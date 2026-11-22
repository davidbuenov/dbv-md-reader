#!/usr/bin/env bash
# =============================================================================
# dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
# Copyright (c) 2026 David Bueno Vallejo
# Licensed under the MIT License. See LICENSE for details.
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================

echo "Starting dbv-md-reader..."
npm run dev || cargo tauri dev
