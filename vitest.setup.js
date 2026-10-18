// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Los módulos de la IA piden sus textos a `window.DBV_I18N` (lo define `src/i18n.js`, un
// script clásico). En el navegador lo carga el HTML; aquí se carga antes de cada fichero
// de test, igual que en la app, para que `t()` y `register()` existan.

import './src/i18n.js';
