import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// 全表扫，看哪些事件 narrative 还含"变化"或"+N"等可能泄露的字符
const events = await db.eventLog.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50,
  select: { age: true, title: true, narrative: true, createdAt: true },
});

const leakPatterns = [
  /变化\s*[+\-±]\s*\d/g,
  /属性\s*[+\-±]\s*\d/g,
  /修为\s*[+\-±]\s*\d/g,
  /悟性\s*[+\-±]\s*\d/g,
  /灵根\s*[+\-±]\s*\d/g,
  /根骨\s*[+\-±]\s*\d/g,
  /福缘\s*[+\-±]\s*\d/g,
  /气运\s*[+\-±]\s*\d/g,
  /破势\s*[+\-±]\s*\d/g,
  /护持\s*[+\-±]\s*\d/g,
  /机变\s*[+\-±]\s*\d/g,
  /气血(?:上限)?\s*[+\-±]\s*\d/g,
  /灵力(?:上限)?\s*[+\-±]\s*\d/g,
  /寿元\s*[+\-±]\s*\d/g,
];

let leakCount = 0;
for (const e of events) {
  for (const p of leakPatterns) {
    const m = e.narrative.match(p);
    if (m) {
      console.log(`age ${e.age} | ${e.title} | ${e.createdAt.toISOString()}`);
      console.log(`  match: ${m[0]} (in: ...${(e.narrative.match(new RegExp(`.{0,30}${m[0]}.{0,30}`)) || [''])[0]}...)`);
      leakCount++;
      break;
    }
  }
}
console.log(`\nTotal leak events: ${leakCount} / ${events.length} checked`);
process.exit(0);