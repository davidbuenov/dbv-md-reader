# Ficha de Microsoft Store — Español (España)

> Copia cada campo tal cual a la sección correspondiente de Partner Center ("Descripción de Store"). Los límites de caracteres indicados son los que muestra el propio formulario.

---

## Descripción *

DBV Markdown Reader es un lector y editor nativo de archivos Markdown (.md) para Windows: ligero, rápido y 100% local — sin cuentas, sin publicidad, sin telemetría.

Abre cualquier documento .md al instante (menos de 200 ms) con el motor de renderizado nativo de Windows, sin necesidad de un IDE pesado. Si necesitas editar, su Modo Edición con vista dividida en vivo muestra el código y la previsualización renderizada en tiempo real, con una barra de formato Markdown y gestión inteligente de conflictos si el archivo cambia desde otro programa. Ocupa apenas unos pocos megabytes de memoria — literalmente cientos de veces menos que las alternativas basadas en Electron.

Ideal para leer y editar documentación técnica, notas, README de proyectos de GitHub, apuntes de estudio o cualquier colección de archivos Markdown interconectados.

Características principales:
• Apertura instantánea por doble clic o "Abrir con..."
• Modo Edición (Ctrl+E) con vista dividida en vivo, barra de formato Markdown y Tab/Shift+Tab para indentar listas
• Explorador de árbol de directorios y selector rápido de archivos (Ctrl+K)
• Exportación directa a Typst (.typ) para seguir editando el documento con un editor de Typst
• Gestión de conflictos si el archivo cambia desde otro programa mientras editas
• Auto-recarga en vivo cuando editas el archivo desde otro programa, sin perder el scroll
• Diagramas Mermaid renderizados como SVG interactivo, con opción de abrirlos en mermaid.live
• Ecuaciones matemáticas en LaTeX renderizadas con KaTeX
• Resaltado de sintaxis de código en más de 24 lenguajes, con colores adaptados a cada tema — también al imprimir o exportar a PDF, y con numeración de línea siempre alineada
• Alertas al estilo GitHub (Nota, Consejo, Importante...), listas de tareas y notas al pie (GFM)
• Tabla de contenidos automática con la sección activa resaltada, y búsqueda de texto instantánea (Ctrl+F)
• Tres temas de lectura: Claro, Oscuro y Sepia
• Navegación entre documentos enlazados con historial (Atrás/Adelante)
• Abre también documentos Markdown remotos por URL
• Interfaz disponible en español e inglés
• 100% seguro: el HTML embebido se sanitiza automáticamente antes de mostrarse

Sin conexión a internet requerida para funcionar, sin recopilación de datos personales. Tus documentos nunca salen de tu equipo.

---

## Novedades de esta versión

v0.16.0: nueva exportación directa a Typst (.typ) para seguir editando el documento con un editor de Typst. Colores de sintaxis correctos al imprimir o exportar a PDF (antes se perdían al hacerlo desde el tema Oscuro o Sepia) y numeración de línea siempre alineada en los bloques de código. Además, desde la actualización anterior: alertas al estilo GitHub (Nota, Consejo, Importante...), indicador de cambios sin guardar en Modo Edición con confirmación antes de descartarlos, y varias correcciones de estabilidad (cierre de ventana con cambios sin guardar, enlaces internos con tildes/ñ).

---

## Características del producto
*(máximo 20, resúmenes breves — se muestran como lista con viñetas)*

1. Lector y editor de Markdown con guardado directo (.md)
2. Apertura instantánea (menos de 200 ms) y 100% local: sin cuentas, sin telemetría, sin publicidad
3. Modo Edición con vista dividida en vivo (código + previsualización)
4. Barra de formato Markdown (16 acciones) + Tab/Shift+Tab para indentar listas
5. Explorador de árbol de directorios y selector rápido de archivos (Ctrl+K)
6. Exportar a Typst (.typ) para seguir editando con un editor de Typst
7. Gestión de conflictos si el archivo cambia desde otro programa mientras editas
8. Auto-recarga en vivo al editar el archivo desde otra herramienta
9. Ayuda de sintaxis Markdown integrada (chuleta interactiva)
10. Diagramas Mermaid renderizados como SVG interactivo
11. Ecuaciones matemáticas en LaTeX, renderizadas con KaTeX
12. Resaltado de sintaxis en más de 24 lenguajes, colores correctos también al imprimir/exportar a PDF
13. Números de línea (siempre alineados) y ajuste de línea en los bloques de código
14. Alertas al estilo GitHub, listas de tareas y notas al pie (GFM)
15. Tabla de contenidos automática con la sección activa resaltada
16. Búsqueda de texto instantánea (Ctrl+F)
17. Tres temas de lectura: Claro, Oscuro y Sepia
18. Navegación con historial y apertura de documentos remotos por URL
19. Archivos recientes, zoom proporcional (Ctrl+Rueda) y modo Always on Top
20. Interfaz disponible en español e inglés

---

## Campos complementarios

### Título corto
*(versión más corta opcional del nombre, se usa en Xbox — dejar en blanco si no aplica)*

DBV Markdown Reader

### Descripción corta
*(máx. recomendado 270 caracteres)*

Lector y editor nativo de Markdown para Windows: rápido, ligero y 100% local. Modo Edición en vivo, explorador de archivos, diagramas Mermaid, ecuaciones KaTeX, exportación a Typst y PDF, y tres temas visuales. Sin telemetría, sin cuentas.

---

## Información adicional

### Palabras clave
*(máximo 7, 40 caracteres cada una)*

- markdown
- editor markdown
- lector markdown
- documentación técnica
- readme github
- notas markdown
- diagramas mermaid

### Información de copyright y marca registrada

© 2026 David Bueno Vallejo

### Términos de licencia adicionales

*(dejar en blanco — se usan los términos estándar de la Store, la app en sí es MIT)*

### Desarrollado por

David Bueno Vallejo

---

## Notas para certificación
*(pantalla "Additional Testing Info" de Partner Center — campo "Description". No lo ve el usuario final, solo el equipo de certificación. No requiere credenciales: dejar la tabla "Credentials" vacía.)*

Esta aplicación no requiere cuenta, inicio de sesión ni credenciales de ningún tipo — funciona completamente sin conexión a internet y no recopila ningún dato personal.

Para probarla:
1. Al abrirla sin ningún archivo, se muestra una pantalla vacía con un botón para abrir un archivo, o se puede arrastrar y soltar directamente un archivo .md sobre la ventana.
2. Se puede crear un archivo de prueba con extensión .md y contenido Markdown básico, por ejemplo:

   ````markdown
   # Título de prueba

   Texto en **negrita** y *cursiva*, una lista:
   - Uno
   - Dos

   ```javascript
   console.log('hola');
   ```
   ````

3. Modo Edición: el icono de lápiz de la barra superior (o Ctrl+E) abre un panel dividido con el código a la izquierda y la vista renderizada a la derecha; los cambios se guardan con Ctrl+S.
4. También se puede asociar la app a la extensión .md desde Configuración > Aplicaciones predeterminadas de Windows, y abrir cualquier archivo .md haciendo doble clic en el Explorador de archivos.

No hay ninguna funcionalidad oculta tras un inicio de sesión ni contenido de pago — todas las funciones están disponibles desde el primer uso.
