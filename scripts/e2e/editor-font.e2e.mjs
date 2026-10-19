// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Tamaño de letra del editor (RF-43) en el motor Chromium de WebView2: los atajos Ctrl +/−/0 y la rueda actúan
// sobre el panel con el foco o bajo el puntero (editor frente a vista previa), los límites 60 %–200 %, que los
// números de línea siguen alineados con el texto a tres tamaños, la persistencia y las entradas de Preferencias.
//
// @spec RF-43

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', ...Array.from({ length: 200 }, (_, i) => `Línea ${i + 1} con texto de relleno para medir.`)].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const MOD = 2; // Ctrl
const sizes = (h) => h.eval(`
  const ta = document.getElementById('editor-textarea'); const ln = document.getElementById('editor-line-numbers');
  const t = getComputedStyle(ta); const n = getComputedStyle(ln);
  return { ta: parseFloat(t.fontSize), ln: parseFloat(n.fontSize), taLh: parseFloat(t.lineHeight), lnLh: parseFloat(n.lineHeight),
           preview: document.getElementById('content').style.zoom || '100%', level: window.DBVApp.editorZoomLevel(),
           taH: ta.scrollHeight, lnH: ln.scrollHeight, lines: ta.value.split('\\n').length };`);
const key = async (h, k, code, vk) => { await h.key(k, code, vk, MOD); await h.sleep(120); };

