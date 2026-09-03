// AUTO-SPLIT from engine.ts — physical extraction only, logic unchanged.

import {
  combatVerdict,
  realmDiff,
} from '../realm-power';
import {
  CharacterState,
  AttributeChange,
  StatusEntry,
  StatusEffect,
  ItemEntry,
  TechniqueProfile,
  TechniqueRequirement,
  ArtifactAbility,
  ConstitutionProfile,
  ElementType,
  Realm,
  RealmProfile,
  REALMS,
  REALM_TRAITS,
  getRealmInfo,
  CombatProjectionTraits,
  getNextRealm,
  SpiritualRoot,
  SPIRITUAL_ROOTS,
  FATE_NODES,
  AIEventOutput,
  SpiritualRootChange,
  EngineStateContext,
  NarrativeOutcomeKind,
  EquipSlot,
  EquippedMap,
  ITEM_TYPE_LABEL,
  SLOT_LABEL,
  itemToSlot,
  ELEMENTS,
  CultivationFactor,
  EventBlueprint,
  EVENT_BLUEPRINTS,
  BlueprintCategory,
  CharacterIntent,
  PendingThread,
  QuestEntry,
  QuestEntryStage,
  CombatEnemy,
  CombatRound,
  CombatRoundProposal,
  CombatSession,
  CombatActionOption,
  CombatActionPalette,
  CombatActionGroupKey,
  Formation,
  FormationType,
  Pet,
  PetSpecies,
  PET_SPECIES_TEMPLATES,
  TalismanType,
  SecretRealm,
  SECRET_REALMS,
  ExplorationRecord,
  WorldNpc,
  WorldFact,
  WorldFactKind,
  CausalGraph,
  CausalNode,
  CausalEdge,
  EffectResolveTrace,
  CultivationAttributeEntry,
  AlchemyAIOutcome,
  CombatLootAIOutcome,
  PetBondAIOutcome,
  PetCareAIOutcome,
  HeartDemonType,
  WorldTier,
  AscensionRequirement,
  AscensionSession,
  Restriction,
  CombatStance,
  CombatStanceUsage,
  CombatResourceType,
  CombatResourceUsage,
  BreakthroughStage,
  BreakthroughAttempt,
  ComboChain,
  COMBAT_STANCE_LABEL,
  WorldRegion,
  RegionTier,
  LocationNode,
  TravelRoute,
  WorldMap,
  COMBAT_RESOURCE_LABEL,
  BREAKTHROUGH_STAGE_LABEL,
  SectFaction,
  SectRelation,
  SectNode,
  SectRelationEdge,
  SectRelationGraph,
  EndingArchetype,
  EndingCondition,
  EndingChoice,
  EndingOutcome,
  EndingPathMap,
  InheritanceKind,
  InheritanceRecipient,
  InheritanceClaim,
  InheritanceChain,
  InheritancePool,
  CraftingRecipe,
  CraftingSession,
  CraftingResult,
  CraftingSideEffect,
  TechniqueStudy,
  CombatLogEntry,
  LootTable,
  LootCondition,
  StatusExpireRule,
  StatusExpiryMeta,
  PetCultivationPath,
  PillRecipeUnlockCondition,
  PillRecipe,
  PillCraftResult,
  FormationStackRule,
  FormationStackResult,
  BidderPersonality,
  BidderAction,
  ThreadChainNode,
  BottleSpirit,
  SwordAptitude,
  InnatePhysique,
  FakeDeathRule,
  NPCMemoryEntry,
  WorldRumor,
  NPCMemoryTier,
  NPCMemory,
  NPCMemoryCluster,
  NPCBehaviorInfluence,
  SectPhase,
  SectEvent,
  SectPowerMetric,
  SectTrajectory,
  SectInfluenceMap,
  FateEchoKind,
  FateEchoTrigger,
  FateEchoResolution,
  FateWeb,
  FatePredictedOutcome,
} from '../types';
import type {
  PillSideEffect,
  PillEffectiveness,
  PillSideEffectResolution,
  FormationDrawingStep,
  FormationDrawingSession,
  FormationDrawingProgress,
  PetEvolutionStage,
  PetEvolutionRequirement,
  PetEvolutionEligibility,
  PetInsight,
  PetCommunication,
  PetCombatSkill,
  PetSkillUsage,
  PetCombatSkillEvent,
  SecretRealmTriggerCondition,
  SecretRealmEntryAttempt,
  BidderArchetype,
  BidderBehaviorProfile,
  CombatCauseChain,
  StalemateExit,
} from '../types';
import {
  COMBAT_PROJECTION_LABELS,
  sanitizeLootName,
  sanitizeNarrativeText,
} from '../display';
import {
  hasRealmEntryRequirement,
} from '../secret-realm-utils';
import {
  resolveAttributeChanges,
} from '../effect-resolver';
import {
  inferAttributeChangesFromNarrative,
} from '../narrative-inference';
import {
  applyAgeBasedBodyGrowth,
} from '../body-growth';
import {
  validateAIBoundary,
  BoundaryValidationTrace,
} from '../ai-boundary-validator';
import {
  buildStateChangeLog,
  StateChangeLogEntry,
} from '../state-change-log';
import {
  buildEventSchedulerPlan,
} from '../event-scheduler';
import {
  attemptTribulation,
  TRIBULATION_FATAL_KILLS,
  TRIBULATION_PILL_PATTERN,
} from '../tribulation/engine';
import {
  realmToMajor,
} from '../tribulation/types';
import {
  appendEvent,
} from '../events/store';
import {
  applyKarmaDelta,
  computeKarmaShiftFromEvent,
} from '../karma';
import {
  registerItem,
  registerMany,
  registerStatus,
  registerThread,
  registerNpc,
  ValidationTrace,
} from '../content-registry';
import type {
  KarmaShiftPayload,
} from '../events/types';

import {
  ATTRIBUTE_BOUNDS,
  computeCultivationFactors,
  computeEffectiveCultivationRate,
  deriveCombatProjection,
  deriveCoreCultivationAttributes,
  deriveCultivationAttributes,
  deriveRealmTraits,
  deriveSoulRealm,
  getRealmProfile,
  normalizeCultivationState,
  recalcCultivationMultiplier,
} from './attributes';
import {
  deriveHeartDemonProjection,
} from './heart-demon';
import {
  appendCausalGraph,
  causalId,
} from './causality';
import {
  startCombat,
} from './combat';
import {
  getDiscoveredStoryRealms,
} from './exploration';
import {
  derivePlayerSectRank,
} from './sect';
import {
  ItemEffectResolveResult,
  addItems,
  equipItemsByIds,
  removeItemsByIds,
  resolveItemEffects,
  unequipItemsByIds,
} from './items';
import {
  addMemory,
  applySpiritualRootChange,
} from './lifecycle';
import {
  addPet,
} from './pet';
import {
  tryBreakthrough,
} from './progression';
import {
  normalizeThreadsCompletion,
  realmPowerMultiplier,
  sanitizeRealmProfile,
} from './shared';
import {
  addStatuses,
} from './statuses';
import {
  addThreads,
  advanceThread,
  buildQuestEntriesFromThreads,
  checkThreadDeadlines,
  completeThread,
  failThread,
  generateCharacterIntents,
} from './threads';
import {
  refreshWorldFacts,
  upsertNpcs,
} from './world';

function applyRealmProfilePatch(state: CharacterState, patch?: RealmProfile): CharacterState {
  const profile = sanitizeRealmProfile(patch);
  if (!profile) return state;
  const current = getRealmProfile(state) || {};
  return { ...state, realmProfile: { ...current, ...profile } };
}

