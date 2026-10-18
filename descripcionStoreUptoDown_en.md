# Uptodown listing — English

> Adapted from `descripcionStore_en.md` (Microsoft Store) for the real submission form of the **Uptodown Developers Console** (Apps → Add new app). Field names and character limits come from Uptodown's own help center ("How to publish an app on Uptodown"). Unlike the Store, Uptodown's *Operating System* field only supports **Windows and Mac** — **Linux is not a supported platform on Uptodown**, so the `.deb`/`.AppImage` aren't uploaded here; they're mentioned in the text as a link to GitHub Releases, not as an attached file.
>
> **Listing focused on Mac** (the platform Uptodown actually has published, in review since `v0.7.0`): the text no longer splits attention evenly across Windows/macOS/Linux — it leads with the native Mac experience (app menu, ⌘ shortcuts) and mentions the other platforms briefly at the end. If the Windows listing is published on Uptodown later, rewrite the body with the same approach but centered on Windows — don't reuse this text as-is.
>
> **File to upload in *Select File*:** `DBV.Markdown.Reader_0.12.0_universal.dmg` (macOS, Intel + Apple Silicon, no Apple code signing), downloaded from the `v0.12.0` GitHub Release — verified via `gh release view v0.12.0` that this is the real asset name (an earlier note in this file had a dot before the version, `.7.0`; the real name uses an underscore: `_0.12.0_`).

---

## Name

DBV Markdown Reader

## Operating System

Mac *(macOS, universal .dmg for Intel + Apple Silicon — no Apple code signing)*

## Short description
*(max. 70 characters)*

Native Markdown reader and editor for Mac: fast, light, local.

*(62 characters)*

## Full body text description
*(min. 50 words)*

DBV Markdown Reader is a native Markdown (.md) reader and editor for Mac, with universal support for Intel and Apple Silicon: lightweight, fast, and 100% local — no accounts, no ads, no telemetry. Open any .md document instantly (under 200 ms), with no code editor or heavyweight IDE required. It uses just a few megabytes of memory — literally hundreds of times less than Electron-based alternatives.

It includes a native application menu (App/File/Edit/View/Window/Help) with ⌘ shortcuts, like an app actually built for Mac, not a plain Windows port.

When you need to edit, its Edit Mode (⌘E) shows a live split view with your raw Markdown on one side and the rendered preview on the other, complete with a 16-action formatting toolbar (bold, lists, tables, links...) and smart conflict handling if the file changes from another program while you're editing.

Perfect for reading and editing technical documentation, notes, GitHub project READMEs, study notes, or any collection of interlinked Markdown files.

**Key features:**
• Instant opening via double-click or "Open with..."
• Native macOS menu with ⌘ shortcuts (⌘O open, ⌘S save, ⌘E Edit Mode, ⌘P print, ⌘F search)
• Edit Mode with a live split view, a Markdown formatting toolbar, and Tab/Shift+Tab list indenting
• Conflict handling if the file changes from another program while editing
• Live auto-reload when you edit the file from another program, without losing your scroll position
• Mermaid diagrams rendered as interactive SVG, with an option to open them in mermaid.live
• LaTeX math equations (inline and block), rendered with KaTeX
• Code syntax highlighting for 24+ languages, with a copy button
• Task lists and footnotes (GFM)
• Automatic table of contents that highlights the section you're reading, and instant text search
• Three reading themes: Light, Dark, and Sepia
• Navigation between linked documents with history (Back/Forward) and remote Markdown documents by URL
• Print/export to PDF with proper pagination (no tables, code, or diagrams cut mid-page)
• Interface available in English and Spanish
• 100% safe: embedded HTML is automatically sanitized before being displayed

No internet connection required to function, no personal data collected. Your documents never leave your computer. Open source under the MIT license.

**A note on code signing:** this universal `.dmg` isn't signed by Apple (outside the paid Apple Developer program), so macOS will warn the first time you open it ("cannot verify the developer"). Fix: right-click the app → Open, or run `xattr -cr /Applications/DBV\ Markdown\ Reader.app` from Terminal.

**Also available for Windows** (Microsoft Store, with auto-update, or the `.exe` installer from GitHub Releases) **and Linux** (`.deb`/`.AppImage` from GitHub Releases) — see https://davidbuenov.github.io/dbv-md-reader/en/.

---

## What's new in this version (v0.12.0)
*(per-version changelog field)*

Full Edit Mode (⌘E): live split view, resizable panels, scroll sync, a Markdown formatting toolbar (16 actions) with Tab/Shift+Tab list indenting, conflict handling if the file changes from another program while editing, and a built-in Markdown syntax cheat sheet. New native macOS menu (App/File/Edit/View/Window/Help) with ⌘ shortcuts, including the print permission WKWebView requires. Also: task lists and footnotes (GFM), syntax highlighting for 24+ languages matched to each theme.

---

## Additional information

**Official website:** https://davidbuenov.github.io/dbv-md-reader/en/
**Suggested category/directory:** Productivity / Utilities
**Nationality:** Spain
**Author:** David Bueno Vallejo

### License and distribution

- **Distribution Model:** Free
- **License Type:** MIT
- **License Text URL:** https://github.com/davidbuenov/dbv-md-reader/blob/master/LICENSE
- **Source Code URL:** https://github.com/davidbuenov/dbv-md-reader

### Keywords
*(reference for SEO/ASO — Uptodown has no field identical to Partner Center's)*

- markdown mac
- markdown editor mac
- markdown reader
- documentation viewer
- github readme
- markdown notes
- mermaid diagrams

### Icon to upload

`src-tauri/icons/icon.png` (512×512, PNG, square) — meets Uptodown's minimum requirement of 256×256.
