# 📋 Especificaciones Técnicas (PRD): dbv-md-reader

> **Fase:** `/spec` (Especificación)  
> **Estado:** Validado  
> **Última Revisión:** 2026-08-08  

---

## 🎯 1. Contexto y Objetivos

- **Problema:** Los visores actuales de Markdown para Windows suelen estar basados en Electron (pesados, alto consumo de RAM > 200 MB, empaquetan Chromium completo) o requieren abrir un IDE (como VS Code) o navegadores web con extensiones. Falta una utilidad nativa, rápida y ligera dedicada exclusivamente a la **lectura de archivos `.md`** locales y remotos.
- **Objetivo (Éxito):** Crear una aplicación nativa para Windows (**dbv-md-reader**) enfocada en la lectura fluida de archivos Markdown, con consumo de RAM menor a 64 MB, instalador inferior a 8 MB, renderizado instantáneo (< 200 ms), auto-recarga en vivo y sanitización estricta de HTML mediante Rust (`ammonia`), lista para sustituir al Bloc de Notas de Windows como visor predeterminado para la extensión `.md`.

---

## 👥 2. Usuarios y Escenarios

- **Perfil de Usuario:** Desarrolladores, estudiantes, profesores, escritores técnicos, investigadores y usuarios de Windows que necesitan abrir y leer rápidamente archivos `.md` sin editar ni sobrecargar el sistema.
- **Escenarios Clave:**
  - *Escenario A (Doble clic / Abrir con):* El usuario hace doble clic sobre un archivo `README.md` en el Explorador de Archivos de Windows. `dbv-md-reader` se inicia instantáneamente cargando y renderizando el documento.
  - *Escenario B (Cursos y Documentación Interconectada):* El usuario sigue un curso o documentación modular en Markdown. Hace clic en un enlace a otro `.md` local (ej. `[Lección 2](./leccion2.md)`), el lector lo abre al instante y permite volver atrás con la flecha o `Alt + ←`.
  - *Escenario C (Vista previa en tiempo real / Auto-reload):* El usuario edita el documento en su editor preferido y `dbv-md-reader` actualiza automáticamente la vista en pantalla al guardar los cambios en disco.
  - *Escenario D (Diagramas Mermaid):* El usuario visualiza documentación técnica con diagramas de flujo o arquitectura incrustados (` ```mermaid `) que se renderizan como SVGs interactivos.
  - *Escenario E (Lectura prolongada y navegación):* El usuario conmuta entre temas (Claro, Oscuro, Sepia), navega con la Tabla de Contenidos (TOC) y busca texto con `Ctrl + F`.

---

## ✨ 3. Requisitos Funcionales (MVP & Mejoras)

- [x] **RF-01: Apertura mediante Argumento CLI:**  
  La aplicación acepta una ruta de archivo como argumento al iniciarse (ej. `dbv-md-reader.exe C:\notas\readme.md`). Permite asociar el ejecutable como visor predeterminado en Windows mediante *"Abrir con..."*.
- [x] **RF-02: Renderizado Completo e Híbrido:**  
  - **Markdown Estándar:** Soporte para títulos (`#`..`######`), listas, tablas, enlaces, imágenes y bloques de código con resaltado de sintaxis (Prism.js). ✅ Implementado (`markdown-it` + Prism.js).
  - **HTML Integrado:** Las etiquetas HTML válidas dentro del documento se renderizan respetando el diseño web estándar. ✅ Implementado (`html: true` en `markdown-it`) — **sin sanitizar**, ver riesgo en RF-03.
  - **Diagramas Mermaid:** Los bloques de código identificados con ` ```mermaid ` son procesados e inyectados como gráficos vectoriales (SVG). ✅ Implementado.
- [x] **RF-03: Sanitización de HTML y Seguridad Estricta:**  
  Cualquier etiqueta o atributo HTML peligroso que intente ejecutar scripts (`<script>`, `onclick`, `onload`, `javascript:`, etc.) se elimina antes de insertarse en el DOM del WebView2. Implementado con **DOMPurify** (ver ADR-009 en `memory.md`) sobre el HTML ya renderizado por `markdown-it`, en vez de `ammonia` en Rust sobre el Markdown crudo (que corrompería bloques de código con `<`/`&`). ✅ Verificado 2026-08-09: `<script>` y `onerror` no se ejecutan; un bloque de código con `if (a < b)` se muestra intacto.
- [x] **RF-04: Experiencia de Lectura Despejada y Navegación:**  
  - Interfaz minimalista sin barras de herramientas pesadas. ✅  
  - Barra lateral flotante o colapsable con Tabla de Contenidos (TOC) generada automáticamente a partir de encabezados (`#`, `##`, `###`). ✅  
  - Atajo de teclado (`Ctrl + F`) para abrir una barra de búsqueda interna de texto rápida. ✅  
- [x] **RF-05: Modos Visuales (Temas):**  
  Soporte para tres temas básicos: Claro (estilo GitHub), Oscuro (estilo VS Code / GitHub Dark) y Sepia (lectura prolongada). ✅ Implementado con persistencia en `localStorage`.
- [x] **RF-06: Auto-Reload por Modificación Externa (File Watcher):**  
  Integración de un observador de archivos en Rust (`notify` crate, comando `watch_file`, vigila el directorio padre — ADR-010). Si el archivo abierto es editado y guardado por otra aplicación, la vista de `dbv-md-reader` se recarga automáticamente en caliente sin perder la posición del scroll (evento `file-changed` + debounce en `app.js`). ✅ Verificado 2026-08-09: al añadir una sección al `.md` abierto, la Tabla de Contenidos se actualizó sola sin recarga manual.
- [x] **RF-07: Carga y Resolución de Imágenes Locales:**  
  Conversión automática de rutas relativas de imágenes (`./assets/imagen.png`) y rutas locales absolutas al protocolo de activos de Tauri (`asset://` vía `convertFileSrc` + `app.security.assetProtocol` en `tauri.conf.json`) para prevenir enlaces rotos por políticas de origen cruzado en WebView2. ✅ Verificado 2026-08-09: imagen relativa renderizada correctamente (bug original reportado por el usuario, corregido).
- [x] **RF-08A: Navegación de Documentos Markdown (Locales y Remotos):**  
  Si un enlace apunta a otro archivo Markdown (ej. `./leccion2.md` o un URL remoto `https://.../doc.md`), `dbv-md-reader` lo lee/descarga, lo sanitiza y lo abre dentro de la propia aplicación permitiendo navegar por la estructura del curso o documentación. Los enlaces `.md` locales relativos funcionan (`resolve_relative_path` + `read_file`). La descarga de `.md` remotos está implementada con `ureq` (`read_file` detecta `http(s)://` y descarga; `resolve_relative_path` une URLs cuando la base es remota). ✅ Verificado 2026-08-09 con un test de integración (`read_file_downloads_remote_markdown`, `#[ignore]` por defecto — requiere red) contra una URL real (`raw.githubusercontent.com`): descarga, `file_name` y `dir_path` correctos.  
  **Entrada de UI (RF-08A-UI, añadido 2026-08-09):** hasta ahora solo se podía llegar a un `.md` remoto haciendo clic en un enlace *dentro* de un documento ya abierto — no había forma de pegar una URL directamente (el selector nativo de archivos no admite `http(s)://`). Se añadió un botón "Abrir desde URL" en la barra superior y un enlace "o abrir desde una URL" en el Estado Vacío (RF-09), que despliegan un panel con un campo de texto; al confirmar (botón "Abrir" o `Enter`) se invoca la misma ruta de carga que el resto de aperturas explícitas (`isPrimaryOpen`, se registra en Archivos Recientes). ✅ Verificado con una URL real del usuario.
- [x] **RF-08B: Historial de Navegación (Atrás / Adelante):**  
  Mantiene una pila de historial de documentos leídos con botones discretos `←` / `→` en la barra superior y atajos universales `Alt + Left` (Atrás) / `Alt + Right` (Adelante) para regresar al documento anterior sin perderse en el curso. ✅ Implementado.
- [x] **RF-08C: Enlaces a Páginas Web Externas:**  
  Si un enlace apunta a una página web general (ej. `https://github.com`), se abre directamente en el navegador predeterminado del sistema operativo para mantener la aplicación ligera y segura. ✅ Implementado (`tauri-plugin-shell`).
- [x] **RF-09: Estado "Sin Archivo Abierto" (Empty State & Drag and Drop):**  
  Si la aplicación se ejecuta sin argumentos CLI, muestra una pantalla limpia con zona para arrastrar y soltar (Drag & Drop) un archivo `.md` y acceso al selector de archivos (`Ctrl + O`). ✅ Implementado.
- [x] **RF-10: Utilerías de Lectura (Copiar Código, Zoom, Exportar PDF):**  
  - Botón disimulado "Copy" en bloques de código. ✅  
  - Zoom de lectura con `Ctrl + +`, `Ctrl + -` y `Ctrl + 0`. ✅ El zoom se aplica tanto al contenido (`#content`) como a la Tabla de Contenidos (`#toc-sidebar`) — corregido 2026-08-09 (antes solo afectaba al contenido).  
  - Impresión / Exportación a PDF mediante `Ctrl + P`. ✅
- [x] **RF-12: "Acerca de":**  
  Botón en la barra superior que abre un panel modal con el nombre de la aplicación, la versión actual (leída dinámicamente del backend Rust vía `get_app_version`, sincronizada siempre con `Cargo.toml`), enlaces a la web del autor (`davidbuenov.com`) y su GitHub (`github.com/davidbuenov`) abiertos en el navegador del sistema, y la licencia. ✅ Implementado y verificado 2026-08-09.
- [x] **RF-11: Archivos Recientes (Recent Files):**  
  - El backend de Rust persiste en disco (directorio de datos de la aplicación, `recent_files.json`) una lista de hasta 10 rutas de archivos `.md` abiertos explícitamente (CLI, diálogo nativo o Drag & Drop), con nombre de fichero y fecha/hora de última apertura.  
  - Un botón "Recientes" en la barra superior despliega un panel con esa lista; al hacer clic en una entrada se reabre el documento y sube al principio de la lista.  
  - Si un archivo recientemente registrado ya no existe en disco (movido/borrado), se descarta silenciosamente de la lista al mostrarla o al intentar abrirlo, sin bloquear la aplicación.  
  - El Estado "Sin Archivo Abierto" (RF-09) muestra también un acceso directo a los últimos archivos recientes (si existen) para evitar tener que buscar el fichero de nuevo.  
  - La navegación interna entre documentos enlazados (RF-08A) y los botones Atrás/Adelante (RF-08B) **no** añaden entradas a esta lista — solo las aperturas explícitas cuentan como "recientes".  
  - Un botón "Limpiar historial" vacía la lista de recientes.
  - ✅ Verificado 2026-08-09: al abrir por CLI, `recent_files.json` registró correctamente la ruta, nombre y timestamp.

---

## 🏗️ 4. Propuesta de Solución Técnica

- **Core / Backend:** **Rust** + **Tauri v2**.
- **Sanitizador de Seguridad:** **DOMPurify** (JS, frontend) sobre el HTML ya renderizado por `markdown-it` — decisión actualizada 2026-08-09 (ver ADR-009 en `memory.md`); reemplaza la idea original de `ammonia` en Rust, que operaría sobre Markdown crudo y corrompería bloques de código.
- **File Watcher:** **Notify crate** (Rust) para la recarga en vivo de archivos editados, vigilando el directorio padre (ADR-010) para sobrevivir a guardados atómicos.
- **HTTP Client (Remotos):** **ureq** (Rust, bloqueante, sin runtime async) para descargar documentos Markdown remotos si el usuario hace clic en una URL `.md`.
- **Frontend / WebView:** HTML5, CSS3 (Tailwind CSS), JavaScript Vanilla (modular).
- **Historial de Navegación:** Pila de navegación (Stack) en JS/Rust con soporte para enlaces relativos al directorio del archivo actual.
- **Parser de Markdown:** **markdown-it** (CommonMark + soporte de HTML integrado).
- **Resaltado de Sintaxis:** **Prism.js**.
- **Diagramas:** **mermaid.js** (generación de SVG vectorial).

---

## 📐 5. Requisitos No Funcionales

- **Tamaño del Instalador:** Menor a 20 MB (`.msi` o `.exe` para Windows). *(Relajado el 2026-08-09 de <8 MB a <20 MB — decisión consciente del usuario: prioriza la funcionalidad completa (seguridad, auto-reload, imágenes, remotos) sobre el tamaño mínimo. Sigue siendo drásticamente inferior a una app Electron equivalente.)*
- **Consumo de RAM:** Menor a 64 MB en reposo con un documento abierto.
- **Tiempo de Respuesta:** Renderizado inicial completado en menos de 200 ms tras abrir el archivo.

---

## 🚫 6. Fuera de Alcance (Out of Scope)

- [ ] Edición o modificación del contenido de los archivos `.md` (aplicación strictly de solo lectura).
- [ ] Base de datos pesada de notas o sincronización en la nube propietaria.

---

## ⚠️ 7. Riesgos y Mitigación

- **Riesgo:** Inyección de código malicioso XSS mediante HTML embebido en archivos Markdown no confiables (locales o remotos).  
  - **Mitigación:** Sanitización estricta en el backend de Rust con `ammonia` previa a cualquier renderizado en el WebView.  
- **Riesgo:** Bloqueo de WebView2 al intentar cargar archivos locales mediante `file://`.  
  - **Mitigación:** Uso del protocolo `asset://` de Tauri para la resolución de imágenes y documentos `.md` locales relativos.  

---

## ❓ 8. Preguntas Abiertas

- [x] **Stack:** ¿Estrategia A (Rust + Tauri v2 + WebView2)? Confirmado.
- [x] **Nombre del proyecto:** `dbv-md-reader` (Confirmado por el usuario).
- [x] **Navegación Cursos / Docs:** Soporte total de navegación entre archivos `.md` locales enlazados con historial de Atrás (`Alt + ←`) / Adelante (`Alt + →`). Confirmado.
- [x] **Presupuesto de tamaño vs. RF-03/06/08A:** Confirmado por el usuario (2026-08-09): se relaja el NFR de tamaño a <20 MB y se implementan todos los RF pendientes (RF-03, RF-06, RF-07, RF-08A, RF-11) en este ciclo sin recortar funcionalidad.