function scaleByRealmPower(value: number, mult: number): number {
  return Math.max(1, Math.floor(value * mult));
}

// ==================== 属性变更应用 (引擎权威) ====================

// AI 可影响的属性白名单 + 钳制范围
// 注意：age（年龄）不在白名单内——年龄推进是引擎独占职责
//   - advance 流程：引擎 state.age += 1
//   - interfere 流程：引擎根据 AI 的 ageAdvance 字段推进
//   AI 不得通过 changes 直接修改 age，否则会与引擎推进叠加导致跳岁
function factNameKey(value?: string) {
  return String(value || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/^(?:[^\u4e00-\u9fa5]{0,4})/, '')
    .slice(0, 24);
}

function knownItemNameSet(state: CharacterState) {
  return new Set([...(state.inventory || []), ...(state.equipped || [])].map(it => factNameKey(it.name)).filter(Boolean));
}

function filterAlreadyKnownItems(state: CharacterState, items: ItemEntry[]) {
  const known = knownItemNameSet(state);
  const accepted: ItemEntry[] = [];
  const rejectedNames: string[] = [];
  for (const item of items || []) {
    const key = factNameKey(item.name);
    if (key && known.has(key)) {
      rejectedNames.push(item.name);
      continue;
    }
    if (key) known.add(key);
    accepted.push(item);
  }
  return { accepted, rejectedNames };
}

function escapeStoryRegExp(value: string) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeNarrativeKnownFactRepetition(text: string, state: CharacterState, duplicateItemNames: string[] = []) {
  let out = String(text || '');
  const names = Array.from(new Set([
    ...duplicateItemNames,
    ...(state.inventory || []).map(it => it.name),
    ...(state.equipped || []).map(it => it.name),
  ].filter(Boolean))).slice(0, 40);
  for (const name of names) {
    const safe = escapeStoryRegExp(name);
    const inquire = new RegExp(`[^\u3002\uff01\uff1f\uff1b]{0,40}${safe}[^\u3002\uff01\uff1f\uff1b]{0,40}(?:\u54ea\u91cc\u53ef\u4ee5\u83b7\u5f97|\u4f55\u5904\u53ef\u5f97|\u4ece\u4f55\u5f97\u6765|\u5982\u4f55\u83b7\u5f97|\u4ece\u4f55\u800c\u6765)[^\u3002\uff01\uff1f\uff1b]*[\u3002\uff01\uff1f\uff1b]?`, 'g');
    out = out.replace(inquire, `${state.name}\u4e0d\u518d\u8ffd\u95ee${name}\u4ece\u4f55\u800c\u6765\uff0c\u8f6c\u800c\u6838\u5bf9\u5176\u4fee\u4e60\u95e8\u69db\u4e0e\u540e\u7eed\u7528\u6cd5\u3002`);
    const obtain = new RegExp(`[^\u3002\uff01\uff1f\uff1b]{0,30}(?:\u5076\u7136\u6240\u5f97|\u5076\u7136\u83b7\u5f97|\u62fe\u5f97|\u6361\u5230|\u53c8\u5f97|\u518d\u6b21\u83b7\u5f97|\u83b7\u5f97\u4e86|\u5f97\u5230)${safe}[^\u3002\uff01\uff1f\uff1b]*[\u3002\uff01\uff1f\uff1b]?`, 'g');
    out = out.replace(obtain, `${state.name}\u91cd\u65b0\u53d6\u51fa\u5df2\u5728\u8eab\u8fb9\u7684${name}\uff0c\u628a\u5fc3\u601d\u653e\u5728\u5982\u4f55\u627f\u63a5\u5176\u56e0\u679c\u3002`);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function itemAcquisitionMemories(age: number, items: ItemEntry[]) {
  return (items || []).slice(0, 6).map(item => `${age}\u5c81\u5df2\u83b7\u5f97${item.name}${item.source ? `\uff0c\u6765\u6e90\uff1a${item.source}` : ''}`);
}

// 添加物品到 inventory。若物品是储物袋（含 storageCapacity 效果的 tool），自动增加 storageCapacity。
// 兜底：若 AI 给了无效 item_type（如 'storage'），但物品含 storageCapacity 效果，则强转 item_type='tool'。
// 兜底：若物品名含功法关键词（诀/经/典/录/篇/功法）但 item_type 不是 scripture，强转 scripture 并补默认效果
// Task 22: 容量限制——超过 storageCapacity 时丢弃多余物品（储物袋本身优先保留，因可扩容）
function recordEventCausality(state: CharacterState, aiOutput: AIEventOutput): CharacterState {
  const age = state.age;
  const eventId = causalId('event', age + '_' + (aiOutput.title || 'event'));
  const nodes: CausalNode[] = [{
    id: eventId,
    type: aiOutput.triggerCombat ? 'combat' : 'event',
    label: aiOutput.title || '无名事件',
    age,
    summary: (aiOutput.causalSummary || aiOutput.memory || aiOutput.narrative || '').slice(0, 180),
    tags: [aiOutput.eventType || 'normal'],
  }];
  const edges: CausalEdge[] = [];

  for (const thread of state.pendingThreads || []) {
    const nodeId = causalId('thread', thread.id);
    nodes.push({ id: nodeId, type: 'thread', label: thread.title, age: thread.startAge || age, refId: thread.id, summary: thread.description?.slice(0, 140), tags: [thread.status, thread.category] });
    const edgeType = (aiOutput.completeThreadIds || []).includes(thread.id) ? 'resolved'
      : (aiOutput.failThreadIds || []).includes(thread.id) ? 'failed'
      : (aiOutput.newThreads || []).some(t => t.id === thread.id) ? 'created'
      : (aiOutput.advanceThreads || []).some(t => t.id === thread.id) ? 'updated'
      : undefined;
    if (edgeType) edges.push({ id: causalId('edge', eventId + '_' + edgeType + '_' + nodeId), from: eventId, to: nodeId, type: edgeType, age, summary: thread.followUpHint || thread.description?.slice(0, 80) });
  }

  for (const npc of state.npcs || []) {
    const mentioned = (aiOutput.newNpcs || []).some(n => n.id === npc.id || n.name === npc.name) || (aiOutput.triggerCombat?.enemies || []).some(e => npc.name && e.name === npc.name);
    if (!mentioned) continue;
    const nodeId = causalId('npc', npc.id);
    nodes.push({ id: nodeId, type: 'npc', label: npc.name, age: npc.firstMetAge ?? age, refId: npc.id, summary: npc.memory || npc.description, tags: [npc.attitude, npc.role || 'npc'].filter(Boolean) });
    edges.push({ id: causalId('edge', eventId + '_mentions_' + nodeId), from: eventId, to: nodeId, type: 'mentions', age, summary: npc.memory || npc.description?.slice(0, 80) });
  }

  for (const item of [...(aiOutput.newItems || []), ...(aiOutput.newEquippedItems || [])]) {
    if (!item?.id || !item?.name) continue;
    const nodeId = causalId('item', item.id);
    nodes.push({ id: nodeId, type: 'item', label: item.name, age, refId: item.id, summary: item.description?.slice(0, 120), tags: [item.rarity, item.item_type].filter(Boolean) });
    edges.push({ id: causalId('edge', eventId + '_rewards_' + nodeId), from: eventId, to: nodeId, type: 'rewards', age, summary: item.source });
  }

  for (const status of aiOutput.newStatuses || []) {
    if (!status?.id || !status?.name) continue;
    const nodeId = causalId('status', status.id);
    nodes.push({ id: nodeId, type: 'status', label: status.name, age, refId: status.id, summary: status.description?.slice(0, 120), tags: [status.category] });
    edges.push({ id: causalId('edge', eventId + '_caused_' + nodeId), from: eventId, to: nodeId, type: 'caused', age, summary: status.description?.slice(0, 80) });
  }

  return appendCausalGraph(state, nodes, edges);
}
// ==================== WorldFacts Lite ====================

function combatEnemiesToNpcs(enemies: CombatEnemy[] | undefined, aiOutput: AIEventOutput, state: CharacterState): Partial<WorldNpc>[] {
  if (!Array.isArray(enemies)) return [];
  return enemies
    .filter(e => e?.name && !String(e.name).includes('心魔'))
    .map(e => ({
      id: e.id ? `npc_${e.id}` : undefined,
      name: e.name,
      description: e.description || e.name,
      role: '战斗对手',
      realm: e.realm,
      attitude: 'hostile' as const,
      relationshipScore: -40,
      firstMetAge: state.age,
      lastSeenAge: state.age,
      lastKnownLocation: state.location,
      source: aiOutput.title,
      memory: aiOutput.narrative ? aiOutput.narrative.slice(0, 180) : undefined,
      tags: ['combat'],
    }));
}

function scheduleHintId(prefix: string, raw: string): string {
  return `seh_${prefix}_${String(raw || 'unknown').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, '_').slice(0, 60)}`;
}

function narrativeOutcomeThreadIds(state: CharacterState, aiOutput: AIEventOutput): string[] {
  const contract = aiOutput.narrativeContract;
  if (!contract?.narrativeOutcome) return [];
  const ids = new Set<string>();
  const usedHintIds = new Set((contract.usedScheduleHintIds || []).filter(Boolean));
  const focusText = [aiOutput.title, contract.contractNote].filter(Boolean).join('；');
  for (const thread of state.pendingThreads || []) {
    if (!thread?.id || thread.status === 'resolved' || thread.status === 'failed') continue;
    const directIds = [
      thread.id,
      scheduleHintId('thread', thread.id),
      scheduleHintId('quest', `quest_${thread.id}`),
      scheduleHintId('quest', thread.id),
    ];
    if (directIds.some(id => usedHintIds.has(id))) {
      ids.add(thread.id);
      continue;
    }
    const title = String(thread.title || '').trim();
    if (title && title.length >= 3 && focusText.includes(title)) ids.add(thread.id);
  }
  return Array.from(ids);
}

function syncThreadsFromNarrativeOutcome(state: CharacterState, aiOutput: AIEventOutput): CharacterState {
  const outcome = aiOutput.narrativeContract?.narrativeOutcome as NarrativeOutcomeKind | undefined;
  if (!outcome) return state;
  const threadIds = narrativeOutcomeThreadIds(state, aiOutput)
    .filter(id => !(aiOutput.completeThreadIds || []).includes(id) && !(aiOutput.failThreadIds || []).includes(id));
  if (!threadIds.length) return state;
  let next = state;
  for (const id of threadIds) {
    if (outcome === 'resolved') {
      next = completeThread(next, id);
    } else if (outcome === 'failed') {
      next = failThread(next, id);
    } else if (outcome === 'advanced') {
      const current = next.pendingThreads?.find(t => t.id === id);
      const remaining = Math.max(0, 100 - Number(current?.progress || 0));
      next = advanceThread(next, id, Math.min(35, Math.max(10, remaining)), aiOutput.narrativeContract?.contractNote || aiOutput.title);
    }
  }
  return next;
}

// 检查线索 deadline —— 若有线索已过期（age > deadlineAge）且未完成，标记为 failed
const INFANT_NARRATIVE_REWRITES: Array<{ pattern: RegExp; replacement: string }> = [
  // "独自 + 动词" → "被带去 + 动词" 或 "懵懂地看着"
  { pattern: /独自(?:前往|赶路|寻访|追踪|追查|探查|探访|赴约|出行|启程)/g, replacement: '懵懂地被抱在怀中、随长者前往' },
  { pattern: /独自(?:追寻|寻找|寻找|追捕|行路|翻山)/g, replacement: '在长者怀中懵懂地望着' },
  { pattern: /(?:他|她|你|角色)(?:独自|单独|一人)(?:前往|赶路|寻访|追踪|追查|探查|探访|赴约|出行|启程|上路)/g, replacement: '在长者看护下被抱去' },
  { pattern: /(?:他|她|你|角色)(?:独自|单独|一人)(?:追寻|寻找|追捕|行路|翻山)/g, replacement: '在长者看护下懵懂张望' },
  // 纯动词
  { pattern: /(?:^|[，。；\s])(?:前往|赶路|追查|追踪|探查|探访|赴约|寻访|独行|赶赴|登程|启程|上路)/g, replacement: '$1在长者看护下被抱去' },
];

function rewriteInfantNarrative(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { pattern, replacement } of INFANT_NARRATIVE_REWRITES) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  // 句中独立"独自"也做柔和兜底
  out = out.replace(/(?<![一-龥])(独自)(?![一-龥])/g, '在长者看护下');
  return out;
}

// P1-10 cultivationInsight 清洗 wrapper：调用 sanitizeNarrativeText
// 防止 AI 把"破境进度 +12""修为 +5"等内部机制词塞进修炼心得。
export interface EngineExecutionResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  contentRegistryTrace: ValidationTrace[];
  contentRegistryWarnings: string[];
  effectResolveTrace: EffectResolveTrace[];
  effectResolveWarnings: string[];
  aiBoundaryTrace: BoundaryValidationTrace[];
  aiBoundaryWarnings: string[];
  stateChangeLog: StateChangeLogEntry[];
  breakthroughHappened: boolean;
  newRealm?: Realm;
  breakthroughMajor?: boolean;
  breakthroughSteps?: number;
  breakthroughReasonAccepted?: boolean;
  died: boolean;
  deathReason?: string;
  // 2026-07-12：实际从 inventory/equipped 被移除的物品 id 列表（AI claimed + 引擎实际删的）。
  // 用于 buildEventDisplayEffects 渲染"失去：XXX"chip —— 之前只透 appliedChanges 不透 removedItemIds，
  // 玩家看到 narrative 写"服用丹药"但背包里丹药还在，沉浸感断。
  removedItemIds?: string[];
}

