// =============================================================================
// dbv-md-reader — Tests de la velocidad de respuesta (RF-102)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-33

import { describe, expect, it } from 'vitest';
import { computeSpeed, formatSpeed, shouldHintSlow } from '../../src/ai/speed.js';

describe('velocidad', () => {
  it('usa la duración que informa el servidor, que es exacta', () => {
    const speed = computeSpeed({ outputTokens: 160, evalMs: 4200, wallMs: 9000 });
    expect(speed.tokensPerSecond).toBeCloseTo(38.1, 1);
    expect(speed).toMatchObject({ seconds: 4.2, approximate: false });
  });

  it('sin ese dato mide del primer al último trozo y lo marca como aproximado', () => {
    expect(computeSpeed({ outputTokens: 50, wallMs: 10000 })).toEqual({ tokensPerSecond: 5, seconds: 10, approximate: true });
  });

  it('sin tokens o sin tiempo no hay medida', () => {
    expect(computeSpeed({ outputTokens: 0, evalMs: 1000 })).toBeNull();
    expect(computeSpeed({ outputTokens: 10 })).toBeNull();
    expect(computeSpeed({ outputTokens: 10, evalMs: 0, wallMs: 0 })).toBeNull();
  });

  it('solo sugiere mirar la GPU con un modelo local, lento, con medida fiable y una vez', () => {
    const slow = computeSpeed({ outputTokens: 100, evalMs: 50000 });
    const base = { speed: slow, outputTokens: 100, local: true, alreadyHinted: false };
    expect(shouldHintSlow(base)).toBe(true);
    expect(shouldHintSlow({ ...base, local: false })).toBe(false);
    expect(shouldHintSlow({ ...base, alreadyHinted: true })).toBe(false);
    expect(shouldHintSlow({ ...base, outputTokens: 5 })).toBe(false);
    // El límite está incluido: con exactamente 20 tokens ya vale la medida.
    expect(shouldHintSlow({ ...base, outputTokens: 20 })).toBe(true);
    expect(shouldHintSlow({ ...base, outputTokens: 19 })).toBe(false);
    expect(shouldHintSlow({ ...base, speed: computeSpeed({ outputTokens: 100, evalMs: 2000 }) })).toBe(false);
    expect(shouldHintSlow({ ...base, speed: null })).toBe(false);
  });

  it('da los números legibles', () => {
    expect(formatSpeed({ tokensPerSecond: 38.14, seconds: 4.2, approximate: false })).toEqual({ rate: '38', seconds: '4.2' });
    expect(formatSpeed({ tokensPerSecond: 3.456, seconds: 41.6, approximate: true })).toEqual({ rate: '~3.5', seconds: '42' });
  });
});
