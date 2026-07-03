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
  inferStoryRealmName,
  normalizeThreadCompletion,
  normalizeThreadsCompletion,
} from './shared';

function threadStatusToQuestStage(status: PendingThread['status']): QuestEntryStage {
  if (status === 'resolved') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'urgent') return 'urgent';
  return 'open';
}

function questUrgency(thread: PendingThread, currentAge: number): number {
  if (thread.status === 'resolved' || thread.status === 'failed') return 0;
  const remaining = Number(thread.deadlineAge ?? currentAge) - currentAge;
  let urgency = 1;
  if (thread.status === 'urgent' || remaining <= 1 || thread.dueInSameYear) urgency = 10;
  else if (remaining <= 3) urgency = 8;
  else if (remaining <= 8) urgency = 5;
  else urgency = 3;
  if ((thread.progress || 0) >= 75) urgency = Math.max(urgency, 6);
  return urgency;
}

export function buildQuestEntriesFromThreads(threads: PendingThread[] | null | undefined, currentAge: number): QuestEntry[] {
  const safeThreads = Array.isArray(threads) ? threads : [];
  const normalized = safeThreads.map(t => normalizeThreadCompletion(t));
  return normalized
    .filter(t => t && t.id && t.title)
    .map(t => ({
      id: `quest_${t.id}`,
      title: t.title,
      summary: t.description || t.followUpHint || t.title,
      kind: t.category,
      stage: threadStatusToQuestStage(t.status),
      progress: Math.max(0, Math.min(100, Number(t.progress || 0))),
      startedAtAge: Number(t.startAge ?? currentAge),
      dueAge: Number.isFinite(Number(t.deadlineAge)) ? Number(t.deadlineAge) : undefined,
      urgency: questUrgency(t, currentAge),
      sourceThreadId: t.id,
      sourceEventTitle: t.sourceEventTitle,
      currentHook: t.followUpHint,
      rewardHint: t.reward,
      failureHint: t.failureCost,
      realmId: t.realmId,
      tags: [t.category, t.status, t.dueInSameYear ? 'same-year' : '', t.realmId ? 'realm' : ''].filter(Boolean),
    }))
    .sort((a, b) => b.urgency - a.urgency || (a.dueAge ?? 999999) - (b.dueAge ?? 999999))
    .slice(0, 80);
}

// ==================== 引擎状态上下文构建 ====================

