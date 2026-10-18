#!/usr/bin/env python3
# =============================================================================
# dbv-specs-ops — Deterministic SDD Governance Linter (v3.1.0)
# Copyright (c) 2026 David Bueno Vallejo
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
"""Validador determinista para proyectos dbv-specs-ops. Solo librería estándar (Python 3.8+).

Qué comprueba:
  1. Regla de un solo `return` en ficheros Python (AST): solo se permiten Guard Clauses al
     inicio de la función y un único `return` en la última línea.
  2. Frontmatter YAML (`dependencies`, `risks`, `rollback_strategy`) en `implementation_plan.md`.
  3. Trazabilidad Spec-to-Test: los IDs de requisito declarados en `docs/SPECIFICATIONS.md`
     frente a las etiquetas `@spec <ID>` del código y de los tests (ver --help).
  4. Grafo de fases (`docs/PROCEDURAL_GRAPH.json`, v3.1.0+): estructura válida y bloques de
     `.claude/commands/*.md` sincronizados con él (delegado en `scripts/pg-guide.py`).

Compatibilidad con proyectos anteriores a v3.0.0: si `SPECIFICATIONS.md` no usa IDs de
requisito, la trazabilidad se omite sin avisos. Para no inundar de avisos una base de código
heredada, usa `--changed` (solo lo que has tocado) o `--staged` (pre-commit).

Códigos de salida: 0 = sin errores; 1 = hay errores (o avisos con --strict); 2 = uso/entorno.
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import List, NamedTuple, Optional, Sequence, Set, Tuple, Union

SKIP_DIRS = frozenset({
    ".git", ".hg", ".svn", "node_modules", ".venv", "venv", "env", "__pycache__", "target",
    "dist", "build", "out", ".tox", ".mypy_cache", ".pytest_cache", ".idea", ".vscode",
    "site-packages", ".next", "coverage",
})
TRACE_SUFFIXES = frozenset({
    ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".go", ".java", ".kt", ".cs",
})
TEST_DIRS = frozenset({"test", "tests", "__tests__", "spec", "specs", "e2e"})
TEST_NAME_RE = re.compile(
    r"^test_.*\.py$|_test\.(py|go|rs)$|\.(test|spec)\.[A-Za-z]+$|Tests?\.(java|kt|cs)$"
)
PLACEHOLDER_MARKERS = ("[Nombre del Proyecto]", "[Project Name]")
PLAN_REQUIRED_KEYS = ("dependencies", "risks", "rollback_strategy")
MAX_SOURCE_BYTES = 2_000_000
MAX_IDS_SHOWN = 15

# ID de requisito: REQ-01, RNF-01, RNF-IA.1, RF-IA-01, RF-IA-01.1 ... El formato exacto da igual
# mientras el prefijo sea REQ / RF / RNF y el número no se reutilice.
ID_BODY = r"(?<![A-Za-z0-9_])(?:REQ|RF|RNF)(?:-[A-Z]{2,})?[-.]\d+(?:\.\d+)*(?!\w)"
ID_RE = re.compile(ID_BODY)
# Una declaración es un ID al principio de una línea de lista, encabezado o fila de tabla
# (admite checkbox, negrita, comillas invertidas y corchetes). Una mención en prosa NO declara.
DECLARATION_RE = re.compile(
    r"^[ \t]*(?:(?:[-*+]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?|#{1,6}[ \t]+|\|[ \t]*)?[*`\[]*("
    + ID_BODY + r")",
    re.MULTILINE,
)
TAG_RE = re.compile(r"@spec[ \t]+((?:" + ID_BODY + r")(?:[ \t]*[,/][ \t]*(?:" + ID_BODY + r"))*)")

SIMPLE_STATEMENTS = (
    ast.Assign, ast.AnnAssign, ast.AugAssign, ast.Expr, ast.Assert, ast.Pass,
    ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal,
)
NESTED_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)
LEVEL_ORDER = {"error": 0, "warn": 1, "info": 2}
LEVEL_ICON = {"error": "❌", "warn": "⚠️ ", "info": "ℹ️ "}


class Ok(NamedTuple):
    value: str


class Err(NamedTuple):
    message: str


Result = Union[Ok, Err]


class Finding(NamedTuple):
    level: str  # "error" | "warn" | "info"
    message: str


class TagIndex(NamedTuple):
    in_code: Set[str]
    in_tests: Set[str]


class Selection(NamedTuple):
    files: List[Path]
    notes: List[Finding]
    error: str
    project_scope: bool  # True => además del AST se evalúan plan y trazabilidad


# --------------------------------------------------------------------------- utilidades


def configure_output() -> None:
    """Evita `UnicodeEncodeError` en consolas/redirecciones de Windows (cp1252)."""
    for flujo in (sys.stdout, sys.stderr):
        reconfigure = getattr(flujo, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def read_text(path: Path) -> Result:
    """Lee un fichero como UTF-8. Un fichero ilegible es un hallazgo, no un fallo del linter."""
    try:
        resultado: Result = Ok(path.read_text(encoding="utf-8", errors="replace"))
    except OSError as exc:
        resultado = Err(f"{path.as_posix()}: no se pudo leer ({exc.strerror or exc})")
    return resultado


def shown(path: Path, root: Path) -> str:
    """Ruta relativa a la raíz del proyecto (con `/`) para que la salida sea corta y portable."""
    try:
        texto = path.relative_to(root).as_posix()
    except ValueError:
        texto = path.as_posix()
    return texto


def shown_parts(path: Path, root: Path) -> Tuple[str, ...]:
    """Componentes de la ruta relativos a la raíz (así `C:\\build\\proyecto` no cuenta como carpeta podada)."""
    try:
        partes = path.resolve().relative_to(root).parts
    except ValueError:
        partes = path.resolve().parts
    return partes


def is_inside(path: Path, folder: Path) -> bool:
    """True si `path` está dentro de `folder` (o es `folder`)."""
    try:
        path.relative_to(folder)
        resultado = True
    except ValueError:
        resultado = False
    return resultado


def format_ids(ids: Sequence[str]) -> str:
    """Lista corta de IDs para los mensajes (`REQ-01, REQ-02 … (+3 más)`).

    Un sub-ID (`RF-IA-01.2`) se omite si su padre (`RF-IA-01`) ya está en la lista.
    """
    raices = [i for i in ids if not any(i.startswith(otro + ".") for otro in ids)]
    visibles = ", ".join(raices[:MAX_IDS_SHOWN])
    extra = len(raices) - MAX_IDS_SHOWN
    return f"{visibles} … (+{extra} más)" if extra > 0 else visibles


def find_root(start: Path) -> Path:
    """Raíz del proyecto: el directorio con `.git` más cercano hacia arriba; si no hay, `start`.

    Se usa el directorio de trabajo (no la ubicación del script) para no salirse del proyecto
    cuando el framework vive en una carpeta cuyo padre contiene otros repositorios.
    """
    resultado = start
    for candidato in (start, *start.parents):
        if (candidato / ".git").exists():
            resultado = candidato
            break
    return resultado


def is_pruned(parent: Path, name: str, framework_resolved: Path) -> bool:
    """True si la subcarpeta no debe recorrerse: dependencias, builds, el framework o cualquier
    entorno virtual de Python (se detecta por su marcador `pyvenv.cfg`, sea cual sea su nombre)."""
    candidata = parent / name
    return (
        name in SKIP_DIRS
        or (candidata / "pyvenv.cfg").is_file()
        or candidata.resolve() == framework_resolved
    )


def walk_files(base: Path, suffixes: Sequence[str], framework_dir: Path) -> List[Path]:
    """Ficheros con esas extensiones bajo `base`, podando dependencias, builds y el framework."""
    encontrados: List[Path] = []
    framework_resuelto = framework_dir.resolve()
    for carpeta, subcarpetas, ficheros in os.walk(base):
        actual = Path(carpeta)
        subcarpetas[:] = sorted(d for d in subcarpetas if not is_pruned(actual, d, framework_resuelto))
        encontrados.extend(actual / f for f in sorted(ficheros) if Path(f).suffix in suffixes)
    return encontrados


def list_project_files(root: Path, suffixes: Sequence[str], framework_dir: Path) -> List[Path]:
    """Ficheros del proyecto con esas extensiones.

    En un repositorio git son los versionados más los nuevos no ignorados: así se respeta el
    `.gitignore` (entornos virtuales, builds, runtimes empaquetados). Sin git se recorre el árbol
    podando carpetas conocidas (ver `walk_files`).
    """
    listado = run_git(root, ["ls-files", "-co", "--exclude-standard", "-z"])
    if isinstance(listado, Err):
        return walk_files(root, suffixes, framework_dir)
    try:
        framework_relativo: Tuple[str, ...] = framework_dir.resolve().relative_to(root.resolve()).parts
    except ValueError:
        framework_relativo = ()
    encontrados: List[Path] = []
    for texto in listado.value.split("\0"):
        partes = Path(texto).parts
        valido = (
            bool(texto)
            and Path(texto).suffix in suffixes
            and not any(parte in SKIP_DIRS for parte in partes[:-1])
            and not (framework_relativo and partes[:len(framework_relativo)] == framework_relativo)
            and (root / texto).is_file()
        )
        if valido:
            encontrados.append(root / texto)
    return sorted(encontrados)


# ------------------------------------------------- 1. regla de un solo return (AST)


def own_nodes(node: ast.AST) -> List[ast.AST]:
    """Nodos de `node` sin entrar en funciones, clases ni lambdas anidadas (se analizan aparte)."""
    resultado: List[ast.AST] = []
    if isinstance(node, NESTED_SCOPES):
        return resultado
    pendientes = [node]
    while pendientes:
        actual = pendientes.pop()
        resultado.append(actual)
        pendientes.extend(
            hijo for hijo in ast.iter_child_nodes(actual) if not isinstance(hijo, NESTED_SCOPES)
        )
    return resultado


def return_nodes(stmt: ast.stmt) -> List[ast.Return]:
    """Los `return` que pertenecen al ámbito de la función (no a funciones anidadas)."""
    return sorted(
        (n for n in own_nodes(stmt) if isinstance(n, ast.Return)), key=lambda n: n.lineno
    )


def has_yield(body: Sequence[ast.stmt]) -> bool:
    """Los generadores quedan fuera de la regla: su `return` no devuelve un valor al llamador."""
    return any(
        isinstance(n, (ast.Yield, ast.YieldFrom)) for stmt in body for n in own_nodes(stmt)
    )


def is_guard(stmt: ast.stmt) -> bool:
    """Guard Clause: `if` (con `elif` opcionales, sin `else`) cuyo cuerpo termina en
    `return`/`raise` y no contiene ningún otro `return`. Puede llevar efectos antes de salir."""
    resultado = False
    if isinstance(stmt, ast.If) and stmt.body:
        cierra = isinstance(stmt.body[-1], (ast.Return, ast.Raise))
        sin_extras = not [r for s in stmt.body[:-1] for r in return_nodes(s)]
        cola_valida = not stmt.orelse or (len(stmt.orelse) == 1 and is_guard(stmt.orelse[0]))
        resultado = cierra and sin_extras and cola_valida
    return resultado


def guard_prefix_length(body: Sequence[ast.stmt]) -> int:
    """Cuántas sentencias iniciales forman el bloque de guardas.

    Las guardas pueden ir precedidas de sentencias simples (asignaciones, llamadas) siempre
    que después venga otra guarda; el bloque termina en cuanto aparece lógica compuesta.
    """
    longitud = 0
    for indice, stmt in enumerate(body):
        if is_guard(stmt):
            longitud = indice + 1
        elif not isinstance(stmt, SIMPLE_STATEMENTS):
            break
    return longitud


def strip_docstring(body: Sequence[ast.stmt]) -> List[ast.stmt]:
    """Cuerpo de la función sin su docstring."""
    resultado = list(body)
    if resultado and isinstance(resultado[0], ast.Expr):
        valor = getattr(resultado[0], "value", None)
        if isinstance(valor, ast.Constant) and isinstance(valor.value, str):
            resultado = resultado[1:]
    return resultado


def analyze_function(func: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> List[int]:
    """Líneas de los `return` que incumplen: guardas iniciales y, tras ellas, un único `return`
    en la última sentencia de la función."""
    violaciones: List[int] = []
    cuerpo = strip_docstring(func.body)
    if cuerpo and not has_yield(cuerpo):
        resto = cuerpo[guard_prefix_length(cuerpo):]
        for indice, stmt in enumerate(resto):
            es_ultima = indice == len(resto) - 1
            for nodo in return_nodes(stmt):
                if not (es_ultima and nodo is stmt):
                    violaciones.append(nodo.lineno)
    return violaciones


def check_python_file(path: Path, root: Path) -> List[Finding]:
    """Aplica la regla de un solo `return` a todas las funciones de un fichero Python."""
    hallazgos: List[Finding] = []
    leido = read_text(path)
    if isinstance(leido, Err):
        hallazgos.append(Finding("warn", leido.message))
        return hallazgos
    try:
        arbol = ast.parse(leido.value, filename=str(path))
    except (SyntaxError, ValueError) as exc:
        hallazgos.append(
            Finding("warn", f"{shown(path, root)}: no se pudo analizar ({type(exc).__name__})")
        )
    else:
        for nodo in ast.walk(arbol):
            if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for linea in analyze_function(nodo):
                    hallazgos.append(Finding(
                        "error",
                        f"{shown(path, root)}:{linea} en '{nodo.name}()': `return` fuera de las "
                        "Guard Clauses iniciales o de la última línea.",
                    ))
    return hallazgos


# ------------------------------------------------- 2. frontmatter de implementation_plan.md


def check_plan_frontmatter(framework_dir: Path, root: Path) -> List[Finding]:
    """El plan complejo debe abrir con un Frontmatter YAML con las claves obligatorias."""
    hallazgos: List[Finding] = []
    plan = framework_dir / "implementation_plan.md"
    if not plan.is_file():
        return hallazgos
    leido = read_text(plan)
    if isinstance(leido, Err):
        hallazgos.append(Finding("warn", leido.message))
        return hallazgos
    lineas = leido.value.lstrip("﻿").splitlines()
    nombre = shown(plan, root)
    if not lineas or lineas[0].strip() != "---":
        hallazgos.append(Finding("warn", f"{nombre}: falta el Frontmatter YAML al inicio del plan."))
        return hallazgos
    cierre = next((i for i, linea in enumerate(lineas[1:], 1) if linea.strip() == "---"), None)
    if cierre is None:
        hallazgos.append(Finding("warn", f"{nombre}: el Frontmatter YAML no se cierra con '---'."))
    else:
        claves = set(re.findall(r"^([A-Za-z_][\w-]*)\s*:", "\n".join(lineas[1:cierre]), re.M))
        faltan = [k for k in PLAN_REQUIRED_KEYS if k not in claves]
        if faltan:
            hallazgos.append(Finding(
                "warn", f"{nombre}: faltan claves en el Frontmatter YAML: {', '.join(faltan)}."
            ))
    return hallazgos


# ------------------------------------------------- 3. trazabilidad Spec-to-Test


def related(a: str, b: str) -> bool:
    """Mismo ID, o uno es sub-ID del otro (`RF-IA-01` y `RF-IA-01.2`)."""
    return a == b or a.startswith(b + ".") or b.startswith(a + ".")


def covered(ident: str, tags: Set[str]) -> bool:
    """True si alguna etiqueta apunta a este requisito (o a su padre / hijo)."""
    return any(related(ident, tag) for tag in tags)


def declared_ids(spec_text: str) -> List[str]:
    """IDs declarados en SPECIFICATIONS.md, en orden y con repeticiones (para detectar duplicados)."""
    return [m.group(1) for m in DECLARATION_RE.finditer(spec_text)]


def tags_in_text(text: str) -> Set[str]:
    """IDs referenciados con `@spec` (admite varios separados por coma o barra)."""
    etiquetas: Set[str] = set()
    for coincidencia in TAG_RE.finditer(text):
        etiquetas.update(ID_RE.findall(coincidencia.group(1)))
    return etiquetas


def is_test_file(relative: Path, text: str) -> bool:
    """Heurística: carpeta de tests, nombre de test, o módulo `#[cfg(test)]` en Rust."""
    en_carpeta = any(parte.lower() in TEST_DIRS for parte in relative.parts[:-1])
    rust_inline = relative.suffix == ".rs" and "#[cfg(test)]" in text
    return en_carpeta or rust_inline or bool(TEST_NAME_RE.search(relative.name))


def collect_tags(files: Sequence[Path], root: Path) -> TagIndex:
    """Etiquetas `@spec` del proyecto, separadas entre código y tests."""
    en_codigo: Set[str] = set()
    en_tests: Set[str] = set()
    for ruta in files:
        try:
            demasiado_grande = ruta.stat().st_size > MAX_SOURCE_BYTES
        except OSError:
            demasiado_grande = True
        leido = Err("omitido") if demasiado_grande else read_text(ruta)
        if isinstance(leido, Ok):
            ids = tags_in_text(leido.value)
            destino = en_tests if is_test_file(ruta.relative_to(root), leido.value) else en_codigo
            destino.update(ids)
    return TagIndex(en_codigo, en_tests)


def check_traceability(framework_dir: Path, root: Path, code_files: Sequence[Path]) -> List[Finding]:
    """IDs de SPECIFICATIONS.md frente a etiquetas `@spec`: huérfanos, sin test, colgantes, duplicados."""
    hallazgos: List[Finding] = []
    spec = framework_dir / "docs" / "SPECIFICATIONS.md"
    if not spec.is_file():
        return hallazgos
    leido = read_text(spec)
    if isinstance(leido, Err):
        hallazgos.append(Finding("warn", leido.message))
        return hallazgos
    texto = leido.value
    if any(marca in texto for marca in PLACEHOLDER_MARKERS):
        hallazgos.append(Finding("info", "Trazabilidad omitida: SPECIFICATIONS.md aún es la plantilla."))
        return hallazgos
    declarados = declared_ids(texto)
    if not declarados:
        hallazgos.append(Finding(
            "info",
            "Trazabilidad omitida: SPECIFICATIONS.md no usa IDs de requisito (proyecto anterior a "
            "v3.0.0 o aún sin IDs). Los requisitos nuevos deben llevar un ID (p. ej. REQ-01).",
        ))
        return hallazgos
    unicos = list(dict.fromkeys(declarados))
    duplicados = [i for i in unicos if declarados.count(i) > 1]
    etiquetas = collect_tags(code_files, root)
    todas = etiquetas.in_code | etiquetas.in_tests
    huerfanos = [i for i in unicos if not covered(i, todas)]
    sin_test = [i for i in unicos if covered(i, etiquetas.in_code) and not covered(i, etiquetas.in_tests)]
    colgantes = sorted(t for t in todas if not any(related(t, d) for d in unicos))
    con_test = len(unicos) - len(huerfanos) - len(sin_test)
    hallazgos.append(Finding(
        "info", f"Trazabilidad: {len(unicos)} requisito(s) con ID, {con_test} con test, "
                f"{len(sin_test)} solo en código, {len(huerfanos)} sin etiqueta @spec."
    ))
    if duplicados:
        hallazgos.append(Finding("warn", f"IDs duplicados en SPECIFICATIONS.md: {format_ids(duplicados)}."))
    if huerfanos:
        hallazgos.append(Finding(
            "warn", f"Requisitos sin etiqueta @spec en código ni tests: {format_ids(huerfanos)}."
        ))
    if sin_test:
        hallazgos.append(Finding(
            "warn", f"Requisitos con @spec en código pero sin test etiquetado: {format_ids(sin_test)}."
        ))
    if colgantes:
        hallazgos.append(Finding(
            "warn", f"Etiquetas @spec que no existen en SPECIFICATIONS.md: {format_ids(colgantes)}."
        ))
    return hallazgos


# ------------------------------------------------- 4. grafo de fases (v3.1.0+)


def load_pg_guide(script: Path) -> Result:
    """Importa `pg-guide.py` (el guion del nombre impide un `import` normal)."""
    try:
        spec = importlib.util.spec_from_file_location("dbv_pg_guide", script)
        modulo = importlib.util.module_from_spec(spec) if spec and spec.loader else None
        if modulo is not None:
            spec.loader.exec_module(modulo)
        resultado: Result = Ok(modulo) if modulo is not None else Err(f"{script.name}: no se pudo cargar.")
    except (ImportError, OSError, SyntaxError) as exc:
        resultado = Err(f"{script.name}: no se pudo cargar ({exc}).")
    return resultado


def check_procedural_graph(framework_dir: Path, root: Path) -> List[Finding]:
    """Grafo válido y comandos sincronizados. Sin grafo (framework < 3.1.0) no se comprueba nada.

    Los comandos del framework se generan desde el grafo, así que un desajuste es un error. La copia de
    `.claude/commands/` en la raíz de un proyecto consumidor solo avisa: puede llevar texto propio.
    """
    hallazgos: List[Finding] = []
    grafo = framework_dir / "docs" / "PROCEDURAL_GRAPH.json"
    if not grafo.is_file():
        return hallazgos
    cargado = load_pg_guide(framework_dir / "scripts" / "pg-guide.py")
    if isinstance(cargado, Err):
        hallazgos.append(Finding("warn", f"Grafo de fases no verificado: {cargado.message}"))
        return hallazgos
    pg = cargado.value
    datos = pg.load_graph(grafo)
    problemas = [datos.message] if isinstance(datos, pg.Err) else pg.validate_graph(datos.value)
    hallazgos.extend(Finding("error", f"{shown(grafo, root)}: {p}") for p in problemas)
    if not problemas:
        modelo = pg.build_graph(datos.value)
        script = f"python {shown(framework_dir / 'scripts' / 'pg-guide.py', root)} --write-commands"
        destinos = [(framework_dir / ".claude" / "commands", "error", script)]
        if root.resolve() != framework_dir.resolve():
            raiz = root / ".claude" / "commands"
            destinos.append((raiz, "warn", f"{script} --commands-dir {shown(raiz, root)}"))
        for carpeta, nivel, arreglo in destinos:
            desajustes = pg.sync_commands(modelo, carpeta, write=False, missing_ok=nivel == "warn") if carpeta.is_dir() else []
            hallazgos.extend(
                Finding(nivel, f"{shown(d.path, root)}: {d.reason}. Regenera con: {arreglo}") for d in desajustes
            )
    return hallazgos


# ------------------------------------------------- selección de ficheros (git / rutas)


def run_git(root: Path, command: Sequence[str]) -> Result:
    """Ejecuta `git -C root <command>`; devuelve su salida o el primer mensaje de error."""
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), *command], capture_output=True, text=True,
            encoding="utf-8", errors="replace", check=False, timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        resultado: Result = Err(f"git no disponible ({type(exc).__name__})")
    else:
        lineas_error = [linea for linea in proc.stderr.splitlines() if linea.strip()]
        resultado = Ok(proc.stdout) if proc.returncode == 0 else Err(
            lineas_error[0] if lineas_error else "git devolvió un error"
        )
    return resultado


def git_paths(root: Path, commands: Sequence[Sequence[str]]) -> Tuple[List[Path], str]:
    """Rutas que devuelven uno o varios comandos git (relativas a `root`). Devuelve (rutas, error)."""
    rutas: List[Path] = []
    error = ""
    dentro = run_git(root, ["rev-parse", "--is-inside-work-tree"])
    if isinstance(dentro, Err):
        return rutas, "no se pudo consultar git: " + dentro.message
    for comando in commands:
        salida = run_git(root, comando)
        if isinstance(salida, Err):
            error = salida.message
            break
        rutas.extend(root / linea for linea in salida.value.splitlines() if linea.strip())
    return rutas, error


def expand_paths(paths: Sequence[str], framework_dir: Path) -> List[Path]:
    """Ficheros .py de las rutas dadas (los directorios se recorren podando dependencias)."""
    resultado: List[Path] = []
    for texto in paths:
        ruta = Path(texto).resolve()
        if ruta.is_dir():
            resultado.extend(walk_files(ruta, (".py",), framework_dir))
        else:
            resultado.append(ruta)
    return resultado


def select_python_files(
    args: argparse.Namespace, root: Path, framework_dir: Path, project_files: Sequence[Path]
) -> Selection:
    """Decide qué .py se analizan según los flags; `project_scope` activa plan y trazabilidad."""
    notas: List[Finding] = []
    error = ""
    candidatos: List[Path] = list(project_files)
    if args.staged:
        candidatos, error = git_paths(
            root, [["diff", "--name-only", "--relative", "--diff-filter=ACMR", "--cached"]]
        )
    elif args.paths:
        candidatos = expand_paths(args.paths, framework_dir)
    elif args.changed:
        cambiados, fallo = git_paths(root, [
            ["diff", "--name-only", "--relative", "--diff-filter=ACMR"],
            ["diff", "--name-only", "--relative", "--diff-filter=ACMR", "--cached"],
            ["ls-files", "--others", "--exclude-standard"],
        ])
        if fallo:
            notas.append(Finding("warn", f"--changed no disponible ({fallo}): se analiza todo el proyecto."))
        else:
            candidatos = cambiados
    # Lo autodescubierto (barrido o git) excluye el framework si vive dentro del proyecto;
    # las rutas pasadas a mano se respetan tal cual.
    excluir_framework = not args.paths and framework_dir.resolve() != root.resolve()
    validos = sorted({
        p.resolve() for p in candidatos
        if p.suffix == ".py" and p.is_file()
        and not (excluir_framework and is_inside(p.resolve(), framework_dir.resolve()))
        and not (not args.paths and any(parte in SKIP_DIRS for parte in shown_parts(p, root)))
    })
    return Selection(validos, notas, error, not args.staged and not args.paths)


# ------------------------------------------------- CLI


def parse_args(argv: Optional[Sequence[str]]) -> argparse.Namespace:
    """Argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        prog="dbv-lint.py",
        description="Linter determinista de dbv-specs-ops: regla de un solo return (AST), "
                    "Frontmatter del plan y trazabilidad @spec.",
        epilog="Trazabilidad: declara cada requisito con un ID (REQ-01, RNF-01...) al inicio de su "
               "línea en SPECIFICATIONS.md y cita el ID en el código y en los tests con la etiqueta "
               "@spec seguida del ID. Sin IDs en la spec, la trazabilidad se omite.",
    )
    parser.add_argument("paths", nargs="*", help="Ficheros o carpetas .py concretos a analizar.")
    parser.add_argument("--root", help="Raíz del proyecto (por defecto, el directorio con .git más cercano).")
    selector = parser.add_mutually_exclusive_group()
    selector.add_argument("--changed", action="store_true",
                          help="Solo los .py modificados/nuevos según git (recomendado en proyectos heredados).")
    selector.add_argument("--staged", action="store_true",
                          help="Solo los .py preparados en el índice de git (pensado para pre-commit).")
    parser.add_argument("--strict", action="store_true", help="Los avisos también hacen fallar (exit 1).")
    return parser.parse_args(argv)


