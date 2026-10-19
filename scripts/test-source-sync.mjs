#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Test de la sincronización edición ↔ previsualización (RF-30).
//
// `sourcesync.js` es lógica pura (UMD, sin DOM); `extractMath()` vive dentro de
// la IIFE de `app.js`, así que se extrae del fichero fuente por marcadores, igual
// que hace `test-typst-export.mjs`. Se comprueba, sobre los .md reales del repo,
// que cada bloque anotado EMPIEZA donde dice en el fichero del usuario — lo más
// sensible al desfase que causan las fórmulas `$$…$$` de varias líneas — y se
// añaden casos sintéticos adversariales.
//
// @spec RF-30
// Uso: node scripts/test-source-sync.mjs
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (...parts) => readFileSync(path.join(rootDir, ...parts), 'utf8');

// ── Carga de sourcesync.js (UMD) y de extractMath() de app.js ────────────────
const sandbox = { module: { exports: {} } };
vm.runInNewContext(read('src', 'sourcesync.js'), sandbox);
const Sync = sandbox.module.exports;

function loadExtractMath() {
  const src = read('src', 'app.js');
  const start = src.indexOf('  var MATH_PROTECT_RE');
  const end = src.indexOf('  function renderKatex');
  assert.ok(start !== -1 && end !== -1, 'No se encontraron los marcadores de extractMath en src/app.js');
  const ctx = { window: { DBVSourceSync: Sync } };
  vm.runInNewContext(`${src.slice(start, end)}\nthis.extractMath = extractMath;`, ctx);
  return ctx.extractMath;
}
const extractMath = loadExtractMath();

function makeParser() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  Sync.annotate(md);
  return md;
}

/** Tokens con el mismo preprocesado que renderMarkdown(). */
function parse(md, raw) {
  const extracted = extractMath(raw);
  return md.parse(extracted.text, { lineShifts: extracted.lineShifts });
}

