---
description: Fase Ship del ciclo SDD (dbv-specs-ops) — versionado, changelog y release
---
Ejecuta ahora la fase **Ship** (`/ship`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 6). No cierres esta fase si quedan hallazgos
Crítico sin resolver de la revisión de `/code-simplify` (`dbv-specs-ops/docs/REVIEW.md`). Actualiza el
`README.md` de la raíz, completa `dbv-specs-ops/walkthrough.md`, pregunta el tipo de versión (Patch/Minor/
Major), publica `dbv-specs-ops/CHANGELOG.md` y propone el commit + tag de git (sin hacer push). Si el
remoto es GitHub, ofrece una vez el Release automático o manual (`dbv-specs-ops/scripts/release-notes.py`).

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Ship

Fase 6: Memory Gate, documentación, versión semántica, CHANGELOG y tag de git.

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Simplify (CONVERGES_TO) — *si:* Cero hallazgos Crítico, dbv-lint.py sin errores (si aplica) y tests en verde tras el refactor.
  - *Cómo:* Imprime <memory_update_proposal>. Actualiza README.md de la raíz, sincroniza DESIGN.md derivado si existe, completa walkthrough.md, pregunta el tipo de versión, publica CHANGELOG.md y propone commit + tag.
  - *Evita:* No ejecutes git push (solo sugiérelo). No cierres sin <memory_update_proposal>. No generes start/stop en apps de escritorio, librerías o CLIs.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Ship → Simplify (TRIGGERS) — *si:* El gate de /ship encuentra un hallazgo Crítico sin resolver o la documentación contradice el código.
  - *Cómo:* Vuelve a la revisión por pases solo para resolver lo que bloquea la entrega.
  - *Evita:* No publiques una versión con un Crítico abierto.
- Ship → End (LEADS_TO) — *si:* Versión elegida por el usuario, CHANGELOG.md publicado, commit y tag propuestos.
  - *Cómo:* Guarda el Snapshot de Contexto en task.md y resume al usuario lo entregado.
  - *Evita:* No dejes ficheros temporales ni cambios sin reflejar en task.md.

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Simplify → Build (TRIGGERS) — *si:* La revisión deja un hallazgo Crítico que exige cambiar el comportamiento del código, o un refactor rompe los tests.
  - *Cómo:* Vuelve a Build solo para ese hallazgo y repasa Test antes de regresar a Simplify.
  - *Evita:* No mezcles la corrección con funcionalidad nueva. No ocultes el hallazgo rebajando su severidad.
- Simplify ↩ Ship (CONVERGES_TO) — *si:* Cero hallazgos Crítico, dbv-lint.py sin errores (si aplica) y tests en verde tras el refactor.

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
