// =============================================================================
// dbv-md-reader — Tests de aplicar y deshacer una propuesta (RF-34.4, RF-34.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La regla que se protege: el documento ABIERTO se cambia en el editor (deshacible,
// «Modificado») y NUNCA se escribe en disco por detrás de él; los demás
// documentos se escriben tras la revisión; un documento nuevo se deshace
// borrándolo solo si sigue como lo dejó la aplicación.
//
// @spec RF-34
// @spec RNF-IA.7

import { describe, expect, it, vi } from 'vitest';
import { createProposalApplier } from '../../src/ai/applyProposal.js';
import { applyChange, createProposal } from '../../src/ai/proposal.js';

const ok = (value = null) => ({ ok: true, value });

/** Un «disco» y un «editor» simulados. */
function world({ open = 'a.md', disk = { 'a.md': 'Uno dos tres.\n', 'b.md': 'Otro.\n' } } = {}) {
  const state = { disk: { ...disk }, editor: disk[open] ?? '' };
  const backend = {
    aiWriteFile: vi.fn(async (_root, relative, content) => {
      state.disk[relative] = content;
      return ok();
    }),
    aiDeleteCreated: vi.fn(async (_root, relative, expected) => {
      if (state.disk[relative] !== expected) return ok(false);
      delete state.disk[relative];
      return ok(true);
    }),
  };
  const applier = createProposalApplier({
    getRoot: () => 'D:/curso',
    readText: async (relative) => (relative === open ? state.editor : state.disk[relative] ?? null),
    isOpenDocument: (relative) => relative === open,
    applyToEditor: (text) => {
      state.editor = text;
      return true;
    },
    editorText: () => state.editor,
    backend,
  });
  const read = async (relative) => (relative === open ? state.editor : state.disk[relative] ?? null);
  return { state, backend, applier, read };
}

describe('aplicar', () => {
  it('el documento abierto va al editor y no toca el disco (RNF-IA.7)', async () => {
    const { state, backend, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'edit', search: 'tres', replace: '3' }, read);
    const { report } = await applier.apply(p);
    expect(state.editor).toBe('Uno dos 3.\n');
    expect(backend.aiWriteFile).not.toHaveBeenCalled();
    expect(state.disk['a.md']).toBe('Uno dos tres.\n');
    expect(report.modified).toEqual(['a.md']);
    expect(report.notes).toEqual(['a.md']);
    expect(p.status).toBe('applied');
  });

  it('otro documento de la carpeta se escribe en disco', async () => {
    const { state, backend, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'b.md', action: 'edit', search: 'Otro', replace: 'Distinto' }, read);
    const { report } = await applier.apply(p);
    expect(backend.aiWriteFile).toHaveBeenCalledWith('D:/curso', 'b.md', 'Distinto.\n');
    expect(state.disk['b.md']).toBe('Distinto.\n');
    expect(report.notes).toEqual([]);
  });

  it('un documento nuevo se crea, y Deshacer lo borra solo si sigue igual', async () => {
    const { state, backend, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'nuevo.md', action: 'create', content: '# Nuevo\n' }, read);
    const { report, undo } = await applier.apply(p);
    expect(report.created).toEqual(['nuevo.md']);
    expect(state.disk['nuevo.md']).toBe('# Nuevo\n');
    expect(await undo()).toBe(true);
    expect(state.disk['nuevo.md']).toBeUndefined();
    expect(backend.aiDeleteCreated).toHaveBeenCalledWith('D:/curso', 'nuevo.md', '# Nuevo\n');
  });

  it('si el usuario tocó el documento nuevo, Deshacer no lo borra', async () => {
    const { state, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'nuevo.md', action: 'create', content: '# Nuevo\n' }, read);
    const { undo } = await applier.apply(p);
    state.disk['nuevo.md'] = '# Nuevo\n\nAñadí esto yo.\n';
    expect(await undo()).toBe(false);
    expect(state.disk['nuevo.md']).toContain('Añadí esto yo');
  });

  it('solo se aplica lo marcado, y lo desmarcado se queda como estaba', async () => {
    const { state, applier, read } = world({ disk: { 'a.md': 'Uno.\n\nDos.\n' } });
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'replace_all', content: 'UNO.\n\nDOS.\n' }, read);
    const file = p.files.get('a.md');
    const changes = file.regions.filter((r) => r.type === 'change');
    file.accepted.delete(changes[1].id);
    await applier.apply(p);
    expect(state.editor).toBe('UNO.\n\nDos.\n');
  });

  it('un fichero sin nada marcado ni se toca ni se cuenta', async () => {
    const { backend, applier, read, state } = world();
    const p = createProposal();
    await applyChange(p, { path: 'b.md', action: 'replace_all', content: 'x\n' }, read);
    p.files.get('b.md').accepted.clear();
    const { report } = await applier.apply(p);
    expect(report.modified).toEqual([]);
    expect(backend.aiWriteFile).not.toHaveBeenCalled();
    expect(state.disk['b.md']).toBe('Otro.\n');
  });
});

