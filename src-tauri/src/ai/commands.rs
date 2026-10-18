// =============================================================================
// dbv-md-reader — Comandos Tauri de la IA (RF-31, RF-33, RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-31
//
// Frontera con el frontend. Reglas que se cumplen aquí:
//   · Ningún comando devuelve una clave: como mucho, `hasKey`.
//   · El chat se pide por `connectionId`; la clave se lee del almacén justo
//     antes de la petición y la respuesta llega como eventos `ai-stream`.
//   · Nada se escribe en el proyecto: conexiones en la carpeta de
//     configuración, conversaciones en la de datos.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

use super::check::{self, FileContent};
use super::connections::{self, Connection, ConnectionsFile, ProviderKind};
use super::detect::{self, Detection};
use super::providers::{self, ChatRequest, StreamEvent};
use super::secrets::KeyStorage;
use super::store;
use super::{AiError, AiState};

fn config_dir(app: &AppHandle) -> Result<PathBuf, AiError> {
    app.path().app_config_dir().map_err(|error| AiError::Config(error.to_string()))
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, AiError> {
    app.path().app_data_dir().map_err(|error| AiError::Config(error.to_string()))
}

/// ¿Puede usarse la clave GUARDADA de `connection`? Solo si la conexión
/// guardada con ese id apunta al mismo proveedor y la misma dirección: una
/// dirección cambiada en el formulario (una errata, un intermediario) no debe
/// recibir la clave sin volver a escribirla.
pub fn stored_key_allowed(file: &ConnectionsFile, connection: &Connection) -> bool {
    file.connections
        .iter()
        .any(|saved| saved.id == connection.id && saved.provider == connection.provider && saved.base_url.trim() == connection.base_url.trim())
}

/// Conexiones guardadas (sin claves) y si mostrar la IA.
#[tauri::command]
pub fn ai_connections(app: AppHandle) -> Result<ConnectionsFile, AiError> {
    connections::load(&config_dir(&app)?)
}

/// Lo que se guarda al crear o editar una conexión. `apiKey` solo viaja de ida.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConnection {
    pub connection: Connection,
    /// `None`: no tocar la clave guardada; cadena vacía: borrarla.
    pub api_key: Option<String>,
    #[serde(default)]
    pub activate: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub file: ConnectionsFile,
    /// `session` si el sistema no tiene almacén y la clave solo dura la sesión.
    pub key_storage: Option<KeyStorage>,
}

#[tauri::command]
pub fn ai_save_connection(app: AppHandle, state: State<'_, AiState>, request: SaveConnection) -> Result<SavedConnection, AiError> {
    let mut connection = request.connection;
    connection.validate()?;
    let dir = config_dir(&app)?;
    let mut file = connections::load(&dir)?;
    let mut key_storage = None;
    match request.api_key.as_deref() {
        Some("") => {
            state.secrets.delete(&connection.id)?;
            connection.has_key = false;
        }
        Some(key) => {
            key_storage = Some(state.secrets.set(&connection.id, key.trim()));
            connection.has_key = true;
        }
        None => {
            let had_key = file.connections.iter().any(|c| c.id == connection.id && c.has_key);
            if had_key && !stored_key_allowed(&file, &connection) {
                return Err(AiError::Config("cambiaste la dirección de la conexión: vuelve a escribir la clave".into()));
            }
            connection.has_key = had_key;
        }
    }
    match file.connections.iter_mut().find(|c| c.id == connection.id) {
        Some(existing) => *existing = connection.clone(),
        None => file.connections.push(connection.clone()),
    }
    if request.activate || file.active.is_none() {
        file.active = Some(connection.id.clone());
    }
    connections::save(&dir, &file)?;
    Ok(SavedConnection { file, key_storage })
}

/// Elimina la conexión y su clave del almacén (RF-31.4).
#[tauri::command]
pub fn ai_delete_connection(app: AppHandle, state: State<'_, AiState>, id: String) -> Result<ConnectionsFile, AiError> {
    let dir = config_dir(&app)?;
    let mut file = connections::load(&dir)?;
    state.secrets.delete(&id)?;
    file.connections.retain(|c| c.id != id);
    if file.active.as_deref() == Some(id.as_str()) {
        file.active = file.connections.first().map(|c| c.id.clone());
    }
    connections::save(&dir, &file)?;
    Ok(file)
}

/// Conexión activa y «Mostrar las funciones de IA».
#[tauri::command]
pub fn ai_set_preferences(app: AppHandle, active: Option<String>, show_ai: Option<bool>) -> Result<ConnectionsFile, AiError> {
    let dir = config_dir(&app)?;
    let mut file = connections::load(&dir)?;
    if let Some(id) = active.filter(|id| file.connections.iter().any(|c| &c.id == id)) {
        file.active = Some(id);
    }
    if let Some(show) = show_ai {
        file.show_ai = show;
    }
    connections::save(&dir, &file)?;
    Ok(file)
}

/// URL por defecto, contexto prudente y si es de nube, para el asistente.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub provider: ProviderKind,
    pub base_url: &'static str,
    pub cloud: bool,
    pub context_tokens: u32,
    /// Tope de tokens por respuesta por defecto (RF-107.1); `None` en las nubes.
    pub max_output_tokens: Option<u32>,
}

#[tauri::command]
pub fn ai_providers() -> Vec<ProviderInfo> {
    use ProviderKind::*;
    [Ollama, LmStudio, OpenAiCompatible, Anthropic, OpenAi, Gemini, OpenRouter, Agent]
        .into_iter()
        .map(|provider| ProviderInfo {
            provider,
            base_url: provider.default_base_url(),
            cloud: provider.is_cloud(),
            context_tokens: provider.default_context(),
            max_output_tokens: provider.default_max_output(),
        })
        .collect()
}

