import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const chars = await db.character.findMany({
  orderBy: { createdAt: 'desc' },
  take: 3,
});
for (const c of chars) {
  console.log(`id ${c.id} | ${c.name} | age ${c.age} | realm ${c.realm}`);
  console.log(`  atk=${c.attack} def=${c.defense} spd=${c.speed} hp=${c.maxHp}`);
  console.log(`  bodyGrowthResidual: ${(c as any).bodyGrowthResidual || '(undefined)'}`);
  console.log(`  origin: ${(c as any).originJson || '(undefined)'}`);
}
process.exit(0);