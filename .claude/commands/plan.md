---
description: Fase Plan del ciclo SDD (dbv-specs-ops) — Architect Review y desglose de tareas
---
Ejecuta ahora la fase **Plan** (`/plan`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 2). Si `dbv-specs-ops/docs/SPECIFICATIONS.md`
todavía no tiene contenido real para esta tarea, ejecuta primero la fase Spec en la misma respuesta (no
rechaces la petición). Aplica el Adversarial Architect Review (con `<evidence>` y `<confidence_score>`) y
desglosa el trabajo en `dbv-specs-ops/task.md` (o `dbv-specs-ops/implementation_plan.md` si es complejo),
pidiendo aprobación explícita antes de construir.

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Plan

Fase 2: modo Conductor/Orquestador, Adversarial Architect Review y desglose en task.md (o implementation_plan.md).

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Spec (PROVIDES_INPUT_FOR) — *si:* Los requisitos de la tarea tienen ID y criterios de aceptación verificables, sin preguntas abiertas críticas.
  - *Cómo:* Clasifica el modo (Conductor <= 2 archivos y < 50 líneas; Orquestador si no). Imprime <architect_review> con <evidence> y <confidence_score>; el <adversary> cita un sustantivo concreto de SPECIFICATIONS.md. Desglosa en pasos de <= 50 líneas que citen su ID.
  - *Evita:* No propongas un enfoque que figure como vigente en la Rejection Memory sin decir por qué ya no aplica. No avances a /build con un eje de confianza en low sin validación humana. Si el plan es complejo, no omitas el Frontmatter YAML (dependencies, risks, rollback_strategy).
- desde Maintain (PROVIDES_INPUT_FOR) — *si:* Un humano ha revisado el hallazgo [Detectado automáticamente] y decide abordarlo.
  - *Cómo:* Trata el hallazgo como un requisito más: asígnale un ID y pásalo por el Architect Review.
  - *Evita:* No saltes de Maintain a Build sin plan aprobado.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Plan → Spec (LEADS_TO) — *si:* El Architect Review revela que la especificación es ambigua o contradictoria, o el usuario rechaza el plan.
  - *Cómo:* Corrige solo la parte de SPECIFICATIONS.md afectada y vuelve a /plan. Registra el enfoque descartado y su motivo en la Rejection Memory de memory.md (REJECTED-NN).
  - *Evita:* No reescribas requisitos que no estaban en cuestión. No borres un enfoque rechazado: se registra para no volver a proponerlo.
- Plan → Build (PROVIDES_INPUT_FOR) — *si:* El plan ha superado el Architect Review y el usuario lo ha aprobado explícitamente.
  - *Cómo:* Implementa una porción cada vez. Cabecera de project.config.md en cada fichero nuevo, @spec REQ-NN en las funciones que implementan un requisito y entrada en CHANGELOG.md [Sin publicar]. Si contradices ARCHITECTURE.md, regístralo ya en memory.md.
  - *Evita:* Varios return fuera de las Guard Clauses iniciales (un solo return final); excepciones o None donde toca el patrón Result; any en TypeScript; .unwrap()/.expect() en comandos IPC de Rust; todo el React en App.tsx; en Tauri sin bundler, ES modules o una constante isTauri (usa IIFE y runningInTauri).

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Spec ↩ Plan (PROVIDES_INPUT_FOR) — *si:* Los requisitos de la tarea tienen ID y criterios de aceptación verificables, sin preguntas abiertas críticas.
- Build → Test (LEADS_TO) — *si:* La porción está implementada, compila o se ejecuta sin errores y está anotada en CHANGELOG.md.
  - *Cómo:* Escribe y ejecuta tests deterministas que citen @spec REQ-NN para cada requisito tocado. Con componentes de IA, añade Evals; con un Agent Plugin, valida plugin.json y mcp.json.
  - *Evita:* No marques una tarea como hecha sin un test en verde. Si un enfoque falla y lo reviertes, regístralo en la Rejection Memory antes de probar otro.

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
