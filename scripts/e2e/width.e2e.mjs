// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ancho de lectura (RF-41) medido con getBoundingClientRect en el motor Chromium de WebView2: los cuatro
// anchos × las dos posiciones de la casilla «Bloques anchos a todo el ancho», que el valor por defecto
// conserva el comportamiento de siempre (800 px de prosa dentro de 1100 px), que con la casilla desmarcada
// texto, tabla, línea, código, Mermaid e imagen suelta comparten borde, la persistencia, el menú y que ni la
// impresión ni el Modo Edición se ven afectados.
//
// @spec RF-41

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
// markdown-it solo admite data: de gif/png/jpeg/webp; se mide el PÁRRAFO (bloque), no el tamaño intrínseco de la imagen.
const svg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const doc = [
  '# Título', '',
  'Un párrafo de texto normal para medir la columna de lectura.', '',
  '- elemento uno', '- elemento dos', '',
  '> una cita', '',
  '| a | b |', '| - | - |', `| ${'palabra '.repeat(60)} | dos |`, '',
  '```js', `const largo = "${'x'.repeat(200)}";`, '```', '',
  '---', '',
  '```mermaid', 'flowchart LR', '  A --> B', '```', '',
  `![ancha](${svg})`, '',
  'Otro párrafo con una imagen ![pequeña](data:image/gif;base64,R0lGODlhAQABAAAAACw=) dentro del texto.', '',
].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const MEASURE = `
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, w: Math.round(b.width * 10) / 10 }; };
  const c = document.getElementById('content');
  const cs = getComputedStyle(c);
  const inner = { w: Math.round((c.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 10) / 10 };
  return {
    container: inner,
    p: r(c.querySelector('p')),
    table: r(c.querySelector('table')),
    code: r(c.querySelector('.code-block')),
    hr: r(c.querySelector('hr')),
    mermaid: r(c.querySelector('.mermaid-container')),
    imgP: r(c.querySelector('p.img-block')),
    smallImgP: r(Array.from(c.querySelectorAll('p')).find((p) => p.textContent.includes('Otro párrafo'))),
    scrollOver: c.scrollWidth - c.clientWidth,
  };`;

const setWidth = async (h, width, wide) => {
  await h.eval(`window.DBVPrefs.contentWidth.set('${width}'); window.DBVPrefs.wideBlocks.set(${wide});`);
  await h.sleep(150);
  return h.eval(MEASURE);
};
const near = (a, b, tol = 1) => a !== null && b !== null && Math.abs(a - b) <= tol;
const sameEdges = (a, b, tol = 1) => a && b && near(a.l, b.l, tol) && near(a.r, b.r, tol);

