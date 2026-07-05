const { PrismaClient } = require('@prisma/client');
const Y = require('yjs');
const prisma = new PrismaClient();

async function main() {
  const file = await prisma.file.findFirst({
    where: { roomId: 'f7cbe34d-ce0f-4968-8f30-e6c859321d0e', name: 'src/index.css' }
  });
  
  if (file && file.crdtState) {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(file.crdtState));
    const text = ydoc.getText('monaco').toString();
    console.log(`RoomId: ${file.roomId} | src/index.css Yjs text length: ${text.length}`);
    console.log(`RoomId: ${file.roomId} | src/index.css DB content length: ${file.content?.length}`);
    console.log(`Text preview: ${text.substring(0, 100)}`);
  }
}

main().finally(() => prisma.$disconnect());
