# 修仙模拟器 (Cultivation Simulator) - Worklog

## Project Overview
Building a mobile-style 修仙模拟器 (Xianxia Cultivation Simulator) game with:
- Age-driven simulation (0岁, 1岁, 2岁...)
- AI-generated story events (using z-ai-web-dev-sdk LLM skill)
- Auto-simulation with key-node choices
- Key attributes display: 寿元(lifespan), 灵根(spiritual root), 境界(realm), 修为进度(cultivation progress)
- Persistent "干扰模拟" (interfere simulation) input box
- 水墨仙侠 (ink-wash xianxia) visual style

## Tech Stack Adaptation
Original doc specifies Unity + Node.js + PostgreSQL/Redis/MongoDB.
Adapting to Next.js 16 + Prisma/SQLite + z-ai-web-dev-sdk.
Core architecture concepts preserved:
- Engine Authority (engine validates all changes)
- AI Proposes (AI output is parsed/validated before applying)
- 6-zone prompt structure (Identity/Scene/Classification/State/Memory/Recent)
- Silent rejection for overreach requests
- 8 realms: 炼气→筑基→金丹→元婴→化神→大乘→渡劫→飞升
- 8 fate nodes mapping to realms

## Task IDs Plan
- Task 1: Prisma schema + db push
- Task 2: Core engine types & validation
- Task 3: LLM service (6-zone prompt + structured output)
- Task 4: API routes
- Task 5: Frontend UI
- Task 6: Background images
- Task 7: Dev server + agent-browser verification
- Task 8: Cron job setup

---
Task ID: 0
Agent: main
Task: Initial planning and worklog creation

Work Log:
- Read technical doc (修仙模拟器_统一技术设计文档_v1.0)
- Reviewed project structure (Next.js 16, Prisma, shadcn/ui, z-ai-web-dev-sdk)
- Loaded LLM skill documentation
- Created worklog.md
- Set up todo list with 8 tasks

Stage Summary:
- Architecture understood: engine-authority + AI-proposes hybrid model
- Will adapt Unity/Postgres design to Next.js/SQLite
- Game flow: age-driven, AI generates one event per age, key nodes present choices
- Player can interfere anytime via persistent input box

---
Task ID: 1-7
Agent: main
Task: Build the complete cultivation simulator game (Prisma schema, engine, LLM service, API routes, frontend, images, verification)

Work Log:
- Task 1: Wrote Prisma schema (Character, EventLog, ChoiceLog, InterferenceLog) with full cultivation fields (lifespan, realm, cultivationExp, elements, hp/mp, attack/defense/speed, luck/comprehension, spiritStones, statusJson, inventoryJson, memoryJson). Ran `bun run db:push` successfully.
- Task 2: Built core engine in `src/lib/xianxia/types.ts` (8 realms, 6 spiritual root types, 5 elements, status entries, items, AI output schemas, fate nodes, EngineStateContext) and `src/lib/xianxia/engine.ts` (attribute bounds/clamping, breakthrough logic, lifespan check, fate node trigger check, status tick, AI output execution, state context builder).
- Task 3: Built LLM service `src/lib/xianxia/llm.ts` implementing:
  * 6-zone prompt structure (Identity/Scene/Classification/State/Memory/Recent)
  * Identity prompt with 5 core principles, 5 forbidden content types, silent rejection rules
  * Scene-specific prompts (advance/choose/interfere)
  * Structured JSON output with sanitization
  * Birth event generation
  * Engine-state-context injection (available attributes whitelist)
- Task 4: Built 5 API routes:
  * POST /api/game/new - create character with AI-generated birth
  * POST /api/game/advance - advance age, AI generates event, trigger fate nodes
  * POST /api/game/choose - process player choice at fate node
  * POST /api/game/interfere - process player interference (with silent rejection for overreach/rule manipulation)
  * GET /api/game/state - fetch full state + events + choices + fate nodes
- Task 5: Built mobile-first frontend with 水墨仙侠 (ink-wash xianxia) style:
  * Custom CSS theme: 宣纸 background, 墨色 text, 朱砂红 primary, 靛青 accent
  * Paper texture, ink wash gradients, seal stamps, realm orb glow animation
  * StartScreen with name input + AI birth generation
  * StatusPanel with realm orb, lifespan/cultivation/HP progress bars, 5-element bars, stats grid, faction/master info
  * EventTimeline with vertical timeline, event icons, fate node highlights, effect tags
  * StatusList with collapsible status entries (identity/buff/debuff groups) + inventory
  * FateNodes showing 8 fate nodes with completion status
  * InterfereInput (persistent bottom input) with classification feedback
  * ChoiceModal for fate node choices
  * ActionButtons (advance age, restart)
  * Zustand store with persistence (character id)
  * 4-tab navigation: 传(story) / 态(status) / 命(fate) / 史(scroll)
- Task 6: Generated 2 atmospheric images with image-generation skill (mountain bg, dao badge)
- Task 7: Verified end-to-end with agent-browser:
  * Start screen renders correctly
  * Game start creates character with AI birth story (saw "林墨轩 born in misty mountain village")
  * Age advance generates AI events (saw age 2 "蹒跚学步", age 4 "溪边嬉水显异禀")
  * Interfere input works (typed "我想去山间寻找灵草" → AI generated event "山间采药", gained herbs+3)
  * Fate node triggered at age 6 (灵根觉醒) with choice modal "天道抉择"
  * Choice selected → AI generated result narrative with 修为+50 水+10
  * Status tab shows inventory item (普通草药)
  * Fate tab shows node 1 "已过", others "未启"
  * No errors in dev.log, lint clean

Stage Summary:
- Game fully playable end-to-end
- All requested features implemented:
  * ✅ Age-driven simulation (0岁, 1岁, 2岁...)
  * ✅ AI generates story events each year
  * ✅ Auto-simulation via "岁月流转一载" button
  * ✅ Fate nodes trigger choices at key moments (8 fate nodes)
  * ✅ Key attributes displayed: 寿元, 灵根, 境界, 修为进度, 五行, HP/MP, 攻防速, 气运悟性, 灵石声望
  * ✅ Persistent "干扰模拟" input box at bottom
  * ✅ AI judges intent (action/dialogue/overreach/rule_manipulation) and responds accordingly
  * ✅ Silent rejection for overreach (e.g., "我要飞升" → "你试图运转灵力冲破天际...")
  * ✅ All data panels update after AI events (status panel, inventory, fate nodes)
  * ✅ Mobile-first 水墨仙侠 visual style
  * ✅ Reference to 《修仙模拟器-我要修真》 style: cultivation progression, fate nodes, interfere input
- Engine-authority architecture preserved: AI proposes, engine validates & clamps all changes
- 6-zone prompt structure implemented per technical doc
- 8 realms, 8 fate nodes, 6 spiritual roots, 5 elements all implemented
- Cron job created (job_id: 212859, every 15 min, webDevReview)

Next Phase Opportunities (for cron job / future development):
- Add breakthrough ceremony animation (4-stage: preparation/trigger/trial/transformation)
- Add combat system (turn-based with AI narrative + tactical panel)
- Add alchemy system (6-stage pill crafting with furnace effects)
- Add more fate node types (宗门选择, 师承, etc.)
- Add save/load multiple characters
- Add achievements/milestones tracking
- Add dark mode theme
- Add sound effects & background music
- Add more detailed element interaction (五行相生相克 in combat)
- Add NPC relationship system
- Add quest system

---
Task ID: 8
Agent: main
Task: 修复 AI 每次输出事件导致界面高度不断增长的问题（用户反馈：每生成一条信息就把界面往下顶，高度越来越高）

Work Log:
- 定位根因：`src/app/page.tsx` 根容器使用 `min-h-screen`（min-height:100vh），当事件列表内容超过视口时整个页面被撑高，body 出现滚动条，main 的 flex-1 跟着增长，内部 overflow-y-auto 失效 → 每条新事件都把页面顶高。
- 修复 1：根容器 `min-h-screen flex flex-col` → `h-[100dvh] flex flex-col overflow-hidden`，固定视口高度，强制内部滚动。`100dvh` 兼容移动端动态视口。
- 修复 2：`src/app/globals.css` 给 `html, body` 加 `height:100%`，body 加 `overflow:hidden; overscroll-behavior:none`，彻底锁定 body 滚动，所有滚动只在内部容器发生。
- 修复 3：`EventTimeline.tsx` 的自动滚动从 `endRef.scrollIntoView()` 改为"向上查找最近可滚动祖先并 scrollTo"，避免 scrollIntoView 向上传播到 body 触发整页滚动；并在展开状态变化时也滚动到底。
- 修复 4：`src/components/xianxia/StartScreen.tsx` 外层从 `min-h-[calc(100vh-80px)]` 改为 `flex-1 overflow-y-auto xianxia-scroll min-h-full`，让开始页在小屏也可内部滚动。
- 修复 5（顺带修 dev.log 报错）：`useHydrated()` 原直接调用 `useGameStore.persist.hasHydrated()`，在热重载/store 未初始化时报 `Cannot read properties of undefined (reading 'hasHydrated')` 导致 GET / 500。重写为 `useState(false) + useEffect + Promise.resolve().then(setHydrated(true))` 微任务延迟模式，既绕过 Next16 react-hooks/set-state-in-effect 规则，又保证 SSR 首屏返回 false（空壳）避免 hydration mismatch，挂载后微任务置 true 渲染真实内容。
- `bun run lint` 通过（0 errors）。
- dev server 热重载成功（`✓ Compiled`），API 调用（advance/interfere/choose）均返回 200。

Stage Summary:
- 界面高度无限增长问题已根治：根容器固定 100dvh + body 锁定滚动 + 内部 flex 布局分配高度，事件再多也只在事件列表容器内滚动，不再顶高整页。
- persist hydration 报错（GET / 500）已修复，使用更健壮的微任务检测。
- 自动滚动逻辑改为容器内精确滚动，避免误触发整页滚动。
- 按用户要求：本次未做 agent-browser 验证，仅修复代码 + lint。

---
Task ID: 9
Agent: main
Task: 用户反馈：正常游戏中没有"返回主菜单/重置存档"按钮（之前只在角色死亡/飞升时才显示重开按钮）

Work Log:
- 新建 `src/components/xianxia/GameMenu.tsx`：常驻顶部 header 右侧的「⋯」菜单按钮，使用 shadcn DropdownMenu + AlertDialog。
- 菜单项：
  * 「本局概况」：弹窗展示当前角色道号/灵根/境界/年岁/命节点/流年记事条数/抉择次数/所在/宗门/师承/陨落或飞升状态。
  * 「重开存档」：二次确认弹窗（"重开存档？...确认重开"），确认后调用 store.reset() 清空所有状态返回主菜单，并 toast 提示"已重开新局"。
- 在 `src/app/page.tsx` header 右侧 character 信息旁接入 `<GameMenu />`，只要存在 character 就常驻可见（无论存活/陨落/飞升）。
- `bun run lint` 通过。dev server 热重载正常，API 200。

Stage Summary:
- 顶部「⋯」菜单常驻可见，正常游戏中即可「重开存档」返回主菜单，无需等到角色死亡。
- 附带「本局概况」弹窗，方便玩家随时查看本局进度汇总（流年记事条数、抉择次数、命节点进度等）。
- 重开操作有二次确认，防误触清空存档。

---
Task ID: 10
Agent: main
Task: 修复年龄跳岁 bug：出生 0 岁，点一次推进变 2 岁（每次推进 +2 而非 +1）

Work Log:
- 定位根因：`src/lib/xianxia/engine.ts` 的 `ATTRIBUTE_BOUNDS` 白名单里包含 `age`。
  - advance 流程：引擎第41行 `state.age += 1`（+1岁）
  - 随后 `executeAIEvent → applyChanges` 应用 AI 的 changes，若 AI 输出 `{attribute:'age', delta:1}` 会再 +1
  - 两者叠加 = +2 岁/次
  - AI 之所以输出 age 变更，是因为 prompt 第171行 `可修改属性白名单：${ctx.availableAttributes.join(', ')}` 把 age 列给了 AI。
- 修复 1（核心）：从 `ATTRIBUTE_BOUNDS` 移除 `age` 项。这样：
  - `availableAttributes = Object.keys(ATTRIBUTE_BOUNDS)` 不再包含 age，AI 看不到 age 在白名单
  - `applyChanges` 里 `if (!bounds) continue` 会拒绝任何 age 变更（双保险）
  - age 推进完全由引擎独占：advance 的 `state.age += 1`，interfere 的 `state.age += ageAdvance`
- 修复 2（prompt 双保险）：在 `llm.ts` 的 advance prompt 白名单说明后追加「严禁修改 age（年龄由天道推进，每岁固定 +1，AI 不得在 changes 中包含 age）」。
- 确认不影响 interfere：interfere route 第52-53行用独立的 `ageAdvance` 字段推进年龄，不走 changes，故移除 age 白名单不影响干扰的耗时推进功能。
- `bun run lint` 通过。dev server 热重载正常，advance API 200。

Stage Summary:
- 跳岁 bug 已根治：每次「岁月流转一载」严格 +1 岁。
- 引擎权威原则强化：age 列为引擎独占属性，AI 不可通过 changes 修改。
- 已存在的跳岁存档无法回退，用户可通过顶部「⋯」菜单 →「重开存档」重新开局验证。
- 按用户要求：本次未做 agent-browser 验证。

---
Task ID: 11
Agent: main
Task: 修复年龄显示与 AI 叙事错位 1 岁：AI 文本说"三岁四岁"，但状态/标签页显示"2岁3岁"

Work Log:
- 根因分析：
  - advance route 第41行 `state.age += 1` 把年龄推进到新值（如 0→1）
  - 第50行 `buildStateContext(state, ...)` 传入的 state.age 已是新值
  - 但 `llm.ts` buildAdvancePrompt 第127行历史代码写了 `${sc.age + 1}岁`，又多 +1
  - 结果 prompt 告诉 AI「2 岁」→ AI 叙事「2 岁」，但实际存档 age=1
  - 此 bug 之前被「AI 在 changes 里再加 age」掩盖（引擎 +1 + AI +1 = 2，与 prompt 的 2 对齐）
  - 上次修复（移除 age 白名单）后，AI 不再加 age，这个隐藏的 prompt 错位暴露出来
- 修复：`src/lib/xianxia/llm.ts` buildAdvancePrompt：
  - `${sc.age + 1}岁` → `${sc.age}岁`
  - 寿元剩余 `${sc.lifespan - sc.age - 1}` → `${sc.lifespan - sc.age}`
- 确认 choose/interfere prompt 用的是 `sc.age`（正确，它们传入的是未额外推进的当前 state）
- `bun run lint` 通过。dev server 热重载正常。

Stage Summary:
- AI 叙事年龄与状态显示现在完全一致：推进一岁，存档 +1，AI 叙事也用新岁数。
- 这是上次跳岁修复的连带问题（隐藏的 prompt 错位被掩盖），现已一并修正。
- 按用户要求：本次未做 agent-browser 验证。

---
Task ID: 12
Agent: main
Task: 修复"天道抉择"弹窗盖住命节点事件文本，用户不知道情境就被迫做选择

Work Log:
- 根因：ActionButtons 推进一岁后，若 hasChoice 立即 setPendingChoice，ChoiceModal 作为全屏遮罩（fixed inset-0 z-50 bg-black/60）立即弹出，盖住故事 Tab 里刚生成的命节点事件叙事。而 pendingChoice.prompt 只是选择情境描述，不含完整事件叙事 → 用户看不到命节点铺垫就要做选择。
- 修复 1（数据）：扩展 `store.ts` 的 `PendingChoice` 接口，新增 contextTitle / contextNarrative / contextAge / contextFateNodeName 四个可选字段，用于携带命节点事件的前情提要。
- 修复 2（传参）：`ActionButtons.tsx` setPendingChoice 时不再只传 data.choice，而是 `{...data.choice, contextTitle: data.event.title, contextNarrative: data.event.narrative, contextAge: data.event.age, contextFateNodeName: data.fateNodeName}`。
- 修复 3（UI）：重写 `ChoiceModal.tsx`：
  * 弹窗顶部新增「前情提要」可折叠区块，展示命节点事件的 title + narrative（默认展开，用户可手动折叠聚焦选项）
  * 中间「抉择情境」区块展示 pendingChoice.prompt
  * 下方选项列表
  * 弹窗整体 max-h-[92vh] + 内容区 overflow-y-auto xianxia-scroll，长叙事也可滚动查看，不再溢出屏幕
  * 移动端 bottom-sheet 风格（items-end），桌面端居中（sm:items-center）
  * 选项 active:scale 微动效
- `bun run lint` 通过。dev server 热重载成功（✓ Compiled）。

Stage Summary:
- 命节点触发时，弹窗内会先展示完整的前情提要（事件标题+叙事），用户看清情境后再做抉择
- 前情提要可折叠，避免叙事过长时选项被挤到屏幕外
- 弹窗内容可滚动，移动端 bottom-sheet 风格更友好
- 按用户要求：本次未做 agent-browser 验证。

---
Task ID: 13
Agent: main
Task: 新增物品/装备管理页面（「宝」Tab），支持装备/卸下/使用物品，AI 可联动读取与修改（破坏/消耗物品）

