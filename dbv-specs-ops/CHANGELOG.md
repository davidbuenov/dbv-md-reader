# 📝 Changelog: dbv-md-reader

Todas las notas de cambios relevantes de este proyecto se documentarán en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Sin publicar]

### Añadido
- **Carpeta `templates/` con 20 plantillas Markdown bilingües (ES/EN)**, organizadas por categoría en `templates/README.md`: **Académico** (seguimiento TFG, rúbrica de evaluación TFG, acta de defensa TFG, notas de curso), **Desarrollo de software** (registro de decisiones/ADR, informe de bug, especificación de funcionalidad/RFC, checklist de release), **Gestión de proyectos** (información de proyecto, seguimiento de proyecto, lista de tareas, comparativa de opciones), **Reuniones y equipos** (acta de reunión, notas 1:1, retrospectiva, guía de onboarding) y **Personal** (CV, itinerario de viaje, receta de cocina, revisión semanal). Solo contenido (sin tocar código ni build), pensadas como ejemplos reales de uso de la app y complemento descargable.

---

## [0.13.1] - 2026-08-20

### Añadido
- **Alertas / callouts al estilo GitHub**: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` se renderizan como recuadros con icono y color por tipo (mismos tonos que GitHub), en los tres temas. Antes se mostraban como una cita normal con el marcador `[!NOTE]` como texto literal — la sintaxis ya estaba documentada en la ayuda integrada, pero nunca se había implementado.
- **Indicador "Modificado"** junto al nombre del documento en Modo Edición: aparece en cuanto hay cambios sin guardar y desaparece al guardar o salir del modo edición (badge compartido con "Solo lectura", `.header-badge`).
- **Confirmación al descartar cambios sin guardar**: cerrar la ventana, salir de Modo Edición (`Ctrl+E`) o navegar a otro documento con cambios sin guardar ahora pregunta antes de descartarlos — modal propio coherente con el resto de la interfaz, con las mismas dos opciones en los tres casos.
- **Tabla de atajos de teclado y ratón**: nueva sección en la ayuda integrada (`src/markdownhelp_{es,en}.md`) y en el `README`, con los atajos existentes documentados por primera vez en un solo sitio.

### Corregido
- **Cierre de la ventana sin preguntar pese a tener cambios sin guardar (pérdida de datos real)**: tres bugs encadenados. (1) faltaba el permiso `core:window:allow-destroy` — sin él, Tauri no podía completar el cierre tras `onCloseRequested` y la ventana quedaba bloqueada sin poder cerrarse en absoluto. (2) `window.confirm()` en este WebView2 no es síncrono como en un navegador normal, sino que devuelve una promesa — tratarlo como booleano hacía que el guardián de cierre nunca esperase la respuesta real. (3) el propio `window.confirm()` resultó ser irrecuperable: el script de inicialización de `tauri-plugin-dialog` 2.7.2 lo redefine para invocar el comando `plugin:dialog|confirm`, que ya no existe en el lado Rust de esa versión del plugin (se fusionó con `message`, sin actualizar el script de JS) — ningún permiso lo arregla porque el comando no existe. Sustituido por un modal propio.
- **Enlaces internos rotos hacia encabezados con tilde/ñ**: el navegador serializa el `href` de un enlace `#ancla-con-acentos` con los caracteres no-ASCII percent-encoded (`é` → `%C3%A9`), pero el `id` real del encabezado se queda como texto Unicode literal — la comparación nunca coincidía. Corregido decodificando el fragmento antes de buscar el elemento.
- **Enlaces internos rotos hacia encabezados con "/" en el título** (p. ej. "Alertas / callouts"): el generador de slugs propio colapsaba guiones consecutivos y recortaba espacios sobrantes tras quitar un emoji — GitHub no hace ninguna de las dos cosas. Corregido para igualar el comportamiento real de GitHub; de paso arregla 6 enlaces del propio `README.md`/`README.en.md` que llevaban rotos desde antes de esta versión por el mismo motivo (emoji al inicio del encabezado).
- **La ayuda integrada no reflejaba ediciones del fichero mientras la app seguía abierta**: se leía una sola vez por idioma y sesión de ventana. Ahora relee del disco en cada apertura (el parseo/renderizado completo solo se repite si el contenido cambió de verdad, no en cada clic).

---

## [0.13.0] - 2026-08-20

