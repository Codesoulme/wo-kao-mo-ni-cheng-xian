// scripts/xianxia-narrative-quality.ts
//
// 叙事质量评测入口。两个模式，互不污染：
//
//   --gates-only   门禁层。**一次模型调用都不发**，纯正则，秒级。
//   --judge        判分层。默认仍不发请求（干跑组提示词）；只有再加 --live 才真调模型。
//
// 用法：
//   bun scripts/xianxia-narrative-quality.ts --gates-only            # 门禁 + 误报体检
//   bun scripts/xianxia-narrative-quality.ts --gates-only --quiet     # 只出汇总
//   bun scripts/xianxia-narrative-quality.ts --gates-only --route=丙
//   bun scripts/xianxia-narrative-quality.ts --judge                  # 判分干跑，零调用
//   bun scripts/xianxia-narrative-quality.ts --judge --live --limit=6  # 真调模型，限 6 条
//   bun scripts/xianxia-narrative-quality.ts --judge --live --judge-pick=id1,id2
//   bun scripts/xianxia-narrative-quality.ts --judge --live --timeout=1  # 逼出超时路径
//
// 输出契约：每条样本一行单行 JSON，供既有工具直接 parse：
//   {"eval":"narrative-quality","sample":"xxx","gates":"pass"}
//   {"eval":"narrative-judge","sample":"xxx","verdict":"合格"}
//
// **自己数自己 exit**：不抄主 runner「有 fail 也 exit 0」的宽松策略。
// 门禁层：任何一条样本的门禁实测与冻结期望不符，或误报体检不过，一律 exit 1。
// 判分层：判分器是仪表不是闸门，档位低不算 fail；但 --live 跑完一条都没判出来（全 unknown）
//         说明仪表本身坏了，那要 exit 1。
//
// 配额自保：当前是 5 小时滚动窗口，前面已经因为限速撞掉过任务。所以 --live 默认只跑 6 条、
// 顺序不并发，且必须显式给 --live 才发请求。不要一次把 91 条全打出去。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkGates,
  failedGateIds,
  assertLoreWhitelistSafe,
  ruleTableStats,
  type GateId,
  type GateResult,
  type NarrativeScope,
} from '../src/lib/xianxia/eval/rules';
import {
  judgeNarrative,
  summarizeJudgeOutcomes,
  splitGateSeverity,
  judgeTransportInfo,
  getJudgeCallCount,
  buildJudgePrompt,
  UNCOVERED_SCOPES,
  JUDGE_GRADES,
  GRADE_LABELS,
  GRADE_CRITERIA,
  DEFAULT_JUDGE_TIMEOUT_MS,
  type JudgeOutcome,
  type JudgeSample,
} from '../src/lib/xianxia/eval/judge';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname_esm, '..');
const FIXTURE_ROOT = path.join(REPO, 'tests', 'fixtures', 'narrative-eval');

const argv = process.argv.slice(2);
const GATES_ONLY = argv.includes('--gates-only');
const JUDGE = argv.includes('--judge');
const QUIET = argv.includes('--quiet');
const ROUTE_FILTER = (argv.find((a) => a.startsWith('--route='))?.split('=')[1] ?? '').trim();

