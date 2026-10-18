#!/bin/bash
# scripts/run-evals.sh
# Ejecuta la suite de evals/ contra el CLI de IA declarado en project.config.md
# Uso (desde la raíz del proyecto): bash dbv-specs-ops/scripts/run-evals.sh
#   (en el repo del framework:      bash scripts/run-evals.sh)
# Override manual: AI_CLI="gemini -p" bash dbv-specs-ops/scripts/run-evals.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$FRAMEWORK_DIR/project.config.md"
EVALS_DIR="$FRAMEWORK_DIR/evals"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Falta 'jq' (https://jqlang.github.io/jq/). Instálalo para poder leer los evals."
  exit 1
fi

# 1. Determinar qué CLI usar: variable de entorno > project.config.md > error
if [ -z "$AI_CLI" ] && [ -f "$CONFIG_FILE" ]; then
  RAW_CLI=$(grep -i -m1 "CLI no interactivo:" "$CONFIG_FILE" | sed 's/.*CLI no interactivo:[[:space:]]*//' | tr -d '\r')
  # Lista blanca: el valor COMPLETO debe ser "<cli conocido> -p". Así se descartan los
  # placeholders (claude -p | gemini -p, <...>, [...]) y cualquier metacaracter de shell,
  # porque el valor acaba dentro de un eval.
  if [[ "$RAW_CLI" =~ ^(claude|gemini|copilot|cursor)[A-Za-z0-9._-]*\ -p$ ]]; then
    AI_CLI="$RAW_CLI"
  fi
fi

if [ -z "$AI_CLI" ]; then
  echo "❌ No se ha definido el CLI de IA. Declara 'CLI no interactivo: claude -p' (o gemini -p, copilot -p, cursor-agent -p)"
  echo "   en $CONFIG_FILE, o exporta AI_CLI, ej: export AI_CLI='claude -p'"
  exit 1
fi

echo "🤖 Usando: $AI_CLI"
echo "---"

LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"' EXIT

TOTAL=0
PASSED=0
INCONCLUSIVE=0
FAILED=0

for eval_file in "$EVALS_DIR"/*.json; do
  [ -e "$eval_file" ] || continue
  TOTAL=$((TOTAL+1))
  name=$(jq -r '.name' "$eval_file")
  prompt=$(jq -r '.prompt' "$eval_file")
  target=$(jq -r '.check_target' "$eval_file")
  pattern=$(jq -r '.check_pattern' "$eval_file")

  echo "▶ $name"

  # El fichero a comprobar se busca tal cual (proyecto con el framework en la raíz) y, si no
  # existe, dentro de la carpeta del framework (proyecto con aislamiento en dbv-specs-ops/).
  TARGET_PATH="$target"
  if [ ! -f "$TARGET_PATH" ] && [ -f "$FRAMEWORK_DIR/$target" ]; then
    TARGET_PATH="$FRAMEWORK_DIR/$target"
  fi

  # Un eval solo es concluyente si el patrón NO estaba ya en el fichero antes de ejecutar el CLI;
  # si no, pasaría aunque la IA no hiciera nada.
  if [ -z "${EVALS_ALLOW_STALE:-}" ] && [ -f "$TARGET_PATH" ] && grep -qE "$pattern" "$TARGET_PATH"; then
    echo "  ⚠️  INCONCLUSO — el patrón ya estaba en $target antes de ejecutar el CLI."
    echo "     Restaura el fichero (o usa una copia limpia) y vuelve a ejecutar; EVALS_ALLOW_STALE=1 lo ignora."
    INCONCLUSIVE=$((INCONCLUSIVE+1))
    FAILED=$((FAILED+1))
    continue
  fi

  # Ejecuta el prompt de forma no interactiva contra el CLI configurado
  eval "$AI_CLI \"\$prompt\"" > "$LOG_FILE" 2>&1 || true

  if [ -f "$TARGET_PATH" ] && grep -qE "$pattern" "$TARGET_PATH"; then
    echo "  ✅ PASA"
    PASSED=$((PASSED+1))
  else
    echo "  ❌ FALLA — no se encontró el patrón esperado en $target"
    FAILED=$((FAILED+1))
  fi
done

echo "---"
# Resumen comparable entre ejecuciones: un cambio en MASTER_PROMPT.md, el grafo o los comandos no debería
# bajar el número de evals que pasan (ver evals/README.md). Los inconclusos no miden nada: se repiten.
echo "📊 Resultado: $PASSED/$TOTAL pasan ($((FAILED-INCONCLUSIVE)) fallan, $INCONCLUSIVE inconclusos)"
if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED eval(s) fallidos"
  exit 1
else
  echo "✅ Todos los evals pasaron"
fi
