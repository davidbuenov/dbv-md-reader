// =============================================================================
// dbv-md-reader — Política de apertura de documentos
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// @spec RF-14
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVDocumentOpen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // En macOS abrir otro documento debe crear una vista elegible para pestañas.
  // El historial restaura la vista actual y una ventana vacía se aprovecha.
  function opensNewView(platform, hasDocument, options) {
    var opts = options || {};
    return platform === 'macos' && hasDocument && !opts.isHistory && !opts.isAutoRestore;
  }

  return { opensNewView: opensNewView };
});
