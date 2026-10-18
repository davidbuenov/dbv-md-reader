// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Imágenes pegadas o soltadas (RF-37): lógica PURA (sin DOM propio ni Tauri),
// para poder probarla en Node/jsdom. El cableado con la interfaz y el guardado
// (comandos de `src-tauri/src/images.rs`) viven en app.js.
//
// Mismo diseño que `dbv-typst-editor` (`clipboardImage.js` y `dropTarget.js`),
// que ya resolvió los casos raros: un pegado mixto de texto e imagen, la
// posición del soltado en píxeles físicos y la conversión a base64.
//
// @spec RF-37
// =============================================================================
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DBVImagePaste = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Tipos MIME de imagen del portapapeles que se guardan, con su extensión.
   * Sin `image/bmp`: Windows lo pone en el portapapeles con frecuencia, pesa
   * mucho y no es portable (misma lista que `IMAGE_EXTENSIONS` de Rust).
   */
  var IMAGE_MIME_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp'
  };

  var IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

  /**
   * La imagen de un evento de pegado, o `null`.
   *
   * Devuelve `null` si el portapapeles trae texto: copiar texto de una web
   * arrastra a veces una imagen de adorno, y ahí se quiere pegar el texto. Un
   * recorte de pantalla no trae `text/plain`.
   *
   * @param {DataTransfer|null} clipboardData
   * @returns {{file: File, extension: string}|null}
   */
  function pickImageFromClipboard(clipboardData) {
    var result = null;
    if (!clipboardData) return result;
    var types = Array.prototype.slice.call(clipboardData.types || []);
    if (types.indexOf('text/plain') !== -1) return result;
    var items = Array.prototype.slice.call(clipboardData.items || []);
    for (var i = 0; i < items.length && result === null; i++) {
      var extension = items[i].kind === 'file' ? IMAGE_MIME_EXTENSIONS[items[i].type] : null;
      var file = extension ? items[i].getAsFile() : null;
      if (file) result = { file: file, extension: extension };
    }
    return result;
  }

  function two(n) { return (n < 10 ? '0' : '') + n; }

  /** `captura-AAAAMMDD-HHMMSS.ext` con la hora local de `date`. */
  function captureName(date, extension) {
    var day = '' + date.getFullYear() + two(date.getMonth() + 1) + two(date.getDate());
    var time = two(date.getHours()) + two(date.getMinutes()) + two(date.getSeconds());
    return 'captura-' + day + '-' + time + '.' + extension;
  }

  /** El código que se inserta: texto alternativo vacío (decisión del usuario, RF-37.4). */
  function imageMarkdown(relative) {
    return '![](' + relative + ')';
  }

  /** Rutas de `paths` con extensión de imagen admitida (sin distinguir mayúsculas). */
  function imagePaths(paths) {
    return (paths || []).filter(function (path) {
      var dot = String(path).lastIndexOf('.');
      return dot !== -1 && IMAGE_EXTENSIONS.indexOf(String(path).slice(dot + 1).toLowerCase()) !== -1;
    });
  }

  /**
   * ¿Cayó el soltado sobre el editor? `position` llega en píxeles FÍSICOS
   * (evento nativo de Tauri) y `rect` en píxeles lógicos (`getBoundingClientRect`):
   * hay que pasar por `devicePixelRatio` o, con escalado ≠ 100 %, nunca coincide.
   */
  function isOverEditor(position, rect, devicePixelRatio) {
    if (!position || !rect) return false;
    var ratio = devicePixelRatio || 1;
    var x = position.x / ratio;
    var y = position.y / ratio;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  /** `\\?\D:\x` (ruta canónica de Windows) → `D:/x`; `\\?\UNC\srv\x` → `//srv/x`; `\` → `/`. */
  function normalizePath(path) {
    return String(path == null ? '' : path)
      .replace(/\\/g, '/')
      .replace(/^\/\/\?\/UNC\//i, '//')
      .replace(/^\/\/\?\//, '')
      .replace(/\/+$/, '');
  }

  /**
   * Ruta de `absolute` relativa a `base` (con `/`), o `null` si queda fuera de ella.
   * Sin distinguir mayúsculas en las rutas de Windows (`D:`). Sirve para saber si lo
   * guardado con «Guardar como» quedó dentro de la carpeta del documento.
   */
  function relativeInside(base, absolute) {
    var result = null;
    var from = normalizePath(base);
    var to = normalizePath(absolute);
    var caseless = /^[a-z]:/i.test(from);
    var head = to.slice(0, from.length);
    var same = caseless ? head.toLowerCase() === from.toLowerCase() : head === from;
    if (from && to.length > from.length && same && to.charAt(from.length) === '/') {
      var relative = to.slice(from.length + 1);
      if (relative.split('/').indexOf('..') === -1) result = relative;
    }
    return result;
  }

  /** Los bytes en base64 de un `data:` URL (sin la cabecera `data:image/png;base64,`). */
  function base64FromDataUrl(dataUrl) {
    var comma = String(dataUrl).indexOf(',');
    return comma === -1 ? '' : String(dataUrl).slice(comma + 1);
  }

  /**
   * Lee un `File` como base64. Pasa por `readAsDataURL` y no por
   * `btoa(String.fromCharCode(...bytes))`, que desborda la pila con un recorte
   * de pantalla de tamaño normal.
   */
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(base64FromDataUrl(reader.result)); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  return {
    IMAGE_EXTENSIONS: IMAGE_EXTENSIONS,
    pickImageFromClipboard: pickImageFromClipboard,
    captureName: captureName,
    imageMarkdown: imageMarkdown,
    imagePaths: imagePaths,
    isOverEditor: isOverEditor,
    normalizePath: normalizePath,
    relativeInside: relativeInside,
    base64FromDataUrl: base64FromDataUrl,
    readFileAsBase64: readFileAsBase64
  };
});
