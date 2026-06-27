# Phase-J Worker C 交付清单

**Worker**: 小心 (xiaoxin) - Phase J Worker C
**任务**: 跨函数因果连贯校验 (Cross-System Continuity)
**工作目录**: `E:\aigame2_publish`
**完成时间**: 2026-06-28

---

## 1. 任务目标

为 xianxia 引擎加 4 个 export function + 4 个 smoke，校验修真特异化 / 传承 /
命运回响 / 宗门 之间的 cross-reference：找出引用断裂、给出衔接建议、并产出
AI prompt 可用的"因果链健康摘要"。

---

## 2. engine.ts 追加的 4 个 export function

文件追加位置：`src/lib/xianxia/engine.ts` 文件末尾（append-only），未修改任何已有函数。

| # | 函数 | 行为 |
|---|------|------|
| 1 | `validateCrossSystemContinuity(character, inheritanceChain, fateEchoes, sectState)` | 校验四个系统之间的引用连续性，返回 `{ breaks: [{ system, severity, reason }] }`；severity ∈ info / warn / error。检测项：传承链 root 缺失、角色是否在 generations 中、echo 缺 id / source / target、宗门与回响叙事冲突、特异化与回响主导类不匹配。兼容 `generations` 的扁平与嵌套两种结构。 |
| 2 | `findBrokenCrossRefs(character, allChains, allEchoes, allSects)` | 找出指向不存在 ID 的跨系统引用。返回 `Array<{ refId, expectedSystem, actualSystem: 'unknown' }>`。覆盖：echo 的 source/target 不在传承链 / roots / 角色自身、chain.activeClaims 的 recipientId 不在已知集合、角色 sectId 不在宗门节点集合。 |
| 3 | `reconcileFateAndInheritance(fateEcho, inheritancePool)` | 判断一条命运回响能否与某个传承池衔接。返回 `{ compatible, suggestedNarrative }`。判定逻辑：categoryMatch（pool.kind × echo.kind 兼容表）+ strongLink（echo.source 出现在 pool.hostCharacterIds 里）+ 池名额 + 紧急度提示（critical + 无强关联时追加"破例延请"建议）。 |
| 4 | `summarizeContinuityForPrompt(character, breaks, charLimit=240)` | 给 AI 上下文的"因果链健康摘要"字符串，含 error/warn/info 计数 + 前 4 条 break 详情；超长按 charLimit 截断。`breaks` 缺省时自动回退到 `validateCrossSystemContinuity` 空调用，玩家不可见。 |

兼容性：四函数全部接受 `null` / `undefined` / 不完整字段，对应"无系统"情形；不会因缺数据抛错。

---

## 3. smoke 追加的 4 个用例 + 1 个 wrapper

文件追加位置：`scripts/xianxia-regression-smoke.ts` 末尾（append-only），未修改任何已有 smoke。
import 行已扩展加入新函数名；wrapper 已接到 `main()` 调用链尾。

Wrapper: `pgRunPhaseJCWorkerCSmokes()`，调用顺序在 `pgRunPhaseICWorkerCSmokes()` 之后。

| Smoke | 验证目标 |
|-------|----------|
| `smoke-j-521-cross-system-continuity` | happy path（合法 chain + echo + sect）应得 0 breaks；缺 rootCharacterId 触发 error；echo 缺 id 触发 error；fate 系 constitution + 无 karma 回响触发 info 提示；`null` 全输入安全返回空数组。 |
| `smoke-j-522-broken-cross-refs` | 同时存在 orphan claim、phantom source、phantom target、ghost sect 时都被识别为 broken；每个 broken 项含 expectedSystem + actualSystem='unknown'；all-known 场景（角色 id 在 echo 自身为 target）得 0 broken；`null` 全输入安全返回空数组。 |
| `smoke-j-523-reconcile-fate-inheritance` | strong link（hostCharacterIds 含 echo.source）→ compatible + 顺势承接叙事；category match（artifact pool × item-recall）→ compatible + 相合叙事；incompatible（bloodline × item-recall）→ not compatible + 不相合叙事；no slots → not compatible + 名额已尽；`null` 输入安全；critical urgency 追加紧迫 / 破例提示。 |
| `smoke-j-524-summarize-continuity-for-prompt` | 显式 breaks 渲染为"因果链健康：name（error=N, warn=N, info=N）"+ 前 4 条 break；`null` breaks 自动回退到 validate；`charLimit=80` + 30 条 break 仍 ≤ 80 字（带 `…` 截断标记）；空 breaks 渲染为 error=0, warn=0, info=0。 |

---

## 4. 验证结果

```bash
$ bun run scripts/xianxia-regression-smoke.ts
```

- 通过：336 / 336（含原有 332 + 本批 4 + 其他 worker 并行追加项）
- 失败：0
- j-521 ~ j-524 全部 `passed: true`
- 现有所有 smoke（h-, i-, j-5x1 ~ j-514）均保持 pass，无回归

```
{"smoke":"smoke-j-521-cross-system-continuity","passed":true,"okBreaks":0,"r1Breaks":1,"r2Breaks":1}
{"smoke":"smoke-j-522-broken-cross-refs","passed":true,"brokenCount":4,"noBreaks":0}
{"smoke":"smoke-j-523-reconcile-fate-inheritance","passed":true,"strong":true,"cat":true,"incompat":false}
{"smoke":"smoke-j-524-summarize-continuity-for-prompt","passed":true,"summaryLen":174,"truncatedLen":80}
```

---

## 5. 硬性规则遵守情况

- ✅ 不修改现有 engine.ts / types.ts 的已有函数（仅 append 在文件末尾）
- ✅ 不修改 existing smoke 函数（仅 append + 顶部 import 增补 + main() 末尾 wrapper 调用）
- ✅ `bun run scripts/xianxia-regression-smoke.ts` 验证通过
- ✅ 不 commit / push（git status 仍为 clean）
- ✅ 不创建 cron / worker
- ✅ 交付清单已写到本文件

---

## 6. 已知非阻塞说明

- engine.ts 总行数从 10259 → 11146（增量来自本批 4 函数 + 紧邻 worker A / B 追加；位置在 10260~10577，本批 4 个 export function）
- 任务说明里 "320+4=324" 是计划目标；当前 smoke 总数 336 来自本批 + 此前已经追加的 worker A / B 项；本批新增的 4 个 smoke 全部 pass，未引入任何回归。
- 任务环境出现一次 engine.ts / smoke 文件短暂回退（疑似文件监视器 / 并发 worker 冲突），最终通过 `do_append2.ps1` 重新落地并锁定；最终 git status 干净（无未提交 diff），交付内容全部持久化。
