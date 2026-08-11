# 🏬 Publicación en Microsoft Store: dbv-md-reader

> **Estado:** En preparación — cuenta de Partner Center creada, nombre de producto aún sin reservar.
> **Última revisión:** 2026-08-11

Documento operativo (no una especificación de producto): checklist accionable para publicar `dbv-md-reader` en la Microsoft Store, y registro de las decisiones técnicas que llevaron hasta aquí. Complementa a `ARCHITECTURE.md` (que documenta el instalador NSIS existente) sin sustituirlo — ambos canales de distribución coexisten.

---

## 1. Vía elegida: MSIX subido directamente a Partner Center

Tauri v2 no genera paquetes MSIX de fábrica (solo NSIS/MSI). Se evaluaron dos vías para llegar a la Store:

| Vía | Firma de código | Empaquetado |
| --- | --- | --- |
| **Listado "EXE o MSI"** (la Store solo enlaza a un instalador alojado externamente) | El desarrollador debe comprar y gestionar un certificado Authenticode de una CA del Microsoft Trusted Root Program — coste y verificación de identidad recurrentes. | Reutiliza el `.exe` NSIS ya existente, cero empaquetado nuevo. |
| **MSIX subido a Partner Center** ✅ elegida | **La Store firma el paquete automáticamente con su propio certificado tras la certificación** — no hace falta comprar ningún certificado Authenticode. Confirmado en la documentación oficial de Microsoft ([`app-package-requirements` MSIX](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements), sección "Code signing for Microsoft Store submissions"). | Requiere una herramienta de terceros (`@choochmeque/tauri-windows-bundle`, Tauri no lo hace nativo) que genera un `.msix`/`.msixbundle` a partir del mismo build. |

Se eligió **MSIX** porque elimina el bloqueo real más caro y lento (certificado comercial + verificación de identidad), a cambio de un empaquetado adicional que sí se puede automatizar con código. El listado "EXE o MSI" queda documentado aquí como alternativa descartada, no como plan B activo.

**Los dos canales de distribución coexisten sin conflicto:**
- El instalador NSIS (`dbv-md-reader_x.y.z_x64-setup.exe`) sigue publicándose en GitHub Releases como hasta ahora — es el canal fuera de la Store, con su propio mecanismo de actualización (`tauri-plugin-updater`, RF-13).
- El MSIX es un paquete e identidad de aplicación distintos, exclusivos de la Store — sus actualizaciones las gestiona la propia Store/Windows Update, **no** `tauri-plugin-updater`. Un usuario que instale desde la Store nunca verá el botón "Buscar actualizaciones" de "Acerca de" encontrar nada nuevo por su cuenta; sus actualizaciones llegan solas vía Store.

---

## 2. Empaquetado MSIX con `@choochmeque/tauri-windows-bundle`

Herramienta de terceros (no oficial de Tauri) auditada antes de instalar: MIT, ~6.400 descargas/mes, publicada vía GitHub Actions con npm trusted publishing (OIDC, sin token manual — buena señal de cadena de suministro), sin issues de seguridad abiertos relevantes. Ver auditoría completa en el registro de esta fase en `task.md`.

### Flujo usado

```
npx @choochmeque/tauri-windows-bundle init      # genera gen/windows/bundle.config.json + AppxManifest.xml.template + Assets/
# editar gen/windows/bundle.config.json (publisher, capabilities)
npx @choochmeque/tauri-windows-bundle build --runner npm   # genera el .msix
```

**Nota importante — `--runner npm` es obligatorio en este proyecto:** el runner por defecto de la herramienta (`cargo`) ejecuta `cargo tauri build`, que asume la extensión `cargo-tauri` instalada como subcomando de Cargo. Este proyecto usa el CLI de Tauri vía npm (`@tauri-apps/cli`, invocado como `npm run tauri`), no esa extensión de Cargo — sin `--runner npm` el build falla con `error: no such command: 'tauri'`.

### Archivos generados (no se commitean, ver `.gitignore` propio de la herramienta en `src-tauri/gen/windows/.gitignore`)

- `src-tauri/gen/windows/bundle.config.json` — configuración editable (publisher, capabilities, extensiones, firma).
- `src-tauri/gen/windows/AppxManifest.xml.template` — plantilla del manifiesto MSIX.
- `src-tauri/gen/windows/Assets/` — iconos requeridos por el manifiesto (generados automáticamente a partir de `bundle.icon` de `tauri.conf.json`).

