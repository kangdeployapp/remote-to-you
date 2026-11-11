'use client';

import React, { useState } from 'react';
import { Globe, ArrowRight, Clock, Trash2, Key } from 'lucide-react';
import { formatId } from '@/lib/utils';

interface RemoteDeskCardProps {
  onConnect: (targetId: string, password?: string) => void;
  isConnecting: boolean;
}

export const RemoteDeskCard: React.FC<RemoteDeskCardProps> = ({
  onConnect,
  isConnecting,
}) => {
  const [targetId, setTargetId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recentSessions, setRecentSessions] = useState<string[]>([
    '492 810 932',
    '817 294 105',
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatId(e.target.value);
    setTargetId(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) return;

    // Save to recents
    if (!recentSessions.includes(targetId)) {
      setRecentSessions((prev) => [targetId, ...prev.slice(0, 4)]);
    }

    onConnect(targetId, password);
  };

  const handleQuickConnect = (id: string) => {
    setTargetId(id);
    onConnect(id, password);
  };

  const removeRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSessions((prev) => prev.filter((item) => item !== id));
  };

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-2xl pointer-events-none" />

      <div>
        {/* Card Header */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Remote Desk</h2>
            <p className="text-[11px] text-gray-400">Control a remote computer by entering its ID</p>
          </div>
        </div>

        {/* Connect Form */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-5">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">
              Remote Desk ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={targetId}
                onChange={handleInputChange}
                placeholder="000 000 000"
                maxLength={11}
                className="w-full bg-surface border border-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-lg font-mono tracking-wider text-white placeholder-gray-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Password (Optional for Unattended)
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-blue-400 hover:underline"
              >
                {showPassword ? 'Hide' : 'Add Password'}
              </button>
            </div>
            {showPassword && (
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter one-time or unattended password"
                  className="w-full bg-surface border border-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none transition-all"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!targetId.trim() || isConnecting}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Establishing WebRTC Session...</span>
              </>
            ) : (
              <>
                <span>Connect</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Recent Sessions */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-2">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-medium text-[11px] uppercase tracking-wider">Recent Sessions</span>
        </div>

        {recentSessions.length === 0 ? (
          <p className="text-[11px] text-gray-500">No recent connections recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {recentSessions.map((id) => (
              <div
                key={id}
                onClick={() => handleQuickConnect(id)}
                className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-card border border-border cursor-pointer transition-colors group"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-gray-500 group-hover:bg-blue-400 transition-colors" />
                  <span className="font-mono text-xs text-gray-300 font-medium">{id}</span>
                </div>
                <button
                  onClick={(e) => removeRecent(id, e)}
                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                  title="Remove from history"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
