#!/usr/bin/env python3
# =============================================================================
# dbv-specs-ops — Procedural Graph guide: validator, 2-hop context and command sync (v3.1.0)
# Copyright (c) 2026 David Bueno Vallejo
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
"""Grafo de fases de dbv-specs-ops (`docs/PROCEDURAL_GRAPH.json`). Solo librería estándar (Python 3.8+).

Inspirado en *Procedural Graphs* (Lu et al., arXiv:2609.09153): el ciclo SDD se describe como
transiciones (origen, relación, destino) con `condition`, `guidance` y `pitfalls`, y a cada fase solo
se le entrega su vecindario cercano en lugar de todas las reglas de todas las fases.

Qué hace:
  --validate         Comprueba la estructura: IDs, relaciones, atributos y que todo nodo sea alcanzable
                     desde el nodo inicial y llegue al nodo final (sin callejones sin salida).
  --node FASE        Imprime el contexto de una fase (`Build`, `build` o `/build`): las transiciones de
                     entrada (cómo ejecutarla), las salidas y el horizonte a 2 saltos.
  --write-commands   Regenera el bloque del grafo en `.claude/commands/*.md` (entre marcadores).
  --check-commands   Falla si algún comando no coincide con el grafo (lo usa también `dbv-lint.py`).

Códigos de salida: 0 = correcto; 1 = grafo inválido o comandos desincronizados; 2 = uso/entorno.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Sequence, Set, Union

FRAMEWORK_DIR = Path(__file__).resolve().parent.parent
GRAPH_PATH = FRAMEWORK_DIR / "docs" / "PROCEDURAL_GRAPH.json"
COMMANDS_DIR = FRAMEWORK_DIR / ".claude" / "commands"
EDGE_ATTRIBUTES = ("condition", "guidance", "pitfalls")
BEGIN_MARKER = "<!-- pg-guide:begin"
END_MARKER = "<!-- pg-guide:end -->"
BEGIN_LINE = (
    BEGIN_MARKER + " · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: "
    "python dbv-specs-ops/scripts/pg-guide.py --write-commands -->"
)
ARGUMENTS_LINE = "$ARGUMENTS"


class Ok(NamedTuple):
    value: Any


class Err(NamedTuple):
    message: str


Result = Union[Ok, Err]


class Edge(NamedTuple):
    source: str
    relation: str
    target: str
    condition: str
    guidance: str
    pitfalls: str


class Graph(NamedTuple):
    nodes: Dict[str, Dict[str, Any]]
    edges: List[Edge]
    start: str
    end: str


class Drift(NamedTuple):
    path: Path
    reason: str  # "falta el fichero" | "el bloque del grafo no coincide con PROCEDURAL_GRAPH.json"


# --------------------------------------------------------------------------- utilidades


def configure_output() -> None:
    """Evita `UnicodeEncodeError` en consolas/redirecciones de Windows (cp1252)."""
    for flujo in (sys.stdout, sys.stderr):
        reconfigure = getattr(flujo, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def read_text(path: Path) -> Result:
    """Lee un fichero UTF-8 como texto."""
    try:
        resultado: Result = Ok(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError) as exc:
        resultado = Err(f"{path.as_posix()}: no se pudo leer ({exc})")
    return resultado


def load_graph(path: Path) -> Result:
    """Carga el JSON del grafo. Un fichero ausente o mal formado es un `Err`, no una excepción."""
    leido = read_text(path)
    if isinstance(leido, Err):
        return leido
    try:
        resultado: Result = Ok(json.loads(leido.value))
    except ValueError as exc:
        resultado = Err(f"{path.as_posix()}: JSON inválido ({exc})")
    return resultado


def text_field(item: Dict[str, Any], key: str) -> str:
    """Valor de texto de un campo, o cadena vacía si falta o no es texto."""
    valor = item.get(key)
    return valor.strip() if isinstance(valor, str) else ""


# --------------------------------------------------------------------------- validación


def node_issues(data: Dict[str, Any]) -> List[str]:
    """Nodos: lista de objetos con `id` único, `type` permitido, descripción y comando único."""
    problemas: List[str] = []
    nodos = data.get("nodes")
    tipos = data.get("node_types")
    if not isinstance(nodos, list) or not nodos:
        return ["'nodes' debe ser una lista no vacía."]
    tipos_validos = set(tipos) if isinstance(tipos, list) else set()
    vistos: Set[str] = set()
    comandos: Set[str] = set()
    for posicion, nodo in enumerate(nodos):
        if not isinstance(nodo, dict):
            problemas.append(f"Nodo #{posicion}: debe ser un objeto.")
            continue
        ident = text_field(nodo, "id")
        comando = text_field(nodo, "command")
        if not ident:
            problemas.append(f"Nodo #{posicion}: falta 'id'.")
        elif ident in vistos:
            problemas.append(f"Nodo '{ident}': ID duplicado.")
        vistos.add(ident)
        if nodo.get("type") not in tipos_validos:
            problemas.append(f"Nodo '{ident}': tipo '{nodo.get('type')}' fuera de 'node_types'.")
        if not text_field(nodo, "description"):
            problemas.append(f"Nodo '{ident}': falta 'description'.")
        if comando and (not comando.startswith("/") or comando in comandos):
            problemas.append(f"Nodo '{ident}': comando '{comando}' inválido o repetido.")
        comandos.add(comando)
    return problemas


def edge_issues(data: Dict[str, Any], node_ids: Set[str]) -> List[str]:
    """Aristas: extremos existentes, relación del vocabulario, los tres atributos y sin duplicados."""
    problemas: List[str] = []
    aristas = data.get("edges")
    relaciones = data.get("relations")
    if not isinstance(aristas, list) or not aristas:
        return ["'edges' debe ser una lista no vacía."]
    relaciones_validas = set(relaciones) if isinstance(relaciones, list) else set()
    vistas: Set[str] = set()
    for posicion, arista in enumerate(aristas):
        if not isinstance(arista, dict):
            problemas.append(f"Arista #{posicion}: debe ser un objeto.")
            continue
        origen = text_field(arista, "source")
        destino = text_field(arista, "target")
        relacion = text_field(arista, "relation")
        etiqueta = f"Arista #{posicion} ({origen} -{relacion}-> {destino})"
        if origen not in node_ids or destino not in node_ids:
            problemas.append(f"{etiqueta}: apunta a un nodo inexistente.")
        if origen == destino:
            problemas.append(f"{etiqueta}: un nodo no puede transitar a sí mismo.")
        if relacion not in relaciones_validas:
            problemas.append(f"{etiqueta}: relación fuera de 'relations'.")
        faltan = [clave for clave in EDGE_ATTRIBUTES if not text_field(arista, clave)]
        if faltan:
            problemas.append(f"{etiqueta}: faltan atributos: {', '.join(faltan)}.")
        clave_unica = f"{origen}|{relacion}|{destino}"
        if clave_unica in vistas:
            problemas.append(f"{etiqueta}: transición duplicada.")
        vistas.add(clave_unica)
    return problemas


def reachable(start: str, adjacency: Dict[str, List[str]]) -> Set[str]:
    """Nodos alcanzables desde `start` siguiendo la adyacencia dada (BFS)."""
    alcanzados = {start}
    pendientes = deque([start])
    while pendientes:
        actual = pendientes.popleft()
        for vecino in adjacency.get(actual, []):
            if vecino not in alcanzados:
                alcanzados.add(vecino)
                pendientes.append(vecino)
    return alcanzados


def reachability_issues(data: Dict[str, Any], node_ids: Set[str]) -> List[str]:
    """Inicio sin entradas, final sin salidas, todo alcanzable desde el inicio y todo llega al final.

    Equivale a la comprobación estructural previa (`PrepareCandidate`) del Algoritmo 1 del paper,
    endurecida: además de exigir camino hacia un terminal, exige que el terminal sea `end_node` y que
    ningún nodo quede huérfano respecto a `start_node`.
    """
    inicio = text_field(data, "start_node")
    final = text_field(data, "end_node")
    if inicio not in node_ids or final not in node_ids:
        return ["'start_node' y 'end_node' deben ser IDs de nodos existentes."]
    problemas: List[str] = []
    salida: Dict[str, List[str]] = {ident: [] for ident in node_ids}
    entrada: Dict[str, List[str]] = {ident: [] for ident in node_ids}
    for arista in data.get("edges", []):
        origen = text_field(arista, "source") if isinstance(arista, dict) else ""
        destino = text_field(arista, "target") if isinstance(arista, dict) else ""
        if origen in node_ids and destino in node_ids:
            salida[origen].append(destino)
            entrada[destino].append(origen)
    if entrada[inicio]:
        problemas.append(f"El nodo inicial '{inicio}' no puede tener transiciones de entrada.")
    if salida[final]:
        problemas.append(f"El nodo final '{final}' no puede tener transiciones de salida.")
    huerfanos = sorted(node_ids - reachable(inicio, salida))
    sin_salida = sorted(node_ids - reachable(final, entrada))
    if huerfanos:
        problemas.append(f"Nodos inalcanzables desde '{inicio}': {', '.join(huerfanos)}.")
    if sin_salida:
        problemas.append(f"Nodos sin camino hasta '{final}' (callejón sin salida): {', '.join(sin_salida)}.")
    return problemas


def validate_graph(data: Any) -> List[str]:
    """Todas las comprobaciones estructurales. Lista vacía = grafo válido."""
    if not isinstance(data, dict):
        return ["La raíz del grafo debe ser un objeto JSON."]
    problemas = node_issues(data)
    ids = {text_field(n, "id") for n in data.get("nodes", []) if isinstance(n, dict)} - {""}
    problemas.extend(edge_issues(data, ids))
    if not problemas:
        problemas.extend(reachability_issues(data, ids))
    return problemas


def build_graph(data: Dict[str, Any]) -> Graph:
    """Convierte un grafo ya validado en estructuras tipadas (conserva el orden del JSON)."""
    nodos = {text_field(n, "id"): n for n in data["nodes"]}
    aristas = [
        Edge(*(text_field(a, clave) for clave in ("source", "relation", "target", *EDGE_ATTRIBUTES)))
        for a in data["edges"]
    ]
    return Graph(nodos, aristas, text_field(data, "start_node"), text_field(data, "end_node"))


# --------------------------------------------------------------------------- contexto de una fase


def resolve_node(graph: Graph, query: str) -> Optional[str]:
    """Localiza la fase por ID o comando, sin distinguir mayúsculas y con o sin barra (`build`, `/build`)."""
    buscado = query.strip().lower().lstrip("/")
    encontrado: Optional[str] = None
    for ident, nodo in graph.nodes.items():
        comando = text_field(nodo, "command").lower().lstrip("/")
        if buscado and buscado in (ident.lower(), comando):
            encontrado = ident
            break
    return encontrado


def edge_lines(edge: Edge, label: str, full: bool) -> List[str]:
    """Una transición en Markdown; `full=False` solo muestra la condición (vuelta a una fase ya vista)."""
    lineas = [f"- {label} — *si:* {edge.condition}"]
    if full:
        lineas.append(f"  - *Cómo:* {edge.guidance}")
        lineas.append(f"  - *Evita:* {edge.pitfalls}")
    return lineas


def render_context(graph: Graph, node_id: str, hops: int = 2) -> str:
    """Contexto local de una fase: entradas (cómo ejecutarla), salidas (salto 1) y horizonte (salto 2…).

    En el paper el agente se localiza en su último paso completado y lee las transiciones salientes; aquí
    la fase se conoce por el comando, así que las transiciones de entrada aportan el «cómo» de la fase y
    las de salida, las puertas que tendrá que cumplir y lo que revisará su trabajo.
    """
    lineas = [
        f"## 🕸️ Grafo de fases — nodo activo: {node_id}",
        "",
        text_field(graph.nodes[node_id], "description"),
        "",
    ]
    entradas = [e for e in graph.edges if e.target == node_id]
    if entradas:
        lineas.append("**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:")
        for arista in entradas:
            lineas.extend(edge_lines(arista, f"desde {arista.source} ({arista.relation})", True))
        lineas.append("")
    vistos: Set[str] = {node_id}
    frontera: List[str] = [node_id]
    for salto in range(1, hops + 1):
        aristas = [e for e in graph.edges if e.source in frontera]
        if not aristas:
            break
        lineas.append(
            "**Salidas** (salto 1) — a dónde puedes ir y con qué condición:" if salto == 1
            else f"**Horizonte** (salto {salto}) — lo que vendrá después y revisará tu trabajo:"
        )
        siguiente: List[str] = []
        for arista in aristas:
            nueva = arista.target not in vistos
            flecha = "→" if nueva else "↩"
            lineas.extend(edge_lines(arista, f"{arista.source} {flecha} {arista.target} ({arista.relation})", nueva))
            if nueva and arista.target not in siguiente:
                siguiente.append(arista.target)
        vistos.update(siguiente)
        frontera = siguiente
        lineas.append("")
    return "\n".join(lineas).rstrip() + "\n"


# --------------------------------------------------------------------------- comandos de Claude Code


def command_block(graph: Graph, node_id: str) -> str:
    """Bloque generado que se inserta en el comando de la fase."""
    return (
        f"{BEGIN_LINE}\n"
        f"{render_context(graph, node_id)}\n"
        "*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer "
        "un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*\n"
        f"{END_MARKER}"
    )


def splice_block(text: str, block: str) -> str:
    """Sustituye el bloque entre marcadores; si no existe, lo inserta antes de `$ARGUMENTS` (o al final)."""
    inicio = text.find(BEGIN_MARKER)
    fin = text.find(END_MARKER, inicio + 1) if inicio >= 0 else -1
    if inicio >= 0 and fin > inicio:
        resultado = text[:inicio] + block + text[fin + len(END_MARKER):]
    elif ARGUMENTS_LINE in text:
        posicion = text.rfind(ARGUMENTS_LINE)
        resultado = text[:posicion] + block + "\n\n" + text[posicion:]
    else:
        resultado = text.rstrip("\n") + "\n\n" + block + "\n"
    return resultado


def sync_commands(graph: Graph, commands_dir: Path, write: bool, missing_ok: bool = False) -> List[Drift]:
    """Compara (o reescribe, con `write`) el bloque de cada comando con el grafo. Devuelve los desajustes.

    `missing_ok` ignora los comandos ausentes: en la raíz de un proyecto el usuario puede haber copiado
    solo algunos. Lo que hay fuera de los marcadores (texto propio del comando) no se toca.
    """
    desajustes: List[Drift] = []
    for ident, nodo in graph.nodes.items():
        comando = text_field(nodo, "command")
        ruta = commands_dir / f"{comando.lstrip('/')}.md"
        if not comando or (missing_ok and not ruta.is_file()):
            continue
        leido = read_text(ruta)
        if isinstance(leido, Err):
            desajustes.append(Drift(ruta, "falta el fichero o no se puede leer"))
            continue
        esperado = splice_block(leido.value, command_block(graph, ident))
        if esperado != leido.value and write:
            with ruta.open("w", encoding="utf-8", newline="\n") as fichero:  # LF también en Windows (3.8+)
                fichero.write(esperado)
            print(f"✏️  {ruta.name}: bloque del grafo regenerado.")
        elif esperado != leido.value:
            desajustes.append(Drift(ruta, "el bloque del grafo no coincide con PROCEDURAL_GRAPH.json"))
    return desajustes


# --------------------------------------------------------------------------- CLI


def parse_args(argv: Optional[Sequence[str]]) -> argparse.Namespace:
    """Argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        prog="pg-guide.py",
        description="Grafo de fases de dbv-specs-ops: validación, contexto a 2 saltos y sincronía de comandos.",
    )
    accion = parser.add_mutually_exclusive_group()
    accion.add_argument("--validate", action="store_true", help="Solo valida el grafo (acción por defecto).")
    accion.add_argument("--node", help="Fase a mostrar: ID o comando (Build, build o /build).")
    accion.add_argument("--write-commands", action="store_true", help="Regenera el bloque en .claude/commands/*.md.")
    accion.add_argument("--check-commands", action="store_true", help="Falla si algún comando no coincide con el grafo.")
    parser.add_argument("--hops", type=int, default=2, help="Saltos de salida a mostrar con --node (por defecto 2).")
    parser.add_argument("--graph", default=str(GRAPH_PATH), help="Ruta del grafo (por defecto docs/PROCEDURAL_GRAPH.json).")
    parser.add_argument("--commands-dir", default=str(COMMANDS_DIR), help="Carpeta de comandos (por defecto .claude/commands del framework).")
    return parser.parse_args(argv)


