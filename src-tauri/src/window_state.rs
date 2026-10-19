// =============================================================================
// dbv-md-reader — Recordar la ventana principal: posición, tamaño y maximizado (RF-42)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Módulo propio en vez de `tauri-plugin-window-state` (ver ADR-051): el spec exige que NUNCA se restaure una
// ventana inalcanzable (monitor desenchufado, resolución distinta) y eso es una función pura que se puede
// probar aquí (`plan_restore`); además el plugin añade una dependencia y, según el issue #20, la versión 2.5
// sube `tauri` a 2.12 y descuadra el CLI con `@tauri-apps/api` (dato de un tercero, sin comprobar).
//
// Solo la ventana `main`: las ventanas de documento (`doc-*`, RF-14) se abren como siempre. Se guarda desde
// el estado EN MEMORIA que mantienen los eventos `Moved`/`Resized` y se escribe en `CloseRequested` y en
// `Destroyed`, porque `window.destroy()` (con el que se cierra tras el aviso de cambios sin guardar, RF-21)
// emite `Destroyed` sin `CloseRequested` y a esas alturas la ventana ya no se puede consultar.
//
// La casilla «Recordar la posición y el tamaño de la ventana» (por defecto activada) vive en este mismo
// fichero porque Rust lo lee ANTES de que exista el frontend. En Wayland algunos compositores no dejan que
// la app coloque su ventana: allí solo valen tamaño y maximizado (limitación documentada, como RF-19).
//
// @spec RF-42

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, State, Window, WindowEvent};

const FILE_NAME: &str = "window-state.json";
const MAIN_LABEL: &str = "main";
/// Mínimos de la ventana (`tauri.conf.json`): un tamaño guardado menor se sube a ellos.
const MIN_WIDTH: u32 = 640;
const MIN_HEIGHT: u32 = 450;
/// Una posición solo vale si deja a la vista una parte útil de la BARRA DE TÍTULO (por donde se arrastra la
/// ventana): al menos 100 px de ancho (o todo el ancho si la ventana es más estrecha) por 16 de alto.
const TITLE_STRIP_HEIGHT: i64 = 32;
const MIN_VISIBLE_WIDTH: i64 = 100;
const MIN_VISIBLE_HEIGHT: i64 = 16;

