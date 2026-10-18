# 📱 LinkedIn Post: Actualización dbv-md-reader (v0.3.0 → v0.4.0, 2 días después del lanzamiento)

## 📝 Texto del Post (Listo para copiar/pegar)

```markdown
Si encuentras un visor de Markdown más eficiente, te lo compro.

Hace dos días publiqué dbv-md-reader. En 48 horas ya ha evolucionado más de lo que esperaba:

🪟 Instancia única de verdad: abre 10 documentos y sigue siendo UN solo proceso en el Administrador de Tareas — antes cada .md abierto lanzaba una instancia nueva, ahora todas las ventanas viven bajo el mismo proceso, cada una con su propio zoom, búsqueda y contenido.
🔄 Edita el archivo desde tu editor favorito y la vista se actualiza sola, al instante, sin perder el scroll ni tocar nada.
🔗 ¿Diagrama Mermaid enorme e ilegible? Botón derecho → ábrelo en mermaid.live con pan y zoom libres.
📦 Instalador rehecho: dos casillas de verdad (menú contextual / aplicación predeterminada), marcadas por defecto pero decidibles por ti — nada se impone en silencio, y se desinstala tan limpio como se instala.
🔔 Comprobación de actualizaciones bajo demanda desde "Acerca de" — nunca al arrancar, para no robarle ni un milisegundo a los <200 ms de apertura. La encuentra, la descarga, la instala y reinicia la app sola.

Y la prueba del algodón — los mismos 2 archivos abiertos a la vez, memoria según el Administrador de Tareas de Windows:

Visual Studio Code: 885,8 MB
Notepad++: 21,5 MB
dbv-md-reader: 5,9 MB

Ni Notepad++ —la referencia histórica de ligereza en Windows— se le acerca.

Si todavía no lo tienes, descárgatelo ya. Tu navegador probablemente te avisará de que "no es de confianza" — es lo que tiene el software libre y gratuito hecho por una persona: si quieres que deje de decírtelo, hay que pagar entre 100 y 400 €/año por un certificado de firma de código. Prefiero gastarme eso en café mientras sigo programando.

Y si te resulta útil, una estrella en GitHub sienta mejor que ese café ☕⭐
👉 https://github.com/davidbuenov/dbv-md-reader

#OpenSource #Rust #Tauri #Windows #Markdown #DesarrolladorIndependiente #SoftwareLibre #BuildInPublic
```

---

## 🖼️ Imagen recomendada

`docs/assets/screenshots/comparacioneficiencia.png` — la captura del Administrador de Tareas con los 3 procesos lado a lado (885,8 MB / 21,5 MB / 5,9 MB). Es la imagen que sostiene todo el post: pégala directamente después del párrafo de la comparativa, antes del cierre. No hace falta ningún gráfico adicional — el propio Administrador de Tareas de Windows ya es la prueba más creíble posible.

## 💡 Notas de publicación

- El hook ("Si encuentras un visor de Markdown más eficiente, te lo compro.") funciona mejor como primera línea *aislada* — LinkedIn trunca tras 2-3 líneas antes de "ver más", y una afirmación tan tajante invita al clic.
- Coloca la imagen justo después de la lista `Visual Studio Code / Notepad++ / dbv-md-reader` para que el lector vea los números y la prueba visual en el mismo golpe de vista.
- El chiste del certificado de firma de código (100–400 €/año) es honesto, no exagerado — está documentado como limitación real en `README.md` (aviso de SmartScreen al descargar/ejecutar).
- Si el post queda muy largo para tu gusto, el bloque de las 5 funcionalidades es lo primero recortable manteniendo el hook + la comparativa + el cierre.
