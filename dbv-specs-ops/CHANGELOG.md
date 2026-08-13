# 📝 Changelog: dbv-md-reader

Todas las notas de cambios relevantes de este proyecto se documentarán en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [0.7.0] - 2026-08-12

> **Nota:** el paquete Windows de esta versión ya está en certificación en Microsoft Store al añadir lo de más abajo (Fase 24, 2026-08-12) — se decidió conscientemente **no** subir de versión, porque el código de aplicación (Rust/JS) no cambia en absoluto, solo empaquetado/CI/documentación para Linux y macOS. La build de Windows que está en certificación sigue siendo exactamente la 0.7.0. **Actualización (Fase 25, 2026-08-13):** mismo criterio — Microsoft Store ya está publicada y macOS pasa a Release oficial vía CI, de nuevo sin tocar el código de aplicación.

### Añadido
- **RF-17 Ecuaciones matemáticas (LaTeX)**: renderizado con **KaTeX** vendorizado localmente (`src/vendor/`, sin CDN, mismo patrón que Mermaid). Sintaxis soportada: inline `$...$`, bloque `$$...$$` y bloque de código ` ```math `. Preprocesado (`extractMath()`) protege las fórmulas del Markdown crudo antes del parseo (mismo tipo de problema de capa que RF-03/ADR-009: `$...$` es texto normal de párrafo, a diferencia de un bloque ` ```mermaid ``` ` ya opaco desde el principio) y postprocesado (`processMath()`) las renderiza tras el sanitizado, con `throwOnError: false` para que un LaTeX inválido no rompa el resto del documento. Ver ADR-018 en `memory.md`.
- **RF-10 mejorado — paginación real de impresión/PDF**: `@page` (A4, márgenes), evita títulos/tablas/código/imágenes/diagramas/fórmulas partidos entre páginas, muestra la URL junto a cada enlace y fuerza contraste legible en el bloque de código al imprimir.
- **Distribución para Linux (Release oficial vía CI)**: `.github/workflows/release-linux.yml` construye `.deb` y `.AppImage` en cada tag `vX.Y.Z` y los adjunta como borrador de GitHub Release. Sin auto-actualización en esta plataforma por ahora (deuda técnica consciente, ver ADR-019 en `memory.md`).
- **Distribución para macOS vía CI (Release oficial)**: `.github/workflows/release-macos.yml` construye el `.dmg`/`.app` (sin firmar) en cada tag `vX.Y.Z` y lo adjunta como borrador de GitHub Release, mismo patrón que Linux — amplía la decisión inicial de solo compilación local (ver ADR-020 en `memory.md`). El mismo artefacto queda preparado para publicarse también en Uptodown (alta manual, fuera de CI).
- **Microsoft Store como descarga preferente en Windows 11**: README y landing de GitHub Pages (`docs/index.html` + `docs/en/index.html`) actualizados con el badge oficial y el enlace a la ficha ya publicada (`apps.microsoft.com/detail/9n7bmdzgcp0s`), presentándola como la vía recomendada (sin aviso de SmartScreen, auto-actualización nativa) frente al instalador NSIS.
- Configuración de Tauri separada por plataforma (`src-tauri/tauri.windows.conf.json`, `tauri.linux.conf.json`, `tauri.macos.conf.json`), fusionada automáticamente por el propio Tauri v2 según el sistema operativo de build. El flujo de Release de Windows no cambia.

### Cambiado
- `dbv-specs-ops/docs/MICROSOFT_STORE.md`: estado actualizado de "en preparación" a publicado.

### Corregido
- **Rechazo de Microsoft Store (política 10.1.1.11 "On Device Tiles")**: el mosaico ancho del paquete MSIX (`Wide310x150Logo.png`, 310×150) era un rectángulo negro sólido en vez del icono real de la app — quedó así tras el pulido visual de la Fase 20 sin terminar de generarse correctamente. Regenerado centrando el icono real sobre un lienzo transparente (mismo criterio que usa la propia herramienta de empaquetado). Ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §4bis.

Auditoría de seguridad de esta fase (obligatoria, `/code-simplify`): sin secretos en el código; única dependencia nueva es `katex` (vendorizada, no cargada en runtime vía npm); la salida de KaTeX se pasa por `DOMPurify.sanitize()` antes de inyectarse en el DOM (defensa en profundidad, además del `trust:false` por defecto de la propia librería) — verificado visualmente que no recorta MathML ni los SVG de radicales.

Auditoría de seguridad de la Fase 25 (`release-macos.yml` + landing + docs, obligatoria antes de `/ship`): sin secretos filtrados (escaneado el diff completo, único uso de credenciales es `${{ secrets.GITHUB_TOKEN }}`, igual que `release-linux.yml`); sin dependencias nuevas (mismas GitHub Actions ya auditadas: `actions/checkout@v5`, `dtolnay/rust-toolchain@stable`, `actions/setup-node@v5`, `tauri-apps/tauri-action@v0`); el único input de usuario del workflow (`draft`, `workflow_dispatch`) es de tipo `choice` restringido a `true`/`false`, sin superficie de inyección de shell. Hallazgo incidental (no relacionado con el cambio de esta fase): un byte NUL suelto en `memory.md` (ADR-018, sesión anterior) hacía que Git tratara el fichero como binario — eliminado, sin pérdida de contenido.

## [0.6.0] - 2026-08-11

### Añadido
- **Interfaz en español e inglés (RF-16)**: selector ES/EN en la barra superior (junto al de temas), detección automática del idioma del sistema al primer arranque, elección persistente. Cubre toda la interfaz de la app (`src/i18n.js`, sin librería de i18n externa).
- **Ficha de Microsoft Store bilingüe**: `descripcionStore_es.md` / `descripcionStore_en.md` con los textos listos para Partner Center, y 4 capturas de pantalla nuevas (`docs/assets/store/`) en ambos idiomas.

### Corregido
- **Bug de traducción con un documento abierto**: al cambiar de idioma, el nombre del archivo en la barra se sobreescribía con el texto genérico "Sin documento abierto".
- **Envío a Microsoft Store**: nombre de manifiesto (`dbv-md-reader`) sin reservar en Partner Center — resuelto reservándolo como nombre adicional del mismo producto, sin tocar el paquete.

## [0.5.0] - 2026-08-11

### Añadido
- **Instalador NSIS con tema visual moderno**: `XPStyle on` (botones y controles con el tema activo de Windows en vez del estilo clásico sin temas de Windows 2000), confirmación al cancelar a medias, textos personalizados de Bienvenida y Fin, sidebar de marca rediseñado, y descripciones fijas en la página de componentes (`MUI_COMPONENTSPAGE_SMALLDESC`).
- **Paquete MSIX para Microsoft Store**: empaquetado con la herramienta de terceros `@choochmeque/tauri-windows-bundle` (auditada antes de usar), con la identidad real reservada en Partner Center. Sienta las bases para publicar en la Store re-firmando con el certificado de Microsoft, sin necesidad de comprar un certificado Authenticode propio. Ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` para el checklist completo.
- **Página de política de privacidad** (`docs/privacidad.html`), enlazada desde la landing y lista para Partner Center.

