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
  WorkerDCharacter,
  WorkerDEndingCharacter,
  WorkerDEndingWorldState,
} from './shared';

export const SCRIPTURE_STAGE_THRESHOLDS: { stage: 'practiced' | 'awakened' | 'transcendent'; min: number; max: number; label: string; color: string }[] = [
  { stage: 'practiced',     min: 0,  max: 33, label: '初习', color: '#9ca3af' }, // 灰
  { stage: 'awakened',      min: 34, max: 66, label: '觉意', color: '#14b8a6' }, // 青
  { stage: 'transcendent',  min: 67, max: 100, label: '大成', color: '#a855f7' }, // 紫
];

// 给定 exp（0..100）返回当前阶段。exp 越界会被夹紧。
// 兼容旧数据：若 item 无 stage 字段，视作 exp=0 → 'practiced'。
export function computeScriptureStage(expOrItem: number | ItemEntry | null | undefined): 'practiced' | 'awakened' | 'transcendent' {
  let exp: number;
  if (typeof expOrItem === 'number') {
    exp = expOrItem;
  } else if (expOrItem && typeof expOrItem === 'object') {
    exp = typeof expOrItem.scriptureExp === 'number' ? expOrItem.scriptureExp : 0;
  } else {
    exp = 0;
  }
  if (!Number.isFinite(exp)) exp = 0;
  const clamped = Math.max(0, Math.min(100, exp));
  if (clamped <= 33) return 'practiced';
  if (clamped <= 66) return 'awakened';
  return 'transcendent';
}

// 给出 exp 计算阶段标签（中文：初习/觉意/大成）
export function scriptureStageLabel(stage: 'practiced' | 'awakened' | 'transcendent' | null | undefined): string {
  if (stage === 'awakened') return '觉意';
  if (stage === 'transcendent') return '大成';
  return '初习';
}

// 给出 exp 计算阶段色（chip 颜色用）
export function scriptureStageColor(stage: 'practiced' | 'awakened' | 'transcendent' | null | undefined): string {
  const found = SCRIPTURE_STAGE_THRESHOLDS.find(t => t.stage === (stage || 'practiced'));
  return found?.color || '#9ca3af';
}

// 给单个 scripture 物品累计 exp，自动判定阶段并落 scriptureStage。
// expDelta 由调用方钳制（建议 [0..30]/事件 防溢出）；reason 仅用于日志，不修改物品。
// 返回 { state, item, crossedStage, oldStage }：
//   - crossedStage=true 表示本次累计跨段（practiced→awakened 或 awakened→transcendent）
//   - oldStage 用于日志 / 反馈
//   - item 已是新值（写回 inventory / equipped 后视图一致）
// 兼容：旧 scripture 无 stage 字段 → 视作初习 + 0 exp；item 不存在时返回 state 不变。
export function addScriptureProgress(
  state: CharacterState,
  scriptureId: string,
  expDelta: number,
  reason?: string
): { state: CharacterState; item: ItemEntry; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent' } {
  // 悟性影响功法修炼：comprehension 每点 +0.5% exp 增益（上限 +50%）
  const comprehensionBoost = Math.min(1.5, 1 + (state.comprehension || 0) * 0.005);
  const safeDelta = Number.isFinite(expDelta) ? Math.max(0, Math.min(30, Math.floor(expDelta * comprehensionBoost))) : 0;
  // 找 inventory + equipped 两处
  let item: ItemEntry | undefined = state.inventory.find(it => it.id === scriptureId);
  let location: 'inventory' | 'equipped' | null = item ? 'inventory' : null;
  if (!item) {
    item = (state.equipped || []).find(it => it.id === scriptureId);
    if (item) location = 'equipped';
  }
  if (!item || item.item_type !== 'scripture') {
    // 找不到或非 scripture：原状返回 state，构造空 item 以便类型对齐
    return {
      state,
      item: { id: scriptureId, name: '未知功法', description: '', item_type: 'scripture', rarity: 'common', effects: [], source: 'engine' },
      crossedStage: false,
      oldStage: 'practiced',
      newStage: 'practiced',
    };
  }
  const oldExp = typeof item.scriptureExp === 'number' && Number.isFinite(item.scriptureExp) ? item.scriptureExp : 0;
  const oldStage = (item.scriptureStage && ['practiced', 'awakened', 'transcendent'].includes(item.scriptureStage))
    ? item.scriptureStage
    : computeScriptureStage(oldExp);
  const newExp = Math.max(0, Math.min(100, oldExp + safeDelta));
  const newStage = computeScriptureStage(newExp);
  const crossedStage = newStage !== oldStage;
  const awakeningHook = crossedStage
    ? (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 80) : `${scriptureStageLabel(oldStage)} → ${scriptureStageLabel(newStage)}`)
    : item.scriptureAwakeningHook;
  const updated: ItemEntry = {
    ...item,
    scriptureExp: newExp,
    scriptureStage: newStage,
    scriptureAwakeningHook: awakeningHook,
  };
  // 写回 inventory / equipped（不可变更新）
  let next = state;
  if (location === 'inventory') {
    next = { ...state, inventory: state.inventory.map(it => it.id === scriptureId ? updated : it) };
  } else if (location === 'equipped') {
    next = { ...state, equipped: (state.equipped || []).map(it => it.id === scriptureId ? updated : it) };
  }
  return { state: next, item: updated, crossedStage, oldStage, newStage };
}

