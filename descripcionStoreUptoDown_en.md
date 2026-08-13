# Uptodown listing — English

> Adapted from `descripcionStore_en.md` (Microsoft Store) for the real submission form of the **Uptodown Developers Console** (Apps → Add new app). Field names and character limits come from Uptodown's own help center ("How to publish an app on Uptodown"). Unlike the Store, Uptodown's *Operating System* field only supports **Windows and Mac** — **Linux is not a supported platform on Uptodown**, so the `.deb`/`.AppImage` aren't uploaded here; they're mentioned in the text as a link to GitHub Releases, not as an attached file.
>
> **File to upload in *Select File*:** for this listing, `DBV.Markdown.Reader.0.7.0_universal.dmg` (macOS, Intel + Apple Silicon), downloaded from the `v0.7.0` GitHub Release. If the Windows build is later also published on Uptodown, repeat this same form with `dbv-markdown-reader_0.7.0_x64-setup.exe` and **Operating System: Windows** — the description text below already covers all three platforms as-is, no changes needed for that second listing.

---

## Name

DBV Markdown Reader

## Operating System

Mac *(macOS, universal .dmg for Intel + Apple Silicon — no Apple code signing)*

## Short description
*(max. 70 characters)*

Lightweight, local Markdown reader for Windows, Mac and Linux. No ads

*(69 characters)*

## Full body text description
*(min. 50 words)*

DBV Markdown Reader is a native, read-only Markdown (.md) file reader: lightweight, fast, and 100% local — no accounts, no ads, no telemetry. Open any .md document instantly (under 200 ms), with no code editor or heavyweight IDE required. It uses just a few megabytes of memory — literally hundreds of times less than Electron-based alternatives.

**Available for Windows, macOS, and Linux:**
• **Windows 10/11:** Microsoft Store (recommended, with auto-update) or the `.exe` installer from GitHub Releases.
• **macOS (Intel and Apple Silicon):** this same universal `.dmg` package — not signed by Apple, so macOS will warn the first time ("developer cannot be verified"); right-click → Open, or `xattr -cr` from Terminal.
• **Linux (.deb / .AppImage):** direct download from the project's GitHub Releases (not yet distributed on Uptodown).

Perfect for reading technical documentation, notes, GitHub project READMEs, study notes, or any collection of interlinked Markdown files.

**Key features:**
• Instant opening via double-click or "Open with..."
• Live auto-reload when you edit the file from another program, without losing your scroll position
• Mermaid diagrams rendered as interactive SVG, with an option to open them in mermaid.live
• LaTeX math equations (inline and block), rendered with KaTeX
• Code syntax highlighting with a one-click copy button
• Automatic table of contents and instant text search (Ctrl+F)
• Three reading themes: Light, Dark, and Sepia
• Navigation between linked documents with history (Back/Forward)
• Also opens remote Markdown documents by URL
• Print/export to PDF with proper pagination (no tables, code, or diagrams cut mid-page)
• Interface available in English and Spanish
• 100% safe: embedded HTML is automatically sanitized before being displayed

No internet connection required to function, no personal data collected. Your documents never leave your computer. Open source under the MIT license.

---

## What's new in this version (v0.7.0)
*(per-version changelog field)*

LaTeX math equations (KaTeX) and proper print/PDF pagination. Expanded distribution: the Windows installer is unchanged, plus automatically-built Linux `.deb`/`.AppImage` packages on every release, and this universal macOS `.dmg` (Intel + Apple Silicon), unsigned.

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

- markdown
- markdown reader
- md viewer
- documentation viewer
- github readme
- markdown notes
- mermaid diagrams

### Icon to upload

`src-tauri/icons/icon.png` (512×512, PNG, square) — meets Uptodown's minimum requirement of 256×256.
