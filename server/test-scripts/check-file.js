const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const file = await prisma.file.findFirst({
    where: { roomId: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e', name: 'src/index.css' }
  });
  
  console.log('File ID:', file.id);
  console.log('Room ID:', file.roomId);
}

main().finally(() => prisma.$disconnect());
