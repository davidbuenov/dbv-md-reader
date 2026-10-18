#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Ejecuta en serie todos los bancos de interfaz (`*.e2e.mjs`) y devuelve un código
// de salida distinto de cero si alguno falla. Cada banco lanza su propio Edge
// headless, así que no se pueden paralelizar (comparten el puerto de depuración).
//
// Uso: npm run test:e2e

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(dir).filter((name) => name.endsWith('.e2e.mjs')).sort();
let failed = 0;
for (const suite of suites) {
  console.log(`\n━━ ${suite}`);
  const run = spawnSync(process.execPath, [path.join(dir, suite)], { stdio: 'inherit' });
  if (run.status !== 0) failed++;
}
console.log(failed ? `\n${failed} de ${suites.length} bancos fallan.` : `\n${suites.length} bancos correctos.`);
process.exit(failed ? 1 : 0);
