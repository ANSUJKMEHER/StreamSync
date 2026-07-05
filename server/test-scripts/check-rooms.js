const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    where: { name: 'E-commerce' },
    include: { files: { where: { name: 'src/index.css' } } }
  });
  
  console.log(`Found ${rooms.length} E-commerce rooms`);
  rooms.forEach(r => {
    console.log(`Room ID: ${r.id}, CreatedAt: ${r.createdAt}, Files: ${r.files.length}`);
    r.files.forEach(f => console.log(`  File ID: ${f.id}`));
  });
}

main().finally(() => prisma.$disconnect());