/// Lo que se guarda en `window-state.json`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(default)]
pub struct SavedState {
    /// La casilla de Preferencias: si es `false` ni se guarda ni se restaura.
    pub enabled: bool,
    /// `false` mientras no se haya guardado ninguna geometría (primer arranque).
    pub has_geometry: bool,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for SavedState {
    fn default() -> Self {
        SavedState { enabled: true, has_geometry: false, x: 0, y: 0, width: 0, height: 0, maximized: false }
    }
}

/// Rectángulo de un monitor conectado, en píxeles físicos del escritorio virtual.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Qué hacer con la ventana al arrancar.
#[derive(Debug, PartialEq, Eq)]
pub enum Placement {
    /// Dejarla como la creó `tauri.conf.json` (preferencia apagada, primer arranque o sin monitores).
    Untouched,
    /// Colocarla en esa posición con ese tamaño (ya recortado al monitor).
    At { x: i32, y: i32, width: u32, height: u32 },
    /// La posición guardada ya no cae en ningún monitor: centrarla con el tamaño guardado (recortado).
    Centered { width: u32, height: u32 },
}

/// Parte visible (ancho, alto) de la barra de título de una ventana en `(x, y)` de ancho `width` sobre un monitor.
fn visible_title_strip(x: i64, y: i64, width: i64, monitor: &MonitorRect) -> (i64, i64) {
    let left = x.max(monitor.x as i64);
    let right = (x + width).min(monitor.x as i64 + monitor.width as i64);
    let top = y.max(monitor.y as i64);
    let bottom = (y + TITLE_STRIP_HEIGHT).min(monitor.y as i64 + monitor.height as i64);
    ((right - left).max(0), (bottom - top).max(0))
}

/// Decide dónde restaurar la ventana. Pura: no toca ventanas ni disco.
///
/// @spec RF-42
pub fn plan_restore(saved: &SavedState, monitors: &[MonitorRect]) -> Placement {
    let usable = saved.enabled && saved.has_geometry && !monitors.is_empty();
    if !usable {
        return Placement::Untouched;
    }
    let width = saved.width.max(MIN_WIDTH);
    let height = saved.height.max(MIN_HEIGHT);
    let needed_width = MIN_VISIBLE_WIDTH.min(width as i64);

    // El monitor donde más se ve la barra de título, si se ve lo suficiente.
    let best = monitors
        .iter()
        .map(|m| (m, visible_title_strip(saved.x as i64, saved.y as i64, width as i64, m)))
        .filter(|(_, (w, h))| *w >= needed_width && *h >= MIN_VISIBLE_HEIGHT)
        .max_by_key(|(_, (w, h))| w * h)
        .map(|(m, _)| m);

    match best {
        Some(monitor) => Placement::At {
            x: saved.x,
            y: saved.y,
            width: width.min(monitor.width),
            height: height.min(monitor.height),
        },
        None => {
            let primary = monitors[0];
            Placement::Centered { width: width.min(primary.width), height: height.min(primary.height) }
        }
    }
}

/// Lee el estado guardado; un fichero ausente o corrupto devuelve el de un primer arranque.
pub fn load_state(path: &Path) -> SavedState {
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// Guarda el estado (crea la carpeta de datos si hace falta).
pub fn save_state(path: &Path, state: &SavedState) -> Result<(), String> {
    let parent_ok = match path.parent() {
        Some(dir) => fs::create_dir_all(dir).map_err(|e| format!("Error creando el directorio de datos: {}", e)),
        None => Ok(()),
    };
    parent_ok?;
    let raw = serde_json::to_string_pretty(state).map_err(|e| format!("Error serializando el estado de la ventana: {}", e))?;
    fs::write(path, raw).map_err(|e| format!("Error guardando el estado de la ventana: {}", e))
}

/// Estado vivo de la ventana principal, gestionado por Tauri.
pub struct Memory(Mutex<SavedState>);

impl Default for Memory {
    fn default() -> Self {
        Memory(Mutex::new(SavedState::default()))
    }
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|e| format!("Error resolviendo el directorio de datos: {}", e))
}

fn monitors_of(window: &tauri::WebviewWindow) -> Vec<MonitorRect> {
    window
        .available_monitors()
        .map(|list| {
            list.iter()
                .map(|m| MonitorRect { x: m.position().x, y: m.position().y, width: m.size().width, height: m.size().height })
                .collect()
        })
        .unwrap_or_default()
}

/// Carga el estado, lo deja en memoria y coloca la ventana principal. Se llama desde `setup`, con la ventana
/// recién creada por `tauri.conf.json` (1120×760 centrada).
pub fn restore(app: &AppHandle) {
    let saved = state_path(app).map(|p| load_state(&p)).unwrap_or_default();
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        match plan_restore(&saved, &monitors_of(&window)) {
            Placement::Untouched => {}
            Placement::At { x, y, width, height } => {
                let _ = window.set_size(PhysicalSize::new(width, height));
                let _ = window.set_position(PhysicalPosition::new(x, y));
            }
            Placement::Centered { width, height } => {
                let _ = window.set_size(PhysicalSize::new(width, height));
                let _ = window.center();
            }
        }
        if saved.enabled && saved.has_geometry && saved.maximized {
            let _ = window.maximize();
        }
    }
    if let Some(memory) = app.try_state::<Memory>() {
        if let Ok(mut state) = memory.0.lock() {
            *state = saved;
        }
    }
}

/// Lo que se sabe de la ventana en un instante. Se separa de `Window`/`WebviewWindow` (que son dos tipos distintos
/// según de dónde llegue la llamada) para poder aplicar la regla en una función pura y probarla.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Snapshot {
    pub minimized: bool,
    pub maximized: bool,
    /// Posición exterior en píxeles físicos, si se pudo leer.
    pub position: Option<(i32, i32)>,
    /// Tamaño interior en píxeles físicos, si se pudo leer.
    pub size: Option<(u32, u32)>,
}

/// Actualiza el estado en memoria con lo que se acaba de ver de la ventana. Con la preferencia apagada o la ventana
/// minimizada (Windows la manda a (-32000, -32000)) no cambia nada; maximizada solo se anota el estado, para no perder
/// la geometría «normal» a la que se vuelve al desmaximizar.
///
/// @spec RF-42
pub fn apply_snapshot(state: &mut SavedState, snap: &Snapshot) {
    if state.enabled && !snap.minimized {
        if snap.maximized {
            state.maximized = true;
        } else if let (Some((x, y)), Some((width, height))) = (snap.position, snap.size) {
            state.x = x;
            state.y = y;
            state.width = width;
            state.height = height;
            state.maximized = false;
            state.has_geometry = true;
        }
    }
}

fn snapshot_of_window(window: &Window) -> Snapshot {
    Snapshot {
        minimized: window.is_minimized().unwrap_or(false),
        maximized: window.is_maximized().unwrap_or(false),
        position: window.outer_position().ok().map(|p| (p.x, p.y)),
        size: window.inner_size().ok().map(|s| (s.width, s.height)),
    }
}

