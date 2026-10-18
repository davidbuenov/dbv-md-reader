// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Regresión del pase Bugs de /code-simplify (0.18.0): un documento con saltos de línea
// CRLF (lo normal en Windows) parecía siempre «desfasado» respecto al editor, porque
// el `.value` de un <textarea> normaliza a LF. Resultado: cada doble clic repintaba la
// preview, perdía la palabra pulsada y caía a la línea.
//
// @spec RF-30

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Primer párrafo con la palabra zorro y otra vez zorro y más texto.', '', '$$', 'a = b', '$$', '', 'Último párrafo.', ''].join('\r\n');

const h = await launch({ appDir, docPath: 'C:/x/crlf.md', docContent: doc });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

try {
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(500);
  const zorro = await h.eval(`
    const p=[...document.querySelectorAll('#content p')].find(e=>e.textContent.includes('Primer'));
    const n=document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
    const idx=n.textContent.lastIndexOf('zorro'); const range=document.createRange(); range.setStart(n, idx+2); range.setEnd(n, idx+2);
    const r=range.getBoundingClientRect(); return {x:r.left, y:r.top + r.height/2};`);
  // Marca el nodo para saber si la preview se repinta (un repintado lo sustituye).
  await h.eval(`window.__marker = document.querySelector('#content p')`);
  await h.click(zorro.x, zorro.y, 2);
  await h.sleep(400);
  const result = await h.eval(`
    const t=document.getElementById('editor-textarea');
    return { sel: t.value.slice(t.selectionStart, t.selectionEnd), start: t.selectionStart, expected: t.value.lastIndexOf('zorro'),
             sameNode: window.__marker === document.querySelector('#content p'), crlfInValue: t.value.includes('\\r') };`);
  ok('el doble clic selecciona la palabra exacta en un documento CRLF', result.sel === 'zorro' && result.start === result.expected, JSON.stringify(result));
  ok('y no repinta la preview (no se ve «desfasada» por el CRLF)', result.sameNode === true);
  ok('(precondición) el textarea trae el texto normalizado a LF', result.crlfInValue === false);
  const line = await h.eval(`return document.querySelector('#content h1')?.dataset.srcLine + ',' + [...document.querySelectorAll('#content p')].pop().dataset.srcLine`);
  ok('las líneas de origen son las del fichero también con CRLF y fórmula multilínea', line === '0,8', line);
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
