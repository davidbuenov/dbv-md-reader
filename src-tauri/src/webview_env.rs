// =============================================================================
// dbv-md-reader — Entorno de WebView2 heredado de un proceso padre (RF-14, Windows)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un programa que aloja WebView2 (según la PR #23 de Park-Young-Seok, el botón «Abrir con la app
// predeterminada» de PowerToys Peek) fija `WEBVIEW2_USER_DATA_FOLDER` y
// `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--block-new-web-contents` en SU entorno, y la app que lanza
// los hereda. La carpeta de datos del padre tiene prioridad sobre la que pide la propia app, así
// que la ventana principal intentaría usar un perfil ya en uso por el navegador del padre y no
// llegaría a crearse: el proceso quedaría vivo solo con la ventana oculta de instancia única.
//
// Esta app usa siempre su propio perfil y solo descarta el argumento que impone el padre: el resto
// (p. ej. un `--remote-debugging-port` de depuración) se conserva. La decisión es una función
// pura (`scrub`) para poder probarla sin tocar el entorno real del proceso.
//
// NO VERIFICADO con Peek real: que Peek fije esas variables es un dato de la PR (ver task.md).
//
// @spec RF-14

/// El único argumento del navegador que se descarta: bloquea las ventanas nuevas del WebView.
pub const BLOCKED_ARG: &str = "--block-new-web-contents";

/// Qué hacer con `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`.
#[derive(Debug, PartialEq, Eq)]
pub enum ArgsChange {
    /// No hay nada que quitar: se deja como está.
    Keep,
    /// Solo estaba el argumento bloqueado: se elimina la variable.
    Remove,
    /// Había más argumentos: se reescribe sin el bloqueado.
    Set(String),
}

/// Resultado de limpiar el entorno heredado.
#[derive(Debug, PartialEq, Eq)]
pub struct Scrubbed {
    /// `true` si hay que eliminar `WEBVIEW2_USER_DATA_FOLDER`.
    pub drop_user_data_folder: bool,
    pub browser_args: ArgsChange,
}

/// Decide qué limpiar a partir del valor actual de las dos variables (`None` = no definida).
pub fn scrub(user_data_folder: Option<&str>, browser_args: Option<&str>) -> Scrubbed {
    let browser_args = match browser_args {
        None => ArgsChange::Keep,
        Some(args) => {
            let all: Vec<&str> = args.split_whitespace().collect();
            let kept: Vec<&str> = all.iter().copied().filter(|a| *a != BLOCKED_ARG).collect();
            match (all.len() == kept.len(), kept.is_empty()) {
                (true, _) => ArgsChange::Keep,
                (false, true) => ArgsChange::Remove,
                (false, false) => ArgsChange::Set(kept.join(" ")),
            }
        }
    };
    Scrubbed {
        drop_user_data_folder: user_data_folder.is_some(),
        browser_args,
    }
}

/// Aplica `scrub` al entorno real del proceso. Debe llamarse al inicio de `run()`, antes de crear
/// ninguna ventana. Solo hace algo en Windows (WebView2); en el resto de plataformas no existe.
#[cfg(windows)]
pub fn scrub_inherited() {
    let folder = std::env::var("WEBVIEW2_USER_DATA_FOLDER").ok();
    let args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").ok();
    let change = scrub(folder.as_deref(), args.as_deref());
    if change.drop_user_data_folder {
        std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
    }
    match change.browser_args {
        ArgsChange::Keep => {}
        ArgsChange::Remove => std::env::remove_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"),
        ArgsChange::Set(value) => std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", value),
    }
}

#[cfg(not(windows))]
pub fn scrub_inherited() {}

#[cfg(test)]
mod tests {
    use super::*;

    /// @spec RF-14
    #[test]
    fn sin_variables_no_hay_nada_que_limpiar() {
        let s = scrub(None, None);
        assert!(!s.drop_user_data_folder);
        assert_eq!(s.browser_args, ArgsChange::Keep);
    }

    /// @spec RF-14
    #[test]
    fn la_carpeta_de_datos_heredada_se_descarta() {
        let s = scrub(Some(r"C:\Users\x\AppData\LocalLow\Microsoft\PowerToys\Peek-Temp"), None);
        assert!(s.drop_user_data_folder);
        assert_eq!(s.browser_args, ArgsChange::Keep);
    }

    /// @spec RF-14
    #[test]
    fn si_solo_estaba_el_argumento_bloqueado_la_variable_se_elimina() {
        let s = scrub(None, Some("--block-new-web-contents"));
        assert_eq!(s.browser_args, ArgsChange::Remove);
    }

    /// @spec RF-14
    #[test]
    fn los_demas_argumentos_se_conservan_y_solo_cae_el_bloqueado() {
        let s = scrub(None, Some("--remote-debugging-port=9333 --block-new-web-contents --disable-gpu"));
        assert_eq!(
            s.browser_args,
            ArgsChange::Set("--remote-debugging-port=9333 --disable-gpu".to_string())
        );
    }

    /// @spec RF-14
    #[test]
    fn argumentos_sin_el_bloqueado_se_dejan_intactos() {
        let s = scrub(None, Some("--remote-debugging-port=9333"));
        assert_eq!(s.browser_args, ArgsChange::Keep);
    }

    /// @spec RF-14
    #[test]
    fn un_argumento_parecido_no_se_confunde_con_el_bloqueado() {
        let s = scrub(None, Some("--block-new-web-contents-extra"));
        assert_eq!(s.browser_args, ArgsChange::Keep);
    }

    /// @spec RF-14
    #[test]
    fn el_caso_completo_de_peek_limpia_ambas_cosas() {
        let s = scrub(Some("C:\\Peek-Temp"), Some("--block-new-web-contents"));
        assert!(s.drop_user_data_folder);
        assert_eq!(s.browser_args, ArgsChange::Remove);
    }
}
