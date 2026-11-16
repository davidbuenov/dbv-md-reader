// =============================================================================
// dbv-md-reader — Tests del generador de tablas Markdown (RF-55)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Dimensiones, cabecera, escape de `|`, conversión TSV/CSV con CRLF, colocación con líneas en blanco, y que el
// resultado lo renderiza markdown-it (el mismo parser de la app) como una tabla de esas dimensiones.
//
// @spec RF-55

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'mdtable.js'), 'utf8'), sandbox);
const T = sandbox.DBVMdTable;
const md = new MarkdownIt();

/** `{ head, body, cols, cells }` de la primera tabla que renderiza markdown-it. */
function shape(text) {
  const tokens = md.parse(text, {});
  let inHead = false, head = 0, body = 0, cols = 0, row = 0;
  const cells = [];
  let current = null;
  for (const t of tokens) {
    if (t.type === 'thead_open') inHead = true;
    if (t.type === 'thead_close') inHead = false;
    if (t.type === 'tr_open') { row = 0; current = []; if (inHead) head++; else body++; }
    if (t.type === 'th_open' || t.type === 'td_open') row++;
    if (t.type === 'inline' && current) current.push(t.content);
    if (t.type === 'tr_close') { cols = Math.max(cols, row); cells.push(current); current = null; }
  }
  return { head, body, cols, cells, tables: tokens.filter((t) => t.type === 'table_open').length };
}

describe('RF-55.1 · dimensiones', () => {
  it('recorta a 1–20 y lo que no es número da 1', () => {
    expect(T.clampDim(0)).toBe(1);
    expect(T.clampDim(25)).toBe(20);
    expect(T.clampDim('7')).toBe(7);
    expect(T.clampDim('abc')).toBe(1);
    expect(T.clampDim(3.6)).toBe(4);
  });

  it('con cabecera: 4 filas × 3 columnas = cabecera + 3 de cuerpo', () => {
    const s = shape(T.build(4, 3, true));
    expect(s).toMatchObject({ tables: 1, head: 1, body: 3, cols: 3 });
  });

  it('sin cabecera: cabecera vacía y todas las filas pedidas en el cuerpo', () => {
    const s = shape(T.build(2, 5, false));
    expect(s).toMatchObject({ tables: 1, head: 1, body: 2, cols: 5 });
    expect(s.cells[0].every((c) => c === '')).toBe(true);
  });

  it('1×1 y 20×20 renderizan; fuera de rango se recorta', () => {
    expect(shape(T.build(1, 1, true))).toMatchObject({ tables: 1, head: 1, body: 0, cols: 1 });
    expect(shape(T.build(99, 99, true))).toMatchObject({ tables: 1, head: 1, body: 19, cols: 20 });
  });

  it('celdas vacías y fila separadora | --- |', () => {
    expect(T.build(2, 2, true)).toBe('|     |     |\n| --- | --- |\n|     |     |');
  });
});

describe('RF-55.3 · selección con datos', () => {
  it('TSV de una hoja de cálculo, con CRLF', () => {
    const rows = T.parseDelimited('Nombre\tEdad\r\nAna\t30\r\nLuis\t41\r\n');
    expect(rows).toEqual([['Nombre', 'Edad'], ['Ana', '30'], ['Luis', '41']]);
    const s = shape(T.fromRows(rows, true));
    expect(s).toMatchObject({ head: 1, body: 2, cols: 2 });
    expect(s.cells[2]).toEqual(['Luis', '41']);
  });

  it('CSV con comillas y comas dentro', () => {
    const rows = T.parseDelimited('a,"b, c",d\n1,"dice ""hola""",3');
    expect(rows).toEqual([['a', 'b, c', 'd'], ['1', 'dice "hola"', '3']]);
  });

  it('si alguna línea no tiene separador no es una tabla', () => {
    expect(T.parseDelimited('uno\tdos\ntres')).toBe(null);
    expect(T.parseDelimited('solo texto')).toBe(null);
    expect(T.parseDelimited('')).toBe(null);
  });

  it('los tabuladores mandan sobre las comas', () => {
    expect(T.parseDelimited('a,b\tc\nd,e\tf')).toEqual([['a,b', 'c'], ['d,e', 'f']]);
  });

  it('escapa | y no lo escapa dos veces; filas cortas se rellenan', () => {
    const text = T.fromRows([['a|b', 'x'], ['c\\|d']], true);
    const s = shape(text);
    expect(s.cells[0]).toEqual(['a|b', 'x']);
    expect(s.cells[1]).toEqual(['c|d', '']);
    expect(s.cols).toBe(2);
  });
});

describe('RF-55.2 · colocación', () => {
  it('en medio de un párrafo añade líneas en blanco a los dos lados', () => {
    const value = 'antes después';
    const ins = T.insertion(value, 6, 6, '| a |\n| --- |');
    const out = value.slice(0, ins.replaceStart) + ins.replacement + value.slice(ins.replaceEnd);
    expect(out).toBe('antes \n\n| a |\n| --- |\n\ndespués');
    expect(shape(out).tables).toBe(1);
    expect(out.slice(ins.cursor - 2, ins.cursor)).toBe('| ');
  });

  it('entre líneas en blanco no añade nada; al principio y al final tampoco', () => {
    expect(T.insertion('a\n\n\n\nb', 3, 3, 'X').replacement).toBe('X');
    expect(T.insertion('', 0, 0, 'X').replacement).toBe('X');
    expect(T.insertion('a\n', 2, 2, 'X').replacement).toBe('\nX');
  });

  it('sustituye la selección y el cursor queda en la primera celda', () => {
    const value = 'p\n\nA\tB\n\nq';
    const ins = T.insertion(value, 3, 6, T.fromRows(T.parseDelimited('A\tB'), true));
    const out = value.slice(0, ins.replaceStart) + ins.replacement + value.slice(ins.replaceEnd);
    expect(out).toBe('p\n\n| A | B |\n| --- | --- |\n\nq');
    expect(out.charAt(ins.cursor)).toBe('A');
  });
});
