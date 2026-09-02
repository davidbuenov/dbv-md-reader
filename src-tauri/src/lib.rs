// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use std::process::Command;
#[cfg(desktop)]
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(desktop)]
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

/// Extensiones tratadas como documento abierto por la app — mismo criterio en el filtro
/// del diálogo nativo (`open_file_dialog`), el Drag & Drop (RF-09) y el árbol de directorios
/// (RF-25, campo `is_markdown` de `DirEntryInfo`), para no divergir en qué cuenta como ".md".
const MARKDOWN_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];

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

/// Una entrada de un nivel del árbol de directorios (RF-25) — carpetas e imágenes/assets
/// se listan igual que los `.md` para reflejar la estructura real de disco, pero solo
/// `is_markdown` es clicable en el frontend.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_markdown: bool,
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

/// Instala el proveedor criptográfico por defecto de rustls antes de que ninguna otra parte
/// del binario pueda construir un cliente `reqwest`. Hallazgo real de esta sesión (SIGABRT
/// confirmado con `adb logcat` contra un build Android real): `tauri` (núcleo, no solo
/// `tauri-plugin-updater` — ver `cargo tree -i reqwest`) depende de `reqwest` con backend
/// `rustls`, y sin un proveedor instalado *cualquier* intento de construir un cliente reqwest
/// panickea ("No rustls crypto provider is configured") — al no poder desenrollar a través de
/// la frontera FFI, aborta el proceso entero antes de mostrar ninguna ventana.
/// **Por qué `#[ctor::ctor]` y no una llamada al principio de `run()`:** en Android, el hilo
/// nativo que arranca `tao`/`wry` (`ndk_glue::create`) puede construir ese cliente reqwest
/// *antes* de que `run()` llegue a ejecutarse — una llamada al principio de `run()` llega
/// tarde (verificado: seguía crasheando igual). `#[ctor::ctor]` genera un símbolo
/// `.init_array` en el `.so`, ejecutado por el propio enlazador dinámico al cargar la
/// librería — antes de que exista ningún hilo de la aplicación con el que competir.
/// `install_default()` solo falla si ya hay uno instalado (no es un panic), de ahí el `let _ =`.
#[ctor::ctor]
fn install_rustls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

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
///
/// Desktop-only: `unminimize()` no existe en `WebviewWindow` de Android, y todos sus llamantes
/// (instancia única RF-14, `open_document_window`, `RunEvent::Opened` de macOS) son a su vez
/// desktop-only — ver SPECIFICATIONS.md RF-14 en Android.
#[cfg(desktop)]
fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Ventana "main" si existe, si no la primera disponible — fallback compartido por el
/// callback de single-instance y por el manejador de eventos del menú de macOS cuando
/// no hay ninguna pista mejor (ruta de archivo, ventana enfocada). Desktop-only por el mismo
/// motivo que `focus_window`: ningún llamante existe en Android.
#[cfg(desktop)]
fn main_or_first_window(windows: &HashMap<String, tauri::WebviewWindow>) -> Option<&tauri::WebviewWindow> {
    windows.get("main").or_else(|| windows.values().next())
}

/// Extracts the first non-flag argument (the file path) from a CLI argv-like list,
/// skipping argv[0] (the executable path itself). Shared by `get_cli_argument` (first
/// launch) and the single-instance callback (RF-14, subsequent launches).
fn first_path_argument<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|a| !a.starts_with('-'))
}

#[cfg(desktop)]
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Opens `path` in a brand-new window of the *same* process (RF-14), instead of the OS
/// launching a whole new dbv-md-reader.exe per file. Each window keeps its own
/// zoom/TOC/search/watcher state, exactly like the original main window — the frontend
/// doesn't need to know it was opened this way. `window.__DBV_INITIAL_PATH__` stands in
/// for the CLI argument that a normally-launched process would read via `get_cli_argument`.
///
/// Desktop-only: `WebviewWindowBuilder::center()` no existe en el builder de Android, y el
/// modelo de una sola Activity no tiene equivalente a "ventana adicional del mismo proceso"
/// — ver SPECIFICATIONS.md RF-14/RF-25 en Android.
#[cfg(desktop)]
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
/// same file always converges on one window instead of accumulating copies. Desktop-only:
/// every caller (instancia única, `RunEvent::Opened` de macOS, `open_in_new_window`) lo es.
#[cfg(desktop)]
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

fn is_saf(path: &str) -> bool {
    path.starts_with("content://")
}

