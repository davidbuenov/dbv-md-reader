# DBV Markdown Reader — Alignment with Microsoft PowerToys #45267

## Purpose

This document is a technical/product brief for the AI assistant developing **DBV Markdown Reader**.

The goal is to evolve the application so that it is a strong, credible real-world implementation of the use case proposed in **Microsoft PowerToys issue #45267: “Markdown Reader - Persistent viewer with TOC and Mermaid support”**, while keeping DBV an independent project.

**Important:** DBV Markdown Reader is not part of Microsoft PowerToys and is not endorsed by Microsoft. The objective is functional and UX alignment with the proposal, not imitation of PowerToys' internal architecture.

Reference issue:
https://github.com/microsoft/PowerToys/issues/45267

Current repository:
https://github.com/davidbuenov/dbv-md-reader

---

# 1. What PowerToys #45267 proposes

The issue describes a gap between:

- **Peek / File Explorer Preview:** useful for quick inspection, but transient.
- **VS Code / Obsidian / editors:** powerful but unnecessarily heavy when the user only wants to read Markdown.
- **Browser-based viewing:** possible, but less integrated with Windows and less convenient for persistent documentation.

The proposed PowerToy is a **standalone, lightweight, read-only Markdown viewer optimized for sustained documentation consumption**.

The issue's principal requirements are:

1. Persistent Markdown Reader window.
2. Clickable Table of Contents generated from Markdown headings.
3. Current-section navigation/highlighting.
4. Zoom.
5. `Ctrl+F` text search.
6. GitHub Flavored Markdown (GFM).
7. Mermaid diagrams.
8. Robust table rendering.
9. Native-feeling Windows integration.
10. Always on Top.
11. Standard Windows Snap Layouts.
12. File Explorer context-menu access.
13. PowerToys Run access.
14. Multiple independent windows for side-by-side comparison.
15. Proposed implementation using WinUI 3.
16. Proposed use of Markdig.
17. WebView2 inside a native Windows shell.
18. Mica backdrop.
19. PowerToys module structure compatible with the existing project.

The issue explicitly describes scenarios such as keeping README/docs open beside an IDE, reviewing Markdown specifications on a second monitor, and reading local knowledge-base notes in read-only mode.

---

# 2. Current DBV Markdown Reader

DBV Markdown Reader is currently a lightweight, read-only Markdown viewer built with:

- Rust
- Tauri v2
- WebView2 on Windows
- `markdown-it`
- Mermaid.js
- KaTeX
- Prism.js
- DOMPurify
- `notify`
- `ureq`

The current repository documents:

- Windows, Linux and macOS builds
- Microsoft Store distribution for Windows
- Windows `.md` file association
- Explorer “Open with” / context-menu integration
- CLI opening
- multiple independent windows
- TOC
- current-section highlighting
- `Ctrl+F` search
- auto-reload
- Mermaid
- syntax highlighting
- KaTeX
- remote Markdown URLs
- recent files
- light/dark/sepia themes
- reading time
- scroll progress
- XSS/HTML sanitization
- PDF/printing-related functionality
- WebView2 on Windows

The repository currently has 47 commits, 2 issues and 1 pull request.

---

# 3. Feature-by-feature comparison

| PowerToys #45267 requirement | DBV current state | Action |
|---|---|---|
| Persistent viewer | Implemented | Keep and document prominently |
| Read-only experience | Core design | Keep as central product principle |
| Clickable TOC | Implemented | Keep; add screenshots/demo |
| Current section highlighting | Implemented | Keep |
| Zoom | Implemented/documented | Verify keyboard/UI behavior |
| `Ctrl+F` search | Implemented | Keep |
| GFM/Markdown rendering | Implemented through `markdown-it` | Verify compatibility and document supported syntax |
| Tables | Implemented | Add compatibility tests |
| Mermaid | Implemented | Add compatibility tests |
| Multiple independent windows | Implemented | Verify side-by-side workflow |
| File Explorer integration | Implemented | Keep |
| Double-click `.md` | Implemented | Keep |
| WebView2 | Implemented on Windows through Tauri | Document explicitly |
| Lightweight architecture | Core design | Add reproducible measurements |
| Always on Top | Not currently established as implemented | Investigate and consider implementing |
| Snap Layouts | Standard Windows behavior may work, but no dedicated feature documented | Verify and document |
| PowerToys Run | Not implemented | Consider only if useful; do not pretend it exists |
| WinUI 3 | Not used | Do not change architecture solely for parity |
| Markdig | Not used; uses `markdown-it` | Focus on rendered behavior/compatibility |
| Mica | Not implemented/documented | Optional Windows UX enhancement |
| PowerToys module structure | Not applicable to independent app | Do not imitate unnecessarily |

