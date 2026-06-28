// Character ↔ ECS Entity 适配层（PoC 阶段 — TechDoc 18.6.3）
// 把现有 CharacterStateSnapshot 拆成多个 Component；反之把 Entity 还原为 snapshot。
// 不替换现有 Character 实现，PoC 阶段新 class 与现有并存。

import { Entity, World } from './core';
import {
  createCultivationComponent,
  createInventoryComponent,
  createMetaComponent,
  createRealmComponent,
  createStatsComponent,
  createStatusComponent,
} from './components';
import type {
  CultivationComponent,
  InventoryComponent,
  MetaComponent,
  RealmComponent,
  StatsComponent,
} from './components';
import type { CharacterStateSnapshot } from '../events/types';

const CHARACTER_ENTITY_PREFIX = 'character-';

/** 把 CharacterStateSnapshot 拆成多个 Component 挂到 ECS Entity 上 */
export function createCharacterEntity(world: World, snapshot: CharacterStateSnapshot): Entity {
  const entity = world.createEntity(`${CHARACTER_ENTITY_PREFIX}${snapshot.characterId}`);

  entity.addComponent(
    createMetaComponent({
      name: snapshot.name,
      characterId: snapshot.characterId,
      age: snapshot.age,
      lifespan: snapshot.lifespan,
      alive: snapshot.alive,
    }),
  );

  entity.addComponent(
    createRealmComponent({
      realm: snapshot.realm,
      realmLevel: 0, // PoC 占位
      spiritualRoot: '', // PoC 占位
      rootDetail: null,
    }),
  );

  entity.addComponent(
    createCultivationComponent({
      cultivationExp: snapshot.cultivationExp,
      expToBreak: 0, // PoC 占位
      cultivationSpeed: 1.0,
      cultivationFactors: null,
    }),
  );

  entity.addComponent(
    createStatsComponent({
      hp: snapshot.hp,
      maxHp: snapshot.maxHp,
      mp: 100, // PoC 占位
      maxMp: 100,
      attack: 10, // PoC 占位
      defense: 5,
      speed: 5,
      luck: 0,
      comprehension: 0,
    }),
  );

  entity.addComponent(
    createInventoryComponent({
      // CharacterStateSnapshot.inventory 是 Array<{ id, item }>；
      // InventoryComponent.items 多了 equipped 字段。PoC 阶段 equipped 全部 undefined。
      items: snapshot.inventory.map((entry) => ({ id: entry.id, item: entry.item })),
      spiritStones: snapshot.spiritStones,
      storageCapacity: 100,
    }),
  );

  entity.addComponent(
    createStatusComponent({
      activeStatuses: [],
    }),
  );

  return entity;
}

/** 从 ECS Entity 还原 CharacterStateSnapshot */
export function entityToSnapshot(entity: Entity): CharacterStateSnapshot {
  const meta = entity.getComponent<MetaComponent>('Meta');
  const realm = entity.getComponent<RealmComponent>('Realm');
  const cultivation = entity.getComponent<CultivationComponent>('Cultivation');
  const stats = entity.getComponent<StatsComponent>('Stats');
  const inventory = entity.getComponent<InventoryComponent>('Inventory');

  if (!meta || !realm || !cultivation || !stats || !inventory) {
    throw new Error('Entity missing required components for snapshot');
  }

  return {
    characterId: meta.characterId,
    name: meta.name,
    age: meta.age,
    realm: realm.realm,
    cultivationExp: cultivation.cultivationExp,
    hp: stats.hp,
    maxHp: stats.maxHp,
    spiritStones: inventory.spiritStones,
    alive: meta.alive,
    lifespan: meta.lifespan,
    inventory: inventory.items.map((entry) => ({ id: entry.id, item: entry.item })),
  };
}
