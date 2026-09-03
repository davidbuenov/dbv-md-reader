# 📱 Propuesta de actualización para dbv-specs-ops — Aplicaciones móviles nativas con Android, Tauri v2 y publicación en Google Play Store

> **Origen:** Conocimiento real y lecciones aprendidas extraídas durante el ciclo completo de desarrollo, adaptación y publicación de `dbv-md-reader` en Android (Rust + Tauri v2 + Kotlin), abarcando desde la arquitectura de almacenamiento Scoped Storage (SAF), hasta la solución del error bloqueante de páginas de 16 kB en Google Play y la generación de assets sin tablet física.
> **Destino:** Insumo técnico y metodológico para quien mantiene el framework **`dbv-specs-ops`** (David Bueno Vallejo), listo para ser incorporado en futuras versiones del framework en `docs/` y en `MASTER_PROMPT.md`.
> **Por qué importa:** `dbv-specs-ops` cubre actualmente proyectos web y aplicaciones de escritorio nativas Windows/Linux/macOS (documentado en `actualizacion_dbv_specs_ops.md`). Sin embargo, el salto al ecosistema **móvil (Android)** introduce paradigmas radicalmente diferentes (Scoped Storage, Storage Access Framework, ciclo de vida de actividades, insets de pantalla táctil, requisitos de páginas de memoria de 16 kB y empaquetado AAB firmado). Sin esta documentación, cualquier proyecto Tauri móvil tendría que redescubrir estos retos desde cero.

---

## 1. Resumen de Brechas Detectadas en el Framework

| # | Brecha en dbv-specs-ops | Desafío Real Encontrado | Solución Probada en este Proyecto |
|---|---|---|---|
| **1** | **Acceso al Sistema de Archivos en Móvil** | En Android 11+ (`Scoped Storage`), el acceso directo por rutas POSIX tradicionales (`/storage/emulated/0/...`) o URLs `file://` falla o está bloqueado por el sistema operativo. | Creación de un plugin nativo de Tauri en Kotlin (`tauri-plugin-saf`) que utiliza **Storage Access Framework (SAF)** para selección de archivo individual (`ACTION_OPEN_DOCUMENT`) y carpetas completas (`ACTION_OPEN_DOCUMENT_TREE`), persistiendo permisos con `takePersistableUriPermission`. |
| **2** | **Interoperabilidad con otras Apps (Intents)** | Los usuarios esperan poder "Abrir con" desde WhatsApp, Telegram, Gmail o el explorador de archivos nativo sin duplicar archivos. | Configuración de `intent-filter` en `AndroidManifest.xml` con acciones `VIEW` y `SEND` para tipos MIME `text/markdown`, `text/plain` y `octet-stream`, leyendo el stream directamente desde `ContentResolver` en memoria. |
| **3** | **Diseño y Ergonomía Móvil vs. Escritorio** | Los controles de escritorio (títulos de ventana, menús contextuales de botón derecho, barras de herramientas anchas) saturan o rompen la pantalla de un móvil. | Adaptación de UI táctil: cajón lateral (drawer) para Tabla de Contenidos (TOC), menú flotante modal (⚙️) para Ajustes y cambio de tema, barra de navegación táctil y respeto de los insets del sistema (barra de estado, notch/cutout y barra de navegación gestual). |
| **4** | **Requisito Bloqueante de Google Play: 16 kB Page Size** | A partir de Android 15, Google Play rechaza App Bundles cuyas librerías `.so` nativas (compiladas en Rust/C) no estén alineadas a páginas de 16 kB (`PT_LOAD align: 4096` provoca error rojo en consola). | Inyección de flags del enlazador en `src-tauri/build.rs` (`-Wl,-z,max-page-size=16384` y `-Wl,-z,common-page-size=16384`) y configuración de `packaging.jniLibs.useLegacyPackaging = false` en `build.gradle.kts`. |
| **5** | **Advertencia de Símbolos de Depuración Nativos** | Google Play advierte sobre la ausencia de símbolos de depuración nativos para análisis de caídas (ANR y crash reporting). | Configuración de `debugSymbolLevel = "FULL"` en `buildTypes.release.ndk` y generación de paquete `native-debug-symbols.zip` organizado por arquitecturas (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) con los binarios *unstripped*. |
| **6** | **Requisito de Capturas de Tablet sin Dispositivo Físico** | Google Play exige al menos 1-2 capturas para tablets de 7" y 10", pero los desarrolladores frecuentemente no disponen de hardware tablet físico. | Uso de comandos dinámicos sobre el emulador Android (`adb shell wm size` y `adb shell wm density`) para tomar capturas nativas reales en 7" (1200x1920) y 10" (2560x1600 apaisado) sin distorsión. |
| **7** | **Generación Automatizada del Gráfico Destacado (1024x500)** | La consola exige un banner promocional obligatorio de exactamente 1024x500 px sin canal alfa. | Script reutilizable con Node.js + Microsoft Edge headless que renderiza una plantilla HTML/SVG con degradados, logo oficial y mockup de la interfaz en alta resolución. |

