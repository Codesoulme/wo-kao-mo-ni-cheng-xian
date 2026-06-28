// Phase-M follow-up: ending preview helper.
// Reuses triggerEndingEvaluation by passing causeOfDeath: null as "alive preview".
// If engine ever breaks on null, fall back to local heuristic.

import {
  triggerEndingEvaluation,
  type PhaseKEndingEvaluation,
} from '@/lib/xianxia/engine';

export interface EndingPreviewEntry {
  archetype: string;       // ascend-immortal / sit-death / fall-demonic / found-sect / reincarnate / escape-world / world-collapse / fade-into-mortal
  label: string;            // 中文显示名
  weight: number;           // 0..1 候选权重
  reason: string;           // engine 解释
  progress: {
    ageMet: boolean;        // 角色年龄是否足够
    realmMet: boolean;      // 境界是否匹配
    factionMet: boolean;    // 宗门/身份是否匹配
    overallPct: number;     // 0..100 玩家能看到的进度
  };
  tone: 'good' | 'bad' | 'neutral' | 'mystery';
}

const ARCHETYPE_LABEL: Record<string, { label: string; tone: 'good' | 'bad' | 'neutral' | 'mystery' }> = {
  'ascend-immortal':   { label: '飞升成仙',   tone: 'good' },
  'sit-death':         { label: '坐化归尘',   tone: 'neutral' },
  'fall-demonic':      { label: '堕入魔道',   tone: 'bad' },
  'found-sect':        { label: '开宗立派',   tone: 'good' },
  'reincarnate':       { label: '轮回转世',   tone: 'good' },
  'escape-world':      { label: '跳出此界',   tone: 'mystery' },
  'world-collapse':    { label: '世界崩毁',   tone: 'bad' },
  'fade-into-mortal':  { label: '归隐红尘',   tone: 'neutral' },
};

export interface PreviewProgressInput {
  age: number;
  realm: string;
  faction: string;
  spiritualRoot: string;
  causeOfDeath?: string | null;
}

function _progressForArchetype(arch: string, p: PreviewProgressInput): EndingPreviewEntry['progress'] {
  const age = p.age;
  const realm = (p.realm || '').toLowerCase();
  const hasFaction = !!p.faction;
  let ageMet = false, realmMet = false, factionMet = false;
  let score = 0;
  switch (arch) {
    case 'ascend-immortal':
      ageMet = age >= 80;
      realmMet = realm.includes('ascension') || realm.includes('tribulation') || realm.includes('化神') || realm.includes('炼虚');
      factionMet = false;
      score = (ageMet ? 35 : 0) + (realmMet ? 50 : 0);
      break;
    case 'sit-death':
      ageMet = age >= 60;
      realmMet = realm.includes('结丹') || realm.includes('金丹') || realm.includes('筑基') || realm.includes('练气');
      factionMet = false;
      score = (ageMet ? 40 : 0) + (realmMet ? 30 : 0) + (age >= 100 ? 30 : 0);
      break;
    case 'fall-demonic':
      ageMet = age >= 20;
      realmMet = realm.length > 0;
      factionMet = hasFaction;
      score = (ageMet ? 20 : 0) + (realmMet ? 20 : 0) + (factionMet ? 10 : 0) + 30;
      break;
    case 'found-sect':
      ageMet = age >= 30;
      realmMet = realm.includes('金丹') || realm.includes('结丹') || realm.includes('化神') || realm.includes('元婴');
      factionMet = hasFaction;
      score = (ageMet ? 25 : 0) + (realmMet ? 40 : 0) + (factionMet ? 35 : 0);
      break;
    case 'reincarnate':
      ageMet = age >= 18;
      realmMet = realm.length > 0;
      factionMet = false;
      score = (ageMet ? 20 : 0) + (realmMet ? 20 : 0) + 40;
      break;
    case 'escape-world':
      ageMet = age >= 40;
      realmMet = realm.includes('炼虚') || realm.includes('化神') || realm.includes('大乘');
      factionMet = false;
      score = (ageMet ? 25 : 0) + (realmMet ? 55 : 0);
      break;
    case 'world-collapse':
      ageMet = age >= 10;
      realmMet = true;
      factionMet = true;
      score = 5 + (ageMet ? 5 : 0);
      break;
    case 'fade-into-mortal':
      ageMet = age >= 30;
      realmMet = realm.length > 0;
      factionMet = hasFaction;
      score = (ageMet ? 35 : 0) + (realmMet ? 30 : 0) + 25;
      break;
    default:
      score = 0;
  }
  return { ageMet, realmMet, factionMet, overallPct: Math.min(100, Math.max(0, Math.round(score))) };
}

export function previewEndingsForCharacter(
  character: any,
  worldState: any,
): EndingPreviewEntry[] {
  const ch = (character && typeof character === 'object') ? character : {};
  const ws = (worldState && typeof worldState === 'object') ? worldState : {};
  let evalRes: PhaseKEndingEvaluation | null = null;
  try {
    evalRes = triggerEndingEvaluation(ch, ws, null);
  } catch (e) {
    evalRes = null;
  }
  const triggered = (evalRes && Array.isArray(evalRes.triggeredEndings)) ? evalRes.triggeredEndings : [];
  // Ensure all 8 archetypes are present (even with 0 weight if missing)
  const allArchs = Object.keys(ARCHETYPE_LABEL);
  const map = new Map<string, number>();
  const reasonMap = new Map<string, string>();
  for (const c of triggered) {
    if (c && typeof c.archetype === 'string') {
      map.set(c.archetype, typeof c.weight === 'number' ? c.weight : 0);
      reasonMap.set(c.archetype, c.reason || '');
    }
  }
  const progressInput: PreviewProgressInput = {
    age: typeof ch.age === 'number' && Number.isFinite(ch.age) ? ch.age : 0,
    realm: typeof ch.realm === 'string' ? ch.realm : (typeof ch.cultivation === 'string' ? ch.cultivation : ''),
    faction: typeof ch.faction === 'string' ? ch.faction : (typeof ch.sect === 'string' ? ch.sect : ''),
    spiritualRoot: typeof ch.spiritualRoot === 'string' ? ch.spiritualRoot : '',
    causeOfDeath: ch.causeOfDeath ?? null,
  };
  const out: EndingPreviewEntry[] = allArchs.map((arch) => {
    const meta = ARCHETYPE_LABEL[arch];
    return {
      archetype: arch,
      label: meta.label,
      weight: map.get(arch) ?? 0,
      reason: reasonMap.get(arch) ?? '未触发',
      progress: _progressForArchetype(arch, progressInput),
      tone: meta.tone,
    };
  });
  // Sort: highest weight first, then by overallPct
  out.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.progress.overallPct - a.progress.overallPct;
  });
  return out;
}

export const ENDING_ARCHETYPE_LABELS = ARCHETYPE_LABEL;
