// =============================================================================
// dbv-md-reader — Tests de la decisión del guardado automático (RF-54)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-54

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'autosave.js'), 'utf8'), sandbox);
const A = sandbox.DBVAutoSave;
const base = { enabled: true, editMode: true, remote: false, hasPath: true, dirty: true, conflict: false };

describe('RF-54 · decisión', () => {
  it('guarda un documento local con cambios en Modo Edición', () => {
    expect(A.decide(base)).toBe('proceed');
  });

  it('omite si está apagado, fuera de edición, sin cambios, remoto o sin ruta', () => {
    expect(A.decide({ ...base, enabled: false })).toBe('skip');
    expect(A.decide({ ...base, editMode: false })).toBe('skip');
    expect(A.decide({ ...base, dirty: false })).toBe('skip');
    expect(A.decide({ ...base, remote: true })).toBe('skip');
    expect(A.decide({ ...base, hasPath: false })).toBe('skip');
    expect(A.decide(undefined)).toBe('skip');
  });

  it('con el fichero cambiado en disco no escribe: conflicto', () => {
    expect(A.decide({ ...base, conflict: true })).toBe('conflict');
  });

  it('apagado manda aunque haya conflicto (no avisa de nada)', () => {
    expect(A.decide({ ...base, enabled: false, conflict: true })).toBe('skip');
  });

  it('espera 2 s, como typst', () => {
    expect(A.DELAY_MS).toBe(2000);
  });
});

describe('RF-54.3 · aviso del conflicto una vez por episodio', () => {
  it('avisa la primera vez y calla hasta que el conflicto se resuelve', () => {
    const n = A.createConflictNotice();
    expect(n.shouldWarn(true)).toBe(true);
    expect(n.shouldWarn(true)).toBe(false);
    expect(n.shouldWarn(true)).toBe(false);
    expect(n.shouldWarn(false)).toBe(false);
    expect(n.shouldWarn(true)).toBe(true);
  });

  it('sin conflicto nunca avisa', () => {
    const n = A.createConflictNotice();
    expect(n.shouldWarn(false)).toBe(false);
    expect(n.shouldWarn(false)).toBe(false);
  });
});
