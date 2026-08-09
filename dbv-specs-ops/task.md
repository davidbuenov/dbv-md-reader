# 📋 Backlog & Task Tracking: dbv-md-reader

> **Estado:** Fases 0 a 13 completadas · v0.2.0 publicado en GitHub (repo + Release con `.exe` adjunto)
> **Última Actualización:** 2026-08-09

---

## ⚠️ Deuda Técnica Detectada (Auditoría 2026-08-09) — Resuelta en Fase 7

Al revisar el código real frente a `ARCHITECTURE.md`/`SPECIFICATIONS.md` se encontró que RF-03, RF-06, RF-07 y RF-08A estaban documentados como decisión arquitectónica pero **no implementados**. Todos se cerraron en la Fase 7 (ver detalle casilla por casilla en `docs/SPECIFICATIONS.md` §3).

---

## 📌 Snapshot de Contexto (Estado Actual)

- **Fase Actual:** Todo lo solicitado hasta ahora está completo (RF-03/06/07/08A/11/12, tests, Git). Sin tareas abiertas salvo las anotadas como pendientes más abajo.
- **Build release:** `cargo build --release` → `dbv-md-reader.exe`, **v0.2.0, ~14.5 MB** (dentro del NFR relajado <20 MB, ver ADR-008). El `.exe` de la raíz refleja el build con RF-03/06/07/08A/11 (About + fix de zoom del TOC compilados pero no reempaquetados en el `.exe` de la raíz — ver Fase 8).
- **Entorno & Toolchain:**
  - Rust toolchain: `rustc 1.97.1` / `cargo 1.97.1` (Edition 2021).
  - Node.js / NPM: Dependencias de vendor empaquetadas localmente en `src/vendor/` (`markdown-it.min.js`, `dompurify.min.js`, `prism.min.js`, `mermaid.min.js`).
- **Git:** repositorio inicializado, commit inicial `b359def`, tag `v0.2.0`. Sin remoto configurado — no se ha hecho `push`.
- **Características Principales Implementadas & Verificadas:**
  1. **Apertura de Documentos:**
     - Argumento CLI por línea de comandos (`dbv-md-reader.exe ruta/fichero.md`).
     - Diálogo de selección de archivos nativo de Windows (botón "Abrir" / `Ctrl + O`) mediante `open_file_dialog` en Rust (`tauri-plugin-dialog`).
     - Arrastrar y soltar (Drag & Drop) nativo de archivos `.md` mediante el evento `tauri://drag-drop` de Tauri v2.
     - Documentos Markdown remotos (`http(s)://.md`) descargados vía `ureq` (RF-08A).
     - Archivos Recientes: últimos 10 documentos abiertos explícitamente, persistidos en `recent_files.json` (RF-11).
  2. **Renderizado & Markdown:**
     - Parseo CommonMark con `markdown-it` (soporte HTML inline como `<a id="..."></a>` habilitado).
     - Sanitización XSS con DOMPurify sobre el HTML ya renderizado (RF-03).
     - Resolución de imágenes locales al protocolo `asset://` de Tauri (RF-07).
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
     - Sistema de Zoom Proporcional (`Ctrl + Rueda`, `Ctrl + +`, `Ctrl + -`, `Ctrl + 0`) aplicado al contenido y a la Tabla de Contenidos, con toast indicador y persistencia local.
     - Auto-recarga en caliente cuando el archivo abierto cambia en disco, preservando el scroll (RF-06).
     - Modo Impresión / Exportación a PDF con `@media print` (`Ctrl + P`).
     - Panel "Acerca de" con versión, enlaces a `davidbuenov.com` / GitHub y licencia (RF-12).

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
- [x] **7.4 RF-08A Remotos:** `ureq` v3.4.0; `read_file` y `resolve_relative_path` manejan `http(s)://` (descarga + unión de URLs). Verificado con test de integración contra una URL real (Fase 10).
- [x] **7.5 RF-11 Archivos Recientes:** `RecentFile` + `get_recent_files` / `add_recent_file` / `clear_recent_files` en Rust (`recent_files.json`); `isPrimaryOpen` en `loadDocument()`; botón `#btn-recent` + panel + estilos. Verificado.
- [x] **7.6 Build:** Comandos registrados en `generate_handler!`; `cargo check` y `cargo build --release` sin errores ni warnings.
- [x] **7.7 Pruebas manuales:** imágenes, sanitización + anclas + código con `<` + intento XSS, auto-reload y recientes verificados lanzando el `.exe` release con un `.md` de prueba real (ver Lección 6 en `memory.md`); RF-08A verificado después con test de integración (Fase 10).
- [x] **7.8 Ship:** `CHANGELOG.md` movido a `[0.2.0] - 2026-08-09`; versión actualizada en `package.json`/`Cargo.toml`/`tauri.conf.json`; `README.md` actualizado (DOMPurify, Recientes, Auto-Reload, remotos); `.exe` de la raíz reemplazado por el build v0.2.0 (14.5 MB).

