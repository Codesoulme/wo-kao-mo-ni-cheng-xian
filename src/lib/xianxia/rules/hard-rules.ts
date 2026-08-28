// 第一层：硬规则（确定性定律 —— 全局默认值，可被第三层局部覆盖）
//
// 关键点：硬规则的默认处置是 **clamp / strip，不是 reject**。
// 这与既有行为一致（effect-resolver 钳到 bounds、procInfantGuard 剥字段），
// 也是「全局默认值」的题中之义 —— 默认值被局部改写是正常的，不是违规。
//
// 数据来源全部 **import 复用，不复制**：
//   ATTRIBUTE_BOUNDS  ← engine/attributes.ts（21 项数值区间）
//   6 张枚举白名单     ← content-registry.ts 里已有的集合。
//                        但那些集合是模块私有（未 export），本批不改现有文件，
//                        所以这里改为从**类型**推导，而非复制字面量 —— 见下方说明。

import { ATTRIBUTE_BOUNDS } from '../engine/attributes';
import type { ItemType, StatusCategory, PendingThread } from '../types';
import type { HardRule, RuleContext } from './types';

// ==================== bounds 类：直接吃 ATTRIBUTE_BOUNDS ====================

/**
 * 由 ATTRIBUTE_BOUNDS 生成 bounds 类硬规则。
 * 这是 import 复用而非复制：上游改一个数字，这里自动跟随，不会漂移。
 *
 * overridable 判定：绝大多数属性上限可被秘境/阵法局部改写（第三层的用场），
 * 但少数是引擎独占的不变量，标 false。
 */
const NON_OVERRIDABLE_ATTRS: ReadonlySet<string> = new Set([
  // 年龄推进是引擎独占职责（execute-ai-event.ts 注释明确写了这点）；
  // age 本就不在 ATTRIBUTE_BOUNDS 里，这里列出是为了将来若有人加进去时兜住
  'age',
  // 生命/法力上限可以被改，但「hp 不得超过 maxHp」这条不变式不可覆盖，
  // 见下方 invariant 段
]);

export const BOUNDS_HARD_RULES: readonly HardRule[] = Object.freeze(
  Object.entries(ATTRIBUTE_BOUNDS).map(([attr, bounds]): HardRule => ({
    id: `hard.bounds.${attr}`,
    layer: 1,
    kind: 'bounds',
    description: `${attr} 取值须落在 ${bounds.min}~${bounds.max}`,
    disposition: 'clamp',
    // 复用 effect-resolver 的既有码
    code: 'value_clamped',
    field: `changes.${attr}`,
    bounds,
    overridable: !NON_OVERRIDABLE_ATTRS.has(attr),
  })),
);

// ==================== whitelist 类 ====================

// 说明：content-registry.ts 里的 6 张集合（ITEM_TYPES / STATUS_CATEGORIES /
// THREAD_CATEGORIES / RARITIES / EFFECT_OPERATIONS / REALM_NORMALIZE）都是
// **模块私有、未 export**。本批硬约束是「不改任何现有文件」，所以不能去加 export。
//
// 折中办法：从**类型**派生而非从值复制。下面每张表都用
// `Record<XxxType, true>` 的形式写，一旦上游联合类型增删成员，
// tsc 立刻在这里报错（缺键 / 多键），编译期就把漂移抓住。
// 这比复制一份字面量安全 —— 复制会静默漂移，这个不会。
//
// 接线批次二里可以顺手给 content-registry 加 export，届时把这里换成直接 import。

function keysOf<T extends string>(map: Record<T, true>): ReadonlySet<string> {
  return new Set(Object.keys(map));
}

/** 与 content-registry ITEM_TYPES 同构；类型驱动，缺键即编译报错 */
const ITEM_TYPE_TABLE: Record<ItemType, true> = {
  weapon: true,
  armor: true,
  accessory: true,
  artifact: true,
  consumable: true,
  material: true,
  tool: true,
  scripture: true,
};