---

## 2. Lecciones de Arquitectura Transferibles (Android + Tauri v2)

### 2.1 Storage Access Framework (SAF) como Pilar de Almacenamiento
En sistemas de escritorio, `tauri::api::fs` o las funciones estándar de Rust (`std::fs::read_to_string`) leen cualquier ruta concedida por el diálogo del sistema. En Android:
1. Las rutas de archivo son **URIs de contenido** (`content://...`), no rutas de disco.
2. Rust no puede abrir `content://` con `std::fs`.
3. **Patrón recomendado para el framework:** Desarrollar o incluir un plugin ligero de Tauri en Kotlin (`tauri-plugin-saf`) que exponga comandos IPC a Rust/Frontend:
   - `open_file()`: Invoca `ACTION_OPEN_DOCUMENT`, retorna `{ uri, name, content }`.
   - `open_folder()`: Invoca `ACTION_OPEN_DOCUMENT_TREE`, persiste el permiso (`takePersistableUriPermission`) y genera un árbol JSON con los nombres y URIs de los archivos para permitir la navegación interna.
   - `read_file_uri(uri)`: Lee el contenido bajo demanda usando `contentResolver.openInputStream(uri)`.
   - **Imágenes locales relativas:** Para mostrar imágenes referenciadas en el Markdown dentro de carpetas abiertas con SAF, el backend lee los bytes de la imagen y los entrega al frontend como `data:image/...;base64,...`, burlando la imposibilidad de servir URLs `file://` locales en el WebView.

### 2.2 Inyección del Requisito de 16 kB en `build.rs`
Este es uno de los problemas más críticos de 2024-2026 para cualquier aplicación que compile código nativo (Rust, C++, Go) en Android.

**Configuración requerida en `src-tauri/build.rs`:**
```rust
fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("android") {
        // Soporte obligatorio para tamaños de página de memoria de 16 kB en Android 15+ (Google Play)
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }
    tauri_build::build();
}
```

**Configuración requerida en `src-tauri/gen/android/app/build.gradle.kts`:**
```kotlin
android {
    packaging {
        jniLibs {
            useLegacyPackaging = false
        }
    }
}
```

**Comprobación automatizada (Script de verificación ELF):**
Para validar que las librerías `.so` están correctamente alineadas antes de subir el AAB a Google Play, se comprueba el campo `p_align` de los segmentos `PT_LOAD`:
```javascript
// Debe devolver 16384 (16 KB) en lugar de 4096 (4 KB)
const p_align = is64 ? Number(buf.readBigUInt64LE(off + 48)) : buf.readUInt32LE(off + 28);
console.log('PT_LOAD align:', p_align, p_align >= 16384 ? 'OK' : 'FAIL');
```

---

### 2.3 Símbolos de Depuración Nativos (`debugSymbolLevel`)
Google Play advierte si un App Bundle contiene código nativo sin sus símbolos de depuración.

1. **En Gradle (`build.gradle.kts`):**
   ```kotlin
   buildTypes {
       getByName("release") {
           ndk {
               debugSymbolLevel = "FULL" // o "SYMBOL_TABLE"
           }
       }
   }
   ```
2. **Paquete ZIP manual (`native-debug-symbols.zip`):**
   Si se compila con Rust fuera del flujo directo de NDK en Gradle, las librerías con símbolos se encuentran en `src-tauri/target/<target>/release/libapp.so` (~17 MB) antes del paso `strip` de Gradle (~5 MB).
   Empaquetar en un `.zip` con la estructura:
   ```
   arm64-v8a/libapp.so
   armeabi-v7a/libapp.so
   x86/libapp.so
   x86_64/libapp.so
   ```
   Permite subirlo directamente en Google Play Console (*Explorador de paquetes > Descargas > Símbolos nativos*).

