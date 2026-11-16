// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Modo Vim en el editor (RF-51) sobre el motor Chromium de WebView2, con teclas reales (CDP): apagado no cambia
// nada; encendido arranca en NORMAL, los modos cambian la insignia, las órdenes no escriben en el documento,
// `u` deshace una sesión de Insertar entera, `:w` guarda, Ctrl+S sigue siendo de la app, Esc en Insertar no cierra
// el panel de búsqueda (en Normal sí), el cursor de bloque se pinta, y cada tecla con 5.000 líneas va en < 16 ms.
//
// @spec RF-51

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'uno dos tres', 'cuatro cinco', 'seis'].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

/** Una tecla imprimible como la manda el teclado: keyDown con `text` (si nadie lo impide, se escribe). */
async function type(h, str) {
  for (const ch of str) {
    await h.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
    await h.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
  await h.sleep(40);
}
const esc = async (h) => { await h.key('Escape', 'Escape', 27); await h.sleep(40); };
const enter = async (h) => { await h.key('Enter', 'Enter', 13); await h.sleep(40); };
const value = (h) => h.eval(`return document.getElementById('editor-textarea').value`);
const caret = (h) => h.eval(`return document.getElementById('editor-textarea').selectionStart`);
const badge = (h) => h.eval(`const b = document.getElementById('editor-status-vim'); return b.classList.contains('hidden') ? '' : b.textContent`);
const writes = (h) => h.eval(`return (window.__calls || []).filter((c) => c[0] === 'write_file').length`);
const focusAt = (h, offset) => h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(${offset}, ${offset})`);

async function main() {
  console.log('RF-51 · apagado (por defecto)');
  const h = await launch({ appDir, docPath: 'C:/x/vim.md', docContent: doc, width: 1400 });
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  ok('desactivado por defecto y sin insignia', (await h.eval(`return window.DBVPrefs.vimMode.get()`)) === false && (await badge(h)) === '');
  await focusAt(h, 0); await type(h, 'j');
  ok('con Vim apagado «j» se escribe como siempre', (await value(h)).startsWith('j# Título'), JSON.stringify((await value(h)).slice(0, 12)));
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value = ${JSON.stringify(doc)}; ta.dispatchEvent(new Event('input'))`);

  console.log('RF-51 · encendido');
  await h.eval(`document.getElementById('btn-prefs-menu').click()`); await h.sleep(150);
  const item = await h.eval(`const e = document.querySelector('#prefs-menu [data-pref="vimMode"]'); return { disabled: e.disabled, checked: e.getAttribute('aria-checked') }`);
  ok('Preferencias ▸ Modo Vim ya está habilitada', item.disabled === false && item.checked === 'false', JSON.stringify(item));
  await h.eval(`document.querySelector('#prefs-menu [data-pref="vimMode"]').click()`); await h.sleep(150);
  ok('la casilla lo enciende y se guarda', await h.eval(`return window.DBVPrefs.vimMode.get() === true && localStorage.getItem('dbv-md-vim') === '1'`));
  await h.eval(`document.getElementById('btn-prefs-menu').click()`); await h.sleep(100);
  // Salir y volver a entrar en Modo Edición: arranca en NORMAL.
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(300);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  ok('al entrar en Modo Edición: NORMAL', (await badge(h)) === 'NORMAL', await badge(h));
  await focusAt(h, 0); await h.sleep(80);
  ok('cursor de bloque visible', await h.eval(`const l = document.getElementById('editor-vim-layer'); const c = document.getElementById('editor-vim-cursor'); return !l.hidden && c.offsetWidth >= 2 && c.offsetHeight > 8`));

  await type(h, 'jj');
  ok('«jj» mueve el cursor a la línea 3 sin escribir', (await value(h)) === doc && (await caret(h)) === doc.indexOf('uno'), String(await caret(h)));
  await type(h, 'w');
  ok('«w» va a la palabra siguiente', (await caret(h)) === doc.indexOf('dos'));
  await type(h, 'dw');
  ok('«dw» borra la palabra', (await value(h)).includes('uno tres'));
  await type(h, 'u');
  ok('«u» lo deshace', (await value(h)) === doc);

  await type(h, 'i');
  ok('«i»: INSERT', (await badge(h)) === 'INSERT');
  ok('en Insertar no hay cursor de bloque', await h.eval(`return document.getElementById('editor-vim-layer').hidden`));
  await type(h, 'XY');
  ok('en Insertar se escribe', (await value(h)).includes('uno XYdos'));
  await esc(h);
  ok('Esc: NORMAL y el cursor retrocede uno', (await badge(h)) === 'NORMAL' && (await caret(h)) === doc.indexOf('dos') + 1, String(await caret(h)));
  await type(h, 'u');
  ok('«u» deshace la sesión de Insertar entera', (await value(h)) === doc);
  await type(h, '<');
  await esc(h);

  await type(h, 'v');
  ok('«v»: VISUAL', (await badge(h)) === 'VISUAL');
  await type(h, 'e');
  ok('en Visual la selección se ve en el textarea', await h.eval(`const ta = document.getElementById('editor-textarea'); return ta.selectionEnd - ta.selectionStart === 3`));
  await type(h, 'V');
  ok('«V»: V-LINE', (await badge(h)) === 'V-LINE');
  await esc(h);
  ok('Esc vuelve a NORMAL', (await badge(h)) === 'NORMAL');

  console.log('RF-51 · órdenes y atajos de la app');
  const before = await writes(h);
  await type(h, 'x'); await type(h, ':w');
  ok('la línea de órdenes se ve en la barra', (await h.eval(`return document.getElementById('editor-status-cmd').textContent`)) === ':w');
  await enter(h); await h.sleep(200);
  ok('«:w» guarda (write_file)', (await writes(h)) === before + 1, `${before} → ${await writes(h)}`);
  await type(h, 'x');
  await h.key('s', 'KeyS', 83, 2); await h.sleep(200);
  ok('Ctrl+S sigue siendo de la app en NORMAL', (await writes(h)) === before + 2);
  await type(h, ':foo'); await enter(h);
  ok('orden desconocida: aviso en la barra', /foo/.test(await h.eval(`return document.getElementById('editor-status-msg').textContent`)));

  console.log('RF-51.6 · Esc y paneles');
  await h.eval(`window.DBVApp && document.getElementById('btn-search').click()`); await h.sleep(200);
  ok('panel de búsqueda abierto', await h.eval(`return !document.getElementById('search-modal').classList.contains('hidden')`));
  await focusAt(h, 0); await type(h, 'i'); await esc(h);
  ok('Esc en Insertar NO cierra el panel de búsqueda', await h.eval(`return !document.getElementById('search-modal').classList.contains('hidden')`));
  await type(h, 'v'); await esc(h);
  ok('Esc en Visual tampoco', await h.eval(`return !document.getElementById('search-modal').classList.contains('hidden')`));
  await esc(h);
  ok('Esc en NORMAL sí lo cierra (como hasta ahora)', await h.eval(`return document.getElementById('search-modal').classList.contains('hidden')`));

  console.log('RF-51.9 · latencia con 5.000 líneas');
  const big = Array.from({ length: 5000 }, (_, i) => `línea ${i} con (algo) de texto, más palabras`).join('\n');
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value = ${JSON.stringify(big)}; ta.dispatchEvent(new Event('input')); ta.focus(); ta.setSelectionRange(${Math.floor(big.length / 2)}, ${Math.floor(big.length / 2)})`);
  await h.sleep(200);
  // Movimientos: la tecla entera (núcleo + adaptador). Ediciones: el `input` de la app (números de línea, sucio,
  // guardado automático…) cuesta decenas de ms con 5.000 líneas también SIN Vim (medido 41–57 ms, hallazgo previo
  // a esta rebanada); lo que se exige a Vim es no añadir nada apreciable sobre esa edición nativa.
  const lat = await h.eval(`
    const ta = document.getElementById('editor-textarea'); let motion = 0; const edits = [];
    const press = (key) => { const t0 = performance.now(); ta.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); return performance.now() - t0; };
    for (const key of ['j', 'k', 'w', 'b', 'e', '$', '0', '}', '{', 'G', 'g', 'g', 'j', '%', 'n']) motion = Math.max(motion, press(key));
    for (const key of ['x', 'x', 'u', 'u', 'x', 'p']) edits.push(press(key));
    window.DBVPrefs.vimMode.set(false);
    const p = ta.selectionStart; const native = [];
    for (let i = 0; i < 6; i++) { const t0 = performance.now(); ta.setRangeText(i % 2 ? 'z' : 'y', p, p + 1); ta.dispatchEvent(new Event('input', { bubbles: true })); native.push(performance.now() - t0); }
    window.DBVPrefs.vimMode.set(true);
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    return { motion, edit: med(edits), native: med(native) };`);
  ok('cada movimiento en Normal (adaptador incluido) < 16 ms', lat.motion < 16, lat.motion.toFixed(2) + ' ms');
  ok('una edición de Vim no cuesta más que la misma edición nativa (+30 % o 5 ms)', lat.edit <= lat.native * 1.3 + 5,
    `Vim ${lat.edit.toFixed(1)} ms · nativa ${lat.native.toFixed(1)} ms`);

  await h.eval(`window.DBVPrefs.vimMode.set(false)`); await h.sleep(80);
  ok('al apagarlo desaparecen la insignia y el cursor de bloque', (await badge(h)) === '' && await h.eval(`return document.getElementById('editor-vim-layer').hidden`));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
