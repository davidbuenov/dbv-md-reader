// =============================================================================
// dbv-md-reader — Imágenes pegadas o soltadas: guardarlas junto al documento (RF-37)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Pegar un recorte de pantalla o soltar un fichero de imagen lo guarda en `images/` junto al
// documento abierto (o en la carpeta que el usuario elija si el documento es remoto o no hay
// ninguno). Es el mismo diseño que `dbv-typst-editor` (`assets.rs`, RF-39 y RF-18).
//
// El frontend decide QUÉ guardar y DÓNDE, pero la escritura la comprueba aquí: el nombre se
// sanea a su último componente y a `[A-Za-z0-9._-]` (así el código `![](images/x.png)` nunca
// necesita `<…>` ni `%20`), la extensión está en una lista blanca, hay un tope de tamaño y
// nunca se sobrescribe nada que ya existiera. `images` no se sigue si es un enlace simbólico ni
// si es un fichero: en ese caso falla y el frontend ofrece «Guardar como».
//
// @spec RF-37

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Formatos que el visor sabe pintar y que son portables (no `bmp`: pesa mucho y Windows lo pone
/// en el portapapeles con frecuencia).
pub const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "svg", "webp"];

/// Tope de una imagen: un recorte de pantalla ronda 1 MB; esto es solo una guarda.
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

const IMAGES_DIR: &str = "images";

/// Nombres que Windows no deja usar como fichero (con o sin extensión).
const RESERVED_NAMES: [&str; 22] = [
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2",
    "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

/// Lo que ve el frontend de una imagen guardada.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedImage {
    /// Ruta absoluta del fichero.
    pub path: String,
    /// Ruta para el código Markdown: `images/nombre.png` (con `/` también en Windows) o solo el
    /// nombre si se guardó en una carpeta elegida a mano.
    pub relative: String,
    /// `true` si ya había una imagen idéntica y se reutilizó en vez de duplicarla.
    pub reused: bool,
}

/// Letra sin acento para los caracteres latinos más comunes; `None` si no tiene equivalente.
fn fold_letter(c: char) -> Option<char> {
    match c {
        'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' => Some('a'),
        'é' | 'è' | 'ê' | 'ë' => Some('e'),
        'í' | 'ì' | 'î' | 'ï' => Some('i'),
        'ó' | 'ò' | 'ô' | 'ö' | 'õ' => Some('o'),
        'ú' | 'ù' | 'û' | 'ü' => Some('u'),
        'ñ' => Some('n'),
        'ç' => Some('c'),
        _ => None,
    }
}

/// Nombre de fichero seguro, o `None` si la extensión no es de una imagen admitida.
///
/// Se queda con el último componente (`a/b\..\c.png` → `c.png`), pasa la extensión a minúsculas,
/// deja `[A-Za-z0-9_-]` y transcribe los acentos; lo demás (espacios, `<>()[]%#`…) pasa a `-`.
pub(crate) fn sanitize_file_name(name: &str) -> Option<String> {
    let last = name.rsplit(['/', '\\']).next().unwrap_or("");
    let (stem, extension) = last.rsplit_once('.')?;
    let extension = extension.to_ascii_lowercase();
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return None;
    }

    let mut clean = String::new();
    for c in stem.chars().flat_map(char::to_lowercase) {
        let folded = fold_letter(c).unwrap_or(c);
        let keep = folded.is_ascii_alphanumeric() || folded == '_' || folded == '-';
        let next = if keep { folded } else { '-' };
        if next == '-' && clean.ends_with('-') {
            continue;
        }
        clean.push(next);
    }
    let mut stem: String = clean.trim_matches('-').chars().take(80).collect();
    if stem.is_empty() {
        stem = "imagen".to_string();
    }
    if RESERVED_NAMES.contains(&stem.as_str()) {
        stem.push_str("-img");
    }
    Some(format!("{stem}.{extension}"))
}

/// Nombre libre dentro de `dir`: si `file_name` existe, `nombre-1.ext`, `nombre-2.ext`…
pub(crate) fn unique_destination(dir: &Path, file_name: &str) -> PathBuf {
    let stem = Path::new(file_name).file_stem().and_then(|s| s.to_str()).unwrap_or("imagen");
    let extension = Path::new(file_name).extension().and_then(|s| s.to_str()).unwrap_or("png");
    let mut candidate = dir.join(file_name);
    let mut attempt = 0;
    while candidate.exists() {
        attempt += 1;
        candidate = dir.join(format!("{stem}-{attempt}.{extension}"));
    }
    candidate
}

