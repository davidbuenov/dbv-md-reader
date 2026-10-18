// =============================================================================
// dbv-md-reader — Agentes instalados por ACP: transporte (RF-32)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-32
//
// El Agent Client Protocol es JSON-RPC 2.0, una línea por mensaje, por la
// entrada y salida estándar del agente. Este módulo es solo TRANSPORTE:
//   · lanza el agente con la carpeta del proyecto como directorio de trabajo;
//   · envía peticiones y notificaciones y espera las respuestas;
//   · reenvía al frontend (`acp-message`) lo que el agente pide o notifica
//     (permisos, lectura y escritura de ficheros, avances), y devuelve lo que
//     el frontend responde (`acp_respond`);
//   · toma un punto de restauración de los ficheros de texto del proyecto
//     antes de cada turno, para saber qué escribió el agente en disco por su
//     cuenta (spike S-ACP: Claude Code escribe así tras pedir permiso).
// Lo que se decide —qué se permite, qué se enseña— lo decide el frontend.
//
// DBV no instala nada: si falta el programa o Node.js, se dice (RF-32.4). Las
// credenciales son las del propio agente; DBV no las ve (RF-32.3).

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

use super::detect::{launcher, which};
use super::files::{is_skipped_dir, is_text_document};
use super::AiError;

/// Paquetes de npm de los adaptadores ACP (comprobados en npm el 2026-10-02).
pub const CLAUDE_ADAPTER: &str = "@agentclientprotocol/claude-agent-acp";
pub const CODEX_ADAPTER: &str = "@zed-industries/codex-acp";

/// Tamaño máximo de un fichero del punto de restauración (los .md son pequeños;
/// uno enorme no se vigila).
const SNAPSHOT_MAX_BYTES: u64 = 2 * 1024 * 1024;
const SNAPSHOT_MAX_FILES: usize = 4000;
/// La carpeta de un documento puede ser cualquiera (Documentos, una descarga…):
/// la foto no baja más de estos niveles ni mira más entradas que estas.
const SNAPSHOT_MAX_DEPTH: usize = 8;
const SNAPSHOT_MAX_ENTRIES: usize = 50_000;
/// Memoria total del punto de restauración.
const SNAPSHOT_MAX_TOTAL: u64 = 64 * 1024 * 1024;

/// Qué agente lanzar: uno de los cuatro reconocidos. No hay agente «a medida» con una orden libre:
/// md-reader abre `.md` de terceros, y una orden arbitraria recibida por IPC sería ejecución de código
/// si algún día se colara una inyección en la interfaz.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSpec {
    pub id: String,
}

/// Programa y argumentos para lanzar un agente reconocido (RF-32.1).
pub fn agent_command(spec: &AgentSpec) -> Result<(PathBuf, Vec<String>), AiError> {
    let need = |name: &str| which(name).ok_or_else(|| AiError::Config(format!("no se encuentra «{name}» en el PATH")));
    let (program, args): (PathBuf, Vec<String>) = match spec.id.as_str() {
        "claude" => (need("npx")?, vec!["-y".into(), CLAUDE_ADAPTER.into()]),
        "codex" => (need("npx")?, vec!["-y".into(), CODEX_ADAPTER.into()]),
        "gemini" => (need("gemini")?, vec!["--experimental-acp".into()]),
        "copilot" => (need("copilot")?, vec!["--acp".into()]),
        other => return Err(AiError::Config(format!("agente desconocido: {other}"))),
    };
    let (program, mut prefix) = launcher(&program);
    prefix.extend(args);
    Ok((program, prefix))
}

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, Value>>>>>;

/// Un agente en marcha.
struct Running {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    next_id: AtomicU64,
    pending: Pending,
}

impl Drop for Running {
    fn drop(&mut self) {
        kill_tree(&mut self.child);
    }
}

