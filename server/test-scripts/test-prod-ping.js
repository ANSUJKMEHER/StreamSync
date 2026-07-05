const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const tokenA = jwt.sign({ userId: 'f2de0183-8b7a-451b-a039-ef88ed7fce18', username: 'ANSUJKMEHER' }, 'super-secret-key-for-development-only');

const wsA = new WebSocket('wss://streamsync-cxox.onrender.com/ws?token=' + tokenA);

wsA.on('message', (data) => {
  console.log('[A] RAW MESSAGE:', data.toString());
});

wsA.on('open', () => {
  console.log('[A] Connected. Sending ping...');
  wsA.send(JSON.stringify({ type: 'ping' }));
});

wsA.on('close', (code, reason) => console.log('[A] Closed:', code, reason.toString()));

setTimeout(() => {
  wsA.close();
}, 5000);
