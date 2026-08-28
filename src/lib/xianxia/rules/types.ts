// 五层规则体系 —— 类型定义
//
// 设计来源：一份架构说明书主张规则按「可覆盖性」分五层。核心洞察是
// **覆盖而非违反**：反重力装置不是让引力失效，而是产生等大反向的力。
// 这个区分决定了引擎能否推导出「装置断电 → 重力立刻恢复」。
//
// 本仓语境下的对应关系：
//   第零层 元元规则   不可覆盖的基石；唯一敢 reject 的层
//   第一层 硬规则     确定性定律；全局默认值，可被第三层局部覆盖
//   第二层 软规则     概率性社会规则；带 probability / delay / exceptions
//   第三层 规则覆盖   局部有条件覆盖；condition 失效则原规则自动恢复
//   第四层 未定义兜底 向上求助 / 默认允许+事后修正 / 标记待裁决
//
// 本批只建不接线：所有 enforce 开关默认关闭、默认放行。

import type { DSLNode } from '../rules-dsl/ast';
import type { KnownTraceCode } from './trace-codes';

// ==================== 处置态 ====================

// 五（实为六）种处置态。现有代码这些行为**都已存在**，只是没有统一语义：
//   reject        ← content-registry.ts 的 reject()；effect-resolver 的 unknown_attribute
//   clamp         ← effect-resolver 的 value_clamped；engine/validation 的回落
//   strip         ← procInfantGuard 剥离 triggerCombat / hasChoice；empty_effect_removed
//   flag_review   ← 现在没有真通道（ai-boundary-validator 的 warning 落库即止）
//   inject_context← 现在只有 narrativeContract 一条闭环（回灌下轮生成侧）
//   defer         ← 现在没有；第四层新增
export type RuleDisposition =
  | 'accept'         // 放行，无痕
  | 'reject'         // 布尔拒绝（仅第零层敢用）
  | 'clamp'          // 数值钳到 bounds
  | 'strip'          // 剥离越界字段，其余放行
  | 'flag_review'    // 标记待审查，本轮仍放行
  | 'inject_context' // 不改数据，向生成侧注入一句约束
  | 'defer';         // 悬置待裁决（第四层）

/** 处置强度序（影响 mergeVerdicts 的取胜规则；数越大越强） */
export const DISPOSITION_SEVERITY: Readonly<Record<RuleDisposition, number>> = {
  accept: 0,
  inject_context: 1,
  flag_review: 2,
  clamp: 3,
  strip: 4,
  defer: 5,
  reject: 6,
};

export type RuleLayer = 0 | 1 | 2 | 3 | 4;

export const RULE_LAYER_LABEL: Readonly<Record<RuleLayer, string>> = {
  0: '元元规则',
  1: '硬规则',
  2: '软规则',
  3: '规则覆盖',
  4: '未定义兜底',
};

// ==================== 裁决结果 ====================

export interface RuleVerdict {
  /** 命中的规则 id */
  ruleId: string;
  layer: RuleLayer;
  disposition: RuleDisposition;
  /** 必须复用既有 trace code，不得发明新码 */
  code: KnownTraceCode;
  /** 内部诊断文案（可含机制词，永不进玩家视野） */
  message: string;
  /** 受影响字段路径，如 'changes.spiritStones' */
  field?: string;
  /** 受影响实体 id */
  refId?: string;
  /** clamp 专用：钳制前后 */
  before?: number;
  after?: number;
  /**
   * 玩家可见话术（简体中文，世界内的说法）。
   * 硬约束：不得出现 display.ts SANITIZE_STRIP_TERMS 里的机制词；
   * 第零层的拒绝话术要是「天道不许」而非「系统拒绝」。
   * 只有 reject / defer / flag_review 需要提供；其余留空。
   */
  playerFacing?: string;
  /** 该裁决是否真的改了数据。本批全部 false（只建不接线） */
  enforced: boolean;
  /** 第三层专用：这条裁决是被哪个覆盖改写的 */
  overriddenBy?: string;
}

