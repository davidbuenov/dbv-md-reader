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

Este mismo fallo aparece antes en local que en CI, y ahí es más engañoso: encadenar
`tauri build && <paso siguiente>` en un script de `package.json` hace que el paso siguiente (renombrar el
instalador, copiarlo, etc.) **nunca se ejecute** en cualquier build local sin las variables de firma —
sin ningún error que lo explique, porque el instalador sí se generó. Cuando el comando previo puede
"fallar" por un motivo secundario ajeno al artefacto que de verdad importa, usa un orquestador
(`spawnSync` en un `scripts/build.mjs`) que ejecute siempre ambos pasos y decida el código de salida final
combinando los dos resultados, en vez de `&&`.

## 6bis. Los nombres de input de una Action de terceros cambian entre versiones — y un input inválido no rompe el build

`tauri-apps/tauri-action` renombró inputs entre versiones sin que `@v0` deje de aceptar los antiguos en
silencio: se configuró `uploadUpdaterJson: false` siguiendo documentación previa cuando el input real de la
versión que de verdad corría era `includeUpdaterJson`. GitHub Actions **no falla** ante un input
desconocido, solo emite un aviso — así que la opción quedó sin efecto y pasó desapercibida.

**Regla:** para acciones de terceros con alta velocidad de cambio, un `WebFetch` puntual de la documentación
no es verificación suficiente. Tras el **primer run real**, abre el log completo y lee el aviso
`Unexpected input(s) ...` de la propia Action — enumera los inputs válidos exactos de la versión que se
ejecutó, que es la única fuente fiable. Corrige contra esa lista, no contra la documentación.

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
[`MARKETPLACE_PUBLISHING.md`](./MARKETPLACE_PUBLISHING.md).

## 9. Plantillas completas de workflow (Windows, Linux, macOS)

Los fragmentos de las secciones anteriores son principios; estas son las 3 plantillas completas y copiables
que los aplican todos a la vez, validadas contra ejecuciones reales de GitHub Actions. Build sin firmar en
las 3 plataformas (§8), sin artefactos de actualizador (§6) — el punto de partida más simple que funciona de
extremo a extremo el primer día, antes de añadir firma/notarización/auto-actualización más adelante si hace
falta. Los 3 comparten el mismo patrón: leer la versión desde `src-tauri/tauri.conf.json` (§3), input
`draft` para poder relanzar manualmente sobre una Release ya publicada (§2), y `permissions: contents:
write` acotado al propio job (§4).

### `release-windows.yml`

```yaml
name: Release Windows

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:
    inputs:
      draft:
        description: >
          "true" (normal): crea/usa un borrador para esa versión. "false": la Release de esa
          versión ya está PUBLICADA y solo quieres añadirle artefactos de esta plataforma.
        required: false
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

jobs:
  build-windows:
    runs-on: windows-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5

      - name: Leer versión de tauri.conf.json
        id: version
        run: echo "tag=v$(node -p "require('./src-tauri/tauri.conf.json').version")" >> "$env:GITHUB_OUTPUT"

      - name: Determinar si la Release debe crearse/tratarse como borrador
        id: draft
        run: |
          if ("${{ github.event_name }}" -eq "workflow_dispatch") {
            "value=${{ github.event.inputs.draft }}" >> $env:GITHUB_OUTPUT
          } else {
            "value=true" >> $env:GITHUB_OUTPUT
          }

      - name: Instalar Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Instalar Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24

      - name: Instalar dependencias de Node
        run: npm install

      - name: Build y Release (Windows)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ steps.version.outputs.tag }}
          releaseName: ${{ steps.version.outputs.tag }}
          releaseDraft: ${{ steps.draft.outputs.value }}
          prerelease: false
          includeUpdaterJson: false
```

### `release-linux.yml`

```yaml
name: Release Linux

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:
    inputs:
      draft:
        description: >
          "true" (normal): crea/usa un borrador para esa versión. "false": la Release de esa
          versión ya está PUBLICADA y solo quieres añadirle artefactos de esta plataforma.
        required: false
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

jobs:
  build-linux:
    runs-on: ubuntu-22.04
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5

      - name: Leer versión de tauri.conf.json
        id: version
        run: echo "tag=v$(node -p "require('./src-tauri/tauri.conf.json').version")" >> "$GITHUB_OUTPUT"

      - name: Determinar si la Release debe crearse/tratarse como borrador
        id: draft
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "value=${{ github.event.inputs.draft }}" >> "$GITHUB_OUTPUT"
          else
            echo "value=true" >> "$GITHUB_OUTPUT"
          fi

      # Dependencias de sistema para compilar Tauri v2 en un runner Ubuntu — ver también §5 de
      # NATIVE_DESKTOP_APPS.md sobre la diferencia de comportamiento entre .deb y .AppImage.
      - name: Instalar dependencias del sistema (WebKitGTK)
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils

      - name: Instalar Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Instalar Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24

      - name: Instalar dependencias de Node
        run: npm install

      - name: Build y Release (Linux)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ steps.version.outputs.tag }}
          releaseName: ${{ steps.version.outputs.tag }}
          releaseDraft: ${{ steps.draft.outputs.value }}
          prerelease: false
          includeUpdaterJson: false
```

### `release-macos.yml`

```yaml
name: Release macOS

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:
    inputs:
      draft:
        description: >
          "true" (normal): crea/usa un borrador para esa versión. "false": la Release de esa
          versión ya está PUBLICADA y solo quieres añadirle artefactos de esta plataforma.
        required: false
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

jobs:
  build-macos:
    runs-on: macos-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v5

      - name: Leer versión de tauri.conf.json
        id: version
        run: echo "tag=v$(node -p "require('./src-tauri/tauri.conf.json').version")" >> "$GITHUB_OUTPUT"

      - name: Determinar si la Release debe crearse/tratarse como borrador
        id: draft
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "value=${{ github.event.inputs.draft }}" >> "$GITHUB_OUTPUT"
          else
            echo "value=true" >> "$GITHUB_OUTPUT"
          fi

      # macos-latest es Apple Silicon — sin el target universal, un Mac Intel no podría ejecutar
      # el binario (ver §5, gotcha real de runners).
      - name: Instalar Rust (targets Intel + Apple Silicon)
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: "aarch64-apple-darwin,x86_64-apple-darwin"

      - name: Instalar Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24

      - name: Instalar dependencias de Node
        run: npm install

      - name: Build y Release (macOS)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: --target universal-apple-darwin
          tagName: ${{ steps.version.outputs.tag }}
          releaseName: ${{ steps.version.outputs.tag }}
          releaseDraft: ${{ steps.draft.outputs.value }}
          prerelease: false
          includeUpdaterJson: false
```

**Cuándo dejan de bastar estas plantillas:** en cuanto se añada firma de código en cualquier plataforma
(certificado Authenticode en Windows, notarización de Apple en macOS) o auto-actualización con
`tauri-plugin-updater` — en ambos casos hay que inyectar secretos de firma vía `env`/`secrets` en el paso de
`tauri-action` y quitar `includeUpdaterJson: false` (más `createUpdaterArtifacts: false` del `tauri.<platform>.conf.json`
correspondiente, §6) solo en las plataformas que de verdad tengan ya la clave configurada.