/// Mata al agente Y a todo lo que lanzó (`npx` → `node` → el servidor MCP de DBV…). `Child::kill` solo alcanza al hijo
/// directo: los nietos quedaban vivos y uno bloqueaba el ejecutable de debug al volver a compilar.
fn kill_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = Command::new("taskkill").args(["/PID", &child.id().to_string(), "/T", "/F"]).creation_flags(CREATE_NO_WINDOW).output();
    }
    #[cfg(unix)]
    {
        // El agente se lanzó como líder de su propio grupo (`process_group(0)`): `-PID` es todo el grupo. La forma
        // `kill -TERM -PID` NO sirve: el `kill` de procps la interpreta de otro modo y mata la SESIÓN entera (en la CI de
        // Linux se llevó por delante el propio job de pruebas). Con `-s TERM -- -PID` solo cae el grupo, y si el hijo no
        // fuera líder de su grupo da «No such process» sin tocar nada más.
        let _ = Command::new("kill").args(["-s", "TERM", "--", &format!("-{}", child.id())]).output();
    }
    let _ = child.kill();
}

/// Estado del agente por ACP gestionado por Tauri (uno a la vez).
#[derive(Default)]
pub struct AcpState {
    running: Mutex<Option<Running>>,
    snapshot: Mutex<Option<(PathBuf, Snapshot)>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn write_line(stdin: &Mutex<ChildStdin>, message: &Value) -> Result<(), AiError> {
    let mut stdin = lock(stdin);
    let mut line = serde_json::to_string(message).map_err(|error| AiError::Server(error.to_string()))?;
    line.push('\n');
    stdin.write_all(line.as_bytes()).and_then(|_| stdin.flush()).map_err(|error| AiError::Network(format!("el agente no acepta mensajes: {error}")))
}

/// Mensaje del agente que el frontend debe ver o atender.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessage {
    /// `request` (espera respuesta con `acp_respond`) o `notification`.
    pub kind: &'static str,
    pub id: Option<Value>,
    pub method: String,
    pub params: Value,
}

/// Clasifica una línea JSON-RPC del agente: respuesta a una petición nuestra,
/// petición suya o notificación.
pub enum Incoming {
    Response { id: u64, result: Result<Value, Value> },
    Message(AgentMessage),
    Ignore,
}

pub fn classify(line: &str) -> Incoming {
    let Ok(value) = serde_json::from_str::<Value>(line) else { return Incoming::Ignore };
    match (value.get("method").and_then(Value::as_str), value.get("id")) {
        (Some(method), Some(id)) => Incoming::Message(AgentMessage { kind: "request", id: Some(id.clone()), method: method.into(), params: value["params"].clone() }),
        (Some(method), None) => Incoming::Message(AgentMessage { kind: "notification", id: None, method: method.into(), params: value["params"].clone() }),
        (None, Some(id)) => match id.as_u64() {
            Some(id) => Incoming::Response {
                id,
                result: match value.get("error") {
                    Some(error) => Err(error.clone()),
                    None => Ok(value.get("result").cloned().unwrap_or(Value::Null)),
                },
            },
            None => Incoming::Ignore,
        },
        _ => Incoming::Ignore,
    }
}

/// A quién se le cuentan los mensajes del agente: la ventana (`acp-message`,
/// `acp-exit`) en la aplicación, un canal en los tests.
pub type Sink = Arc<dyn Fn(&str, Value) + Send + Sync>;

