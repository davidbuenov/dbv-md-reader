# 🏛️ Arquitectura Técnica: dbv-md-reader

> **Proyecto:** dbv-md-reader (Lector de Markdown de Solo Lectura — Windows y Linux con Release oficial, macOS por auto-compilación)  
> **Stack Principal:** Rust + Tauri v2 + WebView nativo del sistema (WebView2 en Windows, WebKitGTK en Linux, WKWebView en macOS) + HTML5 / Tailwind CSS / JS (markdown-it, DOMPurify, mermaid.js, Prism.js, KaTeX)  
> **Fase:** `/plan` (Arquitectura)  

---

## 1. Visión General de la Arquitectura

`dbv-md-reader` utiliza una arquitectura híbrida de alto rendimiento con auto-recarga en vivo. El backend Rust se limita a E/S (lectura/descarga de ficheros, watcher, protocolo de assets); el parseo de Markdown y la sanitización de HTML ocurren en el frontend, en el WebView (`markdown-it` + `DOMPurify` post-render — ver ADR-009 en `memory.md`):

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
|  3. Fetcher de URLs remotos (`ureq`): Descarga de .md remotos                     |
|  4. Protocol Handler (`asset://`): Transformación de rutas de imágenes locales    |
|  5. Interceptor de Enlaces: Distingue enlaces .md (App) vs URLs Web (Navegador OS)|
+----------------------------------------+------------------------------------------+
                                         | Tauri IPC Bridge (Markdown crudo, sin sanitizar)
                                         v
+-----------------------------------------------------------------------------------+
|                           FRONTEND (WebView2 - Edge Engine)                       |
|  HTML5 + Tailwind CSS + Vanilla JS                                                |
|  - Parseador: markdown-it (CommonMark + extensiones GFM: tablas, ~~strikethrough~~,|
|    autolinks, HTML embebido, task lists, footnotes — ver `SPECIFICATIONS.md`)     |
|  - Sanitizador: DOMPurify sobre el HTML ya renderizado (Seguridad XSS, RF-03)     |
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
  - **Explorador de árbol de directorios — comando `list_directory(path)` (RF-25, planificado 2026-08-20)**: nuevo comando de solo lectura sobre `std::fs::read_dir`, sin plugin `fs` oficial de Tauri (mismo criterio que `read_file`/`write_file`) — devuelve un nivel de la carpeta indicada (nombre, si es carpeta o archivo, extensión), leído bajo demanda al expandir cada nodo en el frontend, nunca recursivo de golpe. Sin comando Rust propio para Quick Open (RF-26): filtra en el frontend sobre los nodos que el árbol ya tiene cargados en memoria.
  - **"Revelar en el Explorador" — comando `reveal_in_file_manager(path)` (RF-25, planificado 2026-08-20)**: `std::process::Command` (sin plugin, sin dependencia nueva) — `explorer /select,<path>` en `cfg(windows)`, `open -R <path>` en `cfg(target_os = "macos")`, `xdg-open <carpeta_padre>` en `cfg(target_os = "linux")` (sin selección exacta del archivo, limitación de plataforma). Los argumentos se pasan directo al proceso (`Command::arg`, sin invocar un shell intermedio) — sin riesgo de inyección, mismo patrón de seguridad que `tauri-plugin-shell` (RF-08C).

---

## 3. Componentes del Frontend (HTML/CSS/JS)

