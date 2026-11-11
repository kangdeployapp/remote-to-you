//! Windows Native Clipboard Synchronization Engine
//! Listens for system clipboard modifications using `AddClipboardFormatListener`,
//! extracts UTF-16 Unicode text, and syncs bidirectionally with echo-suppression.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use windows::{
    core::*,
    Win32::Foundation::*,
    Win32::System::DataExchange::*,
    Win32::System::LibraryLoader::GetModuleHandleW,
    Win32::System::Memory::*,
    Win32::UI::WindowsAndMessaging::*,
};

const CF_UNICODETEXT_ID: u32 = 13;

pub struct ClipboardManager {
    last_synced_hash: Arc<Mutex<u64>>,
    is_running: Arc<AtomicBool>,
}

impl ClipboardManager {
    pub fn new() -> Self {
        Self {
            last_synced_hash: Arc::new(Mutex::new(0)),
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Read plain text currently stored in the Windows System Clipboard
    pub fn get_text(&self) -> std::result::Result<String, String> {
        #[cfg(windows)]
        unsafe {
            if OpenClipboard(HWND::default()).is_err() {
                return Err("Failed to open Windows Clipboard".to_string());
            }

            let handle = match GetClipboardData(CF_UNICODETEXT_ID) {
                Ok(h) if !h.is_invalid() => h,
                _ => {
                    let _ = CloseClipboard();
                    return Ok(String::new());
                }
            };

            let ptr = GlobalLock(HGLOBAL(handle.0));
            if ptr.is_null() {
                let _ = CloseClipboard();
                return Err("Failed to lock global clipboard memory".to_string());
            }

            let wide_slice = {
                let mut len = 0;
                let wide_ptr = ptr as *const u16;
                while *wide_ptr.add(len) != 0 {
                    len += 1;
                }
                std::slice::from_raw_parts(wide_ptr, len)
            };

            let text = String::from_utf16_lossy(wide_slice);

            let _ = GlobalUnlock(HGLOBAL(handle.0));
            let _ = CloseClipboard();

            Ok(text)
        }

        #[cfg(not(windows))]
        {
            Ok("Mock clipboard content".to_string())
        }
    }

    /// Inject remote text into the local Windows Clipboard without triggering a broadcast echo
    pub fn set_text(&self, text: &str) -> std::result::Result<(), String> {
        // Calculate hash to ignore incoming WM_CLIPBOARDUPDATE notification
        let hash = Self::calculate_hash(text);
        *self.last_synced_hash.lock() = hash;

        #[cfg(windows)]
        unsafe {
            if OpenClipboard(HWND::default()).is_err() {
                return Err("Failed to open Windows Clipboard for writing".to_string());
            }

            if EmptyClipboard().is_err() {
                let _ = CloseClipboard();
                return Err("Failed to empty Windows Clipboard".to_string());
            }

            let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
            let byte_count = utf16.len() * std::mem::size_of::<u16>();

            let hmem = match GlobalAlloc(GMEM_MOVEABLE, byte_count) {
                Ok(h) if !h.is_invalid() => h,
                _ => {
                    let _ = CloseClipboard();
                    return Err("Failed to allocate global memory for clipboard".to_string());
                }
            };

            let locked = GlobalLock(hmem);
            if locked.is_null() {
                let _ = GlobalFree(hmem);
                let _ = CloseClipboard();
                return Err("Failed to lock memory for clipboard write".to_string());
            }

            std::ptr::copy_nonoverlapping(utf16.as_ptr() as *const u8, locked as *mut u8, byte_count);
            let _ = GlobalUnlock(hmem);

            if SetClipboardData(CF_UNICODETEXT_ID, HANDLE(hmem.0)).is_err() {
                let _ = GlobalFree(hmem);
                let _ = CloseClipboard();
                return Err("SetClipboardData Win32 call failed".to_string());
            }

            let _ = CloseClipboard();
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = text;
            Ok(())
        }
    }

    /// Spawns a dedicated Win32 message-only window thread to listen for `WM_CLIPBOARDUPDATE`
    pub fn start_listener(&self, app_handle: AppHandle) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let is_running = self.is_running.clone();
        let last_hash = self.last_synced_hash.clone();

        std::thread::spawn(move || {
            #[cfg(windows)]
            unsafe {
                let class_name = w!("RemoteDeskClipboardListener");
                let hinstance = GetModuleHandleW(None).unwrap_or_default();
                let wnd_class = WNDCLASSW {
                    lpfnWndProc: Some(Self::wnd_proc),
                    hInstance: hinstance.into(),
                    lpszClassName: class_name,
                    ..Default::default()
                };

                RegisterClassW(&wnd_class);

                let hwnd_res = CreateWindowExW(
                    WINDOW_EX_STYLE::default(),
                    class_name,
                    w!("RemoteDeskClipboardHidden"),
                    WS_OVERLAPPED,
                    0, 0, 0, 0,
                    HWND_MESSAGE,
                    HMENU::default(),
                    hinstance,
                    None,
                );

                let hwnd = match hwnd_res {
                    Ok(h) if !h.0.is_null() => h,
                    _ => {
                        log::error!("Failed to create clipboard listener message window");
                        is_running.store(false, Ordering::SeqCst);
                        return;
                    }
                };

                if AddClipboardFormatListener(hwnd).is_err() {
                    log::error!("Failed to register clipboard format listener");
                    let _ = DestroyWindow(hwnd);
                    is_running.store(false, Ordering::SeqCst);
                    return;
                }

                log::info!("Windows Clipboard format listener registered successfully");

                let mut msg = MSG::default();
                while is_running.load(Ordering::SeqCst) && GetMessageW(&mut msg, HWND::default(), 0, 0).as_bool() {
                    if msg.message == WM_CLIPBOARDUPDATE {
                        // Read current clipboard text
                        if let Ok(current_text) = Self::read_raw_clipboard() {
                            let new_hash = Self::calculate_hash(&current_text);
                            let mut guard = last_hash.lock();
                            if *guard != new_hash && !current_text.is_empty() {
                                *guard = new_hash;
                                // Emit clipboard event to Tauri frontend to forward to WebRTC DataChannel
                                let _ = app_handle.emit("clipboard-changed", current_text);
                            }
                        }
                    }

                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                let _ = RemoveClipboardFormatListener(hwnd);
                let _ = DestroyWindow(hwnd);
            }
        });
    }

    #[cfg(windows)]
    unsafe fn read_raw_clipboard() -> std::result::Result<String, ()> {
        if OpenClipboard(HWND::default()).is_err() {
            return Err(());
        }

        let handle = match GetClipboardData(CF_UNICODETEXT_ID) {
            Ok(h) if !h.is_invalid() => h,
            _ => {
                let _ = CloseClipboard();
                return Err(());
            }
        };

        let ptr = GlobalLock(HGLOBAL(handle.0));
        if ptr.is_null() {
            let _ = CloseClipboard();
            return Err(());
        }

        let wide_slice = {
            let mut len = 0;
            let wide_ptr = ptr as *const u16;
            while *wide_ptr.add(len) != 0 {
                len += 1;
            }
            std::slice::from_raw_parts(wide_ptr, len)
        };

        let text = String::from_utf16_lossy(wide_slice);

        let _ = GlobalUnlock(HGLOBAL(handle.0));
        let _ = CloseClipboard();

        Ok(text)
    }

    #[cfg(windows)]
    unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    fn calculate_hash(s: &str) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        s.hash(&mut hasher);
        hasher.finish()
    }
}
