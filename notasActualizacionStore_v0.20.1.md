# Notas de actualización v0.20.1 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9N7BMDZGCP0S`.

> **Es una versión de mantenimiento: para Windows no cambia ninguna función.** La única novedad visible es de macOS (menús en la barra del sistema). Los textos de abajo lo dicen tal cual, sin presentar como novedad nada que un usuario de Windows no vaya a ver.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.20.1: actualización de mantenimiento.

• Sin cambios de funciones en Windows: todo funciona igual que en la 0.20.0.
• En macOS, los menús Archivo, Herramientas y Preferencias pasan a la barra de menús del sistema.
• Ajustes internos en las pruebas automáticas y en la documentación.
```

### 🇬🇧 English

```text
Version 0.20.1: maintenance update.

• No feature changes on Windows: everything works the same as in 0.20.0.
• On macOS, the File, Tools and Preferences menus move to the system menu bar.
• Internal improvements to automated tests and documentation.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.20.1 (Maintenance Release over 0.20.0)

WHAT'S NEW IN 0.20.1:
- No functional change on Windows. The only user-visible change is for macOS (the File, Tools and Preferences menus appear in the system menu bar), which does not apply to this package: on Windows the new code path does nothing and the in-window menus are unchanged.
- Internal: automated UI tests and documentation.

CREDENTIALS:
None required. Every feature works offline without any account. The optional AI assistant is off unless the user connects their own local server, CLI agent or API key; keys stay in Windows Credential Manager.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch DBV Markdown Reader and click "New document" (Ctrl+N), or drag any .md file onto the window.
2. Click the three theme buttons in the header; the document changes theme.
3. Open the File, Tools and Preferences menus in the window header: they work as in 0.20.0.
4. Press Ctrl+E for Edit mode and type; the bottom status bar shows the line and column.

ADDITIONAL TECHNICAL CONTEXT:
- Same single executable as 0.20.0 (no sidecars); the .md and .markdown file associations are unchanged.
- No new network destinations. The only optional network use is the user-configured AI provider and the manual "Check for updates" link.
- No telemetry, advertising or tracking. Privacy policy: https://davidbuenov.github.io/dbv-md-reader/privacidad.html
```

---

## 3. Checklist de verificación del paquete MSIX

Un solo ejecutable, **sin sidecars** (a diferencia de `dbv-typst-editor`), con la asociación `.md`.

- [x] Versión del paquete: **`0.20.1.0`** (en el nombre del `.msixbundle` y `Version="0.20.1.0"` en `AppxManifest.xml`). *(verificado el 2026-11-23)*
- [x] Identidad del manifiesto: `Name="davidbuenov.DBVMarkdownReader"`, `Publisher="CN=13EE2A5D-F49E-48C9-8873-941069B15D63"`, `ProcessorArchitecture="x64"`, `DisplayName` `dbv-md-reader`, igual que en la 0.20.0. *(verificado leyendo `src-tauri\target\appx\x64\AppxManifest.xml`)*
- [x] Tamaño de `src-tauri\target\msix\dbv-md-reader_0.20.1.0.msixbundle`: del orden del de la `v0.20.0`. *(**7.598.180** bytes frente a 7.570.842; el `.msix` interno, 7.596.395)*
- [x] Revisados los iconos de `src-tauri\target\appx\x64\Assets\` (sin placeholders de un solo color), contando colores distintos por muestreo: `Square150x150Logo.png` 125, `Square44x44Logo.png` 296, `StoreLogo.png` 328, `Wide310x150Logo.png` 55 (entre 1,9 y 8 KB). *(checklist anti-placeholder de `dbv-specs-ops/docs/MARKETPLACE_PUBLISHING.md` §3; no se ha abierto cada imagen a ojo)*
- [x] `AppxManifest.xml` con la asociación `.md` y `.markdown`.
- [x] El empaquetado no ha modificado ningún fichero versionado (`git status` limpio en `src-tauri/gen`).
- [ ] En Partner Center → Envíos → Paquetes: subir `src-tauri/target/msix/dbv-md-reader_0.20.1.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: la descripción y las características no cambian respecto a la 0.20.0 (siguen valiendo `descripcionStore_es.md` y `descripcionStore_en.md`, que ahora llevan tus cambios sin commit); copiar la sección 1 de este fichero en «Novedades de esta versión» y las notas de la sección 2 en «Notas para la certificación».
- [ ] Opcional: ninguna captura nueva hace falta, porque Windows no cambia.
