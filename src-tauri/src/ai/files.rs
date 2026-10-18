// =============================================================================
// dbv-md-reader — IA integrada: ficheros confinados a la carpeta del documento
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Todo lo que la IA lee, busca o escribe pasa por aquí, y TODO pasa por
// `resolve_inside` (RNF-IA.3). El frontend decide qué ruta pedir y puede estar
// influido por un documento de un tercero (inyección indirecta), así que la
// comprobación vive en Rust y no confía en el texto de la ruta: se normaliza, se
// rechazan `..`, rutas absolutas y `.git`, y además se canonicaliza el resultado
// para que un enlace simbólico dentro de la carpeta no pueda llevar fuera de ella.
//
// Solo ficheros de texto que la app abre (`.md`, `.markdown`, `.txt`).
//
// @spec RNF-IA.3

use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use super::AiError;

/// Extensiones de los documentos con los que trabaja la IA (las mismas que abre la app).
pub const TEXT_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
/// Tope de lectura de un fichero.
pub const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;
/// Niveles de carpeta que se recorren como máximo al listar o buscar.
pub const MAX_DEPTH: usize = 8;
/// Ficheros que se listan como mucho.
pub const MAX_LISTED: usize = 2000;
/// Coincidencias que devuelve una búsqueda como mucho.
pub const MAX_HITS: usize = 200;
/// Entradas del disco que se miran como mucho al recorrer.
const MAX_VISITED: usize = 50_000;

/// ¿Es un documento de texto de los que maneja la IA?
pub fn is_text_document(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| TEXT_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Carpetas que no se recorren: ocultas (`.git`, `.obsidian`…) y de dependencias.
pub fn is_skipped_dir(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "node_modules" | "target" | "dist" | "build")
}

/// Normaliza una ruta relativa del frontend: barras `/`, sin vacíos ni `.`.
/// Rechaza lo que se sale de la carpeta: absolutas, `..`, unidades de Windows y `.git`.
pub fn clean_relative(relative: &str) -> Result<String, AiError> {
    let normalized = relative.replace('\\', "/");
    if normalized.trim().is_empty() {
        return Err(AiError::Outside("ruta vacía".into()));
    }
    if normalized.starts_with('/') || normalized.starts_with("//") || normalized.contains(':') || normalized.contains('\0') {
        return Err(AiError::Outside(format!("«{relative}» no es una ruta relativa a la carpeta del documento")));
    }
    let mut parts: Vec<&str> = Vec::new();
    for part in normalized.split('/') {
        match part {
            "" | "." => {}
            ".." => return Err(AiError::Outside(format!("«{relative}» sale de la carpeta del documento"))),
            _ if part.eq_ignore_ascii_case(".git") => return Err(AiError::Outside(format!("«{relative}» apunta a .git"))),
            _ => parts.push(part),
        }
    }
    if parts.is_empty() {
        return Err(AiError::Outside("ruta vacía".into()));
    }
    Ok(parts.join("/"))
}

/// Ruta absoluta de `relative` dentro de `root`, garantizando que cuelga de ella
/// aunque haya enlaces simbólicos. El fichero puede no existir todavía (una
/// propuesta que lo crea): entonces se comprueba su carpeta existente más cercana.
pub fn resolve_inside(root: &str, relative: &str) -> Result<PathBuf, AiError> {
    let relative = clean_relative(relative)?;
    let root_canonical = Path::new(root).canonicalize().map_err(|e| AiError::Config(format!("la carpeta del documento no es accesible: {e}")))?;
    // Se añade pieza a pieza (no con `join("a/b")`): una ruta canónica de Windows (`\?\C:\…`)
    // no normaliza las barras `/`.
    let mut target = root_canonical.clone();
    for part in relative.split('/') {
        target.push(part);
    }

    // El ancestro existente más cercano es el que puede ser (o contener) un enlace simbólico.
    let mut existing = target.as_path();
    while !existing.exists() {
        match existing.parent() {
            Some(parent) => existing = parent,
            None => return Err(AiError::Outside(format!("«{relative}» no cuelga de la carpeta del documento"))),
        }
    }
    let resolved = existing.canonicalize().map_err(|e| AiError::Config(e.to_string()))?;
    if !resolved.starts_with(&root_canonical) {
        return Err(AiError::Outside(format!("«{relative}» sale de la carpeta del documento")));
    }
    // El propio componente final, si existe y es un enlace, también debe quedarse dentro.
    if target.exists() {
        let full = target.canonicalize().map_err(|e| AiError::Config(e.to_string()))?;
        if !full.starts_with(&root_canonical) {
            return Err(AiError::Outside(format!("«{relative}» sale de la carpeta del documento")));
        }
    }
    // Y nunca un componente que no sea normal (por si `join` dejó algo raro).
    if target.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(AiError::Outside(format!("«{relative}» sale de la carpeta del documento")));
    }
    Ok(target)
}

