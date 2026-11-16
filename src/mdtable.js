// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Insertar tabla: lógica PURA (sin DOM), para probarla en Node. Genera tablas GFM vacías, convierte una
// selección con tabuladores o comas (pegada de una hoja de cálculo) en tabla y calcula dónde insertarla para
// que no se pegue al párrafo de al lado. El panel y la edición deshacible viven en app.js.
//
// Una tabla GFM necesita siempre una fila de cabecera. Con «Fila de encabezado» desmarcada se genera una cabecera
// VACÍA y todas las filas pedidas van al cuerpo; marcada, la primera de las filas pedidas es la cabecera.
//
// @spec RF-55
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVMdTable = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = 1;
  var MAX = 20;
  var EMPTY_CELL = '   ';

  /** Recorta filas/columnas a 1–20; lo que no es un número da 1. */
  function clampDim(value) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.max(MIN, Math.min(MAX, n)) : MIN;
  }

  /** Contenido de celda seguro para GFM: sin saltos de línea y con `|` escapado (sin escapar dos veces). */
  function escapeCell(text) {
    return String(text).replace(/\r?\n|\r/g, ' ').replace(/\\?\|/g, '\\|').trim();
  }

  function rowLine(cells) {
    return '| ' + cells.join(' | ') + ' |';
  }

  function filled(count, value) {
    var out = new Array(count);
    for (var i = 0; i < count; i++) out[i] = value;
    return out;
  }

  /**
   * Tabla a partir de filas de celdas (texto). `header`: la primera fila es la cabecera; si no, cabecera vacía.
   * Las filas cortas se rellenan hasta la más larga.
   */
  function fromRows(rows, header) {
    var cols = 1;
    rows.forEach(function (r) { cols = Math.max(cols, r.length); });
    var norm = rows.map(function (r) {
      var cells = r.map(function (c) { return escapeCell(c) || EMPTY_CELL; });
      while (cells.length < cols) cells.push(EMPTY_CELL);
      return cells;
    });
    var head = header && norm.length ? norm[0] : filled(cols, EMPTY_CELL);
    var body = header ? norm.slice(1) : norm;
    var lines = [rowLine(head), rowLine(filled(cols, '---'))].concat(body.map(rowLine));
    return lines.join('\n');
  }

  /** Tabla vacía de `rows` × `cols` (recortados a 1–20). */
  function build(rows, cols, header) {
    var r = clampDim(rows);
    var c = clampDim(cols);
    var data = [];
    for (var i = 0; i < r; i++) data.push(filled(c, ''));
    return fromRows(data, header !== false);
  }

  /** Divide una línea CSV respetando comillas dobles (`"a, b"` y `""` dentro). */
  function splitCsv(line) {
    var cells = [];
    var cur = '';
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (quoted) {
        if (ch === '"' && line.charAt(i + 1) === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"' && cur.trim() === '') {
        quoted = true; cur = '';
      } else if (ch === ',') {
        cells.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  /**
   * Filas de celdas si TODAS las líneas no vacías de `text` tienen tabuladores (TSV) o, si no, comas (CSV); si no,
   * `null`. Acepta `\r\n`. Una sola columna no es una tabla.
   */
  function parseDelimited(text) {
    var lines = String(text || '').split(/\r?\n|\r/).filter(function (l) { return l.trim() !== ''; });
    var rows = null;
    if (lines.length) {
      var allTabs = lines.every(function (l) { return l.indexOf('\t') !== -1; });
      var allCommas = lines.every(function (l) { return l.indexOf(',') !== -1; });
      if (allTabs) rows = lines.map(function (l) { return l.split('\t'); });
      else if (allCommas) rows = lines.map(splitCsv);
    }
    return rows;
  }

  /**
   * Cómo insertar `table` en `value` sustituyendo `[start, end)`: con líneas en blanco alrededor solo si hacen
   * falta. Devuelve `{ replacement, replaceStart, replaceEnd, cursor }`, con el cursor en la primera celda.
   */
  function insertion(value, start, end, table) {
    var before = value.slice(0, start);
    var after = value.slice(end);
    var lead = before.length === 0 || before.slice(-2) === '\n\n' ? '' : (before.slice(-1) === '\n' ? '\n' : '\n\n');
    var trail = after.length === 0 || after.slice(0, 2) === '\n\n' ? '' : (after.slice(0, 1) === '\n' ? '\n' : '\n\n');
    return {
      replacement: lead + table + trail,
      replaceStart: start,
      replaceEnd: end,
      cursor: start + lead.length + 2
    };
  }

  return {
    MIN: MIN,
    MAX: MAX,
    clampDim: clampDim,
    escapeCell: escapeCell,
    build: build,
    fromRows: fromRows,
    parseDelimited: parseDelimited,
    insertion: insertion
  };
});
