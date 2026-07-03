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


const PET_RARITY_MULTIPLIER: Record<string, number> = {
  common: 1.0, uncommon: 1.2, rare: 1.5, epic: 1.8, legendary: 2.2, mythic: 2.8,
};

// 根据物种 + 稀有度 + 境界生成完整灵宠属性
export function createPet(
  species: PetSpecies,
  rarity: Pet['rarity'],
  realm: Realm,
  name: string,
  description: string,
  sourceAcquired: string,
  acquiredAge: number,
  customSkill?: Partial<Pet['skill']>,
  aiBond?: PetBondAIOutcome | null,
): Pet {
  if (aiBond) {
    const clamp = (v: number, min: number, max: number, fallback: number) => Math.max(min, Math.min(max, Math.round(Number(v) || fallback)));
    return {
      id: `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: aiBond.name || name || '灵兽',
      species: aiBond.species || species,
      description: aiBond.description || description || '循缘而来的灵宠。',
      rarity: aiBond.rarity || rarity,
      realm,
      hp: clamp(aiBond.hp, 20, 1200, 60), maxHp: clamp(aiBond.hp, 20, 1200, 60),
      attack: clamp(aiBond.attack, 1, 500, 10), defense: clamp(aiBond.defense, 0, 500, 6), speed: clamp(aiBond.speed, 1, 500, 10),
      element: aiBond.element || 'wood',
      loyalty: clamp(aiBond.loyalty, 0, 100, 70), satiety: clamp(aiBond.satiety, 0, 100, 80),
      level: 1, exp: 0, expToLevel: 100,
      sourceAcquired: aiBond.sourceAcquired || sourceAcquired,
      acquiredAge,
      traits: aiBond.traits || [],
      passiveHint: aiBond.passiveHint,
      skill: { name: aiBond.skill?.name || '灵息护主', description: aiBond.skill?.description || '以灵息护持主人。', power: Math.max(0.5, Math.min(5, Number(aiBond.skill?.power) || 1.2)), cooldown: Math.max(1, Math.min(8, Math.round(Number(aiBond.skill?.cooldown) || 3))) },
    };
  }
  const template = PET_SPECIES_TEMPLATES[species];
  const rarityMul = PET_RARITY_MULTIPLIER[rarity] || 1.0;
  // 境界加成：每境界 +20% 基础属性
  const realmIdx = REALMS.findIndex(r => r.id === realm);
  const realmMul = 1 + Math.max(0, realmIdx) * 0.2;
  const baseHp = Math.round(template.baseHp * rarityMul * realmMul);
  const baseAttack = Math.round(template.baseAttack * rarityMul * realmMul);
  const baseDefense = Math.round(template.baseDefense * rarityMul * realmMul);
  const baseSpeed = Math.round(template.baseSpeed * rarityMul * realmMul);
  return {
    id: `pet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name || template.name,
    species,
    description: description || `${template.name}，${rarity}品质`,
    rarity,
    realm,
    hp: baseHp,
    maxHp: baseHp,
    attack: baseAttack,
    defense: baseDefense,
    speed: baseSpeed,
    element: template.defaultElement,
    loyalty: 70,         // 初始忠诚度 70（较高，但会随时间下降）
    satiety: 80,         // 初始饱食度 80
    level: 1,
    exp: 0,
    expToLevel: 100,
    sourceAcquired,
    acquiredAge,
    skill: {
      name: customSkill?.name || template.skillName,
      description: customSkill?.description || template.skillDesc,
      power: customSkill?.power || template.skillPower,
      cooldown: customSkill?.cooldown || template.skillCooldown,
    },
  };
}

// 添加灵宠到角色
export function addPet(state: CharacterState, pet: Pet): CharacterState {
  // 上限 5 只（避免灵宠过多复杂化游戏）
  const existing = state.pets || [];
  if (existing.length >= 5) {
    // 已满，不加（AI 应避免过度授予；可考虑替换最弱的一只）
    return state;
  }
  // ID 去重
  const usedIds = new Set(existing.map(p => p.id));
  let id = pet.id;
  while (usedIds.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
  return { ...state, pets: [...existing, { ...pet, id }] };
}

// 解雇/放生灵宠
export function dismissPet(state: CharacterState, petId: string): CharacterState {
  return { ...state, pets: (state.pets || []).filter(p => p.id !== petId) };
}

// 喂养灵宠：消耗一个材料类物品，回复饱食度 + 提升忠诚度 + 增加经验
export function feedPet(
  state: CharacterState,
  petId: string,
  itemId: string,
  aiCare?: PetCareAIOutcome | null,
): { state: CharacterState; ok: boolean; error?: string; pet?: Pet } {
  const pet = (state.pets || []).find(p => p.id === petId);
  if (!pet) return { state, ok: false, error: '灵宠不存在' };
  const item = state.inventory.find(it => it.id === itemId);
  if (!item) return { state, ok: false, error: '物品不在储物袋中' };
  // 仅允许材料类、丹药类、食物类（tool）物品喂养
  if (item.item_type !== 'material' && item.item_type !== 'consumable' && item.item_type !== 'tool') {
    return { state, ok: false, error: '该物品不适合喂养灵宠' };
  }
  if (aiCare) {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
    const levelDelta = clamp(aiCare.levelDelta || 0, 0, 3);
    const maxHpDelta = clamp(aiCare.maxHpDelta || 0, -20, 120) + levelDelta * 8;
    const updatedPet: Pet = {
      ...pet,
      satiety: Math.max(0, Math.min(100, pet.satiety + clamp(aiCare.satietyDelta, -20, 80))),
      loyalty: Math.max(0, Math.min(100, pet.loyalty + clamp(aiCare.loyaltyDelta, -30, 60))),
      level: Math.max(1, pet.level + levelDelta),
      exp: Math.max(0, pet.exp + clamp(aiCare.expDelta, 0, 300)),
      attack: Math.max(0, pet.attack + clamp(aiCare.attackDelta || 0, -10, 80) + levelDelta * 2),
      defense: Math.max(0, pet.defense + clamp(aiCare.defenseDelta || 0, -10, 80) + levelDelta),
      maxHp: Math.max(1, pet.maxHp + maxHpDelta),
      hp: Math.min(Math.max(1, pet.maxHp + maxHpDelta), Math.max(0, pet.hp + maxHpDelta)),
    };
    const newInventory = state.inventory.filter(it => it.id !== itemId);
    const newPets = state.pets.map(p => p.id === petId ? updatedPet : p);
    return { state: { ...state, pets: newPets, inventory: newInventory }, ok: true, pet: updatedPet };
  }
  // AI 失败时按稀有度公式兜底计算喂养价值
  const rarityValue: Record<string, number> = { common: 15, uncommon: 25, rare: 40, epic: 60, legendary: 80, mythic: 100 };
  const feedValue = rarityValue[item.rarity] || 15;
  // 更新灵宠
  const newSatiety = Math.min(100, pet.satiety + feedValue);
  const newLoyalty = Math.min(100, pet.loyalty + Math.floor(feedValue / 4));
  let newExp = pet.exp + Math.floor(feedValue / 2);
  let newLevel = pet.level;
  let newExpToLevel = pet.expToLevel;
  let levelUpBonus = 0;
  while (newExp >= newExpToLevel) {
    newExp -= newExpToLevel;
    newLevel += 1;
    newExpToLevel = Math.round(newExpToLevel * 1.4);
    levelUpBonus += 1;
  }
  // 升级提升属性
  const updatedPet: Pet = {
    ...pet,
    satiety: newSatiety,
    loyalty: newLoyalty,
    level: newLevel,
    exp: newExp,
    expToLevel: newExpToLevel,
    attack: pet.attack + levelUpBonus * 2,
    defense: pet.defense + levelUpBonus * 1,
    maxHp: pet.maxHp + levelUpBonus * 8,
    hp: Math.min(pet.maxHp + levelUpBonus * 8, pet.hp + levelUpBonus * 8),
  };
  // 移除消耗品
  const newInventory = state.inventory.filter(it => it.id !== itemId);
  const newPets = state.pets.map(p => p.id === petId ? updatedPet : p);
  return {
    state: { ...state, pets: newPets, inventory: newInventory },
    ok: true,
    pet: updatedPet,
  };
}

// 每岁灵宠状态变化：
// - 饱食度 -10
// - 忠诚度 -2（饥饿时 -5）
// - HP 自然回复（满饱食度 +10% maxHp，半饱 +5%，饥饿不回复）
// - 忠诚度 < 30 的灵宠有概率逃离（每岁 5%）
export function tickPets(state: CharacterState): CharacterState {
  if (!state.pets || state.pets.length === 0) return state;
  const survivedPets: Pet[] = [];
  for (const pet of state.pets) {
    let newSatiety = Math.max(0, pet.satiety - 10);
    let newLoyalty = pet.loyalty - (newSatiety < 30 ? 5 : 2);
    newLoyalty = Math.max(0, newLoyalty);
    // HP 自然回复
    const hpRegen = newSatiety >= 70 ? Math.round(pet.maxHp * 0.1) : newSatiety >= 30 ? Math.round(pet.maxHp * 0.05) : 0;
    const newHp = Math.min(pet.maxHp, pet.hp + hpRegen);
    // 忠诚度 < 30 时 5% 概率逃离
    if (newLoyalty < 30 && Math.random() < 0.05) {
        continue; // 灵宠逃离
    }
    survivedPets.push({ ...pet, satiety: newSatiety, loyalty: newLoyalty, hp: newHp });
  }
  return { ...state, pets: survivedPets };
}

// 灵宠战斗贡献计算：返回灵宠对玩家属性的额外加成（被动效果）
// 不同物种提供不同被动：龟加防御、鹰加速度、虎加攻击、狐加气运、龙加全属性
export function computePetPassiveBonus(state: CharacterState): {
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  cultivationRate: number;  // 修炼速度倍率加成
} {
  const result = { attack: 0, defense: 0, speed: 0, luck: 0, cultivationRate: 0 };
  for (const pet of state.pets || []) {
    if (pet.loyalty < 30 || pet.satiety < 20 || pet.hp <= 0) continue;
    const tier = Math.max(1, Math.floor(pet.level / 3) + 1);
    switch (pet.species) {
      case 'turtle':   result.defense += tier * 2; break;
      case 'eagle':    result.speed += tier * 2; break;
      case 'tiger':
      case 'ape':      result.attack += tier * 2; break;
      case 'fox':
      case 'butterfly':result.luck += tier * 2; break;
      case 'dragon':
      case 'phoenix':  result.attack += tier; result.defense += tier; result.speed += tier; break;
      case 'wolf':
      case 'snake':    result.attack += tier; break;
    }
    // 所有灵宠略微提升修炼速度（陪伴效应）
    result.cultivationRate += 0.02 * tier;
  }
  return result;
}

// ==================== Task 23: 符箓识别 ====================

// 判断物品是否为符箓（通过 effects 中的 target_attribute 判定）
const PET_STAGE_ORDER: PetEvolutionStage[] = ['infant', 'youth', 'mature', 'ascended'];

const PET_EVOLUTION_REQUIREMENTS: Record<PetEvolutionStage, PetEvolutionRequirement> = {
  infant: {
    stage: 'infant',
    minAge: 0,
    minRealmLevel: 0,
    materials: [],
    minLoyalty: 0,
  },
  youth: {
    stage: 'youth',
    minAge: 1,
    minRealmLevel: 2,
    materials: ['pet_growth_pill'],
    minLoyalty: 40,
  },
  mature: {
    stage: 'mature',
    minAge: 5,
    minRealmLevel: 4,
    materials: ['pet_mature_essence', 'pet_growth_pill'],
    minLoyalty: 70,
  },
  ascended: {
    stage: 'ascended',
    minAge: 20,
    minRealmLevel: 7,
    materials: ['pet_ascension_crystal', 'pet_mature_essence', 'pet_growth_pill'],
    minLoyalty: 90,
  },
};

/**
 * 检查灵宠是否能进阶到下一阶段。返回资格与缺失项列表。
 */
export function derivePetEvolutionEligibility(
  pet: { id: string; level?: number; exp?: number; loyalty?: number; acquiredAge?: number; stage?: PetEvolutionStage },
  character: CharacterState
): PetEvolutionEligibility {
  const currentStage: PetEvolutionStage = pet.stage ?? 'infant';
  const idx = PET_STAGE_ORDER.indexOf(currentStage);
  const nextStage = idx >= 0 && idx < PET_STAGE_ORDER.length - 1 ? PET_STAGE_ORDER[idx + 1] : undefined;

  if (!nextStage) {
    return {
      petId: pet.id,
      currentStage,
      eligible: false,
      missing: ['已达最高阶段'],
    };
  }

  const req = PET_EVOLUTION_REQUIREMENTS[nextStage];
  const missing: string[] = [];

  const heldAge = Math.max(0, (character.age ?? 0) - (pet.acquiredAge ?? 0));
  if (heldAge < req.minAge) {
    missing.push(`陪伴年限不足（需${req.minAge}年，当前${heldAge}年）`);
  }
  const realmLevel = (character as any).realmLevel ?? 0;
  if (realmLevel < req.minRealmLevel) {
    missing.push(`角色境界不足（需境界等级${req.minRealmLevel}，当前${realmLevel}）`);
  }
  const loyalty = pet.loyalty ?? 0;
  if (loyalty < req.minLoyalty) {
    missing.push(`忠诚度不足（需${req.minLoyalty}，当前${loyalty}）`);
  }
  // 材料检查：从角色 inventory 中查找（这里只校验逻辑，不消耗）
  const inv: any[] = (character as any).inventory ?? [];
  for (const mat of req.materials) {
    const has = inv.some((it: any) => it?.id === mat || it?.name === mat);
    if (!has) {
      missing.push(`缺少材料：${mat}`);
    }
  }

  return {
    petId: pet.id,
    currentStage,
    nextStage,
    eligible: missing.length === 0,
    missing,
  };
}

/**
 * 执行灵宠进阶：返回进阶后的灵宠对象（含 stage 提升、属性提升）。
 */
export function resolvePetEvolution(
  pet: { id: string; name?: string; level?: number; stage?: PetEvolutionStage; hp?: number; maxHp?: number; attack?: number; defense?: number; speed?: number }
): PetEvolutionStage | null {
  const currentStage: PetEvolutionStage = pet.stage ?? 'infant';
  const idx = PET_STAGE_ORDER.indexOf(currentStage);
  if (idx < 0 || idx >= PET_STAGE_ORDER.length - 1) return null;
  return PET_STAGE_ORDER[idx + 1];
}

// ---------------- AI-89: Pet Insight Communication ----------------

/**
 * 灵宠在特定条件下向角色传递顿悟片段。
 * 返回 null 表示当前无新顿悟。
 */
export function derivePetInsight(
  pet: { id: string; name?: string; stage?: PetEvolutionStage; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth'; level?: number; loyalty?: number },
  character: CharacterState
): PetInsight | null {
  const stage = pet.stage ?? 'infant';
  const loyalty = pet.loyalty ?? 0;
  const level = pet.level ?? 1;
  // 触发条件：成熟期以上 + 忠诚度>=60 + 等级>=3
  if (stage === 'infant') return null;
  if (loyalty < 60) return null;
  if (level < 3) return null;

  const insightsByStage: Record<PetEvolutionStage, { name: string; source: string; effect: PetInsight['effect'] }[]> = {
    infant: [],
    youth: [
      { name: '初识灵韵', source: `与${pet.name ?? '灵宠'}日夕相伴`, effect: { cultivationRateBonus: 0.05, elementAffinity: pet.element } },
    ],
    mature: [
      { name: '气机共鸣', source: `${pet.name ?? '灵宠'}突破至成熟期时的心境共鸣`, effect: { cultivationRateBonus: 0.1, elementAffinity: pet.element } },
      { name: '本能觉醒', source: `${pet.name ?? '灵宠'}在危难中护主`, effect: { techniqueHint: '可尝试修习与本属性相合的功法' } },
    ],
    ascended: [
      { name: '化形心得', source: `${pet.name ?? '灵宠'}化形一刻的灵光`, effect: { cultivationRateBonus: 0.2, elementAffinity: pet.element } },
      { name: '本相归元', source: `${pet.name ?? '灵宠'}化形后的反向传授`, effect: { techniqueHint: '可窥见本属性功法的高阶法门' } },
    ],
  };

  const pool = insightsByStage[stage] ?? [];
  if (pool.length === 0) return null;
  // 简化：根据角色年龄 hash 选择一个（确定性，不消耗随机数）
  const idx = ((character.age ?? 0) + (pet.id?.length ?? 0)) % pool.length;
  const pick = pool[idx];
  return {
    petId: pet.id,
    petName: pet.name ?? '灵宠',
    insightName: pick.name,
    source: pick.source,
    learnedAge: character.age ?? 0,
    effect: pick.effect,
  };
}

/**
 * 灵识对话：根据触发原因生成灵宠传递给主人的一句话。
 */
export function resolvePetCommunication(
  pet: { id: string; name?: string; species?: string; loyalty?: number },
  trigger: string
): string {
  const name = pet.name ?? '灵宠';
  const loyalty = pet.loyalty ?? 0;
  // 根据忠诚度切换语气
  if (loyalty < 30) {
    return `${name}心不在焉地瞥了一眼，似对「${trigger}」毫无兴趣。`;
  }
  if (loyalty < 60) {
    return `${name}低鸣一声，隐约传达出对「${trigger}」的淡淡警示。`;
  }
  if (loyalty < 85) {
    return `${name}灵识波动，向主人清晰地传来：「${trigger}——当谨慎。」`;
  }
  return `${name}目光中透出深意，灵识中郑重传来：「主人，${trigger}——此乃天赐之机，亦是天设之险。」`;
}

// ---------------- AI-90: Pet Combat Skills ----------------

/**
 * 根据宠物的基础属性，派生它在战斗中的技能列表。
 * 化形期之前的灵宠只有一个技能（来自 PET_SPECIES_TEMPLATES）。
 */
export function derivePetSkillAvailable(
  pet: { id: string; stage?: PetEvolutionStage; level?: number; skill?: { name: string; description: string; power: number; cooldown: number }; species?: string },
  turn: number,
  usage: PetSkillUsage[] = []
): PetCombatSkill[] {
  const stage = pet.stage ?? 'infant';
  const baseSkill = pet.skill;
  if (!baseSkill) return [];

  const skills: PetCombatSkill[] = [
    {
      skillId: `${pet.id}-basic`,
      name: baseSkill.name,
      description: baseSkill.description,
      power: baseSkill.power,
      cooldown: baseSkill.cooldown,
      range: 'single',
      effect: 'physical',
    },
  ];

  // 成熟期 +：解锁元素技能
  if (stage === 'mature' || stage === 'ascended') {
    skills.push({
      skillId: `${pet.id}-elemental`,
      name: `${baseSkill.name}·属相共鸣`,
      description: '汲取主人与自身的元素共鸣，释放元素之击',
      power: Math.round(baseSkill.power * 1.4),
      cooldown: baseSkill.cooldown + 1,
      range: stage === 'ascended' ? 'all_enemies' : 'single',
      effect: 'elemental',
      element: 'fire',
    });
  }
  // 化形期：解锁辅助技能
  if (stage === 'ascended') {
    skills.push({
      skillId: `${pet.id}-guard`,
      name: '化形护主',
      description: '以人形短暂护主，减免本回合伤害',
      power: 0,
      cooldown: 4,
      range: 'all_allies',
      effect: 'buff',
    });
  }

  // 过滤掉冷却中或已用尽的技能
  return skills.filter(s => {
    const u = usage.find(x => x.skillId === s.skillId);
    if (!u) return true;
    if (u.usesLeft === 0) return false;
    if (u.lastUsedTurn > 0 && turn - u.lastUsedTurn < s.cooldown) return false;
    return true;
  });
}

/**
 * 执行灵宠技能，返回一个战斗事件对象（damage/heal/buff 等）。
 */
export function resolvePetSkillUse(
  pet: { id: string; name?: string; attack?: number; element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth' },
  skill: PetCombatSkill,
  turn: number,
  targetId?: string
): PetCombatSkillEvent {
  const baseAtk = pet.attack ?? 10;
  const damage = skill.effect === 'physical' || skill.effect === 'elemental'
    ? Math.round(baseAtk * skill.power)
    : undefined;
  const heal = skill.effect === 'heal'
    ? Math.round(baseAtk * skill.power * 0.6)
    : undefined;

  return {
    petId: pet.id,
    skillId: skill.skillId,
    skillName: skill.name,
    turn,
    targetId,
    damage,
    heal,
    buffApplied: skill.effect === 'buff' ? ['护主之势'] : undefined,
    debuffApplied: skill.effect === 'debuff' || skill.effect === 'control' ? [skill.name] : undefined,
    narrativeHint: `${pet.name ?? '灵宠'}施展【${skill.name}】${
      damage ? `，造成${damage}点伤害` :
      heal ? `，恢复${heal}点气血` :
      skill.effect === 'buff' ? '，为主人撑起护体气罩' :
      skill.effect === 'control' ? `，试图压制目标` :
      ''
    }。`,
  };
}
// ==================== Worker A: AI-81~AI-85 Additions ====================
// All functions below are additive derivation/resolution helpers.
// They DO NOT mutate the combat state machine core or breakthrough state machine core.
// UI is responsible for reading the returned values; the engine never prescribes player input.

// ==================== AI-81: Combat Stance ====================

/**
 * AI-81: 根据角色当前战斗状态与敌方姿态，推导一个建议的战斗姿态。
 * - 始终返回非空姿态（除非没有进行中的战斗）
 * - 不写入 session；仅供 UI / AI 调用方参考
 * - 该函数纯派生，不修改任何状态
 */
const PET_PATH_KEYWORDS: Record<PetCultivationPath, string[]> = {
  combat:   ['锋','锐','猛','破','噬','猎','爪','牙','杀'],
  assist:   ['护','养','愈','柔','伴','庇','医','灵'],
  transform:['化形','蜕变','人形','九尾','蛟龙','仙鹤','凤'],
  contract: ['心','契','羁','念','魂','约'],
};

/**
 * 根据灵宠名/描述/类型，推荐一条修行路径。
 * 命中关键字的关键词数最多者胜出；平局时按 combat > assist > transform > contract 优先级。
 */
export function derivePetCultivationSuggestion(pet: { name?: string; description?: string; type?: string } | null | undefined, _character: CharacterState): PetCultivationPath {
  if (!pet) return 'combat';
  const text = `${pet.name ?? ''} ${pet.description ?? ''} ${pet.type ?? ''}`;
  const scores: Record<PetCultivationPath, number> = { combat: 0, assist: 0, transform: 0, contract: 0 };
  (Object.keys(PET_PATH_KEYWORDS) as PetCultivationPath[]).forEach(k => {
    for (const kw of PET_PATH_KEYWORDS[k]) {
      if (text.includes(kw)) scores[k] += 1;
    }
  });
  const order: PetCultivationPath[] = ['combat','assist','transform','contract'];
  let best: PetCultivationPath = 'combat';
  let bestScore = -1;
  for (const k of order) {
    if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
  }
  return best;
}

/**
 * 学习一个新技能到灵宠身上：检查技能是否与已有 skill 重复，并返回新灵宠对象。
 * 重复时返回原 pet（不重复登记），并通过 throw 提示。
 */
export function resolvePetSkillLearn<T extends { skill: { name: string; power: number; cooldown: number } }>(pet: T, skill: { name: string; power: number; cooldown: number; description?: string }): T {
  if (!pet || !skill || !skill.name) return pet;
  if (pet.skill && pet.skill.name === skill.name) return pet;
  return {
    ...pet,
    skill: {
      name: skill.name,
      description: (skill as any).description ?? ((pet as any).skill?.description ?? ''),
      power: typeof skill.power === 'number' ? skill.power : ((pet as any).skill?.power ?? 1),
      cooldown: typeof skill.cooldown === 'number' ? skill.cooldown : ((pet as any).skill?.cooldown ?? 0),
    },
  };
}

// ===== AI-96: Pill Recipe =====
/**
 * 给定丹方和角色，推算是否已解锁 + 还缺什么。
 */