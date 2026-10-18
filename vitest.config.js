// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Tests del frontend de la IA (`tests/ai/*.test.js`), con `jsdom` porque parte de
// los módulos pintan DOM (el panel, la revisión, la IA en línea). Viven FUERA de
// `src/` a propósito: `frontendDist` es `../src` y Tauri embebe en el ejecutable todo
// lo que haya dentro. Los tests de
// la lógica sin DOM del lector (sincronización, exportación a Typst) son
// scripts de Node aparte: `npm run test:sync`, `npm run test:typst-export`.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    restoreMocks: true,
    reporters: ['default'],
  },
});