// ==================== AI 事件执行：处理器管线 ====================
// 重构：原 executeAIEvent 是 20+ 个编号顺序步骤的单体巨函数（424 行）。
// 现改为「共享 ExecCtx + 有序处理器数组」：
//   - 每个处理器 (ctx) => void，只读写 ctx，逐块搬自原函数，副作用与顺序逐字保持不变；
//   - 新增 AI 能力 = 往 AI_EVENT_PROCESSORS 数组追加一个处理器，无需再改巨函数；
//   - 执行顺序 = 数组顺序，与原编号步骤 0→1→2→3.5→3→3.6→3.7→3.8→4→4.2→4.5→5→α→6→7→8 完全一致。
// 关键不变量：输入 (state, aiOutput) 与输出 EngineExecutionResult 与重构前逐字段一致。

interface ExecCtx {
  /** 原始入参 state（buildStateChangeLog 的 before 基准，不可变） */
  readonly state: CharacterState;
  /** 逐步演进的角色状态（原函数里的 next） */
  next: CharacterState;
  aiOutput: AIEventOutput;
  rejected: AttributeChange[];
  contentRegistryTrace: ValidationTrace[];
  contentRegistryWarnings: string[];
  effectResolveTrace: EffectResolveTrace[];
  effectResolveWarnings: string[];
  appliedChanges: AttributeChange[];
  boundaryValidation: ReturnType<typeof validateAIBoundary>;
  breakthroughHappened: boolean;
  newRealm?: Realm;
  breakthroughMajor: boolean;
  breakthroughSteps: number;
  breakthroughReasonAccepted: boolean;
  died: boolean;
  deathReason?: string;
  /**
   * 本次结算里「渡劫」那条支路是否已经记过一笔功过。
   * 记过就不再让 procKarmaShift 二次落账——同一件事不能被算两遍善恶。
   */
  karmaShiftedByTribulation: boolean;
  collectItemResolve(resolved: ItemEffectResolveResult): void;
  // 2026-07-12：收集本次实际从 inventory/equipped 被移除的物品 id，供显示层渲染"失去：XXX"chip
  removedItemIds: string[];
}