async function main() {
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1500, height: 900 });
  await h.eval(`localStorage.clear(); location.reload()`);
  await h.sleep(2200);

  console.log('RF-41 · valor por defecto = comportamiento de siempre');
  const d = await h.eval(MEASURE);
  const cw = d.container.w;
  ok('Normal por defecto: el texto mide 800 px', near(d.p.w, 800), `${d.p.w} px`);
  ok('el contenedor es de 1100 px (o lo que quepa)', cw >= 900 && cw <= 1100.5, `${cw} px`);
  ok('con la casilla marcada tabla, código y línea usan todo el contenedor', near(d.table.w, cw) && near(d.code.w, cw) && near(d.hr.w, cw), `tabla ${d.table.w}, código ${d.code.w}, línea ${d.hr.w}`);
  ok('el diagrama Mermaid usa todo el contenedor', d.mermaid !== null && near(d.mermaid.w, cw), JSON.stringify(d.mermaid));
  ok('el párrafo de una imagen suelta llega al contenedor; la que va entre texto no cambia', near(d.imgP.w, cw) && near(d.smallImgP.w, 800), `suelta ${d.imgP.w}, entre texto ${d.smallImgP.w}`);
  ok('sin scroll horizontal en el contenido', d.scrollOver <= 1, String(d.scrollOver));

  console.log('RF-41 · los cuatro anchos con la casilla marcada');
  const expected = { narrow: 640, normal: 800, wide: 1000 };
  for (const [name, px] of Object.entries(expected)) {
    const m = await setWidth(h, name, true);
    ok(`${name}: el texto mide ${px} px y los bloques anchos siguen abiertos`, near(m.p.w, Math.min(px, m.container.w)) && near(m.table.w, m.container.w) && near(m.code.w, m.container.w), `texto ${m.p.w}, tabla ${m.table.w}/${m.container.w}`);
  }
  let m = await setWidth(h, 'full', true);
  ok('full: texto y bloques ocupan el 100 % del área de lectura', near(m.p.w, m.container.w) && near(m.table.w, m.container.w) && near(m.imgP.w, m.container.w), `texto ${m.p.w}, contenedor ${m.container.w}`);

  console.log('RF-41 · casilla desmarcada: los bloques se alinean con el texto');
  for (const name of ['narrow', 'normal', 'wide']) {
    m = await setWidth(h, name, false);
    const aligned = ['table', 'code', 'hr', 'mermaid', 'imgP'].filter((k) => !sameEdges(m[k], m.p));
    ok(`${name}: tabla, código, línea, Mermaid e imagen comparten borde izquierdo y derecho con el texto`, aligned.length === 0, aligned.length ? `no alinean: ${aligned.join(', ')} · texto ${JSON.stringify(m.p)}` : `columna ${m.p.w} px`);
    ok(`${name}: la tabla ancha no desborda la columna ni el contenido`, m.table.w <= m.p.w + 1 && m.scrollOver <= 1, `tabla ${m.table.w}, scroll ${m.scrollOver}`);
  }
  m = await setWidth(h, 'full', false);
  ok('full + casilla desmarcada: todo al 100 %', sameEdges(m.table, m.p) && sameEdges(m.imgP, m.p));

  console.log('RF-41 · menú de Preferencias');
  await setWidth(h, 'normal', true);
  await h.eval(`document.getElementById('btn-prefs-menu').click()`);
  await h.sleep(200);
  const menu = await h.eval(`return Array.from(document.querySelectorAll('#prefs-menu [data-pref="contentWidth"]')).map((i) => i.dataset.value + ':' + i.getAttribute('aria-checked')).join(',') + '|' + document.querySelector('#prefs-menu [data-pref="wideBlocks"]').getAttribute('aria-checked')`);
  ok('el menú marca Normal y la casilla de bloques anchos', menu === 'narrow:false,normal:true,wide:false,full:false|true', menu);
  await h.eval(`document.querySelector('#prefs-menu [data-pref="contentWidth"][data-value="wide"]').click()`);
  await h.sleep(300);
  const afterClick = await h.eval(`return { width: document.body.dataset.width, open: !document.getElementById('prefs-menu').classList.contains('hidden'), checked: document.querySelector('#prefs-menu [data-value="wide"]').getAttribute('aria-checked'), normal: document.querySelector('#prefs-menu [data-value="normal"]').getAttribute('aria-checked'), stored: localStorage.getItem('dbv-md-content-width') }`);
  ok('elegir Ancho se aplica al instante, se guarda y no cierra el menú', afterClick.width === 'wide' && afterClick.open && afterClick.checked === 'true' && afterClick.normal === 'false' && afterClick.stored === 'wide', JSON.stringify(afterClick));
  await h.eval(`document.querySelector('#prefs-menu [data-pref="wideBlocks"]').click()`);
  await h.sleep(300);
  const box = await h.eval(`return { off: document.body.classList.contains('wide-blocks-off'), stored: localStorage.getItem('dbv-md-wide-blocks'), open: !document.getElementById('prefs-menu').classList.contains('hidden') }`);
  ok('desmarcar la casilla aplica el modo alineado, se guarda y no cierra el menú', box.off && box.stored === '0' && box.open, JSON.stringify(box));

  console.log('RF-41 · persistencia');
  await h.send('Page.reload');
  await h.sleep(2000);
  const kept = await h.eval(`return { width: document.body.dataset.width, off: document.body.classList.contains('wide-blocks-off') }`);
  ok('tras recargar se conservan el ancho y la casilla', kept.width === 'wide' && kept.off === true, JSON.stringify(kept));
  await h.eval(`localStorage.setItem('dbv-md-content-width', 'enorme'); localStorage.setItem('dbv-md-wide-blocks', 'quizas');`);
  await h.send('Page.reload');
  await h.sleep(2000);
  const bad = await h.eval(`return { width: document.body.dataset.width, off: document.body.classList.contains('wide-blocks-off') }`);
  ok('un valor guardado inválido vuelve al por defecto', bad.width === 'normal' && bad.off === false, JSON.stringify(bad));

  console.log('RF-41 · no afecta a la impresión ni al Modo Edición');
  const printed = [];
  for (const [w, wide] of [['normal', true], ['narrow', false], ['full', true]]) {
    await h.eval(`window.DBVPrefs.contentWidth.set('${w}'); window.DBVPrefs.wideBlocks.set(${wide});`);
    await h.send('Emulation.setEmulatedMedia', { media: 'print' });
    await h.send('Emulation.setDeviceMetricsOverride', { width: 657, height: 900, deviceScaleFactor: 1, mobile: false });
    await h.sleep(250);
    printed.push(await h.eval(`return Math.round(document.querySelector('.markdown-body p').getBoundingClientRect().width) + '/' + Math.round(document.querySelector('.markdown-body table').getBoundingClientRect().width)`));
    await h.send('Emulation.setEmulatedMedia', { media: 'screen' });
    await h.send('Emulation.clearDeviceMetricsOverride');
  }
  ok('la maquetación impresa es la misma con cualquier ancho elegido en pantalla', new Set(printed).size === 1, printed.join(' · '));

  await h.eval(`window.DBVPrefs.contentWidth.set('wide'); window.DBVPrefs.wideBlocks.set(true); document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(900);
  const edit = await h.eval(`const c = document.getElementById('content'); const rc = document.getElementById('reader-container'); return { over: c.scrollWidth - c.clientWidth, rcOver: rc.scrollWidth - rc.clientWidth, p: Math.round(c.querySelector('p').getBoundingClientRect().width), pane: Math.round(c.clientWidth) }`);
  ok('en Modo Edición la vista previa usa el menor entre el ancho y su panel, sin scroll horizontal', edit.over <= 1 && edit.rcOver <= 1 && edit.p <= edit.pane, JSON.stringify(edit));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
