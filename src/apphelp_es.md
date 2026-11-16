# 🧭 Guía de DBV Markdown Reader

> Cómo se usa la aplicación: abrir, leer, buscar, editar, exportar y los ajustes. Para escribir Markdown (encabezados, tablas, fórmulas, diagramas…) mira la pestaña **Sintaxis Markdown**, arriba.
>
> Esta ventana se abre con **F1** o con el botón **?** de la barra superior, y se cierra con **Esc**.

---

## 📑 Índice

- [1. Empezar](#1-empezar)
- [2. La ventana](#2-la-ventana)
- [3. Leer cómodamente](#3-leer-cómodamente)
- [4. Moverse entre documentos](#4-moverse-entre-documentos)
- [5. Buscar](#5-buscar)
- [6. Editar](#6-editar)
- [7. El asistente de IA](#7-el-asistente-de-ia)
- [8. Imprimir y exportar](#8-imprimir-y-exportar)
- [9. Preferencias](#9-preferencias)
- [10. Atajos de teclado](#10-atajos-de-teclado)
- [11. Modo Vim](#11-modo-vim)
- [12. Actualizaciones y dudas](#12-actualizaciones-y-dudas)

---

## 1. Empezar

Hay varias formas de abrir un documento `.md`:

- **Archivo → Abrir archivo…** (`Ctrl/Cmd + O`), o el botón de la pantalla de bienvenida.
- **Arrastrar** el archivo sobre la ventana. Si arrastras una **carpeta**, pasa a ser la raíz de la pestaña Archivos.
- **Doble clic** en un `.md` desde el explorador del sistema, o *Abrir con…* → DBV Markdown Reader. Abrir varios no multiplica procesos: cada uno tiene su propia ventana.
- **Archivo → Abrir desde URL…** para un `.md` publicado en internet (`http://` o `https://`).
- **Archivo → Archivos recientes…** para volver a lo último que abriste.
- **Archivo → Nuevo documento** (`Ctrl/Cmd + N`) pide dónde guardarlo, crea el archivo vacío y entra directamente en el Modo Edición.
- **Archivo → Guardar como…** (`Ctrl/Cmd + Mayús + S`) guarda el documento con otro nombre o en otra carpeta, y la ventana pasa al fichero nuevo. El original queda como estaba. También sirve con un documento abierto desde una URL, para guardar una copia local.
- **Archivo → Salir** (`Ctrl + Q`; en macOS, `Cmd + Q`) cierra todas las ventanas de la aplicación. Si alguna tiene cambios sin guardar, te pregunta antes en esa ventana.

Desde la línea de comandos: `dbv-md-reader ruta/al/documento.md`.

Si el archivo cambia en disco porque lo guardas desde otro programa, la vista se **recarga sola** y conserva el punto donde estabas leyendo.

---

## 2. La ventana

La parte superior tiene, de izquierda a derecha:

- **El nombre del documento**, con su tiempo estimado de lectura y, si procede, las marcas *Solo lectura* o *Modificado*. Una barra fina bajo la cabecera muestra cuánto llevas leído.
- Los botones de uso diario: **Buscar** (la lupa), **Modo Edición** (y **Guardar** mientras editas), **panel lateral** y, si la tienes conectada, la **IA** ✨.
- **Tres menús**:
  - **Archivo**: nuevo, abrir, abrir desde URL, recientes, guardar, guardar como, imprimir, exportar a Typst y salir.
  - **Herramientas**: buscar archivo, ir a la vista previa, insertar tabla, conectar una IA, esta ayuda y *Acerca de*.
  - **Preferencias**: temas y colores, ancho de lectura, tamaño de letra del editor, Modo Vim, números de línea relativos, guardado automático y opciones de la ventana.
- **El idioma** (desplegable) y **tres botones de tema**. Por defecto son Claro, Oscuro y Sepia, y cada botón se puede asignar a cualquier tema (ver el apartado 3).
- La **chincheta** (mantiene la ventana por encima de las demás, útil para tener la documentación junto a tu editor) y los botones **?** (esta ayuda) e **i** (*Acerca de*).

A la izquierda, el **panel lateral** tiene tres pestañas:

- **Índice**: los encabezados del documento. Un clic salta a esa sección y la que estás leyendo queda resaltada.
- **Archivos**: la carpeta del documento, con subcarpetas y un filtro por nombre.
- **Asistente**: la conversación con la IA, que es opcional (ver el apartado 7).

El panel lateral y la posición y tamaño de la ventana se **recuerdan** al cerrar la aplicación (la ventana se puede dejar de recordar en Preferencias).

---

## 3. Leer cómodamente

- **Tema**: hay diez, los mismos de toda la colección DBV: Oscuro, Claro, Sepia, Alto contraste, Nord, Dracula, Catppuccin Mocha, Catppuccin Latte, Solarized Dark y Gruvbox Dark, más uno **Personalizado**. Todo sigue al tema: el texto, el código, los diagramas Mermaid, los menús y el Asistente. Imprimir usa siempre la paleta Clara.
- **Preferencias → Temas y colores…** abre un diálogo con una tarjeta por tema (también se eligen con las flechas). Ahí asignas los tres botones rápidos de la barra y editas el tema Personalizado: copias la paleta de un tema y cambias cada color. Si el texto queda con poco contraste, te avisa.
- **Zoom**: `Ctrl/Cmd + +`, `Ctrl/Cmd + -` y `Ctrl/Cmd + 0` para restablecerlo. Con el cursor dentro del editor, esas teclas cambian solo el tamaño de letra del editor.
- **Zoom con la rueda**: `Ctrl/Cmd + rueda` actúa sobre el panel que tienes bajo el puntero. Sobre el editor cambia su letra; sobre la lectura o la vista previa, el zoom de lectura. El pellizco del panel táctil va escalón a escalón, sin saltos bruscos.
- **Ancho de lectura** (Preferencias): *Estrecho*, *Normal*, *Ancho* o *Completo*. Las líneas muy largas cansan; elige el que prefieras.
- **Bloques anchos a todo el ancho** (Preferencias): con la casilla marcada, las tablas, el código, los diagramas y las imágenes sueltas pueden ocupar más que el texto. Desmárcala para que todo quede alineado con la columna de texto.
- **Bloques de código**: tienen números de línea y, al pasar el ratón, dos botones: **Copiar** y **Ajustar línea** (para ver las líneas largas sin desplazarte).
- **Diagramas Mermaid**: clic derecho sobre uno → *Abrir en mermaid.live* para verlo con zoom libre.
- **Fórmulas LaTeX**, **notas al pie**, **listas de tareas** y **tablas** se muestran ya renderizadas.

---

## 4. Moverse entre documentos

- **Enlaces**: un enlace a otro `.md` lo abre en la misma ventana; uno a una página web, en tu navegador. Los enlaces a una sección del mismo documento hacen scroll hasta ella.
- **Atrás y adelante**: `Alt + ←` y `Alt + →` recorren los documentos que has ido abriendo.
- **Buscar archivo** (`Ctrl/Cmd + K`): escribe parte del nombre de cualquier archivo de la carpeta y pulsa `Enter`; con `↑` y `↓` eliges entre los resultados.
- **Pestaña Archivos**: clic abre el archivo; `Ctrl/Cmd + clic` lo abre en una **ventana nueva**. El clic derecho ofrece *Abrir en ventana nueva* y *Revelar en el Explorador*.
- **Inicio** y **Fin** llevan al principio o al final del documento.

---

## 5. Buscar

Pulsa `Ctrl/Cmd + F` o la lupa. Escribe y se marcan las coincidencias; `Enter` pasa a la siguiente y `Mayús + Enter` a la anterior.

En **Modo Edición** la búsqueda tiene un selector **Dónde buscar**: **Editor** (el texto Markdown tal como lo escribiste, con todo su formato) o **Vista previa** (el texto ya renderizado). En el editor se marca la coincidencia actual aunque el foco esté en el cuadro de búsqueda.

---

## 6. Editar

Pulsa `Ctrl/Cmd + E` (o el botón del lápiz) para entrar en el **Modo Edición**: el Markdown en crudo queda a la izquierda, con números de línea, y la vista renderizada a la derecha. Arrastra el borde entre ambos para cambiar su reparto.

- **Guardar**: `Ctrl/Cmd + S`. Verás *Modificado* mientras haya cambios sin guardar; al salir o abrir otro documento se te avisa antes de perderlos.
- **Barra de estado**: al pie del editor se ve `Ln X, Col Y` y, si hay selección, cuántos caracteres llevas seleccionados. Un emoji o una sílaba coreana cuentan como un carácter.
- **Números de línea relativos** (Preferencias): cada línea muestra su distancia a la del cursor, y la del cursor su número. Es cómodo con el Modo Vim (`5j`, `3dd`…).
- **Guardado automático** (Preferencias, apagado por defecto): guarda a los 2 segundos de dejar de escribir y al salir del Modo Edición, con un aviso discreto en la barra de estado. Nunca pisa un cambio hecho desde otro programa: si el archivo cambió en disco, no escribe y te avisa. No actúa en documentos abiertos desde una URL.
- **Barra de formato**: negrita, cursiva, encabezados, listas, enlaces, imágenes, tablas, código… Envuelve la selección o inserta un esqueleto para rellenar. `Ctrl/Cmd + B` y `Ctrl/Cmd + I` ponen negrita y cursiva.
- **Insertar tabla**: el botón de tabla de la barra de formato o **Herramientas → Insertar tabla…** abren un panel con filas, columnas (de 1 a 20) y «Fila de encabezado». La tabla va en su propia línea con el cursor en la primera celda, y `Ctrl/Cmd + Z` la deshace de una vez. Si antes seleccionas texto con tabuladores o comas (lo que pegas de una hoja de cálculo), lo convierte en tabla.
- **Tab** y **Mayús + Tab** sangran o quitan la sangría de la línea (o de todas las seleccionadas). Muy útil en listas anidadas.
- **Tamaño de letra del editor**: en *Preferencias* (Reducir, Aumentar, Restablecer), con `Ctrl/Cmd + +`, `-` y `0` estando dentro del editor, o con `Ctrl/Cmd + rueda` sobre él.
- **Las dos mitades van a la par**: al hacer scroll en una, la otra la sigue. **Doble clic en la vista previa** lleva el cursor al texto que has pulsado; `Ctrl/Cmd + Alt + P` hace lo contrario (del editor a la vista previa).
- **Reordenar secciones**: con el Modo Edición activo, **arrastra una entrada del Índice** y suéltala entre otras: se mueve esa sección entera (el encabezado y todo lo que cuelga de él) en el texto. También con `Alt + ↑` y `Alt + ↓` sobre la entrada. Se deshace con `Ctrl/Cmd + Z` y se rehace con `Ctrl + Y` (o `Ctrl/Cmd + Mayús + Z`); tras mover una sección, el deshacer recuerda solo ese último movimiento.
- **Pegar o soltar imágenes**: pega una captura de pantalla (o suelta un archivo de imagen) y se guarda en una carpeta `images/` junto al documento. En el editor se inserta además `![](images/…)` en el cursor.
- **Si el archivo cambia por fuera mientras lo editas**: se te avisa con un banner y eliges entre conservar tus cambios o recargar desde el disco. Nunca se pierde nada en silencio.
- **Modo Vim**: si estás acostumbrado a Vim, actívalo en Preferencias. Lo tienes explicado en el apartado 11.

Para escribir la sintaxis misma, tienes la pestaña **Sintaxis Markdown** de esta ayuda y las [20 plantillas del proyecto](https://github.com/davidbuenov/dbv-md-reader/tree/master/templates), listas para copiar y rellenar.

---

## 7. El asistente de IA

Es **opcional**: mientras no conectes nada, la aplicación ni carga el código de la IA ni abre ninguna conexión. Solo existe en escritorio.

1. Abre **Herramientas → Conectar una IA…** o pulsa `Ctrl/Cmd + Mayús + I`.
2. Elige de dónde viene el modelo: uno **local** (Ollama o LM Studio, nada sale de tu equipo), uno **en la nube con tu clave de API**, o un **agente que ya tengas instalado** (Claude Code, Gemini CLI, Codex o GitHub Copilot CLI).
3. En la pestaña **Asistente** conversas sobre el documento abierto y su carpeta. Escribe `@` para mencionar otro `.md`.

**La IA nunca escribe sin que lo revises.** Te enseña los cambios trozo a trozo y los aceptas o rechazas uno a uno; al aplicarlos se hacen en el editor, y los deshaces con `Ctrl/Cmd + Z`.

**Autonomía**: el selector de la barra del Asistente decide qué puede hacer la IA sin preguntarte:

| Nivel | Qué hace |
| --- | --- |
| **Preguntar todo** | Pide permiso antes de leer cualquier archivo de la carpeta que no sea el documento abierto. |
| **Preguntar al modificar** | Lee la carpeta libremente y te propone los cambios para que los revises (es el nivel por defecto). |
| **Solo lectura** | Contesta, pero no puede proponer cambios. |

No hay un nivel «automático»: en esta aplicación nada se escribe sin tu revisión. Con los agentes (Claude Code, Codex…) el selector controla lo que el agente pide a la aplicación; sus propias herramientas las gobierna el agente.

Si la IA se queda **esperando tu aprobación** y la ventana no está delante, su icono parpadea en la barra de tareas (en macOS rebota en el Dock) hasta que vuelves a ella.

También hay IA sobre el texto seleccionado (mejorar, corregir, traducir, acortar…): en Modo Edición, `Ctrl/Cmd + Alt + I` o clic derecho → *IA: acciones sobre el texto…*.

Si no te interesa, desmarca **Preferencias → Mostrar las funciones de IA** y desaparece de la interfaz. La guía completa está en [docs/IA.md](https://github.com/davidbuenov/dbv-md-reader/blob/master/docs/IA.md).

---

## 8. Imprimir y exportar

- **Imprimir / PDF** (`Ctrl/Cmd + P`): abre el diálogo de impresión del sistema, y de ahí puedes imprimir o **guardar como PDF**. La paginación es real (A4), sin títulos, tablas ni código partidos entre páginas, y los colores de sintaxis se conservan sea cual sea el tema de la pantalla.
- **Exportar a Typst** (menú *Archivo*): convierte el documento a `.typ` (encabezados, énfasis, código, listas, citas, tablas, imágenes y enlaces). No necesitas tener Typst instalado; es el camino para seguir con [dbv-typst-editor](https://davidbuenov.github.io/dbv-typst-editor/) si quieres un control fino del PDF final.

---

## 9. Preferencias

El menú **Preferencias** recoge los ajustes. Se aplican al instante y se recuerdan.

| Ajuste | Qué hace |
| --- | --- |
| **Temas y colores…** | Elegir tema, asignar los tres botones rápidos y editar el tema Personalizado. |
| **Ancho de lectura** | Estrecho, Normal, Ancho o Completo. |
| **Bloques anchos a todo el ancho** | Deja que tablas, código, diagramas e imágenes sueltas ocupen más que el texto. |
| **Tamaño de letra del editor** | Reducir, aumentar o restablecer. Muestra el porcentaje actual. |
| **Modo Vim** | Edición al estilo Vim en el editor y teclas de Vim para moverte al leer (apartado 11). Apagado por defecto. |
| **Números de línea relativos** | En el editor, cada línea muestra su distancia a la del cursor. Apagado por defecto. |
| **Guardado automático** | Guarda solo a los 2 segundos de dejar de escribir. Apagado por defecto. |
| **Recordar la posición y el tamaño de la ventana** | Al abrir la aplicación, vuelve donde la dejaste (sin quedar nunca fuera de la pantalla). |
| **Mostrar las funciones de IA** | Oculta o muestra todo lo relacionado con la IA. |

El **idioma** y los **botones de tema** están en la barra, junto al menú Preferencias. La interfaz está en español, inglés y coreano; si tu sistema usa otro idioma, se usa el inglés. Solo se recuerda el idioma que elijas tú, no el que se detecta solo.

---

## 10. Atajos de teclado

En macOS, `Cmd` hace el papel de `Ctrl`.

| Atajo | Acción |
| --- | --- |
| `F1` | Abrir esta ayuda |
| `Ctrl/Cmd + N` | Nuevo documento |
| `Ctrl/Cmd + O` | Abrir archivo |
| `Ctrl/Cmd + S` | Guardar (en Modo Edición) |
| `Ctrl/Cmd + Mayús + S` | Guardar como… |
| `Ctrl/Cmd + P` | Imprimir / exportar a PDF |
| `Ctrl + Q` (`Cmd + Q` en macOS) | Salir |
| `Ctrl/Cmd + F` | Buscar |
| `Ctrl/Cmd + K` | Buscar archivo por nombre |
| `Ctrl/Cmd + E` | Alternar Modo Edición |
| `Ctrl/Cmd + Mayús + I` | Asistente de IA (o conectar una IA) |
| `Ctrl/Cmd + Alt + I` | IA sobre la selección (en el editor) |
| `Ctrl/Cmd + Alt + P` | Ir a la vista previa desde el cursor (en el editor) |
| `Ctrl/Cmd + B` / `Ctrl/Cmd + I` | Negrita / cursiva (en el editor) |
| `Tab` / `Mayús + Tab` | Sangrar / quitar sangría (en el editor) |
| `Alt + ↑` / `Alt + ↓` | Mover la sección del Índice seleccionada (Modo Edición) |
| `Ctrl/Cmd + +` / `-` / `0` | Acercar / alejar / restablecer el zoom |
| `Ctrl/Cmd + rueda` | Zoom del panel que hay bajo el puntero |
| `Alt + ←` / `Alt + →` | Atrás / adelante en el historial |
| `Inicio` / `Fin` | Principio / final del documento |
| `Esc` | Cerrar el panel o el diálogo abierto |

---

## 11. Modo Vim

Actívalo en **Preferencias → Modo Vim**. Apagado (lo normal), el editor funciona como siempre y estas teclas no hacen nada.

Al entrar en Modo Edición el editor empieza en modo **NORMAL**: las letras son órdenes, no texto. Al pie del editor verás el modo en que estás (**NORMAL**, **INSERT**, **VISUAL** o **V-LINE**) y, en NORMAL y VISUAL, un cursor de bloque.

**Lo que entiende** (un subconjunto de Vim, no todo Vim):

| Grupo | Teclas |
| --- | --- |
| Moverse | `h j k l` · `w b e` y `W B E` · `0 ^ $` · `gg G` y `{n}G` · `f F t T` con `;` `,` · `%` entre paréntesis y corchetes · `{ }` entre párrafos · `Ctrl+D` / `Ctrl+U` media pantalla |
| Contadores | Un número delante: `3w`, `5j`, `2dd`, `d3w` |
| Operadores | `d` (borrar), `c` (cambiar), `y` (copiar), `>` y `<` (sangrar) con un movimiento o en Visual · `dd cc yy >> <<` · `D C Y` · `x X` · `p P` · `r{c}` · `J` · `~` · objetos de texto `iw` y `aw` (`diw`, `ciw`, `daw`) |
| Escribir | `i a I A o O`; se vuelve a NORMAL con `Esc` o `Ctrl+[` |
| Seleccionar | `v` (caracteres) y `V` (líneas) |
| Deshacer | `u` deshace y `Ctrl+R` rehace. Cada orden y cada rato en INSERT es un solo paso. Mover una sección, la IA o insertar una tabla también cuentan como un paso. |
| Buscar | `/texto` hacia delante y `?texto` hacia atrás, con `n` y `N` para repetir. No distingue mayúsculas. |
| Órdenes | `:w` guarda · `:wq` o `:x` guarda y sale del Modo Edición · `:q` sale del Modo Edición (sin cerrar la ventana) · `:{n}` va a la línea n |

**Para tener en cuenta:**

- Los atajos de la aplicación con `Ctrl/Cmd` (guardar, buscar, Modo Edición, zoom, IA…) siguen funcionando en todos los modos.
- `y` copia a un registro interno, como en Vim, y no al portapapeles del sistema. `Ctrl+C` y `Ctrl+V` siguen funcionando para el portapapeles.
- `Esc` en INSERT o VISUAL solo vuelve a NORMAL. En NORMAL, cierra el panel abierto, como siempre.
- Con teclados que componen caracteres (coreano, por ejemplo), las letras solo escriben en INSERT. En NORMAL pulsa `i` antes de escribir.
- No están las macros, los registros con nombre, las marcas, `:s`, el Visual de bloque, `.vimrc` ni `.` (repetir el último cambio).

**Al leer** (y en la vista previa del Modo Edición), con el Modo Vim activo:

| Tecla | Acción |
| --- | --- |
| `j` / `k` | Bajar / subir una línea |
| `Ctrl+D` / `Ctrl+U` | Bajar / subir media pantalla |
| `gg` / `G` | Principio / final del documento |
| `]]` / `[[` | Encabezado siguiente / anterior (como un clic en el Índice) |
| `/` | Buscar |
| `n` / `N` | Coincidencia siguiente / anterior |

`Ctrl+F` sigue siendo Buscar. Las teclas no actúan mientras escribes en un cuadro de texto, un menú o un diálogo.

---

## 12. Actualizaciones y dudas

- **Acerca de** (botón **i** o menú Herramientas) muestra la versión y el botón **Buscar actualizaciones**. Nunca se comprueba al arrancar. En la versión de Microsoft Store o de Google Play, la tienda las instala sola.
- Código fuente, descargas, incidencias y propuestas: [github.com/davidbuenov/dbv-md-reader](https://github.com/davidbuenov/dbv-md-reader).

---

<div align="center">

Hecho con cariño por **[David Bueno Vallejo](https://github.com/davidbuenov)** · Licencia MIT

</div>
