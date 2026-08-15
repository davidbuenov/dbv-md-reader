// =============================================================================
// dbv-md-reader — Lector nativo de Markdown (.md) de solo lectura para Windows
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
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

/// Holds the file path macOS delivers via `RunEvent::Opened` (Finder "Open With"/double-click)
/// when the app is launched cold. On macOS this event fires *before* any window exists — see
/// the `Opened -> Ready -> Window` ordering — so there's no window yet to hand the path to.
/// `get_cli_argument` reads it as a fallback once the frontend is ready to receive it, exactly
/// like it already reads `std::env::args()` on Windows.
pub struct OpenedFileState(pub Mutex<Option<String>>);

/// Maps a document's canonical path to the label of the window currently displaying it, so a
/// repeat "Open With" on the same file focuses that window instead of stacking a duplicate.
/// Resolved live against `app_handle.webview_windows()` on lookup, so a closed window's stale
/// entry is simply ignored rather than requiring explicit cleanup on window-close.
pub struct OpenDocumentsState(pub Mutex<HashMap<String, String>>);

fn is_remote(path: &str) -> bool {
    path.starts_with("http://") || path.starts_with("https://")
}

/// Renders a filesystem path as a `String`, tolerating non-UTF-8 components. Centralizes the
/// `to_string_lossy().to_string()` conversion repeated across `read_file`, `resolve_relative_path`
/// and `canonical_path_str`.
fn path_to_string(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

/// Canonicalizes a local path for use as a dedupe key in `OpenDocumentsState` (same two
/// differently-spelled paths to the same file must map to the same key); remote URLs are
/// already a stable identifier and are returned as-is.
fn canonical_path_str(path: &str) -> String {
    if is_remote(path) {
        return path.to_string();
    }
    fs::canonicalize(path)
        .map(|p| path_to_string(&p))
        .unwrap_or_else(|_| path.to_string())
}

/// Restores `window` if minimized and brings it to the front. Best-effort (`set_focus` can fail
/// if the window is mid-teardown) — shared by every "bring this window to the user" case: an
/// already-open document being reopened, an already-running app receiving no path, and a
/// freshly created document window.
fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Extracts the first non-flag argument (the file path) from a CLI argv-like list,
/// skipping argv[0] (the executable path itself). Shared by `get_cli_argument` (first
/// launch) and the single-instance callback (RF-14, subsequent launches).
fn first_path_argument<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|a| !a.starts_with('-'))
}

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Opens `path` in a brand-new window of the *same* process (RF-14), instead of the OS
/// launching a whole new dbv-md-reader.exe per file. Each window keeps its own
/// zoom/TOC/search/watcher state, exactly like the original main window — the frontend
/// doesn't need to know it was opened this way. `window.__DBV_INITIAL_PATH__` stands in
/// for the CLI argument that a normally-launched process would read via `get_cli_argument`.
fn open_document_window(app: &tauri::AppHandle, path: String) -> tauri::Result<()> {
    let label = format!("doc-{}", WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst));
    let init_script = format!(
        "window.__DBV_INITIAL_PATH__ = {};",
        serde_json::to_string(&path).unwrap_or_else(|_| "null".to_string())
    );
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("dbv-md-reader")
        .inner_size(1120.0, 760.0)
        .min_inner_size(640.0, 450.0)
        .resizable(true)
        .center()
        .initialization_script(&init_script)
        .build()?;
    focus_window(&window);
    Ok(())
}

/// Opens `path` in a new window, unless a live window already displays that exact document —
/// in that case brings the existing window to the front instead of stacking a duplicate. Used
/// by every "open a file while the app is already running" entry point (RF-14 single-instance
/// callback, macOS `RunEvent::Opened` while already running) so repeated "Open With" on the
/// same file always converges on one window instead of accumulating copies.
fn open_or_focus_document(app: &tauri::AppHandle, path: String) {
    let canonical = canonical_path_str(&path);
    let existing_label = app
        .state::<OpenDocumentsState>()
        .0
        .lock()
        .unwrap()
        .get(&canonical)
        .cloned();
    if let Some(label) = existing_label {
        if let Some(window) = app.webview_windows().get(&label) {
            focus_window(window);
            return;
        }
    }
    let _ = open_document_window(app, path);
}

