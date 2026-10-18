# 🔄 Fase 7 — Maintain (Cierre Autónomo del Loop)

> Inspirado en el "closing the loop" del [AI-Native SDLC Playbook (Anthropic)](https://claude.com/blog/the-ai-native-sdlc-playbook), adaptado para ser independiente de proveedor.

## Objetivo

Las fases 1-6 de dbv-specs-ops (`Spec → Plan → Build → Test → Simplify → Ship`) asumen siempre un disparo humano: alguien escribe `/spec` o pide un cambio. La fase **Maintain** cierra el ciclo: cuando el proyecto en producción (o el propio CI) se desvía de lo esperado, el propio sistema genera un nuevo `SPECIFICATIONS.md` (o una sección `[Detectado]` dentro de él) **sin que un humano tenga que iniciarlo**, y ese hallazgo vuelve a entrar por `/plan` como cualquier otro requisito.

Un humano sigue aprobando antes de que se construya nada: Maintain solo automatiza la **detección y redacción del problema**, no la decisión de arreglarlo.

## Cómo funciona (agnóstico de IA)

Maintain no depende de un mecanismo propietario (tipo hooks de Claude Code). Se apoya en tres piezas universales que cualquier stack ya tiene o puede montar en minutos:

1. **Un detector determinista** (script, cron job, GitHub/GitLab Action programada) que vigila una métrica: tasa de fallos de tests en CI, errores 5xx si hay despliegue, tiempo de build, lo que aplique al proyecto. No usa IA — es matemática simple (media + desviación sobre una ventana).
2. **Un invocador no interactivo** de tu asistente de IA. Cada plataforma soporta modo "batch"/"headless" con distinto flag: `claude -p "prompt"`, `gemini -p "prompt"`, `copilot suggest -p "prompt"` (o el CLI equivalente). El proyecto declara cuál usa en `project.config.md` → ver más abajo.
3. **El formato de salida ya existente**: el hallazgo se escribe como una entrada nueva en `docs/SPECIFICATIONS.md` bajo un epígrafe `## [Detectado automáticamente] <fecha>`, siguiendo la misma estructura Problema/Objetivo/Criterios que ya usa el framework. No se inventa un fichero nuevo.

## Niveles de respuesta (bandas)

| Banda | Umbral | Acción |
|---|---|---|
| 1 | Desviación leve (1σ) | Solo se registra en `task.md` → sección Backlog, sin invocar IA. |
| 2 | Desviación relevante (2σ) | Se invoca la IA en modo **solo lectura** para diagnosticar y redactar el hallazgo. |
| 3 | Desviación crítica (3σ) | El hallazgo se redacta y además se abre automáticamente una rama/PR marcada `needs-human-review`, nunca se hace merge directo. |

## Configuración en `project.config.md`

Añade este bloque al fichero existente:

```markdown
## Maintain (Fase 7)
- Habilitado: sí/no
- CLI no interactivo: claude -p | gemini -p | otro
- Métrica vigilada: <ej. tasa de fallos CI>
- Ventana de referencia: <ej. 30 días>
- Umbral banda 3: <ej. 3 sigma>
```

## Preparar el contexto del diagnóstico

Dos reglas, tomadas de *Procedural Graphs* ([arXiv:2609.09153](https://arxiv.org/abs/2609.09153), Algoritmo 1), para que el diagnóstico en solo lectura no se equivoque por falta de contexto:

1. **Si el log no cabe, conserva el final.** El fallo, el stack trace y el estado de cierre suelen estar al final; si recortas por el principio de la traza (`head`), la IA diagnostica sobre la parte que funcionó. El detector pasa a la IA solo la cola, con un presupuesto fijo:

   ```bash
   tail -n 300 ci_failure.log > diagnostico_contexto.log
   ```

2. **Consulta la Rejection Memory antes de proponer una causa o un arreglo.** La sección `## 🚫 Rejection Memory` de `memory.md` recoge los arreglos que ya se probaron y se revirtieron. Si el diagnóstico apunta a uno de ellos, el hallazgo lo dice y explica qué ha cambiado.

> El paper usa además un bucle que modifica su propio grafo y solo conserva un cambio si la puntuación en un conjunto de validación no baja. Maintain **no** lo hace, porque no hay ese conjunto de validación y cada ejecución es una llamada no determinista al CLI. El motivo está en `docs/PROCEDURAL_GRAPHS.md` §6.

## Qué NO hace Maintain

- No despliega nada a producción.
- No hace merge de nada por sí sola.
- No sustituye tu monitorización/observabilidad existente — la consume.

## Indicadores

Ver `docs/METRICS.md` → sección Maintain.
