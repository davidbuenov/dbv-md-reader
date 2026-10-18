// =============================================================================
// dbv-md-reader — Propuesta de cambios de la IA (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una propuesta reúne, en memoria, todo lo que la IA quiere cambiar en una
// respuesta: modificar y crear documentos de la carpeta del documento (RF-34.1).
// Renombrar y eliminar quedan fuera: el árbol de la app es de solo lectura
// (RF-25). Nada toca el disco hasta que el usuario acepta. Cada fichero guarda el
// texto BASE sobre el que se calculó (para recolocar los cambios si el usuario
// edita entre medias, RF-34.5) y el PROPUESTO; la revisión trabaja por trozos.
//
// La IA describe los cambios con `propose_changes` (RF-35) o, si el modelo no
// usa herramientas, con bloques `dbv-edit`/`dbv-file` en su texto (RF-35.2).
// Las dos vías acaban en `applyChange`.
//
// @spec RF-34

import { isDocumentPath, isSafeRelativePath } from './paths.js';
import { applyRegions, countChanges, diffRegions } from './diff.js';

let nextProposalId = 1;

/** @typedef {'modify'|'create'} ChangeKind */

/**
 * @typedef {object} ProposedFile
 * @property {string} path Ruta relativa a la raíz, con `/`.
 * @property {ChangeKind} kind
 * @property {string} base Texto sobre el que se calculó ('' si es nuevo).
 * @property {string} proposed Texto propuesto.
 * @property {Array} regions Zonas del diff base → propuesto.
 * @property {Set<number>} accepted Trozos aceptados.
 */

export function createProposal() {
  return { id: nextProposalId++, files: new Map(), summary: '', status: 'pending' };
}

function refresh(file) {
  file.regions = diffRegions(file.base, file.proposed);
  file.accepted = new Set(file.regions.filter((r) => r.type === 'change').map((r) => r.id));
}