### Asociación de archivos `.md`: reutiliza la configuración existente

La herramienta lee `bundle.fileAssociations` directamente de `src-tauri/tauri.conf.json` (la misma entrada que ya usa el instalador NSIS) — no hace falta duplicar la asociación `.md`/`.markdown` en `bundle.config.json`. **Diferencia de UX esperada entre canales:** el instalador NSIS ofrece dos checkboxes explícitos (menú contextual / app predeterminada, ADR-013); un MSIX declara la asociación de forma declarativa en el manifiesto (`uap:FileTypeAssociation`) y es Windows quien pregunta al usuario qué app usar la primera vez que abre un `.md`, no el instalador. No es un bug, es el mecanismo estándar de MSIX — se documenta aquí para no confundirlo con una regresión.

### Certificado — solo para pruebas locales, no para la Store

Para instalar/ejecutar un `.msix` en un PC de pruebas antes de enviarlo a la Store hace falta *algún* certificado que firme el paquete (MSIX no se puede instalar sin firma, ni siquiera temporalmente) — pero puede ser **autofirmado y gratuito** (`New-SelfSignedCertificate` de PowerShell), de confianza únicamente en el equipo de pruebas. Esto **no es el mismo bloqueo** que la vía EXE/MSI: no requiere verificación de identidad ni pago. La Store, al recibir el `.msix`, ignora esa firma de prueba y lo re-firma con su propio certificado.

**Probado en esta sesión — el certificado de prueba debe confiarse a nivel de equipo, no de usuario:** generar el certificado con `New-SelfSignedCertificate` y firmar con `signtool sign /fd SHA256 /a /f cert.pfx /p <pwd> paquete.msix` funciona sin permisos especiales, pero `Add-AppxPackage` sigue rechazando el paquete (`0x800B0109`, "el certificado raíz... debe ser de confianza") aunque el certificado ya esté confiado en `Cert:\CurrentUser\Root` — Windows valida la cadena de confianza de MSIX contra el almacén **`Cert:\LocalMachine\Root`**, que requiere una consola elevada (administrador) para escribir, incluso para una instalación por-usuario. No es un requisito de la Store (que re-firma con su propio certificado), solo de la instalación local sin publicar — documentado aquí para no repetir la investigación en el futuro.

### Identidad real (ya configurada, reservada por el usuario en Partner Center)

`bundle.config.json` usa la identidad **real** obtenida de "Ver identidad del producto" en Partner Center:
```json
"identifier": "davidbuenov.DBVMarkdownReader",
"publisher": "CN=13EE2A5D-F49E-48C9-8873-941069B15D63",
"publisherDisplayName": "davidbuenov"
```
Verificado que el `AppxManifest.xml` generado (`src-tauri/target/appx/x64/AppxManifest.xml`) coincide exactamente con `Package/Identity/Name` y `Package/Identity/Publisher` mostrados en Partner Center — el `.msix` final ya se puede regenerar en cualquier momento con `npx @choochmeque/tauri-windows-bundle build --runner npm` sin pasos adicionales de identidad antes de someterlo a certificación.

**No se sobrescribió `displayName`** en `bundle.config.json` (se dejó por defecto = `productName` de `tauri.conf.json`, ahora "DBV Markdown Reader" tras el rebrand — ver más abajo): la herramienta deriva el nombre de archivo del `.exe` esperado dentro del paquete a partir de ese campo (quitando espacios), y como el binario compilado real sigue siendo `dbv-md-reader.exe` (nombre de Cargo, sin cambios), fijar un `displayName` distinto rompía el build con `Executable not found`.

### Rebrand a "DBV Markdown Reader" (decisión del usuario tras reservar el nombre)

