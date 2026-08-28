// 第一层补充：UI 槽位词表（whitelist 类硬规则）
//
// 这批规则的词表是**从 engine/validation.ts 原样迁来的**，不是新造的。
// 原先它们是 validation.ts 里的五个模块私有 const 数组
// （SLOT_BOUNDARY_KNOWN_CATEGORIES / GROUPS / SLOTS / TONES / RENDER_HINTS），
// 被 validateUISlotMapping 与 clampCategoryToKnownSlot 两个函数用 Set.has 硬查。
//
// 迁过来的收益不是「代码更漂亮」，而是这批判定从此**可查询**：
//   哪些值在册、这条规则的处置是钳还是剥、能不能被局部覆盖，
//   都能经 registry.ts 一次问清，不必去读 validation.ts 的函数体。
//
// 迁移硬约束：**词表内容与顺序逐字不变**。
//   顺序要紧 —— clampCategoryToKnownSlot 在 misc / uncategorized 都不在调用方
//   许可集合时会取 Array.from(known)[0]，那是顺序敏感的路径。
//
// 同源提醒：display-registry.ts 的 SLOT_SET / groupFromStatus 是这批词表的兄弟来源。
// 本批不动它 —— 两边保持各自自洽，等接线批次二再收成一处。
//
// 本文件**只 import type**，编译后无任何运行时依赖（依赖环成因见 whitelist.ts 顶注）。

import type { HardRule } from './types';

// ==================== 词表（逐字迁自 validation.ts） ====================

/** 槽位名七种 */
export const UI_SLOT_NAMES: ReadonlyArray<string> = Object.freeze([
  'topTags',
  'characterDetail',
  'statusPage',
  'threadPage',
  'combatPanel',
  'inventoryPanel',
  'worldLegacy',
]);

/** 色调六种 */
export const UI_SLOT_TONES: ReadonlyArray<string> = Object.freeze([
  'neutral',
  'good',
  'bad',
  'rare',
  'danger',
  'mystery',
]);

/** 呈现形制六种 */
export const UI_SLOT_RENDER_HINTS: ReadonlyArray<string> = Object.freeze([
  'badge',
  'card',
  'meter',
  'timeline',
  'action',
  'detail',
]);

/** 归组七种（与 display-registry.ts 的 groupFromStatus 对应） */
export const UI_SLOT_GROUPS: ReadonlyArray<string> = Object.freeze([
  'identity',
  'constitution',
  'attribute',
  'fate',
  'debuff',
  'buff',
  'misc',
]);

/** 类别十六种。末两项 misc / uncategorized 是钳制落点，不可删 */
export const UI_SLOT_CATEGORIES: ReadonlyArray<string> = Object.freeze([
  'attribute',
  'status',
  'special',
  'identity',
  'quest',
  'thread',
  'fate',
  'injury',
  'buff',
  'debuff',
  'constitution',
  'item',
  'technique',
  'realm',
  'misc',
  'uncategorized',
]);

// ==================== 规则 ====================

function frozenSet(values: ReadonlyArray<string>): ReadonlySet<string> {
  return new Set(values);
}

/**
 * 类别词表。
 * disposition=clamp —— 既有行为是归一到 misc（clampCategoryToKnownSlot），不是拒绝。
 * overridable=false —— UI 词表是前端渲染契约，秘境或宗门无权改它。
 */
export const UI_SLOT_CATEGORY_RULE: HardRule = Object.freeze({
  id: 'hard.whitelist.ui_slot_category',
  layer: 1,
  kind: 'whitelist',
  description: '槽位类别须为已知十六种',
  disposition: 'clamp',
  code: 'invalid_category',
  field: 'slot.category',
  allowed: frozenSet(UI_SLOT_CATEGORIES),
  overridable: false,
});

export const UI_SLOT_GROUP_RULE: HardRule = Object.freeze({
  id: 'hard.whitelist.ui_slot_display_group',
  layer: 1,
  kind: 'whitelist',
  description: '槽位归组须为已知七种',
  disposition: 'clamp',
  code: 'field_normalized',
  field: 'slot.displayGroup',
  allowed: frozenSet(UI_SLOT_GROUPS),
  overridable: false,
});

/**
 * 槽位名词表。
 * disposition=strip —— 既有行为是 filter 掉未知槽位（不是归一到某个默认槽位），
 * 这正是 strip 与 clamp 的分野：剥离越界项，其余照旧。
 */
export const UI_SLOT_NAME_RULE: HardRule = Object.freeze({
  id: 'hard.whitelist.ui_slot_display_slot',
  layer: 1,
  kind: 'whitelist',
  description: '槽位名须为已知七种',
  disposition: 'strip',
  code: 'invalid_type',
  field: 'slot.displaySlots',
  allowed: frozenSet(UI_SLOT_NAMES),
  overridable: false,
});

export const UI_SLOT_TONE_RULE: HardRule = Object.freeze({
  id: 'hard.whitelist.ui_slot_tone',
  layer: 1,
  kind: 'whitelist',
  description: '槽位色调须为已知六种',
  disposition: 'clamp',
  code: 'field_normalized',
  field: 'slot.tone',
  allowed: frozenSet(UI_SLOT_TONES),
  overridable: false,
});

export const UI_SLOT_RENDER_HINT_RULE: HardRule = Object.freeze({
  id: 'hard.whitelist.ui_slot_render_hint',
  layer: 1,
  kind: 'whitelist',
  description: '槽位呈现形制须为已知六种',
  disposition: 'clamp',
  code: 'field_normalized',
  field: 'slot.renderHint',
  allowed: frozenSet(UI_SLOT_RENDER_HINTS),
  overridable: false,
});

/**
 * 按名取用（接线侧直接持规则对象，不走字符串 id 查表）。
 * 好处：id 拼错在编译期就报，不会等到运行时查不到规则而静默放行。
 */
export const UI_SLOT_RULES = Object.freeze({
  category: UI_SLOT_CATEGORY_RULE,
  displayGroup: UI_SLOT_GROUP_RULE,
  displaySlot: UI_SLOT_NAME_RULE,
  tone: UI_SLOT_TONE_RULE,
  renderHint: UI_SLOT_RENDER_HINT_RULE,
});

export const UI_SLOT_HARD_RULES: readonly HardRule[] = Object.freeze([
  UI_SLOT_CATEGORY_RULE,
  UI_SLOT_GROUP_RULE,
  UI_SLOT_NAME_RULE,
  UI_SLOT_TONE_RULE,
  UI_SLOT_RENDER_HINT_RULE,
]);

/** 钳制落点。与 validation.ts 既有行为一致，改动这里等于改玩法，慎动 */
export const UI_SLOT_CLAMP_FALLBACK = Object.freeze({
  category: 'misc',
  categorySecondary: 'uncategorized',
  displayGroup: 'misc',
  tone: 'neutral',
  renderHint: 'badge',
});
