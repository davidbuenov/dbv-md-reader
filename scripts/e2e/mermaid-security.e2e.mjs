// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un `.md` ajeno no ejecuta script a través de un diagrama Mermaid (RF-49: redibujado al cambiar de tema; seguridad
// del renderizado, ADR-009). Con `securityLevel: 'loose'` (hasta la 0.19.0), `click C "javascript:…"` dejaba un enlace
// que se ejecutaba al pulsar el nodo, y desde ahí `__TAURI__` llegaba a `write_file`. Se prueban cargas conocidas
// (onerror, <script>, enlaces javascript:, click) en la carga inicial, tras pulsar los nodos y tras redibujar con otro
// tema; y que los `<br/>` de las etiquetas siguen partiendo línea. `APP_DIR=<carpeta src>` prueba otro frontend.
//
// @spec RF-49

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = (process.env.APP_DIR || path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src')).replace(/\\/g, '/');
const doc = [
  '# Diagramas ajenos', '',
  '```mermaid',
  'graph TD',
  '  A["<img src=x onerror=window.__x1=1>"] --> B["<script>window.__x2=1</script>"]',
  '  B --> C["<a href=javascript:window.__x3=1>c</a>"]',
  '  C --> D["Línea uno<br/>línea dos"]',
  '  click A call window.__x4()',
  '  click C "javascript:window.__x5=1"',
  '```', '',
  '```mermaid',
  'sequenceDiagram',
  '  Alice->>Bob: <img src=x onerror=window.__x6=1>',
  '```',
].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const state = (h) => h.eval(`
  const ran = ['__x1', '__x2', '__x3', '__x4hit', '__x5', '__x6'].filter((k) => window[k]);
  const bad = [...document.querySelectorAll('#content svg *')].filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name) || (/href$/i.test(a.name) && /^\\s*(javascript|data|vbscript):/i.test(a.value)))).length;
  const br = [...document.querySelectorAll('#content svg .node')].find((n) => /uno/.test(n.textContent));
  return { ran, bad, svgs: document.querySelectorAll('#content svg[id^="mermaid"], #content .mermaid svg').length, br: br ? br.querySelectorAll('br').length : -1 };`);

async function main() {
  console.log('Mermaid · un documento ajeno no ejecuta script');
  const h = await launch({ appDir, docPath: 'C:/x/ajeno.md', docContent: doc, width: 1200 });
  await h.eval(`window.__x4 = () => { window.__x4hit = 1; }`);
  await h.sleep(2500);
  let s = await state(h);
  ok('los dos diagramas se dibujan', s.svgs >= 2, JSON.stringify(s));
  ok('al cargar no se ejecuta nada y el SVG no tiene on* ni enlaces javascript:', s.ran.length === 0 && s.bad === 0, JSON.stringify(s));
  await h.eval(`document.querySelectorAll('#content svg .node, #content svg a').forEach((n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))`);
  await h.sleep(300);
  s = await state(h);
  ok('pulsar los nodos tampoco ejecuta nada', s.ran.length === 0, JSON.stringify(s.ran));
  await h.eval(`const b = document.querySelectorAll('[id^="theme-slot-"]'); if (b[1]) b[1].click()`);
  await h.sleep(2000);
  s = await state(h);
  ok('tras redibujar con otro tema sigue igual', s.ran.length === 0 && s.bad === 0, JSON.stringify(s));
  ok('los <br/> de las etiquetas siguen partiendo línea', s.br === 1, String(s.br));
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
