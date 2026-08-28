// 统一查询入口 —— 把散落在一百多处 if 里的判定变成可查询的一等公民
//
// 这一层不做求值编排（那是 evaluate.ts 的事），只回答三个问题：
//   1. 某条规则此刻是否生效？          isRuleActive / queryRule().active
//   2. 它被谁覆盖？                    queryRule().overriddenBy[]
//   3. 覆盖条件是什么？                overriddenBy[].conditionText（DSL → 汉文）
//
// 刻意的取舍：查询接口收 **规则 id 字符串** 是为了可外部化（日志、面板、prompt），
// 但接线调用点应当拿 **规则对象**（如 UI_SLOT_RULES.category）而不是手写 id ——
// id 写错时查不到规则，会静默退化成「无判词 = 全放行」，那是最坏的一种坏。
// 所以：queryRule 找不到规则时显式返回 found:false，调用方必须自己处理。

import { META_RULES, META_RULE_ENFORCEMENT } from './meta-rules';
import { HARD_RULES, OVERRIDABLE_HARD_RULE_IDS } from './hard-rules';
import { UI_SLOT_HARD_RULES } from './ui-slot-rules';
import { SOFT_RULES } from './soft-rules';
import { RULE_OVERRIDES, resolveOverrides, computeEffectiveBounds } from './overrides';
import { FALLBACK_RULES } from './fallback-rules';
import { describeCondition, collectConditionVars } from './condition';
import { ALL_HARD_RULES } from './evaluate';
import { RULE_LAYER_LABEL, FALLBACK_STRATEGY_DISPOSITION } from './types';
import type {
  RuleContext,
  RuleDisposition,
  RuleLayer,
  RuleOverride,
  OverrideMode,
  OverrideScope,
} from './types';

// ==================== 规则概览 ====================

export interface RuleSummary {
  ruleId: string;
  layer: RuleLayer;
  /** 层名（汉文） */
  layerLabel: string;
  description: string;
  /** 该规则命中时的处置态 */
  disposition: RuleDisposition;
  code: string;
  field?: string;
  /** 可否被第三层覆盖 */
  overridable: boolean;
}

function summarize(): RuleSummary[] {
  const out: RuleSummary[] = [];
  for (const r of META_RULES) {
    out.push({
      ruleId: r.id,
      layer: 0,
      layerLabel: RULE_LAYER_LABEL[0],
      description: r.description,
      disposition: 'reject',
      code: r.code,
      overridable: false,
    });
  }
  for (const r of ALL_HARD_RULES) {
    out.push({
      ruleId: r.id,
      layer: 1,
      layerLabel: RULE_LAYER_LABEL[1],
      description: r.description,
      disposition: r.disposition,
      code: r.code,
      field: r.field,
      overridable: r.overridable,
    });
  }
  for (const r of SOFT_RULES) {
    out.push({
      ruleId: r.id,
      layer: 2,
      layerLabel: RULE_LAYER_LABEL[2],
      description: r.description,
      // 软规则本身不改数据，最重只标记审查
      disposition: 'flag_review',
      code: r.code,
      field: r.field,
      overridable: false,
    });
  }
  for (const r of RULE_OVERRIDES) {
    out.push({
      ruleId: r.id,
      layer: 3,
      layerLabel: RULE_LAYER_LABEL[3],
      description: r.description,
      disposition: 'inject_context',
      code: r.code,
      overridable: false,
    });
  }
  for (const r of FALLBACK_RULES) {
    out.push({
      ruleId: r.id,
      layer: 4,
      layerLabel: RULE_LAYER_LABEL[4],
      description: r.description,
      disposition: FALLBACK_STRATEGY_DISPOSITION[r.strategy],
      code: r.code,
      overridable: false,
    });
  }
  return out;
}

/** 全部规则的扁平索引（五层合一） */
export const RULE_INDEX: readonly RuleSummary[] = Object.freeze(summarize());

const RULE_INDEX_BY_ID: ReadonlyMap<string, RuleSummary> = new Map(
  RULE_INDEX.map((s) => [s.ruleId, s] as const),
);

/** 按层列规则；不给层号则全列 */
export function listRules(layer?: RuleLayer): RuleSummary[] {
  return layer === undefined ? RULE_INDEX.slice() : RULE_INDEX.filter((s) => s.layer === layer);
}

/** 某个 id 是否已在册（第四层判「未定义」时也用得上同一份口径） */
export function hasRule(ruleId: string): boolean {
  return RULE_INDEX_BY_ID.has(ruleId);
}

/** 取概览，不含上下文判定 */
export function getRuleSummary(ruleId: string): RuleSummary | undefined {
  return RULE_INDEX_BY_ID.get(ruleId);
}

// ==================== 覆盖情形 ====================

