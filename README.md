# DBV Markdown Reader

**🇪🇸 Español · [🇬🇧 English](./README.en.md)**

[![Release](https://img.shields.io/github/v/release/davidbuenov/dbv-md-reader?display_name=tag&sort=semver)](https://github.com/davidbuenov/dbv-md-reader/releases)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-disponible-0078D4?logo=microsoft&logoColor=white)](https://apps.microsoft.com/detail/9n7bmdzgcp0s)
[![Uptodown](https://img.shields.io/badge/Uptodown-macOS-1AAFD0)](https://dbv-markdown-reader.uptodown.com/mac)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Rust](https://img.shields.io/badge/Rust-1.76+-000000?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-.deb%20%2F%20AppImage-FCC624?logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/macOS-.dmg%20sin%20firmar-000000?logo=apple&logoColor=white)
![Status](https://img.shields.io/badge/status-active-success)
[![Last Update](https://img.shields.io/github/last-commit/davidbuenov/dbv-md-reader?label=last%20update)](https://github.com/davidbuenov/dbv-md-reader/commits/master)
[![Framework](https://img.shields.io/badge/framework-dbv--specs--ops-111827?logo=github&logoColor=white)](https://github.com/davidbuenov/dbv-specs-ops)

> Lector y editor nativo de Markdown (`.md`) ultra-ligero, seguro y veloz para Windows, Linux y macOS basado en Rust y Tauri v2.

**[🌐 Ver la web del proyecto](https://davidbuenov.github.io/dbv-md-reader/)**

![Demo animada de dbv-md-reader: resaltado de sintaxis con color real, cambio entre temas Claro/Oscuro/Sepia y navegación por la Tabla de Contenidos](docs/assets/screenshots/demo_v_0_8.gif)

---

## 📑 Índice

- [Descárgalo e instálalo](#-descárgalo-e-instálalo)
  - [Windows](#-windows)
  - [Linux](#-linux)
  - [macOS](#-macos)
- [Sobre el proyecto](#-sobre-el-proyecto)
- [Características Principales](#-características-principales)
- [Plantillas incluidas](#-plantillas-incluidas)
- [Atajos de teclado](#-atajos-de-teclado)
- [Para desarrolladores](#-para-desarrolladores)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Changelog](#-changelog)
- [Contribuir](#-contribuir)
- [Curiosidad: candidato a PowerToys](#-curiosidad-candidato-natural-a-microsoft-powertoys)
- [Licencia](#-licencia)
- [Autor y Créditos](#-autor-y-créditos)

---

## 🚀 Descárgalo e instálalo

**No necesitas instalar Rust, Node.js, ni ninguna herramienta de programación.** El instalador de **DBV Markdown Reader** trae todo lo necesario —incluido el motor de renderizado de Windows (WebView2)— y asocia los archivos `.md` contigo automáticamente.

### 🪟 Windows

#### 🏬 Microsoft Store (recomendado en Windows 11)

**[🛒 Consíguelo en Microsoft Store](https://apps.microsoft.com/detail/9n7bmdzgcp0s)**

Es la vía preferente para Windows 11: el paquete lo firma la propia Store (sin el aviso de SmartScreen del `.exe`), se instala con un clic y se actualiza solo. Si prefieres no usar la Store, o vas en Windows 10, usa el instalador `.exe` de abajo.

#### 1️⃣ Descarga (instalador `.exe`)

**[⬇️ Ver todas las versiones (Releases)](https://github.com/davidbuenov/dbv-md-reader/releases)**

Descarga el instalador de la última versión: `dbv-markdown-reader_x.y.z_x64-setup.exe`.

El navegador puede avisar de que el archivo "no se descarga habitualmente" o "no es de confianza" (SmartScreen de Microsoft Edge/Chrome). Es normal en instaladores nuevos y sin firma comercial: en Edge, abre el panel de descargas y pulsa **Mostrar más → Mantener** (o **Conservar de todos modos**).

#### 2️⃣ Instala

Haz doble clic sobre el instalador descargado. No requiere permisos de administrador (se instala solo para tu usuario) ni conexión a internet durante la instalación —el WebView2 necesario ya viaja incluido—. Windows puede mostrar también un aviso de "Editor no reconocido" al ejecutarlo — pulsa **Más información → Ejecutar de todas formas**.

Antes de copiar los archivos, el instalador muestra una pantalla con dos casillas independientes (ambas marcadas por defecto, pero desmarcables):

1. **Menú contextual**: que **DBV Markdown Reader** aparezca como opción al pulsar con el botón derecho sobre un `.md` → **Abrir con...**.
2. **Aplicación predeterminada**: que además sea la aplicación que abre los `.md` al hacer doble clic.

Puedes cambiar esta configuración cuando quieras desde **Configuración → Aplicaciones → Aplicaciones predeterminadas** de Windows.

> Si ya tenías instalada una versión anterior con la pantalla de asociación de `.md` distinta (o sin ella) y el menú "Abrir con" te sigue mostrando una entrada duplicada o con el icono antiguo, desinstala primero la versión anterior desde "Aplicaciones instaladas" de Windows y luego instala la nueva — versiones previas usaban un identificador interno distinto que el desinstalador no limpia automáticamente entre versiones.

#### 3️⃣ Actualiza

A partir de aquí ya no necesitas volver a esta página para cada versión nueva. Abre el panel **Acerca de** (icono ⓘ de la barra superior) y pulsa **Buscar actualizaciones**. La comprobación es siempre bajo demanda — nunca se ejecuta sola al arrancar, para no afectar al arranque instantáneo.

- Si ya tienes la última versión: **"Ya tienes la última versión."**
- Si hay una nueva: **"Nueva versión X.Y.Z disponible."** y el botón cambia a **Actualizar** — un clic descarga, instala y reinicia la app por ti, sin salir de **DBV Markdown Reader** ni pasar por el navegador ni por Releases.

### 🐧 Linux

**[⬇️ Descarga el `.deb` o el `.AppImage` desde Releases](https://github.com/davidbuenov/dbv-md-reader/releases)** — se generan automáticamente en cada versión.

- **`.deb` (Debian, Ubuntu, Linux Mint y derivadas):** `sudo dpkg -i dbv-md-reader_x.y.z_amd64.deb` (o doble clic desde el gestor de archivos). Es la opción recomendada — instala la app en el sistema y registra la asociación con `.md`.
- **`.AppImage` (cualquier distribución):** dale permisos de ejecución (`chmod +x dbv-md-reader_x.y.z_amd64.AppImage`) y ejecútalo directamente. Es portátil (no requiere instalación), pero **no** se asocia automáticamente con archivos `.md` — para eso hace falta una herramienta adicional como [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

> **Nota:** el canal de Linux todavía no tiene comprobación de actualizaciones integrada (botón "Buscar actualizaciones" del panel "Acerca de") — descarga la versión nueva desde Releases cuando quieras actualizar.

### 🍎 macOS

#### 🟢 Uptodown (recomendado en macOS)

**[⬇️ Consíguelo en Uptodown](https://dbv-markdown-reader.uptodown.com/mac)**

Vía Uptodown descargas el `.dmg` directamente desde su web, sin pasar por la página de Releases de GitHub. Sigue sin firma ni notarización de Apple (ver aviso más abajo), pero es la forma más sencilla de encontrar la última versión sin tener que navegar por GitHub.

**[⬇️ Descarga el `.dmg` desde Releases](https://github.com/davidbuenov/dbv-md-reader/releases)** — se genera automáticamente en cada versión vía CI (ver más abajo).

No está firmado ni notarizado: la firma y notarización de Apple requieren una cuenta de pago (Apple Developer Program, 99 $/año) que este proyecto no usa, así que macOS lo bloqueará la primera vez ("no se puede abrir porque su desarrollador no puede verificarse"). Para abrirlo:

- Clic derecho (o `Ctrl` + clic) sobre `DBV Markdown Reader.app` → **Abrir** → confirmar en el diálogo. Solo hace falta la primera vez.
- O, desde la Terminal: `xattr -cr "DBV Markdown Reader.app"` antes de abrirlo.

Si prefieres compilar tu propio ejecutable en vez de descargar el `.dmg`, puedes hacerlo en un par de minutos:

```bash
git clone https://github.com/davidbuenov/dbv-md-reader.git
cd dbv-md-reader
npm install
npm run tauri build
```

El `.app` resultante queda en `src-tauri/target/release/bundle/macos/`, tampoco firmado — mismo aviso de Gatekeeper y mismo remedio que arriba (`xattr -cr "src-tauri/target/release/bundle/macos/DBV Markdown Reader.app"`).

Requiere tener instalados Xcode Command Line Tools (`xcode-select --install`), [Rust](https://rustup.rs/) y Node.js 18+ — ver la sección [Para desarrolladores](#-para-desarrolladores) más abajo para el detalle común a las tres plataformas.

---

## 📌 Sobre el proyecto

**DBV Markdown Reader** es una aplicación nativa para **leer y editar archivos Markdown (`.md`)** — con Release oficial para Windows y Linux, y compilación local para macOS. Ofrece una apertura instantánea (< 200 ms), un ejecutable ligero (< 20 MB) y un consumo de memoria RAM inferior a 64 MB, tanto en modo lectura como en el Modo Edición (ver [comparativa de coste real](#-rendimiento--medido-no-solo-afirmado) más abajo).

Sustituye la pesadez de visores basados en Electron o IDEs pesados por un ejecutable nativo liviano con protección anti-XSS mediante **DOMPurify** sobre el HTML ya renderizado.

### 📊 Rendimiento — medido, no solo afirmado

Benchmark reproducible (7 repeticiones por medición, se descarta la mejor y la peor, se promedia el resto — metodología y datos del equipo de referencia en [`dbv-specs-ops/BENCHMARK_RESULTS.md`](./dbv-specs-ops/BENCHMARK_RESULTS.md), regenerable por cualquiera con `pwsh scripts/benchmark.ps1`):

| Medición | Resultado |
| --- | --- |
| Arranque (frío / caliente) | ~20 ms |
| RAM del proceso propio (memoria privada) | ~7-8 MB |
| RAM total, incluido el motor WebView2 (memoria privada) | ~215-250 MB |
| CPU en reposo | 0 % |

*"Memoria privada" excluye las páginas de código que Windows comparte físicamente entre cualquier app que use WebView2 (el motor de renderizado de Microsoft Edge, preinstalado en Windows 11) — a diferencia de Electron, que no comparte nada entre apps. Es la cifra que refleja el coste real y exclusivo de esta app, ni inflada ni recortada a conveniencia.*

#### ¿Cuánto cuesta el Modo Edición? — mismo benchmark, antes y después

La duda razonable con cualquier editor integrado es si va a engordar la app. Se ejecutó el mismo benchmark reproducible contra el `.exe` de la versión justo anterior a añadir el Modo Edición (`v0.10.0`, de solo lectura) y contra esta versión (`v0.11.0`, con panel dividido, números de línea, paneles redimensionables, sincronización de scroll y gestión de conflictos):

| Medición | v0.10.0 (solo lectura) | v0.11.0 (+ Modo Edición) | Diferencia |
| --- | --- | --- | --- |
| Tamaño del ejecutable | 16,35 MB | 16,36 MB | +0,01 MB (+0,06 %) |
| Arranque en frío | 36 ms | 32 ms | −4 ms |
| Arranque en caliente | 31 ms | 26 ms | −5 ms |
| RAM privada del proceso propio (doc. pequeño) | 7,5 MB | 7,2 MB | −0,3 MB |
| RAM privada del proceso propio (doc. grande) | 7,7 MB | 7,9 MB | +0,2 MB |
| CPU en reposo | 0 % | 0 % | sin cambio |

Las diferencias están dentro del ruido normal de medición entre ejecuciones (ninguna supera unas décimas de MB o unos pocos ms) — no hay coste medible. La razón es de diseño, no casualidad: el editor reutiliza el mismo `<textarea>` plano y el mismo motor de renderizado (`markdown-it` + DOMPurify + Prism/Mermaid/KaTeX) que ya usaba el modo lectura, en vez de incorporar una librería de editor de código tipo CodeMirror o Monaco — la misma decisión que ya resuelve así [READU.md](https://github.com/breezy89757/READU.md), la app que inspiró este enfoque (ver créditos más abajo).

Comparativa original (medición puntual con el Administrador de Tareas, previa al benchmark reproducible de arriba) con los mismos 2 archivos `.md` abiertos a la vez:

![Comparativa de memoria: Visual Studio Code 885,8 MB, Notepad++ 21,5 MB, dbv-md-reader 5,9 MB](docs/assets/screenshots/comparacioneficiencia.png)

| Aplicación | RAM (mismos 2 archivos abiertos) |
| --- | --- |
| Visual Studio Code | 885,8 MB |
| Notepad++ | 21,5 MB |
| **dbv-md-reader** | **5,9 MB** |

Ni siquiera Notepad++ (referencia histórica de ligereza en Windows) se le acerca.

**Construido con:**
- **Core / Backend:** Rust + Tauri v2 (motor de renderizado nativo del sistema: WebView2 en Windows, WebKitGTK en Linux, WKWebView en macOS).
- **Seguridad:** DOMPurify (JS) sanitiza el HTML renderizado contra ataques XSS.
- **Auto-Reload & Remotos:** `notify` (observador de archivos) y `ureq` (cliente HTTP para `.md` remotos) en Rust.
- **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript (Vanilla).
- **Renderizado:** `markdown-it` (CommonMark), `Prism.js` (Syntax Highlighting), `mermaid.js` (Diagramas vectoriales SVG) y `KaTeX` (Ecuaciones matemáticas LaTeX).

---

## ✨ Características Principales

- **Modo Edición:** panel dividido con el Markdown en crudo a la izquierda (con números de línea) y la vista renderizada a la derecha, sincronizados por línea al hacer scroll en cualquiera de los dos — sin librería de editor de código, así que no penaliza el tamaño ni la RAM. Bordes arrastrables para redimensionar. Gestión de conflictos si el archivo cambia desde fuera mientras editas (igual que el Bloc de notas de Windows: silencioso si no tienes cambios propios, un aviso solo la primera vez si sí los tienes). Incluye una chuleta de sintaxis Markdown integrada (botón "?"), una barra de formato de 16 iconos (negrita, cursiva, encabezados, listas, enlaces, imágenes, tablas...) que envuelve la selección o inserta un esqueleto listo para rellenar, y `Tab`/`Shift+Tab` para indentar/desindentar listas sin salir del editor.
- **Apertura CLI / Doble Clic:** Abre directamente cualquier archivo `.md` desde la línea de comandos o asociándolo en *"Abrir con..."* (ej. `dbv-md-reader.exe C:\notas\readme.md`).
- **Instancia única:** abrir varios `.md` desde el Explorador de Windows no multiplica procesos — todas las ventanas viven bajo un único proceso (visible en el Administrador de Tareas), cada una con su propio documento, zoom y búsqueda.
- **Archivos Recientes:** Panel con los últimos documentos abiertos explícitamente, para no tener que volver a buscarlos.
- **Explorador de árbol de directorios + Quick Open:** pestaña "Archivos" junto al Índice, con la carpeta del documento activo como raíz, subcarpetas expandibles y filtro de texto. `Ctrl/Cmd + clic` en cualquier archivo (o en su menú contextual) lo abre en una ventana nueva en vez de sustituir la actual; clic derecho también permite "Revelar en el Explorador de archivos". Arrastra una carpeta entera sobre la ventana para fijarla como raíz. `Ctrl/Cmd + K` abre un selector rápido para saltar a cualquier archivo por nombre sin tocar el ratón.
- **Auto-Reload:** La vista se recarga sola (conservando el scroll) cuando el archivo abierto se edita y guarda desde otra aplicación.
- **Renderizado Híbrido:** Soporta Markdown estándar, GitHub Flavored Markdown (tablas, ~~tachado~~, listas de tareas `- [ ]`, notas al pie `[^1]`), HTML seguro incrustado, imágenes locales y diagramas Mermaid. Botón derecho sobre un diagrama Mermaid → "Abrir en mermaid.live" para inspeccionarlo con zoom libre.
- **Always on Top:** botón en la barra superior para fijar la ventana por encima de las demás mientras trabajas — pensado para mantener la documentación visible junto a un editor o IDE.
- **Resaltado de sintaxis con color real:** ~24 lenguajes soportados (C/C++, Python, Rust, Bash, JSON, YAML, TypeScript, Go, Java, C#, SQL, TOML, PowerShell...), con números de línea y un botón para alternar el ajuste de línea en bloques con líneas muy largas. Los colores se adaptan a cada tema (Claro, Oscuro, Sepia) en vez de usar siempre una paleta oscura fija.
- **Ecuaciones matemáticas:** Sintaxis LaTeX inline (`$...$`), en bloque (`$$...$$` o ` ```math `) renderizada con KaTeX — fracciones, raíces, sumatorios, subíndices/superíndices y símbolos.
- **Documentos remotos:** Abre y navega enlaces a `.md` alojados en una URL (`http(s)://`), además de los locales.
- **Seguridad Estricta:** Sanitización de etiquetas y atributos peligrosos (DOMPurify) antes de insertarse en el WebView2.
- **Navegación e Índice:** Tabla de Contenidos (TOC) flotante/lateral generada automáticamente a partir de los encabezados, con la sección visible resaltada mientras haces scroll. Junto al nombre del documento se muestra el tiempo de lectura estimado, y una barra fina bajo la cabecera indica el progreso de scroll.
- **Búsqueda en Página:** Atajo `Ctrl + F` para buscar texto de forma rápida e intuitiva.
- **Temas Visuales:** Soporte para modo Claro (GitHub Light), Oscuro (VS Code / GitHub Dark) y Sepia (lectura prolongada).
- **Imprimir / Exportar a PDF:** `Ctrl + P` abre el diálogo nativo de impresión, con paginación real (A4, sin títulos/tablas/código partidos entre páginas). *Truco (Windows):* si no quieres que el PDF lleve el pie con la URL/hora que añade el propio diálogo (motor Chromium de WebView2), despliega "Más opciones" y desmarca "Encabezados y pies de página" — el navegador recuerda esa preferencia para las siguientes veces. En macOS/Linux el diálogo nativo es distinto (panel de impresión de macOS / GTK en Linux) y no se ha confirmado si añade el mismo pie.
- **Buscar actualizaciones:** Botón en el panel "Acerca de" — nunca se comprueba al arrancar (arranque instantáneo intacto). Si hay una versión nueva, se puede instalar en un clic sin salir de la app.

> 🧪 **¿Quieres ver todo esto en acción sin buscar tus propios archivos?** Abre cualquiera de los ficheros de [`testfiles/`](testfiles/) (`demo-funcionalidades_es.md` / `demo-funcionalidades_en.md`) — un único documento con resaltado de sintaxis en 8 lenguajes, un diagrama Mermaid, ecuaciones KaTeX y una tabla, pensado para probar o mostrar de un vistazo las funcionalidades del lector.

---

## 📁 Plantillas incluidas

El repositorio incluye una carpeta [`templates/`](templates/) con **20 plantillas Markdown listas para usar**, en español e inglés, agrupadas por categoría (Académico, Desarrollo de software, Gestión de proyectos, Reuniones y equipos, Personal — desde actas de reunión y seguimiento de TFG hasta un CV o un itinerario de viaje). Cópialas con otro nombre y ábrelas con **DBV Markdown Reader** en Modo Edición.

**[📋 Ver el índice completo de plantillas](templates/README.md)**

---

## ⌨️ Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Ctrl/Cmd + O` | Abrir archivo |
| `Ctrl/Cmd + F` | Buscar en el documento |
| `Ctrl/Cmd + K` | Quick Open — saltar a un archivo por nombre |
| `Ctrl/Cmd + E` | Alternar Modo Edición |
| `Ctrl/Cmd + S` | Guardar (en Modo Edición) |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Negrita / cursiva (con el cursor en el editor) |
| `Tab` / `Shift + Tab` | Indentar / desindentar la línea o selección (en el editor) |
| `Ctrl/Cmd + P` | Imprimir / exportar a PDF |
| `Ctrl/Cmd + +` / `-` / `0` | Acercar / alejar / restablecer zoom |
| `Alt + ←` / `Alt + →` | Atrás / adelante en el historial de navegación |
| `Inicio` / `Fin` | Ir al principio / final del documento (fuera de un campo de texto) |
| `Esc` | Cerrar el panel o modal abierto |

**Ratón:** doble clic sobre una palabra en el editor la selecciona (lista para `Ctrl/Cmd + B` / `I`); clic derecho sobre un diagrama Mermaid abre "mermaid.live"; clic derecho sobre un archivo/carpeta del árbol ofrece "Abrir en ventana nueva" / "Revelar en el Explorador".

> La lista completa, con la navegación por teclado de Quick Open y la búsqueda, está también en la ayuda integrada de la app (botón «?» en Modo Edición).

---

## 🧑‍💻 Para desarrolladores

Todo lo anterior es lo único que necesita un usuario normal. Lo siguiente solo aplica si quieres **modificar el código fuente o compilarlo tú mismo** — no hace falta para usar la aplicación.

### Requisitos

- **Rust:** `rustc 1.76+` y `cargo` ([rustup.rs](https://rustup.rs/))
- **Node.js:** `v18+` y `npm`
- **Build Tools para Windows:** C++ Build Tools (MSVC) de Visual Studio.

### Ejecutar en modo desarrollo

Usa los scripts incluidos en la raíz del proyecto:

**Windows:**
```cmd
start.cmd
```

**macOS / Linux:**
```bash
./start.sh
```

O ejecutando manualmente:
```bash
npm run dev
# o
cargo tauri dev
```

Para detenerlo: `stop.cmd` (Windows) o `./stop.sh` (macOS/Linux).

### Tests

```bash
npm test          # Tests unitarios (rápidos, sin red)
npm run test:all  # Incluye el test de integración que descarga un .md real (RF-08A)
```

### Publicar una nueva Release (con soporte de actualización, RF-13)

⚠️ **Checklist obligatorio.** Desde que existe el botón "Buscar actualizaciones", publicar una Release sin el paso 3 (`latest.json`) dejará la app funcionando pero ese botón nunca encontrará la versión nueva — es fácil de olvidar porque el build y el `git push` siguen funcionando igual sin él.

1. Sube de versión en `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json`, y mueve la sección `[Sin publicar]` de `dbv-specs-ops/CHANGELOG.md` a `[x.y.z] - fecha`.
2. Compila con las variables de firma en el entorno, para que también se genere el `.sig` de cada instalador:
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="<ruta a tu clave privada minisign>"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<password de esa clave>"
   npm run build
   ```
   `npm run build` compila y además renombra automáticamente el instalador (Tauri lo genera con el nombre completo de la app, con espacio) a `dbv-markdown-reader_x.y.z_x64-setup.exe`, sin espacios, listo para su URL de descarga.
3. **Genera `latest.json` automáticamente** (no se construye a mano, para no equivocarse ni olvidarlo):
   ```bash
   npm run release:manifest -- --notes "Resumen breve de esta versión"
   ```
   Escribe `latest.json` en la raíz del repo (no se commitea, ver `.gitignore`) leyendo la versión de `tauri.conf.json` y el `.sig` que generó el paso 2.
4. `git commit`, `git tag vx.y.z`, `git push origin master --tags`.
5. Crea la Release de GitHub subiendo **los tres archivos**: el instalador `dbv-markdown-reader_x.y.z_x64-setup.exe`, su `.sig`, y `latest.json`.

La clave privada de firma **no está en este repositorio** — la genera y custodia quien mantiene el proyecto (`npx tauri signer generate`). Perderla obliga a publicar una clave pública nueva y a que las instalaciones existentes se actualicen a mano una vez.

### Microsoft Store (canal MSIX, publicado)

Además del instalador NSIS de GitHub Releases, el proyecto publica un paquete MSIX en Microsoft Store: **[apps.microsoft.com/detail/9n7bmdzgcp0s](https://apps.microsoft.com/detail/9n7bmdzgcp0s)** (identidad de Partner Center configurada, sin necesidad de certificado de firma propio — la Store firma el paquete). Checklist completo de envío y actualización de este canal en [`dbv-specs-ops/docs/MICROSOFT_STORE.md`](./dbv-specs-ops/docs/MICROSOFT_STORE.md).

### Release de Linux (automática, vía CI)

A diferencia de Windows, el `.deb` y el `.AppImage` de Linux **no se compilan a mano**: `.github/workflows/release-linux.yml` los construye automáticamente.

- **Versión nueva (caso normal):** al hacer `git push --tags` de `vX.Y.Z`, el workflow se dispara solo y sube los artefactos como **borrador** de GitHub Release. Completa ese mismo borrador con los 3 ficheros de Windows (checklist de arriba) en vez de crear la Release desde cero, y pulsa **Publish** cuando ambas plataformas estén listas.
- **Añadir Linux a una versión que ya se publicó a mano (como pasó con la 0.7.0):** lánzalo manualmente desde la pestaña **Actions** de GitHub (`Release Linux` → `Run workflow`) con el input `draft` puesto a **`false`** — así se une a la Release ya publicada de esa versión en vez de buscar (y no encontrar) un borrador. Con `draft: true` sobre una Release ya publicada, el workflow falla a propósito en vez de arriesgarse a tocarla mal.

### Release de macOS (automática, vía CI)

Igual que Linux, el `.dmg` y el `.app` de macOS **no se compilan a mano**: `.github/workflows/release-macos.yml` los construye automáticamente en un runner `macos-latest`, sin firma ni notarización de Apple (mismo motivo que la compilación local — ver sección [🍎 macOS](#-macos)).

- Mismo comportamiento que `release-linux.yml`: se dispara solo en `git push --tags`, sube los artefactos como borrador (o se une a una Release ya publicada con `workflow_dispatch` + `draft: false`).
- El `.dmg` sin firmar generado aquí es también el artefacto publicado en [Uptodown](https://dbv-markdown-reader.uptodown.com/mac) (a diferencia de Microsoft Store o la Mac App Store, no exige firma de Apple) — la actualización de cada nueva versión en Uptodown es manual, vía su [panel de editores](https://support.uptodown.com/hc/es/articles/360053260491).

---

## 📂 Estructura del Proyecto

```
dbv-md-reader/
├── src-tauri/             # Código fuente Rust y configuración Tauri v2
│   ├── src/main.rs        # Punto de entrada Rust, CLI args y mando Tauri
│   ├── nsis/              # Imágenes de marca y hooks del instalador Windows (NSIS)
│   ├── tauri.conf.json    # Config base + tauri.windows/linux/macos.conf.json (fusión por plataforma)
│   └── Cargo.toml         # Dependencias Rust (tauri, notify, ureq, etc.)
├── .github/workflows/     # CI: release-linux.yml + release-macos.yml (build por tag)
├── src/                   # Interfaz de usuario Web (HTML/CSS/JS)
│   ├── index.html         # Maquetación principal y sidebar TOC
│   ├── app.js             # Lógica de renderizado (markdown-it, mermaid, Prism)
│   └── styles.css         # Estilos y tokens de color
├── dbv-specs-ops/         # Especificaciones SDD y marco de ingeniería
│   ├── project.config.md  # Identidad del proyecto y cabeceras
│   ├── docs/              # SPECIFICATIONS, ARCHITECTURE, DESIGN
│   ├── task.md            # Backlog y snapshot de estado
│   ├── memory.md          # Decisiones de arquitectura (ADRs)
│   └── CHANGELOG.md       # Historial de versiones
├── CLAUDE.md              # Activación para Claude Code
├── GEMINI.md              # Activación para Gemini CLI
├── ANTIGRAVITY.md         # Referencia para Antigravity (VS Code)
├── start.cmd / stop.cmd   # Scripts de ejecución en Windows
├── start.sh / stop.sh     # Scripts de ejecución en Linux/macOS
├── LICENSE                # Licencia MIT
└── README.md              # Este archivo
```

---

## 📋 Changelog

Consulta [dbv-specs-ops/CHANGELOG.md](./dbv-specs-ops/CHANGELOG.md) para ver el historial de cambios.

---

## 🤝 Contribuir

¿Quieres proponer un cambio o corregir un bug? Se acepta vía fork + Pull Request contra `master` (rama protegida). Guía completa, requisitos de entorno y checklist antes de abrir el PR en [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 🔷 Curiosidad: candidato natural a Microsoft PowerToys

> Dato anecdótico, no una afirmación de afiliación: **DBV Markdown Reader no forma parte de Microsoft PowerToys ni está respaldado por Microsoft.**

El issue [PowerToys #45267](https://github.com/microsoft/PowerToys/issues/45267) pide un "Markdown Reader" ligero, de solo lectura, con TOC, búsqueda y soporte de Mermaid — como alternativa a abrir un IDE completo solo para leer documentación. Sin buscarlo a propósito, dbv-md-reader ya cumple la mayoría de esos requisitos:

| Requisito de PowerToys #45267 | Estado en dbv-md-reader |
| --- | --- |
| Visor persistente y de solo lectura | ✅ |
| Tabla de Contenidos clicable | ✅ |
| Sección activa resaltada al hacer scroll | ✅ |
| Zoom | ✅ |
| Búsqueda `Ctrl+F` | ✅ |
| GitHub Flavored Markdown (tablas, tachado, task lists, notas al pie, autolinks, HTML) | ✅ |
| Diagramas Mermaid | ✅ |
| Múltiples ventanas independientes | ✅ |
| Integración con el Explorador de Windows (asociación `.md`, menú contextual) | ✅ |
| WebView2 | ✅ |
| Arquitectura ligera (ver [benchmark](#-rendimiento--medido-no-solo-afirmado)) | ✅ |
| Always on Top | ✅ |
| Snap Layouts de Windows | ✅ |
| PowerToys Run | ❌ no implementado |
| Mica (backdrop translúcido de Windows 11) | ❌ evaluado y aparcado por ahora |
| WinUI 3 / Markdig | No usado — arquitectura propia (Rust + Tauri v2 + `markdown-it`), no es una limitación funcional |

Las diferencias de arquitectura (Tauri en vez de WinUI 3, `markdown-it` en vez de Markdig) no son carencias — son otra forma válida de resolver el mismo problema, ya con una implementación real y funcionando.

---

## 📄 Licencia

Licencia [MIT](./LICENSE).

Copyright (c) 2026 David Bueno Vallejo

---

## ✍️ Autor y Créditos

### 👤 David Bueno Vallejo

> Idea original, arquitectura, dirección del proyecto y pruebas en equipos reales.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-davidbueno-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/davidbueno/)
[![Website](https://img.shields.io/badge/Web-davidbuenov.com-6366f1?logo=googlechrome&logoColor=white)](https://davidbuenov.com)
[![GitHub](https://img.shields.io/badge/GitHub-davidbuenov-181717?logo=github&logoColor=white)](https://github.com/davidbuenov)

### 🙏 Agradecimientos

Gracias a quienes han colaborado probando la aplicación, encontrando errores y proponiendo mejoras:

- José M. Alarcón Aguín
- Victor Estival
- Julio Lorca
- Juan Ignacio Caballero — propuso la idea del Explorador de árbol de directorios (RF-25/v0.13.0) en el [Issue #5](https://github.com/davidbuenov/dbv-md-reader/issues/5).
- Jacinto Parga — corrigió la asociación de archivos `.md` en Linux en el [PR #9](https://github.com/davidbuenov/dbv-md-reader/pull/9).

### 💡 Inspiración

El modo de edición ligera (v0.11.0, RF-20/RF-21) se inspira en el enfoque minimalista del modo edición de [**READU.md**](https://github.com/breezy89757/READU.md) (WinUI 3, código abierto) — un `<textarea>` plano reutilizando el pipeline de renderizado ya existente en vez de un componente de editor de código completo. La implementación de `dbv-md-reader` es propia y completamente distinta (stack Rust/Tauri/JS, gestión de conflictos con archivo externo), pero el crédito de la idea original corresponde a su autor.

### 🤖 Construido con IA

| Herramienta | Rol |
| --- | --- |
| **[Claude Code](https://claude.com/claude-code)** · *Anthropic* | Pair programming completo: arquitectura Rust/Tauri, instalador NSIS (asociación `.md`, instancia única), comprobación de actualizaciones firmadas, revisión de seguridad y ciclo `/ship` de principio a fin. |

> 🛠️ Desarrollado con el framework **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — Spec-Driven Development, libre y gratuito.