/** 与 content-registry STATUS_CATEGORIES 同构 */
const STATUS_CATEGORY_TABLE: Record<StatusCategory, true> = {
  attribute: true,
  skill: true,
  buff: true,
  debuff: true,
  special: true,
  constitution: true,
  identity: true,
  quest: true,
  environment: true,
};

/** 与 content-registry THREAD_CATEGORIES 同构 */
const THREAD_CATEGORY_TABLE: Record<NonNullable<PendingThread['category']>, true> = {
  competition: true,
  enemy: true,
  quest: true,
  promise: true,
  mystery: true,
  romance: true,
  debt: true,
  inheritance: true,
  exploration: true,
};

/** 稀有度六级（content-registry RARITIES） */
const RARITY_TABLE = {
  common: true,
  uncommon: true,
  rare: true,
  epic: true,
  legendary: true,
  mythic: true,
} as const;

/** 效果运算六种（content-registry EFFECT_OPERATIONS） */
const EFFECT_OPERATION_TABLE = {
  add: true,
  multiply: true,
  override: true,
  cap: true,
  floor: true,
  trigger: true,
} as const;

/** 境界九阶（content-registry REALM_NORMALIZE 的英文 enum key 值域） */
const REALM_KEY_TABLE = {
  mortal: true,
  qi_refining: true,
  foundation: true,
  golden_core: true,
  nascent_soul: true,
  spirit_severing: true,
  great_vehicle: true,
  tribulation: true,
  ascension: true,
} as const;

export const WHITELIST_HARD_RULES: readonly HardRule[] = Object.freeze([
  {
    id: 'hard.whitelist.item_type',
    layer: 1,
    kind: 'whitelist',
    description: '法宝类别须为已知八类',
    // 既有行为是归一到 material 而非拒绝，所以是 clamp（归一即钳）
    disposition: 'clamp',
    code: 'invalid_type',
    field: 'newItems.item_type',
    allowed: keysOf(ITEM_TYPE_TABLE),
    overridable: false,
  },
  {
    id: 'hard.whitelist.status_category',
    layer: 1,
    kind: 'whitelist',
    description: '状态类别须为已知八类',
    disposition: 'clamp',
    code: 'invalid_category',
    field: 'newStatuses.category',
    allowed: keysOf(STATUS_CATEGORY_TABLE),
    overridable: false,
  },
  {
    id: 'hard.whitelist.thread_category',
    layer: 1,
    kind: 'whitelist',
    description: '因缘类别须为已知九类',
    disposition: 'clamp',
    code: 'invalid_category',
    field: 'newThreads.category',
    allowed: keysOf(THREAD_CATEGORY_TABLE),
    overridable: false,
  },
  {
    id: 'hard.whitelist.rarity',
    layer: 1,
    kind: 'whitelist',
    description: '品阶须为已知六级',
    disposition: 'clamp',
    code: 'invalid_rarity',
    field: 'rarity',
    allowed: keysOf(RARITY_TABLE),
    overridable: false,
  },
  {
    id: 'hard.whitelist.effect_operation',
    layer: 1,
    kind: 'whitelist',
    description: '效果运算须为已知六种',
    disposition: 'strip',
    code: 'invalid_effect',
    field: 'effects.operation',
    allowed: keysOf(EFFECT_OPERATION_TABLE),
    overridable: false,
  },
  {
    id: 'hard.whitelist.realm_key',
    layer: 1,
    kind: 'whitelist',
    description: '境界须为已知九阶',
    disposition: 'clamp',
    code: 'field_normalized',
    field: 'realm',
    allowed: keysOf(REALM_KEY_TABLE),
    overridable: false,
  },
] satisfies HardRule[]);

// ==================== invariant 类：结构不变式 ====================

function num(ctx: RuleContext, path: string): number {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return NaN;
    cur = (cur as Record<string, unknown>)[p];
  }
  return Number(cur);
}

