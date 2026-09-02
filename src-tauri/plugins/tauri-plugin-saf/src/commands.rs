// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::{Deserialize, Serialize};
use tauri::{command, Runtime, State, Window};

use crate::Saf;

/// Mismo shape que `FilePayload` en el `lib.rs` de la app principal (`path`,
/// `content`, `dir_path`, `file_name`) — no se reutiliza el tipo directamente
/// porque este crate no depende de la app principal, pero el contrato de campos
/// se mantiene idéntico a propósito para que el frontend pueda tratar el
/// resultado igual que el de `read_file` en Slices futuras. `path` es la URI
/// `content://` del documento; `dir_path`, la URI `content://` del árbol
/// concedido (persistida vía `takePersistableUriPermission`, reutilizable en
/// la Slice 2 para listar el árbol completo).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirstMarkdownDocument {
    pub path: String,
    pub content: String,
    pub dir_path: String,
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PingResponse {
    pub available: bool,
}

/// Sonda sin efectos visibles (no abre ningún selector) para que el frontend
/// detecte en el arranque si el plugin SAF está registrado — solo ocurre en
/// Android, ver el gating por plataforma en el `Cargo.toml`/`lib.rs` de la app
/// principal. En desktop este comando no existe y la promesa de `invoke()`
/// simplemente se rechaza, sin ejecutar nada en el lado Kotlin.
#[command]
pub async fn ping<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
) -> Result<PingResponse, String> {
    saf.0
        .run_mobile_plugin_async("ping", ())
        .await
        .map_err(|e| e.to_string())
}

/// Comando único de punta a punta de la Slice 1 (ver `implementation_plan.md`):
/// lanza `ACTION_OPEN_DOCUMENT_TREE`, persiste el permiso concedido con
/// `takePersistableUriPermission`, localiza el primer documento hijo con
/// extensión `.md`/`.markdown` y lo lee con `ContentResolver.openInputStream`.
/// Toda la orquestación vive en el lado Kotlin (`SafPlugin.handleFolderPicked`)
/// porque `ACTION_OPEN_DOCUMENT_TREE` requiere un `ActivityResult` — no hay
/// nada que hacer del lado Rust salvo esperar la respuesta.
///
/// Errores esperados, todos mapeados a un `Result::Err` (nunca un panic) para
/// que el frontend pueda distinguir "cancelado por el usuario" (silencioso) de
/// un fallo real, con el mismo criterio de autocuración que RF-11 cuando el
/// permiso ya no es válido (`SecurityException`, revocado en Ajustes, carpeta
/// borrada): "cancelled", "permission_denied: …", "no_markdown_found",
/// "read_failed: …".
#[command]
pub async fn pick_folder_and_read_first_markdown<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
) -> Result<FirstMarkdownDocument, String> {
    saf.0
        .run_mobile_plugin_async("pickFolderAndReadFirstMarkdown", ())
        .await
        .map_err(|e| e.to_string())
}
