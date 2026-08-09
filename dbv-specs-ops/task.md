# 📋 Backlog & Task Tracking: dbv-md-reader

> **Estado:** Fases 0 a 6 COMPLETADAS (parcialmente — ver ⚠️ Deuda Técnica) · Fase 7 en curso  
> **Última Actualización:** 2026-08-09  

---

## ⚠️ Deuda Técnica Detectada (Auditoría 2026-08-09)

Al revisar el código real frente a `ARCHITECTURE.md`/`SPECIFICATIONS.md`, estos RF documentados como decisión arquitectónica **no están implementados** (ni el crate correspondiente aparece en `Cargo.toml`):

- **RF-03 (Sanitización Ammonia):** No implementado. El HTML embebido se renderiza crudo (`html: true` en `markdown-it`, sin filtrado en Rust). Riesgo de seguridad activo.
- **RF-06 (Auto-Reload / `notify`):** No implementado. No hay watcher ni evento `file-changed`.
- **RF-07 (`asset://` para imágenes locales):** No implementado. **Causa el bug reportado por el usuario de imágenes que no cargan.**
- **RF-08A (fetch de `.md` remotos):** No implementado. Solo funciona la navegación a `.md` locales.

Ver detalle y estado corregido casilla por casilla en `docs/SPECIFICATIONS.md` §3.

---

## 📌 Snapshot de Contexto (Estado Actual)

- **Fase Actual:** `/ship` COMPLETADO — v0.2.0. RF-03/06/07/11 implementados y verificados en la app real; RF-08A implementado y compilado, pendiente de una prueba manual con una URL real (sin red en el entorno de verificación).
- **Build release:** `cargo build --release` → `dbv-md-reader.exe` en la raíz actualizado a **v0.2.0, 14.5 MB** (dentro del NFR relajado <20 MB).
- **Sin repositorio Git:** este proyecto no tiene `.git` inicializado, así que no se ha creado tag de versión ni commit — solo se han actualizado los ficheros de versión (`package.json`, `Cargo.toml`, `tauri.conf.json`) y `CHANGELOG.md`.

### 🔹 Fase 8: RF-12 "Acerca de" + fix de zoom en TOC (2026-08-09, edición rápida)
- [x] Comando Rust `get_app_version` (lee la versión de `Cargo.toml` vía `app.package_info()`).
- [x] Modal `#about-modal` con versión, enlaces a `davidbuenov.com` / `github.com/davidbuenov` (vía `shell.open`) y licencia.
- [x] Fix: `applyZoom()` y la restauración de zoom guardado en `init()` ahora aplican `style.zoom` también a `#toc-sidebar`, no solo a `#content`.
- [x] Verificado en la app real: el modal muestra "Versión 0.2.0" correctamente. El fix de zoom del TOC se implementó con el mismo patrón ya probado para `#content` (ADR-005) pero no se verificó visualmente en este ciclo (se interrumpió la automatización de UI al detectar que un clic había perdido el foco de la ventana de la app).
- [ ] **Pendiente:** copiar el build más reciente (`src-tauri\target\release\dbv-md-reader.exe`) sobre el `.exe` de la raíz — bloqueado por una ventana de la app que el usuario tiene abierta desde antes.
- **Entorno & Toolchain:**
  - Rust toolchain: `rustc 1.97.1` / `cargo 1.97.1` (Edition 2021).
  - Node.js / NPM: Dependencias de vendor empaquetadas localmente en `src/vendor/` (`markdown-it.min.js`, `prism.min.js`, `mermaid.min.js`).
  - Ejecutable standalone de producción: `dbv-md-reader.exe` en la raíz del proyecto (~12.5 MB, 100% autónomo sin consola).
