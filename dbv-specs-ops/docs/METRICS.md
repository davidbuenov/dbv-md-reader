# 📊 METRICS.md — Indicadores por Fase

> Opcional pero recomendado si quieres demostrar con datos que el framework está funcionando (útil, por ejemplo, en un contexto docente o de evaluación empírica). No requiere ninguna herramienta de observabilidad concreta — todo se puede leer del historial de git y del CI.

Para cada fase se distingue:
- **Indicador líder** (leading): se mide durante el proceso, predice si va bien.
- **Indicador rezagado** (lagging): se mide después, confirma el resultado.

| Fase | Indicador líder | Indicador rezagado |
|---|---|---|
| **Spec** | Tiempo desde la primera conversación hasta `SPECIFICATIONS.md` commiteado | % de specs que llegan a `/plan` sin reescritura mayor |
| **Plan** | Tiempo entre `SPECIFICATIONS.md` y `implementation_plan.md` | Nº de cambios al plan después de empezar `/build` |
| **Build** | % de tareas que compilan/pasan lint a la primera | Ciclos de retrabajo por tarea (commits de fixup) |
| **Test** | % de tests que pasan a la primera ejecución | Bugs encontrados en producción vs. en `/test` |
| **Simplify** | Hallazgos Críticos resueltos antes de `/ship` (ver `REVIEW.md`) | Hallazgos Importantes que reaparecen en la siguiente revisión |
| **Ship** | Tiempo desde `/ship` hasta el tag publicado | Rollbacks por versión publicada |
| **Maintain** | Tiempo desde banda 2/3 detectada hasta hallazgo redactado en `SPECIFICATIONS.md` | % de hallazgos automáticos que terminan en un fix mergeado |

## Cómo registrar los datos

No se necesita infraestructura nueva: git ya tiene los timestamps. Basta con:

```bash
# Ejemplo: tiempo entre commit de SPECIFICATIONS.md y de implementation_plan.md
git log --follow --format='%ai' -- docs/SPECIFICATIONS.md | tail -1
git log --follow --format='%ai' -- implementation_plan.md | tail -1
```

Si el proyecto quiere agregarlo, puede volcarse periódicamente a un `docs/METRICS_LOG.md` (una línea por release), pero esto es opcional y no forma parte del núcleo del framework.
