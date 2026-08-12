# 🏛️ Arquitectura Técnica: dbv-md-reader

> **Proyecto:** dbv-md-reader (Lector de Markdown de Solo Lectura para Windows)  
> **Stack Principal:** Rust + Tauri v2 + WebView2 + HTML5 / Tailwind CSS / JS (markdown-it, mermaid.js, Prism.js, KaTeX)  
> **Fase:** `/plan` (Arquitectura)  

---

## 1. Visión General de la Arquitectura

`dbv-md-reader` utiliza una arquitectura híbrida de alto rendimiento con auto-recarga en vivo y sanitización server-side en Rust:

```
+-----------------------------------------------------------------------------------+
|                               Sistema Operativo (Windows)                         |
|  Acceso CLI / Doble Clic / Drag & Drop ---> dbv-md-reader.exe                      |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                 CORE (RUST)                                       |
|  1. Captura de argumentos CLI / Ruta del archivo .md                              |
|  2. File Watcher (`notify` crate): Recarga automática si el archivo cambia en disco|
|  3. Fetcher de URLs remotos (`reqwest`/`ureq`): Descarga de .md remotos          |
|  4. Protocol Handler (`asset://`): Transformación de rutas de imágenes locales    |
|  5. Sanitización de HTML embebido usando Ammonia crate (Seguridad XSS)            |
|  6. Interceptor de Enlaces: Distingue enlaces .md (App) vs URLs Web (Navegador OS)|
+----------------------------------------+------------------------------------------+
                                         | Tauri IPC Bridge
                                         v
+-----------------------------------------------------------------------------------+
|                           FRONTEND (WebView2 - Edge Engine)                       |
|  HTML5 + Tailwind CSS + Vanilla JS                                                |
|  - Parseador: markdown-it (CommonMark)                                            |
|  - Resaltador: Prism.js (+ Botón Copy)                                            |
|  - Diagramas: mermaid.js (SVG vectorial)                                          |
|  - Matemáticas: KaTeX (LaTeX inline/bloque, pre/postprocesado alrededor del render)|
|  - Componentes UX: Tabla de Contenidos (TOC), Buscador Ctrl+F, Selector de Temas  |
|  - Utilerías: Zoom Ctrl+/-, Exportar PDF Ctrl+P (paginación real vía @page), D&D  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Componentes del Backend (Rust / Tauri v2)

