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
  WorkerDEndingCharacter,
  WorkerDEndingWorldState,
  safeStringArray,
} from './shared';
import {
  PlayerUIProjection,
} from './ui-projection';
import {
  validateCrossSystemContinuity,
} from './validation';

function clampUnit(n: number, fallback = 0): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function evaluateEndingConditions(
  character: WorkerDEndingCharacter,
  worldState?: WorkerDEndingWorldState,
): EndingCondition[] {
  const ws: WorkerDEndingWorldState = worldState || {};
  const karma = safeStringArray(character?.karmaTags, 32);
  const stability = clampUnit(typeof ws.worldStability === 'number' ? ws.worldStability : 0.7);
  const isDoom = !!ws.isDoomActive || !!ws.activeApocalypse;
  const hasKarma = (kw: string): boolean => karma.indexOf(kw) >= 0;

  const conds: EndingCondition[] = [];

  // 1. 飞升成仙（基础权重 0.15；灵根/道统/师承等标记可放大）
  let ascendWeight = 0.15;
  if (hasKarma('pure-root') || hasKarma('dao-lineage')) ascendWeight += 0.25;
  if (hasKarma('immortal-ally')) ascendWeight += 0.1;
  conds.push({
    id: 'cond-ascend-immortal',
    archetype: 'ascend-immortal',
    requirements: ['元婴以上境界', '渡过至少一次天劫', '宗门/道统护持'],
    weight: clampUnit(ascendWeight, 0.15),
    narrativePreview: '踏破雷劫，紫气东来，肉身飞升上界。',
  });

  // 2. 坐化（默认基线寿尽/伤重；老迈或道基受损时权重显著）
  let sitWeight = 0.25;
  if (typeof character?.age === 'number' && typeof character?.lifespan === 'number' && character.age >= character.lifespan * 0.9) sitWeight += 0.4;
  if (hasKarma('grave-injury') || hasKarma('broken-dao')) sitWeight += 0.2;
  conds.push({
    id: 'cond-sit-death',
    archetype: 'sit-death',
    requirements: ['寿元将尽', '重伤/道基受损', '未破开境界'],
    weight: clampUnit(sitWeight, 0.25),
    narrativePreview: '油尽灯枯，于洞府中安详坐化，留衣钵与残篇。',
  });

  // 3. 堕入魔道（杀戮/邪法/心魔因缘触发）
  let demonicWeight = 0.1;
  if (hasKarma('mass-kill') || hasKarma('blood-art')) demonicWeight += 0.4;
  if (hasKarma('heart-demon-major')) demonicWeight += 0.3;
  conds.push({
    id: 'cond-fall-demonic',
    archetype: 'fall-demonic',
    requirements: ['血祭/邪法修习', '心魔失控', '杀戮因缘累积'],
    weight: clampUnit(demonicWeight, 0.1),
    narrativePreview: '心魔反噬，弃道入魔，从此与正道恩断义绝。',
  });

  // 4. 立宗立派（声望/弟子/资源足够）
  let sectWeight = 0.1;
  const rep = typeof character?.resources?.reputation === 'number' ? character.resources.reputation : 0;
  if (rep >= 500) sectWeight += 0.3;
  if (Array.isArray(character?.heirCandidateIds) && character.heirCandidateIds.length >= 1) sectWeight += 0.2;
  if (hasKarma('teaching-destiny')) sectWeight += 0.25;
  conds.push({
    id: 'cond-found-sect',
    archetype: 'found-sect',
    requirements: ['声望 500 以上', '至少一名继承人', '道统/功法可传'],
    weight: clampUnit(sectWeight, 0.1),
    narrativePreview: '开山收徒，立下道统，从此薪火相传不绝。',
  });

  // 5. 转世（仙缘/灵童/特殊体质）
  let reincWeight = 0.05;
  if (hasKarma('spirit-child') || hasKarma('reincarnation-mark')) reincWeight += 0.3;
  if (hasKarma('immortal-tribulation')) reincWeight += 0.1;
  conds.push({
    id: 'cond-reincarnate',
    archetype: 'reincarnate',
    requirements: ['灵童命格', '未破开仙界', '特殊体质'],
    weight: clampUnit(reincWeight, 0.05),
    narrativePreview: '魂入轮回，待百年后灵童降世，再续仙缘。',
  });

  // 6. 脱出本界（避世/渡海/虚空法阵）
  let escapeWeight = 0.08;
  if (hasKarma('void-art') || hasKarma('sea-pilgrim')) escapeWeight += 0.25;
  if (hasKarma('world-collapse-witness')) escapeWeight += 0.2;
  conds.push({
    id: 'cond-escape-world',
    archetype: 'escape-world',
    requirements: ['虚空/渡海法门', '避世决心', '世界崩坏/宗门将倾'],
    weight: clampUnit(escapeWeight, 0.08),
    narrativePreview: '驾虚空法阵，悄然离开此方天地，去向不可知处。',
  });

  // 7. 天地共灭（世界崩劫中最高权重放大）
  let collapseWeight = 0.02;
  if (isDoom) collapseWeight += 0.5;
  if (stability < 0.3) collapseWeight += (0.3 - stability) * 0.8;
  conds.push({
    id: 'cond-world-collapse',
    archetype: 'world-collapse',
    requirements: ['天地大劫', '世界稳定度 < 0.3', '未及时脱出本界'],
    weight: clampUnit(collapseWeight, 0.02),
    narrativePreview: '天地崩裂时与其同葬，身化劫灰融入虚无。',
  });

  // 8. 凡人隐退（道基仍在但主动放弃修为/归隐）
  let fadeWeight = 0.1;
  if (hasKarma('disillusion') || hasKarma('retreat-vow')) fadeWeight += 0.35;
  if (typeof character?.age === 'number' && character.age >= 80) fadeWeight += 0.1;
  conds.push({
    id: 'cond-fade-into-mortal',
    archetype: 'fade-into-mortal',
    requirements: ['对仙道失望/主动散去修为', '未堕入魔道', '仍有寿元'],
    weight: clampUnit(fadeWeight, 0.1),
    narrativePreview: '散尽修为，隐于凡尘，娶妻生子终老于山野。',
  });

  // 按 weight 降序排列
  conds.sort((a, b) => b.weight - a.weight);
  return conds;
}

/**
 * AI-I432 / selectEndingPath:
 *   按 weight 加权抽样选出一条结局路径。
 *   - rand 可选，默认 Math.random（传入 0..1 数用于测试）；
 *   - rationale 给出可解释的中文理由（谁权重最大 / 哪条被选中）。
 */
export function selectEndingPath(
  character: WorkerDEndingCharacter,
  conditions: EndingCondition[],
  rand?: number,
): { chosen: EndingCondition; rationale: string } {
  const conds = Array.isArray(conditions) ? conditions.filter(c => c && typeof c.id === 'string') : [];
  if (conds.length === 0) {
    // 空列表时给出基线坐化兜底
    return {
      chosen: {
        id: 'cond-sit-death-fallback',
        archetype: 'sit-death',
        requirements: ['无可达结局'],
        weight: 1,
        narrativePreview: '命运无定，默默老死于山野。',
      },
      rationale: '角色未触发任何可达结局，按基线落定「坐化」兜底。',
    };
  }
  const totalWeight = conds.reduce((sum, c) => sum + Math.max(0, typeof c.weight === 'number' ? c.weight : 0), 0);
  const r = (typeof rand === 'number' && Number.isFinite(rand)) ? rand : Math.random();
  const target = Math.max(0, Math.min(1, r)) * totalWeight;

  let acc = 0;
  let picked = conds[0];
  for (const c of conds) {
    acc += Math.max(0, typeof c.weight === 'number' ? c.weight : 0);
    if (target <= acc) { picked = c; break; }
  }

  const top = conds.slice().sort((a, b) => b.weight - a.weight)[0];
  const isTop = picked.id === top.id;
  const rationale = isTop
    ? `角色 ${character?.name || ''} 触发权重最高的结局「${picked.archetype}」（权重 ${picked.weight.toFixed(2)}），按命运主轴落定。`
    : `角色 ${character?.name || ''} 的主轴为「${top.archetype}」（权重 ${top.weight.toFixed(2)}），但命运临门一脚偏转，最终落定「${picked.archetype}」（权重 ${picked.weight.toFixed(2)}）。`;

  return { chosen: picked, rationale };
}

/**
 * AI-I433 / applyEndingOutcome:
 *   把一条 EndingCondition 落到角色 + 世界状态上，生成 EndingOutcome。
 *   - 不修改传入对象（pure function），所有变更通过返回值体现；
 *   - summary / worldStateAftermath / heirIds 三字段从角色与世界状态中归纳产出。
 */
