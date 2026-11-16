// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Temas de la colección (RF-49) y diálogo «Temas y colores…» (RF-50) sobre el motor Chromium de WebView2:
// cada tema aplica sus variables, Mermaid cambia de tema sin desbordar, las alertas se leen, imprimir con
// Dracula da la paleta Clara, botones rápidos, tarjetas con teclado, Personalizado con su nota de contraste,
// persistencia tras recargar y propagación a una segunda ventana. Con `SHOTS=<carpeta>` guarda una captura
// por tema para revisarlas a ojo.
//
// @spec RF-49, RF-50

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = [
  '# Temas', '', 'Párrafo con `código` y un [enlace](#x).', '',
  '> [!NOTE]', '> Nota.', '', '> [!WARNING]', '> Aviso.', '', '> [!CAUTION]', '> Cuidado.', '',
  '```js', 'const x = 42; // comentario', 'function f() { return "hola"; }', '```', '',
  '```mermaid', 'graph LR', '  A[Inicio] --> B{¿Tema?}', '  B --> C[Oscuro]', '  B --> D[Claro]', '```', '',
].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const shots = process.env.SHOTS || '';

const ALL = ['dark', 'light', 'sepia', 'high-contrast', 'nord', 'dracula', 'catppuccin-mocha', 'catppuccin-latte', 'solarized-dark', 'gruvbox-dark', 'custom'];

/** Contraste WCAG entre dos `rgb(r, g, b)` calculados por el navegador. */
const contrastExpr = (fgExpr, bgExpr) => `(() => {
  const lum = (c) => { const v = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const a = lum(${fgExpr}), b = lum(${bgExpr});
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
})()`;