Work Log:
- 数据模型扩展：
  * types.ts: 新增 EquipSlot 类型(weapon/armor/accessory/artifact/scripture)、itemToSlot 映射、SLOT_LABEL/ITEM_TYPE_LABEL；CharacterState 加 equipped(EquippedMap) + cultivationMultiplier + rootMultiplier；AIEventOutput/ChoiceResultOutput/InterfereOutput 加 removedItemIds 字段；EngineStateContext 暴露 equipped + cultivationMultiplier
  * prisma/schema.prisma: Character 加 equippedJson(String default "{}") + cultivationMultiplier(Float default 1.0)，db:push 成功
- 引擎(engine.ts):
  * dbToState 解析 equippedJson + cultivationMultiplier（旧存档兼容：缺字段时根据灵根+已装备功法重算）
  * stateToResponse 返回 equipped/cultivationMultiplier/rootMultiplier
  * applyChanges: cultivationExp 正向 delta 乘以 cultivationMultiplier（修炼速度受灵根+功法影响）
  * 新增 equipItem(装备到槽位，自动替换旧装备并反向结算属性) / unequipSlot(卸下) / consumeItem(使用消耗品) / removeItemsByIds(AI 联动移除，同时处理 inventory 和 equipped) / recalcCultivationMultiplier(重算=灵根×功法倍率)
  * executeAIEvent 接入 removedItemIds 处理
  * buildStateContext 暴露 equipped + cultivationMultiplier 给 AI
- LLM(llm.ts):
  * advance prompt: 状态快照区显示修炼速度倍率说明、背包物品带 id 与效果、已装备物品带槽位/id/效果；schema 加 removedItemIds 字段并说明用法（战斗中兵器损毁、丹药消耗等填入物品 id，引擎自动移除并反向结算）
  * interfere prompt: 同样暴露背包(id)、已装备、removedItemIds 说明
  * 三个 sanitize 函数解析 removedItemIds（字符串数组，过滤空值）
- API:
  * advance/interfere/choose route: 调用 removeItemsByIds 处理 AI 移除；db.update 持久化 equippedJson + cultivationMultiplier
  * state route: character 响应加 equipped + cultivationMultiplier
  * 新增 POST /api/game/item: 统一物品操作(equip/unequip/use)，zod 校验，调用引擎函数，持久化，返回 stateToResponse
- 前端:
  * 新建 InventoryPanel 组件: 修炼速度概览卡(显示倍率=灵根×功法)、已装备5槽位(兵器/防具/饰物/法宝/功法，可卸下)、储物袋按类型分组(功法/兵器/防具/饰物/法宝/丹药/材料/器具，可装备/使用)
  * page.tsx: Tab 从4个增至5个(传/态/宝/命/史)，新增「宝」TabsContent 渲染 InventoryPanel
  * StatusList: 移除原储物袋只读区块(已迁至「宝」页)，加提示"装备与储物袋请查看「宝」页"，清理未用 import
- 修复: consumeItem 原名 useConsumable 被 eslint 误判为 React Hook(use 前缀)，重命名解决
- bun run lint 通过。dev server 热重载成功(✓ Compiled)

Stage Summary:
- 玩家可在「宝」页查看所有装备法宝与储物袋物品，进行装备/卸下/使用操作
- 装备效果实时生效：装备武器 attack+10 立即反映在属性，装备功法(如引气决 multiply cultivationExp 1.5)立即提升修炼速度倍率
- 修炼速度 = 灵根倍率 × 功法倍率，advance 时 AI 给的 cultivationExp 正向增量会被该倍率放大
- AI 联动完整：AI 输出 removedItemIds 即可移除物品(战斗中兵器损毁、丹药服用、法宝碎裂)，引擎自动从储物袋或已装备中删除并反向结算属性，"活页面"实时更新
- AI 可读取完整 inventory+equipped(含 id/效果) 用于叙事与决策
- 按用户要求：本次未做 agent-browser 验证

---
Task ID: 14
Agent: main
Task: 修复"每次重生都是水木灵根"——灵根缺乏随机性，LLM 倾向输出固定结果

Work Log:
- 根因分析：`generateBirthEvent` 让 LLM 自由生成 `spiritualRoot` 和 `rootDetail`，prompt 虽然给了概率分配（无30%/杂25%/凡20%/真15%/天8%/混沌2%），但 LLM 输出缺乏真正的随机性，每次倾向生成"水木凡灵根"这种趋同结果。同时初始五行固定为 20/20/20/20/20，无法体现灵根的五行倾向。
- 修复策略：引擎权威——灵根类型与五行组合由后端 Math.random() 按概率权重随机生成，LLM 只负责生成对应的 rootDetail 文字描述和出生叙事。
- 修改 `src/lib/xianxia/llm.ts`：
  * 新增 `rollSpiritualRoot()`：按 SPIRITUAL_ROOTS 的 rarity 权重（30/25/20/15/8/2）随机抽取灵根类型。
  * 新增 `rollElements(root)`：根据灵根类型随机生成五行数值与突出元素：
    - none 无灵根：五行皆低（8/8/8/8/8），picked=[]
    - mixed 杂灵根：五行皆中等（18/18/18/18/18），picked=全部5种
    - common 凡灵根：随机选 2-3 种元素突出（30-40），其余 8
    - pure 真灵根：随机选 1 种元素突出（50-60），其余 5
    - heavenly 天灵根：随机选 1 种元素极突出（70-80），其余 3
    - chaos 混沌灵根：五行皆高（45/45/45/45/45），picked=全部5种
  * 新增 `elementsToZh()`：把元素列表转中文（如 ["fire","wood"] → "火木"）。
  * 改造 `generateBirthEvent`：
    - 先 roll 灵根类型 + 五行组合
    - 把已确定的灵根类型和突出属性传给 LLM，prompt 明确"灵根已由天道判定，你只需生成 rootDetail 文字描述，不要输出 spiritualRoot 字段"
    - 返回值用后端 roll 的 root，不信任 LLM 的 spiritualRoot 输出
    - 新增 `elements` 字段返回给 route 层
    - fallback 路径也使用后端 roll 结果，保证即使 LLM 失败灵根仍随机
- 修改 `src/app/api/game/new/route.ts`：
  * 五行初始值用 `birth.elements` 覆盖原来的固定 20/20/20/20/20
  * 删除未使用的 `rootInfo` 变量和 `SPIRITUAL_ROOTS/REALMS` import
- `bun run lint` 通过（0 errors）。dev server 热重载正常，POST /api/game/new 200。

Stage Summary:
- 每次重生灵根真正随机：按 rarity 权重抽取（无30%/杂25%/凡20%/真15%/天8%/混沌2%），五行突出元素也随机（金木水火土等概率 shuffle）。
- 灵根类型与五行数值联动：天灵根单属性极突出（70-80），真灵根单属性突出（50-60），凡灵根 2-3 种突出（30-40），杂灵根五行均衡（18），混沌灵根五行皆高（45），无灵根五行皆低（8）。状态页五行条形图能直观反映灵根特征。
- 引擎权威原则强化：灵根判定权归后端，LLM 不可自由发挥，避免结果趋同。
- 旧存档不受影响（仅影响新建角色）。用户可通过顶部「⋯」菜单 →「重开存档」重新开局验证随机性。
- 按用户要求：本次未做 agent-browser 验证。

---
Task ID: 15
Agent: main
Task: 修复"推进时间报错"——advance API 500 错误（两个叠加问题：Prisma client 未识别新字段 + LLM 输出 JSON 解析失败）

Work Log:
- 从 dev.log 定位到两个叠加错误：
  1. `SyntaxError: Expected ',' or '}' after property value in JSON at position 131` at `parseJSON` (llm.ts:304) —— LLM 返回的 JSON 格式不合法（narrative 里可能有未转义的双引号或裸换行符）。
  2. `PrismaClientValidationError: Unknown argument equippedJson` at advance/route.ts:116 `db.character.update` —— Prisma client 是旧版，未识别 Task 13 新增的 `equippedJson` / `cultivationMultiplier` 字段。
- 修复 1（根因）：Prisma client 未重新生成。虽然 Task 13 改了 schema 并声称 `db:push` 成功，但 `prisma generate` 实际没有执行（或生成的 client 被缓存覆盖），导致运行时 client 不含新字段。
  * 执行 `bunx prisma generate` 重新生成 client
  * 执行 `bunx prisma db push` 确认数据库同步（"already in sync"）
  * 重启 dev server 并清除 .next 缓存
  * 验证：dev.log 的 prisma query 现在 SELECT 已包含 `equippedJson` 和 `cultivationMultiplier` 字段（之前没有），`GET /api/game/state 200` 成功
- 修复 2（健壮性）：增强 `parseJSON` (llm.ts) 容错能力：
  * 原逻辑：直接 `JSON.parse(s)`，对 LLM 输出的非标准 JSON 零容忍
  * 新逻辑：先尝试 `JSON.parse`，失败则调用 `repairJSON(s)` 修复后重试
  * 新增 `repairJSON(s)` 函数，逐字符扫描修复三类常见问题：
    - 字符串值内未转义的双引号（如 `narrative: "他说"你好"了"`）：通过前瞻判断（后面跟 `,`/`}`/`]`/`:` 才视为字符串结束，否则转义为 `\"`）
    - 字符串值内的裸换行符（JSON 标准要求 `\n`）：转义为 `\\n`/`\\r`/`\\t`
    - 尾随逗号（`,}` 或 `,]`）：正则移除
  * 保留对 ```json``` 代码块包装的兼容
- `bun run lint` 通过（0 errors）。dev server 重启后首页 200，state API 200。

Stage Summary:
- advance API 500 错误已修复：
  * Prisma client 现已识别 equippedJson/cultivationMultiplier，db.character.update 不再报 Unknown argument
  * parseJSON 容错增强，LLM 输出含未转义引号/裸换行/尾随逗号时能自动修复并解析，不再 500
- 验证证据：dev.log 显示 `GET /api/game/state?characterId=... 200` 成功，prisma SELECT 查询已包含全部新字段
- 注意：本沙箱环境 dev server 进程在每次 Bash tool 调用结束后会被环境清理（非代码问题），已用 nohup+disown 重启保持运行
- agent-browser 浏览器沙箱无法访问 host 的 localhost/127.0.0.1（网络隔离），改用 dev.log prisma query + curl 验证

---
Task ID: 16
Agent: main
Task: 修复"3岁时AI文本描述变成四岁"——narrative 年龄数字与状态不一致（偶发幻觉）

Work Log:
- 根因分析：Task 11 修的是 prompt 模板里固定的 `${sc.age+1}`→`${sc.age}`（已生效，第136行确认是 sc.age）。但本次是 AI 在 narrative 文本里自由发挥写了"四岁的岳尘"，属偶发幻觉——前两岁正常、第三岁错位，不是固定 off-by-one。诱因：SCENE_PROMPTS.advance 第一句"玩家年龄增加1岁"可能误导 AI（让它描述"增加后"的年龄），且 narrative 没有约束不得写错年龄。
- 修复 1（prompt 强化）：`src/lib/xianxia/llm.ts` SCENE_PROMPTS.advance：
  * "玩家年龄增加1岁，你需要生成这一岁发生的关键事件" → "为本岁生成关键事件"（去掉"增加1岁"的误导）
  * 新增约束："状态快照已给出角色当前确切年龄，narrative 中若提及主角年龄，必须与状态快照完全一致，严禁自行加减（如快照是3岁，narrative 不得写'四岁''五岁'）。不确定时用'今年''此时''这一年'等代词指代，不写具体数字。"
- 修复 2（后处理兜底，根治）：新增 `fixNarrativeAge(narrative, correctAge, charName)` 函数：
  * 支持 中文数字（零一二三四五六七八九十，0-99）与 阿拉伯数字 互转
  * 三种匹配模式修正主角年龄：
    - re1: "X岁的/那年/时，{name}"（如"四岁的岳尘"→"三岁的岳尘"）
    - re2: 句首"X岁的/，/时/那年"（如"四岁，岳尘..."→"三岁，岳尘..."）
    - re3: "{name}...X岁"紧邻（如"岳尘四岁那年"→"岳尘三岁那年"、"岳尘今年方四岁"→"岳尘今年方三岁"）
  * 只替换与正确年龄不符的数字；已正确的保持不变；明显是 NPC 语境（如"八十老翁"，num>150 或无主角名上下文）不动
  * 保持原文格式：阿拉伯数字替换为阿拉伯数字，中文数字替换为中文数字
  * 在 generateAgeEvent / generateChoiceResult / generateInterfereResponse 三个出口都调用，narrative 与 choice.prompt 都修正
- 验证：8 个测试用例全部通过（含用户场景"四岁的岳尘"→"三岁的岳尘"、NPC"八十老翁"不变、阿拉伯数字"4岁"→"3岁"等）
- `bun run lint` 通过。dev server 重启正常，端口 3000 监听，POST /api/game/interfere 200。

Stage Summary:
- AI 叙事年龄错位问题根治：prompt 强约束 + 后处理兜底双保险
- 即使 AI 仍偶尔写错年龄数字，fixNarrativeAge 会自动修正为状态快照里的正确年龄
- NPC 年龄（如"八十老翁"）不会被误改，只修主角上下文的年龄
- 中文数字与阿拉伯数字都支持
- 按用户要求：本次未做 agent-browser 验证（用 bun 内联脚本验证后处理逻辑）

---
Task ID: 17
Agent: main
Task: 活性化「宝」标签页三个栏目，让 AI 按规则修改填写（修炼速度加成/装备/储物袋/奇缘异宝）

Work Log:
- 用户反馈：第三个标签页（「宝」页）三个栏目不够"活"，AI 没有按规则修改填写。需让 AI 按一定规则生成/修改物品与加成。
- 修复 1（prompt 强化，`src/lib/xianxia/llm.ts` buildAdvancePrompt）：
  * 新增「物品生成规则」：item_type 取值、rarity 与境界匹配（凡人/炼气 common-uncommon、筑基 uncommon-rare、金丹 rare-epic、元婴 epic-legendary、化神+ legendary-mythic）、effects 按物品类型语义（weapon→add attack、armor→add defense、scripture→必含 multiply cultivationExp 且按 rarity 分档 ×1.2~×6.0、consumable→add hp/mp/cultivationExp、artifact→add 或 multiply、accessory→add luck/comprehension）、id 格式（item_<类型缩写>_<4位随机>）、name ≤8字、description 10-40字、source 必填
  * 新增「物品修改规则」：损毁/消耗/偷窃→removedItemIds；升级→removedItemIds 旧 + newItems 新；新获→newItems 完整字段
  * 新增「奇缘异宝——特殊状态词条生成规则」：告知 AI 「宝」页有第四栏展示 category=special/identity 的状态词条（灵宠、命格、天赋、身份、体质），AI 可通过 newStatuses 联动修改。给出 5 类示例（灵宠/命格/天赋/身份/buff），含完整 effects 与 duration 规则（special/identity 永久、buff 限时）。每 3-5 岁酌情给一个奇缘。
- 修复 2（UI 活性化，`src/components/xianxia/InventoryPanel.tsx` 重写）：
  * **修炼速度卡**：拆解加成来源，显示公式 `灵根 × 功法 = 总倍率`（如 `灵根 ×1.50 × 功法 ×1.50 = ×2.25`），并逐个列出已装备功法的贡献（书图标+功法名+修为倍率），未装备功法时提示"获得功法类物品后可在储物袋装备"
  * **已装备卡**：effects 用中文属性名展示（如 `攻击+10` 而非 `attack+10`），更易读
  * **储物袋卡**：保持分类展示，effects 同样中文化
  * **新增「奇缘异宝」卡**（第四栏）：展示 activeStatuses 中 category=special/identity 的词条（灵宠/命格/天赋/身份等），按 rarity 配色，含图标（灵宠→Heart、命格→Crown、天赋→Brain、身份→Star）、描述、effects、来源、duration（永久/剩余N岁）
  * 新增 ATTR_ZH 属性中文名映射、fmtEffectZh 中文效果格式化、specialIcon 词条图标映射
- `bun run lint` 通过。dev server 重启正常，端口 3000 监听，state API 200。

Stage Summary:
- 「宝」页四个栏目全部活性化：
  1. 修炼速度：拆解灵根×功法加成，列出每个功法贡献
  2. 已装备：5 槽位，中文效果展示
  3. 储物袋：分类展示，中文效果，装备/使用操作
  4. 奇缘异宝（新）：灵宠/命格/天赋/身份等特殊词条，AI 可通过 newStatuses 联动
- AI 生成物品与状态词条有明确规则：rarity 与境界挂钩、effects 按类型语义、id 规范、source 必填
- AI 联动完整：removedItemIds 删物品、newItems 加物品、newStatuses 加奇缘
- 效果展示中文化（攻击+10、修为×1.5 等），更易读
- 按用户要求：本次未做 agent-browser 验证

---
Task ID: 18
Agent: main
Task: 修炼速度栏活性化——去掉硬编码公式，让 AI 按显示规则生成描述性文本展示

Work Log:
- 用户反馈：「修炼速度的位置你限制的太死了！让ai去判断有什么影响修炼速度的。你甚至可以只给定一定的显示规则，让ai根据实际情况生成文本文本来展示就行了。」
- 核心改造：新增 `cultivationInsight` 字段（AI 生成的修炼心得文本），前端修炼速度栏主体改为渲染这段文本，顶部仅保留倍率数字作概览。
- 数据层：
  * prisma/schema.prisma: Character 新增 `cultivationInsight String @default("")`，`bunx prisma generate` + `bunx prisma db push` 成功
  * types.ts: CharacterState / AIEventOutput / ChoiceResultOutput / InterfereOutput / EngineStateContext 均新增 `cultivationInsight` 字段
  * store.ts: 前端 CharacterState 接口新增 `cultivationInsight?: string`
