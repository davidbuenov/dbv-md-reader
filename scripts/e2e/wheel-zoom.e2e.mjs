// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Zoom contextual con Ctrl+rueda (RF-56, amplía RF-43) sobre el motor Chromium de WebView2: un paso de rueda da un
// escalón en el panel bajo el puntero (editor → su letra; lectura, vista previa o panel lateral → zoom de lectura);
// un pellizco (muchos desplazamientos pequeños) acumula hasta un escalón; los límites se respetan; y la página
// entera no hace zoom.
//
// @spec RF-56, RF-43

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', '## Sección', '', 'Párrafo.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const levels = (h) => h.eval(`return { reading: parseInt(document.getElementById('content').style.zoom || '100', 10), editor: window.DBVApp.editorZoomLevel() }`);
/** Rueda sintética con Ctrl sobre `selector`: `deltas` uno por evento. */
const wheel = (h, selector, deltas) => h.eval(`const el = document.querySelector('${selector}'); return ${JSON.stringify(deltas)}.map((d) => { const ev = new WheelEvent('wheel', { deltaY: d, ctrlKey: true, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; }).every(Boolean)`);
/** Vuelve los dos zooms al 100 % por los caminos de la app: Ctrl+0 fuera del editor (lectura) y el del editor. */
const reset = (h) => h.eval(`if (document.activeElement) document.activeElement.blur(); window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', code: 'Digit0', ctrlKey: true, bubbles: true })); window.DBVApp.editorZoomReset()`);

async function main() {
  console.log('RF-56 · Ctrl+rueda sobre cada panel');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400 });
  await h.eval(`if (document.getElementById('toc-sidebar').classList.contains('hidden')) document.getElementById('btn-toggle-toc').click()`); await h.sleep(300);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  await reset(h);

  ok('el evento se cancela (sin zoom nativo de la página)', await wheel(h, '#editor-textarea', [-100]));
  let l = await levels(h);
  ok('sobre el editor: un paso de rueda sube su letra un escalón y no toca la lectura', l.editor === 110 && l.reading === 100, JSON.stringify(l));
  await wheel(h, '#content', [-100]);
  l = await levels(h);
  ok('sobre la vista previa: un escalón de zoom de lectura', l.reading === 110 && l.editor === 110, JSON.stringify(l));
  await wheel(h, '#toc-sidebar', [100]);
  l = await levels(h);
  ok('sobre el panel lateral: también el zoom de lectura, hacia abajo', l.reading === 100, JSON.stringify(l));

  console.log('RF-56.3 · pellizco del panel táctil');
  await reset(h);
  await wheel(h, '#content', Array(5).fill(-10)); await h.sleep(50);
  ok('medio pellizco (5 × −10) todavía no hace nada', (await levels(h)).reading === 100);
  await wheel(h, '#content', Array(5).fill(-10)); await h.sleep(50);
  ok('el pellizco completo (10 × −10) da un escalón, igual que un paso de rueda', (await levels(h)).reading === 110);
  await wheel(h, '#content', Array(9).fill(-10)); await h.sleep(500);
  await wheel(h, '#content', [-10]); await h.sleep(50);
  ok('tras 400 ms sin movimiento lo acumulado se olvida', (await levels(h)).reading === 110);
  await wheel(h, '#content', Array(6).fill(-10));
  await wheel(h, '#editor-textarea', Array(6).fill(-10)); await h.sleep(50);
  l = await levels(h);
  ok('pasar a otro panel empieza de cero (no suma lo de la lectura al editor)', l.reading === 110 && l.editor === 100, JSON.stringify(l));

  console.log('RF-56.1 · límites');
  await reset(h);
  await wheel(h, '#content', Array(20).fill(-100));
  await wheel(h, '#editor-textarea', Array(20).fill(-100));
  l = await levels(h);
  ok('tope del 200 % en los dos', l.reading === 200 && l.editor === 200, JSON.stringify(l));
  await wheel(h, '#content', Array(30).fill(100));
  await wheel(h, '#editor-textarea', Array(30).fill(100));
  l = await levels(h);
  ok('mínimo del 60 % en los dos', l.reading === 60 && l.editor === 60, JSON.stringify(l));

  console.log('RF-56.2 · rueda real (CDP) y la página no hace zoom');
  await reset(h);
  const pt = await h.eval(`const r = document.getElementById('content').getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + 40) }`);
  // Ancho ANTES de la rueda: un zoom de página lo cambiaría (en CSS px). Antes se comparaba con 1376, el valor de
  // Windows para una ventana de 1400 px; en otro sistema el marco es distinto y el banco fallaba sin motivo.
  const widthBefore = await h.eval(`return window.innerWidth`);
  await h.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pt.x, y: pt.y, deltaX: 0, deltaY: -100, modifiers: 2 }); await h.sleep(200);
  const page = await h.eval(`return { scale: window.visualViewport ? window.visualViewport.scale : 1, width: window.innerWidth, reading: parseInt(document.getElementById('content').style.zoom || '100', 10) }`);
  ok('un paso de rueda real con Ctrl da un escalón de lectura', page.reading === 110, JSON.stringify(page));
  ok('y la página sigue a escala 1 con el mismo ancho', page.scale === 1 && page.width === widthBefore, JSON.stringify({ ...page, widthBefore }));
  await reset(h);
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
