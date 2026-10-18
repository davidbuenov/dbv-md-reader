// =============================================================================
// dbv-md-reader — Tests de las herramientas del asistente (RF-35)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un modelo simulado con guion llama a las herramientas y se comprueba lo que
// recibe de vuelta: el bucle, el máximo de pasos, el reintento tras una
// propuesta con errores nuevos y el rechazo de rutas fuera de la carpeta.
//
// @spec RF-35

import { describe, expect, it, vi } from 'vitest';
import { runAgent } from '../../src/ai/agentLoop.js';
import { createProposal } from '../../src/ai/proposal.js';
import { createTools, describeCheck, MAX_FIX_ATTEMPTS, newProblems } from '../../src/ai/tools.js';

const docs = { 'a.md': '# A\n\nUno dos tres.\n', 'sub/b.md': '# B\n\nOtro.\n' };

function setup({ check = async () => ({ fresh: [], fixed: 0, warnings: [] }) } = {}) {
  const proposal = createProposal();
  const checkProposal = vi.fn(check);
  const tools = createTools({
    listFiles: async () => Object.keys(docs),
    readText: async (path) => docs[path] ?? null,
    search: async (query) => (query === 'dos' ? [{ relative: 'a.md', line: 3, text: 'Uno dos tres.' }] : []),
    outline: () => [{ level: 1, text: 'A' }, { level: 2, text: 'Detalle' }],
    checkProposal,
    getProposal: () => proposal,
  });
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  return { tools, byName, proposal, checkProposal };
}

describe('herramientas (solo la carpeta del documento, sin red ni programas)', () => {
  it('ofrece exactamente las cinco de md-reader', () => {
    expect(setup().tools.map((t) => t.name).sort()).toEqual(['get_outline', 'list_files', 'propose_changes', 'read_file', 'search_files']);
  });

  it('list_files, read_file con tramo de líneas, search_files y get_outline', async () => {
    const { byName } = setup();
    expect(await byName.list_files.run({})).toBe('a.md\nsub/b.md');
    expect(await byName.read_file.run({ path: 'a.md' })).toBe(docs['a.md']);
    expect(await byName.read_file.run({ path: 'a.md', start_line: 3, end_line: 3 })).toBe('Uno dos tres.');
    expect(await byName.read_file.run({ path: 'nada.md' })).toMatch(/does not exist/);
    expect(await byName.search_files.run({ query: 'dos' })).toBe('a.md:3: Uno dos tres.');
    expect(await byName.search_files.run({ query: 'zzz' })).toBe('no matches');
    expect(await byName.get_outline.run({})).toBe('- A\n  - Detalle');
  });

  it('read_file rechaza una ruta fuera de la carpeta (RNF-IA.3)', async () => {
    const { byName } = setup();
    for (const path of ['../secreto.md', 'a/../../secreto.md', 'a\\..\\secreto.md', 'C:/x.md']) {
      await expect(byName.read_file.run({ path })).rejects.toThrow(/outside/);
    }
  });

  it('un documento largo se trunca y avisa', async () => {
    const big = { 'g.md': 'x'.repeat(30000) };
    const tools = createTools({ listFiles: async () => [], readText: async (p) => big[p] ?? null, search: async () => [], outline: () => [], checkProposal: async () => null, getProposal: () => createProposal() });
    const text = await tools.find((t) => t.name === 'read_file').run({ path: 'g.md' });
    expect(text).toMatch(/truncated: 30000 characters/);
    expect(text.length).toBeLessThan(25000);
  });
});

