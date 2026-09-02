# 🖥️ Aplicaciones de Escritorio Nativas — Tauri v2 como Stack de Referencia

> Este documento define el patrón de arquitectura recomendado por defecto para cualquier proyecto dbv-specs-ops
> cuyo objetivo sea una aplicación de escritorio nativa multiplataforma (Windows, Linux, macOS).
> Extraído de un proyecto real llevado hasta publicación en Microsoft Store y Uptodown.

## 1. Por qué Tauri v2 como opción por defecto

Frente a Electron, Tauri v2 usa el motor WebView **ya instalado en el sistema operativo** (WebView2 en
Windows, WebKitGTK en Linux, WKWebView en macOS) en vez de empaquetar un Chromium completo. Consecuencias
medibles en un proyecto real:

- Instalador final: **~15-20 MB** (con WebView2 offline embebido) o **~10 MB** sin él, frente a >100 MB típico de Electron.
- RAM en reposo: bajo 64 MB, frente a 150-300 MB típico de Electron.
- Arranque en frío: <200 ms percibido, gracias a evitar un bundler de JS (ver §3).

**Cuándo NO elegir Tauri:** si el proyecto ya tiene una base de código Electron grande, si el equipo no
tiene ninguna experiencia con Rust y el plazo no permite curva de aprendizaje, o si se necesitan APIs de
Node.js muy específicas del lado del proceso principal que no tengan equivalente en el ecosistema de
plugins de Tauri.

## 2. Arquitectura de referencia

```
Sistema Operativo (Windows / Linux / macOS)
        │
        ▼
   CORE (Rust) ── lee args CLI, expone comandos vía #[tauri::command],
        │          gestiona ficheros/red/watchers, nunca renderiza HTML
        │ Tauri IPC Bridge (window.__TAURI__)
        ▼
   FRONTEND (WebView nativo del SO) ── HTML/CSS/JS, toda la lógica de
                                        presentación y sanitización de salida
```

Regla de oro: **el backend Rust nunca debería tener lógica condicional por sistema operativo** si se puede
evitar (`cfg(windows)`, registro de Windows, etc.) — todo lo que difiere por plataforma debería resolverse
en la capa de **empaquetado**, no en el código de aplicación (ver §5).

## 3. Patrón "sin bundler" (IIFE + vendor scripts locales)

Si el frontend no necesita un framework reactivo complejo, evitar Vite/Webpack por completo:

- Vendorizar cada librería de terceros como script UMD/IIFE en `src/vendor/` (descargado una vez, sin CDN).
- Encapsular el código propio en una IIFE clásica (`app.js`), **no** `<script type="module">` — los ES
  Modules dan fallos silenciosos en algunos WebViews embebidos bajo `tauri://` / protocolo custom.
- **La IIFE es obligatoria en TODOS los ficheros JS propios, no solo el principal — incluso "ficheros de
  utilidades que solo definen funciones".** Los scripts clásicos comparten un único ámbito global: si dos
  ficheros declaran el mismo identificador en su top-level (p. ej. un `i18n.js` que define `function t()`
  y un `app.js` que hace `const { t } = window.miI18n`), el segundo fichero muere entero con
  `SyntaxError: Identifier already declared` — y al ser un error de *parseo*, ninguna línea de ese fichero
  llega a ejecutarse: ni listeners, ni handlers de error definidos dentro de él. El síntoma resultante
  (página que renderiza perfectamente pero con la interfaz completamente muerta, sin ningún error visible)
  cuesta horas si no se sabe buscar. Cada fichero se envuelve en su propia IIFE y expone su API por una
  única asignación a `window.<nombre>`.
- **Para depurar este tipo de muerte silenciosa de un script:** los capturadores
  `window.onerror`/`unhandledrejection` deben registrarse en un `<script>` inline (sin `defer`) en el
  `<head>` del HTML, antes de cualquier script externo — un capturador definido dentro del fichero que
  falla nunca llega a registrarse. En un WebView de escritorio sin DevTools abiertos, pintar el error en
  un banner dentro de la propia página es el equivalente práctico de la consola.
- Activar `"withGlobalTauri": true` en `tauri.conf.json` para que `window.__TAURI__` esté disponible sin
  necesidad de `import` — imprescindible para que este patrón sin bundler funcione con los plugins de Tauri.

