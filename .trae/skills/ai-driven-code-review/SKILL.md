---
name: "ai-driven-code-review"
description: "Performs hourly code review against the AI-driven panel architecture principles of 《我靠模拟成仙》. Invoke when user mentions: 代码审查, hourly review, AI 导向检查, or asks for code quality check. Also auto-triggers at session start and on file save."
---

# AI-Driven Code Review Skill

This skill reviews the codebase against the **AI Output Driven Panel Architecture** core principle: AI generates interactive content based on narrative/state/causality; UI is just a projection.

## When to Use

- User explicitly asks for "代码审查" / "hourly review" / "AI 导向检查"
- Auto-trigger at session start (check if last review > 1 hour ago)
- After every `bun run scripts/hourly-review.ts` log file change

## Review Scope

The game has these critical design rules that code MUST follow:

1. **AI Output Driven**: No hardcoded buttons/attributes/formulas
2. **Chinese Localization**: No internal keys (`cultivationExp`, `heartDemon`) in player-visible text
3. **Clean UI Display**: Hide 0/invisible attributes; adaptive layout
4. **Fiction-style Narrative**: No mechanical combat terms ("caused X damage", "HP")
5. **Event Continuity**: Track unresolved clues/promises
6. **No Blank Years**: Always write specific character actions
7. **Elastic Realm System**: Allow AI to create/adjust realms
8. **AI Linkage Priority**: New features must integrate AI
9. **No Main Character Halo**: World logic prevails; death is acceptable
10. **State Synchronization**: Item bonuses sync in real-time
11. **Combat Rules**: Stop at combat interface; single settlement path
12. **Reincarnation Settlement**: Unified flow when character gives up

## Execution Steps

**Step 1: Check Last Review Time**

```bash
cat logs/hourly-review.last 2>/dev/null | tail -n 1
```

If the file shows > 1 hour ago (or doesn't exist), run a fresh review. Otherwise show summary.

**Step 2: Run Review Script**

```bash
bun run scripts/hourly-review.ts
```

This runs ESLint + custom AI-principle checks against `src/`.

**Step 3: Parse Output**

Read the last `logs/hourly-review.log` entries. Group findings by severity:
- **error**: Must fix (ESLint errors, lint broken, build failing)
- **warning**: Should review (AI-principle violations, potential bugs)
- **info**: Nice to have (debug logs, optimization)

**Step 4: Cross-Validate with TRAE-code-review**

For any **warning** findings, invoke the TRAE-code-review skill to verify they are real issues (not false positives due to context).

**Step 5: Present Report**

Use the format:

```markdown
📋 **AI 导向代码审查报告** (YYYY-MM-DD HH:MM)

| 等级 | 数量 | 详情 |
|------|------|------|
| 🔴 Error | N | [list] |
| 🟡 Warning | N | [list grouped by file] |
| 🔵 Info | N | [list] |

✅ ESLint: PASS / ❌ ESLint: FAIL
```

**Step 6: Ask User for Fix Selection**

Use `AskUserQuestion` to ask which issues to fix (referencing TRAE-code-review's interaction strategy).

## False Positive Filters

The custom review script (`scripts/hourly-review.ts`) already filters these out:
- Prompt templates (`IDENTITY_PROMPT`, `SCENE_PROMPTS`)
- Data definition files (`market/route.ts`, `constitutions.ts`)
- Object keys (`cultivationExp: { title: '修为', ... }`)
- Comment lines
- Test files

If a finding is still ambiguous, use `Read` to inspect the line in context before flagging.

## Key Files to Always Check

- `src/lib/xianxia/engine.ts` - Core engine; AI-driven logic lives here
- `src/lib/xianxia/llm.ts` - Prompts; ensure no internal keys in player-visible examples
- `src/lib/xianxia/display.ts` - `ATTRIBUTE_LABEL` mapping; ensure all attributes covered
- `src/app/api/game/advance-sse/route.ts` - SSE streaming; check state persistence
- `src/components/xianxia/EventTimeline.tsx` - Bubble display; check no mechanical terms leak
- `src/components/xianxia/CharacterDetailSheet.tsx` - Stats display; check labels are Chinese

## Auto-Trigger Setup

This skill is invoked automatically when:
1. Trae session starts (read `logs/hourly-review.last` to decide)
2. User opens a file under `src/` (run scoped review on that file only)
3. After 1 hour since last review

For full background scheduling, also run:
```bash
bun run scripts/hourly-review.ts
```
in a separate terminal (it self-schedules every hour).