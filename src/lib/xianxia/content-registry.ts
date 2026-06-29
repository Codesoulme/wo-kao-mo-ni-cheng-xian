import {
  ItemEntry,
  ItemType,
  PendingThread,
  SecretRealm,
  StatusCategory,
  StatusEffect,
  StatusEntry,
  WorldNpc,
} from './types';

export type RegisteredContentType = 'item' | 'status' | 'thread' | 'realm' | 'npc' | 'event';
export type ValidationSeverity = 'info' | 'warning' | 'error';
export type ValidationTraceCode =
  | 'missing_id'
  | 'duplicate_id'
  | 'missing_name'
  | 'missing_description'
  | 'invalid_type'
  | 'invalid_category'
  | 'invalid_rarity'
  | 'invalid_duration'
  | 'invalid_effect'
  | 'empty_effect_removed'
  | 'value_clamped'
  | 'field_normalized'
  | 'accepted'
  | 'infant_blocked_combat'
  | 'infant_blocked_choice';

export interface ValidationTrace {
  severity: ValidationSeverity;
  code: ValidationTraceCode;
  field?: string;
  attribute?: string;
  message: string;
  source?: string;
}

export interface RegisteredContent<T> {
  id: string;
  type: RegisteredContentType;
  content: T;
  trace: ValidationTrace[];
}

export interface RegistrationResult<T> {
  ok: boolean;
  content?: T;
  registered?: RegisteredContent<T>;
  trace: ValidationTrace[];
  warnings: string[];
  rejectedReason?: string;
}

export interface RegistryContext {
  source?: string;
  age?: number;
  existingIds?: Iterable<string>;
}

const ITEM_TYPES = new Set<ItemType>(['weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool', 'scripture']);
const STATUS_CATEGORIES = new Set<StatusCategory>(['attribute', 'skill', 'buff', 'debuff', 'special', 'identity', 'quest', 'environment']);
const THREAD_CATEGORIES = new Set<PendingThread['category']>(['competition', 'enemy', 'quest', 'promise', 'mystery', 'romance', 'debt', 'inheritance', 'exploration']);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
const EFFECT_OPERATIONS = new Set(['add', 'multiply', 'override', 'cap', 'floor', 'trigger']);

function warningsFrom(trace: ValidationTrace[]) {
  return trace.filter(t => t.severity === 'warning').map(t => t.message);
}

function reject<T>(trace: ValidationTrace[], reason: string): RegistrationResult<T> {
  trace.push({ severity: 'error', code: 'invalid_type', message: reason });
  return { ok: false, trace, warnings: warningsFrom(trace), rejectedReason: reason };
}

function accept<T>(type: RegisteredContentType, content: T & { id: string }, trace: ValidationTrace[]): RegistrationResult<T> {
  trace.push({ severity: 'info', code: 'accepted', message: `${type} registered` });
  return {
    ok: true,
    content,
    registered: { id: content.id, type, content, trace },
    trace,
    warnings: warningsFrom(trace),
  };
}

function asText(value: unknown, fallback = '', max = 240): string {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, max);
}

function safeNumber(value: unknown, fallback: number, min: number, max: number, trace: ValidationTrace[], field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    trace.push({ severity: 'warning', code: 'field_normalized', field, message: `${field} normalized to ${fallback}` });
    return fallback;
  }
  const clamped = Math.max(min, Math.min(max, n));
  if (clamped !== n) {
    trace.push({ severity: 'warning', code: 'value_clamped', field, message: `${field} clamped from ${n} to ${clamped}` });
  }
  return clamped;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureId(raw: any, prefix: string, existingIds: Set<string>, trace: ValidationTrace[]): string {
  let id = asText(raw?.id, '', 80).replace(/\s+/g, '_');
  if (!id) {
    id = makeId(prefix);
    trace.push({ severity: 'warning', code: 'missing_id', field: 'id', message: `missing id, generated ${id}` });
  }
  if (existingIds.has(id)) {
    const base = id;
    do {
      id = `${base}_${Math.random().toString(36).slice(2, 6)}`;
    } while (existingIds.has(id));
    trace.push({ severity: 'warning', code: 'duplicate_id', field: 'id', message: `duplicate id ${base}, renamed to ${id}` });
  }
  existingIds.add(id);
  return id;
}

