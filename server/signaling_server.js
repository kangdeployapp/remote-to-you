/**
 * Production-grade WebSocket Signaling Server for RemoteDesk WebRTC P2P Sessions
 * Handles peer discovery, 9-digit client ID addressing, SDP offer/answer relay,
 * ICE candidate exchange, and session permissions negotiation.
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 9002;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'Remote to You Signaling Server',
    status: 'ONLINE',
    connectedPeers: clients.size,
    timestamp: new Date().toISOString()
  }));
});

const wss = new WebSocketServer({ server });

// Map: clientId -> { ws, oneTimePassword, metadata }
const clients = new Map();

// Map: activeSessionId -> { hostId, remoteId, permissions }
const sessions = new Map();

wss.on('connection', (ws) => {
  let registeredId = null;

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      const { type, payload } = data;

      switch (type) {
        case 'register': {
          const { clientId, oneTimePassword, metadata } = payload;
          const cleanId = (clientId || '').replace(/\s+/g, '');
          registeredId = cleanId;
          clients.set(cleanId, { ws, oneTimePassword, metadata: metadata || {} });
          console.log(`[Signaling] Peer registered: ${cleanId}`);
          ws.send(JSON.stringify({
            type: 'registered',
            payload: { clientId: cleanId, success: true }
          }));
          break;
        }

        case 'connect-request': {
          const { targetId, senderId, senderName, password } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const cleanSender = (senderId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);

          if (!target) {
            ws.send(JSON.stringify({
              type: 'connect-error',
              payload: { message: `Target desk ${targetId} is offline or not found.` }
            }));
            return;
          }

          if (target.oneTimePassword && password && target.oneTimePassword !== password) {
            ws.send(JSON.stringify({
              type: 'connect-error',
              payload: { message: `Invalid one-time password for desk ${targetId}.` }
            }));
            return;
          }

          // Forward incoming connection modal request to the target host
          target.ws.send(JSON.stringify({
            type: 'incoming-session',
            payload: {
              senderId: cleanSender,
              senderName: senderName || 'Remote Operator',
              timestamp: Date.now()
            }
          }));
          break;
        }

        case 'session-response': {
          const { targetId, hostId, accepted, permissions, reason } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);

          if (target) {
            target.ws.send(JSON.stringify({
              type: 'session-response',
              payload: { hostId, accepted, permissions, reason }
            }));
          }
          break;
        }

        case 'webrtc-offer': {
          const { targetId, sdp, senderId } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);
          if (target) {
            target.ws.send(JSON.stringify({
              type: 'webrtc-offer',
              payload: { sdp, senderId }
            }));
          }
          break;
        }

        case 'webrtc-answer': {
          const { targetId, sdp, senderId } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);
          if (target) {
            target.ws.send(JSON.stringify({
              type: 'webrtc-answer',
              payload: { sdp, senderId }
            }));
          }
          break;
        }

        case 'ice-candidate': {
          const { targetId, candidate, senderId } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);
          if (target) {
            target.ws.send(JSON.stringify({
              type: 'ice-candidate',
              payload: { candidate, senderId }
            }));
          }
          break;
        }

        case 'session-end': {
          const { targetId } = payload;
          const cleanTarget = (targetId || '').replace(/\s+/g, '');
          const target = clients.get(cleanTarget);
          if (target) {
            target.ws.send(JSON.stringify({
              type: 'session-end',
              payload: { from: registeredId }
            }));
          }
          break;
        }

        default:
          console.warn(`[Signaling] Unrecognized message type: ${type}`);
      }
    } catch (err) {
      console.error('[Signaling] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    if (registeredId) {
      clients.delete(registeredId);
      console.log(`[Signaling] Peer disconnected: ${registeredId}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Signaling] WebSocket error on peer ${registeredId}:`, err);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  RemoteDesk Signaling & NAT Traversal Service`);
  console.log(`  Listening on ws://0.0.0.0:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/`);
  console.log(`=======================================================`);
});
