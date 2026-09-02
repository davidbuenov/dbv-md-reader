// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{command, Runtime, State, Window};

use crate::Saf;

/// Mismo shape que `FilePayload` en el `lib.rs` de la app principal (`path`,
/// `content`, `dir_path`, `file_name`) — no se reutiliza el tipo directamente
/// porque este crate no depende de la app principal, pero el contrato de campos
/// se mantiene idéntico a propósito para que el frontend trate el resultado de
/// `read_document`/`pick_folder_and_read_first_markdown` exactamente igual que
/// el de `read_file` en escritorio. `path` es la URI `content://` del
/// documento; `dir_path`, la URI `content://` de la carpeta que lo contiene
/// (la raíz concedida, o su carpeta real si `readDocument` pudo resolverla vía
/// `DocumentsContract.findDocumentPath` — ver `SafPlugin.kt`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafDocument {
    pub path: String,
    pub content: String,
    pub dir_path: String,
    pub file_name: String,
}

/// Una entrada de un nivel del árbol — mismo shape que `DirEntryInfo` en el
/// `lib.rs` de la app principal (RF-25), `path` es la URI `content://` del
/// hijo (autocontenida: sirve tal cual como `uri` de entrada de `list_children`
/// o `read_document`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafDirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PingResponse {
    pub available: bool,
}

#[derive(Debug, Deserialize)]
struct ListChildrenResponse {
    entries: Vec<SafDirEntry>,
}

#[derive(Debug, Deserialize)]
struct ResolveRelativeResponse {
    uri: String,
}

#[derive(Debug, Deserialize)]
struct DataUriResponse {
    #[serde(rename = "dataUri")]
    data_uri: String,
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
/// extensión `.md`/`.markdown`/`.txt` y lo lee con
/// `ContentResolver.openInputStream`. Toda la orquestación vive en el lado
/// Kotlin (`SafPlugin.handleFolderPicked`) porque `ACTION_OPEN_DOCUMENT_TREE`
/// requiere un `ActivityResult` — no hay nada que hacer del lado Rust salvo
/// esperar la respuesta.
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
) -> Result<SafDocument, String> {
    saf.0
        .run_mobile_plugin_async("pickFolderAndReadFirstMarkdown", ())
        .await
        .map_err(|e| e.to_string())
}

/// Slice 2 (árbol completo, RF-25 sobre SAF): lista un único nivel de `uri`,
/// leído bajo demanda al expandir un nodo en `filetree.js` — igual que
/// `list_directory` en escritorio, nunca recursivo de golpe.
#[command]
pub async fn list_children<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
    uri: String,
) -> Result<Vec<SafDirEntry>, String> {
    saf.0
        .run_mobile_plugin_async::<ListChildrenResponse>("listChildren", json!({ "uri": uri }))
        .await
        .map(|r| r.entries)
        .map_err(|e| e.to_string())
}

/// Slice 2: lee un documento arbitrario de la carpeta concedida (clic en el
/// árbol, Quick Open, o destino de un enlace relativo ya resuelto por
/// `resolve_relative`) — equivalente Android de `read_file`.
#[command]
pub async fn read_document<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
    uri: String,
) -> Result<SafDocument, String> {
    saf.0
        .run_mobile_plugin_async("readDocument", json!({ "uri": uri }))
        .await
        .map_err(|e| e.to_string())
}

/// Slice 2 (RF-07/RF-08A sobre SAF): resuelve `relative_path` contra
/// `base_dir_uri` caminando el árbol segmento a segmento del lado Kotlin (ver
/// `SafPlugin.resolveRelative`) — equivalente Android de `resolve_relative_path`.
/// Devuelve la URI `content://` resuelta (documento o carpeta), nunca contenido.
#[command]
pub async fn resolve_relative<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
    base_dir_uri: String,
    relative_path: String,
) -> Result<String, String> {
    saf.0
        .run_mobile_plugin_async::<ResolveRelativeResponse>(
            "resolveRelative",
            json!({ "baseDirUri": base_dir_uri, "relativePath": relative_path }),
        )
        .await
        .map(|r| r.uri)
        .map_err(|e| e.to_string())
}

/// Slice 2 (RF-07 sobre SAF): el WebView de Android no puede cargar
/// `content://` directamente en `<img src>` (a diferencia de `convertFileSrc`
/// con rutas de fichero reales en escritorio) — lee la imagen y la devuelve
/// como `data:` URI en base64. Ver la rama Android de `resolveImages()` en
/// `app.js`.
#[command]
pub async fn read_image_data_uri<R: Runtime>(
    #[allow(unused)] window: Window<R>,
    saf: State<'_, Saf<R>>,
    uri: String,
) -> Result<String, String> {
    saf.0
        .run_mobile_plugin_async::<DataUriResponse>("readImageDataUri", json!({ "uri": uri }))
        .await
        .map(|r| r.data_uri)
        .map_err(|e| e.to_string())
}
