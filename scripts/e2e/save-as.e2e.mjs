// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Archivo ▸ Guardar como… (RF-64) sobre el motor Chromium de WebView2: la entrada va debajo de Guardar y
// se deshabilita sin documento; en Modo Edición escribe el texto del editor en la ruta elegida, la ventana
// pasa a ese fichero y el original no recibe ninguna escritura; en Modo Lectura escribe lo leído; cancelar
// no escribe nada; Ctrl+Mayús+S abre el diálogo y Ctrl+S sigue guardando sin él.
//
// @spec RF-64

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const ORIG = 'C:/x/test.md';
const doc = ['# Título', '', 'Párrafo.', ''].join('\n');
// Sistema de ficheros de mentira: lo escrito se puede volver a leer, y el diálogo devuelve `window.__dialogPath`.
const customInvoke = `((cmd, args) => {
  window.__fs = window.__fs || {};
  if (cmd === 'save_new_file_dialog') return window.__dialogPath === undefined ? null : window.__dialogPath;
  if (cmd === 'write_file') { window.__fs[args.path] = args.content; return null; }
  if (cmd === 'read_file' && window.__fs[args.path] !== undefined) {
    const p = args.path; const i = p.lastIndexOf('/');
    return { path: p, content: window.__fs[p], dir_path: p.slice(0, i), file_name: p.slice(i + 1) };
  }
  return undefined;
})`;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const writes = (h) => h.eval(`return window.__calls.filter((c) => c[0] === 'write_file').map((c) => c[1].path)`);
const dialogs = (h) => h.eval(`return window.__calls.filter((c) => c[0] === 'save_new_file_dialog').length`);
const openFile = async (h) => { await h.eval(`document.getElementById('btn-file-menu').click()`); await h.sleep(120); };

async function main() {
  console.log('RF-64 · Guardar como…');
  const h = await launch({ appDir, docPath: ORIG, docContent: doc, customInvoke, width: 1400 });

  await openFile(h);
  const pos = await h.eval(`const items = Array.from(document.querySelectorAll('#file-menu .menu-item')); const i = items.findIndex((e) => e.dataset.action === 'saveAs'); return { i, prev: i > 0 ? items[i - 1].dataset.target : null, disabled: i >= 0 && items[i].disabled, keys: i >= 0 ? items[i].querySelector('.menu-item__keys').textContent : '' }`);
  ok('la entrada va justo debajo de Guardar, habilitada, con Ctrl+Mayús+S', pos.i >= 0 && pos.prev === 'btn-save' && !pos.disabled && pos.keys === 'Ctrl+Mayús+S', JSON.stringify(pos));

  // Cancelar: nada se escribe.
  await h.eval(`window.__dialogPath = undefined; document.querySelector('#file-menu [data-action="saveAs"]').click()`); await h.sleep(400);
  ok('cancelar el diálogo no escribe nada', (await dialogs(h)) === 1 && (await writes(h)).length === 0);

  // Modo Lectura: escribe lo leído y la ventana pasa al fichero nuevo.
  await openFile(h);
  await h.eval(`window.__dialogPath = 'C:/y/copia.md'; document.querySelector('#file-menu [data-action="saveAs"]').click()`); await h.sleep(800);
  const r = await h.eval(`return { fs: window.__fs['C:/y/copia.md'], crumb: document.getElementById('doc-breadcrumb').title, edit: document.getElementById('reader-container').classList.contains('edit-mode') }`);
  ok('en Modo Lectura escribe el documento tal como se leyó', r.fs === doc, JSON.stringify(r.fs));
  ok('la ventana pasa a mostrar el fichero nuevo, en Modo Lectura', r.crumb === 'C:/y/copia.md' && r.edit === false, JSON.stringify(r));

  // Modo Edición con cambios sin guardar: van solo al fichero nuevo y el modo se conserva.
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  await h.eval(`const ta = document.getElementById('editor-textarea') || document.querySelector('#reader-container textarea'); ta.value = ta.value + '\\nLínea nueva.'; ta.dispatchEvent(new Event('input', { bubbles: true }))`); await h.sleep(300);
  const before = (await writes(h)).length;
  await h.eval(`window.__dialogPath = 'C:/z/otra.md'`);
  await h.key('S', 'KeyS', 83, 10); await h.sleep(900);
  const e = await h.eval(`return { fs: window.__fs['C:/z/otra.md'], copia: window.__fs['C:/y/copia.md'], crumb: document.getElementById('doc-breadcrumb').title, edit: document.getElementById('reader-container').classList.contains('edit-mode'), modified: !document.getElementById('doc-modified-badge').classList.contains('hidden') }`);
  const after = await writes(h);
  ok('Ctrl+Mayús+S abre el diálogo', (await dialogs(h)) === 3);
  ok('en Modo Edición escribe el texto del editor, con los cambios sin guardar', typeof e.fs === 'string' && e.fs.endsWith('Línea nueva.'), JSON.stringify(e.fs));
  ok('el documento anterior no recibe ninguna escritura', after.length === before + 1 && after.at(-1) === 'C:/z/otra.md' && !e.copia.includes('Línea nueva.'), after.join(','));
  ok('la ventana pasa al fichero nuevo, sigue en Modo Edición y sin «Modificado»', e.crumb === 'C:/z/otra.md' && e.edit && !e.modified, JSON.stringify(e));

  // Ctrl+S sigue guardando sin diálogo, en la ruta nueva.
  await h.eval(`const ta = document.getElementById('editor-textarea') || document.querySelector('#reader-container textarea'); ta.value = ta.value + '\\nOtra.'; ta.dispatchEvent(new Event('input', { bubbles: true }))`); await h.sleep(300);
  await h.key('s', 'KeyS', 83, 2); await h.sleep(500);
  ok('Ctrl+S guarda sin abrir el diálogo, en la ruta nueva', (await dialogs(h)) === 3 && (await writes(h)).at(-1) === 'C:/z/otra.md');
  ok('el original nunca se escribió', !(await writes(h)).includes(ORIG));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

async function noDocument() {
  console.log('RF-64 · sin documento abierto');
  const h = await launch({ appDir, docPath: ORIG, docContent: doc, customInvoke: `((cmd) => cmd === 'get_cli_argument' ? null : undefined)` });
  await openFile(h);
  ok('sin documento, «Guardar como…» se deshabilita', await h.eval(`return document.querySelector('#file-menu [data-action="saveAs"]').disabled === true`));
  await h.close();
}

await main();
await noDocument();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
