// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Barra de estado del editor y números de línea relativos: lógica PURA (sin DOM), para probarla en Node.
// El cableado (barra al pie del panel, actualización por fotograma) vive en app.js.
//
// Las columnas cuentan CARACTERES como los ve el usuario (grafemas con `Intl.Segmenter`): un emoji con
// modificador de tono o una sílaba coreana es una columna, no dos unidades UTF-16. Sin `Intl.Segmenter`
// se cuentan puntos de código, que ya no parten los pares sustitutos.
//
// @spec RF-53
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVCursorStatus = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Una selección enorme (p. ej. Ctrl+A en 5.000 líneas) no se segmenta en grafemas: por encima de este tamaño se
  // cuentan puntos de código, que es lineal y no rompe el presupuesto de un fotograma (RF-53.3).
  var GRAPHEME_LIMIT = 20000;

  var segmenter = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  } catch (_) { segmenter = null; }

  /** Número de puntos de código (los pares sustitutos cuentan uno). */
  function codePoints(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0xD800 || c > 0xDBFF || i + 1 >= str.length) n++;
      else { n++; i++; }
    }
    return n;
  }

  /** Caracteres visibles de `str`: grafemas si se puede, si no puntos de código. Los `\r` no cuentan. */
  function charCount(str) {
    var clean = str.indexOf('\r') === -1 ? str : str.replace(/\r/g, '');
    var n = 0;
    if (segmenter && clean.length <= GRAPHEME_LIMIT) {
      var it = segmenter.segment(clean)[Symbol.iterator]();
      while (!it.next().done) n++;
    } else {
      n = codePoints(clean);
    }
    return n;
  }

  /**
   * Línea y columna (base 1) del desplazamiento `offset` (unidades UTF-16, como `selectionStart`).
   * Un `\r\n` es un solo salto; un desplazamiento que cae entre `\r` y `\n` cuenta como fin de esa línea.
   */
  function position(text, offset) {
    var off = Math.max(0, Math.min(offset | 0, text.length));
    var line = 1;
    var lineStart = 0;
    var idx = text.indexOf('\n');
    while (idx !== -1 && idx < off) {
      line++;
      lineStart = idx + 1;
      idx = text.indexOf('\n', lineStart);
    }
    return { line: line, col: charCount(text.slice(lineStart, off)) + 1 };
  }

  /** Caracteres seleccionados entre `start` y `end` (en cualquier orden); los saltos `\r\n` cuentan uno. */
  function selectionCount(text, start, end) {
    var a = Math.max(0, Math.min(start, end));
    var b = Math.min(text.length, Math.max(start, end));
    return b > a ? charCount(text.slice(a, b)) : 0;
  }

  /** Número de líneas lógicas (igual que la columna de números de hoy: `split('\n')`). */
  function lineCount(text) {
    var n = 1;
    var idx = text.indexOf('\n');
    while (idx !== -1) { n++; idx = text.indexOf('\n', idx + 1); }
    return n;
  }

  /**
   * Texto de la columna de números: absolutos, o relativos a `current` (base 1) si `relative`. La línea actual
   * muestra siempre su número absoluto (RF-53.2). Una línea por número, terminadas en `\n`.
   */
  function gutterText(count, current, relative) {
    var parts = new Array(count);
    for (var i = 1; i <= count; i++) parts[i - 1] = !relative || i === current ? String(i) : String(Math.abs(i - current));
    return parts.join('\n') + '\n';
  }

  return {
    position: position,
    selectionCount: selectionCount,
    lineCount: lineCount,
    gutterText: gutterText,
    charCount: charCount,
    GRAPHEME_LIMIT: GRAPHEME_LIMIT
  };
});
