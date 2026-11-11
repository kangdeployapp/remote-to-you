'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Shield,
  ShieldAlert,
  RotateCw,
  Eye,
  EyeOff,
  Monitor,
  Laptop,
} from 'lucide-react';
import { SystemInfo } from '@/types';

interface ThisDeskCardProps {
  clientId: string;
  oneTimePassword: string;
  signalingStatus: 'disconnected' | 'connecting' | 'connected';
  systemInfo: SystemInfo | null;
  onRegeneratePassword: () => void;
  onRequestElevation: () => void;
}

export const ThisDeskCard: React.FC<ThisDeskCardProps> = ({
  clientId,
  oneTimePassword,
  signalingStatus,
  systemInfo,
  onRegeneratePassword,
  onRequestElevation,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const copyToClipboard = (text: string, type: 'id' | 'pwd') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl pointer-events-none" />

      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">This Desk</h2>
              <p className="text-[11px] text-gray-400">Share your ID to allow remote assistance</p>
            </div>
          </div>

          {/* Status Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                signalingStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : signalingStatus === 'connecting'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="capitalize text-gray-300 font-medium">
              {signalingStatus === 'connected' ? 'Ready' : signalingStatus}
            </span>
          </div>
        </div>

        {/* 9-Digit Desk ID */}
        <div className="bg-surface p-4 rounded-xl border border-border mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">
            Your Desk Address (9 Digits)
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-wider text-white select-all">
              {clientId || '--- --- ---'}
            </span>
            <button
              onClick={() => copyToClipboard(clientId, 'id')}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors"
              title="Copy Desk ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Temporary Password */}
        <div className="bg-surface p-3.5 rounded-xl border border-border mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">
            One-Time Access Password
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm tracking-widest text-emerald-400 font-bold">
              {showPwd ? oneTimePassword : '••••••'}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowPwd(!showPwd)}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
                title={showPwd ? 'Hide' : 'Reveal'}
              >
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onRegeneratePassword}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
                title="Regenerate Password"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => copyToClipboard(oneTimePassword, 'pwd')}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-surface-elevated transition-colors"
                title="Copy Password"
              >
                {copiedPwd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Elevation & Diagnostics */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1.5 text-gray-400">
          <Monitor className="w-3.5 h-3.5 text-gray-500" />
          <span className="truncate max-w-[150px]">{systemInfo?.hostname || 'Windows Device'}</span>
        </div>

        {systemInfo?.is_elevated ? (
          <div className="flex items-center space-x-1 text-emerald-400 font-medium">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[11px]">Administrator (Elevated)</span>
          </div>
        ) : (
          <button
            onClick={onRequestElevation}
            className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[11px] font-medium transition-colors"
            title="Elevate to handle UAC prompts & Secure Desktop"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Elevate to Admin</span>
          </button>
        )}
      </div>
    </div>
  );
};
