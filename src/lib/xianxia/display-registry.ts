import type { CharacterState } from './store';
import { filterMeaningfulStatuses } from './engine';

export type DisplaySlot = 'topTags' | 'characterDetail' | 'statusPage' | 'threadPage' | 'combatPanel' | 'inventoryPanel' | 'worldLegacy';
export type DisplayTone = 'neutral' | 'good' | 'bad' | 'rare' | 'danger' | 'mystery';
export type RenderHint = 'badge' | 'card' | 'meter' | 'timeline' | 'action' | 'detail';

export interface DisplayEntry {
  id: string;
  kind: string;
  category: string;
  displayGroup: string;
  displayLabel: string;
  shortLabel?: string;
  description?: string;
  detail?: string;
  tone: DisplayTone;
  priority: number;
  displaySlots: DisplaySlot[];
  renderHint: RenderHint;
  source?: string;
  sourceEventId?: string;
  persistence?: 'instant' | 'temporary' | 'longTerm' | 'permanent';
  raw?: any;
}

const SLOT_SET = new Set<DisplaySlot>(['topTags', 'characterDetail', 'statusPage', 'threadPage', 'combatPanel', 'inventoryPanel', 'worldLegacy']);

function text(value: any, fallback = '') {
  const v = String(value ?? '').trim();
  return v || fallback;
}

function hasAny(textValue: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(textValue));
}

function toneFromStatus(status: any): DisplayTone {
  const explicit = text(status?.tone || status?.displayTone || status?.rarity || status?.severity).toLowerCase();
  if (['rare', 'legendary', 'epic', 'constitution'].includes(explicit)) return 'rare';
  if (['danger', 'urgent', 'critical', 'curse'].includes(explicit)) return 'danger';
  if (['bad', 'debuff', 'injury', 'negative'].includes(explicit)) return 'bad';
  if (['good', 'buff', 'positive', 'blessing'].includes(explicit)) return 'good';
  if (['mystery', 'fate', 'omen'].includes(explicit)) return 'mystery';
  const merged = `${text(status?.category || status?.type || status?.kind)} ${text(status?.name)} ${text(status?.description)}`;
  if (hasAny(merged, [/constitution|physique|\u4f53\u8d28|\u5251\u9aa8|\u9053\u80ce|\u8840\u8109/])) return 'rare';
  if (hasAny(merged, [/injury|curse|wound|debuff|poison|\u4f24|\u5492|\u6bd2|\u5fc3\u9b54/])) return 'bad';
  if (hasAny(merged, [/fate|omen|thread|\u4ed9\u7f18|\u56e0\u7f18|\u5f02\u8c61|\u4f20\u627f/])) return 'mystery';
  return 'neutral';
}

function groupFromStatus(status: any) {
  const explicit = text(status?.displayGroup || status?.group || status?.categoryLabel);
  if (explicit) return explicit.slice(0, 12);
  const merged = `${text(status?.category || status?.type || status?.kind)} ${text(status?.name || status?.label)} ${text(status?.description)}`;
  if (hasAny(merged, [/identity|\u8eab\u4efd|\u5b97\u95e8|\u804c\u4f4d/])) return '\u8eab\u4efd';
  if (hasAny(merged, [/constitution|physique|\u4f53\u8d28|\u5251\u9aa8|\u9053\u80ce|\u8840\u8109/])) return '\u4f53\u8d28';
  if (hasAny(merged, [/attribute|\u5929\u8d4b|\u7075\u6839|\u609f\u6027|\u6c14\u8fd0|\u5c5e\u6027/])) return '\u5929\u8d4b';
  if (hasAny(merged, [/fate|omen|thread|\u4ed9\u7f18|\u56e0\u7f18|\u5f02\u8c61|\u4f20\u627f|\u5370\u8bb0/])) return '\u4ed9\u7f18';
  if (hasAny(merged, [/injury|curse|wound|debuff|poison|\u4f24|\u5492|\u6bd2|\u5fc3\u9b54/])) return '\u51cf\u76ca';
  if (hasAny(merged, [/buff|blessing|\u589e\u76ca|\u795d\u798f|\u52a0\u6301/])) return '\u589e\u76ca';
  return '\u5f02\u8c61';
}

const CORE_DERIVED_ATTRIBUTE_IDS = new Set(['spiritualSense', 'soulStrength', 'physicalFoundation']);

function isCoreDerivedAttribute(attr: any) {
  const id = text(attr?.id || attr?.key || attr?.target_attribute || attr?.targetAttribute);
  const label = text(attr?.displayLabel || attr?.name || attr?.label);
  return CORE_DERIVED_ATTRIBUTE_IDS.has(id) || label === '\u795e\u8bc6' || label === '\u9b42\u9b44' || label === '\u4f53\u9b44';
}

