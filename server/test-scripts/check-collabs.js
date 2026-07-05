const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    where: { name: 'E-commerce' },
    include: { collaborators: true }
  });
  
  rooms.forEach(r => {
    console.log(`Room: ${r.id}`);
    r.collaborators.forEach(c => console.log(`  Collaborator: ${c.userId}, role: ${c.role}`));
  });
}

main().finally(() => prisma.$disconnect());
