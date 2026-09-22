#!/usr/bin/env node
// =============================================================================
// dbv-md-reader: genera el fragmento darwin-* del manifiesto del updater
// (RF-13) a partir del .app.tar.gz/.sig que acaba de producir tauri-action
// en el job de CI de macOS, y lo sube como asset de la Release en curso.
//
// Sólo se invoca desde .github/workflows/release-macos.yml, y sólo cuando
// ese workflow detecta que el repo tiene configurada la clave de firma
// (TAURI_SIGNING_PRIVATE_KEY). Sin ella no existe ningún .sig que leer.
//
// scripts/generate-latest-json.mjs (que el maintainer sigue ejecutando en
// local para el resto de la Release, exactamente igual que hoy) descarga
// este fragmento vía `gh` y lo fusiona en el latest.json final. Así el
// flujo manual de Windows no cambia en absoluto: si este fragmento no
// existe en la Release (porque la firma de macOS no está activada, o este
// workflow aún no ha corrido para esa versión), generate-latest-json.mjs
// simplemente lo omite y produce el mismo latest.json solo-Windows de
// siempre.
//
// Uso: node scripts/generate-macos-updater-fragment.mjs <tag>
// Requiere `gh` autenticado (el mismo GITHUB_TOKEN que ya usa tauri-action
// para subir los artefactos de esta Release).
// =============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO = 'davidbuenov/dbv-md-reader';
const tag = process.argv[2];

if (!tag) {
  console.error('Uso: node scripts/generate-macos-updater-fragment.mjs <tag>');
  process.exit(1);
}

// Ruta fija: --target universal-apple-darwin en release-macos.yml determina
// este directorio de salida (Tauri organiza el bundle por target triple).
const bundleDir = path.join(
  'src-tauri', 'target', 'universal-apple-darwin', 'release', 'bundle', 'macos'
);

const files = readdirSync(bundleDir);
const tarGzName = files.find((f) => f.endsWith('.app.tar.gz'));
const sigName = files.find((f) => f.endsWith('.app.tar.gz.sig'));

if (!tarGzName || !sigName) {
  console.error(`[macos-updater-fragment] No se encontró .app.tar.gz/.sig en ${bundleDir}.`);
  console.error('¿Se generó con createUpdaterArtifacts:true? Nada que subir.');
  process.exit(1);
}

const signature = readFileSync(path.join(bundleDir, sigName), 'utf8').trim();
const url = `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(tarGzName)}`;

// Universal (mismo fat binary sirve para Intel y Apple Silicon, ver
// release-macos.yml): se publica la misma entrada bajo ambas claves de
// plataforma. El updater de Tauri resuelve la clave por la arquitectura
// en la que corre; no existe una clave "darwin-universal" reconocida.
const fragment = {
  platforms: {
    'darwin-x86_64': { signature, url },
    'darwin-aarch64': { signature, url }
  }
};

const fragmentPath = 'latest-macos-fragment.json';
writeFileSync(fragmentPath, JSON.stringify(fragment, null, 2) + '\n');

execFileSync('gh', ['release', 'upload', tag, fragmentPath, '--clobber'], { stdio: 'inherit' });
console.log(`[macos-updater-fragment] Subido ${fragmentPath} a la Release ${tag}.`);
