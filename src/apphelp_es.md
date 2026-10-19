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
- [11. Actualizaciones y dudas](#11-actualizaciones-y-dudas)

---

## 1. Empezar

Hay varias formas de abrir un documento `.md`:

- **Archivo → Abrir archivo…** (`Ctrl/Cmd + O`), o el botón de la pantalla de bienvenida.
- **Arrastrar** el archivo sobre la ventana. Si arrastras una **carpeta**, pasa a ser la raíz de la pestaña Archivos.
- **Doble clic** en un `.md` desde el explorador del sistema, o *Abrir con…* → DBV Markdown Reader. Abrir varios no multiplica procesos: cada uno tiene su propia ventana.
- **Archivo → Abrir desde URL…** para un `.md` publicado en internet (`http://` o `https://`).
- **Archivo → Archivos recientes…** para volver a lo último que abriste.
- **Archivo → Nuevo documento** (`Ctrl/Cmd + N`) pide dónde guardarlo, crea el archivo vacío y entra directamente en el Modo Edición.

Desde la línea de comandos: `dbv-md-reader ruta/al/documento.md`.

Si el archivo cambia en disco porque lo guardas desde otro programa, la vista se **recarga sola** y conserva el punto donde estabas leyendo.

---

## 2. La ventana

La parte superior tiene, de izquierda a derecha:

- **El nombre del documento**, con su tiempo estimado de lectura y, si procede, las marcas *Solo lectura* o *Modificado*. Una barra fina bajo la cabecera muestra cuánto llevas leído.
- **Tres menús**:
  - **Archivo**: nuevo, abrir, abrir desde URL, recientes, guardar, imprimir y exportar a Typst.
  - **Herramientas**: buscar archivo, ir a la vista previa, conectar una IA, esta ayuda y *Acerca de*.
  - **Preferencias**: ancho de lectura, tamaño de letra del editor y opciones de la ventana.
- **El idioma** (desplegable) y el **tema**: Claro, Oscuro o Sepia.
- Los botones de uso diario: **Buscar** (la lupa), **Modo Edición**, **panel lateral**, **chincheta** (mantiene la ventana por encima de las demás, útil para tener la documentación junto a tu editor) y los botones **?** (esta ayuda) e **i** (*Acerca de*).

A la izquierda, el **panel lateral** tiene tres pestañas:

- **Índice**: los encabezados del documento. Un clic salta a esa sección y la que estás leyendo queda resaltada.
- **Archivos**: la carpeta del documento, con subcarpetas y un filtro por nombre.
- **Asistente**: la conversación con la IA, que es opcional (ver el apartado 7).

El panel lateral y la posición y tamaño de la ventana se **recuerdan** al cerrar la aplicación (la ventana se puede dejar de recordar en Preferencias).

---

## 3. Leer cómodamente

- **Tema**: Claro, Oscuro o Sepia (lectura prolongada). El resaltado de código se adapta a cada uno.
- **Zoom**: `Ctrl/Cmd + +`, `Ctrl/Cmd + -` y `Ctrl/Cmd + 0` para restablecerlo. Con el cursor dentro del editor, esas teclas cambian solo el tamaño de letra del editor.
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
- **Barra de formato**: negrita, cursiva, encabezados, listas, enlaces, imágenes, tablas, código… Envuelve la selección o inserta un esqueleto para rellenar. `Ctrl/Cmd + B` y `Ctrl/Cmd + I` ponen negrita y cursiva.
- **Tab** y **Mayús + Tab** sangran o quitan la sangría de la línea (o de todas las seleccionadas). Muy útil en listas anidadas.
- **Tamaño de letra del editor**: en *Preferencias* (Reducir, Aumentar, Restablecer), o con `Ctrl/Cmd + +`, `-` y `0` estando dentro del editor.
- **Las dos mitades van a la par**: al hacer scroll en una, la otra la sigue. **Doble clic en la vista previa** lleva el cursor al texto que has pulsado; `Ctrl/Cmd + Alt + P` hace lo contrario (del editor a la vista previa).
- **Reordenar secciones**: con el Modo Edición activo, **arrastra una entrada del Índice** y suéltala entre otras: se mueve esa sección entera (el encabezado y todo lo que cuelga de él) en el texto. También con `Alt + ↑` y `Alt + ↓` sobre la entrada. Se deshace con `Ctrl/Cmd + Z` y se rehace con `Ctrl + Y` (o `Ctrl/Cmd + Mayús + Z`); tras mover una sección, el deshacer recuerda solo ese último movimiento.
- **Pegar o soltar imágenes**: pega una captura de pantalla (o suelta un archivo de imagen) y se guarda en una carpeta `images/` junto al documento. En el editor se inserta además `![](images/…)` en el cursor.
- **Si el archivo cambia por fuera mientras lo editas**: se te avisa con un banner y eliges entre conservar tus cambios o recargar desde el disco. Nunca se pierde nada en silencio.

Para escribir la sintaxis misma, tienes la pestaña **Sintaxis Markdown** de esta ayuda y las [20 plantillas del proyecto](https://github.com/davidbuenov/dbv-md-reader/tree/master/templates), listas para copiar y rellenar.

---

## 7. El asistente de IA

Es **opcional**: mientras no conectes nada, la aplicación ni carga el código de la IA ni abre ninguna conexión. Solo existe en escritorio.

1. Abre **Herramientas → Conectar una IA…** o pulsa `Ctrl/Cmd + Mayús + I`.
2. Elige de dónde viene el modelo: uno **local** (Ollama o LM Studio, nada sale de tu equipo), uno **en la nube con tu clave de API**, o un **agente que ya tengas instalado** (Claude Code, Gemini CLI, Codex o GitHub Copilot CLI).
3. En la pestaña **Asistente** conversas sobre el documento abierto y su carpeta. Escribe `@` para mencionar otro `.md`.

**La IA nunca escribe sin que lo revises.** Te enseña los cambios trozo a trozo y los aceptas o rechazas uno a uno; al aplicarlos se hacen en el editor, y los deshaces con `Ctrl/Cmd + Z`.

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
| **Ancho de lectura** | Estrecho, Normal, Ancho o Completo. |
| **Bloques anchos a todo el ancho** | Deja que tablas, código, diagramas e imágenes sueltas ocupen más que el texto. |
| **Tamaño de letra del editor** | Reducir, aumentar o restablecer. Muestra el porcentaje actual. |
| **Recordar la posición y el tamaño de la ventana** | Al abrir la aplicación, vuelve donde la dejaste (sin quedar nunca fuera de la pantalla). |
| **Mostrar las funciones de IA** | Oculta o muestra todo lo relacionado con la IA. |

El **idioma** y el **tema** están en la barra, junto al menú Preferencias. La interfaz está en español, inglés y coreano; si tu sistema usa otro idioma, se usa el inglés. Solo se recuerda el idioma que elijas tú, no el que se detecta solo.

---

## 10. Atajos de teclado

En macOS, `Cmd` hace el papel de `Ctrl`.

| Atajo | Acción |
| --- | --- |
| `F1` | Abrir esta ayuda |
| `Ctrl/Cmd + N` | Nuevo documento |
| `Ctrl/Cmd + O` | Abrir archivo |
| `Ctrl/Cmd + S` | Guardar (en Modo Edición) |
| `Ctrl/Cmd + P` | Imprimir / exportar a PDF |
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
| `Alt + ←` / `Alt + →` | Atrás / adelante en el historial |
| `Inicio` / `Fin` | Principio / final del documento |
| `Esc` | Cerrar el panel o el diálogo abierto |

---

## 11. Actualizaciones y dudas

- **Acerca de** (botón **i** o menú Herramientas) muestra la versión y el botón **Buscar actualizaciones**. Nunca se comprueba al arrancar. En la versión de Microsoft Store o de Google Play, la tienda las instala sola.
- Código fuente, descargas, incidencias y propuestas: [github.com/davidbuenov/dbv-md-reader](https://github.com/davidbuenov/dbv-md-reader).

---

<div align="center">

Hecho con cariño por **[David Bueno Vallejo](https://github.com/davidbuenov)** · Licencia MIT

</div>
