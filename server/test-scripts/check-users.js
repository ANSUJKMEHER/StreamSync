const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: ['f2de0183-8b7a-451b-a039-ef88ed7fce18', '0f96434f-f329-4a89-a5de-087a2f0d38db', '2b3aecc0-a911-4dd4-a802-196cac6e7ae5']
      }
    }
  });
  
  console.log(users.map(u => `${u.id}: ${u.username}`));
}

main().finally(() => prisma.$disconnect());
