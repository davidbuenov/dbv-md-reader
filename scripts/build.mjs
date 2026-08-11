#!/usr/bin/env node
// =============================================================================
// dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Orquesta `tauri build` + el renombrado del instalador (`rename-installer.mjs`).
//
// `tauri build` termina con código de salida distinto de cero si falta
// TAURI_SIGNING_PRIVATE_KEY (no se puede firmar el artefacto del updater),
// aunque el instalador NSIS se haya generado correctamente — por eso no se
// pueden encadenar ambos pasos con `&&`, dejaría el instalador sin renombrar
// en cualquier build local sin esa variable de entorno. Aquí se renombra
// siempre que el instalador exista. El código de salida final es el de
// `tauri build` si este falló (para no ocultar un fallo de compilación real),
// o si no, el del renombrado (para no reportar éxito si el instalador
// esperado no apareció).
// =============================================================================

import { spawnSync } from 'node:child_process';

const build = spawnSync('npx', ['tauri', 'build'], { stdio: 'inherit', shell: true });
const rename = spawnSync('node', ['scripts/rename-installer.mjs'], { stdio: 'inherit', shell: true });

const buildFailed = build.status !== 0;
process.exit(buildFailed ? (build.status ?? 1) : (rename.status ?? 1));
