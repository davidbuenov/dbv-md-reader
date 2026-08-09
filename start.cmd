@echo off
rem =============================================================================
rem dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
rem Copyright (c) 2026 David Bueno Vallejo
rem Licensed under the MIT License. See LICENSE for details.
rem Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
rem =============================================================================

echo Starting dbv-md-reader in development mode...
npm run dev || cargo tauri dev
