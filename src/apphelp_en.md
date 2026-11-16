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
- [11. Vim mode](#11-vim-mode)
- [12. Updates and questions](#12-updates-and-questions)

---

## 1. Getting started

There are several ways to open a `.md` document:

- **File → Open file…** (`Ctrl/Cmd + O`), or the button on the welcome screen.
- **Drag** the file onto the window. If you drag a **folder**, it becomes the root of the Files tab.
- **Double-click** a `.md` in your system's file manager, or *Open with…* → DBV Markdown Reader. Opening several does not multiply processes: each one gets its own window.
- **File → Open from URL…** for a `.md` published on the internet (`http://` or `https://`).
- **File → Recent files…** to go back to what you opened last.
- **File → New document** (`Ctrl/Cmd + N`) asks where to save it, creates the empty file and goes straight into Edit mode.
- **File → Save as…** (`Ctrl/Cmd + Shift + S`) saves the document under another name or folder, and the window switches to the new file. The original is left as it was. It also works on a document opened from a URL, to keep a local copy.
- **File → Exit** (`Ctrl + Q`; on macOS, `Cmd + Q`) closes every window of the app. If any of them has unsaved changes, that window asks you first.

From the command line: `dbv-md-reader path/to/document.md`.

If the file changes on disk because you save it from another program, the view **reloads by itself** and keeps the spot where you were reading.

---

## 2. The window

The top bar holds, from left to right:

- **The document name**, with its estimated reading time and, when relevant, the *Read-only* or *Modified* marks. A thin bar under the header shows how far you have read.
- The everyday buttons: **Search** (the magnifier), **Edit mode** (and **Save** while you edit), **side panel** and, if you have one connected, the **AI** ✨.
- **Three menus**:
  - **File**: new, open, open from URL, recent files, save, save as, print, export to Typst and exit.
  - **Tools**: find file, go to the preview, insert table, connect an AI, this help and *About*.
  - **Preferences**: themes and colors, reading width, editor font size, Vim mode, relative line numbers, auto save and window options.
- **The language** (dropdown) and **three theme buttons**. By default they are Light, Dark and Sepia, and each button can be set to any theme (see section 3).
- The **pin** (keeps the window above the others, handy for keeping documentation next to your editor), and the **?** (this help) and **i** (*About*) buttons.

On the left, the **side panel** has three tabs:

- **Index**: the document's headings. One click jumps to that section, and the one you are reading is highlighted.
- **Files**: the document's folder, with subfolders and a filter by name.
- **Assistant**: the conversation with the AI, which is optional (see section 7).

The side panel and the window's position and size are **remembered** when you close the app (the window can be left unremembered in Preferences).

---

## 3. Reading comfortably

- **Theme**: there are ten, the same across the whole DBV collection: Dark, Light, Sepia, High contrast, Nord, Dracula, Catppuccin Mocha, Catppuccin Latte, Solarized Dark and Gruvbox Dark, plus a **Custom** one. Everything follows the theme: text, code, Mermaid diagrams, menus and the Assistant. Printing always uses the Light palette.
- **Preferences → Themes and colors…** opens a dialog with one card per theme (the arrow keys work too). There you set the three quick buttons in the bar and edit the Custom theme: copy the palette of a theme and change each color. If the text ends up with too little contrast, it warns you.
- **Zoom**: `Ctrl/Cmd + +`, `Ctrl/Cmd + -` and `Ctrl/Cmd + 0` to reset it. With the cursor inside the editor, those keys change only the editor's font size.
- **Wheel zoom**: `Ctrl/Cmd + wheel` acts on the panel under the pointer. Over the editor it changes the editor font; over the reading view or the preview, the reading zoom. A touchpad pinch goes one step at a time, without sudden jumps.
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
- **Status bar**: at the foot of the editor you see `Ln X, Col Y` and, with a selection, how many characters are selected. An emoji or a Korean syllable counts as one character.
- **Relative line numbers** (Preferences): each line shows its distance to the cursor line, and the cursor line shows its number. Handy with Vim mode (`5j`, `3dd`…).
- **Auto save** (Preferences, off by default): saves 2 seconds after you stop typing and when you leave Edit mode, with a discreet note in the status bar. It never overwrites a change made in another program: if the file changed on disk, it does not write and warns you. It does not act on documents opened from a URL.
- **Formatting bar**: bold, italic, headings, lists, links, images, tables, code… It wraps the selection or inserts a skeleton to fill in. `Ctrl/Cmd + B` and `Ctrl/Cmd + I` apply bold and italic.
- **Insert table**: the table button of the formatting bar or **Tools → Insert table…** open a panel with rows, columns (1 to 20) and «Header row». The table goes on its own line with the cursor in the first cell, and `Ctrl/Cmd + Z` undoes it in one go. If you first select text with tabs or commas (what you paste from a spreadsheet), it turns it into a table.
- **Tab** and **Shift + Tab** indent or outdent the line (or every selected line). Very handy in nested lists.
- **Editor font size**: in *Preferences* (Smaller, Larger, Reset), with `Ctrl/Cmd + +`, `-` and `0` while inside the editor, or with `Ctrl/Cmd + wheel` over it.
- **Both halves stay together**: scrolling one moves the other. **Double-click in the preview** takes the cursor to the text you clicked; `Ctrl/Cmd + Alt + P` does the opposite (from the editor to the preview).
- **Reordering sections**: with Edit mode on, **drag an Index entry** and drop it between others: that whole section (the heading and everything under it) moves in the text. You can also use `Alt + ↑` and `Alt + ↓` on the entry. Undo with `Ctrl/Cmd + Z` and redo with `Ctrl + Y` (or `Ctrl/Cmd + Shift + Z`); after moving a section, undo remembers only that last move.
- **Pasting or dropping images**: paste a screenshot (or drop an image file) and it is saved in an `images/` folder next to the document. In the editor, `![](images/…)` is also inserted at the cursor.
- **If the file changes outside while you edit**: a banner warns you and you choose between keeping your changes or reloading from disk. Nothing is ever lost silently.
- **Vim mode**: if you are used to Vim, turn it on in Preferences. Section 11 explains it.

To write the syntax itself, see the **Markdown syntax** tab of this help, and the [20 project templates](https://github.com/davidbuenov/dbv-md-reader/tree/master/templates), ready to copy and fill in.

---

## 7. The AI assistant

It is **optional**: until you connect something, the app neither loads the AI code nor opens any connection. It only exists on desktop.

1. Open **Tools → Connect an AI…** or press `Ctrl/Cmd + Shift + I`.
2. Choose where the model comes from: a **local** one (Ollama or LM Studio, nothing leaves your computer), one **in the cloud with your API key**, or an **agent you already have installed** (Claude Code, Gemini CLI, Codex or GitHub Copilot CLI).
3. In the **Assistant** tab you talk about the open document and its folder. Type `@` to mention another `.md`.

**The AI never writes without you reviewing it.** It shows the changes piece by piece and you accept or reject each one; when applied they happen in the editor, and you undo them with `Ctrl/Cmd + Z`.

**Autonomy**: the selector in the Assistant bar decides what the AI may do without asking you:

| Level | What it does |
| --- | --- |
| **Ask for everything** | Asks before reading any file in the folder other than the open document. |
| **Ask before changes** | Reads the folder freely and proposes changes for you to review (the default level). |
| **Read only** | Answers, but cannot propose changes. |

There is no «automatic» level: in this app nothing is written without your review. With agents (Claude Code, Codex…) the selector controls what the agent asks the app for; the agent's own tools are governed by the agent.

If the AI is **waiting for your approval** and the window is not in front, its icon flashes in the taskbar (on macOS it bounces in the Dock) until you come back to it.

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
| **Themes and colors…** | Pick a theme, set the three quick buttons and edit the Custom theme. |
| **Reading width** | Narrow, Normal, Wide or Full. |
| **Wide blocks at full width** | Lets tables, code, diagrams and stand-alone images take more room than the text. |
| **Editor font size** | Smaller, larger or reset. Shows the current percentage. |
| **Vim mode** | Vim-style editing in the editor and Vim keys to move while reading (section 11). Off by default. |
| **Relative line numbers** | In the editor, each line shows its distance to the cursor line. Off by default. |
| **Auto save** | Saves on its own 2 seconds after you stop typing. Off by default. |
| **Remember window position and size** | When the app opens, it returns where you left it (never ending up off-screen). |
| **Show the AI features** | Hides or shows everything related to the AI. |

The **language** and the **theme buttons** are in the bar, next to the Preferences menu. The interface is available in Spanish, English and Korean; if your system uses another language, English is used. Only the language you pick yourself is remembered, not the one detected automatically.

---

## 10. Keyboard shortcuts

On macOS, `Cmd` plays the role of `Ctrl`.

| Shortcut | Action |
| --- | --- |
| `F1` | Open this help |
| `Ctrl/Cmd + N` | New document |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + S` | Save (in Edit mode) |
| `Ctrl/Cmd + Shift + S` | Save as… |
| `Ctrl/Cmd + P` | Print / export to PDF |
| `Ctrl + Q` (`Cmd + Q` on macOS) | Exit |
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
| `Ctrl/Cmd + wheel` | Zoom the panel under the pointer |
| `Alt + ←` / `Alt + →` | Back / forward in history |
| `Home` / `End` | Start / end of the document |
| `Esc` | Close the open panel or dialog |

---

## 11. Vim mode

Turn it on in **Preferences → Vim mode**. When it is off (the default), the editor works as always and these keys do nothing.

When you enter Edit mode the editor starts in **NORMAL** mode: letters are commands, not text. At the foot of the editor you see the current mode (**NORMAL**, **INSERT**, **VISUAL** or **V-LINE**) and, in NORMAL and VISUAL, a block cursor.

**What it understands** (a subset of Vim, not all of Vim):

| Group | Keys |
| --- | --- |
| Moving | `h j k l` · `w b e` and `W B E` · `0 ^ $` · `gg G` and `{n}G` · `f F t T` with `;` `,` · `%` between parentheses and brackets · `{ }` between paragraphs · `Ctrl+D` / `Ctrl+U` half a screen |
| Counts | A number in front: `3w`, `5j`, `2dd`, `d3w` |
| Operators | `d` (delete), `c` (change), `y` (yank), `>` and `<` (indent) with a motion or in Visual · `dd cc yy >> <<` · `D C Y` · `x X` · `p P` · `r{c}` · `J` · `~` · text objects `iw` and `aw` (`diw`, `ciw`, `daw`) |
| Typing | `i a I A o O`; back to NORMAL with `Esc` or `Ctrl+[` |
| Selecting | `v` (characters) and `V` (lines) |
| Undo | `u` undoes and `Ctrl+R` redoes. Each command and each stay in INSERT is a single step. Moving a section, the AI or inserting a table also count as one step. |
| Search | `/text` forward and `?text` backward, with `n` and `N` to repeat. Case-insensitive. |
| Commands | `:w` saves · `:wq` or `:x` saves and leaves Edit mode · `:q` leaves Edit mode (without closing the window) · `:{n}` goes to line n |

**Keep in mind:**

- The app's `Ctrl/Cmd` shortcuts (save, search, Edit mode, zoom, AI…) keep working in every mode.
- `y` copies to an internal register, as in Vim, not to the system clipboard. `Ctrl+C` and `Ctrl+V` still work for the clipboard.
- `Esc` in INSERT or VISUAL only goes back to NORMAL. In NORMAL it closes the open panel, as always.
- With keyboards that compose characters (Korean, for example), letters only type in INSERT. In NORMAL, press `i` before typing.
- Not included: macros, named registers, marks, `:s`, block Visual, `.vimrc` and `.` (repeat the last change).

**While reading** (and in the Edit mode preview), with Vim mode on:

| Key | Action |
| --- | --- |
| `j` / `k` | Down / up one line |
| `Ctrl+D` / `Ctrl+U` | Down / up half a screen |
| `gg` / `G` | Start / end of the document |
| `]]` / `[[` | Next / previous heading (like a click in the Index) |
| `/` | Search |
| `n` / `N` | Next / previous match |

`Ctrl+F` is still Search. The keys do nothing while you type in a text box, a menu or a dialog.

---

## 12. Updates and questions

- **About** (the **i** button or the Tools menu) shows the version and the **Check for updates** button. It is never checked at startup. In the Microsoft Store or Google Play versions, the store installs updates by itself.
- Source code, downloads, issues and proposals: [github.com/davidbuenov/dbv-md-reader](https://github.com/davidbuenov/dbv-md-reader).

---

<div align="center">

Made with care by **[David Bueno Vallejo](https://github.com/davidbuenov)** · MIT License

</div>
