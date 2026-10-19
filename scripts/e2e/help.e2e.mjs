// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ayuda con dos pestañas (RF-47) sobre el motor Chromium de WebView2: la guía de la aplicación y la sintaxis
// Markdown, cada una en el idioma activo (con reserva inglesa), abiertas desde el botón «?», el menú
// Herramientas y F1; las pestañas quedan fijas mientras el contenido hace scroll, los enlaces del índice
// llevan al encabezado dentro del propio diálogo y el diálogo cabe en ventanas pequeñas.
//
// @spec RF-47, RF-22, RF-38, RF-39

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Párrafo.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const isOpen = (h) => h.eval(`return !document.getElementById('help-modal').classList.contains('hidden')`);
const shown = (h) => h.eval(`
  const root = document.getElementById('help-content');
  const anchors = Array.from(root.querySelectorAll('a[href^="#"]'));
  const missing = anchors.filter((a) => !root.querySelector('[id="' + decodeURIComponent(a.getAttribute('href').slice(1)).replace(/"/g, '') + '"]')).map((a) => a.getAttribute('href'));
  const tabs = Array.from(document.querySelectorAll('#help-tabs .help-tab')).map((b) => ({ id: b.id, text: b.textContent, selected: b.getAttribute('aria-selected'), active: b.classList.contains('active') }));
  return { h1: root.querySelector('h1')?.textContent, anchors: anchors.length, missing, error: root.textContent.includes('help.loadError'), tabs, scrollTop: root.scrollTop };`);
const closeHelp = async (h) => { await h.eval(`document.getElementById('help-close').click()`); await h.sleep(120); };
const openMenu = async (h, id) => { await h.eval(`document.getElementById('${id}').click()`); await h.sleep(120); };

