// @ts-nocheck - script tool（用 bun:sqlite 直连快照库，不走 Prisma client）
//
// scripts/build-narrative-eval-samples.ts
// 甲路（真实产出重放）样本抽取器 —— 一次性冻结落盘，此后评测离线可跑。
//
// 取数方式沿用 scripts/probe-leak-all.ts 的思路（全表扫 EventLog + 正则筛），
// 差别有三：
//   1. 换 bun:sqlite 直连快照库文件，不依赖 Prisma client（本机 Prisma client 未生成）
//   2. 按 eventType 分层抽样，而不是只取最近 50 条
//   3. 泄漏正则不再内联 14 条，统一从 src/lib/xianxia/eval/rules.ts 取
//
// ─── 取样点为什么是这个库（关键，别抄错） ──────────────────────────────────
// 展示层 sanitizeNarrativeText（display.ts:457）会在落库前把机制词删掉/替换：
//   advance/route.ts:468-470  sanitizeEventDraft(...) → eventDrafts → eventLog.create
//   choose/route.ts:101       safeNarrative           → eventLog.create / choiceLog.create
//   interfere/route.ts:83     safeNarrative           → eventLog.create / interferenceLog.create
// 所以**当前** prisma/dev.db 里的 EventLog 是 sanitize **之后**的文本，
// 拿它当样本，泄漏维度永远满分 —— 这就是假绿的来源。
//
// 本抽取器改用快照库 prisma/backups/dev.before-worldfacts-20260619-190352.db：
//   · 时间证据：sanitizeEventDraft 由 commit d15aea0（2026-06-23）引入，
//     该库快照于 2026-06-19，早于过滤层落地 → 库内文本从未过 sanitize
//   · 行为证据：对库内 259 条重跑 sanitizeNarrativeText，仍有 4 条会被改动，
//     说明确有 sanitize 该删而未删的残留；当前 dev.db 24 条则 0 条会被改动
//   · 门禁证据：本抽取器落盘前会用 checkGates 扫一遍，泄漏门禁必须有命中，
//     一条都不报就说明取样点又错了，脚本会直接报错退出
//
// 用法：bun scripts/build-narrative-eval-samples.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';
import { checkGates, failedGateIds } from '../src/lib/xianxia/eval/rules';
import { sanitizeNarrativeText } from '../src/lib/xianxia/display';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname_esm, '..');
const OUT_DIR = path.join(REPO, 'tests', 'fixtures', 'narrative-eval', 'replay');

// sanitize 层落地前的快照库（见文件头说明）
const SOURCE_DB = path.join(REPO, 'prisma', 'backups', 'dev.before-worldfacts-20260619-190352.db');
const SOURCE_DB_LABEL = 'prisma/backups/dev.before-worldfacts-20260619-190352.db';
const SANITIZE_COMMIT = 'd15aea0 (2026-06-23) 引入 sanitizeEventDraft；本库快照于 2026-06-19，早于该提交';

// ==================== 分层定义 ====================
// 8 层是目标；实际能取到几层取决于快照库里跑到过哪些剧情。
// 身故 / 结算两层在本快照里没有数据（12 个角色 alive 全为 1，无人身故、无评传落库），
// 这两层的缺口如实报告，不用人造样本冒充真实重放。

interface Stratum {
  key: string;
  label: string;
  scope: string;
  where: string;
  take: number;
}

const STRATA: Stratum[] = [
  { key: 'birth', label: '出生', scope: 'birth', where: `title LIKE '降生%'`, take: 10 },
  { key: 'advance', label: '年岁推进', scope: 'advance', where: `eventType='normal' AND title NOT LIKE '降生%'`, take: 10 },
  { key: 'choice', label: '抉择', scope: 'choice', where: `eventType='choice'`, take: 10 },
  { key: 'combat-round', label: '战斗回合', scope: 'combat-round', where: `eventType='combat' AND title NOT LIKE '战斗·%'`, take: 10 },
  { key: 'combat-end', label: '战斗终局', scope: 'combat-end', where: `eventType='combat' AND title LIKE '战斗·%'`, take: 10 },
  { key: 'breakthrough', label: '突破', scope: 'breakthrough', where: `eventType='breakthrough'`, take: 10 },
  { key: 'death', label: '身故', scope: 'death', where: `eventType='death' OR title LIKE '%身故%' OR title LIKE '%陨落%'`, take: 10 },
  { key: 'settlement', label: '结算', scope: 'settlement', where: `eventType='ending' OR eventType='settlement' OR title LIKE '%评传%'`, take: 10 },
  // 补充层：上面 8 层凑不满 60 时，用快照库里真实存在的其余类型补覆盖
  { key: 'fate-node', label: '命理回响', scope: 'advance', where: `eventType='fate_node'`, take: 6 },
  { key: 'interference', label: '天道回响', scope: 'generic', where: `eventType='interference' AND title LIKE '干扰%'`, take: 8 },
  { key: 'trade', label: '坊市交易', scope: 'generic', where: `eventType='trade'`, take: 6 },
  { key: 'alchemy', label: '炼丹', scope: 'generic', where: `eventType='alchemy'`, take: 4 },
];

