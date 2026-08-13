#!/usr/bin/env bash
# =============================================================================
# dbv-md-reader — genera un .dmg de macOS sin pasar por el bundler de Tauri.
#
# El bundler de dmg de Tauri (create-dmg) lanza AppleScript para posicionar
# iconos en la ventana del Finder ("--icon", "--app-drop-link"). Eso requiere
# permiso de Automation hacia Finder (TCC), que falla con
# "Not authorized to send Apple events to Finder (-1743)" en shells no
# interactivos — incluidos runners de CI headless. Por eso `bundle.targets`
# está fijado a ["app"] en tauri.macos.conf.json y el .dmg se genera aquí,
# aparte, con `hdiutil` puro (sin osascript): la app + un symlink a
# /Applications, sin estilismo de ventana. Funcionalmente equivalente para
# instalar; sólo pierde el fondo/iconos posicionados.
# =============================================================================
set -euo pipefail

PROFILE="${1:-debug}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT_DIR/src-tauri/tauri.conf.json"

PRODUCT_NAME=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$CONF')).productName)")
VERSION=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$CONF')).version)")

APP_PATH="$ROOT_DIR/src-tauri/target/$PROFILE/bundle/macos/$PRODUCT_NAME.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "No se encontró '$APP_PATH'." >&2
  echo "Ejecuta antes: npx tauri build --debug (o sin --debug para release)." >&2
  exit 1
fi

# Deriva el arco del propio binario (no de `uname -m`) para que un build
# `--target universal-apple-darwin` se nombre "universal" y no "aarch64"
# sólo porque se compiló en un Mac Apple Silicon.
BIN_PATH="$APP_PATH/Contents/MacOS/$(defaults read "$APP_PATH/Contents/Info" CFBundleExecutable)"
ARCHS="$(lipo -archs "$BIN_PATH")"
case "$ARCHS" in
  *" "*) ARCH="universal" ;;
  x86_64) ARCH="x64" ;;
  arm64) ARCH="aarch64" ;;
  *) ARCH="$ARCHS" ;;
esac
SLUG=$(echo "$PRODUCT_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
OUT_DIR="$ROOT_DIR/src-tauri/target/$PROFILE/bundle/dmg"
DMG_PATH="$OUT_DIR/${SLUG}_${VERSION}_${ARCH}.dmg"

STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

cp -R "$APP_PATH" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

mkdir -p "$OUT_DIR"
rm -f "$DMG_PATH"
hdiutil create -volname "$PRODUCT_NAME" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_PATH"

echo "DMG creado: $DMG_PATH"
