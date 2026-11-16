// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Núcleo del Modo Vim: lógica PURA (sin DOM), para probarla en Node y para que la opción B (CodeMirror) la
// reutilice tal cual (RF-51.8, D5 del plan).
//
//   step(state, key, buffer, opts) → { state, edit, cursor, selStart, selEnd, mode, command, snapshot, ... }
//
// `buffer` es `{ text, selStart, selEnd }`. `edit` es `{ start, end, text }` sobre el texto de ENTRADA y `cursor`,
// `selStart` y `selEnd` ya están en coordenadas del texto resultante. `snapshot: true` pide al adaptador que guarde
// una instantánea del texto ANTES de aplicar la edición (un paso de deshacer por orden y por sesión de Insertar,
// RF-51.3, D6). `command` es 'undo' | 'redo' | 'save' | 'savequit' | 'quit'. En Insertar casi todo es
// `passThrough`: el `<textarea>` escribe de forma nativa (también la composición IME, RF-51.7).
//
// Subconjunto (RF-51.2): h j k l w b e W B E 0 ^ $ gg G {n}G f F t T ; , % { } · contadores · d c y > < con
// movimiento o en Visual · dd cc yy >> << D C Y x X p P r J ~ · iw aw · i a I A o O · v V · u Ctrl+R ·
// / ? n N · :w :wq :x :q :{n}. Fuera (recortado, plan V7): `.`.
//
// @spec RF-51
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVVimCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SHIFT = '  ';
  var MAX_UNDO_STEPS = 200;
  var MAX_UNDO_BYTES = 20 * 1024 * 1024;

  // ---------------------------------------------------------------------------------------------------------------
  // Líneas. El cursor de Normal nunca cae en el `\r` de un CRLF ni en el `\n`.
  // ---------------------------------------------------------------------------------------------------------------
  function lineStart(t, i) {
    if (i <= 0) return 0;
    return t.lastIndexOf('\n', i - 1) + 1;
  }
  /** Índice del `\n` que cierra la línea de `i` (o la longitud del texto si es la última). */
  function lineBreak(t, i) {
    var p = t.indexOf('\n', i);
    return p === -1 ? t.length : p;
  }
  /** Fin del contenido de la línea (exclusivo), sin el `\r` de un CRLF. */
  function lineEnd(t, i) {
    var s = lineStart(t, i);
    var e = lineBreak(t, s);
    if (e > s && t.charCodeAt(e - 1) === 13) e--;
    return e;
  }
  function lastChar(t, i) {
    var s = lineStart(t, i);
    var e = lineEnd(t, s);
    return e > s ? e - 1 : s;
  }
  function clampNormal(t, c) {
    var p = Math.max(0, Math.min(c, t.length));
    return Math.min(p, lastChar(t, p));
  }
  function isBlankCh(ch) { return ch === ' ' || ch === '\t'; }
  function firstNonBlank(t, i) {
    var s = lineStart(t, i);
    var e = lineEnd(t, s);
    var p = s;
    while (p < e && isBlankCh(t[p])) p++;
    if (p === e && e > s) p = e - 1;
    return p;
  }
  /** Inicio de la línea siguiente, o -1 si `i` está en la última. */
  function nextLine(t, i) {
    var b = lineBreak(t, i);
    return b >= t.length ? -1 : b + 1;
  }
  function prevLine(t, i) {
    var s = lineStart(t, i);
    return s === 0 ? -1 : lineStart(t, s - 1);
  }
  /** Inicio de la línea `n` (base 1); si no existe, la última. */
  function lineAt(t, n) {
    var s = 0;
    for (var k = 1; k < n; k++) {
      var nx = nextLine(t, s);
      if (nx === -1) break;
      s = nx;
    }
    return s;
  }
  function eolOf(t) { return t.indexOf('\r\n') !== -1 ? '\r\n' : '\n'; }
  function isBlankLine(t, s) {
    var e = lineEnd(t, s);
    for (var p = s; p < e; p++) if (!isBlankCh(t[p])) return false;
    return true;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Palabras: 0 = espacio, 1 = letras/dígitos/_ (Unicode, también hangul), 2 = puntuación. En W B E todo lo que
  // no es espacio es de la misma clase.
  // ---------------------------------------------------------------------------------------------------------------
  var WORD_RE;
  try { WORD_RE = new RegExp('[\\p{L}\\p{N}_]', 'u'); } catch (_) { WORD_RE = /[A-Za-z0-9_À-￿]/; }
  function cls(ch, big) {
    if (ch === undefined) return -1;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') return 0;
    if (big) return 1;
    return WORD_RE.test(ch) ? 1 : 2;
  }
  function emptyLineAt(t, i) {
    return i < t.length ? (t[i] === '\n' || (t[i] === '\r' && t[i + 1] === '\n')) : false;
  }
  function wordForward(t, i, big) {
    var n = t.length;
    if (i >= n) return n;
    var c = cls(t[i], big);
    if (c !== 0) while (i < n && cls(t[i], big) === c) i++;
    while (i < n && cls(t[i]) === 0) {
      if (t[i] === '\n' && emptyLineAt(t, i + 1)) return i + 1;
      i++;
    }
    return i;
  }
  function wordEnd(t, i, big) {
    var n = t.length;
    i++;
    while (i < n && cls(t[i]) === 0) i++;
    if (i >= n) return Math.max(0, n - 1);
    var c = cls(t[i], big);
    while (i + 1 < n && cls(t[i + 1], big) === c) i++;
    return i;
  }
  function wordBack(t, i, big) {
    if (i <= 0) return 0;
    i--;
    while (i > 0 && cls(t[i]) === 0) {
      if (t[i] === '\n' && t[i - 1] === '\n') return i;
      i--;
    }
    if (i <= 0) return 0;
    var c = cls(t[i], big);
    while (i > 0 && cls(t[i - 1], big) === c) i--;
    return i;
  }

  function paraForward(t, c) {
    var s = lineStart(t, c);
    while (s !== -1 && s < t.length && isBlankLine(t, s)) s = nextLine(t, s);
    while (s !== -1 && s < t.length && !isBlankLine(t, s)) s = nextLine(t, s);
    return s === -1 ? t.length : s;
  }
  function paraBack(t, c) {
    var p = prevLine(t, c);
    while (p !== -1 && isBlankLine(t, p)) p = prevLine(t, p);
    while (p !== -1 && !isBlankLine(t, p)) p = prevLine(t, p);
    return p === -1 ? 0 : p;
  }

  var PAIRS = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
  function matchBracket(t, c) {
    var e = lineEnd(t, c);
    var p = c;
    while (p < e && !PAIRS[t[p]]) p++;
    if (p >= e) return -1;
    var open = t[p];
    var close = PAIRS[open];
    var dir = '([{'.indexOf(open) !== -1 ? 1 : -1;
    var depth = 0;
    for (var i = p; i >= 0 && i < t.length; i += dir) {
      if (t[i] === open) depth++;
      else if (t[i] === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  function findInLine(t, c, kind, ch, count, repeat) {
    var s = lineStart(t, c);
    var e = lineEnd(t, s);
    var p = c;
    var forward = kind === 'f' || kind === 't';
    var till = kind === 't' || kind === 'T';
    // Al repetir `t`/`T` con `;` el carácter de al lado no cuenta (si no, no se movería nunca).
    if (till && repeat) p += forward ? 1 : -1;
    for (var k = 0; k < count; k++) {
      p = forward ? t.indexOf(ch, p + 1) : t.lastIndexOf(ch, p - 1);
      if (p === -1 || p >= e || p < s || (!forward && p >= c)) return -1;
    }
    if (till) p += forward ? -1 : 1;
    return p;
  }

  function wordObject(t, c, around, big) {
    var n = t.length;
    if (n === 0) return null;
    var p = Math.min(c, n - 1);
    var s = lineStart(t, p);
    var e = lineEnd(t, s);
    if (p >= e) return null;
    var k = cls(t[p], big);
    var a = p;
    var b = p + 1;
    if (k === 0) {
      while (a > s && isBlankCh(t[a - 1])) a--;
      while (b < e && isBlankCh(t[b])) b++;
      if (around) { var c2 = b < e ? cls(t[b], big) : -1; while (b < e && cls(t[b], big) === c2) b++; }
      return { start: a, end: b };
    }
    while (a > s && cls(t[a - 1], big) === k) a--;
    while (b < e && cls(t[b], big) === k) b++;
    if (around) {
      if (b < e && isBlankCh(t[b])) { while (b < e && isBlankCh(t[b])) b++; }
      else { while (a > s && isBlankCh(t[a - 1])) a--; }
    }
    return { start: a, end: b };
  }

  function defaultFindAll(text, query) {
    var found = [];
    var low = text.toLowerCase();
    var q = query.toLowerCase();
    if (!q) return found;
    for (var i = low.indexOf(q); i !== -1; i = low.indexOf(q, i + q.length)) found.push({ start: i, end: i + q.length });
    return found;
  }
  function searchJump(t, c, query, dir, findAll) {
    var matches = (findAll || defaultFindAll)(t, query);
    var res = { index: -1, wrapped: false };
    if (!matches.length) return res;
    var i;
    if (dir > 0) {
      for (i = 0; i < matches.length; i++) if (matches[i].start > c) { res.index = matches[i].start; return res; }
      res.index = matches[0].start;
    } else {
      for (i = matches.length - 1; i >= 0; i--) if (matches[i].start < c) { res.index = matches[i].start; return res; }
      res.index = matches[matches.length - 1].start;
    }
    res.wrapped = true;
    return res;
  }

  function toggleCase(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var up = ch.toUpperCase();
      out += up === ch ? ch.toLowerCase() : up;
    }
    return out;
  }

  /** Edición mínima entre dos textos (prefijo y sufijo comunes). */
  function diffEdit(a, b) {
    if (a === b) return null;
    var p = 0;
    var max = Math.min(a.length, b.length);
    while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
    var ea = a.length;
    var eb = b.length;
    while (ea > p && eb > p && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) { ea--; eb--; }
    return { start: p, end: ea, text: b.slice(p, eb) };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------------------------------------------
  function initialState() {
    return {
      mode: 'normal', count: '', op: null, opCount: '', pending: '', anchor: 0, vcursor: 0, desiredCol: null,
      register: { text: '', linewise: false }, lastFind: null, cmd: '', cmdKind: '', lastSearch: null,
    };
  }
  function copyState(s) {
    var base = s || initialState();
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    return out;
  }

  /** Movimiento de `key` desde `c`: `{ to, kind: 'excl' | 'incl' | 'line', col? }` o null. */
  function motion(t, c, key, count, hasCount, st, opts) {
    var i;
    var to = c;
    switch (key) {
      case 'h': case 'Backspace': return { to: Math.max(lineStart(t, c), c - count), kind: 'excl' };
      case 'l': case ' ': {
        var end = st.op ? lineEnd(t, c) : lastChar(t, c);
        return { to: Math.min(end, c + count), kind: 'excl' };
      }
      case 'j': case 'k': case '<C-d>': case '<C-u>': case 'Enter': case '+': case '-': {
        var n = count;
        if (key === '<C-d>' || key === '<C-u>') n = Math.max(1, Math.floor((opts.pageLines || 20) / 2)) * count;
        var down = key === 'j' || key === '<C-d>' || key === 'Enter' || key === '+';
        var col = st.desiredCol != null ? st.desiredCol : c - lineStart(t, c);
        var s = lineStart(t, c);
        for (i = 0; i < n; i++) {
          var nx = down ? nextLine(t, s) : prevLine(t, s);
          if (nx === -1) break;
          s = nx;
        }
        if (key === 'Enter' || key === '+' || key === '-') return { to: firstNonBlank(t, s), kind: 'line' };
        return { to: Math.min(s + Math.min(col, 1e9), lastChar(t, s)), kind: 'line', col: col };
      }
      case 'w': case 'W': for (i = 0; i < count; i++) to = wordForward(t, to, key === 'W'); return { to: to, kind: 'excl', word: true };
      case 'e': case 'E': for (i = 0; i < count; i++) to = wordEnd(t, to, key === 'E'); return { to: to, kind: 'incl' };
      case 'b': case 'B': for (i = 0; i < count; i++) to = wordBack(t, to, key === 'B'); return { to: to, kind: 'excl' };
      case '0': return { to: lineStart(t, c), kind: 'excl' };
      case '^': return { to: firstNonBlank(t, c), kind: 'excl' };
      case '$': {
        var ls = lineStart(t, c);
        for (i = 1; i < count; i++) { var nl = nextLine(t, ls); if (nl === -1) break; ls = nl; }
        var le = lineEnd(t, ls);
        return { to: st.op ? Math.max(le - 1, ls) : lastChar(t, ls), kind: 'incl', col: Infinity, emptyEnd: le === ls };
      }
      case 'G': return { to: firstNonBlank(t, hasCount ? lineAt(t, count) : lineStart(t, t.length)), kind: 'line' };
      case 'gg': return { to: firstNonBlank(t, lineAt(t, hasCount ? count : 1)), kind: 'line' };
      case '}': for (i = 0; i < count; i++) to = paraForward(t, to); return { to: to, kind: 'excl' };
      case '{': for (i = 0; i < count; i++) to = paraBack(t, to); return { to: to, kind: 'excl' };
      case '%': { var m = matchBracket(t, c); return m === -1 ? null : { to: m, kind: 'incl' }; }
      case ';': case ',': {
        if (!st.lastFind) return null;
        var kind = st.lastFind.kind;
        if (key === ',') kind = { f: 'F', F: 'f', t: 'T', T: 't' }[kind];
        var p = findInLine(t, c, kind, st.lastFind.ch, count, true);
        return p === -1 ? null : { to: p, kind: kind === 'f' || kind === 't' ? 'incl' : 'excl' };
      }
      default: return null;
    }
  }

  var MOTION_KEYS = 'hjklwbeWBE0^$G{}%;, ';
  function isMotionKey(key) {
    return (key.length === 1 && MOTION_KEYS.indexOf(key) !== -1) ||
      key === 'Backspace' || key === 'Enter' || key === '<C-d>' || key === '<C-u>' || key === '+' || key === '-';
  }

  /** Aplica un operador al rango y deja el resultado en `res`. Rango de líneas si `linewise`. */
  function applyOp(op, t, a, b, linewise, c, st, res) {
    var nt = t;
    var cur = c;
    if (linewise) {
      var ls = lineStart(t, Math.min(a, b));
      var lb = lineBreak(t, Math.max(a, b));
      var le = lineEnd(t, Math.max(a, b));
      if (op === 'y') {
        st.register = { text: t.slice(ls, le) + '\n', linewise: true };
        cur = lineStart(t, c) === ls ? c : ls;
      } else if (op === 'd') {
        st.register = { text: t.slice(ls, le) + '\n', linewise: true };
        var from = ls;
        var to = lb < t.length ? lb + 1 : lb;
        if (lb >= t.length && ls > 0) { from = ls - 1; if (from > 0 && t[from - 1] === '\r') from--; }
        nt = t.slice(0, from) + t.slice(to);
        var pos = from === ls ? Math.min(ls, nt.length) : lineStart(nt, from);
        cur = firstNonBlank(nt, pos);
      } else if (op === 'c') {
        st.register = { text: t.slice(ls, le) + '\n', linewise: true };
        nt = t.slice(0, ls) + t.slice(le);
        cur = ls;
        st.mode = 'insert';
      } else if (op === '>' || op === '<') {
        var lines = t.slice(ls, le).split('\n');
        for (var k = 0; k < lines.length; k++) {
          var line = lines[k];
          if (op === '>') { if (line.replace(/\r$/, '').trim()) lines[k] = SHIFT + line; }
          else if (line[0] === '\t') lines[k] = line.slice(1);
          else lines[k] = line.replace(/^ {1,2}/, '');
        }
        nt = t.slice(0, ls) + lines.join('\n') + t.slice(le);
        cur = firstNonBlank(nt, ls);
      }
    } else {
      var s = Math.min(a, b);
      var e = Math.max(a, b);
      if (op === 'y') {
        st.register = { text: t.slice(s, e), linewise: false };
        cur = s;
      } else if (op === 'd' || op === 'c') {
        st.register = { text: t.slice(s, e), linewise: false };
        nt = t.slice(0, s) + t.slice(e);
        cur = s;
        if (op === 'c') st.mode = 'insert';
      } else if (op === '~') {
        nt = t.slice(0, s) + toggleCase(t.slice(s, e)) + t.slice(e);
        cur = s;
      } else if (op === '>' || op === '<') {
        return applyOp(op, t, s, Math.max(s, e - 1), true, c, st, res);
      }
    }
    setText(res, t, nt, st.mode === 'insert' ? cur : clampNormal(nt, cur));
    if (st.mode === 'insert') res.snapshot = true;
    return res;
  }

  function setText(res, t, nt, cursor) {
    var ed = diffEdit(t, nt);
    if (ed) { res.edit = ed; res.snapshot = true; }
    res.text = nt;
    res.cursor = cursor;
  }

  function joinLines(t, c, n) {
    var nt = t;
    var s = lineStart(t, c);
    var cur = c;
    for (var k = 0; k < n; k++) {
      var le = lineEnd(nt, s);
      var lb = lineBreak(nt, s);
      if (lb >= nt.length) break;
      var ns = lb + 1;
      var q = ns;
      var ne = lineEnd(nt, ns);
      while (q < ne && isBlankCh(nt[q])) q++;
      var head = nt.slice(s, le);
      var sep = (q === ne || /[ \t]$/.test(head) || nt[q] === ')' || le === s) ? '' : ' ';
      nt = nt.slice(0, le) + sep + nt.slice(q);
      cur = le;
    }
    return { text: nt, cursor: cur };
  }

  function paste(t, c, reg, before, count) {
    var eol = eolOf(t);
    var body = '';
    var k;
    if (reg.linewise) {
      var lines = reg.text.replace(/\r?\n$/, '').replace(/\r?\n/g, eol) + eol;
      for (k = 0; k < count; k++) body += lines;
      if (before) {
        var at = lineStart(t, c);
        return { text: t.slice(0, at) + body + t.slice(at), cursor: firstNonBlank(t.slice(0, at) + body, at) };
      }
      var lb = lineBreak(t, c);
      if (lb < t.length) {
        var nt = t.slice(0, lb + 1) + body + t.slice(lb + 1);
        return { text: nt, cursor: firstNonBlank(nt, lb + 1) };
      }
      var tail = eol + body.slice(0, body.length - eol.length);
      var nt2 = t + tail;
      return { text: nt2, cursor: firstNonBlank(nt2, t.length + eol.length) };
    }
    for (k = 0; k < count; k++) body += reg.text;
    if (!body) return { text: t, cursor: c };
    var pos = c;
    if (!before && lineEnd(t, c) > lineStart(t, c)) pos = c + 1;
    return { text: t.slice(0, pos) + body + t.slice(pos), cursor: pos + body.length - 1 };
  }

  function enterInsert(res, st, cursor) {
    st.mode = 'insert';
    res.snapshot = true;
    res.cursor = cursor;
  }

  function finish(res, st, t) {
    var text = res.text != null ? res.text : t;
    res.mode = st.mode;
    res.state = st;
    if (res.cursor == null) res.cursor = 0;
    if (st.mode === 'visual' || st.mode === 'vline') {
      var a = Math.min(st.anchor, st.vcursor);
      var b = Math.max(st.anchor, st.vcursor);
      if (st.mode === 'vline') { res.selStart = lineStart(text, a); res.selEnd = lineEnd(text, b); }
      else { res.selStart = a; res.selEnd = Math.min(text.length, b + 1); }
      res.cursor = st.vcursor;
    } else {
      res.selStart = res.cursor;
      res.selEnd = res.cursor;
    }
    if (st.mode === 'command' || st.mode === 'search') res.cmdline = st.cmdKind + st.cmd;
    delete res.text;
    return res;
  }

  function resetPending(st) { st.count = ''; st.op = null; st.opCount = ''; st.pending = ''; }

  function runCommandLine(st, t, c, res, opts) {
    var cmd = st.cmd;
    var kind = st.cmdKind;
    st.mode = 'normal';
    st.cmd = '';
    st.cmdKind = '';
    res.cursor = clampNormal(t, c);
    if (kind === ':') {
      var trimmed = cmd.trim();
      if (/^\d+$/.test(trimmed)) res.cursor = firstNonBlank(t, lineAt(t, Math.max(1, parseInt(trimmed, 10))));
      else if (trimmed === 'w') res.command = 'save';
      else if (trimmed === 'wq' || trimmed === 'x') res.command = 'savequit';
      else if (trimmed === 'q' || trimmed === 'q!') res.command = 'quit';
      else if (trimmed) res.message = { code: 'unknownCommand', arg: trimmed };
      return;
    }
    var query = cmd || (st.lastSearch && st.lastSearch.query) || '';
    if (!query) return;
    var dir = kind === '?' ? -1 : 1;
    st.lastSearch = { query: query, dir: dir };
    doSearch(t, c, query, dir, res, opts);
  }

  function doSearch(t, c, query, dir, res, opts) {
    var r = searchJump(t, c, query, dir, opts.findAll);
    if (r.index === -1) res.message = { code: 'patternNotFound', arg: query };
    else {
      res.cursor = clampNormal(t, r.index);
      if (r.wrapped) res.message = { code: dir > 0 ? 'searchWrappedBottom' : 'searchWrappedTop' };
    }
  }

  /**
   * Procesa una tecla. `key` es un carácter imprimible o 'Escape' | 'Enter' | 'Backspace' | 'Tab' | '<C-r>' |
   * '<C-d>' | '<C-u>' | '<C-[>' | '<C-z>'. Nunca muta `state`.
   */
  function step(state, key, buffer, options) {
    var opts = options || {};
    var st = copyState(state);
    var t = buffer.text || '';
    var res = { state: st, edit: null, cursor: null, mode: st.mode, command: null, snapshot: false, message: null,
      passThrough: false, endInsert: false, handled: true };
    var isEsc = key === 'Escape' || key === '<C-[>';

    if (st.mode === 'insert') {
      if (isEsc || key === '<C-z>') {
        st.mode = 'normal';
        resetPending(st);
        var ic = buffer.selStart;
        res.endInsert = true;
        res.cursor = clampNormal(t, ic > lineStart(t, ic) ? ic - 1 : ic);
        if (key === '<C-z>') res.command = 'undo';
        return finish(res, st, t);
      }
      res.passThrough = true;
      res.handled = false;
      res.cursor = buffer.selStart;
      res.mode = 'insert';
      res.state = st;
      res.selStart = buffer.selStart;
      res.selEnd = buffer.selEnd;
      return res;
    }

    var visual = st.mode === 'visual' || st.mode === 'vline';
    var c = visual ? st.vcursor : clampNormal(t, buffer.selStart);

    if (st.mode === 'command' || st.mode === 'search') {
      if (isEsc) { st.mode = 'normal'; st.cmd = ''; st.cmdKind = ''; res.cursor = c; }
      else if (key === 'Enter') runCommandLine(st, t, c, res, opts);
      else if (key === 'Backspace') {
        if (!st.cmd) { st.mode = 'normal'; st.cmdKind = ''; }
        else st.cmd = st.cmd.slice(0, -1);
        res.cursor = c;
      } else {
        if (key.length === 1 || (key.length === 2 && key.codePointAt(0) > 0xFFFF)) st.cmd += key;
        res.cursor = c;
      }
      return finish(res, st, t);
    }

    if (isEsc) {
      if (visual) st.mode = 'normal';
      resetPending(st);
      res.cursor = clampNormal(t, c);
      return finish(res, st, t);
    }

    // Prefijos de dos teclas.
    var pend = st.pending;
    var motionKey = null;
    var count = Math.max(1, parseInt(st.count || '1', 10)) * Math.max(1, parseInt(st.opCount || '1', 10));
    var hasCount = !!(st.count || st.opCount);
    if (pend) {
      st.pending = '';
      if (pend === 'g') {
        if (key === 'g') motionKey = 'gg';
        else { resetPending(st); res.cursor = c; return finish(res, st, t); }
      } else if (pend === 'f' || pend === 'F' || pend === 't' || pend === 'T') {
        if (key.length > 2 || key === 'Enter') { resetPending(st); res.cursor = c; return finish(res, st, t); }
        st.lastFind = { kind: pend, ch: key };
        var fp = findInLine(t, c, pend, key, count, false);
        if (fp === -1) { resetPending(st); res.cursor = c; return finish(res, st, t); }
        return applyMotion(st, t, c, { to: fp, kind: pend === 'f' || pend === 't' ? 'incl' : 'excl' }, res);
      } else if (pend === 'r') {
        var re = lineEnd(t, c);
        resetPending(st);
        if (key.length <= 2 && key !== 'Enter' && c + count <= re && re > lineStart(t, c)) {
          var rep = '';
          for (var ri = 0; ri < count; ri++) rep += key;
          setText(res, t, t.slice(0, c) + rep + t.slice(c + count), c + count - 1);
        } else res.cursor = c;
        return finish(res, st, t);
      } else if (pend === 'i' || pend === 'a') {
        var obj = (key === 'w' || key === 'W') ? wordObject(t, c, pend === 'a', key === 'W') : null;
        if (!obj) { resetPending(st); res.cursor = c; return finish(res, st, t); }
        if (visual) {
          st.anchor = obj.start;
          st.vcursor = Math.max(obj.start, obj.end - 1);
          st.count = '';
          res.cursor = st.vcursor;
          return finish(res, st, t);
        }
        var o = st.op;
        resetPending(st);
        applyOp(o, t, obj.start, obj.end, false, c, st, res);
        return finish(res, st, t);
      }
    }

    // Contadores.
    if (!motionKey && /^[0-9]$/.test(key) && (key !== '0' || st.count)) {
      st.count += key;
      res.cursor = c;
      return finish(res, st, t);
    }

    if (motionKey || isMotionKey(key)) {
      var m = motion(t, c, motionKey || key, count, hasCount, st, opts);
      if (!m) { resetPending(st); res.cursor = c; return finish(res, st, t); }
      // `cw` actúa como `ce` sobre una palabra (Vim).
      if (st.op === 'c' && (key === 'w' || key === 'W') && cls(t[c]) !== 0) {
        var ce = c;
        for (var cwi = 0; cwi < count; cwi++) ce = wordEnd(t, cwi === 0 ? c - 1 : ce, key === 'W');
        if (ce < c) ce = c;
        m = { to: ce, kind: 'incl' };
      }
      return applyMotion(st, t, c, m, res);
    }

    if (visual) return visualCommand(st, t, key, res);
    return normalCommand(st, t, c, key, count, res, opts);
  }

  function applyMotion(st, t, c, m, res) {
    var visual = st.mode === 'visual' || st.mode === 'vline';
    st.desiredCol = m.col !== undefined ? m.col : null;
    if (st.op) {
      var op = st.op;
      resetPending(st);
      st.desiredCol = null;
      if (m.kind === 'line') return finish(applyOp(op, t, c, m.to, true, c, st, res), st, t);
      var a = c;
      var b = m.to;
      if (m.kind === 'incl') { if (b >= a) b = m.emptyEnd ? b : b + 1; else a = a + 1; }
      // `dw` en la última palabra de la línea no se lleva el salto de línea (Vim).
      if (m.word && b > lineBreak(t, c)) {
        var lsTo = lineStart(t, b);
        if (b <= firstNonBlank(t, lsTo) || b >= t.length) b = Math.max(c, lineEnd(t, c));
      }
      return finish(applyOp(op, t, a, b, false, c, st, res), st, t);
    }
    st.count = '';
    if (visual) { st.vcursor = Math.min(m.to, Math.max(0, t.length - 1)); res.cursor = st.vcursor; }
    else res.cursor = clampNormal(t, m.to);
    return finish(res, st, t);
  }

  function visualCommand(st, t, key, res) {
    var line = st.mode === 'vline';
    var a = Math.min(st.anchor, st.vcursor);
    var b = Math.max(st.anchor, st.vcursor);
    var end = Math.min(t.length, b + 1);
    var op = null;
    switch (key) {
      case 'v': st.mode = line ? 'visual' : 'normal'; break;
      case 'V': st.mode = line ? 'normal' : 'vline'; break;
      case 'o': { var tmp = st.anchor; st.anchor = st.vcursor; st.vcursor = tmp; break; }
      case 'g': st.pending = 'g'; break;
      case 'f': case 'F': case 't': case 'T': st.pending = key; break;
      case 'i': case 'a': if (!line) st.pending = key; break;
      case 'd': case 'x': op = 'd'; break;
      case 'c': case 's': op = 'c'; break;
      case 'y': op = 'y'; break;
      case '>': op = '>'; break;
      case '<': op = '<'; break;
      case '~': op = '~'; break;
      case 'J': {
        var j = joinLines(t, a, Math.max(1, countLinesBetween(t, a, b)));
        st.mode = 'normal';
        resetPending(st);
        setText(res, t, j.text, clampNormal(j.text, j.cursor));
        return finish(res, st, t);
      }
      case ':': st.mode = 'command'; st.cmdKind = ':'; st.cmd = ''; break;
      default: break;
    }
    if (op) {
      st.mode = 'normal';
      resetPending(st);
      if (op === '~' && line) { a = lineStart(t, a); end = lineEnd(t, b); }
      applyOp(op, t, a, op === '~' || !line ? end : b, line && op !== '~', a, st, res);
      return finish(res, st, t);
    }
    res.cursor = st.mode === 'normal' ? clampNormal(t, st.vcursor) : st.vcursor;
    if (st.mode === 'normal') st.vcursor = 0;
    return finish(res, st, t);
  }

  function countLinesBetween(t, a, b) {
    var n = 0;
    for (var p = t.indexOf('\n', a); p !== -1 && p < b; p = t.indexOf('\n', p + 1)) n++;
    return n;
  }

  function normalCommand(st, t, c, key, count, res, opts) {
    var hasOp = !!st.op;
    if (hasOp && 'dcy<>iagfFtT'.indexOf(key) === -1) { resetPending(st); res.cursor = c; return finish(res, st, t); }
    var i;
    switch (key) {
      case 'd': case 'c': case 'y': case '>': case '<': {
        if (st.op === key) {
          // dd cc yy >> << con contador de líneas.
          resetPending(st);
          var last = lineStart(t, c);
          for (i = 1; i < count; i++) { var nx = nextLine(t, last); if (nx === -1) break; last = nx; }
          applyOp(key, t, c, last, true, c, st, res);
          return finish(res, st, t);
        }
        if (st.op) { resetPending(st); res.cursor = c; return finish(res, st, t); }
        st.op = key;
        st.opCount = st.count;
        st.count = '';
        res.cursor = c;
        return finish(res, st, t);
      }
      case 'i': case 'a':
        if (hasOp) { st.pending = key; res.cursor = c; return finish(res, st, t); }
        resetPending(st);
        enterInsert(res, st, key === 'a' && lineEnd(t, c) > lineStart(t, c) ? c + 1 : c);
        return finish(res, st, t);
      case 'I': resetPending(st); enterInsert(res, st, (function () { var p = lineStart(t, c); var e = lineEnd(t, p); while (p < e && isBlankCh(t[p])) p++; return p; })()); return finish(res, st, t);
      case 'A': resetPending(st); enterInsert(res, st, lineEnd(t, c)); return finish(res, st, t);
      case 'o': case 'O': {
        resetPending(st);
        var eol = eolOf(t);
        var at = key === 'o' ? lineEnd(t, c) : lineStart(t, c);
        var nt = t.slice(0, at) + eol + t.slice(at);
        setText(res, t, nt, key === 'o' ? at + eol.length : at);
        st.mode = 'insert';
        return finish(res, st, t);
      }
      case 'v': case 'V':
        resetPending(st);
        st.mode = key === 'v' ? 'visual' : 'vline';
        st.anchor = c;
        st.vcursor = c;
        res.cursor = c;
        return finish(res, st, t);
      case 'g': case 'f': case 'F': case 't': case 'T': case 'r':
        st.pending = key; res.cursor = c; return finish(res, st, t);
      case 'x': case 'X': {
        resetPending(st);
        var ls = lineStart(t, c);
        var le = lineEnd(t, c);
        var s = key === 'x' ? c : Math.max(ls, c - count);
        var e = key === 'x' ? Math.min(le, c + count) : c;
        if (e > s) {
          st.register = { text: t.slice(s, e), linewise: false };
          var xt = t.slice(0, s) + t.slice(e);
          setText(res, t, xt, clampNormal(xt, s));
        } else res.cursor = c;
        return finish(res, st, t);
      }
      case 'D': case 'C': {
        resetPending(st);
        var dl = lineStart(t, c);
        for (i = 1; i < count; i++) { var nn = nextLine(t, dl); if (nn === -1) break; dl = nn; }
        applyOp(key === 'D' ? 'd' : 'c', t, c, lineEnd(t, dl), false, c, st, res);
        return finish(res, st, t);
      }
      case 'Y': {
        resetPending(st);
        var yl = lineStart(t, c);
        for (i = 1; i < count; i++) { var yn = nextLine(t, yl); if (yn === -1) break; yl = yn; }
        applyOp('y', t, c, yl, true, c, st, res);
        return finish(res, st, t);
      }
      case 'p': case 'P': {
        resetPending(st);
        var pr = paste(t, c, st.register, key === 'P', count);
        setText(res, t, pr.text, pr.cursor);
        return finish(res, st, t);
      }
      case 'J': {
        resetPending(st);
        var jr = joinLines(t, c, Math.max(1, count - 1));
        setText(res, t, jr.text, clampNormal(jr.text, jr.cursor));
        return finish(res, st, t);
      }
      case '~': {
        resetPending(st);
        var te = Math.min(lineEnd(t, c), c + count);
        if (te > c) {
          var tt = t.slice(0, c) + toggleCase(t.slice(c, te)) + t.slice(te);
          setText(res, t, tt, clampNormal(tt, te));
        } else res.cursor = c;
        return finish(res, st, t);
      }
      case 'u': case '<C-z>': resetPending(st); res.command = 'undo'; res.cursor = c; return finish(res, st, t);
      case '<C-r>': resetPending(st); res.command = 'redo'; res.cursor = c; return finish(res, st, t);
      case 'n': case 'N': {
        resetPending(st);
        res.cursor = c;
        if (st.lastSearch) doSearch(t, c, st.lastSearch.query, key === 'n' ? st.lastSearch.dir : -st.lastSearch.dir, res, opts);
        return finish(res, st, t);
      }
      case '/': case '?': case ':':
        resetPending(st);
        st.mode = key === ':' ? 'command' : 'search';
        st.cmdKind = key;
        st.cmd = '';
        res.cursor = c;
        return finish(res, st, t);
      default:
        resetPending(st);
        res.cursor = c;
        return finish(res, st, t);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Deshacer por instantáneas (D6): un paso por orden de Normal y por sesión de Insertar, 200 pasos o 20 MB.
  // ---------------------------------------------------------------------------------------------------------------
  function createHistory(limits) {
    var maxSteps = (limits && limits.steps) || MAX_UNDO_STEPS;
    var maxBytes = (limits && limits.bytes) || MAX_UNDO_BYTES;
    var undo = [];
    var redo = [];
    function bytes() { var n = 0; for (var i = 0; i < undo.length; i++) n += undo[i].text.length * 2; return n; }
    return {
      push: function (snap) {
        undo.push({ text: snap.text, cursor: snap.cursor || 0 });
        redo = [];
        while (undo.length > maxSteps || (undo.length > 1 && bytes() > maxBytes)) undo.shift();
      },
      undo: function (current) {
        if (!undo.length) return null;
        var s = undo.pop();
        redo.push({ text: current.text, cursor: current.cursor || 0 });
        return s;
      },
      redo: function (current) {
        if (!redo.length) return null;
        var s = redo.pop();
        undo.push({ text: current.text, cursor: current.cursor || 0 });
        return s;
      },
      /** Una sesión de Insertar sin cambios no deja un paso vacío. */
      dropIfUnchanged: function (text) { if (undo.length && undo[undo.length - 1].text === text) undo.pop(); },
      clear: function () { undo = []; redo = []; },
      size: function () { return undo.length; },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Teclado
  // ---------------------------------------------------------------------------------------------------------------
  var CTRL_KEYS = { r: '<C-r>', d: '<C-d>', u: '<C-u>', '[': '<C-[>', z: '<C-z>' };
  /**
   * Nombre de la tecla para `step`, o null si pertenece a la app (atajos con Ctrl/Cmd, RF-51.6) o a la
   * composición IME (RF-51.7).
   */
  function keyFromEvent(e) {
    if (!e || e.isComposing || e.keyCode === 229 || e.key === 'Process' || e.key === 'Dead') return null;
    var k = e.key;
    if (e.metaKey) return null;
    // AltGr llega como Ctrl+Alt en Windows: en el teclado español da { } [ ] ~ \ | @ #. Si produce un símbolo, es
    // esa tecla; con una letra o un dígito es un atajo de la app (Ctrl+Alt+P, Ctrl+Alt+I) y no se toma.
    if (e.ctrlKey && e.altKey && typeof k === 'string' && k.length === 1 && !/[A-Za-z0-9]/.test(k)) return k;
    if (e.ctrlKey) {
      if (e.altKey || e.shiftKey) return null;
      return CTRL_KEYS[String(k).toLowerCase()] || null;
    }
    if (e.altKey && !e.ctrlKey && k && k.length === 1) return k; // AltGr en teclados europeos
    if (k === 'Escape' || k === 'Enter' || k === 'Backspace' || k === 'Tab') return k;
    if (typeof k === 'string' && (k.length === 1 || (k.length === 2 && k.codePointAt(0) > 0xFFFF))) return k;
    return null;
  }

  function parseKeys(str) {
    var out = [];
    var re = /<[^>]+>|[\s\S]/gu;
    var m;
    var names = { '<Esc>': 'Escape', '<CR>': 'Enter', '<BS>': 'Backspace', '<Tab>': 'Tab', '<Space>': ' ' };
    while ((m = re.exec(str))) out.push(names[m[0]] || m[0]);
    return out;
  }

  /**
   * Ejecuta una secuencia de teclas como lo haría el adaptador (para tests): en Insertar escribe los caracteres,
   * aplica las ediciones y lleva el historial. `keys` admite `<Esc>`, `<CR>`, `<BS>` y `<C-r>`.
   */
  function run(text, cursor, keys, opts) {
    var st = initialState();
    var hist = createHistory();
    var buf = { text: text, selStart: cursor || 0, selEnd: cursor || 0 };
    var commands = [];
    var messages = [];
    var last = null;
    var list = Array.isArray(keys) ? keys : parseKeys(keys);
    for (var i = 0; i < list.length; i++) {
      var key = list[i];
      var r = step(st, key, buf, opts);
      st = r.state;
      last = r;
      if (r.passThrough) {
        var p = buf.selStart;
        if (key === 'Backspace') { if (p > 0) { buf.text = buf.text.slice(0, p - 1) + buf.text.slice(p); p--; } }
        else if (key === 'Enter' || key === 'Tab' || key.length <= 2) {
          var ins = key === 'Enter' ? eolOf(buf.text) : key === 'Tab' ? '\t' : key;
          buf.text = buf.text.slice(0, p) + ins + buf.text.slice(buf.selEnd);
          p += ins.length;
        }
        buf.selStart = buf.selEnd = p;
        continue;
      }
      if (r.endInsert) hist.dropIfUnchanged(buf.text);
      if (r.snapshot) hist.push({ text: buf.text, cursor: buf.selStart });
      if (r.edit) buf.text = buf.text.slice(0, r.edit.start) + r.edit.text + buf.text.slice(r.edit.end);
      buf.selStart = r.selStart;
      buf.selEnd = r.selEnd;
      if (r.command === 'undo' || r.command === 'redo') {
        var snap = hist[r.command]({ text: buf.text, cursor: r.cursor });
        if (snap) {
          buf.text = snap.text;
          buf.selStart = buf.selEnd = clampNormal(snap.text, snap.cursor);
        }
      } else if (r.command) commands.push(r.command);
      if (r.message) messages.push(r.message.code);
    }
    return {
      text: buf.text, cursor: buf.selStart, selStart: buf.selStart, selEnd: buf.selEnd,
      mode: st.mode, state: st, commands: commands, messages: messages, cmdline: last && last.cmdline, history: hist,
    };
  }

  return {
    initialState: initialState,
    step: step,
    createHistory: createHistory,
    keyFromEvent: keyFromEvent,
    parseKeys: parseKeys,
    run: run,
    clampNormal: clampNormal,
    diffEdit: diffEdit,
    _internal: { lineStart: lineStart, lineEnd: lineEnd, wordForward: wordForward, wordBack: wordBack, wordEnd: wordEnd, matchBracket: matchBracket },
  };
});
