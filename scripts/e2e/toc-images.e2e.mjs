// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Issue #25 (johnblommers): un clic en el Índice no deja el encabezado arriba cuando hay
// imágenes, y el error cambia con el ancho del panel. Hipótesis: el destino se calcula antes de
// que carguen las imágenes de encima y luego lo empujan. El banco sirve imágenes SIN width/height
// con un retardo, a tres anchos de ventana, y mide dónde queda el encabezado cuando terminan de
// cargar. También comprueba que, si el usuario hace scroll mientras cargan, no se le mueve.
//
// @spec RF-63

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const DELAY_MS = Number(process.env.IMG_DELAY || 1500);
const NO_ANCHOR = process.env.NO_ANCHOR !== '0';

// PNG gris de 1200×700 (sin compresión útil, pero válido) para que la imagen escale con el ancho.
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((width + 1) * height, 0x88); for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const IMAGE = png(1200, 700);
const imgServer = http.createServer((req, res) => setTimeout(() => { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(IMAGE); }, DELAY_MS));
await new Promise((r) => imgServer.listen(0, '127.0.0.1', r));
const IMG = (n) => `http://127.0.0.1:${imgServer.address().port}/img${n}.png?t=${Date.now()}-${n}`;

const parts = ['# Documento con imágenes', ''];
for (let s = 1; s <= 6; s++) {
  parts.push(`## Sección ${s}`, '', `Texto de la sección ${s}.`, '', `![figura ${s}](${IMG(s)})`, '');
  for (let p = 0; p < 4; p++) parts.push(`Párrafo ${p} de relleno de la sección ${s} con algo de texto para ocupar espacio.`, '');
}
parts.push('## Destino', '', 'Aquí debería quedar arriba.', '');
for (let p = 0; p < 40; p++) parts.push(`Relleno final ${p}.`, '');
const doc = parts.join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

const measure = `const h = [...document.querySelectorAll('#content h2')].find((e) => e.textContent.trim() === 'Destino');
  const host = document.getElementById('reader-container');
  const imgs = [...document.querySelectorAll('#content img')];
  return { delta: Math.round(h.getBoundingClientRect().top - host.getBoundingClientRect().top), loaded: imgs.filter((i) => i.complete && i.naturalHeight > 0).length, total: imgs.length, scrollTop: Math.round(host.scrollTop) };`;
const clickDestino = `const a = [...document.querySelectorAll('#toc-list a')].find((e) => e.textContent.trim() === 'Destino'); a.click(); return !!a;`;

async function run(width) {
  const h = await launch({ appDir, docPath: 'C:/x/imagenes.md', docContent: doc, width, height: 900, port: 9333 + (width % 97) });
  try {
    await h.eval(`localStorage.clear()`);
    await h.send('Page.reload');
    await h.sleep(400); // el documento ya se pintó; las imágenes siguen cargando (retardo ${DELAY_MS} ms)
    // Chromium tiene «scroll anchoring» (overflow-anchor) y WebKit/WebKitGTK no: lo apagamos para
    // medir lo que ve un usuario de Linux o macOS (con NO_ANCHOR=0 se mide el Chromium normal).
    if (NO_ANCHOR) await h.eval(`const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none !important}'; document.head.appendChild(st); return 1`);
    const before = await h.eval(`return document.querySelectorAll('#content img').length`);
    const clicked = await h.eval(clickDestino);
    await h.sleep(DELAY_MS + 2000);
    const after = JSON.parse(JSON.stringify(await h.eval(measure)));
    ok(`${width} px · el clic en el Índice deja «Destino» arriba tras cargar las imágenes (±4 px)`,
      clicked && before > 0 && after.loaded === after.total && Math.abs(after.delta) <= 4, JSON.stringify(after));

    // Si el usuario hace scroll mientras cargan, no se le recoloca.
    await h.eval(`localStorage.clear()`);
    await h.send('Page.reload');
    await h.sleep(400);
    if (NO_ANCHOR) await h.eval(`const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none !important}'; document.head.appendChild(st); return 1`);
    await h.eval(clickDestino);
    await h.sleep(300);
    // Rueda REAL (CDP), como la de un usuario. Antes se simulaba con un `WheelEvent` sintético y `scrollTop = 200`,
    // pero en Chromium de macOS el desplazamiento suave del clic seguía en marcha y pisaba esa asignación (medido:
    // 200 justo después y 253 en el fotograma siguiente). Una rueda real corta esa animación, como en la app.
    const pt = await h.eval(`const r = document.getElementById('reader-container').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }`);
    await h.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pt.x, y: pt.y, deltaX: 0, deltaY: -300 });
    await h.sleep(400);
    const tras = await h.eval(`return { top: Math.round(document.getElementById('reader-container').scrollTop), loaded: [...document.querySelectorAll('#content img')].filter((i) => i.complete && i.naturalWidth > 0).length }`);
    await h.sleep(DELAY_MS + 1600);
    const user = await h.eval(`return Math.round(document.getElementById('reader-container').scrollTop)`);
    ok(`${width} px · un scroll del usuario durante la carga gana a la recolocación`, tras.loaded === 0 && Math.abs(user - tras.top) <= 4, `tras la rueda ${tras.top} (imágenes cargadas: ${tras.loaded}), al terminar ${user}`);
    // Modo Edición (RF-63.3): la vista previa queda en «Destino» y el editor en su línea.
    await h.eval(`localStorage.clear()`);
    await h.send('Page.reload');
    await h.sleep(400);
    if (NO_ANCHOR) await h.eval(`const st = document.createElement('style'); st.textContent = '*{overflow-anchor:none !important}'; document.head.appendChild(st); return 1`);
    await h.eval(`document.getElementById('btn-edit-toggle').click(); return 1`);
    await h.sleep(300);
    await h.eval(clickDestino);
    await h.sleep(DELAY_MS + 2000);
    const edit = await h.eval(`const h2 = [...document.querySelectorAll('#content h2')].find((e) => e.textContent.trim() === 'Destino');
      let node = h2; while (node && !(/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)) node = node.parentElement;
      const ta = document.getElementById('editor-textarea'); const lh = parseFloat(getComputedStyle(ta).lineHeight);
      const want = ta.value.split(String.fromCharCode(10)).indexOf('## Destino');
      return { editMode: document.body.classList.contains('edit-mode') || !document.getElementById('editor-pane').classList.contains('hidden'),
        previewDelta: Math.round(h2.getBoundingClientRect().top - node.getBoundingClientRect().top),
        editorTopLine: Math.round(ta.scrollTop / lh), want };`);
    ok(`${width} px · Modo Edición: la vista previa queda en «Destino» (±4 px)`, edit.editMode && Math.abs(edit.previewDelta) <= 4, JSON.stringify(edit));
    ok(`${width} px · Modo Edición: el editor muestra la línea de «Destino» arriba (±2 líneas)`, Math.abs(edit.editorTopLine - edit.want) <= 2, JSON.stringify(edit));
    const errs = h.errors();
    ok(`${width} px · sin errores de JS`, errs.length === 0, errs.join(' | '));
  } finally {
    await h.close();
  }
}

console.log(`RF-63 · Índice con imágenes que tardan ${DELAY_MS} ms${NO_ANCHOR ? ' (sin scroll anchoring, como WebKit)' : ''}`);
for (const width of [1400, 1100, 900]) await run(width);
imgServer.close();
console.log(failed ? `\n${failed} comprobación(es) fallida(s).` : '\nTodo correcto.');
process.exit(failed ? 1 : 0);
