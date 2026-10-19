// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Menús de la cabecera de escritorio: Archivo, Herramientas y Preferencias (RF-38), con el patrón de
// `dbv-typst-editor` (RF-30, RF-32 y el menú Preferencias).
//
// NINGUNA acción se reimplementa aquí. Los botones originales de la barra (Nuevo, Abrir, URL, Recientes,
// Imprimir, Exportar a Typst…) siguen en el DOM con su id y su manejador; en escritorio se ocultan con
// `.in-menu` y cada entrada del menú dispara el `click()` del suyo (`data-target`), de modo que ids,
// atajos y bancos de pruebas no cambian y Android (que no usa estos menús) conserva su barra intacta.
// Las entradas sin botón propio (`data-action`) llaman a lo que expone `window.DBVApp`, y las casillas de
// Preferencias (`data-pref`) a `window.DBVPrefs[nombre].get()/set()`.
//
// Se carga DESPUÉS de app.js y filetree.js (usa `window.DBVApp`, `window.DBVFileTree` y `window.DBVPrefs`).
//
// @spec RF-38
// =============================================================================
(function () {
  'use strict';

  var App = window.DBVApp;
  if (!App || App.isAndroid) return;

  document.body.classList.add('desktop-menus');

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  /** `mod+Shift+I` → `Ctrl+Mayús+I` (o `⌘⇧I` en macOS), con el texto de Mayús/Alt según el idioma. */
  function formatKeys(spec) {
    var shiftName = window.DBV_I18N && window.DBV_I18N.getLang() === 'es' ? 'Mayús' : 'Shift';
    var names = isMac
      ? { mod: '⌘', shift: '⇧', alt: '⌥' }
      : { mod: 'Ctrl', shift: shiftName, alt: 'Alt' };
    var parts = spec.split('+').map(function (p) { return names[p.toLowerCase()] || p.toUpperCase(); });
    return parts.join(isMac ? '' : '+');
  }

  /** Acciones de las entradas que no tienen un botón propio al que delegar. */
  var ACTIONS = {
    quickOpen: function () { if (window.DBVFileTree) window.DBVFileTree.toggleQuickOpen(); },
    goPreview: function () { App.goToPreview(); },
    helpSyntax: function () { App.openHelp('syntax'); },
    editorFontDec: function () { App.editorZoomStep(-1); },
    editorFontInc: function () { App.editorZoomStep(1); },
    editorFontReset: function () { App.editorZoomReset(); }
  };

  function menuItems(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll('.menu-item'));
  }

  /**
   * Estado actual de una entrada: oculta, deshabilitada o marcada. Se calcula al abrir el menú copiando el
   * del botón original: lo que depende del contexto se DESHABILITA (el menú no cambia de tamaño) y solo se
   * oculta lo que no existe en la plataforma o está apagado por ajuste (`data-when-hidden="hide"`).
   */
  function itemState(item) {
    var target = item.dataset.target ? document.getElementById(item.dataset.target) : null;
    var needs = item.dataset.needs;
    var state = { hidden: false, disabled: false, checked: null };
    if (target) {
      var targetHidden = target.classList.contains('hidden');
      state.disabled = target.disabled === true || (targetHidden && item.dataset.whenHidden !== 'hide');
      state.hidden = targetHidden && item.dataset.whenHidden === 'hide';
    }
    if (needs === 'doc' && !App.hasDocument()) state.disabled = true;
    if (needs === 'edit' && !App.isEditing()) state.disabled = true;
    if (item.dataset.pref) {
      var pref = window.DBVPrefs && window.DBVPrefs[item.dataset.pref];
      // Con `data-value` es una opción de un grupo excluyente (radio); sin él, una casilla.
      if (item.dataset.value !== undefined) state.checked = !!pref && pref.get() === item.dataset.value;
      else state.checked = pref ? !!pref.get() : false;
    }
    if (item.dataset.lang) state.checked = window.DBV_I18N.getLang() === item.dataset.lang;
    return state;
  }

  function syncPanel(panel) {
    // Cabecera con el valor vivo: «Tamaño de letra del editor · 110 %».
    var fontHeading = panel.querySelector('.menu-heading[data-dynamic="editorFont"]');
    if (fontHeading) fontHeading.textContent = window.DBV_I18N.t('menu.editorFont') + ' · ' + App.editorZoomLevel() + ' %';
    menuItems(panel).forEach(function (item) {
      var s = itemState(item);
      item.classList.toggle('hidden', s.hidden);
      item.disabled = s.disabled;
      item.setAttribute('aria-disabled', s.disabled ? 'true' : 'false');
      if (s.checked !== null) item.setAttribute('aria-checked', s.checked ? 'true' : 'false');
    });
    // Un separador sin entradas visibles a un lado queda huérfano.
    var visible = Array.prototype.slice.call(panel.children).filter(function (el) { return !el.classList.contains('hidden'); });
    visible.forEach(function (el, i) {
      if (el.classList.contains('menu-separator')) {
        var prev = visible[i - 1], next = visible[i + 1];
        el.classList.toggle('hidden', !prev || !next || prev.classList.contains('menu-separator'));
      }
    });
  }

  /** Copia el icono del botón original a la entrada (así no se duplica ningún dibujo en el HTML). */
  function fillIcon(item) {
    var slot = item.querySelector('.menu-item__icon');
    var target = item.dataset.target ? document.getElementById(item.dataset.target) : null;
    var svg = target && target.querySelector('svg');
    if (slot && svg && !slot.firstChild) slot.appendChild(svg.cloneNode(true));
  }

  function activate(item, controller) {
    if (item.disabled) return;
    var isPref = !!item.dataset.pref;
    if (item.dataset.lang) {
      controller.close();
      App.setLanguage(item.dataset.lang);
      return;
    }
    if (isPref) {
      var pref = window.DBVPrefs && window.DBVPrefs[item.dataset.pref];
      var panel = item.closest('.floating-panel--menu');
      // `set` puede ser asíncrono (guarda en Rust): se repinta cuando termina, con el valor real.
      var next = item.dataset.value !== undefined ? item.dataset.value : item.getAttribute('aria-checked') !== 'true';
      if (pref) Promise.resolve(pref.set(next)).then(function () { syncPanel(panel); });
      return;
    }
    if (item.dataset.stay) {
      if (ACTIONS[item.dataset.action]) ACTIONS[item.dataset.action]();
      syncPanel(item.closest('.floating-panel--menu'));
      return;
    }
    controller.close();
    // Diferido un turno: el clic que acaba de pulsar la entrada aún está burbujeando y un panel que se
    // abre en el mismo evento (p. ej. Archivos recientes) lo cerraría su propio «clic fuera».
    setTimeout(function () {
      var target = item.dataset.target ? document.getElementById(item.dataset.target) : null;
      if (target) {
        target.click();
      } else if (item.dataset.action && ACTIONS[item.dataset.action]) {
        ACTIONS[item.dataset.action]();
      }
    }, 0);
  }

  var controllers = [];

  function wireMenu(wrapper) {
    var button = wrapper.querySelector('.header-menu__btn');
    var panel = wrapper.querySelector('.floating-panel--menu');
    var controller = App.registerPanel(panel, {
      trigger: button,
      toggle: true,
      closeOnOutsideClick: true,
      onOpen: function () {
        controllers.forEach(function (c) { if (c.panel !== panel) c.ctl.close(); });
        syncPanel(panel);
        button.setAttribute('aria-expanded', 'true');
      },
      onClose: function () { button.setAttribute('aria-expanded', 'false'); }
    });
    controllers.push({ panel: panel, ctl: controller });

    menuItems(panel).forEach(function (item) {
      fillIcon(item);
      var keys = item.querySelector('.menu-item__keys');
      if (keys && keys.dataset.keys) keys.textContent = formatKeys(keys.dataset.keys);
      item.addEventListener('click', function () { activate(item, controller); });
    });

    function focusable() { return menuItems(panel).filter(function (i) { return !i.disabled && !i.classList.contains('hidden'); }); }

    button.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (panel.classList.contains('hidden')) controller.open();
        var list = focusable();
        if (list.length) (e.key === 'ArrowDown' ? list[0] : list[list.length - 1]).focus();
      }
    });
    panel.addEventListener('keydown', function (e) {
      var list = focusable();
      var idx = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.length) list[(idx + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (list.length) list[(idx - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); if (list.length) list[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); if (list.length) list[list.length - 1].focus(); }
      else if (e.key === 'Escape') { controller.close(); button.focus(); e.stopPropagation(); }
    });
  }

  /**
   * Lista de idiomas del selector (RF-39): una entrada por idioma registrado, con su nombre nativo y un ✓ en el activo.
   * Se construye del registro, así que añadir un idioma no toca el HTML ni este fichero.
   */
  function buildLanguageMenu() {
    var panel = document.getElementById('lang-menu');
    var label = document.getElementById('lang-current');
    if (!panel) return;
    window.DBV_I18N.languages().forEach(function (lang) {
      var item = document.createElement('button');
      item.className = 'menu-item';
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', 'false');
      item.dataset.lang = lang.code;
      item.lang = lang.code;
      item.innerHTML = '<span class="menu-item__check" aria-hidden="true">✓</span><span class="menu-item__label"></span>';
      item.querySelector('.menu-item__label').textContent = lang.name;
      panel.appendChild(item);
    });
    function showCurrent() { if (label) label.textContent = window.DBV_I18N.getLang().toUpperCase(); }
    showCurrent();
    document.addEventListener('dbv-lang-changed', showCurrent);
  }

  buildLanguageMenu();
  Array.prototype.forEach.call(document.querySelectorAll('.header-menu'), wireMenu);

  // Los atajos se pintan según el idioma (Mayús/Shift) y el idioma puede cambiar en caliente.
  document.addEventListener('dbv-lang-changed', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.menu-item__keys[data-keys]'), function (el) {
      el.textContent = formatKeys(el.dataset.keys);
    });
  });

  window.DBVHeaderMenu = { formatKeys: formatKeys, closeAll: function () { controllers.forEach(function (c) { c.ctl.close(); }); } };
})();