Resultado: 100% offline, sin paso de build de frontend, carga instantánea.

**Cuándo SÍ usar un bundler:** si el frontend crece más allá de una pantalla y se necesita un framework
como React — en ese caso usar Vite normalmente, Tauri lo soporta de forma nativa (`tauri.conf.json` →
`build.beforeDevCommand`/`beforeBuildCommand`).

## 4. Ocho lecciones de arquitectura transferibles

1. **Sanitiza en la capa correcta, no en la primera posible.** Si el pipeline es "texto plano → HTML"
   (Markdown, plantillas, etc.), sanitizar el **HTML ya renderizado** en el frontend (p. ej. con DOMPurify),
   no el texto plano de entrada en el backend con un parser HTML — un sanitizador HTML aplicado sobre texto
   plano re-escapa cualquier `<`/`&` suelto (código con genéricos, comparadores), corrompiendo cualquier
   bloque de código técnico. Regla general: sanitiza el formato final, no un formato intermedio.

2. **Vigila el directorio padre, no el fichero, para file watching.** La mayoría de editores guardan con
   escritura a fichero temporal + `rename()` atómico. Un watcher apuntando directamente al path del fichero
   puede perder el watch tras el primer rename (especialmente en Windows). Patrón robusto: vigilar el
   directorio contenedor en modo no recursivo y filtrar en el callback por nombre de fichero, con un
   pequeño debounce (~150ms) antes de reaccionar (un solo guardado suele disparar varios eventos seguidos).

3. **Instancia única multi-ventana ≠ pestañas.** Si el requisito real es "un solo proceso en el
   Administrador de Tareas" (no necesariamente "una sola ventana"), un plugin de instancia única que abra
   una `WebviewWindow` nueva **en el mismo proceso** por cada apertura externa resuelve el problema real con
   una fracción del coste de implementar pestañas de verdad. No sobre-construir hacia pestañas si nadie lo
   ha pedido explícitamente.

4. **El auto-actualizador necesita un par de claves fuera del repo desde el primer commit.** Si se va a
   añadir actualización automática (`tauri-plugin-updater` o equivalente), generar el par de claves de firma
   al principio y documentar desde el día uno dónde vive la clave privada (nunca en el repo) y qué pasa si
   se pierde (ninguna versión futura podrá firmarse de forma compatible con instalaciones ya existentes).
   Avisar explícitamente al usuario de hacer copia de seguridad de esa clave/password.
   **Quién ejecuta el comando importa:** `tauri signer generate` lo lanza el usuario en su propia terminal,
   nunca la IA — así la password no pasa por el contexto ni por los logs del agente. Y el destino de esa
   password es un gestor de contraseñas, no un `README.txt` junto a la clave (error real cometido una vez y
   evitado a propósito después). La nota que quede en el repo puede decir dónde está la clave; nunca cuál es
   su password.

5. **La comprobación de actualizaciones nunca debe bloquear el arranque.** Vivir exclusivamente detrás de
   una acción explícita del usuario (botón "Buscar actualizaciones"), nunca en el flujo de arranque — un
   requisito de rendimiento (arranque <200ms) no es compatible con una llamada de red síncrona o incluso
   asíncrona-pero-bloqueante-de-UI al iniciar.

6. **Si el mismo binario se distribuye por dos canales (tienda + self-hosted), detecta desde qué canal se
   ejecuta y desactiva el actualizador propio en el canal de tienda.** Una app instalada vía Microsoft
   Store/Mac App Store se actualiza por la propia tienda — si el botón de "Buscar actualizaciones" propio
   sigue activo y apunta al manifiesto de GitHub Releases, puede crear una instalación paralela desconectada
   de la de la tienda. Patrón usado: detectar en Rust si el ejecutable actual vive bajo el directorio de
   instalación de la tienda (p. ej. `WindowsApps` en Windows) y ocultar la UI de actualización manual si es así.

7. **i18n sin librería es válido para apps pequeñas.** Con pocas decenas de strings, dos objetos planos
   (`es`/`en`, clave→string con sustitución simple de placeholders) más una función que recorra atributos
   `data-i18n` del DOM cubre el caso de uso sin añadir una dependencia (i18next y similares) desproporcionada
   para el tamaño real del problema. Reevaluar solo si el número de idiomas o de strings crece mucho.

