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
  normalizeCultivationState,
} from './attributes';
import {
  executeAIEvent,
} from './execute-ai-event';
import {
  addItems,
  buildCombatVictorySpoils,
  buildLearnedCombatArts,
  consumeItem,
} from './items';
import {
  realmPowerMultiplier,
} from './shared';
import {
  buildQuestEntriesFromThreads,
} from './threads';
import {
  buildEmptyWorldMap,
  deriveTravelFeasibility,
  discoverLocation,
  generateRandomEncounter,
  summarizeWorldForPrompt,
} from './world';

function combatArtKind(art: { sourceType?: string; itemId?: string }, state: CharacterState): 'technique' | 'spell' | 'artifact' {
  if (art.sourceType === 'artifact') return 'artifact';
  const item = art.itemId ? (state.equipped || []).find(it => it.id === art.itemId) : undefined;
  if (item?.item_type === 'artifact') return 'artifact';
  if (item?.item_type === 'scripture') return 'technique';
  return 'spell';
}

function buildSkillCombatOption(sk: NonNullable<CombatSession['playerSkills']>[number], idx: number, kind: 'technique' | 'spell' | 'artifact', session: CombatSession, sealed: boolean): CombatActionOption {
  return {
    id: `skill-${idx}`,
    name: sk.name,
    description: sk.description || (kind === 'technique' ? '\u501f\u529f\u6cd5\u884c\u6c14\u8def\u6570\u5e94\u6218\u3002' : '\u50ac\u52a8\u5df2\u638c\u63e1\u7684\u672f\u5f0f\u3002'),
    actionType: kind === 'technique' ? 'technique' : 'spell',
    source: kind === 'artifact' ? 'artifact' : kind,
    enabled: !sealed && session.playerMp >= (sk.mpCost || 0),
    disabledReason: sealed ? '\u7075\u529b\u53d7\u5236\uff0c\u96be\u4ee5\u6210\u5f62\u3002' : session.playerMp < (sk.mpCost || 0) ? '\u6cd5\u529b\u4e0d\u8db3\u3002' : undefined,
    skillIdx: idx,
    itemId: sk.itemId,
    mpCost: sk.mpCost || 0,
    risk: sk.adaptation != null && sk.adaptation < 0.7 ? '\u9002\u914d\u4e0d\u8db3\uff0c\u53ef\u80fd\u53cd\u566c\u6216\u5a01\u529b\u6298\u635f\u3002' : undefined,
    requiredItems: sk.itemId ? [sk.itemId] : undefined,
    tags: [kind],
    // 软提示：名称/描述含群攻语义时标为 aoe，供 UI 与 AI 参考；AI 仍可根据法术性质决定实际波及。
    targetScope: /群|范围|横扫|席卷|波及|全场|漫天|笼罩|风暴|燎原|万剑|阵|爆|扇/.test(`${sk.name || ''}${sk.description || ''}`) ? 'aoe' : undefined,
  };
}

function normalizeCombatDedupeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, '');
}

function combatTriggerEnemyNames(trigger: NonNullable<AIEventOutput['triggerCombat']>): string[] {
  return Array.from(new Set((trigger.enemies || [])
    .map((enemy) => normalizeCombatDedupeText(enemy?.name))
    .filter((name) => name.length >= 2)));
}

function combatTriggerSceneTokens(trigger: NonNullable<AIEventOutput['triggerCombat']>): string[] {
  const text = normalizeCombatDedupeText(`${trigger.contextTitle || ''}${trigger.contextNarrative || ''}`);
  const tokens = ['晒谷场', '旧嫌', '冲突', '约', '狗蛋', '虎子', '秘境', '洞府', '坊市', '山林', '江边', '村头', '宗门'];
  return tokens.filter((token) => text.includes(token));
}

function hasSameAgeResolvedCombat(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>): boolean {
  const enemyNames = combatTriggerEnemyNames(trigger);
  if (!enemyNames.length) return false;
  const sceneTokens = combatTriggerSceneTokens(trigger);
  const nodes = state.causalGraph?.nodes || [];
  return nodes.some((node: any) => {
    if (node?.age !== state.age) return false;
    const id = normalizeCombatDedupeText(node?.id);
    const text = normalizeCombatDedupeText(`${node?.label || ''}${node?.title || ''}${node?.summary || ''}`);
    const looksEnded = id.includes('combat_end') || text.includes('战斗得胜') || text.includes('战罢') || text.includes('胜过');
    if (!looksEnded) return false;
    const sameEnemy = enemyNames.some((name) => text.includes(name));
    if (!sameEnemy) return false;
    if (!sceneTokens.length) return true;
    return sceneTokens.some((token) => text.includes(token));
  });
}

function resolveConsumedCombatSceneThreads(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>, note: string): CharacterState {
  const enemyNames = combatTriggerEnemyNames(trigger);
  const sceneTokens = combatTriggerSceneTokens(trigger);
  if (!enemyNames.length && !sceneTokens.length) return state;
  let changed = false;
  const pendingThreads = (state.pendingThreads || []).map((thread) => {
    if (thread.status !== 'pending' && thread.status !== 'urgent') return thread;
    const text = normalizeCombatDedupeText(`${thread.title || ''}${thread.description || ''}${thread.summary || ''}${thread.sourceEventTitle || ''}${thread.followUpHint || ''}`);
    if (text.includes('报复') || text.includes('追杀') || text.includes('余波')) return thread;
    const sameEnemy = enemyNames.some((name) => text.includes(name));
    const sameScene = sceneTokens.some((token) => text.includes(token));
    if (!sameEnemy && !sameScene) return thread;
    changed = true;
    return {
      ...thread,
      status: 'resolved' as const,
      progress: Math.max(thread.progress || 0, 100),
      resolution: thread.resolution || note,
    };
  });
  return changed ? { ...state, pendingThreads, questEntries: buildQuestEntriesFromThreads(pendingThreads, state.age) } : state;
}

