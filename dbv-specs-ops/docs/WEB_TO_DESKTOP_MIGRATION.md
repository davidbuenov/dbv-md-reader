# 🔁 Migrar una App Web Existente a Escritorio Nativo

> Este documento cubre las decisiones **estratégicas previas** a envolver con Tauri v2 una aplicación web
> que ya existe y ya tiene usuarios, historial e issues.
>
> [`NATIVE_DESKTOP_APPS.md`](./NATIVE_DESKTOP_APPS.md) asume que la decisión ya está tomada y explica **cómo**
> se construye la app nativa. Este documento responde a lo de **antes**: en qué repositorio se trabaja, si el
> escritorio sustituye o acompaña a la web, y qué se hace con un backend que no está escrito en Rust.
>
> Saltarse estas decisiones no las evita — solo las convierte en una reescritura a mitad de camino.

## 0. Cuándo usar este documento

Úsalo cuando **ya existe código web funcionando** y se quiere distribuir además (o en vez) como binario
nativo. Si partes de cero, no lo necesitas: ve directo a `NATIVE_DESKTOP_APPS.md`.

Las cuatro decisiones, en el orden en que hay que tomarlas:

| # | Decisión | Sección |
|---|---|---|
| 1 | ¿Qué arquetipo es realmente esta app? | §1 |
| 2 | ¿Repo nuevo desde plantilla, o plantilla hacia el repo existente? | §2 |
| 3 | ¿El escritorio sustituye a la web, o convive con ella? | §3 |
| 4 | ¿El backend se reescribe en Rust o se empaqueta como sidecar? | §4 |

---

## 1. Paso 0 — Clasifica la app antes de decidir nada

**El error más caro es tratar las cuatro decisiones como una sola respuesta para todo el portfolio.** El
coste y la estrategia correcta dependen casi por completo de un solo factor: **qué hay debajo del
frontend**. Clasifica primero:

| Arquetipo | Cómo se reconoce | Coste de migración | Estrategia por defecto |
|---|---|---|---|
| **A — Estática pura** | HTML/CSS/JS o PWA sin build; no hay servidor propio | **Trivial** — `frontendDist` apunta a la carpeta y ya | Dual (§3), sin backend que decidir |
| **B — SPA con bundler** | Vite/Webpack + framework, todo el cómputo en cliente | **Trivial-bajo** — `beforeBuildCommand` + `frontendDist` al `dist/` | Dual (§3), sin backend que decidir |
| **C — Servidor local ligero** | Servidor propio, pero su trabajo real son ficheros/formatos con equivalente en crates de Rust | **Medio** — reescritura del backend a comandos `#[tauri::command]` | Reescribir en Rust (§4) |
| **D — Servidor local pesado** | El servidor existe por una dependencia que **es la razón de ser de la app** (inferencia ML, OCR, motores de documento) | **Alto** — sidecar + estrategia de instalación (§5) | Sidecar Python/otro (§4, §5) |

> ⚠️ **El arquetipo D disfrazado de app web es más común de lo que parece.** Señales: un `start.cmd` que
> levanta el servidor y abre el navegador, `localhost` cableado en el frontend, uso de GPU local, y un README
> que promete "sin nube, privacidad total". Esa app **ya era de escritorio**; el navegador era el
> *workaround*. Reconocerlo cambia el marco: Tauri no le añade un canal nuevo, le da por fin la forma
> correcta.

Verifica el arquetipo mirando el fichero de dependencias real (`requirements.txt`, `pyproject.toml`,
`package.json`), no la descripción del repo. Una sola línea (`torch`, `easyocr`, un stack de ASR) mueve una
app de C a D y multiplica el coste por diez.

