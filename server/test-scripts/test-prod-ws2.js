const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const tokenA = jwt.sign({ userId: 'f2de0183-8b7a-451b-a039-ef88ed7fce18', username: 'ANSUJKMEHER' }, 'super-secret-key-for-development-only');
const tokenB = jwt.sign({ userId: '0f96434f-f329-4a89-a5de-087a2f0d38db', username: 'test' }, 'super-secret-key-for-development-only');

const wsA = new WebSocket('wss://streamsync-cxox.onrender.com/ws?token=' + tokenA);
const wsB = new WebSocket('wss://streamsync-cxox.onrender.com/ws?token=' + tokenB);

const roomId = '9f258559-267e-4e7a-9ea4-625bf52a2979';

wsA.on('open', () => {
  console.log('[A] Connected');
  wsA.send(JSON.stringify({ type: 'join-room', roomId }));
});

wsA.on('close', (code, reason) => console.log('[A] Closed:', code, reason.toString()));

wsB.on('open', () => {
  console.log('[B] Connected');
  wsB.send(JSON.stringify({ type: 'join-room', roomId }));
});

wsB.on('close', (code, reason) => console.log('[B] Closed:', code, reason.toString()));

wsA.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'ping') console.log(`[A] Received: ${msg.type}`, msg.payload || '');
});

wsB.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'ping') console.log(`[B] Received: ${msg.type}`, msg.payload || '');
});

setTimeout(() => {
  console.log('[A] Sending awareness-update');
  wsA.send(JSON.stringify({ type: 'awareness-update', roomId, payload: { update: 'test' } }));
}, 3000);

setTimeout(() => {
  wsA.close();
  wsB.close();
}, 5000);
