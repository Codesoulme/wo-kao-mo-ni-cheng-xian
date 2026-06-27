﻿﻿'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TribulationSession, AscensionSession, Restriction, HeartDemonType } from './types';

// 流式叙事：绕过 React 状态系统，直接更新 DOM
export interface StreamingState {
  eventIndex: number;
  text: string;
}
export const streamingRef: { current: StreamingState | null } = { current: null };


export type HeritageCategory = 'scripture' | 'fate' | 'pet' | 'artifact' | 'constitution' | 'treasure';
export type HeritageRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type TimeAdvanceUnit = 'moment' | 'hour' | 'day' | 'month' | 'season' | 'year' | 'decade' | 'century';

export interface TimeAdvance {
  amount: number;
  unit: TimeAdvanceUnit;
  label: string;
  reason: string;
  ageDeltaYears: number;
  elapsedDays: number;
}

export interface WorldCalendarState {
  eraName: string;
  calendarYear: number;
  elapsedDays: number;
}

export interface ActionProjection {
  id: string;
  kind: 'advance' | 'market' | 'exploration' | 'thread' | 'cultivate' | 'trade' | 'rest' | 'combat' | 'choice' | 'custom';
  label: string;
  description?: string;
  sourceEventId?: string;
  sourceThreadId?: string;
  requirements?: string[];
  risk?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
  expiresAtAge?: number;
  expiresAtWorldDay?: number;
  payload?: Record<string, any>;
}

export interface WorldLegacyRecord {
  id: string;
  characterId: string;
  characterName: string;
  age: number;
  highestRealm?: string;
  status: 'dead' | 'ascended' | 'living_autonomous';
  summary: string;
  relicSeeds: string[];
  legendSeeds: string[];
  createdAtWorldLabel?: string;
  updatedAt: string;
}

export interface HeritageItem {
  id: string;
  category: HeritageCategory;
  name: string;
  description: string;
  rarity: HeritageRarity;
  source: string;
  payload?: any;
}

export type SelectedHeritage = Partial<Record<HeritageCategory, HeritageItem[]>>;

export interface SettlementOption extends HeritageItem {
  reason: string;
}

export interface SimulationHallRecord {
  id: string;
  characterName: string;
  gender: string;
  age: number;
  highestRealm: string;
  realmLevel: number;
  ending: 'death' | 'ascension' | 'living_autonomous';
  evaluationTitle: string;
  score: number;
  notableDeeds: string[];
  carriedOut: HeritageItem[];
  createdAt: string;
}

export interface SettlementResult {
  id: string;
  characterId: string;
  ending: 'death' | 'ascension' | 'living_autonomous';
  title: string;
  summary: string;
  score: number;
  rank: string;
  options: SettlementOption[];
  hallRecord: SimulationHallRecord;
  createdAt: string;
}

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
  realmPowerMultiplier?: number;
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
  // AI/事件生成的非常规属性，由引擎从状态与事件投影而来，面板自动展示。
  cultivationAttributes?: any[];
  // ===== Task 20 新增（前端方便访问，也放在 character 上；advance/choose/interfere 返回的 state 已包含这些字段） =====
  // 未决线索（重要剧情线索，会在后续推进/到期触发）
  pendingThreads?: any[];
  questEntries?: any[];
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
  // 当前剧情中发现的秘境入口（从未决线索/信物/状态推导）
  discoveredRealms?: any[];
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
  timeAdvance?: TimeAdvance;
  worldTime?: WorldCalendarState & { label?: string; displayLabel?: string; monthName?: string; day?: number; phase?: string };
  actionProjections?: ActionProjection[];
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

// AI-77: tribulation ceremony shell
export interface TribulationCeremony {
  session: TribulationSession;
  narrative: string;
}

// AI-78: ascension ceremony shell
export interface AscensionCeremony {
  session: AscensionSession;
  narrative: string;
}

// AI-78: restriction challenge shell
export interface RestrictionChallenge {
  restriction: Restriction;
  narrative: string;
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
  // 干预冷却：上次成功干预时的年龄（十载一次）
  lastInterfereAge: number | null;

