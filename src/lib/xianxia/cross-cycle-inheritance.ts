// Phase-W #10: Cross-Cycle Inheritance (跨周目传承)
// Tracks heritage from previous cycles into current protagonist.
// Reuses engine's heritageVault + InheritancePool structures.

import type { InheritancePool } from '@/lib/xianxia/types';

export interface CrossCycleInheritanceEntry {
  sourceCharacterId: string;
  poolId: string;
  poolName: string;
  kind: string;
  acquiredAtAge: number;
  availableSlots: number;
  lockedUntilAge: number;
  isUnlocked: boolean;
  isClaimed: boolean;
}

export function listAvailableInheritance(input: {
  heritageVault?: any[];
  currentCharacterAge?: number;
  claimedPoolIds?: string[];
}): CrossCycleInheritanceEntry[] {
  const vault = Array.isArray(input.heritageVault) ? input.heritageVault : [];
  const currentAge = typeof input.currentCharacterAge === 'number' && input.currentCharacterAge >= 0
    ? input.currentCharacterAge : 0;
  const claimed = new Set(Array.isArray(input.claimedPoolIds) ? input.claimedPoolIds : []);

  const out: CrossCycleInheritanceEntry[] = [];
  for (const entry of vault) {
    if (!entry || typeof entry !== 'object') continue;
    const pool = entry.pool || entry.inheritancePool || entry;
    if (!pool || typeof pool !== 'object') continue;
    const id = typeof pool.id === 'string' ? pool.id : '';
    if (!id) continue;
    const lockedUntilAge = typeof pool.lockedUntilAge === 'number' ? pool.lockedUntilAge : 0;
    const acquiredAtAge = typeof entry.acquiredAtAge === 'number' ? entry.acquiredAtAge : 0;
    const isClaimed = claimed.has(id);
    const isUnlocked = currentAge >= lockedUntilAge && !isClaimed;
    out.push({
      sourceCharacterId: typeof entry.sourceCharacterId === 'string' ? entry.sourceCharacterId : '',
      poolId: id,
      poolName: typeof pool.name === 'string' ? pool.name : id,
      kind: typeof pool.kind === 'string' ? pool.kind : 'unknown',
      acquiredAtAge,
      availableSlots: typeof pool.availableSlots === 'number' ? pool.availableSlots : 0,
      lockedUntilAge,
      isUnlocked,
      isClaimed,
    });
  }
  return out;
}

export function summarizeInheritanceForDisplay(entries: CrossCycleInheritanceEntry[]): {
  total: number;
  unlocked: number;
  claimed: number;
  locked: number;
  kinds: string[];
} {
  const total = entries.length;
  const unlocked = entries.filter((e) => e.isUnlocked).length;
  const claimed = entries.filter((e) => e.isClaimed).length;
  const locked = entries.filter((e) => !e.isUnlocked && !e.isClaimed).length;
  const kinds = Array.from(new Set(entries.map((e) => e.kind))).filter((k) => k);
  return { total, unlocked, claimed, locked, kinds };
}
