// =============================================================================
// dbv-md-reader — Tests del núcleo del Modo Vim (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-51

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'vimcore.js'), 'utf8'), sandbox);
const V = sandbox.DBVVimCore;

/** `|` marca el cursor en el texto de entrada y en el esperado. */
function check(input, keys, expected, mode = 'normal') {
  const c = input.indexOf('|');
  const text = input.replace('|', '');
  const r = V.run(text, c, keys);
  const got = r.text.slice(0, r.cursor) + '|' + r.text.slice(r.cursor);
  expect(got).toBe(expected);
  expect(r.mode).toBe(mode);
  return r;
}

describe('RF-51.2 · movimientos', () => {
  it.each([
    ['|abc def', 'l', 'a|bc def'],
    ['abc d|ef', 'h', 'abc |def'],
    ['ab|c', 'l', 'ab|c'],
    ['|abc\ndef', 'j', 'abc\n|def'],
    ['abc\nd|ef', 'k', 'a|bc\ndef'],
    ['abcdef|g\nab\nabcdefgh', 'jj', 'abcdefg\nab\nabcdef|gh'],
    ['|foo bar.baz qux', 'w', 'foo |bar.baz qux'],
    ['|foo bar.baz qux', '3w', 'foo bar.|baz qux'],
    ['|foo bar.baz qux', '2W', 'foo bar.baz |qux'],
    ['foo bar|.baz', 'b', 'foo |bar.baz'],
    ['foo bar.baz |qux', 'B', 'foo |bar.baz qux'],
    ['|foo bar', 'e', 'fo|o bar'],
    ['|foo b.r', '2E', 'foo b.|r'],
    ['  ab|c', '0', '|  abc'],
    ['  ab|c', '^', '  |abc'],
    ['|abc\ndef', '$', 'ab|c\ndef'],
    ['|abc\ndef', '2$', 'abc\nde|f'],
    ['a\nb\n|c', 'gg', '|a\nb\nc'],
    ['|a\nb\n  c', 'G', 'a\nb\n  |c'],
    ['|a\nb\nc', '2G', 'a\n|b\nc'],
    ['|a,b,c', 'f,', 'a|,b,c'],
    ['|a,b,c', '2f,', 'a,b|,c'],
    ['|a,b,c', 'f,;', 'a,b|,c'],
    ['a,b,|c', 'F,', 'a,b|,c'],
    ['|a,b,c', 't,', '|a,b,c'],
    ['|xa,b,c', 't,', 'x|a,b,c'],
    ['|xa,b,c', 't,;', 'xa,|b,c'],
    ['a,b,|c', 'F,,', 'a,b|,c'],
    ['|f(a[b]c)', '%', 'f(a[b]c|)'],
    ['f(a[b]c|)', '%', 'f|(a[b]c)'],
    ['|uno\ndos\n\ntres', '}', 'uno\ndos\n|\ntres'],
    ['uno\n\ntres\n|cuatro', '{', 'uno\n|\ntres\ncuatro'],
    ['|한국어 텍스트', 'w', '한국어 |텍스트'],
  ])('%j + %s', (input, keys, expected) => check(input, keys, expected));

  it('con CRLF el cursor no cae en el \\r', () => {
    check('|abc\r\ndef', '$', 'ab|c\r\ndef');
    check('ab|c\r\ndef', 'j', 'abc\r\nde|f');
  });
  it('última línea sin salto', () => check('|ab\ncd', 'jl$', 'ab\nc|d'));
  it('j recuerda la columna tras una línea corta', () => check('abcd|e\nx\nabcdef', 'jj', 'abcde\nx\nabcd|ef'));
  it('Ctrl+D baja media pantalla', () => {
    const text = Array.from({ length: 40 }, (_, i) => `l${i}`).join('\n');
    const r = V.run(text, 0, '<C-d>', { pageLines: 20 });
    expect(r.text.slice(0, r.cursor).split('\n').length).toBe(11);
  });
});

