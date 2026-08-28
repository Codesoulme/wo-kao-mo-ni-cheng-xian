// 五层规则体系 —— 现有 trace code 全集（实地抓取，只读镜像）
//
// 抓取范围（2026-08-14 逐文件核对）：
//   - content-registry.ts   ValidationTraceCode 联合类型 15 个
//   - effect-resolver.ts    trace.push 里的 code 字面量 7 个
//   - ai-boundary-validator.ts  pushTrace 里的 code 字面量 37 个
//
// 本文件**不发明新码**。将来接线时规则求值器只允许吐出这里列出的 code，
// 这样既有 smoke 断言（按 code 过滤 / 计数）不会因为多出未知码而翻红。
//
// 维护约定：如果上游三个文件新增了 code，这里补一行即可；
// 反过来这里不得先行定义上游没有的码。

// ==================== 来源一：content-registry.ts ====================
// 注册前校验。处置形态：静默归一 / 钳制；仅缺 name/title 时才 reject。
export const REGISTRY_TRACE_CODES = [
  'missing_id',
  'duplicate_id',
  'missing_name',
  'missing_description',
  'invalid_type',
  'invalid_category',
  'invalid_rarity',
  'invalid_duration',
  'invalid_effect',
  'empty_effect_removed',
  'value_clamped',
  'field_normalized',
  'accepted',
  // 幼龄拦截：execute-ai-event.ts 的 procInfantGuard 复用了 registry 的 trace 通道
  'infant_blocked_combat',
  'infant_blocked_choice',
] as const;

// ==================== 来源二：effect-resolver.ts ====================
// 属性变更结算。全仓唯一「未知键 → 布尔拒绝」的地方（unknown_attribute）。
export const EFFECT_TRACE_CODES = [
  'unknown_attribute',
  'cultivation_multiplier_applied',
  'value_clamped',
  'attribute_applied',
  'death_triggered_by_hp',
  'hp_capped_by_maxHp',
  'mp_capped_by_maxMp',
] as const;

// ==================== 来源三：ai-boundary-validator.ts ====================
// 事后扫描。当前**纯记录零阻断**：全文只 push info / warning，
// 'error' 只出现在类型定义与末尾过滤器两处，所以 errors 恒为空数组。
export const BOUNDARY_TRACE_CODES = [
  // validateThreadContinuity
  'unknown_thread_reference',
  'duplicate_thread_id',
  'duplicate_new_thread_id',
  'past_deadline_new_thread',
  'closed_thread_referenced',
  'closed_thread_reopened_as_new',
  'new_thread_from_closed_source',
  'active_thread_duplicate_reference',
  'unaddressed_high_priority_quest',
  // validateItemConsistency
  'removed_unknown_item',
  'equip_unknown_item',
  'unequip_unknown_item',
  'new_item_duplicate_id',
  'new_item_duplicate_name',
  // validateNpcConsistency
  'npc_hostile_to_friendly_without_cause',
  'npc_friendly_to_hostile_without_cause',
  'npc_relationship_jump_without_cause',
  'friendly_npc_used_as_enemy_without_cause',
  // validateWorldFactConsistency
  'closed_thread_mentioned_without_aftermath_frame',
  'generated_name_matches_existing_world_fact',
  // validateNarrativeContract（这 9 个同时也是 NARRATIVE_CONTRACT_AUDIT_CODES）
  'missing_narrative_contract',
  'invalid_narrative_focus',
  'invalid_narrative_outcome',
  'unknown_schedule_hint_reference',
  'unknown_world_fact_reference',
  'unknown_npc_contract_reference',
  'empty_narrative_contract_under_pressure',
  'top_schedule_focus_not_declared',
  'daily_focus_ignores_pressure_map',
  // validateAttributeChanges
  'non_numeric_attribute_delta',
  'extreme_attribute_delta',
  'missing_change_reason',
  // validateRewardsAndCombat
  'excessive_item_rewards',
  'extreme_spirit_stone_delta',
  'combat_deferred_by_choice',
  'combat_missing_context',
  'invalid_combat_enemy',
] as const;

// 全仓唯一已闭环的反馈通路：这 9 码经 extractNarrativeContractFeedback
// 回灌下一轮生成侧。它是「校验结果能改变生成侧行为」的既有范例，
// 第二层软规则的 flag_review 将来要学它的形态接线。
export const NARRATIVE_FEEDBACK_CODES = [
  'missing_narrative_contract',
  'invalid_narrative_focus',
  'invalid_narrative_outcome',
  'unknown_schedule_hint_reference',
  'unknown_world_fact_reference',
  'unknown_npc_contract_reference',
  'empty_narrative_contract_under_pressure',
  'top_schedule_focus_not_declared',
  'daily_focus_ignores_pressure_map',
] as const;

export type RegistryTraceCode = (typeof REGISTRY_TRACE_CODES)[number];
export type EffectTraceCode = (typeof EFFECT_TRACE_CODES)[number];
export type BoundaryTraceCode = (typeof BOUNDARY_TRACE_CODES)[number];

/** 规则体系允许引用的 code 全集（三源合并去重） */
export type KnownTraceCode = RegistryTraceCode | EffectTraceCode | BoundaryTraceCode;

export const KNOWN_TRACE_CODES: ReadonlySet<string> = new Set<string>([
  ...REGISTRY_TRACE_CODES,
  ...EFFECT_TRACE_CODES,
  ...BOUNDARY_TRACE_CODES,
]);

/** code → 来源标签（影子比对时用来定位「该跟谁比」） */
export const TRACE_CODE_ORIGIN: Readonly<Record<string, 'registry' | 'effect' | 'boundary'>> =
  (() => {
    const map: Record<string, 'registry' | 'effect' | 'boundary'> = {};
    for (const c of BOUNDARY_TRACE_CODES) map[c] = 'boundary';
    for (const c of EFFECT_TRACE_CODES) map[c] = 'effect';
    // registry 放最后：value_clamped 在三处都有，注册前校验是它的主场
    for (const c of REGISTRY_TRACE_CODES) map[c] = 'registry';
    return map;
  })();

/** 判定一个 code 是否是既有码（规则注册时的自检闸门） */
export function isKnownTraceCode(code: string): code is KnownTraceCode {
  return KNOWN_TRACE_CODES.has(code);
}
