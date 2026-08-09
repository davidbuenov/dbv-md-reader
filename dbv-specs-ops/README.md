# ⚡ dbv-specs-ops

> *The blueprint that turns any AI assistant into a disciplined Senior Engineer.*
> *La plantilla que convierte cualquier asistente IA en un Ingeniero Senior disciplinado.*

<p align="right"><a href="#español">🇪🇸 Español</a> · <a href="#english">🇬🇧 English</a></p>

![Version](https://img.shields.io/badge/version-2.3.0-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## 📑 Table of Contents / Índice

**🇬🇧 English**
- [Key Features](#en-features)
- [Origin & Inspiration](#en-origin)
- [Visual Workflow](#en-workflow)
- [The 6 Development Phases](#en-phases)
- [File Structure](#en-structure)
- [Platform Activation](#en-platforms)
- [Quick Start](#en-quickstart)
- [Adopting an Existing Project](#en-adoption)
- [Upgrading an Existing Project](#en-upgrade)
- [Example Usage](#en-example)
- [FAQ](#en-faq)
- [Contributing](#en-contributing)

**🇪🇸 Español**
- [Características Principales](#es-features)
- [Origen e Inspiración](#es-origin)
- [Flujo de Trabajo Visual](#es-workflow)
- [Las 6 Fases de Desarrollo](#es-phases)
- [Estructura de Archivos](#es-structure)
- [Activación por Plataforma](#es-platforms)
- [Cómo usar (Quick Start)](#es-quickstart)
- [Incorporar a un Proyecto Existente](#es-adoption)
- [Actualizar el Framework](#es-upgrade)
- [Ejemplo de Uso](#es-example)
- [FAQ / Preguntas Frecuentes](#es-faq)
- [Contribuir](#es-contributing)

**General**
- [Estado / Status](#status)
- [Autores y Créditos / Authors & Credits](#credits)
- [Inspiración y Referencias / Inspiration & References](#references)

---

<a name="english"></a>
## 🇬🇧 English

**dbv-specs-ops** is a lightweight engineering system designed to maximize software quality and context persistence in AI-assisted development.

This repository acts as a **master blueprint** that transforms your AI assistant from a simple code generator into a Senior Software Engineer that follows rigorous processes.

---

<a name="en-features"></a>
### ✨ Key Features

*   **Spec-Driven Development (SDD) Lifecycle**: A strict 6-phase flow (*Spec → Plan → Build → Test → Simplify → Ship*) that ensures your AI assistant understands the "why" and "what" before writing a single line of code.
*   **Context & Token Economics**: Leverages structured persistence files (`memory.md` for qualitative design decisions and `task.md` for task logs) to eliminate AI amnesia and optimize token consumption in large projects.
*   **Dual Coding Modes**: The AI self-classifies tasks as *Conductor Mode* (quick, interactive IDE edits) or *Orchestrator Mode* (autonomous, background tasks using asynchronous commands).
*   **Unified Validation (Tests & Evals)**: Combines classical deterministic testing with non-deterministic AI Evals (LLM Judges, formatting checks, and hallucination scans) in the `/test` phase.
*   **Security Review Gate**: A mandatory `/code-simplify` phase that automatically audits code for credential leaks, dependency squatting (*slopsquatting*), and input sanitization.
*   **Declarative Agent Harness**: Configures how the AI interacts with local sandbox environments and resources via the universal **Agent Plugins 1.0.0** standard.
*   **Native Agent Readiness (Web/APIs)**: If enabled, it automatically bootstraps the standard files, headers, and directories (`robots.txt` with Content-Signals, `llms.txt`, `auth.md`, catálogos en `.well-known/` and a unified **Agent Plugin** directory containing `plugin.json` and `mcp.json` specs) to make your web project perfectly readable and discoverable for external AI agents.
*   **Zero-Collision Upgrades**: A dedicated upgrade prompt agent that automatically migrates your project's framework files without touching your source code or custom specs.
*   **Design Enrichment & Audits (Optional)**: Seamlessly integrates community visual design tools (**[Impeccable](https://github.com/pbakaus/impeccable)** for dual-agent accessibility/contrast audits and Nielsen heuristics, and **[SkillUI](https://github.com/amaancoderx/npxskillui)** for extraction/reverse engineering of design tokens from reference URLs).

---

<a name="en-origin"></a>
### 📑 Origin & Inspiration

This workflow is a unified, simplified version of industry pillars, adapted to be lightweight and highly effective:

1. **[Agent Skills (Google/Addy Osmani)](https://github.com/addyosmani/agent-skills):** The **process and technical workflow** (Cycle: Spec → Plan → Build → Test → Simplify → Ship).
2. **[GitHub Spec-Kit](https://github.com/github/spec-kit):** The **quality of specification**, focusing on understanding the problem, risks, and open questions before coding.
3. **[AI Coding Best Practices](https://github.com/davidbuenov/ai-coding-best-practices):** The final layer of **style and excellence** that dictates how the final code should be written.
4. **[design.md (Google Labs)](https://github.com/google-labs-code/design.md):** The **visual design system standard** — a format for describing a visual identity to coding agents, now integrated as `docs/DESIGN.md`.
5. **[The New SDLC With Vibe Coding (Google/Addy Osmani et al.)](https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding):** The theoretical foundation for **Agentic Engineering** (transitioning from prompting to a controlled codebase factory model, Evals, and Harness engineering).
6. **[Agent Plugins](https://agent-plugins.org/specification):** The **vendor-neutral standard** (by Google, Amazon, Microsoft, OpenAI, Vercel) for packaging Agent Skills and MCP servers into a portable unit, integrated under `docs/AGENT_PLUGINS.md`.

---

<a name="en-workflow"></a>
### 🗺️ Visual Workflow

```mermaid
flowchart TD
    Spec["Spec<br/>(docs/SPECIFICATIONS.md)<br/>+ Agent Plugins viability"] --> Plan["Plan<br/>(task.md, implementation_plan.md)<br/>+ Mode: Conductor/Orchestrator"]
    Plan --> Build["Build<br/>(incremental)"]
    Build --> Test["Test<br/>+ deterministic tests<br/>+ non-deterministic Evals"]
    Test --> Simplify["Code Simplify<br/>+ Security Review<br/>(secrets & dependencies check)"]
    Simplify --> Ship["Ship<br/>(walkthrough.md, README.md)<br/>+ versioning & release tag"]
    Ship -- "Context persists (memory.md)" --> Plan
```

---

<a name="en-phases"></a>
### ⚩️ The 6 Development Phases

Each phase has a **trigger command** you can type in the chat at any time. The AI will always respect this order — never skipping a phase without your approval.

| # | Phase | Command | What the AI does | What you do | Output |
|---|---|---|---|---|---|
| 1 | **Spec** | `/spec` | Reviews if the requirement is defined in `SPECIFICATIONS.md`. If not, asks clarifying questions before acting. | Describe the feature or change you need. | Updated `SPECIFICATIONS.md` |
| 2 | **Plan** | `/plan` | **Architect Review:** Validates specs for edge cases first. If valid, breaks the work into atomic steps. For complex tasks, creates `implementation_plan.md` and waits for explicit approval. | Review and approve the plan. | `task.md` + `implementation_plan.md` |
| 3 | **Build** | `/build` | Implements logic incrementally. Adds file headers, sets up `venv` for Python, generates startup scripts, updates `CHANGELOG.md [Unreleased]`. | Sit back. Review the code if you wish. | Source code + `CHANGELOG.md` updated |
| 4 | **Test** | `/test` | Creates and runs unit or integration tests. A task is **not marked as done** without a passing test. Fixes found bugs and logs them in `CHANGELOG.md`. | Run the tests if you want to confirm locally. | Test files + `CHANGELOG.md` updated |
| 5 | **Simplify** | `/code-simplify` | Refactors for clarity and reduces complexity. No new features — only polish. "Clarity over cleverness." | Optional: review and validate the refactor. | Cleaner, simpler code |
| 6 | **Ship** | `/ship` | Updates `README.md`, completes `walkthrough.md`, asks for version type (Patch / Minor / Major), publishes `CHANGELOG.md`, proposes git commit + tag. | Choose the version type and confirm. | Versioned release 🚀 |

> **Tip:** You can jump to any phase by command. For example, type `/ship` when you're ready to deliver and the AI will handle versioning, changelog and git automatically.

---

<a name="en-structure"></a>
### 📂 File Structure

All control files of the framework reside inside the `dbv-specs-ops/` folder:

#### `/dbv-specs-ops/docs` folder:
| File | Purpose |
|---|---|
| [`MASTER_PROMPT.md`](./dbv-specs-ops/docs/MASTER_PROMPT.md) | The brain of the system. Rules, workflow and constraints the AI must follow. |
| [`SPECIFICATIONS.md`](./dbv-specs-ops/docs/SPECIFICATIONS.md) | The "What" and "Why". Problem, objectives and acceptance criteria. |
| [`ARCHITECTURE.md`](./dbv-specs-ops/docs/ARCHITECTURE.md) | The "How". Tech stack, design decisions and system structure. |
| [`DESIGN.md`](./dbv-specs-ops/docs/DESIGN.md) | The "Look". Visual design system: color tokens, typography, spacing and UI components. *(Optional for projects without UI)* |
| [`DESIGN_ENRICHMENT.md`](./dbv-specs-ops/docs/DESIGN_ENRICHMENT.md) | Optional guide for visual audits and reverse-engineering design tokens (Impeccable & SkillUI). |

#### `/dbv-specs-ops/` (Framework Root):
| File | Purpose |
|---|---|
| [`project.config.md`](./dbv-specs-ops/project.config.md) | Project identity: name, author, license and file header template. Filled by the AI during the bootstrap interview. |
| [`CHANGELOG.md`](./dbv-specs-ops/CHANGELOG.md) | Version history. The AI updates the `[Unreleased]` section during `/build` and `/test`, and publishes it on each `/ship`. |
| [`task.md`](./dbv-specs-ops/task.md) | The logbook. Quantitative progress (checklist), backlog, and **Context Snapshots**. |
| [`memory.md`](./dbv-specs-ops/memory.md) | **Context and Decisions.** Qualitative knowledge: active context, technical decisions (ADRs), lessons learned, and relations map. AI must consult it at session start. |
| [`implementation_plan.md`](./dbv-specs-ops/implementation_plan.md) | Created at the `/plan` phase. Detailed technical plan for the AI to fill in and get approved before building. |
| [`walkthrough.md`](./dbv-specs-ops/walkthrough.md) | Created at the `/ship` phase. Summary of what was built, tested and delivered. |

---

<a name="en-platforms"></a>
### 🤖 Platform Activation

Each AI assistant loads context differently. Use the corresponding file:

| Platform | Activation file | Loading |
|---|---|---|
| **Claude Code** (CLI / VS Code / Desktop) | `CLAUDE.md` | Automatic at session start |
| **GitHub Copilot** (VS Code / JetBrains) | `.github/copilot-instructions.md` | Automatic in the workspace |
| **Cursor** | `CLAUDE.md` (compatible) | Automatic |
| **Antigravity** (VS Code · by Google DeepMind) | `GEMINI.md` (auto) + `ANTIGRAVITY.md` (docs & extra setup) | Automatic (+ optional manual KI setup) |
| **Windsurf** | `.windsurfrules` | Automatic |
| **ChatGPT / Gemini Web** | `docs/MASTER_PROMPT.md` | Manual: attach or paste in the first message |
| **Gemini CLI** | `GEMINI.md` | Automatic |

---

<a name="en-quickstart"></a>
### 🚀 Quick Start & Integration (Subfolder Isolation)

This framework is designed to live in a dedicated subdirectory (`dbv-specs-ops/`) inside your project's workspace. This keeps your root folder clean, avoids overwriting project files, and keeps SDD metadata isolated.

#### Step 1 — Copy the Framework Folder
Create a folder named `dbv-specs-ops` in the root of your project, and copy all the files from this repository into it.

#### Step 2 — Place the Activation Files in the Root
Since AI assistants only load configuration files from the workspace root directory, you **must copy or create** the appropriate activation file(s) in the root of your project to redirect the AI:

*   **For Claude Code / Cursor (`CLAUDE.md` in root):**
    ```markdown
    Please read and follow the master instructions in dbv-specs-ops/docs/MASTER_PROMPT.md. All specs, tasks, and memory logs are located inside the dbv-specs-ops/ folder.
    ```
*   **For GitHub Copilot (`.github/copilot-instructions.md` in root):**
    ```markdown
    Este proyecto usa Spec-Driven Development (SDD). Las reglas, especificaciones y tareas se encuentran en el subdirectorio `dbv-specs-ops/`.
    Lee y sigue estrictamente `dbv-specs-ops/docs/MASTER_PROMPT.md`.
    ```
*   **For Windsurf (`.windsurfrules` in root):**
    ```json
    {
      "rules": [
        "Please read and follow the master instructions in dbv-specs-ops/docs/MASTER_PROMPT.md. All specs, tasks, and memory logs are located inside the dbv-specs-ops/ folder."
      ]
    }
    ```
*   **For Gemini CLI / Antigravity (`GEMINI.md` in root):**
    ```markdown
    Please follow the SDD rules and files located in `dbv-specs-ops/`.
    Master prompt is at `dbv-specs-ops/docs/MASTER_PROMPT.md`.
    ```

#### Step 3 — Open your AI assistant and kick off the session
Depending on your project state, write the following to your AI assistant:

*   **For New Projects (Quick Start):**
    Simply write `/spec` (or paste `dbv-specs-ops/docs/MASTER_PROMPT.md` if using a manual interface like ChatGPT web). The AI will start the Engineering Interview to define the application requirements, filling out `dbv-specs-ops/docs/SPECIFICATIONS.md`.
*   **For Existing Projects (Adoption):**
    Type the following message:
    > "Adapt this project to the SDD methodology using the framework configuration inside the `dbv-specs-ops` folder. Refer to `dbv-specs-ops/docs/ADOPTION_PROMPT.md` for instructions."
    The AI will analyze your existing files and run the interview to populate the SDD files under `dbv-specs-ops/`.

---

<a name="en-upgrade"></a>
### ⬆️ Upgrading an Existing Project

Already using dbv-specs-ops and want to get the latest features? You only need **one file**.

#### Step 1 — Download `UPGRADE_PROMPT.md`

> **[⬇️ Download UPGRADE_PROMPT.md](https://raw.githubusercontent.com/davidbuenov/dbv-specs-ops/master/docs/UPGRADE_PROMPT.md)**
>
> Right-click → Save As → save it as `docs/UPGRADE_PROMPT.md` inside your project.

#### Step 2 — Tell your AI

```
Read docs/UPGRADE_PROMPT.md and upgrade my project.
```

That's it. The AI detects your current version, calculates what needs updating, and applies only the framework files.

#### What the AI will do
- ✅ Detect your current framework version (reads `project.config.md` or asks you)
- ✅ Download and update only the framework files that changed since your version
- ✅ Add new optional files if missing (e.g. `docs/DESIGN.md` for UI projects)
- ✅ Show you a full summary of every change applied

#### What the AI will NEVER touch

| File | Why it's protected |
|---|---|
| `docs/SPECIFICATIONS.md` | Your project requirements |
| `docs/ARCHITECTURE.md` | Your technical decisions |
| `task.md` | Your backlog and project state |
| `CHANGELOG.md` | Your version history |
| `README.md` | Your project documentation |
| All source code | Your application |

---


### 🧑‍💻 Example Usage

**1. Phase 0: Specification**

`docs/SPECIFICATIONS.md`:
```markdown
- Problema: "Los usuarios olvidan tareas importantes."
- Objetivo: "Crear un sistema de recordatorios multiplataforma."
- Funcionalidad A: "El usuario puede crear, editar y eliminar recordatorios."
```

**2. Plan:**

`task.md`:
```markdown
- [ ] Implementar modelo Reminder
- [ ] Crear API REST para recordatorios
- [ ] Añadir tests unitarios para Reminder
```

**3. Build / Test / Ship:**

The cycle continues until the result is delivered and documented in `walkthrough.md`.

---

<a name="en-faq"></a>
### ❓ FAQ

**Can I use this template with any AI assistant?**
Yes, it includes activation files for Claude, Copilot, Gemini, Antigravity, Windsurf and ChatGPT.

**What if I already have code?**
Follow the "Adopting an Existing Project" section and use `docs/ADOPTION_PROMPT.md`.

**What if the AI doesn't follow the cycle?**
Make sure it has read `docs/MASTER_PROMPT.md` and that the context is up to date in `task.md`.

**How do I contribute?**
Fork, create a descriptive branch, and open a Pull Request. See the Contributing section below.

---

<a name="en-contributing"></a>
### 🤝 Contributing

1. Fork the repository and create a descriptive branch.
2. Make your changes following the cycle: Spec → Plan → Build → Test → Simplify → Ship.
3. Open a Pull Request explaining the reason and the impact.
4. If it's a methodology improvement, add examples and update the documentation.

---
---

<a name="español"></a>
## 🇪🇸 Español

**dbv-specs-ops** es un motor de ingeniería simplificado diseñado para maximizar la calidad del software y la persistencia del contexto en el desarrollo asistido por Inteligencia Artificial.

Este repositorio actúa como un "Blueprint" o plano maestro que transforma a la IA de un simple generador de código en un Ingeniero de Software Senior que sigue procesos rigurosos.

---

<a name="es-features"></a>
### ✨ Características Principales

*   **Ciclo Spec-Driven Development (SDD)**: Un flujo riguroso de 6 fases (*Spec → Plan → Build → Test → Simplify → Ship*) que asegura que tu asistente de IA entienda el "por qué" y el "qué" antes de escribir una sola línea de código.
*   **Optimización de Contexto y Token Economics**: Utiliza archivos de persistencia estructurados (`memory.md` para decisiones cualitativas de diseño y `task.md` para registro de tareas) para eliminar la amnesia de la IA y optimizar el consumo de tokens en proyectos grandes.
*   **Modos de Trabajo Inteligentes**: La IA clasifica automáticamente las tareas en *Modo Conductor* (ediciones rápidas e interactivas en el IDE) o *Modo Orquestador* (tareas autónomas de fondo mediante comandos asíncronos).
*   **Validación Unificada (Tests & Evals)**: Combina pruebas deterministas clásicas con Evals probabilísticos de IA (jueces LLM, verificación de formatos y detección de alucinaciones) en la fase `/test`.
*   **Puerta de Auditoría de Seguridad**: Una fase `/code-simplify` obligatoria que audita el código generado buscando fugas de credenciales, dependencias alucinadas o falsas (*slopsquatting*) y validación de entradas.
*   **Arnés del Agente Declarativo**: Configura cómo interactúa el agente con entornos virtuales aislados y recursos mediante el estándar universal **Agent Plugins 1.0.0**.
*   **Agent Readiness por Defecto (Web/APIs)**: Prepara automáticamente los ficheros, cabeceras e infraestructura de autodescubrimiento (`robots.txt` con Content-Signals, `llms.txt`, `auth.md`, catálogos en `.well-known/` y una carpeta de **Agent Plugin** conteniendo `plugin.json` y `mcp.json` estándar) para que los agentes de IA externos naveguen y consuman tu sitio web eficientemente.
*   **Actualizaciones Sin Colisiones**: Un agente de actualización dedicado (`docs/UPGRADE_PROMPT.md`) que migra los ficheros del framework sin tocar tu código fuente ni tus especificaciones personalizadas.
*   **Enriquecimiento y Auditoría de Diseño (Opcional)**: Integra herramientas visuales comunitarias (**[Impeccable](https://github.com/pbakaus/impeccable)** para auditorías de contraste/accesibilidad y heurísticas Nielsen, y **[SkillUI](https://github.com/amaancoderx/npxskillui)** para extracción e ingeniería inversa de tokens a partir de URLs de referencia).

---

<a name="es-origin"></a>
### 📑 Origen e Inspiración

Este flujo de trabajo es una versión unificada y simplificada de varios pilares de la industria:

1. **[Agent Skills (Google/Addy Osmani)](https://github.com/addyosmani/agent-skills):** El **proceso y el flujo de trabajo** técnico (Ciclo: Spec → Plan → Build → Test → Simplify → Ship).
2. **[GitHub Spec-Kit](https://github.com/github/spec-kit):** La **calidad de la especificación**, enfocándonos en entender el problema antes de codificar.
3. **[AI Coding Best Practices](https://github.com/davidbuenov/ai-coding-best-practices):** La capa de **estilo y excelencia** que dicta cómo debe escribirse el código final.
4. **[design.md (Google Labs)](https://github.com/google-labs-code/design.md):** El **estándar de sistema de diseño visual** — un formato para describir identidades visuales a agentes de codificación, ahora integrado como `docs/DESIGN.md`.
5. **[The New SDLC With Vibe Coding (Google/Addy Osmani et al.)](https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding):** La base teórica para la **Ingeniería Agéntica** (transición desde el prompting casual hacia un modelo controlado de fábrica de código, Evals y diseño del arnés).
6. **[Agent Plugins](https://agent-plugins.org/specification):** El **estándar neutral de la industria** (Google, Amazon, Microsoft, OpenAI, Vercel) para empaquetar Agent Skills y servidores MCP, integrado bajo `docs/AGENT_PLUGINS.md`.

---

<a name="es-workflow"></a>
### 🗺️ Flujo de Trabajo Visual

```mermaid
flowchart TD
    Spec["Spec<br/>(docs/SPECIFICATIONS.md)<br/>+ Viabilidad de Agent Plugins"] --> Plan["Plan<br/>(task.md, implementation_plan.md)<br/>+ Modo: Conductor o Orquestador"]
    Plan --> Build["Build<br/>(incremental)"]
    Build --> Test["Test<br/>+ pruebas deterministas<br/>+ Evals de trayectoria y output"]
    Test --> Simplify["Code Simplify<br/>+ Security Review<br/>(auditoría de secretos/paquetes)"]
    Simplify --> Ship["Ship<br/>(walkthrough.md, README.md)<br/>+ versión y git tag"]
    Ship -- "El contexto persiste (memory.md)" --> Plan
```

---

<a name="es-structure"></a>
### 📂 Estructura de Archivos

Todos los archivos de control del framework residen dentro de la subcarpeta `dbv-specs-ops/` en tu espacio de trabajo:

#### Carpeta `/dbv-specs-ops/docs`:
| Archivo | Propósito |
|---|---|
| [`MASTER_PROMPT.md`](./dbv-specs-ops/docs/MASTER_PROMPT.md) | El cerebro del sistema. Reglas, workflow y restricciones que la IA debe obedecer. |
| [`SPECIFICATIONS.md`](./dbv-specs-ops/docs/SPECIFICATIONS.md) | El "Qué" y el "Por qué". Problema, objetivos y criterios de aceptación. |
| [`ARCHITECTURE.md`](./dbv-specs-ops/docs/ARCHITECTURE.md) | El "Cómo". Stack tecnológico, decisiones de diseño y estructura del sistema. |
| [`DESIGN.md`](./dbv-specs-ops/docs/DESIGN.md) | El "Aspecto". Sistema de diseño visual: tokens de color, tipografía, espaciado y componentes. *(Opcional para proyectos sin UI)* |
| [`DESIGN_ENRICHMENT.md`](./dbv-specs-ops/docs/DESIGN_ENRICHMENT.md) | Guía para auditorías visuales e ingeniería inversa de tokens de diseño (Impeccable y SkillUI). |

#### Carpeta raíz `/dbv-specs-ops/`:
| Archivo | Propósito |
|---|---|
| [`project.config.md`](./dbv-specs-ops/project.config.md) | Identidad del proyecto: nombre, autor, licencia y plantilla de cabeceras. Lo rellena la IA durante la entrevista de bootstrap. |
| [`CHANGELOG.md`](./dbv-specs-ops/CHANGELOG.md) | Historial de versiones. La IA actualiza la sección `[Sin publicar]` durante `/build` y `/test`, y la publica en cada `/ship`. |
| [`task.md`](./dbv-specs-ops/task.md) | El diario de a bordo. Progreso cuantitativo (checklist), backlog, y **Snapshots de Contexto**. |
| [`memory.md`](./dbv-specs-ops/memory.md) | **Contexto y Decisiones.** Base de conocimiento cualitativo: contexto activo, decisiones técnicas (ADR), lecciones aprendidas y mapa de relaciones. La IA debe consultarlo al iniciar la sesión. |
| [`implementation_plan.md`](./dbv-specs-ops/implementation_plan.md) | Se crea en la fase `/plan`. Plan técnico detallado que la IA rellena y el usuario aprueba antes de construir. |
| [`walkthrough.md`](./dbv-specs-ops/walkthrough.md) | Se crea en la fase `/ship`. Resumen de lo construido, probado y entregado. |

---

<a name="es-phases"></a>
### ⚩️ Las 6 Fases de Desarrollo

Cada fase tiene un **comando de activación** que puedes escribir en el chat en cualquier momento. La IA siempre respetará este orden sin saltarse ninguna fase sin tu aprobación.

| # | Fase | Comando | Qué hace la IA | Qué haces tú | Resultado |
|---|---|---|---|---|---|
| 1 | **Spec** | `/spec` | Revisa si el requisito está definido en `SPECIFICATIONS.md`. Si no, pregunta antes de actuar. | Describe la funcionalidad o cambio que necesitas. | `SPECIFICATIONS.md` actualizado |
| 2 | **Plan** | `/plan` | **Architect Review:** Valida primero las specs buscando edge cases. Si son válidas, desglosa el trabajo en pasos atómicos. Para tareas complejas, crea `implementation_plan.md` y espera tu aprobación. | Revisa y aprueba el plan. | `task.md` + `implementation_plan.md` |
| 3 | **Build** | `/build` | Implementa la lógica de forma incremental. Añade cabeceras a los ficheros, crea `venv` para Python, genera scripts de arranque, actualiza `CHANGELOG.md [Sin publicar]`. | Relájate. Revisa el código si lo deseas. | Código fuente + `CHANGELOG.md` actualizado |
| 4 | **Test** | `/test` | Crea y ejecuta tests unitarios o de integración. Una tarea **no está hecha** sin un test que pase. Corrige los bugs encontrados y los registra en `CHANGELOG.md`. | Ejecuta los tests localmente si quieres confirmar. | Ficheros de test + `CHANGELOG.md` actualizado |
| 5 | **Simplify** | `/code-simplify` | Refactoriza para mayor claridad y reduce la complejidad. Sin nuevas funcionalidades — solo pulido. "Clarity over cleverness." | Opcional: revisa y valida el refactor. | Código más limpio y simple |
| 6 | **Ship** | `/ship` | Actualiza `README.md`, completa `walkthrough.md`, pregunta el tipo de versión (Patch / Minor / Major), publica `CHANGELOG.md`, propone commit git + tag. | Elige el tipo de versión y confirma. | Release versionado 🚀 |

> **Consejo:** Puedes saltar a cualquier fase por comando. Por ejemplo, escribe `/ship` cuando estés listo para entregar y la IA gestionará automáticamente el versionado, el changelog y git.

---

### 🤖 Activación por Plataforma

| Plataforma | Archivo de activación | Carga |
|---|---|---|
| **Claude Code** (CLI / VS Code / Desktop) | `CLAUDE.md` | Automática al iniciar sesión |
| **GitHub Copilot** (VS Code / JetBrains) | `.github/copilot-instructions.md` | Automática en el workspace |
| **Cursor** | `CLAUDE.md` (compatible) | Automática |
| **Antigravity** (VS Code · by Google DeepMind) | `GEMINI.md` (auto) + `ANTIGRAVITY.md` (docs y config extra) | Automática (+ setup KI opcional) |
| **Windsurf** | `.windsurfrules` | Automática |
| **ChatGPT / Gemini Web** | `docs/MASTER_PROMPT.md` | Manual: adjunta o pega en el primer mensaje |
| **Gemini CLI** | `GEMINI.md` | Automática |

---

<a name="es-quickstart"></a>
### 🚀 Integración y Cómo Usar (Aislamiento en Subcarpeta)

Este framework está diseñado para vivir dentro de un subdirectorio dedicado (`dbv-specs-ops/`) en tu espacio de trabajo. Esto mantiene limpia la raíz de tu proyecto, evita sobreescrituras accidentales de tus archivos y aísla los registros de SDD.

#### Paso 1 — Copia la carpeta del Framework
Crea una carpeta llamada `dbv-specs-ops` en la raíz de tu proyecto y copia todos los archivos de este repositorio dentro de ella.

#### Paso 2 — Coloca los archivos de activación en la raíz
Debido a que los asistentes de IA solo leen archivos de configuración desde la raíz del espacio de trabajo (workspace root), **debes copiar o crear** los archivos de activación correspondientes en la raíz de tu proyecto para redirigir al asistente:

*   **Para Claude Code / Cursor (`CLAUDE.md` en la raíz):**
    ```markdown
    Please read and follow the master instructions in dbv-specs-ops/docs/MASTER_PROMPT.md. All specs, tasks, and memory logs are located inside the dbv-specs-ops/ folder.
    ```
*   **Para GitHub Copilot (`.github/copilot-instructions.md` en la raíz):**
    ```markdown
    Este proyecto usa Spec-Driven Development (SDD). Las reglas, especificaciones y tareas se encuentran en el subdirectorio `dbv-specs-ops/`.
    Lee y sigue estrictamente `dbv-specs-ops/docs/MASTER_PROMPT.md`.
    ```
*   **Para Windsurf (`.windsurfrules` en la raíz):**
    ```json
    {
      "rules": [
        "Please read and follow the master instructions in dbv-specs-ops/docs/MASTER_PROMPT.md. All specs, tasks, and memory logs are located inside the dbv-specs-ops/ folder."
      ]
    }
    ```
*   **Para Gemini CLI / Antigravity (`GEMINI.md` en la raíz):**
    ```markdown
    Please follow the SDD rules and files located in `dbv-specs-ops/`.
    Master prompt is at `dbv-specs-ops/docs/MASTER_PROMPT.md`.
    ```

#### Paso 3 — Abre tu asistente de IA y arranca la sesión
Según el estado de tu proyecto, escribe a tu asistente de IA:

*   **Para Proyectos Nuevos (Quick Start):**
    Escribe `/spec` (o pega el contenido de `dbv-specs-ops/docs/MASTER_PROMPT.md` si usas una interfaz manual como la web de ChatGPT). La IA iniciará la Entrevista de Ingeniería para definir la aplicación, rellenando `dbv-specs-ops/docs/SPECIFICATIONS.md`.
*   **Para Incorporar a Proyectos Existentes (Adopción):**
    Escribe el siguiente mensaje:
    > "Sigue las instrucciones de `dbv-specs-ops/docs/ADOPTION_PROMPT.md` para analizar este proyecto e incorporarlo a la metodología SDD utilizando la configuración dentro de la carpeta `dbv-specs-ops`."
    La IA analizará el código existente y rellenará las especificaciones e historial dentro del subdirectorio `dbv-specs-ops/`.

---

<a name="es-upgrade"></a>
### ⬆️ Actualizar el Framework

¿Ya usas dbv-specs-ops y quieres acceder a las últimas mejoras? Solo necesitas **un fichero**.

#### Paso 1 — Descarga `UPGRADE_PROMPT.md`

> **[⬇️ Descargar UPGRADE_PROMPT.md](https://raw.githubusercontent.com/davidbuenov/dbv-specs-ops/master/docs/UPGRADE_PROMPT.md)**
>
> Clic derecho → Guardar como → guárdalo como `docs/UPGRADE_PROMPT.md` dentro de tu proyecto.

#### Paso 2 — Dile a tu IA

```
Lee docs/UPGRADE_PROMPT.md y actualiza mi proyecto.
```

Listo. La IA detecta tu versión actual, calcula qué hay que actualizar y aplica solo los ficheros de framework.

#### Qué hará la IA
- ✅ Detectar tu versión actual del framework (lee `project.config.md` o te pregunta)
- ✅ Descargar y actualizar solo los ficheros de framework que cambiaron desde tu versión
- ✅ Añadir ficheros nuevos opcionales si faltan (ej: `docs/DESIGN.md` para proyectos con UI)
- ✅ Mostrarte un resumen completo de todo lo que se aplicó

#### Qué NO tocará nunca

| Fichero | Por qué está protegido |
|---|---|
| `docs/SPECIFICATIONS.md` | Tus requisitos del proyecto |
| `docs/ARCHITECTURE.md` | Tus decisiones técnicas |
| `task.md` | Tu backlog y estado del proyecto |
| `CHANGELOG.md` | Tu historial de versiones |
| `README.md` | Tu documentación del proyecto |
| Todo el código fuente | Tu aplicación |

---

<a name="es-example"></a>
### 🧑‍💻 Ejemplo de Uso

**1. Fase 1: Especificación**

`docs/SPECIFICATIONS.md`:
```markdown
- Problema: "Los usuarios olvidan tareas importantes."
- Objetivo: "Crear un sistema de recordatorios multiplataforma."
- Funcionalidad A: "El usuario puede crear, editar y eliminar recordatorios."
```

**2. Fase 2: Planificación:**

`task.md`:
```markdown
- [ ] Implementar modelo Reminder
- [ ] Crear API REST para recordatorios
- [ ] Añadir tests unitarios para Reminder
```

**3. Fases de Build / Test / Ship:**

El ciclo continúa de forma incremental hasta que la funcionalidad se entrega y documenta en `walkthrough.md`.

---

<a name="es-faq"></a>
### ❓ FAQ / Preguntas Frecuentes

**¿Puedo usar esta plantilla con cualquier asistente de IA?**
Sí, incluye archivos de activación compatibles con Claude Code, Copilot, Gemini, Antigravity, Windsurf y ChatGPT.

**¿Qué pasa si ya tengo código existente?**
Sigue las instrucciones de la sección "Incorporar a un Proyecto Existente" y utiliza `docs/ADOPTION_PROMPT.md`.

**¿Qué pasa si la IA no sigue el ciclo de fases?**
Asegúrate de que ha leído `docs/MASTER_PROMPT.md` y que tiene el contexto actualizado en `task.md`.

**¿Cómo puedo contribuir al framework?**
Realiza un Fork del repositorio, crea una rama descriptiva y abre una Pull Request explicando tu aportación.

---

<a name="es-contributing"></a>
### 🤝 Contribuir

1. Realiza un Fork del repositorio y crea una rama descriptiva.
2. Realiza tus cambios siguiendo el ciclo: Spec → Plan → Build → Test → Simplify → Ship.
3. Abre una Pull Request detallando los motivos y el impacto.
4. Si es una mejora metodológica, añade ejemplos y actualiza la documentación.

---

<a name="status"></a>
## 🛠 Estado / Status

* **Versión / Version:** 2.4.0
* **Metodología / Methodology:** Spec-Driven Development (SDD)
* **Objetivo / Goal:** Universal AI-assisted development template for any platform and assistant.

---

<a name="credits"></a>
## ✍️ Autores y Créditos / Authors & Credits

### 👤 Concebido y dirigido por / Conceived and directed by

#### David Bueno Vallejo

> "Idea original, visión de la metodología, diseño del sistema de documentos, pruebas y refinamiento."
> "Original idea, methodology vision, document system design, testing and refinement."

[![LinkedIn](https://img.shields.io/badge/LinkedIn-davidbueno-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/davidbueno/)
[![Website](https://img.shields.io/badge/Web-davidbuenov.com-6366f1?logo=google-chrome&logoColor=white)](https://davidbuenov.com)

---

### 📖 Referencia Teórica Principal / Key Reference Book
* **[The New SDLC With Vibe Coding](https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding)** — Whitepaper de Addy Osmani, Shubham Saboo y Sokratis Kartakis (Google, Mayo 2026), utilizado como base teórica fundamental para el diseño del Arnés Agéntico, los Evals y el modelo de Fábrica en la versión 2.0.0.

---

### 🤖 Construido con / Built with AI Pair Programming

| Tool | Role |
|---|---|
| **[Claude Code](https://claude.ai/code)** · *Anthropic* | Main agent: document structure design, prompt engineering, platform files, methodology refinement. |
| **[Antigravity](https://antigravity.google)** · *Google DeepMind* | Antigravity-specific integration, planning artifacts design, compatibility testing. |
| **[Gemini](https://gemini.google.com)** · *Google* | Methodology validation and adoption flow testing on existing projects. |
| **[ChatGPT](https://chatgpt.com)** · *OpenAI* | Manual flow review and `MASTER_PROMPT.md` compatibility with non-auto-loading models. |

> "La visión fue humana. La metodología fue una conversación."
> "The vision was human. The methodology was a conversation."

---

<a name="references"></a>
## 📚 Inspiración y Referencias / Inspiration & References

* **[Agent Skills](https://github.com/addyosmani/agent-skills)** — Addy Osmani (Google)
* **[The New SDLC With Vibe Coding](https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding)** — Addy Osmani, Shubham Saboo & Sokratis Kartakis (Google Whitepaper, May 2026)
* **[GitHub Spec-Kit](https://github.com/github/spec-kit)** — GitHub
* **[AI Coding Best Practices](https://github.com/davidbuenov/ai-coding-best-practices)** — David Bueno Vallejo
* **[design.md](https://github.com/google-labs-code/design.md)** — Google Labs
* **[Impeccable](https://github.com/pbakaus/impeccable)** — Paul Bakaus (Visual Audits and Critique CLI)
* **[SkillUI](https://github.com/amaancoderx/npxskillui)** — Amaan Coder (Design System Reverse Engineering CLI)
* **[Agent Plugins Specification](https://agent-plugins.org/specification)** — TSC of Core Maintainers (Google, Amazon, Microsoft, OpenAI, Vercel)
