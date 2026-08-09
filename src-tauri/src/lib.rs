// =============================================================================
// dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FilePayload {
    pub path: String,
    pub content: String,
    pub dir_path: String,
    pub file_name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RecentFile {
    pub path: String,
    pub file_name: String,
    pub last_opened: u64,
}

/// Holds the single active file watcher (RF-06). Replacing it drops/stops the previous one.
pub struct WatcherState(pub Mutex<Option<notify::RecommendedWatcher>>);

fn is_remote(path: &str) -> bool {
    path.starts_with("http://") || path.starts_with("https://")
}

pub mod commands {
    use super::*;

    /// Returns the initial file path passed as CLI argument (if any)
    #[tauri::command]
    pub fn get_cli_argument() -> Option<String> {
        std::env::args().nth(1).filter(|a| !a.starts_with('-'))
    }

    /// Returns the app version declared in Cargo.toml, for the "About" panel.
    #[tauri::command]
    pub fn get_app_version(app: tauri::AppHandle) -> String {
        app.package_info().version.to_string()
    }

    /// Reads a local Markdown file, or downloads a remote one (RF-08A), and returns its raw text content
    #[tauri::command]
    pub fn read_file(path: String) -> Result<FilePayload, String> {
        if is_remote(&path) {
            let mut response = ureq::get(&path)
                .call()
                .map_err(|e| format!("Error al descargar '{}': {}", path, e))?;
            let content = response
                .body_mut()
                .read_to_string()
                .map_err(|e| format!("Error leyendo respuesta de '{}': {}", path, e))?;
            let file_name = path
                .rsplit('/')
                .next()
                .filter(|s| !s.is_empty())
                .unwrap_or("documento.md")
                .to_string();
            let dir_path = path
                .rsplit_once('/')
                .map(|(dir, _)| dir.to_string())
                .unwrap_or_default();
            return Ok(FilePayload { path, content, dir_path, file_name });
        }

        let path_buf = PathBuf::from(&path);
        if !path_buf.exists() {
            return Err(format!("Archivo no encontrado: {}", path));
        }

        let canonical = fs::canonicalize(&path_buf)
            .map_err(|e| format!("Error al resolver ruta: {}", e))?;

        let content = fs::read_to_string(&canonical)
            .map_err(|e| format!("Error al leer archivo: {}", e))?;

        let file_name = canonical
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "documento.md".to_string());

        let dir_path = canonical
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        Ok(FilePayload {
            path: canonical.to_string_lossy().to_string(),
            content,
            dir_path,
            file_name,
        })
    }

    /// Opens a native OS file picker dialog and returns the selected path
    #[tauri::command]
    pub async fn open_file_dialog(app: tauri::AppHandle) -> Option<String> {
        app.dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .blocking_pick_file()
            .map(|p| p.to_string())
    }

    /// Resolves a relative Markdown/image link from the current document's directory (local or remote base)
    #[tauri::command]
    pub fn resolve_relative_path(base_dir: String, relative_path: String) -> Result<String, String> {
        if is_remote(&relative_path) {
            return Ok(relative_path);
        }
        if is_remote(&base_dir) {
            let base = base_dir.trim_end_matches('/');
            let rel = relative_path.trim_start_matches("./").trim_start_matches('/');
            return Ok(format!("{}/{}", base, rel));
        }
        let joined = PathBuf::from(&base_dir).join(&relative_path);
        let canonical = fs::canonicalize(&joined)
            .map_err(|e| format!("Error resolviendo '{}': {}", relative_path, e))?;
        Ok(canonical.to_string_lossy().to_string())
    }

    /// Watches the parent directory of `path` (RF-06) and emits `file-changed` when it's modified.
    /// Watching the parent (not the file itself) survives atomic saves (temp file + rename) used
    /// by editors like VS Code. Replaces any previously active watcher.
    #[tauri::command]
    pub fn watch_file(
        app: tauri::AppHandle,
        state: tauri::State<WatcherState>,
        path: String,
    ) -> Result<(), String> {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = None; // Stop watching the previous document, if any.

        if is_remote(&path) {
            return Ok(());
        }

        let file_path = PathBuf::from(&path);
        let parent = file_path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .ok_or_else(|| format!("No se pudo determinar el directorio padre de '{}'", path))?
            .to_path_buf();
        let target_name = file_path.file_name().map(|s| s.to_os_string());

        let watched_path = path.clone();
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            let is_relevant_kind = matches!(
                event.kind,
                notify::EventKind::Modify(_) | notify::EventKind::Create(_)
            );
            if !is_relevant_kind {
                return;
            }
            let matches_target = event
                .paths
                .iter()
                .any(|p| p.file_name() == target_name.as_deref());
            if matches_target {
                let _ = app.emit("file-changed", &watched_path);
            }
        })
        .map_err(|e| format!("Error creando el observador de archivos: {}", e))?;

        notify::Watcher::watch(&mut watcher, &parent, notify::RecursiveMode::NonRecursive)
            .map_err(|e| format!("Error observando '{}': {}", parent.display(), e))?;

        *guard = Some(watcher);
        Ok(())
    }

    fn recent_files_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Error resolviendo el directorio de datos: {}", e))?;
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Error creando el directorio de datos: {}", e))?;
        Ok(dir.join("recent_files.json"))
    }

    fn load_recent_files(app: &tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
        let path = recent_files_path(app)?;
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Error leyendo archivos recientes: {}", e))?;
        Ok(serde_json::from_str(&raw).unwrap_or_default())
    }

    fn save_recent_files(app: &tauri::AppHandle, list: &[RecentFile]) -> Result<(), String> {
        let path = recent_files_path(app)?;
        let raw = serde_json::to_string_pretty(list)
            .map_err(|e| format!("Error serializando archivos recientes: {}", e))?;
        fs::write(&path, raw).map_err(|e| format!("Error guardando archivos recientes: {}", e))
    }

    /// Returns the recent-files list (RF-11), self-healing by dropping local entries
    /// whose file no longer exists on disk. Remote entries are kept as-is.
    #[tauri::command]
    pub fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
        let list = load_recent_files(&app)?;
        let filtered: Vec<RecentFile> = list
            .into_iter()
            .filter(|f| is_remote(&f.path) || Path::new(&f.path).exists())
            .collect();
        save_recent_files(&app, &filtered)?;
        Ok(filtered)
    }

    /// Records an explicit file open (CLI/dialog/drag&drop) at the top of the recent-files list.
    #[tauri::command]
    pub fn add_recent_file(
        app: tauri::AppHandle,
        path: String,
        file_name: String,
    ) -> Result<(), String> {
        let mut list = load_recent_files(&app)?;
        list.retain(|f| f.path != path);
        let last_opened = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        list.insert(0, RecentFile { path, file_name, last_opened });
        list.truncate(10);
        save_recent_files(&app, &list)
    }

    /// Clears the recent-files list.
    #[tauri::command]
    pub fn clear_recent_files(app: tauri::AppHandle) -> Result<(), String> {
        save_recent_files(&app, &[])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::get_cli_argument,
            commands::get_app_version,
            commands::read_file,
            commands::open_file_dialog,
            commands::resolve_relative_path,
            commands::watch_file,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::clear_recent_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
