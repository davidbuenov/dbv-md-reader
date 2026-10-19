// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sincronización de scroll editor ↔ vista previa por bloques (RF-20, #15 de johnblommers) en el motor Chromium de
// WebView2. En 10 posiciones repartidas, la primera línea visible del editor debe caer DENTRO del rango de líneas
// del bloque que está en el borde superior de la vista previa (con unas líneas de margen), en las dos direcciones, y un
// clic en el Índice debe dejar el encabezado arriba en AMBOS paneles. Dos documentos: uno de 8.950 líneas con secciones
// muy desiguales y otro con bloques de altura desigual (párrafos de una línea fuente muy anchos, tablas, una imagen alta
// y código).
//
// Punto de partida medido antes del cambio (anclas solo en h1–h3): uniforme, peor caso 16 líneas (el tramo final);
// desigual, 30–31 líneas (6 de 10 posiciones por encima de 2). Ver CHANGELOG [Sin publicar].
//
// @spec RF-20

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');

function uniformDoc() {
  const out = [];
  const sizes = [3, 40, 6, 900, 4, 120, 2, 1500, 8, 60, 700, 5, 300, 12, 800];
  sizes.forEach((n, i) => { out.push(`## Sección ${i + 1}`, ''); for (let k = 0; k < n; k++) out.push(`Párrafo ${i + 1}.${k} con algo de texto para ocupar una línea.`, ''); });
  return out.join('\n');
}

function unevenDoc() {
  const out = [];
  for (let s = 1; s <= 30; s++) {
    out.push(`## Sección ${s}`, '');
    out.push('Lorem ipsum dolor sit amet '.repeat(120), '');
    out.push('| a | b |', '| - | - |');
    for (let r = 0; r < 25; r++) out.push(`| fila ${r} | valor ${s} |`);
    out.push('', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" height="600" width="200">', '');
    out.push('```js'); for (let i = 0; i < 40; i++) out.push(`const v${i} = ${i};`); out.push('```', '');
    for (let k = 0; k < 5; k++) out.push(`Párrafo corto ${k} de la sección ${s}.`, '');
  }
  return out.join('\n');
}

// «Fallo» = líneas que separan la primera línea visible del editor del rango [inicio, fin) del último bloque que empieza por
// encima del borde superior de la vista previa (0 = cae dentro del bloque).
const MISS = `
  const ta = document.getElementById('editor-textarea'); const c = document.getElementById('content');
  const lh = parseFloat(getComputedStyle(ta).lineHeight);
  const first = Math.floor(ta.scrollTop / lh);
  const top = c.getBoundingClientRect().top;
  const els = Array.from(c.querySelectorAll('[data-src-line]')).filter((e) => e.getBoundingClientRect().top <= top + 1);
  const el = els[els.length - 1];
  if (!el) return { first, miss: null };
  const start = Number(el.dataset.srcLine), end = Number(el.dataset.srcEnd);
  return { first, start, end, miss: first < start ? start - first : first >= end ? first - (end - 1) : 0 };`;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

async function run(name, doc, tolerance) {
  console.log(`RF-20 · ${name}`);
  const h = await launch({ appDir, docPath: 'C:/x/d.md', docContent: doc, width: 1400, height: 900 });
  await h.sleep(800);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(1800);
  const e2p = [], p2e = [];
  for (let i = 1; i <= 10; i++) {
    const frac = i / 11;
    await h.eval(`const ta = document.getElementById('editor-textarea'); ta.scrollTop = Math.floor((ta.scrollHeight - ta.clientHeight) * ${frac}); ta.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 450));`);
    e2p.push((await h.eval(MISS)).miss);
    await h.eval(`const c = document.getElementById('content'); c.scrollTop = Math.floor((c.scrollHeight - c.clientHeight) * ${frac}); c.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 450));`);
    p2e.push((await h.eval(MISS)).miss);
  }
  const worst = (a) => Math.max(...a.map((x) => (x === null ? 999 : x)));
  ok(`editor → vista previa: en 10 posiciones el fallo máximo es ≤ ${tolerance} líneas`, worst(e2p) <= tolerance, `fallos ${e2p.join(',')}`);
  ok(`vista previa → editor: en 10 posiciones el fallo máximo es ≤ ${tolerance} líneas`, worst(p2e) <= tolerance, `fallos ${p2e.join(',')}`);

  const n = await h.eval(`return document.querySelectorAll('#toc-list a').length`);
  const clicks = [];
  for (const idx of [1, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1]) {
    clicks.push(await h.eval(`const a = document.querySelectorAll('#toc-list a')[${idx}]; a.click(); await new Promise((r) => setTimeout(r, 4000));
      const ta = document.getElementById('editor-textarea'); const c = document.getElementById('content'); const lh = parseFloat(getComputedStyle(ta).lineHeight);
      const heading = document.getElementById(a.getAttribute('href').slice(1));
      return { line: Number(heading.dataset.srcLine), first: Math.floor(ta.scrollTop / lh), delta: Math.round(heading.getBoundingClientRect().top - c.getBoundingClientRect().top) };`));
  }
  ok('un clic en cada entrada del Índice deja el encabezado arriba en AMBOS paneles (±1 línea)', clicks.every((c) => Math.abs(c.first - c.line) <= 1 && Math.abs(c.delta) <= 2), clicks.map((c) => `${c.line}↔${c.first} (${c.delta}px)`).join(' | '));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await run('documento uniforme de 8.950 líneas con secciones muy desiguales', uniformDoc(), 2);
await run('bloques de altura desigual (párrafos anchos, tablas, imagen alta, código)', unevenDoc(), 3);
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
