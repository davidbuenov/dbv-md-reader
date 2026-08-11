# 📋 Backlog & Task Tracking: dbv-md-reader

> **Estado:** Fases 0 a 21 completadas · v0.5.0 publicada en GitHub (Release + Store en preparación) · interfaz en español/inglés (RF-16) · instancia única multi-ventana (RF-14), enlace a mermaid.live (RF-15), comprobación de actualizaciones (RF-13)
> **Última Actualización:** 2026-08-11

---

## ⚠️ Deuda Técnica Detectada (Auditoría 2026-08-09) — Resuelta en Fase 7

Al revisar el código real frente a `ARCHITECTURE.md`/`SPECIFICATIONS.md` se encontró que RF-03, RF-06, RF-07 y RF-08A estaban documentados como decisión arquitectónica pero **no implementados**. Todos se cerraron en la Fase 7 (ver detalle casilla por casilla en `docs/SPECIFICATIONS.md` §3).

## ⚠️ Deuda Técnica Abierta

- [ ] **Contraste de código en temas Claro/Sepia:** el resaltado de sintaxis usa siempre la hoja de estilos oscura de Prism.js (`vendor/prism-tomorrow.min.css`, cargada de forma fija en `index.html`), sin importar el tema (Claro/Oscuro/Sepia) que el usuario tenga activo. En Claro y Sepia, el texto de los bloques de código queda con muy poco contraste sobre el fondo claro (comentarios y algunos tokens casi ilegibles). Detectado el 2026-08-09 al generar las capturas de la landing page. **Solución propuesta:** cargar dinámicamente una hoja de Prism clara (ej. `prism.min.css` o `prism-solarizedlight.min.css`) cuando el tema sea Claro/Sepia, intercambiando el `href` de `#prism-theme` en `setTheme()` (`src/app.js`), igual que ya se hace con `data-theme` en `<html>`.

---

## 📌 Snapshot de Contexto (Estado Actual)

- **Fase Actual (Fase 20, `/ship` completado):** v0.5.0 — instalador NSIS pulido visualmente, rebrand a "DBV Markdown Reader", paquete MSIX con identidad real de Partner Center, política de privacidad publicada. Ver detalle completo en `docs/MICROSOFT_STORE.md`. **Pendiente del usuario (fuera del alcance de Claude Code):** completar la submission real en Partner Center (Ficha de la Store, capturas, enviar a certificación) — checklist paso a paso en `docs/MICROSOFT_STORE.md` §5.
- **Fase 15-19 (histórico):** Todo lo solicitado hasta entonces completo (RF-03/06/07/08A/11/12/13/14/15, tests, Git, instalador NSIS, actualizaciones, instancia única, mermaid.live). Última Release publicada: v0.4.0.
- **Build release:** `npm run build` (= `cargo tauri build`) → `src-tauri/target/release/bundle/nsis/dbv-md-reader_0.2.0_x64-setup.exe` (~216 MB, incluye el instalador offline de WebView2) + el `.exe` portable sin empaquetar en `src-tauri/target/release/dbv-md-reader.exe` (~14.5 MB, ya no se distribuye, solo para desarrollo/depuración). **Importante:** si solo cambian recursos (icono `.ico`, imágenes NSIS) sin tocar código Rust, `cargo`/`tauri build` puede no detectar el cambio y reusar el binario cacheado — forzar con `cargo clean -p dbv-md-reader --release` antes de reconstruir (ver Fase 15).
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

### 🔹 Fase 14: Landing page en GitHub Pages (2026-08-09)
- [x] Página de presentación en `docs/` (vanilla HTML/CSS/JS, sin dependencias), orientada a usuario final: hero con descarga directa, stats de confianza, grid de 8 características, sección de capturas con selector de tema interactivo, 3 pasos de instalación, CTA final y footer con enlaces a GitHub/autor. Paleta reutilizada del tema Oscuro de la app.
- [x] GitHub Pages activado (`gh api repos/.../pages`) sirviendo desde `master:/docs` → publicado en `https://davidbuenov.github.io/dbv-md-reader/`.
- [x] Capturas reales generadas lanzando la app con un documento de ejemplo (arquitectura + código + diagrama Mermaid + tabla): Oscuro, Claro, Sepia, diagrama Mermaid, panel de Archivos Recientes.
- [x] **Incidente evitado:** el panel de Archivos Recientes mostraba de forma predeterminada rutas reales del usuario (nombre de usuario de Windows y un documento personal de un curso). Se sustituyó por datos de ejemplo genéricos (ficheros dummy locales) antes de capturar, y se restauró el historial real del usuario al terminar.
- [x] **Deuda técnica detectada durante la captura:** contraste bajo en bloques de código con temas Claro/Sepia (Prism.js fijo en tema oscuro) — registrado arriba en "Deuda Técnica Abierta", no se corrigió en esta fase.
- [x] Commiteado y publicado (`ef9c5b7`, `3f1a24c`).

