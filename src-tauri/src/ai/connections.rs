// =============================================================================
// dbv-md-reader — Conexiones con proveedores de IA (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// @spec RF-31
//
// Lista de conexiones configuradas (`ai-connections.json` en la carpeta de
// configuración): proveedor, URL, modelo y capacidades. NUNCA la clave: esa
// vive en el almacén de credenciales del sistema (`secrets.rs`) y aquí solo
// queda `hasKey`.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::AiError;

/// Proveedor de una conexión directa (RF-31.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    Ollama,
    LmStudio,
    OpenAiCompatible,
    OpenAi,
    Anthropic,
    Gemini,
    OpenRouter,
    /// Agente instalado por ACP (RF-32): `base_url` = `acp:<agente>` y, si es
    /// `acp:custom`, `model` lleva la orden completa.
    Agent,
}

/// Protocolo de red que habla el proveedor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Protocol {
    OpenAi,
    Anthropic,
    /// API nativa de Ollama (`/api/chat`): la única forma de fijar el contexto
    /// (`num_ctx`); la compatible con OpenAI usa el de su configuración, que
    /// puede ser de solo 2 048 tokens y recorta en silencio.
    Ollama,
}

impl ProviderKind {
    /// URL base por defecto (la del usuario manda en `OpenAiCompatible`).
    pub fn default_base_url(self) -> &'static str {
        match self {
            Self::Ollama => "http://localhost:11434/v1",
            Self::LmStudio => "http://localhost:1234/v1",
            Self::OpenAiCompatible => "http://localhost:8080/v1",
            Self::OpenAi => "https://api.openai.com/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai",
            Self::OpenRouter => "https://openrouter.ai/api/v1",
            Self::Agent => "acp:claude",
        }
    }

    /// ¿Los datos salen del equipo? (aviso de RNF-IA.2).
    pub fn is_cloud(self) -> bool {
        // Un agente (Claude Code, Gemini CLI…) habla con su nube.
        matches!(self, Self::OpenAi | Self::Anthropic | Self::Gemini | Self::OpenRouter | Self::Agent)
    }

    /// Contexto prudente si el proveedor no lo informa (ADR-V0130-002). Ollama
    /// arranca con 4 096, que deja un presupuesto útil de ≈1 600 tokens
    /// (RF-103.2): DBV pide 8 192, el mínimo con el que el asistente funciona
    /// (ADR-V0140-002, D2).
    pub fn default_context(self) -> u32 {
        match self {
            Self::Ollama | Self::LmStudio | Self::OpenAiCompatible => 8192,
            _ => 32768,
        }
    }

    /// Tope de tokens por respuesta si la conexión no fija uno (RF-107.1): un
    /// modelo local que se desboca no debe generar hasta llenar el contexto
    /// (la prueba de `qwen3:8b` del 2026-10-04 gastó ≈7 000 tokens en 4 min 17 s
    /// sin mostrar nada). 8 192 cubre ≈14 páginas de una sola llamada y corta un
    /// bucle a 29 tok/s en unos 4,7 min (D1). Las nubes ya tienen el suyo.
    pub fn default_max_output(self) -> Option<u32> {
        match self {
            Self::Ollama | Self::LmStudio | Self::OpenAiCompatible => Some(8192),
            _ => None,
        }
    }
}

/// Una conexión configurada.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub provider: ProviderKind,
    pub base_url: String,
    pub model: String,
    /// Hay una clave guardada en el almacén del sistema (o en la sesión).
    #[serde(default)]
    pub has_key: bool,
    #[serde(default)]
    pub context_tokens: Option<u32>,
    #[serde(default)]
    pub supports_tools: Option<bool>,
    #[serde(default)]
    pub supports_images: Option<bool>,
    /// El modelo «piensa» antes de responder (RF-101). `None` = desactivado: más
    /// rápido, y es lo que ya hacían las conexiones anteriores a la 0.13.1.
    #[serde(default)]
    pub reasoning: Option<bool>,
    /// Máximo de tokens que el modelo puede generar en una respuesta (RF-107.1).
    /// `None` = el de su proveedor (`default_max_output`).
    #[serde(default)]
    pub max_output_tokens: Option<u32>,
}