### Añadido
- **RF-25 — Explorador de árbol de directorios**: nueva pestaña "Archivos" junto al Índice de encabezados, en el mismo panel lateral. La raíz sigue siempre a la carpeta del documento activo (o la del último archivo de Recientes si se arranca sin ninguno abierto); carpetas expandibles bajo demanda, filtro de texto, y archivos que no son `.md` visibles pero no clicables. Clic simple abre en la misma ventana; `Ctrl/Cmd+clic` lo abre en una ventana nueva. Arrastrar una carpeta (no solo un `.md`) sobre la ventana la fija como raíz. Menú contextual (clic derecho) con "Revelar en el Explorador de archivos" y "Abrir en ventana nueva".
- **RF-26 — Selector rápido de archivos (Quick Open, `Ctrl/Cmd+K`)**: cuadro de búsqueda flotante que filtra por nombre entre los `.md` ya cargados en el árbol; `Enter` abre en la ventana actual, `Ctrl/Cmd+Enter` en una nueva.

### Corregido
- **Ventana nueva en blanco/colgada al abrir un archivo con `Ctrl+clic` (RF-25/RF-26)**: un comando de Tauri síncrono se despacha ya sobre el hilo principal en esta versión, así que invocar `run_on_main_thread` directamente desde ahí lo ejecutaba de forma reentrante — la ventana nueva se creaba anidada dentro del propio despacho del mensaje que la originó, y quedaba colgada para siempre. Detectado por el usuario probando la función en real. Corregido forzando el despacho desde un hilo genuinamente distinto (`tauri::async_runtime::spawn`).

---

## [0.12.0] - 2026-08-19

