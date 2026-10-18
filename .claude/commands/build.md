---
description: Fase Build del ciclo SDD (dbv-specs-ops) — implementación incremental
---
Ejecuta ahora la fase **Build** (`/build`) del ciclo Spec→Plan→Build→Test→Simplify→Ship definido en
`dbv-specs-ops/docs/MASTER_PROMPT.md` (`<workflow>`, paso 3).

Antes de escribir código: si no existe un plan aprobado (`dbv-specs-ops/task.md` con pasos, o
`dbv-specs-ops/implementation_plan.md` para tareas complejas), **no rechaces la petición** — ejecuta
primero, en la misma respuesta, las fases previas que falten (Spec → Plan) siguiendo `<specs_check>` del
`MASTER_PROMPT.md`, y continúa con el Build en cuanto estén resueltas.

Implementa de forma incremental ("one slice at a time"), siguiendo las normas de codificación y
cabeceras de fichero del `MASTER_PROMPT.md`. Etiqueta con `@spec REQ-NN` el código que implemente un
requisito con ID.

<!-- pg-guide:begin · generado desde docs/PROCEDURAL_GRAPH.json — no lo edites a mano: python dbv-specs-ops/scripts/pg-guide.py --write-commands -->
## 🕸️ Grafo de fases — nodo activo: Build

Fase 3: implementación incremental, una porción cada vez, con cabeceras y etiquetas @spec.

**Al entrar** — la transición por la que llegas fija la condición, cómo ejecutar esta fase y qué evitar:
- desde Plan (PROVIDES_INPUT_FOR) — *si:* El plan ha superado el Architect Review y el usuario lo ha aprobado explícitamente.
  - *Cómo:* Implementa una porción cada vez. Cabecera de project.config.md en cada fichero nuevo, @spec REQ-NN en las funciones que implementan un requisito y entrada en CHANGELOG.md [Sin publicar]. Si contradices ARCHITECTURE.md, regístralo ya en memory.md.
  - *Evita:* Varios return fuera de las Guard Clauses iniciales (un solo return final); excepciones o None donde toca el patrón Result; any en TypeScript; .unwrap()/.expect() en comandos IPC de Rust; todo el React en App.tsx; en Tauri sin bundler, ES modules o una constante isTauri (usa IIFE y runningInTauri).
- desde Test (TRIGGERS) — *si:* Algún test o Eval falla.
  - *Cómo:* Corrige la causa en el código y anótalo como Fixed en CHANGELOG.md. Si el fallo desmiente un supuesto de SPECIFICATIONS.md, regístralo en Lecciones Aprendidas de memory.md.
  - *Evita:* No relajes ni borres una aserción para poner el test en verde. No repitas un arreglo que ya se revirtió (míralo en la Rejection Memory).
- desde Simplify (TRIGGERS) — *si:* La revisión deja un hallazgo Crítico que exige cambiar el comportamiento del código, o un refactor rompe los tests.
  - *Cómo:* Vuelve a Build solo para ese hallazgo y repasa Test antes de regresar a Simplify.
  - *Evita:* No mezcles la corrección con funcionalidad nueva. No ocultes el hallazgo rebajando su severidad.

**Salidas** (salto 1) — a dónde puedes ir y con qué condición:
- Build → Test (LEADS_TO) — *si:* La porción está implementada, compila o se ejecuta sin errores y está anotada en CHANGELOG.md.
  - *Cómo:* Escribe y ejecuta tests deterministas que citen @spec REQ-NN para cada requisito tocado. Con componentes de IA, añade Evals; con un Agent Plugin, valida plugin.json y mcp.json.
  - *Evita:* No marques una tarea como hecha sin un test en verde. Si un enfoque falla y lo reviertes, regístralo en la Rejection Memory antes de probar otro.

**Horizonte** (salto 2) — lo que vendrá después y revisará tu trabajo:
- Test ↩ Build (TRIGGERS) — *si:* Algún test o Eval falla.
- Test → Simplify (PROVIDES_INPUT_FOR) — *si:* Todos los tests y Evals pasan, y ningún requisito con ID de la tarea se queda sin test.
  - *Cómo:* Haz los tres pases de docs/REVIEW.md (Bugs, Seguridad, Cumplimiento con <coding_standards>) y, si hay Python, ejecuta dbv-lint.py --changed. Después refactoriza para dar claridad sin cambiar el comportamiento.
  - *Evita:* No añadas funcionalidad nueva. Si un refactor rompe tests y lo reviertes, regístralo en la Rejection Memory.

*Rutas relativas a `dbv-specs-ops/`. Lee la `🚫 Rejection Memory` de `memory.md` antes de proponer un enfoque: lo que ya se descartó no se vuelve a proponer sin explicar qué ha cambiado.*
<!-- pg-guide:end -->

$ARGUMENTS