8. **Persistencia simple no necesita una base de datos embebida.** Para listas cortas (recientes, favoritos,
   configuración de usuario), un JSON plano en el directorio de datos de la app (`app_data_dir()`) con
   `std::fs` + `serde_json` es suficiente y evita añadir SQLite/sled solo para eso.

## 5. Empaquetado multiplataforma sin lógica condicional en el código

Tauri v2 fusiona automáticamente `tauri.<platform>.conf.json` sobre `tauri.conf.json` según el sistema
operativo donde se ejecuta el build, sin necesidad de flags ni lógica condicional propia:

- `tauri.windows.conf.json` → `bundle.targets: ["nsis"]` (instalador NSIS).
- `tauri.linux.conf.json` → `bundle.targets: ["appimage", "deb"]`.
- `tauri.macos.conf.json` → `bundle.targets: ["dmg", "app"]`.

Antes de dar por buena esta separación, verificar (no asumir) que el código Rust de aplicación no tiene
ninguna dependencia real de plataforma — buscar `cfg(windows)`/registro de Windows/rutas hardcodeadas antes
de prometer soporte multiplataforma.

**Asociación de archivos por formato de paquete Linux — no todos los formatos se comportan igual:**

- **`.deb`**: la asociación de tipo de archivo se registra de forma declarativa vía `bundle.fileAssociations`
  — el bundler genera la entrada `.desktop` correspondiente al instalar el paquete. Esto típicamente **no se
  puede verificar de extremo a extremo sin una máquina Linux real** (doble clic desde el gestor de archivos,
  integración distinta entre entornos de escritorio GNOME/KDE) — si el proyecto no tiene esa máquina
  disponible, documentarlo como riesgo aceptado ("el workflow de CI compila y empaqueta sin error" es una
  verificación distinta de "la asociación funciona en un escritorio real"), no darlo por validado solo porque
  el build pasó.
- **`.AppImage`**: es portátil por diseño — **no se integra con el sistema ni asocia tipos de archivo
  automáticamente**, con o sin `fileAssociations` configurado. No es un bug del proyecto ni algo que el
  bundler pueda resolver: es una limitación del propio formato, que requiere una herramienta externa
  (`AppImageLauncher` o similar) instalada por el usuario para integrarse con el escritorio. Documentar esto
  explícitamente de cara al usuario final (README/instrucciones de instalación) en vez de tratarlo como una
  asociación de archivo rota.

## 6. Trampas concretas de Tauri v2 — permisos, WebView y threading

Los 8 principios de la sección anterior son necesarios pero no suficientes: estas son trampas *concretas*
de la API de Tauri v2 que cuestan horas reales de depuración la primera vez que aparecen, porque fallan en
silencio o con un error que no apunta a la causa real.

1. **`onCloseRequested` exige el permiso `core:window:allow-destroy`, aunque nunca llames a `.destroy()` a
   mano.** Si el handler no hace `event.preventDefault()`, la propia librería `@tauri-apps/api/window`
   invoca `this.destroy()` internamente para completar el cierre. Sin ese permiso en `capabilities/*.json`
   (no incluido en `core:default`, que solo trae lecturas de estado), la ventana se queda **permanentemente
   sin poder cerrarse** por ningún medio (ni la X, ni Alt+F4) — no un error de consola, un bug de UX severo
   y silencioso. Concede el permiso *antes* de escribir el handler, no después de que la ventana se quede
   bloqueada.

2. **`window.confirm()`/`window.alert()` no son síncronos en un WebView de Tauri con `tauri-plugin-dialog`
   registrado — y en algunas versiones el de `confirm` está directamente roto.** El script de inicialización
   del plugin redefine esos globales para invocar comandos IPC asíncronos (`plugin:dialog|confirm`/
   `|message`); `window.confirm()` devuelve una **promesa**, no un booleano — tratarlo como síncrono no
   lanza ningún error, simplemente evalúa la promesa como verdadera siempre. Además, en `tauri-plugin-dialog`
   2.7.2 concretamente, el comando `confirm` no está registrado en el lado Rust (se fusionó con `message` en
   algún punto y el script JS del plugin nunca se actualizó) — cualquier permiso que concedas es irrelevante,
   el comando no existe. Si necesitas confirmación bloqueante de verdad, construye un modal propio en
   HTML/CSS — no dependas de los diálogos nativos del navegador reescritos por un plugin, y verifica el
   comportamiento real leyendo el código fuente del crate instalado
   (`~/.cargo/registry/src/.../<crate>-<version>/src/lib.rs`, buscar `generate_handler!`), no solo la
   documentación.

