// 第三层：规则覆盖（局部有条件覆盖 —— 覆盖而非违反）
//
// 这是五层里最缺、也最有价值的一层。
//
// 核心洞察：**反重力装置不是让引力失效，而是产生等大反向的力**。
// 区分二者的实际收益是可推导性 —— 只有把它建模成「原规则仍在算 + 一个带条件的
// 反向量」，引擎才能自动推出「装置断电 → 重力立刻恢复」。
// 如果建模成「引力在此地失效」，断电时就无从恢复，只能靠人手写回收逻辑，
// 而人手写的回收逻辑一定会漏。
//
// ---------- 本层要修的真实痼疾（已核实）----------
//
// execute-ai-event.ts:293-298
//   function applyRealmProfilePatch(state, patch) {
//     const profile = sanitizeRealmProfile(patch);
//     if (!profile) return state;
//     const current = getRealmProfile(state) || {};
//     return { ...state, realmProfile: { ...current, ...profile } };
//   }
//
// 在 :843-845 的突破处理器里被调用。生成侧可以给出 maxLevel / powerMultiplier /
// expMultiplier 三个根本参数，**浅合并后永久写入 state.realmProfile**。
// 没有 scope、没有 condition、没有 expiresAtAge，也没有任何回收路径 ——
// 秘境或宗门给出的境界加成一旦落下，出了秘境、退了宗门，数值照旧留在身上。
// 而且因为是浅合并，同一个字段会被后一次 patch 覆盖，但从不回落到基准值。
//
// 建模成覆盖栈之后：秘境加成是一条 scope='secret_realm' 的 RuleOverride，
// condition 是「当前秘境 id 等于此 id」。人离开秘境，condition 为假，
// resolveOverrides 就不再返回它的 effect，数值自动回到基准。
// 不需要任何回收代码 —— 回落是求值的自然结果，不是一个要记得去做的动作。
//
// **本批不实际改造它**，只把接口设计成能容纳它，并给出设计验证案例（见文件末）。

import { evalDSL } from '../rules-dsl/interpreter';
import type { DSLNode } from '../rules-dsl/ast';
import { OVERRIDABLE_HARD_RULE_IDS, getHardRule } from './hard-rules';
import type {
  RuleOverride,
  OverrideResolution,
  RuleContext,
  OverrideScope,
} from './types';

// ==================== 作用域匹配 ====================

/**
 * 作用域是否对得上。这一步先于 condition 求值 ——
 * 作用域不匹配的覆盖连条件都不必算（也算不出正确结果）。
 */
function scopeMatches(scope: OverrideScope, scopeRefId: string | undefined, ctx: RuleContext): boolean {
  switch (scope) {
    case 'global':
      return true;
    case 'location':
      return Boolean(scopeRefId) && ctx.locationId === scopeRefId;
    case 'secret_realm':
      return Boolean(scopeRefId) && ctx.secretRealmId === scopeRefId;
    case 'sect':
      return Boolean(scopeRefId) && ctx.sectId === scopeRefId;
    case 'status': {
      const ids = ctx.world && typeof ctx.world === 'object'
        ? (ctx.world as Record<string, unknown>).statusIds
        : undefined;
      return Boolean(scopeRefId) && Array.isArray(ids) && ids.map(String).includes(String(scopeRefId));
    }
    case 'formation': {
      const ids = ctx.world && typeof ctx.world === 'object'
        ? (ctx.world as Record<string, unknown>).formationIds
        : undefined;
      return Boolean(scopeRefId) && Array.isArray(ids) && ids.map(String).includes(String(scopeRefId));
    }
    case 'tribulation': {
      const w = ctx.world && typeof ctx.world === 'object' ? (ctx.world as Record<string, unknown>) : {};
      return Boolean(w.inTribulation);
    }
    default:
      return false;
  }
}

// ==================== 单条覆盖求值 ====================

