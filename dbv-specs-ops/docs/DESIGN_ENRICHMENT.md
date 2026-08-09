# 🎨 Guía de Enriquecimiento de Diseño: Impeccable y SkillUI

Esta guía documenta el uso de herramientas de diseño externas dentro del flujo de Spec-Driven Development (SDD) en **dbv-specs-ops**. Estas herramientas son opcionales y sirven para automatizar la extracción de estilos y auditar la calidad visual de las interfaces de usuario.

---

## 🚀 1. SkillUI: Extracción e Ingeniería Inversa de Diseño
**SkillUI** es un CLI independiente que analiza un sitio web de referencia y extrae automáticamente sus tokens de diseño (paletas de colores, tipografía, espaciados y clases CSS útiles), lo que facilita poblar rápidamente `docs/DESIGN.md` cuando el usuario tiene un diseño real de referencia.

### Uso Básico
Para ejecutar el análisis contra una URL:
```bash
npx skillui --url <url-del-sitio-de-referencia>
```

### Proceso de Integración
1. Ejecuta el comando anterior para generar un vuelco de los tokens de color, fuentes y componentes.
2. Traduce los tokens extraídos al formato YAML en `dbv-specs-ops/docs/DESIGN.md`.
3. Utiliza estos tokens para guiar al asistente de IA en la fase de `/build` garantizando coherencia visual inmediata.

---

## 🔍 2. Impeccable: Auditorías Dual-Agente y Refinamiento Visual
**Impeccable** es un skill multi-agente diseñado para auditar la UX/UI, verificar contraste y accesibilidad (WCAG AA), y pulir el diseño de interfaces construidas.

### Instalación Acotada
Para evitar la instalación innecesaria de múltiples ficheros de proveedores que no usas en el proyecto, Impeccable debe instalarse acotando los proveedores activos detectados en la raíz del proyecto (p. ej., si tienes `CLAUDE.md` y `GEMINI.md`):

```bash
npx impeccable install --providers claude,gemini
```

### Flujo de Auditoría (`critique`)
El comando `critique` ejecuta una evaluación cruzada que combina una revisión subjetiva por parte del modelo y una inspección automática mediante un *browser overlay* (análisis estático de contraste y heurísticas de Nielsen):

```bash
npx impeccable critique
```

* **Heurísticas evaluadas:** Puntuación de usabilidad (ej. de 0 a 36), targets de interacción táctil (>44px), coherencia de estados de carga/vacío/error, y fallos funcionales ocultos.
* **Contraste de Accesibilidad:** Validación de contraste de texto sobre fondos (ej. WCAG AA con contraste mínimo de 4.5:1).

### Comandos de Refinamiento
* **`/impeccable polish`**: Analiza y aplica refactors estéticos enfocados en alineación, consistencia de espaciados y pulido visual.
* **`/impeccable harden`**: Endurece la robustez de la UI frente a overflows de texto y fallos de respuesta a eventos.

---

## 📂 3. Gestión del Archivo `DESIGN.md` de la Raíz
Impeccable y otras herramientas de diseño externas requieren leer un archivo llamado `DESIGN.md` en la raíz del proyecto.

Para respetar el principio de aislamiento en subcarpeta de `dbv-specs-ops`:
1. **Fuente de Verdad:** El archivo maestro de diseño siempre es `dbv-specs-ops/docs/DESIGN.md`.
2. **Copia Derivada:** Si aceptas instalar Impeccable, el framework copiará el contenido a `DESIGN.md` en la raíz del proyecto.
3. **Advertencia de cabecera:** La versión de la raíz tendrá la siguiente cabecera al inicio para alertar al desarrollador:
   ```markdown
   <!-- 
     ⚠️ ARCHIVO GENERADO AUTOMÁTICAMENTE - NO EDITAR A MANO.
     La fuente de verdad es dbv-specs-ops/docs/DESIGN.md.
     Este archivo se sincroniza automáticamente durante la fase /ship.
   -->
   ```
4. **Sincronización:** Durante la fase `/ship`, la IA copiará y sobreescribirá de forma transparente cualquier cambio de la fuente de verdad al archivo de la raíz.
