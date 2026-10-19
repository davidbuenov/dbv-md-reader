// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Buscar dentro del texto fuente del editor (RF-44): lógica PURA (sin DOM), para probarla en Node/jsdom. El
// cableado con el `<textarea>` y el panel de búsqueda vive en app.js.
//
// Mismo criterio que la búsqueda de la vista previa (RF-04): sin distinguir mayúsculas de minúsculas, sin
// normalizar acentos y sin solapar coincidencias. La consulta vacía o solo de espacios no encuentra nada.
//
// @spec RF-44
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVTextSearch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * El texto en minúsculas más, si hizo falta, un mapa de índices al original: algunos caracteres cambian de
   * longitud al pasar a minúsculas (`İ` → `i̇`, dos unidades) y sin el mapa las posiciones se desplazarían.
   */
  function foldCase(text) {
    var low = text.toLowerCase();
    var result = { low: low, map: null };
    if (low.length !== text.length) {
      var parts = [];
      var map = [];
      for (var i = 0; i < text.length;) {
        var ch = String.fromCodePoint(text.codePointAt(i));
        var lo = ch.toLowerCase();
        for (var k = 0; k < lo.length; k++) map.push(i);
        parts.push(lo);
        i += ch.length;
      }
      result = { low: parts.join(''), map: map };
    }
    return result;
  }

  /**
   * Todas las coincidencias de `query` en `text`, como `{ start, end }` en índices del texto ORIGINAL, en orden y
   * sin solaparse.
   */
  function findAll(text, query) {
    var found = [];
    var source = typeof text === 'string' ? text : '';
    var needle = typeof query === 'string' ? query.toLowerCase() : '';
    if (source && needle.trim()) {
      var folded = foldCase(source);
      var from = 0;
      var idx = folded.low.indexOf(needle, from);
      while (idx !== -1) {
        var lowEnd = idx + needle.length;
        var start = folded.map ? folded.map[idx] : idx;
        var end = folded.map ? (lowEnd < folded.map.length ? folded.map[lowEnd] : source.length) : lowEnd;
        found.push({ start: start, end: end });
        from = lowEnd;
        idx = folded.low.indexOf(needle, from);
      }
    }
    return found;
  }

  /** Índice de la primera coincidencia que empieza en `caret` o después; si no hay, la primera (se da la vuelta). */
  function firstFrom(matches, caret) {
    var index = matches.length ? 0 : -1;
    for (var i = 0; i < matches.length; i++) {
      if (matches[i].start >= caret) { index = i; break; }
    }
    return index;
  }

  /** Siguiente (`direction` 1) o anterior (−1) coincidencia, dando la vuelta en los extremos. */
  function step(current, total, direction) {
    var next = -1;
    if (total > 0) next = (((current + direction) % total) + total) % total;
    return next;
  }

  /** Línea (base 0) en la que cae el índice `index` del texto. */
  function lineOf(text, index) {
    var line = 0;
    var limit = Math.min(index, text.length);
    for (var i = text.indexOf('\n'); i !== -1 && i < limit; i = text.indexOf('\n', i + 1)) line++;
    return line;
  }

  /** Columna (base 0) de `index` dentro de su línea. */
  function columnOf(text, index) {
    return index - (text.lastIndexOf('\n', index - 1) + 1);
  }

  /**
   * `scrollTop` que deja la línea `line` centrada en un área visible de `viewHeight` px, sin pasarse de los
   * extremos. `padding` es el relleno superior del área de texto.
   */
  function scrollTopFor(line, lineHeight, viewHeight, padding, contentHeight) {
    var wanted = padding + line * lineHeight - (viewHeight - lineHeight) / 2;
    var max = Math.max(0, (contentHeight || Infinity) - viewHeight);
    return Math.min(Math.max(0, wanted), max);
  }

  return { findAll: findAll, firstFrom: firstFrom, step: step, lineOf: lineOf, columnOf: columnOf, scrollTopFor: scrollTopFor };
});