/**
 * 求值一条覆盖。**纯函数**，绝不改 ctx。
 * 四道闸门依次过：目标可覆盖 → 未过期 → 作用域匹配 → 条件为真。
 * 任一不过，返回 active:false 并带上原因 —— 原因是可诊断性的关键，
 * 「为什么这个加成没了」必须能一句话答出来。
 */
export function resolveOverride(override: RuleOverride, ctx: RuleContext): OverrideResolution {
  // 闸门一：目标规则必须允许被覆盖（第零层的「可演化但本不可移」在这里落地）
  const target = getHardRule(override.targetRuleId);
  if (!target || !OVERRIDABLE_HARD_RULE_IDS.has(override.targetRuleId)) {
    return { override, active: false, inactiveReason: 'target_not_overridable' };
  }

  // 闸门二：过期判定
  if (
    typeof override.expiresAtAge === 'number' &&
    typeof ctx.age === 'number' &&
    ctx.age > override.expiresAtAge
  ) {
    return { override, active: false, inactiveReason: 'expired' };
  }

  // 闸门三：作用域
  if (!scopeMatches(override.scope, override.scopeRefId, ctx)) {
    return { override, active: false, inactiveReason: 'scope_mismatch' };
  }

  // 闸门四：DSL 条件。复用 rules-dsl 的解释器（不改它一行，只 import）
  let conditionHolds = false;
  try {
    conditionHolds = Boolean(evalDSL(override.condition, ctx));
  } catch {
    // 仓内既有风格：try/catch 失败不阻断。条件算不出来就当不生效（保守回落）
    return { override, active: false, inactiveReason: 'eval_error' };
  }
  if (!conditionHolds) {
    return { override, active: false, inactiveReason: 'condition_false' };
  }

  // 四关全过 —— 算出有效改写
  const base = target.bounds;
  switch (override.mode) {
    case 'shift_bounds': {
      const shift = Number(override.magnitude) || 0;
      return {
        override,
        active: true,
        effect: {
          targetRuleId: override.targetRuleId,
          mode: 'shift_bounds',
          bounds: base ? { min: base.min, max: base.max + shift } : undefined,
        },
      };
    }
    case 'counter_force': {
      // 反重力的正解：原规则仍在算，这里只提供等大反向量
      return {
        override,
        active: true,
        effect: {
          targetRuleId: override.targetRuleId,
          mode: 'counter_force',
          counterForce: Number(override.magnitude) || 0,
          bounds: base,
        },
      };
    }
    case 'replace_value': {
      return {
        override,
        active: true,
        effect: {
          targetRuleId: override.targetRuleId,
          mode: 'replace_value',
          replacement: Number(override.replacement),
          bounds: base,
        },
      };
    }
    case 'suspend': {
      // 注意：suspend 也**不删除**原规则 —— 原规则对象仍在栈里，
      // 只是本次求值不参与。这保证了「条件失效即恢复」
      return {
        override,
        active: true,
        effect: { targetRuleId: override.targetRuleId, mode: 'suspend', bounds: base },
      };
    }
    default:
      return { override, active: false, inactiveReason: 'eval_error' };
  }
}

// ==================== 覆盖栈求值 ====================

/**
 * 求值整个覆盖栈。返回**全部**结果（含未生效的），因为
 * 「哪条为什么没生效」跟「哪条生效了」一样重要。
 *
 * 叠加规则：同一 targetRuleId 上多条同时生效时，
 *   - shift_bounds / counter_force 累加（多重加成应当叠加）
 *   - replace_value 取最后一条（后注册的赢）
 *   - suspend 一票通过（任一 suspend 生效则该规则本轮不参与）
 */
export function resolveOverrides(
  overrides: readonly RuleOverride[],
  ctx: RuleContext,
): OverrideResolution[] {
  return overrides.map((o) => {
    try {
      return resolveOverride(o, ctx);
    } catch {
      return { override: o, active: false, inactiveReason: 'eval_error' as const };
    }
  });
}