/// Los documentos de texto de `root`, como rutas relativas con `/`, ordenadas.
pub fn list_documents(root: &Path) -> Vec<String> {
    let mut found = Vec::new();
    let walker = walkdir::WalkDir::new(root)
        .max_depth(MAX_DEPTH)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || !(entry.file_type().is_dir() && is_skipped_dir(&entry.file_name().to_string_lossy())));
    for (visited, entry) in walker.flatten().enumerate() {
        if visited >= MAX_VISITED || found.len() >= MAX_LISTED {
            break;
        }
        if entry.file_type().is_file() && is_text_document(entry.path()) && !entry.file_name().to_string_lossy().starts_with('.') {
            if let Ok(relative) = entry.path().strip_prefix(root) {
                found.push(relative.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    found.sort();
    found
}

fn read_limited(path: &Path) -> Result<String, AiError> {
    let meta = std::fs::metadata(path).map_err(|e| AiError::NotFound(e.to_string()))?;
    if !meta.is_file() {
        return Err(AiError::NotFound("no es un fichero".into()));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(AiError::BadRequest(format!("el fichero supera {} MB", MAX_READ_BYTES / 1024 / 1024)));
    }
    let bytes = std::fs::read(path).map_err(|e| AiError::NotFound(e.to_string()))?;
    // Un NUL en los primeros bytes delata un binario aunque, por casualidad, fuera UTF-8 válido.
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err(AiError::BadRequest("parece un fichero binario".into()));
    }
    String::from_utf8(bytes).map_err(|_| AiError::BadRequest("no es texto UTF-8".into()))
}

/// Una coincidencia de la búsqueda.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Hit {
    pub relative: String,
    /// Línea, base 1.
    pub line: usize,
    pub text: String,
}

/// Busca `query` (sin distinguir mayúsculas) en los documentos de `root`.
pub fn search_documents(root: &Path, query: &str) -> Vec<Hit> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Vec::new();
    }
    let mut hits = Vec::new();
    for relative in list_documents(root) {
        let Ok(text) = read_limited(&root.join(&relative)) else { continue };
        for (index, line) in text.lines().enumerate() {
            if line.to_lowercase().contains(&needle) {
                hits.push(Hit { relative: relative.clone(), line: index + 1, text: line.trim().chars().take(240).collect() });
                if hits.len() >= MAX_HITS {
                    return hits;
                }
            }
        }
    }
    hits
}

/// Un error de disco que dice QUÉ se intentó y sobre qué fichero (el `os error 5` a secas no ayuda a nadie).
fn io_error(action: &str, path: &Path, error: &std::io::Error) -> AiError {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| path.display().to_string());
    AiError::Config(format!("no se pudo {action} «{name}»: {error}"))
}

/// Escribe `content` en `path` de forma atómica (fichero temporal + renombrado),
/// creando las carpetas que falten. En Windows el renombrado falla («acceso denegado») si
/// otro programa tiene el destino abierto sin permitir borrarlo (un editor, un antivirus, un
/// agente): entonces se escribe directamente sobre el fichero, que sí suele permitirse.
fn write_atomic(path: &Path, content: &str) -> Result<(), AiError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| io_error("crear la carpeta de", path, &e))?;
    }
    let temp = path.with_extension("dbv-ai.tmp");
    std::fs::write(&temp, content).map_err(|e| io_error("escribir", &temp, &e))?;
    match std::fs::rename(&temp, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            let _ = std::fs::remove_file(&temp);
            std::fs::write(path, content).map_err(|e| io_error("escribir", path, &e))
        }
    }
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

