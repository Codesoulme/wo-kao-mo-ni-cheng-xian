// 世界大事年表 · AI 排 + RNG fallback
// - ensureChronicleCoverage(targetYear, characterId): 若 generatedUntilYear >= targetYear，noop
//   否则调 LLM 生成 [generatedUntilYear+1..targetYear] 区间事件；LLM 失败则走本地 RNG fallback
// - 每 30 年约 1 条，允许时间重叠、允许类型重复
// - drift 按 rarity 派生（mythic/legendary=8, epic=5, rare=3, uncommon/common=2）

import {
  WORLD_EVENT_TEMPLATES,
  WORLD_EVENT_TYPES,
  type WorldEventType,
  type WorldEventTemplate,
} from './world-event-scheduler';
import type { ScheduledWorldEvent } from './world-chronicle-types';
import { driftForRarity } from './world-chronicle-types';
import { appendSchedule, getChronicle, saveChronicle } from './world-chronicle-store';
import { callLLMText, parseJSON } from './llm';

const EVENTS_PER_30YEARS = 1;
const MAX_EVENTS_PER_CALL = 40;
const HISTORY_CTX_YEARS = 300;

// ============================================================
// 串行队列：避免主流程与后台补齐并发写 schedule
// ============================================================
let coverageQueue: Promise<any> = Promise.resolve();

export interface CoverageResult {
  added: number;
  via: 'llm' | 'rng' | 'noop' | 'mixed';
  fromYear?: number;
  toYear?: number;
}

export async function ensureChronicleCoverage(
  targetYear: number,
  characterId: string,
): Promise<CoverageResult> {
  const task = coverageQueue.then(() => doEnsureCoverage(targetYear, characterId));
  coverageQueue = task.catch(() => undefined);
  return task;
}

async function doEnsureCoverage(
  targetYear: number,
  characterId: string,
): Promise<CoverageResult> {
  const c = await getChronicle();
  const fromYear = c.generatedUntilYear + 1;
  const toYear = Math.max(fromYear, Math.floor(targetYear));

  if (c.generatedUntilYear >= targetYear) {
    return { added: 0, via: 'noop' };
  }

  const spanYears = toYear - fromYear + 1;
  const n = Math.max(1, Math.min(MAX_EVENTS_PER_CALL, Math.round(spanYears / 30) * EVENTS_PER_30YEARS));

  // ---- 上下文 ----
  const tailContext = c.schedule
    .filter(e => e.scheduledYear >= fromYear - 60 && e.scheduledYear < fromYear)
    .slice(-6)
    .map(e => `- ${e.scheduledYear} 年 ${e.type}：${e.narrativeSeed}`)
    .join('\n');
  const historyContext = c.history
    .filter(e => (e.actualEndYear ?? e.scheduledYear) >= fromYear - HISTORY_CTX_YEARS)
    .slice(-10)
    .map(e => `- ${e.actualEndYear ?? e.scheduledYear} 年 ${e.type}：${e.narrativeSeed}`)
    .join('\n');

  let generated: ScheduledWorldEvent[] = [];
  let via: 'llm' | 'rng' = 'rng';

  try {
    const llmEvents = await tryLLMSchedule({
      eraName: c.eraName,
      fromYear,
      toYear,
      n,
      tailContext,
      historyContext,
      characterId,
    });
    if (llmEvents && llmEvents.length > 0) {
      generated = llmEvents;
      via = 'llm';
    }
  } catch (e) {
    console.warn('[chronicle] LLM schedule failed, fallback to RNG:', (e as any)?.message || e);
  }

  if (generated.length === 0) {
    generated = rngFallbackSchedule({
      fromYear,
      toYear,
      n,
      characterId,
      priorHistoryTypes: new Set([...c.schedule, ...c.history].map(e => e.type)),
    });
    via = 'rng';
  }

  // 校验 + telemetry 填充
  generated = generated
    .map(ev => normalizeEvent(ev, fromYear, toYear, characterId, via))
    .filter(Boolean) as ScheduledWorldEvent[];

  if (generated.length > 0) {
    await appendSchedule(generated);
  }
  await saveChronicle({ generatedUntilYear: toYear });

  console.log(`[chronicle] filled ${fromYear} -> ${toYear} + ${generated.length} events, via: ${via}`);

  return { added: generated.length, via, fromYear, toYear };
}

