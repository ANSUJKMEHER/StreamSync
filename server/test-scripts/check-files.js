const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const files = await prisma.file.findMany({
    where: { roomId: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e', name: 'src/index.css' }
  });
  
  console.log(`Found ${files.length} files named src/index.css in room`);
  files.forEach(f => {
    console.log(`ID: ${f.id}, Name: ${f.name}`);
  });
}

main().finally(() => prisma.$disconnect());
