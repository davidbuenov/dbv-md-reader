// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Arreglos de la 0.19.0 medidos en el motor Chromium de WebView2 (Edge headless):
// - RF-09: la pantalla de bienvenida no se pinta al abrir con un archivo, aparece sin retraso
//   sin él y, si el arranque no responde, a los 2 s como máximo.
// - RF-10: los botones de los bloques de código no se mueven con el scroll horizontal, y la
//   impresión no recorta nada ni depende del zoom de pantalla.
// - RF-46: los diálogos de archivo reciben las carpetas candidatas, recuerdan la última tras
//   completar la operación y no la guardan al cancelar.
//
// @spec RF-09, RF-10, RF-46

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const longLine = 'x'.repeat(260);
const doc = ['# Título', '', 'Párrafo corto.', '', '```js', `const largo = "${longLine}";`, 'const b = 1;', '```', '',
  '| a | b |', '| - | - |', `| ${'palabra '.repeat(40)} | dos |`, '', '---', '', 'Fin.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

/** Instala, antes de que exista el DOM, un muestreador por fotograma de la visibilidad de la bienvenida. */
const sampler = (cliBehaviour) => `(function () {
  window.__samples = []; const t0 = performance.now();
  function tick() {
    const e = document.getElementById('empty-state');
    if (e) { const cs = getComputedStyle(e); window.__samples.push([Math.round(performance.now() - t0), cs.display !== 'none' && cs.visibility !== 'hidden' && !e.classList.contains('hidden')]); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return (cmd) => cmd === 'get_cli_argument' ? ${cliBehaviour} : undefined;
})()`;

async function boot() {
  console.log('RF-09 · arranque sin parpadeo');
  // Con archivo (la respuesta tarda 300 ms): la bienvenida no se ve nunca.
  let h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke: sampler(`new Promise((r) => setTimeout(() => r('C:/x/test.md'), 300))`) });
  await h.sleep(900);
  let s = await h.eval(`return window.__samples`);
  ok('con archivo, la bienvenida no se pinta en ningún fotograma', s.length > 20 && s.every(([, v]) => !v), `${s.length} fotogramas, ${s.filter(([, v]) => v).length} con bienvenida`);
  ok('con archivo, el documento acaba cargado', await h.eval(`return document.getElementById('content').textContent.includes('Párrafo corto')`));
  await h.close();

  // Sin archivo: aparece enseguida.
  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke: sampler('null') });
  await h.sleep(900);
  s = await h.eval(`return window.__samples`);
  const first = s.find(([, v]) => v);
  ok('sin archivo, la bienvenida se ve en cuanto termina el arranque', !!first && first[0] < 600, first ? `primera vez a los ${first[0]} ms` : 'nunca');
  await h.close();

  // El arranque no responde: a los 2 s se muestra igualmente.
  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke: sampler('new Promise(() => {})') });
  await h.sleep(2500);
  s = await h.eval(`return window.__samples`);
  const shown = s.find(([, v]) => v);
  ok('si el arranque no responde, no se ve antes de ~1,8 s…', !shown || shown[0] >= 1800, shown ? `primera vez a los ${shown[0]} ms` : 'nunca');
  ok('…pero sí a los 2 s (plazo de seguridad, con margen hasta 3 s)', !!shown && shown[0] <= 3000, shown ? `${shown[0]} ms` : 'nunca');
  await h.close();
}

async function codeButtons() {
  console.log('RF-10.1 · botones Copiar / Ajustar línea fijos');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc });
  await h.sleep(500);
  const r = await h.eval(`
    const pre = document.querySelector('.markdown-body pre'); const act = pre.parentNode.querySelector(':scope > .code-actions');
    const scroller = [pre, pre.querySelector('code')].find((e) => e.scrollWidth > e.clientWidth + 100) || pre;
    const a0 = act.getBoundingClientRect(); const p0 = pre.getBoundingClientRect();
    scroller.scrollLeft = 600; await new Promise((r) => setTimeout(r, 150));
    const a1 = act.getBoundingClientRect(); const p1 = pre.getBoundingClientRect();
    const lines = Array.from(pre.querySelectorAll('.code-line'));
    const numberAlign = lines.map((l) => l.getBoundingClientRect().height);
    return { moved: scroller.scrollLeft, dx: Math.abs(a1.left - a0.left), dy: Math.abs(a1.top - a0.top), inside: a1.right <= p1.right + 0.5 && a1.left >= p1.left - 0.5, lines: lines.length, heights: numberAlign };`);
  ok('el bloque hace scroll horizontal de verdad', r.moved > 0, `scrollLeft ${r.moved}`);
  ok('los botones no se mueven con el scroll (±0,5 px)', r.dx <= 0.5 && r.dy <= 0.5, `dx=${r.dx} dy=${r.dy}`);
  ok('los botones siguen dentro del bloque, sin recortar', r.inside);
  ok('un .code-line por línea lógica (ADR-046 intacto)', r.lines === 2 && r.heights.every((v) => v > 20), JSON.stringify(r.heights));
  // «Ajustar línea» sigue sin desbordar.
  const wrap = await h.eval(`
    const pre = document.querySelector('.markdown-body pre'); pre.parentNode.querySelectorAll('.code-actions button')[1]?.click();
    await new Promise((r) => setTimeout(r, 150));
    const sc = [pre, pre.querySelector('code')].map((e) => e.scrollWidth - e.clientWidth);
    return { wrapped: pre.classList.contains('wrapped'), over: sc };`);
  ok('con «Ajustar línea» no hay desbordamiento horizontal', wrap.over.every((v) => v <= 1), JSON.stringify(wrap));
  await h.close();
}