export interface RuleEvaluation {
  verdicts: RuleVerdict[];
  /** 合并后的最终处置（取最强） */
  disposition: RuleDisposition;
  /** 是否有第零层拒绝（唯一真阻断信号） */
  blocked: boolean;
  /** 待注入生成侧的约束句（第三层 inject_context 汇总） */
  contextInjections: string[];
  /** 悬置待裁决项（第四层） */
  deferred: DeferredDecision[];
  /** 求值期异常（try/catch 兜住，失败不阻断） */
  failures: RuleEvaluationFailure[];
}

export interface RuleEvaluationFailure {
  ruleId: string;
  layer: RuleLayer;
  reason: string;
}

// ==================== 求值上下文 ====================

/**
 * 规则求值上下文。故意用宽松结构而不是直接吃 CharacterState，
 * 理由有二：
 *   1. 规则模块不该反向依赖引擎巨文件（会形成环）
 *   2. 影子比对期需要能手搓最小上下文喂进来做单元对照
 * 接线时由适配器把 CharacterState + AIEventOutput 摊平成这个形状。
 */
export interface RuleContext {
  /** 角色侧快照（摊平，供 DSL 的 var 'character.age' 取值） */
  character?: Record<string, unknown>;
  /** 生成侧输出快照 */
  output?: Record<string, unknown>;
  /** 世界侧快照 */
  world?: Record<string, unknown>;
  /** 当前岁数（第三层覆盖的过期判定要用） */
  age?: number;
  /** 当前所在地点 id（第三层 scope=location 要用） */
  locationId?: string;
  /** 当前秘境 id（realmProfilePatch 痼疾的主要来源） */
  secretRealmId?: string;
  /** 当前宗门 id */
  sectId?: string;
  /** 生效中的覆盖栈 */
  overrides?: RuleOverride[];
  /** 任意扩展位 */
  [key: string]: unknown;
}

/** 参数化 RNG。必须注入，否则 smoke 无法复现 */
export type RuleRng = () => number;

export interface RuleEvaluateOptions {
  /**
   * 是否真的执行处置。默认 false —— 本批只建不接线，
   * 且将来接线时先以 false 跑影子比对，比对通过才逐层开。
   */
  enforce?: boolean;
  /** 逐层开关（比全局 enforce 更细，用于分批接线） */
  enforceLayers?: Partial<Record<RuleLayer, boolean>>;
  /** 参数化 RNG，默认 Math.random */
  rng?: RuleRng;
  /** 只求值这些层（影子比对时逐层隔离） */
  onlyLayers?: RuleLayer[];
}

// ==================== 第零层：元元规则 ====================

/**
 * 四条基石，落到本项目语境：
 *   causality      因果律不可违反 → 接 engine/causality.ts 的 CausalNode/CausalEdge，
 *                  凡是「结果」必须能追到一个已存在的因节点
 *   conservation   能量守恒不可违反 → 灵石/物品的增减必须有 source 字段
 *   evolvability   规则体系允许演化 → 允许注册新规则，但禁止注册/覆盖 immutable 的
 *   cost           修改规则需要成本 → 接 karma.ts 的业力代价或修为消耗
 */
export type MetaRuleKind = 'causality' | 'conservation' | 'evolvability' | 'cost';

export interface MetaRule {
  id: string;
  layer: 0;
  kind: MetaRuleKind;
  /** 内部说明 */
  description: string;
  /** 恒为 true：第零层定义上就是不可覆盖 */
  immutable: true;
  /** 违反时的既有 trace code */
  code: KnownTraceCode;
  /** 世界内的拒绝话术（简体中文，无机制词） */
  playerFacing: string;
  /**
   * 谓词：返回 true 表示**违反**了这条基石。
   * 纯函数，不得改 ctx。异常由求值器 try/catch 兜住。
   */
  violates: (ctx: RuleContext) => boolean;
}

// ==================== 第一层：硬规则 ====================

