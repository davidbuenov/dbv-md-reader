// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Guardado automático: lógica PURA (sin DOM ni Tauri), para probarla en Node. Decide si toca guardar,
// omitir o quedarse quieto por un conflicto con el disco (RF-21), y avisa del conflicto una sola vez por
// episodio. El temporizador, la escritura y el aviso en la barra de estado viven en app.js.
//
// @spec RF-54
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVAutoSave = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Espera tras la última pulsación, la misma que `dbv-typst-editor`. */
  var DELAY_MS = 2000;

  /**
   * `state`: `{ enabled, editMode, remote, hasPath, dirty, conflict }`.
   * Devuelve `'proceed'` (escribir), `'conflict'` (el fichero cambió en disco: no escribir ni abrir diálogos)
   * o `'skip'` (apagado, fuera de edición, documento remoto o sin ruta, o sin cambios).
   */
  function decide(state) {
    var s = state || {};
    var result = 'skip';
    if (s.enabled && s.editMode && !s.remote && s.hasPath && s.dirty) result = s.conflict ? 'conflict' : 'proceed';
    return result;
  }

  /**
   * Avisa del conflicto solo la primera vez de cada episodio: `shouldWarn(true)` da `true` una vez y `false`
   * después; en cuanto llega `shouldWarn(false)` (ya no hay conflicto), el siguiente episodio vuelve a avisar.
   */
  function createConflictNotice() {
    var warned = false;
    return {
      shouldWarn: function (conflict) {
        var first = !!conflict && !warned;
        warned = !!conflict;
        return first;
      }
    };
  }

  return { DELAY_MS: DELAY_MS, decide: decide, createConflictNotice: createConflictNotice };
});
