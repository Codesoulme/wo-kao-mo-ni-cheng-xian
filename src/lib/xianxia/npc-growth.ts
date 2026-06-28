'use client';

/**
 * NPC 自生长（Phase-T #9）
 */

import type { WorldNpc, WorldNpcAttitude } from './types';

export function npcHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function seededRand(seed: string): number {
  const h = npcHash(seed);
  return (h & 0x00ffffff) / 0x01000000;
}

const REALM_ORDER: string[] = [
  'mortal',
  'qi_refining',
  'foundation',
  'golden_core',
  'nascent_soul',
  'spirit_severing',
  'great_vehicle',
  'tribulation',
  'ascension',
];

export function nextRealmId(current: string | undefined): string | null {
  const idx = REALM_ORDER.indexOf(current || 'mortal');
  if (idx < 0 || idx >= REALM_ORDER.length - 1) return null;
  return REALM_ORDER[idx + 1];
}

function baseLifespanFor(realm: string | undefined): number {
  switch (realm) {
    case 'mortal': return 80;
    case 'qi_refining': return 120;
    case 'foundation': return 200;
    case 'golden_core': return 500;
    case 'nascent_soul': return 1000;
    case 'spirit_severing': return 2000;
    case 'great_vehicle': return 5000;
    case 'tribulation': return 10000;
    case 'ascension': return 99999;
    default: return 80;
  }
}

export function deriveNpcAge(npc: WorldNpc): number {
  if (typeof npc.lastSeenAge === 'number' && npc.lastSeenAge > 0) {
    return npc.lastSeenAge;
  }
  if (typeof npc.firstMetAge === 'number' && npc.firstMetAge > 0) {
    return npc.firstMetAge;
  }
  return 0;
}

export interface NpcGrowthChange {
  id: string;
  name: string;
  kind: 'aged' | 'breakthrough' | 'died' | 'relation_decayed' | 'none';
  ageAfter: number;
  realmAfter?: string;
  relationshipDelta?: number;
  relationshipAfter?: number;
  narrativeHint: string;
}

export function tickNpcAge(npc: WorldNpc, yearDelta: number, characterAge: number): {
  next: WorldNpc;
  change: NpcGrowthChange;
} {
  const safeDelta = Math.max(0, Math.floor(yearDelta || 0));
  const prevAge = deriveNpcAge(npc);
  const nextAge = prevAge + safeDelta;
  const seedKey = npc.id + '|y' + safeDelta + '|age' + nextAge;

  const realm = npc.realm || 'mortal';
  const baseLife = baseLifespanFor(realm);
  const dangerStart = realm === 'mortal' ? 60 : Math.floor(baseLife * 0.7);
  let dieChance = 0;
  if (nextAge >= dangerStart) {
    if (realm === 'mortal') {
      if (nextAge >= 90) dieChance = 0.25;
      else if (nextAge >= 80) dieChance = 0.10;
      else dieChance = 0.01 + (nextAge - 60) * 0.005;
    } else {
      const over = Math.max(0, nextAge - dangerStart);
      dieChance = Math.min(0.10, 0.001 + over * 0.0005);
    }
  }
  const dieRoll = seededRand(seedKey + '|die');
  if (dieChance > 0 && dieRoll < dieChance) {
    const updated: WorldNpc = {
      ...npc,
      lastSeenAge: nextAge,
      attitude: 'unknown',
      memory: appendMemory(npc.memory, '于青岚仙历' + characterAge + '年仙逝，享年约 ' + nextAge + ' 岁。'),
    };
    return {
      next: updated,
      change: {
        id: npc.id,
        name: npc.name,
        kind: 'died',
        ageAfter: nextAge,
        realmAfter: realm,
        narrativeHint: npc.name + ' 寿终正寝，享年 ' + nextAge + ' 岁。',
      },
    };
  }

  let nextRealm = realm;
  let breakthrough = false;
  if (realm !== 'ascension' && realm !== 'tribulation') {
    const breakRoll = seededRand(seedKey + '|break');
    const breakChance = realm === 'mortal' ? 0.02 : 0.05;
    if (breakRoll < breakChance) {
      const promoted = nextRealmId(realm);
      if (promoted) {
        nextRealm = promoted;
        breakthrough = true;
      }
    }
  }

  let nextRelationship = npc.relationshipScore;
  let relationshipDelta = 0;
  if (npc.attitude !== 'unknown') {
    const decayPerYear = 0.2;
    const decay = safeDelta * decayPerYear;
    if (decay > 0) {
      nextRelationship = Math.max(-100, Math.min(100, npc.relationshipScore - decay));
      relationshipDelta = -decay;
    }
  }

  const updated: WorldNpc = {
    ...npc,
    lastSeenAge: nextAge,
    realm: nextRealm,
    relationshipScore: Number(nextRelationship.toFixed(2)),
  };

  let kind: NpcGrowthChange['kind'] = 'aged';
  let narrativeHint = npc.name + ' 长了一岁，今约 ' + nextAge + ' 岁。';
  if (breakthrough) {
    kind = 'breakthrough';
    narrativeHint = npc.name + ' 于 ' + nextAge + ' 岁悄然破境至 ' + realmLabel(nextRealm) + '，境界更上一阶。';
  } else if (Math.abs(relationshipDelta) >= 1) {
    kind = 'relation_decayed';
    narrativeHint = npc.name + ' 与你久未联络，关系悄然转淡。';
  }

  return {
    next: updated,
    change: {
      id: npc.id,
      name: npc.name,
      kind,
      ageAfter: nextAge,
      realmAfter: nextRealm,
      relationshipDelta,
      relationshipAfter: nextRelationship,
      narrativeHint,
    },
  };
}