describe('propose_changes', () => {
  const edit = { summary: 'Corrige', changes: [{ path: 'a.md', action: 'edit', search: 'Uno', replace: '1' }] };

  it('acumula la propuesta, la comprueba y le dice al modelo que no hay errores nuevos', async () => {
    const { byName, proposal, checkProposal } = setup();
    const report = await byName.propose_changes.run(edit);
    expect(report).toMatch(/ok: edit a\.md/);
    expect(report).toMatch(/no new errors/);
    expect(proposal.summary).toBe('Corrige');
    expect(proposal.files.size).toBe(1);
    expect(checkProposal).toHaveBeenCalledTimes(1);
  });

  it('con errores nuevos, se los devuelve para que los corrija, y a la tercera para de insistir (máx. reintentos)', async () => {
    const fresh = [{ level: 'error', file: 'a.md', line: 3, message: 'el bloque de código no se cierra' }];
    const { byName } = setup({ check: async () => ({ fresh, fixed: 0, warnings: [] }) });
    const first = await byName.propose_changes.run(edit);
    expect(first).toMatch(/NEW error/);
    expect(first).toMatch(/a\.md:3: el bloque de código no se cierra/);
    expect(first).toMatch(/Fix them with another propose_changes/);
    for (let i = 1; i < MAX_FIX_ATTEMPTS; i += 1) await byName.propose_changes.run(edit);
    const last = await byName.propose_changes.run(edit);
    expect(last).toMatch(/Do not try again/);
  });

  it('informa de lo que corrige y de los avisos no bloqueantes', async () => {
    const warnings = [{ level: 'warning', file: 'a.md', line: 1, message: 'el enlace «x.md» no existe' }];
    const { byName } = setup({ check: async () => ({ fresh: [], fixed: 2, warnings }) });
    const report = await byName.propose_changes.run(edit);
    expect(report).toMatch(/fixes 2 existing/);
    expect(report).toMatch(/New warnings \(not blocking\)/);
    expect(report).toMatch(/a\.md:1: el enlace/);
  });

  it('una lista vacía, un solo objeto en vez de lista y rutas malas', async () => {
    const { byName, proposal } = setup();
    expect(await byName.propose_changes.run({ changes: [] })).toMatch(/NOTHING was proposed/);
    expect(await byName.propose_changes.run({ changes: edit.changes[0] })).toMatch(/ok: edit a\.md/);
    const bad = await byName.propose_changes.run({ changes: [{ path: '../x.md', action: 'create', content: 'x' }, { path: 'c.rs', action: 'create', content: 'x' }] });
    expect(bad).toMatch(/error: \.\.\/x\.md/);
    expect(bad).toMatch(/error: c\.rs/);
    expect(proposal.files.has('../x.md')).toBe(false);
  });

  it('una edición que no cambia nada dice que NO se propuso nada', async () => {
    const { byName } = setup();
    expect(await byName.propose_changes.run({ changes: [{ path: 'a.md', action: 'edit', search: 'Uno', replace: 'Uno' }] })).toMatch(/NOTHING was proposed/);
  });

  it('si no se puede comprobar, la propuesta sigue y se dice', async () => {
    const { byName } = setup({ check: async () => null });
    expect(await byName.propose_changes.run(edit)).toMatch(/could not be checked/);
  });
});

describe('describeCheck y newProblems', () => {
  const e = (message, file = 'a.md') => ({ level: 'error', file, message });

  it('solo cuenta como nuevo lo que no estaba antes (mismo fichero y mensaje)', () => {
    expect(newProblems([e('x')], [e('x'), e('y')])).toEqual([e('y')]);
    expect(newProblems([e('x'), e('x')], [e('x')])).toEqual([]);
    expect(newProblems([e('x', 'a.md')], [e('x', 'b.md')])).toEqual([e('x', 'b.md')]);
  });

  it('calcula errores nuevos, corregidos y avisos nuevos', () => {
    const w = { level: 'warning', file: 'a.md', message: 'w' };
    const result = describeCheck([e('viejo'), e('otro')], [e('otro'), e('nuevo'), w]);
    expect(result.fresh).toEqual([e('nuevo')]);
    expect(result.fixed).toBe(1);
    expect(result.warnings).toEqual([w]);
    expect(result.errors).toBe(2);
  });
});

describe('integración con el bucle del agente', () => {
  it('un modelo con guion lee un documento, propone un cambio y termina', async () => {
    const { tools, proposal } = setup();
    const responses = [
      { text: '', toolCalls: [{ id: '1', name: 'read_file', arguments: '{"path":"a.md"}' }] },
      { text: '', toolCalls: [{ id: '2', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'a.md', action: 'edit', search: 'tres', replace: '3' }] }) }] },
      { text: 'Listo.', toolCalls: [] },
    ];
    const seen = [];
    const result = await runAgent({
      tools,
      messages: [{ role: 'user', content: 'cambia tres por 3' }],
      callModel: async (request) => {
        seen.push(request.tools.map((t) => t.name));
        return responses.shift();
      },
    });
    expect(result.outcome).not.toBe('maxSteps');
    expect(result.messages.at(-1).content).toBe('Listo.');
    expect(proposal.files.get('a.md')).toBeTruthy();
    expect(seen.every((names) => names.includes('propose_changes'))).toBe(true);
  });

  it('se para en el máximo de pasos aunque el modelo siga llamando herramientas', async () => {
    const { tools } = setup();
    const result = await runAgent({
      tools,
      maxSteps: 3,
      messages: [{ role: 'user', content: 'x' }],
      callModel: async () => ({ text: '', toolCalls: [{ id: String(Math.random()), name: 'list_files', arguments: '{}' }] }),
    });
    expect(result.outcome).toBe('maxSteps');
  });
});
