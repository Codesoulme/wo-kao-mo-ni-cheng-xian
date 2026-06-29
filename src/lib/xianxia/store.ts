'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TribulationSession, AscensionSession, Restriction, HeartDemonType, CharacterState } from './types';
// ★ 任务 D 修复：消除 CharacterState 双份定义，canonical 来自 types.ts（更完整）
//   store 层 re-export 保持旧 import 路径（`from '@/lib/xianxia/store'`）不破坏
export type { CharacterState } from './types';
import { selectNextProtagonist } from './engine';
import { triggerEndingEvaluation } from './engine';
import { tickAllNpcsForYear as libTickAllNpcsForYear } from './npc-growth';
// 批 15: store.ts 关键 setter 接 Event Sourcing（PoC 双写，appendEvent 失败仅 console.error）
import { appendEvent } from './events/store';

// 流式叙事：绕过 React 状态系统，直接更新 DOM
export interface StreamingState {
  eventIndex: number;
  text: string;
}
export const streamingRef: { current: StreamingState | null } = { current: null };

// 批 15: 内部 helper —— setter 在 closure 内传入 get()，helper 自己取 character.id
// 无 character 时跳过 appendEvent；appendEvent 失败仅 console.error（不抛）
function _tryAppendEvent(
  get: () => any,
  type: 'character.inheritance-pool.set' | 'character.inheritance-candidates.set' | 'character.inheritance-ending-summary.set' | 'character.end-result.set' | 'character.settlement-result.set' | 'character.streaming-narrative.started',
  data: any
): void {
  try {
    const cid = get()?.character?.id;
    if (!cid || typeof cid !== 'string') return;
    appendEvent({
      characterId: cid,
      type,
      data: { type, ...data } as any,
      source: 'system-tick',
      triggerActor: 'system',
    }).catch((e) => console.error('[store] ' + type + ' event failed (non-fatal):', e));
  } catch (e) {
    console.error('[store] ' + type + ' event helper threw (non-fatal):', e);
  }
}


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

// P1-5：继承白名单字段。AI/legacy 候选对象可能含任意字段（causeOfDeath/alive/dead/realmLevel 等），
// 构造新 character 时只把白名单内的字段从 cand 合并，避免污染新角色并绕过 executeAIEvent 校验链路。
const ALLOWED_INHERITANCE_FIELDS = ['spiritualRoot', 'bloodline', 'karmaTags', 'traitNarrative'] as const;

