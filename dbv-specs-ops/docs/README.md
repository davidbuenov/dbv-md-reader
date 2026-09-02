# Project Documentation / Documentación del Proyecto

This directory contains the operational documents that guide AI-assisted development.
Este directorio contiene los documentos operativos que guían el desarrollo asistido por IA.

| File | Role | When to use |
|---|---|---|
| [`MASTER_PROMPT.md`](./MASTER_PROMPT.md) | Rules, workflow and AI constraints | Attach in the first message if not using Claude Code, Copilot, Gemini CLI or Windsurf |
| [`SPECIFICATIONS.md`](./SPECIFICATIONS.md) | Requirements, users and acceptance criteria | Fill in during **Phase 0 (Spec)** before planning |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack, directory structure and technical decisions | Fill in after Phase 0, before **Phase 1 (Plan)** |
| [`DESIGN.md`](./DESIGN.md) | Visual design system: color tokens, typography and UI components | Fill in during **Phase 0 (Spec)** if the project has a UI. Optional otherwise. |
| [`WEB_TO_DESKTOP_MIGRATION.md`](./WEB_TO_DESKTOP_MIGRATION.md) | Strategic decisions for turning an **existing web app** into a native desktop app | Consult **before** `NATIVE_DESKTOP_APPS.md` whenever the code already exists as a web app |
| [`NATIVE_DESKTOP_APPS.md`](./NATIVE_DESKTOP_APPS.md) | Desktop app architecture (Tauri v2) & 8 design lessons | Fill in/consult only if the project is a compiled native desktop app |
| [`NATIVE_APPS_RELEASE_CI.md`](./NATIVE_APPS_RELEASE_CI.md) | Cross-platform GitHub Actions CI/CD for native desktop binaries | Consult when setting up CI/CD for compiled multi-platform desktop apps |
| [`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md) | App marketplace submission guide & checklist (Microsoft Store, Uptodown, etc.) | Consult before distributing compiled desktop apps to marketplaces |
| [`ADOPTION_PROMPT.md`](./ADOPTION_PROMPT.md) | Onboarding SDD onto an existing project | Use instead of Phase 0 if you already have code but no SDD docs |
| [`UPGRADE_PROMPT.md`](./UPGRADE_PROMPT.md) | Upgrading an existing SDD project to the latest framework version | Download this single file and tell your AI: *"Read docs/UPGRADE_PROMPT.md and upgrade my project"* |
| [`REVIEW.md`](./REVIEW.md) | Review passes and severities (Bugs / Security / Compliance) | Used by `/code-simplify` — Critical findings block `/ship` |
| [`GUARDRAILS.md`](./GUARDRAILS.md) | Deterministic guardrails (git/CI) backing up advisory prompt rules | Optional — consult when a rule must be near-impossible to skip |
| [`PARALLEL_WORK.md`](./PARALLEL_WORK.md) | `git worktree` mechanics for Orchestrator Mode | Consult when running 2-3 independent AI sessions in parallel |
| [`SOURCE_OF_TRUTH.md`](./SOURCE_OF_TRUTH.md) | Coexistence with Jira/ServiceNow/etc. | Optional — only if the project already tracks work externally |
| [`METRICS.md`](./METRICS.md) | Leading/lagging indicators per phase | Optional — read from git history alone |
| [`MAINTAIN.md`](./MAINTAIN.md) | Optional Phase 7 — autonomous loop closure | Enable via `project.config.md` if the project has CI/monitoring to watch |

## Document Flow / Flujo entre documentos

```
MASTER_PROMPT          →  defines HOW the AI works
SPECIFICATIONS         →  defines WHAT we build and WHY
ARCHITECTURE           →  defines WITH WHAT and HOW we build it
DESIGN                 →  defines HOW IT LOOKS (UI projects only)
WEB_TO_DESKTOP_MIGR.   →  defines WHETHER and HOW to migrate (existing web apps only)
NATIVE_DESKTOP_APPS    →  defines Desktop Architecture (Tauri/native apps only)
NATIVE_APPS_RELEASE_CI →  defines Multi-platform CI (compiled desktop apps only)
MARKETPLACE_PUBLISHING →  defines Store Checklist (store distributed desktop apps only)
REVIEW                 →  defines Review Passes & Severities (used by /code-simplify)
GUARDRAILS             →  defines Deterministic Enforcement (optional, git/CI layer)
PARALLEL_WORK          →  defines Parallel Sessions (git worktree, Orchestrator Mode)
SOURCE_OF_TRUTH        →  defines Who Owns State (optional, external ticket systems)
METRICS                →  defines Per-Phase Indicators (optional)
MAINTAIN               →  defines Autonomous Loop Closure (optional Phase 7)
task.md (root)         →  records state and ensures continuity between sessions

ADOPTION_PROMPT        →  used once, to adopt SDD on a project that has no SDD docs
UPGRADE_PROMPT         →  used when upgrading the framework to a new version
```

The AI must read these files at the start of each session before writing a single line of code.
La IA debe leer estos archivos al inicio de cada sesión antes de escribir una sola línea de código.