### Cambiado
- **Rebrand a "DBV Markdown Reader"**: nombre visible de la aplicación (título de ventana, instalador, panel "Acerca de", Estado Vacío) — el identificador técnico interno (`com.davidbuenov.dbv-md-reader`) y la carpeta de datos de usuario no cambian, así que los Archivos Recientes y la configuración existente se conservan. Quien tenga una versión anterior instalada verá una entrada nueva en "Agregar o quitar programas" en vez de una actualización in-place.
- **Nombre del instalador sin espacios**: `dbv-markdown-reader_x.y.z_x64-setup.exe` (antes tenía un espacio, heredado literalmente del nombre de la app). `npm run build` ahora orquesta `tauri build` + un renombrado automático (`scripts/build.mjs`).

### Corregido
- **`scripts/build.mjs` reportaba éxito aunque el renombrado del instalador fallara**: el código de salida solo reflejaba `tauri build`, no `rename-installer.mjs`. Detectado en la revisión `/code-simplify` de esta fase. Ahora se propaga el fallo real de cualquiera de los dos pasos.
- **`scripts/installer-name.mjs` duplicaba el `productName` como literal** en vez de derivarlo de `tauri.conf.json` — un futuro rebrand podía desincronizar el nombre de archivo esperado del que realmente genera Tauri. Ambas funciones ahora reciben `productName` como parámetro.
- **`scripts/generate-latest-json.mjs`** llamaba a `installerFileName()` con la firma antigua (un solo argumento) y su texto de notas por defecto seguía diciendo "dbv-md-reader" tras el rebrand.
- **El botón "Buscar actualizaciones" seguía activo en el paquete MSIX de Microsoft Store**: apuntaba al mismo `tauri-plugin-updater` que el canal NSIS (contra `latest.json` en GitHub), pero descargar y ejecutar el instalador NSIS dentro del sandbox del paquete de la Store fallaría o crearía una instalación separada. Detectado al probar el `.msixbundle` instalado de verdad. Nuevo comando Rust `is_packaged_app` (detecta si el `.exe` corre bajo `...\WindowsApps\...`) oculta el botón y muestra un aviso fijo ("Las actualizaciones se instalan automáticamente desde Microsoft Store") cuando corresponde — el canal NSIS no se ve afectado.