export function generateCharacterIntents(state: CharacterState, threads?: PendingThread[] | null): CharacterIntent[] {
  const intents: CharacterIntent[] = [];
  const now = state.age;
  const safeThreads = Array.isArray(threads) ? threads : Array.isArray((state as any).pendingThreads) ? (state as any).pendingThreads : [];
  // 1. 检查 pendingThreads —— 临近 deadline 的线索生成对应意图
  for (const t of safeThreads) {
    if (t.status !== 'pending' && t.status !== 'urgent') continue;
    const remaining = t.deadlineAge - now;
    if (remaining < 0) continue;
    if (remaining === 0) {
      intents.push({
        id: `intent_due_${t.id}`,
        type: t.category === 'exploration' || t.category === 'mystery' || t.category === 'inheritance' ? 'explore_opportunity' : 'resolve_thread',
        title: `应约·${t.title}`,
        description: `「${t.title}」已到约期。此事压在心头，须去赴约、入境、应试或还愿；若一时不能成行，也该给自己一个交代。${t.followUpHint ? `关窍：${t.followUpHint}` : ''}`,
        priority: 10,
        relatedThreadId: t.id,
      });
      continue;
    }
    if ((t.category === 'exploration' || t.category === 'mystery' || t.category === 'inheritance') && remaining <= 3) {
      intents.push({
        id: `intent_realm_${t.id}`,
        type: 'explore_opportunity',
        title: `牵挂·${t.title}`,
        description: `「${t.title}」仍在心头，约莫 ${remaining} 岁内便会再起波澜。信物、禁制与旧地皆有未尽之意，若暂不能入内，也需另寻缘法。${t.followUpHint ? `关窍：${t.followUpHint}` : ''}`,
        priority: 9,
        relatedThreadId: t.id,
      });
    } else if ((t.category === 'promise' || t.category === 'romance') && remaining <= 3) {
      intents.push({
        id: `intent_promise_${t.id}`,
        type: 'socialize',
        title: `守约·${t.title}`,
        description: `「${t.title}」渐近，旧约旧人萦绕心间。或赴约，或传信，或亲自探望；若终究失约，也该有一番缘由。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    }
    if (t.category === 'competition' && remaining <= 5) {
      intents.push({
        id: `intent_comp_${t.id}`,
        type: 'prepare_combat',
        title: `备战·${t.title}`,
        description: `「${t.title}」将在 ${remaining} 岁后到来。兵器、丹药、功法与师长指点皆可早作筹谋；修为若浅，更该趁早磨砺。`,
        priority: 9,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'enemy' && remaining <= 10) {
      intents.push({
        id: `intent_enemy_${t.id}`,
        type: 'avoid_danger',
        title: `防备·${t.title}`,
        description: `「${t.title}」近来隐有动静。独行险地需多留心，护身之物、师长照拂或同门同行，皆可保一线周全。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'quest' && remaining <= 5) {
      intents.push({
        id: `intent_quest_${t.id}`,
        type: 'resolve_thread',
        title: `推进·${t.title}`,
        description: `「${t.title}」已近收束之时。材料、委托与目标仍需一一落实，不宜再久拖。`,
        priority: 8,
        relatedThreadId: t.id,
      });
    } else if (t.category === 'debt' && remaining <= 3) {
      intents.push({
        id: `intent_debt_${t.id}`,
        type: 'gather_resources',
        title: `还债·${t.title}`,
        description: `「${t.title}」债期将近，灵石与抵偿之物都得早作筹措，否则恐生祸端。`,
        priority: 9,
        relatedThreadId: t.id,
      });
    }
  }
  // 2. 修为接近突破阈值 → 闭关意图
  if (state.cultivationExp >= state.expToBreak * 0.8) {
    intents.push({
      id: `intent_break_${now}`,
      type: 'breakthrough',
      title: '酝酿突破',
      description: '修为将满，应闭关参悟、稳固道心、准备突破。若有突破辅助丹药应及早服用。',
      priority: 7,
    });
  }
  // 3. 灵石富余且无紧迫事项 → 淘宝/交易意图
  if (state.spiritStones >= 50 && intents.length === 0 && state.age >= 12) {
    intents.push({
      id: `intent_trade_${now}`,
      type: 'trade',
      title: '坊市寻宝',
      description: '灵石充裕，可前往坊市淘宝、补充丹药或材料。若有缺武器/防具应优先购置。',
      priority: 4,
    });
  }
  // 4. 无武器且境界炼气以上 → 寻武器意图
  if (state.realm !== 'mortal' && state.age >= 10) {
    const hasWeapon = (state.equipped || []).some(it => it.item_type === 'weapon');
    if (!hasWeapon) {
      intents.push({
        id: `intent_weapon_${now}`,
        type: 'gather_resources',
        title: '寻觅兵器',
        description: '已入修行却无趁手兵器，应主动寻一把剑/刀/杖/法宝防身。',
        priority: 6,
      });
    }
  }
  // 5. 软牵挂：父母、故乡、师承、旧友等不是硬任务，但会在合适年份自然回响。
  const concernText = [
    ...(state.longTermMemory || []),
    ...(state.activeStatuses || []).map(st => `${st.name} ${st.description} ${st.source || ''}`),
    ...(state.pendingThreads || []).map(t => `${t.title} ${t.description} ${t.followUpHint || ''}`),
  ].join(' ');
  const concernSeed = Math.abs((state.age * 17) + String(state.name || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0));
  if (/父母|爹娘|双亲|母亲|父亲|家中|故乡|旧宅|亲人/.test(concernText) && (concernSeed % 4 === 0 || intents.length === 0)) {
    intents.push({
      id: `intent_family_${now}`,
      type: state.spiritStones >= 20 ? 'trade' : 'socialize',
      title: state.spiritStones >= 20 ? '奉亲问安' : '牵挂家中',
      description: state.spiritStones >= 20
        ? '角色心中牵挂父母亲人，若路途与处境允许，可购买调养丹药、托人送信或回乡探望；若不能成行，也应在叙事中自然带过原因。'
        : '角色心中牵挂父母亲人，可能回乡探望、托人问安，或因修行/险地所阻只能暂寄书信。此类牵挂应偶尔回响，不必每年硬写。',
      priority: 3,
    });
  }
  if (/师父|师尊|师门|同门|旧友|好友|恩人|道侣/.test(concernText) && (concernSeed % 5 === 0 || intents.length === 0)) {
    intents.push({
      id: `intent_social_${now}`,
      type: 'socialize',
      title: '旧缘回响',
      description: '角色心中仍有师门、旧友或恩人牵挂；合适时可传信、探访、互赠丹药法器，或写明因闭关/险阻暂不能赴约。',
      priority: 3,
    });
  }

  // 6. 限制最多保留 5 个意图（按优先级排序）
  intents.sort((a, b) => b.priority - a.priority);
  return intents.slice(0, 5);
}

// ==================== Task 20: 未决线索管理 ====================


// ==================== CausalGraph Lite ====================

/**
 * \u7edf\u4e00\u7684\u5b9e\u4f53 ID \u751f\u6210 helper\uff1a\u540c\u6beb\u79d2\u5e76\u53d1\u4e0b\u4e0d\u4f1a\u51b2\u7a81\uff08\u7528 random \u540e\u7f00\u7834\u540c\u5206\uff09\u3002
 * \u7528\u6cd5\uff1agenerateEntityId('formation', aiOutput.id) \u2014 \u6709 ai \u63d0\u4f9b\u7684 id \u5c31\u7528 ai \u7684\uff1b\u5426\u5219\u81ea\u52a8\u751f\u6210\u3002
 */
export function addThreads(state: CharacterState, threads: PendingThread[]): CharacterState {
  if (!threads.length) return state;
  const existingIds = new Set((state.pendingThreads || []).map(t => t.id));
  const newThreads = threads.filter(t => t && t.id && !existingIds.has(t.id)).map(t => ({
    ...t,
    status: t.status || 'pending',
    progress: t.progress || 0,
  }));
  if (!newThreads.length) return state;
  const pendingThreads = [...(state.pendingThreads || []), ...newThreads];
  return { ...state, pendingThreads, questEntries: buildQuestEntriesFromThreads(pendingThreads, state.age) };
}

export function advanceThread(state: CharacterState, threadId: string, progressDelta: number, note?: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  // P0 规则：resolved/failed 线程不能再推进
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t => {
    if (t.id !== threadId) return normalizeThreadCompletion(t);
    const progress = Math.max(0, Math.min(100, (t.progress || 0) + progressDelta));
    return normalizeThreadCompletion({ ...t, progress });
  });
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function completeThread(state: CharacterState, threadId: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'resolved' as const, progress: 100 } : t
  );
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function failThread(state: CharacterState, threadId: string): CharacterState {
  const existing = (state.pendingThreads || []).find(t => t.id === threadId);
  if (!existing) return state;
  if (existing.status === 'resolved' || existing.status === 'failed') return state;
  const threads = (state.pendingThreads || []).map(t =>
    t.id === threadId ? { ...t, status: 'failed' as const } : t
  );
  return { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) };
}

