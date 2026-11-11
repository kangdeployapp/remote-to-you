//! Windows System Service & Secure Desktop Unattended Access Module
//! Architects the Session 0 isolation bridge, UAC prompt traversal, and `SendSAS` injection.

use serde::{Deserialize, Serialize};

#[cfg(windows)]
use windows::{
    core::*,
    Win32::Foundation::*,
    Win32::System::Services::*,
    Win32::System::StationsAndDesktops::*,
    Win32::UI::WindowsAndMessaging::*,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub is_installed: bool,
    pub is_running: bool,
    pub is_elevated: bool,
    pub active_session_id: u32,
    pub secure_desktop_active: bool,
}

pub struct ServiceManager;

impl ServiceManager {
    pub fn new() -> Self {
        Self
    }

    /// Checks whether the current process is running with elevated Administrator privileges
    pub fn is_elevated() -> bool {
        #[cfg(windows)]
        unsafe {
            use windows::Win32::Security::*;
            use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
            let mut token = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_ok() {
                let mut elevation = TOKEN_ELEVATION::default();
                let mut return_length = 0;
                let success = GetTokenInformation(
                    token,
                    TokenElevation,
                    Some(&mut elevation as *mut _ as *mut _),
                    std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                    &mut return_length,
                );
                let _ = CloseHandle(token);
                if success.is_ok() {
                    return elevation.TokenIsElevated != 0;
                }
            }
            false
        }

        #[cfg(not(windows))]
        {
            false
        }
    }

    /// Returns current system unattended service status
    pub fn get_status(&self) -> ServiceStatus {
        let is_elevated = Self::is_elevated();
        let mut is_installed = false;
        let mut is_running = false;
        let active_session_id;
        let mut secure_desktop = false;

        #[cfg(windows)]
        unsafe {
            use windows::Win32::System::RemoteDesktop::WTSGetActiveConsoleSessionId;
            active_session_id = WTSGetActiveConsoleSessionId();

            // Check if service exists in SCM
            if let Ok(scm) = OpenSCManagerW(None, None, SC_MANAGER_CONNECT) {
                if let Ok(service) = OpenServiceW(scm, w!("RemoteDeskService"), SERVICE_QUERY_STATUS) {
                    is_installed = true;
                    let mut s_status = SERVICE_STATUS::default();
                    if QueryServiceStatus(service, &mut s_status).is_ok() {
                        is_running = s_status.dwCurrentState == SERVICE_RUNNING;
                    }
                    let _ = CloseServiceHandle(service);
                }
                let _ = CloseServiceHandle(scm);
            }

            // Check if current desktop is the Secure Desktop (Winlogon / UAC)
            if let Ok(input_desktop) = OpenInputDesktop(DESKTOP_CONTROL_FLAGS(0), false, DESKTOP_READOBJECTS) {
                let mut name_buffer = [0u16; 256];
                let mut needed = 0;
                if GetUserObjectInformationW(
                    HANDLE(input_desktop.0),
                    UOI_NAME,
                    Some(name_buffer.as_mut_ptr() as *mut _),
                    (name_buffer.len() * 2) as u32,
                    Some(&mut needed),
                ).is_ok() {
                    let name = String::from_utf16_lossy(&name_buffer);
                    if name.to_lowercase().contains("winlogon") {
                        secure_desktop = true;
                    }
                }
                let _ = CloseDesktop(input_desktop);
            }
        }

        ServiceStatus {
            is_installed,
            is_running,
            is_elevated,
            active_session_id,
            secure_desktop_active: secure_desktop,
        }
    }

    /// Relaunches the application requesting Administrator UAC prompt if not elevated
    pub fn request_uac_elevation() -> std::result::Result<(), String> {
        #[cfg(windows)]
        unsafe {
            use windows::Win32::UI::Shell::ShellExecuteW;
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_path_wide: Vec<u16> = current_exe.to_str().unwrap_or("").encode_utf16().chain(std::iter::once(0)).collect();

            let operation: Vec<u16> = "runas".encode_utf16().chain(std::iter::once(0)).collect();

            let h_instance = ShellExecuteW(
                HWND::default(),
                PCWSTR(operation.as_ptr()),
                PCWSTR(exe_path_wide.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            );

            if h_instance.0 as usize <= 32 {
                return Err("UAC elevation was cancelled or denied by the user".to_string());
            }

            Ok(())
        }

        #[cfg(not(windows))]
        {
            Ok(())
        }
    }

    /// Simulates SAS (Secure Attention Sequence / Ctrl+Alt+Del) via `SendSAS`
    /// Note: `SendSAS` requires the process to have `SeTcbPrivilege` or be registered as a service
    pub fn trigger_secure_attention_sequence() -> std::result::Result<(), String> {
        #[cfg(windows)]
        {
            // Dynamically load SendSAS from sas.dll (available in Windows Vista+)
            unsafe {
                use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
                let sas_lib = LoadLibraryW(w!("sas.dll"));
                if let Ok(module) = sas_lib {
                    let proc = GetProcAddress(module, windows::core::s!("SendSAS"));
                    if let Some(send_sas_fn) = proc {
                        type SendSasType = unsafe extern "system" fn(as_user: BOOL);
                        let send_sas: SendSasType = std::mem::transmute(send_sas_fn);
                        send_sas(BOOL(0));
                        return Ok(());
                    }
                }
            }
            Err("SendSAS is only accessible when running under SYSTEM service context".to_string())
        }

        #[cfg(not(windows))]
        {
            Ok(())
        }
    }
}
