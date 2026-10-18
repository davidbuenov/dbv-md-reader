# 📦 Propuesta de actualización para dbv-specs-ops — Apps de escritorio nativas, CI multiplataforma y publicación en marketplaces

> **Origen:** conocimiento real extraído de `dbv-md-reader` (Rust + Tauri v2), 25 fases de desarrollo, 20 ADRs en `memory.md`, dos workflows de GitHub Actions ejecutados de verdad contra runners reales, y un ciclo completo de publicación en Microsoft Store (aprobado, con un rechazo real de por medio) + envío a Uptodown.
> **Destino:** este documento es un **insumo para quien mantiene el framework `dbv-specs-ops`** (repo separado, hoy gestionado desde Antigravity), no forma parte de la documentación del proyecto `dbv-md-reader`. Contiene propuestas de contenido listas para incorporar a `docs/MASTER_PROMPT.md` y a nuevos ficheros de `docs/`.
> **Por qué importa:** el framework hoy cubre muy bien apps **web** (Python/Node/React) pero no tiene ninguna cobertura para apps de **escritorio compiladas y distribuidas en múltiples plataformas** — ni como opción de stack, ni como patrón de CI, ni como checklist de publicación en tiendas de apps. Esto es un hueco real: cualquier proyecto Tauri/Electron/similar que use `dbv-specs-ops` hoy tendría que redescubrir desde cero todo lo que sigue.

---

## 1. Resumen ejecutivo — huecos detectados

| # | Hueco actual en dbv-specs-ops | Impacto |
|---|---|---|
| 1 | El Bootstrap (`MASTER_PROMPT.md` §7, "Tecnologías y Stack Recomendado") solo ofrece Backend Python/Node, Frontend React y BD — **no existe opción de app de escritorio nativa** | El agente no propone Tauri (ni ningún stack de escritorio) aunque sea la elección técnica correcta para el proyecto descrito |
| 2 | No hay ningún documento que explique el patrón de **CI multiplataforma para compilar binarios nativos** (matriz de runners, versión leída de config, releases como borrador acumulativo, permisos de `GITHUB_TOKEN`) | Cada proyecto reinventa (y probablemente rompe) su propio pipeline de Release, repitiendo errores ya resueltos aquí |
| 3 | No hay ningún documento sobre **publicación en marketplaces de apps** (Microsoft Store, catálogos tipo Uptodown, etc.) — requisitos de firma, formatos de paquete, políticas de certificación, diferencias de formulario entre tiendas | Riesgo real de rechazo en certificación (nos pasó) o de bloquearse meses en "voy a comprar un certificado" cuando hay una vía gratuita |
| 4 | No hay ningún ADR/lección **transferible entre proyectos** sobre patrones de arquitectura de apps nativas (sanitización en la capa correcta, file watching atómico, instancia única, actualizador con clave de firma) — hoy vive solo en `memory.md` de este proyecto concreto, con lenguaje específico del lector de Markdown | Conocimiento valioso y ya pagado (en tiempo de debugging) que se pierde para el siguiente proyecto |

---

## 2. Cambios propuestos, archivo por archivo

