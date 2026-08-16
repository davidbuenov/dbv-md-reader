# DBV Markdown Reader

[![Release](https://img.shields.io/github/v/release/davidbuenov/dbv-md-reader?display_name=tag&sort=semver)](https://github.com/davidbuenov/dbv-md-reader/releases)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-disponible-0078D4?logo=microsoft&logoColor=white)](https://apps.microsoft.com/detail/9n7bmdzgcp0s)
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

> Lector nativo de Markdown (`.md`) de solo lectura ultra-ligero, seguro y veloz para Windows basado en Rust y Tauri v2.

**[🌐 Ver la web del proyecto](https://davidbuenov.github.io/dbv-md-reader/)**

<a href="https://www.producthunt.com/products/dbv-markdown-reader?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-dbv-markdown-reader" target="_blank" rel="noopener noreferrer"><img alt="DBV Markdown Reader - Ultra-fast, native Markdown reader for Windows, Linux &amp; Mac | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1223973&amp;theme=light&amp;t=1786861415426"></a>

---

## 🚀 Descárgalo e instálalo

**No necesitas instalar Rust, Node.js, ni ninguna herramienta de programación.** El instalador de **DBV Markdown Reader** trae todo lo necesario —incluido el motor de renderizado de Windows (WebView2)— y asocia los archivos `.md` contigo automáticamente.

### 🏬 Microsoft Store (recomendado en Windows 11)

**[🛒 Consíguelo en Microsoft Store](https://apps.microsoft.com/detail/9n7bmdzgcp0s)**

Es la vía preferente para Windows 11: el paquete lo firma la propia Store (sin el aviso de SmartScreen del `.exe`), se instala con un clic y se actualiza solo. Si prefieres no usar la Store, o vas en Windows 10, usa el instalador `.exe` de abajo.

### 1️⃣ Descarga (instalador `.exe`)

**[⬇️ Ver todas las versiones (Releases)](https://github.com/davidbuenov/dbv-md-reader/releases)**

Descarga el instalador de la última versión: `dbv-markdown-reader_x.y.z_x64-setup.exe`.

El navegador puede avisar de que el archivo "no se descarga habitualmente" o "no es de confianza" (SmartScreen de Microsoft Edge/Chrome). Es normal en instaladores nuevos y sin firma comercial: en Edge, abre el panel de descargas y pulsa **Mostrar más → Mantener** (o **Conservar de todos modos**).

### 2️⃣ Instala

Haz doble clic sobre el instalador descargado. No requiere permisos de administrador (se instala solo para tu usuario) ni conexión a internet durante la instalación —el WebView2 necesario ya viaja incluido—. Windows puede mostrar también un aviso de "Editor no reconocido" al ejecutarlo — pulsa **Más información → Ejecutar de todas formas**.

Antes de copiar los archivos, el instalador muestra una pantalla con dos casillas independientes (ambas marcadas por defecto, pero desmarcables):

1. **Menú contextual**: que **DBV Markdown Reader** aparezca como opción al pulsar con el botón derecho sobre un `.md` → **Abrir con...**.
2. **Aplicación predeterminada**: que además sea la aplicación que abre los `.md` al hacer doble clic.

Puedes cambiar esta configuración cuando quieras desde **Configuración → Aplicaciones → Aplicaciones predeterminadas** de Windows.

> Si ya tenías instalada una versión anterior con la pantalla de asociación de `.md` distinta (o sin ella) y el menú "Abrir con" te sigue mostrando una entrada duplicada o con el icono antiguo, desinstala primero la versión anterior desde "Aplicaciones instaladas" de Windows y luego instala la nueva — versiones previas usaban un identificador interno distinto que el desinstalador no limpia automáticamente entre versiones.

### 3️⃣ Actualiza

A partir de aquí ya no necesitas volver a esta página para cada versión nueva. Abre el panel **Acerca de** (icono ⓘ de la barra superior) y pulsa **Buscar actualizaciones**. La comprobación es siempre bajo demanda — nunca se ejecuta sola al arrancar, para no afectar al arranque instantáneo.

- Si ya tienes la última versión: **"Ya tienes la última versión."**
- Si hay una nueva: **"Nueva versión X.Y.Z disponible."** y el botón cambia a **Actualizar** — un clic descarga, instala y reinicia la app por ti, sin salir de **DBV Markdown Reader** ni pasar por el navegador ni por Releases.

---

## 🐧 Linux

**[⬇️ Descarga el `.deb` o el `.AppImage` desde Releases](https://github.com/davidbuenov/dbv-md-reader/releases)** — se generan automáticamente en cada versión.

- **`.deb` (Debian, Ubuntu, Linux Mint y derivadas):** `sudo dpkg -i dbv-md-reader_x.y.z_amd64.deb` (o doble clic desde el gestor de archivos). Es la opción recomendada — instala la app en el sistema y registra la asociación con `.md`.
- **`.AppImage` (cualquier distribución):** dale permisos de ejecución (`chmod +x dbv-md-reader_x.y.z_amd64.AppImage`) y ejecútalo directamente. Es portátil (no requiere instalación), pero **no** se asocia automáticamente con archivos `.md` — para eso hace falta una herramienta adicional como [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

> **Nota:** el canal de Linux todavía no tiene comprobación de actualizaciones integrada (botón "Buscar actualizaciones" del panel "Acerca de") — descarga la versión nueva desde Releases cuando quieras actualizar.

---

## 🍎 macOS

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

## 📑 Índice

- [Descárgalo e instálalo](#-descárgalo-e-instálalo)
- [Linux](#-linux)
- [macOS](#-macos)
- [Sobre el proyecto](#sobre-el-proyecto)
- [Características Principales](#características-principales)
- [Para desarrolladores](#-para-desarrolladores)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Changelog](#changelog)
- [Licencia](#licencia)
- [Autor y Créditos](#autor-y-créditos)

---

## 📌 Sobre el proyecto

**DBV Markdown Reader** es una aplicación nativa diseñada exclusivamente para la **lectura de archivos Markdown (`.md`)** — con Release oficial para Windows y Linux, y compilación local para macOS. Ofrece una apertura instantánea (< 200 ms), un ejecutable ligero (< 20 MB) y un consumo de memoria RAM inferior a 64 MB.

Sustituye la pesadez de visores basados en Electron o IDEs pesados por un ejecutable nativo liviano con protección anti-XSS mediante **DOMPurify** sobre el HTML ya renderizado.

### 📊 Comparativa real de memoria

Los mismos 2 archivos `.md` abiertos a la vez en Visual Studio Code, Notepad++ y `dbv-md-reader` — memoria según el Administrador de Tareas de Windows:

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

- **Apertura CLI / Doble Clic:** Abre directamente cualquier archivo `.md` desde la línea de comandos o asociándolo en *"Abrir con..."* (ej. `dbv-md-reader.exe C:\notas\readme.md`).
- **Instancia única:** abrir varios `.md` desde el Explorador de Windows no multiplica procesos — todas las ventanas viven bajo un único proceso (visible en el Administrador de Tareas), cada una con su propio documento, zoom y búsqueda.
- **Archivos Recientes:** Panel con los últimos documentos abiertos explícitamente, para no tener que volver a buscarlos.
- **Auto-Reload:** La vista se recarga sola (conservando el scroll) cuando el archivo abierto se edita y guarda desde otra aplicación.
- **Renderizado Híbrido:** Soporta Markdown estándar, HTML seguro incrustado, imágenes locales y diagramas Mermaid. Botón derecho sobre un diagrama Mermaid → "Abrir en mermaid.live" para inspeccionarlo con zoom libre.
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
- El `.dmg` sin firmar generado aquí es también el artefacto pensado para publicarse en [Uptodown](https://uptodown.com/) (a diferencia de Microsoft Store o la Mac App Store, no exige firma de Apple) — la subida a Uptodown en sí es manual, vía su [panel de editores](https://support.uptodown.com/hc/es/articles/360053260491).

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

### 🤖 Construido con IA

| Herramienta | Rol |
| --- | --- |
| **[Claude Code](https://claude.com/claude-code)** · *Anthropic* | Pair programming completo: arquitectura Rust/Tauri, instalador NSIS (asociación `.md`, instancia única), comprobación de actualizaciones firmadas, revisión de seguridad y ciclo `/ship` de principio a fin. |

> 🛠️ Desarrollado con el framework **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — Spec-Driven Development, libre y gratuito.
