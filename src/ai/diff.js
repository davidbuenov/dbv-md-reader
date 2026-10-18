// =============================================================================
// dbv-md-reader — Diferencias por líneas para revisar propuestas (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una propuesta se revisa por TROZOS: cada zona cambiada se acepta o se
// rechaza por separado. Aquí se calculan esas zonas (diff por líneas con LCS,
// tras recortar el principio y el final comunes, que es lo habitual en una
// edición) y se aplican solo las aceptadas.
//
// `rebase` resuelve RF-34.5: la propuesta se calculó sobre un texto BASE; si el
// usuario cambió el fichero después, cada trozo aceptado se recoloca en el
// texto ACTUAL solo si las líneas que toca siguen intactas. Lo que no casa se
// devuelve como conflicto y no se aplica en silencio.

/** Más allá de este producto de líneas, el diff se simplifica a una sola zona. */
const LCS_LIMIT = 4_000_000;

const splitLines = (text) => String(text ?? '').split('\n');

/**
 * Operaciones línea a línea entre `a` y `b`.
 * @returns {Array<{type: 'equal'|'delete'|'insert', line: string}>}
 */
export function lineOps(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const head = a.slice(0, start).map((line) => ({ type: 'equal', line }));
  const tail = a.slice(endA).map((line) => ({ type: 'equal', line }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  let middle;
  if (midA.length * midB.length > LCS_LIMIT) {
    middle = [...midA.map((line) => ({ type: 'delete', line })), ...midB.map((line) => ({ type: 'insert', line }))];
  } else {
    // LCS clásica sobre la zona central.
    const rows = midA.length + 1;
    const cols = midB.length + 1;
    const table = new Uint32Array(rows * cols);
    for (let i = midA.length - 1; i >= 0; i -= 1) {
      for (let j = midB.length - 1; j >= 0; j -= 1) {
        table[i * cols + j] = midA[i] === midB[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }
    middle = [];
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        middle.push({ type: 'equal', line: midA[i] });
        i += 1;
        j += 1;
      } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
        middle.push({ type: 'delete', line: midA[i] });
        i += 1;
      } else {
        middle.push({ type: 'insert', line: midB[j] });
        j += 1;
      }
    }
    while (i < midA.length) middle.push({ type: 'delete', line: midA[i++] });
    while (j < midB.length) middle.push({ type: 'insert', line: midB[j++] });
  }
  return [...head, ...middle, ...tail];
}

/**
 * Zonas: tramos iguales y cambios (con lo que se quita y lo que se pone, y en
 * qué línea del texto base empiezan). Cada cambio tiene un `id` estable.
 * @returns {Array<{type: 'equal', lines: string[], baseStart: number} | {type: 'change', id: number, removed: string[], added: string[], baseStart: number}>}
 */
export function diffRegions(baseText, newText) {
  const ops = lineOps(splitLines(baseText), splitLines(newText));
  const regions = [];
  let baseLine = 0;
  let nextId = 0;
  for (const op of ops) {
    const last = regions.at(-1);
    if (op.type === 'equal') {
      if (last?.type === 'equal') last.lines.push(op.line);
      else regions.push({ type: 'equal', lines: [op.line], baseStart: baseLine });
      baseLine += 1;
    } else {
      let change = last;
      if (last?.type !== 'change') {
        change = { type: 'change', id: nextId++, removed: [], added: [], baseStart: baseLine };
        regions.push(change);
      }
      if (op.type === 'delete') {
        change.removed.push(op.line);
        baseLine += 1;
      } else change.added.push(op.line);
    }
  }
  return regions;
}

/** Texto resultante de aplicar solo los cambios cuyo `id` está en `accepted`. */
export function applyRegions(regions, accepted) {
  const lines = [];
  for (const region of regions) {
    if (region.type === 'equal') lines.push(...region.lines);
    else lines.push(...(accepted.has(region.id) ? region.added : region.removed));
  }
  return lines.join('\n');
}

/** Líneas añadidas y quitadas por los cambios aceptados. */
export function countChanges(regions, accepted = null) {
  let added = 0;
  let removed = 0;
  for (const region of regions) {
    if (region.type !== 'change' || (accepted && !accepted.has(region.id))) continue;
    added += region.added.length;
    removed += region.removed.length;
  }
  return { added, removed };
}

/**
 * Recoloca los cambios aceptados (calculados sobre `baseText`) en `currentText`.
 * Un cambio solo se aplica si las líneas del texto base que toca (y, para una
 * inserción, la línea junto a la que va) siguen en el texto actual, intactas y
 * contiguas. Los que no, son conflictos.
 * @returns {{text: string, applied: number[], conflicts: number[]}}
 */
export function rebase(baseText, currentText, regions, accepted) {
  const changes = regions.filter((region) => region.type === 'change' && accepted.has(region.id));
  if (baseText === currentText) {
    return { text: applyRegions(regions, accepted), applied: changes.map((c) => c.id), conflicts: [] };
  }
  const base = splitLines(baseText);
  const current = splitLines(currentText);
  // Línea del texto base → línea del actual, solo para las que siguen iguales.
  const map = new Array(base.length).fill(-1);
  let i = 0;
  let j = 0;
  for (const op of lineOps(base, current)) {
    if (op.type === 'equal') map[i++] = j++;
    else if (op.type === 'delete') i += 1;
    else j += 1;
  }
  const placements = [];
  const conflicts = [];
  for (const change of changes) {
    const start = change.baseStart;
    const end = start + change.removed.length;
    let placement = null;
    if (change.removed.length) {
      const mapped = Array.from({ length: change.removed.length }, (_, k) => map[start + k]);
      const contiguous = mapped.every((value, k) => value !== -1 && (k === 0 || value === mapped[k - 1] + 1));
      if (contiguous) placement = { from: mapped[0], to: mapped.at(-1) + 1 };
    } else if (start < base.length && map[start] !== -1) {
      placement = { from: map[start], to: map[start] };
    } else if (start === base.length && (start === 0 || map[start - 1] !== -1)) {
      const at = start === 0 ? 0 : map[start - 1] + 1;
      placement = { from: at, to: at };
    }
    if (placement && end <= base.length) placements.push({ ...placement, lines: change.added, id: change.id });
    else conflicts.push(change.id);
  }
  // Dos cambios que caerían en el mismo sitio del texto actual: el segundo es conflicto.
  placements.sort((a, b) => a.from - b.from || a.to - b.to);
  const kept = [];
  for (const placement of placements) {
    const previous = kept.at(-1);
    if (previous && placement.from < previous.to) conflicts.push(placement.id);
    else kept.push(placement);
  }
  const lines = [...current];
  for (const placement of [...kept].reverse()) lines.splice(placement.from, placement.to - placement.from, ...placement.lines);
  return { text: lines.join('\n'), applied: kept.map((p) => p.id), conflicts };
}
