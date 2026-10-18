---
description: Fase Maintain (opcional) del ciclo SDD (dbv-specs-ops) — diagnóstico de un hallazgo detectado
---
Ejecuta la fase **Maintain** (`/maintain`, Fase 7 opcional) definida en
`dbv-specs-ops/docs/MAINTAIN.md`. Solo aplica si `dbv-specs-ops/project.config.md` declara
"Maintain (Fase 7) → Habilitado: sí". Diagnostica en modo solo lectura la desviación reportada y redacta
el hallazgo como una nueva entrada `## [Detectado automáticamente] <fecha>` en
`dbv-specs-ops/docs/SPECIFICATIONS.md`, siguiendo la estructura Problema/Objetivo/Criterios. No
despliegues nada, no hagas merge de nada — el hallazgo vuelve a entrar por `/plan` como cualquier otro
requisito, y un humano decide si se construye.

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Maintain

Fase 7 (opcional): diagnóstico en solo lectura de una desviación detectada por CI/cron.

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Start (TRIGGERS) — *si:* Maintain está habilitado en project.config.md y el detector determinista (CI/cron) reporta una desviación de banda 2 o superior.
  - *Cómo:* Diagnostica en solo lectura. Si el log supera el presupuesto de contexto, conserva su FINAL (tail), no su principio: el fallo está al final. Consulta la Rejection Memory antes de proponer una causa o un arreglo.
  - *Evita:* No despliegues, no hagas merge y no cambies código. No te quedes con el principio del log (head): el fallo suele estar al final.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Maintain → End (LEADS_TO) — *si:* El hallazgo está redactado como ## [Detectado automáticamente] <fecha> en SPECIFICATIONS.md.
  - *Cómo:* Deja la decisión al humano: el hallazgo reentra por /plan solo si alguien decide abordarlo.
  - *Evita:* No empieces a construir el arreglo en la misma sesión.
- Maintain → Plan (PROVIDES_INPUT_FOR) — *si:* Un humano ha revisado el hallazgo [Detectado automáticamente] y decide abordarlo.
  - *Cómo:* Trata el hallazgo como un requisito más: asígnale un ID y pásalo por el Architect Review.
  - *Evita:* No saltes de Maintain a Build sin plan aprobado.

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Plan → Spec (LEADS_TO) — *si:* El Architect Review revela que la especificación es ambigua o contradictoria, o el usuario rechaza el plan.
  - *Cómo:* Corrige solo la parte de SPECIFICATIONS.md afectada y vuelve a /plan. Registra el enfoque descartado y su motivo en la Rejection Memory de memory.md (REJECTED-NN).
  - *Evita:* No reescribas requisitos que no estaban en cuestión. No borres un enfoque rechazado: se registra para no volver a proponerlo.
- Plan → Build (PROVIDES_INPUT_FOR) — *si:* El plan ha superado el Architect Review y el usuario lo ha aprobado explícitamente.
  - *Cómo:* Implementa una porción cada vez. Cabecera de project.config.md en cada fichero nuevo, @spec REQ-NN en las funciones que implementan un requisito y entrada en CHANGELOG.md [Sin publicar]. Si contradices ARCHITECTURE.md, regístralo ya en memory.md.
  - *Evita:* Varios return fuera de las Guard Clauses iniciales (un solo return final); excepciones o None donde toca el patrón Result; any en TypeScript; .unwrap()/.expect() en comandos IPC de Rust; todo el React en App.tsx; en Tauri sin bundler, ES modules o una constante isTauri (usa IIFE y runningInTauri).

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
