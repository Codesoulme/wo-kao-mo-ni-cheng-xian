## 小薪2号A完工回执

完成: AI-81 ✅ / AI-82 ✅ / AI-83 ✅ / AI-84 ✅ / AI-85 ✅

smoke: 之前 213 + 11 = **224** (全部通过，0 失败)
  - baseline 来自 Worker B 已交付的 AI-86~AI-90 共 11 条
  - 本次新增 11 条 smoke 全部位于 scripts/xianxia-regression-smoke.ts 末尾

改动:
  - `src/lib/xianxia/types.ts`：追加 AI-81/82/83/85 类型与标签常量（约 110 行）
    - CombatStance / CombatStanceUsage
    - CombatResourceType / CombatResourceUsage
    - BreakthroughStage / BreakthroughAttempt
    - ComboChain
    - COMBAT_STANCE_LABEL / COMBAT_RESOURCE_LABEL / BREAKTHROUGH_STAGE_LABEL
  - `src/lib/xianxia/engine.ts`：追加 11 个 export 函数与对应类型 import（约 270 行，文件结尾）
    - AI-81: deriveCombatStance / resolveCombatStanceShift
    - AI-82: deriveCombatResource / resolveCombatResourceDrain / checkCombatResourceSufficient
    - AI-83: deriveBreakthroughStage / resolveBreakthroughOutcome
    - AI-84: detectCombatStalemate / resolveStalemateBreak
    - AI-85: deriveComboChain / resolveComboDamage
  - `src/components/xianxia/CombatModal.tsx`：追加战斗姿态 UI 投影
    - 新增 import: deriveCombatStance (engine) + CombatStance 类型 + COMBAT_STANCE_LABEL (types)
    - 新增派生: suggestedStance（基于当前 session 推导建议姿态）
    - 新增 UI 块：在既有紫色"战势"面板顶部加一行"态"标签显示建议姿态（猛攻/守御/诱敌/脱身），仅 read-only 投影，玩家可见
  - `scripts/xianxia-regression-smoke.ts`：追加 11 个 smoke 函数 + runner 调用 + imports
    - 新增函数: smokeAi81StanceDerivation / smokeAi81StanceShift / smokeAi81StanceLabelConsistency
    - 新增函数: smokeAi82CombatResourceDerivation / smokeAi82ResourceDrainAndSufficient / smokeAi82ResourceLabelConsistency
    - 新增函数: smokeAi83BreakthroughStageDerivation / smokeAi83BreakthroughOutcome
    - 新增函数: smokeAi84CombatStalemateBreak
    - 新增函数: smokeAi85ComboChainDerivation / smokeAi85ComboDamageResolve
    - 在 smokePetCombatSkillUseDamage() 之后插入 11 条 runner 调用

遗留:
  - 本次未触碰 store.ts / 其他 modal / Git（commit/push 未执行）
  - CombatModal 中的 suggestedStance 目前是纯 UI 投影；如需将其接入到真实战斗 action palette 选项中（让玩家直接切换姿态），需要后续在 store 中加 stance state 字段；本次按任务边界未做
  - CombatStance / CombatResourceType / BreakthroughStage 仅为类型与派生函数；真正的持久化与玩家手动切换仍以任务边界为限，未注入到 store.ts
  - AI-83 突破阶段细化目前只产出 stage/outcome 文本，未串联到 startCombat 或修炼事件的实际状态机（仍按边界不动状态机核心）
  - AI-84 僵局打破目前返回提示文案；接入真实战斗"自动暂停请求玩家决策"需要后续在 store 加触发点
