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
  addItems,
} from './items';
import {
  RARITY_ORDER,
  WorkerDCharacter,
  rarityIndex,
} from './shared';

const PILL_NAMES_BY_ELEMENT: Record<string, { common: string[]; uncommon: string[]; rare: string[]; epic: string[]; legendary: string[] }> = {
  fire: {
    common: ['赤焰散', '火元丸'],
    uncommon: ['烈火丹', '赤阳丹'],
    rare: ['炎阳真丹', '焚天丹'],
    epic: ['九转火元丹', '太阳真火丹'],
    legendary: ['涅槃真丹', '三昧真火丹'],
  },
  water: {
    common: ['寒水散', '水元丸'],
    uncommon: ['玄冰丹', '凝露丹'],
    rare: ['玄冰真丹', '北海神丹'],
    epic: ['九转玄冰丹', '太阴真水丹'],
    legendary: ['混沌玄冰丹', '天河真水丹'],
  },
  wood: {
    common: ['青木散', '木元丸'],
    uncommon: ['生机丹', '回春丹'],
    rare: ['青木真丹', '造化丹'],
    epic: ['九转青木丹', '长生丹'],
    legendary: ['造化真丹', '万木朝宗丹'],
  },
  metal: {
    common: ['锐金散', '金元丸'],
    uncommon: ['庚金丹', '锋锐丹'],
    rare: ['庚金真丹', '白虎丹'],
    epic: ['九转庚金丹', '太白真金丹'],
    legendary: ['诛仙剑意丹', '白虎真形丹'],
  },
  earth: {
    common: ['厚土散', '土元丸'],
    uncommon: ['戊土丹', '磐石丹'],
    rare: ['戊土真丹', '黄中丹'],
    epic: ['九转戊土丹', '后土真丹'],
    legendary: ['玄黄造化丹', '大地之心丹'],
  },
};

// 丹药效果表：按元素 + rarity
function pillEffects(element: string, rarity: string, potencyMultiplier = 1): { target_attribute: string; operation: string; value: number; description: string }[] {
  const powerByRarity: Record<string, number> = { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 250, mythic: 500 };
  const power = (powerByRarity[rarity] || 15) * Math.max(0.6, Math.min(1.8, potencyMultiplier));
  const effByElement: Record<string, { target: string; desc: string }[]> = {
    fire: [{ target: 'attack', desc: '火性丹力淬炼经脉，攻伐更盛' }, { target: 'maxHp', desc: '火候入体，气血渐旺' }],
    water: [{ target: 'maxMp', desc: '水性丹力润养灵海' }, { target: 'mp', desc: '水元回流，灵力复苏' }],
    wood: [{ target: 'hp', desc: '木气生发，血脉回春' }, { target: 'cultivationExp', desc: '木性灵机推动修为' }],
    metal: [{ target: 'attack', desc: '金性丹力砥砺锋芒' }, { target: 'speed', desc: '金气行脉，身法轻捷' }],
    earth: [{ target: 'defense', desc: '土性丹力沉稳护身' }, { target: 'maxHp', desc: '土元厚重，气血根基增长' }],
  };
  const effs = effByElement[element] || effByElement.wood;
  return effs.map(e => ({
    target_attribute: e.target,
    operation: 'add',
    value: Math.round(power * 0.8),
    description: e.desc,
  }));
}

// 从材料的 effects 中提取主要元素倾向
function extractMaterialElement(item: ItemEntry): string | null {
  for (const eff of item.effects || []) {
    if (eff.target_attribute === 'elementFire') return 'fire';
    if (eff.target_attribute === 'elementWater') return 'water';
    if (eff.target_attribute === 'elementWood') return 'wood';
    if (eff.target_attribute === 'elementMetal') return 'metal';
    if (eff.target_attribute === 'elementEarth') return 'earth';
  }
  return null;
}