---

### 2.4 Ergonomía Táctil y Manejo de Insets en Android
En una app de escritorio, los márgenes superiores suelen ser de 0 px o ajustados a la barra de título personalizada. En Android:
1. Se debe respetar `WindowInsetsCompat` para no solapar la barra de estado superior (hora, batería, iconos) ni el notch/isla dinámica.
2. Los botones de acción deben tener un tamaño táctil mínimo de **48 x 48 dp** (o padding adecuado).
3. Los paneles modales (como Ajustes o Archivos Recientes) deben centrarse o anclarse como hojas flotantes con botón de cierre explícito (✕) y soporte de cierre al pulsar fuera.
4. El botón físico o gesto de "Atrás" de Android debe gestionarse: si hay un panel o cajón abierto, debe cerrarlo antes de salir de la aplicación.

---

### 2.5 Técnica de Emulador para Capturas de Pantalla de Tablet
Google Play Console impone la subida de al menos una captura para tablets de 7 pulgadas y otra para tablets de 10 pulgadas. Para no bloquear el lanzamiento si el desarrollador no tiene tablet:

1. **Tablet de 7 pulgadas (Vertical 1200 x 1920):**
   ```bash
   adb -s <id_emulador> shell wm size 1200x1920
   adb -s <id_emulador> shell wm density 280
   adb -s <id_emulador> shell screencap -p /sdcard/tablet7.png
   adb -s <id_emulador> pull /sdcard/tablet7.png
   ```
2. **Tablet de 10 pulgadas (Horizontal / Apaisado 2560 x 1600):**
   ```bash
   adb -s <id_emulador> shell wm size 2560x1600
   adb -s <id_emulador> shell wm density 280
   adb -s <id_emulador> shell screencap -p /sdcard/tablet10.png
   adb -s <id_emulador> pull /sdcard/tablet10.png
   ```
3. **Restaurar el emulador a su resolución original:**
   ```bash
   adb -s <id_emulador> shell wm size reset
   adb -s <id_emulador> shell wm density reset
   ```

---

## 3. Propuestas Concretas para `dbv-specs-ops`

### 3.1 Actualización en `MASTER_PROMPT.md` (Bootstrap y Stack)
Añadir soporte oficial para proyectos móviles en la sección de stacks recomendados:
```markdown
- **Aplicación móvil multiplataforma (Android / iOS):** Rust + Tauri v2 Mobile.
  - Almacenamiento: Storage Access Framework (SAF) obligatorio en Android (evitar rutas de disco directas).
  - Alineación de memoria: Enlazar con `-Wl,-z,max-page-size=16384` para cumplimiento estricto de Android 15+.
  - Distribución: Android App Bundle (.aab) universal firmado con zipalign y apksigner.
```

### 3.2 Nuevo Documento Propuesto: `docs/ANDROID_TAURI_APPS.md`
Crear un documento de referencia en el framework que detalle:
1. Requisitos del SDK de Android, NDK (r25+ / r28) y JDK 17+.
2. Configuración de `tauri.conf.json` para Android (`bundle.android`).
3. Estructura del plugin SAF en Kotlin.
4. Buenas prácticas de rendimiento de renderizado en WebView Android.
5. Checklist de publicación en Google Play Console (límites de caracteres, gráficos obligatorios, formato XML de notas de versión).

### 3.3 Plantilla de Ficha de Publicación: `docs/templates/STORE_GOOGLE_PLAY.md`
Incorporar al framework una plantilla estandarizada similar a `descripcionStoreGooglePlay_es.md` con:
- Título (máx. 30 car.)
- Descripción corta (máx. 80 car.)
- Descripción completa (máx. 4000 car.)
- Bloque XML de notas de versión (`<es-ES>`, `<en-US>`)
- Especificaciones exactas de Icono (512x512), Gráfico de funciones (1024x500) y Capturas (teléfono y tablet).

---

> 🛠️ Generado como insumo de evolución para el framework **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** por David Bueno Vallejo.
