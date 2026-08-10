# 📝 Changelog: dbv-md-reader

Todas las notas de cambios relevantes de este proyecto se documentarán en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [0.3.1] - 2026-08-10

### Añadido
- **RF-13 Comprobación de actualizaciones bajo demanda**: botón "Buscar actualizaciones" en el panel "Acerca de" — nunca se comprueba al arrancar, para no penalizar el arranque instantáneo. Si hay una versión nueva, el botón cambia a "Actualizar" y descarga/instala/relanza en un clic (`tauri-plugin-updater` + `tauri-plugin-process`, sin diálogo nativo del plugin, UI 100% del panel). Los paquetes van firmados con una clave `minisign` propia (privada fuera del repositorio). Ver RF-13 en `SPECIFICATIONS.md` y ADR-014 en `memory.md`.
- **`scripts/generate-latest-json.mjs`** (`npm run release:manifest`): genera el manifiesto `latest.json` del updater a partir de la versión en `tauri.conf.json` y el `.sig` que produce `npm run build` — evita construirlo a mano (y olvidarlo) en cada Release. Documentado como paso obligatorio en `README.md`.
- **Instalador NSIS: pantalla de componentes para la asociación `.md`**: se forkea la plantilla NSIS de Tauri (`src-tauri/nsis/installer.nsi.template`, basada en `tauri-v2.11.5`) para insertar una página de componentes real entre "Carpeta del menú Inicio" e "Instalando", con dos casillas independientes marcadas por defecto: menú contextual (**Abrir con...**) y aplicación predeterminada. Si el usuario desmarca una, no se toca el registro correspondiente; si desinstala, solo se deshace lo que él mismo eligió instalar (`src-tauri/nsis/hooks.nsh`: macros `DBV_REGISTER_PROGID` / `DBV_SET_DEFAULT` / `DBV_RESTORE_DEFAULT` / `DBV_UNREGISTER_PROGID`).

### Corregido
- **La asociación `.md` no siempre "tomaba" tras instalar**: el instalador nunca notificaba a Windows (`SHChangeNotify`) tras escribir el registro, así que el Explorador podía seguir mostrando el estado anterior hasta cerrar sesión. Se añade `UPDATEFILEASSOC` al final de cada sección de asociación.
- **ProgId de la asociación con espacio en el nombre** (`"Documento Markdown"`): incumplía la convención de Windows para identificadores de clase de archivo (sin espacios) y era la sospecha principal de una entrada duplicada/con icono y nombre incorrectos en el menú "Abrir con", confirmada por un usuario en un segundo equipo. Renombrado a `dbv-md-reader.md`; el texto descriptivo visible ("Documento Markdown") no cambia. La entrada antigua puede seguir apareciendo hasta desinstalar la versión previa (identificador distinto, no se limpia solo).
- **Landing page (`docs/index.html`) con enlaces de descarga rotos**: los 3 botones "Descargar" apuntaban a `releases/latest/download/dbv-md-reader.exe`, el `.exe` portable que se dejó de publicar como asset de Release desde que se adoptó el instalador NSIS (ver `[0.3.0]` más abajo) — el enlace daba 404. Apuntan ahora a `releases/latest` (la página de la última Release, igual que hace `README.md`), estable ante futuros cambios de nombre de archivo. De paso se actualiza el copy de la página ("sin instalar nada", "un solo archivo .exe", paso "(Opcional) Asócialo") para reflejar la distribución vía instalador con pantalla de componentes.

### Cambiado
- Se abandona el enfoque inicial de esta misma tarea (dos `MessageBox` Sí/No secuenciales en `NSIS_HOOK_POSTINSTALL`, sin forkear plantilla) en favor de la página de componentes real: el usuario, tras probarlo, prefirió explícitamente una única pantalla con checkboxes. Ver ADR-013 (revisada) en `memory.md` — el coste de mantenimiento de forkear la plantilla (~1000 líneas, antes descartado en Lección 13) se acepta conscientemente a partir de ahora.

## [0.3.0] - 2026-08-09

