# Instrucciones del Proyecto para Claude Code

Este proyecto sigue la metodología **Spec-Driven Development (SDD)**. Lee estos archivos al inicio de cada sesión antes de proponer cualquier código o plan:

| Archivo | Propósito |
| --- | --- |
| `project.config.md` | Identidad del proyecto: nombre, autor, licencia y plantilla de cabeceras |
| `docs/MASTER_PROMPT.md` | Workflow obligatorio, normas y límites |
| `docs/SPECIFICATIONS.md` | Requisitos del proyecto actual |
| `docs/ARCHITECTURE.md` | Stack y decisiones técnicas |
| `docs/DESIGN.md` | Sistema de diseño visual: tokens de color, tipografía, componentes y filosofía *(si existe)* |
| `memory.md` | **Contexto y Decisiones:** Conocimiento cualitativo (ADRs, lecciones, mapa) |
| `task.md` | Estado actual + Snapshot de Contexto |

> **Nota de rutas (aislamiento en subcarpeta):** En proyectos consumidores donde este framework vive dentro de la subcarpeta `dbv-specs-ops/`, antepón `dbv-specs-ops/` a todas las rutas de la tabla anterior (p. ej. `dbv-specs-ops/docs/MASTER_PROMPT.md`, `dbv-specs-ops/task.md`). Si `docs/MASTER_PROMPT.md` existe en la raíz del workspace, estás en el repositorio del propio framework y las rutas son las de la tabla.

## ⚠️ Reglas Core (Puntero Fuerte)

**Lee `docs/MASTER_PROMPT.md` y sigue su flujo de trabajo estrictamente. Si detectas contradicciones entre el prompt y las especificaciones del proyecto, detente e informa antes de proceder.**
Toda la lógica de inicialización (Bootstrap), comprobación de estado (Specs Check), ciclo de vida (Workflow) y estándares de código están definidos centralizadamente allí para evitar redundancia cognitiva.


> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** — libre y gratuito · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