type AIEventProcessor = (ctx: ExecCtx) => void;

// P1-8 幼龄硬拦截：age<6 禁止 triggerCombat / 禁止独立赶路 / 禁止独立赴约
const procInfantGuard: AIEventProcessor = (ctx) => {
  const { next, aiOutput } = ctx;
  if (next.age < 6) {
    if (aiOutput.triggerCombat) {
      ctx.contentRegistryTrace.push({
        severity: 'warning',
        code: 'infant_blocked_combat',
        attribute: '*',
        message: `age<6 (${next.age}) 幼龄引擎拦截 triggerCombat：幼龄不宜动武`,
        source: aiOutput.title || 'executeAIEvent',
      });
      ctx.contentRegistryWarnings.push('幼龄角色不可触发战斗，已剥离 triggerCombat');
      aiOutput.triggerCombat = undefined;
    }
    if (aiOutput.hasChoice) {
      ctx.contentRegistryTrace.push({
        severity: 'warning',
        code: 'infant_blocked_choice',
        attribute: '*',
        message: `age<6 (${next.age}) 幼龄引擎拦截 hasChoice：幼龄不可独立抉择`,
        source: aiOutput.title || 'executeAIEvent',
      });
      ctx.contentRegistryWarnings.push('幼龄角色不可独立抉择，已剥离 hasChoice/choice');
      aiOutput.hasChoice = false;
      aiOutput.choice = undefined;
    }
    if (typeof aiOutput.narrative === 'string' && aiOutput.narrative) {
      aiOutput.narrative = rewriteInfantNarrative(aiOutput.narrative);
    }
  }
};

// 已知物品重复叙事清洗
const procDedupeNarrative: AIEventProcessor = (ctx) => {
  const { aiOutput, state } = ctx;
  const preExistingItemNames = knownItemNameSet(state);
  const duplicateNarrativeItems = [...(aiOutput.newItems || []), ...(aiOutput.newEquippedItems || [])]
    .map(item => item?.name)
    .filter((name): name is string => !!name && preExistingItemNames.has(factNameKey(name)));
  if (duplicateNarrativeItems.length) {
    aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, state, duplicateNarrativeItems);
  }
};

// 0. 年龄驱动的身体成长 + 叙事修正
// - state 侧：拉到 baseline（若 current > baseline 则保留 current，故无 delta）
// - UI 侧：把 4 项 growth delta 补一份到 appliedChanges，让事件卡片能看到
//   「破势/护持/机变/气血上限 ±N（年岁 xx）」chip，玩家肉眼可见成长曲线在运作
const procBodyGrowth: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  const bodyGrowth = applyAgeBasedBodyGrowth(ctx.next, ctx.next.age, aiOutput.narrative);
  if (bodyGrowth.growth.attack || bodyGrowth.growth.defense || bodyGrowth.growth.speed || bodyGrowth.growth.maxHp) {
    ctx.next = bodyGrowth.state;
    // 依年龄段选 reason 文案，避免机制词；婴幼/少年/壮年/中年/老年分段
    const age = ctx.next.age;
    const bodyModeReason = bodyGrowth.bodyModifier.mode === 'critically_ill'
      ? '久病难愈，身骨凋敝'
      : bodyGrowth.bodyModifier.mode === 'weak'
        ? '旧疾未消，气血未复'
        : bodyGrowth.bodyModifier.mode === 'recovered'
          ? '病愈初起，身骨渐复'
          : '';
    let reason: string;
    if (bodyModeReason) {
      reason = bodyModeReason;
    } else if (age <= 5) {
      reason = '襁褓渐长，身骨初开';
    } else if (age <= 12) {
      reason = '年岁滋养，身骨渐盈';
    } else if (age <= 18) {
      reason = '少年抽条，筋骨拔节';
    } else if (age <= 40) {
      reason = '壮年当盛，气血充盈';
    } else if (age <= 60) {
      reason = '年岁渐长，气血微减';
    } else if (age <= 80) {
      reason = '中年之末，筋骨略衰';
    } else {
      reason = '暮年将至，气血凋零';
    }
    const growthChanges: AttributeChange[] = [];
    if (bodyGrowth.growth.attack) growthChanges.push({ attribute: 'attack', delta: bodyGrowth.growth.attack, reason });
    if (bodyGrowth.growth.defense) growthChanges.push({ attribute: 'defense', delta: bodyGrowth.growth.defense, reason });
    if (bodyGrowth.growth.speed) growthChanges.push({ attribute: 'speed', delta: bodyGrowth.growth.speed, reason });
    if (bodyGrowth.growth.maxHp) growthChanges.push({ attribute: 'maxHp', delta: bodyGrowth.growth.maxHp, reason });
    ctx.appliedChanges.push(...growthChanges);
    ctx.effectResolveTrace.push({
      severity: 'info',
      code: 'age_body_growth',
      attribute: '*',
      message: `Age ${ctx.next.age} body growth: factor=${bodyGrowth.factor.toFixed(2)}, realmMult=${bodyGrowth.realmMultiplier.toFixed(2)}, bodyMod=${bodyGrowth.bodyModifier.mode}(${bodyGrowth.bodyModifier.multiplier}x, ${bodyGrowth.bodyModifier.reason}), deltas=atk:${bodyGrowth.growth.attack} def:${bodyGrowth.growth.defense} spd:${bodyGrowth.growth.speed} hp:${bodyGrowth.growth.maxHp}`,
      source: aiOutput.title || 'age-body-growth',
    });
  }
};

// 1. Apply attribute changes through EffectResolver / ERPE Lite.
const procAttributeChanges: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  let inputChanges = aiOutput.changes || [];
  if (inputChanges.length === 0 && aiOutput.narrative) {
    const fallback = inferAttributeChangesFromNarrative(aiOutput.narrative, ctx.next, aiOutput.title || 'ai-event');
    if (fallback.length > 0) {
      inputChanges = fallback;
      ctx.effectResolveTrace.push({
        severity: 'info',
        code: 'engine_inferred_changes',
        attribute: '*',
        message: `Engine inferred ${fallback.length} attribute change(s) from narrative (AI output empty changes)`,
        source: aiOutput.title || 'ai-event',
      });
    }
  }
  const resolvedChanges = resolveAttributeChanges(ctx.next, inputChanges, {
    bounds: ATTRIBUTE_BOUNDS,
    source: aiOutput.title || 'ai-event',
  });
  ctx.next = resolvedChanges.state;
  ctx.appliedChanges.push(...resolvedChanges.appliedChanges);
  ctx.rejected.push(...resolvedChanges.rejectedChanges);
  ctx.effectResolveTrace.push(...resolvedChanges.trace);
  ctx.effectResolveWarnings.push(...resolvedChanges.trace.filter(t => t.severity !== 'info').map(t => t.message));
};