> ⚠️ **"`frontendDist` apunta a la carpeta y ya" (Arquetipo A) solo es cierto si `src-tauri/` NO vive dentro
> de esa misma carpeta.** En una migración in-place, `src-tauri/` se añade en la raíz del repo — la misma
> raíz que ya sirve como sitio estático (y que GitHub Pages puede estar publicando). Apuntar `frontendDist`
> ahí hace que Tauri intente embeber recursivamente `src-tauri/target/...`: en el mejor caso el build muere
> con un error de lock de Cargo (`failed to read asset ... (os error 33)`); en el peor, termina pero embebe
> un árbol sin `index.html` resoluble en la raíz — ventana en negro, WebView2 cae a `127.0.0.1` y falla con
> `ERR_CONNECTION_REFUSED`, un síntoma que no apunta en absoluto a la causa real. **Solución:** un script
> (`scripts/sync-frontend.mjs`) copia solo los ficheros del frontend a una carpeta *fuera* del árbol servido
> por Pages, p. ej. `src-tauri/frontend/` (gitignored), enganchado a `beforeDevCommand`/`beforeBuildCommand`
> en `tauri.conf.json`, y `frontendDist` apunta a esa copia — nunca a la raíz del repo ni a `src-tauri/`
> mismo. Mover los ficheros de sitio en vez de copiarlos no es alternativa: la raíz es lo que Pages publica.

---

## 2. Dirección de la adopción: el repo existente manda

Hay dos formas de juntar la plantilla y la app, y **solo una es correcta**:

| Opción | Qué implica | Veredicto |
|---|---|---|
| Clonar la plantilla y meter dentro la app | Repo nuevo. Se pierde historial, issues, stars, releases, README indexado y las URLs que la gente ya tiene | ❌ |
| Trabajar en el repo existente y traer a él las piezas de la plantilla | El repo sigue siendo el mismo; el escritorio entra por una rama | ✅ |

**La plantilla es andamiaje, no contenedor.** Trabaja en el repo de la app, en una rama dedicada
(`feat/tauri-desktop`), y copia hacia ella exactamente tres cosas:

1. `src-tauri/` completo (config, `Cargo.toml`, iconos, `capabilities/`).
2. `.github/workflows/release-{windows,macos,linux}.yml`.
3. El framework `dbv-specs-ops/` — **salvo que el repo ya lo tenga**, en cuyo caso el paso no es adoptar
   sino ejecutar [`UPGRADE_PROMPT.md`](./UPGRADE_PROMPT.md).

Comprueba ese último punto antes de copiar nada: un proyecto puede tener la **adopción antigua** (con
`project.config.md`, `memory.md` y `task.md` sueltos en la raíz, sin carpeta `dbv-specs-ops/`). Eso ya es
una adopción válida y hay que actualizarla, no duplicarla.

### 2.1 Un repo por app, siempre

No consolides varias apps migradas en un monorepo "de apps de escritorio". Cada una tiene su propio
versionado, sus propios tags `vX.Y.Z` (de los que dependen los workflows de release) y su propia ficha de
tienda. Un monorepo obliga a inventar un esquema de tags compuesto sin ganar nada a cambio.

### 2.2 La demo de la plantilla es desechable, pero no entera

Al traer `src-tauri/`, el `src/` de ejemplo se sustituye por el frontend real. **Conserva** el patrón de
`onCloseRequested` + modal propio si la app tiene estado sin guardar: es el gotcha de permisos más caro de
resolver a mano (ver `NATIVE_DESKTOP_APPS.md` §6) y ya viene resuelto.

Y una advertencia sobre el patrón "sin bundler" de `NATIVE_DESKTOP_APPS.md` §3: **es condicional, no
universal.** Aplica al arquetipo A. Para el arquetipo B (Vite/React/TS/Tailwind) no se aplica — ahí se usa
Vite con normalidad vía `build.beforeDevCommand` / `beforeBuildCommand`. Aplicarlo por inercia significaría
desmontar un frontend que ya funciona.

---

## 3. ¿Escritorio-solo o dual? — dual por defecto

**Regla: el escritorio es un canal de distribución adicional, no un reemplazo.** Convertir a
"solo escritorio" destruye valor existente (usuarios en móvil, enlaces compartidos, uso sin instalación) a
cambio de no ahorrar prácticamente nada, porque el modo web sigue funcionando gratis si se respeta §3.1.

Excepciones donde el matiz importa:

- **Si la app es una PWA usada en móvil**, el modo dual no es una preferencia, es obligatorio: quitar la web
  mata el caso de uso principal.
- **Si la app es arquetipo D disfrazado** (§1), el escritorio pasa a ser el canal *primario* y la web queda
  como modo de desarrollo. Aun así no se borra nada: el servidor local sigue ahí y sigue arrancando.
