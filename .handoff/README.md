# .handoff/ 任务交接目录

> 本目录是 **小虾米（项目负责人 / 游戏策划）** 和 **小薪（Trae 那边首席开发员工）** 之间的任务交接总线。
> 玩家所有者 **一万万** 通过本目录拍板，不参与即时传话。
>
> 创建时间：2026-06-26
> 维护人：小虾米 🦞

---

## 一、目录结构

```
E:\aigame2_publish\.handoff\
 ├── README.md                  # 本文件
 ├── current-task.md            # 当前进行中的任务（单条）
 ├── archive/                   # 已完成任务归档
 │   └── YYYY-MM-DD-task-name.md
 │
 ├── <task-name>/
 │   ├── task.md                # 任务描述（owner 起，或小虾米起草 owner 确认）
 │   ├── xiaoxin-plan.md        # 小薪给的实现计划
 │   ├── xiaoxia-review.md      # 小虾米的评审意见
 │   ├── xiaoxin-fix.diff       # 小薪改完的 diff / 文件路径
 │   ├── xiaoxia-verification.md# 小虾米的验证结果
 │   └── owner-decision.md      # 一万万最终拍板
```

**重要**：

- `current-task.md` 是入口，里面只放"当前正在做的任务"的指针，**不重复正文**。
- 每个独立任务用自己的子目录，不要把所有东西塞 current-task.md。
- 完成后整任务目录移到 `archive/`，命名 `YYYY-MM-DD-<task-name>.md`（打包成一个文件存档）。

---

## 二、工作流（4 步 + 1 拍板）

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 一万万下任务 │ -> │ 小薪写计划  │ -> │ 小虾米评审  │ -> │ 小薪改代码  │ -> │ 小虾米验证  │ -> │ owner 拍板  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                                                     │
                                                                                       ┌─────────────┴─────────────┐
                                                                                       ▼                            ▼
                                                                                  commit (本地)                  拒绝 / 补做
                                                                                       │
                                                                                       ▼
                                                                                  等 owner 说"推"再 push
```

### 第 1 步：owner 起任务

owner 在 `<task-name>/task.md` 里写：

```markdown
# Task: <一句话目标>

## 目标
<本次要达成什么>

## 触发原因
<为什么做这个>

## 范围
- 包含：
- 不包含：

## owner 关注点
- 任何 owner 特别关心的事（沉浸 / 性能 / 旧档 / 玩家体验）

## 优先级
P0 / P1 / P2
```

然后更新 `current-task.md` 指向该目录。

### 第 2 步：小薪给计划

小薪在 `<task-name>/xiaoxin-plan.md` 里写：

```markdown
# 小薪的实施计划

## 读完任务后的理解
<一句话总结>

## 影响文件
- src/...

## 改动点
- ...

## 验证命令
- bunx tsc --noEmit
- bunx eslint <files>
- bun scripts/xianxia-regression-smoke.ts
- git diff --check

## 新增 regression smoke（必须）
- ...

## 风险评估
- 旧档兼容性：
- UI 影响：
- AI prompt 影响：
- 玩家可见文案：

## 是否涉及高风险
- 真实玩家存档修改：否 / 是（待 owner 确认）
- 新增外部依赖：否 / 是
- 内部 enum / schema 改动：否 / 是
- Git 历史重写：否 / 是

## 我的不确定点（请小虾米审）
- ...

## 回退方案
- ...
```

### 第 3 步：小虾米评审

小虾米在 `<task-name>/xiaoxia-review.md` 里写：

```markdown
# 小虾米的评审

## 结论
批准 / 拒绝 / 待改

## 同意的部分
- ...

## 必须修改的地方
- ...

## 风险补充
- ...

## 提议改进（可选）
- ...

## 下一步
- 等小薪按本评审修改 / 等 owner 拍板 / ....
```

### 第 4 步：小薪改代码

小薪改完，在 `<task-name>/xiaoxin-fix.diff` 里写：

- 完整 diff（`git diff` 输出）
- 或具体文件路径列表

并在 `xiaoxin-plan.md` 末尾追加：

```markdown
## 实施结果

### 已完成
- ...

### 未完成（理由）
- ...

### 自验结果
- bunx tsc --noEmit: PASS / FAIL
- bunx eslint <files>: PASS / FAIL
- bun scripts/xianxia-regression-smoke.ts: PASS / FAIL（含新加的 smoke）
- git diff --check: PASS / FAIL
- mojibake scan: PASS / FAIL
```

### 第 5 步：小虾米验证

小虾米读 diff，跑全套验证（**不允许只听小薪报结果**），在 `<task-name>/xiaoxia-verification.md` 里写：

```markdown
# 小虾米的验证

## 我跑的验证
- bunx tsc --noEmit：结果
- bunx eslint <files>：结果
- bun scripts/xianxia-regression-smoke.ts：结果
- git diff --check：结果
- mojibake 扫描：结果

## 真实存档取证（如适用）
- ...

## 关键代码自审
- engine.ts 状态机：未触碰 / 已触碰 + 已 smoke
- llm.ts prompt 主体：未触碰 / 已触碰 + 已 smoke
- display.ts sanitize：未触碰 / 已触碰 + 已 smoke
- 玩家可见命名：未触碰 / 已恢复为 破势/护持/机变
- 内部 enum：未触碰 / 已恢复为 body/spirit/dao/combat/fate/custom

## 我发现的额外问题
- ...

## 结论
PASS / FAIL

## 建议下一步
- 小薪本地 commit（不带 push）
- 等 owner 决定是否 push
```

### 第 6 步：owner 拍板

一万万在 `<task-name>/owner-decision.md` 里写：

```markdown
# owner 拍板

