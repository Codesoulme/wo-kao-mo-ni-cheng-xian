// JSON → DSL AST 解析器
// 校验 DSL 节点结构，递归构建强类型 AST

import type { DSLNode } from './ast';
import { DSL_KNOWN_OPS } from './ast';

export function parseDSL(json: unknown): DSLNode {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid DSL: node must be an object');
  }
  const node = json as Record<string, unknown>;
  if (typeof node.op !== 'string') {
    throw new Error('Invalid DSL: missing "op" field');
  }
  const op = node.op;
  if (!DSL_KNOWN_OPS.has(op as DSLNode['op'])) {
    throw new Error(`Unknown op: ${op}`);
  }

  switch (op) {
    case 'const':
      if (node.value === undefined) {
        throw new Error('Invalid DSL: const requires "value"');
      }
      return { op: 'const', value: node.value as number | string | boolean };

    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'mod':
    case 'and':
    case 'or': {
      const args = Array.isArray(node.args) ? node.args : [];
      if (args.length === 0) {
        throw new Error(`Invalid DSL: op "${op}" requires at least 1 arg`);
      }
      return { op, args: args.map(parseDSL) } as DSLNode;
    }

    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'eq': {
      const args = node.args;
      if (!Array.isArray(args) || args.length !== 2) {
        throw new Error(`Invalid DSL: op "${op}" requires exactly 2 args`);
      }
      return { op, args: [parseDSL(args[0]), parseDSL(args[1])] } as DSLNode;
    }

    case 'not': {
      const args = node.args;
      if (!Array.isArray(args) || args.length !== 1) {
        throw new Error('Invalid DSL: op "not" requires exactly 1 arg');
      }
      return { op, args: [parseDSL(args[0])] };
    }

    case 'if': {
      const args = node.args;
      if (!Array.isArray(args) || args.length !== 3) {
        throw new Error('Invalid DSL: op "if" requires exactly 3 args (cond, then, else)');
      }
      return { op, args: [parseDSL(args[0]), parseDSL(args[1]), parseDSL(args[2])] };
    }

    case 'var': {
      if (typeof node.name !== 'string' || node.name.length === 0) {
        throw new Error('Invalid DSL: op "var" requires non-empty "name"');
      }
      return { op, name: node.name };
    }

    default:
      throw new Error(`Unknown op: ${op}`);
  }
}