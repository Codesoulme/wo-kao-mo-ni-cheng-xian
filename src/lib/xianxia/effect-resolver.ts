import type {
  AttributeChange,
  CharacterState,
  EffectResolveResult,
  EffectResolveTrace,
} from './types';

export type AttributeBounds = Record<string, { min: number; max: number }>;

export interface ResolveAttributeChangesOptions {
  bounds: AttributeBounds;
  source?: string;
  applyCultivationMultiplier?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDelta(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

const ELEMENT_ATTR_TO_KEY: Record<string, 'metal' | 'wood' | 'water' | 'fire' | 'earth'> = {
  elementMetal: 'metal',
  elementWood: 'wood',
  elementWater: 'water',
  elementFire: 'fire',
  elementEarth: 'earth',
};

export function resolveAttributeChanges(
  state: CharacterState,
  changes: AttributeChange[],
  options: ResolveAttributeChangesOptions,
): EffectResolveResult {
  const next: CharacterState = { ...state };
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const trace: EffectResolveTrace[] = [];
  const source = options.source || 'effect-resolver';

  for (const raw of changes || []) {
    const attr = String(raw?.attribute || '').trim();
    const bounds = options.bounds[attr];
    if (!attr || !bounds) {
      const rejected = { ...raw, attribute: attr } as AttributeChange;
      rejectedChanges.push(rejected);
      trace.push({
        severity: 'warning',
        code: 'unknown_attribute',
        attribute: attr,
        message: `Rejected unknown attribute: ${attr || '(empty)'}`,
        source,
      });
      continue;
    }

    const elementKey = ELEMENT_ATTR_TO_KEY[attr];
    const before = elementKey
      ? Number(next.elements?.[elementKey] ?? 0)
      : Number((next as any)[attr] ?? 0);
    let delta = normalizeDelta(raw.delta);
    if (attr === 'cultivationExp' && options.applyCultivationMultiplier !== false && next.cultivationMultiplier > 0 && delta > 0) {
      const scaled = Math.round(delta * next.cultivationMultiplier);
      trace.push({
        severity: 'info',
        code: 'cultivation_multiplier_applied',
        attribute: attr,
        message: `Scaled cultivationExp delta by multiplier ${next.cultivationMultiplier}`,
        before,
        delta: scaled,
        source,
      });
      delta = scaled;
    }

    const unclamped = before + delta;
    const after = clamp(unclamped, bounds.min, bounds.max);
    if (after !== unclamped) {
      trace.push({
        severity: 'warning',
        code: 'value_clamped',
        attribute: attr,
        message: `Clamped ${attr} into ${bounds.min}-${bounds.max}`,
        before,
        delta,
        after,
        source,
      });
    }

    if (elementKey) {
      next.elements = { ...(next.elements || { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }), [elementKey]: after };
    } else {
      (next as any)[attr] = after;
    }
    const applied = { attribute: attr, delta, reason: raw.reason || source };
    appliedChanges.push(applied);
    trace.push({
      severity: 'info',
      code: 'attribute_applied',
      attribute: attr,
      message: raw.reason || `Applied ${attr} change`,
      before,
      delta,
      after,
      source,
    });

    if (attr === 'hp' && after <= 0) {
      next.hp = 0;
      next.alive = false;
      if (!next.causeOfDeath) next.causeOfDeath = '气血耗尽，陨落于此';
      trace.push({
        severity: 'warning',
        code: 'death_triggered_by_hp',
        attribute: attr,
        message: 'HP reached zero; character marked dead',
        before,
        delta,
        after: 0,
        source,
      });
    }
    if (attr === 'maxHp' && next.hp > next.maxHp) {
      const oldHp = next.hp;
      next.hp = next.maxHp;
      trace.push({ severity: 'info', code: 'hp_capped_by_maxHp', attribute: 'hp', message: 'HP capped by maxHp', before: oldHp, after: next.hp, source });
    }
    if (attr === 'maxMp' && next.mp > next.maxMp) {
      const oldMp = next.mp;
      next.mp = next.maxMp;
      trace.push({ severity: 'info', code: 'mp_capped_by_maxMp', attribute: 'mp', message: 'MP capped by maxMp', before: oldMp, after: next.mp, source });
    }
  }

  return { state: next, appliedChanges, rejectedChanges, trace };
}
