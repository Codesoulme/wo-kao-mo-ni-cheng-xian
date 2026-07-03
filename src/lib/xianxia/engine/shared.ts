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
  getRealmProfile,
} from './attributes';
import {
  evaluateEndingConditions,
  selectEndingPath,
} from './ending-inheritance-fate';
import {
  evaluateTechniqueCompatibility,
} from './items';

export function clampProfileNumber(n: any, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

export function sanitizeRealmProfile(raw: any): RealmProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const profile: RealmProfile = {};
  const rawName = raw.name ? String(raw.name).trim() : '';
  if (rawName && !/候补|杂役|弟子|门人|执事|长老|宗主|身份|职位|职司|差役|仆役/.test(rawName)) profile.name = rawName.slice(0, 16);
  if (raw.shortName && !/候补|杂役|弟子|门人|执事|长老|身份|职位/.test(String(raw.shortName))) profile.shortName = String(raw.shortName).slice(0, 3);
  if (/^#[0-9a-fA-F]{6}$/.test(String(raw.color || ''))) profile.color = String(raw.color);
  if (raw.maxLevel !== undefined) profile.maxLevel = Math.round(clampProfileNumber(raw.maxLevel, 0, 999, 9));
  if (raw.powerMultiplier !== undefined) profile.powerMultiplier = clampProfileNumber(raw.powerMultiplier, 0.5, 9, 1);
  if (raw.expMultiplier !== undefined) profile.expMultiplier = clampProfileNumber(raw.expMultiplier, 0.2, 20, 1);
  if (raw.reason) profile.reason = String(raw.reason).slice(0, 120);
  if (raw.traits && typeof raw.traits === 'object') {
    const rawTraits = raw.traits as Record<string, any>;
    profile.traits = {};
    for (const key of ['cultivationMode', 'bottleneck', 'breakthroughTrial', 'socialWeight'] as const) {
      if (rawTraits[key]) (profile.traits as any)[key] = String(rawTraits[key]).slice(0, 160);
    }
    for (const key of ['capabilities', 'limitations', 'worldAccess', 'combatStyle', 'resourceNeeds', 'riskTags'] as const) {
      if (Array.isArray(rawTraits[key])) (profile.traits as any)[key] = rawTraits[key].map(String).filter(Boolean).slice(0, 6);
    }
    if (!Object.keys(profile.traits).length) delete profile.traits;
  }
  return Object.keys(profile).length ? profile : undefined;
}

export function realmPowerMultiplier(state: CharacterState): number {
  return clampProfileNumber(getRealmProfile(state)?.powerMultiplier, 0.5, 9, 1);
}

export function safeRarityIndex(rarity?: string): number {
  const idx = rarityIndex(String(rarity || 'common'));
  return idx >= 0 ? idx : 0;
}

export function stripLootOwnerPrefix(name?: string): string {
  const text = String(name || '').trim();
  if (!text) return text;
  const match = text.match(/^(.{1,10})的(.{2,24})$/u);
  if (!match) return text;
  const [, owner, objectName] = match;
  const ownerLooksLikeEnemy = /修|汉|客|徒|信使|匪|贼|妖|兽|狼|虎|蛇|蛛|狐|猿|魔|邪|劫|道人|真人|老祖|敌|疤|牙|瘦|胖|黑衣|蒙面/.test(owner);
  const objectLooksLikeLoot = /符|剑|刀|珠|环|甲|袍|幡|铃|镜|印|袋|丹|诀|经|玉简|法器|法宝|护/.test(objectName);
  return ownerLooksLikeEnemy && objectLooksLikeLoot ? objectName : text;
}

export function activeConstitutionStatuses(state: CharacterState): StatusEntry[] {
  return (state.activeStatuses || []).filter(status => Boolean(status.constitution));
}

function inferDominantElementFromText(text: string): ElementType | 'none' {
  if (/金|剑|刃|锋|metal|sword|blade|sharp|jin/i.test(text)) return 'metal';
  if (/木|花|草|藤|青|生|药|wood|flower|plant|green|life|mu/i.test(text)) return 'wood';
  if (/水|冰|寒|潮|water|ice|cold|tide|shui/i.test(text)) return 'water';
  if (/火|炎|阳|焰|fire|flame|sun|yang|huo/i.test(text)) return 'fire';
  if (/土|山|岩|岳|earth|mountain|rock|tu/i.test(text)) return 'earth';
  return 'none';
}

function cleanTechniqueBaseName(name?: string): string {
  const raw = String(name || '').trim();
  const cleaned = raw
    .replace(/[\u300a\u300b<>]/g, '')
    .replace(/(玉简|心得|功法|法门|残篇|真经|经卷|剑经|经|诀|法|功|术|谱)$/u, '')
    .trim();
  return (cleaned || raw || '\u7075\u673a').slice(0, 12);
}

function fallbackScriptureAbilityName(item: ItemEntry, element: ElementType | 'none', text: string): string {
  if (/\u5251|sword|blade/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5251\u5f0f`;
  if (/\u5200|\u5203|blade|sabre/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5203\u5f0f`;
  if (/\u96f7|thunder|lightning/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u96f7\u5f15`;
  if (/\u706b|\u708e|\u7130|fire|flame/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u706b\u6cd5`;
  if (/\u6c34|\u51b0|\u6f6e|water|ice|tide/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u6f6e\u6cd5`;
  if (/\u6728|\u82b1|\u85e4|\u9752|wood|flower|plant/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u9752\u6728\u672f`;
  if (/\u571f|\u5c71|\u5ca9|earth|mountain|rock/i.test(text)) return `${cleanTechniqueBaseName(item.name)}\u5ca9\u5cb3\u672f`;
  if (element === 'metal') return `${cleanTechniqueBaseName(item.name)}\u91d1\u950b\u672f`;
  if (element === 'wood') return `${cleanTechniqueBaseName(item.name)}\u751f\u673a\u672f`;
  if (element === 'water') return `${cleanTechniqueBaseName(item.name)}\u51dd\u6ce2\u672f`;
  if (element === 'fire') return `${cleanTechniqueBaseName(item.name)}\u708e\u606f\u672f`;
  if (element === 'earth') return `${cleanTechniqueBaseName(item.name)}\u539a\u571f\u672f`;
  return `${cleanTechniqueBaseName(item.name)}\u672f\u5f0f`;
}

export function fallbackTechniqueAbility(item: ItemEntry, source: 'scripture' | 'artifact'): { name: string; description: string; element: ElementType | 'none'; trigger?: ArtifactAbility['trigger'] } {
  const text = `${item.name || ''}${item.description || ''}`;
  const element = inferDominantElementFromText(text);
  const isSword = /\u5251|sword|blade/i.test(text);
  const isWater = /\u6c34|\u51b0|\u6f6e|water|ice|tide/i.test(text);
  const isProtect = /\u62a4|\u76fe|\u5b88|\u7f69|protect|shield|guard/i.test(text);
  const trigger: ArtifactAbility['trigger'] = isWater ? 'underwater' : isProtect ? 'auto' : 'active';
  const name = source === 'artifact'
    ? (isProtect ? '\u62a4\u8eab\u7075\u7981' : isWater ? '\u907f\u6c34\u7075\u7981' : isSword ? '\u5251\u7eb9\u7075\u7981' : `${cleanTechniqueBaseName(item.name)}\u7075\u7981`)
    : fallbackScriptureAbilityName(item, element, text);
  const description = source === 'artifact'
    ? '\u6cd5\u5b9d\u5185\u85cf\u7075\u7981\u88ab\u50ac\u52a8\uff0c\u5f62\u6210\u4e00\u9053\u72ec\u7acb\u4e8e\u5668\u7269\u672c\u540d\u7684\u5668\u672f\u6548\u679c\u3002'
    : `\u4f9d${item.name || '\u6b64\u95e8\u529f\u6cd5'}\u7684\u884c\u6c14\u8109\u7edc\u51dd\u6210\u6597\u6cd5\u672f\u5f0f\uff0c\u4e0d\u76f4\u63a5\u590d\u7528\u529f\u6cd5\u672c\u540d\u3002`;
  return { name, description, element, trigger };
}


export function describeArtifactAbilitiesOnItem(item: ItemEntry): ItemEntry {
  if (item.item_type !== 'artifact') return item;
  const profile = item.technique || inferTechniqueProfile(item);
  const abilities = profile?.artifactAbilities || [];
  if (!abilities.length) return item;
  const abilityText = abilities.slice(0, 2)
    .map(ability => `${ability.name || '\u672a\u540d\u7075\u7981'}\uff1a${ability.description || '\u6b64\u7269\u5185\u85cf\u53ef\u50ac\u53d1\u7684\u7075\u7981\u672f\u5f0f\u3002'}`)
    .join('\uff1b');
  const baseDesc = item.description || '\u4e00\u4ef6\u6765\u5386\u672a\u660e\u7684\u6cd5\u5668\u3002';
  if (baseDesc.includes('\u5185\u85cf\u7075\u7981') || baseDesc.includes('\u81ea\u5e26\u672f\u5f0f')) return { ...item, technique: profile };
  return { ...item, technique: profile, description: `${baseDesc}\u5185\u85cf\u7075\u7981\uff1a${abilityText}` };
}

function normalizeTechniqueProfile(item: ItemEntry, profile: TechniqueProfile): TechniqueProfile {
  const source = item.item_type === 'artifact' ? 'artifact' : 'scripture';
  const fallback = fallbackTechniqueAbility(item, source);
  const next: TechniqueProfile = { ...profile };
  if (next.spell && (!next.spell.name || next.spell.name === item.name || !next.spell.description || next.spell.description === item.description)) {
    next.spell = {
      ...next.spell,
      name: next.spell.name && next.spell.name !== item.name ? next.spell.name : fallback.name,
      description: next.spell.description && next.spell.description !== item.description ? next.spell.description : fallback.description,
      element: next.spell.element || fallback.element,
    };
  }
  if (next.artifactAbilities?.length) {
    next.artifactAbilities = next.artifactAbilities.map(ability => ({
      ...ability,
      name: ability.name && ability.name !== item.name ? ability.name : fallback.name,
      description: ability.description && ability.description !== item.description ? ability.description : fallback.description,
      element: ability.element || fallback.element,
      trigger: ability.trigger || fallback.trigger,
    }));
  }
  return next;
}

export function inferTechniqueProfile(item: ItemEntry): TechniqueProfile | undefined {
  if (item.technique) return normalizeTechniqueProfile(item, item.technique);
  if (item.item_type !== 'scripture' && item.item_type !== 'artifact') return undefined;
  const text = `${item.name || ''}${item.description || ''}`;
  const requirements: TechniqueRequirement = {};
  const preferredRoots: SpiritualRoot[] = [];
  if (/metal|sword|blade|sharp|jin/i.test(text)) preferredRoots.push('pure', 'heavenly');
  if (/wood|green|life|plant|mu/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/water|ice|cold|tide|shui/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/fire|flame|sun|yang|huo/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (/earth|mountain|rock|tu/i.test(text)) preferredRoots.push('common', 'pure', 'heavenly');
  if (text.includes('\u5929\u7075\u6839') || text.includes('\u5355\u7075\u6839') || text.includes('\u7eaf')) requirements.spiritualRoots = ['pure', 'heavenly', 'chaos'];
  else if (text.includes('\u6df7\u6c8c') || text.includes('\u4e94\u884c\u4ff1\u5168') || text.includes('\u592a\u521d')) requirements.spiritualRoots = ['chaos'];
  else if (preferredRoots.length) requirements.preferredRoots = Array.from(new Set(preferredRoots));
  const ri = safeRarityIndex(item.rarity);
  if (item.item_type === 'scripture') {
    if (ri >= 5) requirements.minRealm = 'nascent_soul';
    else if (ri >= 4) requirements.minRealm = 'golden_core';
    else if (ri >= 3) requirements.minRealm = 'foundation';
    else if (ri >= 1) requirements.minRealm = 'qi_refining';
    requirements.minComprehension = ri >= 4 ? 70 : ri >= 3 ? 55 : ri >= 2 ? 40 : undefined;
  } else {
    if (ri >= 5) requirements.minRealm = 'golden_core';
    else if (ri >= 4) requirements.minRealm = 'foundation';
    else if (ri >= 2) requirements.minRealm = 'qi_refining';
    requirements.minComprehension = ri >= 4 ? 55 : ri >= 3 ? 40 : undefined;
  }
  const derivedAbility = fallbackTechniqueAbility(item, item.item_type === 'artifact' ? 'artifact' : 'scripture');
  const artifactAbilities = item.item_type === 'artifact'
    ? [{
      name: derivedAbility.name,
      description: derivedAbility.description,
      trigger: derivedAbility.trigger,
      element: derivedAbility.element,
      power: 1 + ri * 0.35,
      permanentBuff: derivedAbility.trigger === 'underwater' || derivedAbility.trigger === 'auto',
      rarityNote: ri >= 2 ? '\u6cd5\u5b9d\u54c1\u8d28\u8f83\u9ad8\uff0c\u81ea\u5e26\u53ef\u89e6\u53d1\u7684\u5668\u7269\u7075\u7981\u3002' : '\u53ea\u6709\u5c11\u6570\u51e1\u54c1\u6cd5\u5b9d\u4f1a\u7559\u6709\u7c97\u6d45\u7075\u7981\u3002',
    }]
    : undefined;
  return {
    kind: item.item_type === 'scripture' ? 'cultivation' : 'artifact',
    requirements,
    traits: item.item_type === 'scripture'
      ? [{ name: '\u884c\u529f\u8def\u7ebf', description: '\u4fee\u70bc\u65f6\u6539\u53d8\u5410\u7eb3\u8282\u5f8b\u4e0e\u7075\u6c14\u8fd0\u8f6c\uff0c\u5f71\u54cd\u957f\u671f\u4fee\u4e3a\u79ef\u7d2f\u3002' }]
      : [{ name: '\u5668\u7269\u7075\u7981', description: '\u6cd5\u5b9d\u7684\u7075\u7981\u968f\u4f69\u6234\u6216\u50ac\u52a8\u751f\u6548\uff0c\u4e0d\u7b49\u540c\u4e8e\u89d2\u8272\u5b66\u4f1a\u6b64\u6cd5\u672f\u3002' }],
    spell: item.item_type === 'scripture' && ['\u672f','\u8bc0','\u5251','\u706b','\u96f7','\u51b0','\u98ce','\u5370','\u638c','\u6307'].some(k => text.includes(k))
      ? { name: derivedAbility.name, description: derivedAbility.description, element: derivedAbility.element, power: 1 + safeRarityIndex(item.rarity) * 0.45 }
      : undefined,
    artifactAbilities,
    mismatchRisk: item.item_type === 'scripture'
      ? '\u5f3a\u884c\u4fee\u4e60\u4e0d\u5408\u6839\u6027\u7684\u6cd5\u95e8\uff0c\u8f7b\u5219\u8fdb\u5883\u8fdf\u6ede\uff0c\u91cd\u5219\u7075\u529b\u9006\u884c\u3002'
      : '\u6cd5\u5b9d\u7075\u7981\u53ef\u968f\u5668\u7269\u751f\u6548\uff0c\u4f46\u4fee\u4e3a\u4e0d\u8db3\u65f6\u4e3b\u52a8\u50ac\u52a8\u4f1a\u5a01\u529b\u6298\u51cf\u6216\u589e\u52a0\u53cd\u566c\u98ce\u9669\u3002',
  };
}

function isArtifactTechnique(profile?: TechniqueProfile): boolean {
  return profile?.kind === 'artifact' || Boolean(profile?.artifactAbilities?.length);
}

export function adaptTechniqueEffect(state: CharacterState, item: ItemEntry, eff: any): any {
  if (item.item_type !== 'scripture' && item.item_type !== 'artifact') return eff;
  const compat = evaluateTechniqueCompatibility(state, item);
  if (!compat.usable && !isArtifactTechnique(compat.profile)) return null;
  if (compat.adaptation >= 0.98) return eff;
  if (eff.target_attribute === 'cultivationExp') {
    if (eff.operation === 'multiply') {
      const value = 1 + Math.max(0, (Number(eff.value) - 1) * compat.adaptation);
      return { ...eff, value: Number(value.toFixed(2)), description: `${eff.description || item.name}\uff08\u9002\u914d${Math.round(compat.adaptation * 100)}%\uff0c\u6548\u529b\u6298\u51cf\uff09` };
    }
    if (eff.operation === 'add') {
      return { ...eff, value: Number((Number(eff.value) * compat.adaptation).toFixed(2)), description: `${eff.description || item.name}\uff08\u9002\u914d\u4e0d\u8db3\uff0c\u6536\u76ca\u6298\u51cf\uff09` };
    }
  }
  if (eff.operation === 'add') return { ...eff, value: Number((Number(eff.value) * compat.adaptation).toFixed(2)) };
  if (eff.operation === 'multiply' && Number(eff.value) > 1) return { ...eff, value: Number((1 + (Number(eff.value) - 1) * compat.adaptation).toFixed(2)) };
  return eff;
}

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export function rarityIndex(r: string): number {
  return RARITY_ORDER.indexOf(r);
}

// 炼丹炉：消耗 2-3 个材料 + 灵石，有概率炼出丹药
// 成功率 = 30% + 悟性*0.4% + 灵根倍率*5% + 平均材料 rarity*8% - 5%（每多一个材料扣减）
// 成功：丹药 rarity = clamp(平均材料 rarity ± 1)，效果按主要元素
// 失败：得一枚"废丹"（common consumable，恢复 5hp）
const VALID_ITEM_TYPES_FOR_NORMALIZE = new Set(['weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool', 'scripture']);
const SCRIPTURE_NAME_RE = /诀|决|经|典|录|篇|章|解|式|术|功法|心法|秘籍|玉简|心得|真经|真解|引气|凝气|吐纳/;
const CULTIVATION_EFFECT_ALIASES = new Set(['cultivationExp', 'cultivation', 'cultivationRate', 'cultivationMultiplier', 'cultivation_speed', '修为', '修炼速度']);

function defaultScriptureMultiplier(rarity?: string): number {
  const multByRarity: Record<string, number> = {
    common: 1.3, uncommon: 1.7, rare: 2.5, epic: 3.5, legendary: 4.5, mythic: 5.5,
  };
  return multByRarity[rarity || ''] || 1.5;
}

function isArtifactTechniqueProfile(technique: ItemEntry['technique'] | undefined): boolean {
  return !!technique && (technique.kind === 'artifact' || (Array.isArray(technique.artifactAbilities) && technique.artifactAbilities.length > 0));
}

function isAutoInjectedScriptureCultivationEffect(e: StatusEffect, rarity?: string): boolean {
  if (e.target_attribute !== 'cultivationExp' || e.operation !== 'multiply') return false;
  const desc = String(e.description || '');
  const defaultMult = defaultScriptureMultiplier(rarity);
  return /修习此功法|功法.*修为流转/.test(desc) || Math.abs(Number(e.value || 0) - defaultMult) < 0.0001;
}

export function normalizeCultivationBearingItem(it: ItemEntry): ItemEntry {
  const hasStorageEffect = (it.effects || []).some(e => e.target_attribute === 'storageCapacity' && e.operation === 'add' && e.value > 0);
  const artifactByTechnique = isArtifactTechniqueProfile(it.technique);
  let itemType = it.item_type;
  if (!VALID_ITEM_TYPES_FOR_NORMALIZE.has(itemType)) {
    itemType = hasStorageEffect ? 'tool' : 'material';
  } else if (hasStorageEffect && itemType !== 'tool') {
    itemType = 'tool';
  }

  // 旧档兼容：曾有法宝/护符因名字或描述被误归为 scripture，并被补上“修习此功法”倍率。
  // technique.kind/artifactAbilities 是更强事实；这类物品必须回到 artifact，不再当功法修炼。
  if (artifactByTechnique) itemType = 'artifact';

  const isScriptureByName = SCRIPTURE_NAME_RE.test(`${it.name || ''}${it.description || ''}`);
  if (!artifactByTechnique && isScriptureByName && itemType !== 'scripture') {
    itemType = 'scripture';
  }

  let effects = Array.isArray(it.effects) ? it.effects.map(e => {
    if (CULTIVATION_EFFECT_ALIASES.has(e.target_attribute) && e.target_attribute !== 'cultivationExp') {
      return { ...e, target_attribute: 'cultivationExp' };
    }
    return e;
  }) : [];

  if (itemType === 'artifact') {
    effects = effects.filter(e => !isAutoInjectedScriptureCultivationEffect(e, it.rarity as string));
  }

  if (itemType === 'scripture' && !effects.some(e => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) {
    const mult = defaultScriptureMultiplier(it.rarity as string);
    effects = [...effects, {
      target_attribute: 'cultivationExp',
      operation: 'multiply',
      value: mult,
      description: `修习此功法，修为流转加速×${mult}`,
    }];
  }

  const base = { ...it, name: stripLootOwnerPrefix(it.name), item_type: itemType as any, effects };
  if (itemType === 'artifact') {
    const withTechnique = base.technique ? base : { ...base, technique: inferTechniqueProfile(base) };
    return describeArtifactAbilitiesOnItem(withTechnique);
  }
  if (itemType === 'scripture' && !base.technique) {
    return { ...base, technique: inferTechniqueProfile(base) };
  }
  return base;
}


export function normalizeThreadCompletion(thread: PendingThread): PendingThread {
  if (!thread) return thread;
  if (thread.status === 'resolved' || thread.status === 'failed') return thread;
  const progress = Math.max(0, Math.min(100, Number(thread.progress || 0)));
  if (progress >= 100) {
    return { ...thread, progress: 100, status: 'resolved' as const, dueInSameYear: false };
  }
  return progress === thread.progress ? thread : { ...thread, progress };
}

export function normalizeThreadsCompletion(threads: PendingThread[] = []): PendingThread[] {
  return threads.map(normalizeThreadCompletion);
}

function cleanStoryRealmName(name: string): string {
  return String(name || '')
    .replace(/^(?:或可|可|可以|尚可|似可|若要|若想|前往|进入|探入|探明|探得|发现|得见|显出|现出|浮出|露出|通往|指向|开启)+/, '')
    .replace(/^(?:的|之|其|一处|此处)+/, '')
    .replace(/[，。；、：:！!？?].*$/, '')
    .trim();
}

export function inferStoryRealmName(text: string): string | null {
  const source = String(text || '');
  const suffix = '(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿)';
  const composite = source.match(new RegExp(`([\\u4e00-\\u9fa5]{2,8}(?:江|溪|河|湾|湖|山|岭|渡|岸|洲|峰|林|泽|城))[\\u4e00-\\u9fa5]{0,4}(?:显出|现出|浮出|露出|探明|探得|发现|得见|可见|藏着|藏有|通往|开启|指向)([\\u4e00-\\u9fa5]{2,8}${suffix})`));
  if (composite?.[1] && composite?.[2]) {
    const loc = cleanStoryRealmName(composite[1]);
    const site = cleanStoryRealmName(composite[2]);
    if (loc && site && !site.startsWith(loc)) return `${loc}${site}`.slice(0, 14);
    if (site) return site;
  }
  const quoted = source.match(/[「『“\"]([^」』”\"]{2,14}(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿))[^」』”\"]*[」』”\"]/);
  if (quoted?.[1]) return cleanStoryRealmName(quoted[1]);
  const named = source.match(/([\u4e00-\u9fa5]{2,14}(?:秘境|浮阁|洞府|遗迹|禁地|水府|古阁|钟楼|雾楼|楼|谷|府|墟|宫|殿))/);
  if (named?.[1]) return cleanStoryRealmName(named[1]);
  return null;
}

type _PhaseGReexport =
  | SecretRealmTriggerCondition
  | SecretRealmEntryAttempt
  | BidderArchetype
  | BidderBehaviorProfile
  | CombatCauseChain
  | StalemateExit;
const _phaseGAnchor: _PhaseGReexport | null = null;
void _phaseGAnchor;

/**
 * AI-G111: Evaluate whether character can attempt to enter a SecretRealm.
 * Reads realm.entryRequirement + entryAlternatives; scans character.inventory + statuses.
 * Returns triggers[], missing[], bypassOptions[], and canAttempt flag.
 */
interface WorkerCNodeLike {
  id: string;
  name: string;
  region?: WorldRegion;
  tier?: RegionTier;
  dangerLevel?: number;
  spiritualDensity?: number;
  resources?: string[];
  controllingFaction?: string;
  hiddenEntrance?: boolean;
}

interface WorkerCRouteLike {
  from: string;
  to: string;
  distanceDays: number;
  dangerLevel: number;
  requiredRealm: string;
  hiddenRequirements?: string[];
}

interface WorkerCMapLike {
  nodes: WorkerCNodeLike[];
  routes: WorkerCRouteLike[];
  currentLocationId: string;
  discoveredLocationIds: string[];
}

/**
 * 境界排序常量（与 types.ts REALMS 同序；避免 import 顺序问题，这里硬编码为同序）。
 * mortal=0 < qi_refining=1 < foundation_building=2 < golden_core=3 < nascent_soul=4
 * < spirit_severing=5 < tribulation=6 < immortal_ascension=7
 */
export interface WorkerDCharacter {
  id?: string;
  name?: string;
  age?: number;
  realm?: string;
  realmLevel?: number;
  comprehension?: number;
  luck?: number;
  elements?: Partial<Record<ElementType, number>>;
  inventory?: ItemEntry[];
  activeStatuses?: Array<{ id?: string; name?: string; category?: string }>;
}

export interface WorkerDEndingCharacter {
  id?: string;
  name?: string;
  age?: number;
  lifespan?: number;
  realm?: string;
  realmLevel?: number;
  alive?: boolean;
  ascended?: boolean;
  faction?: string;
  master?: string;
  causeOfDeath?: string;
  // 关键资源/因缘标记（用于 evaluate 判定）
  karmaTags?: string[];
  resources?: { spiritStones?: number; reputation?: number };
  // 继承人候选（如弟子 / 子嗣 / 道统传承者）
  heirCandidateIds?: string[];
}

export interface WorkerDEndingWorldState {
  eraName?: string;
  worldStability?: number; // 0-1，<0.3 时 world-collapse 权重放大
  isDoomActive?: boolean;  // 是否处于天地崩劫
  factionState?: string;   // 宗门状态标签
  activeApocalypse?: boolean;
}

export function safeStringArray(input: unknown, max = 16): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const it of input) {
    if (typeof it === 'string' && it.length > 0) {
      out.push(it.length > 80 ? it.substring(0, 80) : it);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * AI-I431 / evaluateEndingConditions:
 *   根据角色 + 世界状态，返回「当前可见/可达」的所有结局条件列表。
 *   - 强制附加 8 种正典结局（每种至少 1 个），世界崩劫/世界稳定度/宗门状态用于放大权重；
 *   - 列表按 weight 降序排列，便于 selectEndingPath 直接消费；
 *   - 不做任何随机抽样（确定性函数）。
 */
function _kbDescribeFateKind(k: string): string {
  if (k === 'heavy') return '命运重劫';
  if (k === 'mid') return '命运羁绊';
  return '命运微澜';
}

function _kbDescribeFateOutcome(o: string): string {
  if (o === 'resolved-positive') return '了结，因果归位';
  if (o === 'resolved-negative') return '了结，余怨难消';
  return '未了，待续';
}
