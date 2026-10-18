# Resultados de Benchmark — dbv-md-reader

> Generado automáticamente por `scripts/benchmark.ps1`. Metodología: 7 repeticiones por medición, se descarta la mejor y la peor, se promedia el resto. Repetible por cualquiera — ejecuta el script en tu propia máquina para comparar.

## Equipo de referencia

| Campo | Valor |
|---|---|
| Fecha | 2026-08-20 11:23 |
| CPU | 13th Gen Intel(R) Core(TM) i7-13700KF |
| Núcleos / hilos | 16 núcleos / 24 hilos |
| RAM total | 127.8 GB |
| GPU | Meta Virtual Monitor |
| SO | Microsoft Windows 11 Pro (build 26200) |
| Alimentación | Corriente alterna |
| Ejecutable probado | dbv-md-reader.exe (16.37 MB, compilado 2026-08-19 22:02) |

## Arranque

| Medición | Resultado |
|---|---|
| Arranque en frío (documento pequeño) | 59 ms |
| Arranque en caliente (documento pequeño) | 65 ms |

*"Frío"/"caliente" aproximan si la caché de disco del SO ya tenía el ejecutable — no es un reinicio real de Windows entre medición y medición (impracticable de automatizar). "Listo" se mide como el instante en que el proceso obtiene un `MainWindowHandle` visible, no cuando el documento ha terminado de renderizarse del todo.*

## Memoria (RAM)

### Proceso principal (dbv-md-reader.exe en solitario)

| Escenario | Working Set | Memoria privada |
|---|---|---|
| Estado vacío (sin documento) | 30,9 MB | 7,1 MB |
| Documento pequeño (~40 líneas) | 32,7 MB | 7,9 MB |
| Documento grande (~980 líneas) | 33,8 MB | 7,9 MB |
| 3 ventanas simultáneas (doc. pequeño) | 24,6 MB | 4,4 MB |

### Árbol completo (incluye los procesos que WebView2 lanza para esta app: motor de renderizado, GPU, red, almacenamiento...)

| Escenario | Working Set total | Memoria privada total | Nº procesos |
|---|---|---|---|
| Estado vacío (sin documento) | 408,0 MB | 217,9 MB | 7 |
| Documento pequeño (~40 líneas) | 425,6 MB | 234,8 MB | 6,1 |
| Documento grande (~980 líneas) | 451,5 MB | 254,4 MB | 7 |
| 3 ventanas simultáneas (doc. pequeño) | 332,8 MB | 155,1 MB | 7 |

*Estos procesos de WebView2 los lanza esta app (aparecen como hijos de `dbv-md-reader.exe` y mueren con ella) — no son un runtime ajeno que se pueda descontar. Pero el `Working Set` cuenta como propias unas páginas de código que Windows en realidad comparte físicamente entre cualquier proceso que use WebView2 (a diferencia de Electron, que no comparte nada entre apps) — por eso se reporta también la `Memoria privada`, que excluye esas páginas compartidas y refleja mejor el coste exclusivo real de esta app.*

## CPU

| Escenario | % CPU (promedio, todos los núcleos) |
|---|---|
| En reposo (tras estabilizar) | 0 % |
| Renderizado inicial (documento grande, primeros 500 ms) | 0,7 % |

## Comparativa v0.11.0 → v0.12.0: coste de la barra de formato Markdown (RF-23/RF-24)