// 把 aiOutput.scriptureProgress 列表应用到 state 上（按 id 或 name 匹配）
// 单条 delta 限幅 [0..30]，跨多事件总和单场上限 100（一次 AI 事件整体不会超过整段进度）。
// 返回 { state, applied: [{ id, delta, crossedStage, oldStage, newStage, awakeningHook }], dropped }
//   - applied 顺序与输入一致
//   - dropped 是无效条目（无 itemId/itemName 或非 scripture 或不存在）
export function applyScriptureProgressFromAI(
  state: CharacterState,
  progresses: { itemId?: string; itemName: string; expDelta: number; reason?: string }[] | undefined | null
): { state: CharacterState; applied: { id: string; name: string; delta: number; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent'; awakeningHook?: string }[]; dropped: number } {
  if (!Array.isArray(progresses) || progresses.length === 0) {
    return { state, applied: [], dropped: 0 };
  }
  let next = state;
  let applied: { id: string; name: string; delta: number; crossedStage: boolean; oldStage: 'practiced' | 'awakened' | 'transcendent'; newStage: 'practiced' | 'awakened' | 'transcendent'; awakeningHook?: string }[] = [];
  let dropped = 0;
  for (const p of progresses) {
    if (!p || typeof p !== 'object') { dropped++; continue; }
    const targetId = (typeof p.itemId === 'string' && p.itemId) ? p.itemId : '';
    let targetItem: ItemEntry | undefined;
    if (targetId) {
      targetItem = next.inventory.find(it => it.id === targetId) || (next.equipped || []).find(it => it.id === targetId);
    }
    if (!targetItem && p.itemName) {
      targetItem = next.inventory.find(it => it.item_type === 'scripture' && it.name === p.itemName)
        || (next.equipped || []).find(it => it.item_type === 'scripture' && it.name === p.itemName);
    }
    if (!targetItem || targetItem.item_type !== 'scripture') { dropped++; continue; }
    const result = addScriptureProgress(next, targetItem.id, p.expDelta, p.reason);
    next = result.state;
    applied.push({
      id: targetItem.id,
      name: targetItem.name,
      delta: Math.max(0, Math.min(30, Math.floor(Number(p.expDelta) || 0))),
      crossedStage: result.crossedStage,
      oldStage: result.oldStage,
      newStage: result.newStage,
      awakeningHook: result.item.scriptureAwakeningHook,
    });
  }
  return { state: next, applied, dropped };
}

// ==================== 记忆管理 ====================

const SWORD_ORDER: SwordAptitude[] = ['untrained','novice','adept','master'];

/**
 * 根据角色练习剑法时长推进剑道资质。
 */
export function deriveSwordAptitudeProgress(character: CharacterState, practice: { hours?: number; talent?: number }): SwordAptitude {
  const cur = ((character as any).swordAptitude as SwordAptitude | undefined) ?? 'untrained';
  const hours = Math.max(0, practice?.hours ?? 0);
  const talent = Math.max(0.1, Math.min(3, practice?.talent ?? 1));
  const inc = hours * talent / 100;
  const curIdx = SWORD_ORDER.indexOf(cur);
  if (curIdx < 0) return 'untrained';
  // 每跨一阶需要累计 100 inc
  const totalAcc = ((character as any).swordPracticeAcc as number | undefined) ?? 0;
  const next = totalAcc + inc;
  let newIdx = curIdx;
  while (newIdx < SWORD_ORDER.length - 1 && newIdx < curIdx + Math.floor(next / 100)) newIdx += 1;
  return SWORD_ORDER[Math.min(SWORD_ORDER.length - 1, newIdx)];
}

/**
 * 给定角色当前 HP / 受到的伤害 / 假死规则，决定是否进入假死以及揭示率。
 */
export function deriveTechniqueProgress(
  technique: { id: string; name: string; element: string; requiredRealm: number },
  character: WorkerDCharacter,
  practice: { sessions: number; comprehensionEvents: unknown[]; breakthroughs: unknown[] },
): TechniqueStudy {
  const comp = typeof character?.comprehension === "number" ? character.comprehension : 50;
  const sessions = typeof practice?.sessions === "number" ? practice.sessions : 0;
  const events = Array.isArray(practice?.comprehensionEvents) ? practice.comprehensionEvents : [];
  const breakthroughs = Array.isArray(practice?.breakthroughs) ? practice.breakthroughs : [];
  const baseProgress = Math.min(1, sessions * 0.05);
  const compBoost = (comp - 50) / 500;
  const eventBoost = events.length * 0.02;
  const progress = Math.max(0, Math.min(1, baseProgress + compBoost + eventBoost));
  return {
    techniqueId: technique?.id ?? "unknown",
    currentProgress: progress,
    comprehensionEvents: events as TechniqueStudy["comprehensionEvents"],
    breakthroughs: breakthroughs as TechniqueStudy["breakthroughs"],
  };
}

export function resolveTechniqueBreakthrough(
  study: TechniqueStudy,
  character: WorkerDCharacter,
): { newProgress: number; breakthrough: boolean; sideEffect: CraftingSideEffect | null } {
  const progress = Math.max(0, Math.min(1, Number(study?.currentProgress ?? 0)));
  if (progress < 1) {
    return { newProgress: progress, breakthrough: false, sideEffect: null };
  }
  const comp = typeof character?.comprehension === "number" ? character.comprehension : 50;
  const luck = typeof character?.luck === "number" ? character.luck : 50;
  const risk = comp < 30 || luck < 20;
  const sideEffect: CraftingSideEffect | null = risk
    ? {
        kind: "qi-deviation",
        severity: 0.6,
        description: "突破时气海震荡，需闭关静养",
        expiresAfterDays: 7,
      }
    : {
        kind: "status",
        severity: 0.2,
        description: "突破后灵台清明，神识略有增益",
      };
  return { newProgress: 1, breakthrough: true, sideEffect };
}

// ==================== Phase-I Worker D: Ending Spectrum (additive) ====================
// 结局光谱：evaluate / select / apply / branch / summarize 五个引擎函数。
// 输入只接受本文件内的 WorkerDEndingCharacter / WorkerDEndingWorldState；
// 输出严格走 EndingCondition / EndingChoice / EndingOutcome / EndingPathMap 四个接口。
