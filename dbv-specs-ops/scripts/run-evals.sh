#!/bin/bash
# scripts/run-evals.sh
# Ejecuta la suite de evals/ contra el CLI de IA declarado en project.config.md
# Uso: ./scripts/run-evals.sh
# Override manual: AI_CLI="gemini -p" ./scripts/run-evals.sh

set -e

CONFIG_FILE="dbv-specs-ops/project.config.md"
EVALS_DIR="evals"

# 1. Determinar qué CLI usar: variable de entorno > project.config.md > error
if [ -z "$AI_CLI" ]; then
  if [ -f "$CONFIG_FILE" ]; then
    AI_CLI=$(grep -A2 "CLI no interactivo" "$CONFIG_FILE" | grep -oE '(claude|gemini|copilot|cursor)[^ ]* -p' | head -1)
  fi
fi

if [ -z "$AI_CLI" ]; then
  echo "❌ No se ha definido el CLI de IA. Declara 'CLI no interactivo' en $CONFIG_FILE"
  echo "   o exporta AI_CLI, ej: export AI_CLI='claude -p'"
  exit 1
fi

echo "🤖 Usando: $AI_CLI"
echo "---"

FAILED=0

for eval_file in "$EVALS_DIR"/*.json; do
  [ -e "$eval_file" ] || continue
  name=$(jq -r '.name' "$eval_file")
  prompt=$(jq -r '.prompt' "$eval_file")
  target=$(jq -r '.check_target' "$eval_file")
  pattern=$(jq -r '.check_pattern' "$eval_file")

  echo "▶ $name"

  # Ejecuta el prompt de forma no interactiva contra el CLI configurado
  eval "$AI_CLI \"\$prompt\"" > /tmp/eval_output.log 2>&1 || true

  if [ -f "$target" ] && grep -qE "$pattern" "$target"; then
    echo "  ✅ PASA"
  else
    echo "  ❌ FALLA — no se encontró el patrón esperado en $target"
    FAILED=$((FAILED+1))
  fi
done

echo "---"
if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED eval(s) fallidos"
  exit 1
else
  echo "✅ Todos los evals pasaron"
fi