interface AlchemyHarmony {
  successBonus: number;
  rarityBoost: number;
  potencyMultiplier: number;
  elementScores: Record<string, number>;
  tags: string[];
}

function computeAlchemyHarmony(materials: ItemEntry[]): AlchemyHarmony {
  const elementScores: Record<string, number> = {};
  const tags = new Set<string>();
  let potency = 1;
  for (const material of materials) {
    const rarity = Math.max(0, rarityIndex(material.rarity));
    potency += rarity * 0.06;
    for (const effect of material.effects || []) {
      const target = effect.target_attribute;
      const value = Math.max(1, Math.abs(Number(effect.value) || 1));
      if (target === 'elementFire') elementScores.fire = (elementScores.fire || 0) + value;
      if (target === 'elementWater') elementScores.water = (elementScores.water || 0) + value;
      if (target === 'elementWood') elementScores.wood = (elementScores.wood || 0) + value;
      if (target === 'elementMetal') elementScores.metal = (elementScores.metal || 0) + value;
      if (target === 'elementEarth') elementScores.earth = (elementScores.earth || 0) + value;
      if (target === 'cultivationExp') tags.add('cultivation');
      if (target === 'hp' || target === 'maxHp') tags.add('vitality');
      if (target === 'mp' || target === 'maxMp') tags.add('spirit');
    }
  }
  const distinctElements = Object.keys(elementScores).length;
  const dominant = Math.max(0, ...Object.values(elementScores));
  const conflictPenalty = Math.max(0, distinctElements - 2) * 4;
  const successBonus = Math.min(18, dominant * 0.8 + materials.length * 2) - conflictPenalty;
  const rarityBoost = dominant >= 12 && distinctElements <= 2 ? 1 : 0;
  return { successBonus, rarityBoost, potencyMultiplier: potency, elementScores, tags: Array.from(tags) };
}

export interface AlchemyResult {
  state: CharacterState;
  ok: boolean;
  error?: string;
  success: boolean;
  narrative: string;
  product?: ItemEntry;
  consumedMaterials: ItemEntry[];
  spiritStoneCost: number;
  successRate: number;
  contentRegistryTrace: ValidationTrace[];
  contentRegistryWarnings: string[];
  mainElement?: string;
}

function failedAlchemyResult(state: CharacterState, error: string): AlchemyResult {
  return { state, ok: false, error, success: false, narrative: '', consumedMaterials: [], spiritStoneCost: 0, successRate: 0, contentRegistryTrace: [], contentRegistryWarnings: [] };
}

// 炼丹数值上限：按品阶限制 AI 给出的丹效数值，防止数值膨胀（引擎硬约束）
const ALCHEMY_VALUE_CAP_BY_RARITY: Record<string, number> = { common: 30, uncommon: 80, rare: 180, epic: 400, legendary: 900, mythic: 2000 };
const ALCHEMY_ALLOWED_TARGETS = new Set(['attack', 'defense', 'speed', 'luck', 'comprehension', 'hp', 'maxHp', 'mp', 'maxMp', 'cultivationExp']);
function clampAlchemyEffects(effects: Array<{ target_attribute: string; operation: string; value: number; description: string }>, rarity: string): Array<{ target_attribute: string; operation: string; value: number; description: string }> {
  const cap = ALCHEMY_VALUE_CAP_BY_RARITY[rarity] || 30;
  const out: Array<{ target_attribute: string; operation: string; value: number; description: string }> = [];
  for (const e of (effects || []).slice(0, 3)) {
    if (!ALCHEMY_ALLOWED_TARGETS.has(e.target_attribute)) continue;
    if (e.operation === 'multiply') {
      const v = Math.max(1.02, Math.min(3.5, Number(e.value) || 1));
      out.push({ target_attribute: e.target_attribute, operation: 'multiply', value: Number(v.toFixed(2)), description: e.description });
    } else {
      const v = Math.max(-cap, Math.min(cap, Math.round(Number(e.value) || 0)));
      if (v === 0) continue;
      out.push({ target_attribute: e.target_attribute, operation: 'add', value: v, description: e.description });
    }
  }
  return out;
}

