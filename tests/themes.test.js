// =============================================================================
// dbv-md-reader — Tests del catálogo de temas y del tema Personalizado (RF-49, RF-50)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lógica pura (paletas, contraste, validación, migración, botones rápidos) y el arranque en el DOM de jsdom:
// la hoja `#theme-tokens`, `data-theme` sin estilos en línea (D1) y el evento `storage` (D4). Si el repo hermano
// `../dbv-typst-editor` está al lado, se comprueba además que los 18 tokens comunes no se han desviado (D3).
//
// @spec RF-49, RF-50

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const SRC = readFileSync(resolve(process.cwd(), 'src', 'themes.js'), 'utf8');
const CSS = readFileSync(resolve(process.cwd(), 'src', 'styles.css'), 'utf8');

/** Solo la lógica pura: sin `document` en el contexto, themes.js no arranca nada. */
function pure() {
  const sandbox = {};
  sandbox.self = sandbox;
  vm.runInNewContext(SRC, sandbox);
  return sandbox.DBVThemes;
}

/** Con el DOM de jsdom: arranca como en el WebView y devuelve la API. */
function booted() {
  document.getElementById('theme-tokens')?.remove();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
  const sandbox = { document, window, console };
  sandbox.self = sandbox;
  vm.runInNewContext(SRC, sandbox);
  return sandbox.DBVThemes;
}

const T = pure();
const curatedIds = ['dark', 'light', 'sepia', 'high-contrast', 'nord', 'dracula', 'catppuccin-mocha', 'catppuccin-latte', 'solarized-dark', 'gruvbox-dark'];

describe('RF-49.1/49.2 · catálogo', () => {
  it('los 10 curados de typst, en su orden, más Personalizado', () => {
    expect(T.CURATED_THEMES.map((c) => c.id)).toEqual(curatedIds);
    expect(T.ALL_THEME_IDS).toEqual([...curatedIds, 'custom']);
  });

  it('cada tema tiene icono, clave de nombre y la marca de oscuro/claro', () => {
    for (const c of T.CURATED_THEMES) {
      expect(c.icon).toBeTruthy();
      expect(c.labelKey).toMatch(/^theme\./);
      expect(typeof c.isDark).toBe('boolean');
    }
  });
});

