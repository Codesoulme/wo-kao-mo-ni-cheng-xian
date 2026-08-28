// 谓词求值器桥接层 —— 规则体系与 rules-dsl 之间唯一的接缝
//
// 硬约束：**规则体系不自建表达式引擎**。
// src/lib/xianxia/rules-dsl/ 已有 parser + interpreter + 16 个 op，且有 smoke 覆盖，
// 所以这里只做三件事：
//   1. 把 parseDSL 的「抛异常」包成「返回结果」—— 规则层的既有风格是失败不阻断
//   2. 把 evalDSL 的「返回 any」收窄成明确的成败二态 + 保守回落
//   3. 把 DSLNode 渲染成中文可读句子 —— 统一查询入口要回答「覆盖条件是什么」
//
// 谁用它：
//   第二层 soft-rules 的 exceptions（SoftRuleException.when）
//   第三层 overrides 的 condition（overrides.ts 已直接 import evalDSL，这里给出带诊断的版本）
//   第四层 fallback 判定「AI 给的条件根本解析不了」—— 这条正是 parseDSL 的用场

import { parseDSL } from '../rules-dsl/parser';
import { evalDSL } from '../rules-dsl/interpreter';
import { DSL_KNOWN_OPS } from '../rules-dsl/ast';
import type { DSLNode } from '../rules-dsl/ast';
import type { RuleContext } from './types';

/** rules-dsl 当前支持的 op 全集（只读镜像，规则层不得私自扩充） */
export const SUPPORTED_CONDITION_OPS: ReadonlySet<string> = DSL_KNOWN_OPS as ReadonlySet<string>;

// ==================== 编译（JSON → AST） ====================

export type ConditionCompileResult =
  | { ok: true; node: DSLNode }
  | { ok: false; reason: string };

/**
 * 把外部（生成侧 / 存档 / 动态注册）给来的 JSON 编译成 DSL AST。
 * parseDSL 会对未注册 op、缺参、arity 不符抛错；这里收成结果对象。
 *
 * 这是第四层「向上求助」的触发源：条件编译不过 → 规则体系无从判断 → escalate。
 */
export function compileCondition(json: unknown): ConditionCompileResult {
  try {
    return { ok: true, node: parseDSL(json) };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, reason };
  }
}

/** 只问「能不能编译」，不要 AST */
export function isCompilableCondition(json: unknown): boolean {
  return compileCondition(json).ok;
}

// ==================== 求值（AST + ctx → 真假） ====================

export interface ConditionEvalResult {
  /** 求值本身有没有成功（区别于结果真假） */
  ok: boolean;
  /** 布尔化后的结果；求值失败时恒为 false */
  holds: boolean;
  /** 原始返回值（诊断用） */
  raw?: unknown;
  error?: string;
}

/**
 * 求值一条条件。RuleContext 是宽松 Record，正好当 evalDSL 的 EvalContext 用 ——
 * DSL 的 var 'character.age' / 'secretRealmId' / 'world.inTribulation' 都能直接取到。
 */
export function evalCondition(node: DSLNode, ctx: RuleContext): ConditionEvalResult {
  try {
    const raw = evalDSL(node, ctx as Record<string, unknown>);
    return { ok: true, holds: Boolean(raw), raw };
  } catch (e) {
    return { ok: false, holds: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 保守回落版：算不出来就当条件不成立。
 * 为什么保守 —— 条件为真意味着「覆盖生效 / 例外成立」，都是放宽约束的方向；
 * 算不出来时宁可回到基准规则，不要凭一个异常放宽世界法度。
 */
export function conditionHolds(node: DSLNode, ctx: RuleContext): boolean {
  return evalCondition(node, ctx).holds;
}

/** 任一成立（第二层 exceptions 的语义：任一例外成立则整条软规则跳过） */
export function anyConditionHolds(nodes: readonly DSLNode[], ctx: RuleContext): boolean {
  for (const n of nodes) {
    if (conditionHolds(n, ctx)) return true;
  }
  return false;
}

// ==================== 渲染（AST → 中文句子） ====================

const BINARY_SYMBOL: Readonly<Record<string, string>> = {
  add: ' + ',
  sub: ' - ',
  mul: ' × ',
  div: ' ÷ ',
  mod: ' 余 ',
  gt: ' > ',
  gte: ' ≥ ',
  lt: ' < ',
  lte: ' ≤ ',
  eq: ' = ',
};

function renderConst(value: unknown): string {
  if (value === true) return '真';
  if (value === false) return '假';
  if (typeof value === 'string') return `「${value}」`;
  return String(value);
}

/**
 * 把条件渲染成人话。统一查询入口要能回答「覆盖条件是什么」——
 * 回答不能是一坨 JSON，得是一句能读的话。
 * 纯函数、不抛错：遇到意外结构返回占位串。
 */
export function describeCondition(node: DSLNode | null | undefined): string {
  if (!node || typeof node !== 'object') return '(无条件)';
  try {
    switch (node.op) {
      case 'const':
        return renderConst(node.value);
      case 'var':
        return node.name;
      case 'add':
      case 'sub':
      case 'mul':
      case 'div':
      case 'mod': {
        const sym = BINARY_SYMBOL[node.op];
        return `(${node.args.map(describeCondition).join(sym)})`;
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'eq': {
        const sym = BINARY_SYMBOL[node.op];
        return `${describeCondition(node.args[0])}${sym}${describeCondition(node.args[1])}`;
      }
      case 'and':
        return `(${node.args.map(describeCondition).join(' 且 ')})`;
      case 'or':
        return `(${node.args.map(describeCondition).join(' 或 ')})`;
      case 'not':
        return `非(${describeCondition(node.args[0])})`;
      case 'if':
        return `若 ${describeCondition(node.args[0])} 则 ${describeCondition(node.args[1])} 否则 ${describeCondition(node.args[2])}`;
      default:
        return '(未知条件)';
    }
  } catch {
    return '(条件无法描述)';
  }
}

/**
 * 抽出条件里引用的全部 var 路径。
 * 用途：诊断「这条覆盖为什么没生效」时，先看它依赖的 var 在 ctx 里是否真有值。
 */
export function collectConditionVars(node: DSLNode | null | undefined): string[] {
  const out: string[] = [];
  const walk = (n: DSLNode | null | undefined): void => {
    if (!n || typeof n !== 'object') return;
    if (n.op === 'var') {
      if (!out.includes(n.name)) out.push(n.name);
      return;
    }
    if (n.op === 'const') return;
    const args = (n as { args?: DSLNode[] }).args;
    if (Array.isArray(args)) for (const a of args) walk(a);
  };
  try {
    walk(node);
  } catch {
    // 结构异常时返回已收集到的部分
  }
  return out;
}
