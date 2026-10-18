// =============================================================================
// dbv-md-reader — Tests de la sesión ACP con un agente simulado (RF-91)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-32

import { describe, expect, it, vi } from 'vitest';
import { createAcpSession, describeUpdate, insideProject, sliceLines } from '../../src/ai/acpSession.js';
import { createChangesCard, createPermissionCard, permissionDiffs } from '../../src/ai/acpView.js';

/** Transporte simulado: guarda lo que se envía y deja inyectar mensajes del agente. */
function fakeBackend() {
  let handler = null;
  const sent = [];
  const responses = [];
  const backend = {
    sent,
    responses,
    on: vi.fn(async (event, fn) => {
      handler = fn;
      return () => {};
    }),
    emit: (message) => handler(message),
    acpStop: vi.fn(async () => ({ ok: true })),
    acpStart: vi.fn(async () => ({ ok: true })),
    acpRequest: vi.fn(async (method, params) => {
      sent.push({ method, params });
      if (method === 'initialize') return { ok: true, value: { agentInfo: { name: 'falso' }, agentCapabilities: { promptCapabilities: { image: true } } } };
      if (method === 'session/new') return { ok: true, value: { sessionId: 's1' } };
      if (method === 'session/prompt') return { ok: true, value: { stopReason: 'end_turn' } };
      return { ok: false, error: { kind: 'badRequest', message: 'x' } };
    }),
    acpNotify: vi.fn(async (method, params) => sent.push({ method, params })),
    acpRespond: vi.fn(async (id, result, error) => responses.push({ id, result, error })),
    acpSnapshot: vi.fn(async () => ({ ok: true, value: 3 })),
    acpChanges: vi.fn(async () => ({ ok: true, value: [{ path: 'main.typ', before: 'a', after: 'b' }] })),
  };
  return backend;
}

function setup(overrides = {}) {
  const backend = fakeBackend();
  const updates = [];
  const staged = [];
  const session = createAcpSession({
    backend,
    getRoot: () => 'D:/libro',
    readText: async (relative) => ({ 'main.typ': 'uno\ndos\ntres' })[relative] ?? null,
    askPermission: overrides.askPermission ?? (async (params) => params.options[0].optionId),
    stageWrite: async (relative, content) => staged.push({ relative, content }),
    onUpdate: (update) => updates.push(update),
  });
  return { backend, session, updates, staged };
}

