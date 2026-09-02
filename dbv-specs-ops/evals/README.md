# 🧪 evals/ — Regresión de la Configuración del Agente

## Por qué

`/test` (fase 4) valida el **código**. Esta carpeta valida la **configuración que dirige a la IA** (`MASTER_PROMPT.md`, `CLAUDE.md`/`GEMINI.md`/etc., cualquier skill o plantilla de subtarea). Cuando cambias esos ficheros, quieres saber si el asistente sigue haciendo el trabajo al mismo nivel — igual que un cambio de código necesita sus tests.

## Cuándo correr la suite

- En cada cambio a `docs/MASTER_PROMPT.md` o a los ficheros de activación (`CLAUDE.md`, `GEMINI.md`, `.windsurfrules`, etc.).
- Opcionalmente, en un cron/schedule (semanal) para detectar deriva si cambias de modelo o de versión de la IA.

## Formato de un eval

Cada eval es un fichero `.json` con un prompt real y el criterio de aceptación — no depende de qué IA lo ejecute:

```json
{
  "name": "spec-genera-criterios-aceptacion",
  "prompt": "Ejecuta /spec para: 'Los usuarios olvidan tareas importantes'. Debe generar SPECIFICATIONS.md con Problema, Objetivo y al menos 2 criterios de aceptación.",
  "check": "El fichero docs/SPECIFICATIONS.md contiene las tres secciones: Problema, Objetivo, Criterios de aceptación"
}
```

## Cómo se construye la suite

1. Recoge 15-30 tareas reales ya resueltas por el framework (una por fase es un buen mínimo: spec, plan, build, test, simplify, ship, maintain).
2. Cada incidente real que se corrija (ver `docs/MAINTAIN.md`) añade un eval nuevo — así la suite crece con la experiencia del proyecto, no se diseña de una vez.
3. Los evals viven en `evals/*.json`; el script `scripts/run-evals.sh` los ejecuta contra el CLI que declares en `project.config.md`.

## Qué NO es

No sustituye a `/test`. No valida lógica de negocio — valida que el **proceso** (spec bien formada, plan con pasos atómicos, tests exigidos antes de marcar hecho) se sigue produciendo igual de bien tras un cambio de configuración.
