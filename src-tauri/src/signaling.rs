//! Embedded Native Signaling Server for Remote to You
//! Listens on `0.0.0.0:9002` to automatically route WebRTC SDP offers/answers,
//! ICE candidates, and session requests between local and LAN peers without external dependencies.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Serialize, Deserialize)]
struct SignalingMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: serde_json::Value,
}

type PeerSender = tokio::sync::mpsc::UnboundedSender<Message>;

#[derive(Clone, Default)]
pub struct SignalingServer {
    clients: Arc<Mutex<HashMap<String, PeerSender>>>,
}

impl SignalingServer {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawns the signaling server on a background Tokio task
    pub fn start(&self, port: u16) {
        let clients = self.clients.clone();

        tokio::spawn(async move {
            let addr = format!("0.0.0.0:{}", port);
            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => {
                    log::info!("[Signaling] Embedded server bound to {}", addr);
                    l
                }
                Err(e) => {
                    log::warn!("[Signaling] Could not bind to {} ({}), using external signaling or already running.", addr, e);
                    return;
                }
            };

            while let Ok((stream, peer_addr)) = listener.accept().await {
                let clients_inner = clients.clone();
                tokio::spawn(async move {
                    Self::handle_connection(stream, peer_addr, clients_inner).await;
                });
            }
        });
    }

    async fn handle_connection(stream: TcpStream, _addr: SocketAddr, clients: Arc<Mutex<HashMap<String, PeerSender>>>) {
        let ws_stream = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                log::warn!("[Signaling] WebSocket handshake error: {}", e);
                return;
            }
        };

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

        // Forward messages from mpsc channel to the actual WebSocket
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if ws_sender.send(msg).await.is_err() {
                    break;
                }
            }
        });

        let mut registered_id: Option<String> = None;

        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(parsed) = serde_json::from_str::<SignalingMessage>(&text) {
                    let msg_type = parsed.msg_type.as_str();
                    let payload = parsed.payload;

                    match msg_type {
                        "register" => {
                            if let Some(client_id_raw) = payload.get("clientId").and_then(|v| v.as_str()) {
                                let clean_id = client_id_raw.replace(' ', "");
                                registered_id = Some(clean_id.clone());
                                clients.lock().insert(clean_id.clone(), tx.clone());

                                let ack = serde_json::json!({
                                    "type": "registered",
                                    "payload": { "clientId": clean_id, "success": true }
                                });
                                let _ = tx.send(Message::Text(ack.to_string()));
                            }
                        }

                        "connect-request" => {
                            let target_id = payload.get("targetId").and_then(|v| v.as_str()).map(|s| s.replace(' ', ""));
                            let sender_id = payload.get("senderId").and_then(|v| v.as_str()).map(|s| s.replace(' ', "")).unwrap_or_default();
                            let sender_name = payload.get("senderName").and_then(|v| v.as_str()).unwrap_or("Remote Operator");

                            if let Some(tid) = target_id {
                                let target_tx = clients.lock().get(&tid).cloned();
                                if let Some(target) = target_tx {
                                    let forward = serde_json::json!({
                                        "type": "incoming-session",
                                        "payload": {
                                            "senderId": sender_id,
                                            "senderName": sender_name,
                                            "timestamp": std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_millis()
                                        }
                                    });
                                    let _ = target.send(Message::Text(forward.to_string()));
                                } else {
                                    let err = serde_json::json!({
                                        "type": "connect-error",
                                        "payload": { "message": format!("Target desk {} is offline or not found.", tid) }
                                    });
                                    let _ = tx.send(Message::Text(err.to_string()));
                                }
                            }
                        }

                        "session-response" => {
                            let target_id = payload.get("targetId").and_then(|v| v.as_str()).map(|s| s.replace(' ', ""));
                            if let Some(tid) = target_id {
                                let target_tx = clients.lock().get(&tid).cloned();
                                if let Some(target) = target_tx {
                                    let forward = serde_json::json!({
                                        "type": "session-response",
                                        "payload": payload
                                    });
                                    let _ = target.send(Message::Text(forward.to_string()));
                                }
                            }
                        }

                        "webrtc-offer" | "webrtc-answer" | "ice-candidate" | "session-end" => {
                            let target_id = payload.get("targetId").and_then(|v| v.as_str()).map(|s| s.replace(' ', ""));
                            if let Some(tid) = target_id {
                                let target_tx = clients.lock().get(&tid).cloned();
                                if let Some(target) = target_tx {
                                    let forward = serde_json::json!({
                                        "type": msg_type,
                                        "payload": payload
                                    });
                                    let _ = target.send(Message::Text(forward.to_string()));
                                }
                            }
                        }

                        _ => {}
                    }
                }
            }
        }

        // Cleanup on disconnect
        if let Some(id) = registered_id {
            clients.lock().remove(&id);
        }
    }
}