describe('funciones puras', () => {
  it('confina al proyecto (también en Windows y sin distinguir mayúsculas)', () => {
    expect(insideProject('D:/libro', 'D:\\libro\\cap\\uno.typ')).toBe('cap/uno.typ');
    expect(insideProject('D:/libro', 'd:/LIBRO/main.typ')).toBe('main.typ');
    expect(insideProject('D:/libro', 'D:/libro-otro/x.typ')).toBeNull();
    expect(insideProject('D:/libro', 'D:/libro/../fuera.typ')).toBeNull();
    expect(insideProject('/home/u/libro', '/home/u/libro/a.typ')).toBe('a.typ');
    // Regresión: la carpeta canónica de Windows trae `\\?\` y el agente manda la ruta normal.
    expect(insideProject('\\\\?\\D:\\bueno\\Descargas\\pruebamdreader', 'D:\\bueno\\Descargas\\pruebamdreader\\prueba1.md')).toBe('prueba1.md');
    expect(insideProject('\\\\?\\UNC\\srv\\share\\libro', '\\\\srv\\share\\libro\\a.md')).toBe('a.md');
    expect(insideProject('\\\\?\\D:\\libro', 'D:\\otro\\a.md')).toBeNull();
  });

  it('traduce las actualizaciones de sesión', () => {
    expect(describeUpdate({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hola' } })).toEqual({ type: 'text', text: 'Hola' });
    expect(describeUpdate({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Edit main.typ', status: 'pending' })).toMatchObject({ type: 'tool', title: 'Edit main.typ' });
    expect(describeUpdate({ sessionUpdate: 'plan', entries: [{ content: 'Paso 1', status: 'pending' }] }).entries).toHaveLength(1);
    expect(describeUpdate({ sessionUpdate: 'usage_update' }).type).toBe('ignore');
  });

  it('recorta por líneas como pide fs/read_text_file', () => {
    expect(sliceLines('a\nb\nc\nd', 2, 2)).toBe('b\nc');
    expect(sliceLines('a\nb', null, null)).toBe('a\nb');
  });
});

describe('sesión con un agente simulado (RF-91.11)', () => {
  it('inicia, abre sesión en la carpeta del proyecto y no ofrece terminal', async () => {
    const { backend, session } = setup();
    const opened = await session.ensureSession({ id: 'claude' });
    expect(opened).toMatchObject({ fresh: true, images: true });
    const init = backend.sent.find((m) => m.method === 'initialize');
    expect(init.params.clientCapabilities).toEqual({ fs: { readTextFile: true, writeTextFile: true }, terminal: false });
    expect(backend.sent.find((m) => m.method === 'session/new').params).toEqual({ cwd: 'D:/libro', mcpServers: [] });
  });

  it('no ofrece ningún servidor MCP: md-reader no tiene (decidido en /spec de la 0.18.0)', async () => {
    const { backend, session } = setup();
    backend.mcpServerSpec = async () => ({ ok: true, value: { name: 'dbv' } });
    await session.ensureSession({ id: 'claude' });
    expect(backend.sent.find((m) => m.method === 'session/new').params.mcpServers).toEqual([]);
    expect((await session.ensureSession({ id: 'claude' })).fresh).toBe(false);
  });

  it('un turno toma punto de restauración y devuelve los cambios en disco', async () => {
    const { backend, session } = setup();
    await session.ensureSession({ id: 'claude' });
    const turn = await session.prompt([{ type: 'text', text: 'hola' }]);
    expect(backend.acpSnapshot).toHaveBeenCalledWith('D:/libro');
    expect(turn.changes).toEqual([{ path: 'main.typ', before: 'a', after: 'b' }]);
  });

  it('atiende lecturas confinadas, prepara escrituras sin escribir y reenvía las actualizaciones', async () => {
    const { backend, session, updates, staged } = setup();
    await session.ensureSession({ id: 'claude' });
    await backend.emit({ kind: 'request', id: 7, method: 'fs/read_text_file', params: { sessionId: 's1', path: 'D:/libro/main.typ', line: 2, limit: 1 } });
    await backend.emit({ kind: 'request', id: 8, method: 'fs/read_text_file', params: { sessionId: 's1', path: 'C:/Windows/win.ini' } });
    await backend.emit({ kind: 'request', id: 9, method: 'fs/write_text_file', params: { sessionId: 's1', path: 'D:/libro/nuevo.typ', content: '= Nuevo' } });
    await backend.emit({ kind: 'request', id: 10, method: 'terminal/create', params: {} });
    await backend.emit({ kind: 'notification', method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Listo' } } } });
    expect(backend.responses.find((r) => r.id === 7).result).toEqual({ content: 'dos' });
    expect(backend.responses.find((r) => r.id === 8).error).toMatch(/fuera del proyecto/);
    expect(staged).toEqual([{ relative: 'nuevo.typ', content: '= Nuevo' }]);
    expect(backend.responses.find((r) => r.id === 10).error).toMatch(/no admitido/);
    expect(updates).toEqual([{ type: 'text', text: 'Listo' }]);
  });

  it('el permiso lo decide la interfaz; sin decisión, se cancela', async () => {
    const { backend, session } = setup({ askPermission: async () => null });
    await session.ensureSession({ id: 'claude' });
    await backend.emit({ kind: 'request', id: 0, method: 'session/request_permission', params: { options: [{ optionId: 'allow', kind: 'allow_once' }] } });
    expect(backend.responses[0].result).toEqual({ outcome: { outcome: 'cancelled' } });
  });

  it('cancelar envía session/cancel', async () => {
    const { backend, session } = setup();
    await session.ensureSession({ id: 'claude' });
    await session.cancel();
    expect(backend.sent.at(-1)).toEqual({ method: 'session/cancel', params: { sessionId: 's1' } });
  });
});

describe('tarjetas de permiso y de cambios', () => {
  const params = {
    toolCall: { title: 'Edit main.typ', kind: 'edit', content: [{ type: 'diff', path: 'D:/libro/main.typ', oldText: 'uno', newText: 'uno bis' }] },
    options: [
      { optionId: 'a1', kind: 'allow_once', name: 'Allow' },
      { optionId: 'a2', kind: 'allow_always', name: 'Always' },
      { optionId: 'r1', kind: 'reject_once', name: 'Reject' },
    ],
  };
  const deps = { toRelative: (abs) => insideProject('D:/libro', abs), check: async () => ({ fresh: [] }), isDirty: () => true };

  it('enseña el diff, avisa de cambios sin guardar y devuelve la opción elegida', async () => {
    expect(permissionDiffs(params)).toHaveLength(1);
    const { card, decision } = createPermissionCard(params, deps);
    expect(card.querySelector('.ai-hunk__add').textContent).toContain('uno bis');
    expect(card.querySelector('.ai-review__warn')).not.toBeNull();
    [...card.querySelectorAll('button')].find((b) => b.title === 'Always').click();
    await expect(decision).resolves.toBe('a2');
  });

  it('una edición fuera del proyecto se deniega sola', async () => {
    const outside = { ...params, toolCall: { ...params.toolCall, content: [{ type: 'diff', path: 'C:/Windows/x', oldText: '', newText: 'x' }] } };
    const { decision } = createPermissionCard(outside, deps);
    await expect(decision).resolves.toBe('r1');
  });

  it('los cambios en disco se pueden deshacer uno a uno o todos', async () => {
    const undo = vi.fn(async () => true);
    const card = createChangesCard(
      [
        { path: 'main.typ', before: 'a', after: 'b' },
        { path: 'nuevo.typ', before: null, after: 'x' },
      ],
      { undo, open: vi.fn() },
    );
    [...card.querySelectorAll('button')].at(-1).click();
    await vi.waitFor(() => expect(undo).toHaveBeenCalledTimes(2));
  });
});