- **`index.html`**:
  - Estado vacío ("Empty State") con zona Drag & Drop cuando no hay archivo cargado.
  - Contenedor del documento Markdown (`#content`).
  - Barra lateral colapsable para la Tabla de Contenidos (`#toc-sidebar`).
  - Modal flotante de búsqueda (`#search-bar`).
  - Selector de temas (Claro, Oscuro, Sepia).
  - Panel desplegable "Recientes" (`#recent-panel`) anclado al botón de la barra superior, y lista corta de recientes dentro del Estado Vacío (`#empty-state`).
  - **Explorador de árbol y Quick Open (RF-25/RF-26, planificado 2026-08-20):** `#toc-sidebar` pasa a tener dos pestañas — "Índice" (TOC de encabezados ya existente) y "Archivos" (árbol nuevo, `#file-tree`), sin panel adicional en pantalla. Panel flotante `#quick-open` (mismo patrón `registerPanel()` que el buscador `Ctrl+F` y "Abrir desde URL") con campo de texto y lista de resultados filtrados en memoria.
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
- **ADR-002 (SUPERSEDIDA por ADR-009):** Diseño original — sanitización server-side en Rust usando `ammonia` previa al renderizado. Nunca se implementó (`ammonia` no llegó a añadirse a `Cargo.toml`); sustituida por DOMPurify en el frontend (ver ADR-009).
- **ADR-003:** Enrutamiento de enlaces: Archivos `.md` dentro de la app, URLs web externas al navegador predeterminado del S.O.
- **ADR-004:** Uso del crate `notify` en Rust para actualización automática en vivo sin recargas completas de ventana.
- **ADR-005:** Archivos Recientes persistidos en `recent_files.json` (app data dir) sin nuevo crate; solo aperturas explícitas (CLI/diálogo/Drag & Drop) registran entrada.
- **ADR-009 (2026-08-09):** RF-03 se sanitiza con DOMPurify (JS, post-render) en lugar de `ammonia` (Rust, pre-render) — evita corromper bloques de código con `<`/`&`. Ver `memory.md`.
- **ADR-010 (2026-08-09):** RF-06 vigila el directorio padre del archivo (no el archivo directamente) con `notify`, para sobrevivir a guardados atómicos de editores. Ver `memory.md`.
- **ADR-019 (2026-08-12):** Estrategia de distribución multiplataforma — Linux con Release oficial vía CI, macOS solo por auto-compilación sin firmar. Ver `memory.md`.

---

## 5. Soporte Multiplataforma (Windows, Linux, macOS)

El código de aplicación (`src-tauri/src/lib.rs`) es 100% cross-platform: no usa APIs específicas de Windows (sin registro, sin `cfg(windows)`), y las dependencias clave (`tauri-plugin-single-instance` 2.4.3+, `notify`, `ureq`, `tauri-plugin-dialog/updater/process`) soportan oficialmente Windows, Linux y macOS. Lo que sí difiere por plataforma es exclusivamente el **empaquetado**, resuelto con el mecanismo nativo de Tauri v2 de fusión de configuración por sistema operativo (`tauri.<platform>.conf.json` se fusiona automáticamente sobre `tauri.conf.json` según el SO donde se ejecuta `cargo tauri build`, sin flags adicionales):

- **`src-tauri/tauri.windows.conf.json`:** `bundle.targets: ["nsis"]` + configuración de instalador NSIS con imágenes de marca (igual que antes de esta separación).
- **`src-tauri/tauri.linux.conf.json`:** `bundle.targets: ["appimage", "deb"]`. El `.deb` registra la asociación de `.md` vía `.desktop`/`fileAssociations` al instalarse con `dpkg`/`apt`; el `.AppImage` es portátil pero **no** se asocia automáticamente sin una herramienta adicional como AppImageLauncher (limitación inherente del formato, no del proyecto).
- **`src-tauri/tauri.macos.conf.json`:** `bundle.targets: ["dmg", "app"]`, usado únicamente para compilaciones locales del propio usuario (ver más abajo).

### Linux — Release oficial vía CI

`.github/workflows/release-linux.yml` construye el `.deb` y el `.AppImage` en un runner `ubuntu-22.04` en cada tag `vX.Y.Z` (mismo tag que ya crea el maintainer manualmente para Windows) y los adjunta como **borrador** de GitHub Release, que el maintainer completa subiendo a mano los 3 ficheros de Windows antes de publicar. **Sin auto-actualización todavía** (RF-13 queda limitado a Windows en esta fase): las variables `TAURI_SIGNING_*` no se pasan a este job porque el par de claves `minisign` se usa hoy solo en la máquina local donde se firma el build de Windows — fusionar en un único `latest.json` una firma generada en CI (Linux) con otra generada en local (Windows) para el mismo Release introduciría una coordinación cross-máquina no resuelta en este ciclo (ver riesgo aceptado en `memory.md`). El usuario de Linux descarga manualmente las versiones nuevas desde Releases, igual que macOS.

### macOS — Solo auto-compilación, sin firma ni notarización

No se publica ningún binario de macOS. La cuenta de Apple Developer (99 $/año, requisito de Apple para firmar y notarizar) queda fuera de alcance por decisión consciente del usuario. En su lugar, `README.md` documenta cómo un usuario de Mac compila su propio ejecutable (`cargo tauri build` tras clonar el repo) y cómo abrir la app resultante pese a no estar firmada (Gatekeeper la bloquea por defecto: clic derecho → Abrir, o `xattr -cr` sobre el `.app`). Sin CI, sin Release, sin auto-actualización para esta plataforma.

