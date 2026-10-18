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

## 6ter. Gotcha real — el AppImage de Tauri no arranca si lo ejecuta otro usuario

linuxdeploy (el empaquetador que usa `tauri build` para el `.AppImage`) deja `AppRun.wrapped` con
permisos `0770`, y dentro del squashfs todo pertenece a `root`. En un escritorio normal **no se nota**:
el runtime FUSE monta los ficheros con el uid del usuario que lo ejecuta. Pero cualquier entorno que
lo ejecute como "otros" —firejail, algunos sandboxes, y en concreto el test automático del catálogo
[AppImageHub](https://appimage.github.io)— falla con
`AppRun: line 12: .../AppRun.wrapped: Permission denied` y la app no llega a abrir ventana.

Detectado en producción (2026-09-28) en dos apps a la vez: el workflow `discover-apps.yml` de
AppImageHub abre **por su cuenta** un PR de alta en el catálogo para cualquier repo que publique
AppImages, lo prueba y comenta el fallo mencionando al autor. Ver `MARKETPLACE_PUBLISHING.md` §1.

**Cómo diagnosticarlo** sin Linux nativo (WSL basta): el offset del squashfs lo da el propio runtime,
`APPIMAGE_EXTRACT_AND_RUN=1 ./App.AppImage --appimage-offset`, y luego
`unsquashfs -o <offset> -lls App.AppImage | grep AppRun`. Si `AppRun.wrapped` sale `-rwxrwx---`,
es este problema.

**Regla:** tras `tauri-action`, un paso que extraiga el AppImage (`--appimage-extract`, no necesita
FUSE), normalice permisos con `chmod -R u+rwX,go+rX,go-w`, reempaquete con `appimagetool`, **verifique
sobre el AppImage ya reempaquetado** (no sobre el directorio) y sustituya el asset con
`gh release upload --clobber`. Dos trampas del propio paso:

- `appimagetool` es a su vez un AppImage: en el runner, `APPIMAGE_EXTRACT_AND_RUN=1` evita depender de FUSE.
- GitHub **cambia los espacios del nombre del asset por puntos** (`My App_1.0.0_amd64.AppImage` →
  `My.App_1.0.0_amd64.AppImage`). `--clobber` compara con el nombre local, así que hay que subir una
  copia ya renombrada con puntos o fallará con "asset already exists".

El paso completo está en la plantilla `release-linux.yml` de §9. Para una Release ya publicada, basta
relanzar el workflow con `draft: false`; si un Cask de Homebrew referencia el AppImage, hay que
recalcular su sha256 (cambia al reempaquetar).

## 6quater. Actualizaciones incrementales del AppImage (`.zsync`) — y tres trampas

Un AppImage puede llevar **información de actualización** incrustada: AppImageUpdate y las
herramientas compatibles descargan entonces solo los bloques que cambian entre versiones, usando un
fichero `.zsync` publicado junto al AppImage. El test de AppImageHub avisa (sin bloquear) si falta.
Se añade en el mismo paso de reempaquetado de §6ter, con `appimagetool -u`:

```
gh-releases-zsync|<dueño>|<repo>|latest|<Nombre>_*_amd64.AppImage.zsync
```

No choca con el auto-actualizador de Tauri: en Linux está desactivado (§7). Trampas, comprobadas en
el código de `appimagetool` y en WSL sobre un AppImage publicado (2026-09-28, DBV Typst Editor 0.12.0):

1. **`appimagetool` no genera el `.zsync` por sí mismo:** llama a `zsyncmake`, y si no está **se lo
   salta sin fallar**. Hay que instalar el paquete `zsync` y comprobar que el `.zsync` existe.
2. **La URL del `.zsync` es el nombre del fichero de salida.** Si se reempaqueta con el nombre local
   (con espacios) y GitHub lo publica con puntos, el `.zsync` apunta a un fichero que no existe. Se
   reempaqueta directamente con el nombre que tendrá en GitHub y se comprueba la cabecera `URL:`.
3. **Con `APPIMAGE_EXTRACT_AND_RUN=1` (obligatorio en el runner, sin FUSE) el AppImage no atiende
   `--appimage-updateinformation`: arranca la aplicación entera y se queda esperando**, así que el
   paso se colgaría hasta el límite del job. La cadena se lee de la sección `.upd_info` del ELF:
   `objcopy -O binary --only-section=.upd_info App.AppImage out && tr -d '\000' < out`.

Además, si la Release ya estaba **publicada** cuando se sustituye el AppImage (relanzar el workflow
con `draft: false`), cualquier automatización que calculara su sha256 al publicarse (un Cask de
Homebrew) queda desfasada: hay que relanzarla después (`gh workflow run …`, permiso `actions: write`).

Para probarlo en local sin `sudo` en WSL: `apt-get download zsync && dpkg -x zsync_*.deb zs` y añadir
`zs/usr/bin` al `PATH`. El paso completo está en la plantilla `release-linux.yml` de §9.

## 6quinquies. Cask de Homebrew: sin bloques Ruby `preflight`/`postflight` (Homebrew 7) — y el AppImage ya no está en `staged_path`

Homebrew 7 (septiembre de 2026) declara obsoletos los bloques Ruby `preflight do … end` y
`postflight do … end` en los taps de terceros (en los oficiales ya se rechazan). Todavía funcionan,
pero **cada usuario ve en cada `brew install` o `brew upgrade`** el aviso
`Calling preflight is deprecated! Use preflight_steps instead`, que le pide reportarlo al tap. Así lo
detectó un usuario de macOS de DBV Typst Editor el 2026-09-29, el día de publicar la 0.12.0.

Alternativas (referencia: `docs/Cask-Cookbook.md` de `Homebrew/brew`):

- **Un comando de consola** (el caso típico: `typs`, `mdr`…): `command_wrapper`. Escribe el script en
  el `staged_path` y lo enlaza como un `binary`, en un solo paso; sustituye al par `preflight` +
  `binary`. Con `executable:` (más `args:` y `env:`) para un envoltorio simple, o con `content:` para
  un script completo.
- **Un script que no se enlaza** (lo usa un `installer` o un paso posterior): `generated_script`.
- **Cualquier otra preparación**: `preflight_steps do … end`, declarativo, con pasos como
  `write_file`, `set_permissions`, `move`, `symlink` o `run` y los tokens `{{staged_path}}`,
  `{{version}}` o `{{appdir}}`, que se expanden al instalar. No admite Ruby arbitrario.

```ruby
on_macos do
  app "Mi App.app"
  command_wrapper "miapp", content: <<~SH
    #!/bin/sh
    exec open -a "Mi App" "$@"
  SH
end
```

**Trampa en Linux:** desde Homebrew 7, `app_image` **mueve** el AppImage a `appimagedir`
(`~/Applications` por defecto, configurable con `--appimagedir`) y le da permiso de ejecución él
mismo. En `staged_path` ya no queda nada. Un comando que apunte al AppImage en `staged_path` queda
**roto sin ningún error al instalar**: en DBV Typst Editor estuvo así desde el cambio de Homebrew
hasta que se revisó por el aviso. El DSL no expone `appimagedir` (`Cask::Config` es interno), así que
el script usa la ruta por defecto y avisa si no la encuentra:

```ruby
on_linux do
  app_image "Mi.App_#{version}_amd64.AppImage", target: "Mi-App.AppImage"
  command_wrapper "miapp", content: <<~SH
    #!/bin/sh
    APPIMAGE="$HOME/Applications/Mi-App.AppImage"
    if [ ! -x "$APPIMAGE" ]; then
      echo "miapp: $APPIMAGE not found (installed with a custom --appimagedir?)" >&2
      exit 1
    fi
    nohup "$APPIMAGE" "$@" >/dev/null 2>&1 &
  SH
end
```

**El CI del tap tiene que ver lo mismo que el usuario.** Homebrew no se puede ejecutar en Windows, así
que el tap necesita un workflow que instale el Cask de verdad en `macos-latest` y `ubuntu-latest`, con
dos comprobaciones que antes faltaban:

1. **Fallar ante cualquier aviso de obsolescencia**:
   `brew install --cask <tap>/<cask> 2>&1 | tee install.log` y después
   `if grep -qi deprecated install.log; then exit 1; fi`.
2. **Comprobar que existe lo que ejecuta el comando**, no solo el texto del script. Un `grep` sobre el
   contenido del script dejó pasar el fallo de Linux: en su lugar, `test -x "$HOME/Applications/<target>"`.

El workflow de la app que actualiza el tap (`update-homebrew-tap.yml`) solo cambia `version` y los
`sha256` con `sed`, así que no se ve afectado por el cambio de sintaxis.

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
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils zsync

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

      # linuxdeploy (dentro de `tauri build`) deja `AppRun.wrapped` con permisos
      # 0770 y todo el squashfs pertenece a root. En un escritorio no se nota
      # porque el runtime FUSE monta los ficheros con el uid del usuario, pero
      # quien lo ejecuta como "otros" (p. ej. el test con firejail del catálogo
      # de AppImageHub) recibe "Permission denied" y la app no arranca. Se
      # extrae, se normalizan los permisos, se reempaqueta con el mismo nombre y
      # se sustituye el asset que tauri-action ya había subido. El .deb no se
      # toca. Ver dbv-specs-ops/docs/NATIVE_APPS_RELEASE_CI.md §6ter.
      - name: Normalizar permisos del AppImage, añadir el .zsync y resubirlo
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPIMAGE_EXTRACT_AND_RUN: "1"
          ARCH: x86_64
        run: |
          set -euo pipefail
          appimage=$(ls src-tauri/target/release/bundle/appimage/*.AppImage)
          work=$(mktemp -d)
          cp "$appimage" "$work/original.AppImage"
          chmod +x "$work/original.AppImage"
          (cd "$work" && ./original.AppImage --appimage-extract >/dev/null)
          chmod -R u+rwX,go+rX,go-w "$work/squashfs-root"

          wget -q -O "$work/appimagetool" \
            https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
          chmod +x "$work/appimagetool"
          # GitHub cambia los espacios del nombre por puntos al subir el asset:
          # se reempaqueta YA con ese nombre, para que --clobber lo sustituya y la
          # URL del .zsync (appimagetool escribe el nombre del fichero de salida)
          # apunte a un asset real. Con `-u`, AppImageUpdate descarga solo lo que
          # cambia entre versiones (NATIVE_APPS_RELEASE_CI.md §6quater).
          asset=$(basename "$appimage" | tr ' ' '.')
          update_info="gh-releases-zsync|${GITHUB_REPOSITORY_OWNER}|${GITHUB_REPOSITORY#*/}|latest|${asset%%_*}_*_amd64.AppImage.zsync"
          out="$work/out"
          mkdir -p "$out"
          (cd "$out" && "$work/appimagetool" -n -u "$update_info" "$work/squashfs-root" "$asset")

          # Sin `zsyncmake`, appimagetool se salta el .zsync SIN FALLAR: se exige.
          if [ ! -f "$out/$asset.zsync" ]; then
            echo "::error::appimagetool no generó $asset.zsync (¿falta el paquete zsync?)"
            exit 1
          fi
          url=$(grep -a -m1 '^URL: ' "$out/$asset.zsync" | cut -d' ' -f2-)
          if [ "$url" != "$asset" ]; then
            echo "::error::La URL del .zsync es '$url' y el asset se llama '$asset'"
            exit 1
          fi
          # Se lee la sección `.upd_info` del ELF: con APPIMAGE_EXTRACT_AND_RUN=1 el
          # runtime no atiende `--appimage-updateinformation` y arranca la app.
          objcopy -O binary --only-section=.upd_info "$out/$asset" "$work/upd_info"
          embedded=$(tr -d '\000' < "$work/upd_info")
          if [ "$embedded" != "$update_info" ]; then
            echo "::error::Información de actualización incrustada inesperada: '$embedded'"
            exit 1
          fi

          # Permisos: verificación sobre el AppImage ya reempaquetado, no sobre el directorio.
          check=$(mktemp -d)
          (cd "$check" && "$out/$asset" --appimage-extract >/dev/null)
          ls -l "$check/squashfs-root/AppRun" "$check/squashfs-root/AppRun.wrapped" "$check/squashfs-root/usr/bin/"
          bad=$(find "$check/squashfs-root" -type f \( ! -perm -o+r -o -perm -o+w \))
          if [ -n "$bad" ] || [ ! -x "$check/squashfs-root/AppRun.wrapped" ] \
             || find "$check/squashfs-root/AppRun.wrapped" ! -perm -o+x | grep -q .; then
            echo "::error::El AppImage reempaquetado sigue con permisos incorrectos:"
            echo "$bad"
            exit 1
          fi

          gh release upload "${{ steps.version.outputs.tag }}" "$out/$asset" "$out/$asset.zsync" --clobber
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