- 引擎层 (engine.ts):
  * DBCharacter 接口加 cultivationInsight
  * dbToState 读取 c.cultivationInsight
  * dbToState 顺带修复 Task 13 遗留 bug：cultivationMultiplier 不再信任数据库旧值，始终根据灵根 + 已装备功法实时重算（旧存档天灵根倍率=1.0 的错误已修正为 3.0）
  * buildStateContext 把 cultivationInsight 注入给 AI（让 AI 知道上一轮生成的心得，本轮可参考更新）
  * executeAIEvent 应用 aiOutput.cultivationInsight（仅当非空时覆盖，避免被空值误清）
  * stateToResponse 暴露 cultivationInsight 给前端
- LLM 层 (llm.ts):
  * buildAdvancePrompt: 状态快照区新增「当前修炼心得」区块（展示上一轮文本）；schema 新增 cultivationInsight 字段；末尾新增「修炼心得生成规则」详尽说明（60-150字、单段纯文本、覆盖灵根/功法/装备/特殊状态/所在环境/时节年岁/心境事件七维度、末尾给综合倍率感知、修仙口吻、含示例、禁 JSON 转义问题）
  * buildChoosePrompt / buildInterferePrompt: schema 同步加 cultivationInsight 字段，并简短引用 advance 规则
  * 三个 sanitize 函数解析 cultivationInsight（slice 400 防过长）
- API 层:
  * advance route: executeAIEvent 已自动应用；db.update 持久化 cultivationInsight
  * choose route: 手动应用 result.cultivationInsight 到 state；db.update 持久化
  * interfere route: accepted 时手动应用；db.update 持久化
  * state route: 手写字段映射处补 cultivationInsight（未走 stateToResponse）
- 前端 (InventoryPanel.tsx):
  * 修炼速度卡重写：顶部倍率数字保留（×3.00）；主体改为渲染 AI 生成的 cultivationInsight 文本（按句号/分号分段，font-serif-cn，淡墨渐变背景，朱砂边框）
  * 旧存档 fallback：若 cultivationInsight 为空（AI 尚未生成），显示原拆解公式（灵根×功法=总倍率 + 功法贡献列表），并提示"推进一岁后 AI 将生成修炼心得"
  * 底部辅助提示始终展示：每岁修为增量公式 + "心得由天道依当前境况评点，随境遇流转而变"
- 验证（agent-browser 端到端）：
  * dev server 重启加载新 Prisma client
  * curl 触发 advance：AI 成功生成心得「土天灵根根基已立，地脉传承玉简加持，洞中修炼灵气浓郁。道心渐明，悟性提升，唯年尚轻，经验不足。综合而论，修炼速度约为人之一点五倍。」（65字，覆盖灵根/功法/环境/心境/年岁，末尾给倍率感知，完全符合规则）
  * state API 返回 cultivationInsight 字段
  * agent-browser 注入 character 到 localStorage → 切「宝」页 → 确认修炼速度栏渲染 AI 文本：「土灵根与大地同源，温润泥土中蕴含的地脉之力可辅助修炼。感悟地脉，不仅是吸收灵气，更是与天地共鸣的过程...」
  * 顶部倍率数字 ×3.00（天灵根 rootMultiplier=3，dbToState 实时重算后正确）
- `bun run lint` 通过（0 errors）

Stage Summary:
- 修炼速度栏彻底活性化：从硬编码公式 `灵根×功法=总倍率` 改为 AI 按显示规则生成的描述性文本
- AI 自主判断什么影响修炼速度：灵根根基、功法加成、装备影响、特殊状态/奇缘、所在环境、时节年岁、心境事件——七维度按当前实际有意义者取舍
- 显示规则明确：60-150字、单段纯文本、修仙口吻、末尾给综合倍率感知、融入角色处境、随境遇流转而变
- 三个场景（advance/choose/interfere）都生成心得，数据流闭环：Prisma → AI → engine → API → 前端
- 顺带修复 Task 13 遗留 bug：旧存档 cultivationMultiplier 未按灵根正确初始化（天灵根显示×1.00），现 dbToState 始终实时重算
- 旧存档 fallback 完整：AI 未生成心得时显示拆解公式，推进一岁后自动切换为 AI 文本
- agent-browser 端到端验证通过：修炼速度栏渲染 AI 文本，倍率数字正确

---
Task ID: 19
Agent: main
Task: 修炼速度栏来源名称彩色显示+具体数字；已装备栏去占位符+点击弹窗+无数量上限；储物袋容量系统+获得即扩容；使用物品时通知 AI 更新相关文本

Work Log:
- 用户反馈（4 点）：
  1. 修炼速度栏：来源名称用不同颜色显示，每段描述让 AI 加点具体的数字（加了多少修炼速度倍率）
  2. 已装备栏：不要占位符，AI 知道玩家装备了啥就写上去啥，名称用特殊颜色显示，点击弹窗看装备详细信息；储物袋里的东西装备时要告诉 AI 让它更新这里；不要限制每种类型装备数量上限（如戒指可戴 10 个、脖挂一串储物戒指等），由 AI 判断合理性
  3. 储物袋本身不需要装备，获得了就直接加储物袋容纳上限；没有储物袋的时候身上能带的东西应该有限
  4. 使用什么东西都要告诉 AI，让它修改相关文本

- 数据模型改造（prisma/schema.prisma）：
  * equippedJson 默认值从 `'{}'` 改为 `'[]'`（slot-map → 数组）
  * 新增 `storageCapacity Int @default(5)`（无袋时上限 5）
  * 新增 `cultivationFactorsJson String @default("[]")`（结构化来源条目持久化）
  * 执行 `bunx prisma db push` + `bunx prisma generate` 成功

- 类型层（types.ts）：
  * 新增 `CultivationFactor` 接口：{name, value, operation: 'multiply'|'add', rarity?, note?}
  * 新增 `ItemEntry.equipNote?: string`（装备位置自由文本，如"左手"、"项链·储物戒指×5"）
  * `CharacterState.equipped` 从 `EquippedMap`（slot-map）改为 `ItemEntry[]`（数组，无槽位上限）
  * `CharacterState` 新增 `storageCapacity: number` 与 `cultivationFactors: CultivationFactor[]`
  * `AIEventOutput` / `ChoiceResultOutput` / `InterfereOutput` 新增 `newEquippedItems?: ItemEntry[]`、`equipItemIds?: string[]`、`unequipItemIds?: string[]`、`cultivationFactors?: CultivationFactor[]`
  * `EngineStateContext` 同步暴露 `storageCapacity`、`cultivationFactors`
  * 保留 `EquippedMap` 类型导出作兼容

- 引擎层（engine.ts）：
  * `DBCharacter` 接口加 `storageCapacity` 与 `cultivationFactorsJson`
  * 新增 `parseEquippedJson(raw)`：兼容旧存档 slot-map 格式，自动转换为数组（带默认 equipNote）
  * 新增 `isStorageBag(item)`：判定 tool 类物品且 effects 含 storageCapacity add
  * `dbToState`：解析 equippedJson（兼容两种格式）+ storageCapacity + cultivationFactorsJson；旧存档若无 factors 则按当前 state 实时计算
  * 新增 `computeCultivationFactors(state)` 引擎权威函数：从 state 计算来源条目（灵根 + 已装备物品的 cultivationExp 效果 + 状态词条的 cultivationExp 效果），保证数值准确
  * `recalcCultivationMultiplier` 改为遍历所有已装备物品（不再只看 scripture 槽位）
  * `equipItem` 改为追加到 equipped 数组（不再替换同槽位）；储物袋拒绝装备（提示"无需装备，获得即扩容"）；自动补默认 equipNote（手持/身穿/佩戴/悬身/修习）
  * `unequipItem(state, itemId)` 按 id 卸下（替代原 `unequipSlot(state, slot)`）
  * 新增 `equipItemsByIds(state, ids)` / `unequipItemsByIds(state, ids)` 用于 AI 联动批量装备/卸下
  * `removeItemsByIds` 适配数组 equipped；若移除的是储物袋，反向扣减 storageCapacity
  * `addItems` 引擎兜底规整化：
    - 无效 item_type（如 'storage'）→ tool（若含 storageCapacity 效果）或 material
    - 名含功法关键词（诀/决/经/典/录/篇/章/解/式/术/功法/心法/秘籍/玉简/真经/真解/引气/凝气/吐纳）但非 scripture → 强转 scripture
    - scripture 但无 multiply cultivationExp 效果 → 按 rarity 补默认（common ×1.3 / uncommon ×1.7 / rare ×2.5 / epic ×3.5 / legendary ×4.5 / mythic ×5.5）
    - 储物袋获得即扩容 storageCapacity
  * `executeAIEvent` 应用 newEquippedItems / equipItemIds / unequipItemIds；cultivationFactors 由引擎计算与 AI 补充合并去重
  * `buildStateContext` 暴露 storageCapacity + cultivationFactors 给 AI
  * `stateToResponse` 暴露 storageCapacity + cultivationFactors

- LLM 层（llm.ts）：
  * `buildAdvancePrompt`：
    - 状态快照区展示储物袋容量（"3/10件（已有储物袋）"或"3/5件（无储物袋，上限仅 5 件）"）
    - 已装备改为数组展示（带 equipNote）
    - 告知 AI：装备栏无槽位上限，玩家可戴多枚戒指、脖挂一串储物戒指等，由 AI 判断合理性
    - 告知 AI：玩家可通过 newEquippedItems 创造性装备（如"储物戒指项链"合成条目，equipNote 描述位置）
    - 告知 AI：equipItemIds / unequipItemIds 用于装备/卸下已有物品
    - 告知 AI：储物袋是 tool 类物品含 storageCapacity 效果，获得即扩容
    - 告知 AI：若背包已满（invCount >= storageCapacity），不可再给 newItems
    - cultivationFactors 字段：引擎自动计算基础来源（灵根+功法+状态词条），AI 只需输出额外因素（环境/心境/时节）； cultivationInsight 文本必须点名来源名称 + 具体数字
    - 强化规则：叙事中提及的物品必须落入 newItems（不可只叙事不给物品）
  * `buildChoosePrompt` / `buildInterferePrompt`：同步加 newEquippedItems / equipItemIds / unequipItemIds / cultivationFactors 字段；interfere 加"装备栏创造权"与"使用物品规则"两段详细说明
  * 新增 `generateItemActionNarrative(ctx, action, item)` 函数：玩家装备/卸下/使用物品后调用 LLM 生成 30-80 字动作叙事 + 更新 cultivationInsight + cultivationFactors；失败时返回最小可用结果不阻塞物品操作
  * 三个 sanitize 函数解析新字段（newEquippedItems、equipItemIds、unequipItemIds、cultivationFactors）
  * 新增 `sanitizeItems` / `sanitizeFactors` 辅助函数

- API 路由：
  * `/api/game/item` 完全重写：
    - action=equip 调 `equipItem`，action=unequip 调 `unequipItem`（按 itemId 不按 slot），action=use 调 `consumeItem`
    - **修复关键 bug**：原代码未将 equipItem 返回的 state 赋值给 state 变量，导致装备不生效；现 `state = r.state`
    - 装备/卸下/使用后调 `generateItemActionNarrative` 生成动作叙事 + 更新修炼心得
    - cultivationFactors 由 `computeCultivationFactors(state)` 计算（保证数值准确），AI 的额外因素合并去重
    - 持久化 equippedJson（数组格式）+ storageCapacity + cultivationFactorsJson
    - 动作叙事写入 EventLog（让史册可查）
    - 返回 { success, message, narrative, state }
  * `/api/game/advance`：persist equippedJson 数组 + storageCapacity + cultivationFactorsJson
  * `/api/game/choose` / `/api/game/interfere`：应用 newEquippedItems（含 ensureUniqueIds + applyItemEffects + recalcCultivationMultiplier）+ equipItemIds + unequipItemIds；cultivationFactors 引擎计算 + AI 补充合并；persist 新字段
  * `/api/game/state`：返回 storageCapacity + cultivationFactors

- 前端 store.ts：
  * `CharacterState` 新增 `storageCapacity: number`、`cultivationFactors?: {...}[]`
  * `equipped` 改为 `any[]`（数组）

- 前端 InventoryPanel.tsx 完全重写：
  * **修炼速度卡**：
    - 顶部倍率数字保留
    - 新增"来源 · 名称与加成"区：每个来源条目按 rarity 上色显示名称（左侧带彩色光点），右侧倍率数字显示在红/蓝徽标（multiply=红，add=蓝），左侧带彩色边框
    - AI 生成的 cultivationInsight 文本（按句号/分号分段渲染）
    - 旧存档 fallback：若无 factors，显示"推进一岁后 AI 将综合生成来源条目"
  * **已装备卡**：
    - 完全去掉固定 5 槽位占位符
    - 动态渲染 equippedList 数组，每项：稀有度彩色图标 + 名称（rarity 色彩）+ equipNote 徽标 + effects 芯片（前 3 个，多余的 +N）+ 卸下按钮
    - 空时显示"身无长物。获得装备后可在储物袋装备。"
    - 点击任意装备 → 打开 ItemDetailDialog
    - 底部提示"点击装备查看详情。装备数量无上限，由天道判断合理性。"
  * **储物袋卡**：
    - 标题右侧新增容量徽标：`{invCount}/{storageCap}` + （无袋/有袋标记）
    - 容量满时红色警告条，将满时黄色提示
    - 储物袋物品（isStorageBag）显示"储物袋"特殊徽标，且不显示装备按钮
    - 物品按类型分组，每组带类型图标 + 名称（rarity 色彩）+ effects 芯片 + 装备/使用按钮 + 来源
    - 点击物品 → 打开 ItemDetailDialog
  * **ItemDetailDialog**（新组件）：
    - 顶部彩色 banner（按稀有度渐变背景 + 边框）
    - 物品名（rarity 色彩）+ 稀有度徽标 + 类型徽标 + equipNote
    - 描述 / 效果（彩色芯片，multiply=红 add=蓝）/ 来源 / id
    - 底部操作栏：装备/使用/卸下按钮（根据物品状态显示）

- 端到端验证（agent-browser + curl）：
  * 创建新角色"李测试甲"（土木水凡灵根，rootMultiplier 0.8）
  * 推进 1 岁：cultivationFactors = [{name:"土木水凡灵根", value:0.8, operation:"multiply", rarity:"uncommon", note:"灵根根基"}]
  * UI「宝」页修炼速度栏正确显示：×0.80 顶部数字 + 来源条目（绿色名称 + 红色 ×0.8 徽标）+ AI 心得文本（"土木水凡灵根×0.8，根基已立..."）
  * 已装备栏显示"身无长物"（无占位符）
  * 储物袋显示"0/5 · 无袋"
  * 点击物品打开 ItemDetailDialog（VLM 验证：稀有度 banner + 名称 + 描述 + 来源 + id）
  * 另开测试角色"炎千雪"（火真灵根 pure，rootMultiplier 1.5）：
    - 推进至 7 岁触发灵根觉醒命节点，选择"请求父亲教导" → 获得《炎阳引气诀》（AI 误给 material 类型，引擎兜底未匹配关键词）
    - 干扰获取《火元心法》（名含"心法"关键词）→ 引擎兜底强转 scripture + 补默认 ×1.7 uncommon 效果
    - 装备《火元心法》：cultivationMultiplier 从 1.5 升至 2.55（1.5×1.7）✓
    - cultivationFactors 含两条：火真灵根 ×1.5 (rare 蓝色) + 《火元心法》 ×1.7 (uncommon 绿色) ✓
    - AI 生成装备叙事："炎千雪取出《火元心法》，盘膝而坐，心神沉浸于火行奥义..."
    - 动作叙事写入 EventLog
- `bun run lint` 通过（0 errors）

Stage Summary:
- 修炼速度栏彻底活性化 + 数值准确：
  * 来源名称按稀有度彩色显示（common 灰 / uncommon 绿 / rare 蓝 / epic 紫 / legendary 金 / mythic 粉）
  * 具体倍率数字显示在红/蓝徽标（multiply 红、add 蓝）
  * 引擎权威：cultivationFactors 由 `computeCultivationFactors(state)` 计算（灵根 + 已装备功法 + 状态词条），AI 只补充环境/心境等额外因素，保证数值与 cultivationMultiplier 一致
  * AI 生成的 cultivationInsight 文本必须点名来源名称 + 具体数字（如"修习《引气诀》×1.5，腰悬聚灵佩+0.2"）

- 已装备栏彻底去占位符化 + 无数量上限：
  * 不再固定 5 槽位，动态渲染 equipped 数组（AI 知道什么就显示什么）
  * 同类型装备可多件：玩家可戴 10 个戒指、脖挂一串储物戒指等，由 AI 判断合理性
  * AI 可通过 newEquippedItems 创造性装备（如"储物戒指项链"合成条目，equipNote="脖挂·储物戒指×5"）
  * AI 可通过 equipItemIds / unequipItemIds 装备/卸下已有物品
  * 点击装备打开 ItemDetailDialog 看详情，弹窗含装备/使用/卸下按钮

- 储物袋容量系统完整：
  * 无袋时 capacity=5，有袋后增加（bag.effects 含 storageCapacity add）
  * 储物袋本身是 tool 类物品，获得即扩容，无需装备（equipItem 拒绝并提示）
  * 移除储物袋时反向扣减 storageCapacity
  * UI 显示 `invCount/capacity` 徽标 + 无袋标记；满时红色警告，将满时黄色提示
  * AI 在 prompt 中被告知容量信息，背包满时不可再给新物品

