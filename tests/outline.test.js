// =============================================================================
// dbv-md-reader — Tests de reordenar secciones desde el Índice (RF-45)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Incluye la prueba de propiedad del spec: para cada encabezado h1–h3 y cada posición de destino posible sobre los `.md`
// reales del repositorio, el multiconjunto de líneas del documento es el mismo antes y después, lo que queda fuera de la
// zona afectada es idéntico, el bloque movido sigue contiguo y justo donde debe, y se conservan el tipo de fin de línea
// y si el texto termina en salto de línea.
//
// @spec RF-45

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'outline.js'), 'utf8'), sandbox);
const O = sandbox.DBVOutline;

const md = new MarkdownIt({ html: true });

/** Encabezados `{ line, level }` de un texto, como los daría el render (mapa de origen de markdown-it). */
function headingsOf(text) {
  return md.parse(text, {})
    .filter((t) => t.type === 'heading_open' && t.map)
    .map((t) => ({ line: t.map[0], level: Number(t.tag.slice(1)) }));
}

const linesOf = (text) => O.splitLines(text).map((l) => l.replace(/\r?\n$/, ''));
// Para el multiconjunto de líneas se usa `split`: un texto que termina en salto da una línea final vacía, y «sin salto
// final» con la última línea vacía es el MISMO texto que «con salto final» (`…\r\n`), no una pérdida de contenido.
const sortedLines = (text) => text.split(/\r?\n/).sort();

const DOC = [
  '# Uno', 'texto uno', '',
  '## Uno.a', 'a', '',
  '## Uno.b', 'b', '',
  '# Dos', 'texto dos', '',
  '## Dos.a', 'c', '',
  '# Tres', 'texto tres', '',
].join('\n');

describe('RF-45 · secciones', () => {
  it('cada sección llega hasta el siguiente encabezado del mismo nivel o superior (con sus subsecciones)', () => {
    const lines = O.splitLines(DOC);
    const s = O.sections(headingsOf(DOC), lines.length);
    expect(lines).toHaveLength(17);
    expect(s.map((x) => [x.line, x.end])).toEqual([[0, 9], [3, 6], [6, 9], [9, 15], [12, 15], [15, 17]]);
  });

  it('la última sección llega al final del texto', () => {
    const s = O.sections([{ line: 0, level: 1 }], 10);
    expect(s[0].end).toBe(10);
  });
});

