// =============================================================================
// dbv-md-reader — Tests de «Buscar actualizaciones» fuera de las tiendas (RF-62)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-62

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sandbox = {};
sandbox.self = sandbox;
vm.runInNewContext(readFileSync(resolve(process.cwd(), 'src', 'releasecheck.js'), 'utf8'), sandbox);
const R = sandbox.DBVReleaseCheck;

describe('RF-62 · comparación de versiones', () => {
  it.each([
    ['0.19.0', '0.20.0', -1],
    ['0.20.0', 'v0.20.0', 0],
    ['0.20.1', '0.20.0', 1],
    ['0.9.0', '0.10.0', -1], // numérico, no alfabético
    ['1.0.0', '0.99.99', 1],
  ])('%s frente a %s → %i', (a, b, expected) => {
    expect(R.compareVersions(a, b)).toBe(expected);
  });

  it.each(['0.21.0-beta.1', 'latest', '', null, '1.2'])('«%s» no es una versión comparable', (tag) => {
    expect(R.compareVersions('0.20.0', tag)).toBeNull();
  });
});

describe('RF-62 · qué se le dice al usuario', () => {
  const release = (tag, url = `https://github.com/davidbuenov/dbv-md-reader/releases/tag/${tag}`) =>
    ({ status: 200, body: { tag_name: tag, html_url: url } });

  it('hay una versión más nueva: se ofrece su página', () => {
    const out = R.interpretRelease(release('v0.20.0'), '0.19.0');
    expect(out.kind).toBe('newer');
    expect(out.version).toBe('0.20.0');
    expect(out.url).toBe('https://github.com/davidbuenov/dbv-md-reader/releases/tag/v0.20.0');
  });

  it('misma versión o una instalada más nueva: al día', () => {
    expect(R.interpretRelease(release('v0.19.0'), '0.19.0').kind).toBe('upToDate');
    expect(R.interpretRelease(release('v0.19.0'), '0.20.0').kind).toBe('upToDate');
  });

  it('sin red se dice «sin conexión», no un error de GitHub', () => {
    expect(R.interpretRelease({ offline: true }, '0.19.0').kind).toBe('offline');
  });

  it.each([
    [{ status: 403, body: { message: 'API rate limit exceeded' } }],
    [{ status: 429, body: null }],
    [{ status: 404, body: { message: 'Not Found' } }],
    [{ status: 502, body: null }],
    [{ status: 200, body: { tag_name: 'nightly' } }],
    [{ status: 200, body: null }],
  ])('un error o una respuesta rara de GitHub nunca se presenta como «al día» (%j)', (response) => {
    const out = R.interpretRelease(response, '0.19.0');
    expect(out.kind).toBe('githubError');
    expect(out.url).toBe(R.RELEASES_PAGE);
  });

  it('una página de Release de otro sitio no se abre: se usa la de Releases del proyecto', () => {
    const out = R.interpretRelease(release('v0.20.0', 'https://evil.example/download'), '0.19.0');
    expect(out.url).toBe(R.RELEASES_PAGE);
  });
});
