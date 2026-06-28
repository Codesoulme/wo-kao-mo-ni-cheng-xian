// @ts-nocheck - script tool, no strict types needed

// scripts/l3-integration-smoke.ts
// AI-75: L3 机制综合集成测试（飞升/天劫/心魔/禁制/跨域/洞府联动）
import { readFileSync } from 'node:fs';

function log(name: string, payload: unknown): void {
  console.log(JSON.stringify({ smoke: name, ...((payload as object) ?? {}) }));
}

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.log(JSON.stringify({ passed: false, error: msg }));
    process.exit(1);
  }
}

function check(name: string, cond: unknown, msg: string): void {
  if (!cond) { log(name, { passed: false, error: msg }); process.exit(1); }
  log(name, { passed: true });
}

// 1. 类型契约完整性
const types = readFileSync('src/lib/xianxia/types.ts', 'utf-8');
check('l3-types-complete',
  /TribulationStage/.test(types) && /HeartDemonType/.test(types) && /WorldTier/.test(types)
    && /AscensionRequirement/.test(types) && /AscensionSession/.test(types)
    && /RestrictionType/.test(types) && /RestrictionAccessMethod/.test(types)
    && /interface Restriction/.test(types) && /interface TribulationSession/.test(types),
  'L3 类型契约不完整');

// 2. 引擎派生函数完整性
const engine = readFileSync('src/lib/xianxia/engine.ts', 'utf-8');
const requiredFns = [
  'deriveTribulationTrigger', 'resolveTribulationBolt', 'resolveHeartDemon',
  'deriveAscensionRequirements', 'checkAscensionEligibility',
  'deriveAscensionTrigger', 'resolveAscensionOutcome',
  'deriveCrossRealmPaths',
  'checkRestrictionAccess', 'deriveRestrictionTrigger', 'resolveRestrictionInteraction',
  'deriveRealmRestrictionCheck',
];
const missingFns = requiredFns.filter((fn) => !new RegExp(`export function ${fn}\\b`).test(engine));
check('l3-engine-fns-complete', missingFns.length === 0, `缺失引擎函数：${missingFns.join(', ')}`);

// 3. API routes 完整性
const requiredRoutes = [
  'tribulation/start', 'tribulation/action', 'tribulation/end',
  'ascension/check', 'ascension/start', 'ascension/end',
  'restriction/check', 'restriction/interact',
];
import { existsSync } from 'node:fs';
const missingRoutes = requiredRoutes.filter((r) => !existsSync(`src/app/api/game/${r}/route.ts`));
check('l3-api-routes-complete', missingRoutes.length === 0, `缺失 API route：${missingRoutes.join(', ')}`);

// 4. UI 组件完整性
const requiredUis = [
  'TribulationModal', 'AscensionModal', 'RestrictionModal',
];
const missingUis = requiredUis.filter((u) => !existsSync(`src/components/xianxia/${u}.tsx`));
check('l3-ui-complete', missingUis.length === 0, `缺失 UI 组件：${missingUis.join(', ')}`);

// 5. GameLayout 接入
const page = readFileSync('src/app/page.tsx', 'utf-8');
check('l3-layout-integrated',
  /TribulationModal/.test(page) && /AscensionModal/.test(page) && /RestrictionModal/.test(page)
    && /tribulation-section/.test(page) && /ascension-section/.test(page) && /restriction-section/.test(page),
  'GameLayout 未接入 L3 modals');

// 6. prisma schema 持久化字段
const schema = readFileSync('prisma/schema.prisma', 'utf-8');
check('l3-schema-persistence',
  /ascensionPending/.test(schema) && /restrictionPending/.test(schema)
    && /tribulationPending/.test(schema) && /tribulationResultJson/.test(schema),
  'prisma schema 未含 L3 持久化字段');

// 7. 文档完整性
const requiredDocs = [
  'ascension-flow.md', 'three-realms-detail.md',
  'cross-realm-npcs.md', 'starry-sky-paths.md',
  'restrictions-detail.md',
];
const missingDocs = requiredDocs.filter((d) => !existsSync(`docs/world/${d}`));
check('l3-docs-complete', missingDocs.length === 0, `缺失 L3 文档：${missingDocs.join(', ')}`);

console.log(JSON.stringify({ passed: true, suite: 'l3-integration-smoke' }));