'use client';

import React, { useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { FileTransferProgress } from '@/types';
import { formatBytes } from '@/lib/utils';

interface FileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileTransfers: FileTransferProgress[];
  onSendFile: (file: File) => void;
}

export const FileManagerModal: React.FC<FileManagerModalProps> = ({
  isOpen,
  onClose,
  fileTransfers,
  onSendFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSendFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSendFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">File Transfer Manager (P2P DataChannel)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div className="p-5 border-b border-border">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-emerald-500/50 rounded-xl p-8 flex flex-col items-center justify-center bg-surface/50 hover:bg-surface cursor-pointer transition-colors group"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-white mb-1">
              Click to select or drag & drop files here
            </p>
            <p className="text-[11px] text-gray-400">
              Files are streamed directly peer-to-peer in 64KB DTLS-SRTP encrypted chunks
            </p>
          </div>
        </div>

        {/* Transfer Queue */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Transfer Queue ({fileTransfers.length})
          </div>

          {fileTransfers.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No active or previous file transfers in this session.
            </div>
          ) : (
            fileTransfers.map((item) => (
              <div
                key={item.fileId}
                className="p-3 bg-surface rounded-lg border border-border flex flex-col space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 truncate max-w-[70%]">
                    {item.direction === 'upload' ? (
                      <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="font-medium text-white truncate">{item.fileName}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="text-gray-400">
                      {formatBytes(item.transferredBytes)} / {formatBytes(item.totalBytes)}
                    </span>
                    {item.status === 'completed' && (
                      <span className="flex items-center text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                      </span>
                    )}
                    {item.status === 'transferring' && (
                      <span className="text-blue-400 font-medium">{item.percentage}%</span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface-card rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      item.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
