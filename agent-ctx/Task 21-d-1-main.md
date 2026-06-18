# Task 21-d-1: 坊市交易 UI 系统

**Agent**: main
**Task ID**: Task 21-d-1
**Date**: 2025-06-17

## 任务概述
参考《凡人修仙传》小说中的坊市设定，让玩家可以主动访问坊市购买/出售物品。这是 Task 20 蓝图池中"坊市淘宝"主题的延伸——把坊市从被动事件变为玩家可主动进入的交互界面。

## 完成内容

### Task A: 新建坊市 API 路由
**文件**: `/home/z/my-project/src/app/api/game/market/route.ts`（新建）

支持 3 种 action：
- `list`: 按角色境界生成 6-10 件坊市可买物品（价格 ±20% 浮动）+ 玩家可出售物品（估价 = estimateValue × 0.6）
- `buy`: 校验灵石/储物袋容量 → 扣灵石 → addItems 加物品 → 持久化 → 写 EventLog（eventType='trade'，标题"坊市·购·{物品名}"）
- `sell`: 校验物品在背包中 → removeItemsByIds → 加灵石 → 持久化 → 写 EventLog（标题"坊市·售·{物品名}"）

**关键设计**:
- 三档坊市物品池（mortal_qi / foundation / golden）按境界合并取并集
- 防御性检查：alive / isAtChoice / combatStateJson.status='ongoing' 任一为真则拒绝（400）
- 物品 id 用 `market_<timestamp>_<idx>` 仅作前端展示用，buy 时传完整 item 对象
- addItems 自动处理储物袋扩容（含 storageCapacity effect 的 tool）
- removeItemsByIds 自动处理储物袋反向扣减（如卖掉储物袋）
- estimateValue：rarity 基价 + scripture 含 cultivationExp multiply 翻倍 + 储物袋按 capacity×3 加价

### Task B: 新建 MarketModal 组件
**文件**: `/home/z/my-project/src/components/xianxia/MarketModal.tsx`（新建）

UI 结构（z-[55]，介于 ChoiceModal z-50 与 CombatModal z-[60] 之间）:
- **顶部**: "坊市淘宝"标题（Store icon）+ 灵石徽标（金色 Coins + 数字）+ 关闭按钮 + 储物袋容量显示
- **Tab 切换**: 购买 / 出售（amber-500 主题色，避开 indigo/blue）
- **购买 Tab**:
  - 物品卡片列表（max-h-[calc(100dvh-180px)] overflow-y-auto xianxia-scroll）
  - 每个物品卡：稀有度彩色边框 + 类型 icon + 名称（彩色）+ 描述 + 效果 chips + 价格（金色）+ 购买按钮
  - 灵石不足时按钮禁用，文案"灵石不足"
  - 储物袋满时按钮禁用，文案"储物袋已满"
  - 交易中显示 spinner
- **出售 Tab**:
  - 玩家背包物品列表（同上结构）
  - 显示估价（绿色）+ 出售按钮
  - 空背包显示"身无长物"
- **底部说明栏**: "坊市每访问一次便更新陈列；售出估价为原值六成"

样式细节：
- 稀有度配色与 InventoryPanel/AlchemyFurnace 保持一致（common 灰 / uncommon 绿 / rare 蓝 / epic 紫 / legendary 金 / mythic 粉）
- 价格用 amber-700 金色数字，出售估价用 green-700
- 修仙水墨风格：paper-texture / ink-wash / font-serif-cn / amber-500 边框
- 移动端全屏（rounded-none sm:rounded-lg）
- 触控友好：购买/出售按钮 h-8，X 按钮 w-7 h-7

API 调用流：
- 弹窗打开时（useEffect 监听 marketOpen）调 `list` 一次
- 购买调 `buy`，传完整 item 对象 → 成功后 setCharacter 更新状态 + 从本地 marketItems 列表移除该物品
- 出售调 `sell`，传 itemId → 成功后 setCharacter + 从本地 sellableItems 移除
- 关闭时清理本地 state

### Task C: 修改 ActionButtons.tsx
**文件**: `/home/z/my-project/src/components/xianxia/ActionButtons.tsx`（修改）

