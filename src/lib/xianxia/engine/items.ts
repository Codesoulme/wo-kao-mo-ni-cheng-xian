// AUTO-SPLIT from engine.ts — physical extraction only, logic unchanged.

import { DEFAULT_STORAGE_CAPACITY } from '../types/item';
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
  ATTRIBUTE_BOUNDS,
  computeEffectiveCultivationRate,
  isStorageBag,
  normalizeCultivationState,
  recalcCultivationMultiplier,
} from './attributes';
import {
  RARITY_ORDER,
  activeConstitutionStatuses,
  adaptTechniqueEffect,
  describeArtifactAbilitiesOnItem,
  fallbackTechniqueAbility,
  inferTechniqueProfile,
  normalizeCultivationBearingItem,
  safeRarityIndex,
  stripLootOwnerPrefix,
} from './shared';

export interface ItemEffectResolveResult {
  state: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  effectResolveTrace: EffectResolveTrace[];
  effectResolveWarnings: string[];
}

export interface ItemActionResult extends ItemEffectResolveResult {
  ok: boolean;
  error?: string;
  item?: ItemEntry;
}

function emptyItemActionResult(state: CharacterState, ok = false, error?: string, item?: ItemEntry): ItemActionResult {
  return { state, ok, error, item, appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
}

export function resolveItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1, label?: string): ItemEffectResolveResult {
  const changes: AttributeChange[] = [];
  const compat = evaluateTechniqueCompatibility(state, item);
  if (sign > 0 && !compat.usable) {
    return {
      state,
      appliedChanges: [],
      rejectedChanges: [],
      effectResolveTrace: [{ severity: 'warning', code: 'technique_requirement_unmet', source: label || item.name, message: `${item.name}\u672a\u6ee1\u8db3\u4fee\u4e60\u6761\u4ef6\uff1a${compat.reasons.join('\uff1b') || '\u6839\u57fa\u4e0d\u5408'}` }],
      effectResolveWarnings: compat.warnings,
    };
  }
  for (const rawEff of item.effects || []) {
    const eff = sign > 0 ? adaptTechniqueEffect(state, item, rawEff) : rawEff;
    if (!eff) continue;
    if (eff.operation === 'add' && ATTRIBUTE_BOUNDS[eff.target_attribute]) {
      changes.push({
        attribute: eff.target_attribute,
        delta: sign * eff.value,
        reason: label || (sign > 0 ? `\u83b7\u5f97 ${item.name}` : `\u5931\u53bb ${item.name}`),
      });
    }
  }
  if (!changes.length) return { state, appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const resolved = resolveAttributeChanges(state, changes, {
    bounds: ATTRIBUTE_BOUNDS,
    source: label || item.name || 'item-action',
  });
  const extraTrace: EffectResolveTrace[] = [];
  if (sign > 0 && compat.profile && compat.adaptation < 0.98) {
    extraTrace.push({ severity: 'warning', code: 'technique_adaptation_reduced', source: label || item.name, message: `${item.name}\u9002\u914d\u4e0d\u8db3\uff1a${compat.warnings.join('\uff1b')}` });
  }
  return {
    state: resolved.state,
    appliedChanges: resolved.appliedChanges,
    rejectedChanges: resolved.rejectedChanges,
    effectResolveTrace: [...resolved.trace, ...extraTrace],
    effectResolveWarnings: [...resolved.trace.filter(trace => trace.severity !== 'info').map(trace => trace.message), ...compat.warnings],
  };
}

export function applyItemEffects(state: CharacterState, item: ItemEntry, sign: 1 | -1): CharacterState {
  return resolveItemEffects(state, item, sign).state;
}

// 重算修炼倍率 = 灵根倍率 × 所有已装备物品与状态词条的 multiply cultivationExp 效果之积
// 统一委托给 computeEffectiveCultivationRate（同时算 flatBonus，保持口径一致）
const CONSTITUTION_NAME_RE = /体质|道体|圣体|灵体|剑体|雷体|火体|水体|木体|金体|土体|仙体|魔体|妖体|宝体|血脉|仙骨|灵骨|道骨|根骨|先天|天赋/;

export function isConstitutionStatus(status: Partial<StatusEntry> | null | undefined): boolean {
  if (!status || !status.name) return false;
  if (status.constitution) return true;
  if (status.category === 'constitution') return true;
  const text = `${status.name || ''} ${status.description || ''} ${status.source || ''}`;
  return status.category === 'special' && CONSTITUTION_NAME_RE.test(text);
}

// 命格 / 封印 / 前世烙印类 status —— 传承池带入的「fate」类目走这里，
// 玩家角色出生就该看到这条 chip，且不能被后续 buff/debuff 从 topStatuses 里挤掉。
// 2026-07-08：新增 isFateStatus 供 StatusPanel 单独分类，避免出现"选了命格但看不到"。
const FATE_NAME_RE = /命格|封印|命盘|命数|命途|命脉|命轮|因果|轮回|宿命|印记|烙印|前世|来生/;
export function isFateStatus(status: Partial<StatusEntry> | null | undefined): boolean {
  if (!status || !status.name) return false;
  if (isConstitutionStatus(status)) return false;
  // 明确标注来源为"轮回带入"（传承池路径）的 special status 一律归为命格类
  if (status.category === 'special' && status.source === '轮回带入') return true;
  if (status.category === 'special' && status.source === '先天封印') return true;
  // 名称/描述含命格关键字的 special status（origins.ts 里 rollSealedFate 的产物走这条）
  if (status.category === 'special') {
    const text = `${status.name || ''} ${status.description || ''}`;
    if (FATE_NAME_RE.test(text)) return true;
  }
  return false;
}

const DEFAULT_EQUIP_NOTE: Record<string, string> = {
  weapon: '手持', armor: '身穿', accessory: '佩戴', artifact: '悬身', scripture: '修习',
};


type ItemRarity = ItemEntry['rarity'];

function clampRarityIndex(idx: number): ItemRarity {
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, idx))] as ItemRarity;
}