describe('RF-45 · mover una sección', () => {
  it('intercambia dos secciones hermanas (la segunda antes de la primera)', () => {
    const h = headingsOf(DOC);
    const r = O.moveSection(DOC, h, 3, 0); // «Dos» antes de «Uno»
    expect(r.ok).toBe(true);
    expect(r.text).toBe(['# Dos', 'texto dos', '', '## Dos.a', 'c', '', '# Uno', 'texto uno', '', '## Uno.a', 'a', '', '## Uno.b', 'b', '', '# Tres', 'texto tres', ''].join('\n'));
  });

  it('una sección con subsecciones viaja entera', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 0, 15); // «Uno» (con Uno.a y Uno.b) antes de «Tres»
    expect(r.ok).toBe(true);
    expect(r.text.indexOf('# Dos')).toBeLessThan(r.text.indexOf('# Uno'));
    expect(r.text.indexOf('## Uno.a')).toBeGreaterThan(r.text.indexOf('# Uno'));
    expect(r.text.indexOf('# Uno')).toBeLessThan(r.text.indexOf('# Tres'));
  });

  it('mover la primera al final y la última al principio', () => {
    const h = headingsOf(DOC);
    const total = O.splitLines(DOC).length;
    const toEnd = O.moveSection(DOC, h, 0, total);
    expect(toEnd.ok).toBe(true);
    expect(toEnd.text.startsWith('# Dos')).toBe(true);
    expect(toEnd.text.endsWith('## Uno.b\nb\n\n')).toBe(true);
    const toStart = O.moveSection(DOC, h, 5, 0);
    expect(toStart.ok).toBe(true);
    expect(toStart.text.startsWith('# Tres')).toBe(true);
  });

  it('dice dónde ha quedado la sección movida (línea de su encabezado y tamaño)', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 3, 0); // «Dos» (6 líneas) al principio
    expect(r.movedTo).toBe(0);
    expect(r.movedLines).toBe(6);
    expect(linesOf(r.text)[r.movedTo]).toBe('# Dos');
    const down = O.moveSection(DOC, headingsOf(DOC), 0, 15); // «Uno» (9 líneas) antes de «Tres»
    expect(linesOf(down.text)[down.movedTo]).toBe('# Uno');
    expect(down.movedTo).toBe(6);
  });

  it('el reemplazo aplicado sobre el texto original da exactamente el texto nuevo (una sola edición)', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 3, 0);
    expect(DOC.slice(0, r.replaceStart) + r.replacement + DOC.slice(r.replaceEnd)).toBe(r.text);
    expect(r.replaceEnd - r.replaceStart).toBeLessThanOrEqual(DOC.length);
  });

  it('lo que queda fuera de la zona afectada no cambia (prefijo y sufijo idénticos)', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 6 - 3 + 0 /* Uno.b */ + 0, 3); // Uno.b antes de Uno.a
    expect(r.ok).toBe(true);
    expect(r.text.slice(0, r.replaceStart)).toBe(DOC.slice(0, r.replaceStart));
    expect(r.text.slice(r.text.length - (DOC.length - r.replaceEnd))).toBe(DOC.slice(r.replaceEnd));
  });

  it('soltar la sección dentro de sí misma se rechaza sin tocar nada', () => {
    const h = headingsOf(DOC);
    expect(O.moveSection(DOC, h, 0, 3)).toEqual({ ok: false, reason: 'inside' });
    expect(O.moveSection(DOC, h, 0, 6)).toEqual({ ok: false, reason: 'inside' });
  });

  it('soltarla donde ya está (justo antes o justo después) no hace nada', () => {
    const h = headingsOf(DOC);
    expect(O.moveSection(DOC, h, 3, 9)).toEqual({ ok: false, reason: 'noop' });
    expect(O.moveSection(DOC, h, 3, 15)).toEqual({ ok: false, reason: 'noop' });
  });

  it('los niveles de encabezado no se cambian', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 4, 3); // «Dos.a» (##) entre las subsecciones de «Uno»
    expect(r.ok).toBe(true);
    expect(linesOf(r.text).filter((l) => /^#+ /.test(l)).sort()).toEqual(linesOf(DOC).filter((l) => /^#+ /.test(l)).sort());
  });
});