// 启动战斗：从 AI 触发的 triggerCombat 创建 CombatSession
export function startCombat(state: CharacterState, trigger: NonNullable<AIEventOutput['triggerCombat']>): CharacterState {
  // P1-8 幼龄硬拦截：age<6 禁止战斗。return 原 state（不创建 CombatSession），
  // 调用方（executeAIEvent / choose / interfere）会处理拒绝叙事。
  if (state.age < 6) {
    return state;
  }
  if (hasSameAgeResolvedCombat(state, trigger)) {
    return resolveConsumedCombatSceneThreads(state, trigger, '同一场冲突已经了结，引擎拦截重复开战');
  }

  const realmPower = realmPowerMultiplier(state);
  const session: CombatSession = {
    id: `combat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    enemies: trigger.enemies.map(e => ({ ...e, maxHp: e.maxHp || e.hp, currentCooldown: 0 })),
    currentEnemyIdx: 0,
    round: 1,
    log: [],
    status: 'ongoing',
    startAge: state.age,
    contextTitle: trigger.contextTitle,
    contextNarrative: trigger.contextNarrative,
    playerHp: state.hp,
    playerMaxHp: state.maxHp,
    playerMp: state.mp,
    playerMaxMp: state.maxMp,
    playerAttack: state.attack,
    playerDefense: state.defense,
    playerSpeed: state.speed,
    // 修仙三宝·身神——影响实际战斗：破势/护持/机变在 damage 公式里替换基础攻防速
    playerForce: (state as any).combatProjection?.force ?? state.attack,
    playerGuard: (state as any).combatProjection?.guard ?? state.defense,
    playerAgility: (state as any).combatProjection?.agility ?? state.speed,
    playerSpiritualSense: (state as any).spiritualSense ?? 0,
    playerSoulStrength: (state as any).soulStrength ?? 0,
    playerPhysicalFoundation: (state as any).physicalFoundation ?? 0,
    playerLuck: state.luck ?? 0,
    playerComprehension: state.comprehension ?? 0,
    // 从已装备功法/法宝提取可施展术法（与「宝」页习得法术同源）
    playerSkills: buildLearnedCombatArts(state).slice(0, 4),
    // 从背包提取丹药（consumable 类）
    playerItems: (state.inventory || [])
      .filter(it => it.item_type === 'consumable')
      .slice(0, 6)
      .map(it => ({
        itemId: it.id,
        name: it.name,
        description: it.description,
        effect: (it.effects || []).map(e => `${e.operation === 'add' ? '+' : '×'}${e.value} ${e.target_attribute}`).join('，') || '无效果',
      })),
    victoryDrops: trigger.victoryDrops,
    // Task 22: 心魔试炼字段透传
    victoryHeartDemonDelta: trigger.victoryHeartDemonDelta,
    defeatHeartDemonDelta: trigger.defeatHeartDemonDelta,
    isHeartDemonTrial: trigger.isHeartDemonTrial,
  };
  // Task 23: 选择忠诚度最高且饱食度足够的灵宠参战（satiety >= 20 才参战）
  // 心魔试炼战斗灵宠无法参战（心魔投影不属于现实战场）
  if (!trigger.isHeartDemonTrial && state.pets && state.pets.length > 0) {
    const eligible = state.pets
      .filter(p => p.loyalty >= 30 && p.satiety >= 20 && p.hp > 0)
      .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense));
    if (eligible.length > 0) {
      const pet = eligible[0];
      session.petCombatant = {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        hp: pet.hp,
        maxHp: pet.maxHp,
        attack: pet.attack,
        defense: pet.defense,
        speed: pet.speed,
        skillName: pet.skill.name,
        skillDesc: pet.skill.description,
        skillPower: pet.skill.power,
        skillCooldown: pet.skill.cooldown,
        currentCooldown: 0,
        element: pet.element,
      };
    }
  }
  session.playerSkills = repairCombatArtsFromState(state, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(state, session);
  return { ...state, combatSession: session };
}

// 战斗伤害计算（简化版：基于攻防差 + 随机浮动）

function lowerText(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// P1-8 幼龄叙事重写：把 AI 误写的"独自/前往/追查/赶路/独行/寻访"等成人化动词
// 改写为"被带去/看护下/懵懂盼头"等幼儿化口吻，保持叙事连续性又不会破坏沉浸。
function hasRestrainingStatus(state: CharacterState, session?: CombatSession): boolean {
  const text = lowerText(
    session?.contextTitle,
    session?.contextNarrative,
    ...(state.activeStatuses || []).map(s => `${s.name} ${s.description}`),
    ...(session?.log || []).slice(-3).map(r => r.narrative),
  );
  return new RegExp('\\u675f\\u7f1a|\\u6346|\\u7ed1|\\u7f1a|\\u62d8|\\u7981\\u9522|\\u9501|\\u7f51|\\u7f20|\\u5c01\\u4f4f\\u53cc\\u624b|\\u624b\\u811a\\u88ab').test(text);
}

function hasSealedSpiritStatus(state: CharacterState, session?: CombatSession): boolean {
  const text = lowerText(
    session?.contextTitle,
    session?.contextNarrative,
    ...(state.activeStatuses || []).map(s => `${s.name} ${s.description}`),
    ...(session?.log || []).slice(-3).map(r => r.narrative),
  );
  return new RegExp('\\u5c01\\u7075|\\u7981\\u7075|\\u7075\\u529b\\u51dd\\u6ede|\\u6cd5\\u529b\\u88ab\\u5c01|\\u7ecf\\u8109\\u53d7\\u5236').test(text);
}

function weaponLikeItems(state: CharacterState): ItemEntry[] {
  return (state.equipped || []).filter(it => {
    const text = `${it.name} ${it.description || ''} ${it.item_type || ''}`;
    return it.item_type === 'weapon' || new RegExp('\\u5251|\\u5200|\\u67aa|\\u621f|\\u5f13|\\u9488|\\u5203|\\u9524|\\u68cd|\\u77db|\\u65a7|\\u97ad|\\u73af').test(text);
  });
}

function armorLikeItems(state: CharacterState): ItemEntry[] {
  return (state.equipped || []).filter(it => {
    const text = `${it.name} ${it.description || ''} ${it.item_type || ''}`;
    return it.item_type === 'armor' || new RegExp('\\u7532|\\u888d|\\u8863|\\u76fe|\\u955c|\\u51a0|\\u9774|\\u62a4|\\u94e0|\\u80c4').test(text);
  });
}

function optionById(palette: CombatActionPalette | undefined, optionId?: string): CombatActionOption | undefined {
  if (!palette || !optionId) return undefined;
  for (const group of [palette.basicAttack, palette.technique, palette.spell, palette.defense, palette.item, palette.other]) {
    const found = group.options.find(o => o.id === optionId);
    if (found) return found;
  }
  return undefined;
}

export function buildCombatActionPalette(state: CharacterState, session: CombatSession): CombatActionPalette {
  const restrained = hasRestrainingStatus(state, session);
  const sealed = hasSealedSpiritStatus(state, session);
  const weapons = weaponLikeItems(state);
  const armors = armorLikeItems(state);
  const skills = repairCombatArtsFromState(state, session.playerSkills).slice(0, 8);
  session.playerSkills = skills;
  const items = session.playerItems || [];
  const basicOptions: CombatActionOption[] = [];

  basicOptions.push({
    id: 'basic-mana-burst',
    name: '法力轰击',
    description: '以自身法力直接轰出，粗粝但不依赖兵器。',
    actionType: 'basic_attack',
    source: 'body',
    enabled: !sealed && session.playerMp >= 3,
    disabledReason: sealed ? '灵力受制，难以外放法力。' : session.playerMp < 3 ? '法力不足。' : undefined,
    mpCost: 3,
    intent: '以自身灵力试探性攻伐',
    tags: ['mana', 'fallback'],
  });

  for (const weapon of weapons.slice(0, 5)) {
    basicOptions.push({
      id: `weapon-${weapon.id}`,
      name: weapon.name,
      description: `${weapon.name}当前在手，可作为普通攻伐手段。`,
      actionType: 'basic_attack',
      source: 'weapon',
      enabled: !restrained,
      disabledReason: restrained ? '手脚受制，难以挥使兵器。' : undefined,
      itemId: weapon.id,
      mpCost: 0,
      intent: `以${weapon.name}近身或御使攻敌`,
      requiredItems: [weapon.id],
      tags: ['weapon'],
    });
  }

  if (!weapons.length) {
    basicOptions.push({
      id: 'basic-body-strike',
      name: '拳脚近击',
      description: '以体魄和身法贴身攻敌。',
      actionType: 'basic_attack',
      source: 'body',
      enabled: !restrained,
      disabledReason: restrained ? '手脚受制，无法近身出手。' : undefined,
      mpCost: 0,
      tags: ['body'],
    });
  }

  const techniqueOptions: CombatActionOption[] = [];
  const spellOptions: CombatActionOption[] = [];
  const artifactSpellOptions: CombatActionOption[] = [];
  skills.slice(0, 8).forEach((sk, idx) => {
    const kind = combatArtKind(sk, state);
    const option = buildSkillCombatOption(sk, idx, kind, session, sealed);
    if (kind === 'technique') techniqueOptions.push(option);
    else if (kind === 'artifact') artifactSpellOptions.push(option);
    else spellOptions.push(option);
  });

  const defenseOptions: CombatActionOption[] = [{
    id: 'defense-guard',
    name: '护体守势',
    description: '收束气机护住要害，降低下一轮承伤。',
    actionType: 'defense',
    source: 'body',
    enabled: true,
    mpCost: 0,
    tags: ['guard'],
  }];

  for (const armor of armors.slice(0, 4)) {
    defenseOptions.push({
      id: `armor-${armor.id}`,
      name: `${armor.name}护身`,
      description: `借${armor.name}承受来袭攻势；若攻势过强，可能损伤此物。`,
      actionType: 'defense',
      source: 'armor',
      enabled: true,
      itemId: armor.id,
      requiredItems: [armor.id],
      tags: ['armor'],
    });
  }

  const itemOptions = items.map((it): CombatActionOption => ({
    id: `item-${it.itemId}`,
    name: it.name,
    description: it.effect || it.description || '战斗中可用之物。',
    actionType: 'item',
    source: 'item',
    enabled: !restrained,
    disabledReason: restrained ? '手脚受制，难以取用物品。' : undefined,
    itemId: it.itemId,
    tags: ['item'],
  }));

  const otherOptions: CombatActionOption[] = [];
  if (restrained) {
    otherOptions.push({
      id: 'other-break-binding',
      name: '催力挣缚',
      description: sealed ? '强行调动残余气血与体魄挣开束缚。' : '鼓荡法力撑破束缚，争取恢复行动。',
      actionType: 'other',
      source: sealed ? 'body' : 'status',
      enabled: true,
      mpCost: sealed ? 0 : Math.min(8, Math.max(3, Math.floor(session.playerMaxMp * 0.08))),
      risk: '若失败，可能露出破绽。',
      intent: '解除当前束缚',
      tags: ['break-binding', 'scene'],
    });
  }
  otherOptions.push({ id: 'other-observe-opening', name: '观隙寻机', description: '暂缓强攻，观察敌人气机、法器与防护破绽。', actionType: 'other', source: 'ai', enabled: true, mpCost: 0, intent: '寻找下一轮机会', tags: ['observe'] });
  if (session.pendingImpulse?.reason === 'stalemate' || (session.stalemateStreak || 0) >= 2) {
    otherOptions.unshift(
      { id: 'other-stalemate-lure', name: '诱其露绽', description: '不再硬拼，以虚招与身位诱对方护势换气，争取下一拍破绽。', actionType: 'other', source: 'ai', enabled: true, mpCost: 0, intent: '打破僵持，诱使敌人露出护身或站位破绽', tags: ['observe', 'stalemate-breaker'] },
      { id: 'other-stalemate-risk', name: '行险破局', description: '冒险压近或催动异招，赌一线转机；若判断失误，可能反受其制。', actionType: 'other', source: 'ai', enabled: true, mpCost: Math.min(8, Math.max(0, Math.floor(session.playerMaxMp * 0.06))), risk: '若时机不合，可能被敌人抓住破绽。', intent: '用高风险手段打破互耗僵局', tags: ['stalemate-breaker', 'risk'] }
    );
  }
  otherOptions.push({ id: 'other-flee', name: '伺机脱身', description: '借地形或烟尘尝试脱离战场。', actionType: 'flee', source: 'environment', enabled: true, mpCost: 0, tags: ['flee'] });

  const palette: CombatActionPalette = {
    basicAttack: { enabled: basicOptions.some(o => o.enabled), label: '普攻', disabledReason: basicOptions.some(o => o.enabled) ? undefined : (restrained ? '当前受制，常规攻伐难以施展。' : '暂无可用普攻。'), options: basicOptions },
    technique: { enabled: techniqueOptions.some(o => o.enabled), label: '功法', disabledReason: techniqueOptions.length ? '当前功法运转受限。' : '暂无可用功法。', options: techniqueOptions },
    spell: { enabled: [...spellOptions, ...artifactSpellOptions].some(o => o.enabled), label: '法术', disabledReason: (spellOptions.length || artifactSpellOptions.length) ? '当前法术受限。' : '暂无可用法术。', options: [...spellOptions, ...artifactSpellOptions] },
    defense: { enabled: defenseOptions.some(o => o.enabled), label: '防御', options: defenseOptions },
    item: { enabled: itemOptions.some(o => o.enabled), label: '物品', disabledReason: itemOptions.length ? '当前难以取用物品。' : '暂无可用物品。', options: itemOptions },
    other: { enabled: otherOptions.some(o => o.enabled), label: '应变', options: otherOptions },
    generatedBy: 'engine-fallback',
    sceneHint: restrained ? '当前行动受束缚影响，AI 可生成解除、拖延、神识或环境应变。' : undefined,
    tacticalSituation: session.tacticalSituation,
  };
  return mergeAiOptionsIntoPalette(palette, session.aiActionOptions, session.tacticalSituation);
}

function isStalemateBreakerOption(option?: CombatActionOption): boolean {
  return !!option && ((option.tags || []).includes('stalemate-breaker') || String(option.id || '').startsWith('other-stalemate-'));
}

function recentCombatLowProgressStreak(session: CombatSession, round: CombatRound, selectedOption?: CombatActionOption): number {
  if (round.playerActionType === 'flee' || isStalemateBreakerOption(selectedOption)) return 0;
  const playerDamage = Math.max(0, Number(round.playerDamage || 0));
  const enemyDamage = Math.max(0, Number(round.enemyDamage || 0));
  const meaningfulHit = playerDamage >= 4 || enemyDamage >= 4;
  const meaningfulState = (round.playerHeal || 0) > 0 || (round.playerHits || []).some(h => h.dead) || (round.enemyActions || []).some(a => a.dead || a.actionType === 'stunned' || a.actionType === 'flee');
  if (meaningfulHit || meaningfulState) return 0;
  const previous = (session.log || []).slice(-2);
  const previousLow = previous.filter(r => Math.max(0, Number(r.playerDamage || 0)) <= 2 && Math.max(0, Number(r.enemyDamage || 0)) <= 2 && !(r.playerHits || []).some(h => h.dead)).length;
  return Math.max(Number(session.stalemateStreak || 0), previousLow) + 1;
}

function buildStalemateImpulse(session: CombatSession, enemy?: CombatEnemy, streak = 0): NonNullable<CombatSession['pendingImpulse']> {
  const target = enemy?.name || session.enemies?.[session.currentEnemyIdx]?.name || '敌手';
  const text = streak >= 4
    ? `你与${target}又一次错身而过，攻势被护身灵光磨散，对方也难真正逼入要害。这样耗下去，只会把灵力与耐心一并拖干；必须改换打法，寻破绽、诱其露形，或趁势脱身。`
    : `你察觉这场交锋一时陷入僵持：硬攻难入，对方也难一举压倒你。若继续照旧出手，恐怕只是徒耗气机；此刻该换个破局法子。`;
  return { kind: 'contingency', reason: 'stalemate', prompt: text };
}

function deriveFallbackTacticalSituation(session: CombatSession, round: CombatRound, stalemateStreak = 0): NonNullable<CombatSession['tacticalSituation']> {
  const playerDamage = Math.max(0, Number(round.playerDamage || 0));
  const enemyDamage = Math.max(0, Number(round.enemyDamage || 0));
  const playerHpPct = session.playerMaxHp > 0 ? session.playerHp / session.playerMaxHp : 1;
  let tempo: NonNullable<CombatSession['tacticalSituation']>['tempo'] = 'chaos';
  let advantage: NonNullable<CombatSession['tacticalSituation']>['advantage'] = 'unclear';
  if (stalemateStreak >= 3 || (playerDamage <= 2 && enemyDamage <= 2)) { tempo = 'stalemate'; advantage = 'even'; }
  else if (playerHpPct <= 0.35 || enemyDamage >= Math.max(8, playerDamage * 2)) { tempo = 'danger'; advantage = 'enemy'; }
  else if (playerDamage >= Math.max(8, enemyDamage * 2)) { tempo = 'pressing'; advantage = 'player'; }
  else if ((round.playerHits || []).some(h => h.dead) || round.playerHeal) { tempo = 'turning'; advantage = 'player'; }
  const reason = tempo === 'stalemate'
    ? '双方护势与身法互相抵住，硬拼难以打开局面。'
    : tempo === 'danger'
      ? '敌方压力正在逼近要害，需要尽快守御、脱身或反制。'
      : tempo === 'pressing'
        ? '这一拍攻势压住了对方气机，可趁势扩大战果。'
        : '战场气机仍在剧烈变化，需观察下一处破口。';
  return {
    tempo,
    advantage,
    reason,
    playerOpening: tempo === 'stalemate' ? '诱其护势换气，或借地形逼其移步。' : undefined,
    enemyPressure: tempo === 'danger' ? '敌方攻势已逼近气血与护体薄处。' : undefined,
    suggestedFocus: tempo === 'stalemate' ? '改用应变破局' : tempo === 'danger' ? '守御或脱身' : tempo === 'pressing' ? '趁势追击' : '观势再动',
  };
}

function sanitizeTacticalSituation(proposal: CombatRoundProposal, fallback: NonNullable<CombatSession['tacticalSituation']>): NonNullable<CombatSession['tacticalSituation']> {
  const raw = proposal.tacticalSituation || {};
  const tempos = new Set(['pressing', 'stalemate', 'opening', 'danger', 'flee_window', 'turning', 'chaos']);
  const advantages = new Set(['player', 'enemy', 'even', 'unclear']);
  return {
    tempo: tempos.has(raw.tempo as any) ? raw.tempo as any : fallback.tempo,
    advantage: advantages.has(raw.advantage as any) ? raw.advantage as any : fallback.advantage,
    reason: String(raw.reason || fallback.reason).slice(0, 100),
    playerOpening: raw.playerOpening ? String(raw.playerOpening).slice(0, 90) : fallback.playerOpening,
    enemyPressure: raw.enemyPressure ? String(raw.enemyPressure).slice(0, 90) : fallback.enemyPressure,
    suggestedFocus: raw.suggestedFocus ? String(raw.suggestedFocus).slice(0, 70) : fallback.suggestedFocus,
  };
}

function validateAiCombatActions(state: CharacterState, session: CombatSession, proposal: CombatRoundProposal): CombatActionOption[] {
  const actions = Array.isArray(proposal.nextActions) ? proposal.nextActions : [];
  const validTypes = new Set(['basic_attack', 'defense', 'other', 'flee', 'item', 'talisman', 'technique', 'spell']);
  const seen = new Set<string>();
  return actions.map((raw, idx): CombatActionOption | null => {
    const actionType = validTypes.has(String(raw.actionType || '')) ? raw.actionType as CombatActionOption['actionType'] : 'other';
    const name = String(raw.name || '').trim().slice(0, 18);
    const description = String(raw.description || '').trim().slice(0, 100);
    if (!name || !description) return null;
    const option: CombatActionOption = {
      id: 'ai-' + String(raw.id || name || idx).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) + '-' + idx,
      name,
      description,
      actionType,
      source: 'ai',
      enabled: raw.enabled !== false,
      disabledReason: raw.disabledReason ? String(raw.disabledReason).slice(0, 60) : undefined,
      mpCost: Math.max(0, Math.min(session.playerMp, Math.floor(Number(raw.mpCost || 0)))) || 0,
      risk: raw.risk ? String(raw.risk).slice(0, 60) : undefined,
      intent: raw.intent ? String(raw.intent).slice(0, 80) : description,
      tags: Array.from(new Set([...(Array.isArray(raw.tags) ? raw.tags.map(String) : []), 'ai-context'])).slice(0, 6),
    };
    if ((actionType === 'item' || actionType === 'talisman') && raw.itemId) {
      const item = state.inventory.find(it => it.id === raw.itemId);
      if (!item) return null;
      option.itemId = item.id;
      option.requiredItems = [item.id];
    } else if (actionType === 'item' || actionType === 'talisman') {
      return null;
    }
    if ((actionType === 'technique' || actionType === 'spell') && raw.skillIdx != null) {
      const skillIdx = Math.floor(Number(raw.skillIdx));
      if (!session.playerSkills?.[skillIdx]) return null;
      option.skillIdx = skillIdx;
    } else if (actionType === 'technique' || actionType === 'spell') {
      option.actionType = 'other';
      option.tags = Array.from(new Set([...(option.tags || []), 'converted-art-intent']));
    }
    if (seen.has(option.id)) option.id += '-' + seen.size;
    seen.add(option.id);
    return option;
  }).filter(Boolean).slice(0, 5) as CombatActionOption[];
}

function mergeAiOptionsIntoPalette(palette: CombatActionPalette, aiOptions?: CombatActionOption[], tacticalSituation?: NonNullable<CombatSession['tacticalSituation']>): CombatActionPalette {
  if (!aiOptions?.length && !tacticalSituation) return palette;
  const next: CombatActionPalette = { ...palette, generatedBy: aiOptions?.length ? 'hybrid' : palette.generatedBy, tacticalSituation };
  const add = (key: CombatActionGroupKey, option: CombatActionOption) => {
    const group = next[key];
    const exists = group.options.some(o => o.id === option.id);
    const options = exists ? group.options : [option, ...group.options];
    next[key] = { ...group, enabled: options.some(o => o.enabled), options };
  };
  for (const option of aiOptions || []) {
    if (option.actionType === 'basic_attack') add('basicAttack', option);
    else if (option.actionType === 'defense') add('defense', option);
    else if (option.actionType === 'item' || option.actionType === 'talisman') add('item', option);
    else if (option.actionType === 'technique') add('technique', option);
    else if (option.actionType === 'spell') add('spell', option);
    else add('other', option);
  }
  return next;
}

function validateCombatActionOption(state: CharacterState, session: CombatSession, option?: CombatActionOption): { ok: boolean; reason?: string } {
  if (!option) return { ok: true };
  if (!option.enabled) return { ok: false, reason: option.disabledReason || '此刻不可施展。' };
  if (option.mpCost && session.playerMp < option.mpCost) return { ok: false, reason: '法力不足。' };
  const equippedIds = new Set((state.equipped || []).map(it => it.id));
  const inventoryIds = new Set((state.inventory || []).map(it => it.id));
  for (const itemId of option.requiredItems || []) {
    if (!equippedIds.has(itemId) && !inventoryIds.has(itemId)) return { ok: false, reason: '前置器物已经不在身边。' };
  }
  for (const forbidden of option.forbiddenStatuses || []) {
    if ((state.activeStatuses || []).some(s => s.name === forbidden || s.id === forbidden)) return { ok: false, reason: '当前状态不允许此行动。' };
  }
  return { ok: true };
}

function computeDamage(attack: number, defense: number, power: number = 1, variance: number = 0.2): number {
  const base = Math.max(1, attack - defense * 0.5);
  const dmg = base * power * (1 + (Math.random() * 2 - 1) * variance);
  return Math.max(1, Math.floor(dmg));
}

function isGenericCombatArtName(name?: string): boolean {
  const text = String(name || '').trim();
  if (!text) return true;
  return /行动.*气术|气术式|未名术|^术法$/.test(text);
}

function repairCombatArtsFromState(state: CharacterState, arts?: CombatSession['playerSkills']): NonNullable<CombatSession['playerSkills']> {
  const learned = buildLearnedCombatArts(state).slice(0, 8);
  const firstByItem = new Map<string, typeof learned[number]>();
  for (const art of learned) if (!firstByItem.has(art.itemId)) firstByItem.set(art.itemId, art);
  const source = arts?.length ? arts : learned;
  const repaired = source.map((art, idx) => {
    const learnedMatch = (art.itemId ? firstByItem.get(art.itemId) : undefined) || learned[idx];
    if (!learnedMatch) return art;
    const desc = String(art.description || '');
    const learnedIsArtifactArt = learnedMatch.sourceType === 'artifact';
    const nameLooksLikeItemName = state.equipped?.some((it: any) => it.id === art.itemId && art.name === it.name);
    if (!learnedIsArtifactArt && !nameLooksLikeItemName && !isGenericCombatArtName(art.name) && desc && !/行动.*气术|气术式/.test(desc)) return art;
    return { ...art, name: learnedMatch.name, description: learnedMatch.description, mpCost: art.mpCost ?? learnedMatch.mpCost, power: art.power || learnedMatch.power, element: art.element || learnedMatch.element, adaptation: art.adaptation ?? learnedMatch.adaptation, sourceType: learnedMatch.sourceType || art.sourceType };
  });
  return (repaired.length ? repaired : learned) as NonNullable<CombatSession['playerSkills']>;
}

function addCombatWeaknessInsight(session: CombatSession, enemyIdx: number, source: string): void {
  const insights = (session.tacticalInsights || []).filter(x => x.expiresRound >= session.round && x.stacks > 0);
  const existing = insights.find(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx);
  if (existing) {
    existing.stacks = Math.min(3, existing.stacks + 1);
    existing.expiresRound = Math.max(existing.expiresRound, session.round + 3);
    existing.note = '已记下对手气机间一处破绽，下次攻伐更容易命中要害。';
  } else {
    insights.push({ id: 'weak_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), enemyIdx, kind: 'weakness', stacks: 1, bonusPct: 0.35, expiresRound: session.round + 3, source, note: '已记下对手气机间一处破绽，下次攻伐更容易命中要害。' });
  }
  session.tacticalInsights = insights;
}

function consumeCombatWeaknessInsight(session: CombatSession, enemyIdx: number): { bonusPct: number; note: string } | null {
  const insights = (session.tacticalInsights || []).filter(x => x.expiresRound >= session.round && x.stacks > 0);
  const insight = insights.find(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx);
  if (!insight) { session.tacticalInsights = insights; return null; }
  insight.stacks -= 1;
  const bonusPct = Math.max(0.15, Math.min(0.75, insight.bonusPct || 0.35));
  const note = insight.note || '先前窥见的破绽在此刻应验。';
  session.tacticalInsights = insights.filter(x => x.stacks > 0 && x.expiresRound >= session.round);
  return { bonusPct, note };
}

function hasActiveWeaknessInsight(session: CombatSession, enemyIdx: number): boolean {
  return (session.tacticalInsights || []).some(x => x.kind === 'weakness' && x.enemyIdx === enemyIdx && x.stacks > 0 && x.expiresRound >= session.round);
}

// 执行一回合战斗
// action: 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'scripture'
// payload: skillIdx | itemId 等
export interface CombatActionResult {
  state: CharacterState;
  round: CombatRound;
  ended: boolean;
  endStatus?: 'victory' | 'defeat' | 'fled';
  victoryDrops?: ItemEntry[];
}

export function executeCombatRound(
  state: CharacterState,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload?: { skillIdx?: number; itemId?: string; optionId?: string },
): CombatActionResult {
  if (!state.combatSession || state.combatSession.status !== 'ongoing') {
    return {
      state,
      round: { round: 0, playerAction: '', playerActionType: 'attack', narrative: '战斗已结束', playerHpAfter: state.hp, enemyHpAfter: 0 },
      ended: true,
    };
  }
  const session = { ...state.combatSession };
  const enemy = session.enemies[session.currentEnemyIdx];
  if (!enemy) {
    return {
      state: { ...state, combatSession: { ...session, status: 'victory' } },
      round: { round: session.round, playerAction: '战场无敌', playerActionType: 'attack', narrative: '已无敌人', playerHpAfter: session.playerHp, enemyHpAfter: 0 },
      ended: true,
      endStatus: 'victory',
    };
  }

  // 修仙界感改进 - 任务 B：境界碾压判定。
  // 仅当敌我双方境界都已知时才介入；缺数据时保持原算法不动。
  // 玩家境界高于敌人 ≥2 阶 → 第一回合直接判定为玩家胜出，敌人败逃；narrative 显式标"境界碾压"。
  // （凡人/修士与 NPC 战斗时，rebel_risk 由下层负责关掉）
  if (state.realm && enemy.realm) {
    const playerVsEnemyDiff = realmDiff(state.realm, enemy.realm); // attacker=player
    if (playerVsEnemyDiff >= 2) {
      // 一击不胜之碾压：玩家无伤，敌人瞬间崩盘
      const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: 0 } : e);
      const endSession: CombatSession = {
        ...session,
        enemies: updatedEnemies,
        status: 'fled', // 敌人被碾压→败逃
        playerHp: session.playerHp,
        playerMp: session.playerMp,
      };
      const verdict = combatVerdict(state.realm, enemy.realm);
      return {
        state: { ...state, combatSession: endSession, hp: session.playerHp, mp: session.playerMp },
        round: {
          round: session.round,
          playerAction: '境界碾压',
          playerActionType: 'attack',
          playerDamage: enemy.hp,
          narrative: `${enemy.name}被你随手一挥的灵压击溃。${verdict.reason}——对方连遁逃的念头都未来得及生出，便已踉跄而退。`,
          playerHpAfter: session.playerHp,
          enemyHpAfter: 0,
          playerMpAfter: session.playerMp,
        },
        ended: true,
        endStatus: 'fled',
      };
    }
    // 反方向：敌人境界高 玩家 ≥2 阶 → 玩家被碾压、强制败逃
    const enemyVsPlayerDiff = -playerVsEnemyDiff; // 此时为正，等价于 realmDiff(enemy.realm, state.realm)
    if (enemyVsPlayerDiff >= 2) {
      const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: e.maxHp } : e);
      const endSession: CombatSession = {
        ...session,
        enemies: updatedEnemies,
        status: 'fled', // 玩家被碾压→只能逃
        playerHp: 0,
        playerMp: session.playerMp,
      };
      return {
        state: { ...state, combatSession: endSession, hp: 0, mp: session.playerMp },
        round: {
          round: session.round,
          playerAction: '不可抗衡',
          playerActionType: 'flee',
          playerDamage: 0,
          narrative: `${enemy.name}灵压如山倾落，你身体未及抵挡便已口吐鲜血。对方那等境界，根本不是凡人能够直视的。你拼尽最后一丝气力，踉跄遁走。`,
          playerHpAfter: 0,
          enemyHpAfter: enemy.hp,
          playerMpAfter: session.playerMp,
        },
        ended: true,
        endStatus: 'fled',
      };
    }
  }
  session.playerSkills = repairCombatArtsFromState(state, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(state, session);
  const selectedOption = optionById(session.actionPalette, payload?.optionId);
  const validation = validateCombatActionOption(state, session, selectedOption);
  if (!validation.ok) {
    return {
      state: { ...state, combatSession: session },
      round: { round: session.round, playerAction: selectedOption?.name || '行动受阻', playerActionType: 'defend', narrative: validation.reason || '此刻无法成招。', playerHpAfter: session.playerHp, enemyHpAfter: enemy.hp, playerMpAfter: session.playerMp },
      ended: false,
    };
  }

  let playerHp = session.playerHp;
  let playerMp = session.playerMp;
  let enemyHp = enemy.hp;
  let playerDamageDealt = 0;
  let playerHeal = 0;
  let enemyDamageDealt = 0;
  let narrative = '';
  let playerActionDesc = '';
  let playerActionType: CombatRound['playerActionType'] = 'attack';

  // 修仙三宝 8 维——本场战斗内一次性结算（破势/护持/机变 替换基础攻防速）
  // 让「神识/魂魄/体魄/悟/运」真的进战斗公式，而不只是显示
  const myForce    = (session.playerForce    ?? session.playerAttack);
  const myGuard    = (session.playerGuard    ?? session.playerDefense);
  const myAgility  = (session.playerAgility  ?? session.playerSpeed);
  const myLuck     = session.playerLuck     ?? state.luck     ?? 0;
  const myCompr    = session.playerComprehension ?? state.comprehension ?? 0;
  // 暴击（运）：luck 每点 +0.4% 暴击率；闪避（机变）：agility 每点 +0.3% 闪避
  const critChance = Math.min(0.5, Math.max(0, myLuck * 0.004));
  const dodgeChance = Math.min(0.4, Math.max(0, myAgility * 0.003));

  // 玩家行动
  if (action === 'attack') {
    playerActionType = 'attack';
    playerActionDesc = '挥出攻招';
    playerDamageDealt = computeDamage(myForce, enemy.defense);
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt += bonus;
      narrative += '先前窥见的破绽在此刻应验，';
    }
    const isCrit = Math.random() < critChance;
    let dmg = computeDamage(myForce, enemy.defense, isCrit ? 1.5 : 1, 0.2);
    if (isCrit) {
      dmg = Math.floor(dmg * 1.5);
      narrative += `气运牵引，${enemy.name}露出破绽，你出招攻向它，造成 ${dmg} 点伤害（暴击）！`;
    } else {
      narrative += `你出招攻向${enemy.name}，造成 ${dmg} 点伤害。`;
    }
    playerDamageDealt = dmg;
    enemyHp -= playerDamageDealt;
  } else if (action === 'skill' && payload?.skillIdx != null) {
    playerActionType = 'skill';
    const skillIdx = selectedOption?.skillIdx ?? payload.skillIdx;
    const skill = skillIdx != null ? session.playerSkills?.[skillIdx] : undefined;
    if (!skill) {
      return {
        state,
        round: { round: session.round, playerAction: '法术失败', playerActionType: 'skill', narrative: '法术不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    if (playerMp < skill.mpCost) {
      return {
        state,
        round: { round: session.round, playerAction: `试图施展${skill.name}`, playerActionType: 'skill', narrative: '灵力不足，法术施展失败！', playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: false,
      };
    }
    playerMp -= skill.mpCost;
    playerActionDesc = `施展${skill.name}`;
    // 悟性影响法术：comprehension 每点 +0.5% 威力，上限 +50%
    const spellBoost = Math.min(1.5, 1 + myCompr * 0.005);
    playerDamageDealt = computeDamage(myForce, enemy.defense, skill.power * spellBoost, 0.3);
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt += bonus;
      narrative += '你循着先前记下的破绽催动术法，';
    }
    enemyHp -= playerDamageDealt;
    narrative += `你催动${skill.name}，灵力化为攻伐之力，造成 ${playerDamageDealt} 点伤害。`;
  } else if (action === 'other') {
    playerActionType = 'defend';
    const option = selectedOption;
    const mpCost = option?.mpCost || 0;
    if (mpCost > 0) playerMp = Math.max(0, playerMp - mpCost);
    if (option?.id === 'other-break-binding') {
      playerActionDesc = option.name;
      narrative += `你以${option.name}应对战局，稳住当前险势。`;
    } else if (option?.id === 'other-observe-opening' || option?.id === 'defense-focus') {
      playerActionDesc = option.name;
      addCombatWeaknessInsight(session, session.currentEnemyIdx, option.id);
      narrative += `你暂缓强攻，凝神观察${enemy.name}的气机流转，记下一处可乘破绽。`;
    } else if (option?.id === 'other-flee') {
      playerActionType = 'flee';
      playerActionDesc = option.name;
      narrative += `你借地形与烟尘伺机脱身。`;
    } else {
      playerActionDesc = option?.name || '护体守势';
      narrative += `你立起${playerActionDesc}，收束气机护住要害。`;
    }
  } else if (action === 'item' && payload?.itemId) {
    playerActionType = 'item';
    const item = state.inventory.find(it => it.id === payload.itemId);
    if (!item) {
      return {
        state,
        round: { round: session.round, playerAction: '使用丹药', playerActionType: 'item', narrative: '物品不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    playerActionDesc = `服用${item.name}`;
    for (const eff of item.effects || []) {
      if (eff.operation === 'add' && eff.target_attribute === 'hp') {
        const heal = eff.value;
        playerHp = Math.min(session.playerMaxHp, playerHp + heal);
        playerHeal = heal;
      } else if (eff.operation === 'add' && eff.target_attribute === 'mp') {
        playerMp = Math.min(session.playerMaxMp, playerMp + eff.value);
      }
    }
    narrative += `你服下${item.name}，回复 ${playerHeal} 点气血。`;
    // 消耗物品
    state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
    session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
  } else if (action === 'talisman' && payload?.itemId) {
    // Task 23: 符箓系统——单次使用、即时生效的战斗道具
    playerActionType = 'item';
    const item = state.inventory.find(it => it.id === payload.itemId);
    if (!item) {
      return {
        state,
        round: { round: session.round, playerAction: '激发符箓', playerActionType: 'item', narrative: '符箓不存在', playerHpAfter: playerHp, enemyHpAfter: enemyHp },
        ended: false,
      };
    }
    playerActionDesc = `激发${item.name}`;
    // 根据 effects 中的 target_attribute 判定符箓类型，兼容 AI 可能写出的 targetAttribute/attribute 别名
    let talismanResolved = false;
    for (const eff of item.effects || []) {
      const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
      const operation = (eff as any).operation || 'add';
      if (target === 'talisman_attack' && operation === 'add') {
        // 攻击符：直接对敌人造成 value 伤害（无视防御一半）
        const dmg = Math.max(1, Math.floor(eff.value - enemy.defense * 0.3));
        playerDamageDealt = dmg;
        enemyHp -= dmg;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为攻伐之力轰向${enemy.name}，造成 ${dmg} 点伤害。`;
      } else if (target === 'talisman_defense' && operation === 'add') {
        // 防御符：本回合减伤 value
        session.talismanDefenseActive = eff.value;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为护体金光，本回合可减伤 ${eff.value} 点。`;
      } else if (target === 'talisman_heal' && operation === 'add') {
        // 治疗符：回复 HP
        const heal = eff.value;
        playerHp = Math.min(session.playerMaxHp, playerHp + heal);
        playerHeal = heal;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为温润灵光，回复 ${heal} 点气血。`;
      } else if (target === 'talisman_escape' && operation === 'add') {
        // 遁逃符：高概率逃跑
        talismanResolved = true;
        const escapeChance = Math.min(0.95, 0.5 + eff.value * 0.1);
        if (Math.random() < escapeChance) {
          narrative += `你激发${item.name}，符箓化为金光裹身，瞬间脱离战场！`;
          // 消耗符箓
          state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
          session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
          const endSession: CombatSession = { ...session, status: 'fled' };
          return {
            state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
            round: { round: session.round, playerAction: playerActionDesc, playerActionType, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
            ended: true,
            endStatus: 'fled',
          };
        } else {
          narrative += `你激发${item.name}，但灵力被压制，未能脱身。`;
        }
      } else if (target === 'talisman_stun' && operation === 'add') {
        // 镇压符：让敌人本回合无法行动
        session.enemyStunned = true;
        talismanResolved = true;
        narrative += `你激发${item.name}，符箓化为镇压力量，${enemy.name}本回合无法行动！`;
      }
    }
    if (!talismanResolved) {
      narrative += `你激发${item.name}，符纸微燃，灵光散入战局。`;
    }
    // 消耗符箓（除遁逃符已消耗外）
    state = { ...state, inventory: state.inventory.filter(it => it.id !== payload.itemId) };
    session.playerItems = (session.playerItems || []).filter(it => it.itemId !== payload.itemId);
  } else if (action === 'defend') {
    playerActionType = 'defend';
    playerActionDesc = '凝神防御';
    narrative += '你凝神戒备，减少本回合受到的伤害。';
  } else if (action === 'flee') {
    playerActionType = 'flee';
    playerActionDesc = '转身遁走';
    // 逃跑成功率：机变差 + 随机（机变包含速度与神识加成）
    const fleeChance = 0.3 + (myAgility - enemy.speed) * 0.02;
    if (Math.random() < fleeChance) {
      narrative += '你身形一闪，成功脱离战场。';
      const endSession: CombatSession = { ...session, status: 'fled' };
      return {
        state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
        round: { round: session.round, playerAction: playerActionDesc, playerActionType, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: true,
        endStatus: 'fled',
      };
    } else {
      narrative += '你试图遁走，却被对方缠住，未能脱身！';
    }
  }

  // 检查敌人是否被击败
  if (enemyHp <= 0) {
    enemyHp = 0;
    narrative += `${enemy.name}倒下！`;
    // 检查是否还有其他敌人
    const nextIdx = session.enemies.findIndex((e, i) => i > session.currentEnemyIdx && e.hp > 0);
    if (nextIdx < 0) {
      // 全部敌人被击败 → 胜利
      const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: 0 } : e);
      const endSession: CombatSession = { ...session, enemies: updatedEnemies, status: 'victory', playerHp, playerMp };
      narrative += '战场归于沉寂，你胜了！';
      return {
        state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
        round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, playerHeal, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
        ended: true,
        endStatus: 'victory',
        victoryDrops: session.victoryDrops,
      };
    } else {
      // 切换到下一个敌人
      session.currentEnemyIdx = nextIdx;
      narrative += `新的对手${session.enemies[nextIdx].name}逼近！`;
    }
  } else {
    // 敌人未死 → 灵宠参战追加攻击（在敌人反击前）
    if (session.petCombatant && session.petCombatant.hp > 0) {
      const petC = session.petCombatant;
      // 冷却中 → 普通攻击；否则施放技能并进入冷却
      let petDmg: number;
      let petActionDesc: string;
      if (petC.currentCooldown > 0) {
        petDmg = computeDamage(petC.attack, enemy.defense, 0.5, 0.25);
        petActionDesc = `${petC.name}迅疾扑击`;
        petC.currentCooldown -= 1;
      } else {
        petDmg = computeDamage(petC.attack, enemy.defense, petC.skillPower, 0.3);
        petActionDesc = `${petC.name}施展${petC.skillName}`;
        petC.currentCooldown = petC.skillCooldown;
      }
      enemyHp -= petDmg;
      playerDamageDealt += petDmg;
      narrative += `${petActionDesc}，对${enemy.name}追加 ${petDmg} 点伤害。`;
      // 灵宠攻击后再次检查敌人是否被击败
      if (enemyHp <= 0) {
        enemyHp = 0;
        narrative += `${enemy.name}倒下！`;
        const nextIdx = session.enemies.findIndex((e, i) => i > session.currentEnemyIdx && e.hp > 0);
        if (nextIdx < 0) {
          const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: 0 } : e);
          const endSession: CombatSession = { ...session, enemies: updatedEnemies, status: 'victory', playerHp, playerMp };
          narrative += '战场归于沉寂，你胜了！';
          return {
            state: { ...state, combatSession: endSession, hp: playerHp, mp: playerMp },
            round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, playerHeal, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
            ended: true,
            endStatus: 'victory',
            victoryDrops: session.victoryDrops,
          };
        } else {
          session.currentEnemyIdx = nextIdx;
          narrative += `新的对手${session.enemies[nextIdx].name}逼近！`;
        }
      }
    }

    // 敌人反击（除非被镇符眩晕）
    if (!session.enemyStunned) {
      // 机变闪避：玩家 agility 每点 +0.3% 闪避率（上限 40%）
      const didDodge = Math.random() < dodgeChance;
      if (didDodge) {
        enemyDamageDealt = 0;
        narrative += `${enemy.name}反扑，你身形机敏，堪堪避过！`;
        playerHp -= 0;
        // 仍需把这次回合的结果返回
        const updatedEnemiesRound = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: enemyHp } : e);
        return {
          state: { ...state, combatSession: { ...session, enemies: updatedEnemiesRound, round: session.round + 1, playerHp, playerMp }, hp: playerHp, mp: playerMp },
          round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, playerHeal, narrative, playerHpAfter: playerHp, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
          ended: false,
        };
      }
      // 护持（替换 defense）：减伤
      let enemyDmg = action === 'defend'
        ? Math.floor(computeDamage(enemy.attack, myGuard, 1, 0.2) * 0.5)
        : computeDamage(enemy.attack, myGuard, 1, 0.2);
      // Task 23: 防御符减伤
      if (session.talismanDefenseActive && session.talismanDefenseActive > 0) {
        const blocked = Math.min(enemyDmg, session.talismanDefenseActive);
        enemyDmg -= blocked;
        narrative += `护体金光抵消 ${blocked} 点伤害。`;
      }
      enemyDamageDealt = enemyDmg;
      playerHp -= enemyDmg;
      narrative += `${enemy.name}反扑，对你造成 ${enemyDmg} 点伤害。`;
      // 玩家死亡判定
      if (playerHp <= 0) {
        playerHp = 0;
        const endSession: CombatSession = { ...session, status: 'defeat', playerHp: 0 };
        narrative += '你气血耗尽，败下阵来...';
        return {
          state: { ...state, combatSession: endSession, hp: 0, alive: false, causeOfDeath: `战死于${enemy.name}之手` },
          round: { round: session.round, playerAction: playerActionDesc, playerActionType, playerDamage: playerDamageDealt, enemyDamage: enemyDamageDealt, narrative, playerHpAfter: 0, enemyHpAfter: enemyHp, playerMpAfter: playerMp },
          ended: true,
          endStatus: 'defeat',
        };
      }
    } else {
      narrative += `${enemy.name}被镇符压制，无法行动！`;
    }
  }

  // 清除本回合临时状态（符箓减伤/镇符眩晕）
  session.talismanDefenseActive = undefined;
  session.enemyStunned = undefined;

  // 更新敌人 HP 并推进回合
  const updatedEnemies = session.enemies.map((e, i) => i === session.currentEnemyIdx ? { ...e, hp: enemyHp } : e);
  const newSession: CombatSession = {
    ...session,
    enemies: updatedEnemies,
    round: session.round + 1,
    log: [...session.log, {
      round: session.round,
      playerAction: playerActionDesc,
      playerActionType,
      playerDamage: playerDamageDealt,
      playerHeal,
      enemyDamage: enemyDamageDealt,
      narrative,
      playerHpAfter: playerHp,
      enemyHpAfter: enemyHp,
      playerMpAfter: playerMp,
    }],
    playerHp,
    playerMp,
  };
  return {
    state: { ...state, combatSession: newSession, hp: playerHp, mp: playerMp },
    round: newSession.log[newSession.log.length - 1],
    ended: false,
  };
}

