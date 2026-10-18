# 🧪 evals/ — Regresión de la Configuración del Agente

## Por qué

`/test` (fase 4) valida el **código**. Esta carpeta valida la **configuración que dirige a la IA** (`MASTER_PROMPT.md`, `CLAUDE.md`/`GEMINI.md`/etc., cualquier skill o plantilla de subtarea). Cuando cambias esos ficheros, quieres saber si el asistente sigue haciendo el trabajo al mismo nivel — igual que un cambio de código necesita sus tests.

## Cuándo correr la suite

- En cada cambio a `docs/MASTER_PROMPT.md`, al grafo de fases (`docs/PROCEDURAL_GRAPH.json`), a los comandos de `.claude/commands/` o a los ficheros de activación (`CLAUDE.md`, `GEMINI.md`, `.windsurfrules`, etc.).
- Opcionalmente, en un cron/schedule (semanal) para detectar deriva si cambias de modelo o de versión de la IA.

## Formato de un eval

Cada eval es un fichero `.json` con un prompt real y el criterio de aceptación — no depende de qué IA lo ejecute:

```json
{
  "name": "spec-genera-criterios-aceptacion",
  "phase": "spec",
  "prompt": "Ejecuta /spec para: 'Los usuarios olvidan tareas importantes'. Debe generar o actualizar docs/SPECIFICATIONS.md con Problema, Objetivo y al menos 2 criterios de aceptacion.",
  "check_type": "grep",
  "check_target": "docs/SPECIFICATIONS.md",
  "check_pattern": "Problema|Objetivo|Criterios"
}
```

`check_target` se busca tal cual y, si no existe, dentro de la carpeta del framework (`dbv-specs-ops/`); `check_pattern` es una expresión regular para `grep -E`.

**El patrón debe ser algo que la IA produzca y que NO esté ya en el fichero antes de ejecutar** (p. ej. una palabra del prompt, no un título de la plantilla). Si el patrón ya está, el runner marca el eval como `INCONCLUSO` (cuenta como fallo) y no ejecuta el CLI, porque pasaría aunque la IA no hiciera nada. Tras una ejecución correcta el fichero conserva el resultado: restáuralo (o usa una copia limpia del proyecto) antes de repetir la suite, o ejecuta con `EVALS_ALLOW_STALE=1` para ignorar el control.

## Cómo se construye la suite

1. Recoge 15-30 tareas reales ya resueltas por el framework (una por fase es un buen mínimo: spec, plan, build, test, simplify, ship, maintain).
2. Cada incidente real que se corrija (ver `docs/MAINTAIN.md`) añade un eval nuevo — así la suite crece con la experiencia del proyecto, no se diseña de una vez.
3. Los evals viven en `evals/*.json`; el script `scripts/run-evals.sh` los ejecuta contra el CLI que declares en `project.config.md`.

## Cómo ejecutarla

Desde la raíz del proyecto (requiere `bash` y [`jq`](https://jqlang.github.io/jq/)):

```bash
bash dbv-specs-ops/scripts/run-evals.sh
```

El CLI se toma de `AI_CLI` (variable de entorno) o de la línea `CLI no interactivo: claude -p` de `project.config.md` (bloque *Maintain*).

> **Permisos de escritura:** en modo no interactivo (`-p`) el CLI no puede pedir confirmación, así que solo escribirá `SPECIFICATIONS.md` si el proyecto ya lo permite (p. ej. `permissions.allow` con `Write` y `Edit` en `.claude/settings.json` y el proyecto marcado como de confianza). Si no, ejecuta la suite con el permiso explícito: `AI_CLI="claude -p --permission-mode acceptEdits" bash dbv-specs-ops/scripts/run-evals.sh`. Sin escritura todos los evals fallarían, y por un motivo ajeno al framework. Solo se aceptan `claude`, `gemini`, `copilot` o `cursor…` seguidos del flag `-p`: cualquier otro valor, y los placeholders sin rellenar, se ignoran porque el valor se ejecuta con `eval`.

## Regla de no regresión

El script termina con un resumen comparable entre ejecuciones:

```text
📊 Resultado: 4/5 pasan (1 fallan, 0 inconclusos)
```

Un cambio en la configuración del agente se acepta si **no baja el número de evals que pasan** respecto a la versión anterior. Es el principio de la *validation gate* de *Procedural Graphs* ([arXiv:2609.09153](https://arxiv.org/abs/2609.09153)), aplicado a mano y no como bucle automático:

- **Los inconclusos no cuentan.** No miden nada: restaura los ficheros y repite.
- **Repite antes de concluir.** Los evals no son deterministas: si un resultado cambia en uno o dos evals, vuelve a ejecutar antes de decidir.
- **Registra los cambios rechazados.** Si un cambio se descarta porque bajó el resultado, anótalo en la `🚫 Rejection Memory` de `memory.md` para que nadie lo vuelva a proponer.

## Qué NO es

No sustituye a `/test`. No valida lógica de negocio — valida que el **proceso** (spec bien formada, plan con pasos atómicos, tests exigidos antes de marcar hecho) se sigue produciendo igual de bien tras un cambio de configuración.
