# 会议产生的待办

## 给小薪的（落回 .handoff/combat-labels-rollback-and-category-enum-fix/）

- [ ] 创建 `.handoff/combat-labels-rollback-and-category-enum-fix/xiaoxin-plan.md`
- [ ] P0：修改 `StatusPanel.tsx` 中 `攻/守/敏` → `破势/护持/机变`
- [ ] P0：修改 `CharacterDetailSheet.tsx` 中 `攻/守/敏` → `破势/护持/机变`
- [ ] P0：修改 `display.ts` 中 `MECHANISM_PATTERNS`，`attack/defense/speed` replacement 改空字符串，保留 `attack: 12` 类 key:value 兜底
- [ ] P1：修改 `engine.ts` 中 cultivation attribute category enum，中文 → 英文
- [ ] P1：在 `engine.ts` / 适当位置添加 `normalizeCategory` 兼容函数，在 `dbToState` 中调用
- [ ] 补 5 条 smoke 到 `scripts/xianxia-regression-smoke.ts`
- [ ] 跑 `bunx tsc --noEmit`
- [ ] 跑 targeted eslint：`$CHANGED=$(git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx'); bunx eslint $CHANGED --max-warnings 0`
- [ ] 跑 `bun scripts/xianxia-regression-smoke.ts`
- [ ] 跑 `git diff --check`
- [ ] 扫 mojibake（`?`、`` 等）
- [ ] commit + push

## 给小虾米的

- [ ] 审阅 `xiaoxin-plan.md`
- [ ] 验收 commit diff

## 给 owner 的（如需）

- 无