// 结束战斗（清理 combatSession，但保留 log 用于事件记录）

function clampCombatNumber(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function combatPlayerActionTypeFromAction(action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other'): CombatRound['playerActionType'] {
  if (action === 'skill') return 'skill';
  if (action === 'item' || action === 'talisman') return 'item';
  if (action === 'defend' || action === 'other') return 'defend';
  if (action === 'flee') return 'flee';
  return 'attack';
}

function maxFactBoundedPlayerDamage(
  state: CharacterState,
  session: CombatSession,
  enemy: CombatEnemy,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload?: { skillIdx?: number; itemId?: string; optionId?: string },
  selectedOption?: CombatActionOption,
): { maxDamage: number; mpCost: number; playerActionDesc: string; audit: string[] } {
  const audit: string[] = [];
  let maxDamage = Math.max(1, Math.floor((session.playerAttack - enemy.defense * 0.35) * 1.6));
  let mpCost = selectedOption?.mpCost || 0;
  let playerActionDesc = selectedOption?.name || '出手试探';
  if (action === 'skill') {
    const skillIdx = selectedOption?.skillIdx ?? payload?.skillIdx;
    const skill = skillIdx != null ? session.playerSkills?.[skillIdx] : undefined;
    if (skill) {
      mpCost = Math.max(mpCost, skill.mpCost || 0);
      maxDamage = Math.max(1, Math.floor((session.playerAttack - enemy.defense * 0.3) * Math.max(0.5, skill.power || 1) * 1.8));
      playerActionDesc = selectedOption?.name || '施展' + skill.name;
    } else {
      maxDamage = 0;
      audit.push('AI裁决涉及的术法不存在，引擎拒绝术法伤害。');
    }
  } else if (action === 'item' || action === 'talisman') {
    const item = payload?.itemId ? state.inventory.find(it => it.id === payload.itemId) : undefined;
    playerActionDesc = selectedOption?.name || (item ? '催用' + item.name : '出手试探');
    maxDamage = 0;
    if (!item) {
      audit.push('AI裁决涉及的物品不在行囊，引擎拒绝物品效果。');
    } else {
      for (const eff of item.effects || []) {
        const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
        if ((eff as any).operation === 'add' && (target === 'talisman_attack' || target === 'attack')) maxDamage += Math.max(0, Math.floor(Number((eff as any).value || 0) - enemy.defense * 0.25));
      }
      maxDamage = Math.max(maxDamage, action === 'talisman' ? Math.floor(session.playerAttack * 0.6) : 0);
    }
  } else if (action === 'defend') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = Math.floor(session.playerAttack * 0.35);
  } else if (action === 'flee') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = 0;
  } else if (action === 'other') {
    playerActionDesc = selectedOption?.name || '出手试探';
    maxDamage = Math.floor(session.playerAttack * 0.75);
  }
  if ((action === 'attack' || action === 'skill') && hasActiveWeaknessInsight(session, session.currentEnemyIdx)) {
    maxDamage = Math.floor(maxDamage * 1.45);
    audit.push('先前观得破绽，本次攻伐上限已按战术因果放宽。');
  }
  if (mpCost > session.playerMp) {
    audit.push('AI裁决消耗法力超过当前余量，引擎按当前法力上限截断。');
    mpCost = session.playerMp;
  }
  return { maxDamage: Math.max(0, maxDamage), mpCost: Math.max(0, mpCost), playerActionDesc, audit };
}

