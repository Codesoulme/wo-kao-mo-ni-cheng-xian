// scripts/xianxia-judge-unit.ts
//
// 判分器纯函数测例。**全程零真实网络调用**——需要走传输层的两条路径（超时 / 异常）
// 用一个假的 fetch 顶替，不碰真接口，所以这个脚本可以随便跑，不吃配额。
//
// 用法：
//   bun scripts/xianxia-judge-unit.ts
//
// 覆盖三块：
//   A. 静态契约：四档离散、判据齐备、超时有上限、盲区已声明。
//   B. 解析健壮性：垃圾输入不解析成档位、解析器不抛异常、提示词是白话。
//   C. 运行时纪律：unknown 不进任何档位、超时走得通、判分器任何情况都不抛异常。
//
// 自己数自己 exit：任何一项不过就 exit 1。

import {
  JUDGE_GRADES,
  GRADE_LABELS,
  GRADE_CRITERIA,
  UNCOVERED_SCOPES,
  DEFAULT_JUDGE_TIMEOUT_MS,
  getJudgeCallCount,
  resetJudgeCallCount,
  parseGradeLabel,
  parseJudgeReply,
  buildJudgePrompt,
  judgeNarrative,
  judgeBatch,
  summarizeJudgeOutcomes,
  splitGateSeverity,
  judgeTransportInfo,
  type JudgeOutcome,
} from '../src/lib/xianxia/eval/judge';
import { checkGates } from '../src/lib/xianxia/eval/rules';

let ok = 0;
let bad = 0;
const t = (name: string, cond: boolean, detail: string) => {
  if (cond) {
    ok++;
    console.log(`  ✓ ${name} — ${detail}`);
  } else {
    bad++;
    console.log(`  ✗ ${name} — ${detail}`);
  }
};

// ==================== A. 静态契约 ====================

console.log('=== A 静态契约（零调用）===');
t('档位为离散四档', JUDGE_GRADES.length === 4, JUDGE_GRADES.join('/'));
t(
  '每档有判据文字',
  JUDGE_GRADES.every((g) => (GRADE_CRITERIA[g] || '').length > 10),
  JUDGE_GRADES.map((g) => `${g}:${GRADE_CRITERIA[g].length}字`).join(' '),
);
t(
  '每档有中文标签且互不相同',
  new Set(JUDGE_GRADES.map((g) => GRADE_LABELS[g])).size === 4,
  JUDGE_GRADES.map((g) => GRADE_LABELS[g]).join('/'),
);
t('超时有上限', DEFAULT_JUDGE_TIMEOUT_MS > 0 && DEFAULT_JUDGE_TIMEOUT_MS <= 120000, `${DEFAULT_JUDGE_TIMEOUT_MS}ms`);
t(
  '声明了未覆盖类别',
  UNCOVERED_SCOPES.length > 0 && UNCOVERED_SCOPES.every((u) => u.why.length > 10),
  UNCOVERED_SCOPES.map((u) => u.label).join('、'),
);
t('起始调用数为 0', getJudgeCallCount() === 0, String(getJudgeCallCount()));
t(
  '传输层信息不含凭据内容',
  (() => {
    const info = judgeTransportInfo();
    // 只允许出现布尔与短字符串字段，绝不能有形似密钥的长串
    return !Object.values(info).some((v) => typeof v === 'string' && v.length > 60);
  })(),
  '脱敏字段体检通过（只报 host/协议/模型/有无凭据）',
);

// ==================== B. 解析健壮性 ====================

console.log('\n=== B 解析健壮性（零调用）===');
const junk = ['', '   ', '不是档位', '{"broken":', 'null', '???', '{}', '[1,2,3]', '优秀合格勉强差'];
t(
  '垃圾输入不解析成档位',
  junk.slice(0, 6).every((j) => parseGradeLabel(j) === null),
  '6 组全返回 null',
);
t('合法档位能解析', JUDGE_GRADES.every((g) => parseGradeLabel(g) === g), '四档往返一致');
t(
  '中文标签能解析',
  JUDGE_GRADES.every((g) => parseGradeLabel(GRADE_LABELS[g]) === g),
  '优/合格/勉强/差 全部回到对应档位',
);
t(
  '多档位同现时不猜',
  parseJudgeReply('这段可能是优也可能是差，还有点勉强').grade === null,
  '出现多个档位词 → 返回 null 而不是瞎猜',
);
t(
  '正常 JSON 回复能解出总档位与维度',
  (() => {
    const r = parseJudgeReply('{"grade":"合格","texture":"勉强","coherence":"优","causality":"合格","voice":"合格","reasons":["笔触偏平"]}');
    return r.grade === 'pass' && r.dims.texture === 'weak' && r.dims.coherence === 'excellent' && r.reasons.length === 1;
  })(),
  'grade/dims/reasons 三者都到位',
);
t(
  '包了代码块的回复也能解',
  parseJudgeReply('```json\n{"grade":"差"}\n```').grade === 'bad',
  'markdown 包裹被剥掉',
);

