// =============================================================================
// dbv-md-reader — Tests del registro de idiomas, el coreano y la puerta de higiene (RF-39, RF-40)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-16, RF-39, RF-40, RF-47

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const read = (name) => readFileSync(resolve(SRC, name), 'utf8');

/** Carga i18n.js (y los idiomas extra) en un contexto aislado con un `navigator` y un `localStorage` simulados. */
function loadI18n({ navLang = 'es-ES', stored = null, extra = ['i18n.ko.js'] } = {}) {
  const store = new Map(stored ? [['dbv-md-lang', stored]] : []);
  const sandbox = {
    document: { dispatchEvent: () => true, documentElement: { setAttribute: () => {} }, querySelectorAll: () => [] },
    navigator: { language: navLang },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['i18n.js', ...extra]) vm.runInContext(read(file), sandbox, { filename: file });
  return { I: sandbox.DBV_I18N, store };
}

describe('RF-39 · registro de idiomas', () => {
  it('lista los idiomas con su nombre nativo, en orden de registro', () => {
    const { I } = loadI18n();
    expect(I.languages()).toEqual([
      { code: 'es', name: 'Español' },
      { code: 'en', name: 'English' },
      { code: 'ko', name: '한국어' },
    ]);
  });

  it('registerLanguage añade un idioma nuevo sin tocar nada más', () => {
    const { I } = loadI18n({ extra: [] });
    expect(I.registerLanguage('fr', 'Français', { 'toolbar.noDocument': 'Aucun document' })).toBe(true);
    expect(I.languages().map((l) => l.code)).toEqual(['es', 'en', 'fr']);
    I.setLang('fr', { persist: false });
    expect(I.t('toolbar.noDocument')).toBe('Aucun document');
  });

  it('rechaza códigos que no son un subtag corto de idioma', () => {
    const { I } = loadI18n({ extra: [] });
    expect(I.registerLanguage('KO', 'x', {})).toBe(false);
    expect(I.registerLanguage('korean', 'x', {})).toBe(false);
    expect(I.registerLanguage('', 'x', {})).toBe(false);
    expect(I.languages()).toHaveLength(2);
  });
});

describe('RF-39.3 · detección en el primer arranque', () => {
  const cases = [
    ['ko-KR', 'ko'], ['ko', 'ko'], ['es-MX', 'es'], ['es', 'es'], ['en-GB', 'en'], ['en-US', 'en'],
    ['fr-FR', 'en'], ['pt-BR', 'en'], ['de', 'en'], ['', 'en'], ['zh-Hans-CN', 'en'],
  ];
  it.each(cases)('el sistema %s → %s (si no está soportado, inglés)', (tag, expected) => {
    expect(loadI18n({ navLang: tag }).I.getLang()).toBe(expected);
  });

  it('una elección guardada gana al idioma del sistema', () => {
    expect(loadI18n({ navLang: 'ko-KR', stored: 'es' }).I.getLang()).toBe('es');
  });

  it('un valor guardado que ya no existe se ignora y se autodetecta', () => {
    expect(loadI18n({ navLang: 'ko-KR', stored: 'xx' }).I.getLang()).toBe('ko');
  });
});

describe('RF-39.4 · solo se guarda la elección explícita', () => {
  it('el arranque aplica el idioma detectado SIN guardarlo (como hace init() de app.js)', () => {
    const { I, store } = loadI18n({ navLang: 'ko-KR' });
    I.setLang(I.getLang(), { persist: false });
    expect(I.getLang()).toBe('ko');
    expect(store.has('dbv-md-lang')).toBe(false);
  });

  it('elegir un idioma lo guarda', () => {
    const { I, store } = loadI18n({ navLang: 'es-ES' });
    I.setLang('ko');
    expect(store.get('dbv-md-lang')).toBe('ko');
  });

  it('un idioma no registrado no cambia nada', () => {
    const { I, store } = loadI18n({ navLang: 'es-ES' });
    I.setLang('xx');
    expect(I.getLang()).toBe('es');
    expect(store.has('dbv-md-lang')).toBe(false);
  });
});