/// Lanza `program args` en `cwd` y empieza a leer su salida.
fn spawn_agent(program: &Path, args: &[String], cwd: &str, sink: Sink) -> Result<Running, AiError> {
    let mut command = Command::new(program);
    command.args(args).current_dir(cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .map_err(|error| AiError::Config(format!("no se pudo lanzar el agente ({}): {error}", program.display())))?;
    let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or_else(|| AiError::Server("sin entrada estándar".into()))?));
    let stdout = child.stdout.take().ok_or_else(|| AiError::Server("sin salida estándar".into()))?;
    let stderr_pipe = child.stderr.take();
    let pending: Pending = Arc::default();
    let stderr = Arc::new(Mutex::new(String::new()));

    // Errores del agente: se guarda la cola para explicar un fallo de arranque.
    if let Some(mut pipe) = stderr_pipe {
        let tail = stderr.clone();
        std::thread::spawn(move || {
            let mut buffer = [0u8; 4096];
            while let Ok(read) = pipe.read(&mut buffer) {
                if read == 0 {
                    break;
                }
                let mut text = lock(&tail);
                text.push_str(&String::from_utf8_lossy(&buffer[..read]));
                let excess = text.len().saturating_sub(8000);
                if excess > 0 {
                    let cut = text.char_indices().map(|(i, _)| i).find(|i| *i >= excess).unwrap_or(0);
                    text.drain(..cut);
                }
            }
        });
    }

    let reader_pending = pending.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            match classify(&line) {
                Incoming::Response { id, result } => {
                    if let Some(sender) = lock(&reader_pending).remove(&id) {
                        let _ = sender.send(result);
                    }
                }
                Incoming::Message(message) => sink("acp-message", serde_json::to_value(message).unwrap_or(Value::Null)),
                Incoming::Ignore => {}
            }
        }
        // El agente terminó: las peticiones pendientes fallan con su motivo.
        let reason = lock(&stderr).chars().rev().take(1500).collect::<String>().chars().rev().collect::<String>();
        for (_, sender) in lock(&reader_pending).drain() {
            let _ = sender.send(Err(json!({ "message": format!("el agente terminó: {reason}") })));
        }
        sink("acp-exit", json!({ "stderr": reason }));
    });

    Ok(Running { child, stdin, next_id: AtomicU64::new(1), pending })
}

/// Envía una petición y devuelve dónde llegará su respuesta.
fn send_request(running: &Running, method: &str, params: Value) -> Result<oneshot::Receiver<Result<Value, Value>>, AiError> {
    let id = running.next_id.fetch_add(1, Ordering::SeqCst);
    let (sender, receiver) = oneshot::channel();
    lock(&running.pending).insert(id, sender);
    write_line(&running.stdin, &json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))?;
    Ok(receiver)
}

async fn await_response(receiver: oneshot::Receiver<Result<Value, Value>>) -> Result<Value, AiError> {
    match receiver.await {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(error)) => Err(AiError::BadRequest(error["message"].as_str().map(str::to_string).unwrap_or_else(|| error.to_string()))),
        Err(_) => Err(AiError::Network("el agente se cerró".into())),
    }
}

/// Respuesta a una petición del agente.
fn response_message(id: Value, result: Option<Value>, error: Option<String>) -> Value {
    match error {
        Some(message) => json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32603, "message": message } }),
        None => json!({ "jsonrpc": "2.0", "id": id, "result": result.unwrap_or(Value::Null) }),
    }
}

/// Lanza el agente `spec` en la carpeta `cwd`.
#[tauri::command]
pub fn acp_start(app: AppHandle, state: State<'_, AcpState>, spec: AgentSpec, cwd: String) -> Result<(), AiError> {
    *lock(&state.running) = None;
    let (program, args) = agent_command(&spec)?;
    let sink: Sink = Arc::new(move |event, payload| {
        let _ = app.emit(event, payload);
    });
    *lock(&state.running) = Some(spawn_agent(&program, &args, &cwd, sink)?);
    Ok(())
}

/// Envía una petición al agente y espera su respuesta (sin plazo: un turno
/// puede durar minutos; se corta con `session/cancel`).
#[tauri::command]
pub async fn acp_request(state: State<'_, AcpState>, method: String, params: Value) -> Result<Value, AiError> {
    let receiver = {
        let running = lock(&state.running);
        let running = running.as_ref().ok_or_else(|| AiError::Config("no hay ningún agente en marcha".into()))?;
        send_request(running, &method, params)?
    };
    await_response(receiver).await
}

#[tauri::command]
pub fn acp_notify(state: State<'_, AcpState>, method: String, params: Value) -> Result<(), AiError> {
    let running = lock(&state.running);
    let running = running.as_ref().ok_or_else(|| AiError::Config("no hay ningún agente en marcha".into()))?;
    write_line(&running.stdin, &json!({ "jsonrpc": "2.0", "method": method, "params": params }))
}

