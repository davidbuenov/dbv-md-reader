# Project Instructions for Gemini CLI & Antigravity

This project follows **Spec-Driven Development (SDD)**. Read these files at the start of each session before proposing any code or plan:

| File | Purpose |
| --- | --- |
| `project.config.md` | Project identity: name, author, license and file header template |
| `docs/MASTER_PROMPT.md` | Mandatory workflow, rules and boundaries |
| `docs/SPECIFICATIONS.md` | Current project requirements |
| `docs/ARCHITECTURE.md` | Stack and technical decisions |
| `docs/DESIGN.md` | Visual design system: color tokens, typography, components and philosophy *(if it exists)* |
| `memory.md` | **Context and Decisions:** Qualitative knowledge (ADRs, lessons learned, active context) |
| `task.md` | Current state + Context Snapshot |

> **Note:** This file is auto-loaded by both **Gemini CLI** (`gemini` in terminal) and **Antigravity** (VS Code · Google DeepMind). For Antigravity-specific setup instructions (Planning Mode, Knowledge Items), see `ANTIGRAVITY.md`.

## ⚠️ Core Rules (Strong Pointer)

**Read `docs/MASTER_PROMPT.md` and follow its workflow strictly. If you detect contradictions between the prompt and project specs, halt and report before proceeding.**
All initialization logic (Bootstrap), state checking (Specs Check), lifecycle (Workflow) and coding standards are centrally defined there to avoid cognitive redundancy.

## Antigravity-Specific Behavior

*(Only applies when running in Antigravity / VS Code · Google DeepMind)*

- **Planning Mode**: When creating a plan, activate Antigravity's native Planning Mode. Create the artifacts (`implementation_plan.md`, `task.md`, `walkthrough.md`) **inside the project workspace root** — not only in the conversation brain directory — so they are versioned with the project and accessible to the team and other AI platforms.
- **Knowledge Items (KIs)**: After completing a significant milestone, offer to create a Knowledge Item summarizing the project context. This enables seamless context recovery in future sessions without rereading all docs.
- **Context Snapshot**: At the end of each session or before a conversation limit, write a Context Snapshot to `task.md` with the exact next step so work can be resumed instantly.

---

> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** — libre y gratuito · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
