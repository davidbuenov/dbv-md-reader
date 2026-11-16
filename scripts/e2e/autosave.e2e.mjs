// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Guardado automático (RF-54) sobre el motor Chromium de WebView2, con `write_file` simulado: apagado no escribe
// nunca; encendido escribe a los 2 s de la última pulsación (no antes) y avisa en la barra de estado; salir del
// Modo Edición guarda sin preguntar; con el fichero cambiado en disco (RF-21) no escribe ni abre más diálogos y
// avisa una sola vez; un documento remoto no entra en edición ni se escribe.
//
// @spec RF-54

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const PATH = 'C:/x/test.md';
const doc = ['# Título', '', 'Párrafo.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const writes = (h) => h.eval(`return window.__calls.filter((c) => c[0] === 'write_file').map((c) => c[1])`);
const type = (h, text) => h.eval(`const ta = document.getElementById('editor-textarea'); ta.value += ${JSON.stringify(text)}; ta.dispatchEvent(new Event('input', { bubbles: true }))`);
const msg = (h) => h.eval(`return document.getElementById('editor-status-msg').textContent`);
const hidden = (h, id) => h.eval(`return document.getElementById('${id}').classList.contains('hidden')`);

async function start(prefOn, docPath = PATH) {
  const h = await launch({ appDir, docPath, docContent: doc, width: 1400 });
  await h.eval(`localStorage.setItem('dbv-md-autosave', '${prefOn ? '1' : '0'}'); window.DBVPrefs.autoSave.set(${prefOn})`);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  return h;
}

async function off() {
  console.log('RF-54 · apagado (por defecto)');
  const h = await launch({ appDir, docPath: PATH, docContent: doc, width: 1400 });
  ok('desactivado por defecto', await h.eval(`return window.DBVPrefs.autoSave.get() === false`));
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  await type(h, 'x'); await h.sleep(2600);
  ok('apagado no escribe nunca', (await writes(h)).length === 0);
  ok('y sigue «Modificado»', !(await hidden(h, 'doc-modified-badge')));
  await h.close();
}

async function on() {
  console.log('RF-54 · encendido');
  const h = await start(true);
  await type(h, 'a'); await h.sleep(1000);
  await type(h, 'b'); await h.sleep(1500);
  ok('cada pulsación reinicia la espera: a 1,5 s de la última, nada', (await writes(h)).length === 0);
  await h.sleep(800);
  const w = await writes(h);
  ok('a los 2 s de la última escribe una sola vez, con el texto del editor', w.length === 1 && w[0].path === PATH && w[0].content.endsWith('ab'), JSON.stringify(w));
  ok('desaparece «Modificado» y la barra de estado lo dice', (await hidden(h, 'doc-modified-badge')) && (await msg(h)) === 'Guardado automáticamente', await msg(h));
  await h.sleep(2800);
  ok('sin cambios nuevos no vuelve a escribir', (await writes(h)).length === 1);

  // Salir del Modo Edición guarda sin preguntar.
  await type(h, 'c');
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(500);
  const w2 = await writes(h);
  ok('salir del Modo Edición guarda en el acto, sin el diálogo de descartar', w2.length === 2 && w2[1].content.endsWith('abc') && (await hidden(h, 'discard-modal')), JSON.stringify(w2.map((x) => x.content.slice(-3))));
  ok('y sale del Modo Edición', await h.eval(`return !document.getElementById('reader-container').classList.contains('edit-mode')`));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

async function conflict() {
  console.log('RF-54 · nunca pisa un cambio externo');
  const h = await start(true);
  await type(h, 'z');
  await h.eval(`window.__emit('file-changed', ${JSON.stringify(PATH)})`); await h.sleep(200);
  ok('el cambio en disco abre el aviso de conflicto de siempre (RF-21)', !(await hidden(h, 'conflict-modal')));
  await h.eval(`document.getElementById('conflict-keep').click()`); await h.sleep(200);
  await h.sleep(2300);
  ok('con el conflicto pendiente no escribe', (await writes(h)).length === 0);
  ok('ni abre más diálogos', (await hidden(h, 'conflict-modal')) && (await hidden(h, 'discard-modal')));
  ok('avisa en la barra de estado', (await msg(h)).includes('cambió en disco'), await msg(h));
  await h.eval(`document.getElementById('editor-status-msg').textContent = ''`);
  await type(h, 'y'); await h.sleep(2300);
  ok('una sola vez por episodio: el segundo intento no repite el aviso', (await msg(h)) === '' && (await writes(h)).length === 0, await msg(h));
  // Guardar a mano resuelve el episodio y el automático vuelve a funcionar.
  await h.eval(`document.getElementById('btn-save').click()`); await h.sleep(300);
  await h.sleep(900);
  await type(h, 'w'); await h.sleep(2400);
  const w = await writes(h);
  ok('tras guardar a mano, el automático vuelve a escribir', w.length === 2 && w[1].content.endsWith('zyw'), JSON.stringify(w.map((x) => x.content.slice(-3))));
  await h.close();
}

async function remote() {
  console.log('RF-54 · documento remoto');
  const h = await start(true, 'https://example.com/a.md');
  ok('un documento remoto no entra en Modo Edición', await h.eval(`return !document.getElementById('reader-container').classList.contains('edit-mode') && document.getElementById('btn-edit-toggle').disabled`));
  await h.sleep(2300);
  ok('y no se escribe nada', (await writes(h)).length === 0);
  await h.close();
}

await off();
await on();
await conflict();
await remote();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