// P1-6：白名单校验 helper —— 候选 id 必须在某条 pool 的 hostCharacterIds 之内，
// 或（兜底）必须能在当前 worldLegacies 找到对应记录；否则认为该候选与本世传承无关，丢弃。
function validateInheritanceCandidate(cand: any, pool: any[], legacies?: any[]): boolean {
  if (!cand || typeof cand !== 'object') return false;
  const cid = cand.id;
  if (typeof cid !== 'string' || !cid) return false;
  // 主校验：候选 id 是否出现在 pool 的某条 hostCharacterIds 中
  if (Array.isArray(pool)) {
    for (const p of pool) {
      if (p && Array.isArray(p.hostCharacterIds) && p.hostCharacterIds.indexOf(cid) >= 0) {
        return true;
      }
    }
  }
  // 兜底：候选 id 是否出现在 worldLegacies（仙界历代名册）中
  if (Array.isArray(legacies)) {
    for (const w of legacies) {
      if (w && typeof w === 'object' && w.characterId === cid) {
        return true;
      }
    }
  }
  return false;
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

  // Phase-M #3: 继承池 + 候选继承人 + 上一代结局摘要（已加入 partialize，version=2，避免刷新页面后池子消失）
  inheritancePool: any[];
  inheritanceCandidates: any[];
  inheritanceEndingSummary: string | null;

  // Phase-M #4: 自动存档全局状态（移到 store 避免多实例 useAutoSave 双写）
  // lastAutoSaveAt 持久化（玩家刷新页面后还能显示上次存档时间）；
  // lastAutoSaveError 是 transient UI state，不进 partialize
  lastAutoSaveAt: string | null;
  lastAutoSaveError: { age: number; error: string; reason: string; at: number } | null;

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
  setSettlingHint: (hint: 'calculating' | null) => void;
  setSettlementResult: (result: SettlementResult | null) => void;
  addHallRecord: (record: SimulationHallRecord) => void;
  setWorldCalendar: (world: WorldCalendarState) => void;
  advanceWorldCalendar: (time?: TimeAdvance | null) => WorldCalendarState;
  addWorldLegacy: (record: WorldLegacyRecord) => void;
  // Phase-M #3: 继承池运行时 setter + claimInheritanceCandidate action
  setInheritancePool: (pool: any[], candidates: any[], summary?: string | null) => void;
  clearInheritancePool: () => void;
  claimInheritanceCandidate: (candidateId: string) => void;
  // Phase-M #2: 死亡引导 — 3 个选项 + 关闭提示
  deathGuidanceDismissed: boolean;
  dismissDeathGuidance: () => void;
  // Phase-M #4: 自动存档全局 setter（useAutoSave 写，UI 读）
  setLastAutoSaveAt: (at: string | null) => void;
  setLastAutoSaveError: (err: { age: number; error: string; reason: string; at: number } | null) => void;
  selectNextProtagonistAndContinue: () => { ok: boolean; narrative?: string; selectedId?: string; error?: string };
  resetCharacterToMortalStart: () => void;
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
      // Phase-M #3: 继承池初始为空（运行时由调用方填入）
      inheritancePool: [],
      inheritanceCandidates: [],
      inheritanceEndingSummary: null,
      deathGuidanceDismissed: false,
      // Phase-M #4: 自动存档全局状态（默认空）
      lastAutoSaveAt: null,
      lastAutoSaveError: null,
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
        // 流式叙事占位符是 UI 临时状态，不入 event store（之前双写 appendEvent 在浏览器触发 Prisma 错误，2026-06-29 移除）
        // 2026-06-29 重接 _tryAppendEvent：_tryAppendEvent 内部已用 try/catch + 无 cid 短路保护，Prisma 错误已被吞
        _tryAppendEvent(get, 'character.streaming-narrative.started', { eventIndex });
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
      setSettlementResult: (result) => {
        // 客户端只设 UI 状态；事件追踪归服务端 route（settlement/route.ts）单一来源
        // 之前双写 appendEvent 在浏览器触发 Prisma 错误，2026-06-29 移除
        // 2026-06-29 重接 _tryAppendEvent：_tryAppendEvent 内部已用 try/catch + 无 cid 短路保护，Prisma 错误已被吞
        _tryAppendEvent(get, 'character.settlement-result.set', { hasResult: !!result });
        _tryAppendEvent(get, 'character.end-result.set', { hasResult: !!result });
        set({ settlementResult: result });
      },
      addHallRecord: (record) => set((s) => ({
        hallOfSimulations: [record, ...s.hallOfSimulations.filter((it) => it.id !== record.id)].slice(0, 50),
      })),
      setWorldCalendar: (world) => set({ worldCalendar: world }),
      // Phase-M #3: 继承池运行时 setter（不持久化，由调用方决定何时填入/清空）
      setInheritancePool: (pool, candidates, summary) => {
        // 客户端只设 UI 状态；事件追踪归服务端 route 单一来源（之前双写触发 Prisma 浏览器错误，2026-06-29 移除）
        // 2026-06-29 重接 _tryAppendEvent：_tryAppendEvent 内部已用 try/catch + 无 cid 短路保护，Prisma 错误已被吞
        const safePool = Array.isArray(pool) ? pool : [];
        const safeCands = Array.isArray(candidates) ? candidates : [];
        const safeSummary = typeof summary === 'string' ? summary : null;
        _tryAppendEvent(get, 'character.inheritance-pool.set', { count: safePool.length });
        _tryAppendEvent(get, 'character.inheritance-candidates.set', { count: safeCands.length });
        _tryAppendEvent(get, 'character.inheritance-ending-summary.set', { hasSummary: safeSummary !== null });
        set({
          inheritancePool: safePool,
          inheritanceCandidates: safeCands,
          inheritanceEndingSummary: safeSummary,
        });
      },
      clearInheritancePool: () => set({
        inheritancePool: [], inheritanceCandidates: [], inheritanceEndingSummary: null,
      }),

      // Phase-M #3: claimInheritanceCandidate —— 玩家选定继承人后，
      // 调 engine.selectNextProtagonist 复算适配分；若候选存在则构造新 character
      // 替换当前角色（age 重置、alive=true、causeOfDeath 清空、ascended=false、dead 字段抹除），
      // 把候选池与上一代 ending 摘要沉入 heritageVault，再清空继承池；
      // 该动作不向远端发请求，纯本地状态机，符合 UI-only 边界。
      // P1-5 修复：AI/legacy 候选对象可能含任意字段（causeOfDeath/alive/causeOfDeath/dead 等），
      // 不再直接 `...cand` 展开覆盖整个 character；改用 ALLOWED_INHERITANCE_FIELDS 白名单
      // 只把可继承字段（spiritualRoot/bloodline/karmaTags/traitNarrative）合并进去，
      // 避免污染新角色并绕过 executeAIEvent 校验链路。
      claimInheritanceCandidate: (candidateId: string) => {
        const s = get();
        if (!candidateId || typeof candidateId !== 'string') return;
        const candidates = Array.isArray(s.inheritanceCandidates) ? s.inheritanceCandidates : [];
        const cand = candidates.find((c) => c && typeof c === 'object' && c.id === candidateId);
        if (!cand) return;
        const pool = Array.isArray(s.inheritancePool) ? s.inheritancePool : [];
        const selection = selectNextProtagonist(pool, s.worldCalendar, candidates);
        const prev = s.character;
        const nextName = (typeof cand.name === 'string' && cand.name) ? cand.name : ((prev && prev.name) || '新主角');
        const nextAge = (typeof cand.age === 'number' && cand.age >= 0) ? cand.age : 0;
        const nextRealm = (typeof cand.realm === 'string' && cand.realm) ? cand.realm : 'mortal';
        const nextRoot = (typeof cand.spiritualRoot === 'string' && cand.spiritualRoot) ? cand.spiritualRoot : 'none';
        // P1-5：以 prev 为基底，然后只把白名单内的继承字段从 cand 合并进来
        // 这些 override 字段（id/name/age/realm/spiritualRoot/alive/ascended/causeOfDeath/dead/lastEventAge/isAtChoice）
        // 用对象字面量写在展开后确保正确覆盖 prev 残留（如 alive=false/causeOfDeath 旧值）
        const whitelistMerge: Record<string, any> = {};
        for (const k of ALLOWED_INHERITANCE_FIELDS) {
          if (cand && Object.prototype.hasOwnProperty.call(cand, k)) {
            whitelistMerge[k] = (cand as any)[k];
          }
        }
        const newChar: any = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          ...whitelistMerge,
          id: typeof cand.id === 'string' ? cand.id : ('protagonist-' + Date.now()),
          name: nextName,
          age: nextAge,
          realm: nextRealm,
          spiritualRoot: nextRoot,
          alive: true,
          ascended: false,
          causeOfDeath: '',
          ...(prev && typeof prev === 'object' && 'dead' in prev ? { dead: false } : {}),
          lastEventAge: nextAge,
          isAtChoice: false,
        };
        const eligVal = (selection && typeof selection.eligibility === 'number') ? selection.eligibility : 0;
        const heritageLine = s.inheritanceEndingSummary
          ? s.inheritanceEndingSummary + ' · 承继者：' + nextName + '（适配 ' + eligVal.toFixed(2) + '）'
          : '承继者：' + nextName + '（适配 ' + eligVal.toFixed(2) + '）';
        const heritageEntry: any = {
          id: 'herit-' + ((prev && prev.id) ? prev.id : 'prev') + '-' + Date.now(),
          name: '传承 · ' + nextName,
          category: 'fate',
          rarity: 'rare',
          narrative: heritageLine,
          source: 'inheritance-pool',
        };
        set({
          character: newChar,
          heritageVault: [heritageEntry, ...s.heritageVault],
          inheritancePool: [],
          inheritanceCandidates: [],
          inheritanceEndingSummary: null,
          settlementResult: null,
          pendingChoice: null,
        });
      },

      // Phase-T #9: NPC 自生长 — 玩家年龄推进时调一次，把所有 NPC 推进 yearDelta 年（年龄 + 偶发破境 + 偶发寿终 + 关系衰减）。不读 Math.random；确定性 hash 随机。
      tickNpcsForYear: (yearDelta: number) => {
        const safeDelta = Math.max(0, Math.floor(Number(yearDelta) || 0));
        if (!Number.isFinite(safeDelta) || safeDelta <= 0) return;
        const s = get();
        const ch = s.character;
        if (!ch || typeof ch !== 'object') return;
        const prevNpcs = Array.isArray(ch.npcs) ? ch.npcs : [];
        if (prevNpcs.length === 0) return;
        const result = libTickAllNpcsForYear(prevNpcs, safeDelta, typeof ch.age === 'number' ? ch.age : 0);
        if (!result || !Array.isArray(result.nextNpcs)) return;
        set({ character: { ...ch, npcs: result.nextNpcs } });
      },

      // Phase-M #2: dismissDeathGuidance — 玩家选择「继续旁观」后关闭死亡引导
      dismissDeathGuidance: () => set({ deathGuidanceDismissed: true }),

      // Phase-M #4: 自动存档全局 setter — useAutoSave 写入，SaveSlotPanel/DeathGuidancePanel 读取。
      // 之前每个组件各自 useRef 维护 lastError，导致同一 age 推进时 writeSaveSlot 被触发 3 次。
      setLastAutoSaveAt: (at) => set({ lastAutoSaveAt: at }),
      setLastAutoSaveError: (err) => set({ lastAutoSaveError: err }),

      // Phase-M #2: selectNextProtagonistAndContinue — 「轮回重开」
      // 流程：triggerEndingEvaluation 取传承池 → 用 worldLegacies + pool hostCharacterIds 衍生候选 →
      //   selectNextProtagonist 选继承人 → setInheritancePool + claimInheritanceCandidate 替换角色
      // 池空 / 候选空 / 引擎未选出 → 返回 ok=false；UI 显示「无可继承之人」。
      selectNextProtagonistAndContinue: () => {
        const s = get();
        const prev = s.character;
        if (!prev || typeof prev !== 'object') return { ok: false, error: 'no-character' };
        const cause = (typeof prev.causeOfDeath === 'string' && prev.causeOfDeath)
          ? prev.causeOfDeath
          : 'sit-death';
        // 1. 引擎评估：取传承池
        let evalRes: any = null;
        let evalError: any = null;
        try {
          evalRes = triggerEndingEvaluation(prev, s.worldCalendar, cause);
        } catch (e: any) {
          // P1 修复：不吞错 — 记录 telemetry 但保留原 ending 摘要（来自 settlementResult）作为信息源
          // 避免玩家看到「衣钵未竟，待后人接续」却看不到实际生成的 ending 摘要。
          // 仅 console.error，不抛 — 否则连选择继承人的入口都没有了
          evalError = e;
          // eslint-disable-next-line no-console
          if (typeof console !== 'undefined' && console.error) {
            try { console.error('[selectNextProtagonist] triggerEndingEvaluation failed:', (e && (e.message || e)) || e); } catch { /* swallow */ }
          }
        }
        const pool = (evalRes && Array.isArray(evalRes.inheritancePool)) ? evalRes.inheritancePool : [];

        // 构造 endingSummary：优先 evalRes.primaryEnding.summary，否则回退到 settlementResult.summary
        // （settlementResult 在 SettlementModal 关闭后仍保留在 store），最后兜底为通用句
        let endingSummary: string | null = null;
        if (evalRes && evalRes.primaryEnding && typeof evalRes.primaryEnding.summary === 'string' && evalRes.primaryEnding.summary) {
          endingSummary = evalRes.primaryEnding.summary;
        } else if (s.settlementResult && typeof s.settlementResult.summary === 'string' && s.settlementResult.summary) {
          endingSummary = s.settlementResult.summary;
        } else if (evalError) {
          endingSummary = '衣钵未竟，待后人接续。';
        }

        if (pool.length === 0) {
          return {
            ok: false,
            error: evalError ? 'eval-failed' : 'no-pool',
            narrative: endingSummary || '此生未留传承池，仙路轮转暂止。',
            settlementResult: s.settlementResult, // 保留供 UI 展示
            endingSummary: endingSummary,
            evalError: evalError ? { message: (evalError && (evalError.message || evalError)) ? String(evalError.message || evalError) : 'unknown' } : null,
          };
        }
        // 2. 衍生候选：从 worldLegacies（仙界历代名册）取，再补 pool hostCharacterIds 兜底
        const legacyCandidates = (Array.isArray(s.worldLegacies) ? s.worldLegacies : [])
          .filter((w) => w && typeof w === 'object' && w.characterId)
          .slice(0, 8)
          .map((w) => ({
            id: w.characterId,
            name: w.characterName || w.characterId,
            age: typeof w.age === 'number' ? w.age : 12,
            realm: (typeof w.highestRealm === 'string' && w.highestRealm) ? w.highestRealm : 'mortal',
            spiritualRoot: 'mixed',
            bloodline: '',
            karmaTags: [],
            inherited: [],
            traitNarrative: (typeof w.summary === 'string' && w.summary) ? w.summary : '无名后辈',
          }));
        // P1-6 白名单过滤：候选 id 必须在 pool.hostCharacterIds 之内，或与 worldLegacies 关联；
        // 防止 worldLegacies 中与本世传承无关的"前世仙人"被强行塞进候选池
        const whitelistedLegacyCandidates = legacyCandidates.filter(
          (c) => validateInheritanceCandidate(c, pool, s.worldLegacies)
        );
        const legacyIds = new Set(whitelistedLegacyCandidates.map((c) => c.id));
        const hostCandidates: any[] = [];
        for (const p of pool) {
          if (!p || !Array.isArray(p.hostCharacterIds)) continue;
          for (const hid of p.hostCharacterIds) {
            if (typeof hid !== 'string' || legacyIds.has(hid)) continue;
            hostCandidates.push({
              id: hid,
              name: hid,
              age: 12,
              realm: 'mortal',
              spiritualRoot: 'mixed',
              bloodline: '',
              karmaTags: [],
              inherited: (p && typeof p.kind === 'string') ? [{ poolId: p.id, kind: p.kind }] : [],
              traitNarrative: (p && typeof p.name === 'string') ? p.name : '传承之人',
            });
          }
        }
        const candidates = whitelistedLegacyCandidates.concat(hostCandidates);
        if (candidates.length === 0) {
          return { ok: false, error: 'no-candidates', narrative: '本世未结善缘，传承池暂无可承之人。' };
        }
        // 3. 引擎选继承人
        const selection = selectNextProtagonist(pool, s.worldCalendar, candidates);
        const picked = selection && typeof selection.selectedId === 'string' ? selection.selectedId : '';
        if (!picked) {
          return { ok: false, error: 'no-pick', narrative: (selection && selection.narrative) || '无人可承此衣钵。' };
        }
        // 4. 设置池 + 候选 + 摘要（让现有面板可同步显示）
        // 优先使用 endingSummary（已含 settlementResult 回退），避免 evalRes 缺失时降级为占位句
        const summary = endingSummary || '衣钵未竟，待后人接续。';
        s.setInheritancePool(pool, candidates, summary);
        // 5. 替换 character
        s.claimInheritanceCandidate(picked);
        // 6. 关闭引导面板，让玩家重新开始推进
        set({ deathGuidanceDismissed: false });
        return {
          ok: true,
          selectedId: picked,
          narrative: selection.narrative || '已承衣钵。',
          endingSummary: endingSummary, // ← 新增：UI 可展示上一世摘要
          evalError: evalError ? { message: (evalError && (evalError.message || evalError)) ? String(evalError.message || evalError) : 'unknown' } : null, // ← telemetry
        };
      },

      // Phase-M #2: resetCharacterToMortalStart — 「回归入凡」
      // 清空 character 回到 StartScreen（玩家可重新投胎）；保留 heritageVault / worldCalendar /
      //   settlementResult / hallOfSimulations 供后续阅读与世界延续。
      resetCharacterToMortalStart: () => set({
        character: null,
        pendingChoice: null,
        deathGuidanceDismissed: false,
        events: [],
        choices: [],
        selectedEventId: null,
        breakthroughCeremony: null,
        tribulationCeremony: null,
        tribulationResult: null,
        ascensionCeremony: null,
        restrictionChallenge: null,
        lastChange: null,
        lastBreakthrough: null,
        lastInterfere: null,
        // 注意：不重置 inheritancePool — 让玩家继续浏览候选；不重置 settlementResult — 玩家可阅读结局
      }),

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
        // Phase-M #3: 继承池清空
        inheritancePool: [], inheritanceCandidates: [], inheritanceEndingSummary: null,
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
          events: s.events,
          choices: s.choices,
          fateNodes: s.fateNodes,
          pendingChoice: s.pendingChoice,
          lastInterfereAge: s.lastInterfereAge,
          heritageVault: s.heritageVault,
          selectedHeritage: s.selectedHeritage,
          hallOfSimulations: s.hallOfSimulations,
          settlementResult: s.settlementResult,
          worldCalendar: s.worldCalendar,
          worldLegacies: s.worldLegacies,
          // Phase-M #3: 继承池需持久化，否则刷新页面后池子消失导致轮回卡死
          inheritancePool: s.inheritancePool,
          inheritanceCandidates: s.inheritanceCandidates,
          inheritanceEndingSummary: s.inheritanceEndingSummary,
          // Phase-M #4: 上次自动存档时间也持久化（刷新后顶部仍能看到）
          // 注意：lastAutoSaveError 不持久化（transient UI 状态）
          lastAutoSaveAt: s.lastAutoSaveAt,
        }),
        version: 3,
        migrate: (persisted: any, version: number) => {
          if (!persisted) return null;
          if (typeof persisted !== 'object') return null;
          // v1 → v2: 补全继承池字段（v1 partialize 不包含这三个字段，老用户 localStorage 中缺失）
          if (version < 2) {
            persisted = {
              ...persisted,
              inheritancePool: Array.isArray(persisted.inheritancePool) ? persisted.inheritancePool : [],
              inheritanceCandidates: Array.isArray(persisted.inheritanceCandidates) ? persisted.inheritanceCandidates : [],
              inheritanceEndingSummary: typeof persisted.inheritanceEndingSummary === 'string'
                ? persisted.inheritanceEndingSummary
                : null,
            };
          }
          // v2 → v3: 补全 lastAutoSaveAt（lastAutoSaveError 不持久化，无需迁移）
          if (version < 3) {
            persisted = {
              ...persisted,
              lastAutoSaveAt: typeof persisted.lastAutoSaveAt === 'string' ? persisted.lastAutoSaveAt : null,
            };
          }
          return persisted;
        },
      }
    )
  );