/// Responde a una petición del agente (`result`, o `error` con su mensaje).
#[tauri::command]
pub fn acp_respond(state: State<'_, AcpState>, id: Value, result: Option<Value>, error: Option<String>) -> Result<(), AiError> {
    let running = lock(&state.running);
    let running = running.as_ref().ok_or_else(|| AiError::Config("no hay ningún agente en marcha".into()))?;
    write_line(&running.stdin, &response_message(id, result, error))
}

/// Cierra el agente (al cerrar el proyecto o cambiar de conexión).
#[tauri::command]
pub fn acp_stop(state: State<'_, AcpState>) {
    *lock(&state.running) = None;
    *lock(&state.snapshot) = None;
}

// ---------------------------------------------------------------------------
// Punto de restauración por turno (RF-32.6)
// ---------------------------------------------------------------------------

/// ¿Parece texto? Sin NUL en los primeros bytes y UTF-8 válido.
fn read_text(path: &Path) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    if meta.len() > SNAPSHOT_MAX_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return None;
    }
    String::from_utf8(bytes).ok()
}

/// Foto de la carpeta del documento: sus ficheros Markdown (sin carpetas ocultas
/// ni dependencias), con el contenido mientras quepa en los topes, y `None` para
/// los que no caben. Saber que un fichero existía, aunque no se guarde su
/// contenido, evita tomarlo después por «creado por el agente» (y que Deshacer
/// lo borre). Solo se vigilan los `.md`/`.markdown`/`.txt` (RNF-IA.3).
pub type Snapshot = HashMap<String, Option<String>>;

pub fn snapshot_dir(root: &Path) -> Snapshot {
    let mut files = Snapshot::new();
    let mut captured = 0usize;
    let mut total = 0u64;
    let walker = walkdir::WalkDir::new(root)
        .max_depth(SNAPSHOT_MAX_DEPTH)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || !is_skipped_dir(&entry.file_name().to_string_lossy()));
    for (visited, entry) in walker.flatten().enumerate() {
        if visited >= SNAPSHOT_MAX_ENTRIES {
            break;
        }
        if !entry.file_type().is_file() || !is_text_document(entry.path()) {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(root) else { continue };
        // Topes de contenido: ficheros y memoria total (un proyecto con muchos
        // CSV grandes no debe llevarse gigas de memoria en cada turno).
        let room = captured < SNAPSHOT_MAX_FILES && total < SNAPSHOT_MAX_TOTAL;
        let text = if room { read_text(entry.path()) } else { None };
        if let Some(text) = &text {
            captured += 1;
            total += text.len() as u64;
        }
        files.insert(relative.to_string_lossy().replace('\\', "/"), text);
    }
    files
}

/// Un fichero que el agente cambió en disco durante el turno.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DiskChange {
    pub path: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

/// Diferencias entre dos fotos del proyecto. Solo se informa de lo que se
/// puede comparar y deshacer: un fichero sin contenido en alguna de las dos
/// fotos (binario, demasiado grande o fuera de los topes) no se lista.
pub fn diff_snapshots(before: &Snapshot, after: &Snapshot) -> Vec<DiskChange> {
    let mut changes: Vec<DiskChange> = Vec::new();
    for (path, text) in after {
        let Some(text) = text else { continue };
        match before.get(path) {
            None => changes.push(DiskChange { path: path.clone(), before: None, after: Some(text.clone()) }),
            Some(Some(old)) if old != text => changes.push(DiskChange { path: path.clone(), before: Some(old.clone()), after: Some(text.clone()) }),
            _ => {}
        }
    }
    for (path, text) in before {
        if let (Some(text), false) = (text, after.contains_key(path)) {
            changes.push(DiskChange { path: path.clone(), before: Some(text.clone()), after: None });
        }
    }
    changes.sort_by(|a, b| a.path.cmp(&b.path));
    changes
}

