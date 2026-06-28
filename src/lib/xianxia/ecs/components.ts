// ECS Component 定义（PoC 阶段 — TechDoc 18.6.3）
// 每个 component 是 plain data object + marker 字段。
// Factory helpers 强制 __component / __type 字段存在。

import type { Component } from './core';

export interface MetaComponent extends Component {
  readonly __type: 'Meta';
  name: string;
  characterId: string;
  age: number;
  lifespan: number;
  alive: boolean;
}

export interface RealmComponent extends Component {
  readonly __type: 'Realm';
  realm: string;
  realmLevel: number;
  spiritualRoot: string;
  rootDetail: any;
}

export interface CultivationComponent extends Component {
  readonly __type: 'Cultivation';
  cultivationExp: number;
  expToBreak: number;
  cultivationSpeed: number;
  cultivationFactors: any;
}

export interface StatsComponent extends Component {
  readonly __type: 'Stats';
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  comprehension: number;
}

export interface InventoryComponent extends Component {
  readonly __type: 'Inventory';
  items: Array<{ id: string; item: any; equipped?: boolean }>;
  spiritStones: number;
  storageCapacity: number;
}

export interface StatusComponent extends Component {
  readonly __type: 'Status';
  activeStatuses: Array<{ id: string; type: string; effect: any; remainingDays?: number }>;
}

export interface NpcRelationComponent extends Component {
  readonly __type: 'NpcRelation';
  relations: Record<string, { affinity: number; type: 'ally' | 'enemy' | 'neutral' }>;
}

// Factory helpers
export function createMetaComponent(
  data: Omit<MetaComponent, '__component' | '__type'>,
): MetaComponent {
  return { __component: true, __type: 'Meta', ...data };
}

export function createRealmComponent(
  data: Omit<RealmComponent, '__component' | '__type'>,
): RealmComponent {
  return { __component: true, __type: 'Realm', ...data };
}

export function createCultivationComponent(
  data: Omit<CultivationComponent, '__component' | '__type'>,
): CultivationComponent {
  return { __component: true, __type: 'Cultivation', ...data };
}

export function createStatsComponent(
  data: Omit<StatsComponent, '__component' | '__type'>,
): StatsComponent {
  return { __component: true, __type: 'Stats', ...data };
}

export function createInventoryComponent(
  data: Omit<InventoryComponent, '__component' | '__type'>,
): InventoryComponent {
  return { __component: true, __type: 'Inventory', ...data };
}

export function createStatusComponent(
  data: Omit<StatusComponent, '__component' | '__type'>,
): StatusComponent {
  return { __component: true, __type: 'Status', ...data };
}

export function createNpcRelationComponent(
  data: Omit<NpcRelationComponent, '__component' | '__type'>,
): NpcRelationComponent {
  return { __component: true, __type: 'NpcRelation', ...data };
}
