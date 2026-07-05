const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Y = require('yjs');
const { fromByteArray, toByteArray } = require('base64-js');
const { PrismaClient } = require('@prisma/client');

const JWT_SECRET = "super-secret-key-for-development-only";

// Use real user IDs from the database
const tokenA = jwt.sign({ userId: "f2de0183-8b7a-451b-a039-ef88ed7fce18", username: "ANSUJKMEHER" }, JWT_SECRET);
const tokenB = jwt.sign({ userId: "0f96434f-f329-4a89-a5de-087a2f0d38db", username: "test" }, JWT_SECRET);

const wsBase = 'ws://localhost:3001';
const prisma = new PrismaClient();

async function main() {
  const roomId = '9f258559-267e-4e7a-9ea4-625bf52a2979'; // src/index.css

  const wsA = new WebSocket(`${wsBase}/ws?token=${tokenA}`);
  const wsB = new WebSocket(`${wsBase}/ws?token=${tokenB}`);

  let aDoc = new Y.Doc();
  let bDoc = new Y.Doc();
  let aText = aDoc.getText('monaco');
  let bText = bDoc.getText('monaco');

  wsA.on('open', () => {
    console.log('[A] Connected');
    wsA.send(JSON.stringify({ type: 'join-room', roomId }));
  });

  wsB.on('open', () => {
    console.log('[B] Connected');
    wsB.send(JSON.stringify({ type: 'join-room', roomId }));
  });

  // A listens to server
  wsA.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'yjs-sync') {
      Y.applyUpdate(aDoc, toByteArray(msg.payload.update));
      console.log(`[A] Got yjs-sync! Text length: ${aText.toString().length}`);
      
      // Simulate A typing "hello"
      console.log('[A] Typing "hello"');
      aText.insert(0, "hello");
    } else if (msg.type === 'yjs-update') {
      Y.applyUpdate(aDoc, toByteArray(msg.payload.update));
      console.log(`[A] Got update! Text: ${aText.toString()}`);
    } else if (msg.type === 'error') {
      console.log(`[A] ERROR:`, msg.payload);
    }
  });

  // A sends local updates to server
  aDoc.on('update', (update, origin) => {
    if (origin !== 'remote') {
      console.log('[A] Sending local update to server');
      wsA.send(JSON.stringify({
        type: 'yjs-update',
        roomId,
        payload: { update: fromByteArray(update) }
      }));
    }
  });

  // B listens to server
  wsB.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'yjs-sync') {
      Y.applyUpdate(bDoc, toByteArray(msg.payload.update), 'remote');
      console.log(`[B] Got yjs-sync! Text length: ${bText.toString().length}`);
    } else if (msg.type === 'yjs-update') {
      Y.applyUpdate(bDoc, toByteArray(msg.payload.update), 'remote');
      console.log(`[B] Got update! Text: ${bText.toString()}`);
      
      if (bText.toString() === "hello") {
        console.log('✅ SUCCESS! B received A\'s text!');
        wsA.close();
        wsB.close();
        prisma.$disconnect();
        process.exit(0);
      }
    } else if (msg.type === 'error') {
      console.log(`[B] ERROR:`, msg.payload);
    }
  });

  setTimeout(() => {
    console.log(`\n❌ TIMEOUT!`);
    wsA.close();
    wsB.close();
    prisma.$disconnect();
    process.exit(1);
  }, 10000);
}

main().catch(console.error);