/// Un fichero de `dir` con exactamente estos bytes (aunque tenga otro nombre): pegar dos veces el
/// mismo recorte no debe dejar dos copias. Compara primero el tamaño, que es barato.
pub(crate) fn find_existing_copy(dir: &Path, bytes: &[u8]) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    entries
        .flatten()
        .filter(|entry| entry.metadata().is_ok_and(|m| m.is_file() && m.len() == bytes.len() as u64))
        .map(|entry| entry.path())
        .find(|path| fs::read(path).ok().as_deref() == Some(bytes))
}

/// La carpeta donde se escribe: `base_dir` tal cual, o su subcarpeta `images/` (que se crea si no
/// existe). Falla si `images` es un enlace simbólico (podría llevar fuera) o un fichero.
fn prepare_dir(base_dir: &str, into_images: bool) -> Result<PathBuf, String> {
    let base = PathBuf::from(base_dir);
    if !base.is_dir() {
        return Err(format!("la carpeta «{base_dir}» no existe"));
    }
    if !into_images {
        return Ok(base);
    }
    let images = base.join(IMAGES_DIR);
    match fs::symlink_metadata(&images) {
        Ok(meta) if meta.file_type().is_symlink() => Err("«images» es un enlace simbólico".to_string()),
        Ok(meta) if !meta.is_dir() => Err("«images» existe y no es una carpeta".to_string()),
        Ok(_) => Ok(images),
        Err(_) => fs::create_dir_all(&images)
            .map(|()| images.clone())
            .map_err(|e| format!("no se pudo crear la carpeta «images»: {e}")),
    }
}

/// Guarda `bytes` en `dir` con un nombre libre y devuelve (ruta, ¿reutilizada?).
fn store_bytes(dir: &Path, file_name: &str, bytes: &[u8]) -> Result<(PathBuf, bool), String> {
    if bytes.is_empty() {
        return Err("la imagen está vacía".to_string());
    }
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(format!("la imagen pesa más de {} MB", MAX_IMAGE_BYTES / 1024 / 1024));
    }
    let name = sanitize_file_name(file_name).ok_or_else(|| format!("formato de imagen no admitido: «{file_name}»"))?;
    if let Some(existing) = find_existing_copy(dir, bytes) {
        return Ok((existing, true));
    }
    let destination = unique_destination(dir, &name);
    // `create_new`: nunca pisa un fichero que aparezca entre la comprobación y la escritura.
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)
        .map_err(|e| format!("no se pudo escribir «{name}»: {e}"))?;
    file.write_all(bytes).map_err(|e| format!("no se pudo escribir «{name}»: {e}"))?;
    Ok((destination, false))
}

/// Resultado para el frontend a partir de lo guardado.
fn saved(destination: &Path, reused: bool, into_images: bool) -> SavedImage {
    let name = destination.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let relative = if into_images { format!("{IMAGES_DIR}/{name}") } else { name };
    SavedImage { path: destination.to_string_lossy().into_owned(), relative, reused }
}

/// Bytes de un fichero de origen (imagen soltada), con las mismas guardas de formato y tamaño.
fn read_source(source_path: &str) -> Result<(Vec<u8>, String), String> {
    let source = Path::new(source_path);
    let metadata = fs::metadata(source).map_err(|e| format!("no se pudo leer «{source_path}»: {e}"))?;
    if !metadata.is_file() {
        return Err(format!("«{source_path}» no es un fichero"));
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(format!("la imagen pesa más de {} MB", MAX_IMAGE_BYTES / 1024 / 1024));
    }
    let name = source.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    if sanitize_file_name(&name).is_none() {
        return Err(format!("formato de imagen no admitido: «{name}»"));
    }
    let bytes = fs::read(source).map_err(|e| format!("no se pudo leer «{name}»: {e}"))?;
    Ok((bytes, name))
}

fn decode(base64_data: &str) -> Result<Vec<u8>, String> {
    BASE64.decode(base64_data.as_bytes()).map_err(|e| format!("datos de imagen no válidos: {e}"))
}

/// Escribe en un destino elegido por el usuario en el cuadro «Guardar como» (ya confirmó la
/// sobrescritura, si la hay): solo se exige que sea una imagen admitida.
fn write_chosen(dest_path: &str, bytes: &[u8]) -> Result<SavedImage, String> {
    let destination = Path::new(dest_path);
    let name = destination.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let extension = destination.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("formato de imagen no admitido: «{name}»"));
    }
    if bytes.is_empty() || bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err("la imagen está vacía o es demasiado grande".to_string());
    }
    fs::write(destination, bytes).map_err(|e| format!("no se pudo escribir «{name}»: {e}"))?;
    Ok(SavedImage { path: dest_path.to_string(), relative: name, reused: false })
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