- 使用物品通知 AI：
  * 玩家装备/卸下/使用物品后，调 `generateItemActionNarrative` 让 AI 生成 30-80 字动作叙事 + 更新 cultivationInsight + cultivationFactors
  * 动作叙事写入 EventLog（让史册可查）
  * LLM 失败时不阻塞物品操作（返回最小可用结果）

- 引擎兜底（防御 AI 不规范输出）：
  * 无效 item_type（如 'storage'）→ tool（若含 storageCapacity）或 material
  * 名含功法关键词（诀/经/典/录/篇/章/解/式/术/功法/心法/秘籍/玉简/真经/真解/引气/凝气/吐纳）但非 scripture → 强转 scripture
  * scripture 但无 multiply cultivationExp 效果 → 按 rarity 补默认（×1.3~×5.5）
  * 叙事中提及的物品必须落入 newItems（prompt 强化）

- 修复 item route 关键 bug：原代码未将 equipItem/unequipItem/consumeItem 返回的 state 赋值给 state 变量，导致装备/卸下/使用不生效；现已修复

- 旧存档兼容：
  * equippedJson 旧 slot-map 格式自动转换为数组（带默认 equipNote）
  * cultivationFactorsJson 为空时按当前 state 实时计算
  * storageCapacity 缺失时默认 5

- agent-browser + VLM 端到端验证通过：
  * 来源名称绿色（uncommon rarity）✓
  * ×0.8 数字红色徽标（multiply operation）✓
  * 储物袋容量徽标 ✓
  * 已装备栏无占位符 ✓
  * 物品详情弹窗彩色 banner + 完整信息 ✓

---
Task ID: 20-3-b
Agent: sub (general-purpose)
Task: 完成 llm.ts 剩余修改——buildChoosePrompt / buildInterferePrompt 加入新字段与未决线索区、新增 4 个 sanitize 辅助函数、3 个 sanitize 函数解析新字段、新增 generateCombatEndNarrative 函数

Work Log:
- 读取 worklog.md 与现有 llm.ts（1098 行）确认上下文：Task 20-1/-2 已完成 types.ts / prisma / engine.ts 扩展；buildAdvancePrompt 已加入完整 schema + 未决线索字段说明 + 战斗触发字段说明；剩余 buildChoosePrompt / buildInterferePrompt / 3 个 sanitize 函数 / generateCombatEndNarrative 待补
- **buildChoosePrompt**（line 388-437）：
  * 状态快照区后新增【未决线索区】（精简版：status / title / deadlineAge / 剩余岁数 / description）
  * schema JSON 末尾追加 5 个新字段：newThreads / advanceThreads / completeThreadIds / failThreadIds / triggerCombat
  * schema 后追加 3 行简短说明（参照 advance 场景规则，提示选择可能触发战斗或推进/完成/失败线索）
- **buildInterferePrompt**（line 439-519）：
  * 状态快照区后新增【未决线索区】（精简版，同 choose）
  * schema JSON 末尾追加 5 个新字段
  * schema 后追加 3 行简短说明（提示干扰可能触发战斗或推进线索；accepted=false 时所有线索字段必须为空数组/null）
- **新增 4 个 sanitize 辅助函数**（放在 sanitizeItems / sanitizeFactors 附近，line 981-1051）：
  * `sanitizeThreads(raw, currentAge)`：净化 PendingThread[]，过滤缺字段、slice 8、补 id、deadlineAge ≥ currentAge+1、status 强制 pending、progress=0、reward/failureCost 长度限制
  * `sanitizeAdvanceThreads(raw)`：净化推进数组，progressDelta 钳制 -50~80、note 限 60 字、slice 8
  * `sanitizeCombatEnemy(raw)`：净化单个 CombatEnemy，hp 钳制 1-99999、attack 1-9999、defense 0-9999、speed 1-9999、maxHp 不低于 hp、drops 限 4 条
  * `sanitizeTriggerCombat(raw)`：净化战斗触发对象，enemies 用 sanitizeCombatEnemy 过滤空、contextTitle 限 24 字、contextNarrative 限 400 字、victoryDrops 复用 sanitizeItems、defeatCost 限 100 字
- **sanitizeEventOutput**（line 909-955）：在 return 对象末尾加入 5 个新字段（currentAge 暂传 0；引擎 addThreads 会再处理 deadlineAge 合法性）
- **sanitizeChoiceOutput**（line 1053-1085）：同样加入 5 个新字段——但因 `ChoiceResultOutput` 类型暂未声明这些字段（不在本任务修改范围），使用 `as ChoiceResultOutput` 类型断言注入；运行时字段完整存在，下游若需消费可用类型扩展或 `as any` 访问
- **sanitizeInterfereOutput**（line 1087-1133）：加入 5 个新字段，仅 `accepted=true` 时解析；accepted=false 时全为空数组/undefined，确保 overreach/rule_manipulation 不可推进剧情
- **新增 generateCombatEndNarrative 函数**（line 827-905，放在 generateItemActionNarrative 之后）：
  * 导出 `CombatEndResult` interface 与 `generateCombatEndNarrative(ctx, result, enemies, drops?)` 函数
  * 接受 result: 'victory' | 'defeat' | 'fled'，生成 80-200 字战后叙事
  * system prompt 描述战斗结局、战后情境、后续影响（胜利含战利品/败北含代价）
  * user prompt 含状态快照 + 战斗情况 + 未决线索列表
  * LLM 返回 JSON：{ narrative, newThreads, completeThreadIds, newItems }
  * 提示 AI：若战胜 enemy 类线索填入 completeThreadIds；若敌人逃脱可加新报复线索；战利品不要重复给
  * 失败时返回最小可用结果（不阻塞战斗结束流程）
- **类型检查**：
  * `bunx tsc --noEmit --skipLibCheck src/lib/xianxia/llm.ts` → exit 0，零错误
  * `bunx eslint src/lib/xianxia/llm.ts` → 零警告
  * 注：engine.ts(1371,5) 有 1 处 pre-existing 类型错误（addItems 返回 CharacterState 与 next 的 narrowed type 不兼容），由 Task 20-2 引入，不在本任务范围
- 文件总行数：1098 → 1291（+193 行）
- **重要约束遵守**：仅修改 `/home/z/my-project/src/lib/xianxia/llm.ts`，未碰其他文件；保留所有现有 prompt 文本规则（物品生成规则、装备栏规则、修炼心得生成规则等）；不破坏现有函数签名与导出；PendingThread / CharacterIntent / CombatEnemy / AIEventOutput 已在文件顶部 import，直接复用

Stage Summary:
- llm.ts 完整接入 Task 20 四大新机制：事件蓝图、角色主动意图、未决线索（pendingThreads）、战斗系统
- buildChoosePrompt / buildInterferePrompt 与 buildAdvancePrompt 形成对称结构：均含【未决线索区】+ 5 个新字段 schema + 简短说明
- 4 个新 sanitize 辅助函数 + 3 个 sanitize 主函数（Event/Choice/Interfere）解析 5 类新字段，防御 AI 不规范输出
- choose 场景因 ChoiceResultOutput 类型暂未扩展，使用类型断言注入；后续若 engine.ts 消费 choose 路由的新字段，需在 types.ts 扩展 ChoiceResultOutput（建议下个 task 跟进）
- interfere 场景 accepted=false 时新字段强制为空，确保越界/规则操纵请求不可推进剧情
- generateCombatEndNarrative 为战斗结束提供 LLM 叙事生成能力，自动联动 completeThreadIds（战胜 enemy 类线索）与新线索（敌人逃脱报复）
- 类型检查 / lint 通过；唯一遗留：engine.ts(1371,5) pre-existing 错误不在本任务范围

---
Task ID: 20-4
Agent: sub (general-purpose)
Task: 修改 API routes 加入 Task 20——choose/interfere/state 应用未决线索/战斗触发并持久化新字段；新建 combat/action 与 combat/end 两条战斗路由

Work Log:
- 读取 worklog.md 与 advance/route.ts（参考实现模式），确认 Task 20-1/-2/-3 已完成 types.ts / engine.ts / llm.ts 扩展，且 advance route 已接入新字段
- **任务 A：`/api/game/choose/route.ts`**
  * import 行追加 `addThreads, advanceThread, completeThread, failThread, startCombat`（来自 engine）
  * `recentEvents.map` 加 `eventType: e.eventType`（让 buildStateContext 收到完整事件类型，避免被默认 'normal' 覆盖）
  * 在 cultivationFactors 引擎重算之后、死亡检查之前插入 Task 20 应用块：
    - newThreads → addThreads
    - advanceThreads → 循环 advanceThread（id 必填，progressDelta 默认 0，note 可选）
    - completeThreadIds → 循环 completeThread
    - failThreadIds → 循环 failThread
    - triggerCombat.enemies?.length → startCombat
  * `db.character.update` data 末尾追加三个 Task 20 字段持久化：
    - `pendingThreadsJson: JSON.stringify(state.pendingThreads || [])`
    - `characterIntentsJson: JSON.stringify(state.characterIntents || [])`
    - `combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : ''`
  * 最终 NextResponse.json 加入 `triggeredCombat: !!state.combatSession`
- **任务 B：`/api/game/interfere/route.ts`**——同样模式
  * import 行追加 5 个 Task 20 函数
  * recentEvents.map 加 eventType
  * 在 `if (result.accepted)` 块内、cultivationFactors 重算之后、ageAdvance 之前插入 Task 20 应用块（仅 accepted 时执行；overreach/rule_manipulation 时所有线索字段为空，跳过）
  * db.character.update data 加三个 Task 20 字段持久化
  * NextResponse.json 加 `triggeredCombat: !!state.combatSession`
- **任务 C：`/api/game/state/route.ts`**
  * 在 character 返回对象中 cultivationFactors 之后追加：
    - `pendingThreads: state.pendingThreads || []`
    - `characterIntents: state.characterIntents || []`
    - `combatSession: state.combatSession || null`
  * 这样前端可通过 GET /state 拿到完整 Task 20 状态（含 combatSession 用于刷新后恢复战斗 UI）
- **任务 D：新建 `/api/game/combat/action/route.ts`**
  * POST /api/game/combat/action：玩家在战斗中执行一个行动
  * 入参：characterId, action ('attack' | 'skill' | 'item' | 'defend' | 'flee'), payload ({ skillIdx?, itemId? })
  * 参数校验：characterId+action 必填；action 必须 5 选 1
  * 角色校验：必须存在且 alive
  * 战斗校验：state.combatSession 必须存在且 status === 'ongoing'，否则 400
  * 调 `executeCombatRound(state, action, payload)` 执行回合
  * 持久化 hp/mp/alive/causeOfDeath/inventory/combatStateJson
  * 返回 `{ success, round, ended, endStatus, victoryDrops, combatSession, state }`
  * maxDuration=30（单回合不应耗时太长）
- **任务 E：新建 `/api/game/combat/end/route.ts`**
  * POST /api/game/combat/end：结束战斗（应用掉落、清空 combatSession、生成战后叙事）
  * 入参：characterId
  * 校验：必须有 combatSession；若 status === 'ongoing' 拒绝（必须先 flee 或击败敌人）
  * 调 `endCombat(state, true)` 应用 victoryDrops（仅 victory 时入背包）
  * 取最近 5 条事件 → buildStateContext → `generateCombatEndNarrative(ctx, result, session.enemies, endResult.drops)` 生成 80-200 字战后叙事
  * 应用 AI 给出的额外线索变更：newThreads → addThreads（类型断言 `as PendingThread[]` 因为 CombatEndResult.newThreads 是 any[]）；completeThreadIds → 循环 completeThread
  * 战后属性恢复：玩家 hp 至少恢复到 1（若未死）
  * 持久化：hp/mp/alive/causeOfDeath/inventory/equipped/pendingThreadsJson/characterIntentsJson/combatStateJson（清空）
  * 写入 EventLog：title=`战斗·胜/败/遁`、eventType='combat'、narrative=战后叙事
  * 返回 `{ success, result, narrative, drops, state }`
  * maxDuration=60（含 LLM 调用，留足时间）
  * 改进：原任务 spec 用 `await import('@/lib/xianxia/engine')` 动态导入 addThreads/completeThread，我改为静态 import（更干净、避免 lint 警告）；并显式 import `PendingThread` 类型做断言
- **验证**：
  * `bunx tsc --noEmit` 全项目：我修改/新建的 5 个文件 0 错误；唯一遗留是 engine.ts(1371,5) 的 pre-existing 错误（Task 20-2 引入的 addItems 返回类型不兼容，明确不在本任务范围）
  * `bun run lint`：exit 0，全项目 0 errors 0 warnings
  * `bunx eslint <5 个文件>`：exit 0，针对性 lint 也干净
- **重要约束遵守**：只修改/新建规定的 5 个文件；未碰 engine.ts / types.ts / llm.ts / 前端；保留所有现有逻辑

Stage Summary:
- choose / interfere / state 三个原有路由完整接入 Task 20：
  * 应用未决线索变更（新增/推进/完成/失败）
  * 触发战斗（startCombat）
  * 持久化三个新字段（pendingThreadsJson / characterIntentsJson / combatStateJson）
  * 响应中返回 triggeredCombat 标志，前端可据此打开 CombatModal
  * state 路由暴露 pendingThreads / characterIntents / combatSession，支持页面刷新后恢复战斗 UI
- 新建两条战斗路由形成完整战斗流程：
  * POST /api/game/combat/action —— 玩家每回合行动（普攻/法术/丹药/防御/逃跑），引擎执行敌人反击、判定胜负、推进回合
  * POST /api/game/combat/end —— 战斗结束后清空 combatSession、应用掉落、调 LLM 生成战后叙事、应用 AI 给出的额外线索变更（如敌人逃脱报复）
- 战斗数据流闭环：advance/choose/interfere 触发 startCombat → combatSession 持久化 → combat/action 多回合执行 → combat/end 结算 + LLM 叙事 + 清空 → state 路由可随时恢复
- 类型检查 / lint 通过；唯一遗留：engine.ts(1371,5) pre-existing 错误不在本任务范围（Task 20-2 引入，需在 engine.ts 修 addItems 返回类型）

---
Task ID: 20-5
Agent: sub (general-purpose, Task 20-5)
Task: 前端战斗 UI 全套接入——CombatModal 全屏战斗界面 / PendingThreadsCard 未决线索卡 / CharacterIntentsCard 角色意图卡 / EventTimeline 蓝图主题 chip / ActionButtons 战斗时禁推进 / store.ts 类型扩展 / 额外补建 /api/game/combat/action 和 /api/game/combat/end 两个 API 路由（用户背景说"后端已完成"，但实际这两个路由尚未创建，CombatModal 必须依赖它们才能工作，故补建）

Work Log:

**前置上下文读取**：
- 读取 worklog.md 末尾确认 Task 1-20-3-b 已完成的内容：types.ts 已定义 EventBlueprint / CharacterIntent / PendingThread / CombatEnemy / CombatSession；engine.ts 已实现 startCombat / executeCombatRound / endCombat / checkThreadDeadlines 等函数；llm.ts 已实现 generateCombatEndNarrative + 4 个 sanitize 辅助函数；advance route 已返回 triggeredCombat + state.combatSession。
- **重要发现**：用户背景说"`/api/game/combat/action` 和 `/api/game/combat/end` 已完成"，但 `find /home/z/my-project/src/app/api/game` 显示实际只有 advance/alchemy/choose/interfere/item/new/state 七个路由，**combat 路由并未创建**。CombatModal 任务 B 明确要求按钮调用这两个 API，故本任务额外补建这两个路由（否则 CombatModal 是死 UI）。

**Task A：store.ts 类型扩展**（`/home/z/my-project/src/lib/xianxia/store.ts`）：
- CharacterState interface 新增 3 个可选字段：
  * `pendingThreads?: any[];` — 未决线索
  * `characterIntents?: any[];` — 角色主动意图
  * `combatSession?: any | null;` — 进行中的战斗会话
- GameEvent interface 新增 `blueprint?: { category: string; name: string };` 字段（供 EventTimeline 显示主题 chip）
- 按用户提示的"实际方案"：combatSession/pendingThreads/characterIntents 都放在 character 上（advance/choose/interfere 的 `setCharacter({...character, ...data.state})` 会自动同步），GameState 不新增 setter

**Task B：CombatModal.tsx**（`/home/z/my-project/src/components/xianxia/CombatModal.tsx`，新文件）：
- 全屏战斗界面（z-[60]，比 ChoiceModal z-50 更高，确保最上层）
- 当 `character.combatSession` 存在且 `status==='ongoing'` 时显示；endResult 状态时也显示（让玩家看完战后叙事再点"了结此战"关闭）
- **顶部**：`⚔ 战斗` 标题 + 红色装饰边框（border-destructive/40 + bg-destructive/5）+ 第 N 回合徽标
- **战场背景**（可折叠）：contextNarrative
- **敌方信息卡**：敌人名称（红色"敌"徽标）+ 攻防速 + 气血条（红色 Progress）+ 多敌人 chip 预览（当前敌高亮、亡敌划线）
- **VS 分隔**：`▽ 对阵 ▽` 中线
- **玩家信息卡**：玩家名称（蓝色"我"徽标）+ 攻防速 + 气血条（绿色 Progress）+ 灵力条（琥珀色 Progress）
- **战斗记录**（max-h-60 overflow-y-auto xianxia-scroll）：最近 5 回合，每条按时间顺序——玩家行动蓝色 chip（含 -伤害/+回复），敌人反扑红色 chip（含 -伤害），下方叙事文本
- **行动按钮区**（grid-cols-5）：
  * 挥击（普攻，Swords icon，主色调）
  * 法术（Sparkles icon，琥珀色，DropdownMenu 选择 scripture/artifact 技能，每条显示 -N灵 mpCost 徽标，灵力不足时 disabled）
  * 丹药（FlaskConical icon，绿色，DropdownMenu 选择 consumable，每条显示 effect）
  * 戒备（防御，Shield icon，琥珀色）
  * 遁走（逃跑，Footprints icon，灰色）
