import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1/ai/complete';
const JWT_SECRET = process.env.JWT_SECRET || 'streamsync-dev-secret-change-in-production';

const NUM_CONCURRENT = 50; 
const REQUESTS_PER_CLIENT = 2; // Total requests = 100

function generateToken(userId: string, username: string) {
  return jwt.sign({ userId, username }, JWT_SECRET);
}

async function runBenchmark() {
  console.log('--- AI Endpoint Load Testing ---');
  
  const tokens = Array.from({ length: NUM_CONCURRENT }).map((_, i) => 
    generateToken(`user-${i}`, `User ${i}`)
  );

  console.log(`Sending ${NUM_CONCURRENT * REQUESTS_PER_CLIENT} concurrent requests to ${API_URL}...`);

  const start = performance.now();
  let successCount = 0;
  let rateLimitedCount = 0;
  let errorCount = 0;
  let totalLatency = 0;

  const promises = [];

  for (let i = 0; i < NUM_CONCURRENT; i++) {
    for (let j = 0; j < REQUESTS_PER_CLIENT; j++) {
      promises.push((async () => {
        const reqStart = performance.now();
        try {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens[i]}`
            },
            body: JSON.stringify({
              roomId: "test-room",
              context: {
                prefix: "function test() ",
                suffix: "",
                filename: "test.ts",
                language: "typescript"
              }
            })
          });
          
          if (res.status === 429) {
            rateLimitedCount++;
          } else if (res.ok) {
            successCount++;
            totalLatency += (performance.now() - reqStart);
          } else {
            console.error(`Request failed with status: ${res.status}`);
            errorCount++;
          }
        } catch (e: any) {
          console.error(`Fetch error: ${e.message}`);
          errorCount++;
        }
      })());
    }
  }

  await Promise.all(promises);
  
  const totalTime = performance.now() - start;
  
  console.log(`\nTest Completed in ${totalTime.toFixed(2)}ms`);
  console.log(`Successful: ${successCount}`);
  console.log(`Rate Limited: ${rateLimitedCount}`);
  console.log(`Errors: ${errorCount}`);
  
  if (successCount > 0) {
    console.log(`Average Latency (Successful): ${(totalLatency / successCount).toFixed(2)}ms`);
    console.log(`Throughput: ${((successCount / totalTime) * 1000).toFixed(2)} req/sec`);
  }

  process.exit(0);
}

runBenchmark().catch(console.error);