export interface EffectiveBoundsResult {
  targetRuleId: string;
  /** 基准区间（第一层的全局默认值） */
  base?: { min: number; max: number };
  /** 叠加后的有效区间 */
  effective?: { min: number; max: number };
  /** 累加后的反向量 */
  counterForce: number;
  /** 是否被暂停 */
  suspended: boolean;
  /** 参与叠加的覆盖 id（可诊断性） */
  appliedOverrideIds: string[];
}

/**
 * 算出某条硬规则在当下的**有效**区间。
 * 这是「覆盖而非违反」的最终体现：base 永远在，effective 是 base + 生效中的覆盖。
 * ctx 变了（离开秘境），effective 自动回到 base —— 无需任何回收动作。
 */
export function computeEffectiveBounds(
  targetRuleId: string,
  overrides: readonly RuleOverride[],
  ctx: RuleContext,
): EffectiveBoundsResult {
  const target = getHardRule(targetRuleId);
  const base = target?.bounds;
  const resolutions = resolveOverrides(
    overrides.filter((o) => o.targetRuleId === targetRuleId),
    ctx,
  );

  let shift = 0;
  let counterForce = 0;
  let suspended = false;
  let replacement: number | undefined;
  const appliedOverrideIds: string[] = [];

  for (const r of resolutions) {
    if (!r.active || !r.effect) continue;
    appliedOverrideIds.push(r.override.id);
    switch (r.effect.mode) {
      case 'shift_bounds':
        shift += Number(r.override.magnitude) || 0;
        break;
      case 'counter_force':
        counterForce += Number(r.effect.counterForce) || 0;
        break;
      case 'replace_value':
        if (Number.isFinite(r.effect.replacement)) replacement = r.effect.replacement;
        break;
      case 'suspend':
        suspended = true;
        break;
    }
  }

  let effective = base ? { min: base.min, max: base.max + shift } : undefined;
  if (effective && replacement !== undefined && Number.isFinite(replacement)) {
    effective = { min: replacement, max: replacement };
  }

  return { targetRuleId, base, effective, counterForce, suspended, appliedOverrideIds };
}

// ==================== 覆盖注册闸门 ====================

export interface OverrideRegistrationCheck {
  ok: boolean;
  reason?: string;
}

/**
 * 注册前自检。第零层「可演化但本不可移」在这里落地：
 * 允许注册新覆盖，但不得指向不可覆盖的目标，也不得缺 condition。
 */
export function checkOverrideRegistration(override: RuleOverride): OverrideRegistrationCheck {
  if (!override.id) return { ok: false, reason: '覆盖缺少标识' };
  if (!override.targetRuleId) return { ok: false, reason: '覆盖未指明所覆之规' };
  if (!getHardRule(override.targetRuleId)) {
    return { ok: false, reason: `所覆之规不存在：${override.targetRuleId}` };
  }
  if (!OVERRIDABLE_HARD_RULE_IDS.has(override.targetRuleId)) {
    return { ok: false, reason: `此规不可覆盖：${override.targetRuleId}` };
  }
  if (!override.condition) {
    return { ok: false, reason: '覆盖必须带生效条件，否则无从回落' };
  }
  if (!override.playerFacing) {
    return { ok: false, reason: '覆盖须有世间说法，供叙事取用' };
  }
  return { ok: true };
}

// ==================== 设计验证案例：realmProfilePatch ====================

// 下面三条是**设计验证**，不是生产注册表。
// 用途：证明第三层的接口足以容纳已核实的 realmProfilePatch 痼疾。
// 本批不接线，所以它们不会被任何现有代码读到。

/** 条件片段：当前身处指定秘境 */
export function conditionInSecretRealm(realmId: string): DSLNode {
  return {
    op: 'eq',
    args: [{ op: 'var', name: 'secretRealmId' }, { op: 'const', value: realmId }],
  };
}

