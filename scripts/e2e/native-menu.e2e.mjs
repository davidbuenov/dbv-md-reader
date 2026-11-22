// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Menús Archivo / Herramientas / Preferencias en la barra del sistema de macOS (RF-65), sobre Chromium con la
// plataforma simulada y `set_native_menu` registrado por el simulador de Tauri. No comprueba el menú real de
// macOS (eso es la prueba manual): comprueba lo que la webview PUBLICA y cómo reacciona al evento de vuelta.
//
// @spec RF-65

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Párrafo.', ''].join('\n');
const customInvoke = `((cmd, args) => {
  if (cmd === 'ai_set_preferences') return { connections: [], active: null, showAi: args.showAi };
  if (cmd === 'save_new_file_dialog' || cmd === 'open_file_dialog' || cmd === 'save_typst_dialog') return null;
  return undefined;
})`;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const published = (h) => h.eval(`return window.__calls.filter((c) => c[0] === 'set_native_menu').map((c) => c[1].spec)`);
const last = async (h) => (await published(h)).at(-1);
const find = (spec, menu, label) => spec.menus.find((m) => m.id === menu)?.items.find((i) => i.label === label);

async function mac() {
  console.log('RF-65 · menú nativo de macOS');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke, width: 1400, platform: 'MacIntel' });
  await h.send('Emulation.setFocusEmulationEnabled', { enabled: true }); // la ventana de la prueba tiene el foco
  await h.eval(`window.__printed = 0; window.print = () => { window.__printed++; };`);
  await h.sleep(700);

  const hidden = await h.eval(`return { cls: document.body.classList.contains('native-menus'), menus: Array.from(document.querySelectorAll('.toolbar-right > .header-menu:not(#lang-switcher)')).length === 3 && Array.from(document.querySelectorAll('.toolbar-right > .header-menu:not(#lang-switcher)')).every((e) => getComputedStyle(e).display === 'none'), lang: getComputedStyle(document.getElementById('lang-switcher')).display !== 'none', search: getComputedStyle(document.getElementById('btn-search')).display !== 'none' }`);
  ok('los menús de la ventana se ocultan y el resto de la cabecera se queda', hidden.cls && hidden.menus && hidden.lang && hidden.search, JSON.stringify(hidden));

  let spec = await last(h);
  ok('se publica la descripción: Archivo, Herramientas y Preferencias, en ese orden', !!spec && spec.menus.map((m) => m.id).join() === 'file,tools,prefs' && spec.menus.map((m) => m.title).join() === 'Archivo,Herramientas,Preferencias', JSON.stringify(spec?.menus.map((m) => m.title)));

  const todas = spec.menus.flatMap((m) => m.items);
  ok('las entradas salen del DOM: Nuevo, Abrir, Guardar como… con su acelerador', find(spec, 'file', 'Nuevo documento')?.accel === 'CmdOrCtrl+N' && find(spec, 'file', 'Abrir archivo…')?.accel === 'CmdOrCtrl+O' && find(spec, 'file', 'Guardar como…')?.accel === 'CmdOrCtrl+Shift+S');
  ok('«Salir» no se duplica (⌘Q es del menú de la app)', !todas.some((i) => i.label === 'Salir'));
  ok('sin separadores huérfanos', spec.menus.every((m) => m.items.length && m.items[0].kind !== 'sep' && m.items.at(-1).kind !== 'sep' && m.items.every((i, n) => !(i.kind === 'sep' && m.items[n - 1]?.kind === 'sep'))));
  ok('lo que depende del contexto sale deshabilitado, no oculto (Guardar y Vista previa fuera de edición)', find(spec, 'file', 'Guardar')?.enabled === false && find(spec, 'tools', 'Ir a la vista previa')?.enabled === false && find(spec, 'file', 'Imprimir / PDF…')?.enabled === true);
  ok('las preferencias son casillas con su estado', find(spec, 'prefs', 'Mostrar las funciones de IA')?.kind === 'check' && find(spec, 'prefs', 'Mostrar las funciones de IA')?.checked === true && find(spec, 'prefs', 'Normal')?.kind === 'check');
  ok('todos los ids son legibles para Rust (sin espacios ni signos) y las cabeceras de grupo no se pierden', todas.filter((i) => i.kind !== 'sep').every((i) => /^[A-Za-z0-9_:~.-]+$/.test(i.id)) && !!spec.menus.find((m) => m.id === 'prefs').items.find((i) => i.label === 'Ancho de lectura' && i.enabled === false));
  ok('los ids son únicos', new Set(todas.filter((i) => i.kind !== 'sep').map((i) => i.id)).size === todas.filter((i) => i.kind !== 'sep').length);

  // Estado vivo: entrar en Modo Edición habilita Guardar y Vista previa sin ninguna acción en el menú.
  const antes = (await published(h)).length;
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(1300);
  spec = await last(h);
  ok('al entrar en Modo Edición se republica con Guardar y Vista previa habilitados', (await published(h)).length > antes && find(spec, 'file', 'Guardar')?.enabled === true && find(spec, 'tools', 'Ir a la vista previa')?.enabled === true);
  const quieto = (await published(h)).length;
  await h.sleep(1300);
  ok('en reposo no hay más llamadas (sin IPC mientras nada cambia)', (await published(h)).length === quieto);
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(900);

  // Evento de vuelta: una entrada del menú nativo dispara la acción original.
  await h.eval(`window.__emit('menu-item', 'file:btn-print')`); await h.sleep(300);
  ok('el evento «menu-item» de Imprimir llama a window.print', (await h.eval(`return window.__printed`)) === 1);
  await h.eval(`window.__emit('menu-item', 'file:no-existe'); window.__emit('menu-item', null)`); await h.sleep(200);
  ok('un id desconocido no hace nada', (await h.eval(`return window.__printed`)) === 1 && (await h.errors()).length === 0);

  const nuevo = await h.eval(`return window.__calls.filter((c) => c[0] === 'open_file_dialog').length`);
  await h.eval(`window.__emit('menu-item', 'file:btn-open-file')`); await h.sleep(400);
  ok('Abrir archivo… abre el diálogo de siempre', (await h.eval(`return window.__calls.filter((c) => c[0] === 'open_file_dialog').length`)) === nuevo + 1);

  // Casilla: el DOM manda y se vuelve a publicar con el valor real.
  await h.eval(`window.__emit('menu-item', 'prefs:showAi')`); await h.sleep(900);
  spec = await last(h);
  ok('una casilla de Preferencias actúa y se republica con el valor nuevo', (await h.eval(`return window.__calls.filter((c) => c[0] === 'ai_set_preferences').at(-1)[1].showAi`)) === false && find(spec, 'prefs', 'Mostrar las funciones de IA')?.checked === false);
  ok('con la IA apagada «Conectar una IA…» desaparece del menú nativo', !find(spec, 'tools', 'Conectar una IA…'));
  await h.eval(`window.__emit('menu-item', 'prefs:showAi')`); await h.sleep(900);
  ok('y vuelve al encenderla', !!find(await last(h), 'tools', 'Conectar una IA…'));

  // Idioma: el menú nativo sigue el idioma de la app.
  await h.eval(`window.DBVApp.setLanguage('en')`); await h.sleep(900);
  spec = await last(h);
  ok('al cambiar de idioma se republica con las etiquetas nuevas', spec.menus.map((m) => m.title).join() === 'File,Tools,Preferences' && !!find(spec, 'file', 'New document'), JSON.stringify(spec.menus.map((m) => m.title)));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

async function windows() {
  console.log('RF-65 · Windows y Linux no cambian');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke, width: 1400, platform: 'Win32' });
  await h.sleep(1200);
  const r = await h.eval(`return { cls: document.body.classList.contains('native-menus'), menus: Array.from(document.querySelectorAll('.toolbar-right > .header-menu')).every((e) => getComputedStyle(e).display !== 'none'), calls: window.__calls.filter((c) => c[0] === 'set_native_menu').length }`);
  ok('sin macOS no hay clase native-menus, los menús de la ventana siguen y no se llama a Rust', !r.cls && r.menus && r.calls === 0, JSON.stringify(r));
  await h.close();
}

await mac();
await windows();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
