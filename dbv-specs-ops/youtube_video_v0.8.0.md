# 🎬 YouTube: Vídeo demo DBV Markdown Reader (v0.8.0)

## 🏷️ Título

**Recomendado:**
```
DBV Markdown Reader — Lector de Markdown gratuito y ultraligero (Windows, Linux y macOS)
```

**Alternativa a secas (la que proponías):**
```
DBV Markdown Reader
```

**Nota:** en YouTube el título es el principal factor de búsqueda/SEO (a diferencia de la Microsoft Store, donde el nombre de producto ya está fijado y la gente llega mayoritariamente por link directo). "DBV Markdown Reader" a secas es limpio y coherente con la marca, pero nadie busca ese término todavía — no tiene volumen de búsqueda propio. Añadir palabras clave (lector, Markdown, gratuito, y las tres plataformas) multiplica las posibilidades de aparecer en búsquedas de gente que no conoce el nombre del proyecto, sin dejar de ser el nombre real en primer lugar. Corregido: la primera versión de este título decía solo "para Windows", pero el proyecto ya es multiplataforma (Windows con Release oficial + Microsoft Store, Linux con `.deb`/`.AppImage` vía CI, macOS con `.dmg` vía CI) — mencionar solo Windows habría sido regalar alcance de búsqueda de balde en Linux/macOS. Si prefieres la versión a secas por estética del canal, es una opción totalmente válida — solo pierdes descubribilidad orgánica.

---

## 📝 Descripción (lista para copiar/pegar)

```
DBV Markdown Reader es un lector nativo de archivos Markdown (.md) gratuito, de código abierto y ultraligero para Windows, Linux y macOS. Construido en Rust + Tauri v2: abre en menos de 200 ms, pesa menos de 20 MB y consume menos de 64 MB de RAM, frente a los cientos de MB que consumen editores basados en Electron como VS Code solo para leer un .md.

Características principales:
- Apertura instantánea (menos de 200 ms) y consumo de RAM mínimo (menos de 64 MB)
- Instancia única: abre varios .md desde el Explorador sin multiplicar procesos
- Auto-Reload: la vista se actualiza sola (sin perder el scroll) al guardar cambios desde tu editor
- Tres temas visuales: Claro, Oscuro y Sepia
- Resaltado de sintaxis con color real en unos 24 lenguajes (Python, Rust, JSON, Bash, TypeScript...)
- Diagramas Mermaid con zoom libre (botón derecho, abrir en mermaid.live)
- Ecuaciones matemáticas LaTeX renderizadas con KaTeX
- Tabla de Contenidos automática, tiempo de lectura estimado y barra de progreso de scroll
- Búsqueda en página (Ctrl+F)
- Abre también documentos .md remotos por URL, no solo locales
- Exportación a PDF con paginación real (Ctrl+P)
- Comprobación de actualizaciones bajo demanda desde "Acerca de", nunca al arrancar
- Seguridad: sanitización anti-XSS con DOMPurify sobre todo el HTML renderizado

Descárgalo gratis:

Microsoft Store (recomendado en Windows 11):
https://apps.microsoft.com/detail/9n7bmdzgcp0s

Instalador .exe (Windows 10/11), .deb / .AppImage (Linux) y .dmg (macOS), todas las versiones:
https://github.com/davidbuenov/dbv-md-reader/releases

Enlaces:
Web del proyecto: https://davidbuenov.github.io/dbv-md-reader/
Código fuente (GitHub, licencia MIT): https://github.com/davidbuenov/dbv-md-reader
LinkedIn: https://www.linkedin.com/in/davidbueno/
davidbuenov.com

100% gratuito y de código abierto (MIT). Si te resulta útil, una estrella en GitHub ayuda mucho a que otras personas lo encuentren.

#Markdown #OpenSource #Rust #Tauri #Windows #SoftwareLibre #DesarrolladorIndependiente
```

---

## 💡 Notas de publicación

- El vídeo lleva solo música de fondo (sin narración) y los títulos en pantalla están en español e inglés — la parte en inglés de descripción/título se añadirá después, en un segundo bloque.
- Los dos primeros renglones de la descripción son los que YouTube muestra truncados antes de "más" — por eso llevan la propuesta de valor completa (gratis, código abierto, ultraligero, multiplataforma) en vez de dejarla para más abajo.
- Si el vídeo tiene secciones diferenciadas (p. ej. instalación → temas → Mermaid → PDF), añadir marcas de tiempo (`0:00 Intro`, `0:15 Instalación`...) mejora mucho el SEO de YouTube — no las he inventado porque no tengo el vídeo delante; dime los minutos aproximados de cada bloque y te las genero.
- Enlace a Microsoft Store primero (antes que el `.exe` de GitHub) porque es la vía sin aviso de SmartScreen — mismo orden que ya usa el `README.md`.