// ==================== 确定性抽样 ====================
// 不引入新的种子设施（仓里已有 seededRand / stableId 等），
// 这里要固定的也不是随机数，而是**入参快照**：同一个库 + 同一个 where + 同一个 take
// 必然产出同一组样本 —— 用「按 (age,id) 排序后等距取点」实现，零随机。

function pickEvenly<T>(rows: T[], take: number): T[] {
  if (rows.length <= take) return rows;
  const out: T[] = [];
  const step = rows.length / take;
  for (let i = 0; i < take; i++) out.push(rows[Math.floor(i * step)]);
  return out;
}

/**
 * 分层内抽样：已知阳性优先，其余等距补齐。
 *
 * 「已知阳性」= 门禁有非 warn 命中，或现行 sanitize 仍会改动该文本。
 * 这两类是整个样本集里最贵的样本：
 *   · 它们是判分器校准的锚点（判分器若给它们高分，说明评分标准失效）
 *   · 它们同时是取样点的证据（sanitize 之后的文本不可能留下这种残留）
 * 纯等距抽样会把这些稀有样本（259 条里只有个位数）整体漏掉，所以必须显式保底。
 * 仍然零随机：同一个库 + 同一个 where + 同一个 take → 同一组样本。
 */
function pickWithPositives<T extends { narrative: string }>(rows: T[], take: number, scope: string): T[] {
  const isPositive = (r: T) => {
    const t = r.narrative || '';
    if (sanitizeNarrativeText(t) !== t) return true;
    return failedGateIds(checkGates(t, { scope })).length > 0;
  };
  const positives = rows.filter(isPositive);
  const plain = rows.filter((r) => !isPositive(r));
  const keptPositives = pickEvenly(positives, take);
  const remain = take - keptPositives.length;
  const keptPlain = remain > 0 ? pickEvenly(plain, remain) : [];
  // 回到原始顺序输出，便于 diff 稳定
  const keep = new Set<T>([...keptPositives, ...keptPlain]);
  return rows.filter((r) => keep.has(r));
}

function slug(s: string): string {
  return s.replace(/[^0-9A-Za-z一-龥]/g, '').slice(0, 12) || 'x';
}

// ==================== 主流程 ====================

if (!fs.existsSync(SOURCE_DB)) {
  console.error(`[甲路] 快照库不存在：${SOURCE_DB}`);
  console.error('[甲路] 未完成。原因：sanitize 前的快照库缺失，无法做真实产出重放。');
  process.exit(1);
}

