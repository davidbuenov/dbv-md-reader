# 🎨 Propuesta: Design Enrichment opcional en dbv-specs-ops

> **Tipo:** Propuesta de mejora para el framework (no para un proyecto concreto).
> **Origen:** sesión real de prueba sobre "Carta de Restaurante Dinamica" (proyecto construido con dbv-specs-ops), 2026-07-29.
> **Para:** la IA/sesión que mantiene `dbv-specs-ops` (repo `davidbuenov/dbv-specs-ops`).
> **Autor de la propuesta:** Claude Code, a petición de David Bueno Vallejo, tras probar `Impeccable` en un proyecto real.

---

## 1. Resumen de la propuesta

Añadir al framework un paso **opcional, gated por confirmación explícita del usuario** — mismo patrón que ya se usa para `git init` o para planes complejos — que:

1. Ofrece instalar el skill de diseño [Impeccable](https://github.com/pbakaus/impeccable) (multi-agente: Claude Code, Cursor, Gemini CLI, Codex CLI, GitHub Copilot y más) para dar critique estructurado, auditoría de accesibilidad/contraste y comandos de refinamiento (`/impeccable polish`, `critique`, `harden`, `colorize`...) sobre la interfaz ya construida.
2. Si el usuario acepta, copia `dbv-specs-ops/docs/DESIGN.md` a la raíz del proyecto (`DESIGN.md`) para que Impeccable lo lea como contexto — ver §4, es la única pieza de fricción real que no tiene una solución obviamente correcta todavía.
3. Informa (sin instalar nada automáticamente) de la existencia de [SkillUI](https://github.com/amaancoderx/npxskillui), un CLI independiente de cualquier agente que hace ingeniería inversa del sistema de diseño de un sitio web de referencia (colores, tipografía, espaciado) y lo vuelca en ficheros que se le pueden pasar a `dbv-specs-ops/docs/DESIGN.md`. Útil cuando el usuario tiene una web de referencia real (p.ej. la web de un restaurante existente) en vez de solo fotos o descripciones.

**No se propone que ninguna de las dos herramientas sea obligatoria ni se instale sin preguntar.** El framework ya tiene una filosofía fuerte de "no acoplarse a un solo agente" (los mismos docs se leen desde `CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.github/copilot-instructions.md`); esta propuesta debe respetar eso, no romperlo.

---

## 2. Evidencia de esta sesión (por qué merece la pena)

Se instaló Impeccable y se corrió su flujo `critique` (dual-agente: revisión de diseño + detector automático/browser overlay) sobre dos superficies reales del proyecto:

- **Carta pública** (`mobile-cards` theme): puntuó 20/36 en heurísticas de Nielsen. Encontró 5 problemas accionables (hueco vacío al filtrar categoría pequeña, targets táctiles bajo 44px, fallback sin foto genérico, chips de categoría sin pista de overflow, estados de carga/error/vacío sin diferenciar).
- **Panel admin** (`/admin`, compartido entre restaurantes): también 20/36. Encontró **un bug funcional real, no solo estético**: las tres páginas de admin (`AdminDashboardPage`, `AdminPricesPage`, `AdminQrPage`) no pasaban `variant`/`onRetry` al componente `EmptyState`, dejando al usuario sin botón de reintentar tras un fallo de carga — precisamente en la superficie que el propio `DESIGN.md` del proyecto marca como prioridad de velocidad operativa. También encontró que los botones de acción primaria (`bg-accent` + texto blanco) fallaban WCAG AA (~3.45:1 medido, contraste requerido 4.5:1), violando una regla que el propio `DESIGN.md` del proyecto ya declaraba.

**Punto que valida la herramienta**: en ambas rondas, el detector automático (análisis estático + overlay en el navegador vivo) encontró de forma **independiente** los mismos problemas que la revisión subjetiva, sin haber visto su resultado (ej. el hallazgo de contraste `low-contrast` del detector coincidió con el cálculo manual de luminancia de la otra evaluación). Esa doble confirmación cruzada es lo que da confianza real, no solo "una IA con más opinión estética".

Todos los hallazgos P0/P1/P2 de ambas rondas se corrigieron en la misma sesión y quedaron verificados con `tsc --noEmit` + suite de tests + una captura de verificación puntual.

---

## 3. Fricciones detectadas (a resolver antes de recomendarlo sin reservas)

1. **Bloat de instalación**: `npx impeccable install` sin acotar providers instala ~40 ficheros × 5-7 carpetas de proveedor (200+ ficheros) aunque el proyecto solo use 1-2 agentes reales. Si se integra en dbv-specs-ops, el paso opcional debería **detectar qué activadores ya existen en el proyecto** (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`...) e instalar Impeccable solo para esos, no para los 13 soportados.
2. **Colisión de convención de ruta (el punto más importante a decidir)**: Impeccable espera `PRODUCT.md` y `DESIGN.md` en la **raíz** del proyecto. dbv-specs-ops mantiene `DESIGN.md` dentro de `dbv-specs-ops/docs/DESIGN.md`. En esta sesión se resolvió copiando el fichero a la raíz — pero eso crea **dos fuentes de verdad** que pueden desincronizarse si alguien edita una copia y no la otra. Opciones para que decida quien mantiene el framework (ver §5, no las resuelvo yo aquí):
   - **(a)** Mover la convención canónica de `DESIGN.md` a la raíz del proyecto en todo dbv-specs-ops (rompe la actual "todo el framework vive en un subdirectorio").
   - **(b)** Mantener `dbv-specs-ops/docs/DESIGN.md` como fuente de verdad y que el paso opcional cree en la raíz un `DESIGN.md` que sea solo una referencia/symlink-lógico ("ver `dbv-specs-ops/docs/DESIGN.md`, este fichero existe solo para que Impeccable lo lea") — riesgo: Impeccable probablemente no sigue una referencia textual, necesita el contenido real.
   - **(c)** Copiar (no symlink) en cada `/ship` o al final de cada sesión relevante, documentando explícitamente que `DESIGN.md` de raíz es un artefacto derivado, no editable a mano — como ya existe el patrón de "no editar `.impeccable/` a mano".
3. **Coste en tokens/tiempo**: cada ronda de `critique` (dual-agente) gastó 45.000-95.000 tokens por sub-agente y 3-5 minutos. No es algo para correr en cada `/build`; encaja mejor como paso puntual de `/spec` (creación inicial de `DESIGN.md`) o como comando manual que el usuario invoca cuando quiere una auditoría, no como gate automático.
4. **Solapamiento con la entrevista de `/spec` propia**: el comando `impeccable init` hace su propia entrevista para `PRODUCT.md` (usuarios, propósito, posicionamiento) que se solapa parcialmente con lo que `dbv-specs-ops/docs/SPECIFICATIONS.md` ya captura en la fase `/spec`. Si se integra, valdría la pena que el paso opcional **reutilice** el contenido ya confirmado de `SPECIFICATIONS.md` para poblar `PRODUCT.md` en vez de volver a preguntar lo mismo al usuario.

---

## 4. Dónde encajaría en el workflow actual

En `dbv-specs-ops/docs/MASTER_PROMPT.md`, el paso `1. ESPECIFICAR (/spec)` ya dice textualmente:

> "Si el proyecto tiene interfaz de usuario y `dbv-specs-ops/docs/DESIGN.md` no existe aún, crea y completa también ese fichero en esta fase."

Ese es el punto natural para añadir el ofrecimiento opcional, justo después de completar `DESIGN.md` por primera vez (o al detectar que ya existe una interfaz construida sin haber pasado por Impeccable todavía). Propuesta de redacción a integrar (ajustar tono/formato al resto del prompt):

> **Design Enrichment (opcional):** Si el proyecto tiene interfaz visual y el usuario trabaja con un agente compatible (Claude Code, Cursor, Gemini CLI, Codex CLI, GitHub Copilot...), ofrece instalar el skill comunitario **Impeccable** (`npx impeccable install`, acotado a los agentes ya detectados en el proyecto) para poder correr auditorías de diseño (`/impeccable critique`, `audit`, `polish`...) sobre la interfaz ya construida. Si el usuario acepta:
> 1. Copia `dbv-specs-ops/docs/DESIGN.md` a `DESIGN.md` en la raíz del proyecto (documentar en `memory.md` que es un artefacto derivado, no la fuente de verdad).
> 2. Instala Impeccable.
> 3. Informa también de **SkillUI** (`npx skillui --url <sitio-de-referencia>`) como alternativa/complemento independiente de cualquier agente, útil cuando el usuario tiene un sitio web real de referencia (no solo fotos o descripción) del que quiere extraer paleta/tipografía/espaciado.
> Si el usuario declina, no instales nada y continúa el flujo normal.

---

## 5. Preguntas abiertas para quien mantiene el framework

- ¿Se resuelve la colisión de ruta de `DESIGN.md` moviendo la convención a la raíz, o se acepta la copia derivada documentada (opción (c) de §3)?
- ¿El ofrecimiento debe aparecer en `/spec` (una vez, al crear `DESIGN.md`) o también más tarde si el proyecto ya tiene `DESIGN.md` antiguo sin Impeccable instalado?
- ¿Vale la pena que el propio `dbv-specs-ops` mantenga una lista corta de "skills de diseño de terceros conocidos" (Impeccable, SkillUI, UI UX Pro Max) con sus tradeoffs, en vez de recomendar solo uno? En esta sesión se evaluaron los tres; Impeccable fue el único probado en profundidad por ser genuinamente multi-agente.
- ¿Este paso debería quedar fuera del framework core y vivir como un doc de "extensiones recomendadas" aparte, para no añadir peso a `MASTER_PROMPT.md`?

---

> Generado durante una sesión real de `dbv-specs-ops` sobre el proyecto "Carta de Restaurante Dinamica". Ver el histórico de crítica de Impeccable en `.impeccable/critique/` de ese proyecto para el detalle completo de hallazgos si se necesita más contexto.