### 🔹 Fase 15: Instalador Windows (NSIS), asociación .md e icono propio (2026-08-09)
- [x] **Gap detectado por el usuario:** al probar el `.exe` portable en un equipo limpio (sin Rust/Node/nada instalado) aparecieron 3 problemas: avisos de SmartScreen al descargar (esperable, sin firma de código), un `.exe` de la raíz del repo que daba "no se puede ejecutar en este equipo" (descarga poco fiable desde la vista de archivo de GitHub — no desde Releases) y `.md` que se abrían como texto plano (sin asociación de tipo de archivo, al no existir instalador). Un segundo síntoma tras asociar manualmente: el documento se abría pero un diagrama Mermaid fallaba en consola — indicativo de un WebView2 Runtime del sistema desactualizado/mínimo, ya que el `.exe` portátil (14.5 MB) no lo lleva embebido.
- [x] `.gitignore`: añadido `/dbv-md-reader.exe` — deja de commitearse el binario de la raíz (distribución oficial exclusivamente vía Releases).
- [x] `tauri.conf.json`: `bundle.targets` limitado a `["nsis"]`; `bundle.windows.webviewInstallMode: offlineInstaller` (embebe el instalador offline de WebView2, ~127 MB, sin depender de conexión a internet ni de la versión ya instalada en el sistema); `bundle.fileAssociations` para `.md`/`.markdown` (registro automático durante la instalación, sin pasos manuales).
- [x] Icono de aplicación: sustituido el placeholder (cuadrado azul plano, nunca reemplazado desde el bootstrap) por un diseño propio (marca "M" + acento en flecha, paleta del tema Oscuro) generado con `System.Drawing`/PowerShell y regenerado en todos los tamaños/plataformas vía `tauri icon`. **Lección:** un rebuild con caché de Cargo no reincrusta un `.ico` cambiado si el crate no recompila — hace falta `cargo clean -p dbv-md-reader --release` tras cambiar solo el icono para forzar el relink de recursos.
- [x] Instalador de marca: `src-tauri/nsis/sidebar.bmp` (164×314, páginas Bienvenida/Fin) y `header.bmp` (150×57, resto de páginas) con icono, nombre y 3 puntos clave — sustituye a texto de "venta" en la portada, ya que Tauri no permite personalizar `MUI_WELCOMEPAGE_TITLE/TEXT` sin forkear toda la plantilla `.nsi` (~1000 líneas, coste de mantenimiento no asumido). `src-tauri/nsis/hooks.nsh` (`NSIS_HOOK_POSTINSTALL`) muestra un aviso confirmando la asociación `.md` al terminar la instalación (omitido en modo silencioso/pasivo).
- [x] Verificado en el registro de Windows tras una instalación real: `HKCU\Software\Classes\.md` pasa a apuntar al ProgId `Documento Markdown` (con backup del valor anterior). Confirmado por el usuario que el instalador se ejecuta correctamente y crea desinstalador.
- [x] Build verificado en verde (`npm run build` → `dbv-md-reader_x.y.z_x64-setup.exe`, ~216 MB por el WebView2 offline embebido) tras cada cambio de configuración.
- [x] `README.md`: sección "Descárgalo e instálalo" reescrita para reflejar el instalador NSIS (ya no el `.exe` portable como método principal); eliminado el paso manual "(Opcional) asociar .md", ahora automático.

### 🔹 Fase 16: Ancho de lectura "breakout" (prosa 800px / bloques anchos 1100px) + release v0.3.0 (2026-08-09)
- [x] **Gap detectado por el usuario (con captura):** en ventanas anchas quedaba mucho hueco vacío a los lados del documento, mientras un bloque de código con líneas largas hacía scroll horizontal dentro de la franja estrecha de 800px en vez de aprovechar el espacio libre — `#content` limitaba todo por igual (prosa y bloques anchos) al mismo `max-width`.
- [x] `src/styles.css`: `#content` pasa a `max-width: 1100px`; título/párrafo/lista/cita se reestrechan a `max-width: 800px` centrados (patrón "breakout", como GitHub); código (`pre`), tablas y diagramas Mermaid (`.mermaid-container`) no llevan ese límite y usan hasta los 1100px del contenedor. `#reader-container` ya centraba con `justify-content:center` excluyendo el ancho del TOC lateral, así que no hizo falta ningún truco con `vw`.
- [x] `DESIGN.md` actualizado (era `900px` fijo, documentaba solo un ancho — ya no coincidía con el `800px` real del CSS).
- [x] Versionado: `0.2.0` → `0.3.0` (minor, nueva funcionalidad de distribución sin romper nada) en `Cargo.toml`, `package.json`, `tauri.conf.json`. `CHANGELOG.md`: sección `[0.3.0]` con lo de la Fase 15 + este fix de ancho.

