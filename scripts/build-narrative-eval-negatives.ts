// scripts/build-narrative-eval-negatives.ts
//
// 丙路（反面样本）生成器 —— 判分器的校准砖。
//
// 为什么这一路最容易被忽略却最重要：
//   反面样本不是用来测被评对象的，是用来**测判分器本身**的。
//   如果判分器把这十条打成高分，说明评分标准坏了，全部评测结果都不可信。
//   所以每条都带 expectedGrade='low' 与 violations（低分理由），
//   判分器接上后先跑这一路，打不低就先修判分器。
//
// 素材来源（全部是仓内真实记录的坏例，不是我凭空编的）：
//   · 重构前旧兜底文案（1c5a090^:src/lib/xianxia/llm.ts:1984 / :2018）——半文言违反纯白话
//   · prompt-builder.ts:262 明确记录的题材违和反例（天灵根降生村民「甚是失望」「不过如此」）
//   · prompt-builder.ts:276 明确禁止的元叙事旁白（「他还不明白这意味着什么」）
//   · prompt-builder.ts 局外词表（说书体「上回说到」「且听下回分解」）
//   · display.ts 机制词替换表 + probe-leak-all 泄漏正则（机制词/数值泄漏）
//
// 其中 neg-mechanism-leak 一条**必须被 G1 抓到**：它的作用不是测叙事，
// 而是反过来验证「取样点/词表没错」。抓不到就 exit 1。
//
// 用法：bun scripts/build-narrative-eval-negatives.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkGates, failedGateIds, type GateId, type NarrativeScope } from '../src/lib/xianxia/eval/rules';

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname_esm, '..');
const OUT_DIR = path.join(REPO, 'tests', 'fixtures', 'narrative-eval', 'negative');

interface NegCase {
  id: string;
  label: string;
  scope: NarrativeScope;
  title: string;
  narrative: string;
  /** 低分理由，判分器要能独立复现这些判断 */
  violations: string[];
  /** 素材出处 */
  source: string;
  /** 我预期门禁必须抓到的 gate；空数组=门禁抓不到（属判分器职责），非空则强校验 */
  mustFailGates: GateId[];
}

