// 五层规则体系 —— 统一出口
//
// 用法上的一条硬约束：
//   **engine/ 下的模块不要 import 这个 barrel。**
// 本 barrel 会拉起 hard-rules.ts，而它在模块初始化期就要读 engine/attributes 的
// ATTRIBUTE_BOUNDS；engine/attributes → engine/shared → ending-inheritance-fate →
// engine/validation 已经是一条既存链，validation 再拉 barrel 就成环，
// 且是「初始化期取值」的那种致命环（拿到 undefined 后 Object.entries 直接抛）。
//
// 所以 engine/ 侧只准 import 两个叶子模块（它们只有 import type，编译后零运行时依赖）：
//   rules/whitelist.ts
//   rules/ui-slot-rules.ts
// 需要整表的（registry / evaluate / fallback-rules）只在 engine 依赖子树之外用。

export * from './types';
export * from './trace-codes';
export * from './condition';
export * from './whitelist';
export * from './ui-slot-rules';
export * from './meta-rules';
export * from './hard-rules';
export * from './soft-rules';
export * from './overrides';
export * from './fallback-rules';
export * from './evaluate';
export {
  RULE_INDEX,
  listRules,
  hasRule,
  getRuleSummary,
  whoOverrides,
  queryRule,
  isRuleActive,
  isOverridable,
  explainRule,
  dispositionToBoundarySeverity,
  dispositionToContinuitySeverity,
} from './registry';
export type { RuleSummary, OverrideInfo, RuleQueryResult } from './registry';
