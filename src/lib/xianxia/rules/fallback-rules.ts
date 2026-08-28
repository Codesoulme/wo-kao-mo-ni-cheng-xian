// 第四层：未定义兜底（AI 产出了规则体系里没定义的东西时怎么办）
//
// 前三层回答的都是「已定义的事该怎么处置」。第四层回答的是另一个问题：
// **遇到规则表里根本没有的东西该怎么办**。这类情形在 AI 驱动的世界里是常态而非例外 ——
// 生成侧随时会造出一个前所未见的概念、一条前所未见的规矩、一个指向虚无的引用。
//
// 三条策略（都必须能表达，不能只挑一条实现）：
//   escalate       向上求助     本层不认识 → 交给更高层（基石 / 引擎 / 人）
//   allow_then_fix 默认允许+事后修正  本轮照旧放行，只落一条待修正记录
//   mark_pending   标记待裁决   本轮悬置，去处待定
//
// 三者的区别不在「记不记」，而在**本轮放不放行**与**谁来接手**：
//   allow_then_fix 放行（allowedProvisionally=true），接手方是下一轮的自己
//   escalate       不放行，接手方在 escalateTo 里明确指名
//   mark_pending   不放行，接手方未定 —— 这是最诚实的一种：不知道就是不知道
//
// 为什么不做成「统统 reject」：因为未定义 ≠ 违规。规则表没写到的事，多数是世界
// 长出了新枝，而不是世界坏了。第零层才是唯一敢 reject 的层。
//
// 兜底判定的共同风格（沿用 meta-rules.ts 的既有写法）：
// **世界侧没提供判断依据时一律不命中** —— 宁放行不误伤。

import { compileCondition } from './condition';
import { META_RULES } from './meta-rules';
import { HARD_RULES } from './hard-rules';
import { SOFT_RULES } from './soft-rules';
import { UI_SLOT_HARD_RULES } from './ui-slot-rules';
import type {
  FallbackRule,
  DeferredDecision,
  RuleContext,
  FallbackStrategy,
} from './types';
import { FALLBACK_STRATEGY_DISPOSITION } from './types';

// ==================== 已定义空间（「未定义」是相对它而言的） ====================

/**
 * 规则体系当前认识的全部规则 id。
 * 第四层的「未定义」定义域就是它的补集 —— 所以这个集合必须是全的，
 * 少收一张表就会把已定义的东西误判成未定义。
 */
export const DEFINED_RULE_IDS: ReadonlySet<string> = new Set<string>([
  ...META_RULES.map((r) => r.id),
  ...HARD_RULES.map((r) => r.id),
  ...UI_SLOT_HARD_RULES.map((r) => r.id),
  ...SOFT_RULES.map((r) => r.id),
]);

/**
 * AIEventOutput 的顶层字段全集（对 types/event.ts:374 的 AIEventOutput 逐字段抓取）。
 * 用途：算出生成侧输出里「谁都没管过」的字段。
 *
 * 维护约定：上游 AIEventOutput 增字段时这里补一行。漏补的后果是把新字段误报成
 * 未定义 —— 而 allow_then_fix 的处置是放行 + 记录，所以漏补不会伤到玩家，只会多一条记录。
 */
export const KNOWN_OUTPUT_TOP_FIELDS: ReadonlySet<string> = new Set<string>([
  'title', 'narrative', 'eventType', 'changes', 'spiritualRootChange',
  'newStatuses', 'newItems', 'removedItemIds', 'newEquippedItems', 'equipItemIds',
  'unequipItemIds', 'memory', 'cultivationInsight', 'cultivationAttributes',
  'timeAdvance', 'actionProjections', 'hasChoice', 'choice', 'triggeredBreakthrough',
  'breakthroughReason', 'breakthroughTargetLevel', 'breakthroughTargetRealm',
  'realmProfilePatch', 'extraEvents', 'causedDeath', 'deathReason', 'causedAscension',
  'newNpcs', 'causalSummary', 'newThreads', 'advanceThreads', 'completeThreadIds',
  'failThreadIds', 'triggerCombat', 'narrativeContract', 'newPets', 'isFallbackGenerated',
]);