/// Converts a `file://` URL delivered by macOS's `RunEvent::Opened` (Finder "Open With") to a
/// plain filesystem path. Non-`file` URLs (shouldn't occur for this app, no custom URL scheme
/// is registered) are skipped rather than mis-parsed as a path.
#[cfg(target_os = "macos")]
fn opened_url_to_path(url: &tauri::Url) -> Option<String> {
    url.to_file_path().ok().map(|p| p.to_string_lossy().to_string())
}

/// Inserts/moves `entry` to the front of `list`, deduplicating by path and
/// capping the list at 10 entries (RF-11). Pure function, no I/O — kept
/// separate from `add_recent_file` so it can be unit-tested directly.
fn upsert_recent(mut list: Vec<RecentFile>, entry: RecentFile) -> Vec<RecentFile> {
    list.retain(|f| f.path != entry.path);
    list.insert(0, entry);
    list.truncate(10);
    list
}

/// Drops local entries whose file no longer exists on disk; remote entries
/// are always kept (RF-11 self-healing). Pure function, separate from
/// `get_recent_files` so it can be unit-tested without a Tauri AppHandle.
fn filter_existing(list: Vec<RecentFile>) -> Vec<RecentFile> {
    list.into_iter()
        .filter(|f| is_remote(&f.path) || Path::new(&f.path).exists())
        .collect()
}

pub mod commands {
    use super::*;

    /// Returns the initial file path to open: a CLI argument (Windows/Linux "Open With") if
    /// present, otherwise whatever macOS delivered via `RunEvent::Opened` before this window
    /// existed (`OpenedFileState`, see its doc comment). `.take()` consumes the stashed value
    /// so it isn't handed to a second window that happens to call this later.
    #[tauri::command]
    pub fn get_cli_argument(app: tauri::AppHandle) -> Option<String> {
        first_path_argument(std::env::args())
            .or_else(|| app.state::<OpenedFileState>().0.lock().unwrap().take())
    }

    /// Records that `window` is currently displaying the document at `path` (RF-14 dedupe),
    /// called from the frontend after every successful document load. Lets a later "Open With"
    /// on the same file focus this window instead of opening a duplicate.
    #[tauri::command]
    pub fn register_open_document(
        window: tauri::WebviewWindow,
        state: tauri::State<OpenDocumentsState>,
        path: String,
    ) {
        let canonical = canonical_path_str(&path);
        let label = window.label().to_string();
        let mut map = state.0.lock().unwrap();
        map.retain(|_, v| v != &label);
        map.insert(canonical, label);
    }

    /// Returns the app version declared in Cargo.toml, for the "About" panel.
    #[tauri::command]
    pub fn get_app_version(app: tauri::AppHandle) -> String {
        app.package_info().version.to_string()
    }