def run_action(args: argparse.Namespace, graph: Graph) -> int:
    """Ejecuta la acción pedida sobre un grafo válido y devuelve el código de salida."""
    codigo = 0
    if args.node:
        ident = resolve_node(graph, args.node)
        if ident is None:
            print(f"❌ Fase '{args.node}' no encontrada. Fases: {', '.join(graph.nodes)}.", file=sys.stderr)
            codigo = 2
        else:
            print(render_context(graph, ident, args.hops), end="")
    elif args.write_commands or args.check_commands:
        carpeta = Path(args.commands_dir)
        # Fuera del framework (copia en la raíz del proyecto) el usuario puede no haber copiado todos.
        desajustes = sync_commands(
            graph, carpeta, write=args.write_commands, missing_ok=carpeta.resolve() != COMMANDS_DIR.resolve()
        )
        for desajuste in desajustes:
            print(f"❌ {desajuste.path.as_posix()}: {desajuste.reason}.")
        codigo = 1 if desajustes else 0
        if not desajustes:
            print("✅ Comandos sincronizados con PROCEDURAL_GRAPH.json.")
    else:
        print(f"✅ PROCEDURAL_GRAPH.json válido: {len(graph.nodes)} nodos, {len(graph.edges)} transiciones.")
    return codigo


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Punto de entrada."""
    configure_output()
    args = parse_args(argv)
    if args.hops < 1:
        print("❌ --hops debe ser 1 o mayor.", file=sys.stderr)
        return 2
    cargado = load_graph(Path(args.graph))
    if isinstance(cargado, Err):
        print(f"❌ {cargado.message}", file=sys.stderr)
        return 2
    problemas = validate_graph(cargado.value)
    if problemas:
        print(f"❌ {Path(args.graph).name} no es válido:")
        print("\n".join(f"  - {problema}" for problema in problemas))
        return 1
    return run_action(args, build_graph(cargado.value))


if __name__ == "__main__":
    sys.exit(main())