describe('RF-39.5 · reserva de textos: idioma → inglés → clave', () => {
  it('una clave que falta en el idioma activo sale en inglés', () => {
    const { I } = loadI18n({ navLang: 'ko-KR' });
    I.registerLanguage('en', 'English', { 'prueba.solo.en': 'Only in English' });
    expect(I.t('prueba.solo.en')).toBe('Only in English');
  });

  it('una clave que no existe en ningún sitio sale tal cual', () => {
    expect(loadI18n().I.t('no.existe.nunca')).toBe('no.existe.nunca');
  });

  it('los textos de los módulos de la IA (register) caen al inglés en un idioma que no trae los suyos', () => {
    const { I } = loadI18n({ navLang: 'ko-KR' });
    I.register({ es: { 'ai.demo': 'Hola' }, en: { 'ai.demo': 'Hello' } });
    expect(I.t('ai.demo')).toBe('Hello');
  });

  it('sustituye los marcadores {n} también en coreano', () => {
    const { I } = loadI18n({ navLang: 'ko-KR' });
    expect(I.t('img.savedMany', { n: 3 })).toContain('3');
  });
});

describe('RF-39.6 · integridad: todos los idiomas tienen exactamente las claves del inglés', () => {
  const { I } = loadI18n();
  const reference = I.keysOf('en').sort();

  it('hay claves que comparar', () => {
    expect(reference.length).toBeGreaterThan(150);
  });

  for (const lang of ['es', 'ko']) {
    it(`${lang} tiene las mismas claves que en`, () => {
      const keys = I.keysOf(lang).sort();
      expect(keys.filter((k) => !reference.includes(k))).toEqual([]);
      expect(reference.filter((k) => !keys.includes(k))).toEqual([]);
    });
  }

  it('ningún valor está vacío en ningún idioma', () => {
    const empty = [];
    for (const lang of ['es', 'en', 'ko']) {
      const forLang = loadI18n({ navLang: lang }).I;
      forLang.setLang(lang, { persist: false });
      for (const key of forLang.keysOf(lang)) {
        if (forLang.t(key) === '') empty.push(`${lang}:${key}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('cada guía markdownhelp_<código>.md corresponde a un idioma registrado, y a la inversa', () => {
    const guides = readdirSync(SRC).filter((f) => /^markdownhelp_[a-z]{2,3}\.md$/.test(f)).map((f) => f.slice(13, -3)).sort();
    expect(guides).toEqual(I.languages().map((l) => l.code).sort());
  });
});

// ─── Puerta de higiene del texto de terceros (RF-40.3) ───────────────────────────────────────────────
// Aplica a TODO idioma, presente y futuro: un diccionario o una guía traducidos por otra persona son
// contenido no fiable. Se rechaza lo que no se ve (Trojan Source), el código y todo enlace o etiqueta que
// no esté ya en la versión inglesa de referencia.

// Solo caracteres ASCII: en coreano una partícula puede ir pegada a la URL (`https://로`) y no es parte de ella.
const urlsOf = (text) => new Set(text.match(/https?:\/\/[^\s)\]>"'`\u0080-\uffff]+/g) ?? []);
const tagsOf = (text) => new Set(text.match(/<\/?[A-Za-z][A-Za-z0-9-]*/g) ?? []);

/**
 * Lista de problemas de higiene de `text` frente a `reference` (el mismo contenido en inglés).
 * `thirdParty` (por defecto sí): además de lo invisible y lo peligroso, rechaza URLs y etiquetas que no estén en el
 * inglés. El español y el inglés son del mantenedor y localizan sus ejemplos (`ejemplo.com`, `documento.md`).
 */
function hygieneIssues(text, reference, { thirdParty = true } = {}) {
  const issues = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const control = /\p{Cc}/u.test(ch) && ch !== '\n' && ch !== '\r' && ch !== '\t';
    const invisible = /\p{Cf}|\p{Co}|\p{Cs}/u.test(ch) || cp === 0x00ad;
    if (control || invisible) issues.push(`carácter invisible o de control U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
  }
  if (/javascript:|data:text\/html|vbscript:/i.test(text)) issues.push('esquema de URL peligroso');
  if (/<[^>]*\son[a-z]+\s*=/i.test(text)) issues.push('atributo de evento (on…=)');
  if (thirdParty) {
    const refUrls = urlsOf(reference);
    for (const url of urlsOf(text)) if (!refUrls.has(url)) issues.push(`URL que no está en la versión inglesa: ${url}`);
    const refTags = tagsOf(reference);
    for (const tag of tagsOf(text)) if (!refTags.has(tag)) issues.push(`etiqueta que no está en la versión inglesa: ${tag}`);
  }
  return issues;
}

describe('RF-40.3 · la puerta de higiene detecta lo que debe (muestras hostiles)', () => {
  const ref = 'Hello <b>world</b> https://example.com';
  it('acepta un texto limpio con las mismas URLs y etiquetas', () => {
    expect(hygieneIssues('안녕 <b>세계</b> https://example.com', ref)).toEqual([]);
  });
  it.each([
    ['espacio de ancho cero', 'a​b'],
    ['marca de dirección derecha-izquierda', 'a‏b'],
    ['anulación bidi (Trojan Source)', 'a‮b'],
    ['aislamiento bidi', 'a⁦b'],
    ['BOM en medio', 'a﻿b'],
    ['guion blando', 'a­b'],
    ['carácter de control', 'a\u0007b'],
    ['esquema javascript:', '[x](javascript:alert(1))'],
    ['atributo onclick', '<b onclick="x()">a</b>'],
    ['URL nueva', 'ver https://malo.example/x'],
    ['etiqueta nueva', '<img src=x>'],
    ['script', '<script>x</script>'],
  ])('rechaza: %s', (_name, text) => {
    expect(hygieneIssues(text, ref).length).toBeGreaterThan(0);
  });
});

describe('RF-40.3 · todos los idiomas pasan la puerta de higiene', () => {
  const english = loadI18n({ navLang: 'en-US' }).I;
  english.setLang('en', { persist: false });
  const options = (lang) => ({ thirdParty: !['es', 'en'].includes(lang) });

  for (const lang of ['es', 'ko']) {
    it(`el diccionario ${lang}: cada texto limpio${lang === 'ko' ? ' y sin URLs ni etiquetas que no estén en el inglés de su clave' : ''}`, () => {
      const I = loadI18n({ navLang: lang }).I;
      I.setLang(lang, { persist: false });
      const problems = [];
      for (const key of I.keysOf('en')) {
        const issues = hygieneIssues(I.t(key), english.t(key), options(lang));
        if (issues.length) problems.push(`${lang}:${key} → ${issues.join('; ')}`);
      }
      expect(problems).toEqual([]);
    });
  }

  for (const lang of ['es', 'ko']) {
    it(`la guía markdownhelp_${lang}.md: sin caracteres ocultos${lang === 'ko' ? ' y con las mismas URLs y etiquetas que la inglesa' : ''}`, () => {
      expect(hygieneIssues(read(`markdownhelp_${lang}.md`), read('markdownhelp_en.md'), options(lang))).toEqual([]);
    });
  }

  it('la guía coreana tiene las mismas secciones que la inglesa (mismo número de encabezados y de bloques de código)', () => {
    const count = (text, re) => (text.match(re) ?? []).length;
    expect(count(read('markdownhelp_ko.md'), /^#{1,6} /gm)).toBe(count(read('markdownhelp_en.md'), /^#{1,6} /gm));
    expect(count(read('markdownhelp_ko.md'), /^```/gm)).toBe(count(read('markdownhelp_en.md'), /^```/gm));
  });
});

// ─── Guía de la aplicación (RF-47) ───────────────────────────────────────────────────────────────────
// `apphelp_<código>.md` es la pestaña «Guía de la aplicación» de la ayuda. Es del mantenedor en es/en; los demás
// idiomas la leen en inglés (`fetchHelp` cae a `en`), así que aquí solo se exigen es y en.

/** Mismo generador de ids que `githubSlug()` de app.js, sobre el texto visible del encabezado. */
function slugsOf(markdown) {
  const used = {};
  const slugs = new Set();
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,6} (.*)$/.exec(line);
    if (!heading) continue;
    const visible = heading[1].replace(/[*_`]/g, '');
    const slug = visible.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
    const count = used[slug] ?? 0;
    used[slug] = count + 1;
    slugs.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return slugs;
}

const internalLinks = (markdown) => [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1]));

describe('RF-47 · guía de la aplicación', () => {
  const GUIDES = { es: read('apphelp_es.md'), en: read('apphelp_en.md') };

  it.each(['es', 'en'])('apphelp_%s.md: todos los enlaces del índice apuntan a un encabezado que existe', (lang) => {
    const slugs = slugsOf(GUIDES[lang]);
    const links = internalLinks(GUIDES[lang]);
    expect(links.length).toBeGreaterThanOrEqual(11);
    expect(links.filter((link) => !slugs.has(link))).toEqual([]);
  });

  it('la guía española y la inglesa tienen la misma estructura (encabezados, tablas y bloques de código)', () => {
    const count = (text, re) => (text.match(re) ?? []).length;
    for (const re of [/^#{1,6} /gm, /^\| /gm, /^```/gm, /\]\(#/g]) {
      expect(count(GUIDES.es, re)).toBe(count(GUIDES.en, re));
    }
  });

  it('el apartado de atajos recoge los atajos principales de la aplicación, también F1', () => {
    for (const lang of ['es', 'en']) {
      for (const shortcut of ['F1', 'Ctrl/Cmd + N', 'Ctrl/Cmd + O', 'Ctrl/Cmd + S', 'Ctrl/Cmd + P', 'Ctrl/Cmd + F', 'Ctrl/Cmd + K', 'Ctrl/Cmd + E', 'Alt + ↑']) {
        expect(GUIDES[lang], `${lang}: ${shortcut}`).toContain(shortcut);
      }
    }
  });

  // Si alguien renombra una entrada de menú, la guía dejaría de decir lo que se ve en pantalla.
  const LABEL_KEYS = [
    'menu.file', 'menu.tools', 'menu.prefs', 'menu.newDoc', 'menu.openFile', 'menu.openUrl', 'menu.recent', 'menu.connectAi',
    'menu.width.narrow', 'menu.width.normal', 'menu.width.wide', 'menu.width.full', 'menu.wideBlocks', 'menu.rememberWindow',
    'menu.showAi', 'menu.editorFont', 'menu.editorFont.dec', 'menu.editorFont.inc', 'menu.editorFont.reset',
    'sidebar.tabIndex', 'sidebar.tabFiles', 'ai.tab', 'search.targetLabel', 'search.target.editor', 'search.target.preview',
    'code.wrapOn', 'about.checkUpdate', 'ai.menu.inline', 'doc.readOnly', 'doc.modified', 'menu.quickOpen',
  ];
  it.each(['es', 'en'])('apphelp_%s.md nombra las entradas de la interfaz tal como se ven', (lang) => {
    const I = loadI18n({ navLang: lang }).I;
    I.setLang(lang, { persist: false });
    const guide = GUIDES[lang].toLowerCase();
    const missing = LABEL_KEYS.filter((key) => !guide.includes(I.t(key).replace(/…$/, '').toLowerCase()));
    expect(missing).toEqual([]);
  });

  it.each(['es', 'en'])('apphelp_%s.md: sin caracteres ocultos, esquemas peligrosos ni atributos de evento', (lang) => {
    expect(hygieneIssues(GUIDES[lang], GUIDES.en, { thirdParty: false })).toEqual([]);
  });

  it('los enlaces externos de la guía en español están también en la inglesa (salvo la guía de la IA, que es por idioma)', () => {
    const strip = (set) => [...set].filter((url) => !/docs\/IA/.test(url)).sort();
    expect(strip(urlsOf(GUIDES.es))).toEqual(strip(urlsOf(GUIDES.en)));
  });

  it('las claves nuevas de la ayuda existen en los tres idiomas', () => {
    for (const lang of ['es', 'en', 'ko']) {
      const I = loadI18n({ navLang: lang }).I;
      I.setLang(lang, { persist: false });
      for (const key of ['help.tabApp', 'help.tabSyntax', 'menu.help']) expect(I.t(key), `${lang}:${key}`).not.toBe(key);
    }
  });
});