function slotsFromStatus(status: any, group: string): DisplaySlot[] {
  const raw = Array.isArray(status?.displaySlots) ? status.displaySlots : [];
  const slots = raw.filter((slot: any): slot is DisplaySlot => SLOT_SET.has(slot));
  if (slots.length) return slots;
  if (group === '\u4f53\u8d28' || group === '\u5929\u8d4b') return ['topTags', 'characterDetail', 'statusPage'];
  if (group === '\u8eab\u4efd') return ['topTags', 'characterDetail', 'statusPage'];
  if (group === '\u51cf\u76ca') return ['topTags', 'statusPage'];
  if (group === '\u4ed9\u7f18' || group === '\u5f02\u8c61') return ['topTags', 'statusPage', 'threadPage'];
  return ['statusPage'];
}

export function statusToDisplayEntry(status: any, index = 0): DisplayEntry | null {
  const label = text(status?.displayLabel || status?.label || status?.name || status?.title);
  if (!label) return null;
  const group = groupFromStatus(status);
  const tone = toneFromStatus(status);
  const priority = Number.isFinite(Number(status?.priority ?? status?.displayPriority))
    ? Number(status?.priority ?? status?.displayPriority)
    : (group === '\u4f53\u8d28' ? 92 : group === '\u8eab\u4efd' ? 80 : group === '\u51cf\u76ca' ? 76 : group === '\u4ed9\u7f18' ? 72 : 45) - index * 0.01;
  return {
    id: text(status?.id, `status-${index}-${label}`),
    kind: 'status',
    category: text(status?.category || status?.type || status?.kind, group),
    displayGroup: group,
    displayLabel: label.slice(0, 18),
    shortLabel: text(status?.shortLabel || status?.shortName, label).slice(0, 8),
    description: text(status?.visibleDescription || status?.description || status?.summary),
    detail: text(status?.detail || status?.effectDescription || status?.description),
    tone,
    priority,
    displaySlots: slotsFromStatus(status, group),
    renderHint: status?.renderHint || 'badge',
    source: text(status?.source || status?.sourceText),
    sourceEventId: text(status?.sourceEventId),
    persistence: status?.persistence || (status?.duration ? 'temporary' : 'longTerm'),
    raw: status,
  };
}

export function attributeToDisplayEntry(attr: any, index = 0): DisplayEntry | null {
  const label = text(attr?.displayLabel || attr?.name || attr?.label);
  if (!label) return null;
  const group = text(attr?.displayGroup || attr?.categoryLabel || attr?.category, /\u4f53\u8d28|\u5251\u9aa8|\u9053\u80ce|\u8840\u8109/.test(label) ? '\u4f53\u8d28' : '\u5929\u8d4b').slice(0, 12);
  const defaultSlots: DisplaySlot[] = isCoreDerivedAttribute(attr) ? ['topTags', 'characterDetail'] : ['topTags', 'characterDetail', 'statusPage'];
  return {
    id: text(attr?.id, `attribute-${index}-${label}`),
    kind: 'attribute',
    category: text(attr?.category || attr?.type, group),
    displayGroup: group,
    displayLabel: label.slice(0, 18),
    shortLabel: text(attr?.shortLabel || attr?.shortName, label).slice(0, 8),
    description: text(attr?.description || attr?.summary || attr?.effect),
    detail: text(attr?.detail || attr?.description || attr?.effect),
    tone: /\u4f53\u8d28|\u5251\u9aa8|\u9053\u80ce|\u8840\u8109/.test(group + label) ? 'rare' : 'mystery',
    priority: Number.isFinite(Number(attr?.priority ?? attr?.displayPriority)) ? Number(attr?.priority ?? attr?.displayPriority) : 88 - index * 0.01,
    displaySlots: Array.isArray(attr?.displaySlots) ? attr.displaySlots.filter((slot: any): slot is DisplaySlot => SLOT_SET.has(slot)) : defaultSlots,
    renderHint: attr?.renderHint || 'card',
    source: text(attr?.source || attr?.sourceText),
    sourceEventId: text(attr?.sourceEventId),
    persistence: attr?.persistence || 'longTerm',
    raw: attr,
  };
}

export function characterDisplayEntries(character?: Partial<CharacterState> | null): DisplayEntry[] {
  if (!character) return [];
  const statuses = filterMeaningfulStatuses((character as any).activeStatuses || [])
    .map(statusToDisplayEntry)
    .filter(Boolean) as DisplayEntry[];
  const attrs = ((character as any).cultivationAttributes || [])
    .filter((attr: any) => attr && attr.visible !== false)
    .map(attributeToDisplayEntry)
    .filter(Boolean) as DisplayEntry[];
  const byId = new Map<string, DisplayEntry>();
  for (const entry of [...attrs, ...statuses]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((a, b) => b.priority - a.priority);
}

export function entriesForSlot(entries: DisplayEntry[], slot: DisplaySlot, limit?: number) {
  const filtered = entries.filter((entry) => entry.displaySlots.includes(slot)).sort((a, b) => b.priority - a.priority);
  return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
}

export function groupDisplayEntries(entries: DisplayEntry[]) {
  const groups = new Map<string, DisplayEntry[]>();
  for (const entry of entries) {
    const key = entry.displayGroup || '\u5f02\u8c61';
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items: items.sort((a, b) => b.priority - a.priority) }));
}
