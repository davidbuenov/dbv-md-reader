// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Reordenar secciones arrastrando desde el Índice (RF-45) en el motor Chromium de WebView2, con eventos de arrastre
// reales (DragEvent + DataTransfer) y teclas reales para deshacer: solo en Modo Edición, indicador de posición, una sola
// edición con UN Ctrl+Z que restaura texto y cursor (y Ctrl+Y que la rehace), la sección viaja con sus subsecciones y su
// bloque de código con «#», no se puede soltar dentro de sí misma, el texto esperado se calcula aquí con cadenas (no con
// outline.js), Alt+↑/↓, el Índice obsoleto tras teclear (se cancela en vez de mover otra sección), la cancelación si el
// texto cambió durante el arrastre y el rendimiento (insertText multilínea tardaba 129 s con 3.000 líneas).
//
// @spec RF-45

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');

// Cada bloque es un texto completo; el documento es su concatenación (así el esperado se calcula sin leer el código).
const alfa = ['# Alfa', 'texto alfa', '', '## Alfa.1', 'uno', '', '## Alfa.2', 'dos', ''].join('\n') + '\n';
const alfa1 = ['## Alfa.1', 'uno', ''].join('\n') + '\n';
const alfa2 = ['## Alfa.2', 'dos', ''].join('\n') + '\n';
const alfaIntro = ['# Alfa', 'texto alfa', ''].join('\n') + '\n';
const beta = ['# Beta', '```', '# no soy un encabezado', '```', 'texto beta', ''].join('\n') + '\n';
const gamma = ['# Gamma', 'texto gamma', ''].join('\n') + '\n';
const doc = alfa + beta + gamma;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const value = (h) => h.eval(`return document.getElementById('editor-textarea').value`);
const entries = (h) => h.eval(`return Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')).map((a) => a.textContent)`);
const CTRL = 2;
const undo = async (h) => { await h.key('z', 'KeyZ', 90, CTRL); await h.sleep(200); };
const redo = async (h) => { await h.key('y', 'KeyY', 89, CTRL); await h.sleep(200); };

/** Arrastra la entrada `from` y la suelta sobre la entrada `over` (mitad superior o inferior); devuelve el estado del indicador. */
const drag = (h, from, over, half, { release = true } = {}) => h.eval(`
  const links = Array.from(document.querySelectorAll('#toc-list a[data-toc-index]'));
  const mk = (type, el, y) => { const dt = window.__dt; const r = el.getBoundingClientRect(); return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: y !== undefined ? y : r.top + r.height / 2 }); };
  window.__dt = new DataTransfer();
  const src = links[${from}], dst = links[${over}];
  const start = mk('dragstart', src); src.dispatchEvent(start);
  if (start.defaultPrevented) return { cancelled: true };
  const rect = dst.getBoundingClientRect();
  const y = '${half}' === 'top' ? rect.top + 2 : rect.bottom - 2;
  const ev = mk('dragover', dst, y); dst.dispatchEvent(ev);
  const ind = document.getElementById('toc-drop-indicator');
  const state = { prevented: ev.defaultPrevented, shown: !ind.hidden, invalid: ind.classList.contains('invalid') };
  ${release ? `dst.dispatchEvent(mk('drop', dst, y)); src.dispatchEvent(mk('dragend', src));` : ''}
  return state;`);

