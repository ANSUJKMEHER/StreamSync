const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "super-secret-key-for-development-only";
const token = jwt.sign({ userId: "123", username: "test" }, JWT_SECRET);

const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

// Wait, I need a valid roomId from the database!
const roomId = "069aeea9-e868-4af1-9073-e43520178ec8"; // src/App.jsx from check-crdt.js output

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'join-room',
    roomId: roomId
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg.type);
  if (msg.type === 'yjs-sync') {
    console.log('Got yjs-sync payload length:', msg.payload.update.length);
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 15000);
