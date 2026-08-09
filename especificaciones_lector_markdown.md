# 📑 Documento de Especificaciones Técnicas (PRD)
## Proyecto: MD-Reader-Native (Lector de Markdown de Solo Lectura)

### 1. Objetivo del Proyecto y Filosofía
* **Propósito:** Crear una aplicación nativa para Windows enfocada exclusivamente en la **lectura de archivos Markdown (`.md`)**. No incluye funciones de edición, gestión de carpetas complejas ni bases de datos de notas.
* **Filosofía Open-Source:** El proyecto se alojará en GitHub como una utilidad pública, libre y gratuita para la comunidad.
* **Propuesta de Valor:** 
  * **Velocidad:** Apertura instantánea al hacer doble clic sobre un archivo local.
  * **Ligereza:** Consumo mínimo de memoria RAM y un tamaño de instalador inferior a 10 MB (alternativa real a visores basados en Electron).
  * **Integración:** Reemplazo directo del Bloc de Notas de Windows para extensiones `.md`.

---

### 2. Stack Tecnológico Seleccionado (Estrategia A)

El proyecto utiliza una arquitectura híbrida moderna para garantizar el máximo rendimiento del sistema operativo combinado con la madurez del ecosistema web para el renderizado de documentos.

* **Core / Backend:** **Rust**
  * Gestiona el ciclo de vida de la aplicación, el acceso al sistema de archivos del sistema operativo (OS) y los argumentos de la línea de comandos (CLI) para la apertura de archivos por defecto.
* **Framework de Ventanas y Puente:** **Tauri v2**
  * Elimina la necesidad de empaquetar Chromium (como en Electron). Utiliza el motor de renderizado nativo de Windows (**WebView2 / Edge**), asegurando un ejecutable final ultra-pequeño.
* **Seguridad en Rust:** **Ammonia crate**
  * Librería de Rust encargada de sanitizar el código HTML integrado dentro del Markdown para prevenir ataques de ejecución de scripts (XSS) antes de enviarlo a la vista.
* **Frontend (Renderizado e Interfaz):** **HTML5, CSS3 (Tailwind CSS) y JavaScript (Vanilla o Svelte ligero)**
  * Encargado puramente de pintar la interfaz de lectura y aplicar los temas visuales.
* **Parser de Markdown:** **markdown-it** (JavaScript)
  * Elegido por su alta velocidad, modularidad y soporte estricto de la especificación CommonMark, además de admitir extensiones para HTML integrado.
* **Renderizador de Diagramas:** **mermaid.js** (JavaScript)
  * La librería oficial para garantizar compatibilidad total con diagramas de flujo, secuencia, Gantt y arquitecturas incrustados en los bloques de código de los archivos `.md`.

---

### 3. Requisitos Funcionales (MVP)

#### RF-01: Apertura mediante Argumento de Línea de Comandos
* La aplicación debe aceptar una ruta de archivo como argumento al iniciarse (ej. `md-reader.exe C:\notas\readme.md`). Esto permite asociar el programa como el visor predeterminado en Windows mediante el menú *"Abrir con..."*.

#### RF-02: Renderizado Completo e Híbrido
* **Markdown Estándar:** Soporte para títulos, listas, tablas, enlaces, imágenes locales/remotas y bloques de código con resaltado de sintaxis (`prism.js` o similar).
* **HTML Integrado:** Las etiquetas HTML válidas dentro del documento deben renderizarse respetando el diseño web estándar.
* **Diagramas Mermaid:** Los bloques de código identificados con ` ```mermaid ` deben ser procesados por la librería e inyectados como gráficos vectoriales (SVG) interactivos.

#### RF-03: Seguridad Estricta
* Cualquier etiqueta HTML que intente ejecutar scripts (ej. `<script>`, atributos `onclick`, etc.) debe ser eliminada en el backend de Rust mediante sanitización antes de pasar al WebView.

#### RF-04: Experiencia de Lectura Despejada
* Interfaz minimalista sin barras de herramientas pesadas.
* Inclusión de un atajo de teclado (`Ctrl + F`) para abrir una barra de búsqueda de texto interna y rápida.
* Barra lateral flotante u oculta que genere automáticamente una **Tabla de Contenidos (Índice)** basada en los títulos (`#`, `##`, `###`) del documento.

#### RF-05: Modos Visuales (Temas)
* Soporte nativo para tres temas de lectura básicos: Claro (estilo GitHub), Oscuro (estilo VS Code / GitHub Dark) y Sepia (optimizado para lectura prolongada).

---

### 4. Requisitos No Funcionales

* **Tamaño del Instalador:** Menor a 8 MB en su versión de producción para Windows (`.msi` o `.exe`).
* **Consumo de RAM:** Menor a 64 MB en reposo con un documento estándar abierto.
* **Tiempo de Respuesta:** El renderizado inicial del documento debe completarse en menos de 200 milisegundos tras la apertura del archivo.

---

### 5. Instrucciones para la Estructura de Prompt en Antigravity

```text
Actúa como un Ingeniero de Software experto en Rust y Tauri. Basándote en el PRD de "MD-Reader-Native":
1. Genera la estructura de archivos recomendada para un proyecto Tauri v2.
2. Proporciona el archivo 'Cargo.toml' con las dependencias necesarias de Rust (incluyendo soporte para paso de argumentos por CLI y la librería 'ammonia').
3. Escribe el código inicial de 'src-tauri/src/main.rs' para capturar la ruta del archivo `.md` pasado por la línea de comandos de Windows y enviarlo al frontend mediante un evento de Tauri.
```