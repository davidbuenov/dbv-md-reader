# ⚡ PARALLEL_WORK.md — Trabajo Paralelo (Modo Orquestador)

> Formaliza y da la mecánica concreta al "Modo Orquestador" que ya existe en el framework, usando únicamente `git worktree` — disponible en cualquier instalación de git, sin depender de ninguna IA concreta.

## El patrón

1. Divide el trabajo en tareas que **no tocan los mismos ficheros**. Usa `implementation_plan.md` (fase Plan) para identificar qué tareas son independientes; las que comparten fichero van en secuencia, en la misma sesión.
2. Cada tarea independiente recibe su propio `git worktree`, en su propia rama:

```bash
git worktree add ../proyecto-feature-auth feature-auth
git worktree add ../proyecto-fix-rate-limit fix-rate-limit
```

3. Abre una sesión de tu asistente de IA por cada worktree (dos terminales, dos ventanas, o dos pestañas — es indiferente qué IA uses en cada una, incluso pueden ser IAs distintas si el framework ya es multi-IA).
4. Empieza con 2-3 sesiones en paralelo como máximo. El límite real no es técnico, es cuánto puedes revisar tú con calidad — añade sesiones solo mientras la revisión no se acumula.
5. Al terminar cada tarea, se cierra por el ciclo normal (`/test` → `/code-simplify` → `/ship` o merge a rama principal) y se elimina el worktree:

```bash
git worktree remove ../proyecto-feature-auth
```

## Subtareas acotadas ("subagentes" agnósticos)

Para trabajo repetitivo dentro de **una misma** sesión (verificar que la app arranca, revisar un diff, buscar en el código sin llenar el contexto principal), define la subtarea como una plantilla de prompt reutilizable, no como una función de una plataforma concreta:

```markdown
# docs/subtasks/verificador.md
Rol: verificador, solo lectura.
Instrucción: arranca la app, ejercita el comportamiento cambiado y los dos
flujos vecinos más próximos. Reporta qué ejecutaste, qué viste, y cualquier
comportamiento que no coincida con implementation_plan.md. No corrijas nada,
solo informa.
```

Cada plataforma decide cómo invocarlo (subagente nativo si lo soporta, o simplemente pegar la plantilla como un prompt nuevo dentro de la sesión). El fichero markdown es la parte portable; el mecanismo de invocación no lo es, y no hace falta que lo sea.

## Gobernanza

Registra en `task.md` qué worktrees están activos y a qué tarea corresponden, para que cualquier persona (o IA) que retome el proyecto sepa qué hay en vuelo.
