# AI-28 玩家可见文案审计报告 (2026-06-27)

总问题: 3 (P0: 3 / P1: 0)

## 审计范围

- 扫描文件：`src/components/xianxia/*.tsx` (29 个组件)
- 白名单：`AIConfigDialog.tsx`（技术配置页面，允许 "API / 接口 / Key"）
- 规则参考：`docs/UI-RULES.md`

## P0 详单

- **undefined** `src\components\xianxia\EventTimeline.tsx:476` → 0 ? events[idx - 1] : undefined;
          const timeText = eventTimeLabel(event
- **pendingThreads** `src\components\xianxia\PendingThreadsCard.tsx:55` → 0
    ? character.pendingThreads
    : (character.questEntries || []).map(questE
- **cultivationExp** `src\components\xianxia\RealmOrb.tsx:20` → 0
    ? (realmLevel / realmMaxLevel) * 0.7 + (cultivationExp / expToBreak) * 0.3

## P1 详单
