// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Imágenes pegadas o soltadas (RF-37) sobre el motor Chromium de WebView2, con los comandos
// de Rust simulados: pegar en el editor (guarda e inserta, Ctrl+Z), pegar en lectura (solo guarda
// y avisa), pegado mixto texto+imagen (no se toca), campo de texto ajeno (no se toca), soltar sobre
// el editor y fuera de él, documento remoto (cuadro de carpeta, cancelar) y fallo de guardado
// («Guardar como»).
//
// @spec RF-37

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Primer párrafo.', '', 'Segundo párrafo.', ''].join('\n');

// Rust simulado: `save_image`/`copy_image` devuelven lo que devolvería images.rs; el cuadro de carpeta y el
// «Guardar como» se controlan desde la página (`window.__folder`, `window.__saveAs`, `window.__failSave`).
const customInvoke = `((cmd, args) => {
  const clean = (n) => n.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const saved = (name) => ({ path: (args.baseDir || '') + '/' + (args.intoImages ? 'images/' : '') + name, relative: (args.intoImages ? 'images/' : '') + name, reused: false });
  if (cmd === 'save_image' || cmd === 'copy_image') {
    if (window.__failSave) return Promise.reject('«images» existe y no es una carpeta');
    return saved(clean(cmd === 'save_image' ? args.fileName : args.sourcePath.split(/[\\\\/]/).pop()));
  }
  if (cmd === 'pick_folder_dialog') return window.__folder === undefined ? 'C:/Elegida' : window.__folder;
  if (cmd === 'save_image_dialog') return window.__saveAs === undefined ? null : window.__saveAs;
  if (cmd === 'save_image_as' || cmd === 'copy_image_as') return { path: args.destPath, relative: args.destPath.split('/').pop(), reused: false };
  return undefined;
})`;

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };

/** Pega una imagen (o, con `text`, también texto) sobre `selector`; devuelve si el evento se canceló. */
const pasteExpr = (selector, text) => `
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' }));
  ${text ? `dt.setData('text/plain', ${JSON.stringify(text)});` : ''}
  const target = ${selector};
  target.focus && target.focus();
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  await new Promise((r) => setTimeout(r, 500));
  return ev.defaultPrevented;`;

const countCalls = (name) => `window.__calls.filter((c) => c[0] === '${name}')`;

