// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Regresión: la IA no podía escribir en un documento con saltos de línea CRLF (lo normal
// en Windows). El modelo propone `search` con `\n`, pero el texto que ve la app (el documento
// cargado, en lectura) trae `\r\n`: un cambio de varias líneas nunca casaba y la propuesta
// fallaba con «no se encontró el texto a buscar». Además, al escribir otro documento de la
// carpeta, no se debe cambiar su fin de línea por detrás.
//
// @spec RF-34
// @spec RF-35

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Línea dos del párrafo', 'Línea tres del párrafo', '', 'Fin.', ''].join('\r\n');
const other = ['# Otro', '', 'Uno', 'Dos', ''].join('\r\n');

const extra = JSON.stringify({
  ai_connections: { connections: [{ id: 'c1', name: 'Ollama', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b', hasKey: false, contextTokens: 8192, supportsTools: true, supportsImages: false }], active: 'c1', showAi: true },
  ai_providers: [{ provider: 'ollama', baseUrl: 'http://localhost:11434', cloud: false, contextTokens: 8192, maxOutputTokens: 4096 }],
  ai_list_files: ['crlf.md', 'otro.md'],
  ai_project_state_load: null,
  ai_project_state_save: null,
  ai_check_proposal: { diagnostics: [] },
});

// 1.ª llamada: propone un cambio de VARIAS líneas (con \n) en el documento abierto y en otro CRLF.
const customInvoke = `((cmd, args) => {
  if (cmd === 'ai_read_file') return args.relative === 'otro.md' ? ${JSON.stringify(other)} : null;
  if (cmd !== 'ai_chat') return undefined;
  window.__chat.push(args);
  const n = window.__chat.length;
  const call = { type: 'toolCall', id: 't1', name: 'propose_changes', arguments: JSON.stringify({ summary: 'Une las dos líneas', changes: [
    { path: 'crlf.md', action: 'edit', search: 'Línea dos del párrafo\\nLínea tres del párrafo', replace: 'Líneas dos y tres del párrafo' },
    { path: 'otro.md', action: 'edit', search: 'Uno\\nDos', replace: 'UnoDos' },
  ] }) };
  const script = n === 1 ? [call, { type: 'done', stopReason: 'tool_use' }] : [{ type: 'text', text: 'Hecho.' }, { type: 'done', stopReason: 'end_turn' }];
  script.forEach((ev, i) => setTimeout(() => window.__emit('ai-stream', { requestId: args.requestId, ...ev }), 15 + i * 8));
  return null;
})`;

const h = await launch({ appDir, docPath: 'C:/x/crlf.md', docContent: doc, extraInvoke: extra, customInvoke });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

try {
  // En LECTURA (sin Modo Edición), que es donde el texto del documento trae CRLF.
  await h.eval(`document.getElementById('btn-ai').click()`);
  await h.sleep(1500);
  await h.eval(`const i=document.querySelector('.ai-panel__input'); i.value='Une las dos líneas'; i.dispatchEvent(new Event('input',{bubbles:true}));`);
  await h.key('Enter', 'Enter', 13);
  await h.sleep(1800);
  const conv = await h.eval(`return {
    review: !!document.querySelector('.ai-review'),
    files: [...document.querySelectorAll('.ai-file__path')].map(e => e.textContent),
    notes: [...document.querySelectorAll('.ai-note--error')].map(e => e.textContent),
    toolResult: (window.__chat[1]?.request.messages || []).filter(m => m.role === 'tool').map(m => m.content).join(' | '),
  }`);
  ok('la propuesta de varias líneas casa con un documento CRLF (sin «no se encontró»)', !/no se encontró|not found/i.test(conv.toolResult), conv.toolResult);
  ok('aparece la tarjeta de revisión con los dos documentos', conv.review && conv.files.includes('crlf.md') && conv.files.includes('otro.md'), JSON.stringify(conv.files));

  // Aplicar: el abierto va al editor; el otro se escribe en disco CONSERVANDO sus CRLF.
  await h.eval(`document.querySelector('.ai-review__actions .button--primary').click()`);
  await h.sleep(800);
  const applied = await h.eval(`
    const w = window.__calls.filter(c => c[0] === 'ai_write_file');
    const t = document.getElementById('editor-textarea');
    return { editor: t.value, writes: w.map(c => ({ rel: c[1].relative, content: c[1].content })) };`);
  ok('el documento abierto queda corregido en el editor', applied.editor.includes('Líneas dos y tres del párrafo'), JSON.stringify(applied.editor));
  const other2 = applied.writes.find((x) => x.rel === 'otro.md');
  ok('el otro documento se escribe con su fin de línea original (CRLF), no con LF', !!other2 && other2.content === ['# Otro', '', 'UnoDos', ''].join('\r\n'), JSON.stringify(other2));
  ok('no se escribió el documento abierto por detrás del editor', !applied.writes.some((x) => x.rel === 'crlf.md'));
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
