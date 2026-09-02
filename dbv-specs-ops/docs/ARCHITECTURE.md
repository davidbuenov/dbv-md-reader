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
- **ADR-031 (2026-09-02):** MVP de Android es de solo lectura (RF-20/RF-21 fuera de alcance) — evita resolver escritura persistente sobre SAF y gestión de conflictos sin file watcher fiable en la primera versión de la plataforma. Ver `SPECIFICATIONS.md` RNF-01 y `memory.md`.
- **ADR-032 (2026-09-02):** Modelo de archivos en Android vía SAF con árbol completo (`ACTION_OPEN_DOCUMENT_TREE`), no solo apertura de archivo único — mantiene el Explorador de árbol (RF-25) y Quick Open (RF-26) como en escritorio, a costa de una capa de acceso a ficheros específica de Android (`DocumentsContract`) en vez de reutilizar `std::fs`. Ver `SPECIFICATIONS.md`.
- **ADR-033 (2026-09-02):** Distribución de Android vía Google Play Store desde el primer lanzamiento, no GitHub Releases/sideload — decisión explícita del usuario, distinta del criterio ya usado para validar Linux fuera de tienda primero. Implica cuenta de desarrollador de Google Play y política de privacidad publicada antes de poder publicar. Ver `SPECIFICATIONS.md` RNF-01.

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

### Android — MVP de solo lectura vía Google Play (planificado 2026-09-02)

Único caso de la app donde no aplica la afirmación de arriba ("el código de aplicación es 100% cross-platform") — el modelo de archivos de Android (Storage Access Framework, sin rutas de sistema de archivos libres fuera del sandbox de la app) obliga a una capa de acceso a ficheros específica, y el modelo de actividad única sin multiproceso hace que varias piezas de escritorio no tengan equivalente y deban desactivarse por completo en vez de adaptarse. Ver ADR-031/032/033 en `memory.md` para el razonamiento de cada decisión.