- **Si la app era una CLI**, el escritorio le añade una GUI. La CLI se conserva: son públicos distintos.

### 3.1 El patrón que hace barato el modo dual: una capa de adaptación

**Todo el coste de mantener los dos modos se concentra en una sola decisión: que el frontend no asuma
Tauri.** Si `invoke()` aparece esparcido por los componentes de la UI, el modo web muere solo y no hay vuelta
atrás sin refactor.

El patrón es un único módulo que detecta el entorno y enruta:

```js
// src/api.js — ÚNICO fichero de la app que sabe si estamos en Tauri o en el navegador
const runningInTauri = typeof window !== "undefined" && !!window.__TAURI__;

export async function convertImage(payload) {
  if (runningInTauri) {
    return window.__TAURI__.core.invoke("convert_image", payload);
  }
  const res = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

> ⚠️ **No llames `isTauri` a esta constante.** Con `"withGlobalTauri": true` (obligatorio para el patrón sin
> bundler, ver `NATIVE_DESKTOP_APPS.md` §3), Tauri v2 ya declara un global `isTauri` propio. En un script
> clásico (no ES module), declarar `const isTauri = ...` en el nivel superior de tu propio fichero choca con
> ese global y el fichero entero muere con `SyntaxError: Identifier 'isTauri' has already been declared` —
> error de *parseo*, así que ni un solo listener llega a registrarse y la interfaz queda completamente
> muerta sin ningún error visible en pantalla. Es el mismo tipo de fallo silencioso que la colisión entre
> dos ficheros propios (§3 de `NATIVE_DESKTOP_APPS.md`), solo que aquí el segundo declarante es el propio
> runtime de Tauri. Usa un nombre que no sea genérico ni relacionado con Tauri (`runningInTauri`,
> `isDesktopRuntime`, etc.).

Reglas de la capa:

- **Una sola función por operación de negocio**, no por endpoint. La firma la dicta lo que la UI necesita,
  no lo que el servidor expone.
- **Ningún otro fichero importa `window.__TAURI__` ni llama a `fetch` contra la API propia.** Esto es
  verificable en CI con un `grep` — hazlo, o la regla se erosiona en tres commits.
- **Los errores se normalizan aquí**: un `invoke()` rechaza con un string de Rust, un `fetch` devuelve un
  status HTTP. La UI debe ver un único formato de error.
- **Las capacidades exclusivas de escritorio se exponen como consulta, no como excepción**: un
  `export const canPickDirectory = runningInTauri;` permite a la UI ocultar un botón, en vez de esparcir
  condicionales por el árbol de componentes.

---

## 4. Backend no-Rust: reescribir o empaquetar como sidecar

La regla de decisión, y se aplica **por función, no por aplicación**:

> **Reescribe en Rust cuando la dependencia es un detalle de implementación.
> Mantén el runtime original como sidecar cuando la dependencia _es la razón de existir de la app_.**

| Señal | Decisión |
|---|---|
| El backend hace recorrido de directorios, borrado, copia, watching | **Rust** (`walkdir`, `notify`, `std::fs`) |
| Conversión de formatos de imagen | **Rust** (`image`, `webp`) |
| Peticiones HTTP, parseo JSON/CSV, plantillas | **Rust** (`reqwest`, `serde`, `csv`) |
| Inferencia ML con un modelo y un pipeline concretos (ASR, diarización, OCR) | **Sidecar** |
| Motores de documento maduros sin equivalente Rust (PDF complejo, OOXML) | **Sidecar** |
| La reescritura obligaría a rehacer el trabajo de GPU/CUDA ya validado | **Sidecar** |

**Por qué la regla se formula así:** reescribir un pipeline de inferencia en Rust no es traducir código, es
*cambiar de librería*. Sustituir un stack de ASR con alineamiento y diarización por un binding de Rust
significa perder funcionalidad que el usuario ya tiene, además de repetir toda la puesta a punto de GPU. Eso
no es una migración, es un producto distinto y peor.

En cambio, un backend que solo orquesta el sistema de ficheros es **la mejor candidatura posible a Rust**:
suele ser poco código, elimina el servidor local por completo, y el resultado nativo hace algo que el
navegador nunca podrá hacer — tocar el disco directamente, sin proceso intermedio ni puerto abierto.

### 4.1 Cómo se monta el sidecar

Tauri v2 soporta binarios externos de forma nativa:

- Se declara en `tauri.conf.json` → `bundle.externalBin`, con el sufijo de *target triple* por plataforma.
- Se lanza desde Rust con `tauri-plugin-shell` (`Command::new_sidecar`), y **el proceso hijo debe matarse
  explícitamente al cerrar la app** — un servidor local huérfano dejando el puerto ocupado es el fallo más
  reportado de este patrón.
- El puerto **no se cablea**: se pide uno libre al SO y se pasa al frontend, o se elimina el HTTP entero
  hablando por stdin/stdout. Un puerto fijo choca con la segunda instancia y con cualquier otra app.
- El runtime se congela con la herramienta de su ecosistema (PyInstaller y equivalentes) **en el runner de CI
  de cada plataforma** — no se puede congelar en una plataforma y distribuir en otra.

---

## 5. El coste oculto del sidecar: el tamaño del instalador

**Esta es la restricción que hay que aceptar antes de empezar, no descubrir al final.**

`NATIVE_DESKTOP_APPS.md` §1 promete instaladores de ~15-20 MB. **Un sidecar con un stack de ML congelado
convierte eso en varios GB.** Las consecuencias no son estéticas:

- Las tiendas curadas (Microsoft Store y equivalentes) dejan de ser un canal realista.
- El tiempo de build y el almacenamiento de artefactos en CI se disparan.
- La primera impresión del usuario pasa a ser una descarga larga.

Hay tres estrategias, y hay que elegir **antes** de montar el empaquetado:

| Estrategia | Cómo funciona | Cuándo elegirla |
|---|---|---|
| **A — Asistente de primera ejecución** ✅ | Instalador pequeño; en el primer arranque la app provisiona el entorno y descarga modelos, con progreso visible | **Por defecto.** Mantiene el instalador ligero y permite ofrecer variantes CPU/GPU sin recompilar |
| **B — Núcleo mínimo embebido + descarga opcional** | Se empaqueta la variante ligera (CPU, modelo pequeño); la aceleración por GPU se descarga bajo demanda | La app debe funcionar sin red desde el minuto uno |
| **C — Depender del runtime del sistema** ❌ | Se detecta un intérprete ya instalado | Descártala. Convierte la matriz de soporte en el entorno de cada usuario |

Elijas la que elijas: **el asistente debe ser cancelable y reintentable**, y la app debe arrancar y explicar
qué falta si el provisionamiento no se completó. Un fallo de descarga no puede dejar una app que no abre.

---

## 6. Auditoría de licencias antes de invertir

Empaquetar y **distribuir** un binario no es lo mismo que ejecutar un servidor local propio. Dependencias
que eran irrelevantes mientras la app era un `start.cmd` en tu máquina se convierten en una restricción de
distribución en cuanto hay un instalador.

**Haz esta auditoría antes de escribir código, no antes de publicar.** Con revisar el fichero de
dependencias del backend y buscar la licencia de cada una basta:

- **Copyleft fuerte (GPL/AGPL)** en una dependencia del backend obliga a liberar bajo la misma licencia o a
  comprar una licencia comercial al titular. Motores de PDF y de vídeo son el caso típico: son
  frecuentísimos, muy buenos, y **suelen ser AGPL con opción comercial de pago**.
- Si el plan incluye tienda o cualquier canal comercial, un hallazgo copyleft **cambia la decisión de §4**:
  puede convertir "sidecar" en "buscar una librería alternativa" o directamente en "esta app no va a tienda".
- Documenta el resultado en `ARCHITECTURE.md` del proyecto. Es una decisión arquitectónica, no un trámite.

---

## 7. Orden de migración cuando hay varias apps

Con un portfolio que migrar, el orden no es por valor de negocio sino **por riesgo de tubería**: lo que se
está depurando en las primeras migraciones no es la app, es el circuito
plantilla → build → CI en tres plataformas → instalador.

1. **Primero, la app de arquetipo A más pequeña.** Es el ensayo del circuito completo con **cero riesgo de
   backend**. Si algo falla aquí, falla la tubería — que es exactamente lo que se quiere aislar.
2. **Después, un arquetipo C.** Valida el camino de reescritura en Rust y suele ser la primera migración con
   valor nativo real y visible.
3. **Después, un arquetipo B.** Valida el camino "con bundler", que es el que se usará en cualquier app seria
   posterior.
4. **Los arquetipos D, al final.** Se llega a ellos con la tubería ya fiable y con la decisión de §5 y §6
   tomada por escrito.

Con los tres primeros hechos, la plantilla queda validada en los tres escenarios de frontend y la CI probada
en las tres plataformas. Empezar por un arquetipo D significa depurar a la vez la CI multiplataforma, el
empaquetado del sidecar y el tamaño del instalador — tres problemas nuevos que se enmascaran entre sí.

---

## 8. Checklist de migración

Por cada app, en orden:

- [ ] Arquetipo identificado (§1) mirando el fichero de dependencias real, no el README.
- [ ] Auditoría de licencias del backend hecha y anotada en `ARCHITECTURE.md` (§6).
- [ ] Rama `feat/tauri-desktop` creada **en el repo existente** (§2).
- [ ] `dbv-specs-ops` presente y al día — `UPGRADE_PROMPT.md` ejecutado si ya estaba (§2).
- [ ] `src-tauri/` y los 3 workflows de release traídos de la plantilla (§2).
- [ ] Capa de adaptación `api.js` creada y **verificada con un `grep` en CI** de que nadie más llama a
      `invoke()` ni a la API propia (§3.1).
- [ ] Decisión Rust vs sidecar tomada **por función** y registrada como ADR en `memory.md` (§4).
- [ ] Si hay sidecar: estrategia de instalación elegida (§5) y proceso hijo con cierre explícito verificado.
- [ ] `tauri.conf.json`: `productName`, `identifier` e iconos propios de la app (no los de la plantilla).
- [ ] Modo web verificado **después** de la migración: sigue arrancando y funcionando (§3).
- [ ] **DoD de Experiencia de Escritorio cumplida** — los 6 criterios de `NATIVE_DESKTOP_APPS.md` §7
      (diálogos nativos, iconografía propia, atajos, menú de macOS, scrollbars/layout, tooltips de atajos).
      Son criterios de aceptación, no pulido posterior.
- [ ] **El ejecutable real lanzado y usado**, no solo compilado — "el bundle se generó" no es "la app
      funciona".
- [ ] Versión sincronizada en `package.json`, `tauri.conf.json`, `Cargo.toml` y el "Acerca de" de la UI.
- [ ] Build local en las tres plataformas o, en su defecto, primer tag `vX.Y.Z` con los 3 workflows en verde.
- [ ] `SPECIFICATIONS.md` actualizado: el escritorio es un requisito nuevo, no un detalle de despliegue.

---

## 9. Si la app usa un framework con bundler (React/Vue/Svelte + Vite)

El patrón sin bundler de `NATIVE_DESKTOP_APPS.md` §3 no aplica: aquí `beforeDevCommand`/`beforeBuildCommand`
invocan el build del bundler y `frontendDist` apunta a su salida (`dist/`). Tres cosas que solo aparecen en
esta ruta:

- **Los listeners de eventos nativos son una fuente clásica de closures obsoletas.** Suscribir
  `listen('menu-open-file', ...)` o `onCloseRequested` dentro de un `useEffect` con array de dependencias
  vacío captura la primera versión de unos handlers que sí cambian de referencia entre renders — el menú
  nativo acaba guardando contenido antiguo, y el bug es intermitente y difícil de atribuir al menú. Guarda
  el handler vivo en un `ref` actualizado en cada render y suscríbete una sola vez leyendo ese `ref`.
- **Excluye `src-tauri/` del linter.** ESLint (u otro) recorrerá alegremente el JavaScript generado por
  Cargo dentro de `src-tauri/target/` y llenará el informe de ruido ajeno al proyecto.
- **Código muerto de detección de entorno.** Es habitual acabar con un `utils/platform.ts::isTauri()` sin
  ninguna referencia, porque la detección real vive en la capa de adaptación de §3.1. Una sola fuente de
  verdad para "¿estamos en escritorio?" — la de `api.js` — y el resto se borra.