export function checkThreadDeadlines(state: CharacterState): { state: CharacterState; failed: PendingThread[] } {
  const failed: PendingThread[] = [];
  let changed = false;
  const threads = (state.pendingThreads || []).map(raw => {
    const t = normalizeThreadCompletion(raw);
    if (t !== raw) changed = true;
    if (t.status === 'pending' && state.age > t.deadlineAge) {
      changed = true;
      failed.push(t);
      return { ...t, status: 'failed' as const };
    }
    return t;
  });
  if (!changed) return { state, failed: [] };
  return { state: { ...state, pendingThreads: threads, questEntries: buildQuestEntriesFromThreads(threads, state.age) }, failed };
}

// ==================== Task 20: 战斗系统 ====================


function isLocalSameYearThread(thread: PendingThread, age: number): boolean {
  if (thread.dueInSameYear || thread.deadlineAge <= age) return true;
  const text = `${thread.title || ''}${thread.description || ''}${thread.followUpHint || ''}`;
  return /今年|本年|当年|不久|三月|数月|半年|入夜|当夜|夜里|黄昏|清晨|翌日|转日|临走前|临行|临别|走前|离开前/.test(text);
}

export function getSameYearThreads(state: CharacterState): PendingThread[] {
  const age = state.age;
  return normalizeThreadsCompletion(state.pendingThreads || []).filter(t =>
    (t.status === 'pending' || t.status === 'urgent') &&
    isLocalSameYearThread(t, age) &&
    t.progress < 100
  ).slice(0, 2);
}


