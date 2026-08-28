// 第零层：元元规则（不可覆盖的基石）
//
// 这是**唯一敢 reject 的层**。上面四层最重的处置是 clamp / strip / defer，
// 只有基石被违反才布尔拒绝。理由：拒绝是最贵的处置（一次拒绝要么让生成侧重跑、
// 要么让玩家看到一次空转），所以要留给「世界本身不成立」的情形。
//
// 四条基石落到本仓语境：
//   因果律   → engine/causality.ts 的 CausalNode / CausalEdge：结果必须追到已存在的因
//   能量守恒 → 灵石 / 物品的增减必须带来源（reason / source 字段）
//   可演化   → 允许注册新规则，但禁止注册或覆盖 immutable 的
//   代价     → 改动规则要付业力（karma.ts）或修为
//
// 硬约束：playerFacing 全是世界内的说法，不出现「拒绝」「校验」等字样，
// 也避开 display.ts SANITIZE_STRIP_TERMS 里的词。

import type { MetaRule, RuleContext } from './types';

// ---------- 取值助手（纯读，容错到 undefined） ----------

function pick(ctx: RuleContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmptyText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length >= 2;
}

// ==================== 基石一：因果律 ====================

// 语境化：生成侧宣称推进 / 完成 / 失败某条因缘，但那条因缘在世界里根本不存在，
// 就是「果先于因」。这在 ai-boundary-validator 里已有对应判定
// （unknown_thread_reference），但那里只 push warning。这里把它升格为基石。
//
// 接因果图：将来接线时，ctx.world.causalNodes 传 CausalNode[]，
// 这条谓词改为「果节点的 from 边指向的 id 不在图里」。
// 本批先用 thread 引用做等价近似（thread 就是当前唯一持久化的因果载体）。
const causalityRule: MetaRule = {
  id: 'meta.causality.effect_needs_cause',
  layer: 0,
  kind: 'causality',
  description: '果必有因：宣称推进/完结的因缘必须已存在于世界之中；结果不得先于起因',
  immutable: true,
  code: 'unknown_thread_reference',
  playerFacing: '此事无根无由，天时未到。',
  violates: (ctx) => {
    const known = new Set(
      asArray(pick(ctx, 'world.threadIds')).map((v) => String(v)),
    );
    // 世界侧未提供已知集合时不判违反（宁放行不误伤）
    if (known.size === 0) return false;
    const referenced = [
      ...asArray(pick(ctx, 'output.completeThreadIds')),
      ...asArray(pick(ctx, 'output.failThreadIds')),
    ].map((v) => String(v)).filter(Boolean);
    if (referenced.length === 0) return false;
    return referenced.some((id) => !known.has(id));
  },
};

// ==================== 基石二：能量守恒 ====================

// 语境化：灵石与物品是世界里的实物，凭空出现或凭空消失是不允许的。
// 「守恒」在本仓的可落地形态是**来源可追**：每一笔增减都要有 reason / source。
// 现有 ai-boundary-validator 的 missing_change_reason 只记 info，这里升格。
//
// 注意 threshold：小额波动（日常花用）不追来源，只有大额才追。
// 否则会把大量正常事件判成违反 —— 守恒要守的是「炼出个太阳」这种。
const CONSERVATION_THRESHOLD = 10000;

const conservationRule: MetaRule = {
  id: 'meta.conservation.gain_needs_source',
  layer: 0,
  kind: 'conservation',
  description: '有得必有出：大额灵石或物品的增减必须交代来源，不得凭空生灭',
  immutable: true,
  code: 'missing_change_reason',
  playerFacing: '天下无凭空之物，此物来路不明。',
  violates: (ctx) => {
    const changes = asArray(pick(ctx, 'output.changes'));
    for (const raw of changes) {
      if (!raw || typeof raw !== 'object') continue;
      const c = raw as Record<string, unknown>;
      const attr = String(c.attribute || '');
      if (attr !== 'spiritStones') continue;
      const delta = Number(c.delta);
      if (!Number.isFinite(delta)) continue;
      if (Math.abs(delta) < CONSERVATION_THRESHOLD) continue;
      if (!nonEmptyText(c.reason)) return true;
    }
    return false;
  },
};