- **Características Principales Implementadas & Verificadas:**
  1. **Apertura de Documentos:**
     - Argumento CLI por línea de comandos (`dbv-md-reader.exe ruta/fichero.md`).
     - Diálogo de selección de archivos nativo de Windows (botón "Abrir" / `Ctrl + O`) mediante `open_file_dialog` en Rust (`tauri-plugin-dialog`).
     - Arrastrar y soltar (Drag & Drop) nativo de archivos `.md` mediante el evento `tauri://drag-drop` de Tauri v2.
  2. **Renderizado & Markdown:**
     - Parseo CommonMark con `markdown-it` (Soporte HTML inline como `<a id="..."></a>` habilitado).
     - Resaltado de sintaxis de código con Prism.js + botón "Copiar".
     - Renderizado de diagramas de flujo y arquitectura ` ```mermaid ` a SVG interactivos.
     - Auto-generación de Tabla de Contenidos (TOC) en barra lateral desplegable (auto-abierta si el documento contiene encabezados).
  3. **Navegación & Enrutamiento de Enlaces:**
     - Enlaces `.md` relativos resueltos correctamente separando rutas de fragmentos `#ancla` (`modulos/Modulo.md#seccion`).
     - Enlaces web externos (`http://` / `https://`) abiertos automáticamente en el navegador predeterminado del S.O.
     - Historial de navegación `←` / `→` (botones e historial con atajos `Alt + ←` / `Alt + →`).
  4. **Experiencia de Lectura & Utilidades:**
     - Selector de Temas Visuales: Claro (Light), Oscuro (Dark) y Sepia, persistido en `localStorage`.
     - Buscador interno de texto (`Ctrl + F`) con resaltado de coincidencias y contador `1/N`.
     - Sistema de Zoom Proporcional (`Ctrl + Rueda`, `Ctrl + +`, `Ctrl + -`, `Ctrl + 0`) usando CSS `zoom` con toast indicador y persistencia local.
     - Modo Impresión / Exportación a PDF con `@media print` (`Ctrl + P`).

---

## 🚀 Fases de Desarrollo (Backlog)

### 🔹 Fase 0: Bootstrap & Especificaciones SDD
- [x] Adoptar framework `dbv-specs-ops` en la subcarpeta del proyecto.
- [x] Definir `project.config.md`, `SPECIFICATIONS.md`, `ARCHITECTURE.md`, `DESIGN.md`.
- [x] Extender especificaciones con Auto-Reload (RF-06), `asset://` para imágenes (RF-07), Enrutador de Enlaces `.md` (RF-08), Drag & Drop (RF-09) y Utilerías de Lectura (RF-10).
- [x] Generar archivos de activación en la raíz (`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.windsurfrules`, `.github/copilot-instructions.md`).
- [x] Generar `README.md` y `LICENSE` en la raíz.

### 🔹 Fase 1: Core de Rust & Tauri v2 (Backend, Dialogs & File Handlers)
- [x] Inicializar la estructura Tauri v2 (`src-tauri/` y `package.json`).
- [x] Configurar `Cargo.toml` con dependencias: `tauri-plugin-shell`, `tauri-plugin-dialog`, `serde`.
- [x] Implementar la captura de argumentos CLI (`std::env::args`) en `src-tauri/src/lib.rs`.
- [x] Implementar comandos Tauri `read_file`, `open_file_dialog` y `resolve_relative_path`.
- [x] Habilitar `"withGlobalTauri": true` y `"label": "main"` en `tauri.conf.json`.

### 🔹 Fase 2: Frontend Reader & Parser CommonMark (Sin Bundler)
- [x] Diseñar interfaz minimalista con CSS semántico puro (variables CSS para temas, Flexbox, fuentes Inter/JetBrains Mono).
- [x] Empaquetar librerías vendor locales en `src/vendor/` para funcionamiento 100% offline.
- [x] Implementar `app.js` mediante IIFE clásico (previniendo fallos de ES modules en webview).
- [x] Integrar `markdown-it` con soporte HTML activado para etiquetas inline `<a id="...">`.
- [x] Integrar `Prism.js` para resaltado de código con botón overlay "Copiar".