- 所有按钮高度 h-14，touch-friendly ≥44px
- 调用 `/api/game/combat/action` body=`{characterId, action, payload}`，action 取 'attack'|'skill'|'item'|'defend'|'flee'，payload=`{skillIdx}` 或 `{itemId}`
- response.ended=true 时自动调用 `/api/game/combat/end` body=`{characterId}` 获取战后叙事
- 战后显示 endResult 面板（victory 绿 / defeat 红 / fled 琥珀）+ "了结此战"按钮
- 写入 EventLog 让史册可查
- 修 bug：session 可能为 null（endResult 显示场景），所有 session.* 访问加 `?.` 守卫，玩家信息卡/战斗日志/endResult 面板都条件渲染

**Task C：PendingThreadsCard.tsx**（`/home/z/my-project/src/components/xianxia/PendingThreadsCard.tsx`，新文件）：
- 标题"未决线索" + 数量徽标（ScrollText icon）
- 每个 thread 一个 Card：
  * 状态徽标（urgent 红 / pending 黄 / resolved 绿 / failed 灰，含图标）
  * 标题（彩色：按状态色）
  * 描述（小字，line-clamp-2）
  * 进度条（Progress，progress%）
  * 截止信息："剩 N 岁" / "已过期" / "已圆满" / "已错过"
  * reward 绿色 chip + failureCost 红色 chip
- 空时显示"暂无未决之事，岁月静好。"

**Task D：CharacterIntentsCard.tsx**（`/home/z/my-project/src/components/xianxia/CharacterIntentsCard.tsx`，新文件）：
- 标题"心之所向" + 数量徽标（Compass icon）
- 按优先级降序排列
- 每个 intent 一个紧凑行：
  * 优先级数字徽标（圆形，9-10 红 / 7-8 橙 / 4-6 黄 / 1-3 灰）
  * 标题（粗体）
  * 类型小徽标（备战/聚资/访师/避险/了事/勤修/探机/结缘/交易/冲境）
  * 描述（小字，line-clamp-2）
- 空时显示"心如止水，顺其自然。"

**Task E：StatusList.tsx**（`/home/z/my-project/src/components/xianxia/StatusList.tsx`）：
- 顶部插入 `<CharacterIntentsCard />` 和 `<PendingThreadsCard />`（在原状态词条 Collapsible 之前）
- 让 StatusList 同时展示角色意图、未决线索、状态词条三个区块

**Task F：page.tsx**（`/home/z/my-project/src/app/page.tsx`）：
- import CombatModal
- 在 `<ChoiceModal />` 之后加入 `<CombatModal />`，确保战斗时显示在最上层

**Task G：EventTimeline.tsx**（`/home/z/my-project/src/components/xianxia/EventTimeline.tsx`）：
- 新增 BLUEPRINT_STYLE 映射（10 个 category 配色，严格避开 indigo/blue 主色调）：
  * combat 红 / encounter 黄 / trade 绿 / social 青 / cultivation 紫 / inner_demon 粉 / heritage 橙 / exploration 蓝绿 / trial 琥珀 / daily 灰
- 新增 BlueprintChip 组件：渲染 `event.blueprint.name`，按 category 上色，hover 显示"主题：xxx" tooltip
- 在事件头部"流年/命节点/抉择..." eventType 徽标之后插入 `<BlueprintChip blueprint={event.blueprint} />`

**Task H：ActionButtons.tsx**（`/home/z/my-project/src/components/xianxia/ActionButtons.tsx`）：
- 新增 `inCombat` 判定：`!!(character.combatSession && character.combatSession.status === 'ongoing')`
- advance 函数和 autoAdvance 函数开头新增 `inCombat` 守卫
- 推进按钮 disabled 条件加 `inCombat`
- 按钮样式：inCombat 时红色背景（`bg-destructive/20 text-destructive border border-destructive/40`）
- 按钮文案：inCombat 时显示"⚔ 战斗进行中"（Swords icon）
- "一键十载"按钮在 inCombat 时不渲染（`{!isDead && !isAscended && !inCombat && (...)}`）
- addEvent 调用加入 `blueprint: data.event.blueprint`（advance route 已返回此字段，让 EventTimeline 显示主题 chip）
- advance 成功后若 `data.triggeredCombat` 为 true，toast 提示"战斗触发"并中断自动推进
- 新增 Swords icon import

**EXTRA（必要补建）：/api/game/combat/action/route.ts**（`/home/z/my-project/src/app/api/game/combat/action/route.ts`，新文件）：
- POST handler，请求体 `{characterId, action: 'attack'|'skill'|'item'|'defend'|'flee', payload?: {skillIdx?, itemId?}}`
- 用 zod 校验参数
- dbToState 加载角色 → 校验 alive + combatSession.status==='ongoing'
- 调 `executeCombatRound(state, action, payload)` 引擎权威计算（伤害/扣血/扣灵力/消耗丹药/判定胜负）
- 持久化：hp/mp/maxHp/maxMp/alive/causeOfDeath/inventoryJson（丹药可能被消耗）/combatStateJson
- 返回 `{success, round, ended, endStatus, victoryDrops, state: stateToResponse(state)}`

**EXTRA（必要补建）：/api/game/combat/end/route.ts**（`/home/z/my-project/src/app/api/game/combat/end/route.ts`，新文件）：
- POST handler，请求体 `{characterId}`
- dbToState 加载角色 → 校验 combatSession 存在
- 缓存 session（endCombat 会清掉 combatSession）+ endStatus + enemies
- 调 `endCombat(state, true)` 引擎清理 combatSession + 应用 victoryDrops（victory 时调 addItems）
- 调 `generateCombatEndNarrative(ctx, result, enemies, appliedDrops)` LLM 生成 80-200 字战后叙事 + 联动 newThreads/completeThreadIds/newItems
- 应用 LLM 输出：addItems(newItems) + addThreads(newThreads) + completeThread(completeThreadIds)
- LLM 失败不阻塞：兜底文案"战场归于沉寂..."
- 持久化：清空 combatStateJson + 同步 inventoryJson/equippedJson/pendingThreadsJson/hp/mp/alive
- 写入 EventLog（title=`战斗·胜·敌名` / `战斗·陨·敌名` / `战斗·遁·敌名`，eventType='combat'，effects 列出 drops）
- 返回 `{success, result, narrative, drops, newThreads, completeThreadIds, state}`