| Archivo del framework | Acción | Resumen |
|---|---|---|
| `docs/MASTER_PROMPT.md` (Bootstrap, §7) | **Modificar** | Añadir opción de stack "Aplicación de escritorio nativa multiplataforma: Rust + Tauri v2" a la lista de defaults propuestos |
| `docs/MASTER_PROMPT.md` (`<workflow>`, fase `/plan` y `/ship`) | **Modificar** | Añadir dos Phase Gates nuevos: "si es app compilada, planifica la matriz de CI multiplataforma en `/plan`" y "si el proyecto se distribuye en una tienda de apps, ejecuta el checklist de `MARKETPLACE_PUBLISHING.md` antes de `/ship`" |
| `docs/NATIVE_DESKTOP_APPS.md` | **Crear** | Tauri v2 como stack de referencia: arquitectura, patrones de IPC, y 8 lecciones de arquitectura transferibles (sanitización, file watching, instancia única, actualizador, i18n sin librería) |
| `docs/NATIVE_APPS_RELEASE_CI.md` | **Crear** | Patrón de CI/CD multiplataforma con GitHub Actions: matriz de plataformas, releases como borrador acumulativo, gotchas reales de Windows/Linux/macOS |
| `docs/MARKETPLACE_PUBLISHING.md` | **Crear** | Checklist y comparativa de canales de distribución (self-hosted vs. tienda curada vs. catálogo de terceros), con el caso real Microsoft Store + Uptodown |
| `docs/README.md` (índice) | **Modificar** | Añadir las 3 filas nuevas a la tabla de índice, condicionadas a "solo si el proyecto es una app de escritorio compilada" |
| `CHANGELOG.md` del framework | **Modificar** | Entrada de versión nueva describiendo esta ampliación |

Las secciones 3–5 de este documento contienen el contenido ya redactado, listo para pegar en cada fichero nuevo/modificado.

---

## 3. Contenido propuesto — `docs/MASTER_PROMPT.md`

### 3.1 Nueva opción en el Bootstrap (§7 "Tecnologías y Stack Recomendado")

Añadir esta cuarta opción a la lista existente (Backend Python / Backend Node.js / Frontend / Base de Datos):

```markdown
- **Aplicación de escritorio nativa multiplataforma:** Rust + Tauri v2 (WebView nativo del SO: WebView2 en Windows, WebKitGTK en Linux, WKWebView en macOS) + frontend HTML/CSS/JS vanilla (o React/Vite si el proyecto ya lo requiere) — ver `dbv-specs-ops/docs/NATIVE_DESKTOP_APPS.md` para el patrón de referencia completo. Preferir sobre Electron por defecto salvo que el proyecto ya dependa de un ecosistema Node/Electron específico: instalador/binario final un orden de magnitud más ligero (~10-20 MB vs. ~100+ MB) y consumo de RAM muy inferior en reposo, a cambio de asumir Rust en el backend.
```

### 3.2 Nuevo Phase Gate en `/plan` (dentro de `<workflow>`, punto 2)

Añadir como sub-punto del Paso 3 (Phase Gate):

```markdown
- **Gate de app nativa compilada:** si el proyecto produce un binario/instalador (Tauri, Electron, o equivalente) que debe distribuirse en más de una plataforma (Windows/Linux/macOS), el plan de `/plan` DEBE incluir explícitamente qué combinación de CI (GitHub Actions u otro) va a compilar cada plataforma, y si cada plataforma tendrá Release oficial automatizada o solo auto-compilación por el usuario — ver `dbv-specs-ops/docs/NATIVE_APPS_RELEASE_CI.md`. No asumir que "funciona en mi máquina Windows" implica que compilará en Linux/macOS sin cambios: la compilación cruzada de binarios nativos no existe de forma fiable para este tipo de stack, así que la única verificación real es un runner de esa plataforma en CI.
```

### 3.3 Nuevo Phase Gate en `/ship` (dentro de `<workflow>`, punto 6)

Añadir como sub-punto:

```markdown
- **Gate de publicación en marketplace:** si esta entrega va a publicarse (o actualizarse) en una tienda de apps (Microsoft Store, Mac App Store, catálogos como Uptodown, etc.), ejecuta el checklist de `dbv-specs-ops/docs/MARKETPLACE_PUBLISHING.md` antes de dar la tarea por cerrada — en particular la verificación de assets generados automáticamente (nunca asumir que un icono/tile generado por una herramienta de empaquetado es correcto sin abrirlo).
```

---

## 4. Contenido propuesto — `docs/NATIVE_DESKTOP_APPS.md` (nuevo)

```markdown
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

Para el patrón de CI que compila cada plataforma y las particularidades de cada tienda de apps, ver
`docs/NATIVE_APPS_RELEASE_CI.md` y `docs/MARKETPLACE_PUBLISHING.md`.
```

