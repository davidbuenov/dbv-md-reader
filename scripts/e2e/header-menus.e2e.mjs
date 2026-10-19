// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cabecera con menús Archivo / Herramientas / Preferencias (RF-38) sobre el motor Chromium de WebView2:
// inventario de controles (ninguna acción se pierde), cada entrada dispara su acción, los menús se
// operan con teclado, lo que depende del contexto se deshabilita (no se oculta), las casillas no cierran
// Preferencias, la cabecera cabe en 640 px y Android conserva su barra sin menús.
//
// @spec RF-38, RF-19

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
const called = (h, cmd) => h.eval(`return window.__calls.filter((c) => c[0] === '${cmd}').length`);

/** Visible = existe, su `display` no es `none` y ocupa sitio. */
const visibleExpr = (id) => `(() => { const e = document.getElementById('${id}'); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; })()`;
const openMenu = async (h, id) => { await h.eval(`document.getElementById('${id}').click()`); await h.sleep(120); };
const pick = async (h, target) => { await h.eval(`document.querySelector('.menu-item[data-target="${target}"], .menu-item[data-action="${target}"], .menu-item[data-pref="${target}"]').click()`); await h.sleep(250); };

async function main() {
  console.log('RF-38 · inventario y acciones');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke, width: 1400 });
  await h.eval(`window.__printed = 0; window.print = () => { window.__printed++; };`);

  // 1. Inventario: lo que pasa a los menús tiene su entrada con el mismo destino; lo demás sigue en la barra.
  const inMenus = ['btn-new-file', 'btn-open-file', 'btn-open-url', 'btn-recent', 'btn-save', 'btn-print', 'btn-export-typst', 'btn-ai', 'btn-markdown-help', 'btn-about'];
  const items = await h.eval(`return Array.from(document.querySelectorAll('.menu-item[data-target]')).map((i) => i.dataset.target)`);
  ok('cada acción movida tiene su entrada de menú', inMenus.every((id) => items.includes(id)), items.join(','));
  const stillThere = await h.eval(`return ${JSON.stringify(inMenus)}.every((id) => !!document.getElementById(id))`);
  ok('los botones originales siguen en el DOM con su id (ids y bancos intactos)', stillThere);
  const barIds = ['btn-search', 'btn-edit-toggle', 'btn-toggle-toc', 'btn-always-on-top', 'btn-markdown-help', 'btn-about', 'theme-light', 'theme-dark', 'theme-sepia', 'lang-switcher'];
  const bar = {};
  for (const id of barIds) bar[id] = await h.eval(`return ${visibleExpr(id)}`);
  ok('siguen visibles en la barra: Buscar, Modo Edición, panel, chincheta, ?, i, tema e idioma', Object.values(bar).every(Boolean), JSON.stringify(bar));
  const hidden = {};
  for (const id of ['btn-new-file', 'btn-open-file', 'btn-open-url', 'btn-print', 'btn-export-typst']) hidden[id] = await h.eval(`return ${visibleExpr(id)}`);
  ok('los botones movidos ya no ocupan sitio en la barra de escritorio', Object.values(hidden).every((v) => !v), JSON.stringify(hidden));
  ok('los tres menús existen y están cerrados', await h.eval(`return ['file-menu', 'tools-menu', 'prefs-menu'].every((id) => document.getElementById(id).classList.contains('hidden'))`));
  const order = await h.eval(`return ['btn-file-menu', 'btn-tools-menu', 'btn-prefs-menu'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().left))`);
  ok('Archivo, Herramientas y Preferencias van en ese orden de izquierda a derecha', order[0] < order[1] && order[1] < order[2], order.join(' < '));

  // 2. Cada entrada de Archivo dispara su acción y cierra el menú.
  await openMenu(h, 'btn-file-menu');
  ok('abrir Archivo lo muestra y marca aria-expanded', await h.eval(`return !document.getElementById('file-menu').classList.contains('hidden') && document.getElementById('btn-file-menu').getAttribute('aria-expanded') === 'true'`));
  await pick(h, 'btn-new-file');
  ok('Nuevo documento abre el diálogo de guardado', (await called(h, 'save_new_file_dialog')) === 1);
  ok('elegir una entrada cierra el menú', await h.eval(`return document.getElementById('file-menu').classList.contains('hidden')`));
  await openMenu(h, 'btn-file-menu'); await pick(h, 'btn-open-file');
  ok('Abrir archivo abre el diálogo de apertura', (await called(h, 'open_file_dialog')) === 1);
  await openMenu(h, 'btn-file-menu'); await pick(h, 'btn-open-url');
  ok('Abrir desde URL muestra su panel', await h.eval(`return !document.getElementById('url-panel').classList.contains('hidden')`));
  await h.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));`);
  await openMenu(h, 'btn-file-menu'); await pick(h, 'btn-recent');
  await h.sleep(300);
  ok('Archivos recientes abre su panel y se queda abierto (no lo cierra el mismo clic)', await h.eval(`return !document.getElementById('recent-panel').classList.contains('hidden')`));
  await h.eval(`document.body.click()`); await h.sleep(150);
  await openMenu(h, 'btn-file-menu'); await pick(h, 'btn-print');
  ok('Imprimir llama a window.print', (await h.eval(`return window.__printed`)) === 1);
  await openMenu(h, 'btn-file-menu'); await pick(h, 'btn-export-typst');
  ok('Exportar a Typst abre su diálogo', (await called(h, 'save_typst_dialog')) === 1);

  // 3. Habilitado / deshabilitado según el contexto (no se oculta).
  await openMenu(h, 'btn-tools-menu');
  const st = await h.eval(`const q = (s) => document.querySelector(s); return { preview: q('.menu-item[data-action="goPreview"]').disabled, quick: q('.menu-item[data-action="quickOpen"]').disabled, visible: !q('.menu-item[data-action="goPreview"]').classList.contains('hidden') }`);
  ok('«Ir a la vista previa» está deshabilitada fuera del Modo Edición, pero visible', st.preview === true && st.visible === true && st.quick === false, JSON.stringify(st));
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);
  await openMenu(h, 'btn-tools-menu');
  ok('en Modo Edición se habilita', await h.eval(`return document.querySelector('.menu-item[data-action="goPreview"]').disabled === false`));
  await openMenu(h, 'btn-file-menu');
  ok('«Guardar» se habilita en Modo Edición', await h.eval(`return document.querySelector('.menu-item[data-target="btn-save"]').disabled === false`));
  ok('al abrir Archivo se cierra Herramientas (uno solo abierto)', await h.eval(`return document.getElementById('tools-menu').classList.contains('hidden')`));
  await h.eval(`document.getElementById('btn-edit-toggle').click()`); await h.sleep(400);

  // 4. Preferencias: las casillas no cierran el menú y reflejan el valor real.
  await openMenu(h, 'btn-prefs-menu');
  ok('«Mostrar las funciones de IA» arranca marcada', await h.eval(`return document.querySelector('.menu-item[data-pref="showAi"]').getAttribute('aria-checked') === 'true'`));
  await h.eval(`document.querySelector('.menu-item[data-pref="showAi"]').click()`); await h.sleep(400);
  const prefs = await h.eval(`return { open: !document.getElementById('prefs-menu').classList.contains('hidden'), checked: document.querySelector('.menu-item[data-pref="showAi"]').getAttribute('aria-checked'), aiBtn: ${visibleExpr('btn-ai')} }`);
  ok('marcar una casilla no cierra Preferencias', prefs.open === true);
  ok('la casilla se desmarca y la IA desaparece de la barra', prefs.checked === 'false' && prefs.aiBtn === false, JSON.stringify(prefs));
  ok('se pidió guardar el ajuste en Rust', (await h.eval(`return window.__calls.filter((c) => c[0] === 'ai_set_preferences').at(-1)[1].showAi`)) === false);
  await h.eval(`document.querySelector('.menu-item[data-pref="showAi"]').click()`); await h.sleep(400);
  await openMenu(h, 'btn-tools-menu');
  ok('con la IA apagada su entrada desaparece de Herramientas (no existe) y vuelve al encenderla', await h.eval(`return !document.querySelector('.menu-item[data-target="btn-ai"]').classList.contains('hidden')`));

  // 5. Teclado.
  await h.eval(`window.DBVHeaderMenu.closeAll(); document.getElementById('btn-file-menu').focus()`);
  await h.key('ArrowDown', 'ArrowDown', 40); await h.sleep(150);
  ok('ArrowDown sobre el botón abre el menú y enfoca la primera entrada', await h.eval(`return document.activeElement.dataset.target === 'btn-new-file'`));
  await h.key('ArrowDown', 'ArrowDown', 40); await h.sleep(100);
  ok('ArrowDown pasa a la siguiente entrada', await h.eval(`return document.activeElement.dataset.target === 'btn-open-file'`));
  await h.key('End', 'End', 35); await h.sleep(100);
  ok('End va a la última entrada habilitada', await h.eval(`return document.activeElement.dataset.target === 'btn-export-typst'`));
  await h.key('Escape', 'Escape', 27); await h.sleep(150);
  ok('Escape cierra el menú y devuelve el foco al botón', await h.eval(`return document.getElementById('file-menu').classList.contains('hidden') && document.activeElement.id === 'btn-file-menu'`));
  ok('los atajos se muestran con el nombre de la plataforma', await h.eval(`return document.querySelector('.menu-item[data-target="btn-new-file"] .menu-item__keys').textContent === 'Ctrl+N' && document.querySelector('.menu-item[data-target="btn-ai"] .menu-item__keys').textContent === 'Ctrl+Mayús+I'`));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));

  // 6. Ancho mínimo de ventana.
  for (const width of [640, 1120]) {
    await h.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
    await h.sleep(300);
    const m = await h.eval(`const hd = document.getElementById('app-header'); const r = document.querySelector('.toolbar-right').getBoundingClientRect(); return { scroll: hd.scrollWidth - hd.clientWidth, right: Math.round(r.width), left: Math.round(document.querySelector('.toolbar-left').getBoundingClientRect().width) }`);
    ok(`a ${width} px la cabecera no desborda`, m.scroll <= 0, `zona derecha ${m.right} px, izquierda ${m.left} px`);
  }
  await h.close();
}

async function noDocument() {
  console.log('RF-38 · sin documento abierto');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke: `((cmd) => cmd === 'get_cli_argument' ? null : undefined)` });
  await openMenu(h, 'btn-file-menu');
  const s = await h.eval(`const q = (t) => document.querySelector('.menu-item[data-target="' + t + '"]'); return { print: q('btn-print').disabled, typst: q('btn-export-typst').disabled, open: q('btn-open-file').disabled, save: q('btn-save').disabled }`);
  ok('sin documento, Imprimir y Exportar se deshabilitan; Abrir sigue habilitado', s.print && s.typst && !s.open && s.save, JSON.stringify(s));
  await h.close();
}

async function android() {
  console.log('RF-38 · Android conserva su barra');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc });
  await h.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  await h.send('Page.reload');
  await h.sleep(1800);
  const r = await h.eval(`return { android: document.body.classList.contains('is-android'), menus: !!document.querySelector('.desktop-menus'), menu: getComputedStyle(document.querySelector('.header-menu')).display, open: getComputedStyle(document.getElementById('btn-open-file')).display, newf: getComputedStyle(document.getElementById('btn-new-file')).display, recent: getComputedStyle(document.getElementById('btn-recent')).display }`);
  ok('en Android no hay menús y los botones originales siguen visibles', r.android && !r.menus && r.menu === 'none' && r.open !== 'none' && r.recent !== 'none', JSON.stringify(r));
  await h.close();
}

await main();
await noDocument();
await android();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
