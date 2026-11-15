// =============================================================================
// dbv-md-reader — Tests de los niveles de autonomía de la IA (RF-58)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-58

import { describe, expect, it, vi } from 'vitest';
import {
  AUTONOMY_LEVELS, DEFAULT_AUTONOMY, acpPermissionPolicy, acpReadPolicy, guardTools, normalizeAutonomy, offeredTools, toolPolicy,
} from '../../src/ai/autonomy.js';

const TOOLS = ['list_files', 'read_file', 'search_files', 'get_outline', 'propose_changes'];

describe('RF-58 · niveles', () => {
  it('son tres y el de siempre es el valor por defecto; no existen «Automático» ni «Total»', () => {
    expect([...AUTONOMY_LEVELS]).toEqual(['askAll', 'readOnly', 'askOnWrite']);
    expect(DEFAULT_AUTONOMY).toBe('askOnWrite');
    for (const value of ['auto', 'full', '', null, undefined, 42]) expect(normalizeAutonomy(value)).toBe('askOnWrite');
  });
});

describe('RF-58 · tabla nivel × herramienta', () => {
  const table = (level) => Object.fromEntries(TOOLS.map((name) => [name, toolPolicy(level, name)]));

  it('«Preguntar al modificar» se comporta como hasta ahora: todo se ofrece (las propuestas ya se revisan)', () => {
    expect(table('askOnWrite')).toEqual({ list_files: 'offer', read_file: 'offer', search_files: 'offer', get_outline: 'offer', propose_changes: 'offer' });
  });

  it('«Solo lectura» niega proponer cambios y deja leer', () => {
    expect(table('readOnly')).toEqual({ list_files: 'offer', read_file: 'offer', search_files: 'offer', get_outline: 'offer', propose_changes: 'deny' });
  });

  it('«Preguntar todo» pregunta antes de mirar la carpeta, salvo el documento abierto', () => {
    expect(table('askAll')).toEqual({ list_files: 'ask', read_file: 'ask', search_files: 'ask', get_outline: 'offer', propose_changes: 'offer' });
    expect(toolPolicy('askAll', 'read_file', { path: 'notas.md', openDocument: 'notas.md' })).toBe('offer');
    expect(toolPolicy('askAll', 'read_file', { path: 'otro.md', openDocument: 'notas.md' })).toBe('ask');
  });

  it('lo denegado ni siquiera se anuncia al modelo', () => {
    const tools = TOOLS.map((name) => ({ name }));
    expect(offeredTools('readOnly', tools).map((t) => t.name)).not.toContain('propose_changes');
    expect(offeredTools('askOnWrite', tools)).toHaveLength(5);
  });
});

describe('RF-58 · aplicado al ejecutar, aunque el modelo pida lo que no se le ofreció', () => {
  const make = (level, ask = vi.fn(async () => true)) => {
    const runs = Object.fromEntries(TOOLS.map((name) => [name, vi.fn(async () => `ran ${name}`)]));
    const guarded = guardTools(level, TOOLS.map((name) => ({ name, run: runs[name] })), { ask, openDocument: () => 'notas.md' });
    return { runs, ask, tool: (name) => guarded.find((t) => t.name === name) };
  };

  it('en «Solo lectura» propose_changes devuelve un error y NO se ejecuta', async () => {
    const { runs, tool } = make('readOnly');
    const out = await tool('propose_changes').run({ changes: [{ path: 'notas.md', action: 'replace_all', content: 'x' }] });
    expect(out).toMatch(/^error: .*not available/);
    expect(runs.propose_changes).not.toHaveBeenCalled();
  });

  it('en «Preguntar todo» leer otro fichero pregunta; si el usuario dice que no, no se lee', async () => {
    const { runs, ask, tool } = make('askAll', vi.fn(async () => false));
    const out = await tool('read_file').run({ path: 'secreto.md' });
    expect(ask).toHaveBeenCalledWith('read_file', { path: 'secreto.md' });
    expect(out).toMatch(/^error: the user did not allow/);
    expect(runs.read_file).not.toHaveBeenCalled();
  });

  it('en «Preguntar todo» leer el documento abierto no pregunta', async () => {
    const { ask, tool } = make('askAll');
    expect(await tool('read_file').run({ path: 'notas.md' })).toBe('ran read_file');
    expect(ask).not.toHaveBeenCalled();
  });

  it('el nivel se lee en cada llamada: cambiarlo a mitad de conversación surte efecto', async () => {
    let level = 'askOnWrite';
    const run = vi.fn(async () => 'ok');
    const [tool] = guardTools(() => level, [{ name: 'propose_changes', run }], { ask: async () => true, openDocument: () => null });
    expect(await tool.run({})).toBe('ok');
    level = 'readOnly';
    expect(await tool.run({})).toMatch(/^error/);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('RF-58 · agentes ACP', () => {
  it('en «Solo lectura» se rechaza sin preguntar lo que modifica o ejecuta, y lo de tipo desconocido', () => {
    for (const kind of ['edit', 'delete', 'move', 'execute', 'other', undefined, null]) expect(acpPermissionPolicy('readOnly', kind)).toBe('deny');
    for (const kind of ['read', 'search', 'think', 'fetch']) expect(acpPermissionPolicy('readOnly', kind)).toBe('ask');
  });

  it('en los demás niveles se pregunta, como hasta ahora', () => {
    for (const level of ['askAll', 'askOnWrite']) for (const kind of ['edit', 'execute', 'read', 'other']) expect(acpPermissionPolicy(level, kind)).toBe('ask');
  });

  it('fs/read_text_file pregunta en «Preguntar todo» salvo para el documento abierto', () => {
    expect(acpReadPolicy('askAll', 'otro.md', 'notas.md')).toBe('ask');
    expect(acpReadPolicy('askAll', 'notas.md', 'notas.md')).toBe('allow');
    expect(acpReadPolicy('askOnWrite', 'otro.md', 'notas.md')).toBe('allow');
    expect(acpReadPolicy('readOnly', 'otro.md', 'notas.md')).toBe('allow');
  });
});
