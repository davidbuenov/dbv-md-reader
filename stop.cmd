@echo off
rem =============================================================================
rem dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
rem Copyright (c) 2026 David Bueno Vallejo
rem Licensed under the MIT License. See LICENSE for details.
rem Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
rem =============================================================================

echo Stopping dbv-md-reader processes...
taskkill /IM dbv-md-reader.exe /F 2>nul
echo Done.
