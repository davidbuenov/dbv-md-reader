// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Reordenar secciones del documento (RF-45): lógica PURA (sin DOM), para probarla en Node/jsdom. El arrastre desde el
// Índice y la edición del `<textarea>` viven en app.js.
//
// Una SECCIÓN es un encabezado más todo lo que le sigue hasta justo antes del siguiente encabezado del mismo nivel o
// superior: incluye sus subsecciones (h4 o menores también) y cualquier bloque (código, tablas…). Mover una sección es
// mover ese rango de LÍNEAS a otro punto del texto, y es lo único que hace este módulo: no cambia niveles ni toca una
// sola línea de dentro. Se garantiza (y se prueba) que el conjunto de líneas del documento no cambia, que lo que queda
// fuera de la zona afectada es idéntico byte a byte y que se conserva el tipo de fin de línea y si el texto termina en
// salto de línea.
//
// Los encabezados llegan como `{ line, level }` (línea base 0 del texto y nivel 1–6), sacados del mapa de origen del
// render (RF-30), no de una expresión regular: un `#` dentro de un bloque de código no es un encabezado. Aun así, ANTES
// de tocar nada se comprueba contra el texto real que la línea indicada es de verdad un encabezado (ATX o subrayado
// Setext): si el mapa estuviera desfasado (fórmulas `$$` multilínea, un render pendiente…) la operación se ABORTA sin
// modificar nada, nunca mueve por una línea equivocada.
//
// @spec RF-45
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVOutline = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ATX = /^ {0,3}#{1,6}(?:[ \t]|$)/;
  var SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;

  /** Líneas del texto CON su terminador (`\n` o `\r\n`); la última puede no tenerlo. */
  function splitLines(text) {
    return text.match(/[^\n]*\n|[^\n]+$/g) || [];
  }

  function stripEol(line) {
    return line.replace(/\r?\n$/, '');
  }

  /** Terminador dominante del texto (el de su primera línea con salto), `\n` si no hay ninguno. */
  function eolOf(lines) {
    var eol = '\n';
    for (var i = 0; i < lines.length; i++) {
      var m = /\r?\n$/.exec(lines[i]);
      if (m) { eol = m[0]; break; }
    }
    return eol;
  }

  /** ¿Es la línea `index` el comienzo de un encabezado (ATX, o texto con subrayado `===`/`---` justo debajo)? */
  function isHeadingLine(lines, index) {
    var result = false;
    if (index >= 0 && index < lines.length) {
      var current = stripEol(lines[index]);
      if (ATX.test(current)) {
        result = true;
      } else if (current.trim() !== '' && index + 1 < lines.length) {
        result = SETEXT_UNDERLINE.test(stripEol(lines[index + 1]));
      }
    }
    return result;
  }

  /**
   * Secciones de `headings` (en orden del documento): a cada una le añade `end`, la línea (exclusiva) donde termina.
   * `totalLines` es el número de líneas del texto.
   */
  function sections(headings, totalLines) {
    return headings.map(function (h, i) {
      var end = totalLines;
      for (var j = i + 1; j < headings.length; j++) {
        if (headings[j].level <= h.level) { end = headings[j].line; break; }
      }
      return { line: h.line, level: h.level, end: Math.min(end, totalLines) };
    });
  }

  /** Longitud del prefijo común de dos cadenas. */
  function commonPrefix(a, b) {
    var n = Math.min(a.length, b.length);
    var i = 0;
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
    return i;
  }

  /** Longitud del sufijo común (sin pasar de `limit` caracteres, para que no se solape con el prefijo). */
  function commonSuffix(a, b, limit) {
    var n = Math.min(a.length, b.length, limit);
    var i = 0;
    while (i < n && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) i++;
    return i;
  }

  /**
   * Mueve la sección `from` (índice en `headings`) a la línea `at` (índice de línea ANTES de la cual se inserta; el
   * número de líneas del texto significa «al final»). Devuelve `{ ok: true, text, replaceStart, replaceEnd, replacement }`
   * —`replacement` sustituye a `text[replaceStart, replaceEnd)`, de modo que el editor lo aplica como UNA edición— o
   * (más `movedTo`/`movedLines`: la línea del encabezado movido en el texto nuevo y su tamaño) o
   * `{ ok: false, reason }` sin haber tocado nada:
   * `mismatch` (la línea no es un encabezado), `noop` (la sección ya está ahí) o `inside` (soltada dentro de sí misma).
   */
  function moveSection(text, headings, from, at) {
    var lines = splitLines(text);
    var all = sections(headings, lines.length);
    var sec = all[from];
    var result;
    if (!sec) {
      result = { ok: false, reason: 'mismatch' };
    } else if (!isHeadingLine(lines, sec.line) || (at < lines.length && !isHeadingLine(lines, at))) {
      result = { ok: false, reason: 'mismatch' };
    } else if (at > sec.line && at < sec.end) {
      result = { ok: false, reason: 'inside' };
    } else if (at === sec.line || at === sec.end) {
      result = { ok: false, reason: 'noop' };
    } else {
      var endsWithNewline = /\n$/.test(text);
      var eol = eolOf(lines);
      var block = lines.slice(sec.line, sec.end);
      var rest = lines.slice(0, sec.line).concat(lines.slice(sec.end));
      var insertAt = at < sec.line ? at : at - (sec.end - sec.line);
      var moved = rest.slice(0, insertAt).concat(block, rest.slice(insertAt));
      // Todas las líneas salvo la última llevan su terminador (la última del bloque original podía no tenerlo)…
      moved = moved.map(function (line, i) {
        return i < moved.length - 1 && !/\n$/.test(line) ? line + eol : line;
      });
      // …y la última lleva (o no) terminador igual que el texto original.
      var last = moved.length - 1;
      var core = stripEol(moved[last]);
      moved[last] = endsWithNewline ? core + eol : core;
      var newText = moved.join('');
      var prefix = commonPrefix(text, newText);
      var suffix = commonSuffix(text, newText, Math.min(text.length, newText.length) - prefix);
      result = {
        ok: true,
        text: newText,
        // Dónde queda la sección: línea de su encabezado en el texto nuevo y cuántas líneas ocupa.
        movedTo: insertAt,
        movedLines: block.length,
        replaceStart: prefix,
        replaceEnd: text.length - suffix,
        replacement: newText.slice(prefix, newText.length - suffix)
      };
    }
    return result;
  }

  /**
   * Línea de destino para mover la sección `index` UNA posición entre sus hermanas (mismo nivel, mismo padre), o `null`
   * si ya es la primera (`direction` −1) o la última (+1). Se usa con `moveSection(…, index, línea)`.
   */
  function siblingAt(headings, totalLines, index, direction) {
    var all = sections(headings, totalLines);
    var me = all[index];
    var target = null;
    if (me) {
      if (direction < 0) {
        // Hermana anterior: la última cabecera previa del mismo nivel antes de encontrar una de nivel menor.
        for (var i = index - 1; i >= 0; i--) {
          if (all[i].level < me.level) break;
          if (all[i].level === me.level) { target = all[i].line; break; }
        }
      } else {
        // Hermana siguiente: la cabecera que empieza donde acaba esta, si es del mismo nivel; se inserta tras ella.
        for (var j = index + 1; j < all.length; j++) {
          if (all[j].line < me.end) continue;
          if (all[j].level === me.level && all[j].line === me.end) target = all[j].end;
          break;
        }
      }
    }
    return target;
  }

  return { splitLines: splitLines, isHeadingLine: isHeadingLine, sections: sections, moveSection: moveSection, siblingAt: siblingAt };
});