## Key conclusion

DBV already implements **most of the user-facing functionality** described in #45267.

The largest missing user-facing items are:

- PowerToys Run integration
- explicit Always on Top support
- explicit validation/documentation around Snap Layouts
- potentially a more Windows-native visual treatment such as Mica

The architectural differences (Tauri vs WinUI 3, `markdown-it` vs Markdig) are **not functional deficiencies** and should not drive unnecessary rewrites.

---

# 4. What should be improved in the application

## Priority P0 — Make the core PowerToys use case unmistakable

The primary workflow should be:

> Open a Markdown document and keep it visible while doing other work.

Optimize and test this scenario:

1. Double-click a `.md` file.
2. DBV opens quickly.
3. The document is immediately readable.
4. TOC is available without obscuring content.
5. Search is fast.
6. Mermaid and tables render correctly.
7. The window can remain open beside an IDE.
8. A second Markdown file can be opened independently.
9. If the source changes, the reader updates without losing the reading position.

This is the strongest overlap with #45267.

## Priority P0 — Verify Windows integration

Explicitly test:

- `.md` file association
- Explorer context menu / Open with
- double-click launch
- multiple windows
- Windows 10/11 behavior where relevant
- Snap Layouts
- DPI/scaling
- multi-monitor
- taskbar behavior
- window persistence
- keyboard shortcuts

Document only behavior that is actually verified.

## Priority P1 — Always on Top

Investigate adding a native-feeling **Always on Top** feature.

Possible UX:

- toolbar/menu toggle
- keyboard shortcut
- persistent per-window state if appropriate

This is explicitly mentioned in #45267 and fits the documentation/second-monitor workflow.

## Priority P1 — PowerToys Run compatibility

Do not add this merely for marketing.

Evaluate whether a simple launch/discovery integration would be useful.

If implemented, support a workflow such as:

- `Markdown Reader`
- `Markdown Reader <file>`
- launching DBV from PowerToys Run

If not implemented, document it honestly as a difference.

## Priority P1 — Markdown/GFM compatibility

Create a test corpus covering:

- headings
- links
- images
- emphasis
- code fences
- tables
- blockquotes
- nested lists
- task lists
- HTML
- escaping
- URLs
- anchors
- Mermaid
- math/KaTeX

The objective should be **behavioral compatibility**, not use of the same parser as PowerToys.

## Priority P1 — Mermaid robustness

Test:

- flowcharts
- sequence diagrams
- class diagrams
- state diagrams
- ER diagrams
- larger diagrams
- invalid Mermaid
- Mermaid inside long documents
- theme interaction

The reader should fail gracefully when a diagram is invalid.

## Priority P1 — Security

Preserve and test the current DOMPurify sanitization.

Test potentially unsafe Markdown/HTML payloads and ensure:

- scripts cannot execute unexpectedly
- dangerous attributes are sanitized
- external content behavior is deliberate
- remote Markdown is treated as untrusted input

Security should be documented as a design feature, not just an implementation detail.

---

# 5. UX recommendations to move closer to PowerToys

The goal is not to copy PowerToys' visual identity blindly. The goal is a **Windows-native, restrained, utility-oriented experience**.

Priorities:

1. Fast startup.
2. Minimal chrome.
3. Clear document title.
4. TOC available without dominating the screen.
5. Excellent keyboard navigation.
6. Standard Windows window behavior.
7. Good dark/light support.
8. Native-feeling menus and context actions.
9. No unnecessary editor controls.
10. Excellent behavior on multiple monitors.

Avoid turning DBV into a Markdown editor.

The product identity should remain:

> **Read Markdown, don't edit it.**

---

# 6. Performance recommendations

The current README reports an indicative comparison using the same two Markdown files:

- Visual Studio Code: 885.8 MB RAM
- Notepad++: 21.5 MB RAM
- DBV Markdown Reader: 5.9 MB RAM

Do not present this as a formal benchmark.

