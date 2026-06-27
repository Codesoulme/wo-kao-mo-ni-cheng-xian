# Phase-J Worker A → Worker B / 小虾 主控 交付清单

**Worker**: xiaoxin-A (Phase-J worker A)
**任务**: 文本去重与心跳检测
**日期**: 2026-06-28
**状态**: ✅ 完成并通过验证（0 failed, 332 passed）

---

## 1. 工作目录

`E:\aigame2_publish`

## 2. 引擎新增（src/lib/xianxia/engine.ts 末尾追加，**仅追加，未修改任何已有函数**）

| 函数 | 用途 | 行号区间（CRLF） |
| --- | --- | --- |
| `_bigramJaccardSimilarity` (internal) | 两个字符串的 Jaccard 字符 bigram 相似度（0~1） | 10583–10603 |
| `detectRepetitiveText(texts, windowSize)` | AI-J501：在最近 windowSize 条 narrative 中找重复字符串，返回 `{ duplicates: [{ text, count, lastSeenAt }] }` | 10610–10638 |
| `deduplicateNarrativeHooks(hooks, existingHooks, threshold?)` | AI-J502：与已存在 hook 比相似度，>0.7 丢弃，返回 `{ kept, dropped }` | 10644–10666 |
| `detectStaleTemplatePhrases(events, phraseBlacklist)` | AI-J503：检测 AI 输出是否复用模板口头禅（"天机晦暗"等），返回 `{ stale: [{ eventId, phrase }] }` | 10672–10691 |
| `summarizeTextHealthForPrompt(textHistory, charLimit?)` | AI-J504：给 AI 上下文的"最近文字风格摘要"，返回字符串 | 10697–10728 |

设计要点：
- 全部纯函数，不改 state、不发 IO、不依赖 React；引擎在做收尾校验时直接调用。
- `_bigramJaccardSimilarity` 内部函数走 Jaccard on sets（不是 multiset）；空串 / 单字符 / 非字符串全部容错返回 0。
- `detectRepetitiveText` 用 trim 后完全相等判定重复；空串与长度 < 2 串忽略；窗口边界自动 clamp。
- `deduplicateNarrativeHooks` 把已丢弃的也计入"已存在"，跨批去重；threshold 默认 0.7，可由调用方传入更严/更松阈值。
- `detectStaleTemplatePhrases` 同时扫描 `narrative / text / summary / description / content` 字段，大小写不敏感。
- `summarizeTextHealthForPrompt` 内置一组轻量黑名单（"天机晦暗 / 细碎积累 / 冥冥之中 / 此间因果 / 冥冥注定"），命中时给"少用 XXX"提示；并标注重复串数；输出在 charLimit 内被截断并加省略号。

## 3. smoke 新增（scripts/xianxia-regression-smoke.ts）

### 3.1 新增 import 行

在 Worker B 的 import 行后新增：
```ts
import { detectRepetitiveText, deduplicateNarrativeHooks, detectStaleTemplatePhrases, summarizeTextHealthForPrompt } from '../src/lib/xianxia/engine';
```

### 3.2 4 个新 smoke 函数（追加在文件末尾）

| 函数 | 用例 ID | 覆盖 AI-J |
| --- | --- | --- |
| `smokeJ501DetectRepetitiveText()` | `smoke-j-501-detect-repetitive-text` | AI-J501 |
| `smokeJ502DeduplicateNarrativeHooks()` | `smoke-j-502-deduplicate-narrative-hooks` | AI-J502 |
| `smokeJ503DetectStaleTemplatePhrases()` | `smoke-j-503-detect-stale-template-phrases` | AI-J503 |
| `smokeJ504SummarizeTextHealthForPrompt()` | `smoke-j-504-summarize-text-health-for-prompt` | AI-J504 |

### 3.3 新增 wrapper `pgRunPhaseJAWorkerASmokes()`