function normalizeEffects(rawEffects: unknown, trace: ValidationTrace[]): StatusEffect[] {
  if (!Array.isArray(rawEffects)) return [];
  const out: StatusEffect[] = [];
  rawEffects.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      trace.push({ severity: 'warning', code: 'invalid_effect', field: `effects[${idx}]`, message: 'invalid effect removed' });
      return;
    }
    const target = asText((raw as any).target_attribute, '', 80);
    const operation = asText((raw as any).operation, '', 32) as StatusEffect['operation'];
    const value = Number((raw as any).value);
    if (!target || !EFFECT_OPERATIONS.has(operation) || !Number.isFinite(value) || value === 0) {
      trace.push({ severity: 'warning', code: 'empty_effect_removed', field: `effects[${idx}]`, message: 'empty or unsupported effect removed' });
      return;
    }
    out.push({
      target_attribute: target,
      operation,
      value,
      description: asText((raw as any).description, target, 120),
    });
  });
  return out;
}

function normalizeRarity(raw: unknown, trace: ValidationTrace[], fallback = 'common') {
  const rarity = asText(raw, fallback, 32);
  if (RARITIES.has(rarity)) return rarity as ItemEntry['rarity'];
  trace.push({ severity: 'warning', code: 'invalid_rarity', field: 'rarity', message: `invalid rarity ${rarity}, normalized to ${fallback}` });
  return fallback as ItemEntry['rarity'];
}

function isEdibleConsumable(raw: any, name: string, description: string, effects: StatusEffect[]): boolean {
  const text = `${name}${description}${asText(raw?.source, '', 80)}`;
  const hasFoodName = /\u997c|\u9ea6|\u996d|\u7ca5|\u9762|\u998d|\u7cd5|\u7cae|\u5e72\u7cae|\u7cd7|\u8089|\u70e4|\u679c|\u74dc|\u6843|\u68a8|\u9152|\u8336|\u6c64|\u6c34|\u871c|\u98df|\u5403|\u5145\u9965|\u88f9\u8179|\u53ef\u98df|\u4f59\u6e29/.test(text);
  const hasImmediateRecovery = effects.some(e => e.operation === 'add' && /^(hp|maxHp|mp|maxMp|heartDemon|cultivationExp)$/i.test(e.target_attribute));
  return hasFoodName && hasImmediateRecovery;
}

export function registerItem(raw: Partial<ItemEntry> | any, context: RegistryContext = {}): RegistrationResult<ItemEntry> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<ItemEntry>(trace, 'item is not an object');
  const existingIds = new Set(context.existingIds || []);
  const name = asText(raw.name, '', 40);
  if (!name) return reject<ItemEntry>(trace, 'item missing name');
  const rawType = asText(raw.item_type, 'material', 32) as ItemType;
  let itemType = ITEM_TYPES.has(rawType) ? rawType : 'material';
  if (itemType !== rawType) {
    trace.push({ severity: 'warning', code: 'invalid_type', field: 'item_type', message: `invalid item_type ${rawType}, normalized to material` });
  }
  const description = asText(raw.description, name, 300);
  const effects = normalizeEffects(raw.effects, trace);
  if ((itemType === 'material' || rawType === 'material') && isEdibleConsumable(raw, name, description, effects)) {
    itemType = 'consumable';
    trace.push({ severity: 'warning', code: 'field_normalized', field: 'item_type', message: 'edible recovery item normalized to consumable' });
  }
  const item: ItemEntry = {
    id: ensureId(raw, 'item', existingIds, trace),
    name,
    description,
    item_type: itemType,
    rarity: normalizeRarity(raw.rarity, trace),
    effects,
    source: asText(raw.source, context.source || 'content-registry', 80),
    equipNote: raw.equipNote ? asText(raw.equipNote, '', 80) : undefined,
  };
  return accept('item', item, trace);
}

export function registerStatus(raw: Partial<StatusEntry> | any, context: RegistryContext = {}): RegistrationResult<StatusEntry> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<StatusEntry>(trace, 'status is not an object');
  const existingIds = new Set(context.existingIds || []);
  const name = asText(raw.name, '', 40);
  if (!name) return reject<StatusEntry>(trace, 'status missing name');
  const rawCategory = asText(raw.category, 'special', 32) as StatusCategory;
  const category = STATUS_CATEGORIES.has(rawCategory) ? rawCategory : 'special';
  if (category !== rawCategory) {
    trace.push({ severity: 'warning', code: 'invalid_category', field: 'category', message: `invalid category ${rawCategory}, normalized to special` });
  }
  const status: StatusEntry = {
    id: ensureId(raw, 'status', existingIds, trace),
    name,
    description: asText(raw.description, name, 300),
    category,
    rarity: normalizeRarity(raw.rarity, trace),
    duration: Math.round(safeNumber(raw.duration, -1, -1, 9999, trace, 'duration')),
    source: asText(raw.source, context.source || 'content-registry', 80),
    effects: normalizeEffects(raw.effects, trace),
  };
  return accept('status', status, trace);
}