export function executeCombatRoundWithProposal(
  state: CharacterState,
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other',
  payload: { skillIdx?: number; itemId?: string; optionId?: string } | undefined,
  proposal: CombatRoundProposal,
): CombatActionResult {
  if (!state.combatSession || state.combatSession.status !== 'ongoing') return executeCombatRound(state, action, payload);
  let nextState = { ...state };
  const session: CombatSession = { ...state.combatSession, log: [...(state.combatSession.log || [])] };
  const enemy = session.enemies[session.currentEnemyIdx];
  if (!enemy) return executeCombatRound(state, action, payload);
  session.playerSkills = repairCombatArtsFromState(nextState, session.playerSkills);
  session.actionPalette = buildCombatActionPalette(nextState, session);
  const selectedOption = optionById(session.actionPalette, payload?.optionId);
  const validation = validateCombatActionOption(nextState, session, selectedOption);
  if (!validation.ok) {
    return { state: { ...nextState, combatSession: session }, round: { round: session.round, playerAction: selectedOption?.name || '出手试探', playerActionType: 'defend', narrative: validation.reason || '此刻无法成行。', playerHpAfter: session.playerHp, enemyHpAfter: enemy.hp, playerMpAfter: session.playerMp, aiAudit: ['引擎拒绝了不满足硬事实前置的 AI 战斗裁决。'] }, ended: false };
  }
  const audit: string[] = [...(Array.isArray(proposal.auditHints) ? proposal.auditHints.map(String).slice(0, 4) : [])];
  const bound = maxFactBoundedPlayerDamage(nextState, session, enemy, action, payload, selectedOption);
  audit.push(...bound.audit);
  let playerHp = session.playerHp;
  let playerMp = Math.max(0, session.playerMp - bound.mpCost);
  const playerActionType = combatPlayerActionTypeFromAction(action);
  const observeWeakness = action === 'other' && (selectedOption?.id === 'other-observe-opening' || selectedOption?.id === 'defense-focus' || (selectedOption?.tags || []).includes('observe'));
  if (observeWeakness) {
    addCombatWeaknessInsight(session, session.currentEnemyIdx, selectedOption?.id || 'observe');
    audit.push('本回合应变已转化为可持续的破绽记忆，后续攻伐可消耗。');
  }
  let playerDamageDealt = clampCombatNumber(proposal.playerDamage, 0, bound.maxDamage);
  let weaknessNote = '';
  if ((action === 'attack' || action === 'skill') && playerDamageDealt > 0) {
    const weakness = consumeCombatWeaknessInsight(session, session.currentEnemyIdx);
    if (weakness) {
      const bonus = Math.max(1, Math.floor(playerDamageDealt * weakness.bonusPct));
      playerDamageDealt = Math.min(bound.maxDamage, playerDamageDealt + bonus);
      weaknessNote = '先前窥见的破绽在此刻应验，攻势更深一层。';
      audit.push('已消耗一层破绽记忆，本次攻伐获得事实加成。');
    }
  }
  if (Number(proposal.playerDamage || 0) > bound.maxDamage) audit.push('AI裁决伤害 ' + proposal.playerDamage + ' 超过事实上限 ' + bound.maxDamage + '，已截断。');
  let playerHeal = 0;
  if (action === 'item' || action === 'talisman') {
    const item = payload?.itemId ? nextState.inventory.find(it => it.id === payload.itemId) : undefined;
    if (item) {
      let maxHeal = 0;
      for (const eff of item.effects || []) {
        const target = (eff as any).target_attribute || (eff as any).targetAttribute || (eff as any).attribute || '';
        if ((eff as any).operation === 'add' && (target === 'hp' || target === 'talisman_heal')) maxHeal += Math.max(0, Number((eff as any).value || 0));
        if ((eff as any).operation === 'add' && target === 'mp') playerMp = Math.min(session.playerMaxMp, playerMp + Math.max(0, Number((eff as any).value || 0)));
        if ((eff as any).operation === 'add' && target === 'talisman_defense') session.talismanDefenseActive = Math.max(0, Number((eff as any).value || 0));
        if ((eff as any).operation === 'add' && target === 'talisman_stun') session.enemyStunned = true;
      }
      playerHeal = clampCombatNumber(proposal.playerHeal, 0, maxHeal);
      playerHp = Math.min(session.playerMaxHp, playerHp + playerHeal);
      if (proposal.consumeItem !== false) {
        nextState = { ...nextState, inventory: nextState.inventory.filter(it => it.id !== item.id) };
        session.playerItems = (session.playerItems || []).filter(it => it.itemId !== item.id);
      }
    }
  } else {
    const healCap = action === 'defend' || action === 'other' ? Math.floor(session.playerMaxHp * 0.25) : 0;
    playerHeal = clampCombatNumber(proposal.playerHeal, 0, healCap);
    playerHp = Math.min(session.playerMaxHp, playerHp + playerHeal);
  }
  // ---- 玩家命中：单体目标或群攻 ----
  const enemiesWork = session.enemies.map(e => ({ ...e }));
  const aliveAtStart = enemiesWork.map((e, i) => ({ e, i })).filter(x => x.e.hp > 0).map(x => x.i);
  const playerHitsResult: NonNullable<CombatRound['playerHits']> = [];
  const resolveEnemyIdx = (b: { enemyId?: string; enemyIdx?: number }): number => {
    if (b.enemyId != null) { const j = enemiesWork.findIndex(e => e.id === b.enemyId); if (j >= 0) return j; }
    if (b.enemyIdx != null && b.enemyIdx >= 0 && b.enemyIdx < enemiesWork.length) return b.enemyIdx;
    return -1;
  };
  const aoeHits = Array.isArray(proposal.playerHits) ? proposal.playerHits : [];
  if (aoeHits.length > 0 && (action === 'attack' || action === 'skill')) {
    for (const h of aoeHits) {
      const idx = resolveEnemyIdx(h);
      if (idx < 0 || enemiesWork[idx].hp <= 0) continue;
      const tgt = enemiesWork[idx];
      const cap = maxFactBoundedPlayerDamage(nextState, session, tgt, action, payload, selectedOption).maxDamage;
      const dmg = clampCombatNumber(h.damage, 0, cap);
      tgt.hp = Math.max(0, tgt.hp - dmg);
      playerHitsResult.push({ enemyIdx: idx, name: tgt.name, damage: dmg, hpAfter: tgt.hp, dead: tgt.hp <= 0 });
    }
    audit.push('群攻：玩家本节波及 ' + playerHitsResult.length + ' 名敌人。');
  } else {
    const tIdx = session.currentEnemyIdx;
    const tgt = enemiesWork[tIdx];
    if (tgt && tgt.hp > 0 && playerDamageDealt > 0) {
      tgt.hp = Math.max(0, tgt.hp - playerDamageDealt);
      playerHitsResult.push({ enemyIdx: tIdx, name: tgt.name, damage: playerDamageDealt, hpAfter: tgt.hp, dead: tgt.hp <= 0 });
    }
  }

  // ---- 逃脱判定 ----
  const fleeAllowed = action === 'flee' || selectedOption?.actionType === 'flee';
  const fleeSpeedChance = Math.max(0.08, Math.min(0.92, 0.35 + (session.playerSpeed - (enemy?.speed || 0)) * 0.025));
  const fleeSuccess = fleeAllowed && proposal.fleeOutcome === 'success' && fleeSpeedChance >= 0.18;
  if (proposal.fleeOutcome === 'success' && !fleeAllowed) audit.push('AI提议逃脱，但本动作不是逃跑，已拒绝。');

  // ---- 所有存活敌人各自行动 ----
  const enemyActions: NonNullable<CombatRound['enemyActions']> = [];
  let totalEnemyDamage = 0;
  let endStatus: CombatActionResult['endStatus'] | undefined;
  if (fleeSuccess) {
    endStatus = 'fled';
  } else {
    const beats = Array.isArray(proposal.enemyBeats) ? proposal.enemyBeats : [];
    const beatByIdx = new Map<number, (typeof beats)[number]>();
    for (const b of beats) { const idx = resolveEnemyIdx(b); if (idx >= 0 && !beatByIdx.has(idx)) beatByIdx.set(idx, b); }
    for (const idx of aliveAtStart) {
      const e = enemiesWork[idx];
      if (e.hp <= 0) {
        enemyActions.push({ enemyIdx: idx, name: e.name, action: '力竭倒下', actionType: 'down', damage: 0, hpAfter: 0, dead: true });
        continue;
      }
      const b = beatByIdx.get(idx);
      const stunnedTarget = !!session.enemyStunned && idx === session.currentEnemyIdx;
      let actionLabel = b?.action ? String(b.action).slice(0, 40) : '趁势进攻';
      let actType = b?.actionType ? String(b.actionType).slice(0, 24) : 'attack';
      let dmg = 0;
      if (stunnedTarget) {
        actionLabel = '被符箓震慑，未能发难';
        actType = 'stunned';
        audit.push(e.name + ' 被压制，本节未能发难。');
      } else if (actType !== 'defend' && actType !== 'flee' && actType !== 'stunned' && actType !== 'down') {
        const defenseFactor = action === 'defend' ? 0.55 : action === 'other' ? 0.8 : 1;
        const maxEnemyDamage = Math.max(0, Math.floor((e.attack - session.playerDefense * 0.35) * 1.6 * defenseFactor));
        dmg = clampCombatNumber(b?.damageToPlayer, 0, maxEnemyDamage);
        if (b == null) {
          dmg = Math.min(maxEnemyDamage, Math.max(1, Math.floor(maxEnemyDamage * 0.6)));
          actionLabel = '趁势进攻';
          audit.push(e.name + ' 未获 AI 单独裁定，按趁势进攻兜底。');
        }
      }
      totalEnemyDamage += dmg;
      enemyActions.push({ enemyIdx: idx, name: e.name, action: actionLabel, actionType: actType, damage: dmg, hpAfter: e.hp, dead: false });
    }
    if (session.talismanDefenseActive && session.talismanDefenseActive > 0 && totalEnemyDamage > 0) {
      const blocked = Math.min(totalEnemyDamage, session.talismanDefenseActive);
      totalEnemyDamage -= blocked;
      if (blocked > 0) audit.push('符箓护体抵挡 ' + blocked + ' 点伤势。');
    }
    playerHp = Math.max(0, playerHp - totalEnemyDamage);
    if (playerHp <= 0) endStatus = 'defeat';
    else if (enemiesWork.every(e => e.hp <= 0)) endStatus = 'victory';
  }
  session.talismanDefenseActive = undefined;
  session.enemyStunned = undefined;

  // ---- 目标失效则自动切换到下一个存活敌人 ----
  let currentEnemyIdx = session.currentEnemyIdx;
  if (!enemiesWork[currentEnemyIdx] || enemiesWork[currentEnemyIdx].hp <= 0) {
    const nextIdx = enemiesWork.findIndex(e => e.hp > 0);
    if (nextIdx >= 0) { currentEnemyIdx = nextIdx; audit.push('当前目标倒下，自动转向 ' + enemiesWork[nextIdx].name + '。'); }
  }

  // 兼容旧单敌字段
  const legacyEnemy = enemiesWork[session.currentEnemyIdx] || enemiesWork[currentEnemyIdx];
  const legacyEnemyAction = enemyActions.find(a => a.enemyIdx === session.currentEnemyIdx) || enemyActions[0];

  const dialogue = Array.isArray(proposal.dialogue)
    ? proposal.dialogue.map(d => ({ speaker: String(d.speaker || '').slice(0, 24), text: String(d.text || '').slice(0, 120) })).filter(d => d.text).slice(0, 6)
    : undefined;

  const narrativeBase = String(proposal.narrative || '').trim().slice(0, 360) || (bound.playerActionDesc + '，与众敌斗在一处。');
  const narrative = weaknessNote ? (weaknessNote + narrativeBase).slice(0, 420) : narrativeBase;

  const round: CombatRound = {
    round: session.round,
    playerAction: String(proposal.playerActionLabel || bound.playerActionDesc).slice(0, 40),
    playerActionType,
    playerDamage: playerHitsResult.reduce((s, h) => s + h.damage, 0),
    playerHeal,
    enemyAction: legacyEnemyAction?.action,
    enemyActionType: legacyEnemyAction?.actionType,
    enemyDamage: totalEnemyDamage,
    narrative,
    playerHpAfter: playerHp,
    enemyHpAfter: legacyEnemy?.hp ?? 0,
    playerMpAfter: playerMp,
    aiAudit: audit.length ? audit.slice(0, 10) : ['AI提议已通过引擎事实校验。'],
    enemyActions,
    playerHits: playerHitsResult,
    dialogue,
  };
  const stalemateStreak = !endStatus ? recentCombatLowProgressStreak(session, round, selectedOption) : 0;
  if (stalemateStreak >= 3) audit.push(`连续${stalemateStreak}拍难分胜负，引擎判为僵局并触发破局时停。`);
  const fallbackTacticalSituation = deriveFallbackTacticalSituation(session, round, stalemateStreak);
  const tacticalSituation = sanitizeTacticalSituation(proposal, fallbackTacticalSituation);
  round.tacticalSituation = tacticalSituation;
  const aiActionOptions = !endStatus ? validateAiCombatActions(nextState, session, proposal) : [];
  if (aiActionOptions.length) audit.push('AI临场动作已通过引擎校验并投影到战斗面板。');

  // 角色本能想法/应变关口：AI 提示玩家需决断的处境（仅战斗未结束时）
  let pendingImpulse: CombatSession['pendingImpulse'];
  const imp = proposal.playerImpulse;
  if (!endStatus && imp && imp.prompt) {
    if (imp.kind === 'item') {
      const owned = (session.playerItems || []).find(it => it.itemId === imp.itemId) || (session.playerItems || []).find(it => it.name === imp.itemName);
      pendingImpulse = owned
        ? { kind: 'item', prompt: imp.prompt, itemId: owned.itemId, itemName: owned.name, reason: 'danger' }
        : { kind: 'contingency', prompt: imp.prompt, reason: 'unknown' };
      if (!owned) audit.push('AI建议使用物品但未命中现有背包，已转为应变提示。');
    } else {
      pendingImpulse = { kind: 'contingency', prompt: imp.prompt, reason: 'danger' };
    }
  }
  if (!endStatus && stalemateStreak >= 3 && !pendingImpulse) pendingImpulse = buildStalemateImpulse(session, legacyEnemy, stalemateStreak);
  const newSession: CombatSession = { ...session, enemies: enemiesWork, currentEnemyIdx, round: session.round + 1, log: [...session.log, round], status: endStatus || 'ongoing', playerHp, playerMp, pendingImpulse, stalemateStreak, tacticalSituation, aiActionOptions };
  newSession.actionPalette = buildCombatActionPalette(nextState, newSession);
  if (endStatus === 'defeat') {
    const killer = enemyActions.filter(a => (a.damage || 0) > 0).sort((a, b) => (b.damage || 0) - (a.damage || 0))[0];
    return { state: { ...nextState, combatSession: newSession, hp: 0, mp: playerMp, alive: false, causeOfDeath: '战死于' + (killer?.name || legacyEnemy?.name || '敌手') + '之手' }, round, ended: true, endStatus };
  }
  return { state: { ...nextState, combatSession: newSession, hp: playerHp, mp: playerMp }, round, ended: !!endStatus, endStatus, victoryDrops: endStatus === 'victory' ? session.victoryDrops : undefined };
}

