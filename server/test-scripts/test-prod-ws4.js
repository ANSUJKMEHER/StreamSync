const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const tokenA = jwt.sign({ userId: 'f2de0183-8b7a-451b-a039-ef88ed7fce18', username: 'ANSUJKMEHER' }, 'super-secret-key-for-development-only');

const wsA = new WebSocket('wss://streamsync-cxox.onrender.com/ws?token=' + tokenA);

wsA.on('open', () => {
  console.log('[A] Connected');
});

wsA.on('close', (code, reason) => console.log('[A] Closed:', code, reason.toString()));

wsA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'ping') console.log(`[A] Received: ${msg.type}`);
});

setTimeout(() => {
  console.log('[A] Closing manually');
  wsA.close();
}, 10000);
