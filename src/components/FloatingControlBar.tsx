'use client';

import React, { useState } from 'react';
import {
  Monitor,
  Maximize2,
  Minimize2,
  FolderSync,
  MessageSquare,
  KeyRound,
  ShieldCheck,
  PhoneOff,
  ChevronDown,
  Layers,
  Activity,
  Pin,
  PinOff,
} from 'lucide-react';
import { MonitorInfo, SpecialKeyChord } from '@/types';

interface FloatingControlBarProps {
  remotePeerId: string;
  fps: number;
  latency: number;
  monitors: MonitorInfo[];
  selectedMonitor: number;
  fitMode: 'fit' | 'stretch' | 'original';
  unreadChatCount: number;
  onSelectMonitor: (id: number) => void;
  onToggleFitMode: () => void;
  onToggleFullScreen: () => void;
  onSendSpecialKey: (chord: SpecialKeyChord) => void;
  onOpenFileTransfer: () => void;
  onToggleChat: () => void;
  onDisconnect: () => void;
}

export const FloatingControlBar: React.FC<FloatingControlBarProps> = ({
  remotePeerId,
  fps,
  latency,
  monitors,
  selectedMonitor,
  fitMode,
  unreadChatCount,
  onSelectMonitor,
  onToggleFitMode,
  onToggleFullScreen,
  onSendSpecialKey,
  onOpenFileTransfer,
  onToggleChat,
  onDisconnect,
}) => {
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showMonitorMenu, setShowMonitorMenu] = useState(false);
  const [showKeysMenu, setShowKeysMenu] = useState(false);

  const specialKeys: { label: string; chord: SpecialKeyChord; desc?: string }[] = [
    { label: 'Ctrl + Alt + Del', chord: 'ctrl_alt_del', desc: 'Secure Attention Sequence' },
    { label: 'Task Manager', chord: 'task_manager', desc: 'Ctrl + Shift + Esc' },
    { label: 'Alt + Tab', chord: 'alt_tab', desc: 'Switch Windows' },
    { label: 'Windows Key', chord: 'win', desc: 'Open Start Menu' },
    { label: 'Show Desktop', chord: 'win_d', desc: 'Win + D' },
    { label: 'Lock Computer', chord: 'win_l', desc: 'Win + L' },
    { label: 'Copy Clipboard', chord: 'ctrl_c', desc: 'Ctrl + C' },
    { label: 'Paste Clipboard', chord: 'ctrl_v', desc: 'Ctrl + V' },
  ];

  return (
    <div
      className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isPinned || isHovered ? 'translate-y-2 opacity-100' : '-translate-y-8 opacity-40 hover:translate-y-2 hover:opacity-100'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMonitorMenu(false);
        setShowKeysMenu(false);
      }}
    >
      <div className="flex items-center space-x-1 bg-surface-elevated/95 backdrop-blur-md border border-border px-3 py-1.5 rounded-full shadow-2xl text-xs text-gray-200">
        {/* Status & Remote Peer */}
        <div className="flex items-center space-x-2 pl-1 pr-3 border-r border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-white tracking-wide">{remotePeerId}</span>
          <div className="flex items-center space-x-1 text-[10px] text-gray-400">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>{latency}ms</span>
            <span className="text-gray-600">|</span>
            <span>{fps} FPS</span>
          </div>
        </div>

        {/* Multi-Monitor Selector */}
        <div className="relative">
          <button
            onClick={() => setShowMonitorMenu(!showMonitorMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-surface transition-colors"
            title="Select Monitor"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span>Display {selectedMonitor + 1}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showMonitorMenu && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-surface-elevated border border-border rounded-lg shadow-xl py-1 text-xs">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-border">
                Detected Displays
              </div>
              {monitors.map((mon) => (
                <button
                  key={mon.id}
                  onClick={() => {
                    onSelectMonitor(mon.id);
                    setShowMonitorMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-primary/20 ${
                    selectedMonitor === mon.id ? 'text-blue-400 font-medium bg-primary/10' : 'text-gray-300'
                  }`}
                >
                  <span className="truncate">{mon.name || `Display ${mon.id + 1}`}</span>
                  <span className="text-[10px] text-gray-400">{mon.width}x{mon.height}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Special Keys Chords Menu */}
        <div className="relative">
          <button
            onClick={() => setShowKeysMenu(!showKeysMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-surface transition-colors"
            title="Send Special Windows Keys"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Send Keys</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showKeysMenu && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-surface-elevated border border-border rounded-lg shadow-xl py-1 text-xs">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-border">
                Windows Key Chords
              </div>
              {specialKeys.map((item) => (
                <button
                  key={item.chord}
                  onClick={() => {
                    onSendSpecialKey(item.chord);
                    setShowKeysMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-primary/20 text-gray-300 hover:text-white"
                >
                  <span>{item.label}</span>
                  {item.desc && <span className="text-[10px] text-gray-500">{item.desc}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fit Mode Toggle */}
        <button
          onClick={onToggleFitMode}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-surface transition-colors"
          title={`Current: ${fitMode.toUpperCase()}`}
        >
          <Layers className="w-3.5 h-3.5 text-purple-400" />
          <span className="capitalize">{fitMode}</span>
        </button>

        {/* File Transfer */}
        <button
          onClick={onOpenFileTransfer}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-surface transition-colors"
          title="Direct File Transfer"
        >
          <FolderSync className="w-3.5 h-3.5 text-emerald-400" />
          <span>Files</span>
        </button>

        {/* In-Session Chat */}
        <button
          onClick={onToggleChat}
          className="relative flex items-center space-x-1.5 px-2.5 py-1 rounded-md hover:bg-surface transition-colors"
          title="Session Chat"
        >
          <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
          <span>Chat</span>
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Full Screen */}
        <button
          onClick={onToggleFullScreen}
          className="p-1.5 rounded-md hover:bg-surface text-gray-300 hover:text-white transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Pin Bar */}
        <button
          onClick={() => setIsPinned(!isPinned)}
          className={`p-1.5 rounded-md hover:bg-surface transition-colors ${
            isPinned ? 'text-blue-400' : 'text-gray-500'
          }`}
          title={isPinned ? 'Unpin toolbar' : 'Pin toolbar'}
        >
          {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>

        {/* Disconnect */}
        <button
          onClick={onDisconnect}
          className="flex items-center space-x-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors ml-2 shadow"
          title="End Session"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Disconnect</span>
        </button>
      </div>
    </div>
  );
};
