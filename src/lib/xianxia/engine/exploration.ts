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
  buildStateContext,
} from './lifecycle';
import {
  inferStoryRealmName,
  normalizeThreadsCompletion,
} from './shared';

function slugifyRealmName(name: string): string {
  const raw = String(name || 'story_realm').trim() || 'story_realm';
  const ascii = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (ascii) return ascii.slice(0, 48);
  let hash = 0;
  for (const ch of raw) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `story_${hash.toString(36)}`;
}

function inferRealmRequirement(text: string): string | undefined {
  const source = String(text || '');
  const specific = source.match(/([\u4e00-\u9fa5]{1,10}(?:玉片|钥匙|钥纹|残图|令牌|符令|禁制手法|破禁法))/);
  if (specific?.[1]) return specific[1];
  if (/钥|钥匙|钥纹|禁制|破禁|残图|令牌|符令|玉片|信物/.test(source)) return '入境信物';
  return undefined;
}

function buildStoryRealmFromText(name: string, text: string, state: CharacterState, thread?: PendingThread): SecretRealm {
  const water = /江|水|潮|雨|雾|渡|溪|河|禁/.test(`${name}${text}`);
  const ancient = /古|旧|昔年|残图|壁刻|禁制|遗/.test(`${name}${text}`);
  const tier: SecretRealm['tier'] = ancient ? 'uncommon' : 'common';
  const realmIdx = Math.max(0, REALMS.findIndex(r => r.id === state.realm));
  const req = inferRealmRequirement(text);
  return {
    id: thread?.realmId || `story_${slugifyRealmName(name)}`,
    name,
    description: String(text || `因缘牵引而显露的${name}。`).slice(0, 180),
    tier,
    minRealm: Math.max(0, Math.min(realmIdx, realmIdx || 1)),
    minAge: Math.max(0, state.age - 1),
    spiritStoneCost: 0,
    discoveredByThreadId: thread?.id,
    entryRequirement: req,
    entryAlternatives: req ? ['参悟信物中的禁制手法', '循原先残图与地势另觅侧径', '等待潮汐/地脉再次开合'] : ['循旧迹探入', '等待地脉气机再显'],
    isStoryRealm: true,
    dangerLevel: /内禁|杀机|禁地|强闯|不敢/.test(text) ? 6 : 3,
    rewardMultiplier: ancient ? 1.4 : 1.1,
    cooldownYears: 3,
    themeTags: [water ? 'water' : 'mystery', ancient ? 'inheritance' : 'treasure', 'story'],
    elementAffinity: water ? 'water' : undefined,
    encounterHints: req
      ? [`凭${req}试探门户`, '沿旧日痕迹复探外围', '另寻破禁之法', '避开内禁杀机']
      : ['循线索探路', '辨认地脉气机', '避开未知禁制'],
    color: water ? '#0ea5e9' : '#a855f7',
    icon: water ? '🌊' : '🏛',
  };
}

export function getDiscoveredStoryRealms(state: CharacterState): SecretRealm[] {
  const realms = new Map<string, SecretRealm>();
  const threads = normalizeThreadsCompletion(state.pendingThreads || []).filter(t => t.status !== 'failed' && t.status !== 'resolved');
  for (const t of threads) {
    const text = `${t.title} ${t.description} ${t.reward || ''} ${t.followUpHint || ''}`;
    const looksRealm = t.category === 'exploration' || /秘境|浮阁|洞府|遗迹|禁地|水府|古阁|江心|残图|禁制|破禁/.test(text);
    if (!looksRealm) continue;
    const name = inferStoryRealmName(text) || (t.title && /秘境|浮阁|洞府|遗迹|禁地|水府|古阁|楼|谷|府|墟|宫|殿/.test(t.title) ? t.title : null);
    if (!name) continue;
    const realm = buildStoryRealmFromText(name, text, state, t);
    realms.set(realm.id, realm);
  }
  const inventoryText = [...(state.inventory || []), ...(state.equipped || [])]
    .map(it => `${it.name} ${it.description || ''} ${it.source || ''}`).join('\n');
  const invName = inferStoryRealmName(inventoryText);
  if (invName) {
    const realm = buildStoryRealmFromText(invName, inventoryText, state);
    realms.set(realm.id, realm);
  }
  const list = [...realms.values()];
  return list
    .filter((realm, idx, arr) => !arr.some((other, j) => j !== idx && other.name.includes(realm.name) && other.name.length > realm.name.length))
    .slice(0, 5);
}

