# 🗂️ SOURCE_OF_TRUTH.md — Convivencia con Sistemas Existentes

> Relevante solo si el proyecto ya usa Jira, Trello, ServiceNow o similar antes de adoptar dbv-specs-ops (ver `ADOPTION_PROMPT.md`).

Cuando conviven los ficheros del framework (`SPECIFICATIONS.md`, `task.md`, etc.) con un sistema de tickets externo, hay que declarar explícitamente **quién manda**, para no acabar con dos historiales que se contradicen.

## Las tres opciones

1. **El repo manda.** `SPECIFICATIONS.md` y `task.md` son la fuente única de verdad; el ticket externo (si existe) solo enlaza al commit correspondiente. Recomendado para proyectos personales o de equipo pequeño — es el modo por defecto de dbv-specs-ops.
2. **El sistema externo manda.** Jira/ServiceNow es la fuente de verdad; los ficheros del framework son copias de trabajo que la IA usa como contexto de la sesión, pero el estado "oficial" vive fuera del repo.
3. **Enlace mínimo (recomendado al empezar una migración).** Cada entrada de `task.md` lleva el ID del ticket externo, y el ticket externo lleva el SHA del commit relevante. Se acepta convivir con dos fuentes mientras se decide cuál pasa a ser la única.

## Cómo declararlo

Añade una línea en `project.config.md`:

```markdown
## Fuente de verdad
- Modo: repo | sistema-externo | enlace-mínimo
- Sistema externo (si aplica): <Jira / ServiceNow / otro>
- Convención de enlace: <ej. "Ref: JIRA-1234" en cada commit>
```

Esto no cambia el flujo de fases del framework — solo documenta, para quien se incorpore al proyecto (humano o IA), dónde mirar si hay duda.