async function main() {
  console.log('RF-49 / RF-50 · temas y diálogo');
  const h = await launch({ appDir, docPath: 'C:/x/temas.md', docContent: doc, width: 1200, height: 860 });
  await h.sleep(1200);
  if (shots) mkdirSync(shots, { recursive: true });

  // 1. Arranque: Oscuro por defecto, hoja de tokens y nada en línea en <html> (D1).
  ok('arranca en Oscuro con la hoja #theme-tokens', await h.eval(`return document.documentElement.dataset.theme === 'dark' && !!document.getElementById('theme-tokens')`));
  // `--editor-font-size` (RF-43) sí va en línea; lo que no puede ir es ningún token de color.
  ok('ningún token de tema en línea en <html> (la impresión puede forzar la Clara)', await h.eval(`const s = document.documentElement.style; return DBVThemes.ALL_TOKEN_KEYS.every((k) => !s.getPropertyValue(k))`));
  ok('tres botones rápidos: Claro, Oscuro y Sepia, con el Oscuro activo', await h.eval(`return ['theme-slot-0','theme-slot-1','theme-slot-2'].map((id) => document.getElementById(id).dataset.themeId).join() === 'light,dark,sepia' && document.getElementById('theme-slot-1').classList.contains('active')`));
  ok('Mermaid dibujó el diagrama', await h.eval(`return !!document.querySelector('.mermaid-container svg')`));

  // 2. Cada tema aplica su paleta y se lee.
  const bad = [];
  for (const id of ALL) {
    const r = await h.eval(`
      DBVThemes.setTheme('${id}');
      await new Promise((r) => setTimeout(r, 350));
      const d = DBVThemes.describe('${id}', DBVThemes.getCustom());
      const cs = getComputedStyle(document.documentElement);
      const vars = ['--bg-primary', '--text-primary', '--code-keyword', '--alert-note'].every((k) => cs.getPropertyValue(k).trim() === d.tokens[k]);
      const body = getComputedStyle(document.getElementById('reader-container') || document.body);
      const p = document.querySelector('#content p');
      const text = ${contrastExpr(`getComputedStyle(p).color`, `getComputedStyle(document.body).backgroundColor`)};
      const alerts = [...document.querySelectorAll('.markdown-alert-title')].map((el) => ${contrastExpr(`getComputedStyle(el).color`, `getComputedStyle(document.body).backgroundColor`)});
      const svg = document.querySelector('.mermaid-container svg');
      const box = document.querySelector('.mermaid-container');
      const fits = svg && svg.getBoundingClientRect().width <= box.getBoundingClientRect().width + 1;
      return { vars, text, alertMin: Math.min(...alerts), fits, active: document.querySelector('.theme-btn.active')?.dataset.themeId || null };`);
    if (!r.vars || r.text < 4.5 || r.alertMin < 3 || !r.fits) bad.push(`${id}: ${JSON.stringify(r)}`);
    if (shots) await h.screenshot(path.join(shots, `tema-${id}.png`));
  }
  ok('los 11 temas aplican sus variables; texto ≥ 4,5:1, alertas ≥ 3:1 y Mermaid cabe', bad.length === 0, bad.join(' | '));

  // 3. Mermaid cambia de tema al pasar de oscuro a claro.
  const fillOf = `(() => { const n = document.querySelector('.mermaid-container svg .node rect, .mermaid-container svg .node polygon'); return n ? getComputedStyle(n).fill : ''; })()`;
  await h.eval(`DBVThemes.setTheme('dracula'); await new Promise((r) => setTimeout(r, 600));`);
  const darkFill = await h.eval(`return ${fillOf}`);
  await h.eval(`DBVThemes.setTheme('catppuccin-latte'); await new Promise((r) => setTimeout(r, 600));`);
  const lightFill = await h.eval(`return ${fillOf}`);
  ok('Mermaid se redibuja con otro tema al pasar de oscuro a claro', !!darkFill && !!lightFill && darkFill !== lightFill, `${darkFill} → ${lightFill}`);

  // 4. Imprimir con Dracula da la paleta Clara (RF-10).
  await h.eval(`DBVThemes.setTheme('dracula');`);
  await h.send('Emulation.setEmulatedMedia', { media: 'print' });
  const printBg = await h.eval(`return getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() + ' ' + getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()`);
  await h.send('Emulation.setEmulatedMedia', { media: '' });
  ok('imprimir con Dracula usa la paleta Clara', printBg === '#ffffff #1f2328', printBg);

  // 5. Botón rápido.
  await h.eval(`document.getElementById('theme-slot-2').click()`);
  ok('el botón rápido 3 activa Sepia y se marca', await h.eval(`return DBVThemes.getTheme() === 'sepia' && document.getElementById('theme-slot-2').getAttribute('aria-pressed') === 'true'`));

  // 6. Diálogo desde Preferencias.
  await h.eval(`document.getElementById('btn-prefs-menu').click()`); await h.sleep(120);
  await h.eval(`document.querySelector('.menu-item[data-action="themeDialog"]').click()`); await h.sleep(300);
  ok('Preferencias ▸ Temas y colores… abre el diálogo con 11 tarjetas', await h.eval(`return !document.getElementById('theme-modal').classList.contains('hidden') && document.querySelectorAll('.theme-card').length === 11`));
  ok('la tarjeta activa (Sepia) tiene el foco y aria-checked', await h.eval(`return document.activeElement?.dataset.themeId === 'sepia' && document.activeElement.getAttribute('aria-checked') === 'true'`));
  await h.key('ArrowRight', 'ArrowRight', 39); await h.sleep(150);
  ok('→ en las tarjetas activa el siguiente (Alto contraste) y mueve el foco', await h.eval(`return DBVThemes.getTheme() === 'high-contrast' && document.activeElement?.dataset.themeId === 'high-contrast'`));
  await h.eval(`document.querySelector('.theme-card[data-theme-id="nord"]').click()`); await h.sleep(150);
  ok('clic en una tarjeta activa el tema (Nord)', await h.eval(`return DBVThemes.getTheme() === 'nord' && document.querySelector('.theme-card--active')?.dataset.themeId === 'nord'`));
  await h.eval(`const s = document.querySelector('select[data-slot-index="0"]'); s.value = 'dracula'; s.dispatchEvent(new Event('change'));`); await h.sleep(150);
  ok('reasignar el botón 1 a Dracula cambia su icono en la cabecera', await h.eval(`const b = document.getElementById('theme-slot-0'); return b.dataset.themeId === 'dracula' && b.textContent === '🦇'`));
  await h.eval(`document.querySelector('.theme-custom__base').value = 'light'; document.querySelector('[data-action="clone-theme"]').click();`); await h.sleep(200);
  ok('«Copiar y activar» pone el Personalizado con la paleta Clara', await h.eval(`return DBVThemes.getTheme() === 'custom' && getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() === '#ffffff'`));
  const before = await h.eval(`return document.querySelector('.theme-custom__contrast').textContent`);
  await h.eval(`const i = document.querySelector('.theme-custom__color[data-token="--text-primary"]'); i.value = '#dddddd'; i.dispatchEvent(new Event('input'));`); await h.sleep(150);
  const after = await h.eval(`return { text: document.querySelector('.theme-custom__contrast').textContent, warn: document.querySelector('.theme-custom__contrast').classList.contains('theme-custom__contrast--warn'), v: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() }`);
  ok('editar un color lo aplica en vivo y la nota de contraste avisa', after.v === '#dddddd' && after.warn && after.text !== before, `${before} → ${after.text}`);
  await h.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));`); await h.sleep(150);
  ok('Escape cierra el diálogo', await h.eval(`return document.getElementById('theme-modal').classList.contains('hidden')`));

  // 7. Persistencia tras recargar.
  await h.eval(`DBVThemes.setTheme('solarized-dark'); location.reload();`).catch(() => {});
  await h.sleep(2200);
  ok('tras recargar se conservan el tema y los botones', await h.eval(`return DBVThemes.getTheme() === 'solarized-dark' && document.documentElement.dataset.theme === 'solarized-dark' && document.getElementById('theme-slot-0').dataset.themeId === 'dracula'`));
  ok('y el Personalizado editado', await h.eval(`return DBVThemes.getCustom()['--text-primary'] === '#dddddd'`));

  // 8. Una segunda ventana del mismo origen cambia el tema y esta se entera (evento storage, RF-50.5).
  await h.send('Runtime.evaluate', { expression: `window.__w2 = window.open(location.href, '_blank')`, userGesture: true });
  await h.sleep(1800);
  const w2 = await h.eval(`return !!(window.__w2 && window.__w2.DBVThemes)`);
  if (w2) {
    await h.eval(`window.__w2.DBVThemes.setTheme('gruvbox-dark'); await new Promise((r) => setTimeout(r, 300));`);
    ok('la otra ventana cambia el tema y esta lo aplica sin recargar', await h.eval(`return DBVThemes.getTheme() === 'gruvbox-dark' && document.documentElement.dataset.theme === 'gruvbox-dark' && document.querySelector('.theme-btn.active') === null`));
    await h.eval(`window.__w2.DBVThemes.setSlot(1, 'gruvbox-dark'); await new Promise((r) => setTimeout(r, 300));`);
    ok('y también un cambio de botón rápido', await h.eval(`return document.getElementById('theme-slot-1').dataset.themeId === 'gruvbox-dark' && document.getElementById('theme-slot-1').classList.contains('active')`));
    await h.eval(`window.__w2.close()`);
  } else {
    ok('se pudo abrir una segunda ventana para probar la propagación', false);
  }

  // 9. Android: lista de los 10 curados.
  ok('la lista de Ajustes de Android tiene los 10 curados (sin Personalizado)', await h.eval(`const s = document.getElementById('m-theme-select'); return s.options.length === 10 && ![...s.options].some((o) => o.value === 'custom')`));

  const errors = h.errors().filter((e) => !/favicon|fonts\.g/.test(e));
  ok('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await h.close();
  console.log(failed ? `\n${failed} comprobaciones fallidas` : '\nTodo en verde');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