export function applyEndingOutcome(
  character: WorkerDEndingCharacter,
  condition: EndingCondition,
  worldState?: WorkerDEndingWorldState,
): EndingOutcome {
  const age = typeof character?.age === 'number' ? character.age : 0;
  const ws: WorkerDEndingWorldState = worldState || {};

  // 总结按 archetype 给出不同模板，避免 AI 自造文本
  let summary = '';
  switch (condition.archetype) {
    case 'ascend-immortal':
      summary = `${character?.name || '此人'}渡过天劫，紫气东来，踏入上界。`;
      break;
    case 'sit-death':
      summary = `${character?.name || '此人'}在第 ${age} 年坐化于洞府，留残篇与法器于后世。`;
      break;
    case 'fall-demonic':
      summary = `${character?.name || '此人'}堕入魔道，从此与正道恩断义绝。`;
      break;
    case 'found-sect':
      summary = `${character?.name || '此人'}开山收徒，立下道统，宗名流传千古。`;
      break;
    case 'reincarnate':
      summary = `${character?.name || '此人'}魂入轮回，待百年后灵童降世再续仙缘。`;
      break;
    case 'escape-world':
      summary = `${character?.name || '此人'}驾虚空法阵悄然离开此方天地，去向不可知处。`;
      break;
    case 'world-collapse':
      summary = `天地崩裂，${character?.name || '此人'}与之同葬，身化劫灰融入虚无。`;
      break;
    case 'fade-into-mortal':
      summary = `${character?.name || '此人'}散尽修为隐于凡尘，娶妻生子终老于山野。`;
      break;
    default:
      summary = `${character?.name || '此人'}的命运走向未知。`;
  }

  // 世界余波：把世界状态、宗门、稳定性等归纳为字符串数组
  const aftermath: string[] = [];
  if (condition.archetype === 'ascend-immortal') {
    aftermath.push('宗门气运+30 年', '天象呈祥，史册记飞升事');
  } else if (condition.archetype === 'sit-death') {
    aftermath.push('宗门传承由弟子继承', '其遗物成为宗门秘藏');
  } else if (condition.archetype === 'fall-demonic') {
    aftermath.push('正道与其划清界限', '魔道势力扩张');
  } else if (condition.archetype === 'found-sect') {
    aftermath.push(`新宗门「${character?.faction || '无名宗'}」立道统`, '弟子/道统写入宗谱');
  } else if (condition.archetype === 'reincarnate') {
    aftermath.push('轮回印记存于天地间', '后人或可凭此寻灵童');
  } else if (condition.archetype === 'escape-world') {
    aftermath.push('本界再无此人因果', '史册中其下落成谜');
  } else if (condition.archetype === 'world-collapse') {
    aftermath.push('其所在区域化为劫灰', '宗门/家族受重创');
    if (typeof ws.worldStability === 'number') aftermath.push(`世界稳定度降至 ${ws.worldStability.toFixed(2)}`);
  } else if (condition.archetype === 'fade-into-mortal') {
    aftermath.push('其修为尽散', '凡尘留下一段隐者传说');
  }

  // 继承人：仅在立宗/坐化/转世/凡人隐 时承接衣钵
  const heirIds: string[] = [];
  if (
    condition.archetype === 'found-sect'
    || condition.archetype === 'sit-death'
    || condition.archetype === 'reincarnate'
    || condition.archetype === 'fade-into-mortal'
  ) {
    if (Array.isArray(character?.heirCandidateIds)) {
      for (const hid of character.heirCandidateIds) {
        if (typeof hid === 'string' && hid.length > 0 && heirIds.length < 8) heirIds.push(hid);
      }
    }
  }

  return {
    endingId: condition.id,
    archetype: condition.archetype,
    age,
    summary,
    worldStateAftermath: aftermath,
    heirIds,
  };
}

/**
 * AI-I434 / branchAlternativeOutcomes:
 *   在多世界/平行时间线场景下，由一条 outcome 派生多个分支结局。
 *   - alternativeBranches: 数组，每项 { archetype, narrativeTwist } 描述一条平行支线；
 *   - 输出与原 outcome 同结构（id 加 -branch-N 后缀），便于 UI 多结局陈列。
 */
export function branchAlternativeOutcomes(
  outcome: EndingOutcome,
  alternativeBranches: Array<{ archetype: EndingArchetype; narrativeTwist: string }>,
): EndingOutcome[] {
  const baseOut: EndingOutcome = (outcome && typeof outcome === 'object')
    ? {
        endingId: typeof outcome.endingId === 'string' ? outcome.endingId : 'outcome-base',
        archetype: outcome.archetype || 'sit-death',
        age: typeof outcome.age === 'number' ? outcome.age : 0,
        summary: typeof outcome.summary === 'string' ? outcome.summary : '',
        worldStateAftermath: safeStringArray(outcome.worldStateAftermath, 16),
        heirIds: safeStringArray(outcome.heirIds, 8),
      }
    : {
        endingId: 'outcome-base',
        archetype: 'sit-death',
        age: 0,
        summary: '',
        worldStateAftermath: [],
        heirIds: [],
      };

  const branches = Array.isArray(alternativeBranches) ? alternativeBranches : [];
  const out: EndingOutcome[] = [baseOut];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    if (!b || typeof b.archetype !== 'string') continue;
    const twist = typeof b.narrativeTwist === 'string' && b.narrativeTwist.length > 0
      ? b.narrativeTwist.substring(0, 160)
      : '平行时线走向迥异';
    out.push({
      endingId: `${baseOut.endingId}-branch-${i + 1}`,
      archetype: b.archetype,
      age: baseOut.age,
      summary: `${baseOut.summary}｜平行支线：${twist}`,
      worldStateAftermath: [...baseOut.worldStateAftermath, `支线#${i + 1}：${twist}`],
      heirIds: [...baseOut.heirIds],
    });
    if (out.length >= 9) break; // 主线 + 最多 8 支线
  }
  return out;
}

/**
 * AI-I435 / summarizeEndingForPrompt:
 *   把 EndingPathMap 渲染成紧凑中文摘要，给 AI 上下文使用。
 *   - charLimit 默认 600，按 outcomeHistory 优先 + endings 补全；
 *   - 不会越界写超 charLimit（按可见字符截断）。
 */
export function summarizeEndingForPrompt(pathMap: EndingPathMap, charLimit?: number): string {
  const limit = (typeof charLimit === 'number' && charLimit > 40) ? Math.min(charLimit, 4000) : 600;
  const empty = '（暂无结局路径数据）';
  if (!pathMap || typeof pathMap !== 'object') return empty;

  const lines: string[] = [];
  lines.push('【结局光谱】');

  const history = Array.isArray(pathMap.outcomeHistory) ? pathMap.outcomeHistory : [];
  if (history.length > 0) {
    lines.push(`- 已落定结局（${history.length}）`);
    for (const o of history) {
      lines.push(`  · ${o.archetype} @ ${o.age}：${o.summary}`);
    }
  } else {
    lines.push('- 已落定结局：无');
  }

  const choices = Array.isArray(pathMap.characterChoices) ? pathMap.characterChoices : [];
  if (choices.length > 0) {
    lines.push(`- 关键抉择（${choices.length}）`);
    for (const c of choices) {
      lines.push(`  · age=${c.age} → ${c.endingId}${c.irreversibility ? '（不可逆）' : ''}：${c.reason}`);
    }
  }

  const endings = Array.isArray(pathMap.endings) ? pathMap.endings.slice().sort((a, b) => b.weight - a.weight).slice(0, 6) : [];
  if (endings.length > 0) {
    lines.push('- 可达结局（按权重取前 6）：');
    for (const e of endings) {
      lines.push(`  · ${e.archetype}（w=${e.weight.toFixed(2)}）：${e.narrativePreview}`);
    }
  }

  let summary = lines.join('\n');
  if (summary.length > limit) {
    summary = summary.substring(0, limit - 1) + '…';
  }
  return summary;
}

// =================== Worker A (phase-i-p3-long) ===================
// AI-I401: Multi-character inheritance (multi-role lineage / bloodline / master-disciple
//          tribal-clan / sect-lineage / blood-oath / destiny-thread).
// Additive only. Each function targets one engine.ts function added in this batch.

interface InheritanceCharacter {
  id?: string;
  name?: string;
  age?: number;
  realm?: string;
  realmLevel?: number;
  comprehension?: number;
  luck?: number;
  master?: string;
  faction?: string;
  spiritualRoot?: string;
  cultivationExp?: number;
  activeAbilities?: string[];
  inheritedAbilities?: string[];
}