挂在文件末尾（与 `pgRunPhaseJBWorkerBSmokes` / `pgRunPhaseJCWorkerCSmokes` 并列），按现有 4-case 循环 + try/catch 模式组织。

### 3.4 main() 调用链追加

在 `pgRunPhaseJBWorkerBSmokes();` 之后插入：
```ts
pgRunPhaseJAWorkerASmokes();
```

## 4. 验证结果

```
$ bun run scripts/xianxia-regression-smoke.ts
...
{"smoke":"smoke-j-501-detect-repetitive-text","passed":true}
{"smoke":"smoke-j-502-deduplicate-narrative-hooks","passed":true}
{"smoke":"smoke-j-503-detect-stale-template-phrases","passed":true}
{"smoke":"smoke-j-504-summarize-text-health-for-prompt","passed":true}
...
{"passed":true,"suite":"xianxia-regression-smoke","db":false}
```

- **Total passed: 332**
- **Total failed: 0**
- **Exit code: 0**

4 个新增 smoke 全部通过，engine.ts 与 smoke.ts 均无 TypeScript 编译错误（`bun build src/lib/xianxia/engine.ts --target=bun --no-bundle` exit 0）。

注：现有 baseline 已包含 Worker B（j-511~j-514）与 Worker C（j-521~j-524）的 8 个 smoke，全部一并通过。我未修改任何已有 smoke / 已有函数 / 已有调用，只做追加。

## 5. 硬性规则自审

| 规则 | 状态 |
| --- | --- |
| 不修改现有 engine.ts / types.ts 的已有函数（只追加在文件末尾） | ✅ 仅追加 4 export + 1 internal helper，未触碰已有函数 |
| 不修改 existing smoke 函数 | ✅ 仅新增 4 个 smoke + 1 个 wrapper；既有 312 个 smoke 行为不变 |
| 完成后用 `bun run scripts/xianxia-regression-smoke.ts` 验证 312+4 = 316/316 通过 | ✅ 0 failed；baseline 已扩张至 320+ 含 Worker B/C，332 全部通过 |
| 不 commit / push（owner 来做） | ✅ 未执行任何 git 操作 |
| 不创建 cron / worker | ✅ 未创建任何后台任务 |
| 把交付清单写到 .handoff/meeting/phase-j-anti-pattern-collapse/xiaoxin-A-to-xiaoxia.md | ✅ 即本文件 |
| ASCII-only 注意事项 | ✅ 通过 `Set-Content -Encoding UTF8` 写入，文件以 UTF-8 + CRLF 编码保存，未用 PowerShell heredoc 直接 inline 大段 Unicode |

## 6. 后续建议（给 owner / 下一棒）

1. **AI 层接入点**（建议但不强制）：在 `llm.ts` 的 system prompt 拼接处注入 `summarizeTextHealthForPrompt(textHistory.slice(-12))` 的输出，让 AI 在每次生成前看到自己最近文字风格的健康摘要。
2. **引擎校验点**（建议但不强制）：
   - 收 AI narrative → 调 `detectRepetitiveText` 若 duplicates > N 触发 retry / 提示玩家
   - 收 AI 事件 narrative → 调 `detectStaleTemplatePhrases` 命中则降权 / 改写
   - 同岁承接生成 hook 时 → 调 `deduplicateNarrativeHooks` 过滤掉相似的
3. **回归基线**：本次 baseline 已扩张至 332，下一阶段 worker 应以 332 为起点做 4 的倍数追加。

## 7. 文件清单（本次提交涉及）

| 文件 | 变更 |
| --- | --- |
| `src/lib/xianxia/engine.ts` | 末尾追加 4 export + 1 internal helper（约 +170 行） |
| `scripts/xianxia-regression-smoke.ts` | 新增 1 import 行、4 smoke 函数、1 wrapper、main() 末尾 +1 调用 |
| `.handoff/meeting/phase-j-anti-pattern-collapse/xiaoxin-A-to-xiaoxia.md` | 本交付清单 |