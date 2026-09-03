// =============================================================================
// dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("android") {
        // Soporte obligatorio para tamaños de página de memoria de 16 kB en Android 15+ (Google Play)
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }
    tauri_build::build();
}