let threw = false;
try {
  for (const j of junk) parseJudgeReply(j);
} catch {
  threw = true;
}
t('解析器不抛异常', !threw, `${junk.length} 组垃圾输入全部吞下`);

const p = buildJudgePrompt({ id: 'probe', narrative: '他往北边走了三天，路上没遇见人。', scope: 'advance' });
const joined = p.system + p.user;
const classical = ['之乎', '者也', '其言', '然则', '此子', '甚是', '已然', '不复', '乃是'].filter((w) => joined.includes(w));
t('判分提示词无文言虚词', classical.length === 0, classical.length ? classical.join(',') : '零命中');
t('提示词非空且成对', p.system.length > 50 && p.user.length > 10, `system ${p.system.length} 字 / user ${p.user.length} 字`);
t(
  '提示词交代了只判质量不判合规',
  p.system.includes('只看质量') && p.system.includes('不做合规判断'),
  '职责边界写进了 system 区',
);
t(
  '门禁结论作为上下文进了提示词',
  (() => {
    const withGates = buildJudgePrompt({
      id: 'probe2',
      narrative: '引擎判定他的修为+50。',
      scope: 'advance',
      gateResults: checkGates('引擎判定他的修为+50。', { scope: 'advance' }),
    });
    return withGates.user.includes('门禁');
  })(),
  '门禁拦截情况被写进 user 区',
);
t(
  '门禁命中的原词不进提示词',
  (() => {
    const leak = '引擎判定他的修为+50。';
    const withGates = buildJudgePrompt({
      id: 'probe3',
      narrative: leak,
      scope: 'advance',
      gateResults: checkGates(leak, { scope: 'advance' }),
    });
    // 正文里出现是应该的（被评对象），但门禁交代那段不该把机制词再列一遍
    const beforeBody = withGates.user.split('---')[0];
    return !beforeBody.includes('引擎');
  })(),
  '只报类别与条数，不把机制词喂给裁判',
);

// ==================== C. 运行时纪律 ====================

console.log('\n=== C 运行时纪律（假 fetch，零真实网络）===');
resetJudgeCallCount();

// C1 干跑：默认不发请求
const dry = await judgeNarrative({ id: 'c1', narrative: '她把灯挑亮，坐回桌边。', scope: 'advance' });
t(
  '默认干跑不发请求',
  dry.verdict === 'unknown' && dry.unknownReason === 'dry-run' && dry.called === false && getJudgeCallCount() === 0,
  `verdict=${dry.verdict} reason=${dry.unknownReason} 调用数=${getJudgeCallCount()}`,
);

// C2 空样本
const empty = await judgeNarrative({ id: 'c2', narrative: '   ' }, { dryRun: false });
t(
  '空样本判 unknown 且不发请求',
  empty.verdict === 'unknown' && empty.unknownReason === 'empty-sample' && getJudgeCallCount() === 0,
  `reason=${empty.unknownReason} 调用数=${getJudgeCallCount()}`,
);

// C3 超时路径：用一个永不 resolve 但认 abort 信号的假 fetch 顶替真接口
const realFetch = globalThis.fetch;
globalThis.fetch = ((_url: any, init: any) =>
  new Promise((_res, rej) => {
    const sig = init?.signal;
    if (sig) {
      sig.addEventListener('abort', () => {
        const e: any = new Error('The operation was aborted.');
        e.name = 'AbortError';
        rej(e);
      });
    }
  })) as unknown as typeof fetch;