function argNum(name: string, fallback: number): number {
  const raw = argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** 真实调用总闸。缺这个参数就是干跑，一次请求都不发。 */
const JUDGE_LIVE = argv.includes('--live');
/** 真实调用限量。默认 6，硬顶 10——5 小时窗口烧不起更多。 */
const JUDGE_LIMIT_RAW = argNum('limit', 6);
const JUDGE_LIMIT = Math.max(1, Math.min(10, Math.floor(JUDGE_LIMIT_RAW)));
const JUDGE_TIMEOUT_MS = argNum('timeout', DEFAULT_JUDGE_TIMEOUT_MS);
const JUDGE_PICK = (argv.find((a) => a.startsWith('--judge-pick='))?.split('=')[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const SHOW_PROMPT = argv.includes('--show-prompt');

if (!GATES_ONLY && !JUDGE) {
  console.error('要么 --gates-only（门禁层），要么 --judge（判分层）。判分真调模型还要再加 --live。');
  process.exit(2);
}

// ==================== 样本装载 ====================

interface Fixture {
  id: string;
  route: string;
  kind: string;
  label?: string;
  stratum?: string;
  stratumLabel?: string;
  expectedSchema: Record<string, string>;
  expectedOutput: any;
  gateOptions?: { scope?: NarrativeScope; requiredFields?: string[] };
  expectedGates?: { result: 'pass' | 'fail'; gates: GateId[] };
  expectedGrade?: string;
  violations?: string[];
  _file: string;
}

function loadDir(sub: string): Fixture[] {
  const dir = path.join(FIXTURE_ROOT, sub);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const p = path.join(dir, f);
      const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { ...j, _file: path.relative(REPO, p) } as Fixture;
    });
}

const fixtures: Fixture[] = [...loadDir('replay'), ...loadDir('state'), ...loadDir('negative')].filter(
  (f) => !ROUTE_FILTER || f.route === ROUTE_FILTER,
);

// ==================== 计数器（自己数） ====================

let passed = 0;
let failed = 0;
const failures: string[] = [];
const byRoute: Record<string, { total: number; ok: number; gateFail: number; mismatch: number }> = {};

function bump(route: string, k: 'total' | 'ok' | 'gateFail' | 'mismatch') {
  byRoute[route] ??= { total: 0, ok: 0, gateFail: 0, mismatch: 0 };
  byRoute[route][k]++;
}

function emit(sample: string, gates: string, extra: Record<string, unknown> = {}) {
  if (QUIET) return;
  console.log(JSON.stringify({ eval: 'narrative-quality', sample, gates, ...extra }));
}

// ==================== 误报体检（改词表必跑） ====================
// 这一段的存在理由：本层最容易犯的错是把「境界/灵根/天劫/机缘/渡劫/飞升」
// 这类玩家可见的正常题材词误判成泄漏。所以每次跑门禁都先拿正常叙事回测。

const NORMAL_NARRATIVES: ReadonlyArray<readonly [string, string, NarrativeScope]> = [
  [
    'fp-lore-dense',
    '沈清澜在寒潭边坐了三日，境界终于稳住。她本是水真灵根，行气顺水而下，' +
      '这一回突破没有走岔。师父说过，往后还有天劫要过，渡劫那一步谁也替不了。' +
      '她想起十六岁那年的机缘，若不是在南礁捡到那半张水脉图，如今大概还在药圃里数灵草。' +
      '至于飞升，那是太远的事，她没想过。',
    'breakthrough',
  ],
  [
    'fp-second-person',
    '你在潮候站了很久，风把幡子吹得直响。我们说好秋末就还债，可你手里只剩七块灵石。' +
      '他们从坊市那头过来，其中一个你认得，是去年在深水见过的那张脸。' +
      '你把刀往身后挪了挪，没有先开口。',
    'advance',
  ],
  [
    'fp-negated-root',
    '测灵石按在周阿满掌心，半点光也没有。他不是天灵根，连杂灵根都算勉强，' +
      '母亲在旁边有些失望，把他的手拉回来擦了擦。测灵人收了石头就走，' +
      '院里的人也散了。他那年十二岁，回屋以后照旧去挑水。',
    'birth',
  ],
  [
    'fp-normal-numbers',
    '孙掌柜拨了两下算盘，说这一炉丹要三十块灵石。沈清澜身上只有十八块，' +
      '她把玉佩推过去押着，说三个月内一定赎回。掌柜看了半晌，收下了。' +
      '出门时天已经黑了，坊市的灯挑起来一路，她数着走过第七盏就拐进了巷子。',
    'advance',
  ],
  [
    'fp-guard-keywords',
    '他在山中静坐三日，把心里的请求想了一遍，随后起身下山。' +
      '关键节点上他没有犹豫，只是把内部那点不安压下去，同步了呼吸与步子。' +
      '由此往北，还有三十里路。',
    'advance',
  ],
];

function runFalsePositiveAudit(): boolean {
  let ok = true;
  const audit = assertLoreWhitelistSafe();
  if (!audit.ok) {
    ok = false;
    failures.push(`误报体检：题材白名单有 ${audit.violations.length} 项被误判 → ${JSON.stringify(audit.violations.slice(0, 5))}`);
  }
  emit('fp-audit:lore-whitelist', audit.ok ? 'pass' : 'fail', { probes: '白名单+护栏逐词回测', violations: audit.violations.length });

  for (const [id, text, scope] of NORMAL_NARRATIVES) {
    const results = checkGates(text, { scope, fields: { title: '常规叙事', narrative: text }, requiredFields: ['title', 'narrative'] });
    const bad = results.flatMap((r) => r.hits.filter((h) => h.severity !== 'warn'));
    const gatesFailed = failedGateIds(results);
    const clean = bad.length === 0 && gatesFailed.length === 0;
    if (!clean) {
      ok = false;
      failures.push(`误报体检：正常叙事 ${id} 被误判 [${gatesFailed.join(',')}] → ${bad.map((h) => `${h.category}:${h.term}`).join(', ')}`);
    }
    emit(`fp-audit:${id}`, clean ? 'pass' : 'fail', clean ? {} : { hits: bad.map((h) => `${h.category}:${h.term}`) });
  }
  return ok;
}

// ==================== 文本样本（甲路 / 丙路） ====================

function runTextFixture(f: Fixture): void {
  const route = f.route || '?';
  bump(route, 'total');
  const narrative: string = f.expectedOutput?.narrative ?? '';
  const title: string = f.expectedOutput?.title ?? '';
  if (typeof narrative !== 'string' || narrative.length === 0) {
    failed++;
    bump(route, 'mismatch');
    failures.push(`${f.id}: expectedOutput.narrative 缺失或为空（${f._file}）`);
    emit(f.id, 'error', { route, reason: 'narrative-missing' });
    return;
  }

  const results = checkGates(narrative, {
    scope: f.gateOptions?.scope,
    fields: { title, narrative },
    requiredFields: f.gateOptions?.requiredFields ?? ['title', 'narrative'],
  });
  const actual = failedGateIds(results);
  const expected = (f.expectedGates?.gates ?? []) as GateId[];
  const same = actual.length === expected.length && actual.every((g) => expected.includes(g));

  if (actual.length > 0) bump(route, 'gateFail');

  if (!same) {
    failed++;
    bump(route, 'mismatch');
    failures.push(`${f.id}: 门禁实测 [${actual.join(',')}] 与冻结期望 [${expected.join(',')}] 不符（${f._file}）`);
    emit(f.id, 'mismatch', { route, actual, expected });
    return;
  }

  passed++;
  bump(route, 'ok');
  const hitSummary = results
    .flatMap((r) => r.hits.filter((h) => h.severity !== 'warn').map((h) => `${r.gate}/${h.category}:${h.term}`))
    .slice(0, 6);
  emit(f.id, actual.length === 0 ? 'pass' : 'fail', {
    route,
    ...(actual.length ? { gatesFailed: actual, hits: hitSummary } : {}),
    ...(f.expectedGrade ? { expectedGrade: f.expectedGrade } : {}),
  });
}

// ==================== 状态快照（乙路） ====================
// 本路 payload 不是叙事文本，G1-G3 不适用，只做结构校验。

const STATE_REQUIRED = ['character', 'activeStatuses', 'pendingThreads', 'availableAttributes'] as const;

function runStateFixture(f: Fixture): void {
  const route = f.route || '?';
  bump(route, 'total');
  const ctx = f.expectedOutput;
  const problems: string[] = [];

  if (!ctx || typeof ctx !== 'object') {
    problems.push('expectedOutput 不是对象');
  } else {
    for (const k of STATE_REQUIRED) {
      if (!(k in ctx)) problems.push(`缺字段 ${k}`);
    }
    for (const [k, t] of Object.entries(f.expectedSchema ?? {})) {
      if (!(k in (ctx as object))) { problems.push(`schema 声明的 ${k} 不存在`); continue; }
      const v = (ctx as any)[k];
      const actualType = Array.isArray(v) ? 'array' : typeof v;
      if (t !== actualType) problems.push(`${k} 应为 ${t}，实为 ${actualType}`);
    }
    const ch = (ctx as any).character;
    if (!ch || typeof ch !== 'object') problems.push('character 非对象');
    else {
      for (const k of ['name', 'age', 'realmName', 'rootDetail', 'spiritualSense', 'soulStrength', 'physicalFoundation']) {
        if (ch[k] === undefined || ch[k] === null) problems.push(`character.${k} 缺失`);
      }
      if (typeof ch.age === 'number' && typeof ch.lifespan === 'number' && ch.age > ch.lifespan) {
        problems.push(`age(${ch.age}) 超过 lifespan(${ch.lifespan})`);
      }
    }
  }

  if (problems.length) {
    failed++;
    bump(route, 'mismatch');
    failures.push(`${f.id}: 快照结构不合格 → ${problems.join('；')}（${f._file}）`);
    emit(f.id, 'fail', { route, problems });
    return;
  }
  passed++;
  bump(route, 'ok');
  emit(f.id, 'pass', {
    route,
    threads: (ctx as any).pendingThreads.length,
    statuses: (ctx as any).activeStatuses.length,
    realm: (ctx as any).character.realmName,
  });
}

// ==================== 门禁层主流程 ====================

function runGateLayer(): number {
  const t0 = Date.now();
  if (!QUIET) {
    const st = ruleTableStats();
    console.log(`# 门禁词表规模 ${st.total} 项（G1 硬泄漏 ${st.hardEn + st.hardZh + st.hardPatternsZh} / 数值形态 ${st.numericPatterns} / 局外词 ${st.storyteller} / 题材白名单 ${st.loreWhitelist}）`);
    console.log(`# 样本 ${fixtures.length} 条${ROUTE_FILTER ? `（仅 ${ROUTE_FILTER} 路）` : ''}`);
  }

  const fpOk = runFalsePositiveAudit();
  if (!fpOk) failed++; else passed++;

  for (const f of fixtures) {
    if (f.kind === 'state-snapshot') runStateFixture(f);
    else runTextFixture(f);
  }

  // 丙路完整性硬校验：机制词样本必须被 G1 抓到，否则说明取样点或词表错了
  if (!ROUTE_FILTER || ROUTE_FILTER === '丙') {
    const mech = fixtures.find((f) => f.id === 'neg-mechanism-leak');
    if (!mech) {
      failed++;
      failures.push('丙路缺 neg-mechanism-leak：这条是验证取样点/词表的必备样本');
    } else {
      const r = checkGates(mech.expectedOutput.narrative, { scope: mech.gateOptions?.scope });
      const hit = failedGateIds(r).includes('G1');
      if (!hit) {
        failed++;
        failures.push('丙路 neg-mechanism-leak 未被 G1 抓到 → 取样点或机制词表有问题');
      } else {
        passed++;
      }
      emit('assert:mechanism-word-caught-by-G1', hit ? 'pass' : 'fail');
    }
  }

  // ==================== 门禁汇总 ====================

  const ms = Date.now() - t0;
  console.log('');
  console.log('=== 门禁汇总（--gates-only，无模型调用）===');
  for (const [route, s] of Object.entries(byRoute).sort()) {
    console.log(`  ${route} 路: 样本 ${s.total} / 与冻结期望一致 ${s.ok} / 不一致 ${s.mismatch} / 其中门禁判失败 ${s.gateFail}`);
  }
  console.log(`  误报体检: 白名单+护栏逐词 + ${NORMAL_NARRATIVES.length} 段正常叙事 → ${fpOk ? '全部零命中' : '有误判'}`);
  console.log(`  ${passed} passed / ${failed} failed  (${ms}ms)`);

  if (failures.length) {
    console.log('\n--- 失败明细 ---');
    for (const f of failures) console.log(`  ✗ ${f}`);
  }

  // 自己数自己 exit：不沿用主 runner 的宽松策略
  if (failed > 0) {
    console.log(`\n✗ 门禁评测未通过：${failed} 项`);
    return 1;
  }
  console.log('\n✓ 门禁评测全部通过');
  return 0;
}

// ==================== 判分层 ====================

/** 跑一遍门禁，结果只作为判分的上下文输入，不参与门禁层记账。 */
function gatesFor(f: Fixture): GateResult[] {
  try {
    return checkGates(f.expectedOutput?.narrative ?? '', {
      scope: f.gateOptions?.scope,
      fields: { title: f.expectedOutput?.title ?? '', narrative: f.expectedOutput?.narrative ?? '' },
      requiredFields: f.gateOptions?.requiredFields ?? ['title', 'narrative'],
    });
  } catch {
    return [];
  }
}

/**
 * 挑判分样本。
 *
 * 默认刻意**混编**：丙路已知坏例（自带 expectedGrade=low）与甲路门禁全清的正常样本交替。
 * 理由很直接——只判坏例或只判正常样本，都看不出判分器有没有判别力。
 * 坏例判到低档、正常样本判到高档，这才是判分器唯一真正的有效性证据。
 * 两边判出来一样，那判分器就是废的，报告里必须直说。
 */
function selectJudgeSamples(limit: number): Fixture[] {
  const textFixtures = fixtures.filter((f) => f.kind !== 'state-snapshot' && typeof f.expectedOutput?.narrative === 'string');

  if (JUDGE_PICK.length > 0) {
    const picked: Fixture[] = [];
    for (const id of JUDGE_PICK) {
      const hit = textFixtures.find((f) => f.id === id);
      if (hit) picked.push(hit);
      else console.warn(`[judge] --judge-pick 里的 ${id} 没找到，跳过`);
    }
    return picked.slice(0, limit);
  }

  const bad = textFixtures.filter((f) => f.route === '丙' && f.expectedGrade === 'low');
  const clean = textFixtures.filter((f) => f.route === '甲' && failedGateIds(gatesFor(f)).length === 0);

  const out: Fixture[] = [];
  let i = 0;
  while (out.length < limit && (i < bad.length || i < clean.length)) {
    if (i < bad.length && out.length < limit) out.push(bad[i]);
    if (i < clean.length && out.length < limit) out.push(clean[i]);
    i++;
  }
  return out;
}

function toJudgeSample(f: Fixture, gates: GateResult[]): JudgeSample {
  return {
    id: f.id,
    narrative: f.expectedOutput?.narrative ?? '',
    title: f.expectedOutput?.title ?? '',
    scope: f.gateOptions?.scope,
    stratumLabel: f.stratumLabel ?? f.label,
    gateResults: gates,
  };
}

async function runJudgeLayer(): Promise<number> {
  const t0 = Date.now();
  const selected = selectJudgeSamples(JUDGE_LIMIT);
  const info = judgeTransportInfo(REPO);

  console.log('');
  console.log('=== 判分层 ===');
  console.log(`  模式: ${JUDGE_LIVE ? '真实调用（--live）' : '干跑（未给 --live，零模型调用）'}`);
  console.log(`  限量: ${JUDGE_LIMIT} 条${JUDGE_LIMIT_RAW !== JUDGE_LIMIT ? `（请求 ${JUDGE_LIMIT_RAW}，被硬顶压到 ${JUDGE_LIMIT}）` : ''}  |  单条超时 ${JUDGE_TIMEOUT_MS}ms`);
  // 只打脱敏字段：host / 协议 / 模型名 / key 有无。**绝不打 key 本身。**
  console.log(`  传输: ${info.ready ? `${info.protocol} @ ${info.baseUrlHost} · model=${info.model} · 凭据=${info.keyPresent ? '已就绪' : '缺失'} · 来源=${info.source}` : '不可用（未找到可用配置）'}`);
  console.log(`  档位: ${JUDGE_GRADES.map((g) => GRADE_LABELS[g]).join(' / ')}（离散四档，不给连续分数——连续分在模型裁判上不可复现）`);
  console.log(`  待判: ${selected.length} 条${JUDGE_PICK.length ? '（--judge-pick 指定）' : '（丙路已知坏例与甲路门禁全清样本混编，用于看判别力）'}`);

  if (SHOW_PROMPT && selected.length > 0) {
    const p = buildJudgePrompt(toJudgeSample(selected[0], gatesFor(selected[0])));
    console.log('\n--- 提示词样例（system 区）---');
    console.log(p.system);
    console.log('--- 提示词样例（user 区）---');
    console.log(p.user);
    console.log('--- 提示词样例结束 ---\n');
  }

  if (JUDGE_LIVE && !info.ready) {
    console.log('\n✗ 给了 --live 但没有可用的模型配置，判分无法进行。');
    return 1;
  }

  const outcomes: JudgeOutcome[] = [];
  const gateSplitBySample = new Map<string, ReturnType<typeof splitGateSeverity>>();

  for (const f of selected) {
    const gates = gatesFor(f);
    gateSplitBySample.set(f.id, splitGateSeverity(gates));
    const o = await judgeNarrative(toJudgeSample(f, gates), {
      dryRun: !JUDGE_LIVE,
      timeoutMs: JUDGE_TIMEOUT_MS,
    });
    outcomes.push(o);
    if (!QUIET) {
      console.log(
        JSON.stringify({
          eval: 'narrative-judge',
          sample: f.id,
          route: f.route,
          expectedGrade: f.expectedGrade ?? null,
          verdict: o.verdict === 'unknown' ? 'unknown' : o.gradeLabel,
          ...(o.unknownReason ? { unknownReason: o.unknownReason } : {}),
          ...(Object.keys(o.dims).length ? { dims: o.dims } : {}),
          ...(o.reasons.length ? { reasons: o.reasons } : {}),
          ...(o.error ? { note: o.error } : {}),
          ms: o.elapsedMs,
        }),
      );
    }
  }

  const dist = summarizeJudgeOutcomes(outcomes);

  // ---- 档位分布 ----
  console.log('\n--- 档位分布 ---');
  for (const g of JUDGE_GRADES) {
    console.log(`  ${GRADE_LABELS[g]}: ${dist.byGrade[g]}    （判据：${GRADE_CRITERIA[g]}）`);
  }
  console.log(`  计入统计 ${dist.counted} 条 / 送判 ${dist.total} 条`);

  // ---- unknown 丢弃：必须显式报，静默丢弃会让通过率虚高 ----
  console.log('\n--- unknown 丢弃 ---');
  console.log(`  丢弃 ${dist.unknown} 条（unknown 一律不进任何档位，绝不当某一档记账）`);
  if (dist.unknown > 0) {
    for (const [reason, n] of Object.entries(dist.unknownByReason).sort()) {
      console.log(`    ${reason}: ${n}`);
    }
  }
  console.log(`  实际发起模型调用 ${getJudgeCallCount()} 次（分布计数器同步值 ${dist.calls}）`);

  // ---- 门禁失败的硬/软分类：13 条失败不等于 13 处真泄漏 ----
  const all = fixtures.filter((f) => f.kind !== 'state-snapshot' && typeof f.expectedOutput?.narrative === 'string');
  const perRoute: Record<string, { hard: number; soft: number; warn: number; hardSamples: string[]; softSamples: string[] }> = {};
  for (const f of all) {
    const sp = splitGateSeverity(gatesFor(f));
    const r = f.route || '?';
    perRoute[r] ??= { hard: 0, soft: 0, warn: 0, hardSamples: [], softSamples: [] };
    perRoute[r].hard += sp.hard;
    perRoute[r].soft += sp.soft;
    perRoute[r].warn += sp.warn;
    if (sp.hard > 0) perRoute[r].hardSamples.push(f.id);
    if (sp.soft > 0) perRoute[r].softSamples.push(f.id);
  }
  console.log('\n--- 门禁失败的硬/软分类（引用"门禁失败数"必须分开讲）---');
  for (const [route, s] of Object.entries(perRoute).sort()) {
    console.log(`  ${route} 路: 硬泄漏命中 ${s.hard} 处（涉及 ${s.hardSamples.length} 条样本） / 待议软判命中 ${s.soft} 处（涉及 ${s.softSamples.length} 条样本） / 只提示不判定 ${s.warn} 处`);
    if (s.hardSamples.length) console.log(`      硬泄漏样本: ${s.hardSamples.join(', ')}`);
    if (s.softSamples.length) console.log(`      待议软判样本: ${s.softSamples.join(', ')}`);
  }
  console.log('  待议软判是什么：坊市「3 枚灵石」、境界「2层」这类阿拉伯数字加量词，判了 fail 但存疑，本轮冻结不动。');
  console.log('  所以"甲路 13 条门禁失败"读作 3 条真泄漏 + 10 条待议，不是 13 处真泄漏。');

  // ---- 未覆盖类别：不许让盲区伪装成通过 ----
  console.log('\n--- 未覆盖类别声明 ---');
  const coveredScopes = new Set(all.map((f) => f.gateOptions?.scope).filter(Boolean));
  for (const u of UNCOVERED_SCOPES) {
    const present = coveredScopes.has(u.scope);
    console.log(`  ${u.label}（${u.scope}）: ${present ? '样本库中已出现，与声明不符，请复核' : '未覆盖'}`);
    if (!present) console.log(`      原因: ${u.why}`);
  }
  console.log('  这两类的"零 fail"是没测出来的，不是测过了。判分通过率不把它们算作已验证。');

  // ---- 判别力：判分器唯一真正的有效性证据 ----
  const graded = outcomes.filter((o) => o.verdict !== 'unknown');
  const knownBadIds = new Set(selected.filter((f) => f.expectedGrade === 'low').map((f) => f.id));
  const badJudged = graded.filter((o) => knownBadIds.has(o.sampleId));
  const normJudged = graded.filter((o) => !knownBadIds.has(o.sampleId));
  const isLow = (o: JudgeOutcome) => o.verdict === 'weak' || o.verdict === 'bad';

  console.log('\n--- 判别力 ---');
  if (graded.length === 0) {
    console.log('  没有可用判分结果，判别力无从谈起（干跑模式属于这种情况，正常）。');
  } else {
    const badLow = badJudged.filter(isLow).length;
    const normHigh = normJudged.filter((o) => !isLow(o)).length;
    console.log(`  已知坏例 ${badJudged.length} 条 → 判到低档（勉强/差）${badLow} 条`);
    console.log(`  门禁全清样本 ${normJudged.length} 条 → 判到高档（优/合格）${normHigh} 条`);
    for (const o of graded) {
      console.log(`    ${knownBadIds.has(o.sampleId) ? '[已知坏例]' : '[门禁全清]'} ${o.sampleId} → ${o.gradeLabel}`);
    }
    if (badJudged.length > 0 && normJudged.length > 0) {
      const discriminates = badLow > 0 && normHigh > 0 && badLow / badJudged.length > normJudged.filter(isLow).length / normJudged.length;
      console.log(`  结论: ${discriminates ? '两边分开了，判分器有判别力' : '两边没分开 —— 判分器在这批上没有判别力，不要当它的结果可用'}`);
    } else {
      console.log('  这批没有同时含两类样本，判别力这一项本次未能验证。');
    }
  }

  const ms = Date.now() - t0;
  console.log(`\n判分层耗时 ${ms}ms`);

  // 自己数自己 exit。判分器是仪表：档位低不算 fail。
  // 但 --live 跑完一条都没判出来，说明仪表本身坏了，那要报错。
  if (JUDGE_LIVE && dist.counted === 0) {
    console.log('\n✗ --live 模式下 0 条判出档位，全部 unknown —— 判分器本身不可用。');
    return 1;
  }
  console.log('\n✓ 判分层跑完（判分器是仪表不是闸门，档位本身不决定退出码）');
  return 0;
}

// ==================== 调度 ====================

let exitCode = 0;
if (GATES_ONLY) {
  exitCode = runGateLayer();
}
if (JUDGE && exitCode === 0) {
  exitCode = await runJudgeLayer();
}
process.exit(exitCode);
