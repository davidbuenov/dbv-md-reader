---
description: Fase Simplify del ciclo SDD (dbv-specs-ops) — revisión por pases + refactor
---
Ejecuta ahora la fase **Simplify** (`/code-simplify`) del ciclo Spec→Plan→Build→Test→Simplify→Ship
definido en `dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 5). Sigue los tres pases con
severidad de `dbv-specs-ops/docs/REVIEW.md` (Bugs / Seguridad / Cumplimiento), resuelve todo hallazgo
Crítico, registra lo Importante en `dbv-specs-ops/CHANGELOG.md`, y después refactoriza para reducir
complejidad sin añadir funcionalidad nueva ("clarity over cleverness"). Si hay Python 3.8+, ejecuta
también `python dbv-specs-ops/scripts/dbv-lint.py --changed`.

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Simplify

Fase 5: revisión en tres pases (docs/REVIEW.md), dbv-lint.py y refactor de claridad.

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Test (PROVIDES_INPUT_FOR) — *si:* Todos los tests y Evals pasan, y ningún requisito con ID de la tarea se queda sin test.
  - *Cómo:* Haz los tres pases de docs/REVIEW.md (Bugs, Seguridad, Cumplimiento con <coding_standards>) y, si hay Python, ejecuta dbv-lint.py --changed. Después refactoriza para dar claridad sin cambiar el comportamiento.
  - *Evita:* No añadas funcionalidad nueva. Si un refactor rompe tests y lo reviertes, regístralo en la Rejection Memory.
- desde Ship (TRIGGERS) — *si:* El gate de /ship encuentra un hallazgo Crítico sin resolver o la documentación contradice el código.
  - *Cómo:* Vuelve a la revisión por pases solo para resolver lo que bloquea la entrega.
  - *Evita:* No publiques una versión con un Crítico abierto.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Simplify → Build (TRIGGERS) — *si:* La revisión deja un hallazgo Crítico que exige cambiar el comportamiento del código, o un refactor rompe los tests.
  - *Cómo:* Vuelve a Build solo para ese hallazgo y repasa Test antes de regresar a Simplify.
  - *Evita:* No mezcles la corrección con funcionalidad nueva. No ocultes el hallazgo rebajando su severidad.
- Simplify → Ship (CONVERGES_TO) — *si:* Cero hallazgos Crítico, dbv-lint.py sin errores (si aplica) y tests en verde tras el refactor.
  - *Cómo:* Imprime <memory_update_proposal>. Actualiza README.md de la raíz, sincroniza DESIGN.md derivado si existe, completa walkthrough.md, pregunta el tipo de versión, publica CHANGELOG.md y propone commit + tag.
  - *Evita:* No ejecutes git push (solo sugiérelo). No cierres sin <memory_update_proposal>. No generes start/stop en apps de escritorio, librerías o CLIs.

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Build → Test (LEADS_TO) — *si:* La porción está implementada, compila o se ejecuta sin errores y está anotada en CHANGELOG.md.
  - *Cómo:* Escribe y ejecuta tests deterministas que citen @spec REQ-NN para cada requisito tocado. Con componentes de IA, añade Evals; con un Agent Plugin, valida plugin.json y mcp.json.
  - *Evita:* No marques una tarea como hecha sin un test en verde. Si un enfoque falla y lo reviertes, regístralo en la Rejection Memory antes de probar otro.
- Ship ↩ Simplify (TRIGGERS) — *si:* El gate de /ship encuentra un hallazgo Crítico sin resolver o la documentación contradice el código.
- Ship → End (LEADS_TO) — *si:* Versión elegida por el usuario, CHANGELOG.md publicado, commit y tag propuestos.
  - *Cómo:* Guarda el Snapshot de Contexto en task.md y resume al usuario lo entregado.
  - *Evita:* No dejes ficheros temporales ni cambios sin reflejar en task.md.

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
