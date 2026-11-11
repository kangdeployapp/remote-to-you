'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Shield, Radio, Check, RotateCcw, Globe } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSignalingUrl: string;
  onSaveSignalingUrl: (url: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSignalingUrl,
  onSaveSignalingUrl,
}) => {
  const [url, setUrl] = useState(currentSignalingUrl);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setUrl(currentSignalingUrl);
  }, [currentSignalingUrl]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    onSaveSignalingUrl(cleanUrl);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setUrl('ws://localhost:9002');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Network & Relay Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          <div>
            <label className="block text-gray-300 font-semibold mb-1 text-xs">
              Signaling & Rendezvous Server URL
            </label>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
              To remote across different networks (Internet/Cross-city), enter your public WebSocket server URL (e.g. from Render, VPS, or ngrok).
            </p>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://localhost:9002 or wss://your-relay.domain.com"
                className="w-full bg-surface border border-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Quick Presets
            </div>
            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => setUrl('ws://localhost:9002')}
                className="p-2.5 rounded-lg border border-border bg-surface hover:bg-surface-card transition-colors flex items-center space-x-2 text-gray-300"
              >
                <Radio className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-[11px]">Local / LAN Only</div>
                  <div className="text-[10px] text-gray-500 truncate">ws://localhost:9002</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUrl('wss://remote-to-you.onrender.com')}
                className="p-2.5 rounded-lg border border-border bg-surface hover:bg-surface-card transition-colors flex items-center space-x-2 text-gray-300"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-[11px]">Public Cloud Relay</div>
                  <div className="text-[10px] text-gray-500 truncate">wss://remote-to-you...</div>
                </div>
              </button>
            </div>
          </div>

          {/* NAT Traversal (STUN / TURN) info */}
          <div className="p-3 bg-surface rounded-lg border border-border space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-[11px]">
              <Shield className="w-3.5 h-3.5" />
              <span>NAT Traversal & Encryption</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Active STUN: <code className="text-gray-300">stun.l.google.com:19302</code>. All screen frames, keystrokes, and files are end-to-end encrypted with DTLS-SRTP.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-border">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface hover:bg-surface-card border border-border text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                {savedToast ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
                <span>{savedToast ? 'Saved & Reconnected!' : 'Save & Connect'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