async function main() {
  console.log('RF-47 · ayuda con guía de la aplicación y sintaxis');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400, height: 900 });
  await h.eval(`localStorage.clear()`);
  await h.eval(`window.DBVApp.setLanguage('es')`);
  await h.sleep(250);

  // 1. El botón «?» abre la guía de la aplicación.
  ok('la ayuda arranca cerrada', !(await isOpen(h)));
  await h.eval(`document.getElementById('btn-markdown-help').click()`);
  await h.sleep(1200);
  let s = await shown(h);
  ok('el botón «?» abre la ayuda', await isOpen(h));
  ok('abre en la guía de la aplicación, con su índice completo', /Guía de DBV Markdown Reader/.test(s.h1 ?? '') && s.anchors >= 11 && s.missing.length === 0 && !s.error, JSON.stringify({ h1: s.h1, anchors: s.anchors, missing: s.missing }));
  ok('hay dos pestañas y solo la de la guía está seleccionada', s.tabs.length === 2 && s.tabs[0].selected === 'true' && s.tabs[1].selected === 'false' && s.tabs[0].active && !s.tabs[1].active, JSON.stringify(s.tabs));
  ok('las pestañas están en español', s.tabs[0].text === 'Guía de la aplicación' && s.tabs[1].text === 'Sintaxis Markdown', s.tabs.map((t) => t.text).join(' | '));

  // 2. Un enlace del índice lleva al encabezado DENTRO del diálogo y las pestañas no se mueven.
  const before = await h.eval(`const t = document.getElementById('help-tabs').getBoundingClientRect(); return { top: Math.round(t.top), left: Math.round(t.left) }`);
  await h.eval(`document.querySelector('#help-content a[href="#6-editar"]').click()`);
  await h.sleep(1100);
  const nav = await h.eval(`
    const root = document.getElementById('help-content');
    const heading = document.getElementById('6-editar');
    const t = document.getElementById('help-tabs').getBoundingClientRect();
    return { scrollTop: Math.round(root.scrollTop), offset: Math.round(heading.getBoundingClientRect().top - root.getBoundingClientRect().top), pageScroll: window.scrollY, tabs: { top: Math.round(t.top), left: Math.round(t.left) } };`);
  ok('el enlace del índice hace scroll dentro del contenido hasta el encabezado', nav.scrollTop > 200 && Math.abs(nav.offset) < 60, JSON.stringify(nav));
  ok('las pestañas quedan fijas mientras el contenido se desplaza', nav.tabs.top === before.top && nav.tabs.left === before.left && nav.pageScroll === 0, JSON.stringify({ before, nav }));

  // 3. Cambiar de pestaña muestra la sintaxis, desde arriba.
  await h.eval(`document.getElementById('help-tab-syntax').click()`);
  await h.sleep(1500);
  s = await shown(h);
  ok('la pestaña de sintaxis muestra la chuleta (índice de 23 apartados resuelto)', /Guía de referencia Markdown/.test(s.h1 ?? '') && s.anchors >= 20 && s.missing.length === 0 && !s.error, JSON.stringify({ h1: s.h1, anchors: s.anchors, missing: s.missing }));
  ok('cambiar de pestaña vuelve al principio y mueve la selección', s.scrollTop === 0 && s.tabs[1].selected === 'true' && s.tabs[0].selected === 'false', JSON.stringify({ scrollTop: s.scrollTop, tabs: s.tabs.map((t) => t.selected) }));

  // 4. Teclado: flechas entre pestañas, y se recuerda la última al reabrir.
  await h.eval(`document.getElementById('help-tab-syntax').focus()`);
  await h.key('ArrowLeft', 'ArrowLeft', 37); await h.sleep(900);
  s = await shown(h);
  ok('ArrowLeft pasa a la guía de la aplicación y le da el foco', /Guía de DBV/.test(s.h1 ?? '') && (await h.eval(`return document.activeElement.id`)) === 'help-tab-app');
  await h.key('ArrowRight', 'ArrowRight', 39); await h.sleep(900);
  s = await shown(h);
  ok('ArrowRight vuelve a la sintaxis', /Guía de referencia/.test(s.h1 ?? '') && (await h.eval(`return document.activeElement.id`)) === 'help-tab-syntax');
  await h.key('Escape', 'Escape', 27); await h.sleep(200);
  ok('Esc cierra la ayuda', !(await isOpen(h)));
  await h.key('F1', 'F1', 112); await h.sleep(900);
  s = await shown(h);
  ok('F1 abre la ayuda y recuerda la última pestaña usada', (await isOpen(h)) && /Guía de referencia/.test(s.h1 ?? ''), s.h1);
  await closeHelp(h);

  // 5. Menú Herramientas: «Ayuda» (F1) y «Ayuda de sintaxis Markdown» abren cada una la suya.
  await openMenu(h, 'btn-tools-menu');
  const menu = await h.eval(`const items = Array.from(document.querySelectorAll('#tools-menu .menu-item')).filter((i) => /help|syntax/i.test((i.dataset.target || '') + (i.dataset.action || ''))).map((i) => ({ label: i.querySelector('.menu-item__label').textContent, keys: i.querySelector('.menu-item__keys')?.textContent ?? '', disabled: i.disabled })); return items;`);
  ok('el menú ofrece «Ayuda» con F1 y «Ayuda de sintaxis Markdown»', menu.length === 2 && menu[0].label === 'Ayuda' && menu[0].keys === 'F1' && menu[1].label === 'Ayuda de sintaxis Markdown' && !menu[0].disabled && !menu[1].disabled, JSON.stringify(menu));
  await h.eval(`document.querySelector('#tools-menu .menu-item[data-target="btn-markdown-help"]').click()`);
  await h.sleep(1200);
  s = await shown(h);
  ok('«Ayuda» del menú abre la última pestaña usada', (await isOpen(h)) && /Guía de referencia/.test(s.h1 ?? ''), s.h1);
  await closeHelp(h);
  await h.eval(`document.getElementById('help-tab-app').click()`);
  await h.sleep(300);
  await openMenu(h, 'btn-tools-menu');
  await h.eval(`document.querySelector('#tools-menu .menu-item[data-action="helpSyntax"]').click()`);
  await h.sleep(1500);
  s = await shown(h);
  ok('«Ayuda de sintaxis Markdown» abre directamente la sintaxis', (await isOpen(h)) && /Guía de referencia/.test(s.h1 ?? '') && s.tabs[1].selected === 'true', JSON.stringify({ h1: s.h1 }));
  await closeHelp(h);

  // 6. Idiomas: inglés propio; coreano con pestañas en coreano y la guía de la aplicación en inglés (reserva).
  await h.eval(`window.DBVApp.setLanguage('en')`);
  await h.sleep(300);
  await h.eval(`document.getElementById('btn-markdown-help').click()`);
  await h.sleep(800);
  await h.eval(`document.getElementById('help-tab-app').click()`);
  await h.sleep(1200);
  s = await shown(h);
  ok('en inglés: pestañas y guía en inglés con todas las anclas', /DBV Markdown Reader Guide/.test(s.h1 ?? '') && s.tabs[0].text === 'App guide' && s.tabs[1].text === 'Markdown syntax' && s.missing.length === 0 && s.anchors >= 11, JSON.stringify({ h1: s.h1, tabs: s.tabs.map((t) => t.text), missing: s.missing }));
  await closeHelp(h);
  await h.eval(`window.DBVApp.setLanguage('ko')`);
  await h.sleep(300);
  await h.eval(`document.getElementById('btn-markdown-help').click()`);
  await h.sleep(800);
  await h.eval(`document.getElementById('help-tab-app').click()`);
  await h.sleep(1200);
  s = await shown(h);
  ok('en coreano: pestañas en coreano y la guía de la aplicación cae al inglés', /DBV Markdown Reader Guide/.test(s.h1 ?? '') && /[가-힣]/.test(s.tabs[0].text) && /[가-힣]/.test(s.tabs[1].text) && s.missing.length === 0 && !s.error, JSON.stringify({ h1: s.h1, tabs: s.tabs.map((t) => t.text) }));
  await closeHelp(h);
  await h.eval(`window.DBVApp.setLanguage('es')`);
  await h.sleep(300);

  // 7. Geometría: en 1400×900 y en una ventana pequeña el diálogo cabe, sin desbordes, y el botón de cerrar no tapa las pestañas.
  const geometry = () => h.eval(`
    document.getElementById('btn-markdown-help').click();
    await new Promise((r) => setTimeout(r, 900));
    const card = document.getElementById('help-card').getBoundingClientRect();
    const tabs = document.getElementById('help-tabs').getBoundingClientRect();
    const close = document.getElementById('help-close').getBoundingClientRect();
    const content = document.getElementById('help-content');
    const result = { cardW: Math.round(card.width), cardH: Math.round(card.height), vw: innerWidth, vh: innerHeight, tabsRight: Math.round(tabs.right), closeLeft: Math.round(close.left), docOverflow: document.documentElement.scrollWidth - innerWidth, contentOverflowX: content.scrollWidth - content.clientWidth, scrollable: content.scrollHeight > content.clientHeight };
    return result;`);
  let g = await geometry();
  ok('a 1400 px: el diálogo cabe, el contenido hace scroll y no hay desborde horizontal', g.cardW <= g.vw && g.cardH <= g.vh && g.scrollable && g.docOverflow <= 0 && g.contentOverflowX <= 0, JSON.stringify(g));
  ok('el botón de cerrar no se solapa con las pestañas', g.tabsRight < g.closeLeft, JSON.stringify({ tabsRight: g.tabsRight, closeLeft: g.closeLeft }));
  await closeHelp(h);
  await h.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 520, deviceScaleFactor: 1, mobile: false });
  await h.sleep(300);
  g = await geometry();
  ok('a 640×520: el diálogo cabe en la ventana y no desborda', g.cardW <= g.vw && g.cardH <= g.vh && g.docOverflow <= 0 && g.contentOverflowX <= 0, JSON.stringify(g));
  ok('a 640 px las pestañas siguen sin tocar el botón de cerrar', g.tabsRight < g.closeLeft, JSON.stringify({ tabsRight: g.tabsRight, closeLeft: g.closeLeft }));
  await closeHelp(h);
  await h.send('Emulation.clearDeviceMetricsOverride');

  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