### Añadido
- **Instalador Windows (NSIS)**: sustituye al `.exe` portable como método de distribución oficial. Incluye el instalador offline de WebView2 embebido (`bundle.windows.webviewInstallMode: offlineInstaller`), así que no depende de conexión a internet ni de la versión de WebView2 ya presente en el sistema durante la instalación.
- **Asociación automática de `.md`**: `bundle.fileAssociations` registra `dbv-md-reader` como el visor de `.md`/`.markdown` durante la instalación, sin pasos manuales. Un hook post-instalación (`src-tauri/nsis/hooks.nsh`) muestra un aviso confirmando la asociación (omitido en instalaciones silenciosas/pasivas).
- **Icono de aplicación**: sustituido el cuadrado azul de placeholder por un icono propio (marca "M" + acento en tema oscuro), regenerado en todos los tamaños/plataformas con `tauri icon`.
- **Instalador de marca**: imágenes propias para las páginas del instalador (`src-tauri/nsis/sidebar.bmp`, `header.bmp`) con el icono, nombre y características clave de la app.

### Corregido
- El `.exe` de la raíz del repositorio (fuente de confusión: dos binarios con el mismo nombre en dos sitios, uno de ellos fácil de descargar corrupto desde la vista de GitHub) ya no se commitea — añadido a `.gitignore`. La distribución oficial es exclusivamente la página de Releases.
- **Bloques anchos (código/tablas/Mermaid) desperdiciaban el espacio de la ventana**: al limitar todo el documento por igual a `800px`, un bloque de código con líneas largas hacía scroll horizontal dentro de esa franja estrecha en vez de aprovechar el resto de la ventana. Ahora el ancho de prosa (títulos, párrafos, listas, citas) se mantiene en `800px` para legibilidad, como en GitHub, mientras que código, tablas y diagramas Mermaid usan hasta `1100px`.

## [0.2.0] - 2026-08-09

### Añadido
- **RF-11 Archivos Recientes**: botón "Recientes" en la barra superior con panel desplegable (últimos 10 documentos abiertos explícitamente, persistidos en `recent_files.json`), acceso rápido desde la pantalla "Sin archivo abierto" y botón "Limpiar historial". Comandos Rust `get_recent_files` / `add_recent_file` / `clear_recent_files`.
- **RF-06 Auto-Reload**: observador de archivos en Rust (`notify`, comando `watch_file`) que vigila el directorio padre del documento activo y recarga la vista en caliente cuando se guarda desde otra aplicación, preservando la posición del scroll.
- **RF-08A Documentos Markdown remotos**: `read_file` descarga y renderiza `.md` remotos (`http(s)://`) mediante `ureq`; `resolve_relative_path` resuelve enlaces e imágenes relativos a una base remota.
- **Abrir desde URL**: botón en la barra superior y enlace en el Estado Vacío para pegar directamente una URL de un `.md` remoto (antes solo se podía llegar a un documento remoto haciendo clic en un enlace dentro de otro documento ya abierto).
- **RF-12 "Acerca de"**: panel modal con nombre, versión (sincronizada con `Cargo.toml` vía comando Rust), enlaces a `davidbuenov.com` y `github.com/davidbuenov`, y licencia.

### Corregido
- **RF-07 Imágenes locales**: las rutas de imagen relativas y absolutas dentro de un documento Markdown no cargaban en el WebView2 (política de origen cruzado). Ahora se resuelven y se sirven vía el protocolo de activos de Tauri (`asset://` + `convertFileSrc`).
- **RF-03 Sanitización HTML**: el HTML embebido en los documentos (incluyendo `<script>` y atributos `on*`) se renderizaba sin ningún filtrado — riesgo de XSS. Ahora se sanitiza con DOMPurify tras el renderizado de `markdown-it`, sin afectar al resaltado de código ni a las anclas de navegación.
- El zoom (`Ctrl + Rueda`, `Ctrl + +/-/0`) no afectaba a la Tabla de Contenidos, solo al contenido principal.

