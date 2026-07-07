import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const events = await db.eventLog.findMany({
  orderBy: { createdAt: 'desc' },
  take: 8,
  select: { age: true, title: true, effects: true, createdAt: true },
});

for (const e of events) {
  const fx = JSON.parse(e.effects || '[]');
  const bodyGrowth = fx.filter((f: any) =>
    f?.attribute && ['attack', 'defense', 'speed', 'maxHp'].includes(f.attribute)
  );
  const otherAttr = fx.filter((f: any) =>
    f?.attribute && !['attack', 'defense', 'speed', 'maxHp'].includes(f.attribute)
  );
  console.log(`age ${e.age} | ${e.title}`);
  console.log(`  body-growth chips: ${JSON.stringify(bodyGrowth)}`);
  console.log(`  other attr chips: ${JSON.stringify(otherAttr)}`);
  console.log(`  total effects: ${fx.length}`);
  console.log('---');
}
process.exit(0);