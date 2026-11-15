// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// «Buscar actualizaciones» fuera de las tiendas (RF-62, issue #26). Desde la 0.16.0 no se
// publica `latest.json` (ADR-047), así que el updater de Tauri respondía 404 y la app decía
// «revisa tu conexión». Ahora se consulta la última Release de GitHub y se compara su tag con
// la versión instalada; si hay una más nueva, se ofrece su página para descargarla (no se
// instala nada, ADR-019). Módulo puro, sin DOM ni red: la petición la hace `app.js`.
// @spec RF-62
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVReleaseCheck = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LATEST_API = 'https://api.github.com/repos/davidbuenov/dbv-md-reader/releases/latest';
  var RELEASES_PAGE = 'https://github.com/davidbuenov/dbv-md-reader/releases';

  // `v0.20.0`, `0.20.0` → [0, 20, 0]; una pre-release (`0.21.0-beta.1`) o algo que no sea
  // X.Y.Z → null. La API `releases/latest` ya excluye las pre-releases, pero se comprueba igual.
  function parseVersion(tag) {
    var match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag == null ? '' : tag).trim());
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  }

  // -1, 0 o 1; null si alguna de las dos no es una versión válida.
  function compareVersions(a, b) {
    var left = parseVersion(a);
    var right = parseVersion(b);
    var result = null;
    if (left && right) {
      result = 0;
      for (var i = 0; i < 3 && result === 0; i++) {
        if (left[i] !== right[i]) result = left[i] < right[i] ? -1 : 1;
      }
    }
    return result;
  }

  // Qué decirle al usuario a partir de la respuesta. `response` es `{ offline: true }` si la
  // petición ni siquiera llegó, o `{ status, body }` con el JSON ya parseado (o null).
  // Devuelve `{ kind: 'newer'|'upToDate'|'offline'|'githubError', version?, url }`.
  function interpretRelease(response, installedVersion) {
    var res = response || {};
    var outcome = { kind: 'githubError', url: RELEASES_PAGE };
    if (res.offline) {
      outcome = { kind: 'offline', url: RELEASES_PAGE };
    } else if (res.status === 200 && res.body && typeof res.body.tag_name === 'string') {
      var order = compareVersions(installedVersion, res.body.tag_name);
      var page = typeof res.body.html_url === 'string' && res.body.html_url.indexOf(RELEASES_PAGE + '/') === 0
        ? res.body.html_url : RELEASES_PAGE;
      if (order === -1) outcome = { kind: 'newer', version: res.body.tag_name.replace(/^v/, ''), url: page };
      else if (order === 0 || order === 1) outcome = { kind: 'upToDate', url: RELEASES_PAGE };
    }
    return outcome;
  }

  return {
    LATEST_API: LATEST_API,
    RELEASES_PAGE: RELEASES_PAGE,
    parseVersion: parseVersion,
    compareVersions: compareVersions,
    interpretRelease: interpretRelease,
  };
});
