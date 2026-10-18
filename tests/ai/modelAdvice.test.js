// =============================================================================
// dbv-md-reader — Tests de los textos de los avisos (RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-31

import { describe, expect, it, vi } from 'vitest';
import { adviceMessages, createModelInfoLookup, describeAdvice, effectiveContext } from '../../src/ai/modelAdvice.js';

const t = (key) =>
  ({
    'ai.warnSmallModel': 'Pequeño ({size})',
    'ai.warnShortContext': 'Con {have} falta: mínimo {minimum}, recomendado {recommended}',
    'ai.warnExceedsMax': 'Supera {max}',
  })[key];

describe('textos de los avisos', () => {
  it('sin nada que avisar no devuelve nada', () => {
    expect(describeAdvice({ small: null, shortfall: null, exceedsMax: null }, t)).toEqual([]);
  });

  it('rellena los números de cada aviso', () => {
    const advice = { small: '3.1B', shortfall: { have: 4096, minimum: 8192, recommended: 16384 }, exceedsMax: 8192 };
    const messages = describeAdvice(advice, t);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe('Pequeño (3.1B)');
    expect(messages[1]).toMatch(/4[.\u00a0]?096.*8[.\u00a0]?192.*16[.\u00a0]?384/);
    expect(messages[2]).toMatch(/8[.\u00a0]?192/);
  });
});

describe('valores que vienen del proveedor', () => {
  it('un tamaño con patrones de reemplazo ($&, $1) se escribe tal cual, sin interpretarse', () => {
    const messages = describeAdvice({ small: '$&$&-$1B', shortfall: null, exceedsMax: null }, t);
    expect(messages).toEqual(['Pequeño ($&$&-$1B)']);
  });
});

describe('contexto efectivo', () => {
  it('el de la conexión manda; si no, el del proveedor; si no, el prudente (8 192)', () => {
    expect(effectiveContext({ contextTokens: 16384 }, { contextTokens: 4096 })).toBe(16384);
    expect(effectiveContext({ contextTokens: null }, { contextTokens: 4096 })).toBe(4096);
    expect(effectiveContext({}, null)).toBe(8192);
    expect(effectiveContext(undefined, undefined)).toBe(8192);
  });
});

describe('avisos de una conexión (lo que comparten el formulario y el panel)', () => {
  const tt = (key) => ({ 'ai.warnSmallModel': 'Pequeño ({size})', 'ai.warnShortContext': 'Corto {have}/{minimum}', 'ai.warnExceedsMax': 'Máx {max}' })[key];

  it('un modelo pequeño con el contexto de Ollama avisa de las dos cosas', () => {
    const messages = adviceMessages({ info: { parameterSize: '3.1B' }, connection: { supportsTools: null }, providerInfo: { contextTokens: 4096 }, lang: 'es' }, tt);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe('Pequeño (3.1B)');
  });

  it('el razonamiento de la conexión sube el mínimo', () => {
    const base = { info: null, connection: { contextTokens: 8192, reasoning: false }, lang: 'es' };
    expect(adviceMessages(base, tt)).toEqual([]);
    expect(adviceMessages({ ...base, connection: { contextTokens: 8192, reasoning: true } }, tt)).toHaveLength(1);
  });

  it('sin herramientas hace falta menos contexto', () => {
    const base = { info: null, connection: { contextTokens: 6144 }, lang: 'es' };
    expect(adviceMessages(base, tt)).toHaveLength(1);
    expect(adviceMessages({ ...base, connection: { contextTokens: 6144, supportsTools: false } }, tt)).toEqual([]);
  });
});

describe('consulta de lo que sabe Ollama de un modelo', () => {
  const ollama = { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:8b' };
  const good = { ok: true, value: { parameterSize: '8.2B' } };

  it('dos consultas a la vez preguntan una sola vez', async () => {
    const ask = vi.fn(async () => good);
    const lookup = createModelInfoLookup(ask);
    const [a, b] = await Promise.all([lookup(ollama), lookup(ollama)]);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ parameterSize: '8.2B' });
    expect(b).toBe(a);
  });

  it('una respuesta buena se recuerda', async () => {
    const ask = vi.fn(async () => good);
    const lookup = createModelInfoLookup(ask);
    await lookup(ollama);
    await lookup(ollama);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('un fallo no se recuerda: la siguiente vez se vuelve a preguntar', async () => {
    const ask = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue(good);
    const lookup = createModelInfoLookup(ask);
    expect(await lookup(ollama)).toBeNull();
    expect(await lookup(ollama)).toEqual({ parameterSize: '8.2B' });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('cada modelo o dirección tiene su propia respuesta', async () => {
    const ask = vi.fn(async (connection) => ({ ok: true, value: { model: connection.model } }));
    const lookup = createModelInfoLookup(ask);
    expect(await lookup(ollama)).toEqual({ model: 'qwen3:8b' });
    expect(await lookup({ ...ollama, model: 'llama3' })).toEqual({ model: 'llama3' });
    expect(await lookup({ ...ollama, baseUrl: 'http://otro:11434/v1' })).toEqual({ model: 'qwen3:8b' });
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('un modelo que no existe (el backend responde bien pero sin datos) da null y se recuerda', async () => {
    const ask = vi.fn(async () => ({ ok: true, value: null }));
    const lookup = createModelInfoLookup(ask);
    expect(await lookup(ollama)).toBeNull();
    await lookup(ollama);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