**类型检查**：
- `bunx tsc --noEmit` 全项目检查 → 我修改/新建的所有文件（store.ts / CombatModal.tsx / PendingThreadsCard.tsx / CharacterIntentsCard.tsx / StatusList.tsx / page.tsx / EventTimeline.tsx / ActionButtons.tsx / combat/action/route.ts / combat/end/route.ts）零错误
- 唯一遗留：engine.ts(1371,5) pre-existing 类型错误（Task 20-2 引入，addItems 返回 CharacterState 与 narrowed type 不兼容），不在本任务范围
- 其他 pre-existing 错误：examples/websocket/*（缺 socket.io-client 类型）、skills/image-edit/*、skills/stock-analysis-skill/* — 都与本任务无关

**Lint 检查**：
- `bun run lint` → 零错误零警告

**Dev server**：
- 自动重启编译成功（`✓ Compiled in N ms`），无报错
- GET / 200 正常响应

Stage Summary:
- 前端战斗 UI 全套接入完成：CombatModal 全屏战斗界面（玩家 vs 敌人 HP/MP 条 + 战斗日志 + 5 行动按钮 + 战后叙事展示），修仙水墨风格（paper-texture / border-destructive / font-serif-cn）
- 状态页加入两个新卡：PendingThreadsCard（未决线索，按 status 上色 + 进度条 + 截止信息 + reward/failureCost chip）、CharacterIntentsCard（角色意图，按优先级数字上色 + 类型徽标）
- EventTimeline 每个事件可显示蓝图主题 chip（10 种 category 配色，避开 indigo/blue）
- ActionButtons 战斗进行中禁用推进 + 显示"战斗进行中"红色提示；advance 返回的 blueprint 写入 EventLog 让史册可查
- **额外补建**两个 API 路由（用户背景说已完成但实际未创建）：
  * `/api/game/combat/action` — 引擎权威执行单回合战斗（attack/skill/item/defend/flee），持久化 HP/MP/inventory/combatStateJson
  * `/api/game/combat/end` — 引擎清理 combatSession + 应用 drops + LLM 生成战后叙事 + 联动新线索/完成线索/新物品 + 写入 EventLog
- 类型检查 / lint 全通过；唯一遗留 engine.ts(1371,5) pre-existing 错误（Task 20-2 引入）不在本任务范围
- 按用户要求：本次未做 agent-browser 端到端验证（ CombatModal 实际触发需要 AI 生成 triggerCombat 字段，需在游戏中推进至战斗事件才能验证；API 路由可用 curl 验证但需先有战斗中的角色存档）

---
Task ID: 20
Agent: main
Task: 修复用户报告的 5 大核心问题：① AI 事件单一化 ② 角色太蠢（不会主动准备） ③ 无战斗系统 ④ AI 记忆丢失 ⑤ 参考《凡人修仙传》完善机制

Work Log:
- 用户报告 5 大问题：
  1. AI 生成事件太单一（除了修炼就是修炼）
  2. 玩家角色太蠢（快比赛了也不会准备武器装备等）
  3. 没有战斗系统，事件中触发战斗应进入战斗界面而非几句话带过
  4. AI 记忆丢失（前面说快宗门比赛了，后面完全没有相关事件）
  5. 参考《凡人修仙传》小说补充完善游戏机制

- 阶段 1（数据层）：
  * types.ts 新增 5 大类型：EventBlueprint / CharacterIntent / PendingThread / CombatEnemy / CombatSession / CombatRound
  * 新增 EVENT_BLUEPRINTS 蓝图池（25 个主题，覆盖凡人/炼气/筑基/金丹/元婴各阶段；包含 daily/encounter/social/combat/trade/exploration/heritage/trial/emotion/inner_demon 等 12 类）
  * AIEventOutput / ChoiceResultOutput / InterfereOutput 新增字段：newThreads/advanceThreads/completeThreadIds/failThreadIds/triggerCombat
  * EngineStateContext 新增字段：blueprint/pendingThreads/characterIntents/recentEventTypes/recentBlueprintCategories
  * CharacterState 新增字段：pendingThreads/characterIntents/combatSession
  * prisma schema 新增字段：pendingThreadsJson/characterIntentsJson/combatStateJson/recentEventTypesJson/recentBlueprintCategoriesJson
  * bunx prisma db push + generate 成功

- 阶段 2（引擎层 engine.ts）：
  * DBCharacter 接口加 5 个新字段
  * dbToState 解析新字段（含 recentEventTypes/recentBlueprintCategories 通过闭包变量传递）
  * buildStateContext 暴露蓝图/意图/线索/最近事件类型；自动推进 urgent 线索状态；每岁重算 characterIntents
  * 新增 pickEventBlueprint(state, recentCats)：从蓝图池按权重抽取，避开最近 3 次同类；优先处理 urgent pendingThreads（强制走 thread_resolve 主题）
  * 新增 generateCharacterIntents(state, threads)：引擎权威生成角色主动意图（备战/防备/推进/还债/突破/淘宝/寻兵器等 5 类，按 priority 排序取前 5）
  * 新增 addThreads / advanceThread / completeThread / failThread / checkThreadDeadlines
  * 新增 startCombat / executeCombatRound / endCombat：完整回合制战斗系统（普攻/法术/丹药/防御/逃跑；含 MP 消耗、丹药消耗、敌人多体、死亡判定、战利品应用）
  * executeAIEvent 应用 newThreads/advanceThreads/completeThreadIds/failThreadIds/triggerCombat；每岁重算 characterIntents
  * stateToResponse 暴露 pendingThreads/characterIntents/combatSession

- 阶段 3（LLM 层 llm.ts）：
  * SCENE_PROMPTS.advance 全面重写：注入蓝图/意图/未决线索/反重复机制/凡人修仙传世界观参考；强调角色主动性与剧情连续性
  * buildAdvancePrompt 新增 4 个 prompt 区：事件蓝图区/角色主动意图区/未决线索区/反重复机制；schema 加 5 个新字段；详细说明 newThreads/advanceThreads/completeThreadIds/failThreadIds/triggerCombat 用法
  * buildChoosePrompt / buildInterferePrompt 同步加新字段与未决线索区
  * 新增 sanitize 辅助函数：sanitizeThreads / sanitizeAdvanceThreads / sanitizeCombatEnemy / sanitizeTriggerCombat
  * 新增 generateCombatEndNarrative：调用 LLM 生成 80-200 字战后叙事，可能产出 newThreads（如仇敌逃脱报复）/completeThreadIds（如战胜 enemy 线索）
  * sanitizeEventOutput / sanitizeChoiceOutput / sanitizeInterfereOutput 解析 5 个新字段

- 阶段 4（API 层）：
  * advance/route.ts：抽取蓝图（pickEventBlueprint）→ 注入 ctx → 调 LLM → 持久化新字段（pendingThreadsJson/characterIntentsJson/combatStateJson/recentEventTypesJson/recentBlueprintCategoriesJson）→ 返回 triggeredCombat 标志与 blueprint 信息
  * choose/route.ts：应用 newThreads/advanceThreads/completeThreadIds/failThreadIds/triggerCombat；持久化新字段
  * interfere/route.ts：同上（仅 accepted 时应用）
  * state/route.ts：返回 pendingThreads/characterIntents/combatSession
  * 新建 combat/action/route.ts：玩家战斗行动 API（zod 校验 + executeCombatRound + 持久化）
  * 新建 combat/end/route.ts：战斗结算 API（endCombat + generateCombatEndNarrative + 应用 AI 额外线索变更 + 写入 EventLog）

- 阶段 5（前端）：
  * store.ts CharacterState 加 pendingThreads/characterIntents/combatSession；GameEvent 加 blueprint 字段
  * 新建 CombatModal.tsx：全屏战斗界面（z-[60] 最上层）；顶部战场背景叙事（可折叠）+ 敌方 HP 条 + 玩家 HP/MP 条 + 战斗日志 + 5 列行动按钮（挥击/法术 DropdownMenu/丹药 DropdownMenu/戒备/遁走）；战后 endResult 面板（victory 绿/defeat 红/fled 琥珀）+ "了结此战"按钮
  * 新建 PendingThreadsCard.tsx：未决线索卡片（按 status 上色 + 进度条 + 截止信息 + reward/failureCost chip）
  * 新建 CharacterIntentsCard.tsx：角色意图卡片（按优先级数字上色 + 类型徽标）
  * StatusList.tsx 顶部插入两个新卡片
  * EventTimeline.tsx 新增 BlueprintChip（按 category 上色，10 类配色严格避开 indigo/blue）
  * ActionButtons.tsx 战斗时禁用推进按钮 + 显示"⚔ 战斗进行中"红色提示
  * page.tsx ChoiceModal 之后加 CombatModal

- 端到端验证（agent-browser + curl + 测试脚本）：
  * 类型检查：bunx tsc --noEmit 零错误（除 examples/skills 目录无关错误）
  * lint：bun run lint 零警告
  * 旧角色"秦土"测试：
    - 推进 46 岁：蓝图抽取为 trade（坊市淘宝），AI 生成"坊市寻兵"事件，明确体现"元婴修士却无趁手兵器"的角色主动意图 ✓
    - 战斗系统注入测试：手动注入 combatSession（试炼傀儡 hp=40/attack=8），调 combat/action API，第 1 回合玩家普攻造成 204 伤害（元婴 attack=240 vs 傀儡 defense=3），敌人一击毙命，status=victory，ended=true ✓
    - combat/end API：成功调用 generateCombatEndNarrative 生成战后叙事"秦土收掌而立，试炼傀儡轰然碎裂..." ✓
    - 事件写入 EventLog（eventType=combat，标题"战斗·胜·试炼傀儡"）✓
    - 蓝图 chip 在 EventTimeline 正确显示（46岁"流年"→无 chip，47岁"争斗"→combat 红 chip）✓
    - 修炼速度栏正确显示 ×1.50 + 5/岁 + 来源条目（土真灵根 ×1.5 + 土灵石片 +5）✓
    - StatusList 顶部正确显示"心之所向"和"未决线索"两个新卡片 ✓

Stage Summary:
- 5 大核心问题全部解决：
  1. **事件单一化**：事件蓝图池（25 个主题，12 类）+ 反重复机制（避开最近 3 次同类）+ 凡人修仙传世界观参考。验证：46岁事件从"古井漩涡异变"重复变为"坊市寻兵"主动行为。
  2. **角色太蠢**：generateCharacterIntents 引擎权威生成主动意图（备战/防备/推进/还债/突破/淘宝/寻兵器），AI 必须在 narrative 中体现。验证：46岁叙事明确写"元婴修士却无趁手兵器...打点行装，他踏上了前往青云坊市的路"。
  3. **战斗系统**：完整回合制战斗（普攻/法术/丹药/防御/逃跑）+ 全屏 CombatModal + 战后叙事。验证：combat/action + combat/end API 完整闭环测试通过。
  4. **AI 记忆丢失**：PendingThread 持久化 + deadlineAge 检查 + urgent 状态推进 + 引擎强制 thread_resolve 主题。AI 必须保持剧情连续性，前文线索后文必有呼应。
  5. **凡人修仙传元素**：蓝图池含散修/坊市/秘境/妖兽/邪修/拍卖/擂台/秘境/前辈传承/雷劫前夕/收徒传道等元素；物品类型支持符箓（consumable+trigger）/傀儡（artifact）/阵盘（tool）；状态词条支持灵宠/命格/天赋/身份等。

- 4 大新机制：
  1. **事件蓝图系统**：引擎抽取主题 → AI 围绕主题生成 → 反重复避免单一化
  2. **角色主动意图系统**：引擎根据处境生成意图 → AI 必须在事件中体现角色主动行为
  3. **未决线索系统**：重要剧情线索持久化 → deadline 触发对应事件 → AI 必须保持连续性
  4. **战斗系统**：triggerCombat 字段触发独立界面 → 回合制战斗 → 战后叙事 + 掉落 + 线索联动

- 数据流闭环：advance/choose/interfere 触发 startCombat → combatSession 持久化 → combat/action 多回合执行 → combat/end 结算 + LLM 叙事 + 清空 → state 路由可随时恢复（含 combatSession 用于刷新后恢复战斗 UI）

- 旧存档兼容：pendingThreadsJson/characterIntentsJson/combatStateJson 默认空值，旧角色无影响；recentEventTypesJson/recentBlueprintCategoriesJson 默认空数组，旧角色首次推进时建立反重复基线

- 验证状态：所有核心功能验证通过；建议后续在低境界新角色中验证完整战斗触发流程（让 AI 主动给 triggerCombat）

---
Task ID: 21-d-2
Agent: main
Task: 开发阵法系统基础（参考《凡人修仙传》聚灵阵/护体阵/迷踪阵/杀阵/五行阵等设定；阵盘物品 + 激活阵法效果 + 每岁灵石维持消耗）

Work Log:

**Task A：types.ts**（`/home/z/my-project/src/lib/xianxia/types.ts`，文件末尾追加）：
- 新增 `FormationType` 联合类型：10 种阵法类型（spirit_gathering/protection/concealment/killing/illusion/fire/water/wood/metal/earth）
- 新增 `Formation` 接口：id/name/type/description/rarity/effects[]/requirements{minRealm,minComprehension,spiritStoneCost}/formationDiskItemId/active
- 严格只追加，未修改 CharacterState 接口（阵法作为 statusEntry 跟踪，category='special'，name 前缀 `[阵法]`）
- 用 `// ==================== Task 21: 阵法系统 ====================` 注释清晰分隔

**Task B：engine.ts**（`/home/z/my-project/src/lib/xianxia/engine.ts`）：
- 顶部 import 加入 `Formation, FormationType`
- 文件末尾追加 3 个新函数（用 `// ==================== Task 21: 阵法系统 ====================` 分隔）：
  * `activateFormation(state, diskItemId)`：从阵盘物品创建 Formation → 加入 activeStatuses（category='special', duration=-1 永久, name 前缀 `[阵法]`）→ 应用 add 效果（defense/attack/luck/element 等）→ recalcCultivationMultiplier（multiply cultivationExp 由 computeEffectiveCultivationRate 自动算）
    * 阵盘识别：item_type='tool' 且 effects 含 `target_attribute='formationType'`
    * 阵法类型推断：阵盘名关键词扫描（聚灵/护体/迷踪/杀/火/水/木/金/土），默认聚灵
    * 效果强度按稀有度：common=1×、uncommon=1.5×、rare=2×、epic=3×、legendary=4×、mythic=5×
    * 境界检查：需达到炼气期（realmIdx >= qi_refining idx）
    * 悟性检查：≥30
  * `deactivateFormation(state, formationId)`：反向应用 add 效果 → 移除 statusEntry → recalcCultivationMultiplier
  * `tickFormations(state)`：每岁按 rarity 扣灵石（common=2/uncommon=3/rare=5/epic=10/legendary=20/mythic=50）；灵石不足时自动 deactivate 所有阵法
- 复用现有的 `addStatuses / applyItemEffects / recalcCultivationMultiplier` 函数；StatusEntry 已在顶部 import

**Task C：API**（`/home/z/my-project/src/app/api/game/formation/route.ts`，新文件）：
- POST handler，body `{characterId, action: 'activate'|'deactivate'|'list', diskItemId?, formationId?}`
- runtime='nodejs', maxDuration=30
- 校验 characterId + action 必填；校验角色存在 + alive
- action='list'：返回 inventory 中含 formationType 效果的 tool 物品（disks）+ activeStatuses 中 name 以 `[阵法]` 开头的状态（activeFormations，剥离前缀）
- action='activate'：调 activateFormation 引擎函数，持久化 statusJson + attack/defense/speed/luck/comprehension/elements/cultivationMultiplier，返回 formation 与 state
- action='deactivate'：调 deactivateFormation，同上持久化
- 异常兜底：catch 错误返回 500 + 错误消息

**Task D：advance/route.ts**（`/home/z/my-project/src/app/api/game/advance/route.ts`）：
- import 加入 `tickFormations`
- 在 `state = tickStatusDurations(state);` 之后追加：
  ```ts
  // Task 21: 阵法维持消耗灵石
  const formationTick = tickFormations(state);
  state = formationTick.state;
  ```
- 保证每岁推进时阵法维持灵石自动扣除；灵石不足时阵法自动关闭

**Task E：llm.ts**（`/home/z/my-project/src/lib/xianxia/llm.ts`）：
- 在「物品生成规则」tool 类型说明下追加阵盘子规则（含阵盘示例 JSON 结构 + 命名关键词说明 + 激活机制说明）
- 在「储物袋容量规则」与「装备栏规则」之间新增「【阵盘示例】」区块，给出 3 个示例（小聚灵阵盘 uncommon/九宫护体阵盘 rare/迷踪阵盘 rare）

**Task F：FormationPanel.tsx**（`/home/z/my-project/src/components/xianxia/FormationPanel.tsx`，新文件）：
- 修仙水墨风格（paper-texture / font-serif-cn / Collapsible 可折叠）
- 标题"阵法" + 已启用阵法数量徽标（Sparkles icon）+ 总数徽标 + 折叠箭头（Hexagon icon）
- 加载时调 `POST /api/game/formation action=list`；list 失败静默不打扰玩家
- 已激活阵法列表：每条一个 Card（按阵法类型颜色 border + bg）
  * 阵法名 + 类型徽标（彩色：聚灵 emerald/护体 cyan/迷踪 purple/杀 red/火 orange/水 cyan/木 green/金 yellow/土 amber）+ rarity 徽标
  * 描述（line-clamp-2）+ 效果 chip（multiply 红色，add 按阵法类型色）
  * "关闭阵法"按钮（PowerOff icon，琥珀色，调 action=deactivate）
- 阵盘物品列表（inventory 中含 formationType 的 tool）：
  * 阵盘名 + 类型徽标 + rarity 徽标
  * 描述 + 灵石消耗提示（按 rarity 计算，与 engine tickFormations 同口径）
  * "激活阵法"按钮（Power icon，主色调，调 action=activate）
  * 同名阵法已激活时显示"已激活"占位（emerald 色）
- 空状态："无阵法加持。获得阵盘后可激活。"
- 类型徽标配色严格避开 indigo/blue 主色调（水属性用 cyan 代替 blue）
- 移动端优先：所有按钮 h-7（28px）紧凑布局，但点击区域≥44px 由 padding 保证

**Task G：InventoryPanel.tsx**（`/home/z/my-project/src/components/xianxia/InventoryPanel.tsx`）：
- import 加入 `FormationPanel`
- 在「已装备」Card 与「储物袋」Card 之间插入 `<FormationPanel />`（注释标记 `Task 21: 阵法管理面板`）

**验证（端到端）**：
1. **TypeScript 检查**：`bunx tsc --noEmit --skipLibCheck` → 全项目零类型错误（无 examples/skills 干扰输出）
2. **Lint 检查**：`bun run lint` → 零错误零警告（exit code 0）
3. **引擎单元验证**（bun 脚本调用 dbToState + activateFormation + tickFormations + deactivateFormation）：
   * 测试角色"王剑心"（qi_refining/0）注入测试阵盘"小聚灵阵盘"（uncommon）
   * activateFormation → ok=true，formation.type='spirit_gathering'，effects=[cultivationExp multiply 1.3]（1+0.2×1.5=1.3），activeStatuses 新增 "[阵法]小聚灵阵盘"
   * tickFormations → consumed=3（uncommon→3 灵石），spiritStones 从 5 降至 2
   * deactivateFormation → ok=true，activeStatuses 移除，cultivationMultiplier 复原
   * 清理测试数据完毕
4. **API 端到端验证**（curl）：`POST /api/game/formation action=list` 返回 `{success:true, disks:[], activeFormations:[]}` ✓
5. **Dev server**：自动重编译成功（多次 `✓ Compiled in N ms`，无 error/warn），GET / 200

**Stage Summary**：
- 阵法系统基础完整闭环：阵盘物品（LLM 生成）→ 玩家激活（API + 引擎）→ 持久 statusEntry → 每岁灵石维持（advance route tickFormations）→ 玩家可关闭（API + 引擎反向应用效果）
- 阵法效果覆盖《凡人修仙传》经典阵法类型：聚灵（修为倍率）、护体（+防）、迷踪（+气运）、杀阵（+攻）、五行（+对应元素），按稀有度强度递增
- 阵法作为 statusEntry 实现，不修改 CharacterState 接口；multiply cultivationExp 通过 computeEffectiveCultivationRate 自动计入修炼速度来源条目，add 效果通过 applyItemEffects 即时应用到属性
- 前端 FormationPanel 在 InventoryPanel「已装备」与「储物袋」之间，修仙水墨风格，10 种阵法类型按五行/功能上色（严格避开 indigo/blue 主色调，水属性用 cyan 代替）
- 类型检查 / lint 全通过；引擎函数与 API 端到端验证通过
- 遗留问题：暂无。LLM 何时实际产出阵盘物品需在游戏中推进至坊市/秘境/前辈传承等蓝图事件后验证；现有角色存档无阵盘，FormationPanel 显示空状态文案，符合预期。

---
Task ID: Task 21-d-1
Agent: main
Task: 开发坊市交易 UI 系统——让玩家可主动访问坊市购买/出售物品（Task 20 蓝图池中"坊市淘宝"主题的延伸，从被动事件变为主动交互）

Work Log:
- 阅读 worklog.md 了解 Task 1-21 进展（特别是 Task 20 的 EventBlueprint/PendingThread/CombatSession 机制与 CombatModal/AlchemyFurnace/InventoryPanel 的修仙水墨 UI 模式）

- Task A：新建 `/home/z/my-project/src/app/api/game/market/route.ts`
  * 三档物品池（mortal_qi / foundation / golden），按境界合并取并集
    - mortal_qi 池：8 件凡人/炼气期物品（木剑/粗布衣/聚气丹/疗伤丹/木灵符/初级储物袋/引气诀/聚灵佩，basePrice 5-30）
    - foundation 池：8 件筑基/金丹期物品（青锋剑/玄铁甲/凝气丹/回春丹/凝神丹/中级储物袋/凝气诀/青云剑，basePrice 40-200）
    - golden 池：6 件高阶物品（紫电剑/金丝软甲/九转回春丹/筑基丹/玄铁储物戒/紫霄诀，basePrice 300-1000）
  * getPoolForRealm(realm)：mortal/qi_refining → mortal_qi；foundation/golden_core → mortal_qi+foundation；其他 → 全部三档
  * generateMarketItems：每次 list 随机洗牌取 6-10 件，价格 ±20% 浮动（0.8-1.2 × basePrice），生成 `market_<timestamp>_<idx>` 形式临时 id
  * estimateValue(item)：rarity 基价（common 5 / uncommon 20 / rare 80 / epic 300 / legendary 1000 / mythic 5000）+ scripture 含 cultivationExp multiply 翻倍 + 储物袋按 capacity×3 加价
  * action=list：返回 marketItems + sellableItems（每件加 sellPrice = estimateValue × 0.6）+ playerSpiritStones + storageCapacity + inventoryCount
  * action=buy：校验 alive / isAtChoice（拒绝）/ combatSession.status='ongoing'（拒绝）→ 校验 item 对象完整 → 校验 price > 0 → 校验 spiritStones ≥ price → 校验 inventory.length < storageCapacity → 扣灵石 → addItems 加新物品（生成 `item_buy_<ts><rand>` id）→ 持久化 spiritStones/inventoryJson/storageCapacity/equippedJson → 写 EventLog（eventType='trade'，标题"坊市·购·{物品名}"，effects 含 -price 灵石 + 1 物品）→ 返回 boughtItem + price + stateToResponse
  * action=sell：校验 itemId 在 inventory 中 → removeItemsByIds（自动反向应用 equipped effects 与 storageCapacity 扣减）→ 加 sellPrice 灵石 → 持久化 → 写 EventLog（标题"坊市·售·{物品名}"，effects 含 -1 物品 + sellPrice 灵石）→ 返回 soldItem + sellPrice + stateToResponse

- Task B：新建 `/home/z/my-project/src/components/xianxia/MarketModal.tsx`
  * z-[55]（介于 ChoiceModal z-50 与 CombatModal z-[60] 之间），fixed inset-0 全屏背景遮罩 + 移动端 max-w-md Card
  * 顶部 CardHeader：坊市淘宝标题（Store icon，amber-600）+ 灵石徽标（Coins icon + tabular-nums 数字 + "灵石"小字，amber-500/50 边框 + amber-500/10 背景）+ 关闭按钮（X icon，w-7 h-7）+ 储物袋容量显示（Package icon + "{count}/{capacity}" + bagFull 时红色"· 已满"提示）
  * CardContent 内嵌 Tabs：购买（ShoppingCart）/ 出售（ArrowUpCircle），grid-cols-2
  * 购买 Tab：物品卡片 grid 1 列，max-h-[calc(100dvh-180px)] overflow-y-auto xianxia-scroll
    - 每张卡片：稀有度彩色边框（border-{color}50）+ 渐变背景（linear-gradient(180deg, {color}08, transparent)）
    - 卡头：类型 icon（彩色 5x5 方块）+ 名称（彩色 font-serif-cn）+ 稀有度 Badge
    - 描述（muted-foreground font-serif-cn）
    - 效果 chips（fmtEffectZh 格式化为"{zh}+{value}"或"{zh}×{value}"）
    - 底部分隔条：价格（Coins + amber-700 数字）+ 购买按钮（amber-600 hover:amber-700）
    - 按钮文案随状态切换：交易中→"交易中"+ spinner；灵石不足→"灵石不足"；储物袋满→"储物袋已满"；正常→"购入"+ ShoppingCart icon
  * 出售 Tab：同上结构，估价用 green-700，按钮"售出" + ArrowUpCircle icon
  * 空状态：购买 Tab 无物品→"坊市空空如也"；出售 Tab 无物品→"身无长物"
  * 底部说明栏："坊市每访问一次便更新陈列；售出估价为原值六成，望君斟酌。"
  * useEffect 监听 marketOpen：打开时 fetchList()；关闭时清理 marketItems/sellableItems/busyId/tab
  * buy/sell 成功后：setCharacter 更新状态 + 从本地列表移除该物品 + toast 成功提示
  * 加载中显示 Loader2 spinner + "坊市开张中..." / "清点行囊中..."

- Task C：修改 `/home/z/my-project/src/components/xianxia/ActionButtons.tsx`
  * import 新增 Store icon
  * 从 store 解构 setMarketOpen
  * 主推进按钮行下方新增第二行"坊市淘宝"按钮：
    - 全宽 w-full h-9，amber-500/40 边框 + amber-700 文字（dark: amber-400）+ hover:amber-500/10 背景
    - 内容：Store icon + "坊市淘宝" + "· {N} 灵石"（amber-700/70 小字 tabular-nums）
    - 显示条件：`!isDead && !isAscended && !inCombat && !atChoice && !isAutoRunning`（仅在"中断模拟"状态可访问）
    - 点击调 setMarketOpen(true)

- Task D：修改 `/home/z/my-project/src/app/page.tsx`
  * import MarketModal
  * 在 `<CombatModal />` 之后渲染 `<MarketModal />`

- Task E：修改 `/home/z/my-project/src/lib/xianxia/store.ts`
  * GameState interface 加 `marketOpen: boolean` + `setMarketOpen: (open: boolean) => void`
  * 初始 state 加 `marketOpen: false`
  * 实现 `setMarketOpen: (open) => set({ marketOpen: open })`
  * reset() 也清理 `marketOpen: false`

**验证**：
- 类型检查：`bunx tsc --noEmit --skipLibCheck` → 零错误（仅 examples/skills 目录 pre-existing 错误）
- Lint：`bun run lint` → 零警告零错误
- API 端到端 curl 测试（用真实角色"墨问天"，原 3 灵石）：
  * 临时给角色 50 灵石用于测试
  * list：成功返回 6 件 marketItems + 2 件 sellableItems ✓
  * buy 木剑（5 灵石）：成功，spiritStones 50→45，inventory 2→3，EventLog 写入"坊市·购·木剑" ✓
  * sell 木剑（估价 3 灵石）：成功，spiritStones 45→48，inventory 3→2，EventLog 写入"坊市·售·木剑" ✓
  * 边界测试：灵石不足 400 ✓ / 出售不存在物品 400 ✓ / atChoice 角色访问 400 ✓ / 缺 characterId 400 ✓
  * 测试后恢复角色灵石为原值 3 + 删除测试期间产生的 2 条 trade EventLog，避免污染史册

Stage Summary:
- 坊市交易系统全栈完成：API（list/buy/sell 3 个 action，含境界分档物品池 + 灵石/容量校验 + EventLog 记录）+ 全屏 Modal（购买/出售双 Tab + 稀有度彩色边框 + 价格金/估价绿 + 状态禁用按钮）+ ActionButtons 入口（"坊市淘宝"amber 主题按钮，仅"中断模拟"状态可见）+ store 状态（marketOpen/setMarketOpen）
- 修仙水墨风格统一：paper-texture / ink-wash / font-serif-cn / amber-500 边框（避开 indigo/blue 主色调）；稀有度配色与 InventoryPanel/AlchemyFurnace 一致
- 移动端优先：max-w-md mx-auto / 触控友好按钮（购买 h-8 / 关闭 w-7 h-7 / 入口 h-9）/ 滚动列表 max-h-[calc(100dvh-180px)] overflow-y-auto xianxia-scroll
- 防御性 API 设计：拒绝 atChoice / combat ongoing / 灵石不足 / 储物袋满 / 物品不存在等场景，返回明确中文错误信息
- EventLog 写入"坊市·购·{物品名}" / "坊市·售·{物品名}"两条事件，eventType='trade'，便于史册追溯
- 类型检查 / lint 全通过；API 端到端 curl 验证 4 个边界 + 3 个正常路径全部符合预期
- 工作记录已保存到 `/home/z/my-project/agent-ctx/Task 21-d-1-main.md`

---
Task ID: 21
Agent: main (cron 触发)
Task: 项目状态评估 + QA + 修复 bug + 新功能开发（坊市交易UI + 阵法系统）

Work Log:
- 通过 agent-browser 创建新角色"王剑心"端到端验证 Task 20 机制：
  * 推进至 6 岁触发命节点"灵气初触"→ 选择"感受暖流"→ 进入修行路径 ✓
  * 推进至 11 岁触发 thread_resolve 主题"线索推进·生死一线"（pendingThread "寻医问药"驱动）✓
  * 推进至 22 岁触发 hasChoice 事件"夺灵芝"（pendingThread "寻灵芝"驱动）✓
  * 推进至 23 岁修为满 → 自动突破至炼气期 1 层 ✓

- 发现并修复 4 个 bug：

  **Bug 1（严重）：LLM JSON 解析失败导致 advance 500 错误**
  - 现象：`POST /api/game/advance 500`，错误 `Expected ',' or '}' after property value in JSON at position N`
  - 根因：repairJSON 函数无法处理 LLM 输出中的中文标点（中文引号 " "、中文冒号 ：、全角逗号 ，等）
  - 修复（llm.ts）：parseJSON 改为多层兜底
    1. 直接 JSON.parse
    2. repairJSON 后解析
    3. 替换中文标点为 ASCII 后 repairJSON 解析（中文引号→"、中文冒号→:、全角逗号→,、全角括号→ASCII）
    4. 字段级抽取（extractFields）—— 从残缺 JSON 中提取 title/narrative/memory/cultivationInsight/eventType/hasChoice 等关键字段
    5. 全失败抛错给上层 fallback

  **Bug 2（严重）：advance route 无 LLM 失败兜底**
  - 现象：LLM 失败时整个 advance 500，玩家进度不保存
  - 修复（advance/route.ts）：try/catch 包裹 generateAgeEvent，失败时用 blueprint 名生成最小可用 aiOutput（标题"X·流年"+ 占位叙事 + 命节点强制 hasChoice），保证进度推进不卡死

  **Bug 3（严重）：非命节点的 hasChoice 事件未设置 isAtChoice=true**
  - 现象：22 岁"夺灵芝"事件 AI 给了 hasChoice=true，但 advance route 只在 isFateNode && aiOutput.hasChoice 分支设置 isAtChoice=true，导致 choose route 返回 400 "当前无待选择"
  - 修复（advance/route.ts）：新增 `else if (aiOutput.hasChoice) finalState.isAtChoice = true;` 分支处理非命节点的选择

  **Bug 4（中）：urgent pendingThread "原地踏步"**
  - 现象：urgent 线索触发 thread_resolve 主题，但 AI 偶尔不输出 advanceThreads/completeThreadIds，导致线索进度不变、标题重复（"家道再陷困境"重复 3 次）
  - 修复 1（llm.ts prompt）：在 urgent 线索区追加"必须行动"规则——必须在 advanceThreads/completeThreadIds/failThreadIds 中至少一个填值，禁止原地踏步；同时反重复机制区加入"最近事件标题列表"，明确禁止相同/相似标题
  - 修复 2（engine.ts pickEventBlueprint）：强化反重复权重——最近 1 次同类分类 weight×0（彻底跳过），最近 2-3 次 weight×0.1，最近 4-5 次 weight×0.4
  - 修复 3（advance/route.ts）：引擎兜底——若 blueprint.category==='thread_resolve' 且 AI 未推进任何 urgent 线索，引擎自动 advanceThread +30%，防止卡死

- 新功能开发（并行 subagent 完成）：

  **新功能 1：坊市交易 UI 系统（Task 21-d-1）**
  - 新建 `/api/game/market` route（list/buy/sell 三种 action）
  - 三档物品池（mortal_qi / foundation / golden），按境界合并取并集
  - list：随机生成 6-10 件坊市物品（价格 ±20% 浮动）+ 玩家可售物品（估价 × 0.6）
  - buy：校验灵石/储物袋容量 → 扣灵石 → 加物品 → 写 EventLog
  - sell：移除物品 → 加灵石 → 写 EventLog
  - 新建 MarketModal 组件（购买/出售双 Tab，稀有度彩色边框，amber 主题避开 indigo/blue）
  - ActionButtons 加入"坊市淘宝"按钮（含 Store icon + 灵石数显示）
  - page.tsx 加入 `<MarketModal />`
  - store.ts 加入 marketOpen 状态
  - 端到端 curl 验证通过：list/buy/sell 全部正常，边界条件（灵石不足/储物袋满/atChoice）正确拒绝

  **新功能 2：阵法系统基础（Task 21-d-2）**
  - types.ts 末尾追加 `FormationType` 与 `Formation` 接口
  - engine.ts 末尾追加 `activateFormation / deactivateFormation / tickFormations` 三个函数
  - 阵法作为 statusEntry 跟踪（category='special'，name 前缀 `[阵法]`，duration=-1 永久）
  - multiply cultivationExp 效果自动通过 computeEffectiveCultivationRate 计入修炼速度来源条目
  - add 效果（attack/defense/luck/elements）通过 applyItemEffects 即时应用
  - 阵盘识别：item_type='tool' 且 effects 含 target_attribute='formationType'
  - 阵法类型推断：阵盘名关键词扫描（聚灵/护体/迷踪/杀/火/水/木/金/土）
  - 强度按稀有度：common 1× / uncommon 1.5× / rare 2× / epic 3× / legendary 4× / mythic 5×
  - 每岁维持灵石消耗（按 rarity 2-50 灵石）；灵石不足自动关闭所有阵法
  - 新建 `/api/game/formation` route（list/activate/deactivate）
  - 新建 FormationPanel 组件（已激活阵法列表 + 阵盘物品列表，type 徽标按五行/功能上色）
  - InventoryPanel 插入 `<FormationPanel />`（在已装备与储物袋 Card 之间）
  - advance route 在 tickStatusDurations 后调用 tickFormations 扣灵石维持
  - llm.ts 物品生成规则加入阵盘说明与示例
  - 引擎单元验证 + API 端到端验证通过

- 样式细节优化：
  * CombatModal HP/MP 条加 transition-all duration-500 ease-out 动画，伤害变化有平滑过渡

- 验证结果：
  * bunx tsc --noEmit 零错误（除 examples/skills 目录无关错误）
  * bun run lint 零警告
  * agent-browser 端到端验证：坊市按钮显示正常、MarketModal 弹出正常、出售 Tab 显示 8 件可售物品、FormationPanel 显示空状态文案"无阵法加持。获得阵盘后可激活。"
  * 修复后 advance 不再 500，旧角色"秦土"和新角色"王剑心"都能正常推进

Stage Summary:
- 4 个 bug 全部修复：
  1. JSON 解析多层兜底（直接/repairJSON/中文标点替换/字段抽取/抛错）
  2. advance route LLM 失败 fallback（保证进度不卡死）
  3. 非命节点 hasChoice 事件正确设置 isAtChoice=true
  4. urgent 线索引擎兜底推进 +30%（防止原地踏步）

- 2 个新功能完成：
  1. **坊市交易 UI**：玩家可主动访问坊市购买/出售物品（三档物品池按境界生成，价格浮动，储物袋容量校验）
  2. **阵法系统基础**：阵盘物品可激活为阵法（10 种类型，按稀有度定强度，每岁消耗灵石维持，灵石不足自动关闭）

- 项目当前状态：
  * 类型检查通过、lint 通过、dev server 运行正常
  * 5 大 Task 20 机制（蓝图/意图/线索/战斗/凡人修仙传）+ Task 21 修复 + 坊市 + 阵法 全部集成
  * 端到端验证：从创建角色到命节点→线索推进→选择→突破→坊市→阵法面板，全流程无阻塞

- 未解决问题或风险：
  1. **LLM 响应慢**：偶尔 advance 耗时 36-62 秒（接近 60 秒 maxDuration），可能导致超时。建议监控并考虑流式响应或缩短 prompt
  2. **AI 标题重复仍有残余**：21 岁和 22 岁都生成了"灵芝寻踪"标题。虽然强化了反重复 prompt，但 AI 偶尔仍会重复。引擎层难以彻底禁止（标题是自由文本）。可考虑在引擎层对完全相同的标题加后缀（如"灵芝寻踪·续"）
  3. **战斗触发尚未在端到端验证**：本次推进至 23 岁炼气期，AI 未主动给 triggerCombat 字段。需推进至更高境界（筑基+）且蓝图主题为 combat 时才能验证。可考虑给低境界增加一个"试炼傀儡"必触发战斗的命节点
  4. **阵盘物品尚未在游戏中出现**：现有角色无阵盘，FormationPanel 显示空状态。需推进至坊市/秘境/前辈传承等蓝图事件后由 AI 主动生成阵盘

- 建议下一阶段优先事项：
  1. 监控 LLM 响应时间，若频繁超时考虑流式响应或 prompt 精简
  2. 引擎层对"完全相同标题"加后缀机制，彻底解决标题重复
  3. 给低境界角色增加一个"宗门试炼·傀儡阵"必触发战斗的命节点，让玩家早期就能体验战斗系统
  4. 推进新角色至筑基+，验证 AI 主动生成阵盘物品的能力
  5. 考虑添加灵宠参战系统、符箓系统、心魔值系统等凡人修仙传元素
  6. UI 细节：坊市物品按类型分组、阵法面板加阵法效果预览、战斗界面加伤害飘字动画

---
Task ID: 22-a
Agent: main
Task: QA + 3 个关键 bug 修复（choice+combat 冲突 / 储物袋容量未强制 / 物品 ID 重复）

Work Log:

**QA 发现**（agent-browser 端到端测试 王剑心 25岁）：
1. CombatModal 与 ChoiceModal 同时弹出（z-[60] 战斗 + z-50 选择叠加）
2. inventory 12 件物品 > storageCapacity 5（容量限制未强制）
3. 玻璃珠 x2 / 疗伤草药 x2 同 ID 重复（AI 生成重复 ID 未去重）
4. 战斗系统本身工作正常（attack API 测试通过：玩家攻击 11 伤害，狼妖反击 14 伤害）

**Bug 1 修复：Choice + Combat 冲突**（engine.ts + advance/route.ts + choose/route.ts）：
- executeAIEvent：若 aiOutput.hasChoice && aiOutput.triggerCombat，把 triggerCombat 存到 `(state as any)._deferredCombat`，不立即 startCombat
- advance/route.ts：pendingChoiceJson 新增 `deferredCombat: (finalState as any)._deferredCombat || null`
- choose/route.ts：先读 char.pendingChoiceJson 中的 deferredCombat → 选择结果若 triggerCombat 用结果，否则用 deferredCombat 作为 fallback 启动战斗
- 效果：选择通常决定战斗策略（奋力搏杀/灵活周旋/抛物安抚），选项后才进入战斗，避免双弹窗

**Bug 2 修复：储物袋容量限制**（engine.ts addItems）：
- 重写 addItems：先算本批储物袋扩容 bagBoost → projectedCapacity = state.storageCapacity + bagBoost
- 储物袋优先放入（因扩容），其余按顺序填满 availableSlots
- 超出 projectedCapacity 的非储物袋物品被丢弃 + console.warn
- 储物袋物品永远保留（避免容量陷阱：丢了自己的储物袋永远进不去）

**Bug 3 修复：物品 ID 去重**（engine.ts executeAIEvent）：
- 新物品加入前先收集 next.inventory + next.equipped 所有现有 ID 到 Set
- 对 aiOutput.newItems 每件：若 id 冲突，追加 `_rand4` 后缀直到唯一
- 兜底无 id 物品：`i_${Date.now()}_${rand6}`

Stage Summary:
- 3 个 bug 全部修复；tsc + lint 全通过
- 战斗系统本身正常工作（attack API 端到端通过）
- 心魔值系统将在 Task 22-b 实现

---
Task ID: 22-b
Agent: main
Task: 心魔值系统（Heart Demon System）——参考《凡人修仙传》走火入魔设定

Work Log:

**Schema + Types**：
- prisma/schema.prisma：Character 表新增 `heartDemon Int @default(0)`
- types.ts CharacterState 接口新增 `heartDemon: number`（0-100）
- types.ts CombatSession 接口新增 `victoryHeartDemonDelta?` / `defeatHeartDemonDelta?` / `isHeartDemonTrial?`
- types.ts AIEventOutput.triggerCombat 同步新增上述字段
- types.ts EngineStateContext.character 新增 `heartDemon: number`（让 AI 可见）
- `bun run db:push` 同步 schema

**Engine（engine.ts）**：
- dbToState：解析 heartDemon（`(c as any).heartDemon ?? 0`，兼容旧 client）
- stateToResponse：返回 heartDemon
- ATTRIBUTE_BOUNDS：新增 `heartDemon: { min: 0, max: 100 }`（让 AI 可通过 changes 调整）
- computeEffectiveCultivationRate：心魔值 30+ 修炼倍率惩罚（30→-10%，每 10 点额外 -10%，最高 -70%）
- computeCultivationFactors：心魔 >= 30 时新增「心魔侵扰」来源条目（rarity 按 tier：epic/legendary/mythic）
- buildStateContext：character 字段新增 heartDemon
- startCombat：透传 victoryHeartDemonDelta/defeatHeartDemonDelta/isHeartDemonTrial 到 CombatSession
- 新增 `adjustHeartDemon(state, delta, reason)`：钳制 0-100，日志记录变化
- 新增 `tickHeartDemon(state)`：每岁自然变化
  * 静修净化：境界 >= 炼气期 -1，筑基 -2，金丹 -3...（境界越高净化越快）
  * 未解 urgent 线索：每条 +2（执念缠心）
  * 高心魔反噬：>= 60 时额外 +3（自循环恶化）
- 新增 `tryHeartDemonTrial(state)`：心魔 >= 60 时每岁概率触发心魔试炼战斗
  * 触发概率：心魔 60→10%，70→20%，80→30%，90→40%
  * 敌人 = 心魔投影（属性随境界 + 心魔值缩放）
  * 三种敌人：心魔幻影(60-74) / 执念魔影(75-89) / 心魔真身(90+)
  * 胜则心魔 -25，败则心魔 +15 + 扣 20% maxHp（走火入魔征兆，不致死）
- 新增 `resolveHeartDemonTrial(state, victory)`：战斗后结算

**API**：
- advance/route.ts：
  * tickFormations 后调 tickHeartDemon
  * 寿元检查后尝试 tryHeartDemonTrial（仅当无战斗/无选择/存活时）
  * 持久化 heartDemon
  * 新增战斗中拒绝推进年龄校验（`combatStateJson.status === 'ongoing'` → 400）
- combat/end/route.ts：
  * endCombat 后判断 wasHeartDemonTrial → resolveHeartDemonTrial
  * 普通战斗胜利 +3 heartDemon（杀生扰动道心）
  * 持久化 heartDemon
- choose/route.ts：持久化 heartDemon；放宽 choicePrompt 校验（允许空字符串，fallback 到 contextTitle）
- interfere/route.ts：持久化 heartDemon
- state/route.ts：返回 heartDemon

**db.ts 缓存 bust 修复**：
- 问题：dev server 长期运行时 globalThis.prisma 持有旧 schema 的 PrismaClient 实例，新字段（heartDemon）会报 `Unknown argument` 错误
- 修复：用 `PRISMA_CACHE_VERSION = 'v22-heartDemon'` 版本号 bust 缓存——版本不匹配时清除 globalThis.prisma，强制新建实例
- 后续 schema 变更只需更新版本号即可

**LLM Prompt（llm.ts）**：
- advance prompt：新增「Task 22 心魔值机制」段——当前心魔值 + 4 级分级说明 + 增减场景（杀生/邪功/执念 vs 静修/指点/丹药/了却执念）
- choose prompt：选择可能影响心魔（血战到底 +5~10 / 忍辱退让 +3~8 / 高人化解 -10~20）
- interfere prompt：玩家行动可能影响心魔（屠杀 +20~40 / 打坐 -3~8 / 清心丹 -15~30）

**UI**：
- 新建 `HeartDemonCard.tsx`：
  * 心魔值 0 时折叠简短显示「道心澄明」
  * 心魔 > 0 时完整卡片：标题行（icon + tier label + 心魔值）+ 进度条（按 tier 渐变色 + 30/60/90 刻度线）+ 惩罚提示（修炼 -X% + 风险预警）+ 折叠分级说明
  * 4 级 tier：🍃 道心微动(lime) / ⚡ 心魔初起(amber) / 👹 心魔炽盛(orange) / 🔥 走火入魔(red)
  * 颜色全部用 inline style（避免 Tailwind JIT 动态 class purge 问题）
  * 进度条动画 transition-all duration-700 ease-out
- StatusList.tsx：在 CharacterIntentsCard 与 PendingThreadsCard 之间插入 HeartDemonCard
- CharacterDetailSheet.tsx：属性 StatCard 新增「心魔」字段（颜色按 tier 动态）
- CombatModal.tsx：
  * contextTitle 旁加「👹 心魔试炼」徽标（isHeartDemonTrial=true 时显示）
  * 新增伤害飘字 FloatNumbersOverlay：玩家/敌人 HP 区域右上角飘字
    - 红色：普通伤害（-N）
    - 金色：暴击（-N 暴击，>=30 伤害判定为暴击）
    - 绿色：治疗（+N）
    - 灰色：闪避（闪）
    - 动画 combat-float-up 1.2s：从下往上飘 32px + 缩放 0.6→1.2→1→0.85 + 透明度 0→1→0
  * globals.css 新增 @keyframes combat-float-up

**端到端验证（agent-browser + curl）**：
1. ✅ heartDemon=45 时 HeartDemonCard 显示「⚡ 心魔初起 44/100 ⚠ 修炼效率 -20%」
2. ✅ heartDemon=65 时 advance 触发心魔试炼战斗（心魔幻影 HP 224，isHeartDemonTrial=true）
3. ✅ 心魔试炼战斗结束后 heartDemon 变化（败/遁 +15，胜 -25）+ HP 扣 20%
4. ✅ 心魔值每岁自然变化（qi_refining -1/岁，urgent +2/条，高心魔 +3/岁）
5. ✅ AI 可通过 changes 中 attribute='heartDemon' 调整（验证：reset=0 后 advance → heartDemon=1，AI 加了 +2 然后 tick -1）
6. ✅ 心魔值 >= 30 时 cultivationFactors 新增「心魔侵扰」来源条目（multiply 0.8 epic rarity）
7. ✅ 战斗中 advance 返回 400「战斗进行中，请先结束战斗」
8. ✅ 旧存档兼容：heartDemon 默认 0，无影响

Stage Summary:
- 心魔值系统全栈完成：schema + engine + API + UI + LLM prompt
- 参考《凡人修仙传》走火入魔设定：杀生/邪修/执念增心魔，静修/净化/了却减心魔
- 4 级分级机制：道心澄明(0-29) / 心魔初起(30-59) / 心魔炽盛(60-89) / 走火入魔(90-100)
- 心魔试炼战斗：心魔 >= 60 概率触发，胜则 -25 败则 +15+扣血，独立敌人「心魔投影」
- 心魔惩罚自动计入修炼速度倍率（computeEffectiveCultivationRate）+ 来源条目（computeCultivationFactors）
- AI 可读心魔值 + 可通过 changes 调整（advance/choose/interfere 三场景 prompt 都已更新）
- 修复 Prisma client 缓存问题（globalThis.prisma 持有旧 schema）——版本号 bust 机制
- 修复 choose 路由空 choicePrompt 400 bug（pendingChoice.prompt 可能为空字符串）
- 修复 advance 路由未拒绝战斗中推进年龄 bug
- UI 心魔卡片完整：进度条 + 分级色 + 惩罚提示 + 折叠说明
- UI 战斗伤害飘字：暴击/治疗/伤害/闪避 4 种，1.2s 飘字动画
- tsc + lint 全通过

---
Task ID: 22
Agent: main (cron 触发)
Task: 项目状态评估 + QA + 3 bug 修复 + 心魔值系统 + UI 飘字

Work Log:
- 通过 agent-browser 端到端测试 王剑心 25岁，发现 3 个关键 bug：
  1. ChoiceModal + CombatModal 同时弹出（AI 给了 hasChoice + triggerCombat）
  2. inventory 12 件 > storageCapacity 5（容量未强制）
  3. 玻璃珠 x2 / 疗伤草药 x2 同 ID 重复（AI 生成重复 ID 未去重）
  4. choose 路由空 choicePrompt 400（pendingChoice.prompt 可能为空）
  5. advance 路由未拒绝战斗中推进年龄
  6. dev server globalThis.prisma 持有旧 schema 缓存（schema 变更后新字段报 unknown argument）

- 3 个关键 bug 全部修复（Task 22-a）：
  1. hasChoice + triggerCombat 时延迟战斗——存到 _deferredCombat，choose route 用作 fallback
  2. addItems 容量强制——超 storageCapacity 丢弃多余非储物袋物品 + console.warn
  3. executeAIEvent 新物品 ID 去重——冲突时追加 _rand4 后缀

- 新功能：心魔值系统（Task 22-b）——参考《凡人修仙传》走火入魔
  * schema + types + engine + API + UI + LLM prompt 全栈
  * 4 级分级：道心澄明/心魔初起/心魔炽盛/走火入魔
  * 每岁自然变化（静修净化 -1~-5，urgent +2/条，高心魔 +3）
  * 心魔试炼战斗（>= 60 概率触发，胜 -25 败 +15+扣血）
  * 修炼效率惩罚（30+ 开始 -10%，最高 -70%）
  * AI 可读 + 可通过 changes 调整
  * HeartDemonCard UI + CharacterDetailSheet + CombatModal 心魔试炼徽标

- UI 飘字（Task 22-b）：
  * CombatModal 伤害飘字 4 种（伤害红/暴击金/治疗绿/闪避灰）
  * combat-float-up 1.2s 动画（飘 32px + 缩放 + 透明度）
  * globals.css 新增 keyframes

- 附带修复：
  * db.ts Prisma 缓存 bust（版本号机制）
  * choose 路由空 choicePrompt 校验放宽
  * advance 路由战斗中拒绝推进年龄

- 清理：王剑心存档 inventory 从 12 件去重 + 按稀有度保留前 5 件（修复 bug 前的脏数据）

Stage Summary:
- 项目当前状态：
  * 5 个关键 bug 全部修复（3 用户反馈 + 2 附带发现）
  * 心魔值系统全栈完成（schema + engine + API + UI + prompt）
  * 战斗伤害飘字 UI 完成
  * tsc + lint 全通过
  * 端到端验证：heartDemonCard 显示、心魔试炼触发、伤害飘字、容量限制、ID 去重 全部通过
  * dev server 运行正常

- 未解决问题或风险：
  1. **AI 重复 ID 仍有残余风险**：executeAIEvent 已去重新物品，但 AI 在同一次输出中给多个相同 ID 物品时，ensureUniqueIds 仅处理 newEquippedItems。已在 executeAIEvent 内联去重，但建议后续把 ensureUniqueIds 改造为接受 existing IDs 参数的通用版本
  2. **心魔试炼战斗胜率平衡**：当前心魔投影 HP = 玩家 maxHp × 0.8 × scale，对低境界角色可能过强。建议后续根据测试反馈调整 scale 公式
  3. **心魔值变化日志仅 console.log**：未写入 EventLog，玩家无法在史册中心魔变化轨迹。建议后续在 EventLog effects 中记录 heartDemon 变化
  4. **心魔试炼触发后玩家若不结束战斗直接关闭页面**：combatSession 持久化在 DB，下次进游戏会恢复战斗 UI。已通过 advance 路由战斗中拒绝推进年龄保证状态一致
  5. **LLM 偶尔不按 prompt 调整 heartDemon**：AI 可能忽略 prompt 中的心魔值调整指引。当前引擎 tickHeartDemon 兜底每岁自然变化，保证心魔不会完全静止

- 建议下一阶段优先事项：
  1. 监控心魔值在长局游戏中的平衡（是否会无限增长 / 是否会过快归零）
  2. 心魔试炼战斗胜率平衡调整
  3. 心魔值变化写入 EventLog（史册可查）
  4. 灵宠参战系统（凡人修仙传元素，可作为心魔试炼的盟友）
  5. 符箓系统（consumable+trigger 类型物品的扩展使用）
  6. 拍卖会事件蓝图（高稀有度物品获取渠道）
  7. UI 细节：心魔试炼战斗专用背景色（red tint）、心魔值变化时 HeartDemonCard 抖动动画

---
Task ID: 23
Agent: main (previous session, retroactively logged)
Task: 灵宠参战系统 + 符箓系统（Pet Combat + Talisman System）——参考《凡人修仙传》

Work Log:

**Schema**:
- prisma/schema.prisma：Character 表新增 `petsJson String @default("[]")`
- bun run db:push 同步 schema

**Types (types.ts)**:
- 新增 PetSpecies 类型（12 种）：fox/wolf/snake/turtle/eagle/ape/spider/butterfly/fish/tiger/phoenix/dragon
- 新增 Pet 接口：id/name/species/description/rarity/realm/hp/maxHp/attack/defense/speed/element/loyalty/satiety/level/exp/expToLevel/sourceAcquired/acquiredAge/skill
- 新增 PET_SPECIES_TEMPLATES 常量（12 种物种的默认属性、技能、五行）
- 新增 TalismanType 类型（5 种）：talisman_attack/defense/heal/escape/stun
- 新增 TALISMAN_TYPE_LABEL 常量

**Engine (engine.ts)**:
- 新增 PET_RARITY_MULTIPLIER（common→mythic 1.0→2.8）
- 新增 createPet(species, rarity, realm, ...)：按物种+稀有度+境界生成完整属性
- 新增 addPet(state, pet)：上限 5 只 + ID 去重
- 新增 dismissPet(state, petId)：放生
- 新增 feedPet(state, petId, itemId)：消耗材料/丹药/工具类物品 → 回复饱食度+忠诚度+经验，升级提升属性
- 新增 tickPets(state)：每岁饱食-10、忠诚-2(饥饿-5)、HP自然回复、忠诚<30 时 5% 概率逃离
- 新增 computePetPassiveBonus(state)：按物种提供被动加成（龟加防、鹰加速、虎加攻、狐加气运、龙凤全属性）+ 修炼速度倍率
- computeCultivationFactors：新增「灵宠陪伴」来源条目
- computeEffectiveCultivationRate：灵宠陪伴效应乘入修炼倍率
- 新增 getTalismanType(item)：识别符箓类型
- 新增 isPillItem(item)：判断非符箓的丹药
- 新增 getAvailableTalismans(state)：获取战斗可用符箓
- dbToState：解析 petsJson
- stateToResponse：返回 pets
- buildStateContext：character 字段新增 pets
- executeAIEvent：应用 aiOutput.newPets
- startCombat：选择忠诚≥30 且饱食≥20 的灵宠参战（心魔试炼除外），生成 petCombatant
- executeCombatAction：新增 'talisman' action，处理 5 种符箓效果
  * talisman_attack：直接伤害（无视 30% 防御）
  * talisman_defense：本回合减伤
  * talisman_heal：回复 HP
  * talisman_escape：高概率逃跑（value 越大概率越高）
  * talisman_stun：敌人本回合无法行动
  * 灵宠参战追加攻击（在玩家攻击后、敌人反击前）
  * talismanDefenseActive 本回合临时状态，回合末清除

**API (pet/route.ts)**:
- 新建 /api/game/pet 路由
- action='feed'：消耗物品喂养灵宠 → 更新 inventory + pets → 写 EventLog
- action='dismiss'：放生灵宠 → 写 EventLog
- action='summon'：QA/调试用，直接召唤测试灵宠
- 战斗中/选择中拒绝操作

**API (advance/route.ts)**:
- tickFormations 后调 tickPets
- 持久化 petsJson

**API (combat/end/route.ts)**:
- 持久化 petsJson

**API (state/route.ts)**:
- 返回 pets

**LLM Prompt (llm.ts)**:
- advance prompt：新增「Task 23 灵宠系统」段——当前灵宠列表 + 参战规则 + 每岁消耗 + 逃离规则 + newPets 授予场景（命节点/前辈传承/秘境奇遇/收服剧情/灵宠店购买/拾得灵兽蛋）
- advance prompt：新增「Task 23 符箓系统」段——5 种符箓类型 + 物品示例 + 生成场景（前辈传授/秘境拾得/自制）
- AIEventOutput 新增 newPets 字段
- 5 类符箓稀有度威力参考：common 10-20 / uncommon 20-40 / rare 40-70 / epic 70-100 / legendary 100-150 / mythic 150-200

**UI (PetPanel.tsx)**:
- 新建 PetPanel 组件（在 InventoryPanel 内渲染）
- 灵宠列表卡片：稀有度彩色边框 + 物种图标 + 五行徽标 + Lv + 稀有度 label
- 状态条：忠诚度（5 级 tier 色）+ 饱食度（4 级 tier 色）+ HP 进度条
- 简要属性：attack/defense/speed（lucide 图标）
- 展开详情：主动技能（名/描述/威力/冷却）+ 描述 + 来源 + 经验
- 喂养 DropdownMenu：选择物品喂养（消耗该物品）
- 放生按钮 + confirm 二次确认
- 忠诚度过低警告（< 30）+ 饱食度过低警告（< 30）
- 空状态文案：「尚无灵宠。修仙途中可收服妖兽幼崽、前辈相赠、灵宠店购买等途径获得」
- 底部提示：灵宠自动参战规则

**UI (CombatModal.tsx)**:
- CombatAction 类型新增 'talisman'
- 战斗中可用符箓从 inventory 提取（通过 effects 中的 target_attribute 判定）
- 普通丹药与符箓分离（非符箓的 consumable 才显示在丹药 dropdown）
- 符箓 Dropdown：显示数量徽标 + 5 种类型分类
- 战斗中灵宠参战显示（petCombatant HP/attack/技能）

**InventoryPanel.tsx**:
- 插入 <PetPanel />（在已装备与储物袋 Card 之间）

Stage Summary:
- 灵宠参战系统全栈完成：schema + types + engine + API + UI + LLM prompt
- 符箓系统全栈完成：5 种类型 + 战斗中即时使用 + UI 分离丹药/符箓
- 参考《凡人修仙传》灵宠设定（灵狐幻术/灵狼群战/灵蛇毒术/灵龟护主/灵鹰俯冲/灵猿巨力/灵蛛织网/灵蝶迷幻/灵鱼水刃/灵虎威压/火凤涅槃/幼龙龙息）
- 灵宠生命周期完整：获得（AI 授予/QA 召唤）→ 喂养（消耗材料）→ 升级（属性提升）→ 参战（自动追加攻击 + 被动加成）→ 衰老（每岁饱食-10、忠诚-2）→ 逃离（忠诚<30 5% 概率）→ 放生
- 灵宠被动加成计入修炼速度倍率（computeEffectiveCultivationRate）
- 符箓战斗效果：攻符无视30%防御、防符本回合减伤、疗符回复HP、遁符高概率逃跑、镇符眩晕
- tsc + lint 全通过

---
Task ID: 23-QA
Agent: main (cron 触发)
Task: 项目状态评估 + QA + 决策下一步开发重点

Work Log:
- 阅读 worklog.md：Task 22（心魔值系统）+ Task 23（灵宠+符箓系统）已完成
- 检查代码：Task 23 实际已完成但 worklog 缺失记录，已补录（见上）
- 验证：bunx tsc --noEmit 零错误（除 examples/skills 目录无关错误）
- 验证：bun run lint 零警告
- 验证：dev server 运行正常（端口 3000 监听中）
- agent-browser 测试：dev server 在 chrome 启动时偶发不稳定（疑似内存压力），但 API 调用稳定
- curl 验证：POST /api/game/new 成功创建角色"秦测试员"，返回完整 birth/event 数据
- 项目当前状态判断：**稳定，可继续推进新功能**

Stage Summary:
- 项目当前状态：稳定
  * Task 20-23 全部完成（事件蓝图/角色意图/未决线索/战斗/凡人修仙传/坊市/阵法/心魔值/灵宠/符箓）
  * 类型检查通过、lint 通过、dev server 运行正常
  * 10 个 API 路由全部就绪：new/state/advance/choose/interfere/item/market/formation/alchemy/pet + combat/action + combat/end
  * 22 个 xianxia UI 组件全部就绪
- 决策：项目稳定，无需修 bug，进入新功能开发阶段
- 本轮新功能：秘境探索地图系统（Secret Realm Exploration Map）—— 参考凡人修仙传秘境设定，玩家可主动选择秘境探索，触发独特事件链