- **`src-tauri/src/main.rs` & `lib.rs`**:
  - **CLI Parser (`std::env::args`)**: Captura la ruta inicial pasada por línea de comandos o apertura predeterminada de Windows.
  - **Lector `read_file(path: String)`**:
    - Lee archivos `.md` locales (`fs::canonicalize` + `fs::read_to_string`), o descarga `.md` de URLs remotas (`http://`/`https://`) vía `ureq::get(&path).call()` (RF-08A). El HTML se sanitiza en el frontend con DOMPurify, no aquí (ver `docs/SPECIFICATIONS.md` RF-03 / ADR-009).
  - **File Watcher (`notify`) — comando `watch_file(app, path)`**:
    - Vigila el **directorio padre** del archivo activo (`RecursiveMode::NonRecursive`), filtrando eventos por nombre de archivo — sobrevive a guardados atómicos (temp+rename) de editores como VS Code (ADR-010). Un único watcher vive en `tauri::State<Mutex<Option<RecommendedWatcher>>>`, reemplazado en cada carga de documento. Emite el evento IPC `file-changed` al frontend, que recarga con debounce (~150 ms) preservando la posición del scroll.
  - **Protocol Handler (`asset://` vía `app.security.assetProtocol` en `tauri.conf.json`)**:
    - El frontend resuelve rutas de imagen relativas/absolutas con `resolve_relative_path` y las convierte a URL de activos con `convertFileSrc()` (API core de Tauri), evitando fallos de CORS/origen cruzado en WebView2 (RF-07).
  - **Navegación Externa (`tauri-plugin-shell`)**:
    - Abre URLs de páginas web generales en el navegador predeterminado de Windows.
  - **Archivos Recientes (`recent_files.json`)**:
    - Comandos `get_recent_files`, `add_recent_file` y `clear_recent_files` persisten (vía `std::fs` + `serde_json`, sin crates nuevos) hasta 10 rutas en `app.path().app_data_dir()/recent_files.json`.
    - `get_recent_files` filtra en cada lectura las rutas locales que ya no existen en disco (`Path::exists()`) y auto-purga el JSON; las entradas remotas (`http(s)://`) no se validan por existencia.
    - `add_recent_file` deduplica por ruta (mueve al principio si ya existía) y trunca la lista a 10 entradas.
  - **Actualizaciones (`tauri-plugin-updater` + `tauri-plugin-process`, RF-13)**:
    - Sin comando Rust propio: el frontend llama directamente a la API JS del plugin (`window.__TAURI__.updater.check()` / `update.downloadAndInstall()` / `window.__TAURI__.process.relaunch()`), igual que ya se hace con `tauri-plugin-shell` (ADR-006, sin bundler, `withGlobalTauri: true`).
    - `plugins.updater` en `tauri.conf.json`: `dialog: false` (UI propia en el panel "Acerca de", sin el diálogo nativo por defecto del plugin), `endpoints` apunta a `.../releases/latest/download/latest.json` (manifiesto que hay que publicar a mano en cada Release — ver `README.md`, sección para desarrolladores), y `pubkey` con la clave pública `minisign` generada vía `tauri signer generate` (la clave privada vive fuera del repo, ver ADR-014 en `memory.md`).
    - `bundle.createUpdaterArtifacts: true` hace que `cargo tauri build` también genere el archivo `.sig` de cada instalador cuando `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` están en el entorno; sin esas variables, el build sigue funcionando pero no se generan artefactos de actualización.
  - **Instancia única multi-ventana (`tauri-plugin-single-instance`, RF-14)**:
    - Registrado como **primer** plugin de la cadena (`tauri::Builder::default().plugin(tauri_plugin_single_instance::init(...))...`) — requisito documentado del propio plugin.
    - El callback recibe el `argv` del segundo lanzamiento, extrae la ruta con `first_path_argument()` (misma lógica que ya usaba `get_cli_argument`, ahora factorizada para reutilizarla en ambos sitios) y llama a `open_document_window()`, que crea una `WebviewWindowBuilder` nueva con una etiqueta única (`doc-N`, contador `AtomicU32`) apuntando a `index.html`. Todo se despacha con `app_handle.run_on_main_thread(...)` porque crear ventanas fuera del hilo principal puede bloquear el WebView2 en Windows (advertencia documentada en la propia API de Tauri).
    - **Cómo recibe la ventana nueva su documento inicial:** no hay argv de proceso que leer (todas las ventanas comparten el mismo proceso), así que en vez de `get_cli_argument()` se usa `WebviewWindowBuilder::initialization_script()` para inyectar `window.__DBV_INITIAL_PATH__ = "<ruta>"` antes de que cargue `app.js`. El `init()` del frontend comprueba esa variable primero y solo cae a `get_cli_argument()` (la ventana `main` original, arrancada por `tauri.conf.json`) si no existe.
    - Si el segundo lanzamiento no trae ruta (p. ej. relanzar el `.exe` sin argumentos), no se crea ventana: se enfoca la ventana `main` o, si no existe, cualquier otra abierta.
    - Cada ventana sigue teniendo su propio `WatcherState` (el `Mutex<Option<Watcher>>` es por-webview, no compartido), zoom, TOC y búsqueda — ninguna de esa lógica en `app.js` tuvo que cambiar.
  - **Enlace a mermaid.live (RF-15)**: sin comando Rust — todo ocurre en el frontend. `src/vendor/pako_deflate.min.js` (UMD, build *deflate-only* de `pako`, ~26 KB — no se vendoriza el paquete completo, que también incluye `inflate`, innecesario aquí) expone `window.pako.deflate`. `buildMermaidLiveUrl()` en `app.js` replica el formato de estado de `mermaid-live-editor` (`src/lib/util/serde.ts` del proyecto oficial: `deflate(TextEncoder().encode(JSON.stringify(state)))` → Base64 URL-safe → `https://mermaid.live/edit#pako:<...>`), y se abre con `openExternal()` (mismo helper que ya usa `tauri-plugin-shell` para enlaces externos).

