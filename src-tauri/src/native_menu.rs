// =============================================================================
// dbv-md-reader — Lector y editor nativo de Markdown (.md) para Windows, Linux y macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// Descripción neutra del menú nativo de macOS (RF-65) y su saneado. Es la parte PURA y multiplataforma:
// los tipos que llegan del frontend (`headermenu.js` → `set_native_menu`), la limpieza de lo que llega y la
// huella de la estructura. Pintar el menú con Tauri vive en `macos_menu` (lib.rs) y solo compila en macOS.
//
// @spec RF-65
// =============================================================================

use serde::Deserialize;

/// Tope de menús y de entradas por menú: la descripción viene del frontend y no se fía de su tamaño (RF-65.9).
const MAX_MENUS: usize = 8;
const MAX_ITEMS: usize = 80;
const MAX_ID: usize = 96;
const MAX_LABEL: usize = 120;

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct NativeItem {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub accel: Option<String>,
    #[serde(default = "yes")]
    pub enabled: bool,
    #[serde(default)]
    pub checked: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct NativeMenuDef {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub items: Vec<NativeItem>,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
pub struct NativeMenuSpec {
    #[serde(default)]
    pub menus: Vec<NativeMenuDef>,
}

fn yes() -> bool {
    true
}

/// Texto plano: sin caracteres de control, espacios normalizados y con tope.
fn clean_text(text: &str, max: usize) -> String {
    let plain: String = text.chars().filter(|c| !c.is_control()).collect();
    plain.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(max).collect()
}

/// Un id válido es corto y de caracteres seguros: sirve de clave del evento de vuelta.
fn clean_id(id: &str) -> Option<String> {
    let ok = !id.is_empty()
        && id.chars().count() <= MAX_ID
        && id.chars().all(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | ':' | '~' | '.'));
    if ok {
        Some(id.to_string())
    } else {
        None
    }
}

/// Acelerador de Tauri válido (`CmdOrCtrl+Shift+S`, `F1`…) o `None`: una entrada con un atajo ilegible sale sin atajo.
pub fn clean_accel(accel: Option<&str>) -> Option<String> {
    let text = accel?.trim();
    let mut parts: Vec<&str> = text.split('+').collect();
    let key = parts.pop().unwrap_or("");
    let key_ok = (key.len() == 1 && key.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()))
        || (key.starts_with('F') && key[1..].parse::<u8>().map(|n| (1..=24).contains(&n)).unwrap_or(false));
    let mods_ok = parts.iter().all(|m| matches!(*m, "CmdOrCtrl" | "Shift" | "Alt" | "Ctrl"));
    if key_ok && mods_ok {
        Some(text.to_string())
    } else {
        None
    }
}

/// Limpia lo que llega del frontend: ids únicos y seguros, tipos conocidos, textos planos y topes de tamaño.
///
/// @spec RF-65
pub fn sanitize(spec: NativeMenuSpec) -> NativeMenuSpec {
    let mut seen: Vec<String> = Vec::new();
    let mut menus: Vec<NativeMenuDef> = Vec::new();
    for def in spec.menus.into_iter().take(MAX_MENUS) {
        let menu_id = match clean_id(&def.id) {
            Some(id) if !seen.contains(&id) => id,
            _ => continue,
        };
        seen.push(menu_id.clone());
        let mut items: Vec<NativeItem> = Vec::new();
        for item in def.items.into_iter().take(MAX_ITEMS) {
            let kind = item.kind.as_str();
            if kind == "sep" {
                items.push(NativeItem { id: String::new(), kind: "sep".into(), label: String::new(), accel: None, enabled: true, checked: false });
                continue;
            }
            let id = match clean_id(&item.id) {
                Some(id) if (kind == "item" || kind == "check") && !seen.contains(&id) => id,
                _ => continue,
            };
            seen.push(id.clone());
            items.push(NativeItem {
                id,
                kind: item.kind.clone(),
                label: clean_text(&item.label, MAX_LABEL),
                accel: clean_accel(item.accel.as_deref()),
                enabled: item.enabled,
                checked: kind == "check" && item.checked,
            });
        }
        menus.push(NativeMenuDef { id: menu_id, title: clean_text(&def.title, MAX_LABEL), items });
    }
    NativeMenuSpec { menus }
}

/// Huella de la ESTRUCTURA (ids, tipos, etiquetas, atajos): si no cambia, el menú se actualiza en sitio
/// (marcado y habilitado) sin reconstruirlo, para no molestar a un menú abierto (RF-65.5).
pub fn structure_signature(spec: &NativeMenuSpec) -> String {
    let mut out = String::new();
    for menu in &spec.menus {
        out.push_str(&format!("[{}|{}", menu.id, menu.title));
        for item in &menu.items {
            out.push_str(&format!(";{}|{}|{}|{}", item.id, item.kind, item.label, item.accel.as_deref().unwrap_or("")));
        }
        out.push(']');
    }
    out
}