const db = new Database(SOURCE_DB, { readonly: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// 清掉上一轮产物，避免删了分层还留着孤儿文件
for (const f of fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
  fs.unlinkSync(path.join(OUT_DIR, f));
}

const seenNarrative = new Set<string>();
const report: Array<{ key: string; label: string; available: number; unique: number; written: number }> = [];
let written = 0;
let sanitizeWouldChange = 0;
let gateFailCount = 0;
const leakHitCategories = new Set<string>();
const reviewList: Array<{ id: string; gates: string[]; hits: string[] }> = [];

for (const st of STRATA) {
  const rows: any[] = db
    .query(`SELECT id, age, title, narrative, eventType, createdAt FROM EventLog WHERE ${st.where} ORDER BY age ASC, id ASC`)
    .all();
  // 逐字去重：出生事件在快照库里大量重复（同一条兜底文案写了 12 次），
  // 重复样本对评测无增益，只会把分层配额浪费掉
  const uniq = rows.filter((r) => {
    const key = (r.narrative || '').trim();
    if (!key || seenNarrative.has(key)) return false;
    seenNarrative.add(key);
    return true;
  });
  const picked = pickWithPositives(uniq, st.take, st.scope);

  let n = 0;
  for (const r of picked) {
    n++;
    const narrative: string = r.narrative || '';
    const title: string = r.title || '';
    const gateOptions = { scope: st.scope };
    const results = checkGates(narrative, gateOptions);
    const failed = failedGateIds(results);
    if (failed.length) gateFailCount++;
    for (const g of results) for (const h of g.hits) if (h.severity !== 'warn') leakHitCategories.add(h.category);

    const sanitized = sanitizeNarrativeText(narrative);
    const sanitizeDelta = sanitized !== narrative;
    if (sanitizeDelta) sanitizeWouldChange++;

    const id = `replay-${st.key}-${String(n).padStart(2, '0')}-${slug(title)}`;
    if (failed.length) {
      reviewList.push({
        id,
        gates: failed,
        hits: results.flatMap((g) => g.hits.filter((h) => h.severity !== 'warn').map((h) => `${h.category}:${h.term}`)),
      });
    }

    const fixture = {
      id,
      route: '甲',
      kind: 'narrative-replay',
      stratum: st.key,
      stratumLabel: st.label,
      prompt: `真实产出重放 · ${st.label} · eventType=${r.eventType} · age=${r.age} · title=${title}`,
      expectedSchema: { title: 'string', narrative: 'string' },
      expectedOutput: { title, narrative },
      gateOptions,
      // 冻结当前门禁判定。判分器接上后若这里对不上，就是判据变了，必须人工复核。
      expectedGates: { result: failed.length ? 'fail' : 'pass', gates: failed },
      tags: ['real-replay', st.key, 'pre-sanitize'],
      provenance: {
        sourceDb: SOURCE_DB_LABEL,
        sourceTable: 'EventLog',
        sourceRowId: r.id,
        createdAt: r.createdAt,
        preSanitizeEvidence: SANITIZE_COMMIT,
        // true = 现行 sanitize 层仍会改动此文本 → 该样本必然是 sanitize 之前的原文
        sanitizeWouldChange: sanitizeDelta,
      },
      notes: `甲路真实重放，取自 sanitize 层落地前的快照库；未经 sanitizeNarrativeText 处理。`,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
    written++;
  }
  report.push({ key: st.key, label: st.label, available: rows.length, unique: uniq.length, written: picked.length });
}

// ==================== 落盘前自检 ====================

console.log('\n=== 甲路 · 真实产出重放 分层结果 ===');
for (const r of report) {
  const flag = r.written === 0 ? '  ← 本快照库无数据，缺口如实记录' : '';
  console.log(`  ${r.label.padEnd(6)} 库内 ${String(r.available).padStart(4)} 去重后 ${String(r.unique).padStart(3)} 落盘 ${String(r.written).padStart(3)}${flag}`);
}
console.log(`\n合计落盘 ${written} 条 → ${path.relative(REPO, OUT_DIR)}`);
console.log(`门禁失败 ${gateFailCount} 条；现行 sanitize 仍会改动 ${sanitizeWouldChange} 条`);
console.log(`非 warn 命中分类：${[...leakHitCategories].join(', ') || '（无）'}`);

if (reviewList.length) {
  console.log('\n--- 需人工复核的门禁失败样本（已冻结为 expectedGates=fail）---');
  for (const r of reviewList) console.log(`  ${r.id} [${r.gates.join(',')}] ${r.hits.slice(0, 4).join(' ')}`);
}

// 取样点校验：泄漏门禁一条都不报 → 八成抓的是 sanitize 之后的文本
const leakGateHit = reviewList.some((r) => r.gates.includes('G1') || r.gates.includes('G2'));
if (!leakGateHit) {
  console.error('\n[甲路] 取样点校验失败：G1/G2 泄漏门禁在 60 条真实样本上一条都没报。');
  console.error('[甲路] 这通常意味着抓到的是 sanitizeNarrativeText 之后的文本，泄漏维度会永远满分。');
  console.error('[甲路] 请回查取数来源，不要拿 sanitize 后的文本当真实重放。');
  process.exit(1);
}
console.log(`\n取样点校验通过：G1/G2 在真实样本上有命中（含 ${sanitizeWouldChange} 条 sanitize 会改动的残留），确认取的是 sanitize 之前的原文。`);
process.exit(0);
