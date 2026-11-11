'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Laptop,
  Shield,
  ShieldAlert,
  Server,
  Settings,
  Tv,
  HelpCircle,
  Cpu,
  Lock,
} from 'lucide-react';
import { MonitorInfo, SystemInfo } from '@/types';
import { safeInvoke } from '@/lib/tauriBridge';
import { useWebRTC } from '@/hooks/useWebRTC';
import { ThisDeskCard } from '@/components/ThisDeskCard';
import { RemoteDeskCard } from '@/components/RemoteDeskCard';
import { RemoteViewport } from '@/components/RemoteViewport';
import { FloatingControlBar } from '@/components/FloatingControlBar';
import { IncomingSessionModal } from '@/components/IncomingSessionModal';
import { FileManagerModal } from '@/components/FileManagerModal';
import { ChatDrawer } from '@/components/ChatDrawer';
import { SettingsModal } from '@/components/SettingsModal';

export default function Home() {
  const [clientId, setClientId] = useState('482 910 234');
  const [oneTimePassword, setOneTimePassword] = useState('X9K2PW');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState(0);

  // Viewport states
  const [fitMode, setFitMode] = useState<'fit' | 'stretch' | 'original'>('fit');
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [signalingUrl, setSignalingUrl] = useState('ws://localhost:9002');

  // Load saved signaling URL from localStorage if exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('remotetoyou_signaling_url');
      if (saved) setSignalingUrl(saved);
    }
  }, []);

  // Load native system info and credentials
  useEffect(() => {
    async function init() {
      try {
        const creds = await safeInvoke<{ client_id: string; one_time_password: string }>(
          'get_session_credentials'
        );
        if (creds) {
          setClientId(creds.client_id);
          setOneTimePassword(creds.one_time_password);
        }

        const sys = await safeInvoke<SystemInfo>('get_system_info');
        if (sys) setSystemInfo(sys);

        const mons = await safeInvoke<MonitorInfo[]>('get_monitors');
        if (mons) setMonitors(mons);
      } catch (err) {
        console.error('Failed to initialize Tauri session data', err);
      }
    }
    init();
  }, []);

  const handleTauriInvoke = useCallback(async (cmd: string, args?: any) => {
    return safeInvoke(cmd, args);
  }, []);

  // WebRTC Hook
  const {
    signalingStatus,
    sessionState,
    remotePeerId,
    incomingRequest,
    chatMessages,
    fileTransfers,
    remoteFrame,
    fps,
    latency,
    errorMessage,
    clearError,
    requestConnection,
    respondToIncomingSession,
    disconnectSession,
    sendMouseMove,
    sendMouseClick,
    sendMouseWheel,
    sendKeyEvent,
    sendSpecialKey,
    sendChatMessage,
    sendFile,
  } = useWebRTC({
    signalingUrl,
    clientId,
    oneTimePassword,
    onTauriInvoke: handleTauriInvoke,
  });

  const handleSaveSignalingUrl = (newUrl: string) => {
    setSignalingUrl(newUrl);
    if (typeof window !== 'undefined') {
      localStorage.setItem('remotetoyou_signaling_url', newUrl);
    }
  };

  const handleRegeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setOneTimePassword(res);
  };

  const handleRequestElevation = async () => {
    await safeInvoke('request_uac_elevation');
  };

  const handleSelectMonitor = async (id: number) => {
    setSelectedMonitor(id);
    await safeInvoke('select_monitor', { monitorId: id });
  };

  const handleToggleFitMode = () => {
    setFitMode((prev) => (prev === 'fit' ? 'stretch' : 'fit'));
  };

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Render Full Active Remote Session Viewport
  if (sessionState === 'connected') {
    return (
      <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
        {/* Floating Top Control Toolbar */}
        <FloatingControlBar
          remotePeerId={remotePeerId || 'Remote Host'}
          fps={fps}
          latency={latency}
          monitors={monitors}
          selectedMonitor={selectedMonitor}
          fitMode={fitMode}
          unreadChatCount={0}
          onSelectMonitor={handleSelectMonitor}
          onToggleFitMode={handleToggleFitMode}
          onToggleFullScreen={handleToggleFullScreen}
          onSendSpecialKey={sendSpecialKey}
          onOpenFileTransfer={() => setIsFileManagerOpen(true)}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onDisconnect={disconnectSession}
        />

        {/* Remote Screen Canvas */}
        <RemoteViewport
          remoteFrame={remoteFrame}
          remoteWidth={monitors[selectedMonitor]?.width || 1920}
          remoteHeight={monitors[selectedMonitor]?.height || 1080}
          fitMode={fitMode}
          onMouseMove={sendMouseMove}
          onMouseClick={sendMouseClick}
          onMouseWheel={sendMouseWheel}
          onKeyEvent={sendKeyEvent}
        />

        {/* File Manager Modal */}
        <FileManagerModal
          isOpen={isFileManagerOpen}
          onClose={() => setIsFileManagerOpen(false)}
          fileTransfers={fileTransfers}
          onSendFile={sendFile}
        />

        {/* In-Session Chat Drawer */}
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          onSendMessage={sendChatMessage}
        />
      </main>
    );
  }

  // Render Split-View Dashboard
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F17] text-gray-200 select-none">
      {/* Top Application Bar */}
      <header className="h-12 border-b border-border bg-surface flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <img
              src="/app-icon.png"
              alt="Remote to You"
              className="w-8 h-8 rounded-lg shadow-md border border-blue-500/30 object-cover"
            />
            <span className="font-bold text-white tracking-wide text-sm">Remote to You</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
            Windows Native v1.0
          </span>
        </div>

        {/* System & Elevation Status */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-surface-elevated border border-border">
            <Server className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[11px] text-gray-300">Signaling:</span>
            <span
              className={`w-2 h-2 rounded-full ${
                signalingStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </div>

          {systemInfo?.is_elevated ? (
            <div className="flex items-center space-x-1 text-emerald-400 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Mode</span>
            </div>
          ) : (
            <button
              onClick={handleRequestElevation}
              className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 text-xs px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Elevate UAC</span>
            </button>
          )}

          {/* Network Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-md bg-surface-elevated hover:bg-surface-card border border-border text-gray-400 hover:text-white transition-colors"
            title="Signaling & Relay Server Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Global Status / Error Alert Banner */}
      {errorMessage && (
        <div className="bg-red-500/15 border-b border-red-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-red-300 animate-in fade-in duration-150 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-white px-2 py-0.5 rounded hover:bg-red-500/20 text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto flex flex-col justify-between max-w-6xl mx-auto w-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Remote Desktop Console</h1>
              <p className="text-xs text-gray-400">
                DirectX DXGI Desktop Duplication + Win32 Native Hardware Input Simulation
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>DXGI 60 FPS</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>DTLS-SRTP P2P</span>
              </div>
            </div>
          </div>

          {/* AnyDesk Style Split-View Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ThisDeskCard
              clientId={clientId}
              oneTimePassword={oneTimePassword}
              signalingStatus={signalingStatus}
              systemInfo={systemInfo}
              onRegeneratePassword={handleRegeneratePassword}
              onRequestElevation={handleRequestElevation}
            />

            <RemoteDeskCard
              onConnect={requestConnection}
              isConnecting={sessionState === 'calling'}
            />
          </div>
        </div>

        {/* Footer Technical Bar */}
        <footer className="mt-8 pt-4 border-t border-border flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span>Platform: {systemInfo?.os_name || 'Windows 10/11 x64'}</span>
            <span>•</span>
            <span>Architecture: {systemInfo?.architecture || 'x86_64'}</span>
            <span>•</span>
            <span>Displays: {monitors.length || 1} Detected</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Session 0 Unattended Access Ready</span>
          </div>
        </footer>
      </main>

      {/* Incoming Connection Notification Modal */}
      {incomingRequest && (
        <IncomingSessionModal
          request={incomingRequest}
          onAccept={(perms) => respondToIncomingSession(true, perms)}
          onReject={() => respondToIncomingSession(false)}
        />
      )}

      {/* Network & Relay Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSignalingUrl={signalingUrl}
        onSaveSignalingUrl={handleSaveSignalingUrl}
      />
    </div>
  );
}
