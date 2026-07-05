import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3001/ws?token=mock_token_for_test');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'join-room',
    roomId: 'a6d1fe00-1787-447a-949b-3f84ecc395c4' // TestRoom
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
}, 5000);
