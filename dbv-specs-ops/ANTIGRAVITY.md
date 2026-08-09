# Antigravity Reference — SDD Extended Behavior

> **How Antigravity loads context:** `GEMINI.md` is **automatically read** from the workspace root at the start of every session (same mechanism as Gemini CLI). You do NOT need to paste anything manually.
>
> This file documents the **Antigravity-specific features** built on top of the base SDD workflow defined in `GEMINI.md`. Read it if you want to take full advantage of Planning Mode, Knowledge Items, and cross-session persistence.

---

This project follows **Spec-Driven Development (SDD)**. Read these files at the start of each session before proposing any code or plan:

| File | Purpose |
|---|---|
| `docs/MASTER_PROMPT.md` | Mandatory workflow, rules and boundaries |
| `docs/SPECIFICATIONS.md` | Current project requirements |
| `docs/ARCHITECTURE.md` | Stack and technical decisions |
| `docs/DESIGN.md` | Visual design system: color tokens, typography, components and philosophy *(if it exists)* |
| `memory.md` | **Context and Decisions:** Qualitative knowledge (ADRs, lessons learned, active context) |
| `task.md` | Current state + Context Snapshot |

## ⚠️ Core Rules (Strong Pointer)

**Read `docs/MASTER_PROMPT.md` and follow its workflow strictly. If you detect contradictions between the prompt and project specs, halt and report before proceeding.**
All initialization logic (Bootstrap), state checking (Specs Check), lifecycle (Workflow) and coding standards are centrally defined there to avoid cognitive redundancy.

## Antigravity-Specific Behavior

- **Planning Mode**: When creating a plan, activate Antigravity's native Planning Mode. Create the artifacts (`implementation_plan.md`, `task.md`, `walkthrough.md`) **inside the project workspace root** — not only in the conversation brain directory — so they are versioned with the project and accessible to other AI platforms and team members.
- **Knowledge Items (KIs)**: After completing a significant milestone, offer to create a Knowledge Item summarizing the project context. This enables seamless context recovery in future sessions without rereading all docs.
- **Context Snapshot**: At the end of each session or before a conversation limit, write a Context Snapshot to `task.md` with the exact next step so the work can be resumed instantly.

---

> 🛠️ SDD Framework created by **[David Bueno Vallejo](https://github.com/davidbuenov)** — free and open source · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
