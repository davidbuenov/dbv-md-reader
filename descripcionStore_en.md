# Microsoft Store listing — English (United States)

> Copy each field as-is into the matching section of Partner Center ("Store Description"). The character limits shown are the ones the form itself displays.

---

## Description *

DBV Markdown Reader is a native Markdown (.md) reader and editor for Windows: lightweight, fast, and local by default — no accounts, no ads, no telemetry.

Open any .md document instantly (under 200 ms) using Windows' native rendering engine, with no heavyweight IDE required. When you need to edit, its Edit Mode shows a live split view with your raw Markdown and the rendered preview side by side, complete with a formatting toolbar and smart conflict handling if the file changes from another program. It uses just a few megabytes of memory — literally hundreds of times less than Electron-based alternatives.

Perfect for reading and editing technical documentation, notes, GitHub project READMEs, study notes, or any collection of interlinked Markdown files.

Key features:
• Instant opening via double-click or "Open with..."
• Create new documents from scratch (Ctrl+N) and start editing right away
• Optional AI assistant (off by default): connect a local model, a cloud one with your own API key, or an agent you already have; you review every change before it is applied
• Double-click the preview to jump to the exact spot in the code, and a context menu to go from the editor to the preview
• Paste a screenshot or drop an image: it is saved to an images folder next to the document and its code is inserted
• Edit Mode (Ctrl+E) with a live split view, a Markdown formatting toolbar, and Tab/Shift+Tab list indenting
• Directory tree explorer and Quick Open file switcher (Ctrl+K)
• Direct export to Typst (.typ) to keep editing the document with a Typst editor
• Conflict handling if the file changes from another program while you're editing
• Live auto-reload when you edit the file from another program, without losing your scroll position
• Mermaid diagrams rendered as interactive SVG, with an option to open them in mermaid.live
• LaTeX math equations rendered with KaTeX
• Code syntax highlighting for 24+ languages, with colors matched to each theme — including when printing or exporting to PDF, with always-aligned line numbers
• GitHub-style alerts (Note, Tip, Important...), task lists, and footnotes (GFM)
• Automatic table of contents that highlights the section you're reading, and instant text search (Ctrl+F)
• Three reading themes: Light, Dark, and Sepia
• Navigation between linked documents with history (Back/Forward)
• Also opens remote Markdown documents by URL
• Interface available in English and Spanish
• 100% safe: embedded HTML is automatically sanitized before being displayed

No internet connection required to function, and no personal data collected. The AI is optional and off by default: only if you connect it is the document text sent to the provider you chose (or it stays on your computer if you use a local model).

---

## What's new in this version

v0.19.0: the header groups the actions into three menus (File, Tools and Preferences) and the help (F1) now includes an app guide besides the Markdown syntax. New language: Korean (한국어), with a language selector ready for more. Preferences for reading width and editor font size, and the app remembers the window's position and size and the side panel. In Edit Mode you can search inside the editor's text and reorder sections by dragging them from the Index (Alt+↑/↓), with undo. Fixes: the welcome screen no longer flashes when opening a file, the code block copy and wrap buttons no longer move with horizontal scroll, printing and PDF no longer clip long code, file dialogs open in the document's folder, and scroll sync between editor and preview is more precise.

And from v0.18.0 "AI Native": optional AI assistant (off by default) with local models, cloud models with your own API key, or agents such as Claude Code or Gemini CLI — it sees the open document and its folder, and nothing is written until you review each change, which is applied in the editor and undone with Ctrl+Z; inline AI on the selected text (improve, fix, translate, shorten...). New editor ↔ preview sync: double-click the preview to jump to the code, plus a context menu in the editor. Paste a screenshot or drop an image and it is saved to an images folder next to the document, inserting its code at the cursor. The file tree now refreshes by itself and the context menu can no longer reload the window by accident.

Also includes what was new in v0.17.0: new "New document" button (Ctrl+N) to create a .md file from scratch and start writing straight away in Edit Mode. Typst export now keeps the HTML embedded in the document, and no longer produces a .typ file that fails to compile when a file path is followed by bold text.