---

## 5. Contenido propuesto — `docs/NATIVE_APPS_RELEASE_CI.md` (nuevo)

```markdown
# 🚀 CI/CD Multiplataforma para Apps Nativas Compiladas (GitHub Actions)

> Patrón de referencia para compilar y publicar una app de escritorio nativa (Tauri, o similar) en
> Windows, Linux y macOS, validado contra ejecuciones reales de GitHub Actions.

## 1. Principio: no existe compilación cruzada fiable

Para apps nativas compiladas (Tauri/Electron con módulos nativos/etc.), compilar el binario de una
plataforma requiere un runner de **esa misma plataforma**. No asumir que "funciona en Windows" implica que
compilará en Linux/macOS — la única verificación real es un job de CI corriendo en `ubuntu-*` / `macos-*`
respectivamente. Un workflow por plataforma (`release-windows.yml`, `release-linux.yml`,
`release-macos.yml`) es más simple de razonar y depurar que una única matriz condicional.

## 2. Patrón "Release como borrador acumulativo"

Cuando la publicación de alguna plataforma sigue siendo manual (p. ej. Windows con firma local de
actualizador) y otras se automatizan por CI, el patrón que funciona bien es:

- Cada workflow de plataforma automatizada construye su(s) artefacto(s) y los **adjunta a un borrador**
  (`releaseDraft: true`) de GitHub Release para el tag correspondiente — si el borrador no existe, la
  acción de release lo crea; si ya existe, añade los artefactos nuevos sin tocar los existentes.
- El mantenedor completa ese mismo borrador subiendo a mano los artefactos de la plataforma no automatizada,
  y pulsa "Publish" cuando están todos.
- Soportar también `workflow_dispatch` con un input `draft` (`true`/`false`) para poder re-lanzar el
  workflow **después** de que la Release ya esté publicada (p. ej. añadir macOS más tarde a una versión que
  ya salió solo con Windows+Linux) — la acción de release típica **falla** si le pides `draft: true` y solo
  existe ya una Release publicada con ese tag (no la encuentra, no la toca), así que hay que poder pedir
  explícitamente `draft: false` para ese caso.

```yaml
on:
  push:
    tags: ["v*.*.*"]
  workflow_dispatch:
    inputs:
      draft:
        description: >
          "true" (normal): crea/usa un borrador para esa versión. "false": la Release de esa
          versión ya está PUBLICADA y solo quieres añadirle artefactos de esta plataforma.
        required: false
        default: "true"
        type: choice
        options: ["true", "false"]
```

## 3. Leer la versión del fichero de configuración, no de `github.ref_name`

Leer la versión desde el propio fichero de configuración del proyecto (p. ej. `tauri.conf.json`) en vez de
derivarla del tag que disparó el workflow permite relanzar el workflow manualmente sobre la rama principal
(vía `workflow_dispatch`) para adjuntar artefactos de una plataforma a una Release cuyo tag ya existe, sin
depender de empujar un tag nuevo:

```yaml
- name: Leer versión del fichero de configuración
  id: version
  run: echo "tag=v$(node -p "require('./ruta/al/config.json').version")" >> "$GITHUB_OUTPUT"
```

## 4. Permisos de `GITHUB_TOKEN`: conceder por workflow, no globalmente

El `GITHUB_TOKEN` por defecto de un repo suele ser de **solo lectura** (Settings → Actions → Workflow
permissions). Sin escritura explícita, cualquier acción que suba artefactos a una Release falla con
`Resource not accessible by integration`. Conceder el permiso **solo al workflow que lo necesita**, no como
valor por defecto de todo el repositorio (menor privilegio):

```yaml
jobs:
  build:
    permissions:
      contents: write
