#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Test de regresión para la exportación Markdown → Typst (RF-27)
//
// No hay framework de test JS en este proyecto (solo `cargo test` para Rust,
// ver package.json): `app.js` es un script vanilla cargado por <script>, no un
// módulo. Este test extrae las funciones de exportación a Typst (autocontenidas,
// sin dependencias de DOM/Tauri) directamente del fichero fuente y las ejecuta
// contra `testfiles/GFM_test.md`, el mismo fixture que ya se usa como banco de
// pruebas real de RF-27 (ver Lecciones 27/28/29 en dbv-specs-ops/memory.md).
//
// Verifica dos regresiones concretas del bug reportado por Johannes Rexx en el
// foro de Typst (HTML embebido perdido en silencio, corregido 2026-09-22) y,
// si el compilador `typst` está disponible en el PATH, compila el resultado
// completo para confirmar que no rompe nada más en el documento de prueba.
//
// Uso: node scripts/test-typst-export.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appJsPath = path.join(rootDir, 'src', 'app.js');
const fixturePath = path.join(rootDir, 'testfiles', 'GFM_test.md');

function loadMarkdownToTypst() {
  const src = readFileSync(appJsPath, 'utf8');
  const startMarker = '  function escapeTypstText(text) {';
  const endMarker = '  function exportToTypst() {';
  const startIdx = src.indexOf(startMarker);
  const endIdx = src.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('No se encontraron los marcadores de las funciones Typst en src/app.js — ¿se ha movido/renombrado el código?');
  }
  const block = src.slice(startIdx, endIdx);
  // eslint-disable-next-line no-new-func -- extracción deliberada de código propio, no de entrada externa
  const factory = new Function('t', block + '\nreturn { markdownToTypst };');
  return factory(function t() { return ''; }).markdownToTypst;
}

function main() {
  const failures = [];
  const markdownToTypst = loadMarkdownToTypst();
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  const mdText = readFileSync(fixturePath, 'utf8');
  const tokens = md.parse(mdText, {});
  const typst = markdownToTypst(tokens, 'GFM_test.md', []);

  // Regresión 1: HTML inline (p. ej. `<module>` en una traza citada) debe
  // salir como texto literal escapado, no desaparecer.
  if (!typst.includes('\\<module\\>')) {
    failures.push('HTML inline: "<module>" no aparece escapado (\\<module\\>) en la exportación — ¿ha vuelto el bug de descarte silencioso?');
  }

  // Regresión 2: un bloque HTML suelto (`<div>...</div>` de la sección
  // "34. Block HTML") debe salir como código sin traducir, no desaparecer.
  if (!typst.includes('#raw("<div>", block: true)') || !typst.includes('#raw("</div>", block: true)')) {
    failures.push('HTML en bloque: el `<div>...</div>` de prueba no aparece como `#raw(..., block: true)` — ¿ha vuelto a faltar el handler de `html_block`?');
  }

  // Verificación end-to-end con el compilador real, si está disponible (no es
  // un requisito de la app en sí — RF-27 documenta explícitamente que no
  // hace falta tener `typst` instalado para exportar — pero si está, hay que
  // usarlo: ver Lección 27 en memory.md, "verificar con el compilador real
  // del sistema de destino, no con el de origen").
  const typstOutPath = path.join(os.tmpdir(), 'dbv-md-reader-GFM_test.typ');
  writeFileSync(typstOutPath, typst, 'utf8');
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['typst'], { encoding: 'utf8' });
  if (which.status === 0) {
    // En Windows, `spawnSync('typst', ...)` sin `shell` da ENOENT aunque
    // `where` sí lo encuentre (el binario vive tras un symlink/reparse point
    // de WinGet que Node no resuelve por PATH sin invocar una shell) — se usa
    // la ruta absoluta que ya ha devuelto `where`, en vez de `shell: true`
    // (evita el aviso de seguridad de Node por argumentos sin escapar).
    const typstBin = which.stdout.split(/\r?\n/)[0].trim();
    const pdfOutPath = path.join(os.tmpdir(), 'dbv-md-reader-GFM_test.pdf');
    const compile = spawnSync(typstBin, ['compile', typstOutPath, pdfOutPath], { encoding: 'utf8' });
    if (compile.status !== 0) {
      failures.push('`typst compile` falló sobre la exportación completa de GFM_test.md:\n' + (compile.stderr || compile.stdout || (compile.error && compile.error.message)));
    } else {
      console.log('✓ `typst compile` confirma que el .typ exportado compila sin errores.');
    }
  } else {
    console.log('(aviso: `typst` no está en el PATH — se omite la compilación real; ver RF-27, no es un requisito de la app)');
  }

  if (failures.length) {
    console.error('✗ Test de exportación a Typst FALLIDO:\n- ' + failures.join('\n- '));
    process.exitCode = 1;
    return;
  }
  console.log('✓ Test de exportación a Typst OK (' + typst.length + ' bytes generados desde GFM_test.md).');
}

main();
