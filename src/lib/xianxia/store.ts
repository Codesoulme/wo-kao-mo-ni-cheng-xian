'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CharacterState {
  id: string;
  name: string;
  gender: string;
  age: number;
  lifespan: number;
  spiritualRoot: string;
  rootDetail: string;
  rootMultiplier: number;
  realm: string;
  realmName: string;
  realmColor: string;
  realmLevel: number;
  realmMaxLevel: number;
  realmProfile?: any;
  cultivationExp: number;
  expToBreak: number;
  elements: { metal: number; wood: number; water: number; fire: number; earth: number };
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  attack: number; defense: number; speed: number;
  luck: number; comprehension: number;
  spiritStones: number; reputation: number;
  alive: boolean; ascended: boolean;
  causeOfDeath: string;
  faction: string; master: string; location: string;
  fateNodes: number[];
  isAtChoice: boolean;
  activeStatuses: any[];
  inventory: any[];
  // 已装备物品数组（无槽位上限，AI 可创造性放置）
  equipped: any[];
  // 储物袋容量上限（无袋 5；获得储物袋后增加）
  storageCapacity: number;
  cultivationMultiplier: number;
  // 每岁固定修为加成之和（来自 equipped + activeStatuses 的 add cultivationExp 效果，如聚灵佩 +5）
  cultivationFlatBonus?: number;
  cultivationInsight?: string;
  // 修炼速度来源条目（引擎权威计算：灵根 + 已装备功法 + 状态词条；前端按 rarity 给来源名称上色 + 具体数字）
  cultivationFactors?: { name: string; value: number; operation: 'multiply' | 'add'; rarity?: string; note?: string }[];
  // ===== Task 20 新增（前端方便访问，也放在 character 上；advance/choose/interfere 返回的 state 已包含这些字段） =====
  // 未决线索（重要剧情线索，会在后续推进/到期触发）
  pendingThreads?: any[];
  // 角色主动意图（引擎根据处境生成，AI 必须在事件中体现）
  characterIntents?: any[];
  // 进行中的战斗（若有；combatSession.status='ongoing' 时 CombatModal 全屏显示）
  combatSession?: any | null;
  // ===== Task 22 新增 =====
  // 心魔值 0-100
  heartDemon?: number;
  // ===== Task 23 新增 =====
  // 灵宠列表
  pets?: any[];
  // ===== Task 24 新增 =====
  // 已探秘境记录（ExplorationRecord[]）—— 用于秘境面板显示冷却状态
  exploredRealms?: any[];
}

export interface GameEvent {
  id: string;
  age: number;
  title: string;
  narrative: string;
  eventType: string;
  effects: any[];
  isFateNode?: boolean;
  fateNodeName?: string;
  createdAt: string;
  // Task 20: 事件蓝图（advance route 返回；用于 EventTimeline 显示主题 chip）
  blueprint?: { category: string; name: string };
}

export interface ChoiceRecord {
  id: string;
  age: number;
  prompt: string;
  options: { text: string; hint?: string }[];
  chosenIndex: number;
  chosenText: string;
  result: string;
  createdAt?: string;
}

export interface PendingChoice {
  prompt: string;
  options: { text: string; hint?: string }[];
  /** 命节点触发时的前情提要：刚生成的命节点事件标题与叙事 */
  contextTitle?: string;
  contextNarrative?: string;
  contextAge?: number;
  contextFateNodeName?: string;
}

export interface FateNodeInfo {
  index: number;
  name: string;
  realm: string;
  theme: string;
  triggerAge: { min: number; max: number };
  completed: boolean;
}

export interface BreakthroughCeremony {
  fromRealm: string;
  fromRealmName: string;
  toRealm: string;
  toRealmName: string;
  toRealmColor: string;
  newLifespan: number;
  statBoosts: { label: string; value: number }[];
}