/// Drops local entries whose file no longer exists on disk; remote entries
/// and Android SAF content URIs are always kept (RF-11 self-healing). Pure
/// function, separate from `get_recent_files` so it can be unit-tested without
/// a Tauri AppHandle.
fn filter_existing(list: Vec<RecentFile>) -> Vec<RecentFile> {
    list.into_iter()
        .filter(|f| is_remote(&f.path) || is_saf(&f.path) || Path::new(&f.path).exists())
        .collect()
}

/// True si `name` termina en una de `MARKDOWN_EXTENSIONS` (comparación insensible a
/// mayúsculas), el mismo criterio que ya usa el filtro del diálogo nativo y el Drag & Drop.
fn has_markdown_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| MARKDOWN_EXTENSIONS.iter().any(|m| m.eq_ignore_ascii_case(ext)))
        .unwrap_or(false)
}

/// Lee un único nivel de `dir` para el árbol de directorios (RF-25): carpetas primero,
/// después archivos, ambos alfabético insensible a mayúsculas (convención estándar de
/// explorador de archivos). Una entrada individual que falle al leerse (permiso denegado,
/// symlink roto) se descarta en silencio en vez de abortar todo el listado — mismo criterio
/// de autocuración que `filter_existing` (RF-11).
fn list_directory_entries(dir: &Path) -> Vec<DirEntryInfo> {
    let Ok(read_dir) = fs::read_dir(dir) else { return Vec::new() };
    let mut entries: Vec<DirEntryInfo> = read_dir
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            let name = path_to_string(Path::new(&entry.file_name()));
            let is_dir = file_type.is_dir();
            Some(DirEntryInfo {
                is_markdown: !is_dir && has_markdown_extension(&name),
                name,
                path: path_to_string(&entry.path()),
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

/// Construye el `(programa, argumentos)` para revelar `path` en el gestor de archivos nativo
/// del sistema operativo (RF-25, menú contextual), sin llegar a lanzar el proceso — separado
/// de `reveal_in_file_manager` para poder testearlo sin depender de un binario externo real.
/// `is_dir` decide la rama: un archivo se selecciona dentro de su carpeta contenedora, una
/// carpeta se abre directamente.
#[cfg(windows)]
fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    if is_dir {
        ("explorer", vec![path.to_string()])
    } else {
        ("explorer", vec![format!("/select,{}", path)])
    }
}

#[cfg(target_os = "macos")]
fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    if is_dir {
        ("open", vec![path.to_string()])
    } else {
        ("open", vec!["-R".to_string(), path.to_string()])
    }
}

/// Linux, alcance reducido (ver `SPECIFICATIONS.md` RF-25): no existe un comando universal
/// de "seleccionar el archivo exacto" entre gestores de archivos (Nautilus/Dolphin/...) — se
/// abre la carpeta contenedora sin selección, limitación de plataforma documentada.
#[cfg(target_os = "linux")]
fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    let target = if is_dir {
        path.to_string()
    } else {
        Path::new(path)
            .parent()
            .map(path_to_string)
            .unwrap_or_else(|| path.to_string())
    };
    ("xdg-open", vec![target])
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

    /// Writes `content` to a local Markdown file (RF-20). Rejects remote documents (RF-08A) —
    /// there's no local path to write to, and silently trying to write over a URL would be a
    /// bug, not a feature (see the Adversarial Architect Review in memory.md ADR-027).
    #[tauri::command]
    pub fn write_file(path: String, content: String) -> Result<(), String> {
        if is_remote(&path) {
            return Err(format!("No se puede guardar un documento remoto: {}", path));
        }
        fs::write(&path, content).map_err(|e| format!("Error al guardar '{}': {}", path, e))
    }

    /// Opens a native OS file picker dialog and returns the selected path
    #[tauri::command]
    pub async fn open_file_dialog(app: tauri::AppHandle) -> Option<String> {
        app.dialog()
            .file()
            .add_filter("Markdown", &MARKDOWN_EXTENSIONS)
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

    /// Lista un nivel de `path` para el árbol de directorios (RF-25), leído bajo demanda al
    /// expandir cada nodo en el frontend — nunca recursivo de golpe. Rechaza rutas que no
    /// sean una carpeta existente en vez de devolver un listado vacío silencioso.
    #[tauri::command]
    pub fn list_directory(path: String) -> Result<Vec<DirEntryInfo>, String> {
        let dir = PathBuf::from(&path);
        if !dir.is_dir() {
            return Err(format!("No es una carpeta: {}", path));
        }
        Ok(list_directory_entries(&dir))
    }

    /// "Revelar en el Explorador" (RF-25, menú contextual del árbol) — abre el gestor de
    /// archivos nativo del sistema con `path` resaltado (archivo) o abierto (carpeta). Sin
    /// plugin ni dependencia nueva: `std::process::Command` directo, sin invocar un shell
    /// intermedio (los argumentos van tal cual al proceso, sin riesgo de inyección).
    ///
    /// Desktop-only: Android no tiene un gestor de archivos del sistema accesible por Intent
    /// estándar con selección de archivo exacta — ver SPECIFICATIONS.md RF-25 en Android.
    #[cfg(desktop)]
    #[tauri::command]
    pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
        let is_dir = Path::new(&path).is_dir();
        let (program, args) = reveal_command(&path, is_dir);
        Command::new(program)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Error abriendo el explorador de archivos: {}", e))?;
        Ok(())
    }

    /// Punto de entrada del frontend para "abrir en ventana nueva" desde dentro de la app
    /// (RF-25 árbol + RF-26 Quick Open, ambos vía Ctrl/Cmd+clic) — la primera excepción
    /// consciente a que las aperturas internas sustituyan la ventana actual (ver la
    /// ampliación de RF-14 en `SPECIFICATIONS.md`). Envuelve `open_or_focus_document`, nunca
    /// `open_document_window` directo, para que un archivo ya abierto en otra ventana se
    /// enfoque en vez de duplicarse (mismo bug que se corrigió en la Fase 26).
    /// **Bug real encontrado por el usuario (ventana nueva en blanco/colgada al probar
    /// Ctrl+clic en el árbol, RF-25) y su causa exacta:** a diferencia del callback de
    /// instancia única o `RunEvent::Opened` (que llegan en una iteración *nueva* y ya
    /// asentada del bucle de eventos), este `#[tauri::command]` síncrono se despacha
    /// *ya sobre el hilo principal*, dentro de la misma pasada que atiende el propio
    /// mensaje IPC que lo invocó. Llamar a `run_on_main_thread` directamente desde ahí
    /// detecta "ya estoy en el hilo principal" y ejecuta el cierre de forma reentrante
    /// e inline — creando la `WebviewWindowBuilder` anidada dentro del propio despacho
    /// del mensaje que la originó, lo que cuelga `.build()` (necesita bombear mensajes
    /// para completar la inicialización asíncrona de WebView2, y no puede mientras el
    /// hilo sigue ocupado procesando el mensaje exterior). Confirmado con trazas: sin
    /// forzar un hilo distinto, `.build()` nunca retornaba; forzándolo, `run_on_main_thread`
    /// se invoca desde un hilo genuinamente distinto, forzando un envío real (no inline) que
    /// se procesa en una vuelta *posterior y ya libre* del bucle principal.
    /// `tauri::async_runtime::spawn` (no `std::thread::spawn`) logra ese "hilo distinto"
    /// reutilizando el pool de Tokio que Tauri ya tiene en marcha, sin crear/destruir un
    /// hilo de sistema operativo por cada `Ctrl+clic`.
    ///
    /// Desktop-only: el modelo de una sola Activity de Android no tiene equivalente a "ventana
    /// nueva" — ver SPECIFICATIONS.md RF-14/RF-25 en Android.
    #[cfg(desktop)]
    #[tauri::command]
    pub fn open_in_new_window(app: tauri::AppHandle, path: String) {
        tauri::async_runtime::spawn(async move {
            let app_handle = app.clone();
            let _ = app.run_on_main_thread(move || open_or_focus_document(&app_handle, path));
        });
    }
}