/** 条件片段：当前属于指定宗门 */
export function conditionInSect(sectId: string): DSLNode {
  return {
    op: 'eq',
    args: [{ op: 'var', name: 'sectId' }, { op: 'const', value: sectId }],
  };
}

/** 条件片段：某状态仍在身 + 未到某岁 */
export function conditionWhileYounger(age: number): DSLNode {
  return {
    op: 'lt',
    args: [{ op: 'var', name: 'age' }, { op: 'const', value: age }],
  };
}

/**
 * 案例一：秘境内修行速率加成。
 * 现状 —— 生成侧给 expMultiplier=3，永久写入 state.realmProfile，出了秘境照旧三倍。
 * 覆盖栈 —— condition 是「在此秘境中」，一出秘境 effective 回到基准。
 */
export const DESIGN_CASE_SECRET_REALM_EXP: RuleOverride = Object.freeze({
  id: 'design.override.secret_realm_exp_boost',
  layer: 3,
  targetRuleId: 'hard.bounds.cultivationExp',
  description: '秘境灵气充盈，此间修行速率高于外界；出境即复常',
  scope: 'secret_realm',
  scopeRefId: 'realm_example',
  mode: 'shift_bounds',
  condition: conditionInSecretRealm('realm_example'),
  magnitude: 500000,
  playerFacing: '此地灵气浓稠远胜外间，一日之功可抵旬月。',
  code: 'value_clamped',
});

/**
 * 案例二：宗门丹药供给带来的气血上限抬升。
 * 用 counter_force 而非 replace_value —— 抬升是叠加在基准之上的一股力，
 * 不是把基准换掉。退出宗门，这股力消失，基准原样在那。
 */
export const DESIGN_CASE_SECT_HP_SUPPORT: RuleOverride = Object.freeze({
  id: 'design.override.sect_hp_support',
  layer: 3,
  targetRuleId: 'hard.bounds.maxHp',
  description: '宗门丹药供给抬升气血上限；离宗即失此供给',
  scope: 'sect',
  scopeRefId: 'sect_example',
  mode: 'counter_force',
  condition: conditionInSect('sect_example'),
  magnitude: 2000,
  playerFacing: '门中丹药不断，气血比往日雄浑几分。',
  code: 'value_clamped',
});

/**
 * 案例三：幼龄期的护持。
 * 这条用 expiresAtAge 而非 condition —— 说明两种失效路径都有。
 * 注意目标是 lifespan 而非 infant_no_combat：后者 overridable=false，
 * 想覆盖它 checkOverrideRegistration 会挡住 —— 这正是第零层
 * 「本不可移」在第三层的实际体现。
 */
export const DESIGN_CASE_INFANT_SHELTER: RuleOverride = Object.freeze({
  id: 'design.override.infant_shelter',
  layer: 3,
  targetRuleId: 'hard.bounds.lifespan',
  description: '幼龄受长辈护持，寿数下限抬高；及龄自解',
  scope: 'global',
  mode: 'shift_bounds',
  condition: conditionWhileYounger(6),
  magnitude: 10,
  expiresAtAge: 6,
  playerFacing: '有长辈在旁看顾，无性命之忧。',
  code: 'value_clamped',
});

export const DESIGN_VALIDATION_CASES: readonly RuleOverride[] = Object.freeze([
  DESIGN_CASE_SECRET_REALM_EXP,
  DESIGN_CASE_SECT_HP_SUPPORT,
  DESIGN_CASE_INFANT_SHELTER,
]);

/**
 * 生产覆盖表：**本批故意为空**。
 * 空表 + 默认关闭 = 接线时行为零变化。
 * 覆盖要从真实来源（秘境 / 宗门 / 状态）动态生成，不该硬编码在这里。
 */
export const RULE_OVERRIDES: readonly RuleOverride[] = Object.freeze([]);

export const OVERRIDE_ENFORCEMENT_DEFAULT = false;