### 🔹 Fase 8: RF-12 "Acerca de" + fix de zoom en TOC (2026-08-09, edición rápida)
- [x] Comando Rust `get_app_version` (lee la versión de `Cargo.toml` vía `app.package_info()`).
- [x] Modal `#about-modal` con versión, enlaces a `davidbuenov.com` / `github.com/davidbuenov` (vía `shell.open`) y licencia.
- [x] Fix: `applyZoom()` y la restauración de zoom guardado en `init()` ahora aplican `style.zoom` también a `#toc-sidebar`, no solo a `#content`.
- [x] Verificado en la app real: el modal muestra "Versión 0.2.0" correctamente.
- [ ] **Pendiente de verificación visual:** el fix de zoom del TOC se implementó con el mismo patrón ya probado para `#content` (ADR-005), pero no se confirmó visualmente (la automatización de UI por coordenadas resultó poco fiable en este entorno — ver Lección 8 en `memory.md`). Confirmar manualmente con `Ctrl + Rueda` sobre un documento con TOC.
- [x] `.exe` de la raíz actualizado con el build que incluye RF-12 + fix de zoom del TOC.

### 🔹 Fase 9: Control de versiones (2026-08-09)
- [x] `git init` en la raíz del proyecto (no existía repositorio previamente).
- [x] Commit inicial `b359def` — "feat: dbv-md-reader v0.2.0 — commit inicial del proyecto" (115 ficheros, incluye RF-12 y el fix de zoom, ya escritos en disco antes del commit).
- [x] Tag `v0.2.0` creado sobre el commit inicial.
- [ ] Sin remoto configurado todavía — no se ha hecho `push` (no aplica hasta que el usuario añada un remoto, ej. GitHub). Cambios posteriores al commit inicial (tests de la Fase 10) siguen sin commitear.

### 🔹 Fase 10: Tests automatizados (2026-08-09)
- [x] Refactor de `add_recent_file`/`get_recent_files` para extraer lógica pura sin `AppHandle`: `upsert_recent()` (dedupe + orden + límite de 10) y `filter_existing()` (auto-purga de locales borrados, remotos siempre se conservan). Ver Lección 5 en `memory.md`.
- [x] `cargo add tempfile --dev` para los tests que necesitan archivos reales en disco.
- [x] 9 tests unitarios en `src-tauri/src/lib.rs` (`resolve_relative_path` local/absoluta/remota/error, `upsert_recent`, `filter_existing`) — todos en verde con `cargo test --lib`.
- [x] 1 test de integración `#[ignore]` (`read_file_downloads_remote_markdown`) que descarga un `.md` real por HTTPS — verificado en verde con `cargo test --lib -- --ignored`, confirmando RF-08A end-to-end.
- [x] Commiteado (`0982bc4`).

### 🔹 Fase 11: Botón "Abrir desde URL" + confirmación de fixes (2026-08-09)
- [x] **Zoom del TOC confirmado por el usuario:** funciona correctamente.
- [x] **Gap detectado por el usuario:** RF-08A funcionaba a nivel de backend (verificado con test de integración, Fase 10) pero no había ninguna forma de *introducir* una URL en la app — el botón "Abrir archivo" solo lanza el selector nativo de Windows, que no admite `http(s)://`. Los documentos remotos solo eran alcanzables haciendo clic en un enlace dentro de un documento local ya abierto.
- [x] Botón "Abrir desde URL" en la barra superior + enlace "o abrir desde una URL" en el Estado Vacío → panel con input (`#url-panel`) que invoca `loadDocument(url, false, null, true)` (misma ruta que CLI/diálogo/Drag&Drop: primary open, se registra en Recientes).
- [x] Verificado en la app real con la URL exacta que reportó el usuario (`raw.githubusercontent.com/davidbuenov/dbv-pdf2md/refs/heads/master/implementation_plan.md`) — carga y renderiza correctamente.
- [x] Consola de errores (`#error-panel`): ya existía y está conectada al mismo `catch` de `loadDocument`, así que cualquier fallo al abrir una URL (typo, 404, etc.) se refleja ahí sin cambios adicionales.
- [x] `.exe` de la raíz actualizado con este build.
- [x] Commiteado (`5e1f950`).