/// Barra de menú nativa de macOS. Se parte de la misma estructura que
/// `tauri::menu::Menu::default` (App/File/Edit/View/Window/Help), pero con
/// un "Abrir archivo…" real en File: el default de Tauri sólo trae Close
/// Window ahí, y un File "vacío" no es lo que un usuario de Mac espera.
#[cfg(target_os = "macos")]
mod macos_menu {
    use tauri::menu::{
        AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID,
        WINDOW_SUBMENU_ID,
    };
    use tauri::{AppHandle, Runtime};

    /// Los items predefinidos de macOS (Cortar/Copiar/Pegar…) los localiza el
    /// propio sistema según su idioma — nuestros items propios (Abrir
    /// archivo, Guardar…) no tienen esa magia gratis, así que replican el
    /// mismo criterio a mano para no acabar con un menú medio español medio
    /// inglés según el idioma del Mac. Nota: independiente del selector de
    /// idioma ES/EN de la propia app (ese vive sólo en el frontend/localStorage,
    /// no accesible todavía desde Rust en el momento en que se construye el
    /// menú, al arrancar antes de que cargue la webview).
    fn is_spanish_system() -> bool {
        sys_locale::get_locale()
            .map(|l| l.to_lowercase().starts_with("es"))
            .unwrap_or(false)
    }

