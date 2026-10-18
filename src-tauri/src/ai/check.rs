// =============================================================================
// dbv-md-reader — IA integrada: comprobación en memoria de una propuesta
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Antes de enseñar una propuesta de la IA se comprueba en memoria, sin tocar el
// disco (RF-34.3). Markdown no tiene compilador, así que se vigila lo que de
// verdad rompe el render o el documento:
//
//   · error:   la ruta sale de la carpeta o no es un documento de texto;
//   · error:   un bloque de código sin cerrar (se come el resto del documento);
//   · aviso:   `$$` sin pareja (la fórmula se queda como texto);
//   · aviso:   un enlace o imagen relativo a un fichero que no existe.
//
// El frontend compara la comprobación del texto actual con la de la propuesta y
// solo le cuenta al modelo los errores NUEVOS (como en typst con el compilador).
//
// @spec RF-34

use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::files::{clean_relative, is_text_document};
use super::AiError;

/// Un fichero con su contenido (sin guardar o propuesto).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

/// Un problema encontrado.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub file: String,
    /// Línea, base 1.
    pub line: Option<usize>,
    pub message: String,
    /// `error` o `warning`.
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckOutcome {
    pub diagnostics: Vec<Diagnostic>,
}

fn problem(file: &str, line: Option<usize>, severity: &str, message: impl Into<String>) -> Diagnostic {
    Diagnostic { file: file.to_string(), line, message: message.into(), severity: severity.to_string() }
}

/// Apertura de una valla: carácter, longitud y línea (base 1).
struct Fence {
    ch: char,
    len: usize,
    line: usize,
}

/// ¿La línea abre o cierra una valla? Devuelve el carácter y la longitud.
fn fence_marker(line: &str) -> Option<(char, usize, &str)> {
    let indent = line.len() - line.trim_start_matches(' ').len();
    if indent > 3 {
        return None;
    }
    let rest = &line[indent..];
    let ch = rest.chars().next()?;
    if ch != '`' && ch != '~' {
        return None;
    }
    let len = rest.chars().take_while(|c| *c == ch).count();
    if len < 3 {
        return None;
    }
    Some((ch, len, &rest[len..]))
}

/// Recorre las líneas fuera de bloques de código y avisa de un bloque sin cerrar.
/// Devuelve, por cada línea, si está FUERA de un bloque de código (y si hay una valla abierta al final).
fn code_regions(text: &str) -> (Vec<bool>, Option<Fence>) {
    let mut outside = Vec::new();
    let mut open: Option<Fence> = None;
    for (index, line) in text.lines().enumerate() {
        match (&open, fence_marker(line)) {
            (None, Some((ch, len, _))) => {
                open = Some(Fence { ch, len, line: index + 1 });
                outside.push(false);
            }
            (Some(fence), Some((ch, len, tail))) if ch == fence.ch && len >= fence.len && tail.trim().is_empty() => {
                open = None;
                outside.push(false);
            }
            (Some(_), _) => outside.push(false),
            (None, _) => outside.push(true),
        }
    }
    (outside, open)
}

/// Destinos relativos de enlaces e imágenes de una línea: `](destino)`.
fn relative_targets(line: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut rest = line;
    while let Some(start) = rest.find("](") {
        let after = &rest[start + 2..];
        let Some(end) = after.find(')') else { break };
        let raw = after[..end].trim();
        // «destino "título"» → destino; <destino con espacios> → destino.
        let target = raw.trim_start_matches('<').split(['>', ' ', '"', '\'']).next().unwrap_or("");
        let lower = target.to_ascii_lowercase();
        let external = target.is_empty()
            || target.starts_with('#')
            || target.starts_with('/')
            || lower.starts_with("http://")
            || lower.starts_with("https://")
            || lower.starts_with("mailto:")
            || lower.starts_with("data:")
            || lower.starts_with("tel:")
            || target.contains("://")
            || target.contains(':');
        if !external {
            targets.push(target.split('#').next().unwrap_or("").to_string());
        }
        rest = &after[end + 1..];
    }
    targets.retain(|t| !t.is_empty());
    targets
}

