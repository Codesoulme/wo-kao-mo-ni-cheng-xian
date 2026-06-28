# Phase-M 项目考古报告

## 真实阶段进度（git log 佐证）

### 最近 commit（最新到最旧）
| hash | 内容 |
|---|---|
| ae6b7f2 | phase-m save/load system (3 槽 + auto-save + partialize 12 + version+migrate) |
| f377d91 | phase-l 续 panel data inference |
| 49f0a10 | cleanup smoke tmp |
| 86895a0 | phase-l cycle-panel integration (CycleProjectionPanel.tsx + 1 smoke + 346/346) |
| fd305a1 | phase-k B 4 UI projection funcs + 4 smokes, 344/344 |
| 839ebc8 | phase-k cycle-and-ui-projection (3 workers, 12 items AI-6xx, 8 smokes, 340/340, dev server HTTP 200) |
| 59a0c14 | phase-j anti-pattern-collapse (3 workers, 12 items AI-5xx, 12 smokes, 332/332) |
| 6d40ae1 | tools + handoff: minimaxi quota/video + phase-i B/D receipts |
| 5b5a13f | phase-i P3 long-term (4 workers, 20 items AI-4xx, 16 smokes) |
| bf98573 | phase-h D 物品合成炼制 (1 enum + 5 interface + 5 func + 4 smoke) |
| 6267d99 | docs: phase-h P2 mid worker A/B/C completion receipts |
| b1f1ddf | phase-h P2 mid (4 workers, sect graph + npc memory + world map) |
| de7c51f | phase-g owner delegation (text cleanup + cause strengthen + smoke regression + design docs) |
| 6d40ae1 | tools + handoff: minimaxi quota/video CLIs + phase-i B/D receipts + xiaoxin self-portrait MP4 |
| e6db959 | chore: untrack nested chorus-eval/Chorus |
| 4fb39d9 | phase-f owner delegation full pipeline (4 workers, 20 items, 250+ smokes) |
| 28eea7b | docs: open phase F owner delegation full pipeline |
| e7bb273 | docs: open phase E parallel grand slam |
| 1c213c7 | feat(phase-d): modal callbacks wired to store + db migration + trae automation |
| 14b29b2 | docs: open phase D |
| 6946e86 | feat(phase-c): schema + tribulation integration + L3 tests + engine perf |
| 49d3bc7 | docs: open phase C |
| 849973f | feat(phase-b): L3 full grand slam (5 items AI-68~AI-72) |
| 4482109 | docs: open phase B |
| 499db04 | feat(phase-a): L2 contracts + L3 tribulation |
| 4a0b4ba | docs: open phase A |
| 9e46f02 | feat(p3+): slot UI coverage + L1 worldview docs + 3 pending fixes |
| b0e659b | docs: open P3 archival + slot coverage + L1 worldview |
| 2b4b8aa | docs: refactor fanren gap analysis into L1/L2/L3 layers |
| 76dcb79 | docs: fanren xiuxian gap analysis - 8 dimensions, P4 backlog (8 items) |
| 2540cfb | docs: open P2+P3 grand slam |
| 1343734 | feat(p1+p2): fixups + save-load blueprint + 6 new smokes |
| 4d61bed | docs: open P1 fixups + P2 pilot (6 items, save-load as P2 pilot) |
| de7112e | feat(p1): cleanup + design docs + causality + audit + smokes |
| 9039bc6 | docs: open P1 meeting |
| f8b24dc | feat(ui+docs): 16 UI rules full delivery + combat projection battle panel + UI/identity partition |
| b95a238 | docs: dispatch batch 3 v2 |
| 349a8d9 | feat(llm+display): status affects events + combat sync + multi-bonus + yinyuan |
| 87d31dd | feat(attrs+ui): combat projection UI + 16 UI rules batch fix |
| 5597912 | fix(combat-labels): rollback; fix(category): engine cultivation category back to English |
| 605749e | fix: stream narrative with paragraph structure |
| bb2364a | fix: lower narrative length cap |
| a0bbceb | fix: remove duplicate toast during advance |
| 0e5a806 | feat: multi-profile AI config, display registry refactor |
| bb5bcac | fix: advance-sse event persistence, world calendar progression |
| 222eb3e | Fix: const blueprint to let blueprint |
| e89d605 | Fix fallback narrative + blueprint chip leak |
| fbf918d | Fix stream route: pass full args to buildEventDisplayEffects |
| 69b2656 | Engine: narrative-driven body modifier overrides age-based body growth |
| 3ef83c1 | Engine: age-based body growth for mortals |