export type HardRuleKind =
  | 'bounds'      // 数值区间（吸收 ATTRIBUTE_BOUNDS）
  | 'whitelist'   // 枚举白名单（吸收 content-registry 的 6 张表）
  | 'invariant';  // 结构不变式（如 hp<=maxHp）

export interface HardRule {
  id: string;
  layer: 1;
  kind: HardRuleKind;
  description: string;
  /** 硬规则的默认处置是 clamp / strip，**不是** reject */
  disposition: Extract<RuleDisposition, 'clamp' | 'strip' | 'reject'>;
  code: KnownTraceCode;
  /** 作用字段路径 */
  field: string;
  /** bounds 类专用 */
  bounds?: { min: number; max: number };
  /** whitelist 类专用 */
  allowed?: ReadonlySet<string>;
  /**
   * 可否被第三层覆盖。硬规则默认可覆盖（这正是「全局默认值」的含义），
   * 少数不可覆盖的（如 age 只能引擎推进）标 false。
   */
  overridable: boolean;
  /** invariant 类专用谓词：返回 true 表示违反 */
  violates?: (ctx: RuleContext) => boolean;
}

// ==================== 第二层：软规则 ====================

export interface SoftRuleException {
  /** 例外说明 */
  description: string;
  /** DSL 条件；成立则本条软规则不触发 */
  when: DSLNode;
}

export interface SoftRule {
  id: string;
  layer: 2;
  description: string;
  code: KnownTraceCode;
  field?: string;
  /**
   * 审查概率。语义：roll < reviewProbability 才标记审查，否则放行。
   * 这正是「允许低概率事件发生」—— 社会规则不是物理定律，
   * 偶尔的越界是世界的常态，不该一律拦。
   */
  reviewProbability: number;
  /** 延迟生效：多少岁之后这条软规则才起作用（社会规则有认知门槛） */
  delayAge?: number;
  /** 例外表；任一成立则跳过 */
  exceptions?: SoftRuleException[];
  /** 命中判定：返回 true 表示这条软规则被触碰 */
  triggers: (ctx: RuleContext) => boolean;
  /** 玩家可见提示（多数软规则不需要——它只标记审查，不改叙事） */
  playerFacing?: string;
}

// ==================== 第三层：规则覆盖 ====================

/**
 * 覆盖的作用域。realmProfilePatch 痼疾对应 'secret_realm' / 'sect'：
 * 秘境里给的境界加成，出了秘境就该没了。
 */
export type OverrideScope =
  | 'global'
  | 'location'
  | 'secret_realm'
  | 'sect'
  | 'status'      // 挂在某个 activeStatus 上，状态消失则覆盖消失
  | 'formation'   // 阵法域
  | 'tribulation';

/**
 * 覆盖的运算方式 —— **这是「覆盖而非违反」的落点**。
 *   counter_force  产生等大反向量（反重力装置的正解）；原规则仍在算
 *   shift_bounds   平移/放宽区间；原区间仍是基准
 *   replace_value  临时替换为新值；原值被记住
 *   suspend        暂停原规则；但原规则对象仍在栈里
 * 四者都保留原规则，condition 失效即自动回落。
 */
export type OverrideMode = 'counter_force' | 'shift_bounds' | 'replace_value' | 'suspend';

export interface RuleOverride {
  id: string;
  layer: 3;
  /** 被覆盖的第一层规则 id */
  targetRuleId: string;
  description: string;
  scope: OverrideScope;
  mode: OverrideMode;
  /** scope 的具体锚点：秘境 id / 宗门 id / 状态 id */
  scopeRefId?: string;
  /**
   * 生效条件。DSL 表达式，由 rules-dsl 的 evalDSL 求值。
   * **失效即自动回落** —— 覆盖不写死进 state，只在栈里带条件存在。
   */
  condition: DSLNode;
  /** counter_force / shift_bounds 专用：反向量或平移量 */
  magnitude?: number;
  /** replace_value 专用 */
  replacement?: number;
  /** 过期岁数；超过则视为条件失效 */
  expiresAtAge?: number;
  /**
   * 告知生成侧的一句话（简体中文，世界内说法）。
   * 覆盖层的默认处置是 inject_context：不改数据，只让生成侧知道
   * 「此地规矩不同」。
   */
  playerFacing: string;
  code: KnownTraceCode;
}

