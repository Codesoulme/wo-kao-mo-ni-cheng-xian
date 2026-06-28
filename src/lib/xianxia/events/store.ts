// Event Store：appendEvent + getEvents 查询 API。
// PoC 阶段：单事务内查 latest event + insert new event（链式引用 + 乐观锁）。
// 注意：本文件不接任何业务写路径——纯基础设施。

import { db } from '../../db';
import { generateEntityId } from '../engine';
import type { Event, EventData, EventSource, EventType, TriggerActor } from './types';

export interface AppendEventInput {
  characterId: string;
  type: EventType;
  data: EventData;
  source: EventSource;
  aiPromptHash?: string;
  triggerActor: TriggerActor;
  createdAtAge?: number;
}

// appendEvent：在事务中读最新 event → 算 aggregateVersion + previousEventId → insert new event。
// 之所以用事务：避免两个并发 append 拿到同一个 aggregateVersion（导致链断裂）。
export async function appendEvent(input: AppendEventInput): Promise<Event> {
  const result = await db.$transaction(async (tx) => {
    const latest = await tx.event.findFirst({
      where: { characterId: input.characterId },
      orderBy: { aggregateVersion: 'desc' },
      select: { id: true, aggregateVersion: true },
    });
    const aggregateVersion = (latest?.aggregateVersion ?? -1) + 1;
    const previousEventId = latest?.id ?? null;

    const created = await tx.event.create({
      data: {
        id: generateEntityId('evt'),
        characterId: input.characterId,
        type: input.type,
        data: input.data as any,
        previousEventId,
        aggregateVersion,
        source: input.source,
        aiPromptHash: input.aiPromptHash ?? null,
        triggerActor: input.triggerActor,
        createdAtAge: input.createdAtAge ?? null,
      },
    });
    return created;
  });
  return toEvent(result);
}

// getEvents：按 character 查事件流（可按 version 范围、type 过滤）。
// 默认按 aggregateVersion 升序——replay 需要这个顺序。
export async function getEvents(
  characterId: string,
  options?: { fromVersion?: number; toVersion?: number; type?: EventType }
): Promise<Event[]> {
  const where: any = { characterId };
  if (options?.fromVersion !== undefined && options?.toVersion !== undefined) {
    where.aggregateVersion = { gte: options.fromVersion, lte: options.toVersion };
  } else if (options?.fromVersion !== undefined) {
    where.aggregateVersion = { gte: options.fromVersion };
  } else if (options?.toVersion !== undefined) {
    where.aggregateVersion = { lte: options.toVersion };
  }
  if (options?.type) where.type = options.type;

  const rows = await db.event.findMany({
    where,
    orderBy: { aggregateVersion: 'asc' },
  });
  return rows.map(toEvent);
}

// getLatestEvent：取指定 character 最新一条事件（用于 appendEvent 的乐观锁基线）。
export async function getLatestEvent(characterId: string): Promise<Event | null> {
  const row = await db.event.findFirst({
    where: { characterId },
    orderBy: { aggregateVersion: 'desc' },
  });
  return row ? toEvent(row) : null;
}

// getEventsByType：按类型筛事件（审计、调试用）。
export async function getEventsByType(characterId: string, type: EventType): Promise<Event[]> {
  return getEvents(characterId, { type });
}

// getEventById：按 id 查单条（PoC 工具函数；projector 会用）。
export async function getEventById(eventId: string): Promise<Event | null> {
  const row = await db.event.findUnique({ where: { id: eventId } });
  return row ? toEvent(row) : null;
}

// ---- 内部：Prisma row → 业务 Event ----
// Prisma 返回 Date 对象；Event interface 用 ms timestamp 数字（统一语义，避免时区混乱）。
function toEvent(row: any): Event {
  return {
    id: row.id,
    characterId: row.characterId,
    type: row.type as EventType,
    data: row.data as EventData,
    previousEventId: row.previousEventId ?? null,
    aggregateVersion: row.aggregateVersion,
    timestamp: row.timestamp instanceof Date ? row.timestamp.getTime() : Number(row.timestamp),
    createdAtAge: row.createdAtAge ?? null,
    source: row.source as EventSource,
    aiPromptHash: row.aiPromptHash ?? null,
    triggerActor: row.triggerActor as TriggerActor,
  };
}