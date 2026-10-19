// =============================================================================
// dbv-md-reader — Tests de la búsqueda dentro del editor (RF-44)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-44

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'textsearch.js'), 'utf8'), sandbox);
const S = sandbox.DBVTextSearch;

const starts = (text, q) => S.findAll(text, q).map((m) => m.start);

describe('RF-44 · findAll', () => {
  it('encuentra todas las coincidencias, sin distinguir mayúsculas', () => {
    expect(starts('Time and time, TIME again', 'time')).toEqual([0, 9, 15]);
  });

  it('devuelve los índices del texto ORIGINAL (inicio y fin)', () => {
    expect(S.findAll('un Zorro rápido', 'zorro')).toEqual([{ start: 3, end: 8 }]);
  });

  it('no solapa coincidencias (igual que la vista previa)', () => {
    expect(starts('aaaa', 'aa')).toEqual([0, 2]);
    expect(starts('aaa', 'aa')).toEqual([0]);
  });

  it('una consulta vacía o de solo espacios no encuentra nada', () => {
    expect(S.findAll('texto', '')).toEqual([]);
    expect(S.findAll('texto', '   ')).toEqual([]);
    expect(S.findAll('texto', null)).toEqual([]);
    expect(S.findAll(undefined, 'x')).toEqual([]);
    expect(S.findAll('', 'x')).toEqual([]);
  });

  it('no normaliza acentos: «é» y «e» son distintos', () => {
    expect(starts('café cafe', 'cafe')).toEqual([5]);
    expect(starts('café cafe', 'café')).toEqual([0]);
  });

  it('trata los caracteres especiales de expresiones regulares como texto', () => {
    expect(starts('a.b (c) [d] a+b', '.')).toEqual([1]);
    expect(starts('a.b (c) [d] a+b', '(c)')).toEqual([4]);
    expect(starts('a.b (c) [d] a+b', 'a+b')).toEqual([12]);
  });

  it('funciona con saltos de línea CRLF', () => {
    const text = 'uno\r\ndos Time\r\ntres time';
    const found = S.findAll(text, 'time');
    expect(found.map((m) => text.slice(m.start, m.end))).toEqual(['Time', 'time']);
  });

  it('las posiciones no se desplazan con caracteres que cambian de longitud en minúsculas (İ)', () => {
    const text = 'İstanbul y Zorro';
    const found = S.findAll(text, 'zorro');
    expect(found).toHaveLength(1);
    expect(text.slice(found[0].start, found[0].end)).toBe('Zorro');
  });

  it('coincidencias al final del texto con caracteres que cambian de longitud', () => {
    const text = 'abc İ';
    const found = S.findAll(text, 'i̇');
    expect(found).toHaveLength(1);
    expect(found[0].end).toBe(text.length);
  });

  it('responde en menos de 100 ms con un documento de 5.000 líneas', () => {
    const doc = Array.from({ length: 5000 }, (_, i) => `Línea ${i} con la palabra Time de relleno y algo más de texto`).join('\n');
    const t0 = performance.now();
    const found = S.findAll(doc, 'time');
    expect(performance.now() - t0).toBeLessThan(100);
    expect(found).toHaveLength(5000);
  });
});

describe('RF-44 · navegación y posición', () => {
  it('step da la vuelta en los dos sentidos', () => {
    expect(S.step(0, 3, 1)).toBe(1);
    expect(S.step(2, 3, 1)).toBe(0);
    expect(S.step(0, 3, -1)).toBe(2);
    expect(S.step(0, 1, 1)).toBe(0);
    expect(S.step(-1, 0, 1)).toBe(-1);
  });

  it('firstFrom elige la primera coincidencia desde el cursor y, si no hay, da la vuelta', () => {
    const matches = [{ start: 2 }, { start: 10 }, { start: 20 }];
    expect(S.firstFrom(matches, 0)).toBe(0);
    expect(S.firstFrom(matches, 10)).toBe(1);
    expect(S.firstFrom(matches, 11)).toBe(2);
    expect(S.firstFrom(matches, 99)).toBe(0);
    expect(S.firstFrom([], 5)).toBe(-1);
  });

  it('lineOf y columnOf', () => {
    const text = 'abc\ndefg\r\nhi';
    expect(S.lineOf(text, 0)).toBe(0);
    expect(S.lineOf(text, 4)).toBe(1);
    expect(S.lineOf(text, text.indexOf('hi'))).toBe(2);
    expect(S.columnOf(text, 6)).toBe(2);
    expect(S.columnOf(text, 0)).toBe(0);
  });

  it('scrollTopFor centra la línea y respeta los extremos', () => {
    // 20 px por línea, área visible de 200 px, relleno de 16.
    expect(S.scrollTopFor(0, 20, 200, 16, 5000)).toBe(0);
    expect(S.scrollTopFor(50, 20, 200, 16, 5000)).toBe(16 + 1000 - 90);
    expect(S.scrollTopFor(240, 20, 200, 16, 5000)).toBe(16 + 4800 - 90);
    expect(S.scrollTopFor(249, 20, 200, 16, 5000)).toBe(4800); // se pasaría del final: se recorta
  });
});