    pub fn build<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
        let es = is_spanish_system();
        let pkg_info = handle.package_info();
        let config = handle.config();
        let about_metadata = AboutMetadata {
            name: Some(pkg_info.name.clone()),
            version: Some(pkg_info.version.to_string()),
            copyright: config.bundle.copyright.clone(),
            authors: config.bundle.publisher.clone().map(|p| vec![p]),
            ..Default::default()
        };

        let app_menu = Submenu::with_items(
            handle,
            pkg_info.name.clone(),
            true,
            &[
                &PredefinedMenuItem::about(handle, None, Some(about_metadata))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::services(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::hide(handle, None)?,
                &PredefinedMenuItem::hide_others(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::quit(handle, None)?,
            ],
        )?;

        let open_file_item = MenuItem::with_id(
            handle,
            "open_file",
            if es { "Abrir archivo…" } else { "Open File…" },
            true,
            Some("CmdOrCtrl+O"),
        )?;
        let save_item = MenuItem::with_id(
            handle,
            "save",
            if es { "Guardar" } else { "Save" },
            true,
            Some("CmdOrCtrl+S"),
        )?;
        let file_menu = Submenu::with_items(
            handle,
            "File",
            true,
            &[
                &open_file_item,
                &PredefinedMenuItem::separator(handle)?,
                &save_item,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::close_window(handle, None)?,
            ],
        )?;

        let edit_menu = Submenu::with_items(
            handle,
            "Edit",
            true,
            &[
                &PredefinedMenuItem::undo(handle, None)?,
                &PredefinedMenuItem::redo(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::cut(handle, None)?,
                &PredefinedMenuItem::copy(handle, None)?,
                &PredefinedMenuItem::paste(handle, None)?,
                &PredefinedMenuItem::select_all(handle, None)?,
            ],
        )?;

        let toggle_edit_mode_item = MenuItem::with_id(
            handle,
            "toggle_edit_mode",
            if es { "Alternar Modo Edición" } else { "Toggle Edit Mode" },
            true,
            Some("CmdOrCtrl+E"),
        )?;
        let view_menu = Submenu::with_items(
            handle,
            "View",
            true,
            &[
                &toggle_edit_mode_item,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::fullscreen(handle, None)?,
            ],
        )?;

        let window_menu = Submenu::with_id_and_items(
            handle,
            WINDOW_SUBMENU_ID,
            "Window",
            true,
            &[
                &PredefinedMenuItem::minimize(handle, None)?,
                &PredefinedMenuItem::maximize(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::close_window(handle, None)?,
            ],
        )?;

        let help_menu = Submenu::with_id_and_items(handle, HELP_SUBMENU_ID, "Help", true, &[])?;

        Menu::with_items(
            handle,
            &[
                &app_menu,
                &file_menu,
                &edit_menu,
                &view_menu,
                &window_menu,
                &help_menu,
            ],
        )
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `builder` se construye en dos tramos: el plugin de instancia única (RF-14) y el
    // manejador de eventos de menú (macOS) no existen en Android — el modelo de una sola
    // Activity ya garantiza instancia única, y no hay menú nativo que emitir eventos. No se
    // puede condicionar un `.plugin(...)`/`.on_menu_event(...)` a mitad de una cadena de
    // métodos con `#[cfg]` (los atributos de `cfg` no se aplican a fragmentos de expresión),
    // así que se reasigna `builder` dentro de bloques `#[cfg(desktop)]` en su lugar — mismo
    // patrón que usan los ejemplos oficiales de Tauri Mobile.
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // RF-13: sin tauri-plugin-updater en Android — Google Play gestiona las
        // actualizaciones (decisión de producto, ver SPECIFICATIONS.md), no relacionado con el
        // crash de rustls de más arriba (esa causa era el propio núcleo de `tauri`, no este
        // plugin).
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // RF-14: un doble clic / "Abrir con" en un .md mientras la app ya está en
            // marcha no debe lanzar un proceso dbv-md-reader.exe nuevo — abre una
            // ventana más en este mismo proceso (o, sin ruta, enfoca una existente).
            let app_handle = app.clone();
            let path = first_path_argument(argv);
            let _ = app_handle.clone().run_on_main_thread(move || match path {
                Some(path) => open_or_focus_document(&app_handle, path),
                None => {
                    let windows = app_handle.webview_windows();
                    if let Some(window) = main_or_first_window(&windows) {
                        focus_window(window);
                    }
                }
            });
        }));
    }

