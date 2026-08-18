# Resultados de Benchmark — dbv-md-reader

> Generado automáticamente por `scripts/benchmark.ps1`. Metodología: 7 repeticiones por medición, se descarta la mejor y la peor, se promedia el resto. Repetible por cualquiera — ejecuta el script en tu propia máquina para comparar.

## Equipo de referencia

| Campo | Valor |
|---|---|
| Fecha | 2026-08-17 20:18 |
| CPU | 13th Gen Intel(R) Core(TM) i7-13700KF |
| Núcleos / hilos | 16 núcleos / 24 hilos |
| RAM total | 127.8 GB |
| GPU | Meta Virtual Monitor |
| SO | Microsoft Windows 11 Pro (build 26200) |
| Alimentación | Corriente alterna |
| Ejecutable probado | dbv-md-reader.exe (16.35 MB, compilado 2026-08-17 19:15) |

## Arranque

| Medición | Resultado |
|---|---|
| Arranque en frío (documento pequeño) | 36 ms |
| Arranque en caliente (documento pequeño) | 31 ms |

*"Frío"/"caliente" aproximan si la caché de disco del SO ya tenía el ejecutable — no es un reinicio real de Windows entre medición y medición (impracticable de automatizar). "Listo" se mide como el instante en que el proceso obtiene un `MainWindowHandle` visible, no cuando el documento ha terminado de renderizarse del todo.*

## Memoria (RAM)

### Proceso principal (dbv-md-reader.exe en solitario)

| Escenario | Working Set | Memoria privada |
|---|---|---|
| Estado vacío (sin documento) | 31,3 MB | 7,6 MB |
| Documento pequeño (~40 líneas) | 31,2 MB | 7,5 MB |
| Documento grande (~980 líneas) | 31,5 MB | 7,7 MB |
| 3 ventanas simultáneas (doc. pequeño) | 24,8 MB | 4,5 MB |

### Árbol completo (incluye los procesos que WebView2 lanza para esta app: motor de renderizado, GPU, red, almacenamiento...)

| Escenario | Working Set total | Memoria privada total | Nº procesos |
|---|---|---|---|
| Estado vacío (sin documento) | 398,1 MB | 215,1 MB | 7 |
| Documento pequeño (~40 líneas) | 407,5 MB | 226,8 MB | 7 |
| Documento grande (~980 líneas) | 425,6 MB | 245,5 MB | 7 |
| 3 ventanas simultáneas (doc. pequeño) | 321,6 MB | 150,6 MB | 7 |

*Estos procesos de WebView2 los lanza esta app (aparecen como hijos de `dbv-md-reader.exe` y mueren con ella) — no son un runtime ajeno que se pueda descontar. Pero el `Working Set` cuenta como propias unas páginas de código que Windows en realidad comparte físicamente entre cualquier proceso que use WebView2 (a diferencia de Electron, que no comparte nada entre apps) — por eso se reporta también la `Memoria privada`, que excluye esas páginas compartidas y refleja mejor el coste exclusivo real de esta app.*

## CPU

| Escenario | % CPU (promedio, todos los núcleos) |
|---|---|
| En reposo (tras estabilizar) | 0 % |
| Renderizado inicial (documento grande, primeros 500 ms) | 0,8 % |


