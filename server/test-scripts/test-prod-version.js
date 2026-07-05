const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const tokenA = jwt.sign({ userId: 'f2de0183-8b7a-451b-a039-ef88ed7fce18', username: 'ANSUJKMEHER' }, 'super-secret-key-for-development-only');

const wsA = new WebSocket('wss://streamsync-cxox.onrender.com/ws?token=' + tokenA);

wsA.on('open', () => {
  console.log('[A] Connected');
  // Send yjs-update for a fake room to trigger the NEW error response
  wsA.send(JSON.stringify({
    type: 'yjs-update',
    roomId: 'fake-room-id',
    payload: { update: 'fake-data' }
  }));
});

wsA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'ping') console.log(`[A] Received: ${msg.type}`, msg.payload || '');
});

setTimeout(() => {
  wsA.close();
}, 5000);