function shortThreadTimeAdvance(threadText: string, isVeryYoung: boolean): any {
  if (/三日后/.test(threadText)) return { amount: 3, unit: 'day', label: '三日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 3 };
  if (/两日后/.test(threadText)) return { amount: 2, unit: 'day', label: '两日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 2 };
  if (/数日后|几日后/.test(threadText)) return { amount: 5, unit: 'day', label: '数日后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 5 };
  if (/明日|翌日|转日/.test(threadText)) return { amount: 1, unit: 'day', label: '翌日', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 1 };
  if (/半月后/.test(threadText)) return { amount: 15, unit: 'day', label: '半月后', reason: '承接短期因缘', ageDeltaYears: 0, elapsedDays: 15 };
  if (/三月后/.test(threadText)) return { amount: 3, unit: 'month', label: '三月后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: 90 };
  if (/数月后/.test(threadText)) return { amount: 2, unit: 'month', label: '数月后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: 60 };
  return { amount: isVeryYoung ? 1 : 1, unit: isVeryYoung ? 'day' : 'month', label: isVeryYoung ? '翌日' : '月余后', reason: '承接同岁因缘', ageDeltaYears: 0, elapsedDays: isVeryYoung ? 1 : 30 };
}

const INTERNAL_THREAD_NARRATIVE_PHRASES = [
  '\u5faa\u7740\u65e7\u8ff9\u4e0e\u65e7\u7ea6\u7ee7\u7eed\u8ffd\u7d22',
  '\u524d\u7f18\u6b63\u5f85\u4e86\u7ed3',
  '\u8fd9\u6861\u524d\u7f18\u6b63\u5f85\u4e86\u7ed3',
  '\u6b64\u4e8b\u5e76\u672a\u968f\u4e0a\u4e00\u6bb5\u7ecf\u5386\u6563\u53bb',
  '\u6536\u62e2\u6240\u5f97\u7ebf\u7d22',
  '\u53cd\u590d\u63e3\u6469',
  '\u540e\u7eed\u627f\u63a5\u63d0\u793a',
  '\u540c\u5e74\u7eed\u7bc7',
  '\u6d41\u5e74\u56e0',
  '\u7eed\u7bc7',
];

function cleanVisibleThreadTitle(title?: string) {
  const cleaned = String(title || '')
    .replace(/\u6d41\u5e74\u56e0[\uff1a:]?/g, '')
    .replace(/\u540c\u5e74\u7eed\u7bc7/g, '')
    .replace(/\u7eed\u7bc7/g, '')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .trim();
  return cleaned.slice(0, 24) || '\u65e7\u4e8b\u56de\u54cd';
}

function sanitizeThreadContinuationNarrative(text: string, fallback: string): string {
  let cleaned = String(text || '').trim();
  for (const phrase of INTERNAL_THREAD_NARRATIVE_PHRASES) {
    cleaned = cleaned.split(phrase).join('');
  }
  cleaned = cleaned
    .replace(/\u6574\u7406\u884c\u88c5\u524d\u53bb\u8d74\u7ea6/g, '\u628a\u65e7\u7ea6\u6682\u4e14\u6536\u5728\u5fc3\u91cc')
    .replace(/\u5fc5\u987b\u4eb2\u81ea\u7ed9\u51fa\u7684\u4ea4\u4ee3/g, '\u7b49\u65f6\u673a\u6210\u719f\u540e\u518d\u4f5c\u56de\u5e94')
    .replace(/\u5c71\u98ce\u8fc7\u5904/g, '')
    .replace(/\u65e7\u4e8b\u4e0d\u518d\u53ea\u662f\u5ff5\u5934/g, '\u8fd9\u4ef6\u4e8b\u8fd8\u88ab\u8bb0\u7740')
    .replace(/\u5fc5\u987b[\u4e00-\u9fff]*\u91cf\u7684\u4e00\u91cd\u56e0\u679c/g, '\u4ecd\u9700\u65e5\u540e\u6162\u6162\u56de\u5e94')
    .replace(/\u4e00\u91cd\u56e0\u679c/g, '\u4e00\u4ef6\u8fd8\u6709\u56de\u54cd\u7684\u65e7\u4e8b')
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/^[\u002c\uff0c\u003b\uff1b\u3002\s]+/, '')
    .replace(/[\u002c\uff0c\u003b\uff1b]\s*[\u3002\uff01\uff1f]/g, '\u3002')
    .trim();
  return cleaned || fallback;
}

export function buildThreadContinuationEvent(state: CharacterState, thread: PendingThread): any {
  const visibleThreadTitle = cleanVisibleThreadTitle(thread.title);
  const threadText = `${visibleThreadTitle} ${thread.description} ${thread.followUpHint || ''}`;
  const realmName = inferStoryRealmName(threadText);
  const isVeryYoung = Number(state.age ?? 0) < 7;
  const isRealm = !isVeryYoung && (thread.category === 'exploration' || !!realmName || /\u79d8\u5883|\u6d6e\u9601|\u6d1e\u5e9c|\u9057\u8ff9|\u7981\u5730|\u7981\u5236|\u7834\u7981/.test(`${thread.title}${thread.description}`));
  const isCompetition = !isVeryYoung && (thread.category === 'competition' || /\u6bd4\u8bd5|\u8003\u6838|\u5165\u95e8|\u4ed9\u95e8|\u64c2\u53f0/.test(`${thread.title}${thread.description}`));
  const isPromise = !isVeryYoung && (thread.category === 'promise' || /\u7ea6|\u8bfa|\u627f\u8bfa|\u8fd8\u613f|\u8d74\u7ea6/.test(threadText));
  const isTeachingFollowUp = /\u542c\u8bc0|\u6388\u8bc0|\u4f20\u8bc0|\u4fee\u884c\u8bc0|\u5fc3\u6cd5|\u53e3\u8bc0|\u542c\u4fee|\u542c\u6cd5|\u8bb2\u8bc0/.test(threadText);
  const title = isVeryYoung
    ? visibleThreadTitle
    : isRealm
      ? (realmName || visibleThreadTitle)
      : isCompetition
        ? `\u7ea6\u671f\u5df2\u81f3\u00b7${visibleThreadTitle}`
        : isPromise
          ? `\u65e7\u7ea6\u56de\u54cd\u00b7${visibleThreadTitle}`
          : visibleThreadTitle;

  const fallbackNarrative = isTeachingFollowUp
    ? `${state.name}\u6309\u7740\u5148\u524d\u7684\u5631\u5490\uff0c\u5728\u7ea6\u5b9a\u7684\u65f6\u5019\u518d\u53bb\u542c\u8bb2\u3002\u8fd9\u4e00\u56de\u4e0d\u518d\u53ea\u662f\u8bb0\u4f4f\u51e0\u53e5\u8bdd\uff0c\u800c\u662f\u628a\u80fd\u542c\u61c2\u7684\u5173\u8282\u7559\u5728\u5fc3\u91cc\uff0c\u5f80\u540e\u4fee\u884c\u65f6\u4e5f\u591a\u4e86\u4e00\u5904\u53ef\u53cd\u590d\u56de\u60f3\u7684\u8bdd\u5934\u3002`
    : isVeryYoung
    ? `${state.name}\u88ab\u4eb2\u4eba\u62b9\u5728\u80a9\u4e0a\u770b\u4e0a\u4e00\u773c\uff0c\u773c\u775b\u8ddf\u7740\u8349\u987a\u4e0a\u7684\u8774\u8776\u4e1c\u8ddf\u897f\u8ff7\u3002\u4e00\u4f1a\u513f\u4ed6\u4ece\u4eb2\u4eba\u80a9\u4e0a\u4e0b\u6765\uff0c\u63a8\u5f00\u9662\u95e8\u53bb\u62ff\u4e1c\u897f\uff0c\u8e29\u4e86\u4e00\u811a\u6c34\u6c60\u8fb9\u7684\u9ec4\u8717\u725b\uff0c\u4e0d\u6015\uff0c\u53cd\u800c\u8d77\u52b2\u62ff\u5c04\u4e1c\u897f\u62fc\u8d77\u6765\u3002\u6700\u540e\u4ed6\u7a7f\u8d8a\u5c0f\u679c\u6797\u62d8\u4e0a\u4e00\u5757\u5e73\u77f3\uff0c\u62ff\u7740\u4e1c\u897f\u8df3\u4e0b\u6765\uff0c\u4e0a\u9762\u5168\u662f\u8349\u8c1c\u3002\u5927\u4eba\u5728\u80a1\u540e\u4e0d\u8d77\u4e49\u52a8\uff0c\u53ea\u62ff\u7740\u5e06\u5e03\u6e90\u4e1c\u897f\u3002`
    : isRealm
      ? `${state.name}\u4f9d\u7167\u624b\u4e2d\u4fe1\u7269\u4e0e\u5730\u52bf\u53d8\u5316\u91cd\u65b0\u8fa8\u8ba4\u95e8\u6237\u3002\u96fe\u6c14\u5f00\u5408\u4e4b\u95f4\uff0c\u65e7\u65e5\u6240\u89c1\u7ec8\u4e8e\u6709\u4e86\u53ef\u843d\u811a\u7684\u65b9\u4f4d\uff1b\u82e5\u8981\u518d\u8fdb\u4e00\u6b65\uff0c\u4ecd\u9700\u8c28\u614e\u8bd5\u63a2\u7981\u5236\u865a\u5b9e\u3002`
      : isCompetition
        ? `\u7ea6\u671f\u5df2\u8fd1\uff0c${state.name}\u6574\u5907\u8863\u88c5\u4e0e\u968f\u8eab\u5668\u7269\uff0c\u6309\u65f6\u524d\u53bb\u5e94\u8bd5\u3002\u573a\u4e2d\u4eba\u58f0\u6e10\u8d77\uff0c\u8fd9\u4e00\u573a\u6bd4\u8bd5\u5173\u7cfb\u5230\u80fd\u5426\u63a5\u7eed\u65e9\u5148\u7ed3\u4e0b\u7684\u4ed9\u9014\u673a\u7f18\u3002`
        : isPromise
          ? `${state.name}\u5fc3\u91cc\u8fd8\u8bb0\u5f97\u65e9\u5148\u90a3\u6869\u7ea6\u5b9a\uff0c\u5374\u4e0d\u518d\u628a\u5b83\u5f53\u6210\u5fc5\u987b\u72ec\u81ea\u5954\u8d74\u7684\u8fdc\u884c\u3002\u5e74\u7eaa\u5c1a\u5c0f\u6216\u65f6\u673a\u672a\u81f3\u65f6\uff0c\u8fd9\u4efd\u7275\u6302\u53ea\u5316\u4f5c\u957f\u8f88\u7684\u7167\u770b\u3001\u4f20\u8bdd\u6216\u5fc3\u5934\u7684\u76fc\u5934\uff1b\u7b49\u5230\u771f\u6b63\u80fd\u4f5c\u51fa\u56de\u5e94\u7684\u65f6\u5019\uff0c\u8fd9\u6761\u65e7\u7ebf\u624d\u4f1a\u518d\u6b21\u663e\u5f62\u3002`
          : `${state.name}\u6ca1\u6709\u628a\u8fd9\u4e8b\u8bf4\u6210\u4ec0\u4e48\u5927\u9053\u7406\uff0c\u53ea\u5728\u65e5\u5e38\u91cc\u591a\u7559\u4e86\u4e2a\u5c0f\u5c0f\u5ff5\u5934\u3002\u5979\u5411\u8eab\u8fb9\u4eba\u95ee\u4e86\u4e24\u53e5\uff0c\u53c8\u628a\u80fd\u8bb0\u4f4f\u7684\u540d\u5b57\u3001\u5730\u65b9\u548c\u8bdd\u5934\u8bb0\u5728\u5fc3\u91cc\uff1b\u82e5\u4ee5\u540e\u6709\u4eba\u518d\u63d0\u8d77\uff0c\u4fbf\u77e5\u9053\u8be5\u4ece\u54ea\u91cc\u63a5\u7740\u95ee\u3002`;

  const narrative = sanitizeThreadContinuationNarrative(fallbackNarrative, fallbackNarrative);
  return {
    title,
    narrative,
    eventType: isCompetition ? 'normal' : isRealm ? 'exploration' : 'normal',
    changes: isCompetition ? [{ attribute: 'reputation', delta: 1, reason: '\u5b88\u7ea6\u8d74\u8bd5' }] : [],
    newStatuses: [],
    newItems: [], removedItemIds: [], newEquippedItems: [], equipItemIds: [], unequipItemIds: [],
    memory: `${state.age}\u5c81\u7eed\u5199\u7ebf\u7d22\uff1a${thread.title}`,
    cultivationInsight: '',
    hasChoice: false, choice: null, triggeredBreakthrough: false, causedDeath: false, causedAscension: false,
    timeAdvance: shortThreadTimeAdvance(threadText, isVeryYoung),
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [thread.id],
    failThreadIds: [],
    triggerCombat: null,
    newPets: [],
  };
}

// ==================== Task 24: 秘境探索系统 ====================

// 获取当前角色可探索的秘境列表（含冷却状态）
export function deriveThreadChain(threadId: string, allThreads: PendingThread[]): ThreadChainNode[] {
  if (!Array.isArray(allThreads) || allThreads.length === 0 || !threadId) return [];
  const map = new Map<string, PendingThread>();
  for (const t of allThreads) if (t && t.id) map.set(t.id, t);
  const chain: PendingThread[] = [];
  let cur = map.get(threadId);
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift(cur);
    const parentId = (cur as any).parentThreadId as string | undefined;
    cur = parentId ? map.get(parentId) : undefined;
  }
  return chain.map((t, i) => ({
    threadId: t.id,
    parentThreadId: (t as any).parentThreadId,
    depth: i,
    generation: i,
    title: t.title,
    category: t.category,
  }));
}

/**
 * 给定一组已存在线索 + 角色状态，决定是否开新线或关闭旧线。
 * - 当任意线索 progress >= 100 → close
 * - 当 urgency > 70 且未到期 → 新开一条 urgent
 */
export function resolveThreadContinuation(threads: PendingThread[], character: CharacterState): { newThread: PendingThread | null; closeThreadIds: string[] } {
  const closeThreadIds: string[] = [];
  for (const t of threads || []) {
    if (!t) continue;
    if ((t.progress ?? 0) >= 100 || t.status === 'resolved') closeThreadIds.push(t.id);
  }
  let newThread: PendingThread | null = null;
  const urgent = (threads || []).find(t => t && t.status === 'urgent');
  if (!urgent && character.alive) {
    newThread = {
      id: `thread-${character.id}-${(character.age ?? 0)}-${Math.floor(((character.age ?? 0) * 17 + (threads?.length ?? 0) * 31) % 9999)}`,
      title: '新的因果纠缠',
      description: '因角色年岁推进，新的一段因果正在酝酿。',
      category: 'mystery',
      startAge: character.age ?? 0,
      deadlineAge: (character.age ?? 0) + 5,
      status: 'pending',
      progress: 0,
    };
  }
  return { newThread, closeThreadIds };
}

// ===== AI-100: Special Physiques =====
/**
 * 瓶灵效果：若角色有 bottleSpirit 字段，则返回一个受其影响的 status；
 * 否则返回 null（不影响角色）。
 */