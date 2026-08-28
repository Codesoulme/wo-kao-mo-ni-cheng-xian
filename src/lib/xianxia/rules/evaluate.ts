// 五层求值器 —— 把五张表按层序跑一遍，产出一份 RuleEvaluation
//
// 层序不是随意排的，它对应「谁有权否决谁」：
//   0 基石     先跑。基石不成立时后面几层的判词都没有意义
//   1 硬规则   跑在覆盖之前算出基准，再由第三层给出有效值
//   2 软规则   概率通道；roll 不中就当没事发生
//   3 覆盖     只出 inject_context —— 覆盖从不改数据，它只改「基准是多少」
//   4 兜底     最后跑。前四层都没接住的，才轮到它
//
// 处置合并取最强（DISPOSITION_SEVERITY），但 **blocked 只认第零层**：
// 唯一的真阻断信号是基石被违反，其余层最重也只是 defer。
//
// 默认全层不执行（enforce=false / enforced=false）。所以本求值器现在跑一万遍，
// 对游戏行为的影响仍然是零 —— 它产出判词，不落判决。

import { META_RULES, META_RULE_ENFORCEMENT } from './meta-rules';
import { HARD_RULES } from './hard-rules';
import { UI_SLOT_HARD_RULES } from './ui-slot-rules';
import { SOFT_RULES } from './soft-rules';
import { RULE_OVERRIDES, resolveOverrides, computeEffectiveBounds } from './overrides';
import { FALLBACK_RULES, resolveFallbacks } from './fallback-rules';
import { anyConditionHolds, evalCondition } from './condition';
import { checkWhitelist } from './whitelist';
import { NARRATIVE_FEEDBACK_CODES } from './trace-codes';
import {
  DISPOSITION_SEVERITY,
  FALLBACK_STRATEGY_DISPOSITION,
} from './types';
import type {
  RuleContext,
  RuleEvaluateOptions,
  RuleEvaluation,
  RuleEvaluationFailure,
  RuleVerdict,
  RuleDisposition,
  RuleLayer,
  RuleRng,
  SoftRule,
  HardRule,
  RuleOverride,
} from './types';

/** 全部第一层规则（本体表 + UI 槽位词表） */
export const ALL_HARD_RULES: readonly HardRule[] = Object.freeze([
  ...HARD_RULES,
  ...UI_SLOT_HARD_RULES,
]);

const NARRATIVE_FEEDBACK_CODE_SET: ReadonlySet<string> = new Set<string>(NARRATIVE_FEEDBACK_CODES);

// ==================== 开关 ====================

/**
 * 某一层此刻要不要真执行。
 * 三档优先级：逐层开关 > 全局 enforce > 该层自己的默认值（全 false）。
 */
export function shouldEnforce(layer: RuleLayer, options?: RuleEvaluateOptions): boolean {
  const perLayer = options?.enforceLayers?.[layer];
  if (typeof perLayer === 'boolean') return perLayer;
  if (options?.enforce === true) {
    // 第零层还要再过一道 kind 级开关（META_RULE_ENFORCEMENT），在层内判
    return true;
  }
  return false;
}

function layerRequested(layer: RuleLayer, options?: RuleEvaluateOptions): boolean {
  const only = options?.onlyLayers;
  if (!only || only.length === 0) return true;
  return only.includes(layer);
}

// ==================== 取值助手 ====================

