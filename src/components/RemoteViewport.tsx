'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { KeyEventPayload, MouseClickPayload, MouseMovePayload, MouseWheelPayload } from '@/types';

interface RemoteViewportProps {
  remoteFrame: string | null;
  remoteWidth?: number;
  remoteHeight?: number;
  onMouseMove: (payload: MouseMovePayload) => void;
  onMouseClick: (payload: MouseClickPayload) => void;
  onMouseWheel: (payload: MouseWheelPayload) => void;
  onKeyEvent: (payload: KeyEventPayload) => void;
  fitMode: 'fit' | 'stretch' | 'original';
}

export const RemoteViewport: React.FC<RemoteViewportProps> = ({
  remoteFrame,
  remoteWidth = 1920,
  remoteHeight = 1080,
  onMouseMove,
  onMouseClick,
  onMouseWheel,
  onKeyEvent,
  fitMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Initialize offscreen image element
  useEffect(() => {
    const img = new Image();
    imgRef.current = img;
  }, []);

  // Render incoming remote frame to canvas with aspect-ratio scaling
  useEffect(() => {
    if (!remoteFrame || !canvasRef.current || !imgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    img.onload = () => {
      // High-DPI device pixel ratio support
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      if (fitMode === 'stretch') {
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      } else {
        // Compute letterbox / pillarbox fit
        const scale = Math.min(displayWidth / img.width, displayHeight / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (displayWidth - drawW) / 2;
        const offsetY = (displayHeight - drawH) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      }

      ctx.restore();
    };

    img.src = remoteFrame;
  }, [remoteFrame, fitMode]);

  // Compute normalized coordinates (0.0 to 1.0) taking into account letterboxing & DPI
  const getNormalizedCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) {
        return null;
      }

      if (fitMode === 'stretch') {
        return {
          x: Math.max(0, Math.min(1, clickX / rect.width)),
          y: Math.max(0, Math.min(1, clickY / rect.height)),
        };
      }

      // Aspect-ratio aware calculation
      const aspectRemote = remoteWidth / remoteHeight;
      const aspectCanvas = rect.width / rect.height;

      let drawW = rect.width;
      let drawH = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (aspectCanvas > aspectRemote) {
        // Pillarbox (black bars on left/right)
        drawW = rect.height * aspectRemote;
        offsetX = (rect.width - drawW) / 2;
      } else {
        // Letterbox (black bars on top/bottom)
        drawH = rect.width / aspectRemote;
        offsetY = (rect.height - drawH) / 2;
      }

      const activeX = clickX - offsetX;
      const activeY = clickY - offsetY;

      if (activeX < 0 || activeY < 0 || activeX > drawW || activeY > drawH) {
        return null;
      }

      return {
        x: Math.max(0, Math.min(1, activeX / drawW)),
        y: Math.max(0, Math.min(1, activeY / drawH)),
      };
    },
    [fitMode, remoteWidth, remoteHeight]
  );

  // Mouse move handler (throttled by requestAnimationFrame)
  const lastMoveRef = useRef<number>(0);
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getNormalizedCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setCursorPos({ x: e.clientX, y: e.clientY });

    const now = performance.now();
    if (now - lastMoveRef.current > 16) {
      // ~60 updates/sec
      lastMoveRef.current = now;
      onMouseMove({ x: coords.x, y: coords.y });
    }
  };

  // Mouse button handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getNormalizedCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const buttonMap: Record<number, 'left' | 'middle' | 'right'> = {
      0: 'left',
      1: 'middle',
      2: 'right',
    };

    onMouseClick({
      x: coords.x,
      y: coords.y,
      button: buttonMap[e.button] || 'left',
      action: 'down',
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getNormalizedCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const buttonMap: Record<number, 'left' | 'middle' | 'right'> = {
      0: 'left',
      1: 'middle',
      2: 'right',
    };

    onMouseClick({
      x: coords.x,
      y: coords.y,
      button: buttonMap[e.button] || 'left',
      action: 'up',
    });
  };

  // Mouse wheel handler
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onMouseWheel({
      delta_x: e.deltaX > 0 ? 1 : e.deltaX < 0 ? -1 : 0,
      delta_y: e.deltaY > 0 ? -1 : e.deltaY < 0 ? 1 : 0,
    });
  };

  // Keyboard handler with capture and suppression of browser defaults
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default on key combinations
      if (
        ['Tab', 'Alt', 'F5', 'F11'].includes(e.key) ||
        (e.ctrlKey && ['w', 'r', 't', 'n', 'p'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }

      onKeyEvent({
        code: e.code,
        vk: e.keyCode,
        state: 'keydown',
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      onKeyEvent({
        code: e.code,
        vk: e.keyCode,
        state: 'keyup',
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onKeyEvent]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none cursor-crosshair"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        tabIndex={0}
      />

      {!remoteFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium tracking-wide">Waiting for DXGI video stream...</p>
        </div>
      )}
    </div>
  );
};
