/**
 * Safe Tauri v2 IPC Bridge
 * Wraps `@tauri-apps/api/core` invoke with web fallbacks for universal development and testing.
 */

let tauriCore: any = null;

async function getTauriCore() {
  if (typeof window === 'undefined') return null;
  if (!tauriCore && (window as any).__TAURI_INTERNALS__) {
    try {
      tauriCore = await import('@tauri-apps/api/core');
    } catch (e) {
      console.warn('Tauri core import failed', e);
    }
  }
  return tauriCore;
}

export async function safeInvoke<T = any>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const core = await getTauriCore();
  if (core && core.invoke) {
    return core.invoke(cmd, args);
  }

  // Web fallback mocks for browser testing
  console.log(`[Tauri Mock Invoke] ${cmd}`, args);

  switch (cmd) {
    case 'get_system_info':
      return {
        os_name: 'Windows 11 Pro (64-bit)',
        architecture: 'x86_64',
        hostname: 'WIN-DESK-PRODUCTION',
        is_elevated: false,
        active_session_id: 1,
      } as unknown as T;

    case 'get_session_credentials':
      return {
        client_id: '492 810 234',
        one_time_password: 'K7X9PQ',
      } as unknown as T;

    case 'get_monitors':
      return [
        {
          id: 0,
          name: '\\\\.\\DISPLAY1 (Primary)',
          width: 1920,
          height: 1080,
          x: 0,
          y: 0,
          is_primary: true,
          scale_factor: 1.0,
        },
        {
          id: 1,
          name: '\\\\.\\DISPLAY2 (Extended)',
          width: 2560,
          height: 1440,
          x: 1920,
          y: 0,
          is_primary: false,
          scale_factor: 1.25,
        },
      ] as unknown as T;

    case 'capture_frame':
      return {
        width: 1920,
        height: 1080,
        format: 'image/jpeg',
        data_base64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="50%" fill="%2394a3b8" font-size="32" font-family="sans-serif" text-anchor="middle">Windows Desktop DirectX Frame Stream</text></svg>',
        timestamp_ms: Date.now(),
      } as unknown as T;

    case 'simulate_mouse_move':
    case 'simulate_mouse_click':
    case 'simulate_mouse_wheel':
    case 'simulate_key_event':
    case 'simulate_special_key':
    case 'set_clipboard_text':
      return undefined as unknown as T;

    case 'get_clipboard_text':
      return 'Mock clipboard text' as unknown as T;

    case 'get_service_status':
      return {
        is_installed: true,
        is_running: true,
        is_elevated: false,
        active_session_id: 1,
        secure_desktop_active: false,
      } as unknown as T;

    case 'request_uac_elevation':
      alert('Requested UAC elevation prompt from Windows Service Manager');
      return undefined as unknown as T;

    case 'send_sas_sequence':
      alert('Sent Secure Attention Sequence (Ctrl+Alt+Del)');
      return undefined as unknown as T;

    default:
      return undefined as unknown as T;
  }
}