// 2. 新状态先经过 ContentRegistry Lite 统一校验/补全，再进入状态系统
const procStatuses: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  const registered = registerMany(aiOutput.newStatuses || [], registerStatus, {
    source: aiOutput.title,
    age: ctx.next.age,
    existingIds: ctx.next.activeStatuses.map(s => s.id),
  });
  ctx.contentRegistryTrace.push(...registered.trace);
  ctx.contentRegistryWarnings.push(...registered.warnings);
  ctx.next = addStatuses(ctx.next, registered.accepted);
  const explicitAttributes = (aiOutput.cultivationAttributes || [])
    .filter(attr => attr && attr.name && attr.visible !== false)
    .map(attr => ({ ...attr, id: attr.id || attr.name }));
  ctx.next.cultivationAttributes = [
    ...deriveCultivationAttributes(ctx.next),
    ...explicitAttributes,
  ].slice(0, 24);
};

// 3.5 AI 联动：移除/破坏物品
const procRemovedItems: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.removedItemIds && aiOutput.removedItemIds.length) {
    const rem = removeItemsByIds(ctx.next, aiOutput.removedItemIds);
    ctx.next = rem.state;
    ctx.collectItemResolve(rem);
    // 2026-07-12：把真正删掉的 id 收进 ctx，给显示层做"失去"chip 用
    for (const r of rem.removed || []) {
      if (r && r.id) ctx.removedItemIds.push(r.id);
    }
  }
};

// 3. 新物品先经过 ContentRegistry Lite 统一校验/补全，再进入背包系统
const procNewItems: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  const rawNew = aiOutput.newItems || [];
  if (rawNew.length) {
    const registered = registerMany(rawNew, registerItem, {
      source: aiOutput.title,
      age: ctx.next.age,
      existingIds: [...ctx.next.inventory, ...(ctx.next.equipped || [])].map(it => it.id),
    });
    ctx.contentRegistryTrace.push(...registered.trace);
    ctx.contentRegistryWarnings.push(...registered.warnings);
    const deduped = filterAlreadyKnownItems(ctx.next, registered.accepted);
    if (deduped.rejectedNames.length) {
      ctx.contentRegistryWarnings.push(`已拥有物品不重复发放：${deduped.rejectedNames.join('、')}`);
      aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, ctx.next, deduped.rejectedNames);
    }
    ctx.next = addItems(ctx.next, deduped.accepted);
    for (const memo of itemAcquisitionMemories(ctx.next.age, deduped.accepted)) ctx.next = addMemory(ctx.next, memo);
  }
};

// 3.6 AI 联动：直接放入已装备的物品
const procNewEquippedItems: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.newEquippedItems && aiOutput.newEquippedItems.length) {
    const registered = registerMany(aiOutput.newEquippedItems, registerItem, {
      source: aiOutput.title,
      age: ctx.next.age,
      existingIds: [...ctx.next.inventory, ...(ctx.next.equipped || [])].map(it => it.id),
    });
    ctx.contentRegistryTrace.push(...registered.trace);
    ctx.contentRegistryWarnings.push(...registered.warnings);
    const deduped = filterAlreadyKnownItems(ctx.next, registered.accepted);
    if (deduped.rejectedNames.length) {
      ctx.contentRegistryWarnings.push(`已拥有物品不重复装备：${deduped.rejectedNames.join('、')}`);
      aiOutput.narrative = sanitizeNarrativeKnownFactRepetition(aiOutput.narrative, ctx.next, deduped.rejectedNames);
    }
    const newEqItems = deduped.accepted;
    ctx.next = {
      ...ctx.next,
      equipped: [...(ctx.next.equipped || []), ...newEqItems],
    };
    for (const memo of itemAcquisitionMemories(ctx.next.age, newEqItems)) ctx.next = addMemory(ctx.next, memo);
    for (const it of newEqItems) {
      const resolved = resolveItemEffects(ctx.next, it, 1, `生成并装备 ${it.name}`);
      ctx.next = resolved.state;
      ctx.collectItemResolve(resolved);
    }
    ctx.next = recalcCultivationMultiplier(ctx.next);
  }
};

// 3.7 AI 联动：把背包里的物品装备上去
const procEquipItems: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.equipItemIds && aiOutput.equipItemIds.length) {
    const r = equipItemsByIds(ctx.next, aiOutput.equipItemIds);
    ctx.next = r.state;
    ctx.collectItemResolve(r);
  }
};

// 3.8 AI 联动：把已装备的物品卸下来
const procUnequipItems: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.unequipItemIds && aiOutput.unequipItemIds.length) {
    const r = unequipItemsByIds(ctx.next, aiOutput.unequipItemIds);
    ctx.next = r.state;
    ctx.collectItemResolve(r);
  }
};

// 4. 添加长期记忆
const procMemory: AIEventProcessor = (ctx) => {
  if (ctx.aiOutput.memory) ctx.next = addMemory(ctx.next, ctx.aiOutput.memory);
};

// 4.2 灵根蜕变：只有结构化 spiritualRootChange 会改变角色灵根
const procSpiritualRoot: AIEventProcessor = (ctx) => {
  const rootChange = applySpiritualRootChange(ctx.next, ctx.aiOutput.spiritualRootChange);
  ctx.next = rootChange.state;
  if (rootChange.applied) ctx.appliedChanges.push(rootChange.applied);
  if (rootChange.trace) {
    ctx.effectResolveTrace.push(rootChange.trace);
    if (rootChange.trace.severity !== 'info') ctx.effectResolveWarnings.push(rootChange.trace.message);
  }
};

// 4.5 更新修炼心得文本 + 归一修炼状态
const procCultivationInsight: AIEventProcessor = (ctx) => {
  if (ctx.aiOutput.cultivationInsight && ctx.aiOutput.cultivationInsight.trim()) {
    ctx.next.cultivationInsight = ctx.aiOutput.cultivationInsight.trim();
  }
  ctx.next = normalizeCultivationState(ctx.next);
};