export function endCombat(state: CharacterState, applyDrops: boolean = true, aiLoot?: CombatLootAIOutcome | null): { state: CharacterState; drops: ItemEntry[]; result: 'victory' | 'defeat' | 'fled' | 'ongoing' | null; spiritStones?: number } {
  if (!state.combatSession) return { state, drops: [], result: null, spiritStones: 0 };
  const session = state.combatSession;
  let next: CharacterState = { ...state, combatSession: null };
  let drops: ItemEntry[] = [];
  let spiritStones = 0;
  if (applyDrops && session.status === 'victory') {
    const spoils = buildCombatVictorySpoils(state, session, aiLoot);
    drops = spoils.items;
    spiritStones = spoils.spiritStones;
    if (drops.length) next = addItems(next, drops);
    if (spiritStones > 0) next = { ...next, spiritStones: next.spiritStones + spiritStones };
    next = normalizeCultivationState(next);
  }
  return { state: next, drops, result: session.status, spiritStones };
}

// ==================== 引擎执行 AI 输出（统一入口） ====================

export function deriveCombatStance(
  character: CharacterState,
  opponent?: { hp?: number; maxHp?: number; attack?: number; defense?: number; speed?: number },
): CombatStance {
  if (!character) return 'defensive';
  const cs = character.combatSession;
  if (!cs || cs.status !== 'ongoing') return 'defensive';
  const playerHpPct = cs.playerMaxHp > 0 ? cs.playerHp / cs.playerMaxHp : 1;
  const playerMpPct = cs.playerMaxMp > 0 ? cs.playerMp / cs.playerMaxMp : 1;

  // 血量过低 → 守御 / 脱身
  if (playerHpPct <= 0.25) {
    return playerMpPct >= 0.5 ? 'retreat' : 'defensive';
  }
  // 资源不足 → 守御回气
  if (playerMpPct <= 0.3) return 'defensive';
  // 敌方虚弱 → 猛攻
  if (opponent && opponent.maxHp && opponent.maxHp > 0 && opponent.hp != null) {
    const enemyHpPct = opponent.hp / opponent.maxHp;
    if (enemyHpPct <= 0.35) return 'aggressive';
    // 敌高速 / 高攻 → 诱敌
    if ((opponent.attack || 0) >= (character.attack || 0) * 1.4) return 'cunning';
  }
  // 默认猛攻
  return 'aggressive';
}

