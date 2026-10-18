// =============================================================================
// dbv-md-reader — Detección de IAs disponibles (RF-31.1, RF-32.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-31
//
// Al abrir «Conectar una IA» (nunca al arrancar la aplicación) se mira qué hay
// en el equipo: servidores locales escuchando (Ollama, LM Studio) y agentes
// instalados en el PATH (Claude Code, Gemini CLI, Codex, Copilot) junto con
// Node.js, que necesitan sus adaptadores ACP.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Un servidor local de modelos.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalServer {
    pub provider: &'static str,
    pub running: bool,
    pub models: Vec<String>,
}

/// Un programa encontrado (o no) en el PATH.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub name: &'static str,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Detection {
    pub servers: Vec<LocalServer>,
    pub tools: Vec<Tool>,
}

/// Programas que interesan: los agentes y lo que necesitan sus adaptadores.
pub const TOOLS: &[&str] = &["claude", "gemini", "codex", "copilot", "node", "npx"];

/// Busca `name` en las carpetas de `path_var` (respeta `PATHEXT` en Windows).
pub fn find_in(name: &str, path_var: &str, extensions: &[String]) -> Option<PathBuf> {
    std::env::split_paths(path_var).find_map(|dir| {
        extensions.iter().map(|ext| dir.join(format!("{name}{ext}"))).find(|candidate| candidate.is_file())
    })
}

fn extensions() -> Vec<String> {
    if cfg!(windows) {
        let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into());
        pathext.split(';').filter(|ext| !ext.is_empty()).map(|ext| ext.to_lowercase()).collect()
    } else {
        vec![String::new()]
    }
}

/// Ruta de un programa del PATH, o `None`.
pub fn which(name: &str) -> Option<PathBuf> {
    find_in(name, &std::env::var("PATH").unwrap_or_default(), &extensions())
}

fn get_json(url: &str) -> Option<Value> {
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_millis(1500)))
        .build()
        .new_agent();
    agent.get(url).call().ok()?.into_body().read_json::<Value>().ok()
}

/// Nombres de modelos de una respuesta de Ollama (`/api/tags`) o compatible con OpenAI (`/v1/models`).
pub fn model_names(value: &Value) -> Vec<String> {
    let list = value["models"].as_array().or_else(|| value["data"].as_array());
    list.into_iter()
        .flatten()
        .filter_map(|model| model["name"].as_str().or_else(|| model["id"].as_str()).map(str::to_string))
        .collect()
}

pub fn detect() -> Detection {
    let ollama = get_json("http://127.0.0.1:11434/api/tags");
    let lmstudio = get_json("http://127.0.0.1:1234/v1/models");
    Detection {
        servers: vec![
            LocalServer { provider: "ollama", running: ollama.is_some(), models: ollama.as_ref().map(model_names).unwrap_or_default() },
            LocalServer { provider: "lmStudio", running: lmstudio.is_some(), models: lmstudio.as_ref().map(model_names).unwrap_or_default() },
        ],
        tools: TOOLS.iter().map(|name| Tool { name, path: which(name).map(|path| path.to_string_lossy().to_string()) }).collect(),
    }
}

/// Ejecutable de verdad para lanzar `name` en Windows: un `.cmd`/`.bat` (como
/// `npx.cmd`) no se puede lanzar directamente con `Command::new`.
pub fn launcher(path: &Path) -> (PathBuf, Vec<String>) {
    let is_script = path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"));
    if cfg!(windows) && is_script {
        (PathBuf::from("cmd.exe"), vec!["/d".into(), "/s".into(), "/c".into(), path.to_string_lossy().to_string()])
    } else {
        (path.to_path_buf(), Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn encuentra_un_programa_con_su_extension() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("claude.cmd");
        std::fs::write(&file, "").unwrap();
        let path = std::env::join_paths([dir.path()]).unwrap();
        let found = find_in("claude", path.to_str().unwrap(), &[".exe".into(), ".cmd".into()]);
        assert_eq!(found, Some(file));
        assert_eq!(find_in("gemini", path.to_str().unwrap(), &[".exe".into(), ".cmd".into()]), None);
    }

    #[test]
    fn lee_los_modelos_de_ollama_y_de_openai() {
        assert_eq!(model_names(&json!({"models": [{"name": "qwen2.5:7b"}]})), vec!["qwen2.5:7b"]);
        assert_eq!(model_names(&json!({"data": [{"id": "local-model"}]})), vec!["local-model"]);
        assert!(model_names(&json!({})).is_empty());
    }

    #[test]
    fn en_windows_un_cmd_se_lanza_con_cmd_exe() {
        let (program, args) = launcher(Path::new("C:/nodejs/npx.cmd"));
        if cfg!(windows) {
            assert_eq!(program, PathBuf::from("cmd.exe"));
            assert_eq!(args.last().unwrap(), "C:/nodejs/npx.cmd");
        } else {
            assert!(args.is_empty());
        }
    }
}