export interface OverrideInfo {
  overrideId: string;
  targetRuleId: string;
  mode: OverrideMode;
  scope: OverrideScope;
  scopeRefId?: string;
  description: string;
  /** DSL 条件渲染成的汉文 —— 回答「覆盖条件是什么」 */
  conditionText: string;
  /** 条件里读了哪些上下文字段（诊断「为什么没生效」） */
  conditionVars: string[];
  /** 此刻是否生效 */
  active: boolean;
  inactiveReason?: string;
  /** 告知生成侧的一句话 */
  playerFacing: string;
  expiresAtAge?: number;
}

function overrideInfos(
  ruleId: string,
  overrides: readonly RuleOverride[],
  ctx: RuleContext,
): OverrideInfo[] {
  const targeted = overrides.filter((o) => o.targetRuleId === ruleId);
  return resolveOverrides(targeted, ctx).map((r) => ({
    overrideId: r.override.id,
    targetRuleId: r.override.targetRuleId,
    mode: r.override.mode,
    scope: r.override.scope,
    scopeRefId: r.override.scopeRefId,
    description: r.override.description,
    conditionText: describeCondition(r.override.condition),
    conditionVars: collectConditionVars(r.override.condition),
    active: r.active,
    inactiveReason: r.inactiveReason,
    playerFacing: r.override.playerFacing,
    expiresAtAge: r.override.expiresAtAge,
  }));
}

/**
 * 「被谁覆盖」的直接问法。
 * 只返回**此刻生效**的覆盖；要看全部（含已回落的）用 queryRule().overriddenBy。
 */
export function whoOverrides(
  ruleId: string,
  ctx: RuleContext = {},
  overrides?: readonly RuleOverride[],
): OverrideInfo[] {
  const stack = overrides || (Array.isArray(ctx.overrides) ? ctx.overrides : RULE_OVERRIDES);
  return overrideInfos(ruleId, stack, ctx).filter((o) => o.active);
}

// ==================== 单条规则查询 ====================

export interface RuleQueryResult {
  /** 规则是否在册。false 时其余字段无意义 —— 调用方必须先看这个 */
  found: boolean;
  ruleId: string;
  layer?: RuleLayer;
  layerLabel?: string;
  description?: string;
  code?: string;
  field?: string;
  disposition?: RuleDisposition;
  overridable?: boolean;
  /**
   * 此刻是否生效。
   * 语义：这条规则现在是否参与裁决。被 suspend 覆盖 → false；
   * 被 shift_bounds / counter_force 覆盖 → 仍为 true（**覆盖不是让规则消失**，
   * 它只是改了基准；反重力装置不让引力失效）。
   */
  active?: boolean;
  /** 不生效的原因（当前只有 suspended 一种） */
  inactiveReason?: string;
  /** 全部指向本规则的覆盖（含已回落的，附不生效原因） */
  overriddenBy: OverrideInfo[];
  /** bounds 类专用：基准区间 */
  baseBounds?: { min: number; max: number };
  /** bounds 类专用：叠加覆盖后的有效区间；ctx 变化后自动回落到基准 */
  effectiveBounds?: { min: number; max: number };
  /** bounds 类专用：累加后的反向量（counter_force 的落点） */
  counterForce?: number;
  /** whitelist 类专用：册内取值（保持注册顺序） */
  allowedValues?: string[];
  /** 第零层专用：该基石此刻是否已开闸执行 */
  metaEnforced?: boolean;
}

/**
 * 单条规则的完整查询。这是「一百多处硬编码 if」应当迁向的入口。
 *
 * ctx 不给时按空上下文算：覆盖一律不生效，返回的就是全局默认值 ——
 * 这正是第一层的定义（全局默认，局部可覆盖）。
 */
export function queryRule(
  ruleId: string,
  ctx: RuleContext = {},
  overrides?: readonly RuleOverride[],
): RuleQueryResult {
  const summary = RULE_INDEX_BY_ID.get(ruleId);
  if (!summary) {
    return { found: false, ruleId, overriddenBy: [] };
  }
  const stack = overrides || (Array.isArray(ctx.overrides) ? ctx.overrides : RULE_OVERRIDES);
  const infos = overrideInfos(ruleId, stack, ctx);

  const result: RuleQueryResult = {
    found: true,
    ruleId,
    layer: summary.layer,
    layerLabel: summary.layerLabel,
    description: summary.description,
    code: summary.code,
    field: summary.field,
    disposition: summary.disposition,
    overridable: summary.overridable,
    active: true,
    overriddenBy: infos,
  };

  // 被生效中的 suspend 覆盖 → 本轮不参与裁决（但规则对象仍在栈里，条件失效即恢复）
  const suspendedBy = infos.find((o) => o.active && o.mode === 'suspend');
  if (suspendedBy) {
    result.active = false;
    result.inactiveReason = 'suspended_by:' + suspendedBy.overrideId;
  }

  if (summary.layer === 0) {
    const meta = META_RULES.find((m) => m.id === ruleId);
    if (meta) result.metaEnforced = META_RULE_ENFORCEMENT[meta.kind] === true;
  }

  if (summary.layer === 1) {
    const hard = ALL_HARD_RULES.find((h) => h.id === ruleId);
    if (hard) {
      if (hard.allowed) result.allowedValues = Array.from(hard.allowed);
      if (hard.kind === 'bounds') {
        const eff = computeEffectiveBounds(ruleId, stack, ctx);
        result.baseBounds = eff.base;
        result.effectiveBounds = eff.effective;
        result.counterForce = eff.counterForce;
        if (eff.suspended) {
          result.active = false;
          result.inactiveReason = result.inactiveReason || 'suspended';
        }
      }
    }
  }

  return result;
}

