const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const c = await p.character.findFirst({ where: { alive: true }, select: { id: true, name: true, age: true, realm: true, realmLevel: true } });
    console.log(JSON.stringify(c));
  } catch (e) { console.error('ERR', e.message); }
  await p.$disconnect();
})();