## 已实现功能清单（按 git commit 引用）

### phase-a / phase-b / phase-c / phase-d（499db04/849973f/6946e86/1c213c7）
- L2/L3 schema + tribulation 雷劫 + modals 接 store + db migration + Trae automation
- 5+5+4+4 items（AI-63~AI-80），13+23+11 smokes

### phase-e / phase-f（4fb39d9 + e7bb273）
- owner delegation full pipeline（4 workers 20 items 250+ smokes）
- phase E parallel grand slam（worker A 战斗突破 + worker B 炼丹阵法灵宠，10 items AI-81~AI-90）

### phase-g（de7c51f）
- text cleanup + cause strengthen + smoke regression + design docs

### phase-h P2 mid（b1f1ddf + 6267d99）
- **4 workers**：sect graph 宗门图 / npc memory NPC 长期记忆 / world map 完整世界地图
- 4 worker completion receipts

### phase-h D（bf98573）
- **物品合成炼制**：1 enum + 5 interface + 5 function + 4 smoke

### phase-i P3 long-term（5b5a13f + 6d40ae1）
- **4 workers 20 items AI-4xx + 16 smokes**
- minimaxi quota/video CLI + xiaoxin self-portrait MP4

### phase-j（59a0c14）
- **anti-pattern-collapse**：3 workers 12 items AI-5xx + 12 smokes（332/332）

### phase-k（839ebc8 + fd305a1）
- cycle-and-ui-projection：3 workers 12 items AI-6xx + 8 smokes（340/340，dev server HTTP 200）
- phase-k B：4 UI projection funcs + 4 smokes（344/344）

### phase-l（86895a0 + f377d91）
- **CycleProjectionPanel.tsx**（传承/宗门/命网/结局 4 tab UI 投影）+ 1 smoke（346/346）
- panel data inference（从 character 推断 inheritance/sect/fate/ending fallback）

### phase-m（ae6b7f2，今天 push）
- **save/load system**：3 槽 + auto-save（年龄/突破/死亡/关键剧情触发）+ partialize 12 字段 + version+migrate
- 文件：`src/lib/xianxia/save-slots.ts` + `src/lib/xianxia/useAutoSave.ts` + `src/components/xianxia/SaveSlotPanel.tsx` + page.tsx 注入
- **未做**：smoke 验证（347/347 应该），dev server 修复（String.repeat bug），

## 未实现 / 待办（按 handoff 文档实际）
- phase-m smoke 验证（save-slots list/read/write/delete + useAutoSave triggers + partialize 12 fields）
- phase-m dev server 修复（Next 16.1.3 Turbopack String.repeat(-1) bug）
- phase-m dev plan 文档化
- 多角色继承池（phase-o）
- 结局谱系 phase-u
- 因缘时间线 UI phase-v

## 已知问题
- **dev server String.repeat(-1)**：Next 16.1.3 Turbopack SSR bug，绕开方法：next dev --turbopack=false 或 build+start
- **scripts/audit-types-deep.ts TS errors**：开发审计脚本，type narrowing 失败，不影响游戏代码
- **node_modules .next 编译缓存 stale**：每次重启 dev server 前可能要清 .next

## 模块布局（src/lib/xianxia）

## 组件布局（src/components/xianxia）
（将在下一步 ls 完整列出）
## 模块布局（src/lib/xianxia / 27 个文件）

