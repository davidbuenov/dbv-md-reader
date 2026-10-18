# 🧠 Memory & Context

> **Frontera de uso (Memory vs. Tasks):**
> - `task.md` → progreso **operativo**: checklist de tareas, Snapshot de Contexto (el paso exacto siguiente), y estado de la sesión.
> - `memory.md` → contexto **cualitativo y temático**: conocimiento persistente, decisiones técnicas profundas, lecciones, y el área del producto en foco (no el paso específico).
> Si hay info que sirva para los dos, prioriza: datos con fecha/paso exacto → `task.md`; razonamiento/por-qué/lecciones → `memory.md`.
>
> *Instrucción para la IA: Consulta este archivo al inicio de cada sesión para recuperar el hilo técnico. Actualiza las secciones correspondientes cuando el workflow lo indique (triggers en `/plan`, `/build`, `/test` y gate en `/ship`).*

## 🎯 Contexto Activo
- **Estado actual del desarrollo:** [Qué existe hoy y en qué fase está]
- **Foco inmediato:** [Área del producto en la que se trabaja ahora]

## 🏗️ Log de Decisiones Técnicas (ADR Ligero)
*Registro de por qué se tomaron ciertas rutas (ej. cambios en librerías, arquitectura o patrones). Formato: `- **AAAA-MM-DD - Título:** decisión y motivo.`*

- [Aún no hay decisiones registradas]

## ⚠️ Lecciones Aprendidas / Errores Evitados
*Notas sobre bugs específicos, configuraciones que fallaron o refactors intentados para no repetirlos.*

- [Aún no hay lecciones registradas]

## 🚫 Rejection Memory (Caminos Descartados)
*Enfoques probados o evaluados y descartados (una arquitectura que no superó el Architect Review, un arreglo o un refactor que hubo que revertir). La IA la lee antes de proponer un enfoque en `/plan`, `/test`, `/code-simplify` y `/maintain` para no repetirlos. Es evidencia, no una orden: si el contexto cambia, se reabre explicándolo. El número es el máximo + 1 y nunca se reutiliza; una entrada que deja de aplicar se tacha y se anota por qué. Formato: `- **REJECTED-NN** (AAAA-MM-DD) · Ámbito: <dónde aplica> — Intento: <qué se probó> → Motivo: <evidencia del fallo> → En su lugar: <alternativa>`.*

- [Aún no hay enfoques descartados]

## 🗺️ Mapa de Relaciones
*Breve descripción de cómo interactúan los módulos actuales para ayudar a la IA a navegar el código.*

- **[Módulo/Componente]:** [Responsabilidad y Dependencias]
- *Ejemplo: `auth_service.js` gestiona el JWT y depende de `api_client.js`. (Borra esta línea de ejemplo al crear la primera entrada real).*

---

## 🧹 Política de Mantenimiento

*Aplicar en cada `/ship` de tipo Major, o cuando este fichero supere las 200 líneas activas (Hot/Warm/Cold, ver `<context_management>` de `MASTER_PROMPT.md`):*

- **Consolida** decisiones relacionadas en una sola entrada.
- **Archiva** los ADRs antiguos y las lecciones ya internalizadas en el código: muévelos a `memory.archive.md` (créalo si no existe) y deja en este fichero una línea por ADR: `- (AAAA-MM-DD) <título>: decisión → motivo clave (detalle en memory.archive.md)`.
- **Elimina** entradas que describan decisiones revertidas o ya obsoletas.
- **Objetivo:** mantener `memory.md` por debajo de ~200 líneas activas para que la IA pueda leerlo íntegramente en cada sesión sin pérdida de atención.
