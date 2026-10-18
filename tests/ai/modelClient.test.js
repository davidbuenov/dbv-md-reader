// =============================================================================
// dbv-md-reader — Tests del cliente del modelo (RF-92.4, RF-100)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-33
// @spec RF-35

import { describe, expect, it, vi } from 'vitest';
import { createModelClient, reduceEvent } from '../../src/ai/modelClient.js';

/** Cliente con un backend simulado que emite `events` al recibir la petición. */
function setup(events) {
  let handler = null;
  const on = vi.fn(async (name, fn) => {
    handler = fn;
    return () => {};
  });
  const aiChat = vi.fn(async (requestId) => {
    queueMicrotask(() => events.forEach((event) => handler({ requestId, ...event })));
    return { ok: true };
  });
  return { client: createModelClient({ aiChat, aiCancel: vi.fn(), on }), aiChat };
}

describe('razonamiento (RF-100)', () => {
  const events = [
    { type: 'thinking', text: 'Pienso ' },
    { type: 'thinking', text: 'un poco.' },
    { type: 'text', text: 'Hola' },
    { type: 'usage', input: 10, output: 5, evalMs: 1200 },
    { type: 'done', stopReason: 'stop' },
  ];

  it('llega por su callback, antes del texto, y NUNCA en la respuesta que consume el bucle', async () => {
    const { client } = setup(events);
    const thinking = [];
    const text = [];
    const response = await client.call('c1', { messages: [], tools: [] }, { onThinking: (chunk) => thinking.push(chunk), onText: (chunk) => text.push(chunk) });
    expect(thinking).toEqual(['Pienso ', 'un poco.']);
    expect(text).toEqual(['Hola']);
    expect(response.text).toBe('Hola');
    expect(JSON.stringify(response)).not.toContain('Pienso');
    expect(Object.keys(response).sort()).toEqual(['stopReason', 'text', 'toolCalls', 'usage']);
  });

  it('un modelo que razona sin llamar a nadie por el callback tampoco falla', async () => {
    const { client } = setup(events);
    await expect(client.call('c1', { messages: [], tools: [] })).resolves.toMatchObject({ text: 'Hola' });
  });

  it('la firma de pensamiento de una llamada a herramienta (Gemini 3) llega con la llamada y no se inventa', async () => {
    const { client } = setup([
      { type: 'toolCall', id: 'c1', name: 'read_file', arguments: '{}', thoughtSignature: 'FIRMA-OPACA' },
      { type: 'toolCall', id: 'c2', name: 'list_files', arguments: '{}' },
      { type: 'done', stopReason: 'toolCalls' },
    ]);
    const response = await client.call('c1', { messages: [], tools: [] });
    expect(response.toolCalls[0]).toEqual({ id: 'c1', name: 'read_file', arguments: '{}', thoughtSignature: 'FIRMA-OPACA' });
    expect(response.toolCalls[1]).toEqual({ id: 'c2', name: 'list_files', arguments: '{}' });
  });

  it('el uso lleva los milisegundos de generación (RF-102.1) y 0 si el servidor no los da', () => {
    const state = { text: '', toolCalls: [], usage: null };
    reduceEvent(state, { type: 'usage', input: 1, output: 2, evalMs: 900 });
    expect(state.usage).toEqual({ input: 1, output: 2, evalMs: 900 });
    reduceEvent(state, { type: 'usage', input: 1, output: 2 });
    expect(state.usage.evalMs).toBe(0);
  });
});
