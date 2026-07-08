// 世界大事年表 · 单例读写
// - 用 findFirst({ id: 'default' }) + 缺则 create 保证单例
// - schedule/history 都是 JSON 字段：读时 parse + 兜底，写时 stringify
// - 并发处理：ensureChronicleCoverage 走串行队列（Promise 链），避免主流程 & 后台补齐互写

import { db } from '@/lib/db';
import type { ScheduledWorldEvent, WorldChronicleShape } from './world-chronicle-types';

const CHRONICLE_ID = 'default';

function safeParseArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function toShape(row: any): WorldChronicleShape {
  return {
    id: row.id,
    eraName: row.eraName,
    currentYear: row.currentYear,
    generatedUntilYear: row.generatedUntilYear,
    schedule: safeParseArray<ScheduledWorldEvent>(row.scheduleJson),
    history: safeParseArray<ScheduledWorldEvent>(row.historyJson),
    updatedAt: row.updatedAt,
  };
}

/** 读取全表；不存在则创建单例默认行 */
export async function getChronicle(): Promise<WorldChronicleShape> {
  let row: any = await (db as any).worldChronicle.findFirst({ where: { id: CHRONICLE_ID } });
  if (!row) {
    row = await (db as any).worldChronicle.create({
      data: {
        id: CHRONICLE_ID,
        eraName: '青岚仙历',
        currentYear: 5000,
        generatedUntilYear: 5000,
        scheduleJson: '[]',
        historyJson: '[]',
      },
    });
  }
  return toShape(row);
}

/** 写整体 chronicle patch（不含 schedule/history 数组本身） */
export async function saveChronicle(
  patch: Partial<Pick<WorldChronicleShape, 'eraName' | 'currentYear' | 'generatedUntilYear'>>,
): Promise<void> {
  await (db as any).worldChronicle.upsert({
    where: { id: CHRONICLE_ID },
    create: {
      id: CHRONICLE_ID,
      eraName: patch.eraName ?? '青岚仙历',
      currentYear: patch.currentYear ?? 5000,
      generatedUntilYear: patch.generatedUntilYear ?? 5000,
      scheduleJson: '[]',
      historyJson: '[]',
    },
    update: {
      ...(patch.eraName !== undefined ? { eraName: patch.eraName } : {}),
      ...(patch.currentYear !== undefined ? { currentYear: patch.currentYear } : {}),
      ...(patch.generatedUntilYear !== undefined ? { generatedUntilYear: patch.generatedUntilYear } : {}),
    },
  });
}

/** 向 schedule 尾追加事件（幂等去重按 id） */
export async function appendSchedule(events: ScheduledWorldEvent[]): Promise<void> {
  if (!events || events.length === 0) return;
  const c = await getChronicle();
  const existingIds = new Set(c.schedule.map(e => e.id));
  const next = [...c.schedule];
  for (const e of events) {
    if (!e || !e.id) continue;
    if (existingIds.has(e.id)) continue;
    next.push(e);
    existingIds.add(e.id);
  }
  next.sort((a, b) => a.scheduledYear - b.scheduledYear);
  await (db as any).worldChronicle.update({
    where: { id: CHRONICLE_ID },
    data: { scheduleJson: JSON.stringify(next) },
  });
}

/** 把已 concluded 的事件从 schedule 移到 history */
export async function moveToHistory(eventIds: string[]): Promise<void> {
  if (!eventIds || eventIds.length === 0) return;
  const c = await getChronicle();
  const idSet = new Set(eventIds);
  const kept: ScheduledWorldEvent[] = [];
  const moved: ScheduledWorldEvent[] = [];
  for (const e of c.schedule) {
    if (idSet.has(e.id) && e.status === 'concluded') moved.push(e);
    else kept.push(e);
  }
  if (moved.length === 0) return;
  const history = [...c.history, ...moved].slice(-500); // 顶多 500 条 history 防炸表
  await (db as any).worldChronicle.update({
    where: { id: CHRONICLE_ID },
    data: {
      scheduleJson: JSON.stringify(kept),
      historyJson: JSON.stringify(history),
    },
  });
}

/** 更新 schedule 中单条事件（in-place）。若 id 不在 schedule，回退到 history 更新（供玩家干预标记追记 causedBy 用）。 */
export async function updateEvent(id: string, patch: Partial<ScheduledWorldEvent>): Promise<void> {
  const c = await getChronicle();
  const inSchedule = c.schedule.some(e => e.id === id);
  if (inSchedule) {
    const next = c.schedule.map(e => (e.id === id ? { ...e, ...patch } : e));
    await (db as any).worldChronicle.update({
      where: { id: CHRONICLE_ID },
      data: { scheduleJson: JSON.stringify(next) },
    });
    return;
  }
  const inHistory = c.history.some(e => e.id === id);
  if (inHistory) {
    const next = c.history.map(e => (e.id === id ? { ...e, ...patch } : e));
    await (db as any).worldChronicle.update({
      where: { id: CHRONICLE_ID },
      data: { historyJson: JSON.stringify(next) },
    });
  }
}

/** 更新 currentYear（advance 每轮同步） */
export async function bumpCurrentYear(currentYear: number): Promise<void> {
  await (db as any).worldChronicle.update({
    where: { id: CHRONICLE_ID },
    data: { currentYear },
  }).catch(async () => {
    // 若不存在则先建
    await getChronicle();
    await (db as any).worldChronicle.update({
      where: { id: CHRONICLE_ID },
      data: { currentYear },
    });
  });
}