async function printing() {
  console.log('RF-10.2/.3 · impresión sin recortes e independiente del zoom');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 900 });
  await h.sleep(600);
  await h.send('Emulation.setEmulatedMedia', { media: 'print' });
  await h.send('Emulation.setDeviceMetricsOverride', { width: 657, height: 900, deviceScaleFactor: 1, mobile: false });
  await h.sleep(300);
  const over = await h.eval(`
    return Array.from(document.querySelectorAll('.markdown-body pre, .markdown-body pre code, .markdown-body table, .mermaid-container, #content')).map((e) => {
      const cs = getComputedStyle(e);
      return { tag: e.tagName, scroll: e.scrollWidth - e.clientWidth, ovx: cs.overflowX, right: Math.round(e.getBoundingClientRect().right) };
    });`);
  ok('nada desborda ni hace scroll interno al imprimir (A4 útil ≈ 657 px)', over.every((o) => o.scroll <= 1 && o.ovx !== 'auto' && o.ovx !== 'scroll' && o.right <= 657), JSON.stringify(over));
  const widths = [];
  for (const z of [60, 100, 200]) {
    await h.eval(`document.getElementById('content').style.zoom = '${z}%'`);
    await h.sleep(100);
    widths.push(await h.eval(`return Math.round(document.querySelector('.markdown-body p').getBoundingClientRect().width)`));
  }
  ok('la maquetación impresa es la misma con zoom 60 %, 100 % y 200 %', new Set(widths).size === 1, `anchos ${widths.join(' / ')}`);
  await h.send('Emulation.setEmulatedMedia', { media: 'screen' });
  await h.sleep(200);
  const onScreen = await h.eval(`document.getElementById('content').style.zoom = '100%'; const pre = document.querySelector('.markdown-body pre'); return getComputedStyle(pre).overflowX + '/' + getComputedStyle(pre.querySelector('code')).overflowX`);
  ok('en pantalla el scroll horizontal del código sigue existiendo', /auto/.test(onScreen), onScreen);
  await h.close();
}

async function dialogs() {
  console.log('RF-46 · carpeta inicial de los diálogos');
  const customInvoke = `((cmd) => cmd === 'save_new_file_dialog' ? (window.__newPath === undefined ? null : window.__newPath) : cmd === 'save_typst_dialog' ? 'E:/exportados/doc.typ' : undefined)`;
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke });
  await h.sleep(500);
  const last = (cmd) => h.eval(`const c = window.__calls.filter((x) => x[0] === '${cmd}'); return c.length ? c[c.length - 1][1] : null`);
  await h.eval(`document.getElementById('btn-new-file').click()`);
  await h.sleep(300);
  let args = await last('save_new_file_dialog');
  ok('Nuevo documento ofrece la carpeta del documento abierto', JSON.stringify(args?.defaultDirs) === '["C:/x"]', JSON.stringify(args));
  ok('cancelar el diálogo no recuerda ninguna carpeta', await h.eval(`return localStorage.getItem('dbv-md-last-dir-newfile')`) === null);
  await h.eval(`document.getElementById('btn-open-file').click()`);
  await h.sleep(300);
  args = await last('open_file_dialog');
  ok('Abrir archivo ofrece la carpeta del documento abierto', JSON.stringify(args?.defaultDirs) === '["C:/x"]', JSON.stringify(args));
  await h.eval(`document.getElementById('btn-export-typst').click()`);
  await h.sleep(500);
  args = await last('save_typst_dialog');
  ok('Exportar a Typst empieza por la carpeta del documento si no hay ninguna recordada', JSON.stringify(args?.defaultDirs) === '["C:/x"]', JSON.stringify(args));
  ok('completar la exportación recuerda su carpeta', await h.eval(`return localStorage.getItem('dbv-md-last-dir-typst')`) === 'E:/exportados');
  await h.eval(`document.getElementById('btn-export-typst').click()`);
  await h.sleep(500);
  args = await last('save_typst_dialog');
  ok('la siguiente exportación ofrece primero la última carpeta de exportación', JSON.stringify(args?.defaultDirs) === '["E:/exportados","C:/x"]', JSON.stringify(args));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await boot();
await codeButtons();
await printing();
await dialogs();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