// 5. 处理突破 + α: 大境突破引雷劫判定（沉浸版 PoC）
const procBreakthrough: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  // 2026-08-31：先把突破前的境界记下。
  //   tryBreakthrough 一成功 ctx.next 就已经是新境界了，底下雷劫那段却拿 next.realm
  //   当「从哪来」，写进事件流的 fromRealm 一直等于 toRealm；跌境要回退更非得有原值不可。
  const realmBefore = ctx.next.realm;
  const realmLevelBefore = ctx.next.realmLevel;
  if (aiOutput.triggeredBreakthrough) {
    const br = tryBreakthrough(ctx.next, {
      reason: aiOutput.breakthroughReason,
      targetRealm: aiOutput.breakthroughTargetRealm,
      targetLevel: aiOutput.breakthroughTargetLevel,
    });
    if (br.success) {
      ctx.next = br.state;
      ctx.breakthroughHappened = true;
      ctx.newRealm = br.newRealm;
      ctx.breakthroughMajor = Boolean(br.major);
      ctx.breakthroughSteps = br.steps || 1;
      ctx.breakthroughReasonAccepted = Boolean(br.reasonAccepted);
      if (br.reasonAccepted && aiOutput.realmProfilePatch) {
        ctx.next = applyRealmProfilePatch(ctx.next, aiOutput.realmProfilePatch);
      }
    }
  }

  // ===== 大境突破引雷劫判定 =====
  if (ctx.breakthroughHappened && ctx.breakthroughMajor && ctx.newRealm && ctx.next.id) {
    try {
      const targetMajor = realmToMajor(ctx.newRealm);
      if (targetMajor) {
        const next = ctx.next;
        const inventory: any[] = Array.isArray((next as any).inventory) ? (next as any).inventory : [];
        // 本命法宝认物品自带的 bonded 标记——types/item.ts 那一行写明「仅能一件，渡劫时共鸣」。
        // 原判据是「身上有任何装备」，等于人人常驻一份加成，本命二字形同虚设。
        const hasBondedArtifact = inventory.some((it) => it?.bonded === true);
        // 渡劫丹按名目认。调用处此前把这一项写死 false，丹药兜底那条规则从来没生效过。
        const pillIndex = inventory.findIndex(
          (it) => it?.item_type === 'consumable' && TRIBULATION_PILL_PATTERN.test(String(it?.name || '')),
        );
        const hasTribulationPill = pillIndex >= 0;
        // 神识字段量程是 0-9999（attributes.ts），雷劫引擎的入参契约却是 0-100。
        // 原先把四位数直接塞进「大于 70」的判断里，稍微修出点神识就永久挂着加成。
        const soulStrength = Math.round(
          Math.max(0, Math.min(100, (Number((next as any).soulStrength) || 0) / 9999 * 100)),
        );
        const tribulationInput = {
          character: {
            id: next.id,
            name: next.name,
            age: next.age,
            realm: realmToMajor(realmBefore) || 'mortal',
          },
          targetRealm: targetMajor,
          hpRatio: next.maxHp > 0 ? Math.max(0, Math.min(1, next.hp / next.maxHp)) : 0.5,
          soulStrength,
          heartDemon: (next as any).heartDemon ?? 30,
          hasBondedArtifact,
          hasTribulationPill,
        };
        const tribulationResult = attemptTribulation(tribulationInput);
        const fromRealm = realmBefore;
        const toRealm = ctx.newRealm;
        const tribKarmaDelta = (() => {
          if (tribulationResult.outcome === 'success') return applyKarmaDelta({ karma: next.karma, merit: next.merit, sin: next.sin }, { meritDelta: 2 });
          if (tribulationResult.outcome === 'severe' || tribulationResult.outcome === 'fatal') return applyKarmaDelta({ karma: next.karma, merit: next.merit, sin: next.sin }, { sinDelta: 1 });
          return null;
        })();
        const karmaShiftPayload: KarmaShiftPayload | undefined = tribKarmaDelta && tribKarmaDelta.applied ? {
          meritDelta: tribulationResult.outcome === 'success' ? 2 : 0,
          sinDelta: tribulationResult.outcome === 'severe' || tribulationResult.outcome === 'fatal' ? 1 : 0,
          karmaDelta: tribKarmaDelta.karma - next.karma,
          reason: tribulationResult.outcome === 'success' ? '渡过天劫善缘有感' : (tribulationResult.outcome === 'severe' ? '天劫重创业火缠身' : '天劫之下罪业浮现'),
        } : undefined;
        // 渡劫这笔功过已入账（进事件流），标记之，procKarmaShift 见此即让位，避免同事件双记。
        if (karmaShiftPayload) ctx.karmaShiftedByTribulation = true;

        // ===== 2026-08-31：判定结果真落到角色身上 =====
        //   此前这一段只入功过账 + 写一条事件流，算出来的 hpDelta 从没赋给 next.hp，
        //   outcome 为 fatal 也不置 alive，跌境不退境。于是天劫的全部后果
        //   就是功过表上 ±1 —— 劫数等于没渡。
        const maxHpForTrib = Math.max(1, Number(next.maxHp) || 100);
        // 引擎给的 hpDelta 是按满血 100 写的，这里按真实上限折算，
        // 免得满血四百的角色挨一记「重伤 60」只掉一成半。
        const scaledDelta = Math.round(maxHpForTrib * (tribulationResult.hpDelta / 100));
        const hpBeforeTrib = Math.max(0, Number(next.hp) || 0);
        let appliedHp = Math.max(0, Math.min(maxHpForTrib, hpBeforeTrib + scaledDelta));
        if (tribulationResult.outcome === 'fall_realm') {
          // 跌境：突破不算成立，境界与层数都退回去。
          //   顺手把 breakthroughHappened 撤掉，否则下游还会照「突破成功」投影一遍。
          //   耗掉的修为不退——功亏一篑，代价照付。
          next.realm = realmBefore as any;
          next.realmLevel = realmLevelBefore;
          ctx.breakthroughHappened = false;
          ctx.breakthroughMajor = false;
          ctx.newRealm = undefined;
        }
        if (tribulationResult.outcome === 'fatal') {
          if (TRIBULATION_FATAL_KILLS) {
            appliedHp = 0;
            next.alive = false;
            next.causeOfDeath = tribulationResult.cause || '渡劫失败，形神俱灭';
            ctx.died = true;
            ctx.deathReason = next.causeOfDeath;
          } else {
            // 生死闸门还关着：陨落先落到濒死一线，留住角色也留住痛感。
            appliedHp = 1;
          }
        }
        next.hp = appliedHp;
        if (hasTribulationPill) {
          // 认了丹药的加成就得扣掉这瓶丹，否则一瓶护一世。
          (next as any).inventory = inventory.filter((_, idx) => idx !== pillIndex);
        }
        const appliedHpDelta = appliedHp - hpBeforeTrib;

        if (!(next as any).__shadowRun) appendEvent({
          characterId: next.id,
          type: 'character.tribulation.attempted',
          data: {
            type: 'character.tribulation.attempted',
            fromRealm,
            toRealm,
            outcome: tribulationResult.outcome,
            kind: tribulationResult.kind,
            difficulty: tribulationResult.difficulty,
            // 记真扣掉的那个数，不记引擎按满血 100 算出来的名义值。
            hpDelta: appliedHpDelta,
            cause: tribulationResult.cause,
            ...(karmaShiftPayload ? { karmaShift: karmaShiftPayload } : {}),
          },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: next.age,
        }).catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[tribulation] appendEvent failed (non-fatal): ${msg}`);
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[tribulation] breakthrough tribulation attempt failed (non-fatal): ${msg}`);
    }
  }
};

// 6. 处理死亡
const procDeath: AIEventProcessor = (ctx) => {
  if (ctx.aiOutput.causedDeath) {
    ctx.next.alive = false;
    ctx.next.causeOfDeath = ctx.aiOutput.deathReason || '陨落于劫难';
    ctx.died = true;
    ctx.deathReason = ctx.next.causeOfDeath;
  }
};

// 7. 处理飞升
const procAscension: AIEventProcessor = (ctx) => {
  if (ctx.aiOutput.causedAscension) {
    ctx.next.ascended = true;
    ctx.next.alive = true; // 飞升不算死亡
    ctx.next.realm = 'ascension';
  }
};

// 7.1 添加新线索
const procNewThreads: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.newThreads && aiOutput.newThreads.length) {
    const registered = registerMany(aiOutput.newThreads, registerThread, {
      source: aiOutput.title,
      age: ctx.next.age,
      existingIds: (ctx.next.pendingThreads || []).map(t => t.id),
    });
    ctx.contentRegistryTrace.push(...registered.trace);
    ctx.contentRegistryWarnings.push(...registered.warnings);
    ctx.next = addThreads(ctx.next, registered.accepted);
  }
};

// 7.1.5 NPC Persistence Lite: register explicit AI NPCs and combat opponents.
const procNpcs: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  const rawNpcs = [
    ...(aiOutput.newNpcs || []),
    ...combatEnemiesToNpcs(aiOutput.triggerCombat?.enemies, aiOutput, ctx.next),
  ];
  if (rawNpcs.length) {
    const registered = registerMany(rawNpcs, registerNpc, {
      source: aiOutput.title,
      age: ctx.next.age,
      existingIds: (ctx.next.npcs || []).map(n => n.id),
    });
    ctx.contentRegistryTrace.push(...registered.trace);
    ctx.contentRegistryWarnings.push(...registered.warnings);
    ctx.next = upsertNpcs(ctx.next, registered.accepted);
  }
};

