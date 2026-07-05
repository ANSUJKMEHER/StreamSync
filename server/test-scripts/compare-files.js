const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customFile = await prisma.file.findFirst({
    where: { name: 'index.css', isFolder: false, roomId: { not: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e' } },
    orderBy: { createdAt: 'desc' }
  });
  
  const githubFile = await prisma.file.findFirst({
    where: { roomId: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e', name: 'src/index.css' }
  });
  
  console.log('Custom File:', customFile);
  console.log('GitHub File:', githubFile);
}

main().finally(() => prisma.$disconnect());
