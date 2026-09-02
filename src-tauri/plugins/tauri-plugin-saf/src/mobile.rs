// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::de::DeserializeOwned;
use tauri::{
    plugin::{mobile::PluginInvokeError, PluginApi, PluginHandle},
    AppHandle, Runtime,
};

/// Debe coincidir con el `namespace`/paquete Kotlin declarado en
/// `android/build.gradle.kts` y con el `package` de `SafPlugin.kt`.
const PLUGIN_IDENTIFIER: &str = "com.davidbuenov.dbv_md_reader.saf";

/// Registra la clase Kotlin `SafPlugin` como el lado nativo de este plugin. Sin
/// implementación de escritorio: SAF no tiene equivalente fuera de Android (ver
/// ADR-032 en `dbv-specs-ops/memory.md`), así que este crate solo se compila para
/// `target_os = "android"` (gateado en el `Cargo.toml` de la app principal).
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<Saf<R>, PluginInvokeError> {
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "SafPlugin")?;
    Ok(Saf(handle))
}

/// Handle al plugin Kotlin — cada comando de `commands.rs` reenvía la llamada a
/// través de este `PluginHandle` con `run_mobile_plugin_async`.
#[derive(Debug)]
pub struct Saf<R: Runtime>(pub(crate) PluginHandle<R>);

impl<R: Runtime> Clone for Saf<R> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}
