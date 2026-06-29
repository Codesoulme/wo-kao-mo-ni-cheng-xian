// DSL AST 解释器
// 在 EvalContext 上执行规则表达式，返回 any 结果

import type { DSLNode } from './ast';

export interface EvalContext {
  [key: string]: any;
}

export function evalDSL(node: DSLNode, ctx: EvalContext): any {
  switch (node.op) {
    case 'const':
      return node.value;

    case 'add':
      return node.args.reduce<number>((a, b) => a + Number(evalDSL(b, ctx)), 0);

    case 'sub':
      return node.args.reduce<number>((a, b, i) => (i === 0 ? Number(evalDSL(b, ctx)) : a - Number(evalDSL(b, ctx))), 0);

    case 'mul':
      return node.args.reduce<number>((a, b, i) => (i === 0 ? Number(evalDSL(b, ctx)) : a * Number(evalDSL(b, ctx))), 1);

    case 'div': {
      if (node.args.length < 2) {
        throw new Error('DSL: op "div" requires at least 2 args');
      }
      const values = node.args.map((a) => Number(evalDSL(a, ctx)));
      // BUGFIX: 之前用 reduce(..., 1) 在 args=[80] 时返回 1/80=0.0125 而非 80
      // 修法：取 args[0] 作为初值，从 args[1] 开始 reduce
      return values.slice(1).reduce<number>((a, b) => {
        if (b === 0) throw new Error('DSL: division by zero');
        return a / b;
      }, values[0]);
    }

    case 'mod': {
      if (node.args.length < 2) {
        throw new Error('DSL: op "mod" requires at least 2 args');
      }
      const values = node.args.map((a) => Number(evalDSL(a, ctx)));
      // BUGFIX: 同 div —— init 不能是 1
      return values.slice(1).reduce<number>((a, b) => {
        if (b === 0) throw new Error('DSL: modulo by zero');
        return a % b;
      }, values[0]);
    }

    case 'gt':
      return evalDSL(node.args[0], ctx) > evalDSL(node.args[1], ctx);

    case 'gte':
      return evalDSL(node.args[0], ctx) >= evalDSL(node.args[1], ctx);

    case 'lt':
      return evalDSL(node.args[0], ctx) < evalDSL(node.args[1], ctx);

    case 'lte':
      return evalDSL(node.args[0], ctx) <= evalDSL(node.args[1], ctx);

    case 'eq':
      return evalDSL(node.args[0], ctx) === evalDSL(node.args[1], ctx);

    case 'and':
      return node.args.every((a) => Boolean(evalDSL(a, ctx)));

    case 'or':
      return node.args.some((a) => Boolean(evalDSL(a, ctx)));

    case 'not':
      return !evalDSL(node.args[0], ctx);

    case 'if': {
      const cond = evalDSL(node.args[0], ctx);
      return cond ? evalDSL(node.args[1], ctx) : evalDSL(node.args[2], ctx);
    }

    case 'var': {
      const path = node.name.split('.');
      let cur: any = ctx;
      for (const p of path) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    }

    default: {
      // TS 完备性检查
      const exhaustive: never = node;
      throw new Error(`Unknown op: ${(exhaustive as any).op}`);
    }
  }
}