export function getAvailableRealms(state: CharacterState): Array<SecretRealm & {
  onCooldown: boolean;
  cooldownRemaining: number;  // 剩余冷却年数
  timesExplored: number;
  lastExploredAge?: number;
}> {
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  const records = state.exploredRealms || [];
  const storyRealms = getDiscoveredStoryRealms(state);
  const pool = storyRealms.length ? storyRealms : SECRET_REALMS;
  return pool
    .filter(r => realmIdx >= r.minRealm && state.age >= r.minAge)
    .map(r => {
      const rec = records.find(rec => rec.realmId === r.id);
      const lastAge = rec?.lastExploredAge ?? -999;
      const elapsed = state.age - lastAge;
      const onCooldown = elapsed < r.cooldownYears;
      return {
        ...r,
        onCooldown,
        cooldownRemaining: onCooldown ? (r.cooldownYears - elapsed) : 0,
        timesExplored: rec?.timesExplored ?? 0,
        lastExploredAge: rec?.lastExploredAge,
      };
    });
}

// 探索秘境前置校验：返回 { ok, error? }
export function canExploreRealm(state: CharacterState, realmId: string): { ok: boolean; error?: string; realm?: SecretRealm } {
  const realm = [...getDiscoveredStoryRealms(state), ...SECRET_REALMS].find(r => r.id === realmId);
  if (!realm) return { ok: false, error: '秘境不存在' };
  if (!state.alive) return { ok: false, error: '角色已陨落' };
  if (state.combatSession && state.combatSession.status === 'ongoing') {
    return { ok: false, error: '战斗进行中，无法探索秘境' };
  }
  if (state.isAtChoice) return { ok: false, error: '当前有待选择，请先完成选择' };
  const realmIdx = REALMS.findIndex(r => r.id === state.realm);
  if (realmIdx < realm.minRealm) return { ok: false, error: `境界不足，需${REALMS[realm.minRealm].name}以上` };
  if (state.age < realm.minAge) return { ok: false, error: `年龄不足，需${realm.minAge}岁以上` };
  const cost = realm.isStoryRealm ? 0 : realm.spiritStoneCost;
  if (realm.entryRequirement) {
    const hasRequirement = hasRealmEntryRequirement(state, realm.entryRequirement);
    if (!hasRequirement) {
      return { ok: false, error: `尚未掌握入境关窍：需${realm.entryRequirement}，或另寻${(realm.entryAlternatives || ['破禁之法']).join('、')}` };
    }
  }
  if (state.spiritStones < cost) {
    return { ok: false, error: `灵石不足，需${cost}灵石` };
  }
  // 冷却检查
  const rec = (state.exploredRealms || []).find(rec => rec.realmId === realmId);
  if (rec) {
    const elapsed = state.age - rec.lastExploredAge;
    if (elapsed < realm.cooldownYears) {
      return { ok: false, error: `秘境冷却中，还需${realm.cooldownYears - elapsed}年` };
    }
  }
  return { ok: true, realm };
}

// 扣除灵石 + 标记秘境探索 + 返回新 state（探索事件由 AI 生成，引擎只负责状态前置）
export function startExploration(state: CharacterState, realm: SecretRealm): CharacterState {
  const newState: CharacterState = {
    ...state,
    spiritStones: Math.max(0, state.spiritStones - (realm.isStoryRealm ? 0 : realm.spiritStoneCost)),
  };
  // 标记当前探索的秘境（让 buildStateContext 透传给 AI）
  (newState as any)._currentExploration = realm;
  return newState;
}

