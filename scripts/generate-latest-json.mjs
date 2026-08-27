#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Genera latest.json para el updater (RF-13) a partir del
// instalador firmado que ya produjo `npm run build`. Evita construir el
// manifiesto a mano (y olvidarlo) en cada Release.
//
// Uso:
//   node scripts/generate-latest-json.mjs [--notes "Texto de la versión"]
//
// Requiere que `npm run build` se haya ejecutado con TAURI_SIGNING_PRIVATE_KEY
// / TAURI_SIGNING_PRIVATE_KEY_PASSWORD en el entorno, para que exista el .sig
// junto al instalador.
//
// También intenta añadir las entradas darwin-* de macOS (ver
// scripts/generate-macos-updater-fragment.mjs): si la Release de GitHub para
// esta versión ya tiene el fragmento que sube ese script en CI, lo descarga
// vía `gh` y lo fusiona aquí. Si no existe todavía (la firma de macOS no
// está activada en el repo, o el workflow de macOS aún no ha corrido para
// esta versión), se omite en silencio: el resultado es exactamente el
// mismo latest.json solo-Windows de siempre, sin ningún cambio de
// comportamiento.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { installerFileName } from './installer-name.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = 'davidbuenov/dbv-md-reader';

const conf = JSON.parse(readFileSync(path.join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'));
const version = conf.version;

const installerName = installerFileName(conf.productName, version);
const bundleDir = path.join(rootDir, 'src-tauri/target/release/bundle/nsis');
const installerPath = path.join(bundleDir, installerName);
const sigPath = `${installerPath}.sig`;

if (!existsSync(installerPath)) {
  console.error(`[generate-latest-json] No se encuentra el instalador: ${installerPath}`);
  console.error('Ejecuta primero "npm run build".');
  process.exit(1);
}
if (!existsSync(sigPath)) {
  console.error(`[generate-latest-json] No se encuentra el .sig: ${sigPath}`);
  console.error('Falta firmar el build: exporta TAURI_SIGNING_PRIVATE_KEY y');
  console.error('TAURI_SIGNING_PRIVATE_KEY_PASSWORD antes de "npm run build".');
  process.exit(1);
}

const signature = readFileSync(sigPath, 'utf8').trim();

// Best-effort: sin `gh`, sin sesión autenticada, o sin fragmento en esta
// Release todavía (macOS sin firmar), sigue funcionando igual que siempre.
function tryMergeMacFragment(platforms, tag) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dbv-mac-fragment-'));
  try {
    execFileSync(
      'gh',
      ['release', 'download', tag, '--pattern', 'latest-macos-fragment.json', '--dir', tmpDir],
      { stdio: 'ignore' }
    );
    const fragment = JSON.parse(
      readFileSync(path.join(tmpDir, 'latest-macos-fragment.json'), 'utf8')
    );
    Object.assign(platforms, fragment.platforms);
    console.log('[generate-latest-json] Fusionadas las entradas darwin-* de macOS.');
  } catch {
    console.log('[generate-latest-json] Sin fragmento de macOS en esta Release (aún no firmado), solo Windows.');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const notesArgIndex = process.argv.indexOf('--notes');
const notes = notesArgIndex !== -1 && process.argv[notesArgIndex + 1]
  ? process.argv[notesArgIndex + 1]
  : `${conf.productName} v${version}`;

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: `https://github.com/${REPO}/releases/download/v${version}/${installerName}`
    }
  }
};

tryMergeMacFragment(manifest.platforms, `v${version}`);

const outPath = path.join(rootDir, 'latest.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[generate-latest-json] Escrito ${outPath} para la version ${version}.`);
