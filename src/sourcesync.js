// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Sincronización edición ↔ previsualización: lógica PURA (sin DOM ni Tauri),
// para poder probarla en Node. El cableado con la interfaz vive en app.js.
//
// Idea: cada bloque que markdown-it renderiza lleva `data-src-line` y
// `data-src-end` (líneas del fuente, base 0, fin exclusivo), tomados de
// `token.map`. Con eso un clic en la preview resuelve a una línea del fuente y
// una línea del fuente resuelve a un bloque de la preview.
//
// Garantiza el BLOQUE, no la palabra: typst lo consigue porque compila el
// documento y cada glifo trae su origen; Markdown no ofrece eso. La palabra
// pulsada se localiza como mejora de mejor esfuerzo (ver pickWordRange).
//
// @spec RF-30
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVSourceSync = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORD_RE = /[\p{L}\p{N}_]+/gu;

  // ─── Líneas desplazadas por las fórmulas multilínea ───────────────────────
  // extractMath() (app.js) sustituye cada `$$ … $$` por un marcador de UNA sola
  // línea antes de parsear, así que los `token.map` quedan desplazados respecto
  // al texto del usuario. `shifts` = [{ line, extra }] en coordenadas del texto
  // ya sustituido: tras la línea `line` desaparecieron `extra` saltos de línea.

  function lineMapper(shifts) {
    var list = shifts || [];
    return function mapLine(line) {
      var extra = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].line < line) extra += list[i].extra;
      }
      return line + extra;
    };
  }

  /** Convierte las posiciones crudas (línea del fuente + saltos que se comió cada fórmula) a `shifts`. */
  function buildShifts(rawFormulas) {
    var cumulative = 0;
    var shifts = [];
    for (var i = 0; i < rawFormulas.length; i++) {
      if (rawFormulas[i].extra > 0) shifts.push({ line: rawFormulas[i].rawLine - cumulative, extra: rawFormulas[i].extra });
      cumulative += rawFormulas[i].extra;
    }
    return shifts;
  }

  // ─── Plugin de markdown-it ────────────────────────────────────────────────

  /** Tokens de bloque que se rinden como un elemento al que se le puede poner un atributo. */
  function isAnnotatable(token) {
    if (!token.map || token.hidden) return false;
    if (token.type === 'fence' || token.type === 'code_block' || token.type === 'hr') return true;
    return token.nesting === 1 && /_open$/.test(token.type);
  }

  /**
   * Normaliza `token.map` a coordenadas del texto del usuario y anota los
   * bloques con `data-src-line` / `data-src-end` (y `data-src-body` en los de
   * código: primera línea del contenido, tras la valla de apertura).
   */
  function annotate(md) {
    md.core.ruler.push('dbv_source_map', function (state) {
      var mapLine = lineMapper(state.env && state.env.lineShifts);
      for (var i = 0; i < state.tokens.length; i++) {
        var token = state.tokens[i];
        if (!token.map) continue;
        token.map = [mapLine(token.map[0]), mapLine(token.map[1])];
        if (!isAnnotatable(token)) continue;
        token.attrSet('data-src-line', String(token.map[0]));
        token.attrSet('data-src-end', String(token.map[1]));
        if (token.type === 'fence') token.attrSet('data-src-body', String(token.map[0] + 1));
        else if (token.type === 'code_block') token.attrSet('data-src-body', String(token.map[0]));
      }
    });
  }

  // ─── Fuente → bloque ──────────────────────────────────────────────────────

  /**
   * Índice del bloque que contiene `line`: el más interno (mayor `depth`, y a
   * igualdad el que empieza más tarde). Si ninguno la contiene (línea en blanco
   * entre bloques), el anterior más cercano. -1 si no hay ninguno.
   * @param {{start: number, end: number, depth?: number}[]} blocks
   */
  function pickBlock(blocks, line) {
    var best = -1;
    var fallback = -1;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.start <= line && line < b.end) {
        if (best === -1 || isMoreSpecific(b, blocks[best])) best = i;
      } else if (b.start <= line && (fallback === -1 || b.start > blocks[fallback].start || (b.start === blocks[fallback].start && (b.depth || 0) > (blocks[fallback].depth || 0)))) {
        fallback = i;
      }
    }
    return best !== -1 ? best : fallback;
  }

  function isMoreSpecific(a, b) {
    if ((a.depth || 0) !== (b.depth || 0)) return (a.depth || 0) > (b.depth || 0);
    if (a.start !== b.start) return a.start > b.start;
    return (a.end - a.start) < (b.end - b.start);
  }

  // ─── Posiciones dentro del texto del editor ───────────────────────────────

  /** Desplazamiento de carácter donde empieza cada línea. */
  function lineStarts(text) {
    var starts = [0];
    for (var i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  /** Línea (base 0) que contiene el desplazamiento `offset`. */
  function lineOfOffset(text, offset) {
    var line = 0;
    var end = Math.min(offset, text.length);
    for (var i = 0; i < end; i++) {
      if (text.charCodeAt(i) === 10) line++;
    }
    return line;
  }

  /** Rango [from, to) del contenido de una línea (sin su salto). Se acota al texto. */
  function lineRange(text, line) {
    var starts = lineStarts(text);
    var n = Math.max(0, Math.min(line, starts.length - 1));
    var from = starts[n];
    var to = n + 1 < starts.length ? starts[n + 1] - 1 : text.length;
    if (to > from && text.charCodeAt(to - 1) === 13) to--;
    return { from: from, to: to };
  }

  // ─── Palabra pulsada (mejor esfuerzo) ─────────────────────────────────────

  /** Primera palabra de lo que el navegador seleccionó con el doble clic, o null. */
  function wordOf(selection) {
    var match = String(selection || '').match(/[\p{L}\p{N}_]+/u);
    return match ? match[0] : null;
  }

  /** Cuántas veces aparece `word` (como palabra completa) en `text`. */
  function countWord(text, word) {
    var count = 0;
    var m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text)) !== null) {
      if (m[0] === word) count++;
    }
    return count;
  }

  /**
   * Rango de la aparición número `n` (base 0) de `word` entre las líneas
   * [startLine, endLine) del fuente. null si el fuente tiene menos apariciones
   * que las vistas en lo renderizado: entonces mejor quedarse en la línea que
   * saltar a una palabra equivocada.
   */
  function pickWordRange(text, startLine, endLine, word, n) {
    if (!word || n < 0) return null;
    var from = lineRange(text, startLine).from;
    var to = lineRange(text, Math.max(startLine, endLine - 1)).to;
    var region = text.slice(from, to);
    var seen = 0;
    var found = null;
    var m;
    WORD_RE.lastIndex = 0;
    while (found === null && (m = WORD_RE.exec(region)) !== null) {
      if (m[0] !== word) continue;
      if (seen === n) found = { from: from + m.index, to: from + m.index + word.length };
      seen++;
    }
    return found;
  }

  return {
    lineMapper: lineMapper,
    buildShifts: buildShifts,
    annotate: annotate,
    pickBlock: pickBlock,
    lineStarts: lineStarts,
    lineOfOffset: lineOfOffset,
    lineRange: lineRange,
    wordOf: wordOf,
    countWord: countWord,
    pickWordRange: pickWordRange
  };
});
