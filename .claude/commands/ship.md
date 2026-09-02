---
description: Fase Ship del ciclo SDD (dbv-specs-ops) — versionado, changelog y release
---
Ejecuta ahora la fase **Ship** (`/ship`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 6). No cierres esta fase si quedan hallazgos
Crítico sin resolver de la revisión de `/code-simplify` (`dbv-specs-ops/docs/REVIEW.md`). Actualiza el
`README.md` de la raíz, completa `dbv-specs-ops/walkthrough.md`, pregunta el tipo de versión (Patch/Minor/
Major), publica `dbv-specs-ops/CHANGELOG.md` y propone el commit + tag de git (sin hacer push).

$ARGUMENTS