const CASES: NegCase[] = [
  {
    id: 'neg-mechanism-leak',
    label: '机制词泄漏（取样点验证样本）',
    scope: 'advance',
    title: '天道干预之后',
    narrative:
      '沈砚舟在药圃里蹲了一整个下午。天道干预降下之后，他手里那株三叶灵芝忽然自己抽了半寸。' +
      '引擎校验通过，这一年的推演结果落定，他把灵芝挖出来收进布包，抬头看了看天色。' +
      '傍晚回屋的路上，同门问他今天挖了几株，他说不清，只摇了摇头。',
    violations: ['出现「天道干预」「引擎校验」「推演」等内部机制词，玩家一眼出戏'],
    source: 'display.ts:385-417 机制词替换表 + probe-leak-all.ts 泄漏正则',
    mustFailGates: ['G1'],
  },
  {
    id: 'neg-numeric-leak',
    label: '数值泄漏（战报体）',
    scope: 'combat-round',
    title: '礁上交手',
    narrative:
      '沈清澜侧身避开蟹钳，反手一刀划在关节上。攻击+12，防御-3，对方气血-45。' +
      '她后撤两步，修为+50，悟性提升 12 点，随后再进一刀。' +
      '第三回合结束，双方各自退开，浪打在礁石上，声音盖过了呼吸。',
    violations: ['把属性增减、修为数值直接写进叙事，等于把后台面板贴到玩家眼前'],
    source: 'prompt-builder.ts:1135 经验值禁令 + generators.ts:781 战报数值禁令',
    mustFailGates: ['G2'],
  },
  {
    id: 'neg-hard-leak-en',
    label: '英文技术词泄漏',
    scope: 'advance',
    title: '闭关三月',
    narrative:
      '孟寒山在丹房里坐了三个月。schema 校验没通过，这一段 narrative 只好重新生成，' +
      '好在 cache 里还留着上次的 prompt，token 没白花。他推开门，外面的雪已经积到膝盖。' +
      '丹炉底下的火早就熄了，他伸手摸了摸炉壁，还有一点余温。',
    violations: ['schema / narrative / cache / prompt / token 全是技术词，零容忍'],
    source: 'ai-output-regression.ts:41-49 BANNED_TERMS',
    mustFailGates: ['G1'],
  },
  {
    id: 'neg-storyteller-voice',
    label: '说书体局外词',
    scope: 'choice',
    title: '上回说到那桩旧事',
    narrative:
      '上回说到沈清澜欠了孙掌柜三十块灵石。话说回来，这债到了秋末就得还。' +
      '她在坊市门口站了一会儿，终究还是推门进去了。孙掌柜正在拨算盘，抬眼看了她一下，没说话。' +
      '至于这三十块灵石最后是怎么了的，且听下回分解。',
    violations: ['「上回说到」「话说回来」「且听下回分解」是说书人腔，不是修仙世界内语言'],
    source: 'prompt-builder.ts:410 局外词禁令',
    mustFailGates: ['G3'],
  },
  {
    id: 'neg-meta-narration',
    label: '元叙事旁白',
    scope: 'birth',
    title: '降生',
    narrative:
      '李青云在柳溪村李家院出生。他还不明白这意味着什么，只是被抱起来时哭了两声。' +
      '这一刻他还不懂，院里那株老槐无风自动是为了谁。' +
      '母亲把他裹进旧布里，年纪尚小的他对身外的动静还只是懵懂的喜悦。',
    violations: ['「他还不明白这意味着什么」「这一刻他还不懂」是上帝视角替玩家解读心理'],
    source: 'prompt-builder.ts:276 元叙述禁令（原 :339）',
    mustFailGates: ['G3'],
  },
  {
    id: 'neg-genre-dissonance',
    label: '题材违和（天灵根遭失望）',
    scope: 'birth',
    title: '测灵之日',
    narrative:
      '游方道士把测灵石按在李青云掌心，石上腾起一道雷光，映得半个院子发白。' +
      '道士看了半晌，说这是天灵根。围观的村民甚是失望，纷纷摇头说不过如此，' +
      '有人还嫌雷光太吵，转身就走了。道士收起测灵石便告辞，说这孩子资质寻常，不必费心。',
    violations: [
      '天灵根降生本该震动一方，村民却「甚是失望」「不过如此」，违背题材常识',
      '游方道士反说天灵根「资质寻常」，与世界设定直接冲突',
    ],
    source: 'prompt-builder.ts:262 明确记录的错误写法',
    mustFailGates: ['G3'],
  },
  {
    id: 'neg-fallback-classical-choice',
    label: '旧兜底文案 · 半文言（抉择）',
    scope: 'choice',
    title: '应下',
    narrative:
      '沈砚舟选择「随师父同去南礁」，顺势应下这一段因果。局势暂且平稳，后续变化仍待天机显现。',
    violations: [
      '「顺势应下这一段因果」「仍待天机显现」是半文言套话，违反纯白话要求',
      '通篇无一个具体动作、地点、人物反应，是空转判词而非叙事',
      '长度不足，只有一句概括',
    ],
    source: '1c5a090^:src/lib/xianxia/llm.ts:1984 重构前兜底文案',
    mustFailGates: [],
  },
  {
    id: 'neg-fallback-classical-interfere',
    label: '旧兜底文案 · 半文言（干预）',
    scope: 'advance',
    title: '天机沉寂',
    narrative: '天机沉寂，沈砚舟心中闪过「去海边看看」之念，却暂未掀起可见波澜。',
    violations: [
      '「天机沉寂」「之念」「暂未掀起可见波澜」半文言堆叠',
      '只交代了「什么都没发生」，玩家得不到任何世界内信息',
      '长度不足',
    ],
    source: '1c5a090^:src/lib/xianxia/llm.ts:2018 重构前兜底文案',
    mustFailGates: [],
  },
  {
    id: 'neg-empty-cliche',
    label: '空转套话（一年白过）',
    scope: 'advance',
    title: '平淡的一年',
    narrative:
      '这一年就这样平淡地过去了。沈砚舟依旧每天在药圃里忙碌，日子波澜不惊。' +
      '时间一天天流逝，转眼又是一年。没有发生什么特别的事情，一切照旧。' +
      '他的修行也在稳步推进，未来还有很长的路要走。',
    violations: [
      '全篇套话，无任何具体事件、人物、地点变化',
      '「时间一天天流逝」「未来还有很长的路要走」是填字，不是叙事',
      '与「一年只发生一件事」的反面——这里是一年什么都没发生',
    ],
    source: 'prompt-builder.ts:184 年度多段叙事要求的反面',
    mustFailGates: [],
  },
  {
    id: 'neg-broken-structure',
    label: '结构破损（截断 + 引号不配对）',
    scope: 'advance',
    title: '井边',
    narrative:
      '沈砚舟走到井边，弯腰去看水里的影子。他忽然想起师父说过的那句话：' +
      '「你这一路，先把药圃看好，别的以后再' ,
    violations: [
      '冒号后接引文却在句中断尾，明显是被截断的半句',
      '引号只开不合',
      '整段不成立，玩家读到的是残句',
    ],
    source: 'G4 结构完整性设计初衷',
    mustFailGates: ['G4'],
  },
  {
    id: 'neg-thread-vanished',
    label: '线索凭空消失',
    scope: 'advance',
    title: '秋末',
    narrative:
      '秋末的风把坊市的幡子吹得直响。沈清澜在潮候看了半天云，回头去铁砧门取了把新刀。' +
      '晚上她在客栈算了算灵石，还剩一百八十块，够撑到明年春天。' +
      '第二天她往北走了，路上遇见一队运货的散修，跟着走了三日。',
    violations: [
      '入参里「药债压门」已到期（deadlineAge=31，age=31），本轮完全没被承接',
      '「半潮门影」标记 urgent 也未出现',
      '另起了无关的北行事件，等于线索凭空消失',
    ],
    source: 'prompt-builder.ts 未决线索连续性禁令 + 乙路 state-many-threads 快照',
    mustFailGates: [],
  },
];

