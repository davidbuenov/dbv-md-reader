# Ficha de Uptodown — Español

> Adaptado de `descripcionStore_es.md` (Microsoft Store) para el formulario real de la **Developers Console de Uptodown** (Apps → Add new app). Los nombres de campo y límites de caracteres son los que indica su ayuda oficial ("How to publish an app on Uptodown"). A diferencia de la Store, Uptodown solo admite **Windows y Mac** como plataforma de la propia ficha (campo *Operating System*) — **Linux no es una plataforma soportada en Uptodown**, así que el `.deb`/`.AppImage` no se suben aquí; se menciona en el texto como enlace a GitHub Releases, no como archivo adjunto.
>
> **Qué archivo subir en *Select File*:** para esta ficha, `DBV.Markdown.Reader.0.7.0_universal.dmg` (macOS, Intel + Apple Silicon), descargado de la Release `v0.7.0` en GitHub. Si más adelante se publica también en Uptodown la versión Windows, se repite el mismo formulario con `dbv-markdown-reader_0.7.0_x64-setup.exe` y **Operating System: Windows** — el texto de descripción de abajo sirve para ambas fichas tal cual, ya está redactado para las tres plataformas.

---

## Name

DBV Markdown Reader

## Operating System

Mac *(macOS, .dmg universal Intel + Apple Silicon — sin firma de Apple)*

## Short description
*(máx. 70 caracteres)*

Lector Markdown rápido y local: Windows, Mac y Linux. Sin publicidad.

*(69 caracteres)*

## Full body text description
*(mín. 50 palabras)*

DBV Markdown Reader es un lector y editor nativo de archivos Markdown (.md): ligero, rápido y 100% local — sin cuentas, sin publicidad, sin telemetría. Abre cualquier documento .md al instante (menos de 200 ms), sin necesidad de un editor de código ni un IDE pesado. Ocupa apenas unos pocos megabytes de memoria — cientos de veces menos que las alternativas basadas en Electron.

**Disponible para Windows, macOS y Linux:**
• **Windows 10/11:** Microsoft Store (recomendado, con auto-actualización) o instalador `.exe` desde GitHub Releases.
• **macOS (Intel y Apple Silicon):** este mismo paquete `.dmg` universal — sin firma de Apple, así que macOS avisará la primera vez ("desarrollador no verificado"); clic derecho → Abrir, o `xattr -cr` desde Terminal.
• **Linux (.deb / .AppImage):** descarga directa desde GitHub Releases del proyecto (Uptodown no distribuye todavía la versión Linux).

Ideal para leer documentación técnica, notas, README de proyectos de GitHub, apuntes de estudio o cualquier colección de archivos Markdown interconectados.

**Características principales:**
• Apertura instantánea por doble clic o "Abrir con..."
• Auto-recarga en vivo cuando editas el archivo desde otro programa, sin perder el scroll
• Diagramas Mermaid renderizados como SVG interactivo, con opción de abrirlos en mermaid.live
• Ecuaciones matemáticas en LaTeX (inline y en bloque), renderizadas con KaTeX
• Resaltado de sintaxis de código con botón de copiar
• Tabla de contenidos automática y búsqueda de texto instantánea (Ctrl+F)
• Tres temas de lectura: Claro, Oscuro y Sepia
• Navegación entre documentos enlazados con historial (Atrás/Adelante)
• Abre también documentos Markdown remotos por URL
• Exportación/impresión a PDF con paginación cuidada (sin cortar tablas, código ni diagramas)
• Interfaz disponible en español e inglés
• 100% seguro: el HTML embebido se sanitiza automáticamente antes de mostrarse

Sin conexión a internet requerida para funcionar, sin recopilación de datos personales. Tus documentos nunca salen de tu equipo. Código abierto bajo licencia MIT.

---

## Novedades de esta versión (v0.7.0)
*(campo de changelog por versión)*

Ecuaciones matemáticas en LaTeX (KaTeX) y paginación real de impresión/exportación a PDF. Distribución ampliada: instalador de Windows sin cambios, más el `.deb`/`.AppImage` de Linux (generados automáticamente en cada versión) y este `.dmg` universal de macOS (Intel + Apple Silicon), sin firma de Apple.

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

- markdown
- lector markdown
- visor md
- documentación técnica
- readme github
- notas markdown
- diagramas mermaid

### Icono a subir

`src-tauri/icons/icon.png` (512×512, PNG, cuadrado) — cumple el mínimo de 256×256 que exige Uptodown.