### 🔹 Fase 17: Instalador menos agresivo (opt-in real de asociación .md, página de componentes) + fix de refresco de registro (2026-08-10)
- [x] **Gap detectado por el usuario al probar v0.3.0 en un segundo equipo:** (1) el instalador decía haber asociado `.md` pero no lo hacía; (2) el menú "Abrir con" mostraba una entrada extraña; (3) pidió que el instalador no imponga la asociación — debe preguntar por separado si aparecer en el menú contextual y si ser la app predeterminada, ambas premarcadas en "Sí" pero decidibles. También reportó el aviso de SmartScreen del navegador al descargar y que el README no enlazaba la landing page de GitHub Pages.
- [x] **Causa raíz de (1):** `installer.nsi` nunca llama a `SHChangeNotify` (macro `UPDATEFILEASSOC`) tras escribir el registro. Corregido.
- [x] **Causa raíz de (2), confirmada tras la primera build de prueba:** el menú mostraba **dos** entradas "dbv-md-reader" (una con icono nuevo, otra con el icono azul placeholder antiguo) — no una entrada rota con nombre "David" como se interpretó inicialmente de una captura recortada. Causa: el ProgId anterior tenía un espacio (`"Documento Markdown"`), incumplía la convención de `FileAssociation.nsh`, y al renombrarlo a `dbv-md-reader.md` la instalación anterior queda huérfana en el registro (no se limpia sola entre versiones con distinto identificador). Documentado en `README.md` cómo resolverlo (desinstalar la versión previa a la `0.3.1` antes de instalar la nueva).
- [x] **(3) — iteración final tras feedback del usuario (ver ADR-013 revisada en `memory.md`):** se probó primero un enfoque sin forkear la plantilla NSIS (dos `MessageBox` Sí/No en `NSIS_HOOK_POSTINSTALL`); el usuario, al verlo funcionar, pidió explícitamente cambiarlo por una única pantalla del instalador con dos checkboxes. Se acepta el coste de mantenimiento y se forkea la plantilla oficial de Tauri (`tauri-v2.11.5`, descargada vía `gh api` a `src-tauri/nsis/installer.nsi.template`, referenciada desde `tauri.conf.json` → `bundle.windows.nsis.template`): página `MUI_PAGE_COMPONENTS` con dos secciones opcionales marcadas por defecto (`SEC_CONTEXTMENU`, `SEC_DEFAULTAPP`); las 3 secciones obligatorias existentes se ocultan con el prefijo `"-"` para no aparecer como checkboxes falsos. `hooks.nsh` define 4 macros reutilizables (`DBV_REGISTER_PROGID`/`DBV_UNREGISTER_PROGID`/`DBV_SET_DEFAULT`/`DBV_RESTORE_DEFAULT`). El desinstalador solo deshace lo que un marcador de registro (`AssocMenu`/`AssocDefault`) dice que se llegó a instalar.
- [x] `README.md`: enlace a `https://davidbuenov.github.io/dbv-md-reader/` bajo el título; sección "Descárgalo e instálalo" documenta el aviso de SmartScreen del navegador, la pantalla de componentes, y la nota sobre desinstalar versiones previas a la `0.3.1`.
- [x] `CHANGELOG.md`: sección `[Sin publicar]` actualizada con el enfoque final (componentes, no MessageBox).
- [x] **Build verificado en verde dos veces** (`npm run build`): una con el enfoque MessageBox (descartado) y otra con la plantilla forkeada — `makensis` compila sin errores en ambos casos; inspeccionado el `.nsi` generado para confirmar que la página de componentes y las 2 secciones opcionales se renderizan correctamente con los valores reales del proyecto.
- [ ] **Pendiente de verificación manual:** el usuario aún no ha probado el instalador con la página de componentes real en el segundo equipo (desmarcar/marcar casillas, comportamiento de "Abrir con" tras desinstalar la versión vieja).
- [ ] **Deuda técnica registrada (ver ADR-013):** cada actualización futura de `tauri`/`@tauri-apps/cli` requiere re-diffear `installer.nsi.template` a mano contra la plantilla oficial de la nueva versión.
- [x] Build final verificado en verde: `dbv-md-reader_0.3.0_x64-setup.exe`.

### 🔹 Fase 18: RF-13 Comprobación de actualizaciones bajo demanda (2026-08-10)
- [x] **Origen:** el usuario preguntó, a modo de discusión ("solo por discutir"), si convenía que la app se autoactualizara o avisara de nuevas versiones. Tras comparar comprobación al arrancar / bajo demanda / autoinstalación silenciosa, decidió: nunca comprobar al arrancar (no penalizar el arranque instantáneo), sí un botón "Buscar actualizaciones" en "Acerca de" que cambia a "Actualizar" si hay una versión nueva. Ver ADR-014 en `memory.md`.
- [x] **Rust:** añadidas `tauri-plugin-updater` (2.10.1) y `tauri-plugin-process` (2.3.1) a `Cargo.toml`; registradas en `lib.rs`. Permisos `updater:default` / `process:allow-restart` en `capabilities/main.json`.
- [x] **Clave de firma `minisign`** generada con `npx tauri signer generate` (no interactivo, `--ci`, password aleatorio de 24 bytes). Privada + password guardados **fuera del repo** en `C:\Users\<usuario>\.tauri-keys\` (`dbv-md-reader.key` + `README.txt` con el password, con instrucción de moverlo a un gestor de contraseñas). Solo la clave pública se incrusta en `tauri.conf.json` → `plugins.updater.pubkey`.
- [x] `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` (genera `.sig` en cada build si las variables de entorno de firma están presentes); `plugins.updater` con `dialog: false` (UI propia), `endpoints: [".../releases/latest/download/latest.json"]`, `pubkey`.
- [x] **Frontend (sin bundler, mismo patrón que `tauri-plugin-shell` — ADR-006):** panel "Acerca de" (`src/index.html`) con botón "Buscar actualizaciones" + texto de estado; `src/app.js` llama directamente a `window.__TAURI__.updater.check()` / `update.downloadAndInstall()` / `window.__TAURI__.process.relaunch()`. Sin comando Rust propio. Estilos nuevos `.btn-secondary` / `.about-update-status` en `src/styles.css`.
- [x] Build verificado en verde con las variables de firma en el entorno (`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) — confirmar en el log que se generó el `.sig` junto al instalador.
- [x] **Nuevo paso obligatorio de Release (antes no existía), automatizado para no olvidarlo:** `scripts/generate-latest-json.mjs` (`npm run release:manifest -- --notes "..."`) genera `latest.json` a partir de la versión de `tauri.conf.json` y el `.sig` del build firmado — ya no se construye a mano. Checklist completo documentado en `README.md`, sección para desarrolladores.
- [x] **v0.3.1 publicada** con soporte de actualización real: primera Release que incluye `latest.json`, así que el botón "Buscar actualizaciones" de cualquier instalación de v0.3.0 (sin este RF) o de una v0.3.1 más antigua ya puede encontrarla. Usuario confirmó el smoke test local del botón antes de publicar ("funciona perfecto").