def report(findings: Sequence[Finding], analyzed: int, strict: bool) -> int:
    """Imprime los hallazgos ordenados por gravedad y devuelve el código de salida."""
    for hallazgo in sorted(findings, key=lambda f: (LEVEL_ORDER[f.level], f.message)):
        print(f"{LEVEL_ICON[hallazgo.level]} {hallazgo.message}")
    errores = sum(1 for f in findings if f.level == "error")
    avisos = sum(1 for f in findings if f.level == "warn")
    fallo = errores > 0 or (strict and avisos > 0)
    if fallo:
        print(f"❌ dbv-lint: {errores} error(es), {avisos} aviso(s) en {analyzed} fichero(s) Python.")
    else:
        print(f"✅ dbv-lint: {analyzed} fichero(s) Python analizados, sin errores ({avisos} aviso(s)).")
    return 1 if fallo else 0


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Punto de entrada del linter."""
    configure_output()
    args = parse_args(argv)
    framework_dir = Path(__file__).resolve().parent.parent
    root = Path(args.root).resolve() if args.root else find_root(Path.cwd().resolve())
    if not root.is_dir():
        print(f"❌ --root no es un directorio: {root}", file=sys.stderr)
        return 2
    proyecto = [] if (args.staged or args.paths) else list_project_files(root, tuple(TRACE_SUFFIXES), framework_dir)
    seleccion = select_python_files(args, root, framework_dir, [p for p in proyecto if p.suffix == ".py"])
    if seleccion.error:
        print(f"❌ {seleccion.error}", file=sys.stderr)
        return 2
    hallazgos = list(seleccion.notes)
    for ruta in seleccion.files:
        hallazgos.extend(check_python_file(ruta, root))
    if seleccion.project_scope:
        hallazgos.extend(check_plan_frontmatter(framework_dir, root))
        hallazgos.extend(check_traceability(framework_dir, root, proyecto))
        hallazgos.extend(check_procedural_graph(framework_dir, root))
    return report(hallazgos, len(seleccion.files), args.strict)


if __name__ == "__main__":
    sys.exit(main())