describe('conflictos: nunca se aplica sobre otro texto (RF-34.5)', () => {
  it('si el usuario editó la misma línea mientras la IA respondía, ese trozo no se aplica y se informa', async () => {
    const { state, applier, read } = world({ disk: { 'a.md': 'Uno.\n\nDos.\n' } });
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'replace_all', content: 'UNO.\n\nDOS.\n' }, read);
    // Mientras tanto, el usuario reescribió la primera línea en el editor.
    state.editor = 'Mi versión.\n\nDos.\n';
    const { report } = await applier.apply(p);
    expect(report.conflicts).toEqual([{ path: 'a.md', count: 1 }]);
    expect(state.editor).toContain('Mi versión.');
    expect(state.editor).toContain('DOS.');
  });

  it('si el documento ya no existe, se informa y no se inventa', async () => {
    const { state, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'b.md', action: 'edit', search: 'Otro', replace: 'X' }, read);
    delete state.disk['b.md'];
    const { report } = await applier.apply(p);
    expect(report.failed).toEqual([{ path: 'b.md', message: 'ya no existe' }]);
  });

  it('un fallo al escribir se informa y no se da por aplicado', async () => {
    const { backend, applier, read } = world();
    backend.aiWriteFile.mockResolvedValueOnce({ ok: false, error: { kind: 'outside', message: 'fuera de la carpeta' } });
    const p = createProposal();
    await applyChange(p, { path: 'b.md', action: 'edit', search: 'Otro', replace: 'X' }, read);
    const { report } = await applier.apply(p);
    expect(report.modified).toEqual([]);
    expect(report.failed).toEqual([{ path: 'b.md', message: 'fuera de la carpeta' }]);
  });
});

describe('deshacer', () => {
  it('en el editor, solo si sigue como lo dejó la propuesta; si se siguió escribiendo, no se pisa', async () => {
    const { state, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'edit', search: 'tres', replace: '3' }, read);
    const first = await applier.apply(p);
    expect(await first.undo()).toBe(true);
    expect(state.editor).toBe('Uno dos tres.\n');

    const p2 = createProposal();
    await applyChange(p2, { path: 'a.md', action: 'edit', search: 'tres', replace: '3' }, read);
    const second = await applier.apply(p2);
    state.editor += 'Sigo escribiendo.\n';
    expect(await second.undo()).toBe(false);
    expect(state.editor).toContain('Sigo escribiendo');
  });

  it('en disco restaura el texto anterior, salvo que el documento cambiara después', async () => {
    const { state, applier, read } = world();
    const p = createProposal();
    await applyChange(p, { path: 'b.md', action: 'edit', search: 'Otro', replace: 'Cambiado' }, read);
    const { undo } = await applier.apply(p);
    expect(await undo()).toBe(true);
    expect(state.disk['b.md']).toBe('Otro.\n');

    const p2 = createProposal();
    await applyChange(p2, { path: 'b.md', action: 'edit', search: 'Otro', replace: 'Cambiado' }, read);
    const second = await applier.apply(p2);
    state.disk['b.md'] = 'Editado por otro lado.\n';
    expect(await second.undo()).toBe(false);
    expect(state.disk['b.md']).toBe('Editado por otro lado.\n');
  });
});
