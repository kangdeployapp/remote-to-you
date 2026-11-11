'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  MousePointer,
  ClipboardCheck,
  FolderDown,
  Volume2,
  Check,
  X,
  Laptop,
} from 'lucide-react';
import { IncomingSessionRequest, SessionPermissions } from '@/types';

interface IncomingSessionModalProps {
  request: IncomingSessionRequest;
  onAccept: (permissions: SessionPermissions) => void;
  onReject: () => void;
}

export const IncomingSessionModal: React.FC<IncomingSessionModalProps> = ({
  request,
  onAccept,
  onReject,
}) => {
  const [permissions, setPermissions] = useState<SessionPermissions>({
    allowKeyboardMouse: true,
    allowClipboard: true,
    allowFileTransfer: true,
    allowAudio: false,
  });

  // Audio chime alert using Web Audio API
  useEffect(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      // Audio autoplay may be restricted
    }
  }, []);

  const togglePermission = (key: keyof SessionPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/40 via-surface-elevated to-blue-900/40 p-5 border-b border-border flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Incoming Connection Request</h3>
            <p className="text-xs text-gray-400">A remote user wants to control this desk</p>
          </div>
        </div>

        {/* Remote Peer Details */}
        <div className="p-5 space-y-4">
          <div className="flex items-center space-x-3 bg-surface p-3.5 rounded-lg border border-border">
            <div className="w-10 h-10 rounded-lg bg-surface-card border border-border flex items-center justify-center text-gray-300">
              <Laptop className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{request.senderName}</div>
              <div className="text-xs font-mono text-gray-400">{request.senderId}</div>
            </div>
            <span className="text-[10px] text-gray-500">
              {new Date(request.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Granular Permission Toggles */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Access Permissions
            </div>

            {/* Keyboard & Mouse */}
            <div
              onClick={() => togglePermission('allowKeyboardMouse')}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                permissions.allowKeyboardMouse
                  ? 'bg-blue-600/10 border-blue-500/30 text-white'
                  : 'bg-surface border-border text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <MousePointer className="w-4 h-4 text-blue-400" />
                <span>Control Keyboard and Mouse</span>
              </div>
              <input
                type="checkbox"
                checked={permissions.allowKeyboardMouse}
                readOnly
                className="rounded border-gray-600 text-blue-600 focus:ring-0"
              />
            </div>

            {/* Clipboard Sync */}
            <div
              onClick={() => togglePermission('allowClipboard')}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                permissions.allowClipboard
                  ? 'bg-blue-600/10 border-blue-500/30 text-white'
                  : 'bg-surface border-border text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                <span>Synchronize Clipboard (Copy / Paste)</span>
              </div>
              <input
                type="checkbox"
                checked={permissions.allowClipboard}
                readOnly
                className="rounded border-gray-600 text-blue-600 focus:ring-0"
              />
            </div>

            {/* File Transfer */}
            <div
              onClick={() => togglePermission('allowFileTransfer')}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                permissions.allowFileTransfer
                  ? 'bg-blue-600/10 border-blue-500/30 text-white'
                  : 'bg-surface border-border text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <FolderDown className="w-4 h-4 text-amber-400" />
                <span>Allow File Transfer</span>
              </div>
              <input
                type="checkbox"
                checked={permissions.allowFileTransfer}
                readOnly
                className="rounded border-gray-600 text-blue-600 focus:ring-0"
              />
            </div>

            {/* Audio Transmission */}
            <div
              onClick={() => togglePermission('allowAudio')}
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                permissions.allowAudio
                  ? 'bg-blue-600/10 border-blue-500/30 text-white'
                  : 'bg-surface border-border text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>Transmit System Audio</span>
              </div>
              <input
                type="checkbox"
                checked={permissions.allowAudio}
                readOnly
                className="rounded border-gray-600 text-blue-600 focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-surface border-t border-border flex items-center justify-end space-x-3">
          <button
            onClick={onReject}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Reject</span>
          </button>
          <button
            onClick={() => onAccept(permissions)}
            className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Accept Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