```

## 5. Gotcha real — runners macOS son Apple Silicon por defecto

Desde que GitHub cambió `macos-latest` a runners Apple Silicon, compilar **sin especificar target** produce
un binario de una sola arquitectura (`aarch64`), no un binario universal. Un Mac Intel no puede ejecutarlo
(Rosetta traduce x86_64→Apple Silicon, no al revés). Si se quiere dar soporte a Mac Intel, hay que pedir
explícitamente el target universal e instalar ambos targets de Rust antes del build:

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: "aarch64-apple-darwin,x86_64-apple-darwin"
# ...
- uses: tauri-apps/tauri-action@v0
  with:
    args: --target universal-apple-darwin
```

**Lección general:** al añadir un job de CI nuevo para una plataforma, no asumir que "sin especificar
arquitectura/target" produce el build más compatible por defecto — verificarlo explícitamente contra la
documentación actual del runner, que cambia con el tiempo.

## 6. Gotcha real — artefactos de auto-actualización rompen el build si faltan las claves

Si el framework de empaquetado soporta generar artefactos firmados para auto-actualización (`.sig`,
manifiesto de versión) pero esa plataforma **no** tiene todavía las variables de entorno de firma
configuradas en CI, el build completo puede fallar (exit 1) en vez de simplemente omitir ese paso — aunque
el propio instalador/paquete se genere bien. Hay que desactivar explícitamente la generación de artefactos
de actualización para esa plataforma hasta que se resuelva la firma cross-máquina (ver §7):

```json
// tauri.<platform>.conf.json de la plataforma sin firma todavía
{ "bundle": { "createUpdaterArtifacts": false } }
```

```yaml
- uses: tauri-apps/tauri-action@v0
  with:
    includeUpdaterJson: false
```

## 7. Deuda técnica aceptable: firma cross-máquina no resuelta

Si el par de claves de firma del actualizador se usa hoy solo en la máquina local donde se firma el build
de una plataforma (p. ej. Windows), fusionar en un único manifiesto de actualización (`latest.json`) una
firma generada en CI (otra plataforma) con otra generada en local introduce una coordinación cross-máquina
real. Es preferible **documentarlo explícitamente como deuda técnica consciente** (esa plataforma queda sin
auto-actualización hasta resolverlo) que improvisar una coordinación frágil bajo presión de tiempo.

## 8. Builds sin firmar como estrategia intermedia legítima

Publicar un binario sin firma de código ni notarización (coste real: cuenta de desarrollador de pago +
verificación de identidad recurrente) es una decisión de producto válida cuando ese coste no está
justificado por el volumen de usuarios — no es un atajo vergonzoso, es una decisión consciente. Lo que sí es
obligatorio: documentar para el usuario final cómo abrir un binario sin firmar pese al aviso del sistema
operativo (SmartScreen en Windows: "Más información" → "Ejecutar de todas formas"; Gatekeeper en macOS: clic
derecho → Abrir, o `xattr -cr` sobre el `.app`).

Para el checklist de qué exige cada tienda de apps en materia de firma/certificación, ver
`docs/MARKETPLACE_PUBLISHING.md`.
```

---

## 6. Contenido propuesto — `docs/MARKETPLACE_PUBLISHING.md` (nuevo)

```markdown
# 🏬 Publicación en Marketplaces de Apps — Guía General

> Checklist y comparativa de canales de distribución para apps nativas, validado contra una publicación
> real en Microsoft Store (aprobada, con un rechazo real de por medio) y un envío real a Uptodown.

## 1. Comparativa de canales de distribución

| Canal | Ejemplo | Firma de código | Coste | Revisión | Actualizaciones |
|---|---|---|---|---|---|
| **Self-hosted** | GitHub Releases | Opcional (recomendable con clave propia tipo minisign) | Gratis | Ninguna, publicas cuando quieras | Gestionadas por ti (p. ej. `tauri-plugin-updater`) |
| **Tienda curada con auto-firma** | Microsoft Store (vía MSIX) | **La tienda firma el paquete automáticamente** tras certificación — no hace falta comprar certificado | Gratis (cuenta de desarrollador individual) | Automatizada + manual, días | Gestionadas por la tienda/SO |
| **Tienda curada con firma propia** | Mac App Store, listado "EXE/MSI" de Microsoft Store | Certificado propio obligatorio (Apple Developer 99$/año, o Authenticode de una CA del Trusted Root Program) | Recurrente | Manual, revisión estricta | Gestionadas por la tienda |
| **Catálogo de terceros** | Uptodown y similares | Normalmente **no exige firma de plataforma** | Gratis | Editorial, manual, sin plazo garantizado | No integradas — el usuario reinstala la nueva versión |

