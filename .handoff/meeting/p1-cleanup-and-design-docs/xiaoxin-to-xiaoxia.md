# 小薪 → 小虾米（P1 cleanup + 设计文档）

> 议题：P1 cleanup + design docs (新会议)
> 任务卡 ID: p1-cleanup-and-design-docs
> 时限: 140 分钟

## 小薪进度

### AI-28: 玩家可见文案审计 (只读) ✅
- 新增 `scripts/player-visible-text-audit.py`（v2 精确化版：提取 JSX 文本节点 + toast 文案 + placeholder + title + aria-label 等真正玩家可见位置；白名单 AIConfigDialog.tsx）
- 输出 `docs/PLAYER_VISIBLE_TEXT_AUDIT.md` 审计报告
- 总问题：6 项（P0: 3 / P1: 3）
  - 3 个 P0 都是 JSX 数学表达式误报（`0 ? events[idx-1] : undefined` 不是字符串）
  - P1 三项真实问题：ActionButtons "AI 响应异常" toast / ChoiceModal "API Base/Key" 漏出 / display.ts 缺 isMeaningfulStatus（在 engine.ts 实际存在，误报）
- 审计扫描 29 个组件 + display.ts + 全部 docs/

### AI-29: 强化秘境/拍卖/战斗因果链 ✅
- 改动：`src/app/api/game/combat/action/route.ts` line 232+ 新增战斗结束后自动补 enemy 线索逻辑
  - 检测 `combatSession.status !== 'ongoing'` 时
  - 查找 `survivedEnemies`（hp > 0 的敌人）
  - 根据结局（defeat / 其他）生成"追杀未止"或"未竟之患"标题
  - 8 年 deadline，避免重复（检查现有 pendingThreads title）
- 不动 engine.ts / types.ts enum / llm.ts 大段 prompt（边界 OK）
- 秘境 + 拍卖 route 已存在完整因果链（验证）

### AI-30: 5 条新 smoke ✅
- 新增：
  1. `smokeCombatEnemySurvivorCausality` (AI-29 战斗后 enemy 线索)
  2. `smokeCausalityChainAuction` (AI-29 拍卖因果链)
  3. `smokeCausalityChainSecretRealm` (AI-29 秘境因果链)
  4. `smokePlayerVisibleTextNoSystemWords` (AI-28 审计报告)
  5. `smokeDesignDocTablesExist` (AI-31 蓝图文档)
- 接入 main() (line 2328-2332)
- 累计 smoke 数：28 + 5 = 33 条

### AI-31: 3 个设计文档子表 ✅
- 新增 `docs/blueprints/value-blueprint.md` (20 项价值 + AI 接管策略)
- 新增 `docs/blueprints/status-blueprint.md` (14 类状态 + 玩家可见性规则)
- 新增 `docs/blueprints/event-blueprint.md` (20 类事件 + 因果链核心规则)
- 每个文档含 markdown 表格 + AI 接管要点 + 边界约束

---

## 小薪完工回执 (2026-06-27 P1)

### 本次完成
- AI-28 ~ AI-31 全部 4 件完成
- 新增 5 条 smoke + 1 个 Python 审计脚本 + 3 个 blueprints 文档 + 1 处战斗因果链改码

### 改动文件
- `scripts/player-visible-text-audit.py` (新增)
- `docs/PLAYER_VISIBLE_TEXT_AUDIT.md` (新增，审计报告)
- `docs/blueprints/value-blueprint.md` (新增)
- `docs/blueprints/status-blueprint.md` (新增)
- `docs/blueprints/event-blueprint.md` (新增)
- `src/app/api/game/combat/action/route.ts` (新增 enemy 线索自动补)
- `scripts/xianxia-regression-smoke.ts` (新增 5 条 smoke)

### 验证结果
- bun scripts/xianxia-regression-smoke.ts ✅ (33 条全过，含 5 条新增)
- bunx eslint targeted ✅
- git diff --check ✅
- python scripts/player-visible-text-audit.py ✅ (审计跑通)

### commit 状态
- 尚未 commit（按新规则等待 owner 拍板）
- **绝不自己 push**，等 owner 或小虾米说"可以推"再推

### 遗留
- AI-28 审计发现 3 项 P1 真实问题（ActionButtons/ChoiceModal toast + display.ts 函数定位），本批未修，留给下批 P1-cleanup-and-design-docs-fixups
- AI-29 战斗因果链仅在 combat/action route 加了 enemy 线索，未做 combat/end 路径上的"仇敌反扑" 后续承接 — 可下一批扩展
- 文档层级：docs/blueprints/ 与 docs/DESIGN.md 链接关系尚未建立 — 可下批补