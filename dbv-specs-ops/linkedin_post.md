# 📱 LinkedIn Post: Lanzamiento de dbv-md-reader v0.2.0

## 📝 Texto del Post (Listo para copiar/pegar)

```markdown
Ni siquiera sabías que lo necesitabas, pero a partir de ahora lo usarás cada día.

Cada vez que tenía que abrir un README.md en Windows me pasaba lo mismo: o lo abría en VS Code (demasiado para solo leer), o en el navegador (sin resaltado de código ni diagramas), o acababa instalando un visor basado en Electron que carga un Chromium entero — más de 200 MB de RAM — solo para mostrarme texto.

Así que construí dbv-md-reader: un lector de Markdown nativo para Windows.

📄 Un único .exe de ~14 MB, sin instalador
⚡ Abre cualquier .md en menos de 200 ms
🔒 Sanitiza el HTML embebido — cero scripts maliciosos, aunque el documento no sea de confianza
📊 Diagramas Mermaid renderizados al vuelo
🎨 Temas Claro, Oscuro y Sepia
🔄 Se recarga solo si editas el archivo desde otro programa, sin perder el scroll
🌐 Le pegas la URL de un .md publicado en internet y lo abre directamente
🗂️ Recuerda los últimos documentos que has abierto

Sin Electron. Sin cuenta. Sin publicidad. Sin telemetría. Doble clic y ya está.

Es gratis y de código abierto (Rust + Tauri v2), y ya lo tienes disponible:
👉 https://davidbuenov.github.io/dbv-md-reader/

Si trabajas con documentación técnica, notas en Markdown o simplemente tienes carpetas llenas de README.md sueltos, creo que te va a resultar útil.

¿Qué usas tú ahora mismo para leer archivos .md en Windows? 👇

#OpenSource #Rust #Windows #Markdown #DesarrolladorIndependiente #SoftwareLibre #Productividad #BuildInPublic
```

---

## 🖼️ Imagen recomendada

Usa la captura `docs/assets/screenshots/hero-dark.png` (o `theme-dark.png` para más resolución) del propio repositorio — es la vista principal en tema Oscuro con la Tabla de Contenidos visible. LinkedIn recorta automáticamente a 1.91:1, así que si prefieres un encuadre más panorámico usa `og-cover.png` (1200×630), pensada para ese ratio.

## 💡 Notas de publicación

- El hook inicial funciona mejor como primera línea *aislada* (LinkedIn trunca el post tras ~2-3 líneas antes de "ver más" — que esa frase quede sola maximiza la curiosidad para hacer clic).
- Si quieres, puedo preparar una variante más corta para los comentarios o para republicar como "story"/carrusel más adelante.
