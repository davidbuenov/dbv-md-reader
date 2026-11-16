// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Catálogo de temas de la colección: 10 curados + Personalizado (RF-49, RF-50).
//
// FUENTE ÚNICA de las paletas. Los 18 tokens comunes son los de
// `dbv-typst-editor/src/themes/theme.js` (un test compara los dos ficheros si
// el repo hermano está al lado). Los propios de esta app (`--quote-bg`,
// `--shadow`, `--alert-*`) se definen aquí para cada tema.
//
// Cómo se aplica (ADR-053, decisiones D1/D2 del plan de la 0.20.0):
//   - Se carga en el <head>, ANTES de pintar: escribe UNA hoja
//     `<style id="theme-tokens">` con una regla `:root[data-theme="<id>"]` por
//     tema y fija `data-theme`. Sin estilos en línea en <html>: si los hubiera,
//     ganarían al bloque `@media print` que fuerza la paleta Clara (RF-10).
//   - El Personalizado viene de `localStorage`, así que sus colores se validan
//     uno a uno contra `#rrggbb` y solo se escriben los de una lista blanca de
//     nombres: un valor manipulado no puede colar `url(`, `;}` ni `@import`.
//   - Las demás ventanas del proceso se enteran por el evento `storage` (D4).
//
// UMD: en Node (tests) solo exporta la lógica pura; en el WebView además
// arranca el tema y expone `window.DBVThemes`.
//
// @spec RF-49, RF-50
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.DBVThemes = api;
    if (typeof document !== 'undefined') api.boot();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'dbv-md-theme';
  var SLOTS_KEY = 'dbv-md-theme-slots';
  var CUSTOM_KEY = 'dbv-md-custom-theme';
  var DEFAULT_THEME = 'dark';
  var DEFAULT_SLOTS = ['light', 'dark', 'sepia'];

  /** Tokens editables del Personalizado: los 18 comunes con typst (lista blanca de nombres). */
  var CUSTOM_THEME_KEYS = [
    '--bg-primary', '--bg-secondary', '--bg-tertiary',
    '--text-primary', '--text-secondary', '--text-muted',
    '--accent', '--accent-hover', '--border', '--code-bg',
    '--code-keyword', '--code-string', '--code-comment', '--code-function',
    '--code-number', '--code-tag', '--code-class', '--code-operator'
  ];

  var ALERT_KEYS = ['--alert-note', '--alert-tip', '--alert-important', '--alert-warning', '--alert-caution'];

  /** Todos los tokens que usa `styles.css` (un test lo comprueba contra la hoja). */
  var ALL_TOKEN_KEYS = CUSTOM_THEME_KEYS.concat(['--quote-bg', '--shadow'], ALERT_KEYS);

  // Alertas de GitHub, las de siempre de esta app (RF-02); el resto de temas usa colores de su propia paleta.
  var GITHUB_DARK_ALERTS = ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f85149'];
  var GITHUB_LIGHT_ALERTS = ['#0969da', '#1a7f37', '#8250df', '#9a6700', '#cf222e'];

  var HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  /** `#abc`/`#AABBCC` → `#aabbcc`; cualquier otra cosa → null. */
  function normalizeHex(value) {
    var match = typeof value === 'string' ? HEX_RE.exec(value.trim()) : null;
    var body = match ? match[1].toLowerCase() : null;
    var result = null;
    if (body) result = '#' + (body.length === 3 ? body[0] + body[0] + body[1] + body[1] + body[2] + body[2] : body);
    return result;
  }

  /** Luminancia relativa WCAG 2.1 (0 negro … 1 blanco), o null si no es un color hex. */
  function relativeLuminance(hex) {
    var full = normalizeHex(hex);
    var result = null;
    if (full) {
      var c = [1, 3, 5].map(function (i) {
        var v = parseInt(full.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      result = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    return result;
  }

  /** Ratio de contraste WCAG 2.1 (1 … 21); 1 si alguno no es un color hex. */
  function contrastRatio(fg, bg) {
    var l1 = relativeLuminance(fg);
    var l2 = relativeLuminance(bg);
    var ratio = 1;
    if (l1 !== null && l2 !== null) ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return ratio;
  }

  function isDarkHex(hex) {
    var lum = relativeLuminance(hex);
    return lum === null ? true : lum <= 0.18;
  }

  function rgba(hex, alpha) {
    var full = normalizeHex(hex) || '#000000';
    return 'rgba(' + [1, 3, 5].map(function (i) { return parseInt(full.slice(i, i + 2), 16); }).join(', ') + ', ' + alpha + ')';
  }

  /** Tokens propios de esta app que se deducen de la paleta: fondo de cita y sombra. */
  function derivedTokens(base, isDark) {
    return {
      '--quote-bg': rgba(base['--accent'], isDark ? 0.08 : 0.05),
      '--shadow': isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.12)'
    };
  }

  function withExtras(base, isDark, alerts) {
    var tokens = {};
    CUSTOM_THEME_KEYS.forEach(function (k) { tokens[k] = base[k]; });
    var derived = derivedTokens(base, isDark);
    tokens['--quote-bg'] = derived['--quote-bg'];
    tokens['--shadow'] = derived['--shadow'];
    ALERT_KEYS.forEach(function (k, i) { tokens[k] = alerts[i]; });
    return tokens;
  }

  /** Paleta en el orden de CUSTOM_THEME_KEYS → objeto de tokens. */
  function palette(values) {
    var out = {};
    CUSTOM_THEME_KEYS.forEach(function (k, i) { out[k] = values[i]; });
    return out;
  }

  function curated(id, icon, labelKey, isDark, values, alerts) {
    return { id: id, icon: icon, labelKey: labelKey, isDark: isDark, tokens: withExtras(palette(values), isDark, alerts) };
  }

  //                                    bg-1       bg-2       bg-3       text-1     text-2     muted      accent     accent-h   border     code-bg    keyword    string     comment    function   number     tag        class      operator
  var CURATED_THEMES = [
    curated('dark', '🌙', 'theme.dark', true,
      ['#0d1117', '#161b22', '#21262d', '#f0f6fc', '#9da7b3', '#848d97', '#58a6ff', '#79c0ff', '#30363d', '#161b22', '#e2a8ff', '#85e89d', '#9ca3af', '#ffa657', '#79c0ff', '#ff7b72', '#ffd580', '#7ee7d8'],
      GITHUB_DARK_ALERTS),
    curated('light', '☀️', 'theme.light', false,
      ['#ffffff', '#f6f8fa', '#eaeef2', '#1f2328', '#57606a', '#636c76', '#0969da', '#0550ae', '#d0d7de', '#f6f8fa', '#cf222e', '#0a3069', '#6e7781', '#8250df', '#0550ae', '#116329', '#953800', '#24292f'],
      GITHUB_LIGHT_ALERTS),
    curated('sepia', '📜', 'theme.sepia', false,
      ['#faf3e0', '#f2e8cc', '#e8d9b5', '#3b2c1a', '#6b5240', '#765c47', '#8b4513', '#6b340f', '#d4bc8a', '#f2e8cc', '#9a3324', '#46613e', '#765c47', '#8b4513', '#6b4f8f', '#7a4419', '#8d5510', '#5a4332'],
      GITHUB_LIGHT_ALERTS),
    curated('high-contrast', '◐', 'theme.highContrast', true,
      ['#000000', '#0c0c0c', '#1c1c1c', '#ffffff', '#e2e8f0', '#b8c2cc', '#4dabff', '#82c8ff', '#6b7280', '#0c0c0c', '#ff7edb', '#72f1b8', '#cbd5e1', '#ffd166', '#7cc4ff', '#ff6b6b', '#fde047', '#67e8f9'],
      ['#4dabff', '#72f1b8', '#ff7edb', '#ffd166', '#ff6b6b']),
    curated('nord', '❄', 'theme.nord', true,
      ['#2e3440', '#3b4252', '#434c5e', '#eceff4', '#d8dee9', '#aeb9cc', '#88c0d0', '#8fbcbb', '#4c566a', '#3b4252', '#9ec0e6', '#a3be8c', '#aeb9cc', '#88c0d0', '#d4a6cb', '#eb8b93', '#ebcb8b', '#8fbcbb'],
      ['#88c0d0', '#a3be8c', '#d4a6cb', '#ebcb8b', '#eb8b93']),
    curated('dracula', '🦇', 'theme.dracula', true,
      ['#282a36', '#21222c', '#343746', '#f8f8f2', '#cbd2e6', '#98a2c7', '#bd93f9', '#d1b3ff', '#44475a', '#21222c', '#ff79c6', '#f1fa8c', '#9ca7cc', '#50fa7b', '#bd93f9', '#ff6e6e', '#ffb86c', '#8be9fd'],
      ['#8be9fd', '#50fa7b', '#bd93f9', '#ffb86c', '#ff6e6e']),
    curated('catppuccin-mocha', '☕', 'theme.catppuccinMocha', true,
      ['#1e1e2e', '#181825', '#313244', '#cdd6f4', '#bac2de', '#9399b2', '#89b4fa', '#b4befe', '#45475a', '#181825', '#cba6f7', '#a6e3a1', '#9399b2', '#89b4fa', '#fab387', '#f38ba8', '#f9e2af', '#94e2d5'],
      ['#89b4fa', '#a6e3a1', '#cba6f7', '#f9e2af', '#f38ba8']),
    curated('catppuccin-latte', '🥛', 'theme.catppuccinLatte', false,
      ['#eff1f5', '#e6e9ef', '#dce0e8', '#2e3248', '#4c4f69', '#6c6f85', '#1e66f5', '#1750c4', '#bcc0cc', '#e6e9ef', '#7830c9', '#2c6d24', '#5c5f77', '#1754cc', '#9c4200', '#b00d2e', '#995c00', '#0e6b73'],
      ['#1e66f5', '#2c6d24', '#7830c9', '#995c00', '#b00d2e']),
    curated('solarized-dark', '🌊', 'theme.solarizedDark', true,
      ['#002b36', '#073642', '#0c4654', '#eee8d5', '#b9c4c2', '#8ea0a0', '#3ea1e6', '#62b6f0', '#175160', '#073642', '#a2be1a', '#39bfb2', '#93a1a1', '#4fa9eb', '#ee7db3', '#f0655d', '#d7a61d', '#95a4f0'],
      ['#3ea1e6', '#a2be1a', '#95a4f0', '#d7a61d', '#f0655d']),
    curated('gruvbox-dark', '🌲', 'theme.gruvboxDark', true,
      ['#282828', '#1d2021', '#3c3836', '#ebdbb2', '#d5c4a1', '#a89984', '#83a598', '#8ec07c', '#504945', '#1d2021', '#fb6f5f', '#b8bb26', '#a89984', '#8ec07c', '#d3869b', '#fe8019', '#fabd2f', '#83a598'],
      ['#83a598', '#b8bb26', '#d3869b', '#fabd2f', '#fb6f5f'])
  ];

  var CURATED_BY_ID = {};
  CURATED_THEMES.forEach(function (t) { CURATED_BY_ID[t.id] = t; });
  var ALL_THEME_IDS = CURATED_THEMES.map(function (t) { return t.id; }).concat(['custom']);

  function isThemeId(id) { return ALL_THEME_IDS.indexOf(id) !== -1; }

  /** Id guardado → id válido. `light`/`dark`/`sepia` de antes se conservan; lo desconocido cae a Oscuro (RF-49.5). */
  function resolveThemeId(stored) {
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  }

  /** JSON guardado de los 3 botones rápidos → lista válida, o la de por defecto (RF-50.2, 50.5). */
  function parseSlots(raw) {
    var slots = DEFAULT_SLOTS.slice();
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(isThemeId)) slots = parsed.slice();
    } catch (_) { /* JSON dañado: los de por defecto */ }
    return slots;
  }

  /**
   * Colores del Personalizado: parte de `base` (18 tokens) y solo toma de `input` los nombres de la lista
   * blanca cuyo valor sea un `#rrggbb` válido (RF-50.4). Nunca devuelve otra cosa que colores hex.
   */
  function sanitizeCustom(input, base) {
    var seed = base || CURATED_BY_ID[DEFAULT_THEME].tokens;
    var out = {};
    CUSTOM_THEME_KEYS.forEach(function (k) {
      var hex = input && typeof input === 'object' ? normalizeHex(input[k]) : null;
      out[k] = hex || normalizeHex(seed[k]) || CURATED_BY_ID[DEFAULT_THEME].tokens[k];
    });
    return out;
  }

  /** JSON guardado del Personalizado → 18 colores válidos (los inválidos, del Oscuro). */
  function parseCustom(raw) {
    var parsed = null;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
    return sanitizeCustom(parsed, null);
  }

  /** Descriptor de un tema (id, icono, clave de nombre, isDark y TODOS los tokens); null si no existe. */
  function describe(id, customColors) {
    var result = CURATED_BY_ID[id] || null;
    if (id === 'custom') {
      var colors = sanitizeCustom(customColors, null);
      var dark = isDarkHex(colors['--bg-primary']);
      result = { id: 'custom', icon: '🎨', labelKey: 'theme.custom', isDark: dark, tokens: withExtras(colors, dark, dark ? GITHUB_DARK_ALERTS : GITHUB_LIGHT_ALERTS) };
    }
    return result;
  }

  function ruleFor(theme) {
    var decls = ALL_TOKEN_KEYS.map(function (k) { return '  ' + k + ': ' + theme.tokens[k] + ';'; });
    decls.push('  color-scheme: ' + (theme.isDark ? 'dark' : 'light') + ';');
    return ':root[data-theme="' + theme.id + '"] {\n' + decls.join('\n') + '\n}';
  }

  /** Hoja completa: una regla por tema curado + la del Personalizado (ya validado). */
  function buildThemeCss(customColors) {
    return CURATED_THEMES.concat([describe('custom', customColors)]).map(ruleFor).join('\n');
  }

  // ─── Estado en el WebView ──────────────────────────────────────────────────
  var state = { theme: DEFAULT_THEME, slots: DEFAULT_SLOTS.slice(), custom: sanitizeCustom(null, null) };
  var listeners = [];
  var styleEl = null;

  function storageGet(key) {
    var value = null;
    try { value = window.localStorage.getItem(key); } catch (_) { value = null; }
    return value;
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) { /* sin almacenamiento: solo esta sesión */ }
  }

  function loadState() {
    state.theme = resolveThemeId(storageGet(STORAGE_KEY));
    state.slots = parseSlots(storageGet(SLOTS_KEY));
    state.custom = parseCustom(storageGet(CUSTOM_KEY));
  }

  function writeStylesheet() {
    if (!styleEl) {
      styleEl = document.getElementById('theme-tokens') || document.createElement('style');
      styleEl.id = 'theme-tokens';
      // Antes de styles.css: `:root[data-theme]` del @media print (más específico) sigue ganando.
      var head = document.head || document.documentElement;
      if (!styleEl.parentNode) head.insertBefore(styleEl, head.firstChild);
    }
    styleEl.textContent = buildThemeCss(state.custom);
  }

  function notify() {
    var snapshot = getTheme();
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot); } catch (e) { console.warn('DBVThemes listener:', e); }
    });
  }

  function applyDom() {
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function getTheme() { return state.theme; }
  function getSlots() { return state.slots.slice(); }
  function getCustom() { return Object.assign({}, state.custom); }
  function isDark(id) { var d = describe(id || state.theme, state.custom); return d ? d.isDark : true; }

  /** @spec RF-49.4 — activa un tema (se guarda) y avisa a los oyentes (Mermaid, botones, diálogo). */
  function setTheme(id) {
    if (isThemeId(id)) {
      state.theme = id;
      storageSet(STORAGE_KEY, id);
      applyDom();
      notify();
    }
    return state.theme;
  }

  /** @spec RF-50.2 — asigna un tema a uno de los 3 botones rápidos. */
  function setSlot(index, id) {
    if (index >= 0 && index <= 2 && isThemeId(id)) {
      state.slots[index] = id;
      storageSet(SLOTS_KEY, JSON.stringify(state.slots));
      notify();
    }
    return getSlots();
  }

  /** @spec RF-50.3, RF-50.4 — cambia colores del Personalizado (solo `#rrggbb` de la lista blanca). */
  function setCustom(colors) {
    state.custom = sanitizeCustom(colors, state.custom);
    storageSet(CUSTOM_KEY, JSON.stringify(state.custom));
    writeStylesheet();
    notify();
    return getCustom();
  }

  /** @spec RF-50.3 — «Copiar y activar»: el Personalizado toma la paleta de un tema curado. */
  function copyToCustom(baseId) {
    var base = CURATED_BY_ID[baseId] || CURATED_BY_ID[DEFAULT_THEME];
    state.custom = sanitizeCustom(base.tokens, null);
    storageSet(CUSTOM_KEY, JSON.stringify(state.custom));
    writeStylesheet();
    return setTheme('custom');
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  /** @spec RF-49.4, RF-50.5 — arranque antes de pintar y escucha de las demás ventanas. */
  function boot() {
    loadState();
    writeStylesheet();
    applyDom();
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY || e.key === SLOTS_KEY || e.key === CUSTOM_KEY || e.key === null) {
        loadState();
        writeStylesheet();
        applyDom();
        notify();
      }
    });
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SLOTS_KEY: SLOTS_KEY,
    CUSTOM_KEY: CUSTOM_KEY,
    DEFAULT_THEME: DEFAULT_THEME,
    DEFAULT_SLOTS: DEFAULT_SLOTS.slice(),
    CUSTOM_THEME_KEYS: CUSTOM_THEME_KEYS.slice(),
    ALL_TOKEN_KEYS: ALL_TOKEN_KEYS.slice(),
    CURATED_THEMES: CURATED_THEMES,
    ALL_THEME_IDS: ALL_THEME_IDS.slice(),
    normalizeHex: normalizeHex,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    resolveThemeId: resolveThemeId,
    parseSlots: parseSlots,
    sanitizeCustom: sanitizeCustom,
    parseCustom: parseCustom,
    describe: describe,
    buildThemeCss: buildThemeCss,
    boot: boot,
    getTheme: getTheme,
    getSlots: getSlots,
    getCustom: getCustom,
    isDark: isDark,
    setTheme: setTheme,
    setSlot: setSlot,
    setCustom: setCustom,
    copyToCustom: copyToCustom,
    onChange: onChange
  };
});