// ============================================================
// LLM 排：调 callLLMText → parseJSON → 校验
// ============================================================

async function tryLLMSchedule(opts: {
  eraName: string;
  fromYear: number;
  toYear: number;
  n: number;
  tailContext: string;
  historyContext: string;
  characterId: string;
}): Promise<ScheduledWorldEvent[]> {
  const { eraName, fromYear, toYear, n, tailContext, historyContext, characterId } = opts;

  const system = `你是"天道"——记录世界大事的中立力量。你不服务玩家，也不为任何角色偏袒。
你根据世界法则、势力兴衰、灵气涨落、修士争斗，编排一段时间里可能发生的世界大事。
你输出严格 JSON，不加任何解释文字，不加代码块标记。`;

  const user = `请为 ${eraName} ${fromYear}~${toYear} 年编排世界大事件时间线。
要求：
- 每 30 年 1 条（可少量浮动，总数约 ${n} 条）
- 从下列 30 种类型中选（可以同类型重复；也允许时间重叠）：${WORLD_EVENT_TYPES.join(', ')}
- 输出严格 JSON 数组，每条：{ "type": "<type>", "scheduledYear": <int>, "narrativeSeed": "<20-40字种子>" }
- narrativeSeed 是一句 20-40 字的种子描述（如"极北魔道大能破封，正邪之战再起"）
- 因果排序：如 demon_pushed_back 必须在 demon_invasion 之后
- mythic/legendary 稀有度事件之间至少间隔 50 年
- 允许时间重叠（如灵潮枯竭进行时同期妖族入侵）

【上一段的尾部事件（供承接）】
${tailContext || '（无）'}

【近 ${HISTORY_CTX_YEARS} 年 concluded 历史（不要与之冲突）】
${historyContext || '（无）'}

直接输出 JSON 数组：`;

  const content = await callLLMText(system, user, { qualityMode: 'light' });
  const parsed = parseJSON(content);
  const arr: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.events)
      ? (parsed as any).events
      : [];

  const validTypes = new Set<string>(WORLD_EVENT_TYPES);
  const out: ScheduledWorldEvent[] = [];
  const rarityRankMap: Record<string, number> = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  const highRarity = new Set(['mythic', 'legendary']);

  // 因果校验：prerequisites 必须在同批之前或已在 chronicle
  const seenTypes = new Set<string>();

  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const type = String(raw.type || '').trim();
    if (!validTypes.has(type)) continue;
    const scheduledYear = Math.floor(Number(raw.scheduledYear));
    if (!Number.isFinite(scheduledYear) || scheduledYear < fromYear || scheduledYear > toYear) continue;
    const seed = String(raw.narrativeSeed || '').slice(0, 60);
    if (!seed) continue;

    const tpl = WORLD_EVENT_TEMPLATES.find(t => t.type === type);
    if (!tpl) continue;

    // mythic/legendary 间隔 50 年
    if (highRarity.has(tpl.rarity)) {
      const conflict = out.some(x => {
        const xtpl = WORLD_EVENT_TEMPLATES.find(t => t.type === x.type);
        return xtpl && highRarity.has(xtpl.rarity) && Math.abs(x.scheduledYear - scheduledYear) < 50;
      });
      if (conflict) continue;
    }

    // prerequisites：只要同批已含或已在 chronicle 类型池，即认为合规
    if (tpl.triggerConditions.prerequisites && tpl.triggerConditions.prerequisites.length > 0) {
      const ok = tpl.triggerConditions.prerequisites.every(p => seenTypes.has(p));
      // 允许通过（不能太严；后续 tickChronicle 也不再依赖 age 因果，这里放宽）
      if (!ok) {
        // 不 skip，只是记一下——上层排定不判 fail
      }
    }

    seenTypes.add(type);
    out.push({
      id: `we-${scheduledYear}-${type}-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: type as WorldEventType,
      status: 'scheduled',
      scheduledYear,
      scheduledDrift: driftForRarity(tpl.rarity),
      plannedDuration: tpl.duration,
      narrativeSeed: seed,
      affectedCharacterIds: [],
      linkedThreadTitles: [],
      telemetry: {
        generatedAtYear: fromYear,
        generatedForCharacterId: characterId,
        generatedByModel: 'llm',
        rarityRoll: rarityRankMap[tpl.rarity] ?? 0,
      },
    });
  }

  out.sort((a, b) => a.scheduledYear - b.scheduledYear);
  return out;
}

// ============================================================
// RNG fallback：均分 fromYear..toYear，每 30 年 1 条，按 rarity 权重挑 type
// ============================================================

function rngFallbackSchedule(opts: {
  fromYear: number;
  toYear: number;
  n: number;
  characterId: string;
  priorHistoryTypes: Set<string>;
}): ScheduledWorldEvent[] {
  const { fromYear, toYear, n, characterId } = opts;
  const span = Math.max(1, toYear - fromYear + 1);
  const step = span / Math.max(1, n);

  // 类型权重：mythic/legendary 低；common/uncommon/rare/epic 高
  const weights: Record<string, number> = {
    mythic: 1, legendary: 2, epic: 5, rare: 6, uncommon: 3, common: 2,
  };
  const pool: WorldEventTemplate[] = WORLD_EVENT_TEMPLATES;
  const flat: WorldEventTemplate[] = [];
  for (const t of pool) {
    const w = weights[t.rarity] ?? 3;
    for (let i = 0; i < w; i++) flat.push(t);
  }

  const out: ScheduledWorldEvent[] = [];
  let lastHighRarityYear = -9999;

  for (let i = 0; i < n; i++) {
    const centerYear = Math.round(fromYear + step * i + step / 2);
    // 挑一个 template
    let tpl = flat[Math.floor(Math.random() * flat.length)];
    // mythic/legendary 至少间隔 50 年
    if ((tpl.rarity === 'mythic' || tpl.rarity === 'legendary') && centerYear - lastHighRarityYear < 50) {
      // 重挑一次非高稀有
      for (let k = 0; k < 8; k++) {
        const alt = flat[Math.floor(Math.random() * flat.length)];
        if (alt.rarity !== 'mythic' && alt.rarity !== 'legendary') { tpl = alt; break; }
      }
    }
    if (tpl.rarity === 'mythic' || tpl.rarity === 'legendary') {
      lastHighRarityYear = centerYear;
    }

    const jitter = Math.round((Math.random() - 0.5) * Math.min(step * 0.4, 6));
    const year = Math.max(fromYear, Math.min(toYear, centerYear + jitter));
    const seed = fallbackSeedFor(tpl);

    out.push({
      id: `we-${year}-${tpl.type}-${Math.floor(Math.random() * 9000 + 1000)}`,
      type: tpl.type,
      status: 'scheduled',
      scheduledYear: year,
      scheduledDrift: driftForRarity(tpl.rarity),
      plannedDuration: tpl.duration,
      narrativeSeed: seed,
      affectedCharacterIds: [],
      linkedThreadTitles: [],
      telemetry: {
        generatedAtYear: fromYear,
        generatedForCharacterId: characterId,
        generatedByModel: 'rng',
        rarityRoll: Math.random(),
      },
    });
  }
  out.sort((a, b) => a.scheduledYear - b.scheduledYear);
  return out;
}

function fallbackSeedFor(tpl: WorldEventTemplate): string {
  const hint = tpl.hints[0] || '';
  return `${tpl.title}——${hint || tpl.narrativeTemplate.slice(0, 24)}`.slice(0, 40);
}

function normalizeEvent(
  ev: ScheduledWorldEvent,
  fromYear: number,
  toYear: number,
  characterId: string,
  via: 'llm' | 'rng',
): ScheduledWorldEvent | null {
  if (!ev || !ev.type || !ev.narrativeSeed) return null;
  const tpl = WORLD_EVENT_TEMPLATES.find(t => t.type === ev.type);
  if (!tpl) return null;
  return {
    ...ev,
    id: ev.id || `we-${ev.scheduledYear}-${ev.type}-${Math.floor(Math.random() * 9000 + 1000)}`,
    status: 'scheduled',
    scheduledDrift: ev.scheduledDrift ?? driftForRarity(tpl.rarity),
    plannedDuration: ev.plannedDuration ?? tpl.duration,
    affectedCharacterIds: Array.isArray(ev.affectedCharacterIds) ? ev.affectedCharacterIds : [],
    linkedThreadTitles: Array.isArray(ev.linkedThreadTitles) ? ev.linkedThreadTitles : [],
    telemetry: ev.telemetry ?? {
      generatedAtYear: fromYear,
      generatedForCharacterId: characterId,
      generatedByModel: via,
      rarityRoll: 0,
    },
  };
}
