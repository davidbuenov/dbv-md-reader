// =============================================================================
// dbv-md-reader — Test de la versión mostrada en la landing (GitHub Pages)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// La insignia `.badge-version` del hero de docs/index.html y docs/en/index.html es un literal (la landing es HTML
// estático). Este test falla si en un release se sube la versión en tauri.conf.json y se olvida la landing.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const { version } = JSON.parse(readFileSync(resolve(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));

describe('Landing · insignia de versión', () => {
  for (const page of ['docs/index.html', 'docs/en/index.html']) {
    it(`${page} muestra v${version}`, () => {
      const html = readFileSync(resolve(root, page), 'utf8');
      const m = html.match(/<span class="badge-version">v([^<]+)<\/span>/);
      expect(m, 'falta la insignia .badge-version').not.toBeNull();
      expect(m[1]).toBe(version);
    });
  }
});
