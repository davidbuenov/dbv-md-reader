// =============================================================================
// dbv-md-reader — Rutas relativas seguras para la IA (RNF-IA.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Primera barrera, en el frontend, para dar un mensaje útil al modelo. La
// barrera de verdad está en Rust (`src-tauri/src/ai/files.rs`, `resolve_inside`):
// aquí no se confía en nada, y allí tampoco se confía en lo que diga este fichero.
//
// @spec RNF-IA.3

/** Extensiones de los documentos con los que trabaja la IA (las mismas que abre la app). */
export const DOCUMENT_EXTENSIONS = ['md', 'markdown', 'txt'];

/** ¿Es una ruta relativa que no sale de la carpeta del documento? */
export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const startsAbsolute = /^([\\/]|[A-Za-z]:)/.test(value);
  const escapes = value.split(/[\\/]/).includes('..');
  return !startsAbsolute && !escapes && !value.includes('\0');
}

/** ¿Termina en una extensión de documento de texto? */
export function isDocumentPath(path) {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(path ?? ''));
  return Boolean(match) && DOCUMENT_EXTENSIONS.includes(match[1].toLowerCase());
}
