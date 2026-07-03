import type { Realm, RealmProfile, RealmTraits, CombatProjectionTraits } from './realm';
import type { SpiritualRoot } from './spiritual-root';
import type { StatusEntry } from './status';
import type { ItemEntry, CultivationFactor, EquipSlot } from './item';
import type { TimeAdvance, EventBlueprint, PendingThread, QuestEntry, CharacterIntent } from './event';
import type { NarrativeContractFeedbackEntry } from './narrative';
import type { WorldNpc, NpcRef } from './npc';
import type { CausalGraph } from './causality';
import type { WorldFact } from './world-fact';
import type { EventSchedulerPlan } from './scheduler';
import type { Pet } from './pet';
import type { ExplorationRecord, SecretRealm } from './secret-realm';
import type { CombatSession } from './combat';
import type { SectHistoryEntry } from './sect';
import type { AscensionSession, Restriction, TribulationSession } from './tribulation-ascension';




export interface CultivationAttributeEntry {

  id: string;

  name: string;

  value?: number | string;

  description: string;

  source?: string;

  category?: 'body' | 'spirit' | 'dao' | 'combat' | 'fate' | 'custom';

  visible?: boolean;

}




// ==================== 引擎状态上下文 (注入给 AI) ====================



export interface EngineStateContext {

  character: {

    name: string;

    age: number;

    lifespan: number;

    gender: string;

    spiritualRoot: string;

    rootDetail: string;

    realm: string;

    realmName: string;

    realmLevel: number;

    realmMaxLevel: number;

    cultivationExp: number;

    expToBreak: number;

    elements: { metal: number; wood: number; water: number; fire: number; earth: number };

    hp: number; maxHp: number;

    mp: number; maxMp: number;

    attack: number; defense: number; speed: number;

    cultivationAttributes?: CultivationAttributeEntry[];

    spiritualSense: number; soulStrength: number; physicalFoundation: number;

    combatProjection?: CombatProjectionTraits;

    soulRealmName: string; soulRealmRank: number; soulRealmGap: string;

    luck: number; comprehension: number;

    spiritStones: number; reputation: number;

    faction: string; master: string; location: string;

    alive: boolean; ascended: boolean;

    // Task 22: 心魔值（0-100）——AI 可读取，可用 changes 中 attribute='heartDemon' 调整

    heartDemon: number;

    // ===== EngineStateContext.character 投影：因果业力 + 修炼心得（llm.ts 调用处用）=====
    karma?: number;
    merit?: number;
    sin?: number;
    cultivationInsight?: string;

  };

  // 修炼心得（当前已存的修炼速度说明文本，AI 可读取参考并决定是否更新）

  cultivationInsight: string;

  // 修炼速度来源结构化列表（AI 可读取上一轮的来源条目，本轮可调整）

  cultivationFactors: CultivationFactor[];

  activeStatuses: StatusEntry[];

  constitutionProfiles?: { name: string; category: string; stage: number; maxStage: number; resonance: string[]; riskHint?: string; hooks: string[] }[];

  inventory: ItemEntry[];

  // 已装备物品数组（无槽位上限，AI 可创造性装备：项链·储物戒指串、十指皆戴戒指等）

  equipped: ItemEntry[];

  // 储物袋容量上限（无袋 5；获得储物袋后增加）

  storageCapacity: number;

  // 修炼速度倍率（灵根 × 功法 × 其他装备的乘法效果之和）

  cultivationMultiplier: number;

  recentEvents: { age: number; title: string; narrative: string; eventType: string; timeLabel?: string; worldTimeLabel?: string }[];

  worldCalendar?: { eraName: string; calendarYear: number; elapsedDays: number; label?: string };

  previousWorldLegacies?: { characterName: string; status: string; summary: string; relicSeeds?: string[]; legendSeeds?: string[] }[];

  suggestedTimeAdvance?: TimeAdvance;

  narrativeContractFeedback: NarrativeContractFeedbackEntry[];

  longTermMemory: string[];

  completedFateNodes: number[];

  // 引擎能力告知

  availableAttributes: string[];   // AI 可改的属性列表

  nextFateNode?: { index: number; name: string; realm: string };

  realmTraits?: RealmTraits;

  // ===== Task 20 新增 =====

