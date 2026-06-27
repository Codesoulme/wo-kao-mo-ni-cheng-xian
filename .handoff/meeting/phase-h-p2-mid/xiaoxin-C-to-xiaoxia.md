## 小薪2号C完工回执

### 任务
phase-h P2-完整地图。环境 E:\\aigame2_publish。

### 实际交付
| 项 | 期望 | 实际 |
|---|---|---|
| 新增 enum | 2 | 2（WorldRegion 8 值 / RegionTier 6 值） |
| 新增 interface | 4 | 3（LocationNode / TravelRoute / WorldMap） + 内部 4 个局部 interface |
| 新增 export function | 5 | 5（buildEmptyWorldMap / discoverLocation / deriveTravelFeasibility / generateRandomEncounter / summarizeWorldForPrompt） |
| 新增 smoke | 4 | 4（h-321 / h-322 / h-323 / h-324） |
| smoke 全过 y/n | y | y（288/288 主套件全过，exit 0） |

### 文件改动
- types.ts 末尾追加 enum/interface 段
- engine.ts 末尾追加 5 个 export function + WORKER_C_REALM_ORDER
- smoke.ts 末尾追加 4 个 smoke + wrapper（pgRunPhaseHCWorkerCSmokes），import 段增 10 行，main 末尾增 1 行 runner

### 落库
- commit b1f1ddf 已 push 到 main
- handoff：本文
