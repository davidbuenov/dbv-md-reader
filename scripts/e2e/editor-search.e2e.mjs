// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Buscar dentro del editor (RF-44) en el motor Chromium de WebView2: Ctrl+F busca en el panel con el foco (editor
// frente a vista previa), el selector «Editor | Vista previa», contador, navegación circular, la coincidencia
// actual seleccionada y a la vista (también en horizontal) aunque el foco siga en el campo de búsqueda, que no
// modifica el documento, Escape devuelve el foco al editor, que la búsqueda en la vista previa no cambia y el
// rendimiento con 5.000 líneas.
//
// @spec RF-44

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const shot = process.env.SHOT_DIR;

const lines = ['# Búsqueda', ''];
for (let i = 1; i <= 120; i++) lines.push(i % 7 === 0 ? `Línea ${i}: el Time pasa y el time vuela.` : `Línea ${i}: texto de relleno sin la palabra.`);
lines.push('', `${'x'.repeat(350)} ZZTOP al final de una línea muy larga`, '', '한국어 문장입니다 안녕하세요 Time 시간 time 끝', '', 'Última línea con TIME.');
const doc = lines.join('\n');
const expectedCount = (doc.match(/time/gi) || []).length;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const CTRL = 2;
const ctrlF = async (h) => { await h.key('f', 'KeyF', 70, CTRL); await h.sleep(200); };
const type = async (h, q) => { await h.eval(`const i = document.getElementById('search-input'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true }));`); await h.sleep(150); };
const editor = (h) => h.eval(`const ta = document.getElementById('editor-textarea'); const lh = parseFloat(getComputedStyle(ta).lineHeight);
  const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  const line = ta.value.slice(0, ta.selectionStart).split('\\n').length - 1;
  const top = 16 + line * lh;
  return { sel, start: ta.selectionStart, line, scrollTop: ta.scrollTop, visible: top >= ta.scrollTop - 1 && top + lh <= ta.scrollTop + ta.clientHeight + 1, counter: document.getElementById('search-counter').textContent, focus: document.activeElement.id, scrollLeft: ta.scrollLeft, clientWidth: ta.clientWidth };`);