    #[cfg(target_os = "android")]
    {
        // Slice 1 (versión Android): capa mínima de Storage Access Framework (SAF) —
        // sin equivalente de escritorio, ver ADR-032 en memory.md y el crate en
        // src-tauri/plugins/tauri-plugin-saf/.
        builder = builder.plugin(tauri_plugin_saf::init());
    }

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|_app| {
            // macOS espera la barra de menú superior del SO (Cmd+Q, Cmd+H,
            // Editar con Cortar/Copiar/Pegar, etc.) — sin ella la app no se
            // siente nativa. Windows/Linux ya tienen su propia UI para esto
            // dentro de la ventana, así que se deja intacto.
            #[cfg(target_os = "macos")]
            {
                let menu = macos_menu::build(_app.handle())?;
                _app.handle().set_menu(menu)?;
            }
            Ok(())
        });

    #[cfg(desktop)]
    {
        builder = builder.on_menu_event(|app, event| {
            // "Abrir archivo…" del menú File (macOS) reusa el flujo que ya tiene
            // el frontend para el botón de la toolbar — sólo hace falta avisar
            // a la ventana enfocada, no reimplementar el diálogo en Rust.
            let event_name = match event.id().as_ref() {
                "open_file" => Some("menu-open-file"),
                "save" => Some("menu-save"),
                "toggle_edit_mode" => Some("menu-toggle-edit-mode"),
                _ => None,
            };
            if let Some(event_name) = event_name {
                let windows = app.webview_windows();
                let target = windows
                    .values()
                    .find(|w| w.is_focused().unwrap_or(false))
                    .or_else(|| main_or_first_window(&windows));
                if let Some(window) = target {
                    let _ = window.emit(event_name, ());
                }
            }
        });
    }

    builder
        .manage(WatcherState(Mutex::new(None)))
        .manage(OpenedFileState(Mutex::new(None)))
        .manage(OpenDocumentsState(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            commands::get_cli_argument,
            commands::get_app_version,
            commands::is_packaged_app,
            commands::read_file,
            commands::write_file,
            commands::open_file_dialog,
            commands::resolve_relative_path,
            commands::watch_file,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::clear_recent_files,
            commands::register_open_document,
            commands::list_directory,
            #[cfg(desktop)]
            commands::reveal_in_file_manager,
            #[cfg(desktop)]
            commands::open_in_new_window
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

            // Slice 3 (versión Android): "Abrir con" desde Gmail/Drive/un gestor de
            // archivos (ACTION_VIEW/SEND) llega igual que en macOS, vía RunEvent::Opened
            // — tao ya lo traduce así en Android (confirmado leyendo su código fuente
            // real, `tao::platform_impl::android::ndk_glue::handle_intent`), tanto en
            // frío (`create`) como con la Activity ya viva (`onNewIntent`, gracias a
            // `android:launchMode="singleTask"` en el manifiesto — nunca se lanza una
            // Activity nueva). A diferencia de macOS, la URL es `content://` (no
            // `file://`): no hay `opened_url_to_path` que valga, y no existe el
            // concepto de "ventana nueva" en Android (RF-14) — en caliente, sustituye
            // el documento actual en la única ventana vía un evento propio en vez de
            // `open_or_focus_document`.
            // `webview_windows().is_empty()` no distingue frío/caliente de forma fiable en
            // Android como sí hace en macOS (verificado en real: un cold start genuino con
            // esa comprobación se quedaba en el Estado Vacío, ni el evento ni
            // `OpenedFileState` llegaban a tiempo — la ventana ya está registrada en el mapa
            // de Tauri antes de que el frontend termine de cargar y registrar su listener,
            // a diferencia del orden "Opened -> Ready -> Window" documentado para macOS).
            // Fix: escribir SIEMPRE en ambos sitios, sin condicional — `get_cli_argument()`
            // solo se llama una vez al arrancar (recoge el caso frío) y el listener de
            // `android-intent-opened` solo existe una vez cargado el frontend (recoge el
            // caso caliente); cada lanzamiento real solo puede completar uno de los dos
            // caminos, así que no hay riesgo de abrir el documento dos veces.
            #[cfg(target_os = "android")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(uri) = urls.first().map(|u| u.to_string()) {
                    *_app_handle.state::<OpenedFileState>().0.lock().unwrap() = Some(uri.clone());
                    let _ = _app_handle.emit("android-intent-opened", uri);
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
            rf("content://com.android.externalstorage.documents/document/123", 4),
        ];

        let filtered = filter_existing(list);

        let paths: Vec<&str> = filtered.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&existing_str.as_str()), "existing local file must be kept");
        assert!(paths.contains(&"https://example.com/remote.md"), "remote entries are never filtered by disk existence");
        assert!(paths.contains(&"content://com.android.externalstorage.documents/document/123"), "saf content entries must be kept");
        assert_eq!(filtered.len(), 3, "the missing local file must be dropped");
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

    // ── write_file (RF-20) ─────────────────────────────────────────────────

    #[test]
    fn write_file_rejects_remote_path() {
        let result = commands::write_file("https://example.com/doc.md".to_string(), "# hi".to_string());
        assert!(result.is_err(), "writing to a remote URL must be rejected, not attempted");
    }

    #[test]
    fn write_file_writes_local_file() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("doc.md");
        let path_str = path.to_string_lossy().to_string();

        let result = commands::write_file(path_str, "# hello".to_string());

        assert!(result.is_ok(), "{:?}", result);
        assert_eq!(fs::read_to_string(&path).unwrap(), "# hello");
    }

    // ── list_directory_entries (RF-25) ─────────────────────────────────────

    #[test]
    fn list_directory_entries_sorts_folders_first_then_alphabetical() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp_file(tmp.path(), "zebra.md", "# z");
        write_temp_file(tmp.path(), "apple.png", "");
        fs::create_dir(tmp.path().join("Beta")).unwrap();
        fs::create_dir(tmp.path().join("alpha")).unwrap();

        let entries = list_directory_entries(tmp.path());

        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "Beta", "apple.png", "zebra.md"]);
    }

    #[test]
    fn list_directory_entries_flags_markdown_only_on_files() {
        let tmp = tempfile::tempdir().unwrap();
        write_temp_file(tmp.path(), "doc.md", "# hi");
        write_temp_file(tmp.path(), "notes.TXT", "hi");
        write_temp_file(tmp.path(), "image.png", "");
        fs::create_dir(tmp.path().join("docs")).unwrap();

        let entries = list_directory_entries(tmp.path());

        let is_markdown = |name: &str| entries.iter().find(|e| e.name == name).unwrap().is_markdown;
        assert!(is_markdown("doc.md"));
        assert!(is_markdown("notes.TXT"), "extension match must be case-insensitive");
        assert!(!is_markdown("image.png"));
        assert!(!is_markdown("docs"), "a directory is never is_markdown even if named like one");
    }

    #[test]
    fn list_directory_entries_on_missing_dir_returns_empty() {
        let missing = Path::new("C:\\definitely\\not\\a\\real\\path\\gone");
        assert_eq!(list_directory_entries(missing).len(), 0);
    }

    #[test]
    fn list_directory_rejects_a_file_path() {
        let tmp = tempfile::tempdir().unwrap();
        let file = write_temp_file(tmp.path(), "doc.md", "# hi");
        let result = commands::list_directory(file.to_string_lossy().to_string());
        assert!(result.is_err(), "a file path is not a directory to list");
    }

    // ── reveal_command (RF-25) — solo la rama de Windows es testable en este entorno ──

    #[cfg(windows)]
    #[test]
    fn reveal_command_selects_file_inside_parent() {
        let (program, args) = reveal_command("C:\\a\\b.md", false);
        assert_eq!(program, "explorer");
        assert_eq!(args, vec!["/select,C:\\a\\b.md".to_string()]);
    }

    #[cfg(windows)]
    #[test]
    fn reveal_command_opens_directory_directly() {
        let (program, args) = reveal_command("C:\\a\\b", true);
        assert_eq!(program, "explorer");
        assert_eq!(args, vec!["C:\\a\\b".to_string()]);
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