| 文件 | 大小 | 用途 |
|---|---|---|
| advance-fallback.ts | 23247B | advance 推进兜底 + AI 调用降级 |
| advance-preload.ts | 13031B | 推进前的预加载（年/事件预告） |
| ai-boundary-validator.ts | 19512B | AI 输出边界审核（不可信数据隔离） |
| ai-config-client.ts | 290B | AI 配置客户端（前端） |
| body-growth.ts | 4864B | 凡人/低境界 age-based body growth |
| constitutions.ts | 15447B | 特殊体质注册表 + 触发逻辑 |
| content-registry.ts | 17943B | AI 生成内容分类注册 + display 映射 |
| display-registry.ts | 9052B | 槽位/状态/物品 display 元数据注册 |
| display.ts | 21360B | 状态/事件/物品 → 玩家可见 UI 文本 |
| effect-resolver.ts | 4501B | effect 解析器 |
| engine.additional.tmp | 7638B | engine 中间产物（待清理） |
| engine.ts | 558445B | 核心引擎（55 万字节） |
| entity-store.ts | 8207B | 实体 store |
| event-effects.ts | 3751B | 事件 effect 处理 |
| event-scheduler.ts | 27390B | 事件调度器 |
| llm.ts | 205703B | LLM 调用层（20 万字节） |
| narrative-body-modifier.ts | 2045B | 叙事驱动的 body modifier 覆盖年龄默认 |
| narrative-inference.ts | 4396B | 叙事推断 |
| save-slots.ts | 3431B | 【phase-m】存档 3 槽（list/read/write/delete/import/export） |
| secret-realm-utils.ts | 1007B | 秘境工具函数 |
| settlement.ts | 10275B | 年度结算 |
| state-change-log.ts | 12139B | 状态变化日志 |
| store.ts | 23202B | zustand store + persist middleware |
| style-anchor.ts | 6238B | style 锚 |
| types.ts | 136241B | 全量类型定义（13 万字节） |
| useAutoSave.ts | 3489B | 【phase-m】auto-save hook（年龄/突破/死亡/剧情触发） |
| world-time.ts | 15953B | 世界时间（仙历/季节/时辰） |

## 组件布局（src/components/xianxia / 35 个组件）

| 组件 | 大小 | 用途 |
|---|---|---|
| AIConfigDialog.tsx | 17170B | AI 配置弹窗 |
| ActionButtons.tsx | 29427B | 主操作按钮（推进/重置等） |
| AlchemyFurnace.tsx | 13688B | 炼丹界面（phase-h E） |
| AscensionModal.tsx | 2838B | 飞升 modal（L3 收尾） |
| CharacterDetailSheet.tsx | 36421B | 角色详情抽屉 |
| CharacterIntentsCard.tsx | 6216B | 角色内心意向（世界内叙事） |
| ChoiceModal.tsx | 8422B | 选择弹窗 |
| CombatModal.tsx | 53014B | 战斗弹窗（核心战斗 UI） |
| CultivationSpeedCard.tsx | 12359B | 修炼速度卡片（多重加成展示 + 折叠） |
| CustomSimulationDialog.tsx | 10042B | 自定义模拟弹窗 |
| CycleProjectionPanel.tsx | 10028B | 【phase-l】轮回投影 4 tab（传承/宗门/命网/结局） |
| EventTimeline.tsx | 29487B | 事件时间线 |
| FateNodes.tsx | 3461B | 命节点展示 |
| FormationPanel.tsx | 18064B | 阵法界面（phase-h E 阵法） |
| GameMenu.tsx | 8664B | 游戏菜单（顶部条） |
| HeartDemonCard.tsx | 5271B | 心魔卡片 |
| HeartIntentPanel.tsx | 8150B | 心之所向面板（牵挂回响） |
| InterfereInput.tsx | 5717B | 天道干预输入框 |
| InventoryPanel.tsx | 37485B | 库存面板 |
| ItemDetailDialog.tsx | 7585B | 物品详情弹窗 |
| MarketModal.tsx | 22829B | 坊市弹窗 |
| MilestonesLog.tsx | 15849B | 里程碑日志 |
| PendingThreadsCard.tsx | 13177B | 未决线索卡片 |
| PetPanel.tsx | 19560B | 灵宠面板 |
| RealmOrb.tsx | 2271B | 境界玉 |
| ResetWorldButton.tsx | 6655B | 重置世界按钮 |
| RestrictionModal.tsx | 4094B | 战斗限制 modal |
| SaveSlotPanel.tsx | 7296B | 【phase-m】存档槽 3 列面板（手动/自动/导入/导出） |
| SecretRealmPanel.tsx | 22900B | 秘境面板 |
| SettlementModal.tsx | 8028B | 结算 modal |
| SimulationHallDialog.tsx | 5237B | 模拟殿弹窗 |
| StartScreen.tsx | 6130B | 开始界面 |
| StatusList.tsx | 6077B | 状态列表 |
| StatusPanel.tsx | 25178B | 状态面板 |
| TribulationModal.tsx | 4805B | 雷劫 modal |
| WorldLegacyPanel.tsx | 4813B | 世界遗产面板 |

## 完成时间

2026-06-28 14:45 GMT+8
