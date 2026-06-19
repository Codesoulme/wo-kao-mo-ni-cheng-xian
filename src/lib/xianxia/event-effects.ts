import type { AttributeChange, CharacterState, ItemEntry, Pet, StatusEntry } from './types';

export type EventDisplayEffect = AttributeChange | {
  kind: 'item' | 'equipment' | 'status' | 'pet' | 'loss' | 'root';
  label: string;
  name: string;
  tone?: 'positive' | 'negative' | 'neutral';
};

function byId<T extends { id?: string }>(items: T[] | undefined): Set<string> {
  return new Set((items || []).map(it => it.id).filter(Boolean) as string[]);
}

function cleanName(value: unknown): string {
  return String(value || '').trim().slice(0, 24);
}

function pushUnique(out: EventDisplayEffect[], seen: Set<string>, effect: EventDisplayEffect) {
  const key = 'attribute' in effect
    ? `attr:${effect.attribute}:${effect.delta}`
    : `${effect.kind}:${effect.label}:${effect.name}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(effect);
}

function collectAdded<T extends { id?: string; name?: string }>(before: T[] | undefined, after: T[] | undefined): T[] {
  const oldIds = byId(before);
  return (after || []).filter(it => it.id && !oldIds.has(it.id) && cleanName(it.name));
}

export function buildEventDisplayEffects(args: {
  before: CharacterState;
  after: CharacterState;
  changes?: AttributeChange[];
  newStatuses?: StatusEntry[];
  newItems?: ItemEntry[];
  newEquippedItems?: ItemEntry[];
  newPets?: Pet[];
  removedItemIds?: string[];
}): EventDisplayEffect[] {
  const out: EventDisplayEffect[] = [];
  const seen = new Set<string>();

  for (const change of args.changes || []) {
    const delta = Number(change.delta || 0);
    if (!change.attribute || delta === 0) continue;
    pushUnique(out, seen, { ...change, delta });
  }

  const addedInventory = collectAdded(args.before.inventory, args.after.inventory);
  const addedEquipped = collectAdded(args.before.equipped || [], args.after.equipped || []);
  const addedStatuses = collectAdded(args.before.activeStatuses, args.after.activeStatuses);
  const addedPets = collectAdded(args.before.pets || [], args.after.pets || []);

  if (args.before.spiritualRoot !== args.after.spiritualRoot || args.before.rootDetail !== args.after.rootDetail) {
    pushUnique(out, seen, {
      kind: 'root',
      label: '灵根蜕变',
      name: cleanName(args.after.rootDetail || args.after.spiritualRoot),
      tone: (args.after.rootMultiplier || 0) >= (args.before.rootMultiplier || 0) ? 'positive' : 'negative',
    });
  }

  for (const item of addedInventory) {
    pushUnique(out, seen, {
      kind: 'item',
      label: '获得',
      name: cleanName(item.name),
      tone: 'positive',
    });
  }

  for (const item of addedEquipped) {
    pushUnique(out, seen, {
      kind: 'equipment',
      label: '装备',
      name: cleanName(item.name),
      tone: 'positive',
    });
  }

  for (const status of addedStatuses) {
    pushUnique(out, seen, {
      kind: 'status',
      label: '获得状态',
      name: cleanName(status.name),
      tone: status.category === 'debuff' ? 'negative' : 'positive',
    });
  }

  for (const pet of addedPets) {
    pushUnique(out, seen, {
      kind: 'pet',
      label: '收服灵宠',
      name: cleanName(pet.name),
      tone: 'positive',
    });
  }

  const removed = new Set(args.removedItemIds || []);
  if (removed.size > 0) {
    const beforeItems = [...(args.before.inventory || []), ...(args.before.equipped || [])];
    for (const item of beforeItems) {
      if (!item.id || !removed.has(item.id)) continue;
      pushUnique(out, seen, {
        kind: 'loss',
        label: '失去',
        name: cleanName(item.name),
        tone: 'negative',
      });
    }
  }

  return out;
}