/**
 * AI-81: 根据当前姿态与对手回应，解析下一次应采用的姿态。
 * - 纯函数：仅做枚举决策
 * - 使用 cooldownTurns 防止抖动切换
 */
export function resolveCombatStanceShift(
  current: CombatStance,
  opponent?: { hp?: number; maxHp?: number; attack?: number; attackPrev?: number },
  history?: { stance: CombatStance; cooldownTurns: number }[],
): CombatStance {
  if (!current) return 'defensive';
  // 若当前姿态还在冷却中（>0），保持
  const inCooldown = (history || []).find(h => h.stance === current && h.cooldownTurns > 0);
  if (inCooldown) return current;

  const enemyHpPct = opponent && opponent.maxHp ? (opponent.hp ?? opponent.maxHp) / opponent.maxHp : 1;
  const enemyRising = opponent && opponent.attack != null && opponent.attackPrev != null && opponent.attack > opponent.attackPrev;

  // 敌方正在蓄力 → 诱敌
  if (enemyRising) return 'cunning';
  // 敌方残血 → 猛攻
  if (enemyHpPct <= 0.3) return 'aggressive';
  // 自身已选猛攻且敌方血多 → 切换诱敌打破僵局
  if (current === 'aggressive' && enemyHpPct > 0.6) return 'cunning';
  // 自身已选诱敌 → 守御片刻
  if (current === 'cunning') return 'defensive';
  return current;
}