### Cambiado
- El NFR de tamaño del instalador se relaja de <8 MB a <20 MB (decisión consciente del usuario) para poder completar RF-03/06/08A sin recortar funcionalidad. Build release actual: ~14.5 MB.
- **`/code-simplify`**: revisión de calidad en 4 ángulos (reuse, simplificación, eficiencia, altitud) sobre todo lo añadido en esta versión, con las siguientes mejoras aplicadas:
  - Los 4 paneles flotantes (Búsqueda, Recientes, Acerca de, Abrir URL) ahora comparten un mecanismo único de abrir/cerrar/clic-fuera/Escape (`registerPanel`) en vez de 4 implementaciones manuales — de paso corrige un bug real: el panel "Abrir desde URL" no se cerraba al hacer clic fuera.
  - `loadDocument(filePath, isHistory, scrollAnchor, isPrimaryOpen)` pasa a `loadDocument(filePath, opts)` con un objeto de opciones, más legible en sus 8 puntos de llamada.
  - Lógica de apertura de enlaces externos (`shell.open` con fallback) extraída a `openExternal()` en vez de duplicada.
  - El fix de zoom del TOC ya no está duplicado entre `applyZoom()` e `init()`.
  - CSS de `#url-panel`/`#search-modal` y de las etiquetas de sección repetidas consolidado en clases compartidas (`.floating-panel`, `.section-label`).
  - Backend: `add_recent_file` devuelve la lista actualizada (evita una segunda llamada IPC `get_recent_files` tras cada apertura), y `get_recent_files` solo escribe a disco cuando la auto-purga realmente eliminó algo.
  - Auditoría de seguridad obligatoria de esta fase: sin secretos en el código propio, dependencias nuevas resueltas vía `cargo add`/copiadas de un paquete ya instalado (sin riesgo de typosquatting), entrada de URL validada antes de usarse.

## [0.1.0] - 2026-08-08

### Añadido
- **Core de Rust & Tauri v2**: Lector nativo ultra-ligero y autónomo para Windows (`dbv-md-reader.exe`).
- **Apertura de Documentos**:
  - Argumento por línea de comandos (`dbv-md-reader.exe documento.md`).
  - Diálogo nativo de selección de archivos de Windows vía `tauri-plugin-dialog` (`open_file_dialog`).
  - Arrastrar y soltar (Drag & Drop) mediante eventos nativos `tauri://drag-drop`.
- **Renderizado CommonMark & HTML**:
  - Motor `markdown-it` con soporte de HTML inline (`<a id="...">`).
  - Resaltado de sintaxis con Prism.js y botón interactivo "Copiar".
  - Diagramas de flujo y arquitectura vectoriales con `mermaid.js` convertidos a SVG.
  - Tabla de Contenidos (TOC) interactiva en panel lateral desplegable.
- **Navegación & Enrutador de Enlaces**:
  - Enrutamiento inteligente de enlaces relativos `.md` con soporte para fragmentos de ancla (`#seccion`).
  - Apertura automática de URLs web externas en el navegador predeterminado del sistema operativo.
  - Historial de navegación por documentos con botones e historial `←` / `→` (`Alt + Left / Right`).
- **Personalización & Utilidades**:
  - Tres temas visuales: Claro (Light), Oscuro (Dark) y Sepia con persistencia en `localStorage`.
  - Buscador de texto en documento (`Ctrl + F`) con iluminación de coincidencias y contador `1/N`.
  - Sistema de zoom proporcional (`Ctrl + Rueda`, `Ctrl + +/-/0`) con propiedad CSS `zoom`, indicador emergente y almacenamiento persistente.
  - Soporte de impresión y exportación a PDF (`Ctrl + P`).
- **Documentación & Framework SDD**:
  - Integración completa del framework `dbv-specs-ops` v2.4.0 (`project.config.md`, `SPECIFICATIONS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `task.md`, `memory.md`).
  - Archivos de activación multi-agente (`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.windsurfrules`, `.github/copilot-instructions.md`).

---

> 🛠️ Proyecto desarrollado con **dbv-specs-ops** por **[David Bueno Vallejo](https://github.com/davidbuenov)**.
