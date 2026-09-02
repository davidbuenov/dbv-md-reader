---
description: Fase Simplify del ciclo SDD (dbv-specs-ops) — revisión por pases + refactor
---
Ejecuta ahora la fase **Simplify** (`/code-simplify`) del ciclo Spec→Plan→Build→Test→Simplify→Ship
definido en `dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 5). Sigue los tres pases con
severidad de `dbv-specs-ops/docs/REVIEW.md` (Bugs / Seguridad / Cumplimiento), resuelve todo hallazgo
Crítico, registra lo Importante en `dbv-specs-ops/CHANGELOG.md`, y después refactoriza para reducir complejidad sin
añadir funcionalidad nueva ("clarity over cleverness").

$ARGUMENTS