function pick(ctx: RuleContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function outputRecord(ctx: RuleContext): Record<string, unknown> {
  return ctx.output && typeof ctx.output === 'object' ? (ctx.output as Record<string, unknown>) : {};
}

/**
 * 按 field 路径从生成侧输出里取出待判的值。
 * field 形如 'newItems.item_type'（数组逐项取 item_type）或 'rarity'（直接取）。
 * 取不到就返回空数组 —— 无值可判即不判。
 */
function resolveFieldValues(field: string, ctx: RuleContext): unknown[] {
  const out = outputRecord(ctx);
  const dot = field.indexOf('.');
  if (dot < 0) {
    const v = out[field];
    return v === undefined ? [] : [v];
  }
  const head = field.slice(0, dot);
  const tail = field.slice(dot + 1);
  const container = out[head];
  if (Array.isArray(container)) {
    const values: unknown[] = [];
    for (const item of container) {
      if (item && typeof item === 'object') {
        const v = (item as Record<string, unknown>)[tail];
        if (v !== undefined) values.push(v);
      }
    }
    return values;
  }
  if (container && typeof container === 'object') {
    const v = (container as Record<string, unknown>)[tail];
    return v === undefined ? [] : [v];
  }
  return [];
}

// ==================== 第零层 ====================

function evaluateMetaLayer(
  ctx: RuleContext,
  options: RuleEvaluateOptions | undefined,
  failures: RuleEvaluationFailure[],
): RuleVerdict[] {
  const verdicts: RuleVerdict[] = [];
  for (const rule of META_RULES) {
    let violated = false;
    try {
      violated = rule.violates(ctx);
    } catch (e) {
      failures.push({
        ruleId: rule.id,
        layer: 0,
        reason: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    if (!violated) continue;
    // 第零层比其它层多一道 kind 级开关：基石是逐条开闸的
    const enforced = shouldEnforce(0, options) && META_RULE_ENFORCEMENT[rule.kind] === true;
    verdicts.push({
      ruleId: rule.id,
      layer: 0,
      disposition: 'reject',
      code: rule.code,
      message: rule.description,
      playerFacing: rule.playerFacing,
      enforced,
    });
  }
  return verdicts;
}

// ==================== 第一层 ====================

function evaluateHardLayer(
  ctx: RuleContext,
  overrides: readonly RuleOverride[],
  options: RuleEvaluateOptions | undefined,
  failures: RuleEvaluationFailure[],
): RuleVerdict[] {
  const verdicts: RuleVerdict[] = [];
  const enforced = shouldEnforce(1, options);
  const character = ctx.character && typeof ctx.character === 'object'
    ? (ctx.character as Record<string, unknown>)
    : {};

  for (const rule of ALL_HARD_RULES) {
    try {
      if (rule.kind === 'invariant') {
        if (rule.violates && rule.violates(ctx)) {
          verdicts.push({
            ruleId: rule.id,
            layer: 1,
            disposition: rule.disposition,
            code: rule.code,
            message: rule.description,
            field: rule.field,
            enforced,
          });
        }
        continue;
      }

      if (rule.kind === 'whitelist') {
        for (const value of resolveFieldValues(rule.field, ctx)) {
          const verdict = checkWhitelist(rule, value);
          if (verdict) verdicts.push({ ...verdict, enforced });
        }
        continue;
      }

      // kind === 'bounds'：field 形如 'changes.<attr>'
      if (!rule.field.startsWith('changes.')) continue;
      const attr = rule.field.slice('changes.'.length);
      const changes = outputRecord(ctx).changes;
      if (!Array.isArray(changes)) continue;
      // 有效区间 = 基准 + 生效中的覆盖（离开秘境即自动回落，见 overrides.ts）
      const eff = computeEffectiveBounds(rule.id, overrides, ctx);
      const bounds = eff.effective || rule.bounds;
      if (!bounds || eff.suspended) continue;
      for (const raw of changes) {
        if (!raw || typeof raw !== 'object') continue;
        const c = raw as Record<string, unknown>;
        if (String(c.attribute) !== attr) continue;
        const delta = Number(c.delta);
        if (!Number.isFinite(delta)) continue;
        const base = Number(character[attr]);
        const projected = (Number.isFinite(base) ? base : 0) + delta + eff.counterForce;
        if (projected >= bounds.min && projected <= bounds.max) continue;
        const clamped = Math.min(bounds.max, Math.max(bounds.min, projected));
        verdicts.push({
          ruleId: rule.id,
          layer: 1,
          disposition: rule.disposition,
          code: rule.code,
          message: `${attr} 推算至 ${projected}，越出 ${bounds.min}~${bounds.max}`,
          field: rule.field,
          before: projected,
          after: clamped,
          enforced,
          overriddenBy: eff.appliedOverrideIds[0],
        });
      }
    } catch (e) {
      failures.push({
        ruleId: rule.id,
        layer: 1,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return verdicts;
}

// ==================== 第二层 ====================

export type SoftRuleSkipReason =
  | 'delay_age'      // 未到认知门槛
  | 'exception'      // 例外成立（DSL 判定）
  | 'not_triggered'  // 没碰到这条规则
  | 'probability';   // 碰到了，但这次 roll 没中 —— 低概率越界是世界的常态

export interface SoftRuleOutcome {
  ruleId: string;
  /** 是否要标记审查 */
  flagged: boolean;
  skipReason?: SoftRuleSkipReason;
  /** 命中的例外说明（skipReason='exception' 时有） */
  exceptionDescription?: string;
  /** 本次 roll 值（可复现性：rng 由外部注入） */
  roll?: number;
  /** 概率通道判定用的阈值 */
  threshold: number;
}

/**
 * 求值一条软规则。四道闸门依次过：
 *   延迟生效 → 例外（走 rules-dsl 求值，不自写表达式引擎） → 命中判定 → 概率
 *
 * 例外的求值是这一层接 rules-dsl 的落点：SoftRuleException.when 是 DSLNode，
 * 由 condition.ts 的 anyConditionHolds → evalDSL 判真假。
 */
export function evaluateSoftRule(rule: SoftRule, ctx: RuleContext, rng: RuleRng): SoftRuleOutcome {
  const base: SoftRuleOutcome = { ruleId: rule.id, flagged: false, threshold: rule.reviewProbability };

  // 闸门一：社会规则有认知门槛，未到龄不追究
  if (typeof rule.delayAge === 'number') {
    const age = typeof ctx.age === 'number' ? ctx.age : Number(pick(ctx, 'character.age'));
    if (Number.isFinite(age) && age < rule.delayAge) {
      return { ...base, skipReason: 'delay_age' };
    }
  }

  // 闸门二：例外表。任一成立则整条跳过
  if (rule.exceptions && rule.exceptions.length > 0) {
    for (const exc of rule.exceptions) {
      const result = evalCondition(exc.when, ctx);
      if (result.holds) {
        return { ...base, skipReason: 'exception', exceptionDescription: exc.description };
      }
    }
  }

  // 闸门三：命中判定
  if (!rule.triggers(ctx)) {
    return { ...base, skipReason: 'not_triggered' };
  }

  // 闸门四：概率通道。roll < p 才标记 —— 允许低概率事件就这么发生
  const roll = rng();
  if (!(roll < rule.reviewProbability)) {
    return { ...base, skipReason: 'probability', roll };
  }
  return { ...base, flagged: true, roll };
}

function evaluateSoftLayer(
  ctx: RuleContext,
  options: RuleEvaluateOptions | undefined,
  failures: RuleEvaluationFailure[],
): { verdicts: RuleVerdict[]; injections: string[] } {
  const verdicts: RuleVerdict[] = [];
  const injections: string[] = [];
  const enforced = shouldEnforce(2, options);
  const rng = options?.rng || Math.random;

  for (const rule of SOFT_RULES) {
    try {
      const outcome = evaluateSoftRule(rule, ctx, rng);
      if (!outcome.flagged) continue;
      // 叙事契约那 9 码是全仓唯一已闭环的反馈通路（回灌下轮生成侧），
      // 所以它们升格为 inject_context；其余软规则只标记审查。
      const isFeedback = NARRATIVE_FEEDBACK_CODE_SET.has(rule.code);
      const disposition: RuleDisposition = isFeedback ? 'inject_context' : 'flag_review';
      verdicts.push({
        ruleId: rule.id,
        layer: 2,
        disposition,
        code: rule.code,
        message: rule.description,
        field: rule.field,
        playerFacing: rule.playerFacing,
        enforced,
      });
      if (isFeedback && rule.playerFacing) injections.push(rule.playerFacing);
    } catch (e) {
      failures.push({
        ruleId: rule.id,
        layer: 2,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { verdicts, injections };
}

// ==================== 第三层 ====================

function evaluateOverrideLayer(
  ctx: RuleContext,
  overrides: readonly RuleOverride[],
  options: RuleEvaluateOptions | undefined,
): { verdicts: RuleVerdict[]; injections: string[] } {
  const verdicts: RuleVerdict[] = [];
  const injections: string[] = [];
  const enforced = shouldEnforce(3, options);
  for (const resolution of resolveOverrides(overrides, ctx)) {
    if (!resolution.active) continue;
    const o = resolution.override;
    verdicts.push({
      ruleId: o.targetRuleId,
      layer: 3,
      // 覆盖从不改数据：它只告诉生成侧「此地规矩不同」
      disposition: 'inject_context',
      code: o.code,
      message: `${o.description}（覆盖 ${o.targetRuleId}，方式 ${o.mode}）`,
      enforced,
      overriddenBy: o.id,
      playerFacing: o.playerFacing,
    });
    if (o.playerFacing) injections.push(o.playerFacing);
  }
  return { verdicts, injections };
}

// ==================== 合并 ====================

/** 取最强处置。空判词集视为 accept */
export function mergeDispositions(verdicts: readonly RuleVerdict[]): RuleDisposition {
  let best: RuleDisposition = 'accept';
  for (const v of verdicts) {
    if (DISPOSITION_SEVERITY[v.disposition] > DISPOSITION_SEVERITY[best]) best = v.disposition;
  }
  return best;
}

// ==================== 总入口 ====================

/**
 * 跑完五层。
 *
 * ctx.overrides 没给时用生产覆盖表 RULE_OVERRIDES（当前故意为空）——
 * 空表 + 默认关闭 = 行为零变化。
 */
export function evaluateRules(ctx: RuleContext, options?: RuleEvaluateOptions): RuleEvaluation {
  const failures: RuleEvaluationFailure[] = [];
  const verdicts: RuleVerdict[] = [];
  const contextInjections: string[] = [];
  const overrides = Array.isArray(ctx.overrides) ? ctx.overrides : RULE_OVERRIDES;

  if (layerRequested(0, options)) {
    verdicts.push(...evaluateMetaLayer(ctx, options, failures));
  }
  if (layerRequested(1, options)) {
    verdicts.push(...evaluateHardLayer(ctx, overrides, options, failures));
  }
  if (layerRequested(2, options)) {
    const soft = evaluateSoftLayer(ctx, options, failures);
    verdicts.push(...soft.verdicts);
    contextInjections.push(...soft.injections);
  }
  if (layerRequested(3, options)) {
    const ov = evaluateOverrideLayer(ctx, overrides, options);
    verdicts.push(...ov.verdicts);
    contextInjections.push(...ov.injections);
  }

  const deferred = layerRequested(4, options) ? resolveFallbacks(ctx, FALLBACK_RULES) : [];
  if (deferred.length > 0) {
    const enforced = shouldEnforce(4, options);
    for (const d of deferred) {
      verdicts.push({
        ruleId: d.ruleId,
        layer: 4,
        disposition: FALLBACK_STRATEGY_DISPOSITION[d.strategy],
        code: d.code,
        message: d.message,
        field: d.field,
        playerFacing: d.playerFacing,
        enforced,
      });
    }
  }

  // blocked 只认第零层，且只认真执行了的那一条。
  // 这条判定是整个体系里唯一能让事件空转的开关，所以写得刻意保守。
  const blocked = verdicts.some((v) => v.layer === 0 && v.disposition === 'reject' && v.enforced);

  return {
    verdicts,
    disposition: mergeDispositions(verdicts),
    blocked,
    contextInjections,
    deferred,
    failures,
  };
}
