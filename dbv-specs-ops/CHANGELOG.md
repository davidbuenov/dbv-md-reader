# 📝 Changelog: dbv-md-reader

Todas las notas de cambios relevantes de este proyecto se documentarán en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [0.2.0] - 2026-08-09

### Añadido
- **RF-12 "Acerca de"**: panel modal con nombre, versión (sincronizada con `Cargo.toml` vía comando Rust), enlaces a `davidbuenov.com` y `github.com/davidbuenov`, y licencia.
- **RF-11 Archivos Recientes**: botón "Recientes" en la barra superior con panel desplegable (últimos 10 documentos abiertos explícitamente, persistidos en `recent_files.json`), acceso rápido desde la pantalla "Sin archivo abierto" y botón "Limpiar historial". Comandos Rust `get_recent_files` / `add_recent_file` / `clear_recent_files`.
- **RF-06 Auto-Reload**: observador de archivos en Rust (`notify`, comando `watch_file`) que vigila el directorio padre del documento activo y recarga la vista en caliente cuando se guarda desde otra aplicación, preservando la posición del scroll.
- **RF-08A Documentos Markdown remotos**: `read_file` descarga y renderiza `.md` remotos (`http(s)://`) mediante `ureq`; `resolve_relative_path` resuelve enlaces e imágenes relativos a una base remota.

### Corregido
- **RF-07 Imágenes locales**: las rutas de imagen relativas y absolutas dentro de un documento Markdown no cargaban en el WebView2 (política de origen cruzado). Ahora se resuelven y se sirven vía el protocolo de activos de Tauri (`asset://` + `convertFileSrc`).
- **RF-03 Sanitización HTML**: el HTML embebido en los documentos (incluyendo `<script>` y atributos `on*`) se renderizaba sin ningún filtrado — riesgo de XSS. Ahora se sanitiza con DOMPurify tras el renderizado de `markdown-it`, sin afectar al resaltado de código ni a las anclas de navegación.

### Cambiado
- El NFR de tamaño del instalador se relaja de <8 MB a <20 MB (decisión consciente del usuario) para poder completar RF-03/06/08A sin recortar funcionalidad. Build release actual: ~14.5 MB.

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
