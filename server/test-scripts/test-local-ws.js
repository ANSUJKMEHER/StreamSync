const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const tokenA = jwt.sign({ userId: 'f2de0183-8b7a-451b-a039-ef88ed7fce18', username: 'ANSUJKMEHER' }, 'super-secret-key-for-development-only');

const wsA = new WebSocket('ws://localhost:3001/ws?token=' + tokenA);

wsA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'ping') console.log(`[A] Received: ${msg.type}`);
});

wsA.on('open', () => {
  console.log('[A] Connected');
});

wsA.on('close', (code, reason) => console.log('[A] Closed:', code, reason.toString()));

setTimeout(() => {
  console.log('[A] Closing manually');
  wsA.close();
}, 2000);