#[tauri::command]
pub async fn acp_snapshot(state: State<'_, AcpState>, root: String) -> Result<usize, AiError> {
    let path = PathBuf::from(&root);
    let files = tauri::async_runtime::spawn_blocking(move || snapshot_dir(&path)).await.map_err(|e| AiError::Server(e.to_string()))?;
    let count = files.len();
    *lock(&state.snapshot) = Some((PathBuf::from(root), files));
    Ok(count)
}

/// Lo que cambió en disco desde el último punto de restauración.
#[tauri::command]
pub async fn acp_changes(state: State<'_, AcpState>) -> Result<Vec<DiskChange>, AiError> {
    let Some((root, before)) = lock(&state.snapshot).clone() else { return Ok(Vec::new()) };
    tauri::async_runtime::spawn_blocking(move || diff_snapshots(&before, &snapshot_dir(&root)))
        .await
        .map_err(|e| AiError::Server(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clasifica_respuestas_peticiones_y_notificaciones() {
        assert!(matches!(classify(r#"{"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}"#), Incoming::Response { id: 3, result: Ok(_) }));
        assert!(matches!(classify(r#"{"jsonrpc":"2.0","id":4,"error":{"message":"x"}}"#), Incoming::Response { id: 4, result: Err(_) }));
        let Incoming::Message(request) = classify(r#"{"jsonrpc":"2.0","id":0,"method":"session/request_permission","params":{"a":1}}"#) else { panic!() };
        assert_eq!((request.kind, request.method.as_str(), request.params["a"].as_i64()), ("request", "session/request_permission", Some(1)));
        let Incoming::Message(note) = classify(r#"{"jsonrpc":"2.0","method":"session/update","params":{}}"#) else { panic!() };
        assert_eq!(note.kind, "notification");
        assert!(matches!(classify("no es json"), Incoming::Ignore));
    }

    #[test]
    fn el_punto_de_restauracion_detecta_cambios_creaciones_y_borrados() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("main.md"), "# Hola").unwrap();
        std::fs::write(dir.path().join("viejo.md"), "x").unwrap();
        std::fs::create_dir(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git").join("HEAD"), "ref").unwrap();
        std::fs::write(dir.path().join("raro.md"), [0u8, 1, 2, 0]).unwrap();
        // Solo se vigilan los documentos de texto: una imagen ni consta (RNF-IA.3).
        std::fs::write(dir.path().join("foto.png"), [0u8, 1, 2, 0]).unwrap();
        let before = snapshot_dir(dir.path());
        assert_eq!(before.len(), 3, "sin .git ni imágenes: {before:?}");
        assert_eq!(before["raro.md"], None, "un .md binario consta, sin contenido");
        assert!(!before.contains_key("foto.png"));

        std::fs::write(dir.path().join("main.md"), "# Hola mundo").unwrap();
        std::fs::remove_file(dir.path().join("viejo.md")).unwrap();
        std::fs::create_dir(dir.path().join("caps")).unwrap();
        std::fs::write(dir.path().join("caps").join("uno.md"), "# Uno").unwrap();
        let changes = diff_snapshots(&before, &snapshot_dir(dir.path()));
        assert_eq!(
            changes,
            vec![
                DiskChange { path: "caps/uno.md".into(), before: None, after: Some("# Uno".into()) },
                DiskChange { path: "main.md".into(), before: Some("# Hola".into()), after: Some("# Hola mundo".into()) },
                DiskChange { path: "viejo.md".into(), before: Some("x".into()), after: None },
            ]
        );
    }

    #[test]
    fn un_fichero_que_existia_sin_contenido_no_se_toma_por_creado() {
        let mut before = Snapshot::new();
        before.insert("grande.csv".into(), None);
        let mut after = Snapshot::new();
        after.insert("grande.csv".into(), Some("a,b".into()));
        after.insert("nuevo.md".into(), Some("# Nuevo".into()));
        let changes = diff_snapshots(&before, &after);
        assert_eq!(changes, vec![DiskChange { path: "nuevo.md".into(), before: None, after: Some("# Nuevo".into()) }]);
    }

    #[test]
    fn un_agente_desconocido_o_a_medida_es_un_error_claro() {
        assert!(agent_command(&AgentSpec { id: "nada".into() }).is_err());
        // No existe el agente «custom» con una orden libre: es ejecución arbitraria por IPC.
        assert!(agent_command(&AgentSpec { id: "custom".into() }).is_err());
    }

    /// Agente falso en Node (`tests/fixtures/fake-acp-agent.mjs`): responde a
    /// `initialize`, `session/new` y `session/prompt`; durante el turno pide un
    /// permiso y lee un fichero, y escribe en disco por su cuenta.
    #[test]
    fn transporte_extremo_a_extremo_con_un_agente_falso() {
        let Some(node) = which("node") else {
            eprintln!("sin node en el PATH: se omite");
            return;
        };
        let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests").join("fixtures").join("fake-acp-agent.mjs");
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("main.md"), "# Hola").unwrap();
        let (tx, rx) = std::sync::mpsc::channel::<(String, Value)>();
        let sink: Sink = Arc::new(move |event, payload| {
            let _ = tx.send((event.to_string(), payload));
        });
        let running = spawn_agent(&node, &[script.to_string_lossy().to_string()], &dir.path().to_string_lossy(), sink).unwrap();
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let init = runtime.block_on(await_response(send_request(&running, "initialize", json!({ "protocolVersion": 1 })).unwrap())).unwrap();
        assert_eq!(init["agentInfo"]["name"], "falso");
        let session = runtime.block_on(await_response(send_request(&running, "session/new", json!({ "cwd": dir.path() })).unwrap())).unwrap();
        assert_eq!(session["sessionId"], "s1");

        let before = snapshot_dir(dir.path());
        let prompt = send_request(&running, "session/prompt", json!({ "sessionId": "s1", "prompt": [] })).unwrap();
        // El agente pide permiso y espera la respuesta del cliente.
        let (event, permission) = rx.recv_timeout(std::time::Duration::from_secs(20)).unwrap();
        assert_eq!(event, "acp-message");
        assert_eq!(permission["method"], "session/request_permission");
        write_line(&running.stdin, &response_message(permission["id"].clone(), Some(json!({ "outcome": { "outcome": "selected", "optionId": "allow" } })), None)).unwrap();
        // Luego lee un fichero a través del cliente.
        let (_, read) = rx.recv_timeout(std::time::Duration::from_secs(20)).unwrap();
        assert_eq!(read["method"], "fs/read_text_file");
        write_line(&running.stdin, &response_message(read["id"].clone(), Some(json!({ "content": "# Hola" })), None)).unwrap();
        let (_, update) = rx.recv_timeout(std::time::Duration::from_secs(20)).unwrap();
        assert_eq!(update["kind"], "notification");
        let done = runtime.block_on(await_response(prompt)).unwrap();
        assert_eq!(done["stopReason"], "end_turn");
        // Lo que escribió por su cuenta aparece frente al punto de restauración.
        let changes = diff_snapshots(&before, &snapshot_dir(dir.path()));
        assert_eq!(changes, vec![DiskChange { path: "main.md".into(), before: Some("# Hola".into()), after: Some("# Hola, agente".into()) }]);
        drop(running);
    }

    /// El agente (y lo que lance) se termina como un grupo y NO se lleva por delante a quien lo lanzó. Regresión real de la
    /// 0.14.0: `kill -TERM -PID` mataba la sesión entera y cancelaba la CI de Linux.
    #[cfg(unix)]
    #[test]
    fn cerrar_el_agente_mata_su_grupo_y_no_a_quien_lo_lanzo() {
        use std::os::unix::process::CommandExt;
        use std::process::{Command, Stdio};
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 60 & wait"]).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        command.process_group(0);
        let mut child = command.spawn().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(200));
        kill_tree(&mut child);
        let started = std::time::Instant::now();
        let mut status = None;
        while status.is_none() && started.elapsed() < std::time::Duration::from_secs(5) {
            status = child.try_wait().unwrap();
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        assert!(status.is_some(), "el agente sigue vivo tras cerrarlo");
        // Si hemos llegado hasta aquí, el proceso de pruebas sigue vivo: la señal no salió del grupo del agente.
    }
}
