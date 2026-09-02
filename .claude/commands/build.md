---
description: Fase Build del ciclo SDD (dbv-specs-ops) — implementación incremental
---
Ejecuta ahora la fase **Build** (`/build`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 3).

Antes de escribir código: si no existe un plan aprobado (`dbv-specs-ops/task.md` con pasos, o
`dbv-specs-ops/implementation_plan.md` para tareas complejas), **no rechaces la petición** — ejecuta primero, en la
misma respuesta, las fases previas que falten (Spec → Plan) siguiendo `<specs_check>` del
`dbv-specs-ops/docs/MASTER_PROMPT.md`, y continúa con el Build en cuanto estén resueltas.

Implementa de forma incremental ("one slice at a time"), siguiendo las normas de codificación y
cabeceras de fichero del `dbv-specs-ops/docs/MASTER_PROMPT.md`.

$ARGUMENTS
