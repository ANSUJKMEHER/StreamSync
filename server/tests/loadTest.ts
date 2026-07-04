import WebSocket from 'ws';
import * as Y from 'yjs';
import { fromByteArray, toByteArray } from 'base64-js';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();
const WS_URL = 'ws://localhost:3001/ws';
const JWT_SECRET = process.env.JWT_SECRET || 'streamsync-dev-secret-change-in-production';

const NUM_CLIENTS = 100; // Number of concurrent users
const MEASUREMENT_COUNT = 10; // Number of messages to average

async function createTestRoom() {
  const user = await prisma.user.upsert({
    where: { username: 'load-tester' },
    update: {},
    create: {
      username: 'load-tester',
      passwordHash: 'fake',
    }
  });

  const room = await prisma.room.create({
    data: {
      name: `Load Test Room ${Date.now()}`,
      ownerId: user.id,
      isPublic: true,
      publicAccess: 'EDIT',
      files: {
        create: {
          name: 'test.ts',
          content: '',
        }
      }
    },
    include: { files: true }
  });

  return { user, room, fileId: room.files[0].id };
}

function generateToken(userId: string, username: string) {
  return jwt.sign({ userId, username }, JWT_SECRET);
}

class TestClient {
  ws: WebSocket;
  ydoc = new Y.Doc();
  id: number;
  userId: string;
  isConnected = false;
  hasJoined = false;
  
  onReady?: () => void;
  onUpdateReceived?: (updateSize: number) => void;
  onCursorReceived?: () => void;

  constructor(id: number, roomId: string) {
    this.id = id;
    this.userId = `client-${id}-${Date.now()}`;
    const token = generateToken(this.userId, `User ${id}`);
    
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);
    
    this.ws.on('open', () => {
      this.isConnected = true;
      // Join room
      this.ws.send(JSON.stringify({
        type: 'join-room',
        roomId
      }));
    });

    this.ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'yjs-sync') {
        this.hasJoined = true;
        Y.applyUpdate(this.ydoc, toByteArray(msg.payload.update));
        if (this.onReady) this.onReady();
      } else if (msg.type === 'yjs-update') {
        const update = toByteArray(msg.payload.update);
        Y.applyUpdate(this.ydoc, update);
        if (this.onUpdateReceived) this.onUpdateReceived(update.byteLength);
      } else if (msg.type === 'awareness-update') {
        if (this.onCursorReceived) this.onCursorReceived();
      }
    });

    this.ydoc.on('update', (update, origin) => {
      if (origin !== 'local') return; // Only broadcast our own changes
      this.ws.send(JSON.stringify({
        type: 'yjs-update',
        roomId,
        payload: { update: fromByteArray(update) }
      }));
    });
  }

  sendCursorMove(roomId: string) {
    this.ws.send(JSON.stringify({
      type: 'awareness-update',
      roomId,
      payload: { x: Math.random() * 1000, y: Math.random() * 1000 }
    }));
  }

  close() {
    this.ws.close();
  }
}

async function runTest() {
  console.log('--- StreamSync Load Testing ---');
  console.log(`Setting up test room...`);
  
  const { room, fileId } = await createTestRoom();
  console.log(`Created Room: ${room.id}, File: ${fileId}`);
  
  console.log(`Connecting ${NUM_CLIENTS} concurrent clients...`);
  
  const tStartConnect = performance.now();
  const clients: TestClient[] = [];
  
  for (let i = 0; i < NUM_CLIENTS; i++) {
    clients.push(new TestClient(i, fileId));
  }

  // Wait for all to connect and sync
  await new Promise<void>((resolve) => {
    let readyCount = 0;
    for (const c of clients) {
      c.onReady = () => {
        readyCount++;
        if (readyCount === NUM_CLIENTS) resolve();
      };
    }
  });

  const tEndConnect = performance.now();
  console.log(`✅ All ${NUM_CLIENTS} clients connected and synced in ${(tEndConnect - tStartConnect).toFixed(2)}ms`);
  
  // Test 1: Editor Sync Latency (CRDT Updates)
  console.log(`\n▶ Test 1: Editor CRDT Sync Latency (1 sender -> ${NUM_CLIENTS - 1} receivers)`);
  
  const sender = clients[0];
  let editorLatencies: number[] = [];

  for (let iter = 0; iter < MEASUREMENT_COUNT; iter++) {
    await new Promise(resolve => setTimeout(resolve, 500)); // wait a bit between tests
    
    await new Promise<void>((resolveIteration) => {
      let receivedCount = 0;
      const startSend = performance.now();
      
      for (let i = 1; i < NUM_CLIENTS; i++) {
        clients[i].onUpdateReceived = () => {
          receivedCount++;
          if (receivedCount === NUM_CLIENTS - 1) {
            const rtt = performance.now() - startSend;
            editorLatencies.push(rtt);
            resolveIteration();
          }
        };
      }
      
      // Trigger local Yjs update which will be broadcasted via socket
      const ytext = sender.ydoc.getText('monaco');
      ytext.doc?.transact(() => {
        ytext.insert(0, `A`);
      }, 'local');
    });
  }
  
  const avgEditorLatency = editorLatencies.reduce((a, b) => a + b, 0) / editorLatencies.length;
  console.log(`Average Editor Sync Latency: ${avgEditorLatency.toFixed(2)}ms`);

  // Test 2: Canvas Awareness Sync (Cursor movements)
  console.log(`\n▶ Test 2: Canvas Awareness Latency (1 sender -> ${NUM_CLIENTS - 1} receivers)`);
  
  let canvasLatencies: number[] = [];
  for (let iter = 0; iter < MEASUREMENT_COUNT; iter++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await new Promise<void>((resolveIteration) => {
      let receivedCount = 0;
      const startSend = performance.now();
      
      for (let i = 1; i < NUM_CLIENTS; i++) {
        clients[i].onCursorReceived = () => {
          receivedCount++;
          if (receivedCount === NUM_CLIENTS - 1) {
            const rtt = performance.now() - startSend;
            canvasLatencies.push(rtt);
            resolveIteration();
          }
        };
      }
      
      sender.sendCursorMove(fileId);
    });
  }

  const avgCanvasLatency = canvasLatencies.reduce((a, b) => a + b, 0) / canvasLatencies.length;
  console.log(`Average Canvas Awareness Latency: ${avgCanvasLatency.toFixed(2)}ms`);

  // Cleanup
  console.log('\nCleaning up...');
  for (const c of clients) c.close();
  await prisma.file.deleteMany({ where: { roomId: room.id } });
  await prisma.room.delete({ where: { id: room.id } });
  await prisma.$disconnect();
  console.log('Done.');
  process.exit(0);
}

runTest().catch(console.error);
