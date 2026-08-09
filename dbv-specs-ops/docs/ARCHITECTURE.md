# 🏛️ Arquitectura Técnica: dbv-md-reader

> **Proyecto:** dbv-md-reader (Lector de Markdown de Solo Lectura para Windows)  
> **Stack Principal:** Rust + Tauri v2 + WebView2 + HTML5 / Tailwind CSS / JS (markdown-it, mermaid.js, Prism.js)  
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
|  - Componentes UX: Tabla de Contenidos (TOC), Buscador Ctrl+F, Selector de Temas  |
|  - Utilerías: Zoom Ctrl+/-, Exportar PDF Ctrl+P, Drag & Drop Empty State          |
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
  - Renderizado con `markdown-it` + Prism.js + mermaid.js.
  - Interceptor de clics en enlaces:
    - Si el enlace finaliza en `.md` o es una ruta relativa: solicita a Rust cargar y sanitizar el nuevo archivo en la aplicación.
    - Si es una URL externa general: invoca el comando de Rust para abrir el navegador del S.O.
  - Atajos de teclado: `Ctrl + F` (Buscador), `Ctrl + O` (Abrir), `Ctrl + P` (Imprimir/PDF), `Ctrl + + / -` (Zoom).
  - `loadDocument()` acepta un flag `isPrimaryOpen`: solo se marca `true` en CLI inicial, diálogo nativo y Drag & Drop, para invocar `add_recent_file` — la navegación por enlaces internos y Atrás/Adelante no ensucia la lista de recientes.

---

## 4. Decisiones de Seguridad y Rendimiento (ADRs)

- **ADR-001:** Adopción de Tauri v2 sobre Electron (ejecutable < 8 MB, RAM < 64 MB).
- **ADR-002:** Sanitización server-side en Rust usando `ammonia` previa al renderizado para asegurar tolerancia cero a vulnerabilidades XSS.
- **ADR-003:** Enrutamiento de enlaces: Archivos `.md` dentro de la app, URLs web externas al navegador predeterminado del S.O.
- **ADR-004:** Uso del crate `notify` en Rust para actualización automática en vivo sin recargas completas de ventana.
- **ADR-005:** Archivos Recientes persistidos en `recent_files.json` (app data dir) sin nuevo crate; solo aperturas explícitas (CLI/diálogo/Drag & Drop) registran entrada.
- **ADR-009 (2026-08-09):** RF-03 se sanitiza con DOMPurify (JS, post-render) en lugar de `ammonia` (Rust, pre-render) — evita corromper bloques de código con `<`/`&`. Ver `memory.md`.
- **ADR-010 (2026-08-09):** RF-06 vigila el directorio padre del archivo (no el archivo directamente) con `notify`, para sobrevivir a guardados atómicos de editores. Ver `memory.md`.