fn snapshot_of_webview(window: &tauri::WebviewWindow) -> Snapshot {
    Snapshot {
        minimized: window.is_minimized().unwrap_or(false),
        maximized: window.is_maximized().unwrap_or(false),
        position: window.outer_position().ok().map(|p| (p.x, p.y)),
        size: window.inner_size().ok().map(|s| (s.width, s.height)),
    }
}

impl Memory {
    fn record(&self, snap: &Snapshot) {
        if let Ok(mut state) = self.0.lock() {
            apply_snapshot(&mut state, snap);
        }
    }

    fn flush(&self, app: &AppHandle) {
        if let (Ok(state), Ok(path)) = (self.0.lock(), state_path(app)) {
            if let Err(err) = save_state(&path, &state) {
                eprintln!("[window_state] {}", err);
            }
        }
    }
}

/// Engancha los eventos de la ventana principal. Se registra con `Builder::on_window_event`.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if window.label() == MAIN_LABEL {
        if let Some(memory) = window.try_state::<Memory>() {
            match event {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) => memory.record(&snapshot_of_window(window)),
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => memory.flush(window.app_handle()),
                _ => {}
            }
        }
    }
}

/// Estado de la casilla de Preferencias.
///
/// @spec RF-42
#[tauri::command]
pub fn get_window_state_pref(memory: State<Memory>) -> bool {
    memory.0.lock().map(|s| s.enabled).unwrap_or(true)
}