describe('RF-45 · lo que parece un encabezado y no lo es', () => {
  const WITH_FENCE = ['# A', '```', '# no soy un encabezado', '```', '', '# B', 'texto', ''].join('\n');

  it('un «#» dentro de un bloque de código no es encabezado: el bloque viaja con su sección', () => {
    const h = headingsOf(WITH_FENCE);
    expect(h).toEqual([{ line: 0, level: 1 }, { line: 5, level: 1 }]);
    const r = O.moveSection(WITH_FENCE, h, 0, 8);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(['# B', 'texto', '# A', '```', '# no soy un encabezado', '```', ''].join('\n') + '\n');
  });

  it('si el mapa está desfasado y la línea indicada NO es un encabezado, aborta sin cambiar nada', () => {
    const wrong = [{ line: 1, level: 1 }, { line: 5, level: 1 }]; // la línea 1 es «```»
    expect(O.moveSection(WITH_FENCE, wrong, 0, 5)).toEqual({ ok: false, reason: 'mismatch' });
    const wrongTarget = [{ line: 0, level: 1 }, { line: 4, level: 1 }]; // la línea 4 está vacía
    expect(O.moveSection(WITH_FENCE, wrongTarget, 0, 4)).toEqual({ ok: false, reason: 'mismatch' });
    expect(O.moveSection(WITH_FENCE, [], 0, 0)).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('reconoce los encabezados Setext (subrayados)', () => {
    const text = ['Título uno', '==========', 'a', '', 'Título dos', '----------', 'b', ''].join('\n');
    const h = headingsOf(text);
    expect(h).toEqual([{ line: 0, level: 1 }, { line: 4, level: 2 }]);
    const r = O.moveSection(text, h, 1, 0);
    expect(r.ok).toBe(true);
    expect(r.text.startsWith('Título dos\n----------\nb\n')).toBe(true);
  });

  it('acepta encabezados con espacios finales y con sangría de hasta 3 espacios', () => {
    const text = ['# A   ', 'x', '   ## B', 'y', ''].join('\n');
    const h = headingsOf(text);
    expect(O.moveSection(text, h, 1, 0).ok).toBe(true);
  });
});

describe('RF-45 · fin de línea y fin de texto', () => {
  it('conserva CRLF: todos los saltos del resultado siguen siendo \\r\\n', () => {
    const text = DOC.replace(/\n/g, '\r\n');
    const r = O.moveSection(text, headingsOf(text), 3, 0);
    expect(r.ok).toBe(true);
    expect(r.text.match(/\r\n/g).length).toBe(text.match(/\r\n/g).length);
    expect(r.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('un texto sin salto de línea final sigue sin tenerlo, aunque se mueva su última sección', () => {
    const text = ['# A', 'a', '# B', 'b'].join('\n'); // termina en «b» sin \n
    const r = O.moveSection(text, headingsOf(text), 1, 0); // «B» al principio
    expect(r.ok).toBe(true);
    expect(r.text).toBe(['# B', 'b', '# A', 'a'].join('\n'));
    expect(r.text.endsWith('\n')).toBe(false);
  });

  it('mover una sección al final de un texto sin salto final no pega líneas', () => {
    const text = ['# A', 'a', '# B', 'b'].join('\n');
    const r = O.moveSection(text, headingsOf(text), 0, 4); // «A» al final
    expect(r.ok).toBe(true);
    expect(r.text).toBe(['# B', 'b', '# A', 'a'].join('\n'));
  });

  it('un texto con salto final sigue teniéndolo', () => {
    const r = O.moveSection(DOC, headingsOf(DOC), 3, 0);
    expect(r.text.endsWith('\n')).toBe(true);
  });
});

describe('RF-45 · mover con el teclado (Alt+↑ / Alt+↓)', () => {
  const h = headingsOf(DOC);
  const total = O.splitLines(DOC).length;

  it('hacia arriba: la hermana anterior; la primera no se puede subir', () => {
    expect(O.siblingAt(h, total, 3, -1)).toBe(0); // Dos → antes de Uno
    expect(O.siblingAt(h, total, 2, -1)).toBe(3); // Uno.b → antes de Uno.a
    expect(O.siblingAt(h, total, 0, -1)).toBeNull();
    expect(O.siblingAt(h, total, 1, -1)).toBeNull(); // Uno.a es la primera hija
  });

  it('hacia abajo: tras la hermana siguiente; la última no se puede bajar', () => {
    expect(O.siblingAt(h, total, 0, 1)).toBe(15); // Uno → tras Dos (antes de Tres)
    expect(O.siblingAt(h, total, 1, 1)).toBe(9); // Uno.a → tras Uno.b
    expect(O.siblingAt(h, total, 5, 1)).toBeNull();
    expect(O.siblingAt(h, total, 2, 1)).toBeNull(); // Uno.b es la última hija
  });

  it('subir y bajar son inversos', () => {
    const down = O.moveSection(DOC, h, 0, O.siblingAt(h, total, 0, 1));
    expect(down.ok).toBe(true);
    const h2 = headingsOf(down.text);
    const idx = h2.findIndex((x, i) => x.level === 1 && linesOf(down.text)[x.line] === '# Uno');
    const up = O.moveSection(down.text, h2, idx, O.siblingAt(h2, O.splitLines(down.text).length, idx, -1));
    expect(up.ok).toBe(true);
    expect(up.text).toBe(DOC);
  });
});

// ─── Prueba de propiedad sobre los .md reales ────────────────────────────────────────────────────────────
function checkAllMoves(name, text) {
  const headings = headingsOf(text);
  const total = O.splitLines(text).length;
  const draggable = headings.map((h, i) => ({ h, i })).filter((x) => x.h.level <= 3);
  const originalSorted = sortedLines(text);
  const endsWithNewline = /\n$/.test(text);
  const crlf = /\r\n/.test(text);
  const failures = [];
  let moves = 0;

  for (const { h: source, i } of draggable) {
    for (let k = 0; k <= draggable.length; k++) {
      const at = k < draggable.length ? draggable[k].h.line : total;
      const r = O.moveSection(text, headings, i, at);
      if (!r.ok) continue;
      moves++;
      const bad = [];
      if (JSON.stringify(sortedLines(r.text)) !== JSON.stringify(originalSorted)) bad.push('el conjunto de líneas cambió');
      if (text.slice(0, r.replaceStart) + r.replacement + text.slice(r.replaceEnd) !== r.text) bad.push('el reemplazo no reproduce el resultado');
      // Solo es exigible cuando la última línea del resultado no está vacía (si lo está, ambos casos son el mismo texto).
      const lastLine = r.text.split(/\r?\n/).filter((x, idx, arr) => idx === arr.length - 1 || x !== undefined).pop();
      if (lastLine !== '' && /\n$/.test(r.text) !== endsWithNewline) bad.push('cambió el salto de línea final');
      if (crlf && r.text.replace(/\r\n/g, '').match(/[\r\n]/)) bad.push('se mezclaron finales de línea');
      // El bloque movido es contiguo y está justo antes del encabezado que estaba en la posición de destino.
      const sec = O.sections(headings, total)[i];
      // Con `split` (como el multiconjunto): ver el comentario de `sortedLines`.
      const block = text.split(/\r?\n/).slice(sec.line, sec.end);
      const newLines = r.text.split(/\r?\n/);
      const dropIndex = at < sec.line ? at : at - block.length;
      if (JSON.stringify(newLines.slice(dropIndex, dropIndex + block.length)) !== JSON.stringify(block)) bad.push('el bloque no quedó contiguo en su destino');
      if (bad.length) failures.push(`${name}: sección ${i} → línea ${at}: ${bad.join('; ')}`);
    }
  }
  return { moves, failures, draggable: draggable.length };
}

describe('RF-45 · prueba de propiedad: todos los movimientos posibles sobre los .md del repositorio', () => {
  const files = [
    ['testfiles/GFM_test.md', readFileSync(resolve(process.cwd(), 'testfiles', 'GFM_test.md'), 'utf8')],
    ['src/markdownhelp_es.md', readFileSync(resolve(process.cwd(), 'src', 'markdownhelp_es.md'), 'utf8')],
    ['src/markdownhelp_en.md', readFileSync(resolve(process.cwd(), 'src', 'markdownhelp_en.md'), 'utf8')],
    ['src/markdownhelp_ko.md', readFileSync(resolve(process.cwd(), 'src', 'markdownhelp_ko.md'), 'utf8')],
    ['src/apphelp_es.md', readFileSync(resolve(process.cwd(), 'src', 'apphelp_es.md'), 'utf8')],
    ['src/apphelp_en.md', readFileSync(resolve(process.cwd(), 'src', 'apphelp_en.md'), 'utf8')],
  ];

  for (const [name, text] of files) {
    it(`${name}: el conjunto de líneas, el resto del texto y el fin de línea se conservan en cada movimiento`, () => {
      const result = checkAllMoves(name, text);
      expect(result.draggable).toBeGreaterThan(5);
      expect(result.moves).toBeGreaterThan(result.draggable);
      expect(result.failures).toEqual([]);
    });
  }

  it('lo mismo con los finales de línea CRLF y sin salto final', () => {
    const base = files[1][1];
    const crlf = base.replace(/\r?\n/g, '\r\n');
    expect(checkAllMoves('es-CRLF', crlf).failures).toEqual([]);
    expect(checkAllMoves('es-sin-final', crlf.replace(/\r\n$/, '')).failures).toEqual([]);
  });
});
