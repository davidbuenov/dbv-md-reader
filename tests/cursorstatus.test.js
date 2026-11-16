// =============================================================================
// dbv-md-reader — Tests de la barra de estado del editor y de los números relativos (RF-53)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-53

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'cursorstatus.js'), 'utf8'), sandbox);
const C = sandbox.DBVCursorStatus;

describe('RF-53.1 · posición del cursor', () => {
  it('base 1 al principio, en medio y tras un salto', () => {
    const t = 'abc\ndef';
    expect(C.position(t, 0)).toEqual({ line: 1, col: 1 });
    expect(C.position(t, 2)).toEqual({ line: 1, col: 3 });
    expect(C.position(t, 3)).toEqual({ line: 1, col: 4 });
    expect(C.position(t, 4)).toEqual({ line: 2, col: 1 });
    expect(C.position(t, 7)).toEqual({ line: 2, col: 4 });
  });

  it('CRLF: un salto por \\r\\n y el \\r no es una columna', () => {
    const t = 'ab\r\ncd\r\n';
    expect(C.position(t, 2)).toEqual({ line: 1, col: 3 });
    expect(C.position(t, 3)).toEqual({ line: 1, col: 3 }); // entre \r y \n: fin de la línea 1
    expect(C.position(t, 4)).toEqual({ line: 2, col: 1 });
    expect(C.position(t, 8)).toEqual({ line: 3, col: 1 });
  });

  it('un emoji (par sustituto, con tono o ZWJ) cuenta como una columna', () => {
    const t = '😀x';
    expect(C.position(t, 2)).toEqual({ line: 1, col: 2 });
    expect(C.position(t, 3)).toEqual({ line: 1, col: 3 });
    const tone = '👍🏽!';
    expect(C.position(tone, tone.length - 1).col).toBe(2);
    const family = '👨‍👩‍👧y';
    expect(C.position(family, family.length - 1).col).toBe(2);
  });

  it('el coreano cuenta una columna por sílaba', () => {
    const t = '한국어 abc';
    expect(C.position(t, 3)).toEqual({ line: 1, col: 4 });
    expect(C.position(t, t.length).col).toBe(8);
  });

  it('un desplazamiento fuera de rango se recorta', () => {
    expect(C.position('ab', -5)).toEqual({ line: 1, col: 1 });
    expect(C.position('ab', 99)).toEqual({ line: 1, col: 3 });
    expect(C.position('', 0)).toEqual({ line: 1, col: 1 });
  });
});

describe('RF-53.1 · selección', () => {
  it('cuenta caracteres en cualquier orden (selección hacia atrás)', () => {
    const t = 'hola mundo';
    expect(C.selectionCount(t, 0, 4)).toBe(4);
    expect(C.selectionCount(t, 4, 0)).toBe(4);
    expect(C.selectionCount(t, 3, 3)).toBe(0);
  });

  it('emoji, coreano y CRLF', () => {
    expect(C.selectionCount('😀😀', 0, 4)).toBe(2);
    expect(C.selectionCount('한국', 0, 2)).toBe(2);
    expect(C.selectionCount('a\r\nb', 0, 4)).toBe(3);
  });

  it('una selección enorme no se segmenta en grafemas, pero no parte los pares sustitutos', () => {
    const big = '😀'.repeat(C.GRAPHEME_LIMIT);
    expect(C.selectionCount(big, 0, big.length)).toBe(C.GRAPHEME_LIMIT);
  });
});

describe('RF-53.2 · números de línea', () => {
  it('cuenta líneas lógicas como la columna de hoy', () => {
    expect(C.lineCount('')).toBe(1);
    expect(C.lineCount('a\nb\n')).toBe(3);
  });

  it('absolutos sin la preferencia', () => {
    expect(C.gutterText(3, 2, false)).toBe('1\n2\n3\n');
  });

  it('relativos: la línea actual con su número absoluto y el resto la distancia', () => {
    expect(C.gutterText(5, 3, true)).toBe('2\n1\n3\n1\n2\n');
    expect(C.gutterText(3, 1, true)).toBe('1\n1\n2\n');
    expect(C.gutterText(1, 1, true)).toBe('1\n');
  });

  it('5.000 líneas: posición y números en un tiempo de fotograma', () => {
    const text = Array.from({ length: 5000 }, (_, i) => 'Línea número ' + i + ' con algo de texto 한국어').join('\n');
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      const p = C.position(text, Math.floor(text.length * (i / 20)));
      C.gutterText(C.lineCount(text), p.line, true);
    }
    expect((performance.now() - t0) / 20).toBeLessThan(16);
  });
});
