# 🕸️ Grafo de Fases y Rejection Memory

> Inspirado en [*Procedural Graphs: Self-Evolving Execution Structures for LLM Agents*](https://arxiv.org/abs/2609.09153) (Yuxing Lu, Yicheng Chen, Shanchan Wu y Sercan Ö. Arık — Google, Georgia Tech y Peking University; arXiv:2609.09153, septiembre de 2026). Esta página explica qué se ha tomado del paper, qué no y por qué.

---

## 1. La idea del paper, en corto

El paper organiza el «cómo se hace» de una tarea (memoria **procedimental**) como un grafo de tripletas `(procedimiento, relación, procedimiento)`, igual que un grafo de conocimiento organiza hechos como `(entidad, relación, entidad)`. Cada transición lleva tres atributos de texto: **`condition`** (cuándo aplica), **`guidance`** (cómo proceder) y **`pitfalls`** (qué evitar). El vocabulario de relaciones es `LEADS_TO`, `TRIGGERS`, `PROVIDES_INPUT_FOR` y `CONVERGES_TO`.

En cada paso, el agente se localiza en el grafo, se extrae el vecindario de **2 saltos** de su nodo activo y un segundo LLM convierte ese subgrafo en una guía para el siguiente paso. Fuera de línea, un refinador compara trayectorias buenas y malas, propone ediciones del grafo y solo las conserva si la puntuación en un conjunto de validación no baja. Las ediciones rechazadas se guardan como **memoria de rechazo** para no volver a proponerlas.

## 2. Qué hemos adoptado y qué no

| Idea del paper | En dbv-specs-ops | Por qué |
|---|---|---|
| Transiciones con `condition` / `guidance` / `pitfalls` | ✅ [`PROCEDURAL_GRAPH.json`](./PROCEDURAL_GRAPH.json): 10 nodos y 16 transiciones, incluidas las **vueltas atrás** (Plan → Spec, Test → Build, Simplify → Build, Ship → Simplify) | Hace explícitas las puertas entre fases que antes solo estaban en prosa. |
| Contexto local de 2 saltos en vez del grafo completo | ✅ Cada comando de `.claude/commands/` lleva **solo** el vecindario de su fase. `MASTER_PROMPT.md` lleva un puntero, no una copia | En la Tabla 3 del paper, dar el grafo completo empeora la ejecución en ALFWorld (72,58 → 70,34, y 54,48 con guía generativa global), mientras que el subgrafo local llega a 81,53. |
| Memoria de rechazo | ✅ Sección `🚫 Rejection Memory` en `memory.md` | Es lo más barato y lo que mejor se traslada: impide que otra sesión repita un enfoque que ya falló. |
| Comprobación estructural antes de aceptar un grafo | ✅ `pg-guide.py --validate`, también dentro de `dbv-lint.py` | Determinista y sin coste. |
| Truncar las trazas largas por el principio y conservar el final | ✅ Regla en [`MAINTAIN.md`](./MAINTAIN.md) | El fallo suele estar al final del log. |
| LLM de guía que reescribe el subgrafo en cada paso | ❌ El agente lee el bloque tal cual | Una llamada extra por paso no compensa en un ciclo de 6 fases que el usuario dispara a mano. |
| Auto-evolución automática con puerta de validación `S_val` | ❌ Solo el principio, como regla de mantenimiento | Ver el apartado 6. |

**Lo que no prometemos.** Las cifras del paper no se trasladan a este framework:

- Todas sus configuraciones usan un LLM de guía.
- El «70,9 % menos de tokens» es solo ALFWorld, comparado con la guía generativa del grafo completo (18,1 % en GDPval y 14,8 % en MultiChallenge).
- Un grafo experto escrito a mano, sin bucle de evolución, **empeoró** MultiChallenge de 87,50 a 58,93 (Tabla 2).

Por eso el grafo de dbv-specs-ops es pequeño, no inventa reglas nuevas (resume las de `<workflow>`) y se verifica de forma determinista. Lo que sí podemos medir: el bloque de cada fase ocupa entre 2,3 y 3,6 KB, frente a los 11,4 KB del grafo completo.

## 3. Cómo se lee el grafo

- **Semántica de una arista** `(origen, relación, destino)`: el destino es admisible después del origen. `condition` es la puerta para pasar; `guidance` dice cómo ejecutar el paso **destino**; `pitfalls`, qué evitar al ejecutarlo.
- **Localización**: en el paper el agente se localiza por su última acción. Aquí la fase activa la da el comando (`/build`), así que el contexto de una fase reúne:
  - **Al entrar**: las transiciones que llegan a ella, que dicen cómo ejecutarla según de dónde vengas (desde Plan: implementar; desde Test: arreglar un fallo).
  - **Salidas (salto 1)**: a dónde puedes ir y con qué condición.
  - **Horizonte (salto 2)**: lo que vendrá después y revisará tu trabajo. Si una transición vuelve a una fase ya mostrada, solo se indica su condición.

```bash
python dbv-specs-ops/scripts/pg-guide.py --node build      # contexto de una fase (también /build o Build)
python dbv-specs-ops/scripts/pg-guide.py --validate        # estructura del grafo
```

## 4. Rejection Memory

Sección `## 🚫 Rejection Memory` de `memory.md`. Registra enfoques **probados o evaluados y descartados**: una arquitectura que no superó el Architect Review, un arreglo que se revirtió, un refactor que rompió los tests. La IA la lee antes de proponer un enfoque en `/plan`, `/test`, `/code-simplify` y `/maintain`.

```markdown
- **REJECTED-03** (2026-09-28) · Ámbito: CI de AppImage — Intento: ejecutar el AppImage con --appimage-updateinformation → Motivo: arranca la app y bloquea el runner → En su lugar: leer .upd_info con objcopy.
```

- **Diferencia con las Lecciones Aprendidas**: una lección explica algo que pasó; una entrada de rechazo es una restricción que se consulta antes de proponer.
- **Es evidencia, no una orden** (`<trust_boundary>` de `MASTER_PROMPT.md`). Si el contexto cambia, por ejemplo una librería corrige el fallo, se reabre explicándolo. Si el usuario pide expresamente un enfoque descartado, la IA cita la entrada y deja que decida.
- **IDs estables**: el siguiente número es el máximo + 1 y nunca se reutiliza. Una entrada que deja de aplicar se tacha (`~~REJECTED-03~~`) con su motivo, no se borra.
- **Proyectos anteriores a v3.1.0**: la actualización no toca `memory.md`, que es un fichero protegido. La IA crea la sección la primera vez que tiene algo que registrar.

## 5. Cambiar el grafo sin romper nada

1. Edita [`PROCEDURAL_GRAPH.json`](./PROCEDURAL_GRAPH.json). No contradigas `<workflow>` de `MASTER_PROMPT.md`: si cambia una regla, cambia en los dos sitios.
2. `python scripts/pg-guide.py --validate` comprueba IDs y tipos de nodo, relaciones del vocabulario, los tres atributos en cada arista, que no haya duplicados, que el nodo inicial no tenga entradas ni el final salidas, que todo nodo sea alcanzable desde el inicio y que todo nodo llegue al final.
3. `python scripts/pg-guide.py --write-commands` regenera el bloque entre `<!-- pg-guide:begin … -->` y `<!-- pg-guide:end -->` en `.claude/commands/*.md`. El texto propio de cada comando, fuera de los marcadores, no se toca.
4. `python scripts/dbv-lint.py` falla si el grafo es inválido o si un comando del framework no coincide con él. En la copia de `.claude/commands/` de la raíz de un proyecto solo avisa, porque el usuario puede no haber copiado todos los comandos.
5. Ejecuta los evals (`bash scripts/run-evals.sh`). El resumen `📊 Resultado: P/T pasan` no debería bajar respecto a la versión anterior.

## 6. Por qué no hay auto-evolución automática

La mejor cifra del paper (+33,93 puntos en MultiChallenge) sale del bucle iterativo con puerta de validación, no del grafo. Ese bucle necesita cosas que este framework no tiene:

- **Un conjunto de validación real.** `evals/` tiene hoy un solo eval, así que la puntuación solo puede valer 0 o 1.
- **Ejecuciones baratas y repetibles.** Aquí cada una es una llamada de pago y no determinista a un CLI de IA. Incluso con 20 episodios, los autores advierten de que cada aceptación o rechazo «debe leerse como una traza de búsqueda, no como un test de significancia».
- **Un grafo propio de cada proyecto.** El de dbv-specs-ops es del framework, y `UPGRADE_PROMPT.md` lo sobrescribe en cada actualización.

Queda registrado como `REJECTED-05` en `memory.md`, con la condición para reabrirlo: que `evals/` llegue a ser una suite real.
