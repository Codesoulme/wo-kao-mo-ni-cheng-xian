// Phase-M: save slot management.
// 1 to 3 slots, each with: name, savedAt (timestamp), savedAge (in-game),
// worldCalendar snapshot, character summary, slot state.

export interface SaveSlotMeta {
  slotId: 1 | 2 | 3;
  name: string;
  savedAt: string;          // ISO 8601
  savedAge: number;
  savedCalendarYear: number;
  savedRealm: string;
  characterName: string;
  eraName: string;
  eventsCount: number;
  isAutoSave: boolean;
}

export interface SaveSlotData {
  meta: SaveSlotMeta;
  payload: any;             // serialized GameState (only persistable slice)
}

const SLOT_KEYS = {
  1: 'xianxia-game-slot-1',
  2: 'xianxia-game-slot-2',
  3: 'xianxia-game-slot-3',
} as const;

export type SlotId = 1 | 2 | 3;

export function listSaveSlots(): SaveSlotMeta[] {
  if (typeof window === 'undefined') return [];
  const out: SaveSlotMeta[] = [];
  for (const id of [1, 2, 3] as const) {
    const raw = localStorage.getItem(SLOT_KEYS[id]);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const meta = parsed?.meta;
      if (meta && typeof meta.slotId === 'number') out.push(meta);
    } catch {
      // skip corrupted
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function readSaveSlot(id: SlotId): SaveSlotData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SLOT_KEYS[id]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export interface WriteSaveSlotResult {
  ok: boolean;
  /** 永远回填（即便失败）—— 失败时仍可读 savedAt 等用于日志/UI 提示 */
  meta: SaveSlotMeta;
  /** 失败原因（中文，UI 可直接显示） */
  error?: string;
}

export function writeSaveSlot(id: SlotId, payload: any, meta: Omit<SaveSlotMeta, 'slotId'>): WriteSaveSlotResult {
  const fullMeta: SaveSlotMeta = { slotId: id, ...meta };
  if (typeof window === 'undefined') {
    return { ok: false, meta: fullMeta, error: '存档不可在服务端执行' };
  }
  const slotData: SaveSlotData = { meta: fullMeta, payload };
  try {
    localStorage.setItem(SLOT_KEYS[id], JSON.stringify(slotData));
    return { ok: true, meta: fullMeta };
  } catch (e: any) {
    // QuotaExceededError / SecurityError / JSON 序列化失败等
    const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string')
      ? (e as any).message
      : '存储失败';
    // P0 修复: 不要把失败留到调用方 console，这里给出明确错误
    // eslint-disable-next-line no-console
    console.warn('[save-slots] writeSaveSlot failed:', { slot: id, err: msg });
    return { ok: false, meta: fullMeta, error: msg };
  }
}

export function deleteSaveSlot(id: SlotId): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SLOT_KEYS[id]);
}

export function exportSaveSlot(id: SlotId): string | null {
  const slot = readSaveSlot(id);
  if (!slot) return null;
  return JSON.stringify(slot, null, 2);
}

export function importSaveSlot(json: string, targetId?: SlotId): SaveSlotMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed?.meta || typeof parsed.meta.slotId !== 'number') {
      throw new Error('Invalid save slot JSON');
    }
    const slotId: SlotId = targetId ?? (parsed.meta.slotId as SlotId);
    if (![1, 2, 3].includes(slotId)) throw new Error('Invalid slot id');
    localStorage.setItem(SLOT_KEYS[slotId], json);
    return parsed.meta;
  } catch {
    return null;
  }
}

export function summarizeCharacterForSlot(character: any): { name: string; realm: string; age: number } {
  const c = character && typeof character === 'object' ? character : {};
  return {
    name: typeof c.name === 'string' ? c.name : (typeof c.id === 'string' ? c.id : '无名氏'),
    realm: typeof c.realm === 'string' ? c.realm : (typeof c.cultivation === 'string' ? c.cultivation : '凡人'),
    age: typeof c.age === 'number' && Number.isFinite(c.age) ? c.age : 0,
  };
}

export const SAVE_SLOT_LIMIT = 3;
export const AUTO_SAVE_SLOT: SlotId = 3;