// 7.2~7.5 线索进度推进 / 完成 / 失败 / 叙事契约同步 / deadline 检查
const procThreadProgress: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.advanceThreads && aiOutput.advanceThreads.length) {
    for (const adv of aiOutput.advanceThreads) {
      if (adv.id && typeof adv.progressDelta === 'number') {
        ctx.next = advanceThread(ctx.next, adv.id, adv.progressDelta, adv.note);
      }
    }
  }
  if (aiOutput.completeThreadIds && aiOutput.completeThreadIds.length) {
    for (const id of aiOutput.completeThreadIds) {
      ctx.next = completeThread(ctx.next, id);
    }
  }
  if (aiOutput.failThreadIds && aiOutput.failThreadIds.length) {
    for (const id of aiOutput.failThreadIds) {
      ctx.next = failThread(ctx.next, id);
    }
  }
  ctx.next = syncThreadsFromNarrativeOutcome(ctx.next, aiOutput);
  const threadCheck = checkThreadDeadlines(ctx.next);
  ctx.next = threadCheck.state;
};

// 7.6 触发战斗（若 AI 给出 triggerCombat）
const procCombatTrigger: AIEventProcessor = (ctx) => {
  const { aiOutput } = ctx;
  if (aiOutput.triggerCombat && aiOutput.triggerCombat.enemies?.length) {
    const combatTrigger = {
      ...aiOutput.triggerCombat,
      contextTitle: aiOutput.title || aiOutput.triggerCombat.contextTitle,
      contextNarrative: aiOutput.narrative || aiOutput.triggerCombat.contextNarrative,
    };
    if (aiOutput.hasChoice) {
      (ctx.next as any)._deferredCombat = combatTrigger;
    } else {
      ctx.next = startCombat(ctx.next, combatTrigger);
    }
  }
};

// Task 23: 应用 AI 授予的灵宠
const procPets: AIEventProcessor = (ctx) => {
  if (ctx.aiOutput.newPets && ctx.aiOutput.newPets.length) {
    for (const pet of ctx.aiOutput.newPets) {
      ctx.next = addPet(ctx.next, pet);
    }
  }
};