3. **WebView2 (Windows) cachea agresivamente entre relanzamientos del *proceso*, no solo en memoria.** Si
   editas frontend y `tauri dev`/el `.exe` de debug sigue mostrando la versión anterior tras recompilar,
   sospecha primero de esto antes que de un bug de código: cierra la app y borra únicamente
   `EBWebView\Default\Cache` y `EBWebView\Default\Code Cache` bajo el directorio de datos de la app
   (`%LOCALAPPDATA%\<identifier>\EBWebView\`) — nunca la carpeta `EBWebView` completa, ahí vive también
   `localStorage` con las preferencias reales del usuario si compartes `identifier` con la build de
   producción instalada.

4. **`capabilities/*.json` → `"windows"` filtra por *label* con un patrón glob, no da permisos a toda la
   app.** Cualquier ventana creada dinámicamente en tiempo de ejecución (`WebviewWindowBuilder`, p. ej. con
   labels `doc-0`, `doc-1`...) con una etiqueta que no case con los patrones declarados se queda **sin
   ningún permiso** — `event:listen` incluido — y falla en silencio o con `Command ... not allowed by ACL`
   la primera vez que intenta usar cualquier capability. Si generas labels dinámicos con un prefijo, añade
   el glob correspondiente (`"windows": ["main", "doc-*"]`) desde el principio, no tras el primer error de
   ACL.

5. **`run_on_main_thread()` llamado ya desde el hilo principal se ejecuta de forma reentrante e inline —
   puede colgar la creación de una ventana nueva.** Si un `#[tauri::command]` síncrono ya se despacha sobre
   el hilo principal (depende de la versión/configuración de Tauri — verificarlo con
   `std::thread::current().id()`, no asumirlo), llamar a `run_on_main_thread()` desde dentro de ese comando
   no produce un salto de hilo real: el cierre se ejecuta anidado dentro del propio despacho del mensaje IPC
   que lo originó. Crear una `WebviewWindowBuilder` ahí cuelga `.build()` indefinidamente (su inicialización
   asíncrona necesita que el bucle de mensajes siga bombeando, y no puede mientras ese mismo hilo procesa el
   mensaje exterior). Si necesitas de verdad un hilo distinto desde un comando (a diferencia de un callback
   de plugin, que sí llega en una iteración nueva del bucle), despacha explícitamente desde
   `tauri::async_runtime::spawn(async move { ... })` antes de llamar a `run_on_main_thread()`.

6. **Dos caminos async independientes desde Rust hacia el mismo frontend no garantizan orden de llegada.**
   Si un comando `invoke()` y un evento disparado por un watcher/observador en segundo plano (file watcher,
   etc.) pueden ambos notificar al frontend sobre el mismo cambio, el evento del observador puede llegar
   *antes* de que se resuelva la promesa del `invoke` que lo causó. Cualquier estado que dependa de "ya
   terminé esta operación" (p. ej. una ventana de supresión para no reaccionar a tu propio cambio) debe
   fijarse de forma optimista en el punto donde se *inicia* la operación, no en el callback de éxito —
   revertirlo en el `.catch()` si la operación falla de verdad.

7. **Cada entrada de `"windows"` en `tauri.conf.json` exige `"label"` explícito.** Sin él, la aplicación se
   cierra inmediatamente al arrancar, sin mensaje de error obvio que apunte a la causa.

8. **En macOS, "Abrir con" desde Finder no pasa por `argv` — solo por `RunEvent::Opened`.** Leer
   `std::env::args()` para saber qué archivo abrir funciona en Windows (el Explorador lo pasa como argumento
   literal) pero no existe ese mecanismo en macOS: Finder entrega la apertura como un Apple Event
   `kAEOpenDocuments`, expuesto en Tauri v2 exclusivamente vía `tauri::RunEvent::Opened { urls }` (requiere
   `.build(...)?.run(closure)` en vez de `.run(...)` directo para poder interceptarlo). El evento llega
   *antes* de que exista cualquier ventana, así que hay que guardar la ruta en un estado gestionado y
   recogerla al crear la ventana principal, no asumir que ya habrá una ventana lista para recibirla.

9. **Un mismo permiso web puede exigirse en un motor WebView y no en otro.** `window.print()` funciona sin
   permiso adicional en WebView2 (Windows), pero WKWebView (macOS) exige explícitamente
   `core:webview:allow-print` en `capabilities/*.json` — sin él, `Cmd+P`/el botón de imprimir falla en
   silencio solo en Mac. No asumas que un permiso probado en una plataforma cubre las otras dos: revisa la
   tabla de diferencias de motores (WebView2/WebKitGTK/WKWebView) contra cada API nueva que uses, no solo al
   final.

10. **Tauri v2 no trae menú de aplicación por defecto en macOS — sin uno propio, la app no se siente
    nativa** (falta `Cmd+Q`, `Cmd+H`, el `Edit` con Cortar/Copiar/Pegar del sistema, etc.). Windows/Linux no
    lo necesitan (ya tienen su propia UI de ventana para esas acciones), así que se construye solo bajo
    `#[cfg(target_os = "macos")]`. Se monta con `tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem}`
    en un módulo dedicado, registrado en `.setup()` con `app.handle().set_menu(menu)?` — no en `.plugin()` ni
    en `Builder::default()` directamente. Los ítems predefinidos (`PredefinedMenuItem::cut/copy/paste/...`)
    los localiza el propio sistema operativo según su idioma; los ítems propios (p. ej. "Abrir archivo…") no
    tienen esa magia gratis — hay que localizarlos a mano (`sys-locale` para detectar el idioma del sistema)
    o quedan en un idioma fijo aunque el resto del menú cambie con el idioma del Mac. Las acciones del menú
    (`MenuItem::with_id`) llegan al frontend vía `.on_menu_event()` reemitiendo un evento normal
    (`window.emit("menu-open-file", ())`) que el frontend escucha con `listen()` — no hace falta reimplementar
    la lógica de esas acciones en Rust, solo avisar a la ventana del clic. Patrón de referencia:
    modularizar el menú bajo `#[cfg(target_os = "macos")] mod macos_menu` en `src-tauri/src/lib.rs`, con `sys-locale = "0.3"` como dependencia ligera para detectar el idioma del sistema.

11. **Tauri v2 desactiva el zoom del WebView por defecto.** `Ctrl`+rueda y `Ctrl`+`+`/`-` no hacen nada en
    una app recién generada, aunque funcionen perfectamente con el mismo frontend en un navegador. No es un
    bug ni un problema de CSS: es `app.windows[].zoomHotkeysEnabled`, que vale `false` por defecto y mapea a
    `IsZoomControlEnabled` de WebView2 en Windows. Actívalo explícitamente en `tauri.conf.json` en cualquier
    app cuyo contenido sea texto o diagramas — es de las primeras cosas que un usuario prueba y la ausencia
    se lee como "la versión de escritorio está más limitada que la web".

12. **Un build que dice `Finished` sin haber dicho `Compiling` conserva los assets antiguos.**
    `generate_context!` embebe el frontend **en tiempo de compilación**. Si Cargo decide que no hay nada que
    recompilar, el binario resultante mantiene la copia anterior del frontend por mucho que el paso de
    sincronización haya escrito los ficheros nuevos en `frontendDist`. Es la segunda causa clásica de "mis
    cambios de frontend no se aplican" (la primera es la caché de WebView2, punto 3) y se distingue de ella
    mirando la salida del build, no la app: si la línea `Compiling <crate>` no aparece, el problema es este.
    Un `.taurignore` que excluya `src-tauri/` lo agrava, porque oculta el propio `frontendDist` del
    seguimiento de cambios — no lo pongas.

13. **`document.title` no sirve como sonda para saber si tu JS se está ejecutando.** En una app Tauri el
    título de la **ventana nativa** lo fija `tauri.conf.json` y no refleja `document.title`, así que la sonda
    devuelve siempre "no se ejecuta" y manda la depuración en la dirección equivocada — un instrumento roto
    es peor que ninguno. **Sondas que sí funcionan:** escribir en un elemento visible del DOM, y sobre todo
    un `window.addEventListener('error', e => { /* volcar e.message al DOM */ }, true)` **inline en el
    `<head>`**, antes de cualquier otro script. Un `SyntaxError` de parseo (ver §3) mata el fichero entero
    sin ejecutar ni su primera línea y sin nada visible en pantalla; ese listener es lo único que lo saca a
    la luz sin devtools.

14. **Cambiar solo un recurso incrustado (icono, manifiesto) no invalida la caché de Cargo.** Tras regenerar
    `icons/icon.ico` con `tauri icon`, un rebuild normal termina en menos de un segundo con "nada que
    compilar" y el `.exe` sigue llevando el icono viejo embebido — `tauri-build`/`build.rs` no vuelven a
    correr porque ningún fichero de código cambió. Fuerza `cargo clean -p <crate> --release` antes de
    reconstruir, y verifica el resultado sobre el binario real (extrayendo el icono), no sobre la carpeta de
    assets.

## 7. Definición de Hecho (DoD) de Experiencia de Escritorio

Una app compilada con Tauri no es todavía una app de escritorio: es una web dentro de un marco. La
diferencia entre ambas cosas la notan los usuarios de inmediato y son siempre los mismos seis detalles, que
por eso se tratan como **criterios de aceptación obligatorios**, no como pulido opcional posterior:

1. **Diálogos de archivo nativos del sistema operativo** — `rfd` (o `tauri-plugin-dialog`) en Rust para la
   ruta nativa, `showSaveFilePicker`/`<input type="file">` en la ruta web si la app es dual. Un `<input>` de
   navegador dentro de una ventana nativa delata el origen web al instante.
2. **Iconografía de marca completa**, generada desde un único `app-icon.svg` (1024×1024) con `npx tauri
   icon` — regenera `.ico`, `.icns`, los PNG de todos los tamaños y los logos de tienda desde esa fuente. El
   icono por defecto de Tauri en la barra de tareas es el fallo más visible que existe.
3. **Atajos de teclado universales** (`Ctrl/⌘+S`, `Ctrl/⌘+O`, `Ctrl/⌘+Enter`, `Escape`) funcionando
   **también con el foco dentro de un input** — el caso que más se olvida y el que más se usa.
4. **Menú de aplicación nativo en macOS** (ver punto 10 de §6). Sin él no hay `Cmd+Q`, `Cmd+H` ni el menú
   `Edit` del sistema.
5. **Scrollbars tematizadas** (`::-webkit-scrollbar`) y layout fluido al 100% de la ventana — sin anchos
   máximos heredados del diseño web, que dejan franjas vacías al maximizar.
6. **Tooltips que anuncian los atajos** en los botones de la propia UI: en una web nadie espera atajos, en
   una app de escritorio se buscan.

Además, dos reglas de verificación que acompañan a esta DoD:

- **Lanzar el ejecutable real, no dar por bueno un build que solo compiló.** "El bundle se generó sin
  errores" y "la app funciona" son afirmaciones distintas; varios de los fallos de §6 solo aparecen al
  ejecutar el `.exe`/`.app` de `target/release/`.
- **La versión vive en cuatro sitios y los cuatro se suben a la vez**: `package.json`, `tauri.conf.json`,
  `Cargo.toml` y donde la muestre la UI (panel "Acerca de"/créditos). Desincronizarlos produce un "Acerca
  de" que miente sobre la versión instalada, algo que las tiendas sí miran.

**Nota de rendimiento al llegar desde la web:** WebView2 no absorbe igual que un navegador de escritorio los
patrones "recalculo todo en cada `mousemove`". Un arrastre que regenera estado derivado global en cada frame
puede ir fluido en Chrome y a tirones en la app nativa. El patrón correcto es el mismo que ya era correcto
en la web pero cuyo coste allí quedaba oculto: posición en vivo en estado **local** del componente durante
el arrastre, y regeneración del estado derivado solo al soltar.

Para el patrón de CI que compila cada plataforma y las particularidades de cada tienda de apps, ver
[`NATIVE_APPS_RELEASE_CI.md`](./NATIVE_APPS_RELEASE_CI.md) y [`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md).