const INHERITANCE_KIND_LIST: InheritanceKind[] = [
  'bloodline',
  'master-disciple',
  'tribal-clan',
  'sect-lineage',
  'blood-oath',
  'destiny-thread',
];

const REALM_ORDER: string[] = [
  'mortal',
  'qi_refining',
  'foundation_building',
  'golden_core',
  'nascent_soul',
  'soul_formation',
  'deity_transformation',
  'void_refinement',
  'unity',
  'mahayana',
  'immortal',
];

function _inheritanceRealmIndex(realm: string | undefined): number {
  if (!realm) return -1;
  const idx = REALM_ORDER.indexOf(realm);
  return idx;
}

function _inheritanceCloneRecipients(gens: unknown): InheritanceRecipient[][] {
  if (!Array.isArray(gens)) return [];
  return gens.map((g) => {
    if (Array.isArray(g)) {
      return g.map((r: any) => ({ ...r, inheritedAbilities: (Array.isArray(r && r.inheritedAbilities) ? r.inheritedAbilities : []).slice() }));
    }
    if (g && typeof g === "object") {
      return [{ ...(g as any), inheritedAbilities: (Array.isArray((g as any).inheritedAbilities) ? (g as any).inheritedAbilities : []).slice() }];
    }
    return [];
  });
}

function _inheritanceSafeChain(chain: InheritanceChain | null | undefined): InheritanceChain {
  if (chain && Array.isArray(chain.generations)) {
    return {
      rootCharacterId: chain.rootCharacterId,
      generations: _inheritanceCloneRecipients(chain.generations),
      activeClaims: Array.isArray(chain.activeClaims) ? chain.activeClaims.slice() : [],
      lostTechniques: Array.isArray(chain.lostTechniques) ? chain.lostTechniques.slice() : [],
    };
  }
  return { rootCharacterId: '', generations: [], activeClaims: [], lostTechniques: [] };
}

/**
 * AI-I401: Compute whether the given character is eligible to claim inheritance from a
 *          source pool at the given target age, and report which prerequisites are missing.
 */
export function deriveInheritanceEligibility(
  character: InheritanceCharacter,
  sourcePool: InheritancePool,
  targetAge: number,
): { eligible: boolean; missingPrerequisites: string[]; inheritanceChain: InheritanceChain } {
  const missing: string[] = [];
  const chain: InheritanceChain = _inheritanceSafeChain(null);
  chain.rootCharacterId = sourcePool && sourcePool.id ? sourcePool.id : '';

  if (!sourcePool) {
    missing.push('pool:missing');
  } else {
    if (typeof sourcePool.availableSlots !== 'number' || sourcePool.availableSlots <= 0) {
      missing.push('pool:no_slots');
    }
    if (typeof sourcePool.lockedUntilAge === 'number' && sourcePool.lockedUntilAge > 0) {
      if (targetAge < sourcePool.lockedUntilAge) {
        missing.push('pool:locked_until_age:' + sourcePool.lockedUntilAge);
      }
    }
    if (Array.isArray(sourcePool.hostCharacterIds) && sourcePool.hostCharacterIds.length > 0) {
      const charId = character && typeof character.id === 'string' ? character.id : '';
      if (charId && sourcePool.hostCharacterIds.indexOf(charId) >= 0) {
        // already host, but still eligible (we just don't double-count)
      } else if (!charId) {
        missing.push('character:id_missing');
      }
    }
  }

  const charAge = character && typeof character.age === 'number' ? character.age : targetAge;
  if (charAge < 0) missing.push('character:age_invalid');

  const eligible = missing.length === 0;
  return { eligible, missingPrerequisites: missing, inheritanceChain: chain };
}

/**
 * AI-I402: Have a character claim a slot from a pool; produce an updated chain and a
 *          claim record (with world-internal narrative).
 */
export function claimInheritance(
  character: InheritanceCharacter,
  pool: InheritancePool,
  claim: InheritanceClaim,
): { updatedChain: InheritanceChain; claim: InheritanceClaim; narrative: string } {
  const charId = character && typeof character.id === 'string' ? character.id : 'unknown';
  const chain: InheritanceChain = _inheritanceSafeChain(null);
  chain.rootCharacterId = pool && pool.id ? pool.id : charId;

  const claimAge = claim && typeof claim.claimAge === 'number' ? claim.claimAge : (character && typeof character.age === 'number' ? character.age : 0);
  const claimReason = claim && typeof claim.claimReason === 'string' ? claim.claimReason : '';
  const witnessIds = claim && Array.isArray(claim.witnessIds) ? claim.witnessIds.slice() : [];
  const contested = !!(claim && claim.contested);

  // If pool is exhausted, mark the claim as resolved=false (still pending) but don't add a recipient.
  if (!pool || typeof pool.availableSlots !== 'number' || pool.availableSlots <= 0) {
    const newClaim: InheritanceClaim = {
      recipientId: '',
      claimAge,
      claimReason,
      witnessIds,
      contested,
      resolved: false,
    };
    chain.activeClaims.push(newClaim);
    return {
      updatedChain: chain,
      claim: newClaim,
      narrative: '\u4f20\u627f\u6c60\u5df2\u7a7a\uff0c\u672a\u80fd\u4e3b\u5f20\u4efb\u4f55\u540d\u989d\u3002', // "传承池已空，未能主张任何名额。"
    };
  }

  // Decrement pool slots; append host if not already present
  const newPool: InheritancePool = {
    id: pool.id,
    name: pool.name,
    kind: pool.kind,
    availableSlots: Math.max(0, pool.availableSlots - 1),
    lockedUntilAge: pool.lockedUntilAge,
    hostCharacterIds: pool.hostCharacterIds.slice(),
  };
  if (newPool.hostCharacterIds.indexOf(charId) < 0) {
    newPool.hostCharacterIds.push(charId);
  }

  // Build a recipient record. Source id is the pool's id (or the previous host if it was a chain claim).
  const recipientId = 'rcp-' + charId + '-' + (newPool.availableSlots + 1) + '-' + claimAge;
  const recipient: InheritanceRecipient = {
    id: recipientId,
    kind: newPool.kind,
    sourceCharacterId: newPool.id,
    targetCharacterId: charId,
    inheritedAbilities: Array.isArray(character && character.activeAbilities) ? (character!.activeAbilities as string[]).slice() : [],
    inheritanceAge: claimAge,
    narrative: '',
    realmRequired: character && typeof character.realm === 'string' ? character.realm : 'mortal',
  };

  chain.generations.push([recipient]);
  if (newPool.availableSlots === 0) {
    // pool closed: do nothing else
  }
  chain.activeClaims = chain.activeClaims.filter((c) => c && c.recipientId !== recipientId);

  const newClaim: InheritanceClaim = {
    recipientId,
    claimAge,
    claimReason,
    witnessIds,
    contested,
    resolved: true,
  };
  chain.activeClaims.push(newClaim);

  const reasonText = claimReason || '\u56e0\u7f18\u4f7f\u7136'; // 因缘使然
  const narrative = '\u4e8e' + claimAge + '\u5c81\u00b7' + reasonText + '\u4e3b\u5f20\u3010' + newPool.name + '\u3011\u540d\u989d\u4e00\u4f4d\uff0c\u9690\u542b\u4e8e\u672a\u6765\u3002'; // 于X岁·Y主张【Z】名额一位，隐含于未来。

  return { updatedChain: chain, claim: newClaim, narrative };
}

/**
 * AI-I403: Resolve a contest between multiple claimants of a single inheritance slot.
 *          Picks a winner by oldest claimAge (or first listed), produces world-internal
 *          narrative and a list of "casualties" (loser recipient ids).
 */