### 🔹 Fase 12: `/code-simplify` — revisión de calidad en 4 ángulos + auditoría de seguridad (2026-08-09)
- [x] 4 agentes en paralelo (Reuse, Simplificación, Eficiencia, Altitud) revisaron todo lo añadido en la sesión (`lib.rs`, `app.js`, `index.html`, `styles.css`). Señal muy consistente entre los 4 ángulos en varios hallazgos.
- [x] **JS:** `registerPanel()`/`closeAllPanels()` — mecanismo único para los 4 paneles flotantes (Búsqueda, Recientes, Acerca de, Abrir URL), sustituyendo 4 implementaciones manuales de abrir/cerrar/clic-fuera/Escape. Corrige de paso un bug real que la propia duplicación había dejado: el panel "Abrir desde URL" no tenía cierre por clic fuera.
- [x] **JS:** `loadDocument(filePath, isHistory, scrollAnchor, isPrimaryOpen)` → `loadDocument(filePath, opts)` con objeto de opciones (8 puntos de llamada actualizados).
- [x] **JS:** `openExternal(href)` extraído (antes duplicado entre `interceptLinks` y los enlaces del "Acerca de").
- [x] **JS:** `applyZoom(level, {silent})` — `init()` ya no reimplementa el `.style.zoom` de `#content`/`#toc-sidebar`.
- [x] **Rust:** `add_recent_file` devuelve la lista actualizada (el frontend ya no hace una segunda llamada `get_recent_files` tras cada apertura). `get_recent_files` solo escribe a disco si la auto-purga eliminó algo.
- [x] **CSS:** `.floating-panel`/`.floating-panel-input` compartidas por `#url-panel`/`#search-modal`; `.section-label` compartida por las 3 cabeceras de sección repetidas.
- [x] **Conscientemente omitido** (fuera de alcance de un pase de limpieza, o coste/beneficio bajo): resolución de imágenes en lote (una sola llamada IPC para N imágenes) — ya se despachan concurrentemente, no bloqueante; reutilizar el watcher de `notify` entre navegaciones dentro del mismo directorio — coste bajo, complejidad no trivial; migrar `is_remote()`/unión de URLs a la crate `url` — cambiaría comportamiento en casos borde (`..`), requiere nueva dependencia.
- [x] `cargo test --lib` (9/9 + 1 ignorado) y `cargo build --release` en verde tras cada cambio.
- [x] Verificado en la app real: el panel de URL ya se cierra al hacer clic fuera; el panel de Recientes sigue abriendo documentos correctamente tras el refactor de `loadDocument`.
- [x] Auditoría de seguridad obligatoria de esta fase: sin secretos en código propio; dependencias nuevas (`notify`, `ureq`, `tempfile`, `dompurify`) resueltas vía `cargo add` o copiadas de un paquete ya instalado, no tecleadas a mano; entrada de la URL validada antes de usarse.
- [x] `.exe` de la raíz actualizado.

### 🔹 Fase 13: Publicación y README orientado a usuarios finales (2026-08-09)
- [x] Repositorio conectado a `https://github.com/davidbuenov/dbv-md-reader` (estaba vacío, sin sobrescribir nada) y publicado: rama `master` (5 commits) + tag `v0.2.0`.
- [x] GitHub Release `v0.2.0` creada con `dbv-md-reader.exe` adjunto como descarga directa (notas orientadas a usuario final, no jerga técnica).
- [x] **Gap detectado por el usuario:** el README solo hablaba de compilar desde fuente (Rust, Node, build tools) — ningún usuario no técnico podía saber que bastaba con descargar el `.exe`.
- [x] README reestructurado: nueva sección "Descárgalo y úsalo" al principio con enlace directo de descarga (`/releases/latest/download/dbv-md-reader.exe`), pasos de doble clic y cómo asociar `.md` en Windows. Todo el contenido de compilación agrupado bajo "Para desarrolladores", con nota explícita de que no es necesario para usar la app.
- [x] Commiteado y publicado (`584aeb4`).
