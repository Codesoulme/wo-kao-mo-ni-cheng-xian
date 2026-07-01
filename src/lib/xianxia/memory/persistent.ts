// Memory layer (Plan-A): 持久化 NPC 关系 + 心境记忆
// 与 episodic 缓存并存：本模块写 SQLite 派生表；现有 memory/store.ts 仍是 PoC 缓存
// 写入由 appendEvent() 调用方触发；不挂隐式 LLM 提炼

import { db } from '../../db';

// ─── NpcRelationship ───

export interface NpcRelationshipSnapshot {
  npcKey: string;
  npcName: string;
  affinity: number;
  trust: number;
  hostility: number;
  lastAge: number;
  lastEvent: string;
  tag: string;
}

export interface RelationshipDelta {
  affinity?: number;
  trust?: number;
  hostility?: number;
  lastEvent: string;
}

export async function getOrCreateNpcRelationship(
  characterId: string,
  npcKey: string,
  npcName: string
): Promise<NpcRelationshipSnapshot> {
  const existing = await db.npcRelationship.findUnique({
    where: { characterId_npcKey: { characterId, npcKey } },
  });
  if (existing) {
    return snapshotFromRow(existing);
  }
  const created = await db.npcRelationship.create({
    data: { characterId, npcKey, npcName },
  });
  return snapshotFromRow(created);
}

export async function applyNpcRelationshipDelta(
  characterId: string,
  npcKey: string,
  npcName: string,
  delta: RelationshipDelta,
  age: number
): Promise<NpcRelationshipSnapshot> {
  const current = await getOrCreateNpcRelationship(characterId, npcKey, npcName);
  const next = {
    affinity: clamp(current.affinity + (delta.affinity ?? 0), -100, 100),
    trust: clamp(current.trust + (delta.trust ?? 0), -100, 100),
    hostility: clamp(current.hostility + (delta.hostility ?? 0), 0, 100),
    lastAge: age,
    lastEvent: delta.lastEvent,
  };
  const updated = await db.npcRelationship.upsert({
    where: { characterId_npcKey: { characterId, npcKey } },
    update: next,
    create: { characterId, npcKey, npcName, ...next },
  });
  return snapshotFromRow(updated);
}

export async function listNpcRelationships(
  characterId: string,
  sort: 'affinity' | 'hostility' | 'recent' = 'affinity'
): Promise<NpcRelationshipSnapshot[]> {
  const orderBy =
    sort === 'hostility'
      ? [{ hostility: 'desc' as const }, { lastAge: 'desc' as const }]
      : sort === 'recent'
      ? [{ lastAge: 'desc' as const }]
      : [{ affinity: 'desc' as const }, { lastAge: 'desc' as const }];
  const rows = await db.npcRelationship.findMany({ where: { characterId }, orderBy });
  return rows.map(snapshotFromRow);
}

// ─── NarrativeMemory ───

export type NarrativeMemoryCategory =
  | 'unresolved_fate'
  | 'debt'
  | 'loss'
  | 'growth'
  | 'promise'
  | 'grudge';

export interface NarrativeMemorySnapshot {
  id: string;
  category: NarrativeMemoryCategory;
  intensity: number;
  title: string;
  body: string;
  sourceEventId: string | null;
  age: number;
  resolved: boolean;
  createdAt: number;
}

export async function addNarrativeMemory(input: {
  characterId: string;
  category: NarrativeMemoryCategory;
  intensity?: number;
  title: string;
  body: string;
  sourceEventId?: string;
  age: number;
}): Promise<NarrativeMemorySnapshot> {
  const row = await db.narrativeMemory.create({
    data: {
      characterId: input.characterId,
      category: input.category,
      intensity: input.intensity ?? 50,
      title: input.title,
      body: input.body,
      sourceEventId: input.sourceEventId ?? null,
      age: input.age,
    },
  });
  return toSnapshot(row);
}

export async function resolveNarrativeMemory(id: string): Promise<void> {
  await db.narrativeMemory.update({
    where: { id },
    data: { resolved: true, intensity: 0 },
  });
}

export async function listActiveMemories(
  characterId: string,
  options?: { category?: NarrativeMemoryCategory; minIntensity?: number; limit?: number }
): Promise<NarrativeMemorySnapshot[]> {
  const where: any = { characterId, resolved: false };
  if (options?.category) where.category = options.category;
  if (options?.minIntensity !== undefined) where.intensity = { gte: options.minIntensity };
  const rows = await db.narrativeMemory.findMany({
    where,
    orderBy: [{ intensity: 'desc' }, { age: 'desc' }],
    take: options?.limit ?? 10,
  });
  return rows.map(toSnapshot);
}

export async function decayMemories(characterId: string, yearsPassed: number): Promise<void> {
  if (yearsPassed <= 0) return;
  await db.$executeRaw`
    UPDATE NarrativeMemory
    SET intensity = MAX(0, intensity - ${yearsPassed * 2}),
        updatedAt = CURRENT_TIMESTAMP
    WHERE characterId = ${characterId} AND resolved = 0
  `;
}

// ─── helpers ───

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function snapshotFromRow(row: any): NpcRelationshipSnapshot {
  return {
    npcKey: row.npcKey,
    npcName: row.npcName,
    affinity: row.affinity,
    trust: row.trust,
    hostility: row.hostility,
    lastAge: row.lastAge,
    lastEvent: row.lastEvent,
    tag: row.tag,
  };
}

function toSnapshot(row: any): NarrativeMemorySnapshot {
  return {
    id: row.id,
    category: row.category as NarrativeMemoryCategory,
    intensity: row.intensity,
    title: row.title,
    body: row.body,
    sourceEventId: row.sourceEventId,
    age: row.age,
    resolved: row.resolved,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
  };
}