  // 新增：事件详情抽屉
  selectedEventId: string | null;
  // 新增：突破仪式
  breakthroughCeremony: BreakthroughCeremony | null;
  // AI-77: tribulation ceremony state for TribulationModal
  tribulationCeremony: TribulationCeremony | null;
  // AI-77: tribulation result (passed/failed) shown after modal closes
  tribulationResult: { passed: boolean; narrative: string; boltsCompleted: number } | null;
  // AI-78: ascension ceremony state for AscensionModal
  ascensionCeremony: AscensionCeremony | null;
  // AI-78: restriction challenge state for RestrictionModal
  restrictionChallenge: RestrictionChallenge | null;
  // Task 21-d-1：坊市弹窗开关（玩家可主动访问坊市购买/出售物品）
  marketOpen: boolean;
  // Task 24：秘境探索弹窗开关（玩家可主动前往秘境探索）
  explorationOpen: boolean;
  // Task 24：最近一次探索结果（用于探索结果弹窗展示）
  lastExploration: { eventId?: string; age?: number; realmName: string; realmTier: string; realmIcon: string; title: string; narrative: string; effects?: any[] } | null;

  heritageVault: HeritageItem[];
  selectedHeritage: SelectedHeritage;
  hallOfSimulations: SimulationHallRecord[];
  settlementResult: SettlementResult | null;
  worldCalendar: WorldCalendarState;
  worldLegacies: WorldLegacyRecord[];

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
  setLastInterfereAge: (age: number | null) => void;
  setSelectedEventId: (id: string | null) => void;
  setBreakthroughCeremony: (b: BreakthroughCeremony | null) => void;
  // AI-77: TribulationModal setters / actions
  setTribulationCeremony: (t: TribulationCeremony | null) => void;
  setTribulationResult: (r: { passed: boolean; narrative: string; boltsCompleted: number } | null) => void;
  startTribulation: (session: TribulationSession, narrative: string) => void;
  endTribulation: () => void;
  recordTribulationBolt: (boltNumber: number) => void;
  resolveTribulationHeartDemon: (demon: HeartDemonType) => void;
  // AI-78: AscensionModal / RestrictionModal setters / actions
  setAscensionCeremony: (a: AscensionCeremony | null) => void;
  setRestrictionChallenge: (r: RestrictionChallenge | null) => void;
  startAscension: (session: AscensionSession, narrative: string) => void;
  endAscension: () => void;
  resolveAscensionRoll: (characterRoll: number) => void;
  tryRestrictionAccess: (restriction: Restriction, choice: 'attempt' | 'retreat' | 'combat', password?: string) => void;
  fightRestriction: (restriction: Restriction) => void;
  // Task 21-d-1：坊市弹窗开关
  setMarketOpen: (open: boolean) => void;
  // Task 24：秘境弹窗开关
  setExplorationOpen: (open: boolean) => void;
  // Task 24：设置最近一次探索结果
  setLastExploration: (e: { eventId?: string; age?: number; realmName: string; realmTier: string; realmIcon: string; title: string; narrative: string; effects?: any[] } | null) => void;
  setHeritageVault: (items: HeritageItem[]) => void;
  addHeritageItems: (items: HeritageItem[]) => void;
  setSelectedHeritage: (selected: SelectedHeritage) => void;
  toggleSelectedHeritage: (item: HeritageItem) => void;
  clearSelectedHeritage: () => void;
  // 气泡级流式显示：新事件索引范围 [start, end)；null 表示无新事件（关闭动画）
  newEventRange: { start: number; end: number } | null;
  // 真正流式：当前正在写入的 narrative（含主叙事 + 增量和）；为空则走原气泡逻辑
  streamingNarrative: { eventIndex: number; text: string } | null;
  // 流式结束后、结算完成前的提示文字（'calculating' = 收获结算中）
  settlingHint: 'calculating' | null;
  setNewEventRange: (range: { start: number; end: number } | null) => void;
  setSettlementResult: (result: SettlementResult | null) => void;
  addHallRecord: (record: SimulationHallRecord) => void;
  setWorldCalendar: (world: WorldCalendarState) => void;
  advanceWorldCalendar: (time?: TimeAdvance | null) => WorldCalendarState;
  addWorldLegacy: (record: WorldLegacyRecord) => void;
  appendStreamingNarrative: (eventIndex: number, delta: string) => void;
  setStreamingNarrative: (eventIndex: number, text: string) => void;
  finishStreamingNarrative: () => void;
  clearStreamingNarrative: () => void;
  resetWorldLocal: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
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
      lastInterfereAge: null,
      selectedEventId: null,
      breakthroughCeremony: null,
      tribulationCeremony: null,
      tribulationResult: null,
      ascensionCeremony: null,
      restrictionChallenge: null,
      marketOpen: false,
      explorationOpen: false,
      lastExploration: null,
      heritageVault: [],
      selectedHeritage: {},
      hallOfSimulations: [],
      settlementResult: null,
      worldCalendar: { eraName: '青岚仙历', calendarYear: 5000, elapsedDays: 0 },
      worldLegacies: [],
      newEventRange: null,
      settlingHint: null,
      streamingNarrative: null,

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
      setLastInterfereAge: (age) => set({ lastInterfereAge: age }),
      setSelectedEventId: (id) => set({ selectedEventId: id }),
      setBreakthroughCeremony: (b) => set({ breakthroughCeremony: b }),
      // AI-77: TribulationModal state
      setTribulationCeremony: (t) => set({ tribulationCeremony: t }),
      setTribulationResult: (r) => set({ tribulationResult: r }),
      startTribulation: (session, narrative) => set({
        tribulationCeremony: { session, narrative },
        tribulationResult: null,
      }),
      endTribulation: () => {
        const cur = get().tribulationCeremony;
        if (cur && (!cur.session.outcome || cur.session.outcome === 'ongoing')) {
          const session = cur.session;
          const passed = session.outcome === 'ascended' || session.passed;
          set({
            tribulationResult: { passed, narrative: cur.narrative, boltsCompleted: session.boltsCompleted },
            tribulationCeremony: null,
          });
          return;
        }
        set({ tribulationCeremony: null });
      },
      recordTribulationBolt: (boltNumber) => set((s) => {
        const cur = s.tribulationCeremony;
        if (!cur) return {};
        const nextBolts = Math.max(cur.session.boltsCompleted, Math.min(9, boltNumber));
        const nextSession: TribulationSession = { ...cur.session, boltsCompleted: nextBolts };
        if (nextBolts >= 9) nextSession.currentStage = 'passed';
        return { tribulationCeremony: { session: nextSession, narrative: cur.narrative } };
      }),
      resolveTribulationHeartDemon: (demon) => set((s) => {
        const cur = s.tribulationCeremony;
        if (!cur) return {};
        const nextSession: TribulationSession = { ...cur.session, heartDemonResolved: true };
        return { tribulationCeremony: { session: nextSession, narrative: cur.narrative } };
      }),
      // AI-78: AscensionModal state
      setAscensionCeremony: (a) => set({ ascensionCeremony: a }),
      startAscension: (session, narrative) => set({
        ascensionCeremony: { session, narrative },
      }),
      endAscension: () => set({ ascensionCeremony: null }),
      resolveAscensionRoll: (characterRoll) => set((s) => {
        const cur = s.ascensionCeremony;
        if (!cur) return {};
        const success = characterRoll >= 0.5 && cur.session.requirements.tribulationPassed;
        const nextSession: AscensionSession = {
          ...cur.session,
          passed: success,
          outcome: success ? 'ascended' : 'failed',
        };
        return { ascensionCeremony: { session: nextSession, narrative: cur.narrative } };
      }),
      // AI-78: RestrictionModal state
      setRestrictionChallenge: (r) => set({ restrictionChallenge: r }),
      tryRestrictionAccess: (restriction, choice, password) => set({
        restrictionChallenge: {
          restriction,
          narrative: 'access attempt: ' + choice + (password ? ' (key=' + password + ')' : ''),
        },
      }),
      fightRestriction: (restriction) => set({
        restrictionChallenge: {
          restriction,
          narrative: 'combat initiated against restriction',
        },
      }),
      setMarketOpen: (open) => set({ marketOpen: open }),
      setExplorationOpen: (open) => set({ explorationOpen: open }),
      setLastExploration: (e) => set({ lastExploration: e }),
      setHeritageVault: (items) => set({ heritageVault: items }),
      addHeritageItems: (items) => set((s) => {
        const known = new Set(s.heritageVault.map((item) => item.id));
        const fresh = items.filter((item) => !known.has(item.id));
        return { heritageVault: [...s.heritageVault, ...fresh] };
      }),
      setSelectedHeritage: (selected) => set({ selectedHeritage: selected }),
      setNewEventRange: (range) => set({ newEventRange: range }),
      setSettlingHint: (hint) => set({ settlingHint: hint }),
      setStreamingNarrative: (eventIndex, text) => {
        streamingRef.current = { eventIndex, text };
        set({ streamingNarrative: { eventIndex, text } });
      },
      appendStreamingNarrative: (eventIndex, delta) => {
        // 同时更新 React 状态和模块级 ref（用于直接 DOM 操作）
        const cur = streamingRef.current;
        if (cur && cur.eventIndex === eventIndex) {
          streamingRef.current = { eventIndex, text: cur.text + delta };
        } else {
          streamingRef.current = { eventIndex, text: delta };
        }
        set((s) => {
          const curState = s.streamingNarrative;
          if (curState && curState.eventIndex === eventIndex) {
            return { streamingNarrative: { eventIndex, text: curState.text + delta } };
          }
          return { streamingNarrative: { eventIndex, text: delta } };
        });
      },
      finishStreamingNarrative: () => {
        // 只停 RAF，不清 streamingNarrative，避免组件因状态变 null 而闪动
        streamingRef.current = null;
      },
      clearStreamingNarrative: () => {
        streamingRef.current = null;
        set({ streamingNarrative: null });
      },
      toggleSelectedHeritage: (item) => set((s) => {
        const current = s.selectedHeritage[item.category] || [];
        const exists = current.some((it) => it.id === item.id);
        return {
          selectedHeritage: {
            ...s.selectedHeritage,
            [item.category]: exists
              ? current.filter((it) => it.id !== item.id)
              : [...current, item],
          },
        };
      }),
      clearSelectedHeritage: () => set({ selectedHeritage: {} }),
      setSettlementResult: (result) => set({ settlementResult: result }),
      addHallRecord: (record) => set((s) => ({
        hallOfSimulations: [record, ...s.hallOfSimulations.filter((it) => it.id !== record.id)].slice(0, 50),
      })),
      setWorldCalendar: (world) => set({ worldCalendar: world }),
      advanceWorldCalendar: (time) => {
        let nextWorld: WorldCalendarState = { eraName: '青岚仙历', calendarYear: 5000, elapsedDays: 0 };
        set((s) => {
          const addDays = Math.max(0, Math.round(Number(time?.elapsedDays ?? ((time?.ageDeltaYears || 0) * 365))));
          const elapsedDays = Math.max(0, (s.worldCalendar?.elapsedDays || 0) + addDays);
          nextWorld = {
            eraName: s.worldCalendar?.eraName || '青岚仙历',
            calendarYear: 5000 + Math.floor(elapsedDays / 365),
            elapsedDays,
          };
          return { worldCalendar: nextWorld };
        });
        return nextWorld;
      },
      addWorldLegacy: (record) => set((s) => ({
        worldLegacies: [record, ...s.worldLegacies.filter((it) => it.id !== record.id)].slice(0, 80),
      })),
      resetWorldLocal: () => set({
        character: null, events: [], choices: [], pendingChoice: null, fateNodes: [],
        loading: false, error: null, lastChange: null, lastBreakthrough: null, lastInterfere: null, lastInterfereAge: null,
        selectedEventId: null, breakthroughCeremony: null, marketOpen: false,
        explorationOpen: false, lastExploration: null, settlementResult: null,
        heritageVault: [], selectedHeritage: {}, hallOfSimulations: [],
        worldCalendar: { eraName: '青岚仙历', calendarYear: 5000, elapsedDays: 0 },
        worldLegacies: [],
      }),
      reset: () => set({
        character: null, events: [], choices: [], pendingChoice: null, fateNodes: [],
        loading: false, error: null, lastChange: null, lastBreakthrough: null, lastInterfere: null, lastInterfereAge: null,
        selectedEventId: null, breakthroughCeremony: null, marketOpen: false,
        explorationOpen: false, lastExploration: null, settlementResult: null,
      }),
    }),
    {
      name: 'xianxia-game',
      partialize: (s) => ({
        character: s.character,
        lastInterfereAge: s.lastInterfereAge,
        heritageVault: s.heritageVault,
        selectedHeritage: s.selectedHeritage,
        hallOfSimulations: s.hallOfSimulations,
        settlementResult: s.settlementResult,
        worldCalendar: s.worldCalendar,
        worldLegacies: s.worldLegacies,
      }),
    }
  )
);