  // 本轮事件蓝图主题（引擎抽取，AI 必须围绕此主题生成事件）

  npcs: WorldNpc[];

  causalGraph: CausalGraph;

  worldFacts: WorldFact[];

  eventSchedule: EventSchedulerPlan;

  blueprint?: EventBlueprint;

  // 未决线索列表（AI 必须保持连续性；deadlineAge 临近的标记为 urgent）

  pendingThreads: PendingThread[];

  questEntries: QuestEntry[];

  // 角色主动意图（AI 应在事件中体现意图的执行）

  characterIntents: CharacterIntent[];

  // 最近 5 次事件类型（用于避免重复，AI 不得连续生成同类事件）

  recentEventTypes: string[];

  // 最近 3 次蓝图分类（避免连续同类主题）

  recentBlueprintCategories: string[];

  // ===== Task 23 新增 =====

  // 灵宠列表（AI 可读取玩家拥有的灵宠，并据此生成事件/触发灵宠技能）

  pets: Pet[];

  // ===== Task 24 新增 =====

  // 秘境探索记录（AI 可读取玩家已探秘境 + 冷却状态，避免重复推荐）

  exploredRealms: ExplorationRecord[];

  // 当前正在探索的秘境（仅 explore route 调用时设置，让 AI 围绕此秘境生成探索事件）

  currentExploration?: SecretRealm;

  discoveredRealms?: SecretRealm[];

  // ===== Phase-M: 风格锚定 + 实体库 prompt 注入（advance-preload 写入） =====

  styleAnchorsPrompt?: string;

  entityEntriesPrompt?: string;

}




// ==================== 角色状态（运行时） ====================



// 兼容旧存档：旧格式为 Partial<Record<EquipSlot, ItemEntry>>（slot-map），新格式为 ItemEntry[]（数组）

// dbToState 会在加载时把旧 slot-map 自动转换为数组

export type EquippedMap = Partial<Record<EquipSlot, ItemEntry>>;




export interface CharacterState {

  id: string;

  name: string;

  age: number;

  lifespan: number;

  gender: string;

  spiritualRoot: SpiritualRoot;

  rootDetail: string;

  rootMultiplier: number;

  realm: Realm;

  realmLevel: number;

  cultivationExp: number;

  expToBreak: number;

  elements: { metal: number; wood: number; water: number; fire: number; earth: number };

  hp: number; maxHp: number;

  mp: number; maxMp: number;

  attack: number; defense: number; speed: number;

  // Legacy numeric fields remain stored as attack/defense/speed; visible projection is force/guard/agility.

  combatProjection?: CombatProjectionTraits;

  // Core cultivation attributes may grow asynchronously from mana realm.

  spiritualSense?: number;

  soulStrength?: number;

  physicalFoundation?: number;

  soulRealmName?: string;

  soulRealmRank?: number;

  soulRealmGap?: string;

  realmTraits?: RealmTraits;

  // 当前战斗动作面板：由 AI/引擎生成，UI 只负责展示可交互内容

  cultivationAttributes?: CultivationAttributeEntry[];

  luck: number; comprehension: number;

  spiritStones: number; reputation: number;

  alive: boolean; ascended: boolean;

  causeOfDeath: string;

  faction: string; master: string; location: string;

  fateNodes: number[];

  isAtChoice: boolean;

  lastEventAge: number;

  activeStatuses: StatusEntry[];

  inventory: ItemEntry[];

  // 已装备物品数组（不再有 5 槽位上限——AI 可创造性放置，玩家也可戴多枚戒指等）

  equipped: ItemEntry[];

  // 储物袋容量上限（无袋 5；获得储物袋物品后增加；储物袋物品本身不占容量）

  storageCapacity: number;

  // 修炼速度倍率（灵根倍率 × 所有已装备物品的 multiply cultivationExp 效果之积）

  cultivationMultiplier: number;

  // 修炼心得：AI 生成的修炼速度说明文本（描述当前影响修炼速度的因素）

  cultivationInsight: string;

  // 修炼速度来源结构化条目（前端按 rarity 给来源上色 + 显示具体倍率数字）

  cultivationFactors: CultivationFactor[];

  // 境界画像：默认境界体系基础上的 AI/奇遇覆盖显示与强度信息

  realmProfile?: RealmProfile;