#[tauri::command]
pub async fn ai_detect() -> Detection {
    tauri::async_runtime::spawn_blocking(detect::detect).await.unwrap_or(Detection { servers: Vec::new(), tools: Vec::new() })
}

/// «Probar conexión»: lista los modelos con la conexión TAL COMO está en el
/// formulario (aún sin guardar), con la clave escrita o con la guardada.
#[tauri::command]
pub async fn ai_list_models(app: AppHandle, state: State<'_, AiState>, connection: Connection, api_key: Option<String>) -> Result<Vec<String>, AiError> {
    connection.validate()?;
    let saved = connections::load(&config_dir(&app)?)?;
    let stored = if stored_key_allowed(&saved, &connection) { state.secrets.get(&connection.id) } else { None };
    let key = api_key.filter(|key| !key.is_empty()).or(stored);
    tauri::async_runtime::spawn_blocking(move || providers::list_models(&connection, key.as_deref()))
        .await
        .map_err(|error| AiError::Server(error.to_string()))?
}

/// Evento `ai-stream`: un trozo de la respuesta de la petición `request_id`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamPayload {
    pub request_id: String,
    #[serde(flatten)]
    pub event: StreamOrError,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum StreamOrError {
    Event(StreamEvent),
    Error { r#type: &'static str, error: AiError },
}

/// Lanza una petición de chat con la conexión `connection_id`. Vuelve en
/// seguida; la respuesta llega por `ai-stream` y termina con `done` o `error`.
/// Tamaño, contexto máximo y capacidades del modelo de una conexión (solo Ollama; RF-101, RF-103).
#[tauri::command]
pub async fn ai_model_info(connection: Connection) -> Result<Option<providers::ModelInfo>, AiError> {
    connection.validate()?;
    tauri::async_runtime::spawn_blocking(move || providers::model_info(&connection))
        .await
        .map_err(|error| AiError::Server(error.to_string()))?
}

#[tauri::command]
pub fn ai_chat(app: AppHandle, state: State<'_, AiState>, request_id: String, connection_id: String, request: ChatRequest) -> Result<(), AiError> {
    let file = connections::load(&config_dir(&app)?)?;
    let connection = file
        .connections
        .into_iter()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| AiError::Config(format!("no existe la conexión «{connection_id}»")))?;
    let key = state.secrets.get(&connection.id);
    if connection.has_key && key.is_none() {
        return Err(AiError::Auth("la clave de esta conexión ya no está en el almacén del sistema: vuelve a escribirla".into()));
    }
    let cancelled = Arc::new(AtomicBool::new(false));
    state.running.lock().unwrap_or_else(|p| p.into_inner()).insert(request_id.clone(), cancelled.clone());
    std::thread::spawn(move || {
        let emit_app = app.clone();
        let id = request_id.clone();
        let mut emit = |event: StreamEvent| {
            let _ = emit_app.emit("ai-stream", StreamPayload { request_id: id.clone(), event: StreamOrError::Event(event) });
        };
        if let Err(error) = providers::stream_chat(&connection, key.as_deref(), &request, &cancelled, &mut emit) {
            let _ = app.emit("ai-stream", StreamPayload { request_id: request_id.clone(), event: StreamOrError::Error { r#type: "error", error } });
        }
        if let Some(state) = app.try_state::<AiState>() {
            state.running.lock().unwrap_or_else(|p| p.into_inner()).remove(&request_id);
        }
    });
    Ok(())
}

/// Detiene una petición en curso (RF-33.5).
#[tauri::command]
pub fn ai_cancel(state: State<'_, AiState>, request_id: String) {
    if let Some(flag) = state.running.lock().unwrap_or_else(|p| p.into_inner()).get(&request_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

/// Problemas que tendría la carpeta con `files` sustituidos (RF-34.3). Barato, pero toca el
/// disco para comprobar enlaces: fuera del hilo de la interfaz.
#[tauri::command]
pub async fn ai_check_proposal(root: String, files: Vec<FileContent>) -> Result<check::CheckOutcome, AiError> {
    tauri::async_runtime::spawn_blocking(move || check::check(&root, &files)).await.map_err(|error| AiError::Server(error.to_string()))?
}

/// Estado de la IA del proyecto (conversaciones, avisos de nube aceptados).
#[tauri::command]
pub fn ai_project_state_load(app: AppHandle, root: String) -> Result<Value, AiError> {
    store::load(&data_dir(&app)?, &root)
}

#[tauri::command]
pub fn ai_project_state_save(app: AppHandle, root: String, value: Value) -> Result<(), AiError> {
    store::save(&data_dir(&app)?, &root, &value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection(base_url: &str) -> Connection {
        Connection {
            id: "c1".into(),
            name: "Claude".into(),
            provider: ProviderKind::Anthropic,
            base_url: base_url.into(),
            model: "m".into(),
            has_key: true,
            context_tokens: None,
            supports_tools: None,
            supports_images: None,
            reasoning: None,
            max_output_tokens: None,
        }
    }

    #[test]
    fn la_clave_guardada_solo_vale_para_su_direccion() {
        let file = ConnectionsFile { connections: vec![connection("https://api.anthropic.com/v1")], active: None, show_ai: true };
        assert!(stored_key_allowed(&file, &connection("https://api.anthropic.com/v1")));
        assert!(!stored_key_allowed(&file, &connection("https://api.anthropic.com.evil.example/v1")));
        let mut other = connection("https://api.anthropic.com/v1");
        other.id = "c2".into();
        assert!(!stored_key_allowed(&file, &other), "otra conexión no hereda la clave");
    }
}
