// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Idiomas ampliables y coreano (RF-39, RF-40) sobre el motor Chromium de WebView2: detección por el idioma
// del sistema sin guardarlo, selector desplegable que se construye del registro, cambio en caliente, la
// elección explícita que se guarda, la guía de sintaxis de cada idioma (todas las anclas de su índice
// resuelven) con reserva inglesa, la lista de Android y que la cabecera quepa en 640 px también en coreano.
//
// @spec RF-16, RF-22, RF-39, RF-40, RF-47

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

/** Recarga la página como si el sistema estuviera en `tag` (el motor lo toma de `acceptLanguage`). */
async function reloadAs(h, tag) {
  const ua = await h.eval('return navigator.userAgent');
  await h.send('Emulation.setUserAgentOverride', { userAgent: ua, acceptLanguage: tag });
  await h.send('Page.reload');
  await h.sleep(1700);
}

const state = (h) => h.eval(`return {
  html: document.documentElement.lang,
  current: document.getElementById('lang-current')?.textContent,
  file: document.querySelector('[data-i18n="menu.file"]')?.textContent,
  nav: navigator.language,
  stored: localStorage.getItem('dbv-md-lang'),
}`);

async function desktop() {
  console.log('RF-39 · detección, selector y persistencia');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1200 });
  await h.eval(`localStorage.clear()`);

  await reloadAs(h, 'ko-KR');
  let s = await state(h);
  ok('sistema en coreano → la interfaz arranca en coreano', s.html === 'ko' && s.file === '파일' && s.current === 'KO', JSON.stringify(s));
  ok('lo autodetectado NO se guarda como elección', s.stored === null, String(s.stored));

  await reloadAs(h, 'fr-FR');
  s = await state(h);
  ok('sistema en un idioma no soportado (francés) → inglés', s.html === 'en' && s.file === 'File', JSON.stringify(s));

  await reloadAs(h, 'es-MX');
  s = await state(h);
  ok('sistema en español (es-MX) → español', s.html === 'es' && s.file === 'Archivo', JSON.stringify(s));

  // El selector se construye del registro: un desplegable con los nombres nativos.
  await h.eval(`document.getElementById('btn-lang').click()`);
  await h.sleep(150);
  const list = await h.eval(`return { names: Array.from(document.querySelectorAll('#lang-menu .menu-item')).map((i) => i.textContent.replace('✓', '').trim()), checked: Array.from(document.querySelectorAll('#lang-menu .menu-item')).filter((i) => i.getAttribute('aria-checked') === 'true').map((i) => i.dataset.lang), open: !document.getElementById('lang-menu').classList.contains('hidden') }`);
  ok('el desplegable lista Español, English y 한국어 con su nombre nativo', JSON.stringify(list.names) === JSON.stringify(['Español', 'English', '한국어']), JSON.stringify(list));
  ok('marca con ✓ el idioma activo', JSON.stringify(list.checked) === '["es"]' && list.open, JSON.stringify(list.checked));

  // Elegir coreano: cambia en caliente, se guarda y se cierra el desplegable.
  await h.eval(`document.querySelector('#lang-menu .menu-item[data-lang="ko"]').click()`);
  await h.sleep(250);
  s = await state(h);
  ok('elegir 한국어 cambia toda la interfaz al instante', s.html === 'ko' && s.file === '파일' && s.current === 'KO', JSON.stringify(s));
  ok('la elección explícita sí se guarda', s.stored === 'ko');
  ok('el desplegable se cierra al elegir', await h.eval(`return document.getElementById('lang-menu').classList.contains('hidden')`));
  const muted = await h.eval(`const p = document.querySelector('#recent-list p'); return { text: p ? p.textContent : null, kids: p ? p.children.length : -1 }`);
  ok('los mensajes de «vacío» se pintan como texto, nunca como HTML (el diccionario puede ser de un tercero)', !!muted.text && muted.kids === 0, JSON.stringify(muted));

  // La elección guardada gana a un sistema en otro idioma.
  await reloadAs(h, 'es-ES');
  s = await state(h);
  ok('la elección guardada gana al idioma del sistema', s.html === 'ko', JSON.stringify(s));

  // Guía de sintaxis (RF-22) en cada idioma: contenido propio y todas las anclas del índice resuelven.
  for (const lang of ['ko', 'es', 'en']) {
    await h.eval(`document.querySelector('#lang-menu .menu-item[data-lang="${lang}"]') || document.getElementById('btn-lang').click(); window.DBVApp.setLanguage('${lang}');`);
    await h.sleep(200);
    await h.eval(`document.getElementById('btn-markdown-help').click()`);
    await h.sleep(800);
    await h.eval(`document.getElementById('help-tab-syntax').click()`); // RF-47: la ayuda abre en la guía de la aplicación
    await h.sleep(1500);
    const help = await h.eval(`const root = document.getElementById('help-content'); const anchors = Array.from(root.querySelectorAll('a[href^="#"]')); const missing = anchors.filter((a) => !root.querySelector('[id="' + decodeURIComponent(a.getAttribute('href').slice(1)).replace(/"/g, '') + '"]')).map((a) => a.getAttribute('href')); return { h1: root.querySelector('h1')?.textContent, anchors: anchors.length, missing, error: root.textContent.includes('help.loadError') };`);
    ok(`guía en ${lang}: carga y las ${help.anchors} anclas del índice resuelven`, !!help.h1 && help.anchors >= 20 && help.missing.length === 0, JSON.stringify({ h1: help.h1, missing: help.missing }));
    await h.eval(`document.getElementById('help-close').click()`);
    await h.sleep(150);
  }
  const heading = await h.eval(`window.DBVApp.setLanguage('ko'); document.getElementById('btn-markdown-help').click(); await new Promise((r) => setTimeout(r, 800)); document.getElementById('help-tab-syntax').click(); await new Promise((r) => setTimeout(r, 1200)); return document.querySelector('#help-content h2')?.textContent`);
  ok('la guía coreana está en coreano', /목차|제목|Markdown/.test(heading ?? ''), heading);
  await h.eval(`document.getElementById('help-close').click()`);

  // Reserva de la guía: un idioma registrado sin fichero propio usa la inglesa.
  await h.eval(`window.DBV_I18N.registerLanguage('zz', 'Zzz', {}); window.DBVApp.setLanguage('zz'); document.getElementById('btn-markdown-help').click();`);
  await h.sleep(1500);
  const fallback = await h.eval(`return document.getElementById('help-content').querySelector('h1')?.textContent ?? ''`);
  ok('un idioma sin guía propia usa la guía inglesa', /Markdown/.test(fallback) && !/help\.loadError/.test(fallback), fallback);
  await h.eval(`document.getElementById('help-close').click()`);

  // Coreano a 640 px: la cabecera no desborda y se ve el texto (captura para revisión visual).
  await h.eval(`window.DBVApp.setLanguage('ko')`);
  await h.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 700, deviceScaleFactor: 1, mobile: false });
  await h.sleep(300);
  const m = await h.eval(`const hd = document.getElementById('app-header'); return { scroll: hd.scrollWidth - hd.clientWidth }`);
  ok('a 640 px, en coreano, la cabecera no desborda', m.scroll <= 0, JSON.stringify(m));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

async function android() {
  console.log('RF-39 · Android: lista de idiomas en Ajustes');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc });
  await h.eval(`localStorage.clear()`);
  await h.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  await h.send('Page.reload');
  await h.sleep(1800);
  const r = await h.eval(`const sel = document.getElementById('m-lang-select'); return { options: Array.from(sel.options).map((o) => o.value + ':' + o.textContent), value: sel.value, old: !!document.getElementById('m-lang-es') }`);
  ok('la lista de Ajustes sale del registro (es, en, ko) y reemplaza a los dos botones', r.options.length === 3 && !r.old, JSON.stringify(r));
  await h.eval(`const sel = document.getElementById('m-lang-select'); sel.value = 'ko'; sel.dispatchEvent(new Event('change'));`);
  await h.sleep(300);
  const after = await h.eval(`return { html: document.documentElement.lang, stored: localStorage.getItem('dbv-md-lang') }`);
  ok('elegir coreano en Android cambia el idioma y lo guarda', after.html === 'ko' && after.stored === 'ko', JSON.stringify(after));
  await h.close();
}

await desktop();
await android();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