async function main() {
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400, height: 900 });
  await h.eval(`localStorage.clear()`);
  await h.send('Page.reload');
  await h.sleep(1800);

  console.log('RF-44 · vista previa (sin cambios)');
  await ctrlF(h);
  ok('en modo lectura el selector de objetivo no se ve', await h.eval(`return document.getElementById('search-target').classList.contains('hidden')`));
  await type(h, 'time');
  let preview = await h.eval(`return { marks: document.querySelectorAll('mark.search-highlight').length, counter: document.getElementById('search-counter').textContent }`);
  ok('la búsqueda en la vista previa resalta y cuenta como siempre', preview.marks === expectedCount && preview.counter === `1/${expectedCount}`, JSON.stringify(preview));
  await h.key('Escape', 'Escape', 27);
  await h.sleep(150);

  console.log('RF-44 · en el editor');
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(900);
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(0, 0);`);
  await ctrlF(h);
  const ui = await h.eval(`return { open: !document.getElementById('search-modal').classList.contains('hidden'), bar: !document.getElementById('search-target').classList.contains('hidden'), active: document.querySelector('#search-target .active')?.dataset.target }`);
  ok('con el foco en el editor, Ctrl+F abre el panel con el objetivo «Editor» y el selector visible', ui.open && ui.bar && ui.active === 'editor', JSON.stringify(ui));
  await type(h, 'Time');
  let e = await editor(h);
  ok('selecciona la primera coincidencia en el texto fuente', e.sel.toLowerCase() === 'time' && e.line === 8, JSON.stringify(e));
  ok(`el contador dice 1/${expectedCount} (el total coincide con el recuento independiente)`, e.counter === `1/${expectedCount}`, e.counter);
  ok('la coincidencia queda a la vista aunque el foco siga en el campo de búsqueda', e.visible && e.focus === 'search-input', JSON.stringify(e));
  ok('en el editor NO hay marcas en la vista previa', (await h.eval(`return document.querySelectorAll('mark.search-highlight').length`)) === 0);
  if (shot) await h.screenshot(`${shot}/search-editor.png`);

  const before = e.start;
  await h.key('Enter', 'Enter', 13);
  await h.sleep(150);
  e = await editor(h);
  ok('Enter pasa a la siguiente coincidencia y la deja a la vista', e.start > before && e.sel.toLowerCase() === 'time' && e.visible && e.counter === `2/${expectedCount}`, JSON.stringify(e));
  await h.key('Enter', 'Enter', 13, 8); // Shift
  await h.sleep(150);
  e = await editor(h);
  ok('Mayús+Enter vuelve a la anterior', e.start === before && e.counter === `1/${expectedCount}`, JSON.stringify(e));
  await h.key('Enter', 'Enter', 13, 8);
  await h.sleep(150);
  e = await editor(h);
  ok('Mayús+Enter en la primera da la vuelta a la última', e.counter === `${expectedCount}/${expectedCount}` && e.visible, JSON.stringify(e));
  await h.key('Enter', 'Enter', 13);
  await h.sleep(150);
  e = await editor(h);
  ok('Enter en la última da la vuelta a la primera', e.counter === `1/${expectedCount}`, JSON.stringify(e));

  console.log('RF-44 · el resaltado de la coincidencia actual (plan B: la selección inactiva no se ve)');
  const HIT = (q) => `
    const ta = document.getElementById('editor-textarea'); const hit = document.getElementById('editor-hit'); const layer = document.getElementById('editor-hit-layer');
    const cs = getComputedStyle(ta);
    // Verdad independiente: un div espejo con el mismo texto, fuente y relleno, medido por el motor de maquetación.
    const idx = ta.selectionStart; const lineStart = ta.value.lastIndexOf('\\n', idx - 1) + 1;
    const mirror = document.createElement('div');
    mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:0;top:0;padding:0;margin:0;border:0;font:' + cs.font;
    const span = document.createElement('span'); span.textContent = ta.value.slice(idx, ta.selectionEnd);
    mirror.append(document.createTextNode(ta.value.slice(lineStart, idx)), span); document.body.appendChild(mirror);
    const m = mirror.getBoundingClientRect(); const s = span.getBoundingClientRect();
    const truth = { left: s.left - m.left, width: s.width }; mirror.remove();
    const hr = hit.getBoundingClientRect(); const lr = layer.getBoundingClientRect(); const tr = ta.getBoundingClientRect();
    const line = ta.value.slice(0, idx).split(String.fromCharCode(10)).length - 1; const lh = parseFloat(cs.lineHeight);
    return { shown: !layer.hidden, hitLeft: hr.left - lr.left, hitWidth: hr.width, truth, hitTop: hr.top - lr.top, expectedTop: parseFloat(cs.paddingTop) + line * lh - ta.scrollTop, padLeft: parseFloat(cs.paddingLeft), scrollLeft: ta.scrollLeft, inside: hr.bottom > tr.top && hr.top < tr.bottom };`;
  await ctrlF(h);
  await type(h, 'time');
  let hit = await h.eval(HIT());
  ok('la capa de resaltado está visible sobre la coincidencia actual', hit.shown && hit.inside, JSON.stringify(hit));
  ok('su posición y su ancho coinciden con la medida independiente (±1,5 px)', Math.abs(hit.hitLeft - (hit.padLeft + hit.truth.left - hit.scrollLeft)) <= 1.5 && Math.abs(hit.hitWidth - hit.truth.width) <= 1.5 && Math.abs(hit.hitTop - hit.expectedTop) <= 1.5, JSON.stringify(hit));
  if (shot) await h.screenshot(`${shot}/search-editor-hit.png`);
  await type(h, 'Time 시간');
  hit = await h.eval(HIT());
  ok('en una línea con coreano (caracteres que no son de ancho fijo) también coincide (±1,5 px)', hit.shown && Math.abs(hit.hitLeft - (hit.padLeft + hit.truth.left - hit.scrollLeft)) <= 1.5 && Math.abs(hit.hitWidth - hit.truth.width) <= 1.5, JSON.stringify(hit));
  await h.eval(`window.DBVApp.editorZoomStep(3)`);
  await h.sleep(500);
  hit = await h.eval(HIT());
  ok('al cambiar el tamaño de letra del editor el resaltado se vuelve a colocar', hit.shown && Math.abs(hit.hitWidth - hit.truth.width) <= 1.5, JSON.stringify(hit));
  await h.eval(`window.DBVApp.editorZoomReset()`);
  await type(h, 'time');
  await h.eval(`document.getElementById('editor-textarea').scrollTop += 40`);
  await h.sleep(150);
  hit = await h.eval(HIT());
  ok('al hacer scroll el resaltado sigue a su coincidencia', Math.abs(hit.hitTop - hit.expectedTop) <= 1.5, JSON.stringify(hit));
  await h.key('Escape', 'Escape', 27);
  await h.sleep(250);
  ok('al cerrar el panel el resaltado desaparece', await h.eval(`return document.getElementById('editor-hit-layer').hidden`));
  await h.eval(`document.getElementById('editor-textarea').focus()`);
  await ctrlF(h);
  await type(h, 'Time');
  await h.eval(`document.getElementById('editor-textarea').focus(); document.execCommand('insertText', false, 'x')`);
  await h.sleep(200);
  ok('si se teclea en el editor el resaltado (ya desfasado) desaparece', await h.eval(`return document.getElementById('editor-hit-layer').hidden`));
  await h.eval(`document.execCommand('undo')`);
  await h.key('Escape', 'Escape', 27);
  await h.sleep(200);

  console.log('RF-44 · no modifica el documento');
  const untouched = await h.eval(`return { same: document.getElementById('editor-textarea').value === ${JSON.stringify(doc)}, badge: document.getElementById('doc-modified-badge').classList.contains('hidden'), writes: window.__calls.filter((c) => c[0] === 'write_file').length }`);
  ok('ni «Modificado», ni cambios en el texto, ni escritura', untouched.same && untouched.badge && untouched.writes === 0, JSON.stringify(untouched));
  const undone = await h.eval(`document.getElementById('editor-textarea').focus(); const before = document.getElementById('editor-textarea').value; const did = document.execCommand('undo'); return { did, same: document.getElementById('editor-textarea').value === before }`);
  ok('Ctrl+Z no tiene nada que deshacer por culpa de la búsqueda', undone.same, JSON.stringify(undone));

  console.log('RF-44 · línea larga: la coincidencia se deja a la vista en horizontal');
  await ctrlF(h);
  await type(h, 'ZZTOP');
  e = await editor(h);
  const cw = await h.eval(`const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(document.getElementById('editor-textarea')).font; return c.measureText('0').width`);
  const left = 351 * cw + 16; // ~columna del texto + relleno
  ok('selecciona ZZTOP y desplaza en horizontal hasta verlo', e.sel === 'ZZTOP' && e.scrollLeft > 0 && left >= e.scrollLeft && left <= e.scrollLeft + e.clientWidth, JSON.stringify(e));

  console.log('RF-44 · selector con el ratón y Escape');
  await type(h, 'time');
  await h.eval(`document.querySelector('#search-target [data-target="preview"]').click()`);
  await h.sleep(250);
  preview = await h.eval(`return { marks: document.querySelectorAll('mark.search-highlight').length, active: document.querySelector('#search-target .active').dataset.target, counter: document.getElementById('search-counter').textContent }`);
  ok('cambiar a «Vista previa» busca allí (marcas y contador)', preview.active === 'preview' && preview.marks === expectedCount, JSON.stringify(preview));
  await h.eval(`document.querySelector('#search-target [data-target="editor"]').click()`);
  await h.sleep(700); // el scroll se asienta y, si hace falta, se recoloca una vez (~280 ms)
  e = await editor(h);
  ok('volver a «Editor» quita las marcas de la vista previa, selecciona en el texto y lo deja a la vista', (await h.eval(`return document.querySelectorAll('mark.search-highlight').length`)) === 0 && e.sel.toLowerCase() === 'time' && e.visible, JSON.stringify(e));
  await h.eval(`document.getElementById('search-input').focus()`);
  await h.key('Escape', 'Escape', 27);
  await h.sleep(250);
  e = await h.eval(`const ta = document.getElementById('editor-textarea'); return { closed: document.getElementById('search-modal').classList.contains('hidden'), focus: document.activeElement.id, selected: ta.selectionEnd > ta.selectionStart }`);
  ok('Escape cierra el panel y devuelve el foco al editor con la coincidencia seleccionada', e.closed && e.focus === 'editor-textarea' && e.selected, JSON.stringify(e));

  console.log('RF-44 · con el foco fuera del editor busca en la vista previa');
  await h.eval(`document.activeElement.blur(); document.body.focus()`);
  await ctrlF(h);
  const out = await h.eval(`return document.querySelector('#search-target .active').dataset.target`);
  ok('Ctrl+F con el foco fuera del editor (aunque haya Modo Edición) elige la vista previa', out === 'preview', out);
  await h.key('Escape', 'Escape', 27);
  await h.sleep(150);

  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

async function big() {
  console.log('RF-44 · rendimiento con 5.000 líneas');
  const bigDoc = Array.from({ length: 5000 }, (_, i) => `Línea ${i} con la palabra Time de relleno y algo más de texto`).join('\n');
  const h = await launch({ appDir, docPath: 'C:/x/big.md', docContent: bigDoc, width: 1400, height: 900 });
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(2500);
  await h.eval(`document.getElementById('editor-textarea').focus()`);
  await ctrlF(h);
  const ms = await h.eval(`const i = document.getElementById('search-input'); const times = []; for (const q of ['t', 'ti', 'tim', 'time']) { i.value = q; const t0 = performance.now(); i.dispatchEvent(new Event('input', { bubbles: true })); times.push(performance.now() - t0); } return { times, counter: document.getElementById('search-counter').textContent };`);
  ok('cada pulsación se resuelve en menos de 100 ms', ms.times.every((t) => t < 100) && /^1\/5000$/.test(ms.counter), JSON.stringify(ms));
  await h.close();
}

await main();
await big();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