async function localScenarios() {
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, customInvoke });
  try {
    await h.eval(`window.__copied = []; navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };`);

    // ── Pegar en Modo Lectura (se prueba primero: salir de edición con cambios pediría confirmación) ─
    await h.eval(`window.__copied.length = 0;`);
    const readPrevented = await h.eval(pasteExpr(`document.body`));
    const read = await h.eval(`return { edit: document.getElementById('reader-container').classList.contains('edit-mode'), toast: document.getElementById('app-toast')?.textContent, copied: window.__copied, saves: ${countCalls('save_image')}.length }`);
    ok('en lectura se intercepta el pegado y se guarda', readPrevented === true && read.saves === 1, JSON.stringify(read));
    ok('en lectura no entra en Modo Edición', read.edit === false);
    ok('en lectura avisa con la ruta y copia ![](images/…) al portapapeles', /images\/captura-/.test(read.toast) && read.copied.length === 1 && /^!\[\]\(images\/captura-\d{8}-\d{6}\.png\)$/.test(read.copied[0]), JSON.stringify(read));

    // ── Pegar en el editor (Modo Edición): guarda e inserta en el cursor ──────────────────────────
    await h.eval(`document.getElementById('btn-edit-toggle').click()`);
    await h.sleep(600);
    await h.eval(`const t = document.getElementById('editor-textarea'); t.focus(); t.setSelectionRange(t.value.indexOf('Segundo'), t.value.indexOf('Segundo'));`);
    const prevented = await h.eval(pasteExpr(`document.getElementById('editor-textarea')`));
    const saves = await h.eval(`return ${countCalls('save_image')}`);
    const args = saves.at(-1)?.[1] ?? {};
    ok('pegar un recorte en el editor cancela el pegado nativo', prevented === true);
    ok('guarda junto al documento, en images/, con el nombre captura-AAAAMMDD-HHMMSS.png', saves.length === 2 && args.baseDir === 'C:/x' && args.intoImages === true && /^captura-\d{8}-\d{6}\.png$/.test(args.fileName), JSON.stringify(args));
    ok('envía los bytes en base64', args.base64Data === 'iVBORw==', args.base64Data);
    const edited = await h.eval(`const t = document.getElementById('editor-textarea'); return { value: t.value, badge: !document.getElementById('doc-modified-badge').classList.contains('hidden') }`);
    ok('inserta ![](images/…) en la posición del cursor', /!\[\]\(images\/captura-\d{8}-\d{6}\.png\)Segundo párrafo\./.test(edited.value), JSON.stringify(edited.value));
    ok('el documento queda «Modificado»', edited.badge);
    await h.eval(`document.getElementById('editor-textarea').focus();`);
    await h.key('z', 'KeyZ', 90, 2);
    await h.sleep(400);
    ok('Ctrl+Z deshace la inserción', (await h.eval(`return !document.getElementById('editor-textarea').value.includes('images/captura')`)) === true);

    // ── Pegado mixto (texto + imagen) y campo de texto ajeno: NO se intercepta ───────────────────
    const before = (await h.eval(`return ${countCalls('save_image')}`)).length;
    const mixed = await h.eval(pasteExpr(`document.getElementById('editor-textarea')`, 'solo quiero el texto'));
    ok('con texto en el portapapeles no se intercepta (se pega el texto)', mixed === false && (await h.eval(`return ${countCalls('save_image')}`)).length === before);
    await h.eval(`const i = document.createElement('input'); i.id = 'campo-ajeno'; i.type = 'text'; document.body.appendChild(i);`);
    const foreign = await h.eval(pasteExpr(`document.getElementById('campo-ajeno')`));
    ok('con el foco en otro campo de texto no se intercepta', foreign === false && (await h.eval(`return ${countCalls('save_image')}`)).length === before);

    // ── Soltar sobre el editor: guarda e inserta; fuera del editor: solo guarda ──────────────────
    await h.eval(`const t = document.getElementById('editor-textarea'); t.focus(); t.setSelectionRange(t.value.length, t.value.length);`);
    const over = await h.eval(`const r = document.getElementById('editor-pane').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 100 }`);
    await h.eval(`window.__emit('tauri://drag-drop', { paths: ['D:/fotos/Mi Foto 1.PNG'], position: { x: ${over.x}, y: ${over.y} } }); await new Promise((r) => setTimeout(r, 500));`);
    const drop1 = await h.eval(`return { calls: ${countCalls('copy_image')}, value: document.getElementById('editor-textarea').value }`);
    ok('soltar sobre el editor copia la imagen a images/', drop1.calls.length === 1 && drop1.calls[0][1].intoImages === true && drop1.calls[0][1].sourcePath === 'D:/fotos/Mi Foto 1.PNG', JSON.stringify(drop1.calls));
    ok('y la inserta con el nombre saneado', drop1.value.includes('![](images/mi-foto-1.png)'), JSON.stringify(drop1.value));
    const preview = await h.eval(`const r = document.getElementById('content').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 50 }`);
    const valueBefore = drop1.value;
    await h.eval(`window.__emit('tauri://drag-drop', { paths: ['D:/fotos/otra.jpg'], position: { x: ${preview.x}, y: ${preview.y} } }); await new Promise((r) => setTimeout(r, 500));`);
    const drop2 = await h.eval(`return { calls: ${countCalls('copy_image')}.length, value: document.getElementById('editor-textarea').value, toast: document.getElementById('app-toast')?.textContent, copied: window.__copied }`);
    ok('soltar fuera del editor también guarda', drop2.calls === 2);
    ok('pero no toca el documento', drop2.value === valueBefore);
    ok('avisa con la ruta y deja el código copiado', /images\/otra\.jpg/.test(drop2.toast) && drop2.copied.includes('![](images/otra.jpg)'), JSON.stringify({ toast: drop2.toast, copied: drop2.copied }));

    // ── Si guardar falla: «Guardar como»; si se elige dentro de la carpeta del documento, se inserta ─
    await h.eval(`window.__failSave = true; window.__saveAs = 'C:/x/otras/foto.png'; const t = document.getElementById('editor-textarea'); t.focus(); t.setSelectionRange(0, 0);`);
    await h.eval(pasteExpr(`document.getElementById('editor-textarea')`));
    const fallback = await h.eval(`return { dialog: ${countCalls('save_image_dialog')}.length, as: ${countCalls('save_image_as')}, value: document.getElementById('editor-textarea').value.slice(0, 40) }`);
    ok('si falla guardar se abre «Guardar como»', fallback.dialog === 1 && fallback.as.length === 1 && fallback.as[0][1].destPath === 'C:/x/otras/foto.png', JSON.stringify(fallback));
    ok('lo guardado dentro de la carpeta del documento se inserta con su ruta relativa', fallback.value.startsWith('![](otras/foto.png)'), JSON.stringify(fallback.value));
    // Y si el usuario cancela el cuadro, hay un error visible (no un silencio).
    await h.eval(`window.__saveAs = null;`);
    await h.eval(pasteExpr(`document.getElementById('editor-textarea')`));
    const cancelled = await h.eval(`return document.getElementById('app-toast')?.textContent`);
    ok('si también se cancela «Guardar como», avisa del error con el motivo', /No se pudo guardar la imagen/.test(cancelled) && /images/.test(cancelled), cancelled);

    const errs = h.errors();
    ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  } finally {
    await h.close();
  }
}