export function alchemy(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number = 10,
  aiOutcome?: AlchemyAIOutcome,
): AlchemyResult {
  if (materialIds.length < 2 || materialIds.length > 3) return failedAlchemyResult(state, '须选 2-3 味材料入炉');
  const uniqueMaterialIds = Array.from(new Set(materialIds));
  if (uniqueMaterialIds.length !== materialIds.length) return failedAlchemyResult(state, '同一份材料不能重复入炉');

  const contentRegistryTrace: ValidationTrace[] = [];
  const contentRegistryWarnings: string[] = [];
  const materials: ItemEntry[] = [];
  for (const id of uniqueMaterialIds) {
    const material = state.inventory.find(item => item.id === id);
    if (!material) return failedAlchemyResult(state, '材料不在储物中');
    materials.push(material);
  }
  if (state.spiritStones < spiritStoneCost) return failedAlchemyResult(state, `灵石不足，需 ${spiritStoneCost} 灵石`);

  const comprehensionBonus = state.comprehension * 0.4;
  const rootBonus = (state.rootMultiplier || 0) * 5;
  const avgRarityIdx = materials.reduce((sum, material) => sum + Math.max(0, rarityIndex(material.rarity)), 0) / materials.length;
  const materialHarmony = computeAlchemyHarmony(materials);
  const rarityBonus = avgRarityIdx * 8;
  const costBonus = Math.min(12, Math.max(0, spiritStoneCost - 10) * 0.6);
  const countPenalty = (materials.length - 2) * 5;
  let successRate = 30 + comprehensionBonus + rootBonus + rarityBonus + materialHarmony.successBonus + costBonus - countPenalty;
  successRate = Math.max(10, Math.min(95, successRate));

  let next: CharacterState = {
    ...state,
    inventory: state.inventory.filter(item => !uniqueMaterialIds.includes(item.id)),
    spiritStones: state.spiritStones - spiritStoneCost,
  };

  // ===== AI 主路径：若提供 AI 产出，引擎只做校验 / clamp / 落库，不再走写死公式 =====
  if (aiOutcome) {
    if (aiOutcome.success) {
      let effects = clampAlchemyEffects(aiOutcome.effects || [], aiOutcome.rarity);
      if (!effects.length) {
        // AI 未给出有效效果时，用引擎元素表兜底，保证丹药有作用
        effects = pillEffects(aiOutcome.mainElement === 'none' ? 'wood' : aiOutcome.mainElement, aiOutcome.rarity, materialHarmony.potencyMultiplier) as any;
      }
      const rawPill: ItemEntry = {
        id: `item_pil_${aiOutcome.mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: aiOutcome.pillName,
        description: aiOutcome.pillDescription || '开炉炼成的丹药。',
        item_type: 'consumable',
        rarity: aiOutcome.rarity as any,
        effects: effects as any,
        source: '炼丹炉成丹',
      };
      const registered = registerItem(rawPill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
      contentRegistryTrace.push(...registered.trace);
      contentRegistryWarnings.push(...registered.warnings);
      const pill = registered.content || rawPill;
      next = addItems(next, [pill]);
      next = normalizeCultivationState(next);
      return {
        state: next, ok: true, success: true,
        narrative: aiOutcome.narrative || `炉火三转，一枚${aiOutcome.pillName}跃然而出。`,
        product: pill, consumedMaterials: materials, spiritStoneCost, successRate,
        contentRegistryTrace, contentRegistryWarnings, mainElement: aiOutcome.mainElement,
      };
    }
    // AI 判定失败：炸炉 / 异变 / 废丹，按 AI 叙事产出一枚低阶产物
    const failEffects = clampAlchemyEffects(aiOutcome.effects || [], 'common');
    const rawFail: ItemEntry = {
      id: `item_pil_fail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: (aiOutcome.pillName && aiOutcome.pillName !== '无名丹') ? aiOutcome.pillName : '焦丹',
      description: aiOutcome.pillDescription || '炉火失衡后凝成的残丹，药力驳杂。',
      item_type: 'consumable',
      rarity: 'common',
      effects: (failEffects.length ? failEffects : [{ target_attribute: 'hp', operation: 'add', value: 5, description: '残丹余性，略复气血' }]) as any,
      source: '炼丹失手所得',
    };
    const registeredFail = registerItem(rawFail, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
    contentRegistryTrace.push(...registeredFail.trace);
    contentRegistryWarnings.push(...registeredFail.warnings);
    const failPill = registeredFail.content || rawFail;
    next = addItems(next, [failPill]);
    next = normalizeCultivationState(next);
    const failNarr = aiOutcome.narrative || `炉中火候骤乱，${materials.map(m => m.name).join('、')}的药性未能相融。`;
    return {
      state: next, ok: true, success: false,
      narrative: aiOutcome.accident ? `${failNarr}（${aiOutcome.accident}）` : failNarr,
      product: failPill, consumedMaterials: materials, spiritStoneCost, successRate,
      contentRegistryTrace, contentRegistryWarnings, mainElement: 'waste',
    };
  }

  const roll = Math.random() * 100;
  const success = roll < successRate;
  if (!success) {
    const rawWastePill: ItemEntry = {
      id: `item_pil_waste_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: '焦丹',
      description: '炉火失衡后凝成的焦黑丹丸，药力微弱，却仍留有一线温养之效。',
      item_type: 'consumable',
      rarity: 'common',
      effects: [{ target_attribute: 'hp', operation: 'add', value: 5, description: '焦丹残余药性，略复气血' }],
      source: '炼丹失手所得',
    };
    const registered = registerItem(rawWastePill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
    contentRegistryTrace.push(...registered.trace);
    contentRegistryWarnings.push(...registered.warnings);
    const wastePill = registered.content || rawWastePill;
    next = addItems(next, [wastePill]);
    next = normalizeCultivationState(next);
    return {
      state: next,
      ok: true,
      success: false,
      narrative: `炉中火候一偏，${materials.map(material => material.name).join('、')}的灵性未能相融，丹烟散尽后只余一枚焦丹。`,
      product: wastePill,
      consumedMaterials: materials,
      spiritStoneCost,
      successRate,
      contentRegistryTrace,
      contentRegistryWarnings,
      mainElement: 'waste',
    };
  }

  const elementCounts: Record<string, number> = { ...materialHarmony.elementScores };
  for (const material of materials) {
    const element = extractMaterialElement(material);
    if (element) elementCounts[element] = (elementCounts[element] || 0) + 1;
  }
  let mainElement = 'wood';
  let maxCount = 0;
  for (const [element, count] of Object.entries(elementCounts)) {
    if (count > maxCount) { maxCount = count; mainElement = element; }
  }
  if (maxCount === 0) mainElement = 'wood';

  const avgIdx = Math.round(avgRarityIdx);
  const drift = Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  const pillRarityIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, avgIdx + drift + materialHarmony.rarityBoost));
  const pillRarity = RARITY_ORDER[pillRarityIdx];
  const namePool = PILL_NAMES_BY_ELEMENT[mainElement]?.[pillRarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'];
  const pillName = namePool?.[Math.floor(Math.random() * namePool.length)] || `${mainElement}元丹`;
  const effects = pillEffects(mainElement, pillRarity, materialHarmony.potencyMultiplier) as any;
  const elementZh = mainElement === 'fire' ? '火' : mainElement === 'water' ? '水' : mainElement === 'wood' ? '木' : mainElement === 'metal' ? '金' : '土';
  const rarityZh: Record<string, string> = { common: '下品', uncommon: '中品', rare: '上品', epic: '地品', legendary: '天品', mythic: '玄品' };
  const rawPill: ItemEntry = {
    id: `item_pil_${mainElement}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: pillName,
    description: `以${materials.map(material => material.name).join('、')}炼成的${rarityZh[pillRarity] || ''}丹药，丹纹中蕴着${elementZh}行灵机。`,
    item_type: 'consumable',
    rarity: pillRarity as any,
    effects,
    source: '炼丹炉成丹',
  };
  const registered = registerItem(rawPill, { source: 'alchemy', existingIds: next.inventory.map(item => item.id) });
  contentRegistryTrace.push(...registered.trace);
  contentRegistryWarnings.push(...registered.warnings);
  const pill = registered.content || rawPill;
  next = addItems(next, [pill]);
  next = normalizeCultivationState(next);

  return {
    state: next,
    ok: true,
    success: true,
    narrative: `炉火三转，${elementZh}行灵机在丹室中凝成细密丹纹。你稳住炉息，开炉时一枚${rarityZh[pillRarity] || ''}丹药跃然而出，正是${pillName}。`,
    product: pill,
    consumedMaterials: materials,
    spiritStoneCost,
    successRate,
    contentRegistryTrace,
    contentRegistryWarnings,
    mainElement,
  };
}

// 炼丹前置参考：在不消耗材料的前提下，预算成功率 / 建议品阶 / 主导元素，供 AI 参考
export function computeAlchemyHints(
  state: CharacterState,
  materialIds: string[],
  spiritStoneCost: number,
): { ok: boolean; error?: string; materials?: ItemEntry[]; baseSuccessRate?: number; suggestedRarity?: string; dominantElement?: string } {
  const uniq = Array.from(new Set(materialIds));
  if (uniq.length < 2 || uniq.length > 3) return { ok: false, error: '须选 2-3 味材料入炉' };
  const materials: ItemEntry[] = [];
  for (const id of uniq) {
    const m = state.inventory.find(it => it.id === id);
    if (!m) return { ok: false, error: '材料不在储物中' };
    materials.push(m);
  }
  const comprehensionBonus = state.comprehension * 0.4;
  const rootBonus = (state.rootMultiplier || 0) * 5;
  const avgRarityIdx = materials.reduce((s, m) => s + Math.max(0, rarityIndex(m.rarity)), 0) / materials.length;
  const harmony = computeAlchemyHarmony(materials);
  const rarityBonus = avgRarityIdx * 8;
  const costBonus = Math.min(12, Math.max(0, spiritStoneCost - 10) * 0.6);
  const countPenalty = (materials.length - 2) * 5;
  let rate = 30 + comprehensionBonus + rootBonus + rarityBonus + harmony.successBonus + costBonus - countPenalty;
  rate = Math.max(10, Math.min(95, rate));
  const suggestedIdx = Math.max(0, Math.min(RARITY_ORDER.length - 1, Math.round(avgRarityIdx) + harmony.rarityBoost));
  const dom = Object.entries(harmony.elementScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  return { ok: true, materials, baseSuccessRate: rate, suggestedRarity: RARITY_ORDER[suggestedIdx], dominantElement: dom };
}

// ==================== 突破处理 ====================

export function derivePillEffectiveness(
  pill: { id: string; name: string; quality?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'; tier?: number; expGain?: number; hpRestore?: number; mpRestore?: number; effects?: any[]; isPill?: boolean },
  character: CharacterState
): PillEffectiveness {
  const quality = pill.quality ?? 'common';
  const tier = pill.tier ?? 1;
  const qualityMul: Record<string, number> = {
    common: 0.6, uncommon: 0.8, rare: 1.0, epic: 1.4, legendary: 1.8, mythic: 2.4,
  };
  const mul = qualityMul[quality] ?? 1.0;

  // 角色境界越高，对高阶丹药利用率越高
  const realmLevel = (character as any).realmLevel ?? 0;
  const realmFactor = 1 + Math.min(realmLevel, 9) * 0.05;

  const baseBoost = pill.expGain ?? 0;
  const hpBoost = pill.hpRestore ?? 0;
  const mpBoost = pill.mpRestore ?? 0;

  // 副作用概率：高阶丹药 + 低境界服用 = 高副作用概率
  const realmGap = Math.max(0, tier - realmLevel);
  const sideEffectChance = Math.min(0.85, 0.05 + realmGap * 0.12 + (tier >= 3 ? 0.1 : 0));
  const sideEffectSeverity = Math.min(5, 1 + Math.floor(tier / 2) + Math.floor(realmGap / 2));

  // 按 tier 决定可能触发的副作用种类
  const possible: PillSideEffect[] = [];
  if (tier >= 1) possible.push('toxicity');
  if (tier >= 2) possible.push('qi-turbulence');
  if (tier >= 3) possible.push('cultivation-deviation');
  if (tier >= 4) possible.push('karma');

  return {
    pillId: pill.id,
    pillName: pill.name,
    boost: {
      cultivationExp: Math.round(baseBoost * mul * realmFactor),
      hp: Math.round(hpBoost * mul),
      mp: Math.round(mpBoost * mul),
      durationTurns: 3,
    },
    sideEffectChance,
    sideEffectSeverity,
    possibleSideEffects: possible,
  };
}

/**
 * 根据副作用评估结果，结算对角色状态的具体影响。
 * 返回的属性变更与状态变更应由调用方应用到 CharacterState。
 */
export function resolvePillSideEffects(
  pill: { id: string; name: string; tier?: number; quality?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' },
  character: CharacterState,
  rand: number = Math.random()
): PillSideEffectResolution {
  const eff = derivePillEffectiveness(pill, character);
  const triggered = rand < eff.sideEffectChance;
  if (!triggered) {
    return {
      pillId: pill.id,
      triggered: false,
      severity: 0,
      attributeChanges: [],
      statusChanges: [],
    };
  }
  // 选取第一个副作用（按出现概率最高的）
  const side = eff.possibleSideEffects[0] ?? 'toxicity';
  const sev = eff.sideEffectSeverity;

  const changes: AttributeChange[] = [];
  const statuses: StatusEntry[] = [];

  switch (side) {
    case 'toxicity':
      changes.push({ attribute: 'hp', delta: -sev * 8, reason: `pill-side-effect:${pill.id}` });
      statuses.push({
        id: `pill-toxicity-${pill.id}`,
        name: '丹毒淤积',
        description: `服用${pill.name}后丹毒未散`,
        category: 'debuff',
        rarity: 'common',
        duration: 30,
        source: `服用${pill.name}后丹毒未散`,
        effects: [{ target_attribute: 'cultivation_rate', operation: 'multiply', value: 1 - sev * 0.05, description: 'cultivation rate penalty from pill toxicity' }],
      });
      break;
    case 'cultivation-deviation':
      changes.push({ attribute: 'hp', delta: -sev * 12, reason: `pill-deviation:${pill.id}` });
      changes.push({ attribute: 'cultivationExp', delta: -sev * 20, reason: `pill-deviation:${pill.id}` });
      statuses.push({
        id: `pill-deviation-${pill.id}`,
        name: '走火入魔',
        description: `服用${pill.name}后气机逆行`,
        category: 'debuff',
        rarity: 'uncommon',
        duration: 15,
        source: `服用${pill.name}后气机逆行`,
        effects: [],
      });
      break;
    case 'karma':
      statuses.push({
        id: `pill-karma-${pill.id}`,
        name: '因果牵缠',
        description: `${pill.name}引来天道注视`,
        category: 'special',
        rarity: 'rare',
        duration: 60,
        source: `${pill.name}引来天道注视`,
        effects: [],
      });
      break;
    case 'qi-turbulence':
      statuses.push({
        id: `pill-qi-turbulence-${pill.id}`,
        name: '气机紊乱',
        description: `服用${pill.name}后经脉不稳`,
        category: 'debuff',
        rarity: 'common',
        duration: 20,
        source: `服用${pill.name}后经脉不稳`,
        effects: [{ target_attribute: 'cultivation_rate', operation: 'multiply', value: 1 - sev * 0.08, description: 'cultivation rate penalty from qi turbulence' }],
      });
      break;
  }

  return {
    pillId: pill.id,
    triggered: true,
    sideEffect: side,
    severity: sev,
    attributeChanges: changes,
    statusChanges: statuses,
    narrativeHint: `服用${pill.name}后感到${
      side === 'toxicity' ? '腹内灼热、丹毒游走' :
      side === 'cultivation-deviation' ? '经脉一阵剧痛、气血翻涌' :
      side === 'karma' ? '冥冥中似有注视落下' :
      '气息凌乱、难以凝神'
    }。`,
  };
}

// ---------------- AI-87: Formation Drawing Process ----------------

export function deriveRecipeUnlock(recipe: PillRecipe, character: CharacterState): { unlocked: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!recipe) return { unlocked: false, missing: ['no_recipe'] };
  // 境界下限
  const realmOrder: Realm[] = ['mortal','qi_refining','foundation','golden_core','nascent_soul','soul_formation','tribulation','ascension'];
  const curIdx = realmOrder.indexOf(character.realm);
  if (curIdx < recipe.minRealmIdx) missing.push(`min_realm:${recipe.minRealmIdx}`);
  // 材料齐备性：character.inventory 中按 item id 统计
  const inv = Array.isArray(character.inventory) ? character.inventory : [];
  for (const matId of recipe.requiredMaterials) {
    const has = inv.some(i => i && i.id === matId);
    if (!has) missing.push(`material:${matId}`);
  }
  return { unlocked: missing.length === 0, missing };
}

/**
 * 给定丹方 + 材料齐备性，模拟炼丹结果：
 * - 成功 → 返回成功 PillCraftResult（含 ItemEntry）
 * - 失败 → 返回失败 + 副作用（随机触发 sideEffect）
 */
export function resolvePillCrafting(recipe: PillRecipe, materials: { id: string; quantity?: number }[]): PillCraftResult {
  if (!recipe) return { success: false, narrativeHint: '丹方无效。' };
  const haveIds = new Set(materials.map(m => m.id));
  const missing = recipe.requiredMaterials.filter(id => !haveIds.has(id));
  if (missing.length > 0) {
    return { success: false, narrativeHint: `材料不足：${missing.join('、')}` };
  }
  // 简化确定性：稀有度越高越容易出副作用
  const rarityScore: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const score = rarityScore[recipe.rarity] ?? 1;
  const seed = (recipe.id.length + score) * 13;
  const roll = ((seed * 9301 + 49297) % 233280) / 233280;
  const sideEffectRoll = ((seed * 1664525 + 1013904223) % 233280) / 233280;
  if (roll < 0.18) {
    const sideEffect: StatusEntry = {
      id: `pill-side-${recipe.id}`,
      name: '丹毒内蕴',
      description: '服丹后残留的毒性，需静坐化解。',
      category: 'debuff',
      rarity: 'common',
      duration: 3,
      source: `丹药副作用（${recipe.name}）`,
      effects: [],
    };
    return { success: false, sideEffect, narrativeHint: '炉火失衡，丹未成形。' };
  }
  const pill: ItemEntry = {
    id: `pill-${recipe.id}`,
    name: recipe.name,
    description: recipe.description,
    item_type: 'consumable',
    rarity: recipe.rarity,
    effects: [],
    source: '炼制所得',
  };
  return {
    success: true,
    pill,
    sideEffect: sideEffectRoll > 0.85 ? {
      id: `pill-mild-side-${recipe.id}`,
      name: '丹气翻涌',
      description: '服丹后气血略有翻涌。',
      category: 'debuff',
      rarity: 'common',
      duration: 1,
      source: `丹药副作用（${recipe.name}）`,
      effects: [],
    } : undefined,
    narrativeHint: '炉火稳定，丹香溢出。',
  };
}

// ===== AI-97: Formation Stack =====
/**
 * 把同一区域内的多个阵法合并成单条 stackResult。
 * - independent: 总加成 = sum(values)
 * - boosted:     同源阵法叠加增强（multiplier = 1 + 0.25 * (count-1)）
 * - conflict:    同源阵法互相削弱（penalty = 0.7 per additional）
 * - replace:     选效果最高的，覆盖其余
 */
export function deriveCraftingEligibility(
  recipe: CraftingRecipe,
  character: WorkerDCharacter,
  inventory: ItemEntry[],
): { eligible: boolean; missing: string[]; alternatives: string[] } {
  const missing: string[] = [];
  const alternatives: string[] = [];
  const inv = Array.isArray(inventory) ? inventory : [];
  const recipeMats = Array.isArray(recipe?.materials) ? recipe.materials : [];
  for (const m of recipeMats) {
    if (!inv.some((it) => it && it.id === m.id)) {
      missing.push(m.id);
      alternatives.push("先修行强化" + m.id + "相关功法");
    }
  }
  const charRealm = typeof character?.realmLevel === "number" ? character.realmLevel : 0;
  if (typeof recipe?.requiredRealm === "number" && charRealm < recipe.requiredRealm) {
    missing.push("realm:" + recipe.requiredRealm);
    alternatives.push("先提升境界至" + recipe.requiredRealm + "层");
  }
  return { eligible: missing.length === 0, missing, alternatives };
}

export function startCraftingSession(
  recipe: CraftingRecipe,
  character: WorkerDCharacter,
): CraftingSession {
  const startedAge = typeof character?.age === "number" ? character.age : 0;
  const materials = Array.isArray(recipe?.materials) ? recipe.materials.slice() : [];
  return {
    recipeId: recipe?.id ?? "unknown",
    startedAge,
    currentStep: 0,
    totalSteps: Math.max(1, materials.length + 1),
    materialsConsumed: [],
    attempts: 0,
    currentSuccess: 0,
  };
}

export function resolveCraftingStep(
  session: CraftingSession,
  character: WorkerDCharacter,
  rand?: () => number,
): { session: CraftingSession; result: CraftingResult | null; hint: string } {
  const r = typeof rand === "function" ? rand : Math.random;
  const nextStep = (session?.currentStep ?? 0) + 1;
  const recipeMats = Array.isArray(session?.materialsConsumed) ? session.materialsConsumed : [];
  const successChance = 0.5 + (typeof character?.comprehension === "number" ? character.comprehension : 50) / 200;
  const success = r() < successChance;
  const nextSession: CraftingSession = {
    ...session,
    currentStep: nextStep,
    attempts: (session?.attempts ?? 0) + 1,
    currentSuccess: (session?.currentSuccess ?? 0) + (success ? 1 : 0),
    materialsConsumed: success ? recipeMats.concat(["step-" + nextStep]) : recipeMats,
  };
  const result: CraftingResult = success
    ? {
        success: true,
        outputItems: [{ id: "crafted-" + session?.recipeId + "-" + nextStep, name: "成品", item_type: "consumable" } as any],
        consumedMaterials: [],
        sideEffects: [],
        attributeChanges: [],
        experienceGained: 10,
      }
    : {
        success: false,
        outputItems: [],
        consumedMaterials: [],
        sideEffects: [],
        attributeChanges: [],
        experienceGained: 1,
      };
  const hint = success ? "成色尚可，继续下一步" : "火候略偏，稳住心神";
  return { session: nextSession, result, hint };
}
