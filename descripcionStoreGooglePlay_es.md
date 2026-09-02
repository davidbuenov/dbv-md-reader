# Ficha de Google Play Store — Español (España)

> Copia cada campo tal cual en la sección correspondiente de Google Play Console ("Ficha de Play Store principal" y "Versión de producción/pruebas"). Los límites de caracteres indicados son los máximos que permite Google Play.

---

## 🏷️ Datos Principales de la Aplicación

### Nombre de la aplicación *
*(máximo 30 caracteres)*

```text
DBV Markdown Reader
```

---

### Descripción breve *
*(máximo 80 caracteres — exactamente 74 caracteres)*

```text
Lector Markdown rápido y ligero con soporte de diagramas Mermaid y KaTeX.
```

---

### Descripción completa *
*(máximo 4000 caracteres — estructurada y optimizada para Android)*

```text
DBV Markdown Reader es un lector y visor nativo de archivos Markdown (.md) ultra-ligero, seguro y veloz, diseñado especialmente para ofrecer una experiencia de lectura fluida tanto en teléfonos como en tablets Android.

Diseñado para desarrolladores, estudiantes, investigadores y amantes de la toma de notas que necesitan consultar su documentación técnica, apuntes o wikis personales sin esperas, sin anuncios y con el máximo respeto por la privacidad.

⚡ RENDIMIENTO NATIVO Y PRIVACIDAD TOTAL
• Apertura instantánea: tus documentos cargan en menos de 200 milisegundos.
• 100% Sin conexión (Offline): toda la lectura y el procesamiento se realizan localmente en tu dispositivo. Tus datos y notas nunca salen de tu teléfono.
• Sin publicidad ni rastreadores: sin cuentas obligatorias ni permisos invasivos.

📁 INTEGRACIÓN PERFECTA CON ANDROID (STORAGE ACCESS FRAMEWORK)
• Apertura en 1 toque: selecciona y visualiza cualquier archivo .md al instante.
• Explorador de carpetas completo: concede acceso a tu carpeta de notas y navega por todo su árbol de subdirectorios.
• Imágenes relativas locales: visualiza imágenes enlazadas dentro de tus carpetas de notas.
• Enlaces cruzados: navega entre diferentes archivos Markdown vinculados con rutas relativas sin salir de la app.
• Abre desde WhatsApp, Telegram o Gmail: visualiza documentos Markdown compartidos directamente desde tus apps de mensajería favoritas mediante streaming instantáneo en memoria sin descargas duplicadas.

📊 SOPORTE AVANZADO DE MARKDOWN (GFM)
• Diagramas Mermaid integrados: visualiza diagramas de flujo, diagramas de secuencia, clases y arquitectura vectorial interactiva.
• Fórmulas Matemáticas con KaTeX: renderizado rápido de ecuaciones matemáticas y científicas complejas.
• Resaltado de sintaxis: coloreado de código fuente para más de 20 lenguajes de programación con números de línea legibles.
• Alertas y Callouts estilo GitHub: recuadros de atención para [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] y [!CAUTION].
• Tablas, listas de tareas interactivas y citas formateadas.

🎨 EXPERIENCIA TÁCTIL Y PERSONALIZACIÓN
• 3 Temas visuales de lectura: Claro (Light), Oscuro (Dark) y Sepia, diseñados para no fatigar la vista en cualquier condición lumínica.
• Tabla de Contenidos (TOC) interactiva: navega rápidamente por encabezados largos mediante el cajón lateral desplegable.
• Historial de archivos recientes: vuelve a abrir rápidamente tus últimos documentos leídos.
• Menú de Ajustes simplificado (⚙️): cambio instantáneo de tema, conmutación de idioma (Español / English) y control de cierre de la aplicación.
• Respeto total de insets de pantalla: interfaz adaptada a la barra de estado, notch y barras de navegación modernas.

DBV Markdown Reader es software libre y de código abierto desarrollado bajo licencia MIT y el framework de especificaciones dbv-specs-ops.
```

---

## 📢 Notas de la Versión (Release Notes)
*(Copiar y pegar tal cual en el cuadro de texto de la versión en Google Play Console — límite de 500 caracteres)*

```xml
<es-ES>
¡Lanzamiento oficial de DBV Markdown Reader para Android (v0.15.0)!
• Lector nativo ultra-rápido y ligero de archivos Markdown (.md).
• Soporte completo de Storage Access Framework (SAF): abre archivos en 1 toque y explora carpetas de notas con imágenes relativas.
• Diagramas Mermaid y fórmulas KaTeX integradas.
• Abre notas compartidas directamente desde WhatsApp, Telegram y Gmail.
• Temas Claro, Oscuro y Sepia con navegación por Tabla de Contenidos (TOC).
• 100% privado y sin anuncios.
</es-ES>
```

---

## 🎨 Recursos Gráficos Preparados para Subir

Todos los archivos están generados en la carpeta `google-play-assets/` cumpliendo los requisitos técnicos de Google Play:

### 1. Icono de la aplicación
* **Archivo:** `google-play-assets/icon-512x512.png`
* **Especificaciones:** 512 x 512 px · PNG 32-bit · 26 KB.

### 2. Gráfico de funciones / Gráfico destacado (Feature Graphic)
* **Archivo:** `google-play-assets/feature-graphic-1024x500.png`
* **Especificaciones:** 1024 x 500 px · PNG 24-bit · 204 KB (fondo oscuro elegante con logo, eslogan y tarjeta de vista previa).

### 3. Capturas de pantalla para teléfono (subir las 6)
Carpeta: `google-play-assets/phone-screenshots/` (todas en 1080 x 2400 px):
1. `01_document_reading.png` — Vista principal de lectura de documento.
2. `02_mermaid_diagram.png` — Diagrama vectorial de flujo con Mermaid.
3. `03_settings_menu.png` — Menú de ajustes flotante (selector de temas e idioma).
4. `04_toc_navigation.png` — Cajón desplegable de Tabla de Contenidos (TOC).
5. `05_recent_files.png` — Historial de archivos recientes persistentes.
6. `06_code_and_syntax.png` — Bloque de código con numeración de líneas y coloreado de sintaxis.

### 4. Capturas de pantalla para tablet (solución al requisito de Google Play)
Carpeta: `google-play-assets/tablet-screenshots/`:
* **Para el apartado "Tablets de 7 pulgadas":**
  - `tablet_7inch_01_reading.png` (1200 x 1920 px)
  - `tablet_7inch_02_mermaid.png` (1200 x 1920 px)
* **Para el apartado "Tablets de 10 pulgadas":**
  - `tablet_10inch_01_landscape_doc.png` (2560 x 1600 px apaisado)
  - `tablet_10inch_02_landscape_mermaid.png` (2560 x 1600 px apaisado)

---

## 📦 Paquete Binario para Subir (AAB)

En la sección **Crear nueva versión** de Google Play Console (pista interna o producción), sube el archivo generado:

`src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`
*(Firmado criptográficamente con la clave upload para todas las arquitecturas ARM64, ARMv7, x86 y x86_64)*
