// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El árbol de Archivos no se enteraba de lo que la app escribía en disco (la carpeta `images/` de una
// imagen pegada) y su clic derecho enseñaba el menú nativo del WebView, cuyo «Actualizar» recarga TODA
// la página. Este banco comprueba: el árbol se relee tras pegar una imagen conservando las carpetas
// expandidas, «Actualizar» del menú propio relee sin recargar, y el menú nativo no sale fuera de los
// campos de texto.
//
// @spec RF-25
// @spec RF-37

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Texto.', ''].join('\n');

// `list_directory` devuelve lo que diga `window.__entries[dir]`; `save_image` simula que Rust crea `images/`.
const customInvoke = `((cmd, args) => {
  if (cmd === 'list_directory') return (window.__entries || {})[args.path || args.dirPath || args.dir] || (window.__entries || {})['*'] || [];
  if (cmd === 'save_image') {
    window.__entries = { '*': [
      { name: 'images', path: 'C:/x/images', is_dir: true, is_markdown: false },
      { name: 'test.md', path: 'C:/x/test.md', is_dir: false, is_markdown: true },
    ] };
    return { path: 'C:/x/images/' + args.fileName, relative: 'images/' + args.fileName, reused: false };
  }
  return undefined;
})`;

const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const names = `[...document.querySelectorAll('#file-tree .tree-name')].map((e) => e.textContent)`;
const listCalls = `window.__calls.filter((c) => c[0] === 'list_directory').length`;

try {
  await h.eval(`window.__entries = { '*': [{ name: 'test.md', path: 'C:/x/test.md', is_dir: false, is_markdown: true }] };`);
  // Se recarga el árbol con la lista inicial (solo test.md).
  await h.eval(`window.DBVFileTree.setActiveTab('files'); await window.DBVFileTree.refresh();`);
  ok('el árbol arranca sin carpeta images', JSON.stringify(await h.eval(`return ${names}`)) === '["test.md"]');

  // ── Pegar una imagen en el editor: aparece images/ sin reabrir ────────────────────────────────
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(600);
  await h.eval(`
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' }));
    const t = document.getElementById('editor-textarea'); t.focus();
    t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 900));`);
  const afterPaste = await h.eval(`return ${names}`);
  ok('tras pegar una imagen, el árbol de Archivos muestra la carpeta images', afterPaste.includes('images'), JSON.stringify(afterPaste));

  // ── Se conservan las carpetas expandidas al refrescar ────────────────────────────────────────
  await h.eval(`window.__entries['C:/x/images'] = [{ name: 'a.png', path: 'C:/x/images/a.png', is_dir: false, is_markdown: false }];
    document.querySelector('#file-tree .tree-row.is-dir').click(); await new Promise((r) => setTimeout(r, 300));`);
  await h.eval(`await window.DBVFileTree.refresh();`);
  const kept = await h.eval(`return { names: ${names}, open: !!document.querySelector('#file-tree .tree-toggle.expanded') }`);
  ok('refrescar conserva la carpeta expandida y su contenido', kept.open && kept.names.includes('a.png'), JSON.stringify(kept));

  // ── Clic derecho en el hueco del panel: menú propio con «Actualizar», sin el nativo ───────────
  const before = await h.eval(`return ${listCalls}`);
  const ctx = await h.eval(`
    const panel = document.getElementById('files-panel');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 600 });
    panel.dispatchEvent(ev);
    const menu = document.getElementById('tree-context-menu');
    const shown = (id) => !document.getElementById(id).classList.contains('hidden');
    return { prevented: ev.defaultPrevented, open: !menu.classList.contains('hidden'), refresh: shown('tree-refresh'), others: ['tree-open-new-window', 'tree-reveal', 'tree-ask-ai'].some(shown) };`);
  ok('el clic derecho en el hueco del panel cancela el menú nativo y abre el propio', ctx.prevented && ctx.open, JSON.stringify(ctx));
  ok('con solo «Actualizar» (nada que abrir ni revelar)', ctx.refresh && !ctx.others, JSON.stringify(ctx));
  await h.eval(`document.getElementById('tree-refresh').click(); await new Promise((r) => setTimeout(r, 500));`);
  ok('«Actualizar» relee el árbol (más lecturas de la carpeta)', (await h.eval(`return ${listCalls}`)) > before);
  ok('y NO recarga la ventana (el documento sigue abierto)', (await h.eval(`return document.querySelector('#content h1')?.textContent`)) === 'Título');

  // ── El menú nativo ya no sale en ningún sitio sin menú propio, pero sí en los campos de texto ──
  const native = await h.eval(`
    const fire = (el) => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; };
    return { toolbar: fire(document.getElementById('btn-edit-toggle')), filter: fire(document.getElementById('file-tree-filter')), editor: fire(document.getElementById('editor-textarea')) };`);
  ok('fuera de campos de texto no sale el menú nativo (su «Actualizar» recargaría todo)', native.toolbar === true, JSON.stringify(native));
  ok('el campo del filtro conserva su menú nativo (cortar/pegar)', native.filter === false, JSON.stringify(native));

  const errs = h.errors();
  ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
} catch (e) {
  console.error('EXCEPCIÓN DEL BANCO:', e.message);
  failed++;
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} fallos` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