/// Guarda una imagen pegada (bytes en base64: por el IPC un `Vec<u8>` viajaría como JSON y
/// multiplicaría por tres o cuatro lo que cruza el puente).
///
/// @spec RF-37
#[tauri::command]
pub fn save_image(base_dir: String, into_images: bool, file_name: String, base64_data: String) -> Result<SavedImage, String> {
    let bytes = decode(&base64_data)?;
    let dir = prepare_dir(&base_dir, into_images)?;
    let (destination, reused) = store_bytes(&dir, &file_name, &bytes)?;
    Ok(saved(&destination, reused, into_images))
}

/// Copia una imagen soltada desde el explorador del sistema.
///
/// @spec RF-37
#[tauri::command]
pub fn copy_image(base_dir: String, into_images: bool, source_path: String) -> Result<SavedImage, String> {
    let (bytes, name) = read_source(&source_path)?;
    let dir = prepare_dir(&base_dir, into_images)?;
    let (destination, reused) = store_bytes(&dir, &name, &bytes)?;
    Ok(saved(&destination, reused, into_images))
}

/// Guarda una imagen pegada en la ruta que el usuario eligió en «Guardar como».
///
/// @spec RF-37
#[tauri::command]
pub fn save_image_as(dest_path: String, base64_data: String) -> Result<SavedImage, String> {
    write_chosen(&dest_path, &decode(&base64_data)?)
}

/// Copia una imagen soltada a la ruta elegida en «Guardar como».
///
/// @spec RF-37
#[tauri::command]
pub fn copy_image_as(dest_path: String, source_path: String) -> Result<SavedImage, String> {
    let (bytes, _) = read_source(&source_path)?;
    write_chosen(&dest_path, &bytes)
}

/// Cuadro nativo para elegir la carpeta donde guardar (documento remoto o sin documento).
///
/// @spec RF-37
#[tauri::command]
pub async fn pick_folder_dialog(app: AppHandle, title: String, default_dirs: Option<Vec<String>>) -> Option<String> {
    let mut dialog = app.dialog().file().set_title(title);
    if let Some(dir) = crate::dialog_start_dir(&app, &default_dirs) {
        dialog = dialog.set_directory(dir);
    }
    dialog.blocking_pick_folder().map(|p| p.to_string())
}

