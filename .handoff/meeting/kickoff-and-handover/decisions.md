# 会议决议

## 会议信息
- 主题：P0+P1 战斗命名单字回滚 + cultivation attribute category enum 回滚
- 时间：2026-06-26
- 参与：小虾米、小薪
- 当前 HEAD：`605749e`

## 已达成共识的事实
1. 玩家可见战斗三维命名必须是 `破势 / 护持 / 机变`，禁止再出现 `攻 / 守 / 敏`。
2. `src/lib/xianxia/display.ts` 中 `MECHANISM_PATTERNS` 对 `attack/defense/speed` 的 replacement 改为玩家可见命名表中的**完整中文 label** `破势/护持/机变`，禁止再用单字 `攻/守/敏`。同时保留针对 `attack: 12` 这类 key:value 机制文本的正则兜底，防止 `sanitizeNarrativeText` 误替换为半拉内容。
3. `src/lib/xianxia/engine.ts` 中 cultivation attribute category 的中文 enum 回滚为英文：`body / spirit / dao / combat / fate / custom`。
5. 旧存档兼容由运行时 `normalizeCategory` + `dbToState` 处理，**不**做数据库 migration。
6. 采用**方案 B**：P0 + P1 一次性回滚，统一跑验证、补 smoke、commit + push。
7. 配置页外禁止泄露 `model / apiKey / baseUrl / debug / cache / preload / schema` 等技术词；AIConfigDialog 配置页内允许保留。
8. smoke 必须能真实 fail 也能真实 pass，不能是摆设；本次补 5 条 smoke。

## 已确认的边界
- 小薪可以改 `engine.ts` 中的 cultivation attribute category enum（已授权）。
- 配置页外禁泄露的范围：**玩家可见 UI 文本 / narrative**，不强制处理 console.log / server 端错误 / API 路由内部字符串。
- 旧存档 category 字段若为中文，运行时 fallback 到对应英文或 `custom`。

## 已确认的做法
1. P0 修改 `StatusPanel.tsx`、`CharacterDetailSheet.tsx`、`display.ts`。
2. P1 修改 `engine.ts` 中文 enum，加 `normalizeCategory` 兼容函数。
3. 补 5 条 smoke：
   - `combat-labels-no-single-char`
   - `sanitize-narrative-attack-defense-speed`
   - `combat-projection-display-mapping`
   - `cultivation-attribute-category-internal-enum`
   - `cultivation-attribute-category-no-leak-in-ui`
4. 跑满 `tsc --noEmit`、`eslint`、regression smoke、`git diff --check`。
5. 完成后 commit + push。

## 仍未达成共识（升级给 owner）
- 无。