interface GameState {
  character: CharacterState | null;
  events: GameEvent[];
  choices: ChoiceRecord[];
  pendingChoice: PendingChoice | null;
  fateNodes: FateNodeInfo[];
  loading: boolean;
  error: string | null;
  lastChange: { attribute: string; delta: number; reason: string }[] | null;
  lastBreakthrough: { newRealm: string } | null;
  lastInterfere: { classification: string; accepted: boolean; narrative: string } | null;

  // 新增：事件详情抽屉
  selectedEventId: string | null;
  // 新增：突破仪式
  breakthroughCeremony: BreakthroughCeremony | null;
  // Task 21-d-1：坊市弹窗开关（玩家可主动访问坊市购买/出售物品）
  marketOpen: boolean;
  // Task 24：秘境探索弹窗开关（玩家可主动前往秘境探索）
  explorationOpen: boolean;
  // Task 24：最近一次探索结果（用于探索结果弹窗展示）
  lastExploration: { realmName: string; realmTier: string; realmIcon: string; title: string; narrative: string } | null;

  setCharacter: (c: CharacterState | null) => void;
  setEvents: (e: GameEvent[]) => void;
  addEvent: (e: GameEvent) => void;
  setChoices: (c: ChoiceRecord[]) => void;
  addChoice: (c: ChoiceRecord) => void;
  setPendingChoice: (c: PendingChoice | null) => void;
  setFateNodes: (f: FateNodeInfo[]) => void;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  setLastChange: (c: any[] | null) => void;
  setLastBreakthrough: (b: any | null) => void;
  setLastInterfere: (i: any | null) => void;
  setSelectedEventId: (id: string | null) => void;
  setBreakthroughCeremony: (b: BreakthroughCeremony | null) => void;
  // Task 21-d-1：坊市弹窗开关
  setMarketOpen: (open: boolean) => void;
  // Task 24：秘境弹窗开关
  setExplorationOpen: (open: boolean) => void;
  // Task 24：设置最近一次探索结果
  setLastExploration: (e: { realmName: string; realmTier: string; realmIcon: string; title: string; narrative: string } | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      character: null,
      events: [],
      choices: [],
      pendingChoice: null,
      fateNodes: [],
      loading: false,
      error: null,
      lastChange: null,
      lastBreakthrough: null,
      lastInterfere: null,
      selectedEventId: null,
      breakthroughCeremony: null,
      marketOpen: false,
      explorationOpen: false,
      lastExploration: null,

      setCharacter: (c) => set({ character: c }),
      setEvents: (e) => set({ events: e }),
      addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
      setChoices: (c) => set({ choices: c }),
      addChoice: (c) => set((s) => ({ choices: [...s.choices, c] })),
      setPendingChoice: (c) => set({ pendingChoice: c }),
      setFateNodes: (f) => set({ fateNodes: f }),
      setLoading: (l) => set({ loading: l }),
      setError: (e) => set({ error: e }),
      setLastChange: (c) => set({ lastChange: c }),
      setLastBreakthrough: (b) => set({ lastBreakthrough: b }),
      setLastInterfere: (i) => set({ lastInterfere: i }),
      setSelectedEventId: (id) => set({ selectedEventId: id }),
      setBreakthroughCeremony: (b) => set({ breakthroughCeremony: b }),
      setMarketOpen: (open) => set({ marketOpen: open }),
      setExplorationOpen: (open) => set({ explorationOpen: open }),
      setLastExploration: (e) => set({ lastExploration: e }),
      reset: () => set({
        character: null, events: [], choices: [], pendingChoice: null, fateNodes: [],
        loading: false, error: null, lastChange: null, lastBreakthrough: null, lastInterfere: null,
        selectedEventId: null, breakthroughCeremony: null, marketOpen: false,
        explorationOpen: false, lastExploration: null,
      }),
    }),
    {
      name: 'xianxia-game',
      partialize: (s) => ({ character: s.character }),
    }
  )
);