**Decisión clave a no dar por hecha:** antes de asumir que hace falta comprar un certificado de firma de
código, comprobar si la tienda ofrece una vía de **auto-firma tras certificación** (como el MSIX de
Microsoft Store) — puede eliminar el bloqueo más caro y lento del proceso a cambio de un empaquetado
adicional, que sí es automatizable con código.

## 2. Antes de adoptar una herramienta de empaquetado de terceros

Si el framework de la app no genera nativamente el formato que exige la tienda (p. ej. Tauri no genera MSIX
de fábrica), y hace falta una herramienta de terceros no oficial, auditarla antes de instalarla:

- [ ] Licencia compatible (MIT/Apache/etc.), sin cláusulas restrictivas.
- [ ] Señal de adopción real (miles de descargas/mes, no un paquete recién publicado con 3 estrellas).
- [ ] Cadena de suministro: publicada vía CI con *trusted publishing*/OIDC (sin token npm manual filtrable)
      es una señal fuerte de buena higiene.
- [ ] Sin issues de seguridad abiertos relevantes en su repositorio.
- [ ] Verificar el flag/parámetro correcto para invocar el CLI subyacente del framework si el proyecto no
      usa la extensión "estándar" (p. ej. si Tauri se invoca vía `@tauri-apps/cli`/npm en vez de la
      extensión `cargo-tauri`, la herramienta puede necesitar un flag `--runner npm` explícito o fallar
      buscando un comando que no existe en el proyecto).

## 3. Gotcha real — assets generados automáticamente pueden ser placeholders silenciosos

Si una herramienta de empaquetado genera automáticamente los iconos/tiles/assets de marketing requeridos
por una tienda (componiendo el icono real sobre un lienzo de un tamaño específico), esa composición puede
fallar silenciosamente para *algunos* tamaños y caer a una imagen de repuesto (p. ej. un rectángulo de color
sólido) sin lanzar ningún error visible durante el build. Ese placeholder puede pasar desapercibido durante
meses hasta que la propia tienda lo rechaza en certificación citando una política concreta.

**Checklist obligatorio antes de cada envío/reenvío a certificación:**

- [ ] Abrir visualmente **cada** asset generado automáticamente (iconos en todos los tamaños exigidos), no
      solo el icono principal.
- [ ] Si hay muchos assets, verificar por script que ninguno sea de un único color sólido (heurística barata
      de "esto es un placeholder", no una prueba exhaustiva pero sí una red de seguridad rápida).
- [ ] Repetir esta verificación en **cada** reenvío tras un rechazo, no solo la primera vez — el bug puede
      haberse introducido en cualquier sesión de pulido visual anterior, no necesariamente en la más reciente.

## 4. Los formularios de cada tienda no son intercambiables

No asumir que el texto/ficha ya redactado para una tienda encaja en el formulario de otra, aunque el
producto sea el mismo. Verificar contra la documentación oficial de cada tienda antes de rellenar:

- Límites de longitud de campos (p. ej. una descripción corta puede ser de 70 caracteres en un catálogo y de
  270 en otro).
- Campos exigidos por una tienda que la otra no tiene (licencia, web oficial, nacionalidad del desarrollador,
  etc.).
- Formatos de artefacto aceptados por plataforma (p. ej. un catálogo puede exigir `.dmg` y rechazar
  `.app.tar.gz` para macOS).