/** Normaliza una ruta que dio la IA: relativa, con `/`, sin `./` delante. */
export function normalizePath(path) {
  return String(path ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Coincidencia ÚNICA de `search` en `text` comparando línea a línea sin los
 * espacios de los extremos. Devuelve el tramo de `text` que ocupa, o `null`.
 */
export function looseMatch(text, search) {
  const lines = text.split('\n');
  const wanted = search.split('\n').map((line) => line.trim());
  while (wanted.length && wanted.at(-1) === '') wanted.pop();
  while (wanted.length && wanted[0] === '') wanted.shift();
  let result = null;
  if (wanted.length) {
    const starts = [];
    for (let i = 0; i + wanted.length <= lines.length; i += 1) {
      if (wanted.every((line, k) => lines[i + k].trim() === line)) starts.push(i);
    }
    if (starts.length === 1) {
      const offset = (line) => lines.slice(0, line).reduce((sum, l) => sum + l.length + 1, 0);
      const last = starts[0] + wanted.length - 1;
      result = { from: offset(starts[0]), to: offset(last) + lines[last].length };
    }
  }
  return result;
}

/** Cuántas veces aparece `needle` en `text`. */
function occurrences(text, needle) {
  let count = 0;
  let from = 0;
  while (needle && (from = text.indexOf(needle, from)) !== -1) {
    count += 1;
    from += needle.length;
  }
  return count;
}

/** Motivo por el que una ruta de la IA no vale, o `null` si vale. */
function pathProblem(path, original) {
  if (!isSafeRelativePath(path)) return `ruta no válida o fuera de la carpeta del documento: ${original}`;
  if (path.split('/').some((part) => part.startsWith('.'))) return `no se pueden tocar ficheros ni carpetas ocultos: ${path}`;
  if (!isDocumentPath(path)) return `solo se pueden proponer documentos de texto (.md, .markdown, .txt): ${path}`;
  return null;
}

/**
 * Aplica un cambio a la propuesta. `readBase(path)` da el contenido actual de
 * un fichero (con lo que haya sin guardar) o `null` si no existe.
 * Devuelve `{ok, message}`: el mensaje se le devuelve a la IA si falla.
 * @param {ReturnType<typeof createProposal>} proposal
 * @param {{path: string, action: 'edit'|'create'|'replace_all', search?: string, replace?: string, content?: string}} change
 * @param {(path: string) => Promise<string|null>} readBase
 */
export async function applyChange(proposal, change, readBase) {
  const path = normalizePath(change.path);
  const problem = pathProblem(path, change.path);
  if (problem) return { ok: false, message: problem };
  let file = proposal.files.get(path);
  if (!file) {
    const base = await readBase(path);
    file = { path, kind: base === null ? 'create' : 'modify', base: base ?? '', proposed: base ?? '', exists: base !== null };
  }
  const action = change.action ?? (change.search !== undefined ? 'edit' : 'replace_all');
  let result = { ok: true, message: '' };
  if (action === 'edit') {
    const search = String(change.search ?? '');
    const count = occurrences(file.proposed, search);
    // Modelos pequeños copian el texto con otra sangría: si no aparece tal
    // cual, se busca línea a línea sin espacios en los extremos, y solo vale
    // si la coincidencia es única.
    const loose = count === 0 && search ? looseMatch(file.proposed, search) : null;
    if (!file.exists && file.kind !== 'create') result = { ok: false, message: `${path} no existe` };
    else if (!search) result = { ok: false, message: 'falta el texto a buscar (search)' };
    else if (count > 1) result = { ok: false, message: `el texto a buscar aparece ${count} veces en ${path}; añade más líneas de contexto para que sea único` };
    else if (count === 1) file.proposed = file.proposed.replace(search, () => String(change.replace ?? ''));
    else if (loose) file.proposed = file.proposed.slice(0, loose.from) + String(change.replace ?? '') + file.proposed.slice(loose.to);
    else result = { ok: false, message: `no se encontró el texto a buscar en ${path}; cópialo exactamente, con sus espacios` };
  } else if (action === 'create' || action === 'replace_all') {
    file.proposed = String(change.content ?? '');
    if (!file.exists) file.kind = 'create';
  } else {
    result = { ok: false, message: `acción desconocida: ${action}` };
  }
  if (result.ok) {
    if (file.kind === 'modify' && file.proposed === file.base) proposal.files.delete(path);
    else {
      refresh(file);
      proposal.files.set(path, file);
    }
  }
  return result;
}

/** El usuario retocó el texto propuesto (RF-34.2). */
export function editProposed(file, text) {
  file.proposed = text;
  refresh(file);
}

/** Texto final de un fichero con los trozos aceptados. */
export function resultText(file) {
  return applyRegions(file.regions, file.accepted);
}

/** ¿Hay algo aceptado en este fichero? */
export function isFileAccepted(file) {
  return file.accepted.size > 0;
}

export function setAll(file, accepted) {
  file.accepted = accepted ? new Set(file.regions.filter((r) => r.type === 'change').map((r) => r.id)) : new Set();
}

/** Resumen para la lista de ficheros: `+añadidas −quitadas`. */
export function fileStats(file) {
  return countChanges(file.regions, file.accepted);
}

/** Ficheros con sus sustituciones en memoria (para comprobar la propuesta antes de enseñarla). */
export function overrides(proposal) {
  return [...proposal.files.values()].map((file) => ({ path: file.path, content: resultText(file) }));
}

/** ¿Parece un bloque de edición (marcas `<<<`/`>>>` de conflicto o diff) aunque no esté en el formato de DBV? */
export function looksLikeEdit(text) {
  return /^[ \t]*(?:<{3,}|>{3,})/m.test(String(text ?? ''));
}

/**
 * Bloques de cambio en el texto de un modelo sin herramientas (RF-35.2):
 *
 *     ```dbv-edit path="cap/uno.md"
 *     <<<<<<< BUSCAR
 *     texto actual
 *     =======
 *     texto nuevo
 *     >>>>>>> FIN
 *     ```
 *
 *     ```dbv-file path="cap/nuevo.md"
 *     contenido completo
 *     ```
 * @returns {Array<{path: string, action: string, search?: string, replace?: string, content?: string}>}
 */
export function parseChangeBlocks(text) {
  const changes = [];
  const pattern = /```dbv-(edit|file)\s+path="([^"]+)"[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(String(text ?? '')))) {
    const [, kind, path, body] = match;
    if (kind === 'file') changes.push({ path, action: 'replace_all', content: body.replace(/\n$/, '') + '\n' });
    else {
      const edit = body.match(/<{7}[^\n]*\n([\s\S]*?)\n?={7}[ \t]*\n([\s\S]*?)\n?>{7}/);
      if (edit) changes.push({ path, action: 'edit', search: edit[1], replace: edit[2] });
    }
  }
  return changes;
}
