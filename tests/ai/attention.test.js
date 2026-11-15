// =============================================================================
// dbv-md-reader — Tests del aviso de aprobación pendiente (RF-59)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-59

import { describe, expect, it, vi } from 'vitest';
import { createAttentionNotifier, shouldRequestAttention } from '../../src/ai/attention.js';

describe('RF-59 · cuándo avisar', () => {
  it('sin foco y con una petición nueva, sí', () => {
    expect(shouldRequestAttention({ focused: false, requestId: 'p1', lastNotifiedId: null })).toBe(true);
  });
  it('con la ventana delante, nunca', () => {
    expect(shouldRequestAttention({ focused: true, requestId: 'p1', lastNotifiedId: null })).toBe(false);
  });
  it('la misma petición solo avisa una vez', () => {
    expect(shouldRequestAttention({ focused: false, requestId: 'p1', lastNotifiedId: 'p1' })).toBe(false);
  });
  it('sin petición, no', () => {
    expect(shouldRequestAttention({ focused: false, requestId: null, lastNotifiedId: null })).toBe(false);
  });
});

describe('RF-59 · avisador de una ventana', () => {
  const win = (focused) => ({ isFocused: vi.fn(async () => focused), requestUserAttention: vi.fn(async () => {}) });

  it('pide atención informativa una vez por petición y la limpia después', async () => {
    const w = win(false);
    const n = createAttentionNotifier(w, 2);
    expect(await n.notify('p1')).toBe(true);
    expect(await n.notify('p1')).toBe(false);
    expect(w.requestUserAttention).toHaveBeenCalledTimes(1);
    expect(w.requestUserAttention).toHaveBeenLastCalledWith(2);
    await n.clear();
    expect(w.requestUserAttention).toHaveBeenLastCalledWith(null);
    expect(await n.notify('p2')).toBe(true);
  });

  it('con foco no hace nada, y limpiar sin aviso activo tampoco', async () => {
    const w = win(true);
    const n = createAttentionNotifier(w);
    expect(await n.notify('p1')).toBe(false);
    await n.clear();
    expect(w.requestUserAttention).not.toHaveBeenCalled();
  });

  it('si no se puede saber el foco, no molesta', async () => {
    const w = { isFocused: vi.fn(async () => { throw new Error('closing'); }), requestUserAttention: vi.fn(async () => {}) };
    expect(await createAttentionNotifier(w).notify('p1')).toBe(false);
    expect(w.requestUserAttention).not.toHaveBeenCalled();
  });
});