/// Estado del menú publicado por la última ventana: la huella de su estructura. `None` = aún no hay menú propio.
#[derive(Default)]
pub struct NativeMenuState(pub std::sync::Mutex<Option<String>>);

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, kind: &str, label: &str) -> NativeItem {
        NativeItem { id: id.into(), kind: kind.into(), label: label.into(), accel: None, enabled: true, checked: false }
    }

    fn one(items: Vec<NativeItem>) -> NativeMenuSpec {
        NativeMenuSpec { menus: vec![NativeMenuDef { id: "file".into(), title: "Archivo".into(), items }] }
    }

    /// @spec RF-65
    #[test]
    fn la_descripcion_se_deserializa_con_los_valores_por_defecto() {
        let spec: NativeMenuSpec = serde_json::from_str(
            r#"{"menus":[{"id":"file","title":"Archivo","items":[{"id":"file:a","kind":"item","label":"A"}]}]}"#,
        )
        .unwrap();
        let first = &spec.menus[0].items[0];
        assert!(first.enabled);
        assert!(!first.checked);
        assert_eq!(first.accel, None);
    }

    /// @spec RF-65
    #[test]
    fn ids_repetidos_o_ilegibles_y_tipos_desconocidos_no_entran() {
        let spec = sanitize(one(vec![
            item("file:a", "item", "A"),
            item("file:a", "item", "A de nuevo"),
            item("", "item", "sin id"),
            item("file:<b>", "item", "con signos raros"),
            item("file:c", "boton", "tipo desconocido"),
            item("file:d", "check", "D"),
        ]));
        let ids: Vec<&str> = spec.menus[0].items.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["file:a", "file:d"]);
    }

    /// @spec RF-65
    #[test]
    fn un_menu_repetido_o_con_id_invalido_se_descarta() {
        let mut spec = one(vec![item("file:a", "item", "A")]);
        spec.menus.push(spec.menus[0].clone());
        spec.menus.push(NativeMenuDef { id: "x y".into(), title: "T".into(), items: vec![] });
        assert_eq!(sanitize(spec).menus.len(), 1);
    }

    /// @spec RF-65
    #[test]
    fn las_etiquetas_son_texto_plano_y_con_tope() {
        let spec = sanitize(one(vec![item("file:a", "item", &format!("  Abrir\n\t archivo\u{0007}…{}", "x".repeat(500)))]));
        let label = &spec.menus[0].items[0].label;
        assert!(label.starts_with("Abrir archivo…"));
        assert!(label.chars().count() <= MAX_LABEL);
        assert!(!label.chars().any(|c| c.is_control()));
    }

    /// @spec RF-65
    #[test]
    fn solo_las_casillas_pueden_ir_marcadas() {
        let mut a = item("file:a", "item", "A");
        a.checked = true;
        let mut b = item("file:b", "check", "B");
        b.checked = true;
        let items = sanitize(one(vec![a, b])).menus.remove(0).items;
        assert!(!items[0].checked);
        assert!(items[1].checked);
    }

    /// @spec RF-65
    #[test]
    fn los_aceleradores_validos_pasan_y_los_demas_se_quedan_sin_atajo() {
        assert_eq!(clean_accel(Some("CmdOrCtrl+Shift+S")).as_deref(), Some("CmdOrCtrl+Shift+S"));
        assert_eq!(clean_accel(Some("F1")).as_deref(), Some("F1"));
        assert_eq!(clean_accel(Some("CmdOrCtrl+Alt+P")).as_deref(), Some("CmdOrCtrl+Alt+P"));
        assert_eq!(clean_accel(Some("F99")), None);
        assert_eq!(clean_accel(Some("Hyper+K")), None);
        assert_eq!(clean_accel(Some("CmdOrCtrl+")), None);
        assert_eq!(clean_accel(Some("")), None);
        assert_eq!(clean_accel(None), None);
    }

    /// @spec RF-65
    #[test]
    fn hay_topes_de_tamano() {
        let items: Vec<NativeItem> = (0..500).map(|n| item(&format!("file:{n}"), "item", "x")).collect();
        let mut spec = one(items);
        for n in 0..20 {
            spec.menus.push(NativeMenuDef { id: format!("m{n}"), title: "T".into(), items: vec![] });
        }
        let out = sanitize(spec);
        assert_eq!(out.menus.len(), MAX_MENUS);
        assert_eq!(out.menus[0].items.len(), MAX_ITEMS);
    }

    /// @spec RF-65
    #[test]
    fn la_huella_ignora_el_estado_pero_no_la_estructura() {
        let a = one(vec![item("file:a", "check", "A")]);
        let mut marcada = a.clone();
        marcada.menus[0].items[0].checked = true;
        marcada.menus[0].items[0].enabled = false;
        assert_eq!(structure_signature(&a), structure_signature(&marcada));
        let mut otra_etiqueta = a.clone();
        otra_etiqueta.menus[0].items[0].label = "B".into();
        assert_ne!(structure_signature(&a), structure_signature(&otra_etiqueta));
    }
}