`v0.12.0` añade la barra de formato Markdown (16 botones), Tab/Shift+Tab para indentar en el editor y el menú nativo de macOS (PR#7, `#[cfg(target_os = "macos")]`, no compila en Windows) — todo JS/Rust ligero, sin dependencias nuevas ni cambios de Rust en el binario de Windows. Mismo benchmark (7 repeticiones, mismo equipo), comparando el `.exe` de `v0.11.0` (dato guardado el 2026-08-18) con el de `v0.12.0` (esta ejecución, 2026-08-20):

| Medición | v0.11.0 | v0.12.0 | Diferencia |
|---|---|---|---|
| Tamaño del ejecutable | 16,36 MB | 16,37 MB | +0,01 MB (+0,06 %) |
| Arranque en frío | 32 ms | 59 ms | +27 ms* |
| Arranque en caliente | 26 ms | 65 ms | +39 ms* |
| RAM privada, proceso propio (doc. pequeño) | 7,2 MB | 7,9 MB | +0,7 MB |
| RAM privada, proceso propio (doc. grande) | 7,9 MB | 7,9 MB | sin cambio |
| RAM privada, árbol completo (doc. pequeño) | 237,1 MB | 234,8 MB** | −2,3 MB |
| CPU en reposo | 0 % | 0 % | sin cambio |

*\*Arranque con mucho más ruido que de costumbre en esta ejecución: las 7 repeticiones individuales de esta sesión oscilaron entre 26 ms y 309 ms (frío) y entre 26 ms y 183 ms (caliente) — muy por encima de la variación vista en mediciones anteriores (siempre <10 ms de rango). Esta sesión tenía otros procesos en marcha en la misma máquina (builds/npx en paralelo) mientras corría el benchmark, la causa más probable del ruido — no hay ningún cambio de código entre `v0.11.0` y `v0.12.0` que explique arrancar más lento (JS puro, sin tocar Rust en el binario de Windows). **Recomendado repetir esta medición en una máquina en reposo antes de tomar la cifra de arranque como definitiva.***

*\*\*Uno de los 7 muestreos de "documento pequeño, árbol completo" devolvió un valor anómalo (1 solo proceso / 26,1 MB en vez de los 7 procesos / ~230 MB habituales — probablemente el proceso medido antes de que WebView2 terminara de lanzar sus subprocesos hijos), lo que baja el nº medio de procesos a 6,1 y arrastra la media de memoria del árbol completo un poco por debajo de lo real. La cifra de memoria del proceso principal en solitario (7,9 MB) no se ve afectada por este artefacto y es la más fiable de esta tabla.*

**Conclusión:** memoria y CPU siguen sin coste medible, coherente con features JS ligeras sin nueva dependencia. El arranque no es concluyente en esta ejecución por el ruido del entorno — pendiente de una repetición limpia si se necesita una cifra fiable.

---

## Comparativa v0.10.0 → v0.11.0: coste del Modo Edición (RF-20/RF-21/RF-22)

`v0.11.0` añade un Modo Edición completo (panel dividido código/preview, números de línea, paneles redimensionables, sincronización de scroll, gestión de conflictos con cambios externos y un modal de ayuda de sintaxis) sin librería de editor de código — reutiliza el mismo `<textarea>` plano y el mismo pipeline de renderizado que ya tenía el modo lectura. Mismo benchmark (7 repeticiones, mismo equipo), ejecutado contra el `.exe` de `v0.10.0` (última versión de solo lectura) y contra `v0.11.0`:

| Medición | v0.10.0 | v0.11.0 | Diferencia |
|---|---|---|---|
| Tamaño del ejecutable | 16,35 MB | 16,36 MB | +0,01 MB (+0,06 %) |
| Arranque en frío | 36 ms | 32 ms | −4 ms |
| Arranque en caliente | 31 ms | 26 ms | −5 ms |
| RAM privada, proceso propio (doc. pequeño) | 7,5 MB | 7,2 MB | −0,3 MB |
| RAM privada, proceso propio (doc. grande) | 7,7 MB | 7,9 MB | +0,2 MB |
| RAM privada, árbol completo (doc. pequeño) | 226,8 MB | 237,1 MB | +10,3 MB* |
| CPU en reposo | 0 % | 0 % | sin cambio |

*\*El árbol completo incluye los procesos auxiliares de WebView2 (Browser/GPU/red/almacenamiento) — su reparto de memoria varía de una ejecución a otra por motivos ajenos a esta app (purga de Chromium en ratos de inactividad, ver ADR-025); la cifra del proceso principal en solitario es la que refleja el coste real y exclusivo del código añadido.*

**Conclusión:** todas las diferencias caen dentro del ruido normal de medición entre ejecuciones — no hay coste medible por añadir el Modo Edición. Detalle completo de la decisión de diseño (por qué sin librería de editor) en `memory.md`, ADR-027.