describe('RF-51.2 · operadores', () => {
  it.each([
    ['|foo bar baz', 'dw', '|bar baz'],
    ['|foo bar baz', '2dw', '|baz'],
    ['|foo bar baz', 'd2w', '|baz'],
    ['foo |bar\nnext', 'dw', 'foo| \nnext'],
    ['|foo bar', 'de', '| bar'],
    ['fo|o bar', 'd$', 'f|o'],
    ['fo|o bar', 'D', 'f|o'],
    ['|a\nb\nc', 'dd', '|b\nc'],
    ['|a\nb\nc', '2dd', '|c'],
    ['a\nb\n|c', 'dd', 'a\n|b'],
    ['|a\nb\nc', 'dj', '|c'],
    ['a\n|b\nc', 'dk', '|c'],
    ['|a\nb\nc', 'dG', '|'],
    ['|ab,cd', 'dt,', '|,cd'],
    ['|ab,cd', 'df,', '|cd'],
    ['|abc', 'x', '|bc'],
    ['|abc', '2x', '|c'],
    ['a|bc', 'X', '|bc'],
    ['ab|c', 'x', 'a|b'],
    ['|abc', 'rx', '|xbc'],
    ['|abc', '2rx', 'x|xc'],
    ['|abc', '~', 'A|bc'],
    ['|abc', '3~', 'AB|C'],
    ['|uno\n  dos', 'J', 'uno| dos'],
    ['|a\nb\nc', '3J', 'a b| c'],
    ['|a\nb', '>>', '  |a\nb'],
    ['  |a\nb', '<<', '|a\nb'],
    ['|a\nb\nc', '>j', '  |a\n  b\nc'],
    ['f|oo bar', 'diw', '| bar'],
  ])('%j + %s', (input, keys, expected) => check(input, keys, expected));

  it('daw se lleva el espacio de detrás', () => check('uno d|os tres', 'daw', 'uno |tres'));
  it('ciw cambia la palabra y escribe', () => check('uno d|os tres', 'ciwXY<Esc>', 'uno X|Y tres'));
  it('cw actúa como ce', () => check('|uno dos', 'cwZ<Esc>', '|Z dos'));
  it('cc vacía la línea', () => check('a\n|bcd\ne', 'ccx<Esc>', 'a\n|x\ne'));
  it('C cambia hasta el final', () => check('ab|cd', 'CZ<Esc>', 'ab|Z'));
  it('yy + p pega la línea debajo', () => check('|uno\ndos', 'yyp', 'uno\n|uno\ndos'));
  it('yy + P pega encima', () => check('uno\n|dos', 'yyP', 'uno\n|dos\ndos'));
  it('yy + p en la última línea sin salto', () => check('uno\n|dos', 'yyp', 'uno\ndos\n|dos'));
  it('yw + P', () => check('|uno dos', 'ywP', 'uno| uno dos'));
  it('x + p intercambia', () => check('|ab', 'xp', 'b|a'));
  it('dd + p mueve la línea', () => check('|a\nb\nc', 'ddp', 'b\n|a\nc'));
  it('3p repite', () => check('|a', 'yl3p', 'aaa|a'));
  it('dd con CRLF conserva los CRLF', () => {
    const r = V.run('a\r\nb\r\nc', 0, 'ddp');
    expect(r.text).toBe('b\r\na\r\nc');
  });
  it('y no toca el texto (registro interno, RF-51.4)', () => {
    const r = V.run('uno dos', 0, 'yw');
    expect(r.text).toBe('uno dos');
    expect(r.state.register).toEqual({ text: 'uno ', linewise: false });
  });
  it('un operador seguido de otra cosa se cancela', () => check('|abc', 'dq', '|abc'));
});

