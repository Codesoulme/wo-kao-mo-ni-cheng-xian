// 通用白名单判定 —— 第一层 whitelist 类硬规则的求值器
//
// 这个文件**故意不 import 任何运行时模块**（只有会被编译擦除的 import type）。
// 理由是依赖环：engine/validation.ts 位于 engine/attributes.ts 的依赖子树里
// （attributes → shared → ending-inheritance-fate → validation），
// 而 hard-rules.ts 在模块初始化时就要读 ATTRIBUTE_BOUNDS。
// 若 validation.ts 直接 import hard-rules.ts，就会出现
// 「attributes 尚未初始化完 → hard-rules 读到 undefined」的启动期崩溃。
//
// 所以接线侧只准 import 叶子模块（本文件 + ui-slot-rules.ts），
// 需要完整规则表的地方走 registry.ts —— 那条路不在 attributes 的依赖子树里。

import type { HardRule, RuleVerdict } from './types';

/**
 * 判一个值是否在某条 whitelist 硬规则的册内。
 *
 * 返回约定沿用第一层的既有风格：**有裁决即越界，null 即放行无痕**。
 *   null       在册（或该规则无册可查，无从判定 —— 宁放行不误伤）
 *   RuleVerdict 不在册，带上规则自己声明的 disposition（clamp / strip）
 *
 * enforced 恒为 false：本函数只出判词，不改数据。谁调用谁决定要不要照办 ——
 * 这正是「规则表可查询」与「规则表执行」两件事的分界。
 */
export function checkWhitelist(
  rule: HardRule,
  value: unknown,
  refId?: string,
): RuleVerdict | null {
  const allowed = rule.allowed;
  if (!allowed) return null;
  const text = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  if (allowed.has(text)) return null;
  return {
    ruleId: rule.id,
    layer: 1,
    disposition: rule.disposition,
    code: rule.code,
    message: `${rule.field} 取值 ${text || '(空)'} 不在册内（${rule.description}）`,
    field: rule.field,
    refId,
    enforced: false,
  };
}

/** 只问在不在册 */
export function isWhitelisted(rule: HardRule, value: unknown): boolean {
  return checkWhitelist(rule, value) === null;
}

/**
 * 批量判：返回全部越界项的裁决。
 * 用于 displaySlots 这类数组字段 —— 一个字段里可能有多个越界值。
 */
export function checkWhitelistAll(rule: HardRule, values: readonly unknown[]): RuleVerdict[] {
  const out: RuleVerdict[] = [];
  for (const v of values) {
    const verdict = checkWhitelist(rule, v);
    if (verdict) out.push(verdict);
  }
  return out;
}

/** 取某条 whitelist 规则的册（保持注册顺序；Set 的迭代序即插入序） */
export function listAllowedValues(rule: HardRule): string[] {
  return rule.allowed ? Array.from(rule.allowed) : [];
}