/** 覆盖求值结果：显式区分「仍生效」与「已回落」 */
export interface OverrideResolution {
  override: RuleOverride;
  active: boolean;
  /** 未生效的原因（过期 / 作用域不匹配 / 条件为假 / 目标不可覆盖） */
  inactiveReason?: 'expired' | 'scope_mismatch' | 'condition_false' | 'target_not_overridable' | 'eval_error';
  /** 生效时对目标规则的有效改写 */
  effect?: {
    targetRuleId: string;
    mode: OverrideMode;
    bounds?: { min: number; max: number };
    counterForce?: number;
    replacement?: number;
  };
}

// ==================== 第四层：未定义兜底 ====================

export type FallbackStrategy =
  | 'escalate'          // 向上求助：交给更高层/人工裁决
  | 'allow_then_fix'    // 默认允许 + 事后修正
  | 'mark_pending';     // 标记待裁决

/**
 * escalate 求的是谁的助。三个去处对应三种「更高层」：
 *   meta   交回第零层基石裁（本层不认识，但基石认识 —— 例如「这算不算凭空生物」）
 *   engine 交给引擎的既有权威（effect-resolver / content-registry 仍是最终结算方）
 *   human  攒着等人看（落 DeferredDecision，不进本轮任何数据通路）
 */
export type FallbackEscalationTarget = 'meta' | 'engine' | 'human';

/** 策略 → 处置态的固定映射。第四层不允许逐条自定处置，避免变成第二个软规则层 */
export const FALLBACK_STRATEGY_DISPOSITION: Readonly<Record<FallbackStrategy, RuleDisposition>> = {
  // 向上求助：本轮悬置，等更高层回话
  escalate: 'defer',
  // 默认允许 + 事后修正：本轮照旧放行，只落一条待修正记录
  allow_then_fix: 'flag_review',
  // 标记待裁决：本轮悬置，但不指定去处
  mark_pending: 'defer',
};

export interface FallbackRule {
  id: string;
  layer: 4;
  description: string;
  strategy: FallbackStrategy;
  code: KnownTraceCode;
  /** 命中判定：这个输入是否落在所有已定义规则之外 */
  matches: (ctx: RuleContext) => boolean;
  playerFacing?: string;
  /** strategy='escalate' 时必须交代求助去处；其余策略留空 */
  escalateTo?: FallbackEscalationTarget;
  /**
   * allow_then_fix 专用：事后修正的着手处（内部诊断文案）。
   * 「默认允许」如果不写清事后怎么修，就退化成「默认忽略」。
   */
  fixHint?: string;
}

export interface DeferredDecision {
  /** 悬置项 id（确定性生成，不用 Math.random，便于影子比对） */
  id: string;
  ruleId: string;
  strategy: FallbackStrategy;
  code: KnownTraceCode;
  message: string;
  field?: string;
  /** 悬置发生时的岁数 */
  age?: number;
  /** allow_then_fix 专用：本轮已放行，待事后修正 */
  allowedProvisionally: boolean;
  /** escalate 专用：求助去处 */
  escalateTo?: FallbackEscalationTarget;
  /** allow_then_fix 专用：事后从哪儿修 */
  fixHint?: string;
  /** 玩家可见话术（若该兜底规则提供了的话） */
  playerFacing?: string;
}

// ==================== 规则表 ====================

export interface RuleSet {
  meta: readonly MetaRule[];
  hard: readonly HardRule[];
  soft: readonly SoftRule[];
  overrides: readonly RuleOverride[];
  fallback: readonly FallbackRule[];
}