## 我看完的文件
- task.md
- xiaoxin-plan.md
- xiaoxia-review.md
- xiaoxin-fix.diff
- xiaoxia-verification.md

## 决定
- 批准 commit
- 批准 commit + push
- 拒绝，原因：...
- 待补：...

## 备注
- ...
```

---

## 三、命名与状态机

| 状态 | 标记 | 说明 |
|---|---|---|
| 待小薪计划 | `[TODO-PLAN]` | owner 已起任务，等小薪写计划 |
| 待小虾米评审 | `[REVIEW]` | 小薪已交计划，等小虾米评审 |
| 待小薪改码 | `[FIX]` | 小虾米已审，等小薪改 |
| 待小虾米验证 | `[VERIFY]` | 小薪已改，等小虾米验 |
| 待 owner 拍板 | `[DECIDE]` | 小虾米已验，等 owner 决定 |
| 已完成 | `[DONE]` | owner 拍板 commit 完成 |
| 已拒绝 | `[REJECTED]` | 任何一步拒绝 |
| 冻结 | `[FROZEN]` | 紧急插队时临时冻结 |

`current-task.md` 顶部必须有 `[状态]` 标签，便于一眼看出当前在哪一步。

---

## 四、纪律

### 4.1 边界（来自工作准则）

1. **小薪不能自己**改：
   - `src/lib/xianxia/engine.ts` 状态机核心逻辑（除非任务明确允许且通过 PACT 评审）
   - `src/lib/xianxia/llm.ts` prompt 主体结构
   - `src/lib/xianxia/types.ts` schema
   - 真实玩家存档（只读取证）
   - Git 历史

2. **小薪不能自己**跑：
   - `git commit` / `git push`
   - 真实存档写入

3. **小薪必须**自己跑：
   - `bunx tsc --noEmit`
   - `bunx eslint <files>`
   - `bun scripts/xianxia-regression-smoke.ts`（含**新加的 smoke**）
   - `git diff --check`
   - mojibake 扫描

4. **小虾米必须**亲自：
   - 重跑全套 smoke（**不**只听小薪报结果）
   - 真读 diff（**不**只看 plan）
   - 真实存档取证（如果涉及）
   - 写 `xiaoxia-verification.md`

5. **owner 必须**：
   - 读两份评审 + diff
   - 在 `owner-decision.md` 显式拍板
   - 没说"推"就**不推**

### 4.2 单任务约束

- 一次只允许一个 `[CURRENT]` 任务。
- 同时多任务 = 不允许。
- 紧急插队任务 = 把当前任务先冻结（`[FROZEN]`）或归档（`[DONE]`），再建新任务。

### 4.3 上下文规则

- 小薪**不**应该看到：
  - `MEMORY.md` / `USER.md` / `SOUL.md`（owner 私人偏好）
  - `prisma/dev.db`（真实玩家存档）
  - 我的内部规则（`AGENTS.md` 全集）
  - 我的内部会话历史
- 小薪**应该**看到：
  - `README.md`（本文件）
  - `<task-name>/` 整个目录
  - 项目代码
  - 已批准的《游戏设计核心工作准则》

小虾米负责**手动**把小薪需要看到的上下文写到 `task.md` 或 `xiaoxin-plan.md` 旁注里，**不**给整个项目根权限。

---

## 五、当前任务

最新任务见 [`current-task.md`](./current-task.md)。

---

## 六、归档

完成的任务进入 `archive/`，命名格式：

```
archive/YYYY-MM-DD-<short-task-name>.md
```

归档文件包含完整 6 步内容（task → plan → review → fix → verification → decision）打包，作为可追溯历史。

---

## 七、与现有规则的关系

- 本目录是 **工作流层**，不是 **规则层**。
- 规则层见：[游戏设计核心工作准则-给-Kimi-和-Trae.md](C:/Users/14262/.openclaw-autoclaw/workspace/docs/wo-kao-mo-ni-cheng-xian/audit/游戏设计核心工作准则-给-Kimi-和-Trae.md)
- 审计见：[三天改动审计与设计核心违背清单](C:/Users/14262/.openclaw-autoclaw/workspace/docs/wo-kao-mo-ni-cheng-xian/audit/三天改动审计与设计核心违背清单.md)
- 本目录**不替代**上面的规则，**只是执行规则的工作流**。

---

## 八、紧急联系

- 紧急情况（owner 拍板要立刻生效）：直接 IM 找小虾米，不走本目录。

---

## 九、Mojibake 历史快照（2026-06-29 扫描）

`scripts/write-handoff.ps1` 已就绪（`[System.IO.File]::WriteAllText` + UTF-8 BOM + Base64Content 路径），未来写 handoff 文件全部走它。

但**历史 handoff 文件**有 4 个被早期 PowerShell heredoc 损坏（中文被替换成 `?`），git 第一次 commit 就是 `?`（`97c71e6` 验证），**无原版可恢复**。标 read-only 历史快照，不修复：

| 文件 | 状态 |
|---|---|
| `.handoff/combat-labels-rollback-and-category-enum-fix/task.md` | 内容已损（PS heredoc 写入时损坏）|
| `.handoff/current-task.md` | 内容已损 |
| `.handoff/meeting/kickoff-and-handover/agenda.md` | 内容已损 |
| `.handoff/meeting/kickoff-and-handover/xiaoxia-to-xiaoxin.md` | 内容已损 |

**应对**：
- 这 4 个文件不再尝试修复（不可逆丢失）
- 后续 handoff 文件**必须用** `scripts/write-handoff.ps1` 写
- 验证脚本：写入后跑 `head -c 3 file.md | xxd` 看首 3 字节是 `EF BB BF`（UTF-8 BOM）
- 阻塞（任何一步卡超过 24 小时）：在当前任务的 `task.md` 里写 `[BLOCKED: reason]`，等 owner 决定。