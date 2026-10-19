# 🧭 DBV Markdown Reader Guide

> How to use the app: open, read, search, edit, export and the settings. To learn how to write Markdown (headings, tables, formulas, diagrams…) see the **Markdown syntax** tab above.
>
> This window opens with **F1** or the **?** button in the top bar, and closes with **Esc**.

---

## 📑 Contents

- [1. Getting started](#1-getting-started)
- [2. The window](#2-the-window)
- [3. Reading comfortably](#3-reading-comfortably)
- [4. Moving between documents](#4-moving-between-documents)
- [5. Searching](#5-searching)
- [6. Editing](#6-editing)
- [7. The AI assistant](#7-the-ai-assistant)
- [8. Printing and exporting](#8-printing-and-exporting)
- [9. Preferences](#9-preferences)
- [10. Keyboard shortcuts](#10-keyboard-shortcuts)
- [11. Updates and questions](#11-updates-and-questions)

---

## 1. Getting started

There are several ways to open a `.md` document:

- **File → Open file…** (`Ctrl/Cmd + O`), or the button on the welcome screen.
- **Drag** the file onto the window. If you drag a **folder**, it becomes the root of the Files tab.
- **Double-click** a `.md` in your system's file manager, or *Open with…* → DBV Markdown Reader. Opening several does not multiply processes: each one gets its own window.
- **File → Open from URL…** for a `.md` published on the internet (`http://` or `https://`).
- **File → Recent files…** to go back to what you opened last.
- **File → New document** (`Ctrl/Cmd + N`) asks where to save it, creates the empty file and goes straight into Edit mode.

From the command line: `dbv-md-reader path/to/document.md`.

If the file changes on disk because you save it from another program, the view **reloads by itself** and keeps the spot where you were reading.

---

## 2. The window

The top bar holds, from left to right:

- **The document name**, with its estimated reading time and, when relevant, the *Read-only* or *Modified* marks. A thin bar under the header shows how far you have read.
- **Three menus**:
  - **File**: new, open, open from URL, recent files, save, print and export to Typst.
  - **Tools**: find file, go to the preview, connect an AI, this help and *About*.
  - **Preferences**: reading width, editor font size and window options.
- **The language** (dropdown) and the **theme**: Light, Dark or Sepia.
- The everyday buttons: **Search** (the magnifier), **Edit mode**, **side panel**, **pin** (keeps the window above the others, handy for keeping documentation next to your editor), and the **?** (this help) and **i** (*About*) buttons.

On the left, the **side panel** has three tabs:

- **Index**: the document's headings. One click jumps to that section, and the one you are reading is highlighted.
- **Files**: the document's folder, with subfolders and a filter by name.
- **Assistant**: the conversation with the AI, which is optional (see section 7).

The side panel and the window's position and size are **remembered** when you close the app (the window can be left unremembered in Preferences).

---

## 3. Reading comfortably

- **Theme**: Light, Dark or Sepia (for long reading). Code highlighting adapts to each.
- **Zoom**: `Ctrl/Cmd + +`, `Ctrl/Cmd + -` and `Ctrl/Cmd + 0` to reset it. With the cursor inside the editor, those keys change only the editor's font size.
- **Reading width** (Preferences): *Narrow*, *Normal*, *Wide* or *Full*. Very long lines are tiring; pick what you prefer.
- **Wide blocks at full width** (Preferences): with the box checked, tables, code, diagrams and stand-alone images may take more room than the text. Uncheck it to keep everything aligned with the text column.
- **Code blocks** have line numbers and, when you hover them, two buttons: **Copy** and **Wrap line** (to see long lines without scrolling sideways).
- **Mermaid diagrams**: right-click one → *Open in mermaid.live* to view it with free zoom.
- **LaTeX formulas**, **footnotes**, **task lists** and **tables** are shown already rendered.

---

## 4. Moving between documents

- **Links**: a link to another `.md` opens it in the same window; one to a web page opens in your browser. Links to a section of the same document scroll to it.
- **Back and forward**: `Alt + ←` and `Alt + →` walk through the documents you have opened.
- **Find file** (`Ctrl/Cmd + K`): type part of the name of any file in the folder and press `Enter`; use `↑` and `↓` to choose among the results.
- **Files tab**: a click opens the file; `Ctrl/Cmd + click` opens it in a **new window**. Right-click offers *Open in new window* and *Reveal in File Explorer*.
- **Home** and **End** go to the start or the end of the document.

---

## 5. Searching

Press `Ctrl/Cmd + F` or the magnifier. Type and the matches are marked; `Enter` goes to the next one and `Shift + Enter` to the previous one.

In **Edit mode** the search has a **Where to search** selector: **Editor** (the Markdown text as you wrote it, with all its markup) or **Preview** (the rendered text). In the editor the current match stays marked even while the focus is in the search box.

---

## 6. Editing

Press `Ctrl/Cmd + E` (or the pencil button) to enter **Edit mode**: the raw Markdown is on the left, with line numbers, and the rendered view on the right. Drag the edge between them to change how they share the space.

- **Save**: `Ctrl/Cmd + S`. You will see *Modified* while there are unsaved changes; on exit, or when opening another document, you are warned before losing them.
- **Formatting bar**: bold, italic, headings, lists, links, images, tables, code… It wraps the selection or inserts a skeleton to fill in. `Ctrl/Cmd + B` and `Ctrl/Cmd + I` apply bold and italic.
- **Tab** and **Shift + Tab** indent or outdent the line (or every selected line). Very handy in nested lists.
- **Editor font size**: in *Preferences* (Smaller, Larger, Reset), or with `Ctrl/Cmd + +`, `-` and `0` while inside the editor.
- **Both halves stay together**: scrolling one moves the other. **Double-click in the preview** takes the cursor to the text you clicked; `Ctrl/Cmd + Alt + P` does the opposite (from the editor to the preview).
- **Reordering sections**: with Edit mode on, **drag an Index entry** and drop it between others: that whole section (the heading and everything under it) moves in the text. You can also use `Alt + ↑` and `Alt + ↓` on the entry. Undo with `Ctrl/Cmd + Z` and redo with `Ctrl + Y` (or `Ctrl/Cmd + Shift + Z`); after moving a section, undo remembers only that last move.
- **Pasting or dropping images**: paste a screenshot (or drop an image file) and it is saved in an `images/` folder next to the document. In the editor, `![](images/…)` is also inserted at the cursor.
- **If the file changes outside while you edit**: a banner warns you and you choose between keeping your changes or reloading from disk. Nothing is ever lost silently.

To write the syntax itself, see the **Markdown syntax** tab of this help, and the [20 project templates](https://github.com/davidbuenov/dbv-md-reader/tree/master/templates), ready to copy and fill in.

---

## 7. The AI assistant

It is **optional**: until you connect something, the app neither loads the AI code nor opens any connection. It only exists on desktop.

1. Open **Tools → Connect an AI…** or press `Ctrl/Cmd + Shift + I`.
2. Choose where the model comes from: a **local** one (Ollama or LM Studio, nothing leaves your computer), one **in the cloud with your API key**, or an **agent you already have installed** (Claude Code, Gemini CLI, Codex or GitHub Copilot CLI).
3. In the **Assistant** tab you talk about the open document and its folder. Type `@` to mention another `.md`.

**The AI never writes without you reviewing it.** It shows the changes piece by piece and you accept or reject each one; when applied they happen in the editor, and you undo them with `Ctrl/Cmd + Z`.

There is also AI on the selected text (improve, correct, translate, shorten…): in Edit mode, `Ctrl/Cmd + Alt + I` or right-click → *AI: actions on the text…*.

If it is not for you, uncheck **Preferences → Show the AI features** and it disappears from the interface. The full guide is in [docs/IA.en.md](https://github.com/davidbuenov/dbv-md-reader/blob/master/docs/IA.en.md).

---

## 8. Printing and exporting

- **Print / PDF** (`Ctrl/Cmd + P`): opens the system print dialog, and from there you can print or **save as PDF**. Pagination is real (A4), with no headings, tables or code split across pages, and the syntax colours are kept whatever the on-screen theme.
- **Export to Typst** (*File* menu): converts the document to `.typ` (headings, emphasis, code, lists, quotes, tables, images and links). You do not need Typst installed; it is the way to continue with [dbv-typst-editor](https://davidbuenov.github.io/dbv-typst-editor/) if you want fine control over the final PDF.

---

## 9. Preferences

The **Preferences** menu gathers the settings. They apply instantly and are remembered.

| Setting | What it does |
| --- | --- |
| **Reading width** | Narrow, Normal, Wide or Full. |
| **Wide blocks at full width** | Lets tables, code, diagrams and stand-alone images take more room than the text. |
| **Editor font size** | Smaller, larger or reset. Shows the current percentage. |
| **Remember window position and size** | When the app opens, it returns where you left it (never ending up off-screen). |
| **Show the AI features** | Hides or shows everything related to the AI. |

The **language** and the **theme** are in the bar, next to the Preferences menu. The interface is available in Spanish, English and Korean; if your system uses another language, English is used. Only the language you pick yourself is remembered, not the one detected automatically.

---

## 10. Keyboard shortcuts

On macOS, `Cmd` plays the role of `Ctrl`.

| Shortcut | Action |
| --- | --- |
| `F1` | Open this help |
| `Ctrl/Cmd + N` | New document |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + S` | Save (in Edit mode) |
| `Ctrl/Cmd + P` | Print / export to PDF |
| `Ctrl/Cmd + F` | Search |
| `Ctrl/Cmd + K` | Find a file by name |
| `Ctrl/Cmd + E` | Toggle Edit mode |
| `Ctrl/Cmd + Shift + I` | AI assistant (or connect an AI) |
| `Ctrl/Cmd + Alt + I` | AI on the selection (in the editor) |
| `Ctrl/Cmd + Alt + P` | Go to the preview from the cursor (in the editor) |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Bold / italic (in the editor) |
| `Tab` / `Shift + Tab` | Indent / outdent (in the editor) |
| `Alt + ↑` / `Alt + ↓` | Move the selected Index section (Edit mode) |
| `Ctrl/Cmd + +` / `-` / `0` | Zoom in / zoom out / reset zoom |
| `Alt + ←` / `Alt + →` | Back / forward in history |
| `Home` / `End` | Start / end of the document |
| `Esc` | Close the open panel or dialog |

---

## 11. Updates and questions

- **About** (the **i** button or the Tools menu) shows the version and the **Check for updates** button. It is never checked at startup. In the Microsoft Store or Google Play versions, the store installs updates by itself.
- Source code, downloads, issues and proposals: [github.com/davidbuenov/dbv-md-reader](https://github.com/davidbuenov/dbv-md-reader).

---

<div align="center">

Made with care by **[David Bueno Vallejo](https://github.com/davidbuenov)** · MIT License

</div>
