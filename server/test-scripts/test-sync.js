const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Y = require('yjs');
const { fromByteArray, toByteArray } = require('base64-js');

const JWT_SECRET = "super-secret-key-for-development-only";

// Use real user IDs from the database
const tokenA = jwt.sign({ userId: "f2de0183-8b7a-451b-a039-ef88ed7fce18", username: "ANSUJKMEHER" }, JWT_SECRET);
const tokenB = jwt.sign({ userId: "2b3aecc0-a911-4dd4-a802-196cac6e7ae5", username: "christina343" }, JWT_SECRET);

const wsBase = 'ws://localhost:3001';

// We need a FILE ID (not a Room ID) — let's find one dynamically
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get a file that belongs to the E-commerce room owned by ANSUJKMEHER
  const file = await prisma.file.findFirst({
    where: { 
      room: { ownerId: "f2de0183-8b7a-451b-a039-ef88ed7fce18" },
      content: { not: "" }
    }
  });
  
  if (!file) {
    console.log('No file found!');
    process.exit(1);
  }
  
  console.log(`Testing with file: ${file.name} (${file.id})`);
  console.log(`File content length: ${file.content.length}`);
  const roomId = file.id; // In this system, roomId = fileId for WebSocket

  const wsA = new WebSocket(`${wsBase}/ws?token=${tokenA}`);
  const wsB = new WebSocket(`${wsBase}/ws?token=${tokenB}`);

  let aGotSync = false;
  let bGotSync = false;

  wsA.on('open', () => {
    console.log('[A] Connected');
    wsA.send(JSON.stringify({ type: 'join-room', roomId }));
  });

  wsB.on('open', () => {
    console.log('[B] Connected');
    wsB.send(JSON.stringify({ type: 'join-room', roomId }));
  });

  wsA.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'yjs-sync') {
      aGotSync = true;
      const doc = new Y.Doc();
      Y.applyUpdate(doc, toByteArray(msg.payload.update));
      const text = doc.getText('monaco').toString();
      console.log(`[A] Got yjs-sync! Text length: ${text.length}, preview: "${text.substring(0, 50)}..."`);
      checkDone();
    } else if (msg.type === 'error') {
      console.log(`[A] ERROR: ${JSON.stringify(msg.payload)}`);
    } else {
      console.log(`[A] Received: ${msg.type}`);
    }
  });

  wsB.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'yjs-sync') {
      bGotSync = true;
      const doc = new Y.Doc();
      Y.applyUpdate(doc, toByteArray(msg.payload.update));
      const text = doc.getText('monaco').toString();
      console.log(`[B] Got yjs-sync! Text length: ${text.length}, preview: "${text.substring(0, 50)}..."`);
      checkDone();
    } else if (msg.type === 'error') {
      console.log(`[B] ERROR: ${JSON.stringify(msg.payload)}`);
    } else {
      console.log(`[B] Received: ${msg.type}`);
    }
  });

  function checkDone() {
    if (aGotSync && bGotSync) {
      console.log('\n✅ SUCCESS! Both clients received yjs-sync with file content!');
      wsA.close();
      wsB.close();
      prisma.$disconnect();
      process.exit(0);
    }
  }

  setTimeout(() => {
    console.log(`\n❌ TIMEOUT! A got sync: ${aGotSync}, B got sync: ${bGotSync}`);
    wsA.close();
    wsB.close();
    prisma.$disconnect();
    process.exit(1);
  }, 15000);
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
