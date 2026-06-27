# type-audit-report.md — AI-105 类型系统深度审计

**suite**: `scripts/audit-types-deep.ts`
**date**: 2026-06-27
**scanned**: `src/lib/xianxia/types.ts` (107659 bytes), `src/lib/xianxia/engine.ts` (370234 bytes)

## 数字

| 项 | 值 |
|----|----|
| types.ts 中导出 types/interfaces | 149 |
| `enum` 关键字 | 0 ✓ |
| literal union (X = `a` \| `b`) | 50 |
| discriminated union | 0 (未见显式 `kind`/`type` 字段驱动的 union 标签) |
| brand 类型 (如 `CharacterId`) | 0 |
| orphan 类型 (未被引用) | 29 |
| warning 数 | 13 |

## 主要发现 (13 个 warning)

### 类型层

1. **`id: string` 缺 brand 修饰** — types.ts 大量字段 (`CharacterState.id`, `ItemEntry.id`, `EventEntry.id` 等) 都是裸 string, 容易和别的 string 串错. 建议抽 `type CharacterId = string & { __brand: 'CharacterId' }` 然后在入口处做 cast.
2. **无 brand 类型引用** — engine.ts 也未引用 `CharacterId`/`ItemId` 等 brand 标识. 现在所有 id 都是 string, 编译期无法防止 "把 NPC id 当 Character id 用" 的错误.
3. **enum 关键字数 = 0** — 全用字面量联合 + as const 对象, 是健康的.
4. **稀有度字面量 `'common' | 'uncommon' | '...'` 重复 12+ 次** — 建议抽 `const RARITY_TIERS` 或 `type Rarity = typeof RARITY_TIERS[number]`.
5. **`: any` 字段在 types.ts 出现 ~5 次** — 多数集中在 `Blueprint` / `StatusEffect.payload` 这种 "由 AI 决定形状" 的容器里. 可以接受, 但建议改成 `Record<string, unknown>` 或更窄的联合.
6. **`as any` 在 engine.ts 出现少量** — 用于 `state: any` 参数, 集中在调用 AI 边界. 可以接受但应在 entry 加 narrow guard.

### 架构层

7. **缺少 discriminated union** — `EventEntry` / `StatusEffect` 这种 "可以由不同 category 决定结构" 的地方没有显式 `category` 标签 (尽管 StatusCategory 是字面量联合), engine 内大量 `switch (entry.category)` 的地方应该用 discriminated union 写, 让 TS 帮穷举.
8. **orphan 类型 = 29** — types.ts 有 29 个导出 interface/type 没人引用. 可能:
   - 旧版遗留
   - 是为 store / route 暴露的 API (UI 端消费)
   - 文档 / 占位类型
   建议人肉过一遍, 把确定的 dead code 删了.

## 修复优先级

| 优先级 | 项 | 改动量 |
|--------|-----|--------|
| 高 | 抽 brand id type (`CharacterId` / `ItemId` / `ThreadId`) | ~30 处签名 |
| 中 | 抽 `RARITY_TIERS` 常量 | ~10 处 |
| 中 | discriminated union 化 `EventEntry` / `StatusEffect` | ~50 处 switch |
| 低 | 清理 orphan types | 待人肉确认 |
| 低 | `: any` → `unknown` | ~5 处 |

## 结论

types.ts 当前是 **能用但不够严格** 的状态. 类型层没有致命问题 (无 enum 反模式), 但 brand id 的缺失是最大的隐性风险. 修复成本可控.

## 文件

- 脚本: `E:\aigame2_publish\scripts\audit-types-deep.ts` (11919 bytes)
- 原始结果: `logs/bench/types-audit.<ts>.json`
- 此报告: `E:\aigame2_publish\type-audit-report.md`