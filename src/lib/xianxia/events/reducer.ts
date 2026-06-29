// Event Reducer：纯函数 reduce(initial, events) → final state。
// 不依赖 DB，不依赖全局状态，可在 worker / replay script / 测试里直接调用。
// 设计原则：
//   1. reduce 总是用 event.data.newValue / .to 等"终态"字段写入 state（绝对值语义，不依赖事件顺序）。
//   2. 未知 event type 不抛错——返回原 state（forward-compatible；后续加新 type 不破历史 replay）。
//   3. reducer 不写 DB——只读 events 数组，输出新 state 对象。

import type { CharacterStateSnapshot, Event, EventData } from './types';

// reduceCharacterState：顺序 apply 每个 event，返回最终 state。
// 入参 events 必须按 aggregateVersion 升序（由 store.getEvents 保证）。
export function reduceCharacterState(
  initial: CharacterStateSnapshot,
  events: Event[]
): CharacterStateSnapshot {
  let state: CharacterStateSnapshot = { ...initial };
  for (const event of events) {
    state = applyEvent(state, event);
  }
  return state;
}

// applyEvent：单事件 reducer。纯函数，返回新 state（不修改入参）。
// 注意 case 顺序与 EventType union 一一对应；未来加新 type 必须在这里加 case。
export function applyEvent(state: CharacterStateSnapshot, event: Event): CharacterStateSnapshot {
  const data: any = event.data;
  switch (event.type) {
    case 'character.created':
      // 初始创建事件：覆盖 name + realm（其他字段由 initial state 提供）
      return { ...state, name: data.name, realm: data.realm };

    case 'character.cultivation-exp.changed':
      return { ...state, cultivationExp: data.newValue };

    case 'character.realm.changed':
      return { ...state, realm: data.to };

    case 'character.age.advanced':
      return { ...state, age: data.to };

    case 'character.lifespan.changed':
      return { ...state, lifespan: data.newValue };

    case 'character.hp.changed':
      return { ...state, hp: data.newValue };

    case 'character.spirit-stones.changed':
      return { ...state, spiritStones: data.newValue };

    case 'character.alive.changed':
      return { ...state, alive: data.alive };

    case 'character.item.added':
      // 同 itemId 已存在则不重复添加（幂等）
      if (state.inventory.some((i) => i.id === data.itemId)) return state;
      return { ...state, inventory: [...state.inventory, { id: data.itemId, item: data.item }] };

    case 'character.item.removed':
      return { ...state, inventory: state.inventory.filter((i) => i.id !== data.itemId) };

    // ---- Sprint 2: 6 个 setter event type ----
    // 这 6 类事件由 _tryAppendEvent 在 store.ts 触发，用于记录"settlement / inheritance / ending"
    // 等全量 setter 的事件痕迹。完整 state 重建风险大（需重算 inheritance pool / candidate /
    // ending summary），所以 reducer 只回写 meta 字段，让 replay 不丢"setter 是否发生过 + 何时发生"
    // 的痕迹；真正的 setter 数据走 projector / 专门路径读取。
    case 'character.inheritance-pool.set':
    case 'character.inheritance-candidates.set':
    case 'character.inheritance-ending-summary.set':
      // 这 3 个不写 meta（避免 inheritance 计算中间产物污染 latestSettlementAt）。
      return state;

    case 'character.settlement-result.set':
      return {
        ...state,
        latestSettlementAt: event.timestamp,
        latestSettlementStatus: 'settlement',
      };

    case 'character.end-result.set':
      return {
        ...state,
        latestSettlementAt: event.timestamp,
        latestSettlementStatus: data.status,
      };

    case 'character.streaming-narrative.started':
      return { ...state, latestNarrativeAt: event.timestamp };

    default:
      // 未知 / 尚未实现的 event type——forward-compatible，原样返回。
      return state;
  }
}

// deriveCurrentRealmLevel：从 state 派生境界等级（PoC 占位；后续批接真实 realm table）。
// 当前实现：未知境界返回 0；后续会替换为查 realmPowerMultiplier 表。
export function deriveCurrentRealmLevel(state: CharacterStateSnapshot): number {
  // PoC 占位：返回 0。真实实现要查 realm → level mapping（不在本批范围）。
  void state;
  return 0;
}