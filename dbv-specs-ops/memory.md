# 🧠 Memory & Architecture Decision Records (ADR): dbv-md-reader

> **Propósito:** Registro cualitativo de decisiones técnicas, lecciones aprendidas y arquitectura para evitar la amnesia contextual de cualquier agente de IA.

---

## 🏗️ Log de Decisiones Técnicas (ADR)

### [2026-08-08] ADR-001: Selección de Tauri v2 + Rust sobre Electron
- **Contexto:** El PRD exige un tamaño de instalador < 15 MB y un consumo de RAM < 64 MB en reposo.
- **Decisión:** Utilizar Tauri v2 con el motor nativo WebView2 en Windows.
- **Consecuencias:** Se reduce drásticamente el peso del ejecutable standalone (~12.5 MB) y el consumo de memoria en comparación con Electron.

### [2026-08-08] ADR-002: Inyección Global de Tauri en WebView2 (`withGlobalTauri: true`)
- **Contexto:** En Tauri v2, la API global `window.__TAURI__` no se inyecta por defecto en la ventana webview.
- **Decisión:** Habilitar `"withGlobalTauri": true` y definir `"label": "main"` en `src-tauri/tauri.conf.json`.
- **Consecuencias:** Garantiza que el código JavaScript del frontend pueda acceder de forma determinista a `window.__TAURI__.core.invoke`, `event` y `shell` sin requerir un bundler de módulos (Vite/Webpack).

### [2026-08-08] ADR-003: Diálogo de Archivos y Drag & Drop Nativo vía Rust & Tauri Events
- **Contexto:** En WebView2 embebido, los elementos HTML `<input type="file">` y los eventos `DragEvent` no exponen la propiedad `file.path` por restricciones de seguridad del navegador.
- **Decisión:** 
  - La apertura de archivos mediante diálogo invoca la función de Rust `open_file_dialog` mediante `app.dialog().file().blocking_pick_file()`.
  - El arrastre de archivos escucha el evento nativo de Tauri `tauri://drag-drop` enviado desde el backend Rust.
- **Consecuencias:** Se obtiene la ruta absoluta real del sistema de archivos de Windows sin bloqueos de seguridad del navegador web.

### [2026-08-08] ADR-004: Enrutamiento Relativo de Documentos Markdown con Soporte de Fragmentos Ancla (#)
- **Contexto:** Los cursos de formación estructurados contienen documentos principales que enlazan a subdocumentos en carpetas hijas (ej. `modulos/Modulo_01.md#seccion`).
- **Decisión:** El interceptor de enlaces en JavaScript separa el enlace en `filePart` y `anchorPart`. La función de Rust `resolve_relative_path` procesa `filePart` con `fs::canonicalize()` sin fallar por el símbolo `#`. Tras cargar el documento, el frontend realiza un desplazamiento suave (`scrollIntoView`) hacia el elemento con `id` o `name` correspondiente a `anchorPart`.
- **Consecuencias:** Navegación fluida entre módulos de cursos y documentación modular sin errores de archivo no encontrado (os error 2).

### [2026-08-08] ADR-005: Escalado de Zoom Proporcional con CSS `zoom`
- **Contexto:** Modificar `font-size` en el contenedor principal no alteraba el tamaño de los encabezados (h1, h2, h3) porque utilizaban unidades `rem` calculadas a nivel de raíz (`html`).
- **Decisión:** Aplicar la propiedad CSS `contentEl.style.zoom = zoomLevel + '%'` en lugar de modificar `font-size`.
- **Consecuencias:** Escalado uniforme y proporcional de todo el documento (títulos, párrafos, listas, imágenes, código y márgenes) idéntico al zoom de los navegadores web.

### [2026-08-08] ADR-006: Frontend Autónomo con IIFE y Vendor Scripts Locales (Sin Bundler)
- **Contexto:** La dependencia de CDN externass (cdnjs) impedía el uso offline y requería conexión a internet. Los ES Modules (`type="module"`) generaban fallos silenciosos en WebView2 con custom-protocol.
- **Decisión:** Empaquetar `markdown-it.min.js`, `prism.min.js` y `mermaid.min.js` en `src/vendor/` y encapsular la lógica del cliente en una IIFE JS clásica (`app.js`).
- **Consecuencias:** Carga instantánea (< 200 ms), ejecución 100% offline y estabilidad total en cualquier equipo Windows.

