// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Archivo ▸ Salir sobre el motor Chromium de WebView2, con la API de ventanas de Tauri simulada: la entrada existe con
// su atajo Ctrl+Q; sin cambios pide `close()` a las demás ventanas (cada una pregunta por lo suyo) y cierra esta con
// `destroy()`; con cambios sin guardar pregunta primero y «Seguir editando» no cierra nada; Ctrl+Q hace lo mismo.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

/** Tres ventanas simuladas; cada llamada queda en `window.__win`. */
const FAKE = `
  window.__win = [];
  const mk = (label) => ({ label,
    close: () => { window.__win.push('close:' + label); return Promise.resolve(); },
    setFocus: () => Promise.resolve(),
    destroy: () => { window.__win.push('destroy:' + label); return Promise.resolve(); } });
  const real = window.__TAURI__.window;
  window.__TAURI__.window = Object.assign({}, real, {
    getCurrentWindow: () => Object.assign(real.getCurrentWindow(), mk('main')),
    getAllWindows: () => Promise.resolve([mk('main'), mk('doc-1'), mk('doc-2')]),
  });`;
const calls = (h) => h.eval(`return window.__win.slice().sort().join(',')`);
const clickExit = (h) => h.eval(`document.getElementById('btn-file-menu').click(); document.querySelector('#file-menu [data-action="exit"]').click()`);

async function main() {
  console.log('Archivo ▸ Salir');
  const h = await launch({ appDir, docPath: 'C:/x/salir.md', docContent: '# Hola\n\ntexto', width: 1400 });
  await h.sleep(500);
  await h.eval(FAKE);
  await h.eval(`document.getElementById('btn-file-menu').click()`); await h.sleep(150);
  const item = await h.eval(`const e = document.querySelector('#file-menu [data-action="exit"]'); return e && { disabled: e.disabled, label: e.textContent.trim(), last: e === e.parentElement.lastElementChild }`);
  ok('la entrada existe, está habilitada y es la última del menú', !!item && !item.disabled && item.last, JSON.stringify(item));
  ok('muestra «Salir» con Ctrl+Q', !!item && /^Salir/.test(item.label) && /Ctrl\+Q/.test(item.label), item && item.label);
  await h.eval(`document.getElementById('btn-file-menu').click()`); await h.sleep(100);

  await clickExit(h); await h.sleep(200);
  ok('sin cambios: pide close() a las otras y destroy() a esta', (await calls(h)) === 'close:doc-1,close:doc-2,destroy:main', await calls(h));

  console.log('con cambios sin guardar');
  await h.eval(`window.__win.length = 0; document.getElementById('btn-edit-toggle').click()`); await h.sleep(500);
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value += ' cambio'; ta.dispatchEvent(new Event('input', { bubbles: true }))`); await h.sleep(100);
  await clickExit(h); await h.sleep(200);
  ok('pregunta antes de cerrar nada', await h.eval(`return !document.getElementById('discard-modal').classList.contains('hidden')`) && (await calls(h)) === '');
  await h.eval(`document.getElementById('discard-cancel').click()`); await h.sleep(200);
  ok('«Seguir editando» no cierra ninguna ventana', (await calls(h)) === '', await calls(h));

  await h.key('q', 'KeyQ', 81, 2); await h.sleep(200);
  ok('Ctrl+Q también pregunta', await h.eval(`return !document.getElementById('discard-modal').classList.contains('hidden')`));
  await h.eval(`document.getElementById('discard-confirm').click()`); await h.sleep(300);
  ok('«Descartar cambios» cierra todas', (await calls(h)) === 'close:doc-1,close:doc-2,destroy:main', await calls(h));

  // @spec RF-21 — en macOS ⌘Q llega como evento `menu-exit` desde el menú de la app.
  await h.eval(`window.__win.length = 0; const ta = document.getElementById('editor-textarea'); ta.value += ' más'; ta.dispatchEvent(new Event('input', { bubbles: true }))`); await h.sleep(100);
  await h.eval(`window.__emit('menu-exit')`); await h.sleep(200);
  ok('el evento menu-exit (⌘Q) pregunta antes de cerrar', await h.eval(`return !document.getElementById('discard-modal').classList.contains('hidden')`) && (await calls(h)) === '');
  await h.eval(`document.getElementById('discard-cancel').click()`); await h.sleep(200);
  ok('y «Seguir editando» no cierra nada', (await calls(h)) === '', await calls(h));

  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
