#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Renombra el instalador NSIS que genera `tauri build` (que usa el
// `productName` de `tauri.conf.json` literal, con espacio) a un nombre de
// archivo sin espacios para la URL de descarga en GitHub Releases.
// Se ejecuta automáticamente al final de `npm run build` (ver `build.mjs`).
// =============================================================================

import { existsSync, readFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tauriGeneratedName, installerFileName } from './installer-name.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const conf = JSON.parse(readFileSync(path.join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'));

const bundleDir = path.join(rootDir, 'src-tauri/target/release/bundle/nsis');
const sourceName = tauriGeneratedName(conf.productName, conf.version);
const targetName = installerFileName(conf.productName, conf.version);

// Result<void, string>: `optional` artifacts (el .sig no existe si no se
// firmó el build) no cuentan como fallo si no aparecen en ningún lado.
function renameArtifact(sourceSuffix, targetSuffix, { optional = false } = {}) {
  const source = path.join(bundleDir, `${sourceName}${sourceSuffix}`);
  const target = path.join(bundleDir, `${targetName}${targetSuffix}`);
  if (existsSync(source)) {
    renameSync(source, target);
    console.log(`[rename-installer] ${path.basename(source)} -> ${path.basename(target)}`);
    return { ok: true };
  }
  if (existsSync(target) || optional) {
    return { ok: true };
  }
  return { ok: false, error: `No se encontró ni "${path.basename(source)}" ni "${path.basename(target)}" en ${bundleDir}` };
}

const exeResult = renameArtifact('', '');
renameArtifact('.sig', '.sig', { optional: true });

if (!exeResult.ok) {
  console.error(`[rename-installer] ${exeResult.error}`);
  process.exit(1);
}
