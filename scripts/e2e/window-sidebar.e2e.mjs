// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Panel lateral recordado y casilla «Recordar la ventana» (RF-42), en el motor Chromium de WebView2. La
// geometría de la ventana la prueba Rust (`window_state.rs`, 16 tests); aquí se mide la parte del frontend:
// el comportamiento automático de siempre mientras no haya decisión, la prevalencia de la primera decisión
// manual, la pestaña activa, el límite de 768 px, que el Asistente solo se restaura si la IA sigue disponible
// y que la casilla de Preferencias habla con Rust.
//
// @spec RF-42

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const withHeadings = ['# Título', '', 'Texto.', '', '## Sección', '', 'Más texto.', ''].join('\n');
const noHeadings = ['Solo un párrafo, sin encabezados.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const sidebar = (h) => h.eval(`return { open: !document.getElementById('toc-sidebar').classList.contains('hidden'), tab: ['index', 'files', 'ai'].find((t) => document.getElementById('tab-' + t).classList.contains('active')), pref: localStorage.getItem('dbv-md-toc-pref'), savedTab: localStorage.getItem('dbv-md-sidebar-tab') }`);
const reload = async (h) => { await h.send('Page.reload'); await h.sleep(1800); };

async function main() {
  console.log('RF-42.3 · sin decisión previa rige el comportamiento automático');
  let h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: noHeadings, width: 1300 });
  await h.eval(`localStorage.clear()`);
  await reload(h);
  let s = await sidebar(h);
  ok('un documento sin encabezados deja el panel cerrado', s.open === false && s.pref === null, JSON.stringify(s));
  await h.close();

  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: withHeadings, width: 1300 });
  await h.eval(`localStorage.clear()`);
  await reload(h);
  s = await sidebar(h);
  ok('un documento con encabezados abre el panel solo (pantalla ancha)', s.open === true && s.pref === null, JSON.stringify(s));

  console.log('RF-42.3 · la primera decisión manual prevalece');
  await h.eval(`document.getElementById('btn-toggle-toc').click()`);
  await h.sleep(200);
  s = await sidebar(h);
  ok('cerrarlo a mano se recuerda como «cerrado»', s.open === false && s.pref === 'closed', JSON.stringify(s));
  await h.eval(`window.DBVApp.openDocument('C:/x/otro.md')`);
  await h.sleep(700);
  s = await sidebar(h);
  ok('abrir otro documento con encabezados ya NO lo reabre solo', s.open === false, JSON.stringify(s));
  await reload(h);
  s = await sidebar(h);
  ok('tras reiniciar sigue cerrado', s.open === false && s.pref === 'closed', JSON.stringify(s));

  await h.eval(`document.getElementById('btn-toggle-toc').click()`);
  await h.sleep(200);
  s = await sidebar(h);
  ok('abrirlo a mano se recuerda como «abierto»', s.open === true && s.pref === 'open', JSON.stringify(s));
  await h.close();

  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: noHeadings, width: 1300 });
  await h.eval(`localStorage.setItem('dbv-md-toc-pref', 'open')`);
  await reload(h);
  s = await sidebar(h);
  ok('con «abierto» recordado se abre aunque el documento no tenga encabezados', s.open === true, JSON.stringify(s));

  console.log('RF-42.3 · pestaña activa y límite de 768 px');
  await h.eval(`document.getElementById('tab-files').click()`);
  await h.sleep(200);
  s = await sidebar(h);
  ok('elegir Archivos se recuerda', s.tab === 'files' && s.savedTab === 'files', JSON.stringify(s));
  await reload(h);
  s = await sidebar(h);
  ok('tras reiniciar vuelve a Archivos', s.open === true && s.tab === 'files', JSON.stringify(s));

  await h.eval(`localStorage.setItem('dbv-md-sidebar-tab', 'ai')`);
  await reload(h);
  s = await sidebar(h);
  ok('el Asistente guardado pero sin IA conectada cae en Índice (no existe)', s.tab === 'index', JSON.stringify(s));
  ok('…y no se cargó ningún módulo de la IA (RNF-IA.1)', await h.eval(`return !performance.getEntriesByType('resource').some((e) => /\\/ai\\/entry\\.js/.test(e.name))`));

  await h.eval(`localStorage.setItem('dbv-md-sidebar-tab', 'index')`);
  await h.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 800, deviceScaleFactor: 1, mobile: false });
  await reload(h);
  s = await sidebar(h);
  ok('en ≤ 768 px sigue cerrado por defecto aunque se recordara «abierto»', s.open === false, JSON.stringify(s));
  await h.send('Emulation.clearDeviceMetricsOverride');
  await h.close();

  console.log('RF-42.3 · el Asistente se restaura solo si la IA sigue disponible');
  const connected = `{ connections: [{ id: 'c1', name: 'Local', provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'x', hasKey: false }], active: 'c1', showAi: true }`;
  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: withHeadings, width: 1300, extraInvoke: `{ ai_connections: ${connected} }` });
  await h.eval(`localStorage.setItem('dbv-md-toc-pref', 'open'); localStorage.setItem('dbv-md-sidebar-tab', 'ai')`);
  await reload(h);
  ok('con la IA conectada y el panel abierto en el Asistente, se vuelve a cargar el Asistente', await h.eval(`return performance.getEntriesByType('resource').some((e) => /\\/ai\\/entry\\.js/.test(e.name))`));
  await h.close();

  console.log('RF-42 · casilla «Recordar la posición y el tamaño de la ventana»');
  h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: withHeadings, width: 1300 });
  await h.eval(`document.getElementById('btn-prefs-menu').click()`);
  await h.sleep(200);
  const item = `document.querySelector('#prefs-menu [data-pref="rememberWindow"]')`;
  ok('la casilla existe y arranca marcada (por defecto activada)', await h.eval(`return ${item}.getAttribute('aria-checked') === 'true'`));
  await h.eval(`${item}.click()`);
  await h.sleep(400);
  const sent = await h.eval(`const c = window.__calls.filter((x) => x[0] === 'set_window_state_pref'); return c.length ? c[c.length - 1][1] : null`);
  ok('desmarcarla le pide a Rust dejar de recordar', sent && sent.enabled === false, JSON.stringify(sent));
  ok('el menú refleja el nuevo valor sin cerrarse', await h.eval(`return ${item}.getAttribute('aria-checked') === 'false' && !document.getElementById('prefs-menu').classList.contains('hidden')`));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
