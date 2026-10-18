---
description: Fase Test del ciclo SDD (dbv-specs-ops) — tests y evals obligatorios
---
Ejecuta ahora la fase **Test** (`/test`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 4). Crea y ejecuta los tests que falten para el
código construido; ninguna tarea se marca como hecha sin un test que pase. Cada test que valide un
requisito con ID lo cita con `@spec REQ-NN`. Si el proyecto tiene
componentes de IA no deterministas, incluye también Evals. Registra cualquier bug corregido en
`dbv-specs-ops/CHANGELOG.md`.

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Test

Fase 4: tests deterministas etiquetados con @spec y Evals si hay IA no determinista.

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Build (LEADS_TO) — *si:* La porción está implementada, compila o se ejecuta sin errores y está anotada en CHANGELOG.md.
  - *Cómo:* Escribe y ejecuta tests deterministas que citen @spec REQ-NN para cada requisito tocado. Con componentes de IA, añade Evals; con un Agent Plugin, valida plugin.json y mcp.json.
  - *Evita:* No marques una tarea como hecha sin un test en verde. Si un enfoque falla y lo reviertes, regístralo en la Rejection Memory antes de probar otro.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Test → Build (TRIGGERS) — *si:* Algún test o Eval falla.
  - *Cómo:* Corrige la causa en el código y anótalo como Fixed en CHANGELOG.md. Si el fallo desmiente un supuesto de SPECIFICATIONS.md, regístralo en Lecciones Aprendidas de memory.md.
  - *Evita:* No relajes ni borres una aserción para poner el test en verde. No repitas un arreglo que ya se revirtió (míralo en la Rejection Memory).
- Test → Simplify (PROVIDES_INPUT_FOR) — *si:* Todos los tests y Evals pasan, y ningún requisito con ID de la tarea se queda sin test.
  - *Cómo:* Haz los tres pases de docs/REVIEW.md (Bugs, Seguridad, Cumplimiento con <coding_standards>) y, si hay Python, ejecuta dbv-lint.py --changed. Después refactoriza para dar claridad sin cambiar el comportamiento.
  - *Evita:* No añadas funcionalidad nueva. Si un refactor rompe tests y lo reviertes, regístralo en la Rejection Memory.

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Build ↩ Test (LEADS_TO) — *si:* La porción está implementada, compila o se ejecuta sin errores y está anotada en CHANGELOG.md.
- Simplify ↩ Build (TRIGGERS) — *si:* La revisión deja un hallazgo Crítico que exige cambiar el comportamiento del código, o un refactor rompe los tests.
- Simplify → Ship (CONVERGES_TO) — *si:* Cero hallazgos Crítico, dbv-lint.py sin errores (si aplica) y tests en verde tras el refactor.
  - *Cómo:* Imprime <memory_update_proposal>. Actualiza README.md de la raíz, sincroniza DESIGN.md derivado si existe, completa walkthrough.md, pregunta el tipo de versión, publica CHANGELOG.md y propone commit + tag.
  - *Evita:* No ejecutes git push (solo sugiérelo). No cierres sin <memory_update_proposal>. No generes start/stop en apps de escritorio, librerías o CLIs.

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