Instead:

1. Create a reproducible benchmark procedure.
2. Test cold startup.
3. Test warm startup.
4. Measure idle RAM.
5. Measure RAM with a small document.
6. Measure RAM with a large document.
7. Measure CPU while idle.
8. Measure CPU during rendering.
9. Test Mermaid-heavy documents.
10. Test multi-window usage.

Publish the methodology.

The performance story is highly relevant because #45267 explicitly identifies heavyweight editors as part of the problem.

---

# 7. README redesign

The current README is strong as an installation/documentation page but is optimized primarily for end users.

For a PowerToys developer, the first screen should answer:

> What is this?
> Why is it relevant to #45267?
> What does it already implement?
> What is different?
> How can I evaluate it?

## Recommended README order

### 1. Title + one-sentence positioning

Recommended positioning:

> **DBV Markdown Reader — Lightweight, read-only Markdown viewer for Windows.**

Then:

> A working independent implementation of the sustained Markdown-reading workflow proposed in Microsoft PowerToys #45267.

Do not imply affiliation with Microsoft.

### 2. Primary screenshot

Place a strong application screenshot immediately below the introduction.

Ideally show:

- document
- TOC
- Mermaid/table content
- Windows desktop context

### 3. PowerToys #45267 section

Add a section near the top:

```markdown
## 🔷 Related to Microsoft PowerToys #45267

DBV Markdown Reader is an independent, working implementation of many of
the user-facing requirements described in
[PowerToys #45267](https://github.com/microsoft/PowerToys/issues/45267).

The project is not affiliated with Microsoft or PowerToys. It is presented
as a real-world reference implementation of the same use case.
```

### 4. Feature comparison table

Add the comparison table from section 3 of this document.

This is the most important addition for PowerToys maintainers.

### 5. Explain the use case

Add:

```markdown
## 🎯 The use case

DBV Markdown Reader is designed for one simple workflow:

> You want to read Markdown while working, not edit it.

Typical scenarios:

- Keep README.md open beside an IDE.
- Read documentation on a second monitor.
- Review Markdown specifications.
- Read generated Markdown documentation.
- Browse local Markdown knowledge bases without risking accidental edits.
```

### 6. Performance

Move performance evidence much higher in the README.

Use neutral technical wording.

### 7. Screenshots / demo

Add screenshots and preferably a short GIF/video showing:

- opening `.md`
- TOC
- search
- Mermaid
- second window
- auto-reload

### 8. Features

Keep the existing feature list but reorder it according to #45267:

1. Persistent window
2. TOC
3. Search
4. Zoom
5. GFM
6. Tables
7. Mermaid
8. Multi-window
9. Explorer integration
10. Auto-reload
11. Themes
12. KaTeX
13. Remote Markdown
14. Other extras

### 9. Architecture

Add a concise technical section:

```markdown
## 🏗️ Architecture

- Rust + Tauri v2 — application shell/native integration
- WebView2 — Windows rendering engine
- markdown-it — Markdown parsing
- Mermaid.js — diagrams
- KaTeX — mathematical notation
- Prism.js — syntax highlighting
- DOMPurify — HTML sanitization
- notify — local file watching
- ureq — remote Markdown loading
```

Explicitly state that the Windows renderer uses WebView2.

### 10. Relation to PowerToys

Near the end:

```markdown
## 🤝 Relation to PowerToys

DBV Markdown Reader is an independent project and is not affiliated with
Microsoft or PowerToys.

It implements many of the same user-facing requirements described in
PowerToys #45267.

The author is interested in sharing implementation experience, UX feedback,
performance measurements and lessons learned from maintaining a real-world
Markdown reader.

The project can therefore serve as a working reference for the proposed
Markdown Reader experience.
```

---

# 8. GitHub repository presentation

Improve the repository's short description.

Current wording emphasizes:

- native
- ultra-light
- Rust
- Tauri
- security

Recommended direction:

> **Lightweight, read-only Markdown viewer for Windows. Persistent TOC, search, Mermaid, GFM, multi-window, auto-reload and WebView2.**

Also consider GitHub topics such as:

- markdown
- markdown-reader
- markdown-viewer
- windows
- tauri
- rust
- webview2
- mermaid
- documentation
- developer-tools
- powertoys

Only add topics that accurately describe the project.

---

# 9. Do NOT make these changes just for PowerToys

