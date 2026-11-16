# Notas de actualización v0.20.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9N7BMDZGCP0S`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.20.0: 10 temas, Modo Vim opcional, barra de estado y guardado automático, y una IA con niveles de autonomía.

• 10 temas curados y uno personalizado (Claro, Oscuro, Sepia, Alto contraste, Nord, Dracula, Catppuccin, Solarized, Gruvbox), con tres botones rápidos en la cabecera y un editor de colores con aviso de contraste en Preferencias → Temas y colores…
• Modo Vim opcional (Preferencias): NORMAL, INSERT y VISUAL con cursor de bloque en el editor, y j/k, gg/G y ]]/[[ para moverte al leer.
• Barra de estado con línea y columna, números de línea relativos y guardado automático que nunca pisa un cambio hecho desde otro programa.
• Insertar tabla (también convierte lo pegado de una hoja de cálculo), Archivo → Guardar como… (Ctrl+Mayús+S) y Archivo → Salir (Ctrl+Q).
• IA con niveles de autonomía (Preguntar todo, Preguntar al modificar, Solo lectura): nada se escribe sin tu revisión, y el icono parpadea en la barra de tareas cuando espera tu aprobación.
• Ctrl+rueda hace zoom en el panel que hay bajo el puntero, y el pellizco del panel táctil va escalón a escalón.
• Seguridad: un diagrama Mermaid de un documento ajeno ya no puede ejecutar código.
```

### 🇬🇧 English

```text
Version 0.20.0: 10 themes, optional Vim mode, status bar and auto save, and an AI with autonomy levels.

• 10 curated themes plus a custom one (Light, Dark, Sepia, High contrast, Nord, Dracula, Catppuccin, Solarized, Gruvbox), with three quick buttons in the header and a color editor with a contrast warning in Preferences → Themes and colors…
• Optional Vim mode (Preferences): NORMAL, INSERT and VISUAL with a block cursor in the editor, and j/k, gg/G and ]]/[[ to move while reading.
• Status bar with line and column, relative line numbers and auto save that never overwrites a change made in another program.
• Insert table (it also converts what you paste from a spreadsheet), File → Save as… (Ctrl+Shift+S) and File → Exit (Ctrl+Q).
• AI with autonomy levels (Ask for everything, Ask before changes, Read only): nothing is written without your review, and the icon flashes in the taskbar when it is waiting for your approval.
• Ctrl+wheel zooms the panel under the pointer, and a touchpad pinch goes one step at a time.
• Security: a Mermaid diagram in someone else's document can no longer run code.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.20.0 (Minor Release over 0.19.0)

WHAT'S NEW IN 0.20.0:
- 10 curated themes plus a user-customizable one, chosen in Preferences > "Themes and colors…" or with 3 configurable quick buttons in the header. Mermaid diagrams follow the theme; printing always uses the Light palette.
- Optional Vim mode (off by default) in Preferences: modal editing in the Markdown editor with a mode badge in a new bottom status bar, plus Vim-style keys to scroll while reading. Implemented as an in-app module, with no new third-party dependencies.
- Editor status bar (Ln/Col and selection), optional relative line numbers, optional auto save (never overwrites a file changed on disk by another program), and Tools > "Insert table…".
- File > "Save as…" (Ctrl+Shift+S) and File > "Exit" (Ctrl+Q), which closes every window and asks first in any window with unsaved changes.
- Optional AI assistant: autonomy levels (Ask for everything / Ask before changes / Read only). There is no automatic mode: nothing is ever written without the user's review. When the AI waits for approval and the window is not focused, the taskbar icon flashes until the window is focused again.
- Security hardening: Mermaid diagrams are rendered in strict mode, so a diagram inside a third-party document cannot run script.

CREDENTIALS:
None required. Every feature works offline without any account. The optional AI assistant is off unless the user connects their own local server, CLI agent or API key; keys stay in Windows Credential Manager.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch DBV Markdown Reader and click "New document" (Ctrl+N), or drag any .md file onto the window.
2. Click the three theme buttons in the header, then Preferences > "Themes and colors…" to preview Nord, Dracula or High contrast.
3. Press Ctrl+E for Edit mode: the bottom status bar shows "Ln 1, Col 1". Tools > "Insert table…" inserts a 3×3 table; Ctrl+Z undoes it.
4. Preferences > "Vim mode": the status bar shows a NORMAL badge; press i to type, Esc to return to NORMAL, and :w + Enter to save.
5. File > "Exit" (Ctrl+Q) closes the app; with unsaved changes it asks before closing.

ADDITIONAL TECHNICAL CONTEXT:
- Same single executable as 0.19.0 (no sidecars); the .md file association is unchanged.
- No new network destinations. The only optional network use is the user-configured AI provider and the manual "Check for updates" link.
- No telemetry, advertising or tracking. Privacy policy: https://davidbuenov.github.io/dbv-md-reader/privacidad.html
```

---

## 3. Checklist de verificación del paquete MSIX

Un solo ejecutable, **sin sidecars** (a diferencia de `dbv-typst-editor`), con la asociación `.md`.

- [x] Versión del paquete: **`0.20.0.0`** (en el nombre del `.msixbundle` y `Version="0.20.0.0"` en `AppxManifest.xml`). *(verificado el 2026-11-16)*
- [x] Tamaño de `src-tauri\target\msix\dbv-md-reader_0.20.0.0.msixbundle`: del orden del de la `v0.19.0` (~7,4 MB). *(**7.570.842** bytes frente a 7.446.788, verificado el 2026-11-16)*
- [x] Revisados los iconos de `src-tauri\target\appx\x64\Assets\` (sin placeholders de un solo color). *(los cuatro, 1,9–8 KB; `Square150x150Logo.png` mirado a ojo)*
- [x] `AppxManifest.xml` con la asociación `.md` (y `.markdown`) (checklist en `dbv-specs-ops/docs/MARKETPLACE_PUBLISHING.md` §3).
- [ ] En Partner Center → Envíos → Paquetes: subir `src-tauri/target/msix/dbv-md-reader_0.20.0.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: copiar de `descripcionStore_es.md` y `descripcionStore_en.md` la Descripción, Características del producto (20/20) y Descripción corta, y la sección 1 de este fichero en «Novedades de esta versión»; las notas de la sección 2 en «Notas para la certificación».
- [ ] Opcional: capturas nuevas con los temas y la barra de estado.