> ⚠️ **Nota (2026-08-16):** esta sección describe el estado de la Fase 19. Desde la Fase 25 (ver `task.md`/ADR-020 en `memory.md`), macOS **sí** tiene Release oficial vía CI (`release-macos.yml`, `.dmg` universal sin firmar). Pendiente de actualizar esta sección para que no diverja — dejado anotado aquí en vez de corregido de pasada, para no mezclarlo con un cambio no relacionado.

### Diferencias conocidas entre motores de WebView (Windows / Linux / macOS)

El entorno de desarrollo de este proyecto es Windows — cualquier cambio de frontend se prueba en la práctica solo contra **WebView2 (Chromium)**. `WebKitGTK` (Linux) y `WKWebView` (macOS) son motores distintos y pueden comportarse de forma diferente para lo mismo. Tabla de diferencias ya detectadas (ampliar cuando aparezca una nueva, no reescribir de memoria):

| Área | WebView2 (Windows) | WebKitGTK (Linux) / WKWebView (macOS) | Fuente |
| --- | --- | --- | --- |
| Diálogo de impresión / pie de página | El diálogo nativo (Chromium) puede añadir un pie con la URL/fecha ("Encabezados y pies de página" en "Más opciones") | Sin confirmar — el panel de impresión de macOS y el diálogo GTK de Linux son distintos, puede que ni tengan esa opción | Sesión 2026-08-16, ver `README.md` |
| Caché de assets del WebView entre reinicios del proceso | Confirmado: `EBWebView/Default/Cache` persiste en disco entre lanzamientos y puede servir `index.html`/`app.js`/`styles.css` obsoletos tras editar el frontend en desarrollo | Sin confirmar si WebKitGTK/WKWebView tienen el mismo comportamiento de caché persistente | ADR-022 en `memory.md` |
| `::-webkit-scrollbar` (usado en `#reader-container`, `styles.css`) | Sin efecto — WebView2 no es un motor WebKit | Debería aplicarse tal cual (WebKitGTK y WKWebView sí son WebKit) | No verificado en esta sesión |
| Always on Top (RF-19, `getCurrentWindow().setAlwaysOnTop()`) | Confirmado funcionando (`WS_EX_TOPMOST` verificado vía Win32) | Sin verificar en macOS. En Linux, funciona en X11; en **Wayland** algunos compositores restringen por diseño que una app se autofije "siempre encima" — comportamiento fuera del control de la app, no un bug | ADR-024 en `memory.md` |
| Atajos de teclado del modo edición (`Ctrl+E`/`Ctrl+S`, RF-20) | `e.ctrlKey` | En macOS debe comprobarse también `e.metaKey` (`Cmd`) — mismo patrón `mod = e.ctrlKey \|\| e.metaKey` ya establecido en `app.js` desde el PR#4 (ADR-026). Sin menú nativo nuevo en `macos_menu::build()` (`lib.rs`): igual criterio que `Ctrl+P`, que ya funciona solo por listener JS sin accelerator de menú | Fase 32 (planificación, `task.md`) |
| `<textarea>` del panel de edición (RF-20) | Sin verificar aún — se espera comportamiento estándar (elemento HTML nativo, sin API propietaria) | Debería comportarse igual en WebKitGTK/WKWebView por ser HTML estándar, pero no confirmado — el `Edit` menu nativo de macOS (`PredefinedMenuItem::cut/copy/paste/undo/redo`, ya existente en `macos_menu::build()`) debería dar deshacer/rehacer/portapapeles gratis sobre el `<textarea>` sin código nuevo, a confirmar en hardware real | Fase 32 (planificación, `task.md`) |
| Eventos del `notify` watcher tras el propio `write_file` (RF-21, ventana de supresión ~800 ms) | `ReadDirectoryChangesW` — comportamiento ya observado y ajustado (RF-06) | Linux usa `inotify`, macOS usa `FSEvents` — la cantidad y latencia de eventos por escritura puede diferir entre los tres backends, y la ventana fija de 800 ms podría no bastar en alguno. Plan B si aparece en pruebas reales: comparar mtime/hash en vez de temporizador fijo | ADR-027 en `memory.md` |

**Regla práctica:** ante la duda sobre si algo se comporta igual en los 3 motores, no asumir que sí — registrar la duda (aquí o en `task.md` como riesgo aceptado) y, si el cambio es visible para el usuario, incluirlo en la lista de pruebas para colaboradores del siguiente `/ship`.