El usuario reservó "DBV Markdown Reader" en Partner Center y pidió unificar el nombre visible en todo el proyecto (no solo en el MSIX): `tauri.conf.json` (`productName`, título de ventana) y los textos visibles de `src/index.html` (`<title>`, tooltip "Acerca de", cabeceras). Riesgo aceptado explícitamente: quien tenga la v0.4.0 previa instalada verá una entrada nueva y separada en "Agregar o quitar programas" en vez de una actualización in-place (mismo patrón que el incidente de ProgId duplicado de la Fase 17/ADR-013) — asumible dado el número reducido de instalaciones actuales. Deliberadamente **no** se tocó el `identifier` (`com.davidbuenov.dbv-md-reader`, controla dónde vive `recent_files.json`) ni el ProgId de asociación `.md` (`dbv-md-reader.md`), para no perder datos de usuario ni repetir el bug de entradas duplicadas en "Abrir con...".

---

## 3. Requisitos de la Store que ya están cubiertos por el proyecto

- **Instalador NSIS silencioso** (`/S`) verificado en esta misma sesión — no bloquea la Store (aplica solo al canal EXE/MSI descartado), pero confirma que el proyecto ya cumple ese estándar por si se retoma esa vía en el futuro.
- **Sin telemetría ni recolección de datos personales**: `dbv-md-reader` solo lee archivos/URLs que el propio usuario indica explícitamente; el único tráfico de red saliente son las descargas de `.md` remotos que el usuario pide (RF-08A) y la comprobación de actualizaciones bajo demanda contra `github.com` (RF-13, solo en el canal NSIS).
- **Política de privacidad publicada:** `docs/privacidad.html` en la landing de GitHub Pages — `https://davidbuenov.github.io/dbv-md-reader/privacidad.html`. Enlazada desde el footer de `docs/index.html`. Lista para pegar en el campo correspondiente de Partner Center.

---

## 4. Estado de Partner Center — ✅ resuelto

Cuenta creada y nombre reservado: **"DBV Markdown Reader"** (`Package/Identity/Name: davidbuenov.DBVMarkdownReader`, Id. de Store `9N7BMDZGCP0S`). La identidad real ya está en `bundle.config.json` (sección 2) y verificada contra el `AppxManifest.xml` generado. El vínculo profundo y la URL de la tienda web solo estarán disponibles tras publicar el producto (mensaje de Partner Center: "Disponible después de que el producto se publique").

**Nombre del producto — pendiente de decidir:** el nombre interno del paquete (`productName` en `tauri.conf.json`, `dbv-md-reader`) es independiente del nombre público mostrado en la ficha de la Store — se puede usar un nombre más comercial en Partner Center sin tocar el código. Opciones discutidas: mantener `dbv-md-reader` (coherente con GitHub/landing page) vs. algo más descriptivo tipo "DBV Markdown Reader" (evitar terminaciones tipo "Pro" en una app 100% gratuita, para no sugerir un nivel de pago que no existe).

---

## 5. Checklist de envío en Partner Center (para cuando el nombre esté reservado)

1. Reservar nombre → `MSIX or PWA app`.
2. Copiar el Publisher CN / Package Identity Name reales desde "Ver detalles de identidad de la app" a `bundle.config.json`.
3. Regenerar el `.msix` final con esa identidad (`npx @choochmeque/tauri-windows-bundle build --runner npm`).
4. Redactar y publicar una página corta de política de privacidad (reutilizando la landing GitHub Pages existente) — la Store la exige si la app accede a datos de cualquier forma, aunque sea solo a petición del usuario.
5. Propiedades del producto: categoría, URL de política de privacidad.
6. Ficha de la Store: descripción, capturas (reutilizables de la landing page, Fase 14), edad recomendada.
7. Paquetes: subir el `.msix`/`.msixupload` generado.
8. (Recomendado, no obligatorio) Pasar el Windows App Certification Kit (WACK) local antes de enviar.
9. Enviar a certificación (automatizada + revisión manual, ~3 días hábiles según la documentación oficial).

---

## 6. Fuera de alcance de esta fase

- Crear la cuenta de Partner Center — ya hecho por el usuario.
- Reservar el nombre definitivo del producto y decidir el nombre comercial — pendiente, discusión abierta (sección 4).
- Enviar la submission real a certificación — requiere la identidad real de Partner Center, no la provisional usada para las pruebas locales de esta sesión.
- Migrar la asociación de archivos `.md` del canal MSIX a un flujo de opt-in idéntico al de NSIS (checkboxes) — no es necesario ni posible con el mecanismo estándar de MSIX; se documenta como diferencia de UX esperada (sección 2).
