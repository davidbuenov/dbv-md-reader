// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sincronización edición ↔ previsualización, en el motor real (RF-30).
//
// @spec RF-30
// =============================================================================

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}


const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = [
  '# Título de prueba', '', 'Primer párrafo con la palabra zorro y otra vez zorro y más texto.', '',
  '$$', 'a = b', 'c = d', '$$', '', '## Sección dos', '',
  '- elemento uno', '- elemento dos con palabra única quimera', '',
  '```js', 'const x = 1;', 'const y = 2;', '```', '', 'Último párrafo final.', '',
  ...Array.from({ length: 60 }, (_, i) => `Relleno número ${i} para obligar a hacer scroll en la vista previa y el editor.\n`),
  '## Final', '', 'Cola del documento con la palabra remate.', '',
].join('\n');

const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failed++; };

try {
  const startup = await h.eval(`return { blocks: document.querySelectorAll('#content [data-src-line]').length, h1: document.querySelector('#content h1')?.dataset.srcLine, code: document.querySelector('#content code[data-src-body]')?.dataset.srcBody, errors: window.__errors || null }`);
  ok('el render lleva data-src-line tras DOMPurify', startup.blocks > 5, JSON.stringify(startup));
  ok('encabezado en la línea 0', startup.h1 === '0');
  // La fórmula de 4 líneas no debe desplazar lo siguiente: ## Sección dos está en la línea 9 del fichero.
  const h2 = await h.eval(`return [...document.querySelectorAll('#content h2')].map(e => e.dataset.srcLine)`);
  ok('## Sección dos mapea a la línea 9 del fichero (con fórmula multilínea antes)', h2[0] === '9', JSON.stringify(h2));
  ok('el bloque de código tiene su cuerpo en la línea 15', startup.code === '15', startup.code);

  // ── Lectura: el doble clic NO debe entrar en edición ────────────────────────
  const para = await h.eval(`const p=[...document.querySelectorAll('#content p')].find(e=>e.textContent.includes('Primer')); const r=p.getBoundingClientRect(); return {x:r.left+40,y:r.top+r.height/2}`);
  await h.click(para.x, para.y, 2);
  await h.sleep(300);
  ok('doble clic en lectura no activa el Modo Edición', (await h.eval(`return document.getElementById('reader-container').classList.contains('edit-mode')`)) === false);

  // ── «Editar aquí» desde el menú contextual en lectura ───────────────────────
  await h.click(para.x, para.y, 1, 'right');
  await h.sleep(250);
  const menuR = await h.eval(`return [...document.querySelectorAll('.ctx-menu .ctx-item')].map(b => b.dataset.action + ':' + b.textContent.trim())`);
  ok('el menú de la preview en lectura ofrece «Editar aquí»', menuR.some((s) => s.startsWith('editHere')), JSON.stringify(menuR));
  await h.eval(`document.querySelector('.ctx-menu [data-action="editHere"]').click()`);
  await h.sleep(500);
  const afterEdit = await h.eval(`const t=document.getElementById('editor-textarea'); return { edit: document.getElementById('reader-container').classList.contains('edit-mode'), sel: t.value.slice(t.selectionStart, t.selectionEnd), start: t.selectionStart }`);
  ok('«Editar aquí» entra en Modo Edición', afterEdit.edit === true);
  // Había una palabra seleccionada (el doble clic de lectura): «Editar aquí» la respeta; si no, seleccionaría la línea.
  ok('…y lleva el cursor al párrafo (la palabra seleccionada o su línea)', afterEdit.sel === 'Primer' || afterEdit.sel.startsWith('Primer párrafo'), JSON.stringify(afterEdit.sel));

  // ── Doble clic en la preview (Modo Edición) → editor, con la palabra ───────
  // Segunda aparición de «zorro»: el doble clic debe seleccionar ESA, no la primera.
  const zorro = await h.eval(`
    const p=[...document.querySelectorAll('#content p')].find(e=>e.textContent.includes('Primer'));
    const walker=document.createTreeWalker(p, NodeFilter.SHOW_TEXT); const n=walker.nextNode();
    const idx=n.textContent.lastIndexOf('zorro'); const range=document.createRange(); range.setStart(n, idx+2); range.setEnd(n, idx+2);
    const r=range.getBoundingClientRect(); return {x:r.left, y:r.top + r.height/2};`);
  await h.eval(`const t=document.getElementById('editor-textarea'); t.setSelectionRange(0,0); t.scrollTop=0;`);
  await h.click(zorro.x, zorro.y, 2);
  await h.sleep(400);
  const dbl = await h.eval(`const t=document.getElementById('editor-textarea'); return { sel: t.value.slice(t.selectionStart, t.selectionEnd), start: t.selectionStart, focus: document.activeElement===t, flash: !!document.querySelector('#content .sync-flash') }`);
  const expectStart = doc.lastIndexOf('zorro');
  ok('doble clic en la preview selecciona la palabra pulsada en el editor', dbl.sel === 'zorro', JSON.stringify(dbl));
  ok('…la SEGUNDA aparición, no la primera', dbl.start === expectStart, `start=${dbl.start} esperado=${expectStart}`);
  ok('…el editor recibe el foco y el bloque parpadea en la preview', dbl.focus && dbl.flash);

  // ── Línea exacta dentro de un bloque de código ──────────────────────────────
  const codeLine = await h.eval(`const l=document.querySelector('#content .code-line[data-line="2"]'); const r=l.getBoundingClientRect(); return {x:r.left+30,y:r.top+r.height/2}`);
  await h.click(codeLine.x, codeLine.y, 2);
  await h.sleep(300);
  const code = await h.eval(`const t=document.getElementById('editor-textarea'); return t.value.slice(t.selectionStart, t.selectionEnd)`);
  ok('doble clic en la 2.ª línea de un bloque de código lleva a esa línea', code.includes('const y') || code === 'y' || code === 'const', JSON.stringify(code));

  // ── Editor → preview: Ctrl+Alt+P ────────────────────────────────────────────
  const target = await h.eval(`const t=document.getElementById('editor-textarea'); const i=t.value.indexOf('Cola del documento'); t.focus(); t.setSelectionRange(i,i); document.getElementById('content').scrollTop=0; return i`);
  await h.sleep(1600); // que acabe el destello anterior
  await h.key('p', 'KeyP', 80, 3); // Ctrl(2)+Alt(1)
  await h.sleep(500);
  const toPrev = await h.eval(`const c=document.getElementById('content'); return { top: c.scrollTop, flash: [...document.querySelectorAll('#content .sync-flash')].map(e => e.textContent.slice(0,40)).join(' | ') }`);
  ok('Ctrl+Alt+P desplaza la preview al bloque del cursor', toPrev.top > 500 && /Cola del documento/.test(toPrev.flash || ''), JSON.stringify(toPrev));
  ok('Ctrl+Alt+P no abrió el diálogo de imprimir', !(await h.eval(`return !!window.__printCalled`)));

  // ── Menú contextual del editor ──────────────────────────────────────────────
  const ed = await h.eval(`const r=document.getElementById('editor-textarea').getBoundingClientRect(); return {x:r.left+120,y:r.top+80}`);
  await h.click(ed.x, ed.y, 1, 'right');
  await h.sleep(250);
  const menuE = await h.eval(`return [...document.querySelectorAll('.ctx-menu .ctx-item')].map(b => b.dataset.action + (b.disabled ? '(off)' : ''))`);
  ok('el menú del editor trae «Ir a la vista previa» + portapapeles', ['goToPreview', 'cut(off)', 'copy(off)', 'paste', 'selectAll'].every((a) => menuE.includes(a)), JSON.stringify(menuE));
  await h.eval(`document.querySelector('.ctx-menu [data-action="goToPreview"]').click()`);
  await h.sleep(300);
  ok('Escape cierra el menú', await (async () => { await h.click(ed.x, ed.y, 1, 'right'); await h.sleep(150); await h.key('Escape', 'Escape', 27); await h.sleep(150); return (await h.eval(`return document.querySelectorAll('.ctx-menu').length`)) === 0; })());

  // ── Render pendiente: teclear y hacer doble clic antes del debounce ────────
  await h.eval(`const t=document.getElementById('editor-textarea'); t.focus(); t.setSelectionRange(0,0); document.execCommand('insertText', false, 'NUEVA LINEA\\n\\n');`);
  const stale = await h.eval(`const p=[...document.querySelectorAll('#content p')].find(e=>e.textContent.includes('Último')); const r=p.getBoundingClientRect(); return {x:r.left+20,y:r.top+r.height/2, vis: r.top>0 && r.bottom<innerHeight}`);
  ok('(precondición) el párrafo «Último» es visible para el clic', stale.vis, JSON.stringify(stale));

  // ── Sin errores de JS durante todo el recorrido ─────────────────────────────
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