/// Decodifica los `%XX` de la ruta de un enlace (espacios y acentos codificados).
/// Trabaja sobre bytes: nunca trocea en mitad de un carácter UTF-8.
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 3 <= bytes.len() {
            let high = (bytes[i + 1] as char).to_digit(16);
            let low = (bytes[i + 2] as char).to_digit(16);
            if let (Some(high), Some(low)) = (high, low) {
                out.push((high * 16 + low) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Une una ruta relativa con la carpeta del fichero que la contiene, resolviendo `.` y `..`.
fn join_relative(file: &str, target: &str) -> Option<String> {
    let mut parts: Vec<&str> = file.split('/').collect();
    parts.pop(); // el nombre del fichero
    let target = target.replace('\\', "/");
    for piece in target.split('/') {
        match piece {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            other => parts.push(other),
        }
    }
    Some(parts.join("/"))
}

/// Comprueba los ficheros de una propuesta. `root` es la carpeta del documento
/// (para saber si un enlace relativo existe); puede no existir en un test.
pub fn check(root: &str, files: &[FileContent]) -> Result<CheckOutcome, AiError> {
    let mut diagnostics = Vec::new();
    let proposed: HashSet<String> = files.iter().filter_map(|f| clean_relative(&f.path).ok()).collect();

    for file in files {
        let relative = match clean_relative(&file.path) {
            Ok(relative) => relative,
            Err(error) => {
                diagnostics.push(problem(&file.path, None, "error", error.to_string()));
                continue;
            }
        };
        if !is_text_document(Path::new(&relative)) {
            diagnostics.push(problem(&relative, None, "error", "solo se pueden proponer documentos de texto (.md, .markdown, .txt)"));
            continue;
        }

        let (outside, still_open) = code_regions(&file.content);
        if let Some(fence) = still_open {
            diagnostics.push(problem(
                &relative,
                Some(fence.line),
                "error",
                format!("el bloque de código que se abre en la línea {} no se cierra: el resto del documento se vería como código", fence.line),
            ));
        }

        let mut math_open: Option<usize> = None;
        for (index, line) in file.content.lines().enumerate() {
            if !outside.get(index).copied().unwrap_or(false) {
                continue;
            }
            for _ in line.matches("$$") {
                math_open = if math_open.is_some() { None } else { Some(index + 1) };
            }
            for target in relative_targets(line) {
                let decoded = percent_decode(&target);
                let Some(resolved) = join_relative(&relative, &decoded) else {
                    diagnostics.push(problem(&relative, Some(index + 1), "warning", format!("el enlace «{target}» sale de la carpeta del documento")));
                    continue;
                };
                let exists = proposed.contains(&resolved) || Path::new(root).join(&resolved).exists();
                if !exists {
                    diagnostics.push(problem(&relative, Some(index + 1), "warning", format!("el enlace o imagen «{target}» no existe")));
                }
            }
        }
        if let Some(line) = math_open {
            diagnostics.push(problem(&relative, Some(line), "warning", format!("el `$$` de la línea {line} no tiene pareja: la fórmula se vería como texto")));
        }
    }
    Ok(CheckOutcome { diagnostics })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(files: &[(&str, &str)]) -> Vec<Diagnostic> {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("existe.md"), "# x").unwrap();
        std::fs::write(dir.path().join("img.png"), [1u8]).unwrap();
        let list: Vec<FileContent> = files.iter().map(|(p, c)| FileContent { path: (*p).into(), content: (*c).into() }).collect();
        check(dir.path().to_str().unwrap(), &list).unwrap().diagnostics
    }

    fn messages(d: &[Diagnostic], severity: &str) -> Vec<String> {
        d.iter().filter(|x| x.severity == severity).map(|x| x.message.clone()).collect()
    }

    #[test]
    fn un_documento_limpio_no_da_problemas() {
        assert!(run(&[("a.md", "# Título\n\ntexto con [enlace](existe.md) y ![i](img.png)\n\n```js\ncode\n```\n")]).is_empty());
    }

    #[test]
    fn un_bloque_de_codigo_sin_cerrar_es_un_error_con_su_linea() {
        let d = run(&[("a.md", "texto\n\n```js\nconst x = 1;\n\nmás texto\n")]);
        assert_eq!(messages(&d, "error").len(), 1);
        assert_eq!(d[0].line, Some(3));
    }

    #[test]
    fn una_valla_mas_larga_o_de_otro_tipo_no_cierra_la_anterior() {
        // ```` se cierra con ```` (o más); ``` dentro no cierra, ~~~ tampoco.
        assert!(run(&[("a.md", "````md\n```\ndentro\n```\n~~~\n````\n")]).is_empty());
        assert_eq!(messages(&run(&[("a.md", "```\ncode\n~~~\n")]), "error").len(), 1);
    }

    #[test]
    fn lo_que_parece_markdown_dentro_de_un_bloque_de_codigo_no_se_comprueba() {
        assert!(run(&[("a.md", "```md\n[roto](no-existe.md)\n$$ sin pareja\n```\n")]).is_empty());
    }

    #[test]
    fn un_dolar_doble_sin_pareja_es_un_aviso() {
        let d = run(&[("a.md", "$$\nx = 1\n\nfin\n")]);
        assert_eq!(messages(&d, "warning").len(), 1);
        assert!(run(&[("a.md", "$$\nx = 1\n$$\n")]).is_empty());
        assert!(run(&[("a.md", "$$x$$ y $$z$$\n")]).is_empty());
    }

    #[test]
    fn un_enlace_a_un_fichero_inexistente_avisa_pero_uno_creado_en_la_misma_propuesta_no() {
        let d = run(&[("a.md", "[x](no-existe.md) ![i](fotos/no.png)\n")]);
        assert_eq!(messages(&d, "warning").len(), 2);
        assert!(run(&[("a.md", "[x](b.md)\n"), ("b.md", "# B\n")]).is_empty());
    }

    #[test]
    fn no_avisa_de_url_anclas_ni_esquemas_y_entiende_porcentajes_y_subcarpetas() {
        let ok = "[a](https://x.org) [b](#seccion) [c](mailto:a@b.c) [d](existe.md#parte) [e](<existe.md>) [f](existe.md \"título\")\n";
        assert!(run(&[("a.md", ok)]).is_empty());
        assert!(run(&[("sub/a.md", "[x](../existe.md)\n")]).is_empty());
        assert!(run(&[("a.md", "[x](exist%65.md)\n")]).is_empty());
    }

    #[test]
    fn una_ruta_fuera_de_la_carpeta_o_un_tipo_no_permitido_es_un_error() {
        let d = run(&[("../fuera.md", "x"), ("codigo.rs", "fn main() {}"), (".git/config.md", "x")]);
        assert_eq!(messages(&d, "error").len(), 3);
    }

    #[test]
    fn un_enlace_que_sube_mas_alla_de_la_raiz_avisa() {
        let d = run(&[("a.md", "[x](../../fuera.md)\n")]);
        assert_eq!(messages(&d, "warning").len(), 1);
    }
}
