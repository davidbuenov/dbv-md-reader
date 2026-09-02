// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

//! Plugin Tauri interno (no publicado) para acceso mínimo a Storage Access
//! Framework (SAF) en Android — primer código Kotlin del proyecto (ver R3 y
//! Slice 1 en `dbv-specs-ops/implementation_plan.md`). Sin equivalente de
//! escritorio: el modelo de archivos vía SAF solo existe en Android (ADR-032
//! en `dbv-specs-ops/memory.md`), así que este crate se depende únicamente
//! bajo `[target.'cfg(target_os = "android")'.dependencies]` en el `Cargo.toml`
//! de la app principal — en Windows/Linux/macOS ni siquiera se compila.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod mobile;

pub use commands::{SafDirEntry, SafDocument};
pub use mobile::Saf;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("saf")
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::exit_app,
            commands::pick_file_and_read_markdown,
            commands::pick_folder_and_read_first_markdown,
            commands::list_children,
            commands::read_document,
            commands::resolve_relative,
            commands::read_image_data_uri,
        ])
        .setup(|app, api| {
            let saf = mobile::init(app, api)?;
            app.manage(saf);
            Ok(())
        })
        .build()
}
