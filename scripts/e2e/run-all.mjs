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
// Después de cada banco comprueba que se ha liberado todo lo que lanzó: ni un proceso de Edge del harness ni su
// carpeta temporal. Un banco que deja algo vivo falsea los siguientes (el puerto de depuración queda ocupado), así
// que cuenta como fallo aunque sus comprobaciones pasen.
//
// Uso: npm run test:e2e

import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MARK = 'dbv-harness-';
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Procesos de Edge lanzados por el harness que siguen vivos (se reconocen por la carpeta de perfil en su línea de órdenes). */
const liveHarnessEdges = () => {
  const run = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${MARK}') } | Measure-Object).Count`], { encoding: 'utf8' })
    : spawnSync('pgrep', ['-f', MARK], { encoding: 'utf8' });
  const out = (run.stdout || '').trim();
  return process.platform === 'win32' ? Number.parseInt(out, 10) || 0 : out.split('\n').filter(Boolean).length;
};
/** Carpetas de perfil temporales que siguen en disco. */
const leftoverProfiles = () => readdirSync(tmpdir()).filter((name) => name.startsWith(MARK)).length;

/** Espera hasta 10 s a que el sistema termine de liberar (con la máquina cargada el cierre no es instantáneo). */
const leaksAfterSuite = (baseline) => {
  let leak = { edges: 0, profiles: 0 };
  for (let i = 0; i < 20; i++) {
    leak = { edges: Math.max(0, liveHarnessEdges() - baseline.edges), profiles: Math.max(0, leftoverProfiles() - baseline.profiles) };
    if (!leak.edges && !leak.profiles) break;
    sleep(500);
  }
  return leak;
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(dir).filter((name) => name.endsWith('.e2e.mjs')).sort();
const baseline = { edges: liveHarnessEdges(), profiles: leftoverProfiles() };
if (baseline.edges) console.log(`Aviso: ya había ${baseline.edges} procesos de Edge del harness antes de empezar; se descuentan.`);
let failed = 0;
for (const suite of suites) {
  console.log(`\n━━ ${suite}`);
  const run = spawnSync(process.execPath, [path.join(dir, suite)], { stdio: 'inherit' });
  const leak = leaksAfterSuite(baseline);
  if (leak.edges || leak.profiles) console.log(`  FALLA no libera lo que lanzó — ${leak.edges} procesos de Edge y ${leak.profiles} carpetas temporales siguen ahí tras 10 s`);
  if (run.status !== 0 || leak.edges || leak.profiles) failed++;
  // Cada banco responde solo de lo suyo: lo que dejó uno ya no se le cuenta al siguiente.
  baseline.edges += leak.edges;
  baseline.profiles += leak.profiles;
}
console.log(failed ? `\n${failed} de ${suites.length} bancos fallan.` : `\n${suites.length} bancos correctos.`);
process.exit(failed ? 1 : 0);