- **Modelo de archivos (SAF):** el usuario concede acceso a una carpeta completa mediante `ACTION_OPEN_DOCUMENT_TREE` (persistido con `ContentResolver.takePersistableUriPermission()`, sobrevive a reinicios de la app), o abre un `.md` suelto vía `ACTION_VIEW`/"Abrir con" desde otra app (gestor de archivos, Gmail, Drive). Toda lectura de contenido, listado de carpeta (RF-25) y resolución de rutas relativas (RF-07/RF-08A) pasa por `DocumentsContract`/`ContentResolver` sobre URIs `content://`, nunca por `std::fs` — los comandos Rust `read_file`/`list_directory`/`resolve_relative_path` existentes no sirven tal cual en Android y necesitan una implementación paralela (plugin de Tauri para Android en Kotlin, o plugin propio) que hable con esas APIs, expuesta al mismo frontend JS sin cambiar su contrato de comandos donde sea posible.
- **Asociación de `.md` (`AndroidManifest.xml`), corregido en `/plan` (2026-09-02) tras inspeccionar el generado real:** a diferencia de lo asumido en el spike inicial, el `<intent-filter>` **no se escribe a mano** — `tauri android init`/`tauri android build` lo genera automáticamente a partir del mismo `bundle.fileAssociations` de `tauri.conf.json` que ya asocia `.md` en Windows/Linux (`mimeType: "text/markdown"`, el mismo campo que corrigió la asociación en Linux, PR#9). Verificado leyendo `src-tauri/gen/android/app/src/main/AndroidManifest.xml` real: bloque `<!-- tauri-file-associations. AUTO-GENERATED. DO NOT REMOVE. -->` con `ACTION_VIEW`/`SEND`/`SEND_MULTIPLE`, `data android:mimeType="text/markdown"` + `pathPattern` para `.md`/`.markdown`. **Riesgo residual, no bloqueante:** proveedores de contenido que no fijan el MIME type real (adjuntos de Gmail, "Abrir con" de Drive pueden entregar `application/octet-stream`) — a verificar en dispositivo real durante `/build`; mitigación de reserva sin tocar `bundle.fileAssociations`: añadir una regla adicional por `pathPattern` sin filtro de MIME si el gap se confirma.
- **Sin equivalente a multi-ventana (RF-14) ni a "abrir en ventana nueva" (RF-25):** el modelo de una sola Activity sustituye el documento mostrado ante cualquier Intent nuevo — no se crea nada parecido a una `WebviewWindowBuilder` adicional. `tauri-plugin-single-instance` no está disponible en Android (no aplica: el sistema operativo ya garantiza una sola instancia de la Activity).
- **Gating de código exclusivo de escritorio (`#[cfg(desktop)]`, implementado y verificado en `/build` Slice 0, 2026-09-02):** el spike técnico (`tauri android dev`, ver `task.md`) encontró 5 puntos de `src-tauri/src/lib.rs` que no compilaban para Android; gateados detrás de `#[cfg(desktop)]` sin romper Windows/Linux/macOS (`cargo test --lib` 20/20 sin cambios):
  1. `tauri_plugin_single_instance::init(...)` (registro del plugin, RF-14) — la dependencia en `Cargo.toml` también se movió a `[target.'cfg(not(target_os = "android"))'.dependencies]`, porque el propio crate no compila para ese target.
  2. `window.unminimize()`/`focus_window()` (no existe en `WebviewWindow` de Android) — junto con `main_or_first_window()`, `open_document_window()`, `open_or_focus_document()` y `WINDOW_COUNTER`, todos ellos solo alcanzables desde código ya desktop-only.
  3. `WebviewWindowBuilder::center()` (no existe en el builder de Android) — dentro de `open_document_window()`, ver punto anterior.
  4. `reveal_command`/`reveal_in_file_manager` (RF-25) — comando completo gateado `#[cfg(desktop)]` (definición y registro en `generate_handler!`, que sí soporta atributos `#[cfg]` por entrada); sin rama Android porque no aplica (ver RF-25 en `SPECIFICATIONS.md`).
  5. `.on_menu_event(...)`/`open_in_new_window` (RF-25) — el `Builder` de Android no tiene menú nativo; ambos gateados igual que el resto.
  - **Restricción real encontrada al implementar:** no se puede aplicar `#[cfg(...)]` a un fragmento de una cadena de métodos (`.plugin(...)` a media cadena) — hay que romper la cadena con `let mut builder = tauri::Builder::default();` y reasignar `builder = builder.plugin(...)` dentro de un bloque `#[cfg(desktop)] { ... }`, patrón usado también en los ejemplos oficiales de Tauri Mobile.
- **Crash real en el arranque, no solo de compilación (encontrado y corregido en `/build` Slice 0, 2026-09-02):** tras resolver los 5 errores de compilación, la app compilaba pero abortaba (`SIGABRT`) al arrancar en el emulador real con `"No rustls crypto provider is configured"` desde `reqwest::async_impl::client` — `tauri` (núcleo, no `tauri-plugin-updater`; verificado con `cargo tree -i reqwest`) depende de `reqwest` con backend `rustls`, y en Android **algo construye un cliente reqwest antes de que `run()` llegue a ejecutarse** (el hilo nativo de arranque de `tao`/`wry`, `ndk_glue::create`, gana la carrera). Fix: `rustls` como dependencia directa (`default-features = false, features = ["ring", "logging", "std", "tls12"]` — sin `aws-lc-rs`, el proveedor por defecto de rustls 0.23, que compilaría C vía `cmake` sin necesidad ya que `ring` es el proveedor real del árbol) más una función `#[ctor::ctor]` (crate `ctor`, ya transitivo vía `tauri`) que llama a `rustls::crypto::ring::default_provider().install_default()` — genera un símbolo `.init_array` en el `.so`, ejecutado por el enlazador dinámico al cargar la librería, antes de que exista ningún hilo con el que competir. Verificado con logging directo a `liblog.so` (un `eprintln!` de prueba no aparecía en logcat por timing de la redirección stdout/stderr que monta `tao`, no porque el ctor no corriera) y con captura de pantalla real del Estado Vacío (RF-09) sin crash. Ver ADR-034 en `memory.md` para la cadena completa de diagnóstico (2 hipótesis descartadas antes de la correcta).
- **Sin recarga en vivo (RF-06):** `notify` no observa URIs `content://` de forma fiable — sin file watcher en Android, ver RF-06 en `SPECIFICATIONS.md`.
- **Distribución:** Google Play Store desde el primer lanzamiento (decisión del usuario 2026-09-02, distinta del criterio "GitHub Releases primero" ya usado para validar Linux) — requiere cuenta de desarrollador de Google Play, ficha en Play Console y política de privacidad publicada (obligatoria en Play Console para cualquier app, no solo las que piden permisos sensibles).
- **Entorno de desarrollo ya preparado** (ver `task.md`): Android Studio + SDK + NDK 25.1.8937393, targets Rust `aarch64-linux-android`/`armv7-linux-androideabi`/`i686-linux-android`/`x86_64-linux-android`, AVD `dbv_md_reader_test` (`android-34;google_apis;x86_64`).
- **`src-tauri/gen/android/`** generado por `tauri android init` — pendiente decidir si se trackea en git (contiene proyecto Gradle generado, normalmente regenerable) antes del primer commit real de esta fase.

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
| `window.confirm()`/`window.alert()` (shims de `tauri-plugin-dialog`, no del motor) | Confirmado roto: `plugin:dialog\|confirm` no existe en el lado Rust de `tauri-plugin-dialog` 2.7.2 — no se usa, sustituido por un modal HTML propio | El bug está en el `js_init_script` del propio plugin, bundleado igual en las 3 plataformas (no depende del motor de WebView) — se espera el mismo fallo en Linux/macOS mientras el proyecto siga en esa versión del plugin, pero sin confirmar en hardware real | ADR-030 en `memory.md` |

**Regla práctica:** ante la duda sobre si algo se comporta igual en los 3 motores, no asumir que sí — registrar la duda (aquí o en `task.md` como riesgo aceptado) y, si el cambio es visible para el usuario, incluirlo en la lista de pruebas para colaboradores del siguiente `/ship`.
