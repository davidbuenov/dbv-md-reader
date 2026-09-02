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

## Qué NO hace Maintain

- No despliega nada a producción.
- No hace merge de nada por sí sola.
- No sustituye tu monitorización/observabilidad existente — la consume.

## Indicadores

Ver `docs/METRICS.md` → sección Maintain.
