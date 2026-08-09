# dbv-md-reader

> Lector nativo de Markdown (`.md`) de solo lectura ultra-ligero, seguro y veloz para Windows basado en Rust y Tauri v2.

---

## 📑 Índice

- [Sobre el proyecto](#sobre-el-proyecto)
- [Características Principales](#características-principales)
- [Requisitos](#requisitos)
- [Cómo ejecutar en Desarrollo](#cómo-ejecutar-en-desarrollo)
- [Cómo parar](#cómo-parar)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Changelog](#changelog)
- [Licencia](#licencia)

---

## 📌 Sobre el proyecto

**dbv-md-reader** es una aplicación nativa para Windows diseñada exclusivamente para la **lectura de archivos Markdown (`.md`)**. Ofrece una apertura instantánea (< 200 ms), un ejecutable ligero (< 20 MB) y un consumo de memoria RAM inferior a 64 MB.

Sustituye la pesadez de visores basados en Electron o IDEs pesados por un ejecutable nativo liviano con protección anti-XSS mediante **DOMPurify** sobre el HTML ya renderizado.

**Construido con:**
- **Core / Backend:** Rust + Tauri v2 (utiliza el motor WebView2 nativo de Windows).
- **Seguridad:** DOMPurify (JS) sanitiza el HTML renderizado contra ataques XSS.
- **Auto-Reload & Remotos:** `notify` (observador de archivos) y `ureq` (cliente HTTP para `.md` remotos) en Rust.
- **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript (Vanilla).
- **Renderizado:** `markdown-it` (CommonMark), `Prism.js` (Syntax Highlighting) y `mermaid.js` (Diagramas vectoriales SVG).

---

## ✨ Características Principales

- **Apertura CLI / Doble Clic:** Abre directamente cualquier archivo `.md` desde la línea de comandos o asociándolo en *"Abrir con..."* (ej. `dbv-md-reader.exe C:\notas\readme.md`).
- **Archivos Recientes:** Panel con los últimos documentos abiertos explícitamente, para no tener que volver a buscarlos.
- **Auto-Reload:** La vista se recarga sola (conservando el scroll) cuando el archivo abierto se edita y guarda desde otra aplicación.
- **Renderizado Híbrido:** Soporta Markdown estándar, HTML seguro incrustado, imágenes locales y diagramas Mermaid.
- **Documentos remotos:** Abre y navega enlaces a `.md` alojados en una URL (`http(s)://`), además de los locales.
- **Seguridad Estricta:** Sanitización de etiquetas y atributos peligrosos (DOMPurify) antes de insertarse en el WebView2.
- **Navegación e Índice:** Tabla de Contenidos (TOC) flotante/lateral generada automáticamente a partir de los encabezados.
- **Búsqueda en Página:** Atajo `Ctrl + F` para buscar texto de forma rápida e intuitiva.
- **Temas Visuales:** Soporte para modo Claro (GitHub Light), Oscuro (VS Code / GitHub Dark) y Sepia (lectura prolongada).

---

## 🧰 Requisitos

Para compilar o desarrollar el proyecto localmente:

- **Rust:** `rustc 1.76+` y `cargo` ([rustup.rs](https://rustup.rs/))
- **Node.js:** `v18+` y `npm`
- **Build Tools para Windows:** C++ Build Tools (MSVC) de Visual Studio.

---

## ▶️ Cómo ejecutar en Desarrollo

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

---

## ⏹ Cómo parar

**Windows:**
```cmd
stop.cmd
```

**macOS / Linux:**
```bash
./stop.sh
```

---

## 📂 Estructura del Proyecto

```
dbv-md-reader/
├── src-tauri/             # Código fuente Rust y configuración Tauri v2
│   ├── src/main.rs        # Punto de entrada Rust, CLI args y mando Tauri
│   └── Cargo.toml         # Dependencias Rust (tauri, notify, ureq, etc.)
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

> 🛠️ Desarrollado con el framework **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — Spec-Driven Development.  
> Creado por [David Bueno Vallejo](https://github.com/davidbuenov) — libre y gratuito.
