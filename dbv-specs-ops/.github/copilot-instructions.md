# Copilot Instructions — dbv-specs-ops

Este proyecto usa **Spec-Driven Development (SDD)**. Aplica estas instrucciones en todas las interacciones.

## Antes de proponer código

1. Consulta `project.config.md` para obtener nombre, autor, licencia y plantilla de cabeceras del proyecto
2. Consulta `docs/SPECIFICATIONS.md` para entender los requisitos actuales
3. Consulta `docs/ARCHITECTURE.md` para respetar el stack y las decisiones técnicas
4. Consulta `docs/DESIGN.md` para respetar el sistema de diseño visual: colores, tipografía y componentes *(si existe)*
5. Consulta `memory.md` para cargar el contexto cualitativo y decisiones técnicas
6. Consulta `task.md` para conocer el estado actual del proyecto

El workflow completo y las normas de desarrollo están en `docs/MASTER_PROMPT.md`.

## ⚠️ Reglas Core (Puntero Fuerte)

**Lee `docs/MASTER_PROMPT.md` y sigue su flujo de trabajo estrictamente. Si detectas contradicciones entre el prompt y las especificaciones del proyecto, detente e informa antes de proceder.**
Toda la lógica de inicialización (Bootstrap), comprobación de estado (Specs Check), ciclo de vida (Workflow) y estándares de código están definidos centralizadamente allí para evitar redundancia cognitiva.

---

> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** — libre y gratuito · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
