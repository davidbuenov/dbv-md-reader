# Project Documentation / Documentación del Proyecto

This directory contains the operational documents that guide AI-assisted development.
Este directorio contiene los documentos operativos que guían el desarrollo asistido por IA.

| File | Role | When to use |
|---|---|---|
| [`MASTER_PROMPT.md`](./MASTER_PROMPT.md) | Rules, workflow and AI constraints | Attach in the first message if not using Claude Code, Copilot, Gemini CLI or Windsurf |
| [`SPECIFICATIONS.md`](./SPECIFICATIONS.md) | Requirements, users and acceptance criteria | Fill in during **Phase 0 (Spec)** before planning |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack, directory structure and technical decisions | Fill in after Phase 0, before **Phase 1 (Plan)** |
| [`DESIGN.md`](./DESIGN.md) | Visual design system: color tokens, typography and UI components | Fill in during **Phase 0 (Spec)** if the project has a UI. Optional otherwise. |
| [`ADOPTION_PROMPT.md`](./ADOPTION_PROMPT.md) | Onboarding SDD onto an existing project | Use instead of Phase 0 if you already have code but no SDD docs |
| [`UPGRADE_PROMPT.md`](./UPGRADE_PROMPT.md) | Upgrading an existing SDD project to the latest framework version | Download this single file and tell your AI: *"Read docs/UPGRADE_PROMPT.md and upgrade my project"* |

## Document Flow / Flujo entre documentos

```
MASTER_PROMPT    →  defines HOW the AI works
SPECIFICATIONS   →  defines WHAT we build and WHY
ARCHITECTURE     →  defines WITH WHAT and HOW we build it
DESIGN           →  defines HOW IT LOOKS (UI projects only)
task.md (root)   →  records state and ensures continuity between sessions

ADOPTION_PROMPT  →  used once, to adopt SDD on a project that has no SDD docs
UPGRADE_PROMPT   →  used when upgrading the framework to a new version
```

The AI must read these files at the start of each session before writing a single line of code.
La IA debe leer estos archivos al inicio de cada sesión antes de escribir una sola línea de código.
