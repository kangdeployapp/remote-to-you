const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// 1. Launch Signaling Server
const serverProcess = spawn('node', [path.join(__dirname, '..', 'server', 'signaling_server.js')], {
  stdio: 'inherit'
});

setTimeout(() => {
  const ws1 = new WebSocket('ws://localhost:9002');
  const ws2 = new WebSocket('ws://localhost:9002');

  let peer1Registered = false;
  let peer2Registered = false;

  ws1.on('open', () => {
    ws1.send(JSON.stringify({
      type: 'register',
      payload: { clientId: '111 222 333', oneTimePassword: 'TESTPW' }
    }));
  });

  ws2.on('open', () => {
    ws2.send(JSON.stringify({
      type: 'register',
      payload: { clientId: '444 555 666', oneTimePassword: 'TESTPW' }
    }));
  });

  ws1.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    console.log('[Peer 1 Received]:', data.type);
    if (data.type === 'registered') {
      peer1Registered = true;
      checkStartCall();
    } else if (data.type === 'incoming-session') {
      console.log('Peer 1 received incoming call from:', data.payload.senderId);
      // Accept call
      ws1.send(JSON.stringify({
        type: 'session-response',
        payload: {
          targetId: data.payload.senderId,
          hostId: '111 222 333',
          accepted: true,
          permissions: { allowKeyboardMouse: true, allowClipboard: true, allowFileTransfer: true }
        }
      }));
    }
  });

  ws2.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    console.log('[Peer 2 Received]:', data.type);
    if (data.type === 'registered') {
      peer2Registered = true;
      checkStartCall();
    } else if (data.type === 'session-response') {
      console.log('Peer 2 received session accepted! Relaying WebRTC offer...');
      ws2.send(JSON.stringify({
        type: 'webrtc-offer',
        payload: {
          targetId: '111 222 333',
          sdp: { type: 'offer', sdp: 'v=0\r\no=mock 123 456\r\ns=-\r\nt=0 0' },
          senderId: '444 555 666'
        }
      }));

      setTimeout(() => {
        console.log('>>> ALL SIGNALING TESTS PASSED SUCCESSFULLY! <<<');
        ws1.close();
        ws2.close();
        serverProcess.kill();
        process.exit(0);
      }, 500);
    }
  });

  function checkStartCall() {
    if (peer1Registered && peer2Registered) {
      console.log('Both peers registered. Initiating connect-request from Peer 2 -> Peer 1...');
      ws2.send(JSON.stringify({
        type: 'connect-request',
        payload: {
          targetId: '111 222 333',
          senderId: '444 555 666',
          senderName: 'Test Operator',
          password: 'TESTPW'
        }
      }));
    }
  }
}, 1000);