async function main() {
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400, height: 900 });
  await h.eval(`localStorage.clear()`);
  await h.send('Page.reload');
  await h.sleep(1800);

  console.log('RF-45 · solo en Modo Edición');
  ok('las entradas del Índice son: Alfa, Alfa.1, Alfa.2, Beta, Gamma (el «#» de un bloque de código no cuenta)', JSON.stringify(await entries(h)) === JSON.stringify(['Alfa', 'Alfa.1', 'Alfa.2', 'Beta', 'Gamma']), JSON.stringify(await entries(h)));
  ok('en modo lectura las entradas no son arrastrables', await h.eval(`return Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')).every((a) => a.getAttribute('draggable') === null)`));
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(900);
  ok('en Modo Edición sí lo son, y con una pista', await h.eval(`return Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')).every((a) => a.draggable === true && a.title.length > 5)`));

  console.log('RF-45 · mover una sección');
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(7, 7);`);
  let st = await drag(h, 4, 0, 'top'); // Gamma antes de Alfa
  ok('al arrastrar se muestra el indicador de posición y se permite soltar', st.prevented && st.shown && !st.invalid, JSON.stringify(st));
  await h.sleep(150);
  let v = await value(h);
  ok('Gamma pasa al principio (texto esperado calculado con cadenas)', v === gamma + alfa + beta, JSON.stringify(v.slice(0, 60)));
  ok('queda «Modificado»', await h.eval(`return !document.getElementById('doc-modified-badge').classList.contains('hidden')`));
  await h.sleep(700);
  ok('el Índice se reconstruye con el nuevo orden', JSON.stringify(await entries(h)) === JSON.stringify(['Gamma', 'Alfa', 'Alfa.1', 'Alfa.2', 'Beta']), JSON.stringify(await entries(h)));
  ok('la sección movida queda seleccionada en el editor', await h.eval(`const ta = document.getElementById('editor-textarea'); return ta.value.slice(ta.selectionStart, ta.selectionEnd) === '# Gamma'`));
  await undo(h);
  v = await value(h);
  const sel = await h.eval(`const ta = document.getElementById('editor-textarea'); return [ta.selectionStart, ta.selectionEnd]`);
  ok('UN solo Ctrl+Z deja el texto exactamente como estaba', v === doc, JSON.stringify(v.slice(0, 40)));
  ok('…y el cursor donde estaba antes del movimiento', sel[0] === 7 && sel[1] === 7, JSON.stringify(sel));
  ok('…y deja de estar «Modificado» (vuelve al contenido guardado)', await h.eval(`return document.getElementById('doc-modified-badge').classList.contains('hidden')`));
  await redo(h);
  ok('Ctrl+Y lo rehace', (await value(h)) === gamma + alfa + beta);
  await undo(h);
  await h.sleep(600);

  st = await drag(h, 0, 4, 'bottom'); // Alfa (con sus dos subsecciones) al final
  await h.sleep(150);
  v = await value(h);
  ok('una sección con subsecciones viaja entera (Alfa con Alfa.1 y Alfa.2 al final)', v === beta + gamma + alfa, JSON.stringify(v.slice(0, 40)));
  await undo(h);
  await h.sleep(600);

  st = await drag(h, 3, 4, 'bottom'); // Beta después de Gamma
  await h.sleep(150);
  v = await value(h);
  ok('Beta, con su bloque de código que contiene «#», viaja entera tras Gamma', v === alfa + gamma + beta && v.includes('```\n# no soy un encabezado\n```'), JSON.stringify(v.slice(-80)));
  await undo(h);
  await h.sleep(600);

  console.log('RF-45 · soltar donde no vale');
  st = await drag(h, 0, 2, 'top', { release: false }); // Alfa sobre su propia subsección
  ok('dentro de su propia sección el indicador sale en rojo', st.shown && st.invalid, JSON.stringify(st));
  await h.eval(`const links = Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')); const dt = window.__dt; links[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: links[2].getBoundingClientRect().top + 2 })); links[0].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));`);
  await h.sleep(150);
  ok('soltarla ahí no cambia el texto', (await value(h)) === doc);
  await drag(h, 3, 3, 'top'); // Beta sobre sí misma: no-op
  await h.sleep(150);
  ok('soltarla donde ya está tampoco', (await value(h)) === doc);
  ok('tras un arrastre cancelado no queda el indicador ni la marca de arrastre', await h.eval(`return document.getElementById('toc-drop-indicator').hidden && !document.querySelector('.toc-dragging')`));

  console.log('RF-45 · Alt+↑ / Alt+↓');
  await h.eval(`document.querySelector('#toc-list a[data-toc-index="1"]').focus()`);
  await h.key('ArrowDown', 'ArrowDown', 40, 1); // Alt
  await h.sleep(500);
  v = await value(h);
  ok('Alt+↓ sobre Alfa.1 la baja tras su hermana Alfa.2', v === alfaIntro + alfa2 + alfa1 + beta + gamma, JSON.stringify(v.slice(0, 80)));
  ok('el foco vuelve a la entrada de la sección movida', await h.eval(`return document.activeElement.textContent === 'Alfa.1' && document.activeElement.dataset.tocIndex === '2'`), await h.eval(`return document.activeElement.textContent + '/' + document.activeElement.dataset.tocIndex`));
  await h.key('ArrowUp', 'ArrowUp', 38, 1);
  await h.sleep(500);
  v = await value(h);
  ok('Alt+↑ la devuelve y el texto vuelve a ser el original', v === doc, JSON.stringify(v.slice(0, 80)));
  await h.eval(`document.querySelector('#toc-list a[data-toc-index="1"]').focus()`);
  await h.key('ArrowUp', 'ArrowUp', 38, 1);
  await h.sleep(250);
  ok('la primera hermana no se puede subir (no cambia nada)', (await value(h)) === doc);

  console.log('RF-45 · escribir descarta el deshacer del movimiento, y render pendiente');
  await drag(h, 4, 0, 'top');
  await h.sleep(200);
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); document.execCommand('insertText', false, 'zz');`);
  const typed = await value(h);
  await undo(h); // el deshacer del movimiento ya no vale: manda el nativo (que tras setRangeText está vacío)
  ok('tras teclear, Ctrl+Z ya no restaura el texto de antes del movimiento', (await value(h)) !== doc, JSON.stringify((await value(h)).slice(0, 30)));
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value = ${JSON.stringify(doc)}; ta.dispatchEvent(new Event('input', { bubbles: true }));`);
  await h.sleep(700);

  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(0, 0); document.execCommand('insertText', false, '# Cero\\n\\ntexto cero\\n\\n');`);
  // sin esperar al debounce de 400 ms: el Índice que se ve es el ANTERIOR (5 entradas) y no el de ahora (6)
  st = await drag(h, 4, 0, 'top');
  await h.sleep(250);
  const cero = '# Cero\n\ntexto cero\n\n';
  ok('arrastrar con un render pendiente se cancela (no mueve otra sección) y deja el Índice al día', st.cancelled === true && (await value(h)) === cero + doc && JSON.stringify(await entries(h)) === JSON.stringify(['Cero', 'Alfa', 'Alfa.1', 'Alfa.2', 'Beta', 'Gamma']), JSON.stringify(await entries(h)));
  st = await drag(h, 5, 0, 'top'); // ahora sí: Gamma antes de Cero
  await h.sleep(200);
  v = await value(h);
  ok('repetido con el Índice ya al día mueve la sección correcta', v === gamma + cero + alfa + beta, JSON.stringify(v.slice(0, 70)));
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value = ${JSON.stringify(doc)}; ta.dispatchEvent(new Event('input', { bubbles: true }));`);
  await h.sleep(700);

  st = await drag(h, 4, 0, 'top', { release: false });
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(0, 0); document.execCommand('insertText', false, 'x');`);
  await h.eval(`const links = Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')); const dt = window.__dt; links[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: links[0].getBoundingClientRect().top + 2 }));`);
  await h.sleep(250);
  v = await value(h);
  ok('si el texto cambió durante el arrastre, el movimiento se cancela y avisa', v === 'x' + doc && (await h.eval(`return document.getElementById('app-toast') && /No se pudo mover/.test(document.getElementById('app-toast').textContent)`)), JSON.stringify(v.slice(0, 20)));

  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close(); // el segundo Edge de abajo usa el mismo puerto de depuración: el primero tiene que haberse cerrado

  console.log('RF-45 · rendimiento');
  const big = Array.from({ length: 150 }, (_, i) => [`## Sección ${i}`, '', ...Array.from({ length: 18 }, (_, k) => `línea ${i}.${k}`), ''].join('\n') + '\n').join('');
  const h2 = await launch({ appDir, docPath: 'C:/x/big.md', docContent: big, width: 1400, height: 900 });
  await h2.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h2.sleep(2500);
  const t = await h2.eval(`const links = Array.from(document.querySelectorAll('#toc-list a[data-toc-index]')); const dt = new DataTransfer(); window.__dt = dt;
    const mk = (type, el, y) => new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y });
    const t0 = performance.now();
    links[149].dispatchEvent(mk('dragstart', links[149], 0));
    const r = links[0].getBoundingClientRect(); links[0].dispatchEvent(mk('dragover', links[0], r.top + 2)); links[0].dispatchEvent(mk('drop', links[0], r.top + 2));
    return { ms: Math.round(performance.now() - t0), first: document.getElementById('editor-textarea').value.slice(0, 20) };`);
  ok('mover la última sección al principio de un documento de ~3.000 líneas tarda menos de 300 ms (con insertText eran 129 s)', t.ms < 300 && t.first.startsWith('## Sección 149'), JSON.stringify(t));
  await h2.key('z', 'KeyZ', 90, CTRL);
  await h2.sleep(300);
  ok('y su Ctrl+Z restaura el documento entero', (await h2.eval(`return document.getElementById('editor-textarea').value`)) === big);
  await h2.close();

}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
