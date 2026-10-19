// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Carpeta inicial de los diálogos nativos de archivo (RF-46): lógica PURA (sin DOM ni Tauri).
//
// Aquí solo se ORDENAN las carpetas candidatas; Rust (`pick_start_dir`, `src-tauri/src/lib.rs`)
// elige la primera que existe de verdad o, si ninguna, Documentos — nunca el directorio de trabajo
// del proceso (en AppImage es `/tmp/.mount_…`, issue #12 de johnblommers).
//
// @spec RF-46
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVDialogDirs = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Prefijo de las claves de `localStorage` donde se recuerda la última carpeta de cada tipo. */
  var STORAGE_PREFIX = 'dbv-md-last-dir-';

  /**
   * Carpeta que contiene un fichero (`C:\x\a.md` → `C:\x`, `/home/a.md` → `/home`), o `null` si la
   * ruta no tiene carpeta. Admite las dos barras: las rutas de Windows llegan con `\`.
   */
  function parentDir(filePath) {
    var result = null;
    if (typeof filePath === 'string' && filePath) {
      var idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
      if (idx >= 0) {
        var head = filePath.slice(0, idx);
        // `C:\a.md` → `C:\` (no `C:`, que significaría «la carpeta actual de la unidad C»); `/a.md` → `/`.
        result = head === '' || /^[A-Za-z]:$/.test(head) ? head + filePath.charAt(idx) : head;
      }
    }
    return result;
  }

  /**
   * Carpetas candidatas, de más a menos preferida, para un diálogo.
   *
   * `kind`: `typst` (Exportar a Typst), `newfile` (Nuevo documento), `open` (Abrir archivo) o
   * `images` (carpeta o «Guardar como» de una imagen, RF-37).
   * `ctx`: `docDir` (carpeta del documento LOCAL abierto, `null` si es remoto o no hay ninguno),
   * `recentPath` (el último archivo reciente) y `remembered` (última carpeta usada por tipo).
   */
  function candidates(kind, ctx) {
    var c = ctx || {};
    var remembered = c.remembered || {};
    var order;
    if (kind === 'typst') order = [remembered.typst, c.docDir];
    else if (kind === 'newfile') order = [c.docDir, remembered.newfile];
    else if (kind === 'open') order = [c.docDir, parentDir(c.recentPath)];
    else if (kind === 'images') order = [c.docDir, remembered.images];
    else order = [];
    return order.filter(function (dir, i) {
      return typeof dir === 'string' && dir !== '' && order.indexOf(dir) === i;
    });
  }

  return { STORAGE_PREFIX: STORAGE_PREFIX, parentDir: parentDir, candidates: candidates };
});
