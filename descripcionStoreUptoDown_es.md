# Ficha de Uptodown — Español

> Adaptado de `descripcionStore_es.md` (Microsoft Store) para el formulario real de la **Developers Console de Uptodown** (Apps → Add new app). Los nombres de campo y límites de caracteres son los que indica su ayuda oficial ("How to publish an app on Uptodown"). A diferencia de la Store, Uptodown solo admite **Windows y Mac** como plataforma de la propia ficha (campo *Operating System*) — **Linux no es una plataforma soportada en Uptodown**, así que el `.deb`/`.AppImage` no se suben aquí; se menciona en el texto como enlace a GitHub Releases, no como archivo adjunto.
>
> **Ficha centrada en Mac** (esta es la plataforma que Uptodown tiene publicada, en revisión desde `v0.7.0`): el texto ya no reparte el protagonismo a partes iguales entre Windows/macOS/Linux — describe primero la experiencia nativa en Mac (menú de aplicación, atajos ⌘) y menciona el resto de plataformas al final, como nota breve. Si más adelante se publica también la ficha de Windows en Uptodown, hay que reescribir el cuerpo con el mismo criterio pero centrado en Windows, no reutilizar este texto tal cual.
>
> **Qué archivo subir en *Select File*:** `DBV.Markdown.Reader_0.12.0_universal.dmg` (macOS, Intel + Apple Silicon, sin firma de Apple), descargado de la Release `v0.12.0` en GitHub — verificado con `gh release view v0.12.0` que ese es el nombre real del asset (el `.7.0` de una nota anterior de este fichero llevaba un punto antes de la versión; el nombre real usa guion bajo: `_0.12.0_`).

---

## Name

DBV Markdown Reader

## Operating System

Mac *(macOS, .dmg universal Intel + Apple Silicon — sin firma de Apple)*

## Short description
*(máx. 70 caracteres)*

Lector y editor de Markdown para Mac: rápido, ligero y 100% local.

*(66 caracteres)*

## Full body text description
*(mín. 50 palabras)*

DBV Markdown Reader es un lector y editor nativo de archivos Markdown (.md) para Mac, con soporte universal para Intel y Apple Silicon: ligero, rápido y 100% local — sin cuentas, sin publicidad, sin telemetría. Abre cualquier documento .md al instante (menos de 200 ms), sin necesidad de un editor de código ni un IDE pesado. Ocupa apenas unos pocos megabytes de memoria — cientos de veces menos que las alternativas basadas en Electron.

Incluye un menú nativo de aplicación (App/Archivo/Edición/Ver/Ventana/Ayuda) con atajos ⌘, como cualquier app pensada de verdad para Mac, no un simple port de Windows.

Si necesitas editar, su Modo Edición (⌘E) muestra una vista dividida en vivo con el Markdown en crudo a un lado y la previsualización renderizada al otro, con una barra de formato con 16 acciones (negrita, listas, tablas, enlaces...) y gestión inteligente de conflictos si el archivo cambia desde otro programa mientras editas.

Ideal para leer y editar documentación técnica, notas, README de proyectos de GitHub, apuntes de estudio o cualquier colección de archivos Markdown interconectados.

**Características principales:**
• Apertura instantánea por doble clic o "Abrir con..."
• Menú nativo de macOS con atajos ⌘ (⌘O abrir, ⌘S guardar, ⌘E Modo Edición, ⌘P imprimir, ⌘F buscar)
• Modo Edición con vista dividida en vivo, barra de formato Markdown y Tab/Shift+Tab para indentar listas
• Gestión de conflictos si el archivo cambia desde otro programa mientras editas
• Auto-recarga en vivo cuando editas el archivo desde otro programa, sin perder el scroll
• Diagramas Mermaid renderizados como SVG interactivo, con opción de abrirlos en mermaid.live
• Ecuaciones matemáticas en LaTeX (inline y en bloque), renderizadas con KaTeX
• Resaltado de sintaxis de código en más de 24 lenguajes, con botón de copiar
• Listas de tareas y notas al pie (GFM)
• Tabla de contenidos automática con la sección activa resaltada, y búsqueda de texto instantánea
• Tres temas de lectura: Claro, Oscuro y Sepia
• Navegación entre documentos enlazados con historial (Atrás/Adelante) y apertura de documentos remotos por URL
• Exportación/impresión a PDF con paginación cuidada (sin cortar tablas, código ni diagramas)
• Interfaz disponible en español e inglés
• 100% seguro: el HTML embebido se sanitiza automáticamente antes de mostrarse

Sin conexión a internet requerida para funcionar, sin recopilación de datos personales. Tus documentos nunca salen de tu equipo. Código abierto bajo licencia MIT.

**Nota sobre la firma:** este `.dmg` universal no está firmado por Apple (fuera del programa de pago de Apple Developer), así que macOS avisará la primera vez que lo abras ("no se puede verificar el desarrollador"). Solución: clic derecho sobre la app → Abrir, o `xattr -cr /Applications/DBV\ Markdown\ Reader.app` desde Terminal.

**También disponible para Windows** (Microsoft Store, con auto-actualización, o instalador `.exe` desde GitHub Releases) **y Linux** (`.deb`/`.AppImage` desde GitHub Releases) — ver https://davidbuenov.github.io/dbv-md-reader/.

---

## Novedades de esta versión (v0.12.0)
*(campo de changelog por versión)*

Modo Edición completo (⌘E): vista dividida en vivo, paneles redimensionables, sincronización de scroll, barra de formato Markdown (16 acciones) con Tab/Shift+Tab para indentar listas, gestión de conflictos si el archivo cambia desde otro programa mientras editas, y una chuleta de ayuda de sintaxis integrada. Nuevo menú nativo de macOS (App/Archivo/Edición/Ver/Ventana/Ayuda) con atajos ⌘, incluido el permiso de impresión que exige WKWebView. Además: listas de tareas y notas al pie (GFM), resaltado de sintaxis en más de 24 lenguajes con colores adaptados a cada tema.

---

## Información adicional

**Web oficial:** https://davidbuenov.github.io/dbv-md-reader/
**Categoría / Directorio sugerido:** Productividad / Utilidades
**Nacionalidad:** España
**Autor:** David Bueno Vallejo

### Licencia y distribución

- **Distribution Model:** Free
- **License Type:** MIT
- **License Text URL:** https://github.com/davidbuenov/dbv-md-reader/blob/master/LICENSE
- **Source Code URL:** https://github.com/davidbuenov/dbv-md-reader

### Palabras clave
*(referencia para SEO/ASO, Uptodown no tiene un campo idéntico al de Partner Center)*

- markdown mac
- editor markdown mac
- lector markdown
- documentación técnica
- readme github
- notas markdown
- diagramas mermaid

### Icono a subir

`src-tauri/icons/icon.png` (512×512, PNG, cuadrado) — cumple el mínimo de 256×256 que exige Uptodown.
