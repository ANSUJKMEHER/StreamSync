const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const files = await prisma.file.findMany({
    where: { roomId: '538e44d7-e0a1-4e21-ab70-169cc69205f7' }
  });
  
  for (const f of files) {
    console.log(`${f.name} - content length: ${f.content?.length || 0} - crdtState exists: ${!!f.crdtState}`);
  }
}

main().finally(() => prisma.$disconnect());