export function registerThread(raw: Partial<PendingThread> | any, context: RegistryContext = {}): RegistrationResult<PendingThread> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<PendingThread>(trace, 'thread is not an object');
  const existingIds = new Set(context.existingIds || []);
  const title = asText(raw.title, '', 40);
  if (!title) return reject<PendingThread>(trace, 'thread missing title');
  const rawCategory = asText(raw.category, 'quest', 32) as PendingThread['category'];
  const category = THREAD_CATEGORIES.has(rawCategory) ? rawCategory : 'quest';
  if (category !== rawCategory) {
    trace.push({ severity: 'warning', code: 'invalid_category', field: 'category', message: `invalid thread category ${rawCategory}, normalized to quest` });
  }
  const startAge = Math.round(safeNumber(raw.startAge, context.age ?? 0, 0, 99999, trace, 'startAge'));
  const rawDeadlineAge = Math.max(startAge, Math.round(safeNumber(raw.deadlineAge, startAge + 3, 0, 99999, trace, 'deadlineAge')));
  const rawStatus = asText(raw.status, 'pending', 20) as PendingThread['status'];
  const status: PendingThread['status'] = ['pending', 'urgent', 'resolved', 'failed'].includes(rawStatus) ? rawStatus : 'pending';
  const description = asText(raw.description, title, 400);
  const followUpHint = raw.followUpHint ? asText(raw.followUpHint, '', 180) : undefined;
  const localTimeText = `${title}${description}${followUpHint || ''}`;
  const sameYear = Boolean(raw.dueInSameYear) || /今年|本年|当年|不久|三月|数月|半年|入夜|当夜|夜里|黄昏|清晨|翌日|转日|临走前|临行|临别|走前|离开前/.test(localTimeText);
  const deadlineAge = sameYear ? startAge : rawDeadlineAge;
  const thread: PendingThread = {
    id: ensureId(raw, 'thread', existingIds, trace),
    title,
    description,
    category,
    startAge,
    deadlineAge,
    status,
    progress: Math.round(safeNumber(raw.progress, 0, 0, 100, trace, 'progress')),
    relatedMemoryIds: Array.isArray(raw.relatedMemoryIds) ? raw.relatedMemoryIds.map((x: unknown) => asText(x, '', 80)).filter(Boolean) : undefined,
    reward: raw.reward ? asText(raw.reward, '', 120) : undefined,
    failureCost: raw.failureCost ? asText(raw.failureCost, '', 120) : undefined,
    dueInSameYear: sameYear,
    followUpHint,
    sourceEventTitle: raw.sourceEventTitle ? asText(raw.sourceEventTitle, '', 80) : context.source,
    realmId: raw.realmId ? asText(raw.realmId, '', 80) : undefined,
  };
  return accept('thread', thread, trace);
}

export function registerRealm(raw: Partial<SecretRealm> | any, context: RegistryContext = {}): RegistrationResult<SecretRealm> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<SecretRealm>(trace, 'realm is not an object');
  const existingIds = new Set(context.existingIds || []);
  const name = asText(raw.name, '', 40);
  if (!name) return reject<SecretRealm>(trace, 'realm missing name');
  const realm: SecretRealm = {
    id: ensureId(raw, 'realm', existingIds, trace),
    name,
    description: asText(raw.description, name, 400),
    tier: RARITIES.has(asText(raw.tier, 'common', 32)) ? asText(raw.tier, 'common', 32) as SecretRealm['tier'] : 'common',
    minRealm: Math.round(safeNumber(raw.minRealm, 1, 0, 8, trace, 'minRealm')),
    minAge: Math.round(safeNumber(raw.minAge, context.age ?? 0, 0, 99999, trace, 'minAge')),
    spiritStoneCost: Math.round(safeNumber(raw.spiritStoneCost, 0, 0, 999999, trace, 'spiritStoneCost')),
    discoveredByThreadId: raw.discoveredByThreadId ? asText(raw.discoveredByThreadId, '', 80) : undefined,
    entryRequirement: raw.entryRequirement ? asText(raw.entryRequirement, '', 120) : undefined,
    entryAlternatives: Array.isArray(raw.entryAlternatives) ? raw.entryAlternatives.map((x: unknown) => asText(x, '', 80)).filter(Boolean) : undefined,
    isStoryRealm: Boolean(raw.isStoryRealm),
    dangerLevel: Math.round(safeNumber(raw.dangerLevel, 3, 1, 10, trace, 'dangerLevel')),
    rewardMultiplier: safeNumber(raw.rewardMultiplier, 1, 0.1, 10, trace, 'rewardMultiplier'),
    cooldownYears: Math.round(safeNumber(raw.cooldownYears, 3, 0, 999, trace, 'cooldownYears')),
    themeTags: Array.isArray(raw.themeTags) ? raw.themeTags.map((x: unknown) => asText(x, '', 40)).filter(Boolean) : [],
    elementAffinity: ['metal', 'wood', 'water', 'fire', 'earth'].includes(raw.elementAffinity) ? raw.elementAffinity : undefined,
    encounterHints: Array.isArray(raw.encounterHints) ? raw.encounterHints.map((x: unknown) => asText(x, '', 120)).filter(Boolean) : [],
    color: /^#[0-9a-fA-F]{6}$/.test(String(raw.color || '')) ? raw.color : '#8b5cf6',
    icon: asText(raw.icon, '✦', 8),
  };
  return accept('realm', realm, trace);
}

