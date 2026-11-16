// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Barra de estado del editor y números de línea relativos (RF-53) sobre el motor Chromium de WebView2:
// «Ln X, Col Y» sigue al cursor con teclado y ratón, cuenta la selección y cambia de idioma; con la preferencia,
// la línea actual muestra su número y el resto la distancia; los números de la línea 1 y la 200 siguen a la
// altura de su línea (±0,5 px) a varios tamaños de letra; y la barra solo existe en Modo Edición.
//
// @spec RF-53

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const lines = ['# Título', '', 'Hola 한국어 😀 fin.'];
for (let i = 4; i <= 400; i++) lines.push('Línea ' + i);
const doc = lines.join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const status = (h) => h.eval(`return document.getElementById('editor-status-pos').textContent`);
const frame = (h) => h.sleep(80);

/**
 * Desfase vertical entre el número de la línea `n` en la columna y esa línea en el textarea. Un <textarea> no deja
 * medir su texto, así que se mide en un espejo: un <div> con su mismo rectángulo, estilo y desplazamiento.
 */
const alignment = (h, n) => h.eval(`
  const g = document.getElementById('editor-line-numbers'); const ta = document.getElementById('editor-textarea');
  const lh = parseFloat(getComputedStyle(ta).lineHeight);
  ta.scrollTop = Math.max(0, (${n} - 5) * lh); ta.dispatchEvent(new Event('scroll'));
  const lineRect = (node, n) => { const text = node.textContent; let start = 0; for (let i = 1; i < n; i++) start = text.indexOf('\\n', start) + 1; let end = text.indexOf('\\n', start); if (end < 0) end = text.length; const r = document.createRange(); r.setStart(node, start); r.setEnd(node, Math.max(end, start + 1)); return { rect: r.getBoundingClientRect(), label: text.slice(start, end) }; };
  const cs = getComputedStyle(ta); const box = ta.getBoundingClientRect();
  const m = document.createElement('div');
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'boxSizing', 'tabSize']) m.style[k] = cs[k];
  Object.assign(m.style, { position: 'fixed', left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px', whiteSpace: 'pre', overflow: 'hidden', visibility: 'hidden', borderStyle: 'solid', borderColor: 'transparent' });
  m.textContent = ta.value; document.body.appendChild(m); m.scrollTop = ta.scrollTop;
  const mine = lineRect(m.firstChild, ${n}); const gut = lineRect(g.firstChild, ${n});
  m.remove();
  const c = (r) => (r.top + r.bottom) / 2;
  return { delta: Math.abs(c(gut.rect) - c(mine.rect)), label: gut.label };
`);

