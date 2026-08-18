# Resultados de Benchmark — dbv-md-reader

> Generado automáticamente por `scripts/benchmark.ps1`. Metodología: 7 repeticiones por medición, se descarta la mejor y la peor, se promedia el resto. Repetible por cualquiera — ejecuta el script en tu propia máquina para comparar.

## Equipo de referencia

| Campo | Valor |
|---|---|
| Fecha | 2026-08-18 19:45 |
| CPU | 13th Gen Intel(R) Core(TM) i7-13700KF |
| Núcleos / hilos | 16 núcleos / 24 hilos |
| RAM total | 127.8 GB |
| GPU | Meta Virtual Monitor |
| SO | Microsoft Windows 11 Pro (build 26200) |
| Alimentación | Corriente alterna |
| Ejecutable probado | dbv-md-reader.exe (16.36 MB, compilado 2026-08-18 19:45) |

## Arranque

| Medición | Resultado |
|---|---|
| Arranque en frío (documento pequeño) | 32 ms |
| Arranque en caliente (documento pequeño) | 26 ms |

*"Frío"/"caliente" aproximan si la caché de disco del SO ya tenía el ejecutable — no es un reinicio real de Windows entre medición y medición (impracticable de automatizar). "Listo" se mide como el instante en que el proceso obtiene un `MainWindowHandle` visible, no cuando el documento ha terminado de renderizarse del todo.*

## Memoria (RAM)

### Proceso principal (dbv-md-reader.exe en solitario)

| Escenario | Working Set | Memoria privada |
|---|---|---|
| Estado vacío (sin documento) | 31,0 MB | 7,2 MB |
| Documento pequeño (~40 líneas) | 31,1 MB | 7,2 MB |
| Documento grande (~980 líneas) | 31,6 MB | 7,9 MB |
| 3 ventanas simultáneas (doc. pequeño) | 24,8 MB | 4,5 MB |

### Árbol completo (incluye los procesos que WebView2 lanza para esta app: motor de renderizado, GPU, red, almacenamiento...)

| Escenario | Working Set total | Memoria privada total | Nº procesos |
|---|---|---|---|
| Estado vacío (sin documento) | 402,4 MB | 220,1 MB | 7 |
| Documento pequeño (~40 líneas) | 421,1 MB | 237,1 MB | 7 |
| Documento grande (~980 líneas) | 448,3 MB | 263,6 MB | 7 |
| 3 ventanas simultáneas (doc. pequeño) | 320,9 MB | 154,0 MB | 7 |

*Estos procesos de WebView2 los lanza esta app (aparecen como hijos de `dbv-md-reader.exe` y mueren con ella) — no son un runtime ajeno que se pueda descontar. Pero el `Working Set` cuenta como propias unas páginas de código que Windows en realidad comparte físicamente entre cualquier proceso que use WebView2 (a diferencia de Electron, que no comparte nada entre apps) — por eso se reporta también la `Memoria privada`, que excluye esas páginas compartidas y refleja mejor el coste exclusivo real de esta app.*

## CPU

| Escenario | % CPU (promedio, todos los núcleos) |
|---|---|
| En reposo (tras estabilizar) | 0 % |
| Renderizado inicial (documento grande, primeros 500 ms) | 0,8 % |

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