describe('RF-49.6 · cada tema define todos los tokens que usa styles.css', () => {
  // Solo `var(--x)` sin valor de reserva: `--alert-color` (local de cada alerta) y `--accent-soft` llevan el suyo.
  const used = [...new Set([...CSS.matchAll(/var\((--(?:bg|text|accent|border|code|quote|shadow|alert)[\w-]*)\)/g)].map((m) => m[1]))];

  it('styles.css usa tokens de tema (hay algo que comprobar)', () => {
    expect(used.length).toBeGreaterThan(15);
  });

  it('la lista de themes.js cubre todos los que se usan', () => {
    expect(used.filter((k) => !T.ALL_TOKEN_KEYS.includes(k))).toEqual([]);
  });

  for (const id of [...curatedIds, 'custom']) {
    it(`${id} define los ${T.ALL_TOKEN_KEYS.length} tokens con un valor`, () => {
      const d = T.describe(id, null);
      const missing = T.ALL_TOKEN_KEYS.filter((k) => !d.tokens[k]);
      expect(missing).toEqual([]);
    });
  }

  it('la reserva :root de styles.css es el Oscuro de themes.js (sin JavaScript se ve igual)', () => {
    const block = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {')));
    const dark = T.describe('dark').tokens;
    for (const k of T.ALL_TOKEN_KEYS) {
      const m = new RegExp(`${k}:\\s*([^;]+);`).exec(block);
      expect(m, k).not.toBeNull();
      expect(m[1].trim().replace(/\s+/g, ' ')).toBe(dark[k]);
    }
  });

  it('la impresión fuerza la paleta Clara de themes.js (RF-10) y gana a las reglas de tema', () => {
    const at = CSS.indexOf('html:root[data-theme]');
    expect(at).toBeGreaterThan(-1);
    const block = CSS.slice(at, CSS.indexOf('}', at));
    const light = T.describe('light').tokens;
    for (const k of T.CUSTOM_THEME_KEYS) expect(new RegExp(`${k}:\\s*${light[k]};`).test(block), k).toBe(true);
  });
});

describe('RF-49.3 · contraste de los curados (WCAG)', () => {
  for (const c of T.CURATED_THEMES) {
    it(`${c.id}: texto ≥ 4,5:1 y secundario, código y alertas ≥ 3:1`, () => {
      const k = c.tokens;
      const low = [];
      if (T.contrastRatio(k['--text-primary'], k['--bg-primary']) < 4.5) low.push('text-primary');
      if (T.contrastRatio(k['--text-secondary'], k['--bg-primary']) < 3) low.push('text-secondary');
      for (const key of ['--code-keyword', '--code-string', '--code-comment', '--code-function', '--code-number', '--code-tag', '--code-class', '--code-operator']) {
        if (T.contrastRatio(k[key], k['--code-bg']) < 3) low.push(key);
      }
      for (const key of ['--alert-note', '--alert-tip', '--alert-important', '--alert-warning', '--alert-caution']) {
        if (T.contrastRatio(k[key], k['--bg-primary']) < 3) low.push(key);
      }
      expect(low).toEqual([]);
    });
  }
});

describe('RF-50.7 · contraste y colores', () => {
  it('pares conocidos', () => {
    expect(T.contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(T.contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(T.contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(T.contrastRatio('nada', '#ffffff')).toBe(1);
  });

  it('normalizeHex solo acepta #rgb y #rrggbb', () => {
    expect(T.normalizeHex('#ABC')).toBe('#aabbcc');
    expect(T.normalizeHex(' #A1b2C3 ')).toBe('#a1b2c3');
    for (const bad of ['red', '#12345', '#1234567', 'url(x)', '#fff;}', null, 42, {}]) expect(T.normalizeHex(bad)).toBeNull();
  });
});

describe('RF-49.5 · migración del tema guardado', () => {
  it('light, dark y sepia de antes se conservan; lo desconocido cae a Oscuro', () => {
    expect(T.resolveThemeId('light')).toBe('light');
    expect(T.resolveThemeId('dark')).toBe('dark');
    expect(T.resolveThemeId('sepia')).toBe('sepia');
    expect(T.resolveThemeId('dracula')).toBe('dracula');
    expect(T.resolveThemeId('solarized')).toBe('dark');
    expect(T.resolveThemeId(null)).toBe('dark');
  });
});

describe('RF-50.2/50.5 · botones rápidos', () => {
  it('por defecto Claro, Oscuro y Sepia (la cabecera se ve como antes)', () => {
    expect(T.parseSlots(null)).toEqual(['light', 'dark', 'sepia']);
  });

  it('se aceptan 3 ids válidos, Personalizado incluido', () => {
    expect(T.parseSlots('["nord","custom","dark"]')).toEqual(['nord', 'custom', 'dark']);
  });

  it('JSON dañado, longitud distinta o id desconocido → los de por defecto', () => {
    for (const raw of ['{', '[]', '["nord","dark"]', '["nord","dark","x"]', '"dark"', '[1,2,3]']) {
      expect(T.parseSlots(raw)).toEqual(['light', 'dark', 'sepia']);
    }
  });
});

describe('RF-50.4 · el Personalizado no deja colar nada que no sea un color (adversary)', () => {
  const evil = {
    '--bg-primary': '#fff;}body{background:url(https://x/?leak)',
    '--text-primary': '@import url(https://x)',
    '--accent': 'expression(alert(1))',
    '--border': '#123456',
    '--evil': '#000000',
    '--code-bg': 'url(data:x)',
  };

  it('solo pasan los #rrggbb de la lista blanca; lo demás toma el tema de origen', () => {
    const out = T.sanitizeCustom(evil, T.describe('light').tokens);
    expect(Object.keys(out).sort()).toEqual([...T.CUSTOM_THEME_KEYS].sort());
    expect(out['--border']).toBe('#123456');
    expect(out['--bg-primary']).toBe('#ffffff');
    expect(out['--text-primary']).toBe('#1f2328');
    expect(Object.values(out).every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
  });

  it('la hoja construida con una carga maliciosa no contiene url(, @, expression ni reglas extra', () => {
    const css = T.buildThemeCss(evil);
    expect(css).not.toMatch(/url\(|@|expression|--evil/);
    expect((css.match(/\{/g) || []).length).toBe(11);
    expect((css.match(/\}/g) || []).length).toBe(11);
  });

  it('localStorage con JSON dañado o no objeto → colores del Oscuro', () => {
    const dark = T.describe('dark').tokens;
    for (const raw of ['{', '"x"', 'null', '[1]']) {
      const out = T.parseCustom(raw);
      for (const k of T.CUSTOM_THEME_KEYS) expect(out[k]).toBe(dark[k]);
    }
  });

  it('isDark del Personalizado sale de la luminancia de su fondo', () => {
    expect(T.describe('custom', { '--bg-primary': '#ffffff' }).isDark).toBe(false);
    expect(T.describe('custom', { '--bg-primary': '#101010' }).isDark).toBe(true);
  });
});

describe('RF-49.4/50.5 · arranque en el DOM, persistencia y otras ventanas', () => {
  beforeEach(() => { localStorage.clear(); });

  it('sin nada guardado: Oscuro, hoja #theme-tokens con las 11 reglas y sin estilos en línea en <html> (D1)', () => {
    const Th = booted();
    expect(Th.getTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const sheet = document.getElementById('theme-tokens');
    expect(sheet).not.toBeNull();
    expect((sheet.textContent.match(/:root\[data-theme="/g) || []).length).toBe(11);
    expect(document.documentElement.getAttribute('style')).toBeNull();
  });

  it('un tema guardado de la 0.19.0 se conserva al arrancar', () => {
    localStorage.setItem('dbv-md-theme', 'sepia');
    expect(booted().getTheme()).toBe('sepia');
  });

  it('setTheme guarda, cambia data-theme y avisa; un id desconocido no cambia nada', () => {
    const Th = booted();
    const seen = [];
    Th.onChange((id) => seen.push(id));
    Th.setTheme('nord');
    Th.setTheme('no-existe');
    expect(seen).toEqual(['nord']);
    expect(localStorage.getItem('dbv-md-theme')).toBe('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
  });

  it('setSlot guarda el botón; índices o ids no válidos se ignoran', () => {
    const Th = booted();
    Th.setSlot(1, 'dracula');
    Th.setSlot(3, 'nord');
    Th.setSlot(0, 'x');
    expect(Th.getSlots()).toEqual(['light', 'dracula', 'sepia']);
    expect(JSON.parse(localStorage.getItem('dbv-md-theme-slots'))).toEqual(['light', 'dracula', 'sepia']);
  });

  it('copyToCustom activa el Personalizado con la paleta de origen y setCustom reescribe su regla', () => {
    const Th = booted();
    Th.copyToCustom('gruvbox-dark');
    expect(Th.getTheme()).toBe('custom');
    expect(Th.getCustom()['--bg-primary']).toBe('#282828');
    Th.setCustom({ '--accent': '#ff00ff', '--bg-primary': 'url(x)' });
    const css = document.getElementById('theme-tokens').textContent;
    const rule = css.slice(css.indexOf(':root[data-theme="custom"]'));
    expect(rule).toContain('--accent: #ff00ff;');
    expect(rule).toContain('--bg-primary: #282828;');
    expect(JSON.parse(localStorage.getItem('dbv-md-custom-theme'))['--accent']).toBe('#ff00ff');
  });

  it('el evento storage de otra ventana aplica el tema sin reiniciar (D4)', () => {
    const Th = booted();
    const seen = [];
    Th.onChange((id) => seen.push(id));
    localStorage.setItem('dbv-md-theme', 'catppuccin-latte');
    window.dispatchEvent(new StorageEvent('storage', { key: 'dbv-md-theme', newValue: 'catppuccin-latte' }));
    expect(Th.getTheme()).toBe('catppuccin-latte');
    expect(document.documentElement.getAttribute('data-theme')).toBe('catppuccin-latte');
    expect(seen).toContain('catppuccin-latte');
  });
});

// D3: deriva frente a typst. Se salta si el repo hermano no está (CI, otra máquina).
const typstPath = resolve(process.cwd(), '..', 'dbv-typst-editor', 'src', 'themes', 'theme.js');
describe.skipIf(!existsSync(typstPath))('D3 · los 18 tokens comunes son los de dbv-typst-editor', () => {
  // El cuerpo de un `describe` omitido se ejecuta igual al recoger los tests: no leer si no está.
  const typst = existsSync(typstPath) ? readFileSync(typstPath, 'utf8') : '';
  for (const c of T.CURATED_THEMES) {
    it(c.id, () => {
      const at = typst.indexOf(`id: '${c.id}'`);
      expect(at).toBeGreaterThan(-1);
      const block = typst.slice(at, typst.indexOf('},', typst.indexOf('tokens:', at)));
      for (const k of T.CUSTOM_THEME_KEYS) {
        const m = new RegExp(`'${k}':\\s*'(#[0-9a-fA-F]{6})'`).exec(block);
        expect(m, `${c.id} ${k}`).not.toBeNull();
        expect(c.tokens[k], `${c.id} ${k}`).toBe(m[1].toLowerCase());
      }
    });
  }
});
