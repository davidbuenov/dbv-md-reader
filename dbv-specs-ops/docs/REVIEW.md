# 🔍 REVIEW.md — Pases de Revisión y Severidades

> Se usa durante `/code-simplify` (fase 5) y opcionalmente en cualquier revisión de PR, sea quien la ejecute (tu asistente de IA local o una acción de CI). No asume ningún servicio de review gestionado.

## Pases obligatorios

Cada revisión de código debe recorrer estos tres pases y etiquetar cada hallazgo con su origen:

1. **Bugs** — errores de lógica, edge cases rotos, regresiones silenciosas.
2. **Seguridad** — inyección, fugas de credenciales, validación de entrada ausente, dependencias alucinadas o de origen dudoso (*slopsquatting* — ya cubierto por el gate de seguridad existente del framework).
   - *Apps con IA integrada (`Desktop AI Assistant: Yes`)*: las claves de API se custodian solo en el llavero nativo del SO (`keyring`), nunca en el frontend, en disco ni en logs; las herramientas de IA confinan sus rutas al espacio de trabajo (rechazan `..` y enlaces simbólicos no controlados).
3. **Cumplimiento** — el cambio respeta `SPECIFICATIONS.md`, `implementation_plan.md`, `ARCHITECTURE.md` **y** los `<coding_standards>` de `MASTER_PROMPT.md` (un solo `return` + guard clauses, patrón Result en operaciones que pueden fallar, tipado estricto en fronteras, excepciones específicas, ESM/tipado moderno). Repasa este último punto función por función en el diff — es una comprobación explícita porque declarar la regla como "obligatoria" en el prompt no basta para que se aplique de forma consistente; ver `docs/GUARDRAILS.md` si además quieres blindarla con un guardarraíl determinista.
   - *Verificación determinista*: ejecuta `python dbv-specs-ops/scripts/dbv-lint.py --changed` (solo lo que toca el cambio) y trata sus errores como hallazgos de Cumplimiento.
   - *Trazabilidad (solo requisitos con ID)*: los tests nuevos que validan un requisito llevan la etiqueta `@spec REQ-XX`.
   - *Apps Tauri*: ningún `.unwrap()`/`.expect()` en comandos `#[tauri::command]` ni en código de runtime (salvo arranque y tests); se respetan las trampas de `docs/NATIVE_DESKTOP_APPS.md` §6; la detección de entorno vive solo en `api.js` (`runningInTauri`, ver `docs/WEB_TO_DESKTOP_MIGRATION.md` §3.1).

## Niveles de severidad

| Nivel | Significado | Bloquea `/ship` |
|---|---|---|
| **Crítico** | Rompe comportamiento, filtra datos o incumple una política de seguridad | Sí |
| **Importante** | Afecta a la calidad o mantenibilidad pero no es bloqueante | No, pero debe registrarse en `CHANGELOG.md` |
| **Nit** | Estilo, nombres, formato | No — máximo 5 por revisión, el resto se resume como recuento |

## Qué NO reportar

- Ficheros generados automáticamente.
- Cualquier cosa que ya valide el linter/formatter del proyecto (evita duplicar el trabajo determinista).
- Incumplimientos preexistentes en ficheros que el cambio no toca (el código anterior a v3.0.0 no se reprocha; `dbv-lint.py --changed` ya lo excluye).

## Cómo se integra en el flujo existente

`/code-simplify` pasa de ser solo "refactoriza y simplifica" a: **1) ejecuta los tres pases, 2) resuelve todo lo Crítico, 3) registra lo Importante en `CHANGELOG.md`, 4) simplifica el código.** El propio asistente de IA puede ejecutar los tres pases en la misma sesión — no requiere una segunda IA ni un servicio externo.

## Plantilla de salida esperada

```markdown
## Revisión — <fecha>
### Bugs
- [Crítico] ...
### Seguridad
- [Importante] ...
### Cumplimiento
- [Nit] (x3, ver detalle en sesión)
```
