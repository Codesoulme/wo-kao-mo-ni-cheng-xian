// Event Sourcing 强类型定义（PoC 阶段先 10 个核心 event 类型；后续批扩展）
// 所有 state change 走这里——reducer 用这些 type 计算派生 state。
//
// 与 projector.ts 兼容：CharacterEvent 是 Event 的别名（让 X2 的 type-only import 不破）。

// Event 类型 union（与 prisma Event.type 字符串一一对应）
export type EventType =
  | 'character.created'
  | 'character.cultivation-exp.changed'
  | 'character.realm.changed'
  | 'character.age.advanced'
  | 'character.lifespan.changed'
  | 'character.hp.changed'
  | 'character.spirit-stones.changed'
  | 'character.alive.changed'
  | 'character.item.added'
  | 'character.item.removed'
  // 批 15: store.ts 关键 setter 事件化（PoC 双写，仅用于调试可追溯，不做事务）
  | 'character.inheritance-pool.set'
  | 'character.inheritance-candidates.set'
  | 'character.inheritance-ending-summary.set'
  | 'character.end-result.set'
  | 'character.settlement-result.set'
  | 'character.streaming-narrative.started'
  // Phase-α 批 1 α-1: 沉浸版 PoC——雷劫判定事件
  | 'character.tribulation.attempted';

// EventData 是 discriminated union——`type` 字段做判别式。
// 命名规则：所有 event data 字段都用 `newValue`/`to` 表示"终态"，`delta`/`from` 表示"变化量"。
// reducer 总是用 `newValue`/`to` 写入 state（绝对值，不依赖 reducer 顺序）。
export type EventData =
  | { type: 'character.created'; name: string; realm: string; spiritualRoot: string }
  | { type: 'character.cultivation-exp.changed'; delta: number; newValue: number; reason?: string }
  | { type: 'character.realm.changed'; from: string; to: string; method: 'breakthrough' | 'demotion' | 'set' }
  | { type: 'character.age.advanced'; from: number; to: number }
  | { type: 'character.lifespan.changed'; delta: number; newValue: number }
  | { type: 'character.hp.changed'; delta: number; newValue: number; reason?: string }
  | { type: 'character.spirit-stones.changed'; delta: number; newValue: number; reason?: string }
  | { type: 'character.alive.changed'; alive: boolean; cause?: string }
  | { type: 'character.item.added'; itemId: string; item: any }
  | { type: 'character.item.removed'; itemId: string; reason?: string }
  // 批 15: store.ts 关键 setter 事件 payload
  | { type: 'character.inheritance-pool.set'; pool: any[] }
  | { type: 'character.inheritance-candidates.set'; candidates: any[] }
  | { type: 'character.inheritance-ending-summary.set'; summary: string | null }
  | { type: 'character.end-result.set'; status: string; narrative: string }
  | { type: 'character.settlement-result.set'; settlement: any }
  | { type: 'character.streaming-narrative.started'; eventIndex: number; placeholderId: string }
  // Phase-α 批 1 α-1: 沉浸版 PoC——雷劫判定事件 payload
  | { type: 'character.tribulation.attempted'; fromRealm: string; toRealm: string; outcome: 'success' | 'fall_realm' | 'severe' | 'fatal'; kind: string; difficulty: number; hpDelta: number; cause: string; karmaShift?: KarmaShiftPayload };

// ==================== Phase-α 批 1 α-2: 因果业力事件 payload ====================

export type KarmaShiftPayload = {
  meritDelta: number;
  sinDelta: number;
  karmaDelta: number;
  reason: string;
};

// 来源标签（决定 audit + reducer 信任级别）
export type EventSource = 'user-action' | 'ai-output' | 'system-tick' | 'migration';

// 触发主体（player/agent/system）
export type TriggerActor = 'player' | 'agent' | 'system';

// 数据库层 Event 行（来自 Prisma Event model，字段对齐 schema.prisma）
export interface Event {
  id: string;
  characterId: string;
  type: EventType;
  data: EventData;
  previousEventId: string | null;
  aggregateVersion: number;
  timestamp: number;        // ms since epoch
  createdAtAge: number | null;
  source: EventSource;
  aiPromptHash: string | null;
  triggerActor: TriggerActor;
}

// CharacterEvent 是 Event 的别名——projector.ts 用此名（X2 定义）做 type-only import。
// 保留别名让 Event Sourcing 主表与 projector 共享同一类型，无需重复定义。
export type CharacterEvent = Event;

// 初始 state（reduce 起点）。PoC 只覆盖核心字段；后续批扩展。
// 注意：这里与 src/lib/xianxia/store.ts 的 CharacterState 有重叠但更精简——
// Event Sourcing 视角下只关心"事件能影响"的字段，不关心 derived/UI 字段。
export interface CharacterStateSnapshot {
  characterId: string;
  name: string;
  age: number;
  realm: string;
  cultivationExp: number;
  hp: number;
  maxHp: number;
  spiritStones: number;
  alive: boolean;
  lifespan: number;
  inventory: Array<{ id: string; item: any }>;
  // Sprint 2: setter event meta trace（optional，向后兼容；dbToState / entityToSnapshot 不感知）。
  // reducer 写入 set 事件时同步 timestamp + type，让 replay 不丢"setter 是否发生过"的痕迹。
  latestSettlementAt?: number;   // 最后一次 settlement/end-result set 事件的时间戳（ms）
  latestSettlementStatus?: string; // settlement / end-result 的 status 字符串（ending、alive、dead 等）
  latestNarrativeAt?: number;     // 最后一次 streaming-narrative.started 的时间戳
}