async function main() {
  console.log('RF-53 · barra de estado');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400 });
  ok('en Modo Lectura la barra no se ve', await h.eval(`return document.getElementById('editor-status').offsetParent === null`));
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  ok('en Modo Edición se ve al pie del panel de código', await h.eval(`const s = document.getElementById('editor-status').getBoundingClientRect(); const b = document.getElementById('editor-body').getBoundingClientRect(); return s.height > 0 && s.top >= b.bottom - 1`));

  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(0, 0)`); await frame(h);
  ok('al principio: Ln 1, Col 1', (await status(h)) === 'Ln 1, Col 1', await status(h));
  // Teclado: dos líneas abajo y hasta el final de la línea 3 (con coreano y un emoji).
  await h.key('ArrowDown', 'ArrowDown', 40); await h.key('ArrowDown', 'ArrowDown', 40); await h.key('End', 'End', 35); await frame(h);
  ok('con el teclado: fin de la línea 3 (15 caracteres), emoji y coreano a una columna cada uno', (await status(h)) === 'Ln 3, Col 16', await status(h));
  // Selección hacia atrás con Mayús+Inicio.
  await h.key('Home', 'Home', 36, 8); await frame(h);
  ok('Mayús+Inicio: cursor en la columna 1 y 15 seleccionados', (await status(h)) === 'Ln 3, Col 1 (15 seleccionados)', await status(h));

  // Ratón: clic en la línea 10.
  const pt = await h.eval(`const ta = document.getElementById('editor-textarea'); ta.scrollTop = 0; const r = ta.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(ta).lineHeight); const pad = parseFloat(getComputedStyle(ta).paddingTop); return { x: Math.round(r.left + 200), y: Math.round(r.top + pad + 9.5 * lh), st: ta.scrollTop }`);
  await h.sleep(100);
  for (const type of ['mousePressed', 'mouseReleased']) await h.send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await frame(h);
  ok('con el ratón: clic en la línea 10 la muestra', /^Ln 10, Col \d+$/.test(await status(h)), (await status(h)) + ' ' + JSON.stringify(pt) + ' st=' + (await h.eval(`return document.getElementById('editor-textarea').scrollTop`)));

  await h.eval(`window.DBVApp.setLanguage('en')`); await frame(h);
  ok('cambia de idioma al instante', /^Ln 10, Col \d+$/.test(await status(h)));
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.setSelectionRange(0, 5)`); await frame(h);
  ok('la selección en inglés: «(5 selected)»', (await status(h)) === 'Ln 1, Col 6 (5 selected)', await status(h));
  await h.eval(`window.DBVApp.setLanguage('es')`);

  console.log('RF-53 · números de línea relativos');
  ok('desactivado por defecto: números absolutos', await h.eval(`return !window.DBVPrefs.relativeLines.get() && document.getElementById('editor-line-numbers').textContent.startsWith('1\\n2\\n3\\n')`));
  const abs = [await alignment(h, 1), await alignment(h, 200)];
  ok('absolutos: la línea 1 y la 200 alineadas (±0,5 px)', abs.every((a) => a.delta <= 0.5), JSON.stringify(abs));
  await h.eval(`window.DBVPrefs.relativeLines.set(true); const ta = document.getElementById('editor-textarea'); ta.focus(); const v = ta.value; let o = 0; for (let i = 1; i < 5; i++) o = v.indexOf('\\n', o) + 1; ta.setSelectionRange(o, o)`); await frame(h);
  const gut = await h.eval(`return document.getElementById('editor-line-numbers').textContent.split('\\n').slice(0, 8).join(',')`);
  ok('con relativos y el cursor en la 5: 4,3,2,1,5,1,2,3', gut === '4,3,2,1,5,1,2,3', gut);
  await h.key('ArrowDown', 'ArrowDown', 40); await frame(h);
  const gut2 = await h.eval(`return document.getElementById('editor-line-numbers').textContent.split('\\n').slice(4, 7).join(',')`);
  ok('al bajar una línea la columna se recalcula', gut2 === '1,6,1', gut2);
  for (const step of [0, 3, -5]) {
    for (let i = 0; i < Math.abs(step); i++) await h.eval(`window.DBVApp.editorZoomStep(${step > 0 ? 1 : -1})`);
    await h.sleep(150);
    const r = [await alignment(h, 1), await alignment(h, 200)];
    const size = await h.eval(`return getComputedStyle(document.getElementById('editor-textarea')).fontSize`);
    ok(`relativos a ${size}: la línea 1 y la 200 alineadas (±0,5 px)`, r.every((a) => a.delta <= 0.5), JSON.stringify(r));
  }
  await h.eval(`window.DBVApp.editorZoomReset(); window.DBVPrefs.relativeLines.set(false)`); await h.sleep(100);
  ok('al apagarlo vuelven los absolutos', await h.eval(`return document.getElementById('editor-line-numbers').textContent.startsWith('1\\n2\\n3\\n4\\n5\\n')`));
  ok('la preferencia se guarda', await h.eval(`return localStorage.getItem('dbv-md-relative-lines') === '0'`));

  await h.eval(`document.getElementById('btn-prefs-menu').click()`); await h.sleep(150);
  const item = await h.eval(`const e = document.querySelector('#prefs-menu [data-pref="relativeLines"]'); return { disabled: e.disabled, checked: e.getAttribute('aria-checked') }`);
  ok('Preferencias ▸ Números de línea relativos ya está habilitada', item.disabled === false && item.checked === 'false', JSON.stringify(item));
  await h.eval(`document.querySelector('#prefs-menu [data-pref="relativeLines"]').click()`); await h.sleep(200);
  ok('la casilla la enciende y el menú sigue abierto', await h.eval(`return window.DBVPrefs.relativeLines.get() === true && !document.getElementById('prefs-menu').classList.contains('hidden')`));
  await h.eval(`window.DBVPrefs.relativeLines.set(false)`);
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