async function remoteScenarios() {
  const h = await launch({ appDir, docPath: 'https://example.com/docs/a.md', docContent: doc, customInvoke });
  try {
    await h.eval(`window.__copied = []; navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };`);
    await h.eval(pasteExpr(`document.body`));
    const picked = await h.eval(`return { dialog: ${countCalls('pick_folder_dialog')}.length, save: ${countCalls('save_image')} }`);
    ok('documento remoto: se abre el cuadro para elegir carpeta', picked.dialog === 1);
    ok('y se guarda directamente en la carpeta elegida (no en images/)', picked.save.length === 1 && picked.save[0][1].baseDir === 'C:/Elegida' && picked.save[0][1].intoImages === false, JSON.stringify(picked.save));
    ok('sin insertar código (el documento remoto no se edita)', (await h.eval(`return window.__copied.length`)) === 0);
    await h.eval(`window.__folder = null;`);
    await h.eval(pasteExpr(`document.body`));
    const cancelled = await h.eval(`return { saves: ${countCalls('save_image')}.length, toast: document.getElementById('app-toast')?.textContent }`);
    ok('si se cancela el cuadro de carpeta no se guarda nada y se avisa', cancelled.saves === 1 && /No se guardó la imagen/.test(cancelled.toast), JSON.stringify(cancelled));
    const errs = h.errors();
    ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  } finally {
    await h.close();
  }
}

async function crlfScenario() {
  // Un documento de Windows (CRLF): la inserción no debe dejar finales de línea mezclados (RF-37, criterio i).
  const h = await launch({ appDir, docPath: 'C:/x/crlf.md', docContent: doc.replace(/\n/g, '\r\n'), customInvoke });
  try {
    await h.eval(`document.getElementById('btn-edit-toggle').click()`);
    await h.sleep(600);
    await h.eval(`const t = document.getElementById('editor-textarea'); t.focus(); t.setSelectionRange(t.value.indexOf('Segundo'), t.value.indexOf('Segundo'));`);
    await h.eval(pasteExpr(`document.getElementById('editor-textarea')`));
    await h.sleep(500);
    const result = await h.eval(`return { value: document.getElementById('editor-textarea').value, img: !!document.querySelector('#content img') }`);
    ok('con un documento CRLF el código se inserta sin finales de línea mezclados', /!\[\]\(images\/captura-\d{8}-\d{6}\.png\)Segundo/.test(result.value) && !result.value.includes('\r'), JSON.stringify(result.value));
    ok('y la vista previa muestra la imagen insertada', result.img);
    const errs = h.errors();
    ok('sin excepciones ni console.error', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  } finally {
    await h.close();
  }
}

try {
  await localScenarios();
  await remoteScenarios();
  await crlfScenario();
} catch (e) {
  console.error('EXCEPCIÓN DEL BANCO:', e.message);
  failed++;
}
console.log(failed ? `\n${failed} fallos` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
