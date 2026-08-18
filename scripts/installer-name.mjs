// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Convención de nombre de archivo del instalador NSIS, compartida entre
// `rename-installer.mjs` y `generate-latest-json.mjs` para no duplicarla.
// Ambas funciones derivan el nombre de `productName` (leído por el llamador
// desde `tauri.conf.json`) en vez de repetirlo como literal — así un futuro
// rebrand no puede desincronizar estos scripts del valor real que usa Tauri.
// =============================================================================

// Nombre que genera `tauri build` de forma literal a partir de `productName`
// (puede contener espacios/mayúsculas, tal cual está en `tauri.conf.json`).
export function tauriGeneratedName(productName, version) {
  return `${productName}_${version}_x64-setup.exe`;
}

// Nombre final, sin espacios, usado para la URL de descarga en Releases.
export function installerFileName(productName, version) {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}_${version}_x64-setup.exe`;
}
