pub mod screen_capture;
pub mod input_simulator;
pub mod clipboard;
pub mod service;
pub mod signaling;

use signaling::SignalingServer;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use screen_capture::{CaptureFrame, MonitorInfo, ScreenCaptureEngine};
use input_simulator::{InputSimulator, KeyEventPayload, MouseClickPayload, MouseMovePayload, MouseWheelPayload, SpecialKeyChord};
use clipboard::ClipboardManager;
use service::{ServiceManager, ServiceStatus};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os_name: String,
    pub architecture: String,
    pub hostname: String,
    pub is_elevated: bool,
    pub active_session_id: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionCredentials {
    pub client_id: String,
    pub one_time_password: String,
}

struct AppState {
    capture_engine: ScreenCaptureEngine,
    input_simulator: InputSimulator,
    clipboard_mgr: ClipboardManager,
    service_mgr: ServiceManager,
    client_id: String,
    one_time_pwd: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let hostname = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows-PC".to_string());
    let is_elevated = ServiceManager::is_elevated();
    
    SystemInfo {
        os_name: "Windows 11 / Windows 10 (64-bit)".to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        hostname,
        is_elevated,
        active_session_id: 1,
    }
}

#[tauri::command]
fn get_session_credentials(state: State<'_, AppState>) -> SessionCredentials {
    SessionCredentials {
        client_id: state.client_id.clone(),
        one_time_password: state.one_time_pwd.clone(),
    }
}

#[tauri::command]
fn get_monitors(state: State<'_, AppState>) -> Vec<MonitorInfo> {
    state.capture_engine.enumerate_monitors()
}

#[tauri::command]
fn select_monitor(monitor_id: u32, state: State<'_, AppState>) {
    state.capture_engine.select_monitor(monitor_id);
}

#[tauri::command]
fn capture_frame(state: State<'_, AppState>) -> Result<CaptureFrame, String> {
    state.capture_engine.capture_frame().map_err(|e| e.to_string())
}

#[tauri::command]
fn simulate_mouse_move(payload: MouseMovePayload, state: State<'_, AppState>) -> Result<(), String> {
    state.input_simulator.send_mouse_move(payload)
}

#[tauri::command]
fn simulate_mouse_click(payload: MouseClickPayload, state: State<'_, AppState>) -> Result<(), String> {
    state.input_simulator.send_mouse_click(payload)
}

#[tauri::command]
fn simulate_mouse_wheel(payload: MouseWheelPayload, state: State<'_, AppState>) -> Result<(), String> {
    state.input_simulator.send_mouse_wheel(payload)
}

#[tauri::command]
fn simulate_key_event(payload: KeyEventPayload, state: State<'_, AppState>) -> Result<(), String> {
    state.input_simulator.send_key_event(payload)
}

#[tauri::command]
fn simulate_special_key(chord: String, state: State<'_, AppState>) -> Result<(), String> {
    let special = match chord.as_str() {
        "ctrl_alt_del" => SpecialKeyChord::CtrlAltDel,
        "alt_tab" => SpecialKeyChord::AltTab,
        "win" => SpecialKeyChord::WinKey,
        "win_d" => SpecialKeyChord::WinD,
        "win_l" => SpecialKeyChord::WinL,
        "ctrl_c" => SpecialKeyChord::CtrlC,
        "ctrl_v" => SpecialKeyChord::CtrlV,
        "task_manager" => SpecialKeyChord::TaskManager,
        _ => return Err(format!("Unknown key chord: {}", chord)),
    };
    state.input_simulator.send_special_key(special)
}

#[tauri::command]
fn get_clipboard_text(state: State<'_, AppState>) -> Result<String, String> {
    state.clipboard_mgr.get_text()
}

#[tauri::command]
fn set_clipboard_text(text: String, state: State<'_, AppState>) -> Result<(), String> {
    state.clipboard_mgr.set_text(&text)
}

#[tauri::command]
fn get_service_status(state: State<'_, AppState>) -> ServiceStatus {
    state.service_mgr.get_status()
}

#[tauri::command]
fn request_uac_elevation() -> Result<(), String> {
    ServiceManager::request_uac_elevation()
}

#[tauri::command]
fn send_sas_sequence() -> Result<(), String> {
    ServiceManager::trigger_secure_attention_sequence()
}

fn generate_random_id() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let num: u32 = rng.gen_range(100_000_000..999_999_999);
    let s = num.to_string();
    format!("{} {} {}", &s[0..3], &s[3..6], &s[6..9])
}

fn generate_random_password() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

pub fn run() {
    let signaling_server = SignalingServer::new();
    signaling_server.start(9002);

    let initial_id = generate_random_id();
    let initial_pwd = generate_random_password();

    let app_state = AppState {
        capture_engine: ScreenCaptureEngine::new(),
        input_simulator: InputSimulator::new(),
        clipboard_mgr: ClipboardManager::new(),
        service_mgr: ServiceManager::new(),
        client_id: initial_id.clone(),
        one_time_pwd: initial_pwd,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(move |app| {
            // Setup System Tray Icon
            let show_item = MenuItem::with_id(app, "show", "Show Remote to You", true, None::<&str>)?;
            let copy_id_item = MenuItem::with_id(app, "copy_id", format!("Copy ID ({})", initial_id), true, None::<&str>)?;
            let elevate_item = MenuItem::with_id(app, "elevate", "Restart as Administrator", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit Remote to You", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &copy_id_item, &elevate_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Remote to You - Listening for Connections")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "copy_id" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                let _ = state.clipboard_mgr.set_text(&state.client_id);
                            }
                        }
                        "elevate" => {
                            let _ = ServiceManager::request_uac_elevation();
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Start Windows native clipboard format listener in background
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            state.clipboard_mgr.start_listener(app_handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_session_credentials,
            get_monitors,
            select_monitor,
            capture_frame,
            simulate_mouse_move,
            simulate_mouse_click,
            simulate_mouse_wheel,
            simulate_key_event,
            simulate_special_key,
            get_clipboard_text,
            set_clipboard_text,
            get_service_status,
            request_uac_elevation,
            send_sas_sequence,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RemoteDesk application");
}
