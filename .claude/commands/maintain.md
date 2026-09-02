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

$ARGUMENTS
