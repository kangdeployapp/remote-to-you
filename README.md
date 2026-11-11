# RemoteDesk - Production-Grade Windows Remote Desktop Application

An AnyDesk / RustDesk equivalent high-performance Windows Remote Desktop application built with **Tauri v2 (Rust backend)** and **Next.js / React (TypeScript + Tailwind CSS)**.

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                RemoteDesk Client                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                       Next.js / React Frontend                              |  |
|  |   - AnyDesk-style Split View (This Desk / Remote Desk)                      |  |
|  |   - RemoteViewport with High-DPI Scaling & Normalized Coordinate Space     |  |
|  |   - Floating Control Bar (Displays, Special Key Chords, Fit Modes, Chat)    |  |
|  |   - Granular Permission Incoming Session Modal with Web Audio Chime         |  |
|  |   - Chunked P2P File Manager (64KB WebRTC DataChannel)                      |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |  Tauri v2 IPC                            |
|  +-----------------------------------------------------------------------------+  |
|  |                           Rust Native Core                                  |  |
|  |   - Screen Capture: DirectX 11 / DXGI Desktop Duplication API (60 FPS)      |  |
|  |   - Input Simulation: Win32 SendInput (Absolute coords, Scan codes)         |  |
|  |   - Clipboard Hook: AddClipboardFormatListener (UTF-16 Bi-directional)      |  |
|  |   - Session 0 Bridge: Windows Service, UAC Elevation, SendSAS               |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         |
                       WebRTC P2P (DTLS-SRTP Encryption)
                                         |