/** 「某条规则当前是否生效」的最短问法。不在册 → false（宁可当不生效也不假装在册） */
export function isRuleActive(ruleId: string, ctx: RuleContext = {}): boolean {
  const q = queryRule(ruleId, ctx);
  return q.found && q.active === true;
}

/** 某条第一层规则可否被覆盖（复用 hard-rules 已算好的集合，避免两处口径） */
export function isOverridable(ruleId: string): boolean {
  if (OVERRIDABLE_HARD_RULE_IDS.has(ruleId)) return true;
  const s = RULE_INDEX_BY_ID.get(ruleId);
  return s ? s.overridable : false;
}

/**
 * 汉文解释一条规则此刻的处境。给日志和调试面板用（内部诊断文案，不进玩家视野）。
 */
export function explainRule(ruleId: string, ctx: RuleContext = {}): string {
  const q = queryRule(ruleId, ctx);
  if (!q.found) return `规则 ${ruleId} 不在册`;
  const parts: string[] = [`[${q.layerLabel}] ${ruleId}：${q.description}`];
  parts.push(q.active ? '此刻参与裁决' : `此刻不参与裁决（${q.inactiveReason}）`);
  if (q.baseBounds) {
    const eff = q.effectiveBounds;
    const same = eff && eff.min === q.baseBounds.min && eff.max === q.baseBounds.max;
    parts.push(
      same
        ? `区间 ${q.baseBounds.min}~${q.baseBounds.max}（无覆盖）`
        : `基准 ${q.baseBounds.min}~${q.baseBounds.max}，有效 ${eff ? eff.min + '~' + eff.max : '同基准'}`,
    );
  }
  if (q.allowedValues && q.allowedValues.length > 0) {
    parts.push(`册内 ${q.allowedValues.length} 项`);
  }
  const active = q.overriddenBy.filter((o) => o.active);
  const lapsed = q.overriddenBy.filter((o) => !o.active);
  if (active.length > 0) {
    parts.push(
      '生效覆盖：' +
        active.map((o) => `${o.overrideId}(${o.mode}，条件 ${o.conditionText})`).join('；'),
    );
  }
  if (lapsed.length > 0) {
    parts.push(
      '已回落覆盖：' + lapsed.map((o) => `${o.overrideId}(${o.inactiveReason})`).join('；'),
    );
  }
  if (active.length === 0 && lapsed.length === 0) parts.push('无覆盖指向本规则');
  return parts.join('｜');
}

// ==================== 严重度适配器（两只，故意不合并） ====================
//
// 全仓有两套 severity 拼写，各自内部自洽：
//   'warning'  ← ai-boundary-validator / content-registry / effect-resolver
//   'warn'     ← engine/validation.ts 的 validateCrossSystemContinuity
// 合并成一只共用映射看着更「干净」，但那会把两套拼写悄悄拉到一起，
// 哪天有人改了共用映射就同时打歪两条通路。所以这里给两只同名不同拼的函数，
// 各自写死自己的字面量 —— 拼写分裂留在类型里显式可见，比藏进一只函数里安全。

/** 给 boundary / registry / effect 三条通路用（拼写 'warning'） */
export function dispositionToBoundarySeverity(
  disposition: RuleDisposition,
): 'info' | 'warning' | 'error' {
  switch (disposition) {
    case 'reject':
      return 'error';
    case 'clamp':
    case 'strip':
    case 'flag_review':
    case 'defer':
      return 'warning';
    case 'inject_context':
    case 'accept':
    default:
      return 'info';
  }
}

/** 只给 validateCrossSystemContinuity 用（拼写 'warn'） */
export function dispositionToContinuitySeverity(
  disposition: RuleDisposition,
): 'info' | 'warn' | 'error' {
  switch (disposition) {
    case 'reject':
      return 'error';
    case 'clamp':
    case 'strip':
    case 'flag_review':
    case 'defer':
      return 'warn';
    case 'inject_context':
    case 'accept':
    default:
      return 'info';
  }
}

// 便于查询侧直接拿到白名单判词，不必再 import 一次 whitelist 模块
export { checkWhitelist, isWhitelisted, listAllowedValues } from './whitelist';
export { describeCondition, collectConditionVars } from './condition';