// ==================== AI-82: Combat Resource Management ====================

/**
 * AI-82: 根据角色状态推导出战斗资源当前快照。
 * - 真元 qi 与 MP 同步
 * - 神识 soul = floor(spiritualSense * 0.5)
 * - 体魄 stamina = floor(hp * 0.6) + 10
 * - 心神 focus = floor(comprehension * 0.4) + 5
 */
export function deriveCombatResource(character: CharacterState): CombatResourceUsage[] {
  const mp = Math.max(0, character?.mp ?? 0);
  const maxMp = Math.max(1, character?.maxMp ?? 1);
  const hp = Math.max(0, character?.hp ?? 0);
  const maxHp = Math.max(1, character?.maxHp ?? 1);
  const spiritualSense = Math.max(0, character?.spiritualSense ?? 0);
  const comprehension = Math.max(0, character?.comprehension ?? 0);
  return [
    { type: 'qi', current: mp, max: maxMp, regenPerTurn: Math.max(1, Math.floor(maxMp * 0.04)) },
    { type: 'soul', current: Math.floor(spiritualSense * 0.5), max: Math.max(50, Math.floor(spiritualSense * 0.5 + 50)), regenPerTurn: Math.max(1, Math.floor(spiritualSense * 0.05)) },
    { type: 'stamina', current: Math.floor(hp * 0.6) + 10, max: Math.floor(maxHp * 0.6) + 10, regenPerTurn: Math.max(2, Math.floor(maxHp * 0.08)) },
    { type: 'focus', current: Math.floor(comprehension * 0.4) + 5, max: Math.floor(comprehension * 0.4) + 55, regenPerTurn: 2 },
  ];
}

/**
 * AI-82: 根据一次行动消耗结算后，资源的新快照（纯计算，不持久化）。
 */
export function resolveCombatResourceDrain(
  usage: CombatResourceUsage,
  cost: { type: CombatResourceType; value: number },
): CombatResourceUsage {
  if (!usage || !cost) return usage;
  if (usage.type !== cost.type) return usage;
  const newCurrent = Math.max(0, usage.current - Math.max(0, cost.value));
  return {
    ...usage,
    current: newCurrent,
    recentDrain: usage.current - newCurrent,
  };
}

/**
 * AI-82: 检查资源是否足够支撑一组消耗，返回缺失列表。
 */
export function checkCombatResourceSufficient(
  usages: CombatResourceUsage[],
  costs: { type: CombatResourceType; value: number }[],
): { sufficient: boolean; missing: { type: CombatResourceType; need: number; have: number }[] } {
  const missing: { type: CombatResourceType; need: number; have: number }[] = [];
  for (const cost of costs || []) {
    const u = (usages || []).find(x => x.type === cost.type);
    const have = u ? u.current : 0;
    if (have < cost.value) {
      missing.push({ type: cost.type, need: cost.value, have });
    }
  }
  return { sufficient: missing.length === 0, missing };
}

// ==================== AI-83: Breakthrough Stage Refinement ====================

/**
 * AI-83: 推导当前突破尝试所处阶段。
 * - realmBefore == realmAfter → 已通过
 * - 第一次尝试 → 感悟
 * - 年龄 + 心魔值辅助判断凝聚 / 风暴 / 稳固
 */
export function detectCombatStalemate(history: Array<{
  round: number;
  playerHpAfter: number;
  enemyHpAfter: number;
}>): { isStalemate: boolean; turnsSinceProgress: number } {
  if (!Array.isArray(history) || history.length < 4) {
    return { isStalemate: false, turnsSinceProgress: 0 };
  }
  let turnsSinceProgress = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const cur = history[i];
    const prev = i > 0 ? history[i - 1] : null;
    if (!prev) {
      turnsSinceProgress += 1;
      continue;
    }
    const deltaPlayer = Math.abs((cur.playerHpAfter ?? 0) - (prev.playerHpAfter ?? 0));
    const deltaEnemy = Math.abs((cur.enemyHpAfter ?? 0) - (prev.enemyHpAfter ?? 0));
    // 至少有一方血量变化超过 1 才算推进
    if (deltaPlayer > 1 || deltaEnemy > 1) {
      return { isStalemate: turnsSinceProgress >= 3, turnsSinceProgress };
    }
    turnsSinceProgress += 1;
  }
  return { isStalemate: turnsSinceProgress >= 3, turnsSinceProgress };
}

/**
 * AI-84: 给出打破僵局的事件提示（用于 AI / UI 显示）。
 * - 不修改任何状态，仅生成提示
 */
export function resolveStalemateBreak(
  character: CharacterState,
  opponent?: { name?: string },
): { event: string; hint: string; suggestedAction: string } {
  const oppName = opponent?.name || '对手';
  const realm = character?.realm || 'qi_refining';
  const choices = [
    { event: `${oppName}似要变招`, hint: '诱敌露绽，激其先动', suggestedAction: 'cunning' },
    { event: `战局胶着`, hint: '行险一击，打破僵持', suggestedAction: 'aggressive' },
    { event: `气息流转渐慢`, hint: '退半步聚气再发', suggestedAction: 'defensive' },
  ];
  // 用 realm 字符串做简单哈希选择
  const idx = Math.abs(Array.from(realm).reduce((a, c) => a + c.charCodeAt(0), 0)) % choices.length;
  return choices[idx];
}

// ==================== AI-85: Combat Combo Chain ====================

