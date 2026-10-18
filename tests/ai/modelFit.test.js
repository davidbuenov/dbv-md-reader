// =============================================================================
// dbv-md-reader — Tests de modelFit (RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-35

import { describe, expect, it } from 'vitest';
import { estimateTokens, systemPrompt } from '../../src/ai/context.js';
import {
  contextBudget,
  contextRequirements,
  contextShortfall,
  isSmallModel,
  modelAdvice,
  parseParameterSize,
  reasoningControl,
  RECOMMENDED_CONTEXT,
  SMALL_MODEL_BILLIONS,
  TOOL_SPEC_TOKENS,
} from '../../src/ai/modelFit.js';

describe('tamaño del modelo', () => {
  it('lee el tamaño que da Ollama en miles de millones', () => {
    expect(parseParameterSize('8.2B')).toBeCloseTo(8.2);
    expect(parseParameterSize('494M')).toBeCloseTo(0.494);
    expect(parseParameterSize('1.5T')).toBeCloseTo(1500);
    expect(parseParameterSize(' 14b ')).toBe(14);
  });

  it('lo que no se entiende da null, nunca un número inventado', () => {
    for (const bad of ['', null, undefined, 'grande', '8', 'B8', '8.2.1B', '-3B']) expect(parseParameterSize(bad)).toBeNull();
  });

  it('un modelo es pequeño por debajo de 7B, y si no se conoce el tamaño no se avisa', () => {
    expect(SMALL_MODEL_BILLIONS).toBe(7);
    expect(isSmallModel({ parameterSize: '3.1B' })).toBe(true);
    expect(isSmallModel({ parameterSize: '494M' })).toBe(true);
    expect(isSmallModel({ parameterSize: '6.9B' })).toBe(true);
    expect(isSmallModel({ parameterSize: '7B' })).toBe(false);
    expect(isSmallModel({ parameterSize: '8.2B' })).toBe(false);
    expect(isSmallModel({ parameterSize: '14.8B' })).toBe(false);
    expect(isSmallModel({ parameterSize: null })).toBe(false);
    expect(isSmallModel(null)).toBe(false);
  });
});

describe('razonamiento por proveedor (RF-101)', () => {
  it('se puede fijar en Ollama y en los compatibles genéricos, y no en el resto', () => {
    expect(reasoningControl({ provider: 'ollama', info: null })).toBe('available');
    expect(reasoningControl({ provider: 'ollama', info: { capabilities: ['completion', 'thinking'] } })).toBe('available');
    expect(reasoningControl({ provider: 'openAiCompatible', info: null })).toBe('available');
    for (const provider of ['openAi', 'anthropic', 'gemini', 'openRouter', 'lmStudio']) expect(reasoningControl({ provider, info: null })).toBe('unavailable');
  });

  it('si Ollama dice que el modelo no razona, el interruptor no aplica', () => {
    expect(reasoningControl({ provider: 'ollama', info: { capabilities: ['completion', 'tools'] } })).toBe('unsupported');
  });
});

describe('avisos de un modelo (RF-103)', () => {
  const systemTokens = 313;

  it('junta tamaño pequeño, contexto corto y contexto por encima del máximo', () => {
    const advice = modelAdvice({ info: { parameterSize: '3.1B', contextLength: 32768 }, contextTokens: 4096, systemTokens });
    expect(advice).toEqual({ small: '3.1B', shortfall: { have: 4096, minimum: 8192, recommended: 16384 }, exceedsMax: null });
    expect(modelAdvice({ info: { contextLength: 8192 }, contextTokens: 16384, systemTokens }).exceedsMax).toBe(8192);
  });

  it('un modelo grande con contexto de sobra no da ningún aviso, y sin información no se inventa nada', () => {
    expect(modelAdvice({ info: { parameterSize: '14.8B', contextLength: 40960 }, contextTokens: 16384, systemTokens })).toEqual({ small: null, shortfall: null, exceedsMax: null });
    expect(modelAdvice({ info: null, contextTokens: 32768, systemTokens })).toEqual({ small: null, shortfall: null, exceedsMax: null });
  });

  it('con el razonamiento activado el mínimo sube y puede avisar donde antes no', () => {
    const base = modelAdvice({ info: null, contextTokens: 8192, systemTokens });
    const thinking = modelAdvice({ info: null, contextTokens: 8192, reasoning: true, systemTokens });
    expect(base.shortfall).toBeNull();
    expect(thinking.shortfall).toMatchObject({ have: 8192 });
  });
});

describe('presupuesto de contexto (RF-103)', () => {
  it('es la fracción que se llena menos la reserva de respuesta y las herramientas', () => {
    // 8 192 × 0,8 = 6 553; − 1 024 de respuesta; − 600 de herramientas (con las de Universe y las de bibliografía).
    expect(contextBudget({ contextTokens: 8192 })).toBe(4929);
    expect(contextBudget({ contextTokens: 8192, tools: false })).toBe(5529);
  });

  it('las herramientas cuestan lo que dice TOOL_SPEC_TOKENS y solo si se usan', () => {
    expect(contextBudget({ contextTokens: 16384, tools: false }) - contextBudget({ contextTokens: 16384, tools: true })).toBe(TOOL_SPEC_TOKENS);
  });

  it('con los 4 096 que Ollama usaba por defecto queda un margen de ≈1 650 tokens (por eso DBV pide 8 192)', () => {
    expect(contextBudget({ contextTokens: 4096 })).toBe(1652);
  });
});

describe('contexto mínimo', () => {
  const systemTokens = estimateTokens(systemPrompt({ lang: 'es', tools: true }));

  it('con las instrucciones reales el mínimo es 8 192 y el recomendado 16 384', () => {
    expect(contextRequirements({ systemTokens })).toEqual({ minimum: 8192, recommended: RECOMMENDED_CONTEXT });
    expect(RECOMMENDED_CONTEXT).toBe(16384);
  });

  it('el razonamiento sube el mínimo, y sin herramientas hace falta menos', () => {
    const base = contextRequirements({ systemTokens }).minimum;
    expect(contextRequirements({ systemTokens, reasoning: true }).minimum).toBeGreaterThan(base);
    expect(contextRequirements({ systemTokens, tools: false }).minimum).toBeLessThan(base);
  });

  it('el mínimo es múltiplo de 1 024 y el recomendado nunca queda por debajo de él', () => {
    for (const reasoning of [false, true]) {
      const { minimum, recommended } = contextRequirements({ systemTokens: 5000, reasoning });
      expect(minimum % 1024).toBe(0);
      expect(recommended).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('avisa con los números cuando la ventana no llega (Ollama arranca con 4 096)', () => {
    const requirements = contextRequirements({ systemTokens });
    expect(contextShortfall({ contextTokens: 4096, requirements })).toEqual({ have: 4096, minimum: 8192, recommended: 16384 });
    expect(contextShortfall({ contextTokens: 8192, requirements })).toBeNull();
    expect(contextShortfall({ contextTokens: 32768, requirements })).toBeNull();
  });
});