在主推进按钮行下方新增"坊市淘宝"按钮：
- 第二行全宽按钮（h-9 w-full），amber-500 边框 + amber-700 文字主题
- Store icon + "坊市淘宝" + 当前灵石数显示（"· {N} 灵石"）
- 显示条件：`!isDead && !isAscended && !inCombat && !atChoice && !isAutoRunning`（仅在"中断模拟"状态下显示）
- 点击调 `setMarketOpen(true)`
- 新增 import Store icon、新增 setMarketOpen 从 store 解构

### Task D: 修改 page.tsx
**文件**: `/home/z/my-project/src/app/page.tsx`（修改）

- import MarketModal
- 在 `<CombatModal />` 之后加入 `<MarketModal />`，确保坊市弹窗能显示（z-[55] 介于 ChoiceModal 与 CombatModal 之间）

### Task E: 修改 store.ts
**文件**: `/home/z/my-project/src/lib/xianxia/store.ts`（修改）

- GameState interface 新增 `marketOpen: boolean` + `setMarketOpen: (open: boolean) => void`
- 初始 state 加 `marketOpen: false`
- 实现 `setMarketOpen: (open) => set({ marketOpen: open })`
- reset() 也清理 `marketOpen: false`

## 验证结果

### 类型检查
```bash
bunx tsc --noEmit --skipLibCheck 2>&1 | grep -v "examples/\|skills/"
```
→ **零错误**（仅有 examples/skills 目录的 pre-existing 错误，与本任务无关）

### Lint 检查
```bash
bun run lint
```
→ **零警告零错误**

### API 端到端验证（curl）

**list 测试**（角色：墨问天，realm=mortal，原 50 灵石）：
```
POST /api/game/market {"action":"list"}
→ 200, marketItems 6 件（凡人/炼气期池），sellableItems 2 件，playerSpiritStones=50
```

**buy 测试**：
```
POST /api/game/market {"action":"buy","itemId":"market_mqivqsfc_0","item":{木剑...}}
→ 200, message="购得 木剑，花费 5 灵石", boughtItem.id=item_buy_mqivqylmicjn
   spiritStones 50→45, inventory 2→3
```

**sell 测试**：
```
POST /api/game/market {"action":"sell","itemId":"item_buy_mqivqylmicjn"}
→ 200, message="售出 木剑，得 3 灵石", sellPrice=3
   spiritStones 45→48, inventory 3→2
```

**边界测试**：
- 灵石不足 → 400 "灵石不足，需 800 灵石" ✓
- 出售不存在物品 → 400 "物品不在储物袋中" ✓
- atChoice 角色访问坊市 → 400 "当前有待抉择的命节点，请先完成抉择" ✓
- 缺 characterId → 400 "characterId 和 action 必填" ✓

**EventLog 验证**：
- 坊市·购·木剑 → "于坊市购得「木剑」，花费灵石 5 枚。"（eventType='trade'）
- 坊市·售·木剑 → "于坊市售出「木剑」，得灵石 3 枚。"（eventType='trade'）

### Dev server log
- `POST /api/game/market 200` for successful list/buy/sell
- `POST /api/game/market 400` for rejected edge cases
- `✓ Compiled in N ms` 编译成功无报错

## 文件清单

**新建（2 个）**:
1. `/home/z/my-project/src/app/api/game/market/route.ts` — 坊市交易 API（list/buy/sell）
2. `/home/z/my-project/src/components/xianxia/MarketModal.tsx` — 坊市交易弹窗组件

**修改（3 个）**:
3. `/home/z/my-project/src/lib/xianxia/store.ts` — 新增 marketOpen/setMarketOpen
4. `/home/z/my-project/src/components/xianxia/ActionButtons.tsx` — 新增"坊市淘宝"入口按钮 + Store icon import
5. `/home/z/my-project/src/app/page.tsx` — import MarketModal + 在 CombatModal 后渲染

## 遗留问题

无遗留问题。

## 测试数据清理

测试时给"墨问天"加了 50 灵石用于买/卖测试，测试后已恢复为原值 3 灵石，并删除了测试期间产生的 2 条 trade EventLog 记录，避免污染史册。