### 🔹 Fase 3: Diagramas Mermaid.js Vectoriales (SVG)
- [x] Integrar `mermaid.js` en el frontend.
- [x] Detectar bloques ` ```mermaid ` y convertirlos en gráficos SVG interactivos.

### 🔹 Fase 4: Experiencia de Lectura & Navegación (TOC, Zoom, Enrutador, Temas)
- [x] Implementar parser automático de encabezados para construir la Tabla de Contenidos (TOC) en barra lateral.
- [x] Implementar buscador interno de texto con atajo `Ctrl + F` e iluminación de coincidencias.
- [x] Implementar enrutador de enlaces (separación de `filePart` y `anchorPart` para navegación por fragmentos).
- [x] Selector de temas visuales (Light, Dark, Sepia).
- [x] Sistema de zoom proporcional con CSS `zoom`, toast emergente e integración `Ctrl + Rueda` / `Ctrl + +/-/0`.

### 🔹 Fase 5: Pruebas, Verificación & Auditoría
- [x] Probar apertura de documentos de curso con rutas complejas y anclas en Windows.
- [x] Verificar funcionamiento de Drag & Drop y selector nativo de archivos.
- [x] Asegurar panel de errores visible para depuración limpia.

### 🔹 Fase 6: Empaquetado Release
- [x] Compilar ejecutable de producción standalone `dbv-md-reader.exe` con `custom-protocol` activado.
- [x] Documentar estado en `task.md`, `memory.md` y `CHANGELOG.md`.

### 🔹 Fase 7: Deuda Técnica (RF-03/06/07/08A) + RF-11 Archivos Recientes — Plan aprobado por el usuario (2026-08-09, alcance completo, NFR relajado a <20 MB)
- [x] **7.1 RF-07 Imágenes (bug urgente):** `assetProtocol` en `tauri.conf.json`; `resolveImages()` en `app.js` (resuelve + `convertFileSrc`). Verificado.
- [x] **7.2 RF-03 Sanitización:** Vendorizado `dompurify.min.js` (v3.4.13); `DOMPurify.sanitize(md.render(raw), {ADD_ATTR:['id','class','name']})` en `renderMarkdown()`. Verificado.
- [x] **7.3 RF-06 Auto-Reload:** `notify` v8.2.0; comando `watch_file` (vigila directorio padre, ADR-010) + evento `file-changed`; `reloadCurrentDocument()` en `app.js` con debounce y scroll preservado. Verificado.
- [x] **7.4 RF-08A Remotos:** `ureq` v3.4.0; `read_file` y `resolve_relative_path` manejan `http(s)://` (descarga + unión de URLs). Compila; **pendiente prueba manual con URL real** (sin red en el entorno de verificación).
- [x] **7.5 RF-11 Archivos Recientes:** `RecentFile` + `get_recent_files` / `add_recent_file` / `clear_recent_files` en Rust (`recent_files.json`); `isPrimaryOpen` en `loadDocument()`; botón `#btn-recent` + panel + estilos. Verificado.
- [x] **7.6 Build:** Comandos registrados en `generate_handler!`; `cargo check` y `cargo build --release` sin errores ni warnings.
- [x] **7.7 Pruebas manuales:** Ejecutadas 4 de 5 (imágenes, sanitización + anclas + código con `<` + intento XSS, auto-reload, recientes) lanzando el `.exe` release con un `.md` de prueba real — ver Lección 5 en `memory.md`. Falta RF-08A remoto (sin red disponible en este entorno).
- [x] **7.8 Ship:** `CHANGELOG.md` movido a `[0.2.0] - 2026-08-09`; versión actualizada en `package.json`/`Cargo.toml`/`tauri.conf.json`; `README.md` actualizado (DOMPurify, Recientes, Auto-Reload, remotos); `.exe` de la raíz reemplazado por el build v0.2.0 (14.5 MB). Sin repositorio Git en este proyecto, así que no hay tag ni commit que crear.
