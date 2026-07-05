const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const file = await prisma.file.findUnique({
    where: { id: 'f7659575-6cb7-4ba8-adb5-dbd3a259ebc4' },
    include: { room: { include: { collaborators: true } } }
  });
  console.log(JSON.stringify(file, null, 2));
}

main().finally(() => prisma.$disconnect());