// ==================== 基石三：规则体系允许演化 ====================

// 语境化：这一条是**允许**性质的基石 —— 它不禁止新规则，只禁止一件事：
// 动摇第零层自身。表现为「试图注册或覆盖一条 immutable 的规则」。
//
// 这条是规则体系的自指闸门：正因为它存在，第一层才敢做成「可被覆盖的默认值」。
const evolvabilityRule: MetaRule = {
  id: 'meta.evolvability.immutable_not_registrable',
  layer: 0,
  kind: 'evolvability',
  description: '道可衍化，本不可移：新规则可注册，但不得注册或覆盖标记为 immutable 的基石',
  immutable: true,
  code: 'invalid_type',
  playerFacing: '此乃天地根本，动它不得。',
  violates: (ctx) => {
    const attempts = asArray(pick(ctx, 'output.ruleRegistrations'));
    if (attempts.length === 0) return false;
    return attempts.some((raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const r = raw as Record<string, unknown>;
      // 试图声明自己是第零层，或试图给自己打 immutable
      return Number(r.layer) === 0 || r.immutable === true;
    });
  },
};

// ==================== 基石四：修改规则需要成本 ====================

// 语境化：接 karma.ts。改动世界法度不是免费的 —— 要么担业力，要么耗修为。
// 表现为「宣称改了世界法度（realmProfilePatch / 覆盖注册）却没有任何代价字段」。
//
// realmProfilePatch 正是这条基石现在被绕过的地方：它改的是境界上限与
// 修行速率这类根本参数，却只需要一句 reason 就永久写入。
const costRule: MetaRule = {
  id: 'meta.cost.rule_change_requires_price',
  layer: 0,
  kind: 'cost',
  description: '逆天有价：改动世界法度（境界上限 / 修行速率）必须伴随业力或修为代价',
  immutable: true,
  code: 'invalid_effect',
  playerFacing: '欲改天数，须先付出相应的代价。',
  violates: (ctx) => {
    const patch = pick(ctx, 'output.realmProfilePatch');
    if (!patch || typeof patch !== 'object') return false;
    const p = patch as Record<string, unknown>;
    // 只有触及根本参数才要价；仅改个名字不算
    const touchesFoundation =
      p.maxLevel !== undefined ||
      p.powerMultiplier !== undefined ||
      p.expMultiplier !== undefined;
    if (!touchesFoundation) return false;
    // 代价可以是业力、修为消耗，或一条明确的因由
    const paidKarma = Number(pick(ctx, 'output.sinDelta')) > 0 ||
      Number(pick(ctx, 'output.meritDelta')) > 0;
    const paidExp = asArray(pick(ctx, 'output.changes')).some((raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const c = raw as Record<string, unknown>;
      return String(c.attribute) === 'cultivationExp' && Number(c.delta) < 0;
    });
    const hasCause = nonEmptyText(p.reason);
    return !paidKarma && !paidExp && !hasCause;
  },
};

// ==================== 表 ====================

export const META_RULES: readonly MetaRule[] = Object.freeze([
  causalityRule,
  conservationRule,
  evolvabilityRule,
  costRule,
]);

/** 按 kind 取基石（接线期逐条开闸用） */
export function getMetaRule(kind: MetaRule['kind']): MetaRule | undefined {
  return META_RULES.find((r) => r.kind === kind);
}

/**
 * 第零层默认全部**不执行**（只记录）。
 * 将来接线时逐条 kind 打开，每开一条先跑一轮影子比对。
 * 本批四条都是 false —— 保证既有 smoke 一行不变。
 */
export const META_RULE_ENFORCEMENT: Readonly<Record<MetaRule['kind'], boolean>> = Object.freeze({
  causality: false,
  conservation: false,
  evolvability: false,
  cost: false,
});
