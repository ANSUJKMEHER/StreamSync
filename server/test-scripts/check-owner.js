const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const room = await prisma.room.findUnique({
    where: { id: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e' },
    include: { collaborators: true }
  });
  console.log(room);
}

main().finally(() => prisma.$disconnect());