describe('RF-51.2 · Insertar y Visual', () => {
  it.each([
    ['a|bc', 'iX<Esc>', 'a|Xbc'],
    ['a|bc', 'aX<Esc>', 'ab|Xc'],
    ['  a|bc', 'IX<Esc>', '  |Xabc'],
    ['a|bc', 'AX<Esc>', 'abc|X'],
    ['a|bc\nd', 'oX<Esc>', 'abc\n|X\nd'],
    ['a\nb|c', 'OX<Esc>', 'a\n|X\nbc'],
    ['|abc', 'i<Esc>', '|abc'],
    ['ab|c', 'i<Esc>', 'a|bc'],
  ])('%j + %s', (input, keys, expected) => check(input, keys, expected));

  it('Ctrl+[ también vuelve a Normal', () => check('|a', 'iX<C-[>', '|Xa'));
  it('coreano en Insertar', () => check('|가', 'i한국<Esc>', '한|국가'));
  it('Enter en Insertar usa el fin de línea del documento', () => {
    expect(V.run('ab\r\ncd', 1, 'i<CR><Esc>').text).toBe('a\r\nb\r\ncd');
  });
  it('en Insertar las teclas pasan al textarea', () => {
    const st = { ...V.initialState(), mode: 'insert' };
    const r = V.step(st, 'x', { text: 'a', selStart: 0, selEnd: 0 });
    expect(r.passThrough).toBe(true);
    expect(r.handled).toBe(false);
  });

  it('v + motion selecciona y d borra', () => check('|uno dos', 'vld', '|o dos'));
  it('v + e + y', () => {
    const r = V.run('uno dos', 0, 'vey');
    expect(r.state.register.text).toBe('uno');
    expect(r.mode).toBe('normal');
  });
  it('la selección visual incluye el carácter del cursor', () => {
    const r = V.run('uno dos', 0, 'vl');
    expect([r.selStart, r.selEnd]).toEqual([0, 2]);
    expect(r.mode).toBe('visual');
  });
  it('V selecciona líneas y d las borra', () => check('|a\nb\nc', 'Vjd', '|c'));
  it('V + > sangra', () => check('|a\nb', 'Vj>', '  |a\n  b'));
  it('v + iw selecciona la palabra', () => {
    const r = V.run('uno dos tres', 5, 'viw');
    expect([r.selStart, r.selEnd]).toEqual([4, 7]);
  });
  it('v + c cambia', () => check('|abc', 'vlcZ<Esc>', '|Zc'));
  it('v + ~', () => check('|abc', 'vl~', '|ABc'));
  it('Esc sale de Visual', () => check('|abc', 'vll<Esc>', 'ab|c'));
  it('V + v pasa a Visual de caracteres', () => expect(V.run('abc', 0, 'Vv').mode).toBe('visual'));
});

describe('RF-51.3 · deshacer', () => {
  it('u deshace una orden y Ctrl+R la rehace', () => {
    expect(V.run('uno dos', 0, 'dwu').text).toBe('uno dos');
    expect(V.run('uno dos', 0, 'dwu<C-r>').text).toBe('dos');
  });
  it('una sesión de Insertar es un solo paso', () => {
    expect(V.run('a', 0, 'ixyz<Esc>u').text).toBe('a');
    expect(V.run('a', 0, 'oxyz<Esc>u').text).toBe('a');
  });
  it('varios niveles', () => {
    const r = V.run('uno dos tres', 0, 'dwdwxuu');
    expect(r.text).toBe('dos tres');
  });
  it('una sesión de Insertar vacía no deja paso', () => {
    const r = V.run('ab', 0, 'i<Esc>xu');
    expect(r.text).toBe('ab');
    expect(r.history.size()).toBe(0);
  });
  it('Ctrl+Z en Insertar sale a Normal y deshace la sesión', () => {
    const r = V.run('a', 0, 'ixyz<C-z>');
    expect(r.text).toBe('a');
    expect(r.mode).toBe('normal');
  });
  it('propiedad: deshacer todo devuelve el texto original', () => {
    const base = 'uno dos tres\n  cuatro (cinco) [seis]\n\nsiete,ocho\r\nnueve 한국어\nfin';
    const alphabet = ['dw', 'x', 'dd', 'p', 'P', 'J', '>>', '<<', '~', 'cwZ<Esc>', 'oN<Esc>', 'D', 'rq', 'yyp',
      'w', 'j', 'k', 'b', '$', '0', 'G', 'gg', 'de', 'ciwW<Esc>', 'vjd', 'Vd', 'X', '3x', 'f(', '%', '}', 'diw'];
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let trial = 0; trial < 60; trial++) {
      let keys = '';
      for (let k = 0; k < 25; k++) keys += alphabet[Math.floor(rnd() * alphabet.length)];
      const start = Math.floor(rnd() * base.length);
      const r = V.run(base, start, keys + 'u'.repeat(200));
      expect(r.text, keys).toBe(base);
    }
  });
});