/// Documentos de texto de la carpeta del documento (RF-35.1).
#[tauri::command]
pub async fn ai_list_files(root: String) -> Result<Vec<String>, AiError> {
    let root = Path::new(&root).canonicalize().map_err(|e| AiError::Config(e.to_string()))?;
    tauri::async_runtime::spawn_blocking(move || list_documents(&root)).await.map_err(|e| AiError::Server(e.to_string()))
}

/// Lee un documento de la carpeta (RF-35.1). El contenido sin guardar del editor lo aporta el frontend.
#[tauri::command]
pub async fn ai_read_file(root: String, relative: String) -> Result<String, AiError> {
    let path = resolve_inside(&root, &relative)?;
    if !is_text_document(&path) {
        return Err(AiError::BadRequest(format!("«{relative}» no es un documento de texto (.md, .markdown, .txt)")));
    }
    tauri::async_runtime::spawn_blocking(move || read_limited(&path)).await.map_err(|e| AiError::Server(e.to_string()))?
}

/// Busca en los documentos de la carpeta (RF-35.1).
#[tauri::command]
pub async fn ai_search_files(root: String, query: String) -> Result<Vec<Hit>, AiError> {
    let root = Path::new(&root).canonicalize().map_err(|e| AiError::Config(e.to_string()))?;
    tauri::async_runtime::spawn_blocking(move || search_documents(&root, &query)).await.map_err(|e| AiError::Server(e.to_string()))
}

/// Escribe un documento de la carpeta TRAS la revisión del usuario (RF-34.4). Nunca el abierto en el editor.
#[tauri::command]
pub async fn ai_write_file(root: String, relative: String, content: String) -> Result<(), AiError> {
    let path = resolve_inside(&root, &relative)?;
    if !is_text_document(&path) {
        return Err(AiError::BadRequest(format!("«{relative}» no es un documento de texto (.md, .markdown, .txt)")));
    }
    tauri::async_runtime::spawn_blocking(move || write_atomic(&path, &content)).await.map_err(|e| AiError::Server(e.to_string()))?
}

