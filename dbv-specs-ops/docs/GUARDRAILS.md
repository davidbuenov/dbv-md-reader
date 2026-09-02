# 🚧 GUARDRAILS.md — Guardarraíles Deterministas

## Por qué

`MASTER_PROMPT.md` da instrucciones que la IA **debería** seguir (control *advisory*). Pero ninguna instrucción en texto impide físicamente que un asistente se salte un paso si el contexto se degrada o el modelo cambia. Un guardarraíl determinista es un control que se ejecuta **fuera del razonamiento de la IA** — a nivel de git o de CI — y por tanto no depende de que el modelo "se acuerde".

Regla general: **una instrucción en `MASTER_PROMPT.md` es una skill (recomendación); un guardarraíl es el respaldo que la hace casi imposible de saltar.** No todas las reglas necesitan guardarraíl — resérvalo para lo que, si se salta, sea costoso arreglar (saltarse tests, tocar ficheros protegidos, borrar el changelog).

## Mecanismos agnósticos (no dependen de un proveedor de IA)

| Mecanismo | Qué garantiza | Coste de montarlo |
|---|---|---|
| **Git pre-commit hook** (`.git/hooks/pre-commit` o `pre-commit` framework) | Bloquea el commit si no hay test nuevo/actualizado para el fichero tocado, o si `CHANGELOG.md [Unreleased]` no se ha tocado | Bajo |
| **Branch protection / required checks** (GitHub, GitLab) | Impide el merge si el pipeline de CI no ha pasado `/test` | Bajo (config de plataforma) |
| **CI job dedicado** | Ejecuta lint/test/build en cada push y falla el pipeline si algo no pasa | Medio |
| **`.gitattributes` / CODEOWNERS** | Exige revisión humana en rutas protegidas (migraciones, infra) | Bajo |

## Notas específicas por plataforma (opcional, no obligatorio)

Si el asistente usado sí soporta un mecanismo propio de enforcement, puede añadirse como capa extra — nunca como sustituto de lo anterior, porque solo cubre a esa IA concreta:

- **Claude Code**: soporta `hooks` en `.claude/settings.json` (`PreToolUse`, etc.) que pueden bloquear o pedir aprobación antes de una acción.
- **GitHub Copilot / Cursor / Windsurf / Gemini CLI**: no tienen un hook nativo equivalente hoy; el guardarraíl real para estos vive en git/CI, como en la tabla de arriba.

## Ejemplo mínimo (pre-commit agnóstico)

```bash
#!/bin/bash
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q '\.py$\|\.ts$\|\.js$'; then
  if ! git diff --cached --name-only | grep -q 'test_\|\.test\.\|\.spec\.'; then
    echo "⚠️  Cambios de código sin test asociado en el mismo commit."
    echo "   Si es intencional, usa: git commit --no-verify"
    exit 1
  fi
fi
```

## Ejemplo: guardarraíl para la regla "un solo `return`"

Si en la práctica la IA sigue sin respetar de forma consistente `<coding_standards>` §1 de
`MASTER_PROMPT.md` (un solo `return` + guard clauses) aunque esté declarada "obligatoria", esa es
justo la señal de que ya no basta con un pase de revisión advisory (`docs/REVIEW.md`) — hace falta
un control que no dependa de que el modelo se acuerde.

**Heurística rápida (pre-commit, agnóstica de lenguaje — JS/TS/Python):**

```bash
#!/bin/bash
# .git/hooks/pre-commit — cuenta 'return' por función en los ficheros staged (heurística, no AST)
for f in $(git diff --cached --name-only -- '*.js' '*.ts' '*.py'); do
  [ -f "$f" ] || continue
  returns=$(grep -c '^\s*return\b' "$f")
  funcs=$(grep -cE '^\s*(function |def |async function |export function )' "$f")
  if [ "$funcs" -gt 0 ] && [ "$returns" -gt "$funcs" ]; then
    echo "⚠️  $f: más 'return' ($returns) que funciones detectadas ($funcs) — revisa la regla de un solo return + guard clauses."
  fi
done
```

Es un conteo por fichero, no un parser: puede dar falsos positivos en ficheros con muchas funciones
cortas legítimas, y falsos negativos si varias funciones comparten el exceso. Si el equipo necesita
precisión real, la alternativa correcta es una regla de lint por AST (un plugin de ESLint a medida, o
un script sobre `ast`/`libcst` en Python) que cuente los `return` de cada función individualmente y
falle solo si hay más de uno fuera de guard clauses tempranas.

## Dónde declararlo

Añade en `project.config.md`:

```markdown
## Guardarraíles activos
- Pre-commit: sí/no
- Branch protection en CI: sí/no
- Hooks nativos de plataforma (si aplica): <cuál y qué bloquea>
```