describe('RF-51.2 · búsqueda y órdenes', () => {
  it('/ busca hacia delante y n repite', () => {
    check('|a x b x c x', '/x<CR>', 'a |x b x c x');
    check('|a x b x c x', '/x<CR>n', 'a x b |x c x');
    check('|a x b x c x', '/x<CR>nN', 'a |x b x c x');
  });
  it('? busca hacia atrás', () => check('a x b x |c', '?x<CR>', 'a x b |x c'));
  it('la búsqueda da la vuelta y avisa', () => {
    const r = V.run('a x b', 4, '/x<CR>');
    expect(r.cursor).toBe(2);
    expect(r.messages).toContain('searchWrappedBottom');
  });
  it('sin coincidencias avisa', () => expect(V.run('abc', 0, '/zz<CR>').messages).toContain('patternNotFound'));
  it('no distingue mayúsculas', () => check('|a X', '/x<CR>', 'a |X'));
  it('/ con <BS> en vacío cancela', () => expect(V.run('abc', 0, '/<BS>').mode).toBe('normal'));
  it('la línea de órdenes se ve mientras se escribe', () => expect(V.run('abc', 0, ':wq').cmdline).toBe(':wq'));
  it(':w, :wq, :x y :q', () => {
    expect(V.run('a', 0, ':w<CR>').commands).toEqual(['save']);
    expect(V.run('a', 0, ':wq<CR>').commands).toEqual(['savequit']);
    expect(V.run('a', 0, ':x<CR>').commands).toEqual(['savequit']);
    expect(V.run('a', 0, ':q<CR>').commands).toEqual(['quit']);
  });
  it(':{n} va a la línea', () => check('|a\nb\n  c', ':3<CR>', 'a\nb\n  |c'));
  it('orden desconocida avisa', () => expect(V.run('a', 0, ':foo<CR>').messages).toContain('unknownCommand'));
  it('Esc cancela la línea de órdenes', () => {
    const r = V.run('a', 0, ':w<Esc>');
    expect(r.mode).toBe('normal');
    expect(r.commands).toEqual([]);
  });
});

describe('RF-51.6/51.7 · teclado', () => {
  const K = (o) => V.keyFromEvent({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  it('letras y teclas especiales', () => {
    expect(K({ key: 'j' })).toBe('j');
    expect(K({ key: 'Escape' })).toBe('Escape');
    expect(K({ key: '$' })).toBe('$');
  });
  it('los atajos de la app con Ctrl/Cmd no se toman', () => {
    expect(K({ key: 's', ctrlKey: true })).toBe(null);
    expect(K({ key: 'f', ctrlKey: true })).toBe(null);
    expect(K({ key: 'e', metaKey: true })).toBe(null);
    expect(K({ key: 'S', ctrlKey: true, shiftKey: true })).toBe(null);
  });
  it('Ctrl+R, Ctrl+D, Ctrl+U, Ctrl+[ y Ctrl+Z sí', () => {
    expect(K({ key: 'r', ctrlKey: true })).toBe('<C-r>');
    expect(K({ key: 'd', ctrlKey: true })).toBe('<C-d>');
    expect(K({ key: 'u', ctrlKey: true })).toBe('<C-u>');
    expect(K({ key: '[', ctrlKey: true })).toBe('<C-[>');
    expect(K({ key: 'z', ctrlKey: true })).toBe('<C-z>');
  });
  it('durante una composición IME no se interpreta nada', () => {
    expect(K({ key: 'ㅎ', isComposing: true })).toBe(null);
    expect(K({ key: 'Process', keyCode: 229 })).toBe(null);
  });
  it('flechas y F-teclas quedan para el textarea', () => {
    expect(K({ key: 'ArrowDown' })).toBe(null);
    expect(K({ key: 'F1' })).toBe(null);
  });
});

describe('RF-51.9 · latencia', () => {
  it('con 5.000 líneas cada tecla en Normal se resuelve en < 16 ms', () => {
    const text = Array.from({ length: 5000 }, (_, i) => `línea ${i} con (algo) de texto, más palabras`).join('\n');
    let st = V.initialState();
    const buf = { text, selStart: Math.floor(text.length / 2), selEnd: Math.floor(text.length / 2) };
    let worst = 0;
    for (const key of ['j', 'k', 'w', 'b', 'e', '$', '0', '}', '{', '%', 'G', 'g', 'g', 'x', 'u']) {
      const t0 = performance.now();
      const r = V.step(st, key, buf);
      worst = Math.max(worst, performance.now() - t0);
      st = r.state;
      buf.selStart = buf.selEnd = r.cursor;
    }
    expect(worst).toBeLessThan(16);
  });
});
