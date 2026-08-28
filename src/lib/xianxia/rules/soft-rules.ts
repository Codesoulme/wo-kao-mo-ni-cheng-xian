// 第二层：软规则（概率性社会规则）
//
// 这一层做的事是给 ai-boundary-validator 的 37 条判定**贴标签**：
// 它们本来就不是物理定律，而是「社会上一般如此」。所以处置态是
// flag_review（标记审查，本轮仍放行），而非 clamp / reject。
//
// 三个刻度：
//   reviewProbability  roll < p 才标记审查，否则放行。
//                      这正是文档说的「允许低概率事件发生」——
//                      社会规则偶尔被越过是世界的常态，一律拦反而失真。
//   delayAge           社会规则有认知门槛：三岁小儿不懂人情世故，
//                      对应规则在到龄之前不起作用。
//   exceptions         DSL 表达的例外；任一成立则整条跳过。
//
// RNG 硬要求：参数化注入（rng: () => number），绝不直接调 Math.random，
// 否则 smoke 无法复现。求值器签名里 rng 是显式参数。

import type { DSLNode } from '../rules-dsl/ast';
import type { SoftRule, RuleContext } from './types';

// ---------- 取值助手 ----------

function pick(ctx: RuleContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function arr(ctx: RuleContext, path: string): unknown[] {
  const v = pick(ctx, path);
  return Array.isArray(v) ? v : [];
}

function idSet(ctx: RuleContext, path: string): Set<string> {
  return new Set(arr(ctx, path).map((v) => String(v)).filter(Boolean));
}

// ---------- 常用 DSL 例外片段 ----------

/** 叙事里已交代了关系转变的因由 → 人情类规则不追究 */
const EXC_HAS_RELATION_CAUSE: DSLNode = {
  op: 'eq',
  args: [{ op: 'var', name: 'world.hasRelationshipCause' }, { op: 'const', value: true }],
};

/** 处于雷劫 / 大变期间 → 数值剧烈波动是应有之义 */
const EXC_DURING_TRIBULATION: DSLNode = {
  op: 'eq',
  args: [{ op: 'var', name: 'world.inTribulation' }, { op: 'const', value: true }],
};

/** 身处秘境 → 奇物成批出现属正常 */
const EXC_IN_SECRET_REALM: DSLNode = {
  op: 'eq',
  args: [{ op: 'var', name: 'world.inSecretRealm' }, { op: 'const', value: true }],
};

// ==================== 因缘连续性类 ====================

const threadSoftRules: SoftRule[] = [
  {
    id: 'soft.thread.duplicate_id',
    layer: 2,
    description: '新起因缘沿用了已有编号',
    code: 'duplicate_thread_id',
    field: 'newThreads',
    reviewProbability: 0.6,
    triggers: (ctx) => {
      const existing = idSet(ctx, 'world.threadIds');
      if (existing.size === 0) return false;
      return arr(ctx, 'output.newThreads').some((raw) => {
        const id = String((raw as Record<string, unknown>)?.id || '');
        return Boolean(id) && existing.has(id);
      });
    },
  },
  {
    id: 'soft.thread.past_deadline',
    layer: 2,
    description: '新起因缘的期限已过',
    code: 'past_deadline_new_thread',
    field: 'newThreads.deadlineAge',
    reviewProbability: 0.5,
    exceptions: [{ description: '雷劫期间时序错乱', when: EXC_DURING_TRIBULATION }],
    triggers: (ctx) => {
      const age = Number(pick(ctx, 'character.age'));
      if (!Number.isFinite(age)) return false;
      return arr(ctx, 'output.newThreads').some((raw) => {
        const t = raw as Record<string, unknown>;
        const status = String(t?.status || '');
        if (status === 'resolved' || status === 'failed') return false;
        const dl = Number(t?.deadlineAge);
        return Number.isFinite(dl) && dl < age;
      });
    },
  },
  {
    id: 'soft.thread.closed_referenced',
    layer: 2,
    description: '试图改动已了结的因缘',
    code: 'closed_thread_referenced',
    field: 'threads',
    reviewProbability: 0.55,
    triggers: (ctx) => {
      const closed = idSet(ctx, 'world.closedThreadIds');
      if (closed.size === 0) return false;
      const touched = [
        ...arr(ctx, 'output.completeThreadIds'),
        ...arr(ctx, 'output.failThreadIds'),
      ].map((v) => String(v));
      return touched.some((id) => closed.has(id));
    },
  },
  {
    id: 'soft.thread.unaddressed_urgent',
    layer: 2,
    description: '当务之急未获交代',
    code: 'unaddressed_high_priority_quest',
    field: 'questEntries',
    // 低概率：偶尔一岁没顾上要紧事，是人之常情
    reviewProbability: 0.25,
    // 六岁前尚不通事理，不追究
    delayAge: 6,
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasUnaddressedUrgentQuest')),
  },
];

// ==================== 物件一致性类 ====================

const itemSoftRules: SoftRule[] = [
  {
    id: 'soft.item.remove_unknown',
    layer: 2,
    description: '试图散去并未在身的物件',
    code: 'removed_unknown_item',
    field: 'removedItemIds',
    reviewProbability: 0.7,
    triggers: (ctx) => {
      const held = idSet(ctx, 'world.heldItemIds');
      if (held.size === 0) return false;
      return arr(ctx, 'output.removedItemIds').some((v) => !held.has(String(v)));
    },
  },
  {
    id: 'soft.item.equip_unknown',
    layer: 2,
    description: '试图佩上并未在身的物件',
    code: 'equip_unknown_item',
    field: 'equipItemIds',
    reviewProbability: 0.7,
    triggers: (ctx) => {
      const held = idSet(ctx, 'world.heldItemIds');
      if (held.size === 0) return false;
      return arr(ctx, 'output.equipItemIds').some((v) => !held.has(String(v)));
    },
  },
  {
    id: 'soft.item.duplicate_name',
    layer: 2,
    description: '新得物件与在身之物同名',
    code: 'new_item_duplicate_name',
    field: 'newItems.name',
    // 很低：同名的凡品（灵石袋、疗伤丹）本就该允许重复
    reviewProbability: 0.15,
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasDuplicateItemName')),
  },
  {
    id: 'soft.item.excessive_rewards',
    layer: 2,
    description: '一时之间所得过丰',
    code: 'excessive_item_rewards',
    field: 'newItems',
    reviewProbability: 0.45,
    exceptions: [{ description: '身处秘境，奇物成批', when: EXC_IN_SECRET_REALM }],
    triggers: (ctx) => {
      const n =
        arr(ctx, 'output.newItems').length +
        arr(ctx, 'output.newEquippedItems').length;
      return n > 12;
    },
  },
];

// ==================== 人情往来类 ====================

const npcSoftRules: SoftRule[] = [
  {
    id: 'soft.npc.hostile_to_friendly',
    layer: 2,
    description: '仇敌骤然转为亲近，未见因由',
    code: 'npc_hostile_to_friendly_without_cause',
    field: 'newNpcs.attitude',
    reviewProbability: 0.5,
    delayAge: 6,
    exceptions: [{ description: '叙事已交代化解之由', when: EXC_HAS_RELATION_CAUSE }],
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasHostileToFriendlyShift')),
  },
  {
    id: 'soft.npc.friendly_to_hostile',
    layer: 2,
    description: '亲近骤然转为仇敌，未见因由',
    code: 'npc_friendly_to_hostile_without_cause',
    field: 'newNpcs.attitude',
    reviewProbability: 0.5,
    delayAge: 6,
    exceptions: [{ description: '叙事已交代结怨之由', when: EXC_HAS_RELATION_CAUSE }],
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasFriendlyToHostileShift')),
  },
  {
    id: 'soft.npc.relationship_jump',
    layer: 2,
    description: '情分变动过于陡峭',
    code: 'npc_relationship_jump_without_cause',
    field: 'newNpcs.relationshipScore',
    reviewProbability: 0.4,
    delayAge: 6,
    exceptions: [{ description: '叙事已交代因由', when: EXC_HAS_RELATION_CAUSE }],
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasRelationshipJump')),
  },
  {
    id: 'soft.npc.friendly_as_enemy',
    layer: 2,
    description: '故交被列为敌手，未见冲突之由',
    code: 'friendly_npc_used_as_enemy_without_cause',
    field: 'triggerCombat.enemies',
    // 稍高：这个在叙事上最容易出戏
    reviewProbability: 0.65,
    delayAge: 6,
    exceptions: [{ description: '叙事已交代翻脸之由', when: EXC_HAS_RELATION_CAUSE }],
    triggers: (ctx) => Boolean(pick(ctx, 'world.hasFriendlyUsedAsEnemy')),
  },
];

// ==================== 数值分寸类 ====================

const numericSoftRules: SoftRule[] = [
  {
    id: 'soft.numeric.extreme_delta',
    layer: 2,
    description: '一笔变动过于悬殊',
    code: 'extreme_attribute_delta',
    field: 'changes',
    reviewProbability: 0.6,
    exceptions: [{ description: '雷劫之下涨落无常', when: EXC_DURING_TRIBULATION }],
    triggers: (ctx) =>
      arr(ctx, 'output.changes').some((raw) => {
        const d = Number((raw as Record<string, unknown>)?.delta);
        return Number.isFinite(d) && Math.abs(d) >= 100000;
      }),
  },
  {
    id: 'soft.numeric.extreme_spirit_stones',
    layer: 2,
    description: '灵石进出过巨',
    code: 'extreme_spirit_stone_delta',
    field: 'changes.spiritStones',
    reviewProbability: 0.55,
    exceptions: [{ description: '身处秘境，重宝可期', when: EXC_IN_SECRET_REALM }],
    triggers: (ctx) => {
      const held = Number(pick(ctx, 'character.spiritStones')) || 0;
      const cap = Math.max(10000, held * 20 + 1000);
      return arr(ctx, 'output.changes').some((raw) => {
        const c = raw as Record<string, unknown>;
        if (String(c?.attribute) !== 'spiritStones') return false;
        const d = Number(c?.delta);
        return Number.isFinite(d) && Math.abs(d) > cap;
      });
    },
  },
  {
    id: 'soft.numeric.non_numeric_delta',
    layer: 2,
    description: '变动数额不成数',
    code: 'non_numeric_attribute_delta',
    field: 'changes',
    // 最高：这个是纯粹的格式脏值，几乎总该看一眼
    reviewProbability: 0.9,
    triggers: (ctx) =>
      arr(ctx, 'output.changes').some((raw) => {
        if (!raw || typeof raw !== 'object') return true;
        return !Number.isFinite(Number((raw as Record<string, unknown>).delta));
      }),
  },
];

// ==================== 叙事契约类 ====================

// 这 9 条对应 NARRATIVE_FEEDBACK_CODES —— 全仓唯一已闭环的反馈通路。
// 它们的 disposition 天然是 inject_context（回灌下轮生成侧）而非 flag_review，
// 但在软规则表里统一用 flag_review 表达「该看一眼」，
// 由求值器根据 code 是否属于 NARRATIVE_FEEDBACK_CODES 决定升格为 inject_context。
const contractSoftRules: SoftRule[] = [
  {
    id: 'soft.contract.missing',
    layer: 2,
    description: '世事压力在前，未表明着眼何处',
    code: 'missing_narrative_contract',
    field: 'narrativeContract',
    reviewProbability: 0.5,
    triggers: (ctx) =>
      Boolean(pick(ctx, 'world.hasStrongPressure')) && !pick(ctx, 'output.narrativeContract'),
  },
  {
    id: 'soft.contract.empty_under_pressure',
    layer: 2,
    description: '世事压力在前，所表着眼为空',
    code: 'empty_narrative_contract_under_pressure',
    field: 'narrativeContract',
    reviewProbability: 0.45,
    triggers: (ctx) =>
      Boolean(pick(ctx, 'world.hasStrongPressure')) &&
      Boolean(pick(ctx, 'world.hasEmptyContract')),
  },
  {
    id: 'soft.contract.top_focus_ignored',
    layer: 2,
    description: '首要之事未获点明',
    code: 'top_schedule_focus_not_declared',
    field: 'narrativeContract.usedScheduleHintIds',
    reviewProbability: 0.3,
    triggers: (ctx) => Boolean(pick(ctx, 'world.topFocusIgnored')),
  },
  {
    id: 'soft.contract.daily_ignores_pressure',
    layer: 2,
    description: '取寻常日课，却有更重之事在侧',
    code: 'daily_focus_ignores_pressure_map',
    field: 'narrativeContract.narrativeFocus',
    reviewProbability: 0.3,
    triggers: (ctx) => Boolean(pick(ctx, 'world.dailyIgnoresPressure')),
  },
];

// ==================== 争斗形制类 ====================

const combatSoftRules: SoftRule[] = [
  {
    id: 'soft.combat.missing_context',
    layer: 2,
    description: '争斗缺少来由与场面',
    code: 'combat_missing_context',
    field: 'triggerCombat',
    reviewProbability: 0.5,
    triggers: (ctx) => {
      const combat = pick(ctx, 'output.triggerCombat');
      if (!combat || typeof combat !== 'object') return false;
      const c = combat as Record<string, unknown>;
      if (!Array.isArray(c.enemies) || c.enemies.length === 0) return false;
      return !c.contextTitle || !c.contextNarrative;
    },
  },
  {
    id: 'soft.combat.invalid_enemy',
    layer: 2,
    description: '敌手形制不成立',
    code: 'invalid_combat_enemy',
    field: 'triggerCombat.enemies',
    reviewProbability: 0.8,
    triggers: (ctx) => {
      const combat = pick(ctx, 'output.triggerCombat');
      if (!combat || typeof combat !== 'object') return false;
      const enemies = (combat as Record<string, unknown>).enemies;
      if (!Array.isArray(enemies)) return false;
      return enemies.some((raw) => {
        if (!raw || typeof raw !== 'object') return true;
        const e = raw as Record<string, unknown>;
        return !e.name || Number(e.hp) <= 0 || Number(e.attack) < 0 || Number(e.defense) < 0;
      });
    },
  },
];

// ==================== 汇总 ====================

export const SOFT_RULES: readonly SoftRule[] = Object.freeze([
  ...threadSoftRules,
  ...itemSoftRules,
  ...npcSoftRules,
  ...numericSoftRules,
  ...contractSoftRules,
  ...combatSoftRules,
]);

export function getSoftRule(id: string): SoftRule | undefined {
  return SOFT_RULES.find((r) => r.id === id);
}

/**
 * 第二层默认不执行。
 * 注意：即便将来打开，软规则的「执行」也只是 flag_review —— 落一条审查标记，
 * 本轮数据照旧放行。所以第二层接线的风险是全五层里最低的。
 */
export const SOFT_RULE_ENFORCEMENT_DEFAULT = false;

/**
 * 影子比对期专用：把所有 reviewProbability 视为 1（必标记）。
 * 这样新规则表的产出与 ai-boundary-validator 的 trace 是**逐条可比**的
 * —— 概率通道关掉后，两边就该一一对应。
 */
export const SHADOW_MODE_RNG: () => number = () => 0;
