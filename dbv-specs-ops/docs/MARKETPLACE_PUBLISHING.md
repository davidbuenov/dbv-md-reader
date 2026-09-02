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

**Corolario de control de versiones: la carpeta de empaquetado generada se trackea entera, no se gitignora.**
El instinto por defecto ante un directorio con "gen" en el nombre (p. ej. `src-tauri/gen/windows/`) es
ignorarlo y trackear solo el fichero de configuración, asumiendo que el resto se regenera. Es exactamente al
revés: los assets de ese directorio pueden necesitar **corrección manual** — como la del placeholder de
arriba — y si están gitignorados, esa corrección se pierde en silencio en el siguiente equipo o en el
siguiente `init` de la herramienta, y el asset roto vuelve sin que nadie lo note hasta el rechazo. Trackea
todo el directorio y trata cualquier regeneración como un diff a revisar. Verificado leyendo `git ls-files`
de un proyecto ya publicado, no deducido.

**Detectar el placeholder antes del envío vale más que corregirlo tras el rechazo.** Cuando ya se conoce el
tamaño problemático concreto, la corrección es reproducible sin la herramienta: componer el logo cuadrado
centrado sobre un lienzo transparente del tamaño exigido (coherente con el `BackgroundColor="transparent"`
del manifiesto) con cualquier librería de imagen. Un rechazo de tienda cuesta días de espera; la
comprobación visual, un minuto.

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
  self-hosted (ver lección 6 en [`NATIVE_DESKTOP_APPS.md`](./NATIVE_DESKTOP_APPS.md)).
- Si se hace un rebrand o cambio de identificador de producto entre versiones, evaluar explícitamente el
  riesgo de que los usuarios existentes vean una instalación **nueva y paralela** en vez de una actualización
  in-place — es un riesgo real y ya observado, no hipotético.

## 6. NSIS (instalador Windows) — trampas reales de personalización

Si el bundler genera el instalador Windows vía NSIS (caso de Tauri) y hace falta personalizarlo más allá de
lo que expone la configuración declarativa:

- **La mayoría de config declarativa sí es suficiente sin forkear nada:** `nsis.sidebarImage`/`headerImage`
  (branding), `nsis.installerHooks` (`NSIS_HOOK_POSTINSTALL`/`NSIS_HOOK_PREINSTALL` para lógica propia como
  un `MessageBox` de confirmación) y `bundle.publisher` (nombre explícito — sin él, "Agregar o quitar
  programas" muestra un valor derivado del identificador técnico del paquete, no el nombre real del
  desarrollador) son puntos de extensión oficiales y estables entre versiones del bundler. Empezar siempre
  por aquí.
- **Personalizar el texto de las páginas de Bienvenida/Fin, o añadir una página de componentes con
  checkboxes propios, sí exige forkear la plantilla completa** (`bundle.windows.nsis.template`, ~1000
  líneas) — no son alcanzables por configuración. Si se necesita, descargar la plantilla oficial de la
  **misma versión exacta** del bundler que usa el proyecto (fijada en el lockfile), no la última de GitHub —
  una plantilla de otra versión puede haber cambiado de estructura interna. Documentar el diff aplicado en
  algún sitio versionado: cualquier subida futura de versión del bundler exige re-diffear la plantilla contra
  la nueva oficial para no perder fixes upstream, y eso solo es viable si el diff propio está documentado.
- **`XPStyle on` no está activado por defecto ni siquiera con MUI2** (la UI moderna de NSIS) — sin ese flag,
  los controles se dibujan con el estilo clásico sin temas, no con el tema visual activo del sistema
  operativo del usuario. Cambio de una línea, alto impacto visual.
- **`fileAssociations` se registra de forma automática y silenciosa** al instalar — no hay checkbox de
  opt-in/opt-out nativo, es una limitación real del bundler, no una opción de configuración por descubrir. Si
  el producto necesita que el usuario pueda elegir (p. ej. "asociar como app por defecto" como paso
  opcional), hay que forkear la plantilla (punto anterior) y añadir secciones NSIS propias marcadas por
  defecto, con el desinstalador deshaciendo **solo** lo que un marcador propio (escrito durante la
  instalación) dice que se registró — nunca asumir que "siempre se registró todo" al desinstalar, o se
  puede restaurar una asociación que el usuario nunca activó.
- **El instalador generado por el bundler puede no llamar a `SHChangeNotify` tras escribir la asociación de
  archivo en el registro** — Explorer no refresca sus iconos/asociaciones hasta el siguiente inicio de sesión
  sin esa notificación, así que el instalador puede "decir" que asoció el tipo de archivo sin que el
  doble clic funcione de inmediato. Verificar explícitamente esto probando el doble clic justo después de
  instalar en una máquina limpia, no solo revisando las claves de registro escritas.
- **Un ProgId (identificador de asociación de tipo de archivo) que cambia entre versiones queda huérfano en
  el registro** si el usuario instala la versión nueva sin desinstalar la anterior — resultado observado:
  dos entradas en el menú "Abrir con", una con el icono correcto y otra con un icono/nombre obsoleto. Si se
  cambia el ProgId alguna vez, documentar para el usuario que debe desinstalar la versión previa antes de
  instalar la nueva, o aceptar la entrada duplicada como deuda conocida.
- **Regenerar un icono (`.ico`) no garantiza que el binario recompilado lo incluya** si el sistema de build
  cachea artefactos agresivamente (p. ej. Cargo) — un rebuild puede detectar "nada que compilar" en el
  crate y dejar el icono anterior embebido en el ejecutable, sin ningún aviso. Tras cambiar solo un recurso
  incrustado por el paso de build (icono, no código), forzar una limpieza del crate afectado antes de
  reconstruir en vez de confiar en el build incremental.

## 7. MSIX / identidad de paquete para tiendas — coincidencia exacta con la consola

Si el paquete final para una tienda (p. ej. MSIX para Microsoft Store) declara un nombre de binario o de
paquete distinto al que produce el compilador:

- El nombre de archivo del ejecutable esperado **dentro** del paquete se suele derivar del nombre visible
  configurado (`displayName` o similar) — si ese campo no coincide exactamente con el binario real que
  produce el build, el empaquetado falla con un error tipo "Executable not found", no con un error obvio de
  "nombre no coincide". Si se renombra el producto de cara al usuario, renombrar también el binario
  compilado en el mismo cambio, no solo la configuración de branding.
- El campo de nombre visible del manifiesto del paquete (`DisplayName` o equivalente) debe coincidir con un
  nombre **reservado explícitamente** en la consola de la tienda — un nombre técnico usado solo internamente
  (el identificador del repositorio/proyecto, por ejemplo) puede no estar reservado aunque el nombre
  comercial sí lo esté. La mayoría de consolas permiten reservar **nombres adicionales** bajo la misma
  identidad de producto exactamente para este caso (nombre técnico del manifiesto ≠ nombre comercial) — más
  simple y de menor riesgo que forzar el manifiesto a usar el nombre comercial completo si eso rompe otro
  canal de distribución ya publicado con el nombre técnico.

## 8. Checklist de envío (genérico, adaptar por tienda)

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