/**
 * AI-85: 根据近 N 回合的命中记录推导当前连击链。
 * - 命中 → 连击 +1
 * - 失手 / 间隔超过 expiresTurn → 断连
 */
export function deriveComboChain(actionHistory: Array<{
  round: number;
  hit?: boolean;
  skillName?: string;
}>): ComboChain | null {
  if (!Array.isArray(actionHistory) || actionHistory.length === 0) return null;
  // 仅看命中且按 round 倒推
  const sorted = [...actionHistory].sort((a, b) => (b.round || 0) - (a.round || 0));
  let hits = 0;
  let lastRound = -1;
  const names: string[] = [];
  for (const a of sorted) {
    if (!a.hit) break;
    if (lastRound >= 0 && (lastRound - (a.round || 0)) > 1) break;
    hits += 1;
    lastRound = a.round || 0;
    if (a.skillName) names.push(a.skillName);
  }
  if (hits < 2) return null;
  const multiplier = 1 + (hits - 1) * 0.15;
  const comboName = hits >= 5 ? `${names[0] || '连'}·${hits}连` : hits >= 3 ? `${hits}连击` : '小连击';
  return {
    comboName,
    hits,
    multiplier: Math.min(2.5, Math.round(multiplier * 100) / 100),
    expiresTurn: (lastRound + 1),
  };
}

/**
 * AI-85: 结算连击加成后的最终伤害（保留整数下限）。
 */
export function resolveComboDamage(baseDamage: number, combo: ComboChain | null): { finalDamage: number; multiplier: number } {
  const base = Math.max(0, Math.floor(baseDamage || 0));
  if (!combo || combo.hits < 2) return { finalDamage: base, multiplier: 1 };
  const m = Math.max(1, combo.multiplier || 1);
  return { finalDamage: Math.max(1, Math.floor(base * m)), multiplier: m };
}


// ==================== AI-91~AI-103 Derived Functions ====================
// Worker A (xiaoxin-A) - additive only. New derived/state-less helpers.
// Do NOT touch state-machine cores (processYear / advanceYear / combat main flow).

// ===== AI-91: Combat Log =====
/**
 * 净化一条战斗日志：把机制词、数字等系统层信息剥离，保留叙事正文。
 * 系统层（如"你受到 3 点伤害"）→ 保留为 isSystem=true，不删字。
 * 叙事层 → 走 narrator 兜底，正常显示。
 */
export function sanitizeCombatLog(entry: CombatLogEntry): { text: string; isSystem: boolean } {
  if (!entry || typeof entry.text !== 'string') {
    return { text: '', isSystem: true };
  }
  // 已经被标记的条目直接返回；剥离零宽 / 控制字符
  const cleaned = entry.text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return { text: cleaned, isSystem: !!entry.isSystem };
}

/**
 * 将一连串战斗日志折叠成一段小说化叙述。
 * 系统条目直接以括注形式嵌入正文；叙事条目作为叙事主体。
 */
export function novelizeCombatLog(log: CombatLogEntry[]): string {
  if (!Array.isArray(log) || log.length === 0) return '';
  const narrativeParts: string[] = [];
  const systemParts: string[] = [];
  for (const e of log) {
    const s = sanitizeCombatLog(e);
    if (!s.text) continue;
    if (s.isSystem) {
      systemParts.push(s.text);
    } else {
      narrativeParts.push(s.text);
    }
  }
  const body = narrativeParts.join('');
  if (systemParts.length === 0) return body;
  // 系统信息以括注形式追加，避免打断正文
  const sys = systemParts.length === 1 ? systemParts[0] : systemParts.join('；');
  return body ? `${body}（${sys}）` : `（${sys}）`;
}

// ===== AI-92: Loot AI =====
/**
 * 从对手身上按 realm 等级推一组基础掉落（不应用 conditions）。
 * 高境界对手产出更稀有的物品；返回的物品名已经清掉敌人归属前缀。
 */
export function deriveLootFromOpponent(opponent: { id?: string; name?: string; realm?: string; level?: number }, realm: Realm): ItemEntry[] {
  const oppLevel = Math.max(0, Math.floor(opponent?.level ?? 1));
  const realmOrder: Realm[] = ['mortal','qi_refining','foundation','golden_core','nascent_soul','soul_formation','tribulation','ascension'];
  const idx = Math.max(0, realmOrder.indexOf(realm));
  const baseRarity = idx >= 5 ? 'rare' : idx >= 3 ? 'uncommon' : 'common';
  const spiritStones = 5 + idx * 8 + oppLevel * 2;
  // 不在 ItemEntry 内放 enemy 归属，只输出器物本名
  const loot: ItemEntry[] = [
    {
      id: `loot-spirit-${opponent?.id ?? 'enemy'}-${idx}`,
      name: `灵材残片（${baseRarity === 'rare' ? '珍' : baseRarity === 'uncommon' ? '异' : '凡'}）`,
      description: '从败敌遗物中拾得的零散灵材。',
      item_type: 'material',
      rarity: baseRarity as ItemEntry['rarity'],
      effects: [],
      source: '战利品',
    },
    {
      id: `loot-stash-${opponent?.id ?? 'enemy'}-${idx}`,
      name: `散碎灵石袋`,
      description: '装有数枚灵石的旧布袋。',
      item_type: 'tool',
      rarity: 'common',
      effects: [],
      source: '战利品',
    },
  ];
  return loot;
}

/**
 * 把 loot 表的 conditions 全部跑一遍，过滤掉未通过的项目，
 * 并把随机概率不足的条目按 chance 字段决定是否落入。
 * 返回的物品已经是经过 character 校验的最终掉落物。
 */
export function resolveLootConditions(loot: LootTable, character: CharacterState): ItemEntry[] {
  if (!loot || !Array.isArray(loot.items)) return [];
  const allowed: ItemEntry[] = [];
  const condList = Array.isArray(loot.conditions) ? loot.conditions : [];
  for (const item of loot.items) {
    let pass = true;
    for (const cond of condList) {
      if (!pass) break;
      if (!cond) continue;
      switch (cond.kind) {
        case 'min_realm':
          pass = cond.realm ? character.realm === cond.realm : true;
          break;
        case 'min_level':
          pass = (character.realmLevel ?? 0) >= (cond.minLevel ?? 0);
          break;
        case 'has_status':
          pass = Array.isArray(character.statuses) && character.statuses.some(s => s && s.id === cond.statusId);
          break;
        case 'has_tag':
          pass = Array.isArray((character as any).tags) && (character as any).tags.includes(cond.tag);
          break;
        case 'faction':
          pass = character.faction === cond.faction;
          break;
        case 'spirit_stones':
          pass = (character.spiritStones ?? 0) >= (cond.minStones ?? 0);
          break;
        case 'random': {
          const chance = typeof cond.chance === 'number' ? Math.max(0, Math.min(1, cond.chance)) : 1;
          if (chance < 1) {
            // 确定性派生：不真正随机，使用角色 id 哈希作伪随机种子
            const seed = (character.id ?? '').length + item.id.length + (item.rarity?.length ?? 0);
            const roll = ((seed * 9301 + 49297) % 233280) / 233280;
            pass = roll <= chance;
          }
          break;
        }
        default:
          pass = true;
      }
    }
    if (pass) allowed.push(item);
  }
  return allowed;
}

// ===== AI-93: Status Expiry =====
/**
 * 推算某状态在当前 age 下的过期年龄。
 * - rule='turns' / 没有 rule → 返回 null（按回合数走战斗 tick）
 * - rule='years' → 返回 startAge + remaining
 * - rule='condition' / 'event' → 返回 null（条件触发，不预测）
 */
export function buildCombatCauseChain(
  action: { kind: string; name?: string; resource?: string; cost?: number },
  character?: { realm?: string; realmLevel?: number; element?: string },
): CombatCauseChain {
  const kind = action?.kind ?? 'strike';
  const name = action?.name ?? '基础出招';
  const trigger = `${character?.realm ?? 'qi_refining'}修士催动「${name}」，灵力贯于指尖。`;
  let opponentResponse = '对手被迫后退半步，勉强稳住身形。';
  let environmentalEffect = '周围气流被牵动，沙石簌簌作响。';
  switch (kind) {
    case 'spell':
      opponentResponse = '对手识得此术法来源，急运护身灵气相抗。';
      environmentalEffect = '天地灵气被抽引，向此处汇聚。';
      break;
    case 'formation':
      opponentResponse = '对手发现脚下灵气纹路，欲抽身已是不及。';
      environmentalEffect = '地脉灵纹亮起，方圆十丈内灵气被锁。';
      break;
    case 'flee':
      opponentResponse = '对手见你退意，冷笑一声，并不追击。';
      environmentalEffect = '风压顿减，远方隐约传来兽鸣。';
      break;
    case 'deception':
      opponentResponse = '对手被假动作所惑，重心前倾。';
      environmentalEffect = '足下尘土扬起，掩去真身。';
      break;
    case 'ally':
      opponentResponse = '对手环顾左右，神色骤变。';
      environmentalEffect = '远处同门气息骤然逼近。';
      break;
    case 'artifact':
      opponentResponse = '法宝灵光一照，对手气血翻涌。';
      environmentalEffect = '灵器共振，震荡四方。';
      break;
    default:
      opponentResponse = '对手抬手硬接一招，指尖发麻。';
      environmentalEffect = '脚下石板龟裂，碎屑纷飞。';
  }
  return { action: name, trigger, opponentResponse, environmentalEffect };
}

/**
 * AI-G116: Resolve a combat stalemate exit strategy.
 * Considers allies, terrain tags, opponent HP, and turn count.
 */
export function resolveStalemateExit(
  session: {
    turnCount: number;
    opponents?: Array<{ name?: string; hp?: number }>;
    environmentTags?: string[];
  } | null | undefined,
  character: { id?: string; realm?: string; realmLevel?: number; faction?: string; allies?: string[] } | null | undefined,
): StalemateExit {
  const turn = session?.turnCount ?? 0;
  const allies = Array.isArray(character?.allies) ? character.allies : [];
  const tags = Array.isArray(session?.environmentTags) ? session.environmentTags : [];
  const oppHpLow =
    Array.isArray(session?.opponents) &&
    session.opponents.some((o) => typeof o.hp === 'number' && o.hp < 30);
  if (allies.length > 0 && turn > 3) return 'ally-intervention';
  if (tags.includes('mountain') || tags.includes('forest') || tags.includes('river'))
    return 'terrain-shift';
  if (oppHpLow) return 'risky-strike';
  if (turn >= 8) return 'disengage';
  return 'deception';
}


// ============================================================================
// Worker C (phase-h-p2-mid): 完整世界地图与世界地点 —— 引擎层
// ============================================================================
// 5 个导出函数：
//   - buildEmptyWorldMap()           -> WorldMap                    空地图骨架
//   - discoverLocation(map,id,age)   -> WorldMap                    标记一处地点为已发现
//   - deriveTravelFeasibility(route, character) -> { feasible, reason, alternativeRoutes }
//   - generateRandomEncounter(route, character, rand?) -> { type, description, effects }
//   - summarizeWorldForPrompt(map, charLimit) -> string              AI prompt 摘要
//
// 设计约束：
// - 不依赖 store.ts / UI / DB；
// - 只接受 map / route / character 的最小契约；character 类型为局部 interface。
// - generateRandomEncounter 的 rand 参数允许注入随机源，便于 smoke / 测试。
// ============================================================================

/**
 * Worker C 引擎层使用的角色最小契约（不引入 CharacterState 全量字段，避免循环依赖）。
 * 任何传入的角色对象只要满足这个子集即可。
 */