export interface RegistryEventLite {
  id: string;
  title: string;
  narrative: string;
  eventType?: string;
  source?: string;
  age?: number;
}

export function registerNpc(raw: Partial<WorldNpc> | any, context: RegistryContext = {}): RegistrationResult<WorldNpc> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<WorldNpc>(trace, 'npc is not an object');
  const existingIds = new Set(context.existingIds || []);
  const name = asText(raw.name, '', 40);
  if (!name) return reject<WorldNpc>(trace, 'npc missing name');
  const rawAttitude = asText(raw.attitude, 'unknown', 32);
  const attitude = ['ally', 'friendly', 'neutral', 'hostile', 'enemy', 'unknown'].includes(rawAttitude) ? rawAttitude as WorldNpc['attitude'] : 'unknown';
  if (attitude !== rawAttitude) {
    trace.push({ severity: 'warning', code: 'field_normalized', field: 'attitude', message: `invalid npc attitude ${rawAttitude}, normalized to unknown` });
  }
  const age = context.age ?? 0;
  const npc: WorldNpc = {
    id: ensureId(raw, 'npc', existingIds, trace),
    name,
    description: asText(raw.description, name, 400),
    role: raw.role ? asText(raw.role, '', 40) : undefined,
    realm: raw.realm ? asText(raw.realm, '', 40) : undefined,
    faction: raw.faction ? asText(raw.faction, '', 60) : undefined,
    attitude,
    relationshipScore: Math.round(safeNumber(raw.relationshipScore, 0, -100, 100, trace, 'relationshipScore')),
    firstMetAge: Math.round(safeNumber(raw.firstMetAge, age, 0, 99999, trace, 'firstMetAge')),
    lastSeenAge: Math.round(safeNumber(raw.lastSeenAge, age, 0, 99999, trace, 'lastSeenAge')),
    lastKnownLocation: raw.lastKnownLocation ? asText(raw.lastKnownLocation, '', 80) : undefined,
    source: asText(raw.source, context.source || 'content-registry', 80),
    memory: raw.memory ? asText(raw.memory, '', 300) : undefined,
    relatedThreadIds: Array.isArray(raw.relatedThreadIds) ? raw.relatedThreadIds.map((x: unknown) => asText(x, '', 80)).filter(Boolean) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((x: unknown) => asText(x, '', 40)).filter(Boolean).slice(0, 8) : undefined,
  };
  return accept('npc', npc, trace);
}

export function registerEvent(raw: Partial<RegistryEventLite> | any, context: RegistryContext = {}): RegistrationResult<RegistryEventLite> {
  const trace: ValidationTrace[] = [];
  if (!raw || typeof raw !== 'object') return reject<RegistryEventLite>(trace, 'event is not an object');
  const existingIds = new Set(context.existingIds || []);
  const title = asText(raw.title, '', 60);
  if (!title) return reject<RegistryEventLite>(trace, 'event missing title');
  const event: RegistryEventLite = {
    id: ensureId(raw, 'event', existingIds, trace),
    title,
    narrative: asText(raw.narrative, title, 1200),
    eventType: raw.eventType ? asText(raw.eventType, '', 40) : undefined,
    source: asText(raw.source, context.source || 'content-registry', 80),
    age: Math.round(safeNumber(raw.age, context.age ?? 0, 0, 99999, trace, 'age')),
  };
  return accept('event', event, trace);
}
export function registerMany<T>(items: any[], register: (raw: any, context: RegistryContext) => RegistrationResult<T>, context: RegistryContext = {}) {
  const existingIds = new Set(context.existingIds || []);
  const accepted: T[] = [];
  const rejected: RegistrationResult<T>[] = [];
  const trace: ValidationTrace[] = [];
  const warnings: string[] = [];
  for (const raw of items || []) {
    const result = register(raw, { ...context, existingIds });
    trace.push(...result.trace);
    warnings.push(...result.warnings);
    if (result.ok && result.content) {
      accepted.push(result.content);
      const id = (result.content as any).id;
      if (id) existingIds.add(id);
    } else {
      rejected.push(result);
    }
  }
  return { accepted, rejected, trace, warnings };
}