// ==================== AI-68: 多界飞升派生函数 ====================
// 飞升要求表（按境界 → 三界层级）
export function recordExploration(
  state: CharacterState,
  realmId: string,
  bestReward?: string,
): CharacterState {
  const existing = state.exploredRealms || [];
  const idx = existing.findIndex(r => r.realmId === realmId);
  let newRecords: ExplorationRecord[];
  if (idx >= 0) {
    // 已有记录：更新 lastExploredAge + timesExplored + bestReward
    const old = existing[idx];
    const updated: ExplorationRecord = {
      realmId,
      lastExploredAge: state.age,
      timesExplored: old.timesExplored + 1,
      bestReward: bestReward || old.bestReward,
    };
    newRecords = [...existing];
    newRecords[idx] = updated;
  } else {
    // 新记录
    newRecords = [...existing, {
      realmId,
      lastExploredAge: state.age,
      timesExplored: 1,
      bestReward,
    }];
  }
  // 清除 _currentExploration（探索结束）
  const newState: CharacterState = {
    ...state,
    exploredRealms: newRecords,
  };
  delete (newState as any)._currentExploration;
  return newState;
}




// ==================== AI-86/87/88/89/90: Worker B Additions ====================
// Worker B (xiaoxin-B) - additive only, do not modify existing functions above.
// New derived functions for pill side effects, formation drawing, pet evolution,
// pet insight/communication, and pet combat skills.


















// ---------------- AI-86: Pill Effectiveness & Side Effects ----------------

/**
 * 派生某颗丹药在角色当前状态下的实际服用效果评估。
 * 综合丹药品质、角色境界、体质、当前丹毒累积等因素。
 */
export function deriveSecretRealmAccess(
  realm: SecretRealm,
  character: {
    id?: string;
    age?: number;
    realm?: string;
    inventory?: Array<{ id?: string; name?: string; item_type?: string; description?: string }>;
    statuses?: Array<{ id?: string; name?: string; category?: string }>;
  },
): SecretRealmEntryAttempt {
  const triggers: SecretRealmTriggerCondition[] = [];
  const missing: SecretRealmTriggerCondition[] = [];
  const bypassOptions: string[] = [];
  if (!realm || !character) {
    return {
      realmId: realm?.id ?? '',
      triggers,
      missing: ['key-item', 'map-fragment', 'qi-tide', 'inheritance-token', 'time-window'],
      bypassOptions,
      canAttempt: false,
    };
  }
  const inventory = Array.isArray(character.inventory) ? character.inventory : [];
  const statuses = Array.isArray(character.statuses) ? character.statuses : [];
  const realmName = realm.name ?? '';
  const req = realm.entryRequirement ?? '';
  const alt = Array.isArray(realm.entryAlternatives) ? realm.entryAlternatives.join(' ') : '';
  const nameBlob = `${req} ${alt}`;
  const wantsKeyItem = /钥匙|令牌|残章|信物|key|token/i.test(nameBlob);
  const wantsMapFragment = /碎片|map|残图|地图碎片/i.test(nameBlob);
  const wantsInheritance = /传承|衣钵|inheritance|前任主人|遗物/i.test(nameBlob);

  // key-item
  if (wantsKeyItem) {
    const hasKey = inventory.some(
      (it) =>
        it &&
        (/钥匙|令牌|残章/.test(it.name ?? '') || /钥匙|令牌|残章/.test(it.description ?? '')),
    );
    if (hasKey) triggers.push('key-item');
    else missing.push('key-item');
  }
  // map-fragment
  if (wantsMapFragment) {
    const fragments = inventory.filter((it) => it && /碎片|残图/.test(it.name ?? ''));
    if (fragments.length >= 2) triggers.push('map-fragment');
    else missing.push('map-fragment');
  }
  // qi-tide
  const qiTideOpen = statuses.some(
    (s) => s && (s.id === 'qi_tide_open' || /气潮|灵气潮/.test(s.name ?? '')),
  );
  if (qiTideOpen) triggers.push('qi-tide');
  else if (!wantsKeyItem && !wantsMapFragment && !wantsInheritance) missing.push('qi-tide');
  // inheritance-token
  if (wantsInheritance) {
    const hasToken = inventory.some(
      (it) =>
        it &&
        (/传承|衣钵|信物/.test(it.name ?? '') || /传承|衣钵|信物/.test(it.description ?? '')),
    );
    if (hasToken) triggers.push('inheritance-token');
    else missing.push('inheritance-token');
  }
  // time-window
  if (!realm.isStoryRealm) {
    const age = typeof character.age === 'number' ? character.age : 0;
    if (age >= realm.minAge) triggers.push('time-window');
    else missing.push('time-window');
  }

  // bypass: alternatives whose first 2 chars overlap with an inventory item name
  if (Array.isArray(realm.entryAlternatives)) {
    for (const a of realm.entryAlternatives) {
      const altLower = a.toLowerCase();
      const matched = inventory.some(
        (it) => it && it.name && altLower.includes(it.name.toLowerCase().slice(0, 2)),
      );
      if (matched) bypassOptions.push(a);
    }
  }

  const canAttempt = missing.length === 0 || bypassOptions.length > 0;
  return { realmId: realm.id, triggers, missing, bypassOptions, canAttempt };
}