/// Deshace la creación de un fichero propuesto por la IA: solo lo borra si sigue
/// exactamente como lo dejó la aplicación (si el usuario lo tocó, no se pierde su trabajo).
#[tauri::command]
pub async fn ai_delete_created(root: String, relative: String, expected: String) -> Result<bool, AiError> {
    let path = resolve_inside(&root, &relative)?;
    if !is_text_document(&path) {
        return Err(AiError::BadRequest(format!("«{relative}» no es un documento de texto")));
    }
    tauri::async_runtime::spawn_blocking(move || match read_limited(&path) {
        Ok(current) if current == expected => std::fs::remove_file(&path).map(|_| true).map_err(|e| io_error("borrar", &path, &e)),
        _ => Ok(false),
    })
    .await
    .map_err(|e| AiError::Server(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_error_names_the_file() {
        let dir = tempfile::tempdir().unwrap();
        // Un directorio donde debería ir el fichero: no se puede escribir encima.
        std::fs::create_dir_all(dir.path().join("nota.md")).unwrap();
        let error = write_atomic(&dir.path().join("nota.md"), "x").unwrap_err();
        assert!(error.to_string().contains("nota.md"), "{error}");
    }

    #[test]
    fn write_atomic_replaces_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.md");
        std::fs::write(&path, "viejo").unwrap();
        write_atomic(&path, "nuevo").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "nuevo");
        assert!(!dir.path().join("a.dbv-ai.tmp").exists());
    }

    fn sample() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("uno.md"), "# Uno\n\nHola mundo\n").unwrap();
        std::fs::create_dir_all(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub").join("dos.md"), "# Dos\nOtro HOLA\n").unwrap();
        std::fs::write(dir.path().join("foto.png"), [0u8, 1, 2]).unwrap();
        std::fs::create_dir_all(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git").join("config.md"), "secreto").unwrap();
        std::fs::create_dir_all(dir.path().join("node_modules")).unwrap();
        std::fs::write(dir.path().join("node_modules").join("x.md"), "dep").unwrap();
        dir
    }

    #[test]
    fn rechaza_las_rutas_que_se_salen_de_la_carpeta() {
        let dir = sample();
        let root = dir.path().to_str().unwrap();
        for bad in ["../fuera.md", "sub/../../fuera.md", "/etc/passwd", "C:/Windows/x.md", "C:\\x.md", "\\\\server\\share\\x.md", "..", ".git/config.md", "sub/.GIT/x.md", "", "   ", "./", "a\0b.md"] {
            assert!(matches!(resolve_inside(root, bad), Err(AiError::Outside(_))), "debía rechazar {bad:?}");
        }
    }

    #[test]
    fn acepta_rutas_normales_aunque_traigan_barras_de_windows_o_puntos() {
        let dir = sample();
        let root = dir.path().to_str().unwrap();
        let a = resolve_inside(root, "sub/dos.md").unwrap();
        let b = resolve_inside(root, "sub\\dos.md").unwrap();
        let c = resolve_inside(root, "./sub/./dos.md").unwrap();
        assert_eq!(a, b);
        assert_eq!(a, c);
        assert!(a.exists());
        // Un fichero nuevo, en una carpeta que aún no existe, también se acepta.
        assert!(resolve_inside(root, "nueva/carpeta/tres.md").is_ok());
    }

    #[test]
    fn un_enlace_simbolico_que_escapa_se_rechaza() {
        let dir = sample();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("secreto.md"), "no debe verse").unwrap();
        let link = dir.path().join("atajo");
        #[cfg(unix)]
        let linked = std::os::unix::fs::symlink(outside.path(), &link).is_ok();
        #[cfg(windows)]
        let linked = std::os::windows::fs::symlink_dir(outside.path(), &link).is_ok();
        if !linked {
            // Windows sin permiso para crear enlaces simbólicos: no se puede ejercitar aquí.
            eprintln!("(sin permiso para crear enlaces simbólicos: se omite la comprobación)");
            return;
        }
        let root = dir.path().to_str().unwrap();
        assert!(matches!(resolve_inside(root, "atajo/secreto.md"), Err(AiError::Outside(_))));
        assert!(matches!(resolve_inside(root, "atajo/nuevo.md"), Err(AiError::Outside(_))));
    }

    #[test]
    fn lista_solo_documentos_de_texto_sin_carpetas_ocultas_ni_dependencias() {
        let dir = sample();
        assert_eq!(list_documents(&dir.path().canonicalize().unwrap()), vec!["sub/dos.md".to_string(), "uno.md".to_string()]);
    }

    #[test]
    fn la_busqueda_no_distingue_mayusculas_y_da_la_linea() {
        let dir = sample();
        let hits = search_documents(&dir.path().canonicalize().unwrap(), "hola");
        assert_eq!(hits.len(), 2);
        assert!(hits.iter().any(|h| h.relative == "uno.md" && h.line == 3));
        assert!(hits.iter().any(|h| h.relative == "sub/dos.md" && h.line == 2));
        assert!(search_documents(dir.path(), "  ").is_empty());
    }

    #[test]
    fn escribe_de_forma_atomica_y_crea_las_carpetas() {
        let dir = sample();
        let root = dir.path().to_str().unwrap();
        let path = resolve_inside(root, "nueva/tres.md").unwrap();
        write_atomic(&path, "# Tres\n").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "# Tres\n");
        assert!(!path.with_extension("dbv-ai.tmp").exists(), "no queda el temporal");
    }

    #[test]
    fn un_binario_o_un_fichero_enorme_no_se_leen() {
        let dir = sample();
        assert!(read_limited(&dir.path().join("foto.png")).is_err(), "con NUL: binario");
        let invalid = dir.path().join("latin1.md");
        std::fs::write(&invalid, [b'a', 0xff, 0xfe, b'b']).unwrap();
        assert!(read_limited(&invalid).is_err(), "UTF-8 inválido");
        let big = dir.path().join("grande.md");
        std::fs::write(&big, vec![b'a'; (MAX_READ_BYTES + 1) as usize]).unwrap();
        assert!(matches!(read_limited(&big), Err(AiError::BadRequest(_))));
    }

    #[test]
    fn solo_son_documentos_los_md_markdown_y_txt() {
        assert!(is_text_document(Path::new("a.MD")));
        assert!(is_text_document(Path::new("a.markdown")));
        assert!(is_text_document(Path::new("a.txt")));
        assert!(!is_text_document(Path::new("a.rs")));
        assert!(!is_text_document(Path::new("a")));
    }
}
