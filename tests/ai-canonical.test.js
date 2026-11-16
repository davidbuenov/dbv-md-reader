// =============================================================================
// dbv-md-reader — Test del subsistema de IA canónico (RF-57)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// RF-57.2: los ficheros de IA de esta app son los de `dbv-tauri-starter`, sin divergencias. Lo comprueba el propio
// `sync-ai.mjs --check` del starter. Si el starter no está junto a este repositorio (CI, otra máquina), el test se
// salta: detecta la deriva donde se puede sin acoplar los repositorios (mismo criterio que D3 con typst).
//
// @spec RF-57

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const starter = resolve(process.cwd(), '..', 'dbv-tauri-starter');
const script = resolve(starter, 'scripts', 'sync-ai.mjs');
const available = existsSync(script);

describe('RF-57 · IA canónica de dbv-tauri-starter', () => {
  it.skipIf(!available)('sync-ai.mjs --check no encuentra ningún fichero divergente ni ausente', () => {
    const r = spawnSync(process.execPath, [script, '--check', process.cwd()], { cwd: starter, encoding: 'utf8', timeout: 60000 });
    const out = `${r.stdout}\n${r.stderr}`;
    expect(out, out).not.toMatch(/\[(DIVERGENTE|FALTA|REVISAR)\]/);
    expect(r.status, out).toBe(0);
    expect(out).toMatch(/verificado/);
  }, 60000);
});