function appendMemory(prev: string | undefined, addition: string): string {
  const safe = (addition || '').trim();
  if (!safe) return prev || '';
  if (!prev) return safe;
  return prev + '｜' + safe;
}

export function tickAllNpcsForYear(
  npcs: WorldNpc[] | null | undefined,
  yearDelta: number,
  characterAge: number,
): {
  nextNpcs: WorldNpc[];
  changes: NpcGrowthChange[];
} {
  const list = Array.isArray(npcs) ? npcs : [];
  const changes: NpcGrowthChange[] = [];
  const nextNpcs: WorldNpc[] = [];

  for (const npc of list) {
    if (!npc || typeof npc.id !== 'string') continue;
    if (npc.attitude === 'unknown' && /仙逝|陨落|归道/.test(npc.memory || '')) {
      nextNpcs.push(npc);
      continue;
    }
    const { next, change } = tickNpcAge(npc, yearDelta, characterAge);
    nextNpcs.push(next);
    changes.push(change);
  }

  return { nextNpcs, changes };
}

export interface NpcChangeSummary {
  aged: NpcGrowthChange[];
  breakthrough: NpcGrowthChange[];
  died: NpcGrowthChange[];
  decayed: NpcGrowthChange[];
  summary: string;
}

export function summarizeNpcChanges(
  prevNpcs: WorldNpc[] | null | undefined,
  nextNpcs: WorldNpc[] | null | undefined,
): NpcChangeSummary {
  const prev = Array.isArray(prevNpcs) ? prevNpcs : [];
  const next = Array.isArray(nextNpcs) ? nextNpcs : [];
  const prevById = new Map<string, WorldNpc>();
  for (const n of prev) {
    if (n?.id) prevById.set(n.id, n);
  }

  const aged: NpcGrowthChange[] = [];
  const breakthrough: NpcGrowthChange[] = [];
  const died: NpcGrowthChange[] = [];
  const decayed: NpcGrowthChange[] = [];

  for (const cur of next) {
    if (!cur?.id) continue;
    const old = prevById.get(cur.id);
    if (!old) continue;
    const oldAge = deriveNpcAge(old);
    const newAge = deriveNpcAge(cur);

    const wasDead = old.attitude === 'unknown' && /仙逝|陨落|归道/.test(old.memory || '');
    const isDead = cur.attitude === 'unknown' && /仙逝|陨落|归道/.test(cur.memory || '');
    if (!wasDead && isDead) {
      died.push({
        id: cur.id,
        name: cur.name,
        kind: 'died',
        ageAfter: newAge,
        realmAfter: cur.realm,
        narrativeHint: cur.name + ' 寿终正寝，享年 ' + newAge + ' 岁。',
      });
      continue;
    }

    if (old.realm !== cur.realm && cur.realm) {
      breakthrough.push({
        id: cur.id,
        name: cur.name,
        kind: 'breakthrough',
        ageAfter: newAge,
        realmAfter: cur.realm,
        narrativeHint: cur.name + ' 破境至 ' + realmLabel(cur.realm) + '。',
      });
      continue;
    }

    const relDelta = (cur.relationshipScore || 0) - (old.relationshipScore || 0);
    if (relDelta <= -1) {
      decayed.push({
        id: cur.id,
        name: cur.name,
        kind: 'relation_decayed',
        ageAfter: newAge,
        realmAfter: cur.realm,
        relationshipDelta: relDelta,
        relationshipAfter: cur.relationshipScore,
        narrativeHint: cur.name + ' 与你久未联络，关系转淡（' + Math.round(relDelta) + '）。',
      });
      continue;
    }

    if (newAge > oldAge) {
      aged.push({
        id: cur.id,
        name: cur.name,
        kind: 'aged',
        ageAfter: newAge,
        realmAfter: cur.realm,
        narrativeHint: cur.name + ' 长了一岁，今约 ' + newAge + ' 岁。',
      });
    }
  }

  const summary = buildSummaryLine({ aged, breakthrough, died, decayed });

  return { aged, breakthrough, died, decayed, summary };
}

function buildSummaryLine(parts: { aged: NpcGrowthChange[]; breakthrough: NpcGrowthChange[]; died: NpcGrowthChange[]; decayed: NpcGrowthChange[] }): string {
  const segs: string[] = [];
  if (parts.died.length) segs.push(parts.died.length + ' 人仙逝');
  if (parts.breakthrough.length) segs.push(parts.breakthrough.length + ' 人破境');
  if (parts.decayed.length) segs.push(parts.decayed.length + ' 人疏远');
  if (parts.aged.length) segs.push(parts.aged.length + ' 人年华流转');
  return segs.length ? segs.join('，') : '故交如旧，未有大变。';
}

const REALM_LABEL: Record<string, string> = {
  mortal: '凡人',
  qi_refining: '炼气期',
  foundation: '筑基期',
  golden_core: '金丹期',
  nascent_soul: '元婴期',
  spirit_severing: '化神期',
  great_vehicle: '大乘期',
  tribulation: '渡劫期',
  ascension: '飞升',
};

export function realmLabel(realm: string | undefined | null): string {
  if (!realm) return '未知境界';
  return REALM_LABEL[realm] || realm;
}

export function attitudeLabel(attitude: WorldNpcAttitude | undefined | null): string {
  switch (attitude) {
    case 'ally': return '同道';
    case 'friendly': return '友善';
    case 'neutral': return '中立';
    case 'hostile': return '敌视';
    case 'enemy': return '仇敌';
    case 'unknown': return '已故/未知';
    default: return '未知';
  }
}