export function resolveInheritanceContest(
  chain: InheritanceChain,
  contestants: string[],
): { winnerId: string; narrative: string; casualties: string[] } {
  const safeChain = _inheritanceSafeChain(chain);
  const allRecipients: InheritanceRecipient[] = [];
  for (const g of safeChain.generations) {
    for (const r of g) allRecipients.push(r);
  }
  const recipientsById: Record<string, InheritanceRecipient> = {};
  for (const r of allRecipients) recipientsById[r.id] = r;

  // Look at active claims for contestants; pick the one with the largest inheritanceAge
  // (or first listed in contestants). Casualties are the losing recipients (and their claims
  // are removed from activeClaims).
  const contestSet: string[] = Array.isArray(contestants) ? contestants.map((x) => typeof x === 'string' ? x : (x && typeof x === 'object' && typeof (x as any).id === 'string' ? (x as any).id : "")).filter((x) => x.length > 0) : [];
  let winnerId = '';
  let winnerAge = -1;
  for (const cid of contestSet) {
    const r = recipientsById[cid];
    if (!r) continue;
    if (r.inheritanceAge > winnerAge) {
      winnerAge = r.inheritanceAge;
      winnerId = r.id;
    }
  }
  if (!winnerId && contestSet.length > 0) winnerId = contestSet[0];

  // Determine which contestants lost
  const casualties: string[] = [];
  for (const cid of contestSet) {
    if (cid && cid !== winnerId) casualties.push(cid);
  }

  // Remove all contestant recipients from generations; keep only the winner
  const newGenerations: InheritanceRecipient[][] = [];
  for (const g of safeChain.generations) {
    const kept = g.filter((r) => {
      if (contestSet.indexOf(r.id) >= 0) {
        return r.id === winnerId;
      }
      return true;
    });
    if (kept.length > 0) newGenerations.push(kept);
  }
  safeChain.generations = newGenerations;
  // Remove resolved contestant claims
  safeChain.activeClaims = safeChain.activeClaims.filter((c) => contestSet.indexOf(c.recipientId) < 0 || c.recipientId === winnerId);

  // Record lost techniques for losers' unique abilities
  const winner = recipientsById[winnerId];
  const winnerAbil = winner && Array.isArray(winner.inheritedAbilities) ? winner.inheritedAbilities : [];
  for (const cid of casualties) {
    const r = recipientsById[cid];
    if (!r) continue;
    for (const ab of (r.inheritedAbilities || [])) {
      if (winnerAbil.indexOf(ab) < 0 && safeChain.lostTechniques.indexOf(ab) < 0) {
        safeChain.lostTechniques.push(ab);
      }
    }
  }

  const narrative = winnerId
    ? '\u4f20\u627f\u4e89\u7aef\u5df2\u5b9a\uff1a' + (winner && winner.targetCharacterId ? winner.targetCharacterId : '\u672a\u77e5') + '\u62ff\u4e0b\u672c\u4ee3\u540d\u989d\uff0c\u4f59\u8005\u6539\u5199\u4e3a\u300a\u672a\u5b8c\u4e4b\u7f18\u300b\u3002' // 传承争端已定：X 拿下本代名额，余者改写为《未完之缘》。
    : '\u4f20\u627f\u4e89\u7aef\u65e0\u4eba\u5e94\u53d7\uff0c\u672c\u4ee3\u540d\u989d\u6682\u5f85\u3002'; // 传承争端无人应受，本代名额暂待。

  return { winnerId, narrative, casualties };
}

/**
 * AI-I404: Propagate the chain forward in time: for each generation, optionally spawn the
 *          next generation based on InheritanceKind attenuation (bloodline / blood-oath
 *          carry the most weight; destiny-thread attenuates fastest).
 */
export function propagateInheritance(
  chain: InheritanceChain,
  age: number,
): InheritanceChain {
  const safe = _inheritanceSafeChain(chain);

  type KindAttenuation = { rate: number; span: number; rename?: string };
  const KIND_ATTENUATION: Record<InheritanceKind, KindAttenuation> = {
    'bloodline':       { rate: 0.85, span: 30 },
    'blood-oath':      { rate: 0.80, span: 30 },
    'master-disciple': { rate: 0.70, span: 25 },
    'sect-lineage':    { rate: 0.65, span: 25 },
    'tribal-clan':     { rate: 0.55, span: 20 },
    'destiny-thread':  { rate: 0.40, span: 15 },
    'mentor-guild':    { rate: 0.60, span: 25 },
    'artifact':        { rate: 0.50, span: 20 },
    'secret-tome':     { rate: 0.55, span: 20 },
    'talisman':        { rate: 0.45, span: 15 },
    'technique':       { rate: 0.50, span: 20 },
    'token':           { rate: 0.40, span: 15 },
    'bond':            { rate: 0.55, span: 25 },
  };

  // Walk the chain in order; for the most recent generation, spawn a child only if
  // the last inheritanceAge is more than (span) years in the past.
  if (safe.generations.length === 0) return safe;
  const lastGen = safe.generations[safe.generations.length - 1];
  const lastAge = lastGen.reduce((m, r) => (typeof r.inheritanceAge === 'number' && r.inheritanceAge > m ? r.inheritanceAge : m), 0);

  // Stop if no more carriers in the latest generation
  if (lastGen.length === 0) return safe;

  // Take the "strongest" parent of the last generation (most inheritedAbilities)
  let parent = lastGen[0];
  for (const r of lastGen) {
    if ((r.inheritedAbilities || []).length > (parent.inheritedAbilities || []).length) parent = r;
  }

  // Determine this parent kind's attenuation
  const att = KIND_ATTENUATION[parent.kind] || KIND_ATTENUATION['master-disciple'];
  if (age - lastAge < att.span) return safe; // not enough time to propagate

  // Roll attenuation: skip propagation probabilistically
  const roll = ((age * 9301 + 49297) % 233280) / 233280;
  if (roll > att.rate) {
    // Failed to propagate; record any unique abilities as lost
    for (const ab of (parent.inheritedAbilities || [])) {
      if (safe.lostTechniques.indexOf(ab) < 0) safe.lostTechniques.push(ab);
    }
    return safe;
  }

  // Succeed: spawn child inheriting a subset of abilities
  const parentAbil = parent.inheritedAbilities || [];
  const childAbil: string[] = [];
  for (let i = 0; i < parentAbil.length; i++) {
    if (i % 2 === 0) childAbil.push(parentAbil[i]);
  }
  const child: InheritanceRecipient = {
    id: 'rcp-auto-' + parent.id + '-' + age,
    kind: parent.kind,
    sourceCharacterId: parent.targetCharacterId || parent.id,
    targetCharacterId: 'auto-' + parent.targetCharacterId + '-' + age,
    inheritedAbilities: childAbil,
    inheritanceAge: age,
    narrative: '',
    realmRequired: parent.realmRequired,
  };
  safe.generations.push([child]);
  return safe;
}

/**
 * AI-I405: Build a short, world-internal prompt injection string summarizing the chain,
 *          truncated to roughly charLimit characters. Used by AI prompt construction.
 */
export function summarizeInheritanceForPrompt(
  chain: InheritanceChain,
  charLimit: number,
): string {
  const safe = _inheritanceSafeChain(chain);
  const limit = typeof charLimit === 'number' && charLimit > 0 ? Math.floor(charLimit) : 480;
  const lines: string[] = [];
  lines.push('[\u4f20\u627f\u8c31]'); // [传承谱]
  lines.push('\u6839\uff1a' + (safe.rootCharacterId || '\u672a\u8bbe')); // 根：X
  const genCount = safe.generations.length;
  lines.push('\u4ee3\u9636\uff1a' + genCount); // 代阶：X
  for (let i = 0; i < safe.generations.length; i++) {
    const g = safe.generations[i];
    const summary = g.map((r) => {
      const ab = (r.inheritedAbilities || []).join('\u00b7'); // ·
      return r.targetCharacterId + '(' + r.kind + '·' + r.inheritanceAge + '\u5c81·' + ab + ')'; // 岁
    }).join('\u3001'); // 、
    lines.push('\u7b2c' + (i + 1) + '\u4ee3\uff1a' + summary); // 第N代：
  }
  if (safe.activeClaims.length > 0) {
    const ids = safe.activeClaims.map((c) => c.recipientId || '\u672a\u77e5').join('\u3001'); // 、
    lines.push('\u672a\u4e86\u56e0\u7f18\uff1a' + ids); // 未了因缘：
  }
  if (safe.lostTechniques.length > 0) {
    lines.push('\u5df2\u4e1f\u5931\uff1a' + safe.lostTechniques.join('\u3001')); // 已丢失：
  }
  let out = lines.join('\n');
  if (out.length > limit) out = out.slice(0, Math.max(0, limit - 1)) + '\u2026'; // …
  return out;
}

void INHERITANCE_KIND_LIST;
void _inheritanceRealmIndex;

// ==================== Phase-I Worker B: 宗门兴衰 ====================
// AI-I4xx additive engine functions: 宗门生命周期评估、外推、危机检测、事件生成、摘要。
// 规则：
//  - 仅追加（additive only），不动既有 engine / types 函数
//  - 5 个 export function 全部以 SectTrajectory / SectPhase 等新类型为输入/输出
//  - 内部辅助函数（helper）不导出；随机性通过可选 rand 参数注入，便于 smoke 验证