Auditoría de seguridad de esta fase (obligatoria, `/code-simplify`): sin secretos en el código; `@choochmeque/tauri-windows-bundle` es la única dependencia nueva, ya auditada antes de instalarla (ver más arriba); sin entradas de usuario nuevas que sanitizar (los scripts nuevos solo leen `tauri.conf.json` y el sistema de archivos local).

## [0.4.0] - 2026-08-10

### Añadido
- **RF-14 Instancia única (multi-ventana, no multi-proceso)**: abrir un `.md` mientras la app ya está en marcha (doble clic, "Abrir con...") ya no lanza un `dbv-md-reader.exe` nuevo — abre una ventana más dentro del mismo proceso (`tauri-plugin-single-instance`), un único árbol en el Administrador de Tareas con varias ventanas, cada una con su documento/zoom/TOC/búsqueda/watcher totalmente independiente. `Ctrl+O`/Recientes/Drag&Drop dentro de una ventana ya abierta siguen sustituyendo su documento, sin cambios — decisión consciente, ver ADR-015.
- **RF-15 Abrir un diagrama Mermaid en mermaid.live**: menú contextual (botón derecho) sobre cualquier diagrama renderizado, para inspeccionarlo con pan/zoom libre cuando el zoom interno (tope 200%) se queda corto en diagramas grandes. Sin servidor propio: el código se codifica en el fragmento de la URL (`#pako:...`), mismo formato que usa mermaid.live para sus propios enlaces para compartir.
- **Comparativa real de memoria** en `README.md` y la landing page: los mismos 2 `.md` abiertos a la vez en Visual Studio Code (885,8 MB), Notepad++ (21,5 MB) y `dbv-md-reader` (5,9 MB), según el Administrador de Tareas de Windows.

### Corregido
- **Ventanas nuevas de RF-14 sin permisos (`Command plugin:event|listen not allowed by ACL`)**: `capabilities/main.json` restringía todos los permisos a la ventana `"main"` (el campo `windows` hace *glob matching* sobre la etiqueta), así que las ventanas `doc-0`, `doc-1`... que abre la instancia única se quedaban sin poder escuchar eventos (`file-changed` de RF-06, `tauri://drag-drop` de RF-09). Ampliado a `["main", "doc-*"]`.

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