---

## 3. Componentes del Frontend (HTML/CSS/JS)

- **`index.html`**:
  - Estado vacío ("Empty State") con zona Drag & Drop cuando no hay archivo cargado.
  - Contenedor del documento Markdown (`#content`).
  - Barra lateral colapsable para la Tabla de Contenidos (`#toc-sidebar`).
  - Modal flotante de búsqueda (`#search-bar`).
  - Selector de temas (Claro, Oscuro, Sepia).
  - Panel desplegable "Recientes" (`#recent-panel`) anclado al botón de la barra superior, y lista corta de recientes dentro del Estado Vacío (`#empty-state`).
- **`app.js`**:
  - Renderizado con `markdown-it` + Prism.js + mermaid.js + KaTeX.
  - Interceptor de clics en enlaces:
    - Si el enlace finaliza en `.md` o es una ruta relativa: solicita a Rust cargar y sanitizar el nuevo archivo en la aplicación.
    - Si es una URL externa general: invoca el comando de Rust para abrir el navegador del S.O.
  - Atajos de teclado: `Ctrl + F` (Buscador), `Ctrl + O` (Abrir), `Ctrl + P` (Imprimir/PDF), `Ctrl + + / -` (Zoom).
  - `loadDocument()` acepta un flag `isPrimaryOpen`: solo se marca `true` en CLI inicial, diálogo nativo y Drag & Drop, para invocar `add_recent_file` — la navegación por enlaces internos y Atrás/Adelante no ensucia la lista de recientes.
  - **Matemáticas (RF-17)**: `extractMath(raw)` corre *antes* de `md.render()` — escanea el Markdown crudo (respetando fenced code blocks y code spans), sustituye cada `$...$`/`$$...$$` por un placeholder HTML crudo de una sola línea (`<span class="dbv-math" data-i="N" data-display="0|1">`) que `markdown-it` (con `html: true`) pasa intacto sin que `emphasis`/`typographer` lo toquen, y guarda el LaTeX de cada match aparte. `processMath()` corre *después* de `DOMPurify.sanitize()`, junto a `processMermaid()` (`renderMarkdown()`) — recorre esos placeholders y los bloques ` ```math `, y llama `katex.renderToString(latex, { displayMode, throwOnError: false })` para inyectar el resultado final. Necesario partirlo en dos pasadas porque, a diferencia de un bloque ` ```mermaid ` (ya opaco para markdown-it desde el principio), `$...$` es texto normal dentro de un párrafo — ver ADR-018.

---

## 4. Decisiones de Seguridad y Rendimiento (ADRs)

- **ADR-001:** Adopción de Tauri v2 sobre Electron (ejecutable < 8 MB, RAM < 64 MB).
- **ADR-002:** Sanitización server-side en Rust usando `ammonia` previa al renderizado para asegurar tolerancia cero a vulnerabilidades XSS.
- **ADR-003:** Enrutamiento de enlaces: Archivos `.md` dentro de la app, URLs web externas al navegador predeterminado del S.O.
- **ADR-004:** Uso del crate `notify` en Rust para actualización automática en vivo sin recargas completas de ventana.
- **ADR-005:** Archivos Recientes persistidos en `recent_files.json` (app data dir) sin nuevo crate; solo aperturas explícitas (CLI/diálogo/Drag & Drop) registran entrada.
- **ADR-009 (2026-08-09):** RF-03 se sanitiza con DOMPurify (JS, post-render) en lugar de `ammonia` (Rust, pre-render) — evita corromper bloques de código con `<`/`&`. Ver `memory.md`.
- **ADR-010 (2026-08-09):** RF-06 vigila el directorio padre del archivo (no el archivo directamente) con `notify`, para sobrevivir a guardados atómicos de editores. Ver `memory.md`.