    /// Returns true if the running binary was installed as a Windows MSIX
    /// package (Microsoft Store), detected by its install path always living
    /// under `...\WindowsApps\...`. Used to hide the GitHub-based updater UI
    /// (RF-13) there — Store packages update via Store/Windows Update, and
    /// downloading/running the NSIS installer inside that sandbox would fail
    /// or create a second, disconnected install.
    #[tauri::command]
    pub fn is_packaged_app() -> bool {
        std::env::current_exe()
            .map(|path| {
                path.components().any(|c| {
                    c.as_os_str()
                        .to_str()
                        .map(|s| s.eq_ignore_ascii_case("WindowsApps"))
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false)
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
            .map(|s| path_to_string(Path::new(s)))
            .unwrap_or_else(|| "documento.md".to_string());

        let dir_path = canonical
            .parent()
            .map(path_to_string)
            .unwrap_or_default();

        Ok(FilePayload {
            path: path_to_string(&canonical),
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
        Ok(path_to_string(&canonical))
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
    /// whose file no longer exists on disk. Remote entries are kept as-is. Only writes
    /// back to disk when the self-healing filter actually dropped something.
    #[tauri::command]
    pub fn get_recent_files(app: tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
        let list = load_recent_files(&app)?;
        let original_len = list.len();
        let filtered = filter_existing(list);
        if filtered.len() != original_len {
            save_recent_files(&app, &filtered)?;
        }
        Ok(filtered)
    }

    /// Records an explicit file open (CLI/dialog/drag&drop) at the top of the recent-files
    /// list and returns the updated list, so the frontend doesn't need a follow-up
    /// `get_recent_files` round-trip just to re-render the panel.
    #[tauri::command]
    pub fn add_recent_file(
        app: tauri::AppHandle,
        path: String,
        file_name: String,
    ) -> Result<Vec<RecentFile>, String> {
        let list = load_recent_files(&app)?;
        let last_opened = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let updated = upsert_recent(list, RecentFile { path, file_name, last_opened });
        save_recent_files(&app, &updated)?;
        Ok(updated)
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
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // RF-14: un doble clic / "Abrir con" en un .md mientras la app ya está en
            // marcha no debe lanzar un proceso dbv-md-reader.exe nuevo — abre una
            // ventana más en este mismo proceso (o, sin ruta, enfoca una existente).
            let app_handle = app.clone();
            let path = first_path_argument(argv);
            let _ = app_handle.clone().run_on_main_thread(move || match path {
                Some(path) => open_or_focus_document(&app_handle, path),
                None => {
                    let windows = app_handle.webview_windows();
                    if let Some(window) = windows.get("main").or_else(|| windows.values().next()) {
                        focus_window(window);
                    }
                }
            });
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(WatcherState(Mutex::new(None)))
        .manage(OpenedFileState(Mutex::new(None)))
        .manage(OpenDocumentsState(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            commands::get_cli_argument,
            commands::get_app_version,
            commands::is_packaged_app,
            commands::read_file,
            commands::open_file_dialog,
            commands::resolve_relative_path,
            commands::watch_file,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::clear_recent_files,
            commands::register_open_document
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            // macOS delivers "Open With"/double-click as an Apple Event, surfaced only through
            // this RunEvent — never through argv (see OpenedFileState's doc comment). Event
            // order is Opened -> Ready -> Window, so "no window yet" reliably means cold start.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(path) = urls.iter().find_map(opened_url_to_path) {
                    if _app_handle.webview_windows().is_empty() {
                        *_app_handle.state::<OpenedFileState>().0.lock().unwrap() = Some(path);
                    } else {
                        open_or_focus_document(_app_handle, path);
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp_file(dir: &Path, name: &str, contents: &str) -> PathBuf {
        let path = dir.join(name);
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(contents.as_bytes()).unwrap();
        path
    }

    fn rf(path: &str, last_opened: u64) -> RecentFile {
        RecentFile {
            path: path.to_string(),
            file_name: "f.md".to_string(),
            last_opened,
        }
    }

    // ── resolve_relative_path (RF-08A / RF-07) ────────────────────────────

    #[test]
    fn resolve_relative_path_full_url_ignores_local_base() {
        let result = commands::resolve_relative_path(
            "C:\\some\\local\\dir".to_string(),
            "https://example.com/doc.md".to_string(),
        );
        assert_eq!(result.unwrap(), "https://example.com/doc.md");
    }

    #[test]
    fn resolve_relative_path_remote_base_joins_as_url() {
        let result = commands::resolve_relative_path(
            "https://example.com/docs/".to_string(),
            "./chapter2.md".to_string(),
        );
        assert_eq!(result.unwrap(), "https://example.com/docs/chapter2.md");
    }

    #[test]
    fn resolve_relative_path_local_relative_file_resolves() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp_file(tmp.path(), "lesson.md", "# hi");
        let result = commands::resolve_relative_path(
            tmp.path().to_string_lossy().to_string(),
            "lesson.md".to_string(),
        );
        assert!(result.as_ref().unwrap().ends_with("lesson.md"), "{:?}", result);
    }

    #[test]
    fn resolve_relative_path_local_absolute_overrides_base() {
        let tmp = tempfile::tempdir().unwrap();
        let abs = write_temp_file(tmp.path(), "abs.md", "# hi");
        let result = commands::resolve_relative_path(
            "C:\\unrelated\\dir".to_string(),
            abs.to_string_lossy().to_string(),
        );
        assert!(result.as_ref().unwrap().ends_with("abs.md"), "{:?}", result);
    }

    #[test]
    fn resolve_relative_path_missing_local_file_errors() {
        let tmp = tempfile::tempdir().unwrap();
        let result = commands::resolve_relative_path(
            tmp.path().to_string_lossy().to_string(),
            "does-not-exist.md".to_string(),
        );
        assert!(result.is_err());
    }

    // ── upsert_recent (RF-11) ──────────────────────────────────────────────

    #[test]
    fn upsert_recent_adds_new_entry_to_front() {
        let list = vec![rf("a.md", 1)];
        let updated = upsert_recent(list, rf("b.md", 2));
        assert_eq!(updated.len(), 2);
        assert_eq!(updated[0].path, "b.md");
    }

    #[test]
    fn upsert_recent_dedupes_and_moves_to_front() {
        let list = vec![rf("a.md", 1), rf("b.md", 2)];
        let updated = upsert_recent(list, rf("a.md", 3));
        assert_eq!(updated.len(), 2, "reopening a.md must not duplicate it");
        assert_eq!(updated[0].path, "a.md");
        assert_eq!(updated[0].last_opened, 3);
    }

    #[test]
    fn upsert_recent_truncates_to_ten_dropping_oldest() {
        let mut list: Vec<RecentFile> = Vec::new();
        for i in 0..10u64 {
            list = upsert_recent(list, rf(&format!("{}.md", i), i));
        }
        assert_eq!(list.len(), 10);

        list = upsert_recent(list, rf("new.md", 99));

        assert_eq!(list.len(), 10, "list must stay capped at 10 entries");
        assert_eq!(list[0].path, "new.md");
        assert!(
            !list.iter().any(|f| f.path == "0.md"),
            "oldest entry (0.md) should have been evicted"
        );
    }

    // ── filter_existing (RF-11 self-healing) ───────────────────────────────

    #[test]
    fn filter_existing_keeps_remote_and_existing_local_drops_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let existing = write_temp_file(tmp.path(), "exists.md", "# hi");
        let existing_str = existing.to_string_lossy().to_string();
        let list = vec![
            rf(&existing_str, 1),
            rf("C:\\definitely\\not\\a\\real\\path\\gone.md", 2),
            rf("https://example.com/remote.md", 3),
        ];

        let filtered = filter_existing(list);

        let paths: Vec<&str> = filtered.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&existing_str.as_str()), "existing local file must be kept");
        assert!(paths.contains(&"https://example.com/remote.md"), "remote entries are never filtered by disk existence");
        assert_eq!(filtered.len(), 2, "the missing local file must be dropped");
    }

    // ── canonical_path_str (RF-14 dedupe) ──────────────────────────────────

    #[test]
    fn canonical_path_str_keeps_remote_url_as_is() {
        assert_eq!(
            canonical_path_str("https://example.com/doc.md"),
            "https://example.com/doc.md"
        );
    }

    #[test]
    fn canonical_path_str_resolves_local_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = write_temp_file(tmp.path(), "doc.md", "# hi");
        let canonical = canonical_path_str(&path.to_string_lossy());
        assert!(canonical.ends_with("doc.md"), "{:?}", canonical);
    }

    #[test]
    fn canonical_path_str_falls_back_to_input_for_missing_file() {
        let missing = "C:\\definitely\\not\\a\\real\\path\\gone.md";
        assert_eq!(canonical_path_str(missing), missing);
    }

    // ── read_file remote (RF-08A) — requires network, run with `cargo test -- --ignored` ──

    #[test]
    #[ignore = "hits the real network; run explicitly with `cargo test -- --ignored`"]
    fn read_file_downloads_remote_markdown() {
        let url = "https://raw.githubusercontent.com/rust-lang/rust/master/README.md";
        let result = commands::read_file(url.to_string());
        let doc = result.expect("remote .md should download successfully over HTTPS");
        assert!(!doc.content.is_empty());
        assert_eq!(doc.file_name, "README.md");
        assert_eq!(doc.dir_path, "https://raw.githubusercontent.com/rust-lang/rust/master");
    }
}
