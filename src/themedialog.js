// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Contenido del diálogo «Temas y colores…» (RF-50), copia de `themeDialog.js` de
// dbv-typst-editor adaptada a IIFE: galería de los 10 temas curados más
// Personalizado, asignación de los 3 botones rápidos y editor del Personalizado
// con nota de contraste en vivo.
//
// Toda la lógica de temas está en themes.js (`window.DBVThemes`); aquí solo se
// construye DOM con createElement/textContent (nunca innerHTML) y los colores
// de las muestras salen de paletas ya validadas.
//
// @spec RF-50
// =============================================================================
(function () {
  'use strict';

  var Themes = window.DBVThemes;
  if (!Themes) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Nombre visible de un tema: «icono nombre». */
  function themeName(t, id) {
    var d = Themes.describe(id, Themes.getCustom());
    return d ? d.icon + ' ' + t(d.labelKey) : id;
  }

  /**
   * @param {{bodyEl: HTMLElement, t: function(string): string}} opts
   * @returns {{render: function(): void, focusActive: function(): void}}
   */
  function create(opts) {
    var bodyEl = opts.bodyEl;
    var t = opts.t;

    function section(titleKey) {
      var s = el('section', 'theme-dialog__section');
      s.appendChild(el('h3', 'theme-dialog__subheading', t(titleKey)));
      return s;
    }

    /** @spec RF-50.1, RF-50.6 — tarjetas como grupo de radio, flechas para moverse. */
    function renderCards() {
      var s = section('theme.curatedHeading');
      var grid = el('div', 'theme-cards');
      grid.setAttribute('role', 'radiogroup');
      grid.setAttribute('aria-label', t('theme.curatedHeading'));
      var active = Themes.getTheme();
      Themes.ALL_THEME_IDS.forEach(function (id) {
        var d = Themes.describe(id, Themes.getCustom());
        var on = id === active;
        var card = el('button', 'theme-card' + (on ? ' theme-card--active' : ''));
        card.type = 'button';
        card.dataset.themeId = id;
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', on ? 'true' : 'false');
        card.tabIndex = on ? 0 : -1;
        var swatches = el('span', 'theme-card__swatches');
        swatches.style.backgroundColor = d.tokens['--bg-primary'];
        swatches.style.borderColor = d.tokens['--border'];
        ['--text-primary', '--accent', '--code-keyword', '--code-string'].forEach(function (k) {
          var dot = el('span', 'theme-card__dot');
          dot.style.backgroundColor = d.tokens[k];
          swatches.appendChild(dot);
        });
        card.appendChild(swatches);
        card.appendChild(el('span', 'theme-card__label', themeName(t, id)));
        card.addEventListener('click', function () { Themes.setTheme(id); });
        grid.appendChild(card);
      });
      grid.addEventListener('keydown', onCardsKey);
      s.appendChild(grid);
      return s;
    }

    function onCardsKey(e) {
      var cards = Array.prototype.slice.call(bodyEl.querySelectorAll('.theme-card'));
      var i = cards.indexOf(document.activeElement);
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      var target = null;
      if (i !== -1 && step) target = cards[(i + step + cards.length) % cards.length];
      if (i !== -1 && e.key === 'Home') target = cards[0];
      if (i !== -1 && e.key === 'End') target = cards[cards.length - 1];
      if (target) {
        e.preventDefault();
        Themes.setTheme(target.dataset.themeId);
        focusActive();
      }
    }

    function themeSelect(selectedId, ids) {
      var select = el('select', 'theme-dialog__select');
      ids.forEach(function (id) {
        var o = el('option', null, themeName(t, id));
        o.value = id;
        o.selected = id === selectedId;
        select.appendChild(o);
      });
      return select;
    }

    /** @spec RF-50.2 — qué tema lleva cada botón rápido de la cabecera. */
    function renderSlots() {
      var s = section('theme.slotsHeading');
      var grid = el('div', 'theme-slots');
      Themes.getSlots().forEach(function (id, index) {
        var row = el('label', 'theme-slots__row');
        row.appendChild(el('span', null, t('theme.slotLabel').replace('{n}', String(index + 1))));
        var select = themeSelect(id, Themes.ALL_THEME_IDS);
        select.dataset.slotIndex = String(index);
        select.addEventListener('change', function () { Themes.setSlot(index, select.value); });
        row.appendChild(select);
        grid.appendChild(row);
      });
      s.appendChild(grid);
      return s;
    }

    function updateContrast(note) {
      var c = Themes.getCustom();
      var ratio = Themes.contrastRatio(c['--text-primary'], c['--bg-primary']);
      var okRatio = ratio >= 4.5;
      note.className = 'theme-custom__contrast theme-custom__contrast--' + (okRatio ? 'ok' : 'warn');
      note.textContent = t(okRatio ? 'theme.contrastOk' : 'theme.contrastLow').replace('{ratio}', ratio.toFixed(1));
    }

    /** @spec RF-50.3 — copiar paleta y editar los 18 colores con la nota de contraste en vivo. */
    function renderCustom() {
      var s = section('theme.customHeading');
      var clone = el('div', 'theme-custom__clone');
      clone.appendChild(el('span', null, t('theme.cloneFrom')));
      var base = themeSelect(Themes.getTheme() === 'custom' ? 'dark' : Themes.getTheme(),
        Themes.CURATED_THEMES.map(function (c) { return c.id; }));
      base.classList.add('theme-custom__base');
      clone.appendChild(base);
      var btn = el('button', 'theme-custom__btn', t('theme.applyClone'));
      btn.type = 'button';
      btn.dataset.action = 'clone-theme';
      btn.addEventListener('click', function () { Themes.copyToCustom(base.value); });
      clone.appendChild(btn);
      s.appendChild(clone);

      var note = el('p');
      updateContrast(note);
      s.appendChild(note);

      var grid = el('div', 'theme-custom__grid');
      var custom = Themes.getCustom();
      Themes.CUSTOM_THEME_KEYS.forEach(function (key) {
        var field = el('label', 'theme-custom__field');
        field.appendChild(el('span', null, t('theme.var.' + key.slice(2))));
        var input = el('input', 'theme-custom__color');
        input.type = 'color';
        input.dataset.token = key;
        input.value = custom[key];
        input.addEventListener('input', function () {
          var patch = {};
          patch[key] = input.value;
          editing = true;
          Themes.setCustom(patch);
          if (Themes.getTheme() !== 'custom') Themes.setTheme('custom');
          editing = false;
          updateContrast(note);
        });
        field.appendChild(input);
        grid.appendChild(field);
      });
      s.appendChild(grid);
      return s;
    }

    // Mientras se arrastra un selector de color no se reconstruye el diálogo: perdería el foco del control.
    var editing = false;

    function render() {
      if (editing) return;
      var scroll = bodyEl.scrollTop;
      bodyEl.replaceChildren(renderCards(), renderSlots(), renderCustom());
      bodyEl.scrollTop = scroll;
    }

    function focusActive() {
      var card = bodyEl.querySelector('.theme-card[aria-checked="true"]');
      if (card) card.focus();
    }

    return { render: render, focusActive: focusActive };
  }

  window.DBVThemeDialog = { create: create };
})();