export function detectFateEchoes(
  character: { id?: string; age?: number; npcs?: Array<{ id: string; attitude?: string }>; longTermMemory?: string[] },
  history: PendingThread[] = [],
): FateEchoTrigger[] {
  const charId = (character && character.id) || 'protagonist';
  const charAge = typeof character?.age === 'number' ? character.age : 0;
  const npcs = Array.isArray(character?.npcs) ? character.npcs : [];
  const mems = Array.isArray(character?.longTermMemory) ? character.longTermMemory : [];

  const out: FateEchoTrigger[] = [];
  const seen = new Set<string>();

  // 1) 未决线索到期 → 人物回响 / 因果回响
  for (const t of history) {
    if (!t || typeof t !== 'object') continue;
    const dueAge = typeof (t as any).deadlineAge === 'number' ? (t as any).deadlineAge : charAge + 100;
    const urgency = dueAge <= charAge + 3 ? 'critical' : dueAge <= charAge + 10 ? 'high' : 'normal';
    const key = 'thread:' + (t as any).id;
    if (seen.has(key)) continue;
    seen.add(key);
    const category = (t as any).category;
    const kind: FateEchoKind = category === 'enemy' || category === 'debt'
      ? FateEchoKind.KarmaDebt
      : category === 'promise'
        ? FateEchoKind.PromiseFulfillment
        : category === 'mystery'
          ? FateEchoKind.DestinyCollision
          : FateEchoKind.CharacterCallback;
    out.push({
      id: 'echo-' + charId + '-' + (t as any).id,
      kind,
      age: charAge,
      sourceCharacterId: String((t as any).id),
      targetCharacterId: charId,
      narrativeHook: (t as any).title || "旧事随风悄然泛起",
      urgency: urgency as FateEchoTrigger['urgency'],
    });
  }

  // 2) 长期记忆中出现的高频关键词 → 物品回响 / 地点回响
  for (let i = 0; i < mems.length; i++) {
    const mem = mems[i];
    if (typeof mem !== 'string') continue;
    const key = 'mem:' + i;
    if (seen.has(key)) continue;
    seen.add(key);
    if (/[法宝剑玉佩珠灯塔印]/.test(mem)) {
      out.push({
        id: 'echo-mem-item-' + i,
        kind: FateEchoKind.ItemRecall,
        age: charAge,
        sourceCharacterId: 'mem:' + i,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    } else if (/[山谷城阁洞湖海林原镇塔]/.test(mem)) {
      out.push({
        id: 'echo-mem-place-' + i,
        kind: FateEchoKind.PlaceResonance,
        age: charAge,
        sourceCharacterId: 'mem:' + i,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    } else if (npcs.length > 0) {
      const npc = npcs[Math.min(i, npcs.length - 1)];
      out.push({
        id: 'echo-mem-npc-' + i,
        kind: FateEchoKind.CharacterCallback,
        age: charAge,
        sourceCharacterId: npc.id,
        targetCharacterId: charId,
        narrativeHook: "旧事随风悄然泛起",
        urgency: 'low',
      });
    }
  }

  return out;
}

// 命运回响解决：根据角色状态 + 随机种子决定回响的结局。
//  - echo:      触发器
//  - character: 角色状态（用于 id + age 标记）
//  - rand?:     可选随机源（默认 Math.random）
// 返回：回响解决结果（outcome + 叙事影响 + 涉及人物）
export function resolveFateEcho(
  echo: FateEchoTrigger,
  character: { id?: string; age?: number } = {},
  rand?: () => number,
): FateEchoResolution {
  const r = typeof rand === 'function' ? rand : Math.random;
  const charId = (character && character.id) || 'protagonist';
  const charAge = typeof character?.age === 'number' ? character.age : 0;
  const roll = r();
  let outcome: FateEchoResolution['outcome'];
  if (echo.urgency === 'critical') {
    outcome = roll < 0.6 ? 'fulfilled' : roll < 0.85 ? 'transformed' : 'severed';
  } else if (echo.urgency === 'high') {
    outcome = roll < 0.45 ? 'fulfilled' : roll < 0.75 ? 'transformed' : roll < 0.9 ? 'deferred' : 'severed';
  } else {
    outcome = roll < 0.35 ? 'fulfilled' : roll < 0.65 ? 'transformed' : roll < 0.9 ? 'deferred' : 'severed';
  }

  const consequenceMap: Record<FateEchoResolution['outcome'], string> = {
    fulfilled: '因缘得偿，旧约履践，命运回响安然落幕',
    transformed: '回响未消而转为新的因缘，暗中改写后路',
    deferred: '时机未至，回响暂且退入雾中，等待来日',
    severed: '因果断绝，旧缘消散，天地间再无回响',
  };

  return {
    echoId: echo.id,
    resolvedAge: charAge,
    outcome,
    narrativeConsequence: consequenceMap[outcome],
    involvedCharacterIds: Array.from(new Set([charId, echo.sourceCharacterId, echo.targetCharacterId])),
  };
}

// 命运回响传播：把单个解决结果合入既有命运网，刷新密度与主导类型。
//  - resolution:  本次回响解决结果
//  - web:         当前命运网（会被读但不修改入参；返回新网）
// 返回：传播后更新的命运网（含 echoes 移除、resolutions 追加、密度与主导重算）
export function propagateFateConsequences(
  resolution: FateEchoResolution,
  web: FateWeb,
): FateWeb {
  const prevEchoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const prevResolutions = Array.isArray(web?.resolutions) ? web.resolutions : [];
  const remainingEchoes = prevEchoes.filter((e) => e && e.id !== resolution.echoId);
  const kindCounts = new Map<FateEchoKind, number>();
  for (const e of prevEchoes) {
    if (!e) continue;
    kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
  }
  const weightAdjust = resolution.outcome === 'fulfilled' ? -1 : resolution.outcome === 'severed' ? 1 : 0;
  const originalEcho = prevEchoes.find((e) => e && e.id === resolution.echoId);
  if (originalEcho) {
    kindCounts.set(originalEcho.kind, Math.max(0, (kindCounts.get(originalEcho.kind) || 0) + weightAdjust));
  }
  let dominantKind: FateEchoKind | null = null;
  let maxCount = -1;
  for (const [k, c] of kindCounts.entries()) {
    if (c > maxCount) { maxCount = c; dominantKind = k; }
  }
  const density = Math.max(0, Math.min(1, remainingEchoes.length / 10));
  return {
    echoes: remainingEchoes,
    resolutions: prevResolutions.concat([resolution]),
    threadDensity: density,
    dominantKind: maxCount > 0 ? dominantKind : null,
  };
}

// 命运轨迹预测：基于命运网 + 角色年龄，推演未来 years 年内每年可能的命运节点。
//  - character: 角色（提供当前年龄；用于设置预测起点）
//  - web:       当前命运网
//  - years:     预测年数（默认 5）
// 返回：按年龄升序的预测节点列表
export function predictFateTrajectory(
  character: { id?: string; age?: number },
  web: FateWeb,
  years: number = 5,
): FatePredictedOutcome[] {
  const startAge = typeof character?.age === 'number' ? character.age : 0;
  const horizon = Math.max(1, Math.min(50, Math.floor(years)));
  const echoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const density = typeof web?.threadDensity === 'number' ? web.threadDensity : 0;
  const dominant = web?.dominantKind ?? null;
  const out: FatePredictedOutcome[] = [];
  for (let i = 1; i <= horizon; i++) {
    const age = startAge + i;
    const baseProb = echoes.length > 0 ? 0.4 + density * 0.4 : 0.1;
    const dominantBoost = dominant ? 0.1 : 0;
    const probability = Math.max(0, Math.min(1, baseProb + dominantBoost - (i - 1) * 0.05));
    const dominantLabel = dominant ? describeFateEchoKind(dominant) : '未知';
    const predictedEvent = echoes.length > 0
      ? dominantLabel + '回响或将显形于今岁（' + age + '岁前后）'
      : '天地暂静，命运未起波澜';
    const rationale = echoes.length > 0
      ? '命运网密度约 ' + density.toFixed(2) + '，主导为' + dominantLabel
      : '命运网尚疏，无突出牵引';
    const alternativeBranches = [
      '延后：今岁未至，回响退入雾中',
      '转化：旧缘未断，转为新的因缘',
      '断绝：若强行斩断，回响或就此消散',
    ];
    out.push({
      age,
      predictedEvent,
      probability,
      rationale,
      alternativeBranches,
    });
  }
  return out;
}

// 命运网 prompt 摘要：把命运网压缩为 AI 上下文可用的中文短摘要，限制字符数。
//  - web:        当前命运网
//  - charLimit:  字符上限（默认 240）
// 返回：玩家不可见、但 AI 可读的摘要字符串（含主导类型 + 密度 + 待解决数）
export function summarizeFateWebForPrompt(
  web: FateWeb,
  charLimit: number = 240,
): string {
  const echoes = Array.isArray(web?.echoes) ? web.echoes : [];
  const resolutions = Array.isArray(web?.resolutions) ? web.resolutions : [];
  const density = typeof web?.threadDensity === 'number' ? web.threadDensity : 0;
  const dominant = web?.dominantKind ? describeFateEchoKind(web.dominantKind) : '无';
  const lines: string[] = [];
  lines.push('命运网：待解决回响 ' + echoes.length + '，已解决 ' + resolutions.length + '，织网密度 ' + density.toFixed(2) + '，主导类型 ' + dominant);
  const sampleCount = Math.min(echoes.length, 3);
  for (let i = 0; i < sampleCount; i++) {
    const e = echoes[i];
    if (!e) continue;
    lines.push('- [' + describeFateEchoKind(e.kind) + '] ' + (e.narrativeHook || '回响待应'));
  }
  let summary = lines.join('\n');
  if (summary.length > charLimit) summary = summary.slice(0, Math.max(0, charLimit - 1)) + '…';
  return summary;
}

// 内部辅助：把 FateEchoKind 翻成中文短语（AI prompt 友好）。
function describeFateEchoKind(kind: FateEchoKind): string {
  switch (kind) {
    case FateEchoKind.CharacterCallback: return '人物回响';
    case FateEchoKind.PlaceResonance: return '地点回响';
    case FateEchoKind.ItemRecall: return '物品回响';
    case FateEchoKind.PromiseFulfillment: return '誓约回响';
    case FateEchoKind.KarmaDebt: return '因果回响';
    case FateEchoKind.DestinyCollision: return '命数碰撞';
    default: return '命运回响';
  }
}
// ==================== Phase-J Worker C 跨函数因果连贯校验 ====================
// AI-J5xx 跨系统连贯校验：修仙特异化（constitution）/ 传承（inheritance）/
// 命运回响（fateEcho）/ 宗门（sect）四类状态之间的引用是否断裂。
// 设计原则：纯校验、纯函数、不动现有数据结构；输出可被 AI 上下文消费
// 的"因果链健康摘要"，并给世界内叙事提供衔接建议。

/**
 * AI-J521: 跨系统连贯性校验
 *  - character:           当前角色（用于自比对：是否在传承根上、是否被某个
 *                         命运回响的目标、是否属于宗门等）
 *  - inheritanceChain:    一条传承链（可为 null）
 *  - fateEchoes:          命运回响列表（可为 null）
 *  - sectState:           角色当前宗门状态（{ sectId, sectName, role, ... }）
 * 返回 { breaks: [{ system, severity, reason }] }，severity ∈ info|warn|error。
 *  - error: 引用缺失或明显冲突
 *  - warn:  可能因叙事尚未展开导致的潜在断裂
 *  - info:  仅供 AI 知晓的提示（如传承链过短、无当前宗门）
 */
export function reconcileFateAndInheritance(
  fateEcho: FateEchoTrigger,
  inheritancePool: InheritancePool,
): { compatible: boolean; suggestedNarrative: string } {
  if (!fateEcho || typeof fateEcho !== 'object') {
    return { compatible: false, suggestedNarrative: '回响不存在，无法与传承池衔接' };
  }
  if (!inheritancePool || typeof inheritancePool !== 'object') {
    return { compatible: false, suggestedNarrative: '传承池不存在，无法与回响衔接' };
  }
  if (typeof inheritancePool.availableSlots !== 'number' || inheritancePool.availableSlots <= 0) {
    return { compatible: false, suggestedNarrative: '传承池名额已尽，回响暂无可承接之位' };
  }

  // 类别匹配：物品/因果回响可与法器/血脉类传承衔接；人物/地点回响
  // 可与师徒/门派类传承衔接
  const kind = inheritancePool.kind;
  let categoryMatch = false;
  if (kind === 'master-disciple' || kind === 'bloodline' || kind === 'mentor-guild') {
    categoryMatch = fateEcho.kind === FateEchoKind.CharacterCallback || fateEcho.kind === FateEchoKind.PlaceResonance || fateEcho.kind === FateEchoKind.PromiseFulfillment;
  } else if (kind === 'artifact' || kind === 'secret-tome' || kind === 'talisman') {
    categoryMatch = fateEcho.kind === FateEchoKind.ItemRecall || fateEcho.kind === FateEchoKind.KarmaDebt;
  } else {
    // 兜底：命数碰撞通常与任何传承可衔接
    categoryMatch = fateEcho.kind === FateEchoKind.DestinyCollision;
  }

  // 角色代际匹配：回响的 source 出现在传承池 hostCharacterIds 里视为强关联
  let strongLink = false;
  if (Array.isArray(inheritancePool.hostCharacterIds) && fateEcho.sourceCharacterId) {
    strongLink = inheritancePool.hostCharacterIds.indexOf(fateEcho.sourceCharacterId) >= 0;
  }

  const compatible = categoryMatch || strongLink;
  let narrative: string;
  if (strongLink) {
    narrative = '回响之源恰在传承池宿主之列（' + (inheritancePool.name || inheritancePool.id) + '），可顺势承接而解';
  } else if (categoryMatch) {
    narrative = '回响类属与传承池相合（' + (inheritancePool.name || inheritancePool.id) + '），可借其位而解';
  } else {
    narrative = '回响与传承池类属暂不相合，需另寻他法或等待传承池轮转';
  }
  if (fateEcho.urgency === 'critical' && !strongLink) {
    narrative += '；回响紧迫，宿主可考虑破例延请';
  }
  return { compatible, suggestedNarrative: narrative };
}

/**
 * AI-J524: 给 AI 上下文的"因果链健康摘要"
 *  - character:  当前角色（用于拼接开头）
 *  - breaks:     validateCrossSystemContinuity 返回的 breaks 列表（允许外部注入）
 *                若不传则自动调用一次 validateCrossSystemContinuity（传入 null 系统）
 * 返回：限制字符数的中文短摘要，含 breaks 计数、严重度分布、关键提示。
 * 玩家不可见，仅 AI prompt 使用。
 */
interface PhaseKEndingCandidate {
  archetype: EndingArchetype;
  weight: number;
  reason: string;
}

export interface PhaseKEndingEvaluation {
  triggeredEndings: PhaseKEndingCandidate[];
  primaryEnding: {
    archetype: EndingArchetype;
    endingId: string;
    age: number;
    summary: string;
    inheritancePool: InheritancePool[];
  } | null;
  inheritancePool: InheritancePool[];
}

interface PhaseKProtagonistCandidate {
  id: string;
  age: number;
  realm: string;
  spiritualRoot: string;
  bloodline: string;
  karmaTags: string[];
  inherited: { poolId: string; kind: InheritanceKind }[];
  traitNarrative: string;
}

export interface PhaseKProtagonistSelection {
  selectedId: string;
  narrative: string;
  eligibility: number;
  scores: {
    root: number;
    blood: number;
    karma: number;
    preference: number;
    inheritance: number;
    total: number;
  };
  reason: string;
}

export interface PhaseKCycleSummaryInput {
  ending?: { archetype?: EndingArchetype; summary?: string; age?: number } | null;
  pool?: InheritancePool[] | null;
  nextProtagonist?: { id?: string; age?: number; realm?: string; traitNarrative?: string } | null;
  charLimit?: number;
}

// ---------- helpers (private to this block) ----------
function _phaseKAClassifyCause(causeOfDeath: any): { bias: Partial<Record<EndingArchetype, number>>; biasLabel: string } {
  const text = (typeof causeOfDeath === 'string' ? causeOfDeath
    : causeOfDeath && typeof causeOfDeath === 'object' ? (causeOfDeath.cause || causeOfDeath.kind || causeOfDeath.label || '')
    : '').toString();
  const lower = text.toLowerCase();
  const bias: Partial<Record<EndingArchetype, number>> = {};
  let biasLabel = 'unknown';
  if (/ascend|飞升|天劫|渡劫|列仙|tribulation/.test(lower)) {
    bias['ascend-immortal'] = 0.65;
    biasLabel = 'ascend-immortal';
  } else if (/sit|坐化|寿终|age|寿元|old/.test(lower)) {
    bias['sit-death'] = 0.55;
    biasLabel = 'sit-death';
  } else if (/demon|魔|fall|心魔|obsess/.test(lower)) {
    bias['fall-demonic'] = 0.6;
    biasLabel = 'fall-demonic';
  } else if (/sect|开宗|创派|found|传道|teach/.test(lower)) {
    bias['found-sect'] = 0.5;
    biasLabel = 'found-sect';
  } else if (/reincarn|转世|轮回|rebirth|samsara/.test(lower)) {
    bias['reincarnate'] = 0.55;
    biasLabel = 'reincarnate';
  } else if (/escape|逃|飞渡|穿越|leave|vacuum/.test(lower)) {
    bias['escape-world'] = 0.5;
    biasLabel = 'escape-world';
  } else if (/collapse|天地崩|灭世|世界崩毁|apocal/.test(lower)) {
    bias['world-collapse'] = 0.65;
    biasLabel = 'world-collapse';
  } else if (/fade|归凡|散功|隐退|退隐|withdraw/.test(lower)) {
    bias['fade-into-mortal'] = 0.5;
    biasLabel = 'fade-into-mortal';
  }
  return { bias, biasLabel };
}

function _phaseKANormalizeCharacter(character: any): {
  id: string; age: number; realm: string; faction: string; cause: string;
} {
  const c = character && typeof character === 'object' ? character : {};
  return {
    id: typeof c.id === 'string' ? c.id : 'char-unknown',
    age: typeof c.age === 'number' && Number.isFinite(c.age) && c.age >= 0 ? c.age : 0,
    realm: typeof c.realm === 'string' ? c.realm : (typeof c.cultivation === 'string' ? c.cultivation : 'mortal'),
    faction: typeof c.faction === 'string' ? c.faction : (typeof c.sect === 'string' ? c.sect : ''),
    cause: typeof c.cause === 'string' ? c.cause : '',
  };
}

function _phaseKAGeneratePoolId(charId: string, archetype: EndingArchetype, kind: string): string {
  return 'pool-' + charId + '-' + archetype + '-' + kind;
}

function _phaseKAClampUnit(n: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ---------- main exports ----------

/**
 * Phase-K 1/4: triggerEndingEvaluation
 * 角色死亡时调用：评估可触发的结局，写入传承池。
 *  - character: 当前角色（id / age / realm / faction / cause）
 *  - worldState: 世界状态（可选；用于查询境界峰顶 / 宗门敌对 / 因缘密度）
 *  - causeOfDeath: 死因字符串或 { cause: string } 对象
 * 返回 { triggeredEndings, primaryEnding, inheritancePool }
 *  - triggeredEndings: 所有候选结局（含权重 + 触发原因）
 *  - primaryEnding: 落定的主要结局（含 inheritancePool 草稿）；可能为 null
 *  - inheritancePool: 顶层传承池列表（与 primaryEnding.inheritancePool 一致，便于直接挂载）
 */
export function triggerEndingEvaluation(
  character: any,
  worldState: any,
  causeOfDeath: any,
): PhaseKEndingEvaluation {
  const ch = _phaseKANormalizeCharacter(character);
  const causeBias = _phaseKAClassifyCause(causeOfDeath || ch.cause);
  const ws = worldState && typeof worldState === 'object' ? worldState : null;
  const ageGate = ch.age >= 60 ? 0.15 : 0; // 寿元越接近暮年越倾向坐化/归凡
  const realmPower = (ch.realm === 'ascension' || ch.realm === 'tribulation') ? 0.4 : 0;

  // 8 个原型 + 基础权重
  const base: Record<EndingArchetype, number> = {
    'ascend-immortal': 0.05 + realmPower,
    'sit-death': 0.10 + ageGate,
    'fall-demonic': 0.05,
    'found-sect': 0.10 + (ch.faction ? 0.10 : 0),
    'reincarnate': 0.08,
    'escape-world': 0.04,
    'world-collapse': 0.02,
    'fade-into-mortal': 0.10 + ageGate,
  };
  // 应用 cause bias
  const cands: PhaseKEndingCandidate[] = (Object.keys(base) as EndingArchetype[]).map((arch) => ({
    archetype: arch,
    weight: _phaseKAClampUnit((base[arch] || 0) + (causeBias.bias[arch] || 0), 0.95),
    reason: 'cause=' + (causeBias.biasLabel || 'unknown') + ', realm=' + ch.realm + ', age=' + ch.age,
  }));

  // 过滤权重 < 0.05 的低概率
  const filtered = cands.filter((c) => c.weight >= 0.05).sort((a, b) => b.weight - a.weight);

  // 选主结局：权重最高；平局时倾向原表顺序
  const top = filtered[0] || null;
  let primaryEnding: PhaseKEndingEvaluation['primaryEnding'] = null;
  let pool: InheritancePool[] = [];
  if (top) {
    const endingId = 'ending-' + ch.id + '-' + top.archetype;
    const summary = top.archetype + ' · ' + ch.id + ' 于 ' + ch.age + ' 岁落定；' + (ch.realm || 'mortal') + '，因 ' + (causeBias.biasLabel || 'unknown') + ' 而终。';
    pool = seedInheritancePoolFromEnding(
      { archetype: top.archetype, endingId, summary, age: ch.age, character: ch } as any,
      ch,
    );
    primaryEnding = {
      archetype: top.archetype,
      endingId,
      age: ch.age,
      summary,
      inheritancePool: pool,
    };
  }

  return {
    triggeredEndings: filtered,
    primaryEnding,
    inheritancePool: pool,
  };
}

/**
 * Phase-K 2/4: seedInheritancePoolFromEnding
 * 从结局抽取可继承条目（功法/法宝/灵宠/血脉/信物/道场/未完之事），生成继承池。
 *  - ending: 任意形状 { archetype, endingId, summary, age, character }
 *  - character: 当前角色（用于 hostCharacterIds / lockedUntilAge）
 * 返回 InheritancePool[]（典型 3-5 项）
 */
export function seedInheritancePoolFromEnding(
  ending: any,
  character: any,
): InheritancePool[] {
  const e = ending && typeof ending === 'object' ? ending : {};
  const arch: EndingArchetype = (typeof e.archetype === 'string') ? e.archetype : 'fade-into-mortal';
  const ch = _phaseKANormalizeCharacter(character || e.character);
  const endingId = typeof e.endingId === 'string' ? e.endingId : ('ending-' + ch.id + '-' + arch);
  const age = typeof e.age === 'number' && e.age >= 0 ? e.age : ch.age;

  // 不同结局原型的 kind 优先级
  const kindPriority: InheritanceKind[] = (
    arch === 'ascend-immortal' ? ['technique', 'artifact', 'bond']
    : arch === 'sit-death' ? ['technique', 'artifact', 'bond']
    : arch === 'fall-demonic' ? ['artifact', 'bloodline', 'technique']
    : arch === 'found-sect' ? ['sect-lineage', 'technique', 'token']
    : arch === 'reincarnate' ? ['bloodline', 'technique', 'token']
    : arch === 'escape-world' ? ['token', 'technique', 'artifact']
    : arch === 'world-collapse' ? ['artifact', 'bond', 'sect-lineage']
    : ['technique', 'token', 'bond']
  );

  const lockSpan = age + 6; // 主角死后 6 年才允许继承
  const pools: InheritancePool[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < kindPriority.length; i++) {
    const k = kindPriority[i];
    const id = _phaseKAGeneratePoolId(ch.id, arch, k);
    if (seen.has(id)) continue;
    seen.add(id);
    const name = k + ' · ' + arch + ' 遗承';
    const slots = (arch === 'found-sect' || arch === 'world-collapse') ? 2 : 1;
    pools.push({
      id,
      name,
      kind: k,
      availableSlots: slots,
      lockedUntilAge: lockSpan,
      hostCharacterIds: [ch.id],
    });
  }

  // 至少 3 项；不足则补 technique/token/bond 兜底
  const fallbackKinds: InheritanceKind[] = ['technique', 'token', 'bond'];
  for (const k of fallbackKinds) {
    if (pools.length >= 3) break;
    const id = _phaseKAGeneratePoolId(ch.id, arch, k + '-fb');
    if (seen.has(id)) continue;
    seen.add(id);
    pools.push({
      id,
      name: k + ' · 遗承',
      kind: k,
      availableSlots: 1,
      lockedUntilAge: lockSpan,
      hostCharacterIds: [ch.id],
    });
  }
  return pools;
}

/**
 * Phase-K 3/4: selectNextProtagonist
 * 从候选人物中选择下一代主角。
 *  - pool: 传承池（用于 inheritance 评分）
 *  - worldState: 世界状态（用于 realm peak / 因缘密度）
 *  - candidateList: 候选人物数组 [{ id, age, realm, spiritualRoot, bloodline, karmaTags, traitNarrative }]
 * 返回 { selectedId, narrative, eligibility, scores, reason }
 *  - eligibility: 0-1 综合适配度
 *  - scores: 各维度分项
 */
export function selectNextProtagonist(
  pool: InheritancePool[] | null | undefined,
  worldState: any,
  candidateList: any[],
): PhaseKProtagonistSelection {
  const poolArr = Array.isArray(pool) ? pool : [];
  const ws = worldState && typeof worldState === 'object' ? worldState : null;
  const candidates: PhaseKProtagonistCandidate[] = Array.isArray(candidateList)
    ? candidateList.filter((c) => c && typeof c === 'object').map((c) => ({
      id: typeof c.id === 'string' ? c.id : 'cand-unknown',
      age: typeof c.age === 'number' && c.age >= 0 ? c.age : 0,
      realm: typeof c.realm === 'string' ? c.realm : 'mortal',
      spiritualRoot: typeof c.spiritualRoot === 'string' ? c.spiritualRoot : (typeof c.root === 'string' ? c.root : 'unknown'),
      bloodline: typeof c.bloodline === 'string' ? c.bloodline : '',
      karmaTags: Array.isArray(c.karmaTags) ? c.karmaTags.filter((t: any) => typeof t === 'string') : [],
      inherited: Array.isArray(c.inherited) ? c.inherited : [],
      traitNarrative: typeof c.traitNarrative === 'string' ? c.traitNarrative : '',
    }))
    : [];

  if (candidates.length === 0) {
    return {
      selectedId: '',
      narrative: '无可继承者候选；修仙轮转暂止。',
      eligibility: 0,
      scores: { root: 0, blood: 0, karma: 0, preference: 0, inheritance: 0, total: 0 },
      reason: 'no-candidates',
    };
  }

  const playerPref = (ws && typeof ws.playerInterventionPreference === 'string')
    ? ws.playerInterventionPreference
    : (ws && typeof ws.protagonistSelectionPreference === 'string' ? ws.protagonistSelectionPreference : 'favor-neutral');
  const favorRoot = playerPref === 'favor-root' || playerPref === 'favor-destiny';
  const favorBlood = playerPref === 'favor-bloodline';

  // 灵根 / 血脉打分映射
  const rootScore = (r: string): number => {
    if (!r || r === 'unknown') return 0.4;
    if (/tianling|天灵|纯阳|纯阴|先天|primordial/.test(r)) return 1.0;
    if (/双灵|dual|single/.test(r)) return 0.7;
    if (/三灵|triple/.test(r)) return 0.55;
    if (/杂灵|mixed|wu/.test(r)) return 0.35;
    return 0.5;
  };
  const bloodScore = (b: string, p: InheritancePool[]): number => {
    if (!b) return 0.2;
    const poolsHaveBlood = p.some((x) => x && x.kind === 'bloodline');
    if (!poolsHaveBlood) return 0.4;
    if (/嫡|直系|传承|heir|lineage/.test(b)) return 0.9;
    if (/旁|远|collateral/.test(b)) return 0.55;
    return 0.45;
  };
  const karmaScore = (tags: string[]): number => {
    if (tags.length === 0) return 0.4;
    let s = 0;
    let n = 0;
    for (const t of tags) {
      if (/因缘|旧约|师徒|誓言|fate|promise|master/.test(t)) { s += 0.9; n++; }
      else if (/仇|敌|杀|feud|enemy/.test(t)) { s += 0.3; n++; }
      else if (/中|平|neutral/.test(t)) { s += 0.5; n++; }
      else { s += 0.5; n++; }
    }
    return n === 0 ? 0.4 : Math.max(0.1, Math.min(1, s / n));
  };
  const inheritanceScore = (inherited: { poolId: string; kind: InheritanceKind }[], p: InheritancePool[]): number => {
    if (!Array.isArray(inherited) || inherited.length === 0 || p.length === 0) return 0.2;
    let matches = 0;
    for (const ih of inherited) {
      if (!ih || typeof ih.poolId !== 'string') continue;
      const matched = p.some((x) => x && x.id === ih.poolId);
      if (matched) matches++;
    }
    return Math.max(0.1, Math.min(1, matches / Math.max(1, Math.min(inherited.length, p.length))));
  };

  // 计算每个候选分
  const scored = candidates.map((c) => {
    const root = rootScore(c.spiritualRoot);
    const blood = bloodScore(c.bloodline, poolArr);
    const karma = karmaScore(c.karmaTags);
    const inherit = inheritanceScore(c.inherited, poolArr);
    let preference = 0.5;
    if (favorRoot && root >= 0.7) preference += 0.15;
    if (favorBlood && blood >= 0.7) preference += 0.15;
    const totalRaw = 0.30 * root + 0.30 * blood + 0.25 * karma + 0.15 * preference + 0.10 * (inherit * 0.5 + 0.5);
    const total = _phaseKAClampUnit(totalRaw, 0);
    return { cand: c, scores: { root, blood, karma, preference, inheritance: inherit, total } };
  });

  scored.sort((a, b) => b.scores.total - a.scores.total);
  const winner = scored[0];
  const id = winner.cand.id;
  const reasonCode = winner.scores.total >= 0.7 ? 'strong-match'
    : winner.scores.total >= 0.55 ? 'good-match'
    : winner.scores.total >= 0.4 ? 'marginal-match' : 'weak-match';
  const narrative = '由 ' + id + ' 接掌（' + reasonCode + '），其灵根 ' + winner.cand.spiritualRoot + '，血脉 ' + (winner.cand.bloodline || '无明显传承') + '，适配度 ' + winner.scores.total.toFixed(3) + '。';

  return {
    selectedId: id,
    narrative,
    eligibility: winner.scores.total,
    scores: winner.scores,
    reason: reasonCode,
  };
}

/**
 * Phase-K 4/4: summarizeCycleForPrompt
 * 给 AI 上下文的"本代轮回摘要"。
 *  - ending: { archetype, summary, age } 上一代结局
 *  - pool: InheritancePool[] 传承池（用于算池容量）
 *  - nextProtagonist: { id, age, realm, traitNarrative } 下一代主角
 *  - charLimit: 字符上限（默认 360），超出部分以 ellipsis 截断
 * 返回 prompt-ready 字符串
 */
export function summarizeCycleForPrompt(
  ending: any,
  pool: InheritancePool[] | null | undefined,
  nextProtagonist: any,
  charLimit?: number,
): string {
  const e = ending && typeof ending === 'object' ? ending : {};
  const arch = (typeof e.archetype === 'string') ? e.archetype : 'fade-into-mortal';
  const age = typeof e.age === 'number' && e.age >= 0 ? e.age : null;
  const summary = typeof e.summary === 'string' && e.summary ? e.summary : ('上一代 ' + arch + ' 落定。');

  const poolArr = Array.isArray(pool) ? pool : [];
  const poolCount = poolArr.length;
  const poolKinds: string[] = [];
  for (const p of poolArr) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.kind === 'string' && poolKinds.indexOf(p.kind) < 0) poolKinds.push(p.kind);
    const items = (p as any).inheritedItems;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it && typeof it === 'object' && typeof it.kind === 'string' && poolKinds.indexOf(it.kind) < 0) {
          poolKinds.push(it.kind);
        }
      }
    }
  }
  const poolLine = poolCount > 0
    ? '传承池共 ' + poolCount + ' 项，类目 ' + (poolKinds.join('、') || 'unknown') + '。'
    : '未留传承池。';

  const np = nextProtagonist && typeof nextProtagonist === 'object' ? nextProtagonist : null;
  const npLine = np
    ? '下一代主角 ' + (typeof np.id === 'string' ? np.id : '未明') + '（' + (typeof np.age === 'number' ? np.age : '?') + ' 岁 / ' + (typeof np.realm === 'string' ? np.realm : 'mortal') + '）：' + (typeof np.traitNarrative === 'string' && np.traitNarrative ? np.traitNarrative : '尚无明确描述。')
    : '尚无明确下一代主角。';

  const ageLine = (age !== null) ? '于 ' + age + ' 岁落定。' : '落定时间未明。';

  let s = '本代轮回：' + arch + ' · ' + ageLine + ' ' + summary + ' ' + poolLine + ' ' + npLine;
  const limit = (typeof charLimit === 'number' && Number.isFinite(charLimit) && charLimit > 0)
    ? Math.floor(charLimit)
    : 360;
  if (s.length > limit) {
    s = s.slice(0, Math.max(0, limit - 1)) + '…';
  }
  return s;
}



// ======================== Phase-K Worker B (cycle-and-ui-projection): UI Projection ========================
// Additive only. Each function takes (character, sourceData) and returns a
// PlayerUIProjection that the UI layer can render. The projection contains
// a primary slot and a list of secondary slots, each carrying tone + renderHint.
// No fs/IO; pure in-memory projection so this stays client-component safe.