let checks = 0;
function check(name, fn) {
  try {
    fn();
    checks++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FALLA  ${name}\n    ${error.message}`);
    process.exitCode = 1;
  }
}

const md = makeParser();

// ── 1. Casos sintéticos ──────────────────────────────────────────────────────
console.log('Casos sintéticos');

check('una fórmula $$ de varias líneas no desplaza los bloques siguientes', () => {
  const raw = '$$\na\nb\n$$\n\n# Título\n\ntexto\n';
  const tokens = parse(md, raw);
  const heading = tokens.find((t) => t.type === 'heading_open');
  assert.equal(heading.map[0], 5, 'el encabezado está en la línea 5 del fichero');
  assert.equal(heading.attrGet('data-src-line'), '5');
  const para = tokens.filter((t) => t.type === 'paragraph_open').at(-1);
  assert.equal(raw.split('\n')[para.map[0]], 'texto');
});

check('dos fórmulas multilínea acumulan su desplazamiento', () => {
  const raw = 'uno\n\n$$\nx\ny\n$$\n\ndos\n\n$$\nz\nw\nv\n$$\n\n## Fin\n';
  const tokens = parse(md, raw);
  const lines = raw.split('\n');
  for (const t of tokens.filter((tok) => tok.type === 'heading_open' || tok.type === 'paragraph_open')) {
    const first = lines[t.map[0]];
    assert.ok(first && first.trim(), `bloque ${t.type} apunta a una línea con contenido (${t.map[0]})`);
  }
  assert.equal(lines[tokens.find((t) => t.type === 'heading_open').map[0]], '## Fin');
});

check('una valla de código conserva sus líneas y su cuerpo empieza tras la apertura', () => {
  const raw = 'intro\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\n# H\n';
  const tokens = parse(md, raw);
  const fence = tokens.find((t) => t.type === 'fence');
  assert.equal(fence.attrGet('data-src-line'), '2');
  assert.equal(fence.attrGet('data-src-body'), '3');
  assert.equal(raw.split('\n')[Number(fence.attrGet('data-src-body'))], 'const a = 1;');
  assert.equal(raw.split('\n')[tokens.find((t) => t.type === 'heading_open').map[0]], '# H');
});

check('una fórmula dentro de una valla NO cuenta como fórmula', () => {
  const raw = '```\n$$\nx\n$$\n```\n\n# H\n';
  const tokens = parse(md, raw);
  assert.equal(raw.split('\n')[tokens.find((t) => t.type === 'heading_open').map[0]], '# H');
  assert.equal(extractMath(raw).lineShifts.length, 0);
});

check('el texto recuperado tras extractMath es idéntico al original salvo las fórmulas', () => {
  const raw = 'a\n\n```\ncode `x` $y$\n```\n\ntexto `c` fin\n';
  assert.equal(extractMath(raw).text, raw, 'sin fórmulas fuera de código, el texto no cambia');
});

check('los atributos llegan a listas, citas y filas de tabla', () => {
  const raw = '- uno\n- dos\n\n> cita\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
  const tokens = parse(md, raw);
  const open = (type) => tokens.filter((t) => t.type === type && t.attrGet('data-src-line') !== null);
  assert.equal(open('list_item_open').length, 2);
  assert.equal(open('blockquote_open').length, 1);
  assert.ok(open('tr_open').length >= 2);
  const second = open('list_item_open')[1];
  assert.equal(second.attrGet('data-src-line'), '1');
  // markdown-it cierra el último ítem tras la línea en blanco que le sigue.
  assert.ok(Number(second.attrGet('data-src-end')) >= 2);
});

check('sin lineShifts (parseo directo) la regla no rompe', () => {
  const tokens = md.parse('# a\n\ntexto\n', {});
  assert.equal(tokens.find((t) => t.type === 'heading_open').attrGet('data-src-line'), '0');
});

// ── 2. pickBlock: fuente → bloque ────────────────────────────────────────────
console.log('pickBlock');

check('elige el bloque más interno que contiene la línea', () => {
  const blocks = [{ start: 0, end: 10, depth: 0 }, { start: 2, end: 5, depth: 1 }, { start: 3, end: 4, depth: 2 }];
  assert.equal(Sync.pickBlock(blocks, 3), 2);
  assert.equal(Sync.pickBlock(blocks, 4), 1);
  assert.equal(Sync.pickBlock(blocks, 8), 0);
});

check('una línea en blanco entre bloques resuelve al anterior más cercano', () => {
  const blocks = [{ start: 0, end: 1, depth: 0 }, { start: 2, end: 4, depth: 0 }, { start: 6, end: 7, depth: 0 }];
  assert.equal(Sync.pickBlock(blocks, 1), 0);
  assert.equal(Sync.pickBlock(blocks, 5), 1);
});

check('sin bloques o antes del primero devuelve -1', () => {
  assert.equal(Sync.pickBlock([], 0), -1);
  assert.equal(Sync.pickBlock([{ start: 3, end: 4 }], 1), -1);
});

// ── 3. Palabra pulsada ───────────────────────────────────────────────────────
console.log('Palabra');

check('wordOf toma la primera palabra, también con tildes y con espacio final', () => {
  assert.equal(Sync.wordOf('palabra '), 'palabra');
  assert.equal(Sync.wordOf('  canción,'), 'canción');
  assert.equal(Sync.wordOf('***'), null);
  assert.equal(Sync.wordOf(''), null);
});

check('pickWordRange elige la aparición n-ésima y no la confunde con subcadenas', () => {
  const text = 'el casa cas\ncasa y casa\n';
  const r0 = Sync.pickWordRange(text, 0, 2, 'casa', 0);
  const r2 = Sync.pickWordRange(text, 0, 2, 'casa', 2);
  assert.equal(text.slice(r0.from, r0.to), 'casa');
  assert.equal(r0.from, 3);
  assert.equal(text.slice(r2.from, r2.to), 'casa');
  assert.equal(r2.from, text.lastIndexOf('casa'));
  assert.equal(Sync.pickWordRange(text, 0, 2, 'casa', 3), null, 'menos apariciones que las vistas → no adivina');
  assert.equal(Sync.pickWordRange(text, 0, 2, 'cas', 0).from, 8, '"cas" es palabra completa solo la suelta');
});

check('pickWordRange respeta el rango de líneas del bloque', () => {
  const text = 'casa\notra\ncasa\n';
  assert.equal(Sync.pickWordRange(text, 2, 3, 'casa', 0).from, 10);
  assert.equal(Sync.pickWordRange(text, 1, 2, 'casa', 0), null);
});

check('lineRange acota al texto y quita el retorno de carro', () => {
  // Se compara serializado: el objeto nace en otro contexto de `vm` (otro prototipo).
  assert.equal(JSON.stringify(Sync.lineRange('ab\r\ncd', 0)), JSON.stringify({ from: 0, to: 2 }));
  assert.equal(JSON.stringify(Sync.lineRange('ab\ncd', 9)), JSON.stringify({ from: 3, to: 5 }));
  assert.equal(Sync.lineOfOffset('a\nb\nc', 4), 2);
});

// ── 4. Ficheros reales: cada bloque empieza donde dice ───────────────────────
console.log('Ficheros reales');

const FIXTURES = [
  ['testfiles', 'GFM_test.md'],
  ['src', 'markdownhelp_es.md'],
  ['src', 'markdownhelp_en.md'],
  ['src', 'apphelp_es.md'],
  ['src', 'apphelp_en.md'],
  ['testfiles', 'demo-funcionalidades_es.md'],
  ['testfiles', 'demo-funcionalidades_en.md'],
];

for (const parts of FIXTURES) {
  const name = parts.join('/');
  check(`${name}: los bloques empiezan en su línea real del fuente`, () => {
    const raw = read(...parts);
    const lines = raw.split(/\r?\n/);
    const tokens = parse(md, raw.replace(/\r\n/g, '\n'));
    let headings = 0;
    let fences = 0;
    let annotated = 0;
    for (const token of tokens) {
      if (token.attrGet('data-src-line') === null) continue;
      annotated++;
      const start = Number(token.attrGet('data-src-line'));
      const end = Number(token.attrGet('data-src-end'));
      assert.ok(start >= 0 && end > start && end <= lines.length + 1, `${token.type} con rango válido [${start},${end})`);
      if (token.type === 'heading_open') {
        headings++;
        const here = lines[start] || '';
        const next = lines[start + 1] || '';
        assert.ok(/^\s{0,3}#{1,6}(\s|$)/.test(here) || /^\s{0,3}(=+|-+)\s*$/.test(next), `encabezado en la línea ${start + 1}: «${here}»`);
      } else if (token.type === 'fence') {
        fences++;
        // Con sangría y/o marca de cita: una valla dentro de una lista o de un blockquote.
        assert.ok(/^[\s>]*(`{3,}|~{3,})/.test(lines[start] || ''),`valla en la línea ${start + 1}: «${lines[start]}»`);
        const body = Number(token.attrGet('data-src-body'));
        const firstCode = token.content.split('\n')[0];
        // Una valla dentro de una lista o una cita lleva sangría en el fichero que token.content ya no tiene.
        assert.ok((lines[body] || '').trim().endsWith(firstCode.trim()), `primera línea de código en ${body + 1}: «${lines[body]}» ≠ «${firstCode}»`);
      } else {
        assert.ok((lines[start] || '').trim() !== '', `${token.type} empieza en una línea con contenido (${start + 1})`);
      }
    }
    assert.ok(annotated > 0, 'hay bloques anotados');
    console.log(`        ${annotated} bloques (${headings} encabezados, ${fences} vallas)`);
  });

  check(`${name}: ida y vuelta línea → bloque → contiene la línea`, () => {
    const raw = read(...parts).replace(/\r\n/g, '\n');
    const tokens = parse(md, raw).filter((t) => t.attrGet('data-src-line') !== null);
    const blocks = tokens.map((t) => ({ start: Number(t.attrGet('data-src-line')), end: Number(t.attrGet('data-src-end')), depth: t.level }));
    for (const b of blocks) {
      const picked = blocks[Sync.pickBlock(blocks, b.start)];
      assert.ok(picked.start <= b.start && b.start < picked.end, `la línea ${b.start + 1} cae dentro del bloque elegido`);
    }
  });
}

console.log(process.exitCode ? '\nHay fallos.' : `\n${checks} comprobaciones correctas.`);