Avoid unnecessary architectural changes:

- Do not rewrite Tauri into WinUI 3 merely for parity.
- Do not replace `markdown-it` with Markdig merely because PowerToys proposes Markdig.
- Do not add Mica if it harms cross-platform architecture.
- Do not turn DBV into an editor.
- Do not copy PowerToys branding.
- Do not claim Microsoft affiliation.
- Do not claim PowerToys compatibility unless tested.

The objective is **functional/UX alignment**, not architectural cloning.

---

# 10. Suggested implementation roadmap

## Phase 1 — Documentation and evidence

- [ ] Add PowerToys #45267 section to README.
- [ ] Add feature comparison table.
- [ ] Add primary screenshot.
- [ ] Add screenshots for TOC, Mermaid and multi-window.
- [ ] Add short demo GIF/video.
- [ ] Move performance comparison higher.
- [ ] Add architecture section.
- [ ] Add explicit PowerToys relationship section.
- [ ] Update GitHub repository description/topics.

## Phase 2 — Windows behavior verification

- [ ] Verify `.md` association.
- [ ] Verify Explorer context menu.
- [ ] Verify multiple windows.
- [ ] Verify Snap Layouts.
- [ ] Verify DPI scaling.
- [ ] Verify multi-monitor behavior.
- [ ] Verify keyboard navigation.
- [ ] Verify window/taskbar behavior.

## Phase 3 — Feature gaps

- [ ] Evaluate Always on Top.
- [ ] Evaluate PowerToys Run integration.
- [ ] Decide whether Mica/native visual treatment adds meaningful value.
- [ ] Document any remaining differences honestly.

## Phase 4 — Compatibility and robustness

- [ ] Build Markdown/GFM test corpus.
- [ ] Build Mermaid test corpus.
- [ ] Build security/XSS test corpus.
- [ ] Test large Markdown documents.
- [ ] Test multi-window memory usage.
- [ ] Create reproducible performance benchmark.

## Phase 5 — PowerToys outreach

Only after the above:

1. Update GitHub repository.
2. Ensure screenshots/demo are public.
3. Verify all claims.
4. Comment on PowerToys #45267.
5. Present DBV as an existing independent implementation/reference.
6. Offer implementation experience and feedback.
7. Do not demand adoption.

---

# 11. Recommended message positioning for the future PowerToys comment

The eventual message should communicate:

> I noticed the Markdown Reader proposal in #45267. I have independently built and published DBV Markdown Reader, a lightweight read-only Markdown viewer that already implements many of the proposed user-facing features: persistent windows, TOC, search, zoom, GFM rendering, tables, Mermaid, multiple windows and Explorer integration. The Windows build uses WebView2. It is distributed through the Microsoft Store and the source is available on GitHub.

Then explain the architectural differences honestly:

> DBV uses Rust/Tauri rather than WinUI 3 and markdown-it rather than Markdig, so it is not intended as a drop-in implementation for PowerToys. I would be happy to share UX/performance findings and implementation experience as the PowerToys proposal is evaluated.

This is collaborative rather than promotional.

---

# 12. Final strategic assessment

The most important conclusion is:

**DBV Markdown Reader already solves most of the user problem described in PowerToys #45267.**

The current gap is not primarily functionality. It is:

1. making the overlap explicit;
2. proving the workflow visually;
3. validating Windows-specific behavior;
4. filling or clearly documenting a few missing features;
5. presenting the project in a way that a PowerToys maintainer can evaluate in under two minutes.

The strongest competitive/technical story is:

> **DBV is an existing, working, lightweight implementation of the same sustained Markdown-reading workflow that PowerToys #45267 proposes.**

The strongest product principle is:

> **Read Markdown, don't edit it.**

The strongest technical differentiator is:

> **Very small Windows desktop footprint while still providing TOC, search, Mermaid, GFM-style rendering, multiple windows and WebView2 rendering.**

The strongest collaboration angle is:

> **DBV can provide real-world UX, compatibility and performance evidence for evaluating the proposed PowerToys feature.**

---

## Sources

- Microsoft PowerToys issue #45267: https://github.com/microsoft/PowerToys/issues/45267
- DBV Markdown Reader repository: https://github.com/davidbuenov/dbv-md-reader

Document prepared from the current public state of both repositories/issues on 2026-08-17.