/**
 * 找出生成侧输出里既不在 AIEventOutput 已知字段中、也不被任何规则 field 覆盖的顶层键。
 *
 * 这是给**接线期适配器**用的工具，不是规则谓词本身 —— 规则谓词只读 ctx.undefinedFields，
 * 由适配器决定要不要算这一步。理由：算这一步要遍历整个 output，
 * 不该在每条规则求值时都做一遍。
 */
export function findUncoveredOutputFields(output: unknown): string[] {
  if (!output || typeof output !== 'object') return [];
  const covered = new Set<string>(KNOWN_OUTPUT_TOP_FIELDS);
  // 规则 field 形如 'changes.spiritStones' / 'newItems.item_type'，取首段
  for (const r of [...HARD_RULES, ...UI_SLOT_HARD_RULES]) {
    if (r.field) covered.add(String(r.field).split('.')[0]);
  }
  for (const r of SOFT_RULES) {
    if (r.field) covered.add(String(r.field).split('.')[0]);
  }
  const out: string[] = [];
  for (const key of Object.keys(output as Record<string, unknown>)) {
    // 双下划线前缀是内部搬运字段（既有代码里的惯例），不算生成侧产出
    if (key.startsWith('__')) continue;
    if (!covered.has(key)) out.push(key);
  }
  return out;
}

// ---------- 取值助手（与 meta-rules / soft-rules 同一写法） ----------

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** 生成侧提交的规则注册意图（含覆盖注册），两处字段合并看 */
function registrationAttempts(ctx: RuleContext): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of [
    ...asArray(pick(ctx, 'output.ruleRegistrations')),
    ...asArray(pick(ctx, 'output.overrideRegistrations')),
  ]) {
    const rec = asRecord(raw);
    if (rec) out.push(rec);
  }
  return out;
}

// ==================== 策略一：向上求助（escalate） ====================

/**
 * 生成侧给出的生效条件根本解析不了（未注册 op / arity 不符 / 结构不成立）。
 *
 * 这是**唯一必须 escalate 的情形**：条件编译不过，本层连「这条规矩说的是什么」
 * 都不知道，谈不上判它对错。交回第零层 —— 基石不需要理解条件也能判
 * 「动没动到不可移之物」。
 *
 * 判定用的是 rules-dsl 的 parseDSL（经 condition.ts 包装），不是自写的校验。
 */
const malformedConditionRule: FallbackRule = {
  id: 'fallback.escalate.malformed_rule_condition',
  layer: 4,
  description: '生成侧提出的规矩带着无法解析的生效条件，本层无从判断，交回基石',
  strategy: 'escalate',
  escalateTo: 'meta',
  code: 'invalid_effect',
  playerFacing: '此中法度含混不清，一时论不出个是非。',
  matches: (ctx) => {
    const attempts = registrationAttempts(ctx);
    if (attempts.length === 0) return false;
    return attempts.some((a) => {
      // 没带 condition 的另有规则管（覆盖注册闸门），这里只管带了但解析不了的
      if (a.condition === undefined || a.condition === null) return false;
      return !compileCondition(a.condition).ok;
    });
  },
};

/**
 * 覆盖指向的规则不在规则表里。
 *
 * 与上一条的分工：上一条是「话说得不通」，这一条是「话说得通但指的东西不存在」。
 * 去处是 engine 而非 meta —— 因为既有引擎（effect-resolver / content-registry）
 * 仍是结算的最终权威，它认识的字段比规则表多；规则表不认识不等于世界不认识。
 */
const unknownTargetRule: FallbackRule = {
  id: 'fallback.escalate.override_target_unknown',
  layer: 4,
  description: '覆盖所指之规不在规则表内，转交引擎既有权威裁断',
  strategy: 'escalate',
  escalateTo: 'engine',
  code: 'invalid_type',
  playerFacing: '所据之规无处可寻，此事另有主张。',
  matches: (ctx) => {
    const attempts = registrationAttempts(ctx);
    if (attempts.length === 0) return false;
    return attempts.some((a) => {
      const target = a.targetRuleId;
      if (typeof target !== 'string' || target.length === 0) return false;
      return !DEFINED_RULE_IDS.has(target);
    });
  },
};

