---
description: Fase Spec del ciclo SDD (dbv-specs-ops) — define el "qué" y el "por qué"
---
Ejecuta ahora la fase **Spec** (`/spec`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 1). Lee primero
`dbv-specs-ops/project.config.md`, `dbv-specs-ops/docs/SPECIFICATIONS.md`, `dbv-specs-ops/memory.md` y
`dbv-specs-ops/task.md`. Revisa si el requisito ya está definido en `SPECIFICATIONS.md`; si no, pregunta
antes de asumir nada. Todo requisito nuevo lleva un ID único (`REQ-NN`).

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Spec

Fase 1: el qué y el por qué en SPECIFICATIONS.md, con IDs REQ-NN (y DESIGN.md si hay UI).

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Start (LEADS_TO) — *si:* project.config.md ya está configurado y el usuario pide una funcionalidad o un cambio de requisitos.
  - *Cómo:* Lee project.config.md, SPECIFICATIONS.md, memory.md (incluida la Rejection Memory) y task.md. Da a cada requisito nuevo o modificado el siguiente ID libre (máximo + 1).
  - *Evita:* No escribas código en esta fase. No inventes requisitos ambiguos: pregunta. No renumeres ni reutilices IDs.
- desde Bootstrap (PROVIDES_INPUT_FOR) — *si:* El usuario ha confirmado la configuración y project.config.md está guardado.
  - *Cómo:* Si SPECIFICATIONS.md solo tiene placeholders y ya hay código, sigue ADOPTION_PROMPT.md; si no, define los requisitos con IDs y DESIGN.md si hay UI.
  - *Evita:* No pases a /plan con placeholders sin resolver en SPECIFICATIONS.md.
- desde Plan (LEADS_TO) — *si:* El Architect Review revela que la especificación es ambigua o contradictoria, o el usuario rechaza el plan.
  - *Cómo:* Corrige solo la parte de SPECIFICATIONS.md afectada y vuelve a /plan. Registra el enfoque descartado y su motivo en la Rejection Memory de memory.md (REJECTED-NN).
  - *Evita:* No reescribas requisitos que no estaban en cuestión. No borres un enfoque rechazado: se registra para no volver a proponerlo.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Spec → Plan (PROVIDES_INPUT_FOR) — *si:* Los requisitos de la tarea tienen ID y criterios de aceptación verificables, sin preguntas abiertas críticas.
  - *Cómo:* Clasifica el modo (Conductor <= 2 archivos y < 50 líneas; Orquestador si no). Imprime <architect_review> con <evidence> y <confidence_score>; el <adversary> cita un sustantivo concreto de SPECIFICATIONS.md. Desglosa en pasos de <= 50 líneas que citen su ID.
  - *Evita:* No propongas un enfoque que figure como vigente en la Rejection Memory sin decir por qué ya no aplica. No avances a /build con un eje de confianza en low sin validación humana. Si el plan es complejo, no omitas el Frontmatter YAML (dependencies, risks, rollback_strategy).

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Plan ↩ Spec (LEADS_TO) — *si:* El Architect Review revela que la especificación es ambigua o contradictoria, o el usuario rechaza el plan.
- Plan → Build (PROVIDES_INPUT_FOR) — *si:* El plan ha superado el Architect Review y el usuario lo ha aprobado explícitamente.
  - *Cómo:* Implementa una porción cada vez. Cabecera de project.config.md en cada fichero nuevo, @spec REQ-NN en las funciones que implementan un requisito y entrada en CHANGELOG.md [Sin publicar]. Si contradices ARCHITECTURE.md, regístralo ya en memory.md.
  - *Evita:* Varios return fuera de las Guard Clauses iniciales (un solo return final); excepciones o None donde toca el patrón Result; any en TypeScript; .unwrap()/.expect() en comandos IPC de Rust; todo el React en App.tsx; en Tauri sin bundler, ES modules o una constante isTauri (usa IIFE y runningInTauri).

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
