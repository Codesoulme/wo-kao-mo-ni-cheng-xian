## 小薪2号B完工回执

### 任务
phase-h P2-NPC 长期记忆。环境 E:\\aigame2_publish。

### 实际交付
| 项 | 期望 | 实际 |
|---|---|---|
| 新增 enum | 1 | 1（NPCMemoryTier 5 值） |
| 新增 interface | 4 | 4（NPCMemory / NPCMemoryCluster / NPCBehaviorInfluence + 内部辅助） |
| 新增 export function | 5 | 5（recordNPCMemory / clusterNPCMemories / decayNPCMemories / deriveNPCBehaviorFromMemory / summarizeNPCForPrompt） |
| 新增 smoke | 4 | 4（h-311 / h-312 / h-313 / h-314） |
| smoke 全过 y/n | y | y（288/288 主套件全过，exit 0） |

### 文件改动
- types.ts 末尾追加 enum/interface 段（line ~2395 起）
- engine.ts 末尾追加 5 个 export function（line ~8337-8540）
- smoke.ts 末尾追加 4 个 smoke（smokeNewH311Record 等）+ wrapper（pgRunPhaseH314Smokes），main() 调用链已 wired

### 落库
- commit b1f1ddf 已 push 到 main
- handoff：本文
