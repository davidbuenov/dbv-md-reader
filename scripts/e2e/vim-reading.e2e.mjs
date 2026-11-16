// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Navegación estilo Vim en Modo Lectura (RF-52) sobre el motor Chromium de WebView2, con teclas reales: apagado no
// hace nada; encendido `j`/`k` mueven una línea, Ctrl+D/Ctrl+U media pantalla, `G`/`gg` final y principio, `]]`/`[[`
// dejan el encabezado siguiente/anterior arriba (±4 px, como el Índice), `/` abre Buscar y `n` salta; dentro del campo
// de búsqueda las teclas escriben; Ctrl+F sigue siendo Buscar; también vale en la vista previa del Modo Edición.
//
// @spec RF-52

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const parts = ['# Documento'];
for (let s = 1; s <= 6; s++) {
  parts.push('', `## Sección ${s}`, '');
  for (let p = 0; p < 12; p++) parts.push(`Párrafo ${p} de la sección ${s} con texto suficiente para ocupar una línea.`, '');
}
const doc = parts.join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
async function type(h, str, modifiers = 0) {
  for (const ch of str) {
    await h.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: modifiers ? undefined : ch, modifiers, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) });
    await h.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, modifiers });
  }
  await h.sleep(120);
}
// El contenedor que desplaza la lectura (el mismo criterio que findScrollHost de app.js).
const HOST = `let n = document.getElementById('content'); while (n && n !== document.documentElement && !(/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight)) n = n.parentElement; const host = n && n !== document.documentElement ? n : document.getElementById('reader-container');`;
const top = (h) => h.eval(`${HOST} return host.scrollTop`);
const setTop = (h, y) => h.eval(`${HOST} host.scrollTop = ${y}`);
const focusDoc = (h) => h.eval(`if (document.activeElement) document.activeElement.blur(); document.body.focus()`);
/** Distancia entre el borde superior del panel de lectura y el encabezado «Sección n». */
const headingOffset = (h, n) => h.eval(`const c = document.getElementById('content'); const hd = [...c.querySelectorAll('h2')].find((x) => x.textContent.trim() === 'Sección ${n}'); ${HOST} return hd.getBoundingClientRect().top - host.getBoundingClientRect().top`);
const tocOffset = async (h, n) => {
  await setTop(h, 0); await h.sleep(100);
  await h.eval(`[...document.querySelectorAll('#toc-list a')].find((a) => a.textContent.trim() === 'Sección ${n}').click()`);
  await h.sleep(900);
  return headingOffset(h, n);
};

async function main() {
  const h = await launch({ appDir, docPath: 'C:/x/lectura.md', docContent: doc, width: 1200, height: 800 });
  await h.sleep(500);

  console.log('RF-52 · apagado (por defecto)');
  await focusDoc(h); await setTop(h, 0);
  await type(h, 'jjG');
  ok('con Vim apagado «j» y «G» no mueven nada', (await top(h)) === 0, String(await top(h)));

  console.log('RF-52 · encendido');
  await h.eval(`window.DBVPrefs.vimMode.set(true)`);
  await focusDoc(h);
  await type(h, 'j');
  const line = await top(h);
  ok('«j» baja una línea', line >= 16 && line <= 60, line + ' px');
  await type(h, 'jj');
  ok('«jj» baja dos más', Math.abs((await top(h)) - 3 * line) <= 2, String(await top(h)));
  await type(h, 'k');
  ok('«k» sube una', Math.abs((await top(h)) - 2 * line) <= 2);
  const half = await h.eval(`${HOST} return Math.floor(host.clientHeight / 2)`);
  const before = await top(h);
  await type(h, 'd', 2);
  ok('Ctrl+D baja media pantalla', Math.abs((await top(h)) - before - half) <= 2, `${before} → ${await top(h)} (½ = ${half})`);
  await type(h, 'u', 2);
  ok('Ctrl+U sube media pantalla', Math.abs((await top(h)) - before) <= 2);
  await type(h, 'G');
  ok('«G» va al final', await h.eval(`${HOST} return Math.abs(host.scrollTop + host.clientHeight - host.scrollHeight) <= 2`));
  await type(h, 'gg');
  ok('«gg» vuelve al principio', (await top(h)) === 0);

  const ref = await tocOffset(h, 1); // «Sección 1» colocada con un clic en el Índice
  await focusDoc(h);
  await type(h, ']]'); await h.sleep(800);
  const off2 = await headingOffset(h, 2);
  ok('«]]» deja «Sección 2» arriba como un clic en el Índice (±4 px)', Math.abs(off2 - ref) <= 4, `]] ${off2.toFixed(1)} · Índice ${ref.toFixed(1)}`);
  await type(h, ']]'); await h.sleep(800);
  ok('«]]» otra vez: «Sección 3»', Math.abs((await headingOffset(h, 3)) - ref) <= 4, (await headingOffset(h, 3)).toFixed(1));
  await type(h, '[['); await h.sleep(800);
  ok('«[[»: vuelve a «Sección 2»', Math.abs((await headingOffset(h, 2)) - ref) <= 4, (await headingOffset(h, 2)).toFixed(1));
  await setTop(h, 0); await type(h, ']]'); await h.sleep(800);
  ok('desde el principio «]]» va al primer encabezado por debajo (el título)', (await top(h)) >= 0 && (await headingOffset(h, 1)) > 0);

  console.log('RF-52 · búsqueda y campos de texto');
  await focusDoc(h);
  await type(h, '/');
  ok('«/» abre Buscar con el foco en el campo', await h.eval(`return !document.getElementById('search-modal').classList.contains('hidden') && document.activeElement === document.getElementById('search-input')`));
  const t0 = await top(h);
  await type(h, 'jk');
  ok('dentro del campo de búsqueda las teclas escriben y no desplazan', (await h.eval(`return document.getElementById('search-input').value`)) === 'jk' && (await top(h)) === t0);
  await h.eval(`const i = document.getElementById('search-input'); i.value = 'Sección 5'; i.dispatchEvent(new Event('input', { bubbles: true }))`); await h.sleep(300);
  await setTop(h, 0); await focusDoc(h);
  await type(h, 'n'); await h.sleep(500);
  ok('«n» salta a la coincidencia de la búsqueda activa', (await top(h)) > 0, String(await top(h)));
  await h.key('Escape', 'Escape', 27); await h.sleep(100);

  console.log('RF-52.3 · vista previa del Modo Edición');
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(700);
  await setTop(h, 0); await focusDoc(h);
  await type(h, 'G'); await h.sleep(200);
  ok('con el foco fuera del editor «G» mueve la vista previa', (await top(h)) > 0);
  const val = await h.eval(`return document.getElementById('editor-textarea').value`);
  ok('y no escribe en el editor', val === doc);

  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