/// Activa o desactiva la casilla. Al activarla se toma la geometría actual; al desactivarla se deja de guardar
/// y de restaurar (lo guardado se conserva por si se vuelve a activar).
///
/// @spec RF-42
#[tauri::command]
pub fn set_window_state_pref(app: AppHandle, memory: State<Memory>, enabled: bool) -> Result<(), String> {
    {
        let mut state = memory.0.lock().map_err(|e| e.to_string())?;
        state.enabled = enabled;
    }
    if enabled {
        if let Some(window) = app.get_webview_window(MAIN_LABEL) {
            memory.record(&snapshot_of_webview(&window));
        }
    }
    let path = state_path(&app)?;
    let state = memory.0.lock().map_err(|e| e.to_string())?;
    save_state(&path, &state)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FULL_HD: MonitorRect = MonitorRect { x: 0, y: 0, width: 1920, height: 1080 };
    const SECOND: MonitorRect = MonitorRect { x: 1920, y: 0, width: 2560, height: 1440 };
    const LEFT_OF_PRIMARY: MonitorRect = MonitorRect { x: -1280, y: 100, width: 1280, height: 1024 };

    fn saved(x: i32, y: i32, width: u32, height: u32) -> SavedState {
        SavedState { enabled: true, has_geometry: true, x, y, width, height, maximized: false }
    }

    /// @spec RF-42
    #[test]
    fn una_ventana_dentro_de_un_monitor_se_restaura_tal_cual() {
        assert_eq!(
            plan_restore(&saved(100, 80, 1120, 760), &[FULL_HD]),
            Placement::At { x: 100, y: 80, width: 1120, height: 760 }
        );
    }

    /// @spec RF-42
    #[test]
    fn medio_fuera_por_la_derecha_se_restaura_si_la_barra_de_titulo_se_ve() {
        let plan = plan_restore(&saved(1500, 50, 1120, 760), &[FULL_HD]);
        assert_eq!(plan, Placement::At { x: 1500, y: 50, width: 1120, height: 760 });
    }

    /// @spec RF-42
    #[test]
    fn con_el_monitor_desenchufado_se_centra_en_el_que_queda() {
        // Estaba en el segundo monitor (x = 3000) y ya no existe.
        let plan = plan_restore(&saved(3000, 200, 1120, 760), &[FULL_HD]);
        assert_eq!(plan, Placement::Centered { width: 1120, height: 760 });
    }

    /// @spec RF-42
    #[test]
    fn una_posicion_en_otro_monitor_que_sigue_conectado_se_respeta() {
        let plan = plan_restore(&saved(3000, 200, 1120, 760), &[FULL_HD, SECOND]);
        assert_eq!(plan, Placement::At { x: 3000, y: 200, width: 1120, height: 760 });
    }

    /// @spec RF-42
    #[test]
    fn un_monitor_a_la_izquierda_con_coordenadas_negativas_funciona() {
        let plan = plan_restore(&saved(-1200, 150, 1000, 700), &[FULL_HD, LEFT_OF_PRIMARY]);
        assert_eq!(plan, Placement::At { x: -1200, y: 150, width: 1000, height: 700 });
    }

    /// @spec RF-42
    #[test]
    fn la_barra_de_titulo_fuera_por_arriba_no_vale() {
        // y = -500: toda la ventana (y su barra de título) está sobre el borde superior.
        let plan = plan_restore(&saved(100, -500, 1120, 760), &[FULL_HD]);
        assert_eq!(plan, Placement::Centered { width: 1120, height: 760 });
    }

    /// @spec RF-42
    #[test]
    fn solo_asoma_un_borde_de_la_ventana_por_la_derecha_no_vale() {
        // Quedan 40 px a la vista (< 100): inalcanzable en la práctica.
        let plan = plan_restore(&saved(1880, 50, 1120, 760), &[FULL_HD]);
        assert_eq!(plan, Placement::Centered { width: 1120, height: 760 });
    }

    /// @spec RF-42
    #[test]
    fn el_tamano_se_recorta_al_monitor() {
        let small = MonitorRect { x: 0, y: 0, width: 1366, height: 768 };
        let plan = plan_restore(&saved(10, 10, 2400, 1300), &[small]);
        assert_eq!(plan, Placement::At { x: 10, y: 10, width: 1366, height: 768 });
        let lost = plan_restore(&saved(5000, 10, 2400, 1300), &[small]);
        assert_eq!(lost, Placement::Centered { width: 1366, height: 768 });
    }

    /// @spec RF-42
    #[test]
    fn un_tamano_guardado_menor_que_el_minimo_sube_al_minimo() {
        let plan = plan_restore(&saved(0, 0, 100, 100), &[FULL_HD]);
        assert_eq!(plan, Placement::At { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT });
    }

    /// @spec RF-42
    #[test]
    fn con_la_preferencia_apagada_o_sin_geometria_o_sin_monitores_no_se_toca_nada() {
        let mut off = saved(100, 80, 1120, 760);
        off.enabled = false;
        assert_eq!(plan_restore(&off, &[FULL_HD]), Placement::Untouched);
        assert_eq!(plan_restore(&SavedState::default(), &[FULL_HD]), Placement::Untouched);
        assert_eq!(plan_restore(&saved(100, 80, 1120, 760), &[]), Placement::Untouched);
    }

    /// @spec RF-42
    #[test]
    fn maximizada_solo_se_anota_el_estado_y_se_conserva_la_geometria_normal() {
        let mut state = saved(100, 80, 1120, 760);
        apply_snapshot(&mut state, &Snapshot { maximized: true, position: Some((0, 0)), size: Some((1920, 1040)), ..Snapshot::default() });
        assert!(state.maximized);
        assert_eq!((state.x, state.y, state.width, state.height), (100, 80, 1120, 760));
        apply_snapshot(&mut state, &Snapshot { position: Some((5, 6)), size: Some((900, 700)), ..Snapshot::default() });
        assert!(!state.maximized);
        assert_eq!((state.x, state.y, state.width, state.height), (5, 6, 900, 700));
    }

    /// @spec RF-42
    #[test]
    fn minimizada_o_con_la_preferencia_apagada_no_cambia_nada() {
        let mut state = saved(100, 80, 1120, 760);
        apply_snapshot(&mut state, &Snapshot { minimized: true, position: Some((-32000, -32000)), size: Some((160, 28)), ..Snapshot::default() });
        assert_eq!(state, saved(100, 80, 1120, 760));
        state.enabled = false;
        apply_snapshot(&mut state, &Snapshot { position: Some((1, 2)), size: Some((900, 700)), ..Snapshot::default() });
        assert_eq!((state.x, state.y, state.width, state.height), (100, 80, 1120, 760));
    }

    /// @spec RF-42
    #[test]
    fn la_primera_geometria_marca_que_ya_hay_algo_que_restaurar() {
        let mut state = SavedState::default();
        apply_snapshot(&mut state, &Snapshot { position: Some((10, 20)), size: Some((1000, 700)), ..Snapshot::default() });
        assert!(state.has_geometry);
    }

    /// @spec RF-42
    #[test]
    fn el_estado_se_guarda_y_se_lee_igual() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub").join(FILE_NAME);
        let state = SavedState { enabled: true, has_geometry: true, x: -20, y: 30, width: 1300, height: 800, maximized: true };
        save_state(&path, &state).unwrap();
        assert_eq!(load_state(&path), state);
    }

    /// @spec RF-42
    #[test]
    fn un_fichero_ausente_o_corrupto_equivale_a_un_primer_arranque() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load_state(&dir.path().join("no-existe.json")), SavedState::default());
        let broken = dir.path().join("roto.json");
        fs::write(&broken, "{ esto no es json").unwrap();
        assert_eq!(load_state(&broken), SavedState::default());
    }

    /// @spec RF-42
    #[test]
    fn un_fichero_con_campos_de_mas_o_de_menos_se_lee_con_los_valores_por_defecto() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("parcial.json");
        fs::write(&path, r#"{"enabled": false, "futuro": 1}"#).unwrap();
        let state = load_state(&path);
        assert!(!state.enabled);
        assert!(!state.has_geometry);
    }
}