/**
 * AI-G112: Resolve a SecretRealm entry attempt given player choice.
 * choice: 'first' (use first trigger), 'best' (highest-priority trigger),
 *         'bypass' (use a bypass option if available).
 */
export function resolveSecretRealmEntry(
  attempt: SecretRealmEntryAttempt,
  choice: 'first' | 'best' | 'bypass',
): { entered: boolean; sideEffect: string; narrativeHint: string } {
  if (!attempt)
    return { entered: false, sideEffect: 'attempt 缺失', narrativeHint: '秘境尝试无效' };
  if (!attempt.canAttempt) {
    return {
      entered: false,
      sideEffect: `缺少触发条件：${attempt.missing.join(' / ')}`,
      narrativeHint: `你尚未备齐进入秘境所需之物：${attempt.missing.join('、')}；可尝试寻找${attempt.bypassOptions.join('、') || '其他通路'}。`,
    };
  }
  const triggers = attempt.triggers.length > 0 ? attempt.triggers : (['key-item'] as SecretRealmTriggerCondition[]);
  let chosen: SecretRealmTriggerCondition = triggers[0];
  if (choice === 'best') {
    const priority: SecretRealmTriggerCondition[] = [
      'inheritance-token',
      'map-fragment',
      'key-item',
      'qi-tide',
      'time-window',
    ];
    chosen = priority.find((t) => triggers.includes(t)) ?? triggers[0];
  } else if (choice === 'bypass') {
    if (attempt.bypassOptions.length === 0) {
      return { entered: false, sideEffect: '无可绕开通路', narrativeHint: '此秘境并无备用通路。' };
    }
    return {
      entered: true,
      sideEffect: '旁门捷径消耗部分灵力',
      narrativeHint: `你借${attempt.bypassOptions[0]}绕开主禁制，悄悄入内。`,
    };
  }

  const sideEffects: Record<SecretRealmTriggerCondition, string> = {
    'key-item': '令牌微微发热，未见异状',
    'map-fragment': '地图碎片共鸣，指明前路',
    'qi-tide': '气潮涌入经脉，略有鼓胀',
    'inheritance-token': '前人遗韵一缕，识海微震',
    'time-window': '时辰契合，门户轻启',
  };
  const narrativeHints: Record<SecretRealmTriggerCondition, string> = {
    'key-item': `你持${chosen}扣响秘境之门，禁制应声而开。`,
    'map-fragment': `碎片拼合后显现光纹，你循光步入${attempt.realmId}。`,
    'qi-tide': '恰逢气潮涌动，你借灵气潮汐推门而入。',
    'inheritance-token': '传承信物泛起柔和光泽，秘境仿佛认出了来人。',
    'time-window': '正是时辰之窗，秘境禁制暂歇。',
  };
  return {
    entered: true,
    sideEffect: sideEffects[chosen],
    narrativeHint: narrativeHints[chosen],
  };
}

/**
 * AI-G113: Derive a richer BidderBehaviorProfile from a bidder + item context.
 * Expands the 4-type BidderPersonality into 5 BidderArchetypes with wealth & hostility.
 */