function makeLootId(prefix = 'loot'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const ELEMENT_KEYS = ['metal', 'wood', 'water', 'fire', 'earth'] as const;

function realmIndexOf(realm?: string): number {
  if (!realm) return -1;
  return REALMS.findIndex(r => r.id === realm || r.name === realm || r.shortName === realm);
}


function statusTextPool(state: CharacterState): string {
  return [
    state.faction || '',
    state.master || '',
    ...(state.activeStatuses || []).flatMap(st => [st.name, st.description, st.source]),
    ...(state.longTermMemory || []),
  ].join(';');
}

function constitutionTechniqueResonance(state: CharacterState, item: ItemEntry, profile: TechniqueProfile): { bonus: number; warnings: string[] } {
  const constitutions = activeConstitutionStatuses(state);
  if (!constitutions.length) return { bonus: 1, warnings: [] };
  const text = [
    item.name,
    item.description,
    profile.traits?.map(t => `${t.name}${t.description}`).join(' '),
    profile.spell ? `${profile.spell.name}${profile.spell.description}` : '',
  ].filter(Boolean).join(' ');
  let bonus = 1;
  const warnings: string[] = [];
  for (const status of constitutions) {
    const c = status.constitution;
    if (!c) continue;
    const elementHit = c.elementAffinity?.some(el => profile.requirements?.minElements?.[el] || text.includes(ELEMENTS[el].name));
    const keywordHit = c.techniqueKeywords?.some(keyword => keyword && text.includes(keyword));
    const tagHit = c.resonanceTags?.some(tag => tag && text.toLowerCase().includes(String(tag).toLowerCase()));
    if (elementHit || keywordHit || tagHit) {
      const stageBonus = Math.max(0, Math.min(0.18, 0.06 * Math.max(1, c.currentStage || 1)));
      bonus += stageBonus;
      warnings.push(`${status.name}与${item.name}气机相合，适配略有提升。`);
    }
    if (c.riskType === 'heart_demon' && /火|炎|阳|魔|煞|血/.test(text)) {
      warnings.push(`${status.name}火性或煞性相激，强行催动时更容易牵动心魔。`);
    }
    if (c.riskType === 'backlash' && safeRarityIndex(item.rarity) >= 3) {
      warnings.push(`${status.name}能容纳高阶法门，但错纳异力时反噬也更重。`);
    }
  }
  return { bonus: Number(Math.min(1.25, bonus).toFixed(2)), warnings };
}

export function evaluateTechniqueCompatibility(state: CharacterState, item: ItemEntry): { usable: boolean; adaptation: number; reasons: string[]; warnings: string[]; profile?: TechniqueProfile } {
  const profile = inferTechniqueProfile(item);
  if (!profile) return { usable: true, adaptation: 1, reasons: [], warnings: [] };
  const req = profile.requirements || {};
  let adaptation = 1;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const strictRoots = req.spiritualRoots || [];
  if (strictRoots.length && !strictRoots.includes(state.spiritualRoot)) {
    return { usable: false, adaptation: 0, reasons: [`\u7075\u6839\u4e0d\u5408\uff1a\u9700${strictRoots.map(r => SPIRITUAL_ROOTS[r]?.name || r).join('\u3001')}`], warnings: ['\u6b64\u6cd5\u95e8\u7075\u6839\u8981\u6c42\u4e25\u82db\uff0c\u5f53\u524d\u6839\u6027\u51e0\u4e4e\u4e0d\u80fd\u5165\u95e8\u3002'], profile };
  }
  const preferred = req.preferredRoots || [];
  if (preferred.length && !preferred.includes(state.spiritualRoot) && state.spiritualRoot !== 'chaos') {
    adaptation *= 0.55;
    warnings.push('\u7075\u6839\u5e76\u975e\u6700\u4f73\u9002\u914d\uff0c\u4fee\u4e60\u6548\u7387\u5927\u5e45\u964d\u4f4e\u3002');
  }
  if (req.minRealm) {
    const need = realmIndexOf(req.minRealm);
    const cur = realmIndexOf(state.realm);
    if (cur >= 0 && need >= 0 && cur < need) {
      const gap = need - cur;
      adaptation *= Math.max(0.25, 1 - gap * 0.28);
      warnings.push(`\u5883\u754c\u672a\u81f3${REALMS[need]?.name || req.minRealm}\uff0c\u53ea\u80fd\u52c9\u5f3a\u53c2\u609f\u3002`);
    }
  }
  if (typeof req.minComprehension === 'number' && state.comprehension < req.minComprehension) {
    adaptation *= Math.max(0.35, state.comprehension / Math.max(1, req.minComprehension));
    warnings.push('\u609f\u6027\u4e0d\u8db3\uff0c\u53c2\u609f\u6b64\u6cd5\u8fdb\u5c55\u7f13\u6162\u3002');
  }
  for (const el of ELEMENT_KEYS) {
    const need = req.minElements?.[el];
    if (typeof need === 'number' && (state.elements?.[el] || 0) < need) {
      adaptation *= Math.max(0.35, (state.elements?.[el] || 0) / Math.max(1, need));
      warnings.push(`${ELEMENTS[el].name}\u884c\u611f\u5e94\u4e0d\u8db3\uff0c\u672f\u8def\u4e0d\u987a\u3002`);
    }
  }
  const resonance = constitutionTechniqueResonance(state, item, profile);
  if (resonance.bonus > 1 && adaptation > 0) {
    adaptation *= resonance.bonus;
    warnings.push(...resonance.warnings);
  }

  if (req.requiredStatuses?.length) {
    const pool = statusTextPool(state);
    const missing = req.requiredStatuses.filter(k => k && !pool.includes(k));
    if (missing.length) {
      adaptation *= 0.35;
      warnings.push(`\u7f3a\u5c11${missing.join('\u3001')}\u7b49\u524d\u7f6e\u56e0\u7f18\uff0c\u53ea\u80fd\u63e3\u6469\u76ae\u6bdb\u3002`);
    }
  }
  adaptation = Number(Math.max(0, Math.min(1.2, adaptation)).toFixed(2));
  if (adaptation >= 0.95) reasons.push('\u6cd5\u95e8\u4e0e\u5f53\u524d\u6839\u57fa\u76f8\u5408');
  else if (adaptation > 0) reasons.push(`\u6cd5\u95e8\u9002\u914d\u7ea6${Math.round(adaptation * 100)}%`);
  return { usable: adaptation > 0, adaptation, reasons, warnings, profile };
}

function artifactAbilityPower(ability: NonNullable<TechniqueProfile['artifactAbilities']>[number], compatAdaptation: number): number {
  const basePower = ability.power || 1;
  return Number((basePower * Math.max(0.4, compatAdaptation || 0.4)).toFixed(2));
}

export function buildLearnedCombatArts(state: CharacterState): { itemId: string; name: string; description: string; mpCost: number; power: number; rarity?: string; sourceType?: string; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'none'; adaptation?: number }[] {
  return (state.equipped || [])
    .filter(it => it.item_type === 'scripture' || it.item_type === 'artifact')
    .flatMap(it => {
      const compat = evaluateTechniqueCompatibility(state, it);
      const profile = compat.profile;
      const rarityCost = it.rarity === 'mythic' ? 30 : it.rarity === 'legendary' ? 25 : it.rarity === 'epic' ? 20 : it.rarity === 'rare' ? 15 : 10;
      if (it.item_type === 'artifact') {
        const fallbackAbility = fallbackTechniqueAbility(it, 'artifact');
        const abilities = profile?.artifactAbilities?.length
          ? profile.artifactAbilities
          : [{ name: fallbackAbility.name, description: fallbackAbility.description, trigger: fallbackAbility.trigger, mpCost: rarityCost, power: 1 + safeRarityIndex(it.rarity) * 0.35, element: fallbackAbility.element }];
        return abilities.map(ability => ({
          itemId: it.id,
          name: ability.name,
          description: ability.description,
          mpCost: Math.max(0, Math.floor(ability.mpCost ?? (ability.trigger === 'passive' || ability.trigger === 'auto' || ability.trigger === 'underwater' ? 0 : rarityCost))),
          power: artifactAbilityPower(ability, compat.adaptation),
          rarity: it.rarity,
          sourceType: it.item_type,
          element: ability.element,
          adaptation: compat.adaptation,
        }));
      }
      if (!compat.usable) return [];
      const spell = profile?.spell;
      if (!spell && !(profile?.traits || []).length) return [];
      return [{
        itemId: it.id,
        name: spell?.name || fallbackTechniqueAbility(it, 'scripture').name,
        description: spell?.description || fallbackTechniqueAbility(it, 'scripture').description,
        mpCost: Math.max(5, Math.floor(spell?.mpCost || rarityCost)),
        power: Number(((spell?.power || (1 + safeRarityIndex(it.rarity) * 0.5)) * Math.max(0.25, compat.adaptation)).toFixed(2)),
        rarity: it.rarity,
        sourceType: it.item_type,
        element: spell?.element,
        adaptation: compat.adaptation,
      }];
    })
    .filter(Boolean)
    .slice(0, 8) as any;
}

function enemyLootTier(enemy: CombatEnemy, state: CharacterState): number {
  const text = `${enemy.name || ''} ${enemy.description || ''} ${enemy.realm || ''}`;
  const realmIdx = enemy.realm ? REALMS.findIndex(r => r.id === enemy.realm || r.name === enemy.realm) : -1;
  if (/大乘|渡劫|仙|魔尊|老祖|天君/.test(text) || realmIdx >= 6) return 5;
  if (/化神|元婴|魔君|长老/.test(text) || realmIdx >= 4) return 4;
  if (/金丹|结丹|真人|筑基后期/.test(text) || realmIdx >= 3) return 3;
  if (/筑基|执事|精英/.test(text) || realmIdx >= 2) return 2;
  if (/炼气|修士|邪修|魔修|劫修|散修/.test(text) || realmIdx >= 1) return 1;
  const playerRealmIdx = REALMS.findIndex(r => r.id === state.realm);
  return Math.max(0, Math.min(2, playerRealmIdx));
}


function enemyGearLootProfile(enemy: CombatEnemy, tier: number): { name: string; description: string; itemType: ItemEntry['item_type']; effectTarget: string; ability: ArtifactAbility } {
  const text = `${enemy.name || ''} ${enemy.description || ''}`;
  const title = String(enemy.name || '敌修').replace(/^(蒙面|黑衣|邪修|劫修)/u, '').trim() || '敌修';
  if (/剑|剑修/.test(text)) {
    return { name: '裂鸣剑', description: `从${title}手中夺下的飞剑，剑脊有新裂，仍能嗡鸣伤敌。`, itemType: 'weapon', effectTarget: 'attack', ability: { name: '裂鸣剑气', description: '催动时剑身发出裂鸣，放出一道锋锐剑气。', trigger: 'active', element: 'metal', power: 1.15 + tier * 0.25 } };
  }
  if (/魔|邪|血/.test(text)) {
    return { name: '血纹护符', description: `从${title}身上找到的血纹法器，凶煞未散，祭炼后可护体，也可能扰动心神。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '血纹煞幕', description: '法器自行浮起血色光幕，替主人挡下一波攻势。', trigger: 'auto', element: 'fire', power: 1.1 + tier * 0.2 } };
  }
  if (/水|潮|冰|江|河/.test(text)) {
    return { name: '潮纹护珠', description: `从${title}遗物中取得的水色法珠，内里有潮声回响，尚未在斗法中碎裂。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '潮息水幕', description: '法珠涌出一层潮息水幕，能缓去来袭力道。', trigger: 'auto', element: 'water', power: 1.1 + tier * 0.2 } };
  }
  if (/木|藤|花|草|青/.test(text)) {
    return { name: '青藤护腕', description: `从${title}身侧取下的青藤法器，藤纹尚能随灵机舒展。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '青藤绕身', description: '护腕中生出灵藤虚影，缠绕身周分担攻势。', trigger: 'auto', element: 'wood', power: 1.05 + tier * 0.2 } };
  }
  return { name: '残光护符', description: `从${title}身上搜得的护身法器，虽经斗法震荡，核心灵禁尚可重新祭炼。`, itemType: 'artifact', effectTarget: 'defense', ability: { name: '残光护幕', description: '法器中残存的灵光展开成薄幕，替主人卸去部分攻势。', trigger: 'auto', element: 'none', power: 1 + tier * 0.18 } };
}

function buildEnemyCarriedLoot(enemy: CombatEnemy, state: CharacterState, enemyIndex: number): { items: ItemEntry[]; spiritStones: number } {
  const text = `${enemy.name || ''} ${enemy.description || ''}`;
  const tier = enemyLootTier(enemy, state);
  const baseRarity = clampRarityIndex(Math.max(0, tier - 1));
  const betterRarity = clampRarityIndex(tier);
  const source = `${enemy.name || '敌修'}遗物`;
  const items: ItemEntry[] = [];
  const addItem = (name: string, description: string, item_type: ItemEntry['item_type'], rarity: ItemRarity, effects: any[], suffix: string, technique?: TechniqueProfile) => {
    const item: ItemEntry = { id: makeLootId(`loot_${enemyIndex}_${suffix}`), name, description, item_type, rarity, effects, source };
    if (technique) item.technique = technique;
    items.push(describeArtifactAbilitiesOnItem(item));
  };

  const title = enemy.name || '敌修';
  const isCultivator = /修|道人|魔|邪|劫|散人|真人|老祖|剑|宗|门/.test(text) || tier >= 1;
  const isBeast = /妖|兽|狼|虎|蛟|蛇|蛛|狐|猿|禽|鸟/.test(text);

  if (isCultivator) {
    addItem(
      '储物袋',
      `从${title}身侧搜得的小型储物法器，袋口禁制已散，可并入自身储物之用。`,
      'tool',
      baseRarity,
      [{ target_attribute: 'storageCapacity', operation: 'add', value: Math.max(8, 8 + tier * 10), description: `储物上限+${Math.max(8, 8 + tier * 10)}` }],
      'bag'
    );
    const gear = enemyGearLootProfile(enemy, tier);
    addItem(
      gear.name,
      gear.description,
      gear.itemType,
      betterRarity,
      [{ target_attribute: gear.effectTarget, operation: 'add', value: Math.max(6, 8 + tier * 8), description: gear.effectTarget === 'attack' ? `攻伐+${Math.max(6, 8 + tier * 8)}` : `护身+${Math.max(6, 8 + tier * 8)}` }],
      'gear',
      gear.itemType === 'artifact' ? { kind: 'artifact', artifactAbilities: [gear.ability], traits: [{ name: '随身灵禁', description: '此物本属敌修防身所用，夺得后需重新祭炼才能完全驱使。' }] } : undefined
    );
    addItem(
      tier >= 2 ? '回元丹' : '疗伤散',
      `藏在${title}储物袋中的应急丹药，瓶身尚未碎裂。`,
      'consumable',
      baseRarity,
      [{ target_attribute: tier >= 2 ? 'mp' : 'hp', operation: 'add', value: Math.max(30, 40 + tier * 35), description: tier >= 2 ? `回灵+${Math.max(30, 40 + tier * 35)}` : `疗伤+${Math.max(30, 40 + tier * 35)}` }],
      'pill'
    );
    if (tier >= 2 || /功法|秘术|邪|魔|血/.test(text)) {
      addItem(
        /邪|魔|血/.test(text) ? '残缺血煞诀' : '斗法心得玉简',
        /邪|魔|血/.test(text) ? '邪修随身携带的残缺法诀，凶险却也有可借鉴之处。' : '记有此人多年斗法心得的玉简。',
        'scripture',
        baseRarity,
        [{ target_attribute: 'cultivationExp', operation: 'multiply', value: Number((1.15 + tier * 0.15).toFixed(2)), description: `参悟修行×${Number((1.15 + tier * 0.15).toFixed(2))}` }],
        'scripture'
      );
    }
  } else if (isBeast) {
    addItem('妖兽内丹', `从${title}体内剖出的内丹，灵气未散。`, 'material', betterRarity, [{ target_attribute: 'cultivationExp', operation: 'add', value: Math.max(20, 35 + tier * 25), description: `炼化可增修为+${Math.max(20, 35 + tier * 25)}` }], 'core');
    addItem('妖兽利爪', `${title}遗下的坚硬利爪，可作炼器材料。`, 'material', baseRarity, [{ target_attribute: 'attack', operation: 'add', value: Math.max(3, 4 + tier * 4), description: `炼器攻材+${Math.max(3, 4 + tier * 4)}` }], 'claw');
  } else {
    addItem('残破护符', `战后从${title}身旁拾得，虽有裂纹，灵光尚存。`, 'accessory', baseRarity, [{ target_attribute: 'luck', operation: 'add', value: 1, description: '护身气运+1' }], 'charm');
  }

  const explicitDrops = Array.isArray(enemy.drops) ? enemy.drops : [];
  for (const d of explicitDrops.slice(0, 3)) {
    const rarity = clampRarityIndex(safeRarityIndex(d.rarity));
    addItem(String(d.name || '遗落材料'), `从${title}身上搜得，未在斗法中毁去。`, 'material', rarity, [], `drop_${items.length}`);
  }

  const explicitLoot = Array.isArray(enemy.lootItems) ? enemy.lootItems : [];
  const safeExplicitLoot = explicitLoot.slice(0, 6).map((it, idx) => ({
    ...it,
    id: it.id || makeLootId(`enemy_${enemyIndex}_${idx}`),
    source: it.source || source,
  }));

  const stonesBase = tier <= 0 ? 2 : 12 * Math.pow(2, tier - 1);
  const spiritStones = Math.max(0, Math.floor(Number(enemy.lootSpiritStones ?? 0) || 0))
    + (isCultivator ? Math.max(5, Math.floor(stonesBase + Math.random() * stonesBase)) : 0);

  return { items: [...safeExplicitLoot, ...items], spiritStones };
}

export function buildCombatVictorySpoils(state: CharacterState, session: CombatSession, aiLoot?: CombatLootAIOutcome | null): { items: ItemEntry[]; spiritStones: number } {
  if (!session || session.status !== 'victory') return { items: [], spiritStones: 0 };
  const allItems: ItemEntry[] = [];
  let spiritStones = 0;

  // AI 主路径：战后由 AI 根据敌人身份/境界/携带资源生成战利品，引擎只去重、补 id、clamp 灵石。
  if (aiLoot && (Array.isArray(aiLoot.items) || Number(aiLoot.spiritStones) > 0)) {
    allItems.push(...(aiLoot.items || []).map((it, idx) => ({ ...it, name: stripLootOwnerPrefix(it.name), id: it.id || makeLootId(`ai_loot_${idx}`), source: it.source || '战利所得' })));
    spiritStones += Math.max(0, Math.floor(Number(aiLoot.spiritStones || 0)));
  } else {
    // AI 失败时才回退旧的敌人关键词模板。
    const enemies = session.enemies || [];
    enemies.forEach((enemy, idx) => {
      const loot = buildEnemyCarriedLoot(enemy, state, idx);
      allItems.push(...loot.items);
      spiritStones += loot.spiritStones;
    });
  }

  const triggerDrops = Array.isArray(session.victoryDrops) ? session.victoryDrops : [];
  allItems.push(...triggerDrops.map((it, idx) => ({ ...it, id: it.id || makeLootId(`drop_${idx}`), source: it.source || '战利所得' })));

  const seen = new Set<string>();
  const deduped = allItems.filter(item => {
    item.name = sanitizeLootName(stripLootOwnerPrefix(item.name));
    const key = `${item.name}|${item.item_type}|${item.rarity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(4, 6 + (session.enemies || []).length * 3));
  return { items: deduped, spiritStones };
}

// 装备物品（从 inventory 移到 equipped 数组末尾，不限制同类型数量）
// 不再替换同槽位物品——玩家可戴多个戒指、脖挂一串储物戒指等，由 AI 在 equipNote 中描述位置
export function equipItem(state: CharacterState, itemId: string): ItemActionResult {
  const idx = state.inventory.findIndex(it => it.id === itemId);
  if (idx < 0) return emptyItemActionResult(state, false, '物品不在储物中');
  const item = state.inventory[idx];
  const slot = itemToSlot(item.item_type);
  if (!slot) return emptyItemActionResult(state, false, '此物不可装备');
  if (isStorageBag(item)) return emptyItemActionResult(state, false, '储物袋只能随身携带，不可装备');

  const equippedItem: ItemEntry = {
    ...item,
    equipNote: item.equipNote || DEFAULT_EQUIP_NOTE[slot] || '装备',
  };
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
    equipped: [...(state.equipped || []), equippedItem],
  };
  const resolved = resolveItemEffects(next, equippedItem, 1, `装备 ${equippedItem.name}`);
  next = recalcCultivationMultiplier(resolved.state);
  return { ...resolved, state: next, ok: true, item: equippedItem };
}

export function unequipItem(state: CharacterState, itemId: string): ItemActionResult {
  const item = (state.equipped || []).find(it => it.id === itemId);
  if (!item) return emptyItemActionResult(state, false, '此物尚未装备');
  let next: CharacterState = {
    ...state,
    equipped: (state.equipped || []).filter(it => it.id !== itemId),
    inventory: [...state.inventory, item],
  };
  const resolved = resolveItemEffects(next, item, -1, `卸下 ${item.name}`);
  next = recalcCultivationMultiplier(resolved.state);
  return { ...resolved, state: next, ok: true, item };
}

export function consumeItem(state: CharacterState, itemId: string): ItemActionResult {
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return emptyItemActionResult(state, false, '物品不在储物中');
  if (item.item_type !== 'consumable') return emptyItemActionResult(state, false, '只有丹药等消耗品可直接使用');
  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(it => it.id !== itemId),
  };
  const resolved = resolveItemEffects(next, item, 1, `使用 ${item.name}`);
  next = normalizeCultivationState(resolved.state);
  return { ...resolved, state: next, ok: true, item };
}

