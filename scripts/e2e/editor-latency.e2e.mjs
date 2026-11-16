// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Latencia por tecla del editor (RNF-04) sobre el motor Chromium de WebView2, con teclas reales: con 5.000 líneas y
// las preferencias nuevas APAGADAS, la letra escrita se pinta en el primer fotograma (mediana < 18 ms desde el
// keydown hasta después del fotograma). La 0.19.0 da ~13,5 ms; en /test de la 0.20.0 un fotograma pedido en `keyup`
// para la barra de estado la llevó a ~25 ms (un fotograma de más), y este banco lo habría detectado.
// `APP_DIR=<carpeta src>` mide otro frontend (p. ej. una versión anterior extraída con `git archive`).
//
// @spec RNF-04

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = (process.env.APP_DIR || path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src')).replace(/\\/g, '/');
const big = Array.from({ length: 5000 }, (_, i) => `línea ${i} con (algo) de texto, más palabras`).join('\n');
const LIMIT_MS = 18;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

async function median(h, keys) {
  await h.eval(`window.__lat = []`);
  for (const ch of keys) {
    await h.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
    await h.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    await h.sleep(60);
  }
  const lat = (await h.eval(`return window.__lat`)).sort((a, b) => a - b);
  return { median: lat[lat.length >> 1], n: lat.length };
}

async function main() {
  console.log('RNF-04 · latencia por tecla con 5.000 líneas (preferencias nuevas apagadas)');
  const h = await launch({ appDir, docPath: 'C:/x/lat.md', docContent: big, width: 1400 });
  await h.sleep(800);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(1500);
  await h.eval(`
    const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(${Math.floor(big.length / 2)}, ${Math.floor(big.length / 2)});
    window.__lat = []; let t0 = 0;
    ta.addEventListener('keydown', () => { t0 = performance.now(); }, true);
    // Hasta después del siguiente fotograma: manejadores, estilo y maquetación, como lo percibe quien escribe.
    ta.addEventListener('input', () => { const s = t0; requestAnimationFrame(() => setTimeout(() => window.__lat.push(performance.now() - s), 0)); });`);
  // Una tanda de calentamiento que no cuenta (la primera maquetación del documento grande es más lenta) y después la
  // mediana de 60 teclas.
  await median(h, 'abcdefghijklmno');
  const m = await median(h, 'abcdefghijklmnopqrstuvwxyz'.repeat(3).slice(0, 60));
  ok(`la letra se pinta en el primer fotograma (mediana < ${LIMIT_MS} ms)`, m.median < LIMIT_MS, `${m.median.toFixed(1)} ms (n=${m.n})`);
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