+-----------------------------------------------------------------------------------+
|                        Signaling & NAT Traversal Server                           |
|   - WebSocket Peer Addressing via 9-Digit ID (xxx xxx xxx)                        |
|   - SDP Offer / Answer Exchange & ICE Candidate Routing                           |
|   - STUN / TURN Fallback Relays                                                   |
+-----------------------------------------------------------------------------------+
```

---

## Native Windows Modules Implemented

### 1. Screen Capture Engine (`src-tauri/src/screen_capture.rs`)
- **DirectX 11 & DXGI Desktop Duplication**:
  - Initializes D3D11 hardware device with `D3D11_CREATE_DEVICE_BGRA_SUPPORT`.
  - Obtains `IDXGIOutputDuplication` to capture full screen frames directly from VRAM in under 16ms (60 FPS).
  - Copies GPU desktop resource into a CPU-accessible staging texture (`D3D11_USAGE_STAGING`).
  - High-performance GDI `BitBlt` fallback for older systems or display mode changes.
- **High-DPI Awareness**:
  - Configured with `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)`.
  - Multi-monitor detection via DXGI Adapters/Outputs and GDI `EnumDisplayMonitors`.

### 2. Native Input Simulation (`src-tauri/src/input_simulator.rs`)
- **Normalized Coordinate Translation**:
  - Translates normalized viewport coordinates (`0.0` to `1.0`) into Win32 Virtual Desktop absolute coordinates (`0` to `65535`) using `SM_CXVIRTUALSCREEN`, `SM_CYVIRTUALSCREEN`, `SM_XVIRTUALSCREEN`, and `SM_YVIRTUALSCREEN`.
  - Dispatches `MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK | MOUSEEVENTF_MOVE`.
- **Hardware Mouse & Keyboard Events**:
  - Mouse down, up, and clicks for Left, Right, and Middle buttons.
  - Mouse wheel delta scaling via `MOUSEEVENTF_WHEEL` and `MOUSEEVENTF_HWHEEL`.
  - Keyboard scan code injection via `KEYEVENTF_SCANCODE` using `MapVirtualKeyW`.
- **Special Windows Key Chords**:
  - Windows Key (`VK_LWIN`), `Alt + Tab`, `Win + D`, `Win + L`, `Ctrl + C`, `Ctrl + V`, Task Manager (`Ctrl + Shift + Esc`).
  - Secure Attention Sequence (Ctrl+Alt+Del) via Windows Service SAS routine (`SendSAS`).

### 3. Native Clipboard Synchronization (`src-tauri/src/clipboard.rs`)
- Registers system-wide clipboard listener via `AddClipboardFormatListener`.
- Dedicated hidden Win32 message-loop window handling `WM_CLIPBOARDUPDATE`.
- Reads and writes UTF-16 Unicode text (`CF_UNICODETEXT`) using `GlobalAlloc` and `GlobalLock`.
- Echo suppression hash checks prevent infinite ping-pong loops between host and client.

### 4. Windows Service & Session 0 Architecture (`src-tauri/src/service.rs`)
- Architects the Session 0 isolation bridge:
  - Background Service runs as `NT AUTHORITY\SYSTEM` in Session 0.
  - Interacts with active user sessions via `WTSGetActiveConsoleSessionId` and `CreateProcessAsUserW`.
  - Switches to Secure Desktop (`Winlogon`) during UAC prompts via `OpenInputDesktop` and `SetThreadDesktop`.
  - Invokes `SendSAS(FALSE)` to inject Ctrl+Alt+Del without hardware keyboard physical interaction.

---

## Directory Structure

```
remote_to_you/
├── src-tauri/                  # Tauri v2 native Rust backend
│   ├── Cargo.toml              # Rust crate dependencies & Windows API features
│   ├── tauri.conf.json         # Tauri v2 configuration, MSI/NSIS bundling, tray icon
│   ├── build.rs                # Tauri build script
│   ├── capabilities/           # Security permissions
│   │   └── default.json
│   ├── icons/                  # Windows app icons (.ico, .png)
│   └── src/
│       ├── main.rs             # Tauri command handlers & System Tray integration
│       ├── screen_capture.rs   # DXGI Desktop Duplication capture pipeline
│       ├── input_simulator.rs  # Win32 SendInput dispatching & coordinate mapping
│       ├── clipboard.rs        # AddClipboardFormatListener & Win32 clipboard sync
│       └── service.rs          # Windows Service, Session 0, UAC & SAS injection
├── src/                        # Next.js / React TypeScript frontend
│   ├── app/
│   │   ├── globals.css         # Tailwind dark theme styling
│   │   ├── layout.tsx          # Root shell layout
│   │   └── page.tsx            # Main remote desktop dashboard & active session view
│   ├── components/
│   │   ├── RemoteViewport.tsx  # Canvas viewport with DPI compensation
│   │   ├── FloatingControlBar.tsx # In-session top toolbar (Keys, Monitors, Fit)
│   │   ├── IncomingSessionModal.tsx # Audio alert chime & permission toggles
│   │   ├── FileManagerModal.tsx # WebRTC DataChannel chunked file explorer
│   │   ├── ChatDrawer.tsx      # In-session real-time text chat
│   │   ├── ThisDeskCard.tsx    # "This Desk" 9-digit ID & one-time password
│   │   └── RemoteDeskCard.tsx  # "Remote Desk" connect input & history
│   ├── hooks/
│   │   └── useWebRTC.ts        # P2P connection, DataChannels & ICE state machine
│   ├── lib/
│   │   ├── utils.ts            # Formatting helpers
│   │   └── tauriBridge.ts      # Tauri IPC bridge with browser mock fallback
│   └── types/
│       └── index.ts            # TypeScript data contracts
├── server/
│   └── signaling_server.js     # Standalone WebSocket Signaling Server (Port 9002)
├── installer/
│   └── inno_setup.iss          # Inno Setup 64-bit installer script
├── package.json
└── tailwind.config.js
```

---

## Quickstart & Execution

### 1. Start the WebSocket Signaling Server
```bash
npm run signaling
# Runs on ws://0.0.0.0:9002
```

### 2. Run the Application in Development Mode
```bash
# Frontend preview & dev server:
npm run dev

# Native Tauri Desktop App:
npm run tauri dev
```

### 3. Build Windows Executables & Installers
```bash
# Build production Next.js frontend:
npm run build

# Build native Windows binaries (NSIS & MSI):
npm run tauri build
```
The compiled setup files will be placed in:
`src-tauri/target/release/bundle/nsis/` (NSIS Installer) and `bundle/msi/` (WiX MSI Installer).
