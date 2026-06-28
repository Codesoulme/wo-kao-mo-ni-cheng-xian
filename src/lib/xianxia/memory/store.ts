// TechDoc 18.6.6: 内存版 memory store
// PoC：用 Map 缓存；生产应该接 SQLite / Redis / 向量 DB

import type { Memory, MemoryKind, HierarchicalSummary, SummaryLevel } from './types';

const memories = new Map<string, Memory>();
const summaries = new Map<string, HierarchicalSummary>();

/** 新增 / 覆盖一条记忆 */
export function addMemory(mem: Memory): void {
  memories.set(mem.id, mem);
}

/** 批量新增 */
export function addMemories(mems: Memory[]): void {
  for (const m of mems) memories.set(m.id, m);
}

/** 按 id 查询 */
export function getMemoryById(id: string): Memory | undefined {
  return memories.get(id);
}

/** 列出记忆（带过滤） */
export function listMemories(filter: {
  kind?: MemoryKind;
  characterId?: string;
  limit?: number;
} = {}): Memory[] {
  let result = Array.from(memories.values());
  if (filter.kind) {
    result = result.filter((m) => m.kind === filter.kind);
  }
  if (filter.characterId) {
    result = result.filter((m) => {
      // episodic 和 procedural 不一定有 characterId；按需判断
      if (m.kind === 'episodic') return (m as any).characterId === filter.characterId;
      // semantic / procedural 没有 characterId 概念，跳过
      return false;
    });
  }
  if (filter.limit) {
    result = result.slice(0, filter.limit);
  }
  return result;
}

/** 关键词搜索（PoC 占位；生产用 embedding + 向量检索） */
export function searchMemoriesByKeyword(keyword: string, kind?: MemoryKind): Memory[] {
  const lower = keyword.toLowerCase();
  if (!lower) return [];
  return Array.from(memories.values()).filter((m) => {
    if (kind && m.kind !== kind) return false;
    const text =
      (m as any).summary ||
      (m as any).fact ||
      JSON.stringify((m as any).traits || {});
    return typeof text === 'string' && text.toLowerCase().includes(lower);
  });
}

/** 摘要 CRUD */
export function addSummary(s: HierarchicalSummary): void {
  summaries.set(s.id, s);
}

export function getSummary(id: string): HierarchicalSummary | undefined {
  return summaries.get(id);
}

export function listSummaries(level: SummaryLevel, characterId: string): HierarchicalSummary[] {
  return Array.from(summaries.values())
    .filter((s) => s.level === level && s.characterId === characterId)
    .sort((a, b) => a.startAge - b.startAge);
}

/** 统计：每类记忆的数量（PoC 测试用） */
export function countMemories(kind?: MemoryKind): number {
  if (!kind) return memories.size;
  let n = 0;
  for (const m of memories.values()) if (m.kind === kind) n++;
  return n;
}

/** 清空（测试用） */
export function clearMemoryStore(): void {
  memories.clear();
  summaries.clear();
}