  longTermMemory: string[];

  // ===== Task 20 新增 =====

  // 未决线索列表（重要剧情线索，会在后续推进/到期触发）

  npcs: WorldNpc[];

  causalGraph: CausalGraph;

  worldFacts: WorldFact[];

  // 最近叙事契约审计反馈，仅用于调度/提示词的短期记忆潮汐，不持久化到角色状态。

  narrativeContractFeedback?: NarrativeContractFeedbackEntry[];

  pendingThreads: PendingThread[];

  questEntries: QuestEntry[];

  // 角色主动意图（引擎根据处境生成，AI 必须在事件中体现）

  characterIntents: CharacterIntent[];

  // 进行中的战斗（若有；持久化以支持页面刷新恢复）

  combatSession: CombatSession | null;

  // ===== Task 22 新增 =====

  // 心魔值 0-100：杀生/邪修/未解执念会增加；静修/净化物品/岁月流逝会减少

  // 30+ 修炼速度 -10%；60+ 偶发心魔试炼战斗；90+ 走火入魔风险（突死/重伤）

  heartDemon: number;

  // ===== Task 23 新增 =====

  // 灵宠列表（Pet[]）—— 玩家收服的灵宠

  pets: Pet[];

  // ===== Task 24 新增 =====

  // 秘境探索记录（ExplorationRecord[]）—— 玩家探索过的秘境 + 冷却追踪

  exploredRealms: ExplorationRecord[];

  discoveredRealms?: SecretRealm[]; // 从未决线索/物品/事件中解析出的剧情秘境

  // ===== AI-64: 道侣系统 =====

  spouse?: NpcRef | null;                  // 道侣（若已婚配）

  cultivationHarmonyBonus?: number;        // 修炼和谐加成 0-50（双修带来的速度加成）

  // ===== AI-66: 门籍/师徒链 =====

  sectHistory?: SectHistoryEntry[];        // 宗门历史（加入/离开/原因）

  teacherRef?: NpcRef | null;              // 师父

  apprentices?: NpcRef[];                  // 徒弟列表

  // ===== AI-72: L3 modals 接入 =====

  ascensionPending?: AscensionSession | null;   // 待结算飞升会话

  restrictionPending?: Restriction | null;      // 待交互禁制

  // ===== AI-74: Tribulation session 持久化 =====

  tribulationPending?: TribulationSession | null;   // 待渡劫会话

  tribulationResult?: { passed: boolean; narrative: string } | null;  // 最近渡劫结果

  // ===== Phase-M: statuses 别名（engine.ts 中引用，部分逻辑以 character.statuses 表达） =====

  statuses?: StatusEntry[];

  // ===== Task D 合并：store.ts 原 CharacterState 独有字段（保持 optional 以兼容 dbToState） =====

  // 展示用境界名/色（由 stateToResponse 在 engine.ts:5119 注入）

  realmName?: string;

  realmColor?: string;

  // 展示用境界最大级（profile override 后）

  realmMaxLevel?: number;

  // 境界整体强度倍率（profile override 后）

  realmPowerMultiplier?: number;

  // 每岁固定修为加成（来自 equipped + activeStatuses add cultivationExp 之和）

  cultivationFlatBonus?: number;

  // 最近一次突破记录（最近状态用）

  lastBreakthrough?: { newRealm: string } | null;

  // 世界历（与 db.Character.worldCalendar 镜像）

  worldCalendar?: { eraName: string; calendarYear: number; elapsedDays: number };

  // alive 的别名（UI 部分代码用 dead 表达）

  dead?: boolean;

  // ===== Phase-α 批 1 α-2: 因果业力 3 字段（修仙沉浸感 PoC）=====
  // 善恶连续轴 -1..+1；正为善 0..1，负为恶 -1..0
  karma: number;
  // 功德累计（≥0）
  merit: number;
  // 杀业累计（≥0）
  sin: number;
}


// ==================== Phase-α 批 1 α-2: 因果业力类型 ====================

// 一笔业力变化来源（事件 / 渡劫 / 继承 / 出身 / 化解）
export type KarmaShift = {
  merit?: number;
  sin?: number;
  karma?: number;
  reason: string;
  source: 'event' | 'tribulation' | 'inheritance' | 'origin' | 'reconcile';
};
