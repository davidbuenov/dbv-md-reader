// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

const COMMANDS: &[&str] = &[
    "ping",
    "pick_folder_and_read_first_markdown",
    "list_children",
    "read_document",
    "resolve_relative",
    "read_image_data_uri",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .try_build()
        .expect("failed to build tauri-plugin-saf (Android SAF plugin)");
}
