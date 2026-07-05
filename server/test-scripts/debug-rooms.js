const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find all rooms
  const rooms = await p.room.findMany({
    include: { _count: { select: { files: true } } }
  });
  
  console.log('=== ALL ROOMS ===');
  for (const rm of rooms) {
    console.log(`${rm.id} | "${rm.name}" | owner=${rm.ownerId} | files=${rm._count.files} | github=${rm.githubRepo || 'none'}`);
  }

  // Find duplicate rooms (same githubRepo)
  const byRepo = {};
  for (const rm of rooms) {
    const key = rm.githubRepo || rm.name;
    if (!byRepo[key]) byRepo[key] = [];
    byRepo[key].push(rm);
  }
  
  console.log('\n=== DUPLICATES ===');
  for (const [key, rms] of Object.entries(byRepo)) {
    if (rms.length > 1) {
      console.log(`"${key}" appears ${rms.length} times:`);
      rms.forEach(rm => console.log(`  - ${rm.id} (${rm._count.files} files)`));
    }
  }
}

main().finally(() => p.$disconnect());
