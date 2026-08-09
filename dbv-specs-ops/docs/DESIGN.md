# 🎨 Sistema de Diseño Visual: dbv-md-reader

> **Proyecto:** dbv-md-reader  
> **Fase:** `/spec` / `/plan`  
> **Filosofía:** Experiencia de lectura ultra-despejada, rápida y elegante.  

---

## 1. Paleta de Colores y Temas (Color Tokens)

`dbv-md-reader` soporta 3 temas de lectura optimizados:

### ☀️ Tema Claro (GitHub Light Style)
- **Background (`--bg-primary`):** `#ffffff`
- **Surface / Sidebar (`--bg-secondary`):** `#f6f8fa`
- **Text Main (`--text-primary`):** `#24292e`
- **Text Muted (`--text-secondary`):** `#57606a`
- **Accent / Links (`--accent`):** `#0969da`
- **Code Block Background (`--code-bg`):** `#f6f8fa`
- **Border (`--border-color`):** `#d0d7de`

### 🌙 Tema Oscuro (VS Code / GitHub Dark Style)
- **Background (`--bg-primary`):** `#0d1117`
- **Surface / Sidebar (`--bg-secondary`):** `#161b22`
- **Text Main (`--text-primary`):** `#c9d1d9`
- **Text Muted (`--text-secondary`):** `#8b949e`
- **Accent / Links (`--accent`):** `#58a6ff`
- **Code Block Background (`--code-bg`):** `#161b22`
- **Border (`--border-color`):** `#30363d`

### 📜 Tema Sepia (Lectura Prolongada)
- **Background (`--bg-primary`):** `#fbf0d9`
- **Surface / Sidebar (`--bg-secondary`):** `#f3e4c4`
- **Text Main (`--text-primary`):** `#433422`
- **Text Muted (`--text-secondary`):** `#766147`
- **Accent / Links (`--accent`):** `#8f5829`
- **Code Block Background (`--code-bg`):** `#f3e4c4`
- **Border (`--border-color`):** `#e4d0aa`

---

## 2. Tipografía y Jerarquía

- **Font Family Body:**  
  `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Font Family Code:**  
  `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`
- **Tamaño de Fuente Base:** `16px` (escalable con `Ctrl + +` / `Ctrl + -`)
- **Line Height:** `1.6` (optimizado para legibilidad)
- **Ancho Máximo del Documento:** `900px` centrado horizontalmente.

---

## 3. Componentes UX

### ⬅️ ➡️ Barra de Navegación e Historial (Cursos y Documentación Modular)
- Botones discretos `←` (Atrás) y `→` (Adelante) en la esquina superior izquierda de la barra superior.
- Muestra de forma tenue el nombre del documento actual o miga de pan (`curso/modulo1/leccion2.md`).
- Atajos globales de teclado: `Alt + Left Arrow` (Volver al tema/lección anterior) y `Alt + Right Arrow` (Avanzar en el historial).

### 📍 Tabla de Contenidos (TOC) Sidebar
- Posicionamiento: Lateral izquierda/derecha colapsable.
- Indentación jerárquica: `H1` (bold), `H2` (indent `12px`), `H3` (indent `24px`).
- Smooth scrolling al hacer clic sobre cualquier encabezado del TOC.

### 🔍 Modal de Búsqueda (`Ctrl + F`)
- Input flotante centrado superior con contador de coincidencias (`3 / 12`).
- Resaltado de coincidencias en amarillo suave.
- Navegación con `Enter` (siguiente) y `Shift + Enter` (anterior), `Esc` (cerrar).

### 🔘 Selector de Temas
- Discreto botón de icono en la esquina superior derecha o barra superior que conmuta entre Claro, Oscuro y Sepia.
