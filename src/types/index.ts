export interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
  scale_factor: number;
}

export interface CaptureFrame {
  width: number;
  height: number;
  format: string;
  data_base64: string;
  timestamp_ms: number;
}

export interface MouseMovePayload {
  x: number; // 0.0 to 1.0 normalized
  y: number; // 0.0 to 1.0 normalized
  monitor_id?: number;
}

export interface MouseClickPayload {
  x: number;
  y: number;
  button: 'left' | 'right' | 'middle';
  action: 'down' | 'up' | 'click';
}

export interface MouseWheelPayload {
  delta_x: number;
  delta_y: number;
}

export interface KeyEventPayload {
  code: string;
  vk?: number;
  state: 'keydown' | 'keyup';
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type SpecialKeyChord =
  | 'ctrl_alt_del'
  | 'alt_tab'
  | 'win'
  | 'win_d'
  | 'win_l'
  | 'ctrl_c'
  | 'ctrl_v'
  | 'task_manager';

export interface SessionPermissions {
  allowKeyboardMouse: boolean;
  allowClipboard: boolean;
  allowFileTransfer: boolean;
  allowAudio: boolean;
}

export interface IncomingSessionRequest {
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface SystemInfo {
  os_name: string;
  architecture: string;
  hostname: string;
  is_elevated: boolean;
  active_session_id: number;
}

export interface ServiceStatus {
  is_installed: boolean;
  is_running: boolean;
  is_elevated: boolean;
  active_session_id: number;
  secure_desktop_active: boolean;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface FileTransferProgress {
  fileId: string;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  percentage: number;
  direction: 'upload' | 'download';
  status: 'pending' | 'transferring' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
}