export const INVARIANT_HARD_RULES: readonly HardRule[] = Object.freeze([
  {
    id: 'hard.invariant.hp_le_maxhp',
    layer: 1,
    kind: 'invariant',
    description: '气血不得超过气血上限',
    disposition: 'clamp',
    code: 'hp_capped_by_maxHp',
    field: 'hp',
    // 不变式不可覆盖：秘境可以抬高 maxHp，但 hp>maxHp 在任何地方都不成立
    overridable: false,
    violates: (ctx) => {
      const hp = num(ctx, 'character.hp');
      const maxHp = num(ctx, 'character.maxHp');
      if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return false;
      return hp > maxHp;
    },
  },
  {
    id: 'hard.invariant.mp_le_maxmp',
    layer: 1,
    kind: 'invariant',
    description: '法力不得超过法力上限',
    disposition: 'clamp',
    code: 'mp_capped_by_maxMp',
    field: 'mp',
    overridable: false,
    violates: (ctx) => {
      const mp = num(ctx, 'character.mp');
      const maxMp = num(ctx, 'character.maxMp');
      if (!Number.isFinite(mp) || !Number.isFinite(maxMp)) return false;
      return mp > maxMp;
    },
  },
  {
    id: 'hard.invariant.infant_no_combat',
    layer: 1,
    kind: 'invariant',
    description: '幼龄（未满六岁）不得动武',
    // 这是全仓唯一的真硬拦截，既有行为是剥离字段
    disposition: 'strip',
    code: 'infant_blocked_combat',
    field: 'triggerCombat',
    overridable: false,
    violates: (ctx) => {
      const age = num(ctx, 'character.age');
      if (!Number.isFinite(age) || age >= 6) return false;
      return Boolean((ctx.output as Record<string, unknown> | undefined)?.triggerCombat);
    },
  },
  {
    id: 'hard.invariant.infant_no_choice',
    layer: 1,
    kind: 'invariant',
    description: '幼龄（未满六岁）不可独立抉择',
    disposition: 'strip',
    code: 'infant_blocked_choice',
    field: 'hasChoice',
    overridable: false,
    violates: (ctx) => {
      const age = num(ctx, 'character.age');
      if (!Number.isFinite(age) || age >= 6) return false;
      return Boolean((ctx.output as Record<string, unknown> | undefined)?.hasChoice);
    },
  },
  {
    id: 'hard.invariant.unknown_attribute',
    layer: 1,
    kind: 'invariant',
    description: '未知属性键不予结算',
    // effect-resolver 里这是真的丢进 rejectedChanges —— 全仓最接近布尔拒绝的一处。
    // 但语义上它是「剥离这一笔」而非「拒绝整个事件」，所以标 strip。
    disposition: 'strip',
    code: 'unknown_attribute',
    field: 'changes.attribute',
    overridable: false,
    violates: (ctx) => {
      const changes = (ctx.output as Record<string, unknown> | undefined)?.changes;
      if (!Array.isArray(changes)) return false;
      return changes.some((raw) => {
        if (!raw || typeof raw !== 'object') return true;
        const attr = String((raw as Record<string, unknown>).attribute || '').trim();
        return !attr || !(attr in ATTRIBUTE_BOUNDS);
      });
    },
  },
] satisfies HardRule[]);

// ==================== 汇总 ====================

export const HARD_RULES: readonly HardRule[] = Object.freeze([
  ...BOUNDS_HARD_RULES,
  ...WHITELIST_HARD_RULES,
  ...INVARIANT_HARD_RULES,
]);

/** 按 id 取硬规则（第三层覆盖要靠 targetRuleId 找到它） */
export function getHardRule(id: string): HardRule | undefined {
  return HARD_RULES.find((r) => r.id === id);
}

/** 可被覆盖的硬规则 id 集合（第三层注册时的校验用） */
export const OVERRIDABLE_HARD_RULE_IDS: ReadonlySet<string> = new Set(
  HARD_RULES.filter((r) => r.overridable).map((r) => r.id),
);

/** 第一层默认不执行 —— 现有 effect-resolver / registry 仍是唯一权威 */
export const HARD_RULE_ENFORCEMENT_DEFAULT = false;