// α-2 善恶轴接线：本次事件里角色做了什么，决定功过如何走。
// 位置说明（为何排在线索/战斗/灵宠之后、procFinalize 之前）：
//   - 要等 procThreadProgress 把「完成 / 失败」的线索结算完，才能拿到本次真正了结的旧因缘标题；
//   - 又必须早于 procFinalize，让 refreshWorldFacts / 因果打点看到的是已落账的善恶轴。
// 判定输入从哪来：AIEventOutput 没有专门的 tags 字段，故按 recordEventCausality 的既有做法就地拼装——
//   tags  ← 新线索标题+类别 / 新状态名 / 本次了结或失手的旧线索标题
//   aiTag ← eventType
//   cause ← 标题 + 记忆 + 因果摘要 + 叙事（玩家实际做的事都写在这里）
// 全部可能为空：拼不出任何词条时 computeKarmaShiftFromEvent 返回 null，本处直接零变化返回（兜底）。
// 上下界不自己写：merit/sin 单调与 karma 的 -1..+1 钳制一律走 applyKarmaDelta。
const procKarmaShift: AIEventProcessor = (ctx) => {
  // 渡劫已在本次结算里记过一笔，不重复累加
  if (ctx.karmaShiftedByTribulation) return;
  const { aiOutput } = ctx;
  const tags: string[] = [];
  for (const t of aiOutput.newThreads || []) {
    if (t?.title) tags.push(String(t.title));
    if (t?.category) tags.push(String(t.category));
  }
  for (const s of aiOutput.newStatuses || []) {
    if (s?.name) tags.push(String(s.name));
  }
  const settledIds = [...(aiOutput.completeThreadIds || []), ...(aiOutput.failThreadIds || [])];
  if (settledIds.length) {
    for (const thread of ctx.state.pendingThreads || []) {
      if (thread?.id && settledIds.includes(thread.id) && thread.title) tags.push(String(thread.title));
    }
  }
  const cause = [aiOutput.title, aiOutput.memory, aiOutput.causalSummary, aiOutput.narrative]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join('；')
    .slice(0, 2000);

  const shift = computeKarmaShiftFromEvent({
    type: aiOutput.eventType,
    tags,
    aiTag: aiOutput.eventType,
    cause,
  });
  if (!shift) return;

  const before = {
    karma: Number(ctx.next.karma || 0),
    merit: Number(ctx.next.merit || 0),
    sin: Number(ctx.next.sin || 0),
  };
  const applied = applyKarmaDelta(before, { meritDelta: shift.meritDelta, sinDelta: shift.sinDelta });
  if (!applied.applied) return;
  ctx.next = { ...ctx.next, karma: applied.karma, merit: applied.merit, sin: applied.sin };

  ctx.effectResolveTrace.push({
    severity: 'info',
    code: 'karma_shift_from_event',
    attribute: '*',
    message: `Karma shift from event: merit ${before.merit}->${applied.merit}, sin ${before.sin}->${applied.sin}, karma ${before.karma.toFixed(3)}->${applied.karma.toFixed(3)} (${shift.reason})`,
    source: aiOutput.title || 'karma-shift',
  });

  // 落库副作用：与雷劫那处同规矩——影子试算期一律不写，免得试算污染真实事件流。
  const nextState = ctx.next;
  if (!(nextState as any).__shadowRun && nextState.id) {
    const payload: KarmaShiftPayload = {
      meritDelta: Number(shift.meritDelta || 0),
      sinDelta: Number(shift.sinDelta || 0),
      karmaDelta: applied.karma - before.karma,
      reason: shift.reason,
    };
    appendEvent({
      characterId: nextState.id,
      type: 'character.karma.shifted',
      data: {
        type: 'character.karma.shifted',
        karmaShift: payload,
        newKarma: applied.karma,
        newMerit: applied.merit,
        newSin: applied.sin,
        eventTitle: aiOutput.title || undefined,
      },
      source: 'ai-output',
      triggerActor: 'player',
      createdAtAge: nextState.age,
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[karma α-2] appendEvent failed (non-fatal): ${msg}`);
    });
  }
};

// 8. 角色主动意图重新生成（每岁重算）+ 世界事实刷新 + 因果打点
const procFinalize: AIEventProcessor = (ctx) => {
  ctx.next.pendingThreads = normalizeThreadsCompletion(ctx.next.pendingThreads || []);
  ctx.next.questEntries = buildQuestEntriesFromThreads(ctx.next.pendingThreads, ctx.next.age);
  ctx.next.characterIntents = generateCharacterIntents(ctx.next, ctx.next.pendingThreads);
  ctx.next = refreshWorldFacts(ctx.next, ctx.aiOutput.title || 'ai-event');
  ctx.next = recordEventCausality(ctx.next, ctx.aiOutput);
};

// 有序处理器管线：顺序 == 原 executeAIEvent 的编号步骤顺序，逐块搬运，行为不变。
const AI_EVENT_PROCESSORS: AIEventProcessor[] = [
  procInfantGuard,
  procDedupeNarrative,
  procBodyGrowth,
  procAttributeChanges,
  procStatuses,
  procRemovedItems,
  procNewItems,
  procNewEquippedItems,
  procEquipItems,
  procUnequipItems,
  procMemory,
  procSpiritualRoot,
  procCultivationInsight,
  procBreakthrough,
  procDeath,
  procAscension,
  procNewThreads,
  procNpcs,
  procThreadProgress,
  procCombatTrigger,
  procPets,
  procKarmaShift,
  procFinalize,
];

export function executeAIEvent(state: CharacterState, aiOutput: AIEventOutput): EngineExecutionResult {
  const ctx: ExecCtx = {
    state,
    next: { ...state },
    aiOutput,
    rejected: [],
    contentRegistryTrace: [],
    contentRegistryWarnings: [],
    effectResolveTrace: [],
    effectResolveWarnings: [],
    appliedChanges: [],
    boundaryValidation: validateAIBoundary(state, aiOutput),
    breakthroughHappened: false,
    newRealm: undefined,
    breakthroughMajor: false,
    breakthroughSteps: 0,
    breakthroughReasonAccepted: false,
    died: false,
    deathReason: undefined,
    karmaShiftedByTribulation: false,
    removedItemIds: [],
    collectItemResolve(resolved: ItemEffectResolveResult) {
      this.appliedChanges.push(...resolved.appliedChanges);
      this.rejected.push(...resolved.rejectedChanges);
      this.effectResolveTrace.push(...resolved.effectResolveTrace);
      this.effectResolveWarnings.push(...resolved.effectResolveWarnings);
    },
  };

  for (const processor of AI_EVENT_PROCESSORS) {
    processor(ctx);
  }

  const stateChangeLog = buildStateChangeLog({
    before: ctx.state,
    after: ctx.next,
    appliedChanges: ctx.appliedChanges,
    rejectedChanges: ctx.rejected,
    contentRegistryTrace: ctx.contentRegistryTrace,
    effectResolveTrace: ctx.effectResolveTrace,
    aiBoundaryTrace: ctx.boundaryValidation.trace,
  });

  return {
    state: ctx.next,
    appliedChanges: ctx.appliedChanges,
    rejectedChanges: ctx.rejected,
    contentRegistryTrace: ctx.contentRegistryTrace,
    contentRegistryWarnings: ctx.contentRegistryWarnings,
    effectResolveTrace: ctx.effectResolveTrace,
    effectResolveWarnings: ctx.effectResolveWarnings,
    aiBoundaryTrace: ctx.boundaryValidation.trace,
    aiBoundaryWarnings: ctx.boundaryValidation.warnings,
    stateChangeLog,
    breakthroughHappened: ctx.breakthroughHappened,
    newRealm: ctx.newRealm,
    breakthroughMajor: ctx.breakthroughMajor,
    breakthroughSteps: ctx.breakthroughSteps,
    breakthroughReasonAccepted: ctx.breakthroughReasonAccepted,
    died: ctx.died,
    deathReason: ctx.deathReason,
    // 2026-07-12：透给显示层，让"失去：XXX"chip 能正确渲染
    removedItemIds: ctx.removedItemIds,
  };
}


// ==================== 状态 → API 响应（含展示字段） ====================

// 将引擎状态转为前端可直接使用的响应对象
// 关键：包含 realmName / realmColor / realmMaxLevel / rootMultiplier 等展示字段
// 这样前端 setCharacter({...character, ...data.state}) 时这些字段会被正确更新
export function stateToResponse(s: CharacterState) {
  const realmInfo = getRealmInfo(s.realm);
  const realmProfile = getRealmProfile(s);
  const rootInfo = SPIRITUAL_ROOTS[s.spiritualRoot];
  const rate = computeEffectiveCultivationRate(s);
  const realmPower = realmPowerMultiplier(s);
  const coreAttrs = deriveCoreCultivationAttributes(s);
  const soulRealm = deriveSoulRealm({ ...s, ...coreAttrs });
  const realmTraits = deriveRealmTraits(s);
  const combatProjection = deriveCombatProjection({ ...s, ...coreAttrs });
  return {
    age: s.age,
    lifespan: s.lifespan,
    realm: s.realm,
    realmName: realmProfile?.name || realmInfo.name,
    realmColor: realmProfile?.color || realmInfo.color,
    realmLevel: s.realmLevel,
    realmMaxLevel: realmProfile?.maxLevel ?? realmInfo.levels,
    realmProfile,
    realmTraits,
    spiritualSense: coreAttrs.spiritualSense,
    soulStrength: coreAttrs.soulStrength,
    physicalFoundation: coreAttrs.physicalFoundation,
    combatProjection,
    soulRealmName: soulRealm.name,
    soulRealmRank: soulRealm.rank,
    soulRealmGap: soulRealm.gap,
    realmPowerMultiplier: realmPower,
    cultivationExp: s.cultivationExp,
    expToBreak: s.expToBreak,
    hp: scaleByRealmPower(s.hp, realmPower), maxHp: scaleByRealmPower(s.maxHp, realmPower),
    mp: scaleByRealmPower(s.mp, realmPower), maxMp: scaleByRealmPower(s.maxMp, realmPower),
    attack: scaleByRealmPower(s.attack, realmPower), defense: scaleByRealmPower(s.defense, realmPower), speed: scaleByRealmPower(s.speed, Math.sqrt(realmPower)),
    luck: s.luck, comprehension: s.comprehension,
    spiritStones: s.spiritStones, reputation: s.reputation,
    alive: s.alive, ascended: s.ascended,
    causeOfDeath: s.causeOfDeath,
    faction: s.faction, master: s.master, location: s.location,
    elements: s.elements,
    fateNodes: s.fateNodes,
    isAtChoice: s.isAtChoice,
    spiritualRoot: s.spiritualRoot,
    rootDetail: s.rootDetail,
    rootMultiplier: rootInfo?.multiplier ?? 0,
    cultivationMultiplier: rate.multiplier,
    cultivationFlatBonus: rate.flatBonus,
    cultivationInsight: s.cultivationInsight,
    cultivationFactors: computeCultivationFactors(s),
    cultivationAttributes: deriveCultivationAttributes(s),
    storageCapacity: s.storageCapacity,
    activeStatuses: s.activeStatuses,
    inventory: s.inventory,
    equipped: s.equipped,
    // Task 20 新字段
    pendingThreads: s.pendingThreads || [],
    questEntries: buildQuestEntriesFromThreads(s.pendingThreads || [], s.age),
    characterIntents: s.characterIntents || [],
    combatSession: s.combatSession || null,
    npcs: s.npcs || [],
    causalGraph: s.causalGraph || { nodes: [], edges: [] },
    worldFacts: s.worldFacts || [],
    // Task 22 新字段
    heartDemon: s.heartDemon ?? 0,
    heartDemonProjection: deriveHeartDemonProjection(s),
    // Task 23 新字段
    pets: s.pets || [],
    // Task 24 新字段
    exploredRealms: s.exploredRealms || [],
    discoveredRealms: getDiscoveredStoryRealms(s),
    // B4: 玩家宗门身份统一由引擎派生 (原 SectStorylinePanel 的 inferRank 已下沉)
    sectRank: derivePlayerSectRank(s),
    // Phase-Z: FxLayer 触发源——这些字段由 advance / advance-sse 在 finalState 上临时挂，
    // 前端 useFxFromCharacter 读取后播飘字/过场/光柱/成就 toast 后即清。
    // 之前没放进白名单导致前端永远拿不到，是 4 类特效完全没触发的根因。
    __lastAnnualGrowth: (s as any).__lastAnnualGrowth,
    __lastBreakthrough: (s as any).__lastBreakthrough,
    __lastAchievements: (s as any).__lastAchievements,
    __lastDrops: (s as any).__lastDrops,
    __lastHeritageAdditions: (s as any).__lastHeritageAdditions,
  };
}

// ==================== 验证：状态名唯一性 ====================