impl Connection {
    pub fn protocol(&self) -> Protocol {
        match self.provider {
            ProviderKind::Anthropic => Protocol::Anthropic,
            ProviderKind::Ollama => Protocol::Ollama,
            _ => Protocol::OpenAi,
        }
    }

    /// Contexto con el que se pide al modelo (el configurado o el prudente).
    pub fn context(&self) -> u32 {
        self.context_tokens.unwrap_or_else(|| self.provider.default_context())
    }

    /// Tope de tokens por respuesta (el configurado o el de su proveedor), nunca
    /// mayor que el contexto: generar más no cabría (RF-107.1).
    pub fn output_cap(&self) -> Option<u32> {
        self.max_output_tokens.or_else(|| self.provider.default_max_output()).map(|cap| cap.min(self.context()))
    }

    /// Una URL que no sea `http(s)` no se acepta (ni `file:`, ni nada raro).
    pub fn validate(&self) -> Result<(), AiError> {
        let url = self.base_url.trim();
        if self.provider == ProviderKind::Agent {
            let known = ["acp:claude", "acp:gemini", "acp:codex", "acp:copilot", "acp:custom"];
            if !known.contains(&url) {
                return Err(AiError::Config(format!("agente no reconocido ({url})")));
            }
        } else if !(url.starts_with("http://") || url.starts_with("https://")) {
            return Err(AiError::Config(format!("la dirección debe empezar por http:// o https:// ({url})")));
        }
        if self.id.trim().is_empty() || self.id.contains(['/', '\\']) {
            return Err(AiError::Config("identificador de conexión no válido".into()));
        }
        Ok(())
    }
}

/// Fichero de conexiones: la lista y cuál está activa.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsFile {
    #[serde(default)]
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub active: Option<String>,
    /// RNF-IA.1: «Mostrar las funciones de IA». Por defecto, sí (si hay conexión).
    #[serde(default = "yes")]
    pub show_ai: bool,
}

fn yes() -> bool {
    true
}

pub fn file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("ai-connections.json")
}

pub fn load(config_dir: &Path) -> Result<ConnectionsFile, AiError> {
    let path = file_path(config_dir);
    if !path.is_file() {
        return Ok(ConnectionsFile { show_ai: true, ..ConnectionsFile::default() });
    }
    let text = std::fs::read_to_string(&path).map_err(|error| AiError::Config(error.to_string()))?;
    serde_json::from_str(&text).map_err(|error| AiError::Config(format!("{} ilegible: {error}", path.display())))
}