// ==================== 策略二：默认允许 + 事后修正（allow_then_fix） ====================

/**
 * 输出里出现了规则表与 AIEventOutput 都没管过的顶层字段。
 *
 * 为什么是「默认允许」而不是「剥离」：这类字段的典型来源是生成侧长出了一个新概念。
 * 剥离等于把世界的新枝剪掉，而世界长新枝正是这个项目的目的。
 * 所以本轮放行（allowedProvisionally=true），只把它记下来 —— 记下来的用处是
 * 下一批能据此决定：给它建一条规则，还是确认它是噪声。
 *
 * ctx.undefinedFields 由接线期适配器用 findUncoveredOutputFields 算好塞进来；
 * 没塞就不判（宁放行不误伤）。
 */
const undeclaredFieldRule: FallbackRule = {
  id: 'fallback.allow_then_fix.undeclared_output_field',
  layer: 4,
  description: '生成侧输出了规则表未覆盖的字段：本轮照旧放行，记下来待事后建规',
  strategy: 'allow_then_fix',
  code: 'field_normalized',
  fixHint: '取 DeferredDecision.field 里的键名，判定是建一条硬规则还是确认为噪声',
  matches: (ctx) => {
    const fields = asArray(ctx.undefinedFields).filter((f) => typeof f === 'string' && f.length > 0);
    return fields.length > 0;
  },
};

// ==================== 策略三：标记待裁决（mark_pending） ====================

/**
 * 生成侧提出了一条形制完好的新规矩（不动基石、条件能解析、目标存在）。
 *
 * 这一条与第零层的分工要说清：
 *   第零层 evolvability 拦的是「试图注册 immutable / layer 0」—— 那是动基石，reject。
 *   第零层 cost 管的是「改法度要付代价」—— 那是要价。
 *   第四层这一条管的是**中间地带**：既没动基石也不缺代价，纯粹是「这条新规矩要不要收」。
 *
 * 这个问题规则体系答不了，因为答它需要的是取向而非推理。所以是 mark_pending
 * 而非 escalate —— 连该问谁都还没定。
 */
const newRuleProposalRule: FallbackRule = {
  id: 'fallback.mark_pending.new_rule_proposal',
  layer: 4,
  description: '生成侧提出形制完好的新规矩，收与不收待裁',
  strategy: 'mark_pending',
  code: 'invalid_category',
  playerFacing: '此例前所未有，暂且悬着。',
  matches: (ctx) => {
    const attempts = registrationAttempts(ctx);
    if (attempts.length === 0) return false;
    return attempts.some((a) => {
      // 动基石的交第零层，不在这一层挂起
      if (Number(a.layer) === 0 || a.immutable === true) return false;
      // 条件解析不了的走 escalate，不在这一层挂起
      if (a.condition !== undefined && a.condition !== null && !compileCondition(a.condition).ok) {
        return false;
      }
      // 指向不存在之规的走 escalate
      const target = a.targetRuleId;
      if (typeof target === 'string' && target.length > 0 && !DEFINED_RULE_IDS.has(target)) {
        return false;
      }
      return true;
    });
  },
};

/**
 * 引用了任何已知系统里都找不到的实体。
 *
 * ctx.unresolvedRefs 的形状故意对齐 engine/validation.ts 的 findBrokenCrossRefs 返回值
 * （[{ refId, expectedSystem, actualSystem }]）—— 那个函数已经在算这件事了，
 * 第四层不重算，只接它的结果。
 *
 * 为什么不 escalate：因为「这个 id 指的是谁」没有更高层知道。
 * 挂起是唯一诚实的处置。
 */
const unresolvedRefRule: FallbackRule = {
  id: 'fallback.mark_pending.unresolved_reference',
  layer: 4,
  description: '所引之物在各系统中皆无处对应，悬置待裁',
  strategy: 'mark_pending',
  code: 'missing_id',
  playerFacing: '所提之人事一时寻不着来处。',
  matches: (ctx) => {
    const refs = asArray(ctx.unresolvedRefs);
    if (refs.length === 0) return false;
    return refs.some((raw) => {
      if (typeof raw === 'string') return raw.length > 0;
      const rec = asRecord(raw);
      return Boolean(rec && typeof rec.refId === 'string' && rec.refId.length > 0);
    });
  },
};

