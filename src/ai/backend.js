// =============================================================================
// dbv-md-reader — Puente IPC de la IA con el backend de Tauri
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ningún comando devuelve una clave de API: la clave solo viaja de ida, al
// guardar una conexión, y vive en el almacén de credenciales del sistema
//. Todo devuelve `{ok, value}` o `{ok: false, error: {kind, message}}`,
// nunca una excepción, para que la interfaz pueda explicar cada fallo.

const tauri = () => window.__TAURI__;

/** Normaliza cualquier fallo del puente al error tipado `{kind, message}`. */
function normalizeError(raw) {
  if (raw && typeof raw === 'object' && typeof raw.kind === 'string') return { kind: raw.kind, message: String(raw.message ?? raw.kind) };
  return { kind: 'bridge', message: String(raw?.message ?? raw) };
}

export async function call(command, args = {}) {
  try {
    return { ok: true, value: await tauri().core.invoke(command, args) };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

/** Suscribe a un evento emitido por el backend. @returns {Promise<() => void>} */
export function on(eventName, handler) {
  return tauri().event.listen(eventName, (event) => handler(event.payload));
}

/**
 * Abre una dirección en el navegador del sistema con el plugin `opener` (el
 * único cargado: `shell` no existe y `window.open` no hace nada en la WebView).
 * Fuera de Tauri (navegador de desarrollo) recurre a `window.open`.
 */
export async function openExternalUrl(url) {
  const opener = tauri()?.opener;
  let result = { ok: true, value: undefined };
  try {
    if (opener) await opener.openUrl(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    result = { ok: false, error: normalizeError(error) };
  }
  return result;
}

// ─── Conexiones y modelos ────────────────────────────────────────────
export const aiConnections = () => call('ai_connections');
/** `apiKey`: `null` no la toca, `''` la borra, otro valor la guarda en el almacén del sistema. */
export const aiSaveConnection = (connection, apiKey, activate = false) =>
  call('ai_save_connection', { request: { connection, apiKey: apiKey ?? null, activate } });
export const aiDeleteConnection = (id) => call('ai_delete_connection', { id });
export const aiSetPreferences = ({ active, showAi } = {}) => call('ai_set_preferences', { active: active ?? null, showAi: showAi ?? null });
export const aiProviders = () => call('ai_providers');
export const aiDetect = () => call('ai_detect');
export const aiListModels = (connection, apiKey) => call('ai_list_models', { connection, apiKey: apiKey ?? null });
/** Modelos disponibles para un agente CLI específico (antigravity, claude, codex, etc.). */
export const aiListAgentModels = (agentId, forceRefresh = false) =>
  call('ai_list_agent_models', { agentId, forceRefresh: Boolean(forceRefresh) });
/** Tamaño, contexto máximo y capacidades del modelo (solo Ollama; `null` en el resto). */
export const aiModelInfo = (connection) => call('ai_model_info', { connection });
/** Lanza una petición; la respuesta llega por el evento `ai-stream` con este `requestId`. */
export const aiChat = (requestId, connectionId, request) => call('ai_chat', { requestId, connectionId, request });
export const aiCancel = (requestId) => call('ai_cancel', { requestId });

// ─── Documentos de la carpeta, confinados en Rust ─────────────────
export const aiListFiles = (root) => call('ai_list_files', { root });
export const aiReadFile = (root, relative) => call('ai_read_file', { root, relative });
export const aiSearchFiles = (root, query) => call('ai_search_files', { root, query });
/** Escribe un documento TRAS la revisión del usuario. */
export const aiWriteFile = (root, relative, content) => call('ai_write_file', { root, relative, content });
/** Deshace la creación de un documento: solo lo borra si sigue como lo dejó la aplicación. */
export const aiDeleteCreated = (root, relative, expected) => call('ai_delete_created', { root, relative, expected });
/** Problemas que tendría la carpeta con `files` (`{path, content}`) en memoria. */
export const aiCheckProposal = (root, files) => call('ai_check_proposal', { root, files });
export const aiProjectStateLoad = (root) => call('ai_project_state_load', { root });
export const aiProjectStateSave = (root, value) => call('ai_project_state_save', { root, value });

// ─── Agentes por ACP ─────────────────────────────────────────────────
// Transporte: Rust lanza el agente y reenvía sus mensajes como `acp-message`.
export const acpStart = (spec, cwd) => call('acp_start', { spec, cwd });
export const acpRequest = (method, params) => call('acp_request', { method, params });
export const acpNotify = (method, params) => call('acp_notify', { method, params });
export const acpRespond = (id, result, error) => call('acp_respond', { id, result: result ?? null, error: error ?? null });
export const acpStop = () => call('acp_stop');
export const acpSnapshot = (root) => call('acp_snapshot', { root });
export const acpChanges = () => call('acp_changes');
