// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Lógica PURA del menú nativo de macOS (RF-65): convierte lo que `headermenu.js` lee de los paneles HTML
// (Archivo, Herramientas, Preferencias) en la descripción neutra que recibe el comando `set_native_menu`.
// Sin DOM ni Tauri: se prueba con vitest. El DOM sigue siendo la única fuente de las entradas (RF-65.2).
//
// Entrada de `describe(menus)`:  [{ id, title, items: [{ key, kind, label, keys, hidden, disabled, checked, omit }] }]
//   kind: 'item' | 'check' (casilla o radio) | 'sep' | 'heading' (cabecera de grupo: sale como entrada apagada).
// Salida:                         { menus: [{ id, title, items: [{ id, kind: 'item'|'check'|'sep', label, accel, enabled, checked }] }] }
//
// UMD: en Node (tests) exporta la API; en el WebView la cuelga de `window.DBVNativeMenu`.
//
// @spec RF-65
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVNativeMenu = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MODIFIERS = { mod: 'CmdOrCtrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl' };
  var KEY_RE = /^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4]))$/;

  /**
   * `mod+Shift+S` → `CmdOrCtrl+Shift+S` (acelerador de Tauri). Una tecla desconocida o vacía da `null`: la entrada
   * sale sin atajo en vez de fallar (RF-65.9).
   * @spec RF-65
   */
  function toAccelerator(spec) {
    var out = null;
    var parts = typeof spec === 'string' && spec ? spec.split('+') : [];
    if (parts.length) {
      var key = parts[parts.length - 1].toUpperCase();
      var mods = parts.slice(0, -1).map(function (p) { return MODIFIERS[p.toLowerCase()]; });
      if (KEY_RE.test(key) && mods.every(Boolean)) out = mods.concat(key).join('+');
    }
    return out;
  }

  /** Id único dentro del menú: si se repite, `id`, `id~2`, `id~3`… */
  function uniqueId(base, seen) {
    var id = base || 'item';
    var n = 2;
    while (seen[id]) id = (base || 'item') + '~' + n++;
    seen[id] = true;
    return id;
  }

  /**
   * Quita lo oculto y lo omitido, convierte cabeceras en entradas apagadas y poda los separadores que quedan
   * al principio, al final o dos seguidos.
   * @spec RF-65
   */
  function describe(menus) {
    var seen = {};
    var result = [];
    (menus || []).forEach(function (menu) {
      var items = [];
      (menu.items || []).forEach(function (src) {
        if (src.hidden || src.omit) return;
        if (src.kind === 'sep') {
          var last = items[items.length - 1];
          if (last && last.kind !== 'sep') items.push({ id: '', kind: 'sep', label: '', accel: null, enabled: true, checked: false });
          return;
        }
        var isCheck = src.kind === 'check';
        var isHeading = src.kind === 'heading';
        items.push({
          id: uniqueId(menu.id + ':' + src.key, seen),
          kind: isCheck ? 'check' : 'item',
          label: String(src.label || '').replace(/\s+/g, ' ').trim(),
          accel: isHeading ? null : toAccelerator(src.keys),
          enabled: !isHeading && !src.disabled,
          checked: isCheck && !!src.checked
        });
      });
      while (items.length && items[items.length - 1].kind === 'sep') items.pop();
      if (items.length) result.push({ id: menu.id, title: menu.title, items: items });
    });
    return { menus: result };
  }

  /** Huella de la descripción completa: solo se envía a Rust cuando cambia (sin IPC en reposo, RNF-04). */
  function signature(desc) {
    return JSON.stringify(desc);
  }

  return { toAccelerator: toAccelerator, describe: describe, signature: signature };
});