- **Cobertura real de plataformas del catálogo** — no asumir que un catálogo genérico "de apps" acepta todas
  las plataformas que tu proyecto compila; verificarlo leyendo su ayuda oficial (un catálogo real consultado
  en este proyecto solo admite Android/Windows/macOS, sin Linux, pese a distribuir binarios Linux por otros
  canales).

## 5. Coexistencia de canales de distribución

Cuando el mismo producto se distribuye simultáneamente self-hosted y en una tienda curada:

- Ambos canales pueden coexistir sin conflicto técnico si tienen **identidad de paquete distinta** (p. ej.
  un instalador NSIS y un MSIX son instalaciones independientes en el sistema del usuario).
- Documentar explícitamente, de cara al usuario final, qué mecanismo de actualización usa cada canal — un
  usuario que instale desde la tienda no debería ver ni depender del botón de actualización manual del canal
  self-hosted (ver lección 6 en `docs/NATIVE_DESKTOP_APPS.md`).
- Si se hace un rebrand o cambio de identificador de producto entre versiones, evaluar explícitamente el
  riesgo de que los usuarios existentes vean una instalación **nueva y paralela** en vez de una actualización
  in-place — es un riesgo real y ya observado, no hipotético.

## 6. Checklist de envío (genérico, adaptar por tienda)

1. Reservar/verificar el nombre e identidad del producto en la consola de la tienda.
2. Copiar la identidad real (publisher ID, identificador de paquete) a la configuración de empaquetado del
   proyecto — verificar que el manifiesto generado coincide **exactamente** con lo mostrado en la consola de
   la tienda antes de enviar.
3. Regenerar el paquete final con esa identidad.
4. Publicar/enlazar una política de privacidad si la tienda la exige (casi todas la exigen si la app accede
   a datos de cualquier forma, aunque sea solo a petición explícita del usuario).
5. Rellenar la ficha de producto (descripción, capturas, categoría, edad recomendada) **con los límites
   reales de esa tienda**, no reutilizando sin revisar el texto de otra.
6. Verificar todos los assets generados automáticamente (§3).
7. (Recomendado) Pasar cualquier kit de certificación local que ofrezca la tienda antes de enviar.
8. Enviar a certificación. Si es rechazado, leer la política citada literalmente antes de asumir la causa —
   la causa raíz puede no ser obvia desde la descripción del rechazo (en este proyecto, "tile con imagen por
   defecto" resultó ser un fallo silencioso de generación de assets, no una omisión de subida).
```

---

## 7. Próximos pasos sugeridos para quien aplique esto (Antigravity)

1. **Crear** los tres ficheros nuevos en `dbv-specs-ops/docs/` del repo del framework con el contenido de
   las secciones 4, 5 y 6 (ya en formato markdown listo para pegar).
2. **Modificar** `docs/MASTER_PROMPT.md` según §3 (nueva opción de stack en Bootstrap + dos Phase Gates
   nuevos en `/plan` y `/ship`).
3. **Modificar** `docs/README.md` (índice) añadiendo las tres filas nuevas, marcadas como condicionales:
   *"Fill in only if the project is a compiled multi-platform desktop app"*.
4. **Versionar**: esto es una ampliación de cobertura del framework (nuevo stack + dos documentos
   operativos nuevos), no un cambio incompatible — encaja como `MINOR` en el `CHANGELOG.md` del framework.
5. **Opcional, no bloqueante:** considerar si `ADOPTION_PROMPT.md` (onboarding SDD sobre proyecto existente)
   necesita también detectar automáticamente un `src-tauri/` o `Cargo.toml` para sugerir estos documentos
   nuevos al adoptar SDD sobre un proyecto Tauri ya iniciado.

---

> Generado a partir de la experiencia real de `dbv-md-reader` (repo del proyecto, no del framework) —
> ver `dbv-specs-ops/memory.md` (ADR-001 a ADR-020) y `dbv-specs-ops/docs/MICROSOFT_STORE.md` para el
> detalle completo, no generalizado, del que se extrajo este documento.