async function main() {
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400, height: 900 });
  await h.eval(`localStorage.clear()`);
  await h.send('Page.reload');
  await h.sleep(1800);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(900);

  console.log('RF-43 · por defecto');
  let s = await sizes(h);
  ok('el editor arranca a 13 px (100 %) y su columna de números también', s.ta === 13 && s.ln === 13 && s.level === 100, JSON.stringify(s));

  console.log('RF-43 · atajos por foco');
  await h.eval(`document.getElementById('editor-textarea').focus()`);
  await key(h, '=', 'Equal', 187);
  s = await sizes(h);
  ok('Ctrl + con el foco en el editor agranda el editor (14,3 px) y NO la vista previa', Math.abs(s.ta - 14.3) < 0.01 && Math.abs(s.ln - 14.3) < 0.01 && /^(100%)?$/.test(s.preview === '100%' ? '100%' : s.preview), JSON.stringify(s));
  await key(h, '-', 'Minus', 189);
  await key(h, '-', 'Minus', 189);
  s = await sizes(h);
  ok('Ctrl − con el foco en el editor lo reduce (11,7 px)', Math.abs(s.ta - 11.7) < 0.01, JSON.stringify(s));
  await key(h, '0', 'Digit0', 48);
  s = await sizes(h);
  ok('Ctrl 0 con el foco en el editor lo restablece (13 px)', s.ta === 13 && s.level === 100, JSON.stringify(s));

  await h.eval(`document.activeElement.blur(); document.body.focus();`);
  await key(h, '=', 'Equal', 187);
  s = await sizes(h);
  ok('Ctrl + con el foco FUERA del editor amplía la vista previa (como siempre) y no el editor', s.preview === '110%' && s.ta === 13, JSON.stringify(s));
  await key(h, '0', 'Digit0', 48);

  await h.eval(`document.querySelector('#editor-toolbar button')?.focus()`);
  await key(h, '=', 'Equal', 187);
  s = await sizes(h);
  ok('con el foco en la barra de formato del editor también cuenta como «en el editor»', s.level === 110, JSON.stringify(s));
  await key(h, '0', 'Digit0', 48);

  console.log('RF-43 · rueda con Ctrl bajo el puntero');
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }));`);
  s = await sizes(h);
  ok('la rueda sobre el editor cambia el editor', s.level === 110 && s.preview === '100%', JSON.stringify(s));
  await h.eval(`document.getElementById('content').dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }));`);
  s = await sizes(h);
  ok('la rueda sobre la vista previa cambia la vista previa', s.level === 110 && s.preview === '110%', JSON.stringify(s));
  await h.eval(`window.DBVApp.editorZoomReset(); document.getElementById('content').style.zoom = '100%'; localStorage.setItem('dbv-md-zoom', '100')`);

  console.log('RF-43 · límites');
  await h.eval(`for (let i = 0; i < 20; i++) window.DBVApp.editorZoomStep(1)`);
  s = await sizes(h);
  ok('tope del 200 % (26 px)', s.level === 200 && s.ta === 26, JSON.stringify(s));
  await h.eval(`for (let i = 0; i < 30; i++) window.DBVApp.editorZoomStep(-1)`);
  s = await sizes(h);
  ok('suelo del 60 % (7,8 px)', s.level === 60 && Math.abs(s.ta - 7.8) < 0.01, JSON.stringify(s));

  console.log('RF-43 · los números de línea siguen alineados a cualquier tamaño');
  for (const level of [60, 100, 200]) {
    await h.eval(`window.DBVApp.editorZoomReset(); const target = ${level}; while (window.DBVApp.editorZoomLevel() < target) window.DBVApp.editorZoomStep(1); while (window.DBVApp.editorZoomLevel() > target) window.DBVApp.editorZoomStep(-1);`);
    await h.sleep(200);
    s = await sizes(h);
    const sameFont = s.ta === s.ln && s.taLh === s.lnLh;
    ok(`${level} %: misma fuente (${s.ta}px) e interlineado (${s.taLh}px) en texto y números`, sameFont, JSON.stringify(s));
    ok(`${level} %: la altura de ${s.lines} líneas coincide (texto ${s.taH}px · números ${s.lnH}px)`, Math.abs(s.taH - s.lnH) <= 2, `diferencia ${Math.abs(s.taH - s.lnH)}`);
    // La línea 150: su número y su texto caen en la misma Y (el número n está en la fila n del bloque de números).
    const aligned = await h.eval(`const ta = document.getElementById('editor-textarea'); const ln = document.getElementById('editor-line-numbers'); const lh = parseFloat(getComputedStyle(ta).lineHeight); ta.scrollTop = 149 * lh; ta.dispatchEvent(new Event('scroll')); await new Promise((r) => setTimeout(r, 120)); return Math.abs(ta.scrollTop - ln.scrollTop) <= 1`);
    ok(`${level} %: el desplazamiento de los números sigue al del texto`, aligned);
  }

  console.log('RF-43 · persistencia');
  await h.eval(`window.DBVApp.editorZoomReset(); window.DBVApp.editorZoomStep(1); window.DBVApp.editorZoomStep(1);`);
  await h.send('Page.reload');
  await h.sleep(1800);
  s = await h.eval(`return { level: window.DBVApp.editorZoomLevel(), css: getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() }`);
  ok('tras recargar se conserva el tamaño (120 %)', s.level === 120 && s.css === '15.6px', JSON.stringify(s));
  await h.eval(`localStorage.setItem('dbv-md-editor-zoom', 'enorme')`);
  await h.send('Page.reload');
  await h.sleep(1800);
  ok('un valor guardado inválido vuelve al 100 %', (await h.eval(`return window.DBVApp.editorZoomLevel()`)) === 100);
  await h.eval(`localStorage.setItem('dbv-md-editor-zoom', '9999')`);
  await h.send('Page.reload');
  await h.sleep(1800);
  ok('un valor fuera de rango se recorta al 200 %', (await h.eval(`return window.DBVApp.editorZoomLevel()`)) === 200);
  await h.eval(`localStorage.clear()`);
  await h.send('Page.reload');
  await h.sleep(1800);

  console.log('RF-43 · Preferencias');
  await h.eval(`document.getElementById('btn-prefs-menu').click()`);
  await h.sleep(200);
  const head = await h.eval(`return document.querySelector('#prefs-menu .menu-heading[data-dynamic="editorFont"]').textContent`);
  ok('la cabecera muestra el valor vivo', /100 %/.test(head), head);
  await h.eval(`document.querySelector('#prefs-menu [data-action="editorFontInc"]').click()`);
  await h.sleep(250);
  const after = await h.eval(`return { head: document.querySelector('#prefs-menu .menu-heading[data-dynamic="editorFont"]').textContent, open: !document.getElementById('prefs-menu').classList.contains('hidden'), level: window.DBVApp.editorZoomLevel() }`);
  ok('«Aumentar» sube al 110 %, actualiza la cabecera y no cierra el menú', after.level === 110 && /110 %/.test(after.head) && after.open, JSON.stringify(after));
  await h.eval(`document.querySelector('#prefs-menu [data-action="editorFontReset"]').click()`);
  await h.sleep(250);
  ok('«Restablecer» vuelve al 100 %', (await h.eval(`return window.DBVApp.editorZoomLevel()`)) === 100);
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