### Añadido
- **RF-23 — Barra de formato Markdown en el Modo Edición**: segunda fila de iconos sobre el `<textarea>` (negrita, cursiva, tachado, código inline, H1/H2/H3, lista, lista numerada, tarea, enlace, imagen, cita, bloque de código, tabla, línea horizontal). Con texto seleccionado, envuelve/transforma la selección (y permite alternar: pulsar Negrita dos veces desenvuelve); sin selección, inserta un esqueleto mínimo con el placeholder preseleccionado listo para sobrescribir. Cada acción dispara el mismo evento `input` que una edición tecleada, así que la gestión de conflictos (RF-21) y el resaltado "sucio" no distinguen entre ambos orígenes. Atajos `Ctrl+B`/`Ctrl+I` opcionales cuando el editor tiene el foco.
- **RF-24 — Tab/Shift+Tab indentan dentro del editor**: antes, Tab movía el foco al siguiente control de la interfaz en vez de anidar listas. Ahora indenta/desindenta la línea actual (o todas las líneas de la selección) en incrementos de 2 espacios, sin salir nunca del `<textarea>`; el resto de la app conserva la navegación por Tab normal.
- **Menú nativo macOS: "Guardar" y "Alternar Modo Edición"** en File/View (⌘S/⌘E), localizados según el idioma del sistema igual que el resto del menú. Contribución de [Victor Estival](https://github.com/vestival), PR [#7](https://github.com/davidbuenov/dbv-md-reader/pull/7).

### Corregido
- **Doble clic + Negrita/Cursiva/Enlace rompía el formato**: el doble clic del `<textarea>` para seleccionar una palabra incluye también el espacio siguiente — al envolverla tal cual salía `**palabra **`/`[palabra ](url)`, que CommonMark no reconoce como énfasis/enlace válido. Detectado por el usuario probando la barra de formato recién añadida. Los espacios en los bordes de la selección se recortan antes de aplicar el marcado en vez de envolverlos también.

---

## [0.11.0] - 2026-08-18

### Añadido
- **RF-20 — Modo Edición (Ctrl+E)**: panel dividido con el Markdown en crudo (`<textarea>` plano, sin librería de editor de código) a la izquierda y la vista renderizada a la derecha, reutilizando el mismo pipeline de `renderMarkdown()` (RF-02/RF-03) con debounce (~400 ms). Números de línea sincronizados con el scroll. Guardado con `Ctrl+S`/botón "Guardar" mediante un nuevo comando Rust `write_file`. **Vista Dividida en Vivo / Modo Espejo**: mientras no haya cambios sin guardar, la auto-recarga por cambios externos (RF-06) refresca también el panel de código, no solo la preview — permite usar la app como visor en vivo de lo que se edita en otra herramienta.
- **Paneles redimensionables por arrastre**: divisor entre el panel de código y la preview, y otro para la Tabla de Contenidos — tamaño persistido entre sesiones.
- **Sincronización de scroll editor↔preview↔TOC**: al desplazarte en cualquiera de los tres, los otros dos siguen la misma posición del documento (interpolación por encabezados, no un simple porcentaje).
- **RF-21 — Gestión de Conflictos entre Edición Local y Cambios Externos**: sin cambios sin guardar, recarga silenciosa (comportamiento ya existente de RF-06); con cambios sin guardar, un modal bloqueante la primera vez ("Conservar mis cambios" / "Recargar desde disco") y, tras esa elección, una franja persistente con la opción de recargar siempre disponible en vez de repetir el modal. El propio guardado no dispara ni el modal ni la franja contra su propio archivo (ventana de supresión de ~800 ms).
- **Indicador "Solo lectura" para documentos remotos**: los documentos abiertos por URL (RF-08A) no admiten guardado — el Modo Edición se deshabilita y una etiqueta junto al nombre del documento lo indica explícitamente, en el idioma activo (ES/EN).
- **RF-22 — Ayuda de sintaxis Markdown**: botón "?" que abre una chuleta de referencia completa (Markdown + GFM) en el idioma activo de la interfaz, con el mismo pipeline de render que el documento principal (enlaces, Mermaid y KaTeX incluidos).
- Inspiración de diseño acreditada a [READU.md](https://github.com/breezy89757/READU.md) en `README.md` — implementación propia y distinta, ver ADR-027 en `memory.md`.
- **Comparativa de rendimiento v0.10.0 → v0.11.0**: benchmark reproducible ejecutado antes/después de añadir el Modo Edición — sin coste medible (tamaño +0,06 %, RAM y arranque dentro del ruido de medición). Detalle en `BENCHMARK_RESULTS.md`, ilustrado en `README.md`/`README.en.md` y la landing page.

### Cambiado
- El botón del Modo Edición se movió junto al de Tabla de Contenidos en la barra superior, agrupando visualmente los dos paneles abribles/cerrables de la app.
- El proyecto pasa de "lector de solo lectura" a "lector y editor" — actualizada la descripción en `README.md`/`README.en.md`, cabeceras de fichero, panel "Acerca de" y fichas de tienda.

### Corregido
- **Enlaces de ancla internos rotos (`[Texto](#seccion)`)**: los encabezados nunca recibían un `id` con el slug real (estilo GitHub: minúsculas, sin puntuación, espacios→guiones) — se les asignaba uno sintético (`h-0`, `h-1`...) sin relación con el texto. Cualquier documento con una tabla de contenidos escrita a mano (patrón muy común en READMEs, incluida la propia chuleta de RF-22) tenía esos enlaces rotos. Afectaba también a los enlaces de ancla entre documentos distintos (RF-08A).
- **Error de Mermaid con icono enorme y sin detalle**: un diagrama con error de sintaxis mostraba el SVG de error por defecto de Mermaid.js (icono de bomba grande, solo "Syntax error in text"). Ahora se muestra un aviso compacto con el mensaje real del parser (línea exacta y token esperado incluidos).
- **No había forma visible de guardar en el Modo Edición**: el guardado solo existía como atajo de teclado (`Ctrl+S`), sin ningún botón. Añadido un botón "Guardar" junto al de Modo Edición.
- **La Ayuda de sintaxis Markdown (RF-22) usaba un renderizador distinto y más pobre**: sin ids de encabezado (enlaces internos rotos), sin Mermaid ni KaTeX. Ahora reutiliza exactamente el mismo pipeline de render que el documento principal.
- **Navegación por clic (TOC, enlaces, búsqueda) desalineada una línea en Modo Edición**: `scrollIntoView()` desplazaba de más un contenedor ambiguo; sustituido por un cálculo explícito del contenedor scrollable real.

---

## [0.10.0] - 2026-08-18

### Añadido
- **macOS: menú nativo de aplicación** (App/File/Edit/View/Window/Help), con "Abrir archivo…" real en File (⌘O) — Tauri no trae menú por defecto en macOS. Contribución de [Victor Estival](https://github.com/vestival), PR [#4](https://github.com/davidbuenov/dbv-md-reader/pull/4).
- **Atajos de teclado con soporte ⌘ además de Ctrl** (buscar, abrir, imprimir, zoom) — mismos atajos en Windows/Linux/macOS. Contribución de [Victor Estival](https://github.com/vestival), PR [#4](https://github.com/davidbuenov/dbv-md-reader/pull/4).

### Corregido
- **macOS: imprimir (⌘/Ctrl+P) fallaba en silencio** — WKWebView exige el permiso explícito `core:webview:allow-print` para `window.print()`, a diferencia de WebView2 (Windows), que no lo requiere. Contribución de [Victor Estival](https://github.com/vestival), PR [#4](https://github.com/davidbuenov/dbv-md-reader/pull/4). Ver ADR-026 en `memory.md`.

---

## [0.9.0] - 2026-08-17

### Añadido
- **RF-02 ampliado — soporte GFM de task lists y footnotes**: `- [ ]`/`- [x]` se renderizan como checkboxes reales (no interactivos, `disabled`, coherente con la app de solo lectura) vía `markdown-it-task-lists`; `[^1]` se renderiza como nota al pie numerada con referencia y retroenlace vía `markdown-it-footnote`. Ambos plugins vendorizados en `src/vendor/` siguiendo el mismo patrón sin CDN/sin bundler que el resto de librerías (ver `memory.md`).
- **RF-19 — Always on Top**: botón nuevo en la barra superior para fijar la ventana por encima de las demás (toggle simple, sin persistencia, por ventana). Multiplataforma por diseño vía la API de Tauri, sin código condicional por sistema operativo.
- **Benchmark reproducible**: `scripts/benchmark.ps1` mide arranque, RAM (Working Set y memoria privada, proceso propio y árbol completo incl. WebView2) y CPU con metodología repetible (7 repeticiones, descarta mejor/peor). Resultados y datos del equipo de referencia en `dbv-specs-ops/BENCHMARK_RESULTS.md`.

### Corregido
- **Listas anidadas con la misma viñeta en todos los niveles**: `#content ul { list-style: disc; }` forzaba el mismo símbolo en cualquier profundidad, pisando la diferenciación nativa del navegador (disc → circle → square). Añadidas reglas para 2º/3º nivel en `styles.css`.

---

## [0.8.0] - 2026-08-16

### Añadido
- **RF-02 ampliado — cobertura de lenguajes en Prism.js**: vendorizados ~20 componentes adicionales (`c`, `cpp`, `python`, `bash`, `json`, `yaml`, `typescript`, `jsx`, `tsx`, `go`, `java`, `rust`, `csharp`, `sql`, `toml`, `diff`, `markdown`, `powershell`, `docker`, `ini`) — el build de Prism.js vendorizado solo traía `markup`/`css`/`clike`/`javascript`, así que el resto de lenguajes se mostraban sin colorear.
- **RF-04 ampliado — TOC con sección activa, tiempo de lectura y barra de progreso**: la Tabla de Contenidos resalta el encabezado visible mientras se hace scroll (`IntersectionObserver`); tiempo de lectura estimado junto al nombre del documento (200 palabras/min); barra de progreso de scroll en el borde inferior de la cabecera.
- **RF-10 ampliado — números de línea y ajuste de línea (wrap) en código**: numeración de línea por defecto (plugin oficial `prism-line-numbers`) y un botón "Wrap line" junto al de copiar para alternar el scroll horizontal por salto de línea en bloques con líneas muy largas.

### Cambiado
- **RF-05 ampliado — colores de sintaxis adaptados a cada tema (cierra deuda técnica)**: sustituida la hoja de estilos de Prism.js fija (pensada para tema oscuro, con muy poco contraste en Claro/Sepia) por variables CSS propias por tema, mapeadas a los tokens de Prism.js. El tema Oscuro conserva el aspecto anterior. Ver ADR-022 en `memory.md`.

Auditoría de seguridad de esta fase (obligatoria, `/code-simplify`): sin secretos en el código; las ~22 librerías vendorizadas nuevas (componentes de Prism.js + plugin de números de línea) se copiaron directamente de `node_modules/prismjs/` (paquete ya instalado y auditado, sin tipear código a mano ni descargar de un CDN); sin cambios en Rust ni en las dependencias de `Cargo.toml`; sin nuevas superficies de entrada de usuario (los cambios son de renderizado/CSS/JS de solo lectura sobre contenido que ya pasaba por DOMPurify).

---

## [0.7.1] - 2026-08-15

### Corregido
- **macOS: "Abrir con" no cargaba el archivo (RF-01):** Finder entrega la ruta vía Apple Event (`RunEvent::Opened`), no como argumento de línea de comandos — la app nunca escuchaba ese evento, así que la ventana se abría vacía. Reportado por un usuario real tras probar la Release de macOS de la Fase 25.
- **RF-14: ventana nueva no venía al frente y "Abrir con" repetido duplicaba ventanas:** `open_document_window()` no llamaba a `set_focus()` tras crear la ventana, y no existía ningún registro de qué archivo mostraba cada ventana. Ahora toda apertura trae la ventana al frente, y reabrir un archivo ya visible en una ventana existente la enfoca en vez de abrir un duplicado.

---

## [0.7.0] - 2026-08-12

> **Nota:** el paquete Windows de esta versión ya está en certificación en Microsoft Store al añadir lo de más abajo (Fase 24, 2026-08-12) — se decidió conscientemente **no** subir de versión, porque el código de aplicación (Rust/JS) no cambia en absoluto, solo empaquetado/CI/documentación para Linux y macOS. La build de Windows que está en certificación sigue siendo exactamente la 0.7.0. **Actualización (Fase 25, 2026-08-13):** mismo criterio — Microsoft Store ya está publicada y macOS pasa a Release oficial vía CI, de nuevo sin tocar el código de aplicación.

### Añadido
- **RF-17 Ecuaciones matemáticas (LaTeX)**: renderizado con **KaTeX** vendorizado localmente (`src/vendor/`, sin CDN, mismo patrón que Mermaid). Sintaxis soportada: inline `$...$`, bloque `$$...$$` y bloque de código ` ```math `. Preprocesado (`extractMath()`) protege las fórmulas del Markdown crudo antes del parseo (mismo tipo de problema de capa que RF-03/ADR-009: `$...$` es texto normal de párrafo, a diferencia de un bloque ` ```mermaid ``` ` ya opaco desde el principio) y postprocesado (`processMath()`) las renderiza tras el sanitizado, con `throwOnError: false` para que un LaTeX inválido no rompa el resto del documento. Ver ADR-018 en `memory.md`.
- **RF-10 mejorado — paginación real de impresión/PDF**: `@page` (A4, márgenes), evita títulos/tablas/código/imágenes/diagramas/fórmulas partidos entre páginas, muestra la URL junto a cada enlace y fuerza contraste legible en el bloque de código al imprimir.
- **Distribución para Linux (Release oficial vía CI)**: `.github/workflows/release-linux.yml` construye `.deb` y `.AppImage` en cada tag `vX.Y.Z` y los adjunta como borrador de GitHub Release. Sin auto-actualización en esta plataforma por ahora (deuda técnica consciente, ver ADR-019 en `memory.md`).
- **Distribución para macOS vía CI (Release oficial)**: `.github/workflows/release-macos.yml` construye un `.dmg`/`.app` **universal** (Intel + Apple Silicon, sin firma) en cada tag `vX.Y.Z` y lo adjunta como borrador de GitHub Release, mismo patrón que Linux — amplía la decisión inicial de solo compilación local (ver ADR-020 en `memory.md`). Verificado en producción contra la Release `v0.7.0` real.
- **Ficha de Uptodown enviada** (macOS, `.dmg` universal): en revisión por su equipo editorial a fecha de esta entrada. Textos del formulario en `descripcionStoreUptoDown_es.md`/`_en.md`. Uptodown no admite Linux como plataforma, así que ese canal sigue siendo exclusivamente GitHub Releases.
- **Microsoft Store como descarga preferente en Windows 11**: README y landing de GitHub Pages (`docs/index.html` + `docs/en/index.html`) actualizados con el badge oficial y el enlace a la ficha ya publicada (`apps.microsoft.com/detail/9n7bmdzgcp0s`), presentándola como la vía recomendada (sin aviso de SmartScreen, auto-actualización nativa) frente al instalador NSIS.
- Configuración de Tauri separada por plataforma (`src-tauri/tauri.windows.conf.json`, `tauri.linux.conf.json`, `tauri.macos.conf.json`), fusionada automáticamente por el propio Tauri v2 según el sistema operativo de build. El flujo de Release de Windows no cambia.

### Cambiado
- `dbv-specs-ops/docs/MICROSOFT_STORE.md`: estado actualizado de "en preparación" a publicado.

### Corregido
- **Rechazo de Microsoft Store (política 10.1.1.11 "On Device Tiles")**: el mosaico ancho del paquete MSIX (`Wide310x150Logo.png`, 310×150) era un rectángulo negro sólido en vez del icono real de la app — quedó así tras el pulido visual de la Fase 20 sin terminar de generarse correctamente. Regenerado centrando el icono real sobre un lienzo transparente (mismo criterio que usa la propia herramienta de empaquetado). Ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §4bis.
- **`release-macos.yml` compilaba solo para Apple Silicon (`aarch64`)**: el runner `macos-latest` de GitHub es Apple Silicon, así que sin `--target` explícito el `.dmg` generado no arrancaba en absoluto en un Mac Intel. Corregido con `--target universal-apple-darwin` + ambos targets de Rust instalados antes del build. Ver ADR-020 en `memory.md`.

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