### [2026-08-09] ADR-009: RF-03 se implementa con DOMPurify (JS, post-render) en vez de Ammonia (Rust, pre-render)
- **Contexto (Adversarial Review):** El plan original (ARCHITECTURE.md) mandaba sanitizar con `ammonia` en Rust antes de enviar el contenido al frontend. Pero en ese punto del pipeline el contenido es **Markdown crudo**, no HTML — `markdown-it` renderiza a HTML en el frontend, después del IPC. Sanitizar el Markdown crudo con un parser HTML (`ammonia`) re-serializa cualquier `<`/`&` suelto dentro de bloques de código (`if (a < b)`, `List<T>`) como entidades, que luego `markdown-it` vuelve a escapar al renderizar el `<code>`, mostrando literalmente "&amp;lt;" en pantalla — rompe el resaltado de código en cualquier ejemplo técnico con comparadores o genéricos.
- **Decisión:** Sanitizar el **HTML ya renderizado** (`md.render(raw)`) en el frontend con **DOMPurify**, justo antes de `contentEl.innerHTML = ...`. DOMPurify ya estaba presente como dependencia transitiva de `mermaid` (`node_modules/dompurify`); se vendoriza `src/vendor/dompurify.min.js` siguiendo el patrón ADR-006. Configurado con `ADD_ATTR: ['id','class','name']` para no romper el resaltado de Prism (`class="language-xxx"`), la detección de bloques Mermaid (`code.language-mermaid`) ni las anclas de navegación (`id`/`name`, Lección 3).
- **Consecuencias:** No se añade el crate `ammonia` a `Cargo.toml` (menos peso, coherente con NFR). `RF-03` y `ARCHITECTURE.md` se actualizan para reflejar que la sanitización ocurre en el frontend, no en Rust.

### [2026-08-09] ADR-010: RF-06 vigila el directorio padre (no el archivo) y aplica debounce
- **Contexto (Adversarial Review):** Muchos editores (VS Code, Notepad++) guardan mediante escritura a fichero temporal + `rename()` atómico. Si `notify` vigila directamente la ruta del archivo, el watch puede perderse tras el primer rename en Windows y dejar de disparar eventos en guardados posteriores. Cada guardado además suele generar varios eventos seguidos.
- **Decisión:** El comando `watch_file` vigila el **directorio padre** del archivo activo (`RecursiveMode::NonRecursive`) y filtra en el callback los eventos cuyo path coincide con el nombre de archivo activo. Un único watcher vive en `tauri::State<Mutex<Option<RecommendedWatcher>>>`, reemplazado en cada carga de documento. El frontend aplica un debounce (~150 ms) antes de recargar y preserva `scrollTop` en vez de resetear el scroll.
- **Consecuencias:** Sobrevive a guardados atómicos de cualquier editor. La recarga en caliente no pasa por `isPrimaryOpen` (no ensucia "Recientes") ni por el historial de navegación Atrás/Adelante.

### [2026-08-09] ADR-008: Relajación del NFR de tamaño de instalador (<8 MB → <20 MB)
- **Contexto:** La auditoría de 2026-08-09 reveló que RF-03 (ammonia), RF-06 (notify) y RF-08A (cliente HTTP para `.md` remotos) nunca se implementaron pese a estar documentados en `ARCHITECTURE.md`. El ejecutable ya pesaba ~12.5 MB (por encima del objetivo original de <8 MB) antes de añadir esos 3 crates.
- **Decisión:** El usuario confirmó explícitamente relajar el NFR de tamaño a <20 MB para poder completar RF-03/06/07/08A/11 sin recortar funcionalidad ("lo relajamos a lo que haga falta, no vamos a perder funcionalidad por el tamaño").
- **Consecuencias:** Se implementan todos los RF pendientes en un único ciclo. El tamaño final del ejecutable se documentará en `task.md` tras compilar; sigue siendo muy inferior a una alternativa basada en Electron.

### [2026-08-08] ADR-007: Persistencia de "Archivos Recientes" en JSON local (Rust) sin nueva dependencia
- **Contexto:** RF-11 requiere recordar los últimos documentos abiertos entre sesiones. No se quería añadir un crate nuevo (SQLite, sled) para una lista simple de máx. 10 entradas.
- **Decisión:** Persistir `recent_files.json` en `app.path().app_data_dir()` usando `std::fs` + `serde_json` (ya presentes en `Cargo.toml`). Solo las aperturas explícitas (CLI, diálogo, Drag & Drop) añaden entradas; la navegación por enlaces internos y los botones Atrás/Adelante quedan excluidos.
- **Riesgo aceptado conscientemente (Adversarial Review):** Las entradas de documentos remotos (`http(s)://...md`, RF-08A) no se validan contra un servidor al listarlas (solo se filtran por existencia las rutas locales); si la URL remota ya no responde, el error se mostrará al intentar reabrir mediante el mecanismo de errores ya existente (`showError`/`alert`), sin purgarse automáticamente de la lista.
- **Consecuencias:** Cero dependencias nuevas, lista auto-saneada de archivos locales borrados/movidos (se filtran con `Path::exists()` al leer), y comportamiento consistente con RF-08A/RF-08B (la navegación interna no ensucia la lista de recientes).

