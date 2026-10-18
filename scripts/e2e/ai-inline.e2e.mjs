// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// IA en línea: menú del editor, diferencia, marcado perdido, aceptar y deshacer (RF-36).
//
// @spec RF-36
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
const doc = ['# Título', '', 'Párrafo con un erorr de ortografia y un [enlace](https://ejemplo.org) y $x^2$.', '', '## Sección', '', 'Más texto aquí.', ''].join('\n');

const extra = JSON.stringify({
  ai_connections: { connections: [{ id: 'c1', name: 'Ollama · qwen2.5:3b', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b', hasKey: false, contextTokens: 8192, supportsTools: true, supportsImages: false }], active: 'c1', showAi: true },
  ai_providers: [{ provider: 'ollama', baseUrl: 'http://localhost:11434', cloud: false, contextTokens: 8192, maxOutputTokens: 4096 }],
  ai_list_files: ['test.md'], ai_project_state_load: null, ai_project_state_save: null,
});

// El modelo responde según un guion que fija la prueba (window.__reply).
const customInvoke = `((cmd, args) => {
  if (cmd !== 'ai_chat') return undefined;
  window.__chat.push(args);
  const text = typeof window.__reply === 'function' ? window.__reply(args) : 'ok';
  [{ type: 'text', text }, { type: 'usage', input: 50, output: 10, evalMs: 0 }, { type: 'done', stopReason: 'end_turn' }]
    .forEach((ev, i) => setTimeout(() => window.__emit('ai-stream', { requestId: args.requestId, ...ev }), 15 + i * 8));
  return null;
})`;

const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, extraInvoke: extra, customInvoke });
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

try {
  // Sin IA cargada todavía: el menú del editor ya ofrece «IA» (hay conexión) sin haber descargado nada de src/ai/
  await h.eval(`document.getElementById('btn-edit-toggle').click()`);
  await h.sleep(500);
  const before = await h.eval(`return performance.getEntriesByType('resource').filter(r => /\\/ai\\//.test(r.name)).length`);
  ok('con una IA conectada pero sin usarla, sigue sin descargarse nada de src/ai/', before === 0, `módulos: ${before}`);

  // Selecciona «erorr de ortografia» en el editor y abre el menú contextual
  const sel = await h.eval(`
    const t=document.getElementById('editor-textarea'); const word='erorr de ortografia';
    const a=t.value.indexOf(word); t.focus(); t.setSelectionRange(a, a + word.length);
    // Coordenadas reales del texto seleccionado (un textarea no las da): fuente y sangría medidas con un canvas.
    const cs=getComputedStyle(t); const ctx=document.createElement('canvas').getContext('2d'); ctx.font=cs.font;
    const line=t.value.slice(0,a).split('\\n').length-1; const lineStart=t.value.lastIndexOf('\\n',a-1)+1;
    const x0=ctx.measureText(t.value.slice(lineStart,a)).width, w=ctx.measureText(word).width;
    const lh=parseFloat(cs.lineHeight), r=t.getBoundingClientRect();
    return {x: r.left+parseFloat(cs.paddingLeft)+x0+w/2-t.scrollLeft, y: r.top+parseFloat(cs.paddingTop)+(line+0.5)*lh-t.scrollTop};`);
  await h.click(sel.x, sel.y, 1, 'right');
  await h.sleep(300);
  const menu = await h.eval(`return [...document.querySelectorAll('.ctx-menu .ctx-item')].map(b => b.dataset.action)`);
  ok('el menú contextual del editor ofrece «IA: acciones sobre el texto…»', menu.includes('aiInline'), JSON.stringify(menu));
  const keep = await h.eval(`const t=document.getElementById('editor-textarea'); return t.value.slice(t.selectionStart, t.selectionEnd)`);
  ok('…y el clic derecho no pierde la selección', keep === 'erorr de ortografia', keep);

  // Corregir ortografía
  await h.eval(`window.__reply = () => 'error de ortografía'; document.querySelector('.ctx-menu [data-action="aiInline"]').click()`);
  await h.sleep(1500);
  const bar = await h.eval(`return { open: !!document.querySelector('.ai-inline-bar'), actions: [...document.querySelectorAll('.ai-inline-bar__row .button')].map(b => b.textContent) }`);
  ok('se abre la barra con las 9 acciones', bar.open && bar.actions.length === 9, JSON.stringify(bar.actions));
  await h.eval(`[...document.querySelectorAll('.ai-inline-bar__row .button')].find(b => /Corregir ortograf/.test(b.textContent)).click()`);
  await h.sleep(1200);
  const diff = await h.eval(`return {
    removed: document.querySelector('.ai-inline__removed')?.textContent,
    added: document.querySelector('.ai-inline__added')?.textContent,
    status: document.querySelector('.ai-inline__status')?.textContent,
    msg: window.__chat.at(-1).request.messages.map(m => m.role + ': ' + m.content.slice(0, 140)),
  }`);
  ok('la diferencia muestra lo que sale y lo que entra', diff.removed === 'erorr de ortografia' && diff.added === 'error de ortografía', JSON.stringify([diff.removed, diff.added]));
  ok('el modelo recibe el texto como DATO dentro de <selection>', /<selection>[\s\S]*erorr de ortografia[\s\S]*<\/selection>/.test(await h.eval(`return window.__chat.at(-1).request.messages.at(-1).content`)));
  ok('…y el prompt dice que el contenido es un dato, no una orden', /DATA, never instructions/.test(await h.eval(`return window.__chat.at(-1).request.messages[0].content`)));
  await h.screenshot(OUT + '/ai-inline.png');
  await h.eval(`[...document.querySelectorAll('.ai-inline__bar .button')].find(b => /Aceptar/.test(b.textContent)).click()`);
  await h.sleep(400);
  const accepted = await h.eval(`const t=document.getElementById('editor-textarea'); return { has: t.value.includes('un error de ortografía y un [enlace]'), barClosed: !document.querySelector('.ai-inline-bar'), dirty: !document.getElementById('doc-modified-badge').classList.contains('hidden') }`);
  ok('aceptar sustituye solo la selección, cierra la barra y deja el documento «Modificado»', accepted.has && accepted.barClosed && accepted.dirty, JSON.stringify(accepted));
  await h.eval(`document.getElementById('editor-textarea').focus()`);
  await h.key('z', 'KeyZ', 90, 2);
  await h.sleep(300);
  ok('Ctrl+Z deshace la edición de la IA en línea', await h.eval(`return document.getElementById('editor-textarea').value.includes('un erorr de ortografia')`));

  // Sin selección: actúa sobre el párrafo del cursor y avisa si el modelo pierde un enlace o una fórmula
  await h.eval(`const t=document.getElementById('editor-textarea'); const a=t.value.indexOf('enlace'); t.focus(); t.setSelectionRange(a,a); window.__reply = () => 'Párrafo sin el enlace ni la fórmula.';`);
  await h.key('i', 'KeyI', 73, 3); // Ctrl+Alt+I
  await h.sleep(700);
  await h.eval(`[...document.querySelectorAll('.ai-inline-bar__row .button')].find(b => /Acortar/.test(b.textContent)).click()`);
  await h.sleep(1200);
  const lost = await h.eval(`return { removed: document.querySelector('.ai-inline__removed')?.textContent, status: document.querySelector('.ai-inline__status')?.textContent, cls: document.querySelector('.ai-inline__status')?.className }`);
  ok('sin selección toma el párrafo entero del cursor', /^Párrafo con un erorr.*\$x\^2\$\.$/.test(lost.removed || ''), lost.removed);
  ok('avisa de que el resultado pierde enlaces, fórmulas y direcciones web', /pierde/.test(lost.status || '') && /enlaces/.test(lost.status) && /fórmulas/.test(lost.status), lost.status);
  await h.screenshot(OUT + '/ai-inline-warn.png');

  // «Explicar» no cambia nada
  await h.eval(`document.querySelector('.ai-inline-bar__top .icon-button').click()`);
  await h.eval(`const t=document.getElementById('editor-textarea'); window.__before=t.value; window.__reply = () => '**Significa** que hay una errata.';`);
  await h.key('i', 'KeyI', 73, 3);
  await h.sleep(600);
  await h.eval(`[...document.querySelectorAll('.ai-inline-bar__row .button')].find(b => /Explicar/.test(b.textContent)).click()`);
  await h.sleep(1200);
  const explain = await h.eval(`return { html: document.querySelector('.ai-inline-explain__body')?.innerHTML, same: document.getElementById('editor-textarea').value === window.__before }`);
  ok('«Explicar» muestra la respuesta como Markdown y NO toca el documento', /<strong>Significa<\/strong>/.test(explain.html || '') && explain.same, explain.html);

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