export function removeItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { removed: ItemEntry[] } {
  if (!ids.length) return { state, removed: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const removed: ItemEntry[] = [];
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  // 从 inventory 移除
  const keptInv: ItemEntry[] = [];
  for (const it of state.inventory) {
    if (idSet.has(it.id)) removed.push(it);
    else keptInv.push(it);
  }
  next.inventory = keptInv;
  // 从 equipped 数组移除（并反向应用效果）
  if (next.equipped && next.equipped.length) {
    const keptEq: ItemEntry[] = [];
    for (const it of next.equipped) {
      if (idSet.has(it.id)) {
        removed.push(it);
        collect(resolveItemEffects(next, it, -1, `移除装备 ${it.name}`));
      } else {
        keptEq.push(it);
      }
    }
    next.equipped = keptEq;
    next = recalcCultivationMultiplier(next);
  }
  // 若移除的是储物袋，反向扣减 storageCapacity
  for (const it of removed) {
    if (isStorageBag(it)) {
      for (const eff of it.effects || []) {
        if (eff.target_attribute === 'storageCapacity' && eff.operation === 'add') {
          next.storageCapacity = Math.max(5, next.storageCapacity - eff.value);
        }
      }
    }
  }
  next = normalizeCultivationState(next);
  return { state: next, removed, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// AI 联动：按 id 将物品从 inventory 移到 equipped（AI 可在 interfere 中装备物品，并设置 equipNote）
export function equipItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { equipped: ItemEntry[] } {
  if (!ids.length) return { state, equipped: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  const toEquip: ItemEntry[] = [];
  const keptInv: ItemEntry[] = [];
  const currentRealmIdx = REALMS.findIndex(r => r.id === state.realm);
  for (const it of state.inventory) {
    if (idSet.has(it.id)) {
      const minRealm = it.technique?.requirements?.minRealm;
      if (minRealm) {
        const minRealmIdx = REALMS.findIndex(r => r.id === minRealm);
        if (minRealmIdx >= 0 && currentRealmIdx < minRealmIdx) {
          effectResolveWarnings.push(`\u5883\u754c\u4e0d\u8db3\uff1a\u9700${REALMS[minRealmIdx].name}`);
          keptInv.push(it);
          continue;
        }
      }
      const slot = itemToSlot(it.item_type);
      if (slot && !isStorageBag(it)) {
        toEquip.push({ ...it, equipNote: it.equipNote || DEFAULT_EQUIP_NOTE[slot] || '\u88c5\u5907' });
      } else {
        keptInv.push(it); // Keep non-equippable item in inventory
      }
    } else {
      keptInv.push(it);
    }
  }
  if (!toEquip.length) return { state: next, equipped: [], appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
  next.inventory = keptInv;
  next.equipped = [...(next.equipped || []), ...toEquip];
  for (const it of toEquip) collect(resolveItemEffects(next, it, 1, `装备 ${it.name}`));
  next = recalcCultivationMultiplier(next);
  return { state: next, equipped: toEquip, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// AI 联动：按 id 将物品从 equipped 移回 inventory（AI 可在 interfere 中卸下物品）
export function unequipItemsByIds(state: CharacterState, ids: string[]): ItemEffectResolveResult & { unequipped: ItemEntry[] } {
  if (!ids.length) return { state, unequipped: [], appliedChanges: [], rejectedChanges: [], effectResolveTrace: [], effectResolveWarnings: [] };
  const idSet = new Set(ids);
  let next = { ...state };
  const appliedChanges: AttributeChange[] = [];
  const rejectedChanges: AttributeChange[] = [];
  const effectResolveTrace: EffectResolveTrace[] = [];
  const effectResolveWarnings: string[] = [];
  const collect = (resolved: ItemEffectResolveResult) => {
    appliedChanges.push(...resolved.appliedChanges);
    rejectedChanges.push(...resolved.rejectedChanges);
    effectResolveTrace.push(...resolved.effectResolveTrace);
    effectResolveWarnings.push(...resolved.effectResolveWarnings);
    next = resolved.state;
  };
  const toUnequip: ItemEntry[] = [];
  const keptEq: ItemEntry[] = [];
  for (const it of next.equipped || []) {
    if (idSet.has(it.id)) toUnequip.push(it);
    else keptEq.push(it);
  }
  if (!toUnequip.length) return { state: next, unequipped: [], appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
  next.equipped = keptEq;
  for (const it of toUnequip) collect(resolveItemEffects(next, it, -1, `卸下 ${it.name}`));
  next = recalcCultivationMultiplier(next);
  next.inventory = [...next.inventory, ...toUnequip];
  return { state: next, unequipped: toUnequip, appliedChanges, rejectedChanges, effectResolveTrace, effectResolveWarnings };
}

// ==================== 炼丹炉系统 ====================

// 丹药命名表：按元素 + rarity
/**
 * 这批东西塞不塞得下——返回会被丢掉的件数（储物袋自带扩容，永不被丢）。
 *
 * 2026-08-31：addItems 装不下时只 console.warn 一句就把东西扔了，调用方毫不知情。
 * 拍场那条路尤其难看：灵石先扣，再调 addItems，容量满了物品无声蒸发，
 * 玩家付了钱两手空空，连一句提示都没有。凡是"先付后取"的地方，
 * 都该拿这个函数在扣款之前问一句。
 */
export function countItemsThatWontFit(state: CharacterState, items: ItemEntry[]): number {
  if (!items.length) return 0;
  const normalized = items.map(normalizeCultivationBearingItem);
  let bagBoost = 0;
  for (const it of normalized) {
    if (isStorageBag(it)) {
      for (const eff of it.effects || []) {
        if (eff.target_attribute === 'storageCapacity' && eff.operation === 'add' && eff.value > 0) {
          bagBoost += eff.value;
        }
      }
    }
  }
  const projectedCapacity = (state.storageCapacity || DEFAULT_STORAGE_CAPACITY) + bagBoost;
  const availableSlots = Math.max(0, projectedCapacity - state.inventory.length);
  const bags = normalized.filter(isStorageBag);
  const nonBags = normalized.filter(it => !isStorageBag(it));
  const kept = nonBags.slice(0, Math.max(0, availableSlots - bags.length));
  return nonBags.length - kept.length;
}

export function addItems(state: CharacterState, items: ItemEntry[]): CharacterState {
  if (!items.length) return state;
  // 规整化物品：确保储物袋、功法、玉简/心得等可被后续修炼速度归算识别。
  const normalized = items.map(normalizeCultivationBearingItem);

  // Task 22: 计算加入后的总容量（含本批储物袋扩容），按容量限制裁剪
  let bagBoost = 0;
  for (const it of normalized) {
    if (isStorageBag(it)) {
      for (const eff of it.effects || []) {
        if (eff.target_attribute === 'storageCapacity' && eff.operation === 'add' && eff.value > 0) {
          bagBoost += eff.value;
        }
      }
    }
  }
  const projectedCapacity = (state.storageCapacity || DEFAULT_STORAGE_CAPACITY) + bagBoost;
  const currentCount = state.inventory.length;
  const availableSlots = Math.max(0, projectedCapacity - currentCount);
  // 储物袋优先放入（因其扩容），其余按顺序填满
  const bags = normalized.filter(isStorageBag);
  const nonBags = normalized.filter(it => !isStorageBag(it));
  const keptNonBags = nonBags.slice(0, Math.max(0, availableSlots - bags.length));
  const droppedCount = nonBags.length - keptNonBags.length;
  if (droppedCount > 0) {
    console.warn(`[Task 22] Storage full (${currentCount}/${state.storageCapacity}): dropping ${droppedCount} items: ${nonBags.slice(keptNonBags.length).map(d => d.name).join(', ')}`);
  }
  const finalItems = [...bags, ...keptNonBags];
  if (!finalItems.length) return state;

  let next = { ...state, inventory: [...state.inventory, ...finalItems] };
  // 储物袋获得即扩容
  if (bagBoost > 0) next.storageCapacity = projectedCapacity;
  return next;
}

// ==================== α-4 功法三段（经/诀/神通）====================

// 阶段阈值表（闭区间右开；与 InventoryPanel chip 颜色映射保持一致）
// 0..33 = practiced(初习) / 34..66 = awakened(觉意) / 67..100 = transcendent(神通 / 大成)
export function getTalismanType(item: ItemEntry): TalismanType | null {
  for (const eff of item.effects || []) {
    if (eff.target_attribute === 'talisman_attack') return 'talisman_attack';
    if (eff.target_attribute === 'talisman_defense') return 'talisman_defense';
    if (eff.target_attribute === 'talisman_heal') return 'talisman_heal';
    if (eff.target_attribute === 'talisman_escape') return 'talisman_escape';
    if (eff.target_attribute === 'talisman_stun') return 'talisman_stun';
  }
  return null;
}

// 判断物品是否为普通丹药（非符箓的 consumable）
export function isPillItem(item: ItemEntry): boolean {
  if (item.item_type !== 'consumable') return false;
  return getTalismanType(item) === null;
}

// 获取战斗中可用的符箓列表
export function getAvailableTalismans(state: CharacterState): ItemEntry[] {
  return (state.inventory || []).filter(it => getTalismanType(it) !== null);
}

