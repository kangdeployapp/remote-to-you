import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChatMessage,
  FileTransferProgress,
  IncomingSessionRequest,
  KeyEventPayload,
  MouseClickPayload,
  MouseMovePayload,
  MouseWheelPayload,
  SessionPermissions,
  SpecialKeyChord,
} from '@/types';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk for WebRTC DataChannel

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface UseWebRTCOptions {
  signalingUrl?: string;
  clientId: string;
  oneTimePassword: string;
  onTauriInvoke?: (cmd: string, args?: any) => Promise<any>;
}

export function useWebRTC({
  signalingUrl = 'ws://localhost:9002',
  clientId,
  oneTimePassword,
  onTauriInvoke,
}: UseWebRTCOptions) {
  const [signalingStatus, setSignalingStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessionState, setSessionState] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<IncomingSessionRequest | null>(null);
  const [permissions, setPermissions] = useState<SessionPermissions>({
    allowKeyboardMouse: true,
    allowClipboard: true,
    allowFileTransfer: true,
    allowAudio: false,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fileTransfers, setFileTransfers] = useState<FileTransferProgress[]>([]);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const [fps, setFps] = useState(60);
  const [latency, setLatency] = useState(12);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const inputChannelRef = useRef<RTCDataChannel | null>(null);
  const clipboardChannelRef = useRef<RTCDataChannel | null>(null);
  const fileChannelRef = useRef<RTCDataChannel | null>(null);
  const chatChannelRef = useRef<RTCDataChannel | null>(null);
  const captureIntervalRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);

  // Incoming file transfer reconstruction buffers
  const receivingFilesRef = useRef<
    Map<
      string,
      {
        fileName: string;
        fileSize: number;
        receivedBytes: number;
        chunks: ArrayBuffer[];
      }
    >
  >(new Map());

  // Helper to send over WebSocket
  const sendSignaling = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Connect to Signaling Server
  useEffect(() => {
    if (!clientId) return;

    let socket: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      setSignalingStatus('connecting');
      socket = new WebSocket(signalingUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setSignalingStatus('connected');
        setErrorMessage(null);
        // Register local Desk ID (normalized without spaces)
        const cleanId = clientId.replace(/\s+/g, '');
        socket.send(
          JSON.stringify({
            type: 'register',
            payload: {
              clientId: cleanId,
              oneTimePassword,
              metadata: { platform: 'Windows', userAgent: navigator.userAgent },
            },
          })
        );
      };

      socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleSignalingMessage(msg);
        } catch (e) {
          console.error('[WebRTC] Error parsing signaling message', e);
        }
      };

      socket.onclose = () => {
        setSignalingStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.warn('[WebRTC] Signaling socket error:', err);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [clientId, oneTimePassword, signalingUrl]);

  // Clean up Peer Connection
  const cleanupPeerConnection = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    if (inputChannelRef.current) inputChannelRef.current.close();
    if (clipboardChannelRef.current) clipboardChannelRef.current.close();
    if (fileChannelRef.current) fileChannelRef.current.close();
    if (chatChannelRef.current) chatChannelRef.current.close();

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setSessionState('idle');
    setRemotePeerId(null);
    setRemoteFrame(null);
    setIsHost(false);
  }, []);

  // Setup PeerConnection & Data Channels
  const setupPeerConnection = useCallback(
    (targetPeerId: string, asInitiator: boolean) => {
      cleanupPeerConnection();

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setRemotePeerId(targetPeerId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling('ice-candidate', {
            targetId: targetPeerId,
            candidate: event.candidate,
            senderId: clientId,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setSessionState('connected');
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupPeerConnection();
        }
      };

      const setupDataChannelEvents = (channel: RTCDataChannel) => {
        const name = channel.label;

        channel.onmessage = async (evt) => {
          if (name === 'input' && isHost) {
            // Host receives input events from remote client and simulates Win32 inputs
            if (!permissions.allowKeyboardMouse) return;
            try {
              const data = JSON.parse(evt.data);
              if (onTauriInvoke) {
                if (data.type === 'move') {
                  await onTauriInvoke('simulate_mouse_move', { payload: data.payload });
                } else if (data.type === 'click') {
                  await onTauriInvoke('simulate_mouse_click', { payload: data.payload });
                } else if (data.type === 'wheel') {
                  await onTauriInvoke('simulate_mouse_wheel', { payload: data.payload });
                } else if (data.type === 'key') {
                  await onTauriInvoke('simulate_key_event', { payload: data.payload });
                } else if (data.type === 'special_key') {
                  await onTauriInvoke('simulate_special_key', { chord: data.chord });
                }
              }
            } catch (err) {
              console.error('[WebRTC] Input dispatch error:', err);
            }
          } else if (name === 'clipboard') {
            if (!permissions.allowClipboard) return;
            try {
              const data = JSON.parse(evt.data);
              if (data.text && onTauriInvoke) {
                await onTauriInvoke('set_clipboard_text', { text: data.text });
              }
            } catch (err) {
              console.error('[WebRTC] Clipboard sync error:', err);
            }
          } else if (name === 'chat') {
            try {
              const msg: ChatMessage = JSON.parse(evt.data);
              setChatMessages((prev) => [...prev, { ...msg, isSelf: false }]);
            } catch (err) {
              console.error('[WebRTC] Chat message parse error:', err);
            }
          } else if (name === 'file-transfer') {
            if (!permissions.allowFileTransfer) return;
            handleFileTransferMessage(evt.data);
          } else if (name === 'video-frame') {
            // Remote client receives frame from host
            setRemoteFrame(evt.data);
          }
        };
      };

      if (asInitiator) {
        // Initiator creates channels
        const inputChan = pc.createDataChannel('input', { ordered: false, maxRetransmits: 0 });
        inputChannelRef.current = inputChan;
        setupDataChannelEvents(inputChan);

        const clipChan = pc.createDataChannel('clipboard');
        clipboardChannelRef.current = clipChan;
        setupDataChannelEvents(clipChan);

        const fileChan = pc.createDataChannel('file-transfer');
        fileChannelRef.current = fileChan;
        setupDataChannelEvents(fileChan);

        const chatChan = pc.createDataChannel('chat');
        chatChannelRef.current = chatChan;
        setupDataChannelEvents(chatChan);

        const frameChan = pc.createDataChannel('video-frame', { ordered: false, maxRetransmits: 0 });
        setupDataChannelEvents(frameChan);
      } else {
        // Receiver listens for channels
        pc.ondatachannel = (event) => {
          const ch = event.channel;
          if (ch.label === 'input') inputChannelRef.current = ch;
          if (ch.label === 'clipboard') clipboardChannelRef.current = ch;
          if (ch.label === 'file-transfer') fileChannelRef.current = ch;
          if (ch.label === 'chat') chatChannelRef.current = ch;
          setupDataChannelEvents(ch);
        };
      }

      return pc;
    },
    [clientId, isHost, permissions, sendSignaling, cleanupPeerConnection, onTauriInvoke]
  );

  // Host Screen Capture Loop
  const startHostCaptureLoop = useCallback(() => {
    if (!onTauriInvoke) return;

    captureIntervalRef.current = setInterval(async () => {
      try {
        const frame = await onTauriInvoke('capture_frame');
        if (frame && frame.data_base64) {
          // Send to client via video-frame channel if open
          if (pcRef.current) {
            // Also notify local preview
          }
        }
      } catch (err) {
        // Capture frame error
      }
    }, 1000 / 30);
  }, [onTauriInvoke]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(
    async (msg: any) => {
      const { type, payload } = msg;

      switch (type) {
        case 'incoming-session': {
          setIncomingRequest({
            senderId: payload.senderId,
            senderName: payload.senderName,
            timestamp: payload.timestamp,
          });
          setSessionState('incoming');
          break;
        }

        case 'session-response': {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          if (payload.accepted) {
            // Connection accepted by remote host! Create WebRTC Offer
            const cleanHost = payload.hostId.replace(/\s+/g, '');
            const cleanSender = clientId.replace(/\s+/g, '');
            const pc = setupPeerConnection(cleanHost, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignaling('webrtc-offer', {
              targetId: cleanHost,
              sdp: offer,
              senderId: cleanSender,
            });
          } else {
            setErrorMessage(`Connection declined by remote desk: ${payload.reason || 'User rejected request'}`);
            cleanupPeerConnection();
          }
          break;
        }

        case 'webrtc-offer': {
          // Host receives offer from client
          setIsHost(true);
          const cleanSender = payload.senderId.replace(/\s+/g, '');
          const cleanLocal = clientId.replace(/\s+/g, '');
          const pc = setupPeerConnection(cleanSender, false);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendSignaling('webrtc-answer', {
            targetId: cleanSender,
            sdp: answer,
            senderId: cleanLocal,
          });

          // Host starts capturing screen frames
          startHostCaptureLoop();
          break;
        }

        case 'webrtc-answer': {
          // Client receives answer from host
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
          break;
        }

        case 'ice-candidate': {
          if (pcRef.current && payload.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
          break;
        }

        case 'session-end': {
          setErrorMessage('Remote peer disconnected the session.');
          cleanupPeerConnection();
          break;
        }

        case 'connect-error': {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          setErrorMessage(payload.message || 'Could not connect to target desk.');
          setSessionState('idle');
          break;
        }
      }
    },
    [clientId, sendSignaling, setupPeerConnection, cleanupPeerConnection, startHostCaptureLoop]
  );

  // Incoming chunked file transfer handler
  const handleFileTransferMessage = (data: any) => {
    if (typeof data === 'string') {
      try {
        const packet = JSON.parse(data);
        if (packet.type === 'start') {
          receivingFilesRef.current.set(packet.fileId, {
            fileName: packet.fileName,
            fileSize: packet.fileSize,
            receivedBytes: 0,
            chunks: [],
          });
          setFileTransfers((prev) => [
            ...prev,
            {
              fileId: packet.fileId,
              fileName: packet.fileName,
              totalBytes: packet.fileSize,
              transferredBytes: 0,
              percentage: 0,
              direction: 'download',
              status: 'transferring',
            },
          ]);
        } else if (packet.type === 'end') {
          const rec = receivingFilesRef.current.get(packet.fileId);
          if (rec) {
            const blob = new Blob(rec.chunks);
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = rec.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            setFileTransfers((prev) =>
              prev.map((f) => (f.fileId === packet.fileId ? { ...f, status: 'completed', percentage: 100 } : f))
            );
            receivingFilesRef.current.delete(packet.fileId);
          }
        }
      } catch (err) {
        console.error('File metadata parse error', err);
      }
    } else if (data instanceof ArrayBuffer) {
      // Find active transfer and push chunk
      const activeEntry = Array.from(receivingFilesRef.current.entries())[0];
      if (activeEntry) {
        const [fileId, rec] = activeEntry;
        rec.chunks.push(data);
        rec.receivedBytes += data.byteLength;
        const pct = Math.min(100, Math.round((rec.receivedBytes / rec.fileSize) * 100));

        setFileTransfers((prev) =>
          prev.map((f) => (f.fileId === fileId ? { ...f, transferredBytes: rec.receivedBytes, percentage: pct } : f))
        );
      }
    }
  };

  // Public Methods
  const requestConnection = useCallback(
    (targetId: string, password?: string) => {
      const cleanTarget = targetId.replace(/\s+/g, '');
      const cleanSelf = clientId.replace(/\s+/g, '');

      if (!cleanTarget) {
        setErrorMessage('Please enter a valid 9-digit Desk ID.');
        return;
      }

      if (cleanTarget === cleanSelf) {
        setErrorMessage(
          'Cannot connect to your own desk address! To test on this computer, open another window in an incognito tab or connect from a different device.'
        );
        return;
      }

      if (signalingStatus !== 'connected') {
        setErrorMessage(
          'Connecting to signaling service... Please wait a few seconds and try again.'
        );
        return;
      }

      setSessionState('calling');
      setRemotePeerId(targetId);
      setErrorMessage(null);

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        setErrorMessage(`Connection timed out: Desk ${targetId} did not respond or is offline.`);
        setSessionState('idle');
      }, 12000);

      sendSignaling('connect-request', {
        targetId: cleanTarget,
        senderId: cleanSelf,
        senderName: 'Remote Operator',
        password,
      });
    },
    [clientId, signalingStatus, sendSignaling]
  );

  const respondToIncomingSession = useCallback(
    (accepted: boolean, customPermissions?: SessionPermissions) => {
      if (!incomingRequest) return;
      const perms = customPermissions || permissions;
      if (accepted) {
        setPermissions(perms);
        setIsHost(true);
      }
      sendSignaling('session-response', {
        targetId: incomingRequest.senderId,
        hostId: clientId,
        accepted,
        permissions: perms,
        reason: accepted ? 'Accepted' : 'User declined incoming connection',
      });
      setIncomingRequest(null);
      if (!accepted) {
        setSessionState('idle');
      }
    },
    [incomingRequest, permissions, clientId, sendSignaling]
  );

  const disconnectSession = useCallback(() => {
    if (remotePeerId) {
      sendSignaling('session-end', { targetId: remotePeerId });
    }
    cleanupPeerConnection();
  }, [remotePeerId, sendSignaling, cleanupPeerConnection]);

  // Dispatch Input Events
  const sendMouseMove = useCallback((payload: MouseMovePayload) => {
    if (inputChannelRef.current && inputChannelRef.current.readyState === 'open') {
      inputChannelRef.current.send(JSON.stringify({ type: 'move', payload }));
    }
  }, []);

  const sendMouseClick = useCallback((payload: MouseClickPayload) => {
    if (inputChannelRef.current && inputChannelRef.current.readyState === 'open') {
      inputChannelRef.current.send(JSON.stringify({ type: 'click', payload }));
    }
  }, []);

  const sendMouseWheel = useCallback((payload: MouseWheelPayload) => {
    if (inputChannelRef.current && inputChannelRef.current.readyState === 'open') {
      inputChannelRef.current.send(JSON.stringify({ type: 'wheel', payload }));
    }
  }, []);

  const sendKeyEvent = useCallback((payload: KeyEventPayload) => {
    if (inputChannelRef.current && inputChannelRef.current.readyState === 'open') {
      inputChannelRef.current.send(JSON.stringify({ type: 'key', payload }));
    }
  }, []);

  const sendSpecialKey = useCallback((chord: SpecialKeyChord) => {
    if (inputChannelRef.current && inputChannelRef.current.readyState === 'open') {
      inputChannelRef.current.send(JSON.stringify({ type: 'special_key', chord }));
    }
  }, []);

  const sendChatMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const msg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderId: clientId,
        senderName: 'Me',
        text,
        timestamp: Date.now(),
        isSelf: true,
      };
      setChatMessages((prev) => [...prev, msg]);
      if (chatChannelRef.current && chatChannelRef.current.readyState === 'open') {
        chatChannelRef.current.send(JSON.stringify(msg));
      }
    },
    [clientId]
  );

  const sendFile = useCallback(async (file: File) => {
    if (!fileChannelRef.current || fileChannelRef.current.readyState !== 'open') return;

    const fileId = Math.random().toString(36).substring(2, 9);
    setFileTransfers((prev) => [
      ...prev,
      {
        fileId,
        fileName: file.name,
        totalBytes: file.size,
        transferredBytes: 0,
        percentage: 0,
        direction: 'upload',
        status: 'transferring',
      },
    ]);

    // Send metadata header
    fileChannelRef.current.send(
      JSON.stringify({
        type: 'start',
        fileId,
        fileName: file.name,
        fileSize: file.size,
      })
    );

    const buffer = await file.arrayBuffer();
    let offset = 0;

    const sendNextChunk = () => {
      while (offset < buffer.byteLength) {
        if (fileChannelRef.current && fileChannelRef.current.bufferedAmount > 16 * 1024 * 1024) {
          // Pause and wait for buffer to drain
          setTimeout(sendNextChunk, 50);
          return;
        }

        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        fileChannelRef.current?.send(chunk);
        offset += chunk.byteLength;

        const pct = Math.min(100, Math.round((offset / buffer.byteLength) * 100));
        setFileTransfers((prev) =>
          prev.map((f) => (f.fileId === fileId ? { ...f, transferredBytes: offset, percentage: pct } : f))
        );
      }

      fileChannelRef.current?.send(
        JSON.stringify({
          type: 'end',
          fileId,
        })
      );

      setFileTransfers((prev) =>
        prev.map((f) => (f.fileId === fileId ? { ...f, status: 'completed', percentage: 100 } : f))
      );
    };

    sendNextChunk();
  }, []);

  return {
    signalingStatus,
    sessionState,
    remotePeerId,
    isHost,
    incomingRequest,
    permissions,
    setPermissions,
    chatMessages,
    fileTransfers,
    remoteFrame,
    fps,
    latency,
    errorMessage,
    clearError: () => setErrorMessage(null),
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
  };
}
