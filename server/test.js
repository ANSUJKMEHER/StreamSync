const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const file = await prisma.file.findFirst({ where: { name: { contains: 'App.css' } } });
  console.log('File:', file ? file.name : 'not found');
  if (file) console.log('Content length:', file.content.length);
}
run().catch(console.error).finally(() => process.exit(0));
