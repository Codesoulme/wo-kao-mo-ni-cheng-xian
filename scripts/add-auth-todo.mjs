// 一次性脚本：给指定 route.ts 文件批量插入 P0 鉴权 TODO 注释块。
// 不破坏任何业务逻辑，仅插入注释。
import { readFileSync, writeFileSync } from 'fs';

const TODO = `// P0 TODO AUTH: 此 route 当前零鉴权，任意能访问 baseUrl 的人可改写任意 characterId。
// 完整鉴权方案（User model + session + where: { userId }）属于 P1。
// 当前已对破坏性 route（reset-world / clean-test-artifacts / ai-config / archive）加 requireAuth；
// 此 route 暂留 TODO，待 P1 引入 User model 后批量加 requireAuth + 收窄 where 条件。
// 参考实现：src/lib/auth.ts

`;

const FILES = [
  'src/app/api/game/alchemy/route.ts',
  'src/app/api/game/auction/route.ts',
  'src/app/api/game/choose/route.ts',
  'src/app/api/game/exploration/route.ts',
  'src/app/api/game/formation/route.ts',
  'src/app/api/game/interfere/route.ts',
  'src/app/api/game/item/route.ts',
  'src/app/api/game/latest/route.ts',
  'src/app/api/game/market/route.ts',
  'src/app/api/game/new/route.ts',
  'src/app/api/game/pet/route.ts',
  'src/app/api/game/preload-advance/route.ts',
  'src/app/api/game/settlement/route.ts',
  'src/app/api/game/state/route.ts',
  'src/app/api/game/ascension/check/route.ts',
  'src/app/api/game/ascension/end/route.ts',
  'src/app/api/game/ascension/start/route.ts',
  'src/app/api/game/combat/action/route.ts',
  'src/app/api/game/combat/end/route.ts',
  'src/app/api/game/restriction/check/route.ts',
  'src/app/api/game/restriction/interact/route.ts',
  'src/app/api/game/tribulation/action/route.ts',
  'src/app/api/game/tribulation/end/route.ts',
  'src/app/api/game/tribulation/start/route.ts',
];

for (const f of FILES) {
  const src = readFileSync(f, 'utf8');
  if (src.includes('P0 TODO AUTH')) {
    console.log('SKIP ' + f + ' (already has TODO)');
    continue;
  }
  // 插入位置：第一个 "export const runtime" 之前
  const idx = src.indexOf('export const runtime');
  if (idx < 0) {
    console.log('SKIP ' + f + ' (no runtime export)');
    continue;
  }
  const newSrc = src.slice(0, idx) + TODO + src.slice(idx);
  writeFileSync(f, newSrc, 'utf8');
  console.log('OK ' + f);
}
