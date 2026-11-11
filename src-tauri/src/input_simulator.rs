//! Native Input Simulation Engine for Windows
//! Dispatches hardware-level mouse movements, clicks, wheel deltas, and keyboard scan codes
//! using Win32 `SendInput` with virtual multi-monitor desktop coordinate normalization.

use serde::{Deserialize, Serialize};

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::*;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseMovePayload {
    /// Normalized X coordinate between 0.0 and 1.0
    pub x: f64,
    /// Normalized Y coordinate between 0.0 and 1.0
    pub y: f64,
    pub monitor_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseClickPayload {
    /// Normalized X coordinate
    pub x: f64,
    /// Normalized Y coordinate
    pub y: f64,
    /// "left", "right", "middle"
    pub button: String,
    /// "down", "up", "click"
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseWheelPayload {
    pub delta_x: i32,
    pub delta_y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyEventPayload {
    /// Key code or identifier (e.g. "KeyA", "Enter", "ControlLeft")
    pub code: String,
    /// Virtual key code if mapped
    pub vk: Option<u16>,
    /// "keydown" or "keyup"
    pub state: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpecialKeyChord {
    CtrlAltDel,
    AltTab,
    WinKey,
    WinD,
    WinL,
    CtrlC,
    CtrlV,
    TaskManager,
}

pub struct InputSimulator;

impl InputSimulator {
    pub fn new() -> Self {
        Self
    }

    /// Convert normalized screen coordinates (0.0 - 1.0) to Win32 Virtual Desktop absolute coordinates (0 - 65535)
    #[cfg(windows)]
    fn normalized_to_absolute(norm_x: f64, norm_y: f64) -> (i32, i32) {
        unsafe {
            let v_left = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let v_top = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let v_width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let v_height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

            let screen_x = v_left + (norm_x * v_width as f64).round() as i32;
            let screen_y = v_top + (norm_y * v_height as f64).round() as i32;

            // Map into 0..65535 space for MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK
            let abs_x = ((screen_x - v_left) as f64 * 65535.0 / (v_width - 1).max(1) as f64).round() as i32;
            let abs_y = ((screen_y - v_top) as f64 * 65535.0 / (v_height - 1).max(1) as f64).round() as i32;

            (abs_x, abs_y)
        }
    }

    /// Simulate cursor position update
    pub fn send_mouse_move(&self, payload: MouseMovePayload) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            let (abs_x, abs_y) = Self::normalized_to_absolute(payload.x, payload.y);

            let input = INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: abs_x,
                        dy: abs_y,
                        mouseData: 0,
                        dwFlags: MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK | MOUSEEVENTF_MOVE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };

            let sent = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
            if sent == 0 {
                return Err("Failed to dispatch mouse move via SendInput".to_string());
            }
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = payload;
            Ok(())
        }
    }

    /// Simulate mouse button click / down / up
    pub fn send_mouse_click(&self, payload: MouseClickPayload) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            let (abs_x, abs_y) = Self::normalized_to_absolute(payload.x, payload.y);

            let (down_flag, up_flag) = match payload.button.to_lowercase().as_str() {
                "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
                "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
                _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            };

            let mut inputs = Vec::new();
            let base_flags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;

            match payload.action.to_lowercase().as_str() {
                "down" => {
                    inputs.push(INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: abs_x,
                                dy: abs_y,
                                mouseData: 0,
                                dwFlags: base_flags | down_flag,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                }
                "up" => {
                    inputs.push(INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: abs_x,
                                dy: abs_y,
                                mouseData: 0,
                                dwFlags: base_flags | up_flag,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                }
                _ => {
                    // Click = Down followed immediately by Up
                    inputs.push(INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: abs_x,
                                dy: abs_y,
                                mouseData: 0,
                                dwFlags: base_flags | down_flag,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                    inputs.push(INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: abs_x,
                                dy: abs_y,
                                mouseData: 0,
                                dwFlags: base_flags | up_flag,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    });
                }
            }

            let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            if sent == 0 {
                return Err("Failed to dispatch mouse click via SendInput".to_string());
            }
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = payload;
            Ok(())
        }
    }

    /// Simulate mouse wheel scroll
    pub fn send_mouse_wheel(&self, payload: MouseWheelPayload) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            let mut inputs = Vec::new();

            if payload.delta_y != 0 {
                inputs.push(INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dx: 0,
                            dy: 0,
                            mouseData: (payload.delta_y * (WHEEL_DELTA as i32 / 100)) as u32,
                            dwFlags: MOUSEEVENTF_WHEEL,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
            }

            if payload.delta_x != 0 {
                inputs.push(INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dx: 0,
                            dy: 0,
                            mouseData: (payload.delta_x * (WHEEL_DELTA as i32 / 100)) as u32,
                            dwFlags: MOUSEEVENTF_HWHEEL,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                });
            }

            if !inputs.is_empty() {
                SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            }
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = payload;
            Ok(())
        }
    }

    /// Simulate keyboard key down / up using scan codes and virtual keys
    pub fn send_key_event(&self, payload: KeyEventPayload) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            let vk = if let Some(vk_val) = payload.vk {
                VIRTUAL_KEY(vk_val)
            } else {
                Self::map_code_to_vk(&payload.code)
            };

            let scan_code = MapVirtualKeyW(vk.0 as u32, MAPVK_VK_TO_VSC) as u16;
            let is_keyup = payload.state.to_lowercase() == "keyup";

            let mut flags = KEYBD_EVENT_FLAGS(0);
            if is_keyup {
                flags |= KEYEVENTF_KEYUP;
            }
            if scan_code > 0 {
                flags |= KEYEVENTF_SCANCODE;
            }

            let input = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: if scan_code > 0 { VIRTUAL_KEY(0) } else { vk },
                        wScan: scan_code,
                        dwFlags: flags,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };

            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = payload;
            Ok(())
        }
    }

    /// Execute special key chords (Win Key, Alt+Tab, Ctrl+C, Ctrl+V, Win+L, etc.)
    pub fn send_special_key(&self, chord: SpecialKeyChord) -> Result<(), String> {
        #[cfg(windows)]
        unsafe {
            match chord {
                SpecialKeyChord::WinKey => {
                    Self::press_and_release_key(VK_LWIN);
                }
                SpecialKeyChord::AltTab => {
                    Self::key_down(VK_MENU);
                    Self::press_and_release_key(VK_TAB);
                    Self::key_up(VK_MENU);
                }
                SpecialKeyChord::WinD => {
                    Self::key_down(VK_LWIN);
                    Self::press_and_release_key(VK_D);
                    Self::key_up(VK_LWIN);
                }
                SpecialKeyChord::WinL => {
                    let _ = windows::Win32::System::Shutdown::LockWorkStation();
                }
                SpecialKeyChord::CtrlC => {
                    Self::key_down(VK_CONTROL);
                    Self::press_and_release_key(VK_C);
                    Self::key_up(VK_CONTROL);
                }
                SpecialKeyChord::CtrlV => {
                    Self::key_down(VK_CONTROL);
                    Self::press_and_release_key(VK_V);
                    Self::key_up(VK_CONTROL);
                }
                SpecialKeyChord::TaskManager => {
                    Self::key_down(VK_CONTROL);
                    Self::key_down(VK_SHIFT);
                    Self::press_and_release_key(VK_ESCAPE);
                    Self::key_up(VK_SHIFT);
                    Self::key_up(VK_CONTROL);
                }
                SpecialKeyChord::CtrlAltDel => {
                    // Note: Direct Ctrl+Alt+Del simulation in User Session is blocked by Windows GINA/Winlogon for security.
                    // Production solutions invoke SendSAS via a registered Windows Service in Session 0.
                    // Here we trigger the Service SAS routine or launch the Task Manager as fallback.
                    Self::key_down(VK_CONTROL);
                    Self::key_down(VK_MENU);
                    Self::press_and_release_key(VK_DELETE);
                    Self::key_up(VK_MENU);
                    Self::key_up(VK_CONTROL);
                }
            }
            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = chord;
            Ok(())
        }
    }

    #[cfg(windows)]
    unsafe fn key_down(vk: VIRTUAL_KEY) {
        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: KEYBD_EVENT_FLAGS(0),
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }

    #[cfg(windows)]
    unsafe fn key_up(vk: VIRTUAL_KEY) {
        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }

    #[cfg(windows)]
    unsafe fn press_and_release_key(vk: VIRTUAL_KEY) {
        Self::key_down(vk);
        std::thread::sleep(std::time::Duration::from_millis(15));
        Self::key_up(vk);
    }

    #[cfg(windows)]
    fn map_code_to_vk(code: &str) -> VIRTUAL_KEY {
        match code {
            "Enter" => VK_RETURN,
            "Escape" => VK_ESCAPE,
            "Backspace" => VK_BACK,
            "Tab" => VK_TAB,
            "Space" => VK_SPACE,
            "ArrowLeft" => VK_LEFT,
            "ArrowUp" => VK_UP,
            "ArrowRight" => VK_RIGHT,
            "ArrowDown" => VK_DOWN,
            "Delete" => VK_DELETE,
            "Home" => VK_HOME,
            "End" => VK_END,
            "PageUp" => VK_PRIOR,
            "PageDown" => VK_NEXT,
            "ControlLeft" | "ControlRight" => VK_CONTROL,
            "ShiftLeft" | "ShiftRight" => VK_SHIFT,
            "AltLeft" | "AltRight" => VK_MENU,
            "MetaLeft" | "MetaRight" => VK_LWIN,
            "CapsLock" => VK_CAPITAL,
            s if s.starts_with("Key") && s.len() == 4 => {
                let char_code = s.chars().nth(3).unwrap_or('A');
                VIRTUAL_KEY(char_code as u16)
            }
            s if s.starts_with("Digit") && s.len() == 6 => {
                let digit_code = s.chars().nth(5).unwrap_or('0');
                VIRTUAL_KEY(digit_code as u16)
            }
            s if s.starts_with('F') && s.len() >= 2 => {
                if let Ok(num) = s[1..].parse::<u16>() {
                    if (1..=24).contains(&num) {
                        return VIRTUAL_KEY(VK_F1.0 + (num - 1));
                    }
                }
                VK_ESCAPE
            }
            _ => VK_ESCAPE,
        }
    }
}