### 🔹 Fase 19: RF-14 Instancia única multi-ventana + RF-15 enlace a mermaid.live (2026-08-10)
- [x] **Origen:** al ver un diagrama Mermaid grande, el usuario preguntó cómo verlo con más detalle (el zoom interno tope 200% no basta) — se le sugirió mermaid.live y pidió apuntarlo como mejora futura ("menú contextual → abrir en mermaid.live"). Aparte, mostró una captura del Administrador de Tareas con dos procesos `dbv-md-reader` separados (uno por cada `.md` abierto) y pidió discutir opciones para consolidarlos en uno solo, como Notepad++. Se generó (en modo Plan) un documento con 4 opciones — el usuario eligió la **Opción B** (instancia única, cada documento en su propia ventana, todas bajo un mismo proceso) y pidió implementar ambas cosas de cara a la v0.4.0. Ver ADR-015 en `memory.md`.
- [x] **RF-14:** `tauri-plugin-single-instance` (2.4.3) registrado como primer plugin. Callback → `first_path_argument()` (refactor de la lógica que ya tenía `get_cli_argument`) → `open_document_window()` crea una `WebviewWindowBuilder` con label único (`doc-N`), despachada con `run_on_main_thread()`. La ruta inicial se inyecta vía `initialization_script()` (`window.__DBV_INITIAL_PATH__`) porque no hay argv de proceso que leer para una ventana creada dinámicamente; `app.js` la comprueba antes de caer a `get_cli_argument()`. Sin ruta en el segundo lanzamiento → se enfoca una ventana existente en vez de crear una vacía.
- [x] `Ctrl+O`/Recientes/Drag&Drop **sin cambios** — siguen sustituyendo el documento de la ventana actual; solo las aperturas externas (Explorador de Windows) consolidan proceso, que era el problema concreto reportado.
- [x] **RF-15:** vendorizado `src/vendor/pako_deflate.min.js` (build deflate-only de `pako`, ~26 KB, copiado de `node_modules/pako/dist/browser/pako_deflate.umd.min.js`). `buildMermaidLiveUrl()` en `app.js` replica el formato de estado real de `mermaid-live-editor` (verificado leyendo su código fuente en GitHub, no adivinado). Menú contextual nuevo (`#mermaid-context-menu` en `index.html`, estilos en `styles.css`) sobre `.mermaid-container`, con el código fuente del diagrama guardado en `dataset.mermaidSource` al renderizar (`processMermaid()`).
- [x] `cargo check` en verde tras el primer intento (un error de borrow-checker en el callback del single-instance, `app_handle` movido y prestado a la vez — corregido con un `.clone()` extra).
- [x] Build completo verificado (`npm run build`, dos veces: sin firma y con `TAURI_SIGNING_PRIVATE_KEY*` para producir `dbv-md-reader_0.4.0_x64-setup.exe` + `.sig`).
- [x] Versión subida a `0.4.0` (`package.json`, `Cargo.toml`, `tauri.conf.json`); `CHANGELOG.md` movido de `[Sin publicar]` a `[0.4.0]`.
- [x] **Verificación automatizada (sin depender de clics en pantalla — ver Lección 8):** se lanzó el `.exe` dos veces con ficheros distintos vía `Start-Process`; confirmado por `Get-Process` (1 proceso) y por `EnumWindows`/`GetWindowThreadProcessId` (Win32 vía `Add-Type` en PowerShell) que ese único proceso tenía **2 ventanas visibles** con título "dbv-md-reader" + 1 ventana oculta interna del propio plugin de instancia única.
- [x] **RF-15 verificado con test de ida y vuelta:** comprimido con `pako.deflate` en Node usando el mismo código que `app.js`, descomprimido de nuevo con `pako.inflate` y comparado — el JSON reconstruido coincide byte a byte con el original, confirmando que la URL generada es válida para mermaid.live.
- [x] **Bug encontrado por el usuario tras probar en real:** al abrir la 2ª y 3ª ventana, el panel de error mostraba `Command plugin:event|listen not allowed by ACL` para los listeners `file-changed` (RF-06) y `tauri://drag-drop` (RF-09). **Causa:** `capabilities/main.json` tenía `"windows": ["main"]` — el sistema de capacidades de Tauri v2 usa **glob matching** sobre la etiqueta de la ventana (`tauri-utils::acl::resolved::ResolvedCommand.windows: Vec<glob::Pattern>`, confirmado leyendo el código fuente de la crate), así que las ventanas `doc-0`, `doc-1`... (creadas dinámicamente para RF-14) no encajaban en ese patrón y se quedaban sin ningún permiso, incluido `core:event:allow-listen`. **Fix:** `"windows": ["main", "doc-*"]`. Reconstruido y reverificado (mismo test de proceso/ventanas en verde). Ver Lección 15 en `memory.md`.
- [x] **Confirmado por el usuario ("funciona perfecto"):** reconstruido tras el fix, probado en real — sin errores de ACL en la 2ª/3ª ventana.
- [x] **Bonus del usuario:** captura real del Administrador de Tareas comparando RAM con los mismos 2 `.md` abiertos en Visual Studio Code (885,8 MB), Notepad++ (21,5 MB) y `dbv-md-reader` (5,9 MB) — añadida a `README.md` y a la landing page (`docs/index.html`, sección "Por qué"), movida a `docs/assets/screenshots/comparacioneficiencia.png`.
- [x] **`/ship`:** versión `0.4.0` publicada — commit, tag `v0.4.0`, Release de GitHub con instalador + `.sig` + `latest.json`.