---

## ⚠️ Lecciones Aprendidas & Gotchas

1. **WebView2 File Path Mismatch:** Nunca confiar en `e.dataTransfer.files[0].path` o `input.files[0].path` dentro de WebView2 en Tauri. Usar siempre `tauri_plugin_dialog` o eventos `tauri://drag-drop`.
2. **Canonicalización de Rutas con Anclas:** La función `fs::canonicalize()` de Rust falla con `os error 2` si la ruta incluye fragmentos URL como `#seccion`. Siempre separar el fragmento `#` en el frontend antes de pasarlo a Rust.
3. **HTML Inline en Markdown:** Para soportar anclas HTML explícitas tipo `<a id="modulo-1"></a>` escritas dentro de archivos `.md`, `markdown-it` debe inicializarse con `{ html: true }`.
4. **Ventanas Tauri v2:** Cada entrada dentro de `"windows": [...]` en `tauri.conf.json` exige obligatoriamente la propiedad `"label": "main"`. Sin ella, la aplicación se cierra inmediatamente al ejecutarse.
5. **[2026-08-09] Comandos Tauri con `AppHandle`: extraer la lógica pura para poder testearla:** `add_recent_file`/`get_recent_files` recibían `tauri::AppHandle`, lo que impide instanciarlos en un `#[test]` sin un contexto de app real. Se extrajo el dedupe/truncado/filtrado a funciones puras (`upsert_recent`, `filter_existing`) que no tocan `AppHandle` ni el disco directamente, dejando los comandos como finas capas de I/O sobre ellas. `resolve_relative_path` y `read_file`, al no depender de `AppHandle`, se testean directamente. Los tests de red (`read_file` contra una URL real) se marcan `#[ignore]` y se ejecutan aparte con `cargo test -- --ignored`, para no depender de conectividad en cada `cargo test`.
6. **[2026-08-09] Verificación funcional en la app real (RF-03/06/07/11):** Se compiló el release (`cargo build --release`, ~14.5 MB) y se lanzó con un `.md` de prueba (imagen relativa, bloque de código con `<`, ancla HTML, intento de `<script>`/`onerror`). Confirmado visualmente: la imagen carga (RF-07), el código con `<`/`>` se muestra intacto y el script/onerror no se ejecutan (RF-03), y al editar el archivo abierto la Tabla de Contenidos se actualizó sola sin recarga manual (RF-06). `recent_files.json` se generó correctamente tras la apertura por CLI (RF-11). RF-08A (fetch remoto) se verificó después con un test de integración contra una URL real (ver lección 5).
7. **[2026-08-09] El `.exe` de producción no se puede sobrescribir con una instancia previa abierta:** Windows bloquea el archivo (`Device or resource busy`) mientras un proceso lo tiene cargado. Antes de copiar un build nuevo sobre `dbv-md-reader.exe` en la raíz, hay que cerrar cualquier ventana de la app que siga abierta desde una sesión anterior.
8. **[2026-08-09] Automatización de UI por coordenadas de pantalla es frágil y arriesgada:** Al simular clics con coordenadas absolutas de pantalla para probar la app, un clic erró el objetivo y aparentemente interactuó con la ventana de VS Code en segundo plano en vez de con `dbv-md-reader`. No causó daño (no se generó ningún proceso ni cambio inesperado), pero confirma que este método no es fiable para verificación de UI en este entorno. **Lección:** preferir verificar lógica mediante tests unitarios/integración sobre el backend (Rust) cuando sea posible, y reservar la interacción real por captura de pantalla solo para comprobaciones puntuales de bajo riesgo, revisando el proceso/ventana objetivo antes de cada clic.
9. **[2026-08-09] Documentación desincronizada del código real:** `task.md` marcaba las Fases 0-6 como "COMPLETADAS" y `ARCHITECTURE.md` documentaba `ammonia` (RF-03), `notify` (RF-06) y un cliente HTTP para `.md` remotos (RF-08A) como decisiones ya tomadas, pero ninguno de esos 3 crates está en `Cargo.toml`/`Cargo.lock` — nunca se implementaron. Además `RF-07` (protocolo `asset://`/`convertFileSrc` para imágenes locales) tampoco existe: `markdown-it` renderiza `<img src="...">` con la ruta literal del `.md` sin reescribirla, por lo que las imágenes relativas/absolutas locales no cargan en WebView2 (bug reportado por el usuario). **Lección:** no dar por completada una Fase en `task.md` sin verificar en el código (`Cargo.toml`, `invoke_handler`, listeners JS) que cada RF referenciado en `ARCHITECTURE.md` esté realmente implementado, no solo diseñado.
