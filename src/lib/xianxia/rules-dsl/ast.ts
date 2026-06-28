// DSL 抽象语法树（参考 JsonLogic 风格）
// 用于规则引擎 / 物品效果声明式定义（TechDoc 18.6.4 PoC）

export type DSLValue = number | string | boolean;

export type DSLNode =
  | { op: 'const'; value: DSLValue }
  | { op: 'add'; args: DSLNode[] }
  | { op: 'sub'; args: DSLNode[] }
  | { op: 'mul'; args: DSLNode[] }
  | { op: 'div'; args: DSLNode[] }
  | { op: 'mod'; args: DSLNode[] }
  | { op: 'gt'; args: [DSLNode, DSLNode] }
  | { op: 'gte'; args: [DSLNode, DSLNode] }
  | { op: 'lt'; args: [DSLNode, DSLNode] }
  | { op: 'lte'; args: [DSLNode, DSLNode] }
  | { op: 'eq'; args: [DSLNode, DSLNode] }
  | { op: 'and'; args: DSLNode[] }
  | { op: 'or'; args: DSLNode[] }
  | { op: 'not'; args: [DSLNode] }
  | { op: 'if'; args: [DSLNode, DSLNode, DSLNode] } // condition, then, else
  | { op: 'var'; name: string }; // 上下文变量，如 'character.realm'

// 已注册的 op 集合（用于校验 + 扩展点）
export const DSL_KNOWN_OPS: ReadonlySet<DSLNode['op']> = new Set<DSLNode['op']>([
  'const',
  'add',
  'sub',
  'mul',
  'div',
  'mod',
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'and',
  'or',
  'not',
  'if',
  'var',
]);

export interface DSLRule {
  id: string;
  description: string;
  rule: DSLNode;
}