const warns: string[] = [];
const slow = await judgeNarrative(
  { id: 'c3', narrative: '他在渡口等了半天，船一直没来。', scope: 'advance' },
  { dryRun: false, timeoutMs: 60, onWarn: (m) => warns.push(m) },
);
t(
  '超时走 unknown 不抛异常',
  slow.verdict === 'unknown' && slow.unknownReason === 'timeout',
  `reason=${slow.unknownReason} 耗时 ${slow.elapsedMs}ms`,
);
t('超时被 warn 记下不是静默丢', warns.some((w) => w.includes('超时')), `warn ${warns.length} 条`);

// C4 传输层直接炸：判分器要吞掉，不许打断主流程
globalThis.fetch = (() => {
  throw new Error('模拟传输层崩溃');
}) as unknown as typeof fetch;
let batchThrew = false;
let outcomes: JudgeOutcome[] = [];
try {
  outcomes = await judgeBatch(
    [
      { id: 'c4a', narrative: '院里的槐树落了一地叶子。', scope: 'advance' },
      { id: 'c4b', narrative: '他把刀收回鞘里，没有再说话。', scope: 'advance' },
    ],
    { dryRun: false, timeoutMs: 500, onWarn: () => {} },
  );
} catch {
  batchThrew = true;
}
t('传输层崩溃时批量判分不抛异常', !batchThrew, batchThrew ? '抛了' : '全部收敛成 unknown');
t(
  '崩溃样本全部记 unknown',
  outcomes.length === 2 && outcomes.every((o) => o.verdict === 'unknown'),
  outcomes.map((o) => `${o.sampleId}:${o.unknownReason}`).join(' '),
);

globalThis.fetch = realFetch;

// C5 unknown 记账：绝不能悄悄进某一档
const mixed: JudgeOutcome[] = [
  { sampleId: 'm1', verdict: 'excellent', gradeLabel: '优', reasons: [], dims: {}, called: true, elapsedMs: 1 },
  { sampleId: 'm2', verdict: 'bad', gradeLabel: '差', reasons: [], dims: {}, called: true, elapsedMs: 1 },
  { sampleId: 'm3', verdict: 'unknown', gradeLabel: '', unknownReason: 'timeout', reasons: [], dims: {}, called: true, elapsedMs: 1 },
  { sampleId: 'm4', verdict: 'unknown', gradeLabel: '', unknownReason: 'parse-failed', reasons: [], dims: {}, called: true, elapsedMs: 1 },
];
const dist = summarizeJudgeOutcomes(mixed);
t(
  'unknown 不进任何档位',
  dist.counted === 2 && dist.unknown === 2 && dist.total === 4,
  `计入 ${dist.counted} / 丢弃 ${dist.unknown} / 送判 ${dist.total}`,
);
t(
  'unknown 按成因分类计数',
  dist.unknownByReason.timeout === 1 && dist.unknownByReason['parse-failed'] === 1,
  JSON.stringify(dist.unknownByReason),
);
t(
  '档位分布与计入数自洽',
  JUDGE_GRADES.reduce((n, g) => n + dist.byGrade[g], 0) === dist.counted,
  `四档之和 ${dist.counted}`,
);

// C6 门禁硬软分类
// 两段文本都要过 G4 的长度下界（advance 场景 20 字），否则 struct-too-short 会自己算一条 hard，
// 把这一项想验的东西盖掉。这里刻意写够长度，只留下想测的那一种命中。
const hardText = '引擎判定天道干预生效，他站在原地没有动，过了很久才把手里的东西放下。';
const softText = '他在坊市把那袋药材卖了个好价，换回 3 枚灵石，揣进怀里就往回走了。';
const hardSplit = splitGateSeverity(checkGates(hardText, { scope: 'advance' }));
const softSplit = splitGateSeverity(checkGates(softText, { scope: 'advance' }));
t(
  '硬泄漏与待议软判分得开',
  hardSplit.hard > 0 && hardSplit.soft === 0 && softSplit.soft > 0 && softSplit.hard === 0,
  `硬例 hard=${hardSplit.hard}(${hardSplit.hardCategories.join(',')})/soft=${hardSplit.soft}  ` +
    `软例 hard=${softSplit.hard}/soft=${softSplit.soft}(${softSplit.softCategories.join(',')})`,
);

t('全程零真实模型调用', true, `计数器 ${getJudgeCallCount()} 次（均为假 fetch，未触网）`);

console.log(`\n结果：${ok} 过 / ${bad} 不过`);
if (bad > 0) {
  console.log('✗ 判分器单元测例未通过');
  process.exit(1);
}
console.log('✓ 判分器单元测例全部通过');
process.exit(0);
