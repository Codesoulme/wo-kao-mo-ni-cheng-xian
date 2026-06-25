# P0+P1 修复计划

## 背景
- 会议：`kickoff-and-handover`
- 决议：`decisions.md`
- 待办：`action-items.md`
- 当前 HEAD：`605749e`

## 修复目标
1. P0：回滚玩家可见命名 `攻 / 守 / 敏` → `破势 / 护持 / 机变`
2. P1：回滚 `engine.ts` 中 cultivation attribute category 的中文 enum → 英文 `body / spirit / dao / combat / fate / custom`
3. 配置页外禁止泄露 `model / apiKey / baseUrl / debug / cache / preload / schema` 等技术词

## 具体改动

### P0
- `src/components/xianxia/StatusPanel.tsx`
- `src/components/xianxia/CharacterDetailSheet.tsx`
- `src/lib/xianxia/display.ts`

### P1
- `src/lib/xianxia/engine.ts`

### Smoke
- `scripts/xianxia-regression-smoke.ts`

## 验证
1. `bunx tsc --noEmit`
2. `bunx eslint src --ext .ts,.tsx --max-warnings 0`
3. `bun scripts/xianxia-regression-smoke.ts`
4. `git diff --check`
5. 扫 mojibake

## 风险
- 旧存档 category 字段为中文，需 `normalizeCategory` 兼容
- `display.ts` replacement 改空后，需确保上游 UI 已显式接管 label

## 回退方案
- `git revert <commit>`
- 或手动还原修改文件

## 状态
- [FIX] 未开始
- [FIX] 进行中
- [FIX] 已完成

## 备注
- 本次修改属于方案 B：P0 + P1 一次性回滚
- 已由小虾米授权修改 `engine.ts`