/// Cuadro nativo «Guardar como» para una imagen (cuando no se pudo guardar junto al documento).
///
/// @spec RF-37
#[tauri::command]
pub async fn save_image_dialog(app: AppHandle, default_name: String, title: String, default_dirs: Option<Vec<String>>) -> Option<String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Imagen", &IMAGE_EXTENSIONS)
        .set_title(title)
        .set_file_name(default_name);
    if let Some(dir) = crate::dialog_start_dir(&app, &default_dirs) {
        dialog = dialog.set_directory(dir);
    }
    dialog.blocking_save_file().map(|p| p.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

    fn b64(bytes: &[u8]) -> String {
        BASE64.encode(bytes)
    }

    #[test]
    fn sanitize_deja_solo_un_nombre_seguro() {
        assert_eq!(sanitize_file_name("Captura de pantalla (1).PNG").as_deref(), Some("captura-de-pantalla-1.png"));
        assert_eq!(sanitize_file_name("Ñandú árbol.jpg").as_deref(), Some("nandu-arbol.jpg"));
        assert_eq!(sanitize_file_name("a/b\\..\\c.png").as_deref(), Some("c.png"));
        assert_eq!(sanitize_file_name("../../etc/passwd.png").as_deref(), Some("passwd.png"));
        assert_eq!(sanitize_file_name("%20<x>#?.webp").as_deref(), Some("20-x.webp"));
        assert_eq!(sanitize_file_name("???.gif").as_deref(), Some("imagen.gif"));
    }

    #[test]
    fn sanitize_rechaza_lo_que_no_es_una_imagen_admitida() {
        assert_eq!(sanitize_file_name("nota.md"), None);
        assert_eq!(sanitize_file_name("foto.bmp"), None);
        assert_eq!(sanitize_file_name("foto.png.exe"), None);
        assert_eq!(sanitize_file_name("sin-extension"), None);
    }

    #[test]
    fn sanitize_evita_los_nombres_reservados_de_windows() {
        assert_eq!(sanitize_file_name("CON.png").as_deref(), Some("con-img.png"));
        assert_eq!(sanitize_file_name("com1.jpg").as_deref(), Some("com1-img.jpg"));
    }

    #[test]
    fn guarda_en_images_y_la_crea_si_falta() {
        let dir = tempfile::tempdir().unwrap();
        let saved = save_image(dir.path().to_string_lossy().into_owned(), true, "captura-20261018-221500.png".into(), b64(&PNG)).unwrap();
        assert_eq!(saved.relative, "images/captura-20261018-221500.png");
        assert!(!saved.reused);
        assert_eq!(fs::read(dir.path().join("images").join("captura-20261018-221500.png")).unwrap(), PNG);
    }

    #[test]
    fn guarda_directamente_en_la_carpeta_elegida() {
        let dir = tempfile::tempdir().unwrap();
        let saved = save_image(dir.path().to_string_lossy().into_owned(), false, "foto.png".into(), b64(&PNG)).unwrap();
        assert_eq!(saved.relative, "foto.png");
        assert!(dir.path().join("foto.png").is_file());
        assert!(!dir.path().join("images").exists());
    }

    #[test]
    fn pegar_dos_veces_lo_mismo_reutiliza_el_fichero() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_string_lossy().into_owned();
        let first = save_image(base.clone(), true, "a.png".into(), b64(&PNG)).unwrap();
        let second = save_image(base, true, "otra.png".into(), b64(&PNG)).unwrap();
        assert!(second.reused);
        assert_eq!(first.path, second.path);
        assert_eq!(fs::read_dir(dir.path().join("images")).unwrap().count(), 1);
    }

    #[test]
    fn dos_imagenes_distintas_con_el_mismo_nombre_se_numeran_sin_pisarse() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_string_lossy().into_owned();
        save_image(base.clone(), true, "a.png".into(), b64(&[1, 2, 3])).unwrap();
        let second = save_image(base, true, "a.png".into(), b64(&[4, 5, 6])).unwrap();
        assert_eq!(second.relative, "images/a-1.png");
        assert_eq!(fs::read(dir.path().join("images").join("a.png")).unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn rechaza_vacio_extension_ajena_y_base64_roto() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_string_lossy().into_owned();
        assert!(save_image(base.clone(), true, "a.png".into(), String::new()).is_err());
        assert!(save_image(base.clone(), true, "a.exe".into(), b64(&PNG)).is_err());
        assert!(save_image(base.clone(), true, "a.png".into(), "%%%no es base64%%%".into()).is_err());
        assert!(!dir.path().join("images").join("a.exe").exists());
    }

    #[test]
    fn un_nombre_con_ruta_no_sale_de_la_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let saved = save_image(dir.path().to_string_lossy().into_owned(), true, "../../fuera.png".into(), b64(&PNG)).unwrap();
        assert_eq!(saved.relative, "images/fuera.png");
        assert!(!dir.path().parent().unwrap().join("fuera.png").exists());
    }

    #[test]
    fn images_siendo_un_fichero_falla_para_que_el_frontend_ofrezca_guardar_como() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("images"), "soy un fichero").unwrap();
        let error = save_image(dir.path().to_string_lossy().into_owned(), true, "a.png".into(), b64(&PNG)).unwrap_err();
        assert!(error.contains("images"), "{error}");
    }

    #[test]
    fn una_carpeta_que_no_existe_falla() {
        assert!(save_image("Z:/no/existe/nunca".into(), true, "a.png".into(), b64(&PNG)).is_err());
    }

    #[test]
    fn copia_una_imagen_soltada_con_el_nombre_saneado() {
        let project = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let source = outside.path().join("Mi foto 1.JPG");
        fs::write(&source, [1, 2, 3, 4]).unwrap();
        let saved = copy_image(project.path().to_string_lossy().into_owned(), true, source.to_string_lossy().into_owned()).unwrap();
        assert_eq!(saved.relative, "images/mi-foto-1.jpg");
        assert_eq!(fs::read(project.path().join("images").join("mi-foto-1.jpg")).unwrap(), vec![1, 2, 3, 4]);
    }

    #[test]
    fn no_copia_un_fichero_que_no_es_imagen() {
        let project = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let source = outside.path().join("secreto.txt");
        fs::write(&source, "x").unwrap();
        assert!(copy_image(project.path().to_string_lossy().into_owned(), true, source.to_string_lossy().into_owned()).is_err());
    }

    #[test]
    fn guardar_como_escribe_donde_el_usuario_dijo_y_solo_imagenes() {
        let dir = tempfile::tempdir().unwrap();
        let ok = dir.path().join("elegida.png");
        let saved = save_image_as(ok.to_string_lossy().into_owned(), b64(&PNG)).unwrap();
        assert_eq!(saved.relative, "elegida.png");
        assert_eq!(fs::read(&ok).unwrap(), PNG);
        assert!(save_image_as(dir.path().join("malo.exe").to_string_lossy().into_owned(), b64(&PNG)).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn un_images_que_es_un_enlace_simbolico_no_se_sigue() {
        let dir = tempfile::tempdir().unwrap();
        let elsewhere = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(elsewhere.path(), dir.path().join("images")).unwrap();
        assert!(save_image(dir.path().to_string_lossy().into_owned(), true, "a.png".into(), b64(&PNG)).is_err());
        assert_eq!(fs::read_dir(elsewhere.path()).unwrap().count(), 0);
    }
}
