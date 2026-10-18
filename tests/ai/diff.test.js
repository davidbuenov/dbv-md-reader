// =============================================================================
// dbv-md-reader — Tests del diff de propuestas (RF-93)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-34

import { describe, expect, it } from 'vitest';
import { applyRegions, countChanges, diffRegions, rebase } from '../../src/ai/diff.js';

const base = ['= Título', '', 'Uno.', 'Dos.', 'Tres.', '', 'Final.'].join('\n');
const proposed = ['= Título nuevo', '', 'Uno.', 'Dos.', 'Tres y más.', '', 'Final.', 'Extra.'].join('\n');

describe('diffRegions', () => {
  it('separa los cambios en trozos con su línea de base', () => {
    const regions = diffRegions(base, proposed);
    const changes = regions.filter((r) => r.type === 'change');
    expect(changes.map((c) => [c.baseStart, c.removed, c.added])).toEqual([
      [0, ['= Título'], ['= Título nuevo']],
      [4, ['Tres.'], ['Tres y más.']],
      [7, [], ['Extra.']],
    ]);
    expect(countChanges(regions)).toEqual({ added: 3, removed: 2 });
  });

  it('aceptar todo da la propuesta y nada da el original', () => {
    const regions = diffRegions(base, proposed);
    const all = new Set(regions.filter((r) => r.type === 'change').map((r) => r.id));
    expect(applyRegions(regions, all)).toBe(proposed);
    expect(applyRegions(regions, new Set())).toBe(base);
  });

  it('aceptar por trozo', () => {
    const regions = diffRegions(base, proposed);
    expect(applyRegions(regions, new Set([1]))).toBe(base.replace('Tres.', 'Tres y más.'));
  });

  it('un fichero nuevo es un único trozo', () => {
    const regions = diffRegions('', '= Capítulo\nTexto.');
    expect(regions.filter((r) => r.type === 'change')).toHaveLength(1);
  });
});

describe('rebase (RF-93.5)', () => {
  const regions = diffRegions(base, proposed);
  const all = new Set([0, 1, 2]);

  it('si el texto no cambió, aplica tal cual', () => {
    expect(rebase(base, base, regions, all)).toEqual({ text: proposed, applied: [0, 1, 2], conflicts: [] });
  });

  it('recoloca los cambios si el usuario añadió líneas en otro sitio', () => {
    const current = base.replace('Uno.', 'Cero.\nUno.');
    const result = rebase(base, current, regions, all);
    expect(result.conflicts).toEqual([]);
    expect(result.text).toBe(proposed.replace('Uno.', 'Cero.\nUno.'));
  });

  it('un trozo cuyas líneas cambió el usuario es conflicto y no se aplica', () => {
    const current = base.replace('Tres.', 'Tres (editado).');
    const result = rebase(base, current, regions, all);
    expect(result.conflicts).toEqual([1]);
    expect(result.text).toContain('Tres (editado).');
    expect(result.text).toContain('= Título nuevo');
    expect(result.text).toContain('Extra.');
  });
});
