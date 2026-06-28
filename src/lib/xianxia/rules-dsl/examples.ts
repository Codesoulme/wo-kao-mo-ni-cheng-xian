// 修仙物品效果 DSL 示例规则（TechDoc 18.6.4 PoC）
// 添加新效果只需新增 rule JSON，无需改引擎代码

import type { DSLRule } from './ast';

export const RULE_EXAMPLES: DSLRule[] = [
  {
    id: 'rule-attack-boost-low-realm',
    description: '炼气期角色获得装备时攻击 +20%（灵根属性加权）',
    rule: {
      op: 'if',
      args: [
        {
          op: 'eq',
          args: [
            { op: 'var', name: 'character.realm' },
            { op: 'const', value: 'qi_refining' },
          ],
        },
        {
          op: 'mul',
          args: [
            { op: 'var', name: 'item.attackBase' },
            {
              op: 'add',
              args: [
                { op: 'const', value: 1 },
                {
                  op: 'mul',
                  args: [
                    { op: 'const', value: 0.2 },
                    { op: 'var', name: 'character.spiritualRoot.power' },
                  ],
                },
              ],
            },
          ],
        },
        { op: 'var', name: 'item.attackBase' },
      ],
    },
  },
  {
    id: 'rule-cultivation-speed-artifact',
    description: '若角色佩戴与灵根匹配的本命法宝（且已绑定），修炼速度 ×1.5',
    rule: {
      op: 'if',
      args: [
        {
          op: 'and',
          args: [
            {
              op: 'eq',
              args: [
                { op: 'var', name: 'character.equipped.artifact.element' },
                { op: 'var', name: 'character.spiritualRoot.element' },
              ],
            },
            {
              op: 'eq',
              args: [
                { op: 'var', name: 'character.equipped.artifact.bonded' },
                { op: 'const', value: true },
              ],
            },
          ],
        },
        {
          op: 'mul',
          args: [
            { op: 'var', name: 'character.cultivationSpeed' },
            { op: 'const', value: 1.5 },
          ],
        },
        { op: 'var', name: 'character.cultivationSpeed' },
      ],
    },
  },
  {
    id: 'rule-injury-resistance-realm',
    description: '金丹以上境界伤害减免公式（每高一级减伤 10%）',
    rule: {
      op: 'if',
      args: [
        {
          op: 'gte',
          args: [
            { op: 'var', name: 'character.realmLevel' },
            { op: 'const', value: 9 }, // 金丹
          ],
        },
        {
          op: 'mul',
          args: [
            { op: 'var', name: 'damage' },
            {
              op: 'sub',
              args: [
                { op: 'const', value: 1 },
                {
                  op: 'mul',
                  args: [
                    { op: 'const', value: 0.1 },
                    {
                      op: 'sub',
                      args: [
                        { op: 'var', name: 'character.realmLevel' },
                        { op: 'const', value: 8 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { op: 'var', name: 'damage' },
      ],
    },
  },
];