// ==================== 表 ====================

export const FALLBACK_RULES: readonly FallbackRule[] = Object.freeze([
  malformedConditionRule,
  unknownTargetRule,
  undeclaredFieldRule,
  newRuleProposalRule,
  unresolvedRefRule,
]);

export function getFallbackRule(id: string): FallbackRule | undefined {
  return FALLBACK_RULES.find((r) => r.id === id);
}

/** 按策略取兜底规则（三条策略各自是否有实现，一眼可查） */
export function getFallbackRulesByStrategy(strategy: FallbackStrategy): FallbackRule[] {
  return FALLBACK_RULES.filter((r) => r.strategy === strategy);
}

// ==================== 悬置项生成 ====================

/** 悬置 id 确定性生成：不用 Math.random，否则影子比对两轮对不上 */
function deferredId(ruleId: string, age: number | undefined, seq: number): string {
  const agePart = typeof age === 'number' && Number.isFinite(age) ? String(age) : 'na';
  return `defer.${ruleId}.${agePart}.${seq}`;
}

/** 命中时的诊断文案：把「哪些字段/哪些引用」带出来，否则记录了也没法修 */
function detailFor(rule: FallbackRule, ctx: RuleContext): { message: string; field?: string } {
  if (rule.id === undeclaredFieldRule.id) {
    const fields = asArray(ctx.undefinedFields)
      .filter((f): f is string => typeof f === 'string' && f.length > 0);
    return {
      message: `${rule.description}：${fields.join(' / ')}`,
      field: fields[0],
    };
  }
  if (rule.id === unresolvedRefRule.id) {
    const ids = asArray(ctx.unresolvedRefs)
      .map((raw) => {
        if (typeof raw === 'string') return raw;
        const rec = asRecord(raw);
        return rec && typeof rec.refId === 'string' ? rec.refId : '';
      })
      .filter((s) => s.length > 0);
    return { message: `${rule.description}：${ids.join(' / ')}` };
  }
  return { message: rule.description };
}

/**
 * 求值第四层，产出悬置项。
 *
 * 注意 allowedProvisionally 的取值来源是**策略本身**（FALLBACK_STRATEGY_DISPOSITION
 * 里 allow_then_fix 映射到 flag_review = 放行 + 标记），不是逐条自定 ——
 * 否则第四层会退化成第二个软规则层。
 */
export function resolveFallbacks(
  ctx: RuleContext,
  rules: readonly FallbackRule[] = FALLBACK_RULES,
): DeferredDecision[] {
  const out: DeferredDecision[] = [];
  let seq = 0;
  const age = typeof ctx.age === 'number' ? ctx.age : Number(pick(ctx, 'character.age'));
  const safeAge = Number.isFinite(age) ? age : undefined;
  for (const rule of rules) {
    let hit = false;
    try {
      hit = rule.matches(ctx);
    } catch {
      // 兜底规则自己出错时不再兜底（否则递归无底），当未命中处理
      hit = false;
    }
    if (!hit) continue;
    seq += 1;
    const detail = detailFor(rule, ctx);
    out.push({
      id: deferredId(rule.id, safeAge, seq),
      ruleId: rule.id,
      strategy: rule.strategy,
      code: rule.code,
      message: detail.message,
      field: detail.field,
      age: safeAge,
      allowedProvisionally: FALLBACK_STRATEGY_DISPOSITION[rule.strategy] === 'flag_review',
      escalateTo: rule.escalateTo,
      fixHint: rule.fixHint,
      playerFacing: rule.playerFacing,
    });
  }
  return out;
}

/**
 * 第四层默认不执行。
 * 即便打开，最重的处置也只是 defer（本轮悬置那一条判定，不阻断整个事件）——
 * 第四层没有 reject 的权限，那是第零层独有的。
 */
export const FALLBACK_ENFORCEMENT_DEFAULT = false;