### 🔹 Fase 20: Pulido visual del instalador NSIS + primer paquete MSIX para Microsoft Store (2026-08-11)

- [x] **Origen:** el usuario pidió mejorar el aspecto del instalador NSIS (referencia inicial: "ExperienceUI" de la wiki de NSIS) como paso previo a publicar en Microsoft Store. Investigación previa: ExperienceUI es un skin de NSIS de 2004 sin mantenimiento — se descarta a favor de pulir el Modern UI 2 (MUI2) que ya usa el proyecto (plantilla forkeada desde la Fase 17/ADR-013).
- [x] **Pulido NSIS (`src-tauri/nsis/installer.nsi.template`):** `XPStyle on` (botones/controles con el tema visual activo de Windows en vez del estilo clásico sin temas — la causa más probable de que el instalador "se viera antiguo"), `MUI_ABORTWARNING`, textos personalizados de Bienvenida y Fin (`MUI_WELCOMEPAGE_TITLE/TEXT`, `MUI_FINISHPAGE_TITLE/TEXT/LINK`, ya posibles al ser plantilla propia — superan la limitación de la Lección 13 en `memory.md`), `MUI_COMPONENTSPAGE_SMALLDESC` (descripciones de `SEC_CONTEXTMENU`/`SEC_DEFAULTAPP` fijas bajo la lista en vez de tooltip). `tauri.conf.json`: `bundle.publisher: "David Bueno Vallejo"` explícito (antes vacío, mostraba "davidbuenov" en Agregar o quitar programas).
- [x] **Verificado en la app real:** rebuild (`cargo clean -p dbv-md-reader --release` + `npm run build`, Lección 12) sin errores/warnings nuevos de `makensis`. Captura de la página de Bienvenida confirma botones con tema Windows 11 (bordes redondeados) y texto nuevo. Instalación y desinstalación silenciosas (`/S`) verificadas end-to-end: se desinstaló la v0.4.0 previa, se instaló limpio el build de hoy, y "Agregar o quitar programas" mostró `DisplayName=dbv-md-reader`, `Publisher=David Bueno Vallejo`, `DisplayVersion=0.4.0` correctamente. **Nota de comportamiento NSIS confirmada:** un `/S` sobre la misma versión ya instalada no reinstala/sobrescribe (hay que desinstalar primero para forzar un reemplazo limpio con la misma versión) — no es un bug, es el comportamiento estándar de la página de reinstalación de Tauri en modo silencioso.
- [x] **Pivote de estrategia para Microsoft Store (decisión del usuario, verificada con documentación oficial de Microsoft):** la investigación inicial apuntaba al listado "EXE o MSI" en Partner Center (instalador NSIS enlazado externamente), pero esa vía exige comprar un certificado Authenticode propio. El usuario, tras leer que la Store firma automáticamente los paquetes **MSIX** subidos directamente (sin necesidad de certificado propio — confirmado en `learn.microsoft.com/.../msix/app-package-requirements`), pidió cambiar a esa vía. Ver ADR-016 en `memory.md`.
- [x] **Empaquetado MSIX de prueba:** auditada la dependencia de terceros `@choochmeque/tauri-windows-bundle` antes de instalar (MIT, ~6.400 descargas/mes, publicada vía GitHub Actions/npm trusted publishing, sin red flags) — ver detalle en `docs/MICROSOFT_STORE.md`. `npx @choochmeque/tauri-windows-bundle init` generó `src-tauri/gen/windows/` (config, manifiesto, assets — no se commitea, tiene su propio `.gitignore`). Build con `--runner npm` (el runner `cargo` por defecto falla en este proyecto: espera la extensión `cargo-tauri`, que no se usa aquí, en vez del CLI vía npm) generó `dbv-md-reader_0.4.0.0_x64.msix` + `.msixbundle` (~6,3 MB, sin el WebView2 offline embebido que sí lleva el NSIS).
- [x] **Verificación de firma (parcial, ver hallazgo):** certificado de prueba autofirmado generado y usado para firmar el `.msix` con `signtool` — correcto. La instalación local (`Add-AppxPackage`) reveló que Windows exige el certificado en `Cert:\LocalMachine\Root` (no `CurrentUser\Root`) para validar la cadena de confianza de un MSIX, lo que requiere una consola elevada que no estaba disponible en la sesión — documentado en `docs/MICROSOFT_STORE.md` para no repetir la investigación. No bloquea la Store (que re-firma con su propio certificado), solo la prueba de instalación 100% local sin publicar.
- [x] **`dbv-specs-ops/docs/MICROSOFT_STORE.md` creado:** hoja de ruta completa — vía elegida y por qué, flujo de empaquetado, diferencias de UX esperadas entre canales NSIS/MSIX (asociación de archivos, mecanismo de actualización), checklist de envío en Partner Center, y lo que queda fuera de alcance (reservar nombre, enviar a certificación).
- [x] **Nombre reservado por el usuario y sidebar rediseñado:** el usuario reservó "DBV Markdown Reader" en Partner Center (sin "Pro", como se discutió) y compartió una captura de identidad real (`Package/Identity/Name`, `Package/Identity/Publisher`, `PublisherDisplayName`) y un mockup de referencia para el sidebar del instalador. `src-tauri/gen/windows/bundle.config.json` actualizado con la identidad real (`identifier: "davidbuenov.DBVMarkdownReader"`, `publisher: "CN=13EE2A5D-F49E-48C9-8873-941069B15D63"`, `publisherDisplayName: "davidbuenov"`) — verificado que el `AppxManifest.xml` generado coincide exactamente con Partner Center. **Nota:** no se sobrescribió `displayName` en `bundle.config.json` porque la herramienta deriva el nombre del `.exe` empaquetado de ese campo (`executableName()`), y el binario real sigue siendo `dbv-md-reader.exe` (nombre de Cargo, sin cambios) — usar un `displayName` distinto rompía el build (`Executable not found`).
- [x] **`src-tauri/nsis/sidebar.bmp` reemplazado:** recortado con PIL desde el mockup del usuario (detección de bordes por brillo de píxel, no coordenadas a ojo) a los 164×314 px exactos que exige NSIS, redimensionado con LANCZOS.
- [x] **Rebrand a "DBV Markdown Reader" en el instalador y la app (decisión explícita del usuario, riesgo aceptado):** `tauri.conf.json` → `productName` y `app.windows[0].title`; `src/index.html` → `<title>`, tooltip "Acerca de", cabecera del modal "Acerca de" y cabecera del Estado Vacío. **Deliberadamente NO tocados** (identificadores técnicos, no visibles al usuario, evitan repetir el bug de ProgId duplicado de la Fase 17): `identifier` (`com.davidbuenov.dbv-md-reader`, controla la carpeta de datos de la app — así los recientes/config sobreviven al rename), `bundle.fileAssociations[0].name` (`dbv-md-reader.md`, el ProgId), nombre del paquete de Cargo/npm, nombre del repositorio.
- [x] **Verificado en el registro tras un rebuild + reinstalación silenciosa limpia:** carpeta de instalación `%LOCALAPPDATA%\DBV Markdown Reader\` (binario interno sigue siendo `dbv-md-reader.exe`), entrada de "Agregar o quitar programas" con `DisplayName=DBV Markdown Reader`, `Publisher=David Bueno Vallejo`, `DisplayVersion=0.4.0`.
- [x] **Nombre de archivo del instalador sin espacios (decisión del usuario: "eso siempre da problemas"):** Tauri genera el `OutFile` de forma literal a partir de `productName` (sin campo de config separado para el nombre de archivo), así que `DBV Markdown Reader_0.4.0_x64-setup.exe` (con espacio) es inevitable como salida directa de `tauri build`. Solución: `scripts/installer-name.mjs` (convención compartida) + `scripts/rename-installer.mjs` (renombra el `.exe` y su `.sig` a `dbv-markdown-reader_x.y.z_x64-setup.exe` justo después del build) + `scripts/build.mjs` (orquesta ambos pasos). **Hallazgo importante:** no se pudo encadenar con `tauri build && node scripts/rename-installer.mjs` porque `tauri build` termina con código de salida distinto de cero si falta `TAURI_SIGNING_PRIVATE_KEY` (no puede firmar el artefacto del updater) **aunque el instalador se haya generado bien** — con `&&` el renombrado nunca se ejecutaba en un build local sin esa variable. `scripts/build.mjs` ejecuta el renombrado siempre que el instalador exista, conservando el código de salida real de `tauri build` para no enmascarar un fallo de compilación de verdad. `scripts/generate-latest-json.mjs` actualizado para usar la misma convención compartida (antes tenía el nombre antiguo `dbv-md-reader_...` hardcodeado, ya desincronizado tras el rename). `README.md`, `docs/index.html` y `package.json` (script `tauri:windows:build`, le faltaba `--runner npm`) actualizados en consecuencia. Verificado con un build real: `npm run build` produce `dbv-markdown-reader_0.4.0_x64-setup.exe` sin espacios.
- [x] **Política de privacidad publicada:** `docs/privacidad.html` (mismo estilo visual que la landing, reutiliza `styles.css`) — sin telemetría, sin cuentas, qué datos se guardan solo en local (recientes, preferencias) y las 3 únicas conexiones a internet que hace la app bajo petición explícita del usuario (documento remoto, buscar actualizaciones, mermaid.live), más una nota aclarando que la Microsoft Store tiene sus propias políticas de recolección de datos de instalación, independientes de la app. Enlazada desde el footer de `docs/index.html` y desde `MICROSOFT_STORE.md`.
- [x] **`/code-simplify` (revisión de seguridad + simplificación) sobre los 3 scripts nuevos de esta fase:** 5 hallazgos, todos reales, todos corregidos:
  1. `build.mjs` reportaba éxito (`exit 0`) aunque `rename-installer.mjs` fallara — solo comprobaba el código de salida de `tauri build`. Corregido: se propaga el fallo de cualquiera de los dos pasos, conservando el de `tauri build` si ese es el que falló (para no ocultar un fallo de compilación real).
  2. `installer-name.mjs` repetía `"DBV Markdown Reader"` como literal en dos funciones en vez de derivarlo de `tauri.conf.json` — refactorizado para recibir `productName` como parámetro (incluye una función de slugificación genérica para el nombre de archivo, no un valor hardcodeado).
  3. `rename-installer.mjs` devolvía un booleano plano para una operación de fichero que puede fallar de forma controlada, incumpliendo la Norma de Codificación #2 de `MASTER_PROMPT.md` (patrón `Result`) — ahora devuelve `{ ok, error? }`.
  4. `generate-latest-json.mjs` llamaba a `installerFileName()` con la firma antigua (un solo argumento) tras el refactor del punto 2 — habría roto en el primer uso real. Corregido, y su texto de notas por defecto ya usa `productName` en vez de la cadena vieja `"dbv-md-reader"`.
  5. Los 3 archivos nuevos no llevaban la cabecera de fichero obligatoria (`project.config.md`) — añadida. (`generate-latest-json.mjs`, preexistente, ya se salía de esa convención antes de esta fase — no se ha tocado, fuera de alcance.)
  - Auditoría de seguridad de la fase: sin secretos en el código; `@choochmeque/tauri-windows-bundle` ya auditada antes de instalarla; sin entradas de usuario que sanitizar en los scripts nuevos (solo leen `tauri.conf.json` y el sistema de ficheros local).
  - Verificado con un build real tras las correcciones: `npm run build` sigue produciendo `dbv-markdown-reader_0.4.0_x64-setup.exe` sin espacios, y el código de salida final (`1`, por la falta de `TAURI_SIGNING_PRIVATE_KEY` en este entorno) refleja correctamente el estado real.
- [x] **`/ship` de esta fase:** versión `0.5.0` (Minor — el usuario confirmó reservar 1.0.0 para cuando la ficha de la Store esté publicada de verdad, no para esta preparación). `README.md` actualizado (rebrand visible, checklist de Release con el renombrado automático, enlace a `MICROSOFT_STORE.md`). `CHANGELOG.md`: `[Sin publicar]` movido a `[0.5.0] - 2026-08-11`. Versión sincronizada en `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (+ `Cargo.lock` regenerado con `cargo check`).
- [x] **Fix post-ship: RF-13 (Buscar actualizaciones) no debe estar activo en el canal MSIX.** Detectado por el usuario al instalar y probar de verdad el `.msixbundle` firmado con el certificado de prueba — el botón seguía intentando comprobar/descargar el instalador NSIS desde GitHub, lo cual dentro del sandbox de un paquete de la Store fallaría o crearía una instalación paralela desconectada (mismo patrón que el incidente de ProgId duplicado de la Fase 17). Nuevo comando `is_packaged_app()` en `src-tauri/src/lib.rs` (detecta `...\WindowsApps\...` en `std::env::current_exe()`, sin dependencias nuevas, sin entrada en `capabilities/main.json` — los comandos propios de la app no pasan por el ACL de plugins) + `src/app.js` oculta el botón y muestra un aviso fijo cuando corresponde. Verificado con las rutas de instalación reales de ambos canales confirmadas esta sesión (`%LOCALAPPDATA%\DBV Markdown Reader\` vs. `C:\Program Files\WindowsApps\davidbuenov.DBVMarkdownReader_...\`) — no se pudo verificar visualmente con captura de pantalla (Windows no cedía el foco de ventana a ningún intento, tres fallos distintos en la sesión), documentado como límite conocido del entorno, no como pendiente sin resolver. Tag `v0.5.0` movido para incluir este commit (aún sin `push`).
- [x] **`push` + Release de GitHub para v0.5.0:** build firmado (`TAURI_SIGNING_PRIVATE_KEY` desde `~/.tauri-keys/`, fuera del repo — ADR-014), `.sig` generado correctamente, `npm run release:manifest` para `latest.json`, `git push origin master --tags`, Release `v0.5.0` creada con los 3 archivos (`gh release create`).
- [x] **Envío a Microsoft Store — dos hallazgos reales durante el envío real, ambos resueltos:**
  1. Partner Center rechazó el `.msixbundle` (`Package/Properties/DisplayName usa un nombre que no tienes reservado: dbv-md-reader`) — el manifiesto usa ese nombre técnico (necesario para que coincida con el `.exe` compilado, ver ADR-016) pero solo "DBV Markdown Reader" estaba reservado. Resuelto reservando "dbv-md-reader" como nombre adicional en "Identidad del producto" de Partner Center — sin tocar ni regenerar el paquete. Se descartó la alternativa (renombrar también el `.exe` vía `mainBinaryName`) por afectar también al canal NSIS ya publicado.
  2. Aviso de "restricted capability: runFullTrust" al validar el paquete — esperado y normal para cualquier app de escritorio Win32 empaquetada como MSIX (Desktop Bridge la añade automáticamente); se revisa como parte de la certificación estándar, no requiere aprobación previa aparte. Confirmado con la documentación oficial de Microsoft.
- [x] **Sin ship propio:** los hallazgos de Partner Center (nombre adicional, aviso `runFullTrust`) no tocaron código — no requieren una versión nueva. El ship real pendiente es el de la Fase 21 (interfaz multi-idioma).

### 🔹 Fase 21: Interfaz en español e inglés (RF-16) + ficha de Microsoft Store bilingüe (2026-08-11)

- [x] **Origen:** de cara al envío a Microsoft Store, el usuario planteó si merecía la pena preparar la interfaz para inglés además de español — se acordó una arquitectura ligera (sin librería de i18n) dado que la app tiene pocos textos. El usuario además compartió capturas del formulario "Descripción de Store" de Partner Center y pidió generar los textos y las capturas de pantalla en ambos idiomas.
- [x] **`src/i18n.js` (nuevo, ~35 claves):** diccionarios `es`/`en` planos + `t(clave, vars)` con sustitución simple `{placeholder}` + `applyTranslations()` (recorre `[data-i18n]`/`[data-i18n-title]`/`[data-i18n-placeholder]`) + `setLang()` (persiste en `localStorage`, actualiza `<html lang>`, dispara `dbv-lang-changed`) + `getLang()` (detección: `localStorage` guardado → si no, `navigator.language` → si no, español por defecto). Cargado antes que `app.js` en `index.html`.
- [x] **`src/index.html`:** ~30 textos (tooltips, paneles, placeholders, estado vacío, TOC, búsqueda, "Acerca de") migrados a atributos `data-i18n*`. Nuevo selector `#lang-switcher` (botones ES/EN) junto al selector de temas, mismo patrón visual (`.lang-btn`/`.theme-btn` comparten estilo en `styles.css`).
- [x] **`src/app.js`:** ~20 mensajes generados en JS (errores, `alert()`, estados del updater, tiempo relativo de "Recientes", botón "Copiar") migrados a `t()`. `setLang()` local envuelve `DBV_I18N.setLang()` para además marcar el botón activo.
- [x] **Bug encontrado y corregido durante la propia verificación (no en producción):** al cambiar de idioma con un documento ya abierto, `applyTranslations()` pisaba el nombre de archivo del breadcrumb con el texto genérico "Sin documento abierto", porque ese `<span>` tenía `data-i18n` permanente. Se quitó el atributo del HTML y se gestiona explícitamente en el `setLang()` de `app.js` (solo lo toca si `!currentDoc`).
- [x] **Verificado en la app real con un método de captura nuevo y fiable:** `PrintWindow` con `PW_RENDERFULLCONTENT` (Win32) en vez de `CopyFromScreen` — captura el contenido real de una ventana **aunque esté detrás de otras**, a diferencia de una captura de pantalla normal. Resuelve de raíz el problema de foco que bloqueó la verificación visual en las Fases 20 y en el fix de RF-13 (documentado como limitación entonces, ya no aplica). Confirmado ES y EN correctos en: estado vacío, documento renderizado (encabezados, código, Mermaid, tabla), TOC, y panel "Acerca de" (versión, botón de actualizaciones, licencia).
- [x] **`descripcionStore_es.md` / `descripcionStore_en.md`** (raíz del proyecto): textos listos para copiar-pegar en cada campo del formulario de Partner Center (descripción, novedades de la versión, características del producto, título corto, descripción corta, palabras clave, copyright, desarrollado por) — estructura calcada de las capturas del formulario real que compartió el usuario.
- [x] **4 capturas de pantalla nuevas** en `docs/assets/store/` (`store_es_1/2.png`, `store_en_1/2.png`), 1440×900 (por encima del mínimo recomendado de 1366×768 de Partner Center), con un documento de ejemplo bilingüe (`demo_es.md`/`demo_en.md`, no versionados) mostrando encabezados, código resaltado, diagrama Mermaid y tabla — reemplazan a las capturas antiguas de la landing page, que quedaron desactualizadas tras el rebrand (nombre de la app y selector de idioma ausentes).
- [ ] **Pendiente:** `/ship` de esta fase (candidata a `0.6.0`), y decidir si el instalador NSIS también se traduce (fuera de alcance de RF-16, ver `SPECIFICATIONS.md`).
