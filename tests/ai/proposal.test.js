// =============================================================================
// dbv-md-reader — Tests de las propuestas de cambios (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-34
// @spec RNF-IA.3

import { describe, expect, it } from 'vitest';
import { isDocumentPath, isSafeRelativePath } from '../../src/ai/paths.js';
import { applyChange, createProposal, fileStats, isFileAccepted, looseMatch, looksLikeEdit, normalizePath, overrides, parseChangeBlocks, resultText, setAll } from '../../src/ai/proposal.js';

const files = { 'a.md': '# A\n\nUno dos tres.\n\nFin.\n', 'sub/b.md': '# B\n' };
const readBase = async (path) => files[path] ?? null;

describe('rutas que acepta la IA (RNF-IA.3, primera barrera: la de verdad está en Rust)', () => {
  it('rechaza absolutas, con unidad, con .. y vacías', () => {
    for (const bad of ['/etc/passwd', '//server/share/x.md', 'C:/x.md', 'C:\\x.md', '..', '../x.md', 'a/../../x.md', 'a\\..\\..\\x.md', '', '   ', 'a\0b.md']) {
      expect(isSafeRelativePath(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(isSafeRelativePath('sub/b.md')).toBe(true);
    expect(isSafeRelativePath('sub\\b.md')).toBe(true);
  });

  it('solo documentos de texto', () => {
    expect(isDocumentPath('a.MD')).toBe(true);
    expect(isDocumentPath('a.markdown')).toBe(true);
    expect(isDocumentPath('a.txt')).toBe(true);
    expect(isDocumentPath('a.rs')).toBe(false);
    expect(isDocumentPath('a')).toBe(false);
  });

  it('normaliza barras, ./ y barras iniciales', () => {
    expect(normalizePath('.\\sub\\b.md')).toBe('sub/b.md');
    expect(normalizePath('/a.md')).toBe('a.md');
  });
});

describe('applyChange', () => {
  it('edit: sustituye una coincidencia exacta y deja la propuesta con un fichero modificado', async () => {
    const p = createProposal();
    const result = await applyChange(p, { path: 'a.md', action: 'edit', search: 'Uno dos tres.', replace: 'Uno, dos y tres.' }, readBase);
    expect(result.ok).toBe(true);
    const file = p.files.get('a.md');
    expect(file.kind).toBe('modify');
    expect(resultText(file)).toBe('# A\n\nUno, dos y tres.\n\nFin.\n');
    expect(fileStats(file)).toEqual({ added: 1, removed: 1 });
  });

  it('edit: una coincidencia ambigua o inexistente falla con un mensaje que el modelo puede usar', async () => {
    const p = createProposal();
    expect((await applyChange(p, { path: 'a.md', action: 'edit', search: 'no existe', replace: 'x' }, readBase)).message).toMatch(/no se encontró/);
    expect((await applyChange(p, { path: 'a.md', action: 'edit', search: '', replace: 'x' }, readBase)).message).toMatch(/falta/);
    const twice = { 'r.md': 'x\nx\n' };
    expect((await applyChange(p, { path: 'r.md', action: 'edit', search: 'x', replace: 'y' }, async (path) => twice[path] ?? null)).message).toMatch(/2 veces/);
    expect(p.files.size).toBe(0);
  });

  it('edit: tolera una sangría distinta si la coincidencia es única (modelos pequeños)', async () => {
    const p = createProposal();
    const source = { 'l.md': '- uno\n  - dos\n- tres\n' };
    const result = await applyChange(p, { path: 'l.md', action: 'edit', search: '- dos', replace: '- DOS' }, async (path) => source[path] ?? null);
    expect(result.ok).toBe(true);
    expect(looseMatch('a\n  b\nc', 'b')).toEqual({ from: 2, to: 5 });
    expect(looseMatch('x\nx', 'x')).toBeNull();
  });

  it('create y replace_all: un documento nuevo es «create», uno existente «modify»', async () => {
    const p = createProposal();
    await applyChange(p, { path: 'nuevo.md', action: 'create', content: '# Nuevo\n' }, readBase);
    await applyChange(p, { path: 'a.md', action: 'replace_all', content: '# Otro\n' }, readBase);
    expect(p.files.get('nuevo.md').kind).toBe('create');
    expect(p.files.get('a.md').kind).toBe('modify');
    expect([...overrides(p)].map((f) => f.path).sort()).toEqual(['a.md', 'nuevo.md']);
  });

  it('una edición idéntica al texto actual no deja nada que revisar', async () => {
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'edit', search: 'Fin.', replace: 'Fin.' }, readBase);
    expect(p.files.size).toBe(0);
  });

  it('varias ediciones del mismo fichero se acumulan', async () => {
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'edit', search: 'Uno', replace: '1' }, readBase);
    await applyChange(p, { path: 'a.md', action: 'edit', search: 'Fin.', replace: 'Final.' }, readBase);
    expect(resultText(p.files.get('a.md'))).toBe('# A\n\n1 dos tres.\n\nFinal.\n');
  });

  it('rechaza rutas fuera de la carpeta, ocultas, .git y tipos que no son documentos', async () => {
    const p = createProposal();
    const cases = ['../fuera.md', 'a/../../fuera.md', 'a\\..\\fuera.md', 'C:/x.md', '.git/config.md', 'sub/.hidden/x.md', '.env.md', 'codigo.rs', 'imagen.png', 'sinextension'];
    for (const path of cases) {
      const result = await applyChange(p, { path, action: 'create', content: 'x' }, readBase);
      expect(result.ok, path).toBe(false);
    }
    expect(p.files.size).toBe(0);
  });

  it('una ruta absoluta que da el modelo se trata como relativa a la carpeta (nunca sale de ella)', async () => {
    const p = createProposal();
    expect((await applyChange(p, { path: '/sub/b.md', action: 'edit', search: 'B', replace: 'BB' }, readBase)).ok).toBe(true);
    expect([...p.files.keys()]).toEqual(['sub/b.md']);
  });

  it('renombrar y eliminar ya no existen (el árbol es de solo lectura, RF-25)', async () => {
    const p = createProposal();
    expect((await applyChange(p, { path: 'a.md', action: 'delete' }, readBase)).message).toMatch(/desconocida/);
    expect((await applyChange(p, { path: 'a.md', action: 'rename', newPath: 'z.md' }, readBase)).message).toMatch(/desconocida/);
  });

  it('aceptar por trozos: lo desmarcado no se aplica', async () => {
    const p = createProposal();
    await applyChange(p, { path: 'a.md', action: 'replace_all', content: '# A\n\nUNO dos tres.\n\nFIN.\n' }, readBase);
    const file = p.files.get('a.md');
    const changes = file.regions.filter((r) => r.type === 'change');
    expect(changes.length).toBe(2);
    file.accepted.delete(changes[1].id);
    expect(resultText(file)).toBe('# A\n\nUNO dos tres.\n\nFin.\n');
    setAll(file, false);
    expect(isFileAccepted(file)).toBe(false);
    setAll(file, true);
    expect(isFileAccepted(file)).toBe(true);
  });
});

describe('texto de un modelo sin herramientas (RF-35.2)', () => {
  it('lee bloques dbv-edit y dbv-file, y NO dbv-delete', () => {
    const text = [
      'Hecho:',
      '```dbv-edit path="a.md"',
      '<<<<<<< SEARCH',
      'Uno',
      '=======',
      '1',
      '>>>>>>> END',
      '```',
      '```dbv-file path="b.md"',
      '# B',
      '```',
      '```dbv-delete path="c.md"',
      '```',
    ].join('\n');
    expect(parseChangeBlocks(text)).toEqual([
      { path: 'a.md', action: 'edit', search: 'Uno', replace: '1' },
      { path: 'b.md', action: 'replace_all', content: '# B\n' },
    ]);
  });

  it('detecta un diff en un formato que no entiende', () => {
    expect(looksLikeEdit('<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> otro')).toBe(true);
    expect(looksLikeEdit('texto normal con > una cita')).toBe(false);
  });
});