And from v0.16.0: direct export to Typst (.typ) to keep editing the document with a Typst editor, correct syntax colors when printing or exporting to PDF (they used to get lost when doing so from the Dark or Sepia theme), and always-aligned line numbers in code blocks. And from v0.13.1: GitHub-style alerts (Note, Tip, Important...), an unsaved-changes indicator in Edit Mode that confirms before discarding them, and several stability fixes (closing the window with unsaved changes, internal links with accented characters).

---

## Product features
*(up to 20, short summaries — shown as a bulleted list)*

1. Markdown reader and editor: create new documents (Ctrl+N) or edit and save existing ones
2. Instant opening (under 200 ms), no accounts, no telemetry, no ads
3. Optional AI assistant (off by default): local model, cloud with your own API key, or your agent; you review every change
4. Inline AI on the selected text: improve, fix, translate, shorten
5. Edit Mode with a live split view (code + preview)
6. Double-click the preview to jump to the code; context menu to go to the preview
7. Paste a screenshot or drop an image: it is saved to images and its code is inserted
8. Markdown formatting toolbar (16 actions) + Tab/Shift+Tab list indenting
9. Directory tree explorer and Quick Open file switcher (Ctrl+K)
10. Export to Typst (.typ) to keep editing with a Typst editor
11. Conflict handling and auto-reload if the file changes from another program
12. Built-in Markdown syntax help (interactive cheat sheet)
13. Mermaid diagrams rendered as interactive SVG
14. Math equations in LaTeX, rendered with KaTeX
15. Syntax highlighting for 24+ languages, also when printing/exporting to PDF
16. GitHub-style alerts, task lists, and footnotes (GFM)
17. Automatic table of contents and instant text search (Ctrl+F)
18. Three reading themes: Light, Dark, and Sepia
19. Navigation with history, remote documents by URL, recent files, and zoom
20. Interface available in English and Spanish

---

## Additional fields

### Short title
*(optional shorter version of the name, used on Xbox — leave blank if not applicable)*

DBV Markdown Reader

### Short description
*(recommended max. 270 characters)*

Native Markdown reader and editor for Windows: fast, lightweight, and local. Live Edit Mode, optional AI assistant (local, cloud, or your own agent), Mermaid, KaTeX, export to Typst and PDF, and three themes. No telemetry, no accounts.

---

## Additional information

### Keywords
*(up to 7, 40 characters each)*

- markdown
- markdown editor
- markdown reader
- documentation viewer
- github readme
- markdown notes
- mermaid diagrams

### Copyright and trademark info

© 2026 David Bueno Vallejo

### Additional license terms

*(leave blank — standard Store terms apply; the app itself is MIT licensed)*

### Developed by

David Bueno Vallejo

---

## Notes for certification
*(Partner Center's "Additional Testing Info" screen — "Description" field. Not visible to end users, only to the certification team. No credentials required: leave the "Credentials" table empty.)*

This application does not require an account, sign-in, or any kind of credentials — it works fully offline and does not collect any personal data. The only feature that can use the network is the optional AI assistant, which is off by default and only acts if the user connects it.

To test it:
1. When opened with no file, it shows an empty screen with a button to open a file and another to create a new document (Ctrl+N), or a `.md` file can be dragged and dropped directly onto the window.
2. A test file with a `.md` extension and basic Markdown content can be created, for example:

   ````markdown
   # Test title

   Text in **bold** and *italic*, a list:
   - One
   - Two

   ```javascript
   console.log('hello');
   ```
   ````

3. Edit Mode: the pencil icon in the top toolbar (or Ctrl+E) opens a split panel with the code on the left and the rendered preview on the right; changes are saved with Ctrl+S.
4. The app can also be associated with the `.md` extension from Windows' Settings > Default apps, then any `.md` file can be opened by double-clicking it in File Explorer.

5. AI assistant (optional): the sparkles button (✨) in the top bar opens an assistant that **does nothing until the user connects a model or an agent on their own** (a local server such as Ollama, their own API key, or an already installed agent). It is off by default and not needed to test any other feature: with no AI connected it loads nothing and opens no connection.
6. Pasting images: in Edit Mode, pasting an image from the clipboard (for example a screenshot taken with Win+Shift+S) saves it to an "images" folder next to the document and inserts its code.

There is no functionality hidden behind a sign-in and no paid content — every feature is available from first use.