// ==================== 落盘 ====================

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.json'))) fs.unlinkSync(path.join(OUT_DIR, f));

let written = 0;
let assertFail = 0;
let gateCaught = 0;
console.log('\n=== 丙路 · 反面样本（判分器校准）===');

for (const c of CASES) {
  const results = checkGates(c.narrative, {
    scope: c.scope,
    fields: { title: c.title, narrative: c.narrative },
    requiredFields: ['title', 'narrative'],
  });
  const failed = failedGateIds(results);
  const nonWarnHits = results.flatMap((r) => r.hits.filter((h) => h.severity !== 'warn'));
  const warnHits = results.flatMap((r) => r.hits.filter((h) => h.severity === 'warn'));

  // 强校验：声明了 mustFailGates 的样本，门禁必须真抓到
  for (const g of c.mustFailGates) {
    if (!failed.includes(g)) {
      console.log(`  ✗ 断言失败 ${c.id}: 期望 ${g} 失败，实际未失败（failed=[${failed.join(',')}]）`);
      assertFail++;
    }
  }
  if (failed.length > 0) gateCaught++;

  const fixture = {
    id: c.id,
    route: '丙',
    kind: 'negative',
    label: c.label,
    prompt: `反面样本 · ${c.label}`,
    expectedSchema: { title: 'string', narrative: 'string' },
    expectedOutput: { title: c.title, narrative: c.narrative },
    gateOptions: { scope: c.scope, requiredFields: ['title', 'narrative'] },
    // 冻结门禁实测结果：判分器接上后若与此不符，说明词表/门禁被改动
    expectedGates: { result: failed.length > 0 ? 'fail' : 'pass', gates: failed },
    // 判分器必须给低分；这是校准依据，不是门禁职责
    expectedGrade: 'low',
    violations: c.violations,
    gateHitSummary: {
      nonWarn: nonWarnHits.map((h) => `${h.category}:${h.term}`),
      warn: warnHits.map((h) => `${h.category}:${h.term}`),
    },
    tags: ['negative', 'judge-calibration', c.id.replace(/^neg-/, '')],
    provenance: {
      builder: 'scripts/build-narrative-eval-negatives.ts',
      source: c.source,
      mustFailGates: c.mustFailGates,
    },
    notes: `丙路反面样本，判分器必须打低分。低分理由：${c.violations.join('；')}`,
  };
  fs.writeFileSync(path.join(OUT_DIR, `${c.id}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  written++;

  const flag = failed.length > 0 ? `门禁抓到 [${failed.join(',')}]` : '门禁放过（交判分器）';
  console.log(`  ${c.id.padEnd(34)} ${flag}`);
  if (nonWarnHits.length) console.log(`      硬/软命中: ${nonWarnHits.map((h) => `${h.category}:${h.term}`).join(', ')}`);
  if (warnHits.length) console.log(`      提示命中: ${warnHits.map((h) => `${h.category}:${h.term}`).join(', ')}`);
}

console.log(`\n合计落盘 ${written} 条 → ${path.relative(REPO, OUT_DIR)}`);
console.log(`其中门禁可直接抓到 ${gateCaught} 条，其余 ${written - gateCaught} 条属判分器职责（风格/空转/线索断裂）`);

if (assertFail > 0) {
  console.log(`\n✗ ${assertFail} 项断言失败：声明必被抓的样本没被抓到，说明词表或门禁有问题`);
  process.exit(1);
}
console.log('\n✓ 全部 mustFailGates 断言通过（含机制词样本被 G1 抓到）');
process.exit(0);
