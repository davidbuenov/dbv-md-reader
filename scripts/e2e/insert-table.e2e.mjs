// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Insertar tabla (RF-55) sobre el motor Chromium de WebView2: desde el botón de la barra de formato y desde
// Herramientas ▸ Insertar tabla…; filas y columnas recortadas a 1–20; la tabla va en su propia línea con el cursor
// en la primera celda y se renderiza; una selección TSV se convierte; Ctrl+Z la deshace en un solo paso; y la entrada
// del menú está deshabilitada fuera del Modo Edición.
//
// @spec RF-55

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findEdge, launch } from './harness.mjs';

if (!findEdge()) {
  console.log('Sin Edge/Chromium: se omite este banco (define EDGE_PATH para indicarlo).');
  process.exit(0);
}

const appDir = path.join(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), 'src').replace(/\\/g, '/');
const doc = ['# Título', '', 'Antes del cursor y después.', ''].join('\n');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? '  ok ' : '  FALLA'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const value = (h) => h.eval(`return document.getElementById('editor-textarea').value`);
const modalOpen = (h) => h.eval(`return !document.getElementById('table-modal').classList.contains('hidden')`);

async function main() {
  console.log('RF-55 · insertar tabla');
  const h = await launch({ appDir, docPath: 'C:/x/test.md', docContent: doc, width: 1400 });

  await h.eval(`document.getElementById('btn-tools-menu').click()`); await h.sleep(150);
  ok('fuera del Modo Edición, Herramientas ▸ Insertar tabla… está deshabilitada', await h.eval(`return document.querySelector('#tools-menu [data-action="insertTable"]').disabled === true`));
  await h.eval(`window.DBVHeaderMenu.closeAll(); document.getElementById('btn-edit-toggle').click()`); await h.sleep(600);

  // Desde la barra de formato, con el cursor en mitad del párrafo.
  const original = await value(h);
  const at = original.indexOf(' y después');
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.focus(); ta.setSelectionRange(${at}, ${at}); document.querySelector('#editor-toolbar [data-format="table"]').click()`); await h.sleep(200);
  ok('el botón de la barra abre el panel', await modalOpen(h));
  await h.eval(`const r = document.getElementById('table-rows'); r.value = '50'; r.dispatchEvent(new Event('change')); document.getElementById('table-cols').value = '2'`);
  ok('un valor fuera de rango se recorta a 20', (await h.eval(`return document.getElementById('table-rows').value`)) === '20');
  await h.eval(`document.getElementById('table-rows').value = '3'; document.getElementById('table-insert').click()`); await h.sleep(600);
  const v1 = await value(h);
  const expectedTable = '|     |     |\n| --- | --- |\n|     |     |\n|     |     |';
  ok('inserta la tabla en su propia línea, separada del párrafo', v1 === original.slice(0, at) + '\n\n' + expectedTable + '\n\n' + original.slice(at), JSON.stringify(v1));
  ok('el panel se cierra', !(await modalOpen(h)));
  const cur = await h.eval(`const ta = document.getElementById('editor-textarea'); return { start: ta.selectionStart, end: ta.selectionEnd, focus: document.activeElement === ta }`);
  ok('el cursor queda en la primera celda, con el foco en el editor', cur.start === at + 4 && cur.end === cur.start && cur.focus, JSON.stringify(cur));
  await h.sleep(400);
  const dims = await h.eval(`const t = document.querySelector('#content table'); return t ? { rows: t.querySelectorAll('tr').length, cols: t.querySelectorAll('tr:first-child th').length } : null`);
  ok('la vista previa la renderiza como una tabla de 3 × 2', !!dims && dims.rows === 3 && dims.cols === 2, JSON.stringify(dims));

  // Deshacer en un solo paso.
  await h.key('z', 'KeyZ', 90, 2); await h.sleep(300);
  ok('Ctrl+Z la deshace en un solo paso', (await value(h)) === original);
  await h.key('y', 'KeyY', 89, 2); await h.sleep(300);
  ok('Ctrl+Y la rehace', (await value(h)) === v1);
  await h.key('z', 'KeyZ', 90, 2); await h.sleep(300);

  // Desde el menú, convirtiendo una selección TSV.
  await h.eval(`const ta = document.getElementById('editor-textarea'); ta.value = 'p\\n\\nNombre\\tEdad\\nAna\\t30\\n\\nq'; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); ta.setSelectionRange(3, 3 + 'Nombre\\tEdad\\nAna\\t30'.length)`);
  await h.eval(`document.getElementById('btn-tools-menu').click()`); await h.sleep(150);
  ok('en Modo Edición la entrada del menú se habilita', await h.eval(`return document.querySelector('#tools-menu [data-action="insertTable"]').disabled === false`));
  await h.eval(`document.querySelector('#tools-menu [data-action="insertTable"]').click()`); await h.sleep(300);
  const sel = await h.eval(`return { open: !document.getElementById('table-modal').classList.contains('hidden'), offered: !document.getElementById('table-from-selection-row').classList.contains('hidden'), checked: document.getElementById('table-from-selection').checked, label: document.getElementById('table-from-selection-label').textContent, dimsDisabled: document.getElementById('table-rows').disabled }`);
  ok('el menú abre el panel y ofrece convertir la selección (2 × 2)', sel.open && sel.offered && sel.checked && sel.label.includes('2 × 2') && sel.dimsDisabled, JSON.stringify(sel));
  await h.eval(`document.getElementById('table-insert').click()`); await h.sleep(400);
  ok('convierte la selección en tabla con sus celdas', (await value(h)) === 'p\n\n| Nombre | Edad |\n| --- | --- |\n| Ana | 30 |\n\nq', JSON.stringify(await value(h)));

  // Escape cierra el panel sin tocar nada.
  const before = await value(h);
  await h.eval(`document.querySelector('#editor-toolbar [data-format="table"]').click()`); await h.sleep(200);
  await h.key('Escape', 'Escape', 27); await h.sleep(200);
  ok('Escape cierra el panel sin insertar', !(await modalOpen(h)) && (await value(h)) === before);
  ok('sin excepciones ni console.error', (await h.errors()).length === 0, JSON.stringify(await h.errors()));
  await h.close();
}

await main();
console.log(failed ? `\n${failed} comprobaciones fallan.` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