/// Escritura atómica (temporal + renombrado), como el resto de la aplicación.
pub fn save(config_dir: &Path, file: &ConnectionsFile) -> Result<(), AiError> {
    std::fs::create_dir_all(config_dir).map_err(|error| AiError::Config(error.to_string()))?;
    let path = file_path(config_dir);
    let temp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(file).map_err(|error| AiError::Config(error.to_string()))?;
    std::fs::write(&temp, text).map_err(|error| AiError::Config(error.to_string()))?;
    std::fs::rename(&temp, &path).map_err(|error| AiError::Config(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Connection {
        Connection {
            id: "c1".into(),
            name: "Claude".into(),
            provider: ProviderKind::Anthropic,
            base_url: ProviderKind::Anthropic.default_base_url().into(),
            model: "claude-sonnet".into(),
            has_key: true,
            context_tokens: None,
            supports_tools: Some(true),
            supports_images: Some(true),
            reasoning: None,
            max_output_tokens: None,
        }
    }

    #[test]
    fn guardar_y_cargar_conserva_las_conexiones() {
        let dir = tempfile::tempdir().unwrap();
        let file = ConnectionsFile { connections: vec![sample()], active: Some("c1".into()), show_ai: true };
        save(dir.path(), &file).unwrap();
        assert_eq!(load(dir.path()).unwrap(), file);
    }

    #[test]
    fn sin_fichero_no_hay_conexiones_y_se_muestra_la_ia() {
        let dir = tempfile::tempdir().unwrap();
        let file = load(dir.path()).unwrap();
        assert!(file.connections.is_empty());
        assert!(file.show_ai);
    }

    #[test]
    fn la_nube_y_el_protocolo_dependen_del_proveedor() {
        assert!(ProviderKind::Gemini.is_cloud());
        assert!(!ProviderKind::Ollama.is_cloud());
        assert_eq!(sample().protocol(), Protocol::Anthropic);
    }

    fn with(provider: ProviderKind, context: Option<u32>, max: Option<u32>) -> Connection {
        Connection { provider, context_tokens: context, max_output_tokens: max, ..sample() }
    }

    #[test]
    fn el_tope_de_salida_es_de_8192_en_locales_y_no_existe_en_la_nube() {
        // RF-107.1 / D1: lo que se midió (una propuesta de ~1 200 palabras son 1 409 tokens) cabe de sobra.
        for local in [ProviderKind::Ollama, ProviderKind::LmStudio, ProviderKind::OpenAiCompatible] {
            assert_eq!(with(local, None, None).output_cap(), Some(8192), "{local:?}");
        }
        for cloud in [ProviderKind::Anthropic, ProviderKind::OpenAi, ProviderKind::Gemini, ProviderKind::OpenRouter, ProviderKind::Agent] {
            assert_eq!(with(cloud, None, None).output_cap(), None, "{cloud:?}");
        }
    }

    #[test]
    fn el_tope_configurado_manda_y_nunca_supera_el_contexto() {
        assert_eq!(with(ProviderKind::Ollama, None, Some(16000)).output_cap(), Some(8192), "el contexto por defecto de Ollama (8 192) es el techo");
        assert_eq!(with(ProviderKind::Ollama, Some(32768), Some(16000)).output_cap(), Some(16000));
        assert_eq!(with(ProviderKind::Ollama, Some(4096), None).output_cap(), Some(4096), "con 4 096 de contexto no se puede generar más");
        // En la nube, un tope explícito se respeta.
        assert_eq!(with(ProviderKind::Anthropic, None, Some(2000)).output_cap(), Some(2000));
    }

    #[test]
    fn ollama_pide_8192_de_contexto_por_defecto() {
        // ADR-V0140-002 D2: con 4 096 el presupuesto útil era de ≈1 600 tokens.
        assert_eq!(with(ProviderKind::Ollama, None, None).context(), 8192);
        assert_eq!(with(ProviderKind::Ollama, Some(32768), None).context(), 32768);
    }

    #[test]
    fn una_conexion_guardada_antes_de_la_0_14_sigue_cargando_sin_el_campo() {
        let old = r#"{"id":"c1","name":"Ollama","provider":"ollama","baseUrl":"http://localhost:11434/v1","model":"qwen3:8b","hasKey":false,"contextTokens":32768}"#;
        let connection: Connection = serde_json::from_str(old).unwrap();
        assert_eq!(connection.max_output_tokens, None);
        assert_eq!(connection.output_cap(), Some(8192));
    }

    #[test]
    fn solo_se_aceptan_urls_http() {
        let mut connection = sample();
        connection.base_url = "file:///etc".into();
        assert!(connection.validate().is_err());
        connection.base_url = "http://localhost:11434/v1".into();
        assert!(connection.validate().is_ok());
        connection.id = "../x".into();
        assert!(connection.validate().is_err());
        connection.id = "a1".into();
        connection.provider = ProviderKind::Agent;
        connection.base_url = "acp:claude".into();
        assert!(connection.validate().is_ok());
        connection.base_url = "acp:../../x".into();
        assert!(connection.validate().is_err());
    }
}
