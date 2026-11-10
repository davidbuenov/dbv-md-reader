// =============================================================================
// dbv-md-reader — Tests de la política de apertura
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// @spec RF-14
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src/documentopen.js'), 'utf8'), sandbox);
const policy = sandbox.DBVDocumentOpen;

describe('RF-14 · abrir documentos según la plataforma', () => {
  it.each([{}, { isPrimaryOpen: true }, { scrollAnchor: '#seccion' }, { startInEditMode: true }])(
    'macOS crea otra vista sin sustituir el documento (%j)', (options) => {
      expect(policy.opensNewView('macos', true, options)).toBe(true);
    }
  );
  it('aprovecha la ventana vacía y evita abrir ventanas recursivamente al arrancar', () => {
    expect(policy.opensNewView('macos', false, { isPrimaryOpen: true })).toBe(false);
  });
  it.each([{ isHistory: true }, { isAutoRestore: true }])('mantiene historial/restauración en la vista (%j)', (options) => {
    expect(policy.opensNewView('macos', true, options)).toBe(false);
  });
  it.each(['windows', 'linux', 'android', 'other'])('conserva el comportamiento de %s', (platform) => {
    expect(policy.opensNewView(platform, true, { isPrimaryOpen: true })).toBe(false);
  });
});
