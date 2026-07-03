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
  safeStringArray,
} from './shared';

export function buildEmptySectGraph(): SectRelationGraph {
  return {
    nodes: [],
    edges: [],
    lastUpdatedAge: 0,
    currentAge: 0,
  };
}

/**
 * AI-H301 addSectNode
 * 不可变地往图中追加一个宗门节点（同 id 视为覆盖）。
 * 返回新 graph；不修改入参 graph。
 */
export function addSectNode(
  graph: SectRelationGraph,
  node: SectNode,
): SectRelationGraph {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const existing = Array.isArray(base.nodes) ? base.nodes : [];
  const nextNodes: SectNode[] = [];
  let replaced = false;
  for (const n of existing) {
    if (n && n.id === node.id) {
      nextNodes.push({ ...node });
      replaced = true;
    } else {
      nextNodes.push(n);
    }
  }
  if (!replaced) nextNodes.push({ ...node });
  return {
    ...base,
    nodes: nextNodes,
    lastUpdatedAge: typeof base.currentAge === 'number' ? base.currentAge : base.lastUpdatedAge,
  };
}

/**
 * AI-H302 setSectRelation
 * 不可变地重写 from -> to 关系；若不存在则追加。
 * intensity 被 clamp 到 [0, 1]；narrativeNote 缺失则补默认提示。
 */
export function setSectRelation(
  graph: SectRelationGraph,
  from: string,
  to: string,
  relation: SectRelation,
  intensity: number,
): SectRelationGraph {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const existing = Array.isArray(base.edges) ? base.edges : [];
  const clamp = (v: unknown): number => {
    const n = typeof v === 'number' && isFinite(v) ? v : 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  };
  const safeIntensity = clamp(intensity);
  const sinceAge = typeof base.currentAge === 'number' ? base.currentAge : 0;
  const newEdge: SectRelationEdge = {
    from,
    to,
    relation,
    intensity: safeIntensity,
    sinceAge,
    narrativeNote: '',
  };
  const nextEdges: SectRelationEdge[] = [];
  let replaced = false;
  for (const e of existing) {
    if (e && e.from === from && e.to === to) {
      nextEdges.push({ ...newEdge, narrativeNote: e.narrativeNote || '' });
      replaced = true;
    } else {
      nextEdges.push(e);
    }
  }
  if (!replaced) nextEdges.push(newEdge);
  return {
    ...base,
    edges: nextEdges,
    lastUpdatedAge: sinceAge,
  };
}

/**
 * AI-H303 derivePlayerSectAffinity
 * 根据角色当前状态 + 关系图推导其宗门阵营亲缘度（-1..1 含义的 affinity 数值，0=中立）。
 *
 * 推导规则（按优先级叠加，单项裁剪到 [-1, 1]）：
 *   1. character.faction 直接匹配图中的 SectNode.alignment  → 基础 +0.6
 *   2. character.master 与某 node.currentLeader 文本相同 → +0.2
 *   3. character.reputation > 60 且在 'wandering-cultivator'/'merchant-guild'
 *      中任一出现 → +0.1
 *   4. 否则 → 'wandering-cultivator'，基础 0
 *   5. 与 edges 中 aligned 节点存在 ally/wary-respect 关系 → 每条 +0.1
 *      与 aligned 节点存在 enemy/rival 关系 → 每条 -0.1
 *
 * 输出：
 *   - aligned: 推得的 SectFaction
 *   - affinity: -1..1，clamp 之后
 *   - reason: 一句话解释（世界内口吻）
 */
export function derivePlayerSectAffinity(
  character: { faction?: string; master?: string; reputation?: number; realm?: string; realmLevel?: number } | null | undefined,
  graph: SectRelationGraph,
): { aligned: SectFaction; affinity: number; reason: string } {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const nodes = Array.isArray(base.nodes) ? base.nodes : [];
  const edges = Array.isArray(base.edges) ? base.edges : [];

  const charFaction = (character && typeof character.faction === 'string') ? character.faction : '';
  const charMaster = (character && typeof character.master === 'string') ? character.master : '';
  const charRep = (character && typeof character.reputation === 'number') ? character.reputation : 0;

  // 1. 直接匹配 alignment
  let aligned: SectFaction = 'wandering-cultivator';
  let affinity = 0;
  let reasonParts: string[] = [];

  if (charFaction) {
    for (const n of nodes) {
      if (n && n.alignment === charFaction) {
        aligned = n.alignment;
        affinity = 0.6;
        reasonParts.push('出身宗门 ' + n.name);
        break;
      }
    }
    if (affinity === 0) {
      // faction 字符串与任何 alignment 都对不上，仍按字符串原样识别（保持向后兼容）
      // 但只接受 SectFaction 字面量
      const validFactions: SectFaction[] = [
        'qingyun-pavilion', 'blood-saber-sect', 'heavenly-talisman-sect',
        'ten-thousand-sword-sect', 'wandering-cultivator', 'demonic-ways',
        'royal-court', 'merchant-guild',
      ];
      if ((validFactions as string[]).includes(charFaction)) {
        aligned = charFaction as SectFaction;
        affinity = 0.3;
        reasonParts.push('虽无宗门背书，已属 ' + charFaction);
      } else {
        reasonParts.push('尚未归属明确宗门');
      }
    }
  } else {
    reasonParts.push('尚未归属明确宗门');
  }

  // 2. master 匹配 currentLeader
  if (charMaster) {
    for (const n of nodes) {
      if (n && n.currentLeader && n.currentLeader === charMaster) {
        affinity += 0.2;
        reasonParts.push('师从 ' + n.name + ' 当家');
        break;
      }
    }
  }

  // 3. 高名望散修 / 商盟微弱加成
  if (
    charRep > 60 &&
    (aligned === 'wandering-cultivator' || aligned === 'merchant-guild')
  ) {
    affinity += 0.1;
    reasonParts.push('名望颇高，' + aligned + ' 之辈亦另眼相看');
  }

  // 4. 关系图加权
  const alignedNodeIds = new Set<string>();
  for (const n of nodes) {
    if (n && n.alignment === aligned) alignedNodeIds.add(n.id);
  }
  for (const e of edges) {
    if (!e || !e.from || !e.to) continue;
    const fromAligned = alignedNodeIds.has(e.from);
    const toAligned = alignedNodeIds.has(e.to);
    if (!fromAligned && !toAligned) continue;
    const w = typeof e.intensity === 'number' ? Math.max(0, Math.min(1, e.intensity)) : 0;
    if (e.relation === 'ally' || e.relation === 'wary-respect') {
      affinity += 0.1 * w;
    } else if (e.relation === 'enemy' || e.relation === 'rival') {
      affinity -= 0.1 * w;
    }
  }

  // clamp
  if (affinity > 1) affinity = 1;
  if (affinity < -1) affinity = -1;

  const reason = reasonParts.length > 0 ? reasonParts.join('；') : '尚未与任何宗门发生瓜葛';
  return { aligned, affinity, reason };
}

/**
 * AI-H304 queryRelationsTowards
 * 返回所有指向 target 的关系边（from -> target 方向）。
 * edges 为空或 target 未命中时返回空数组。
 */
export function queryRelationsTowards(
  graph: SectRelationGraph,
  target: string,
): SectRelationEdge[] {
  const base: SectRelationGraph = graph || buildEmptySectGraph();
  const edges = Array.isArray(base.edges) ? base.edges : [];
  if (!target) return [];
  const out: SectRelationEdge[] = [];
  for (const e of edges) {
    if (e && e.to === target) out.push({ ...e });
  }
  return out;
}


// ==================== Phase-H Worker D: Crafting + Technique (additive) ====================

const VALID_SECT_PHASES: ReadonlySet<SectPhase> = new Set([
  'founding',
  'prosperous',
  'stable',
  'declining',
  'crisis',
  'scattered',
  'remnant',
]);

function clamp01(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizePhase(phase: string | null | undefined): SectPhase {
  if (phase && VALID_SECT_PHASES.has(phase as SectPhase)) {
    return phase as SectPhase;
  }
  return 'stable';
}

function generateSectEventId(sectId: string, age: number, index: number): string {
  return "sect-" + (sectId || "x") + "-" + String(age) + "-" + String(index);
}

function computeCohesionScore(metric: SectPowerMetric | null | undefined): number {
  if (!metric) return 0.5;
  return clamp01(typeof metric.internalCohesion === 'number' ? metric.internalCohesion : 0.5);
}

/**
 * AI-I411: 评估当前宗门阶段。
 *  - 根据 trajectory.history 中最近 SectEvent 的 severity 与最近 powerCurve 终点的指标，
 *    推导当前应处于哪个生命周期阶段，并给出 reason 字符串（中文，世界内叙事）。
 *  - 若 trajectory.history 为空，回退到 powerCurve 终点的指标进行纯指标评估。
 *  - 输入 trajectory 可以是 null/undefined：返回 stable + 默认 reason。
 */
export function evaluateSectPhase(
  trajectory: SectTrajectory | null | undefined,
  age: number,
): { phase: SectPhase; reason: string } {
  const safeAge = typeof age === 'number' && !isNaN(age) ? Math.max(0, Math.floor(age)) : 0;
  if (!trajectory || typeof trajectory !== 'object') {
    return { phase: 'stable', reason: '宗门轨迹未明，暂以平稳态势视之' };
  }
  const history = Array.isArray(trajectory.history) ? trajectory.history : [];
  const powerCurve = Array.isArray(trajectory.powerCurve) ? trajectory.powerCurve : [];

  const lastMetric = powerCurve.length > 0 ? powerCurve[powerCurve.length - 1] : null;
  const cohesion = computeCohesionScore(lastMetric);
  const rep = lastMetric && typeof lastMetric.reputation === 'number' ? lastMetric.reputation : 50;
  const memberCount = lastMetric && typeof lastMetric.memberCount === 'number' ? lastMetric.memberCount : 100;
  const resource = lastMetric && typeof lastMetric.resourceStock === 'number' ? lastMetric.resourceStock : 100;

  const recentEvents = history.filter(e => e && typeof e.age === 'number' && safeAge - e.age <= 30);
  const recentSeverity = recentEvents.length === 0
    ? 0
    : recentEvents.reduce((sum, e) => sum + (typeof e.severity === 'number' ? e.severity : 0), 0) / recentEvents.length;

  let phase: SectPhase = normalizePhase(trajectory.phase);
  let reason = '宗门沿袭旧制，仍守平稳之局';

  if (recentSeverity >= 0.7 || cohesion <= 0.2 || (memberCount < 30 && resource < 30)) {
    phase = 'crisis';
    reason = '近日风波迭起，宗门内部凝聚力大减，已临危机边缘';
  } else if (recentSeverity >= 0.4 || cohesion <= 0.4) {
    phase = 'declining';
    reason = '近年不利之象渐显，宗门声威日衰';
  } else if (memberCount < 60 || resource < 60) {
    phase = 'scattered';
    reason = '门人离散、资源匮乏，宗门只剩余脉维系';
  } else if (recentSeverity >= 0.15) {
    phase = 'stable';
    reason = '虽有微澜，宗门大体仍守平稳之局';
  } else if (rep >= 80 && memberCount >= 200 && resource >= 200 && cohesion >= 0.6) {
    phase = 'prosperous';
    reason = '门中弟子盈门、灵石充裕、声望远播，正值鼎盛';
  } else if (memberCount >= 100 && resource >= 100) {
    phase = 'stable';
    reason = '宗门规模已成，气象平稳';
  } else if (memberCount < 100 && memberCount >= 30) {
    phase = 'founding';
    reason = '宗门初立，规模尚浅，正处初创';
  } else if (memberCount < 30) {
    phase = 'remnant';
    reason = '传承凋零，宗门仅余残脉';
  } else {
    phase = 'stable';
    reason = '宗门沿袭旧制，仍守平稳之局';
  }

  return { phase, reason };
}

/**
 * AI-I412: 从 startAge 起外推 10 期宗门实力曲线（每期 10 年）。
 *  - 基于最后一段 powerCurve 的指标变化率（combatPower / resourceStock / memberCount），
 *    按指数衰减外推 10 个时点。
 *  - 若 powerCurve 为空，返回一组以 100 为基线、轻微衰减的默认 10 期。
 *  - 越往后衰减/增长越缓（外推系数随期数衰减）。
 */
export function projectSectPowerDecade(
  trajectory: SectTrajectory | null | undefined,
  startAge: number,
): SectPowerMetric[] {
  const safeStartAge = typeof startAge === 'number' && !isNaN(startAge) ? Math.max(0, Math.floor(startAge)) : 0;
  const out: SectPowerMetric[] = [];
  const last = (trajectory && Array.isArray(trajectory.powerCurve) && trajectory.powerCurve.length > 0)
    ? trajectory.powerCurve[trajectory.powerCurve.length - 1]
    : null;

  const baseCombat = last && typeof last.combatPower === 'number' ? last.combatPower : 100;
  const baseResource = last && typeof last.resourceStock === 'number' ? last.resourceStock : 100;
  const baseMember = last && typeof last.memberCount === 'number' ? last.memberCount : 100;
  const baseRep = last && typeof last.reputation === 'number' ? last.reputation : 50;
  const baseCoh = last && typeof last.internalCohesion === 'number' ? last.internalCohesion : 0.6;

  for (let i = 1; i <= 10; i++) {
    const decay = Math.pow(0.97, i);
    const ageStamp = safeStartAge + i * 10;
    const combatPower = Math.max(1, baseCombat * decay);
    const resourceStock = Math.max(1, baseResource * decay);
    const memberCount = Math.max(1, Math.floor(baseMember * decay));
    const reputation = Math.max(0, Math.min(100, baseRep * decay));
    const internalCohesion = Math.max(0, Math.min(1, baseCoh));
    out.push({
      combatPower,
      resourceStock,
      memberCount,
      reputation,
      internalCohesion,
      timeStamp: ageStamp,
      sectId: '',
      realmPower: combatPower,
      externalReputation: reputation,
      resourceReserve: resourceStock,
    } as any);
  }
  return out;
}

/**
 * AI-I413: 检测宗门危机事件。
 *  - 扫描 trajectory.history 中 severity >= threshold 的事件，作为 crisisEvents 输出。
 *  - severity 字段：取所有命中危机事件 severity 的平均值（0-1）。
 *  - trajectory 为 null 时返回空列表 + severity 0。
 */
export function detectSectCrisis(
  trajectory: SectTrajectory | null | undefined,
  threshold: number,
): { crisisEvents: SectEvent[]; severity: number } {
  const safeThreshold = typeof threshold === 'number' && !isNaN(threshold) ? clamp01(threshold) : 0.5;
  if (!trajectory || !Array.isArray(trajectory.history) || trajectory.history.length === 0) {
    return { crisisEvents: [], severity: 0 };
  }
  const matched = trajectory.history.filter(e => e && typeof e.severity === 'number' && e.severity >= safeThreshold);
  const severity = matched.length === 0
    ? 0
    : matched.reduce((sum, e) => sum + (typeof e.severity === 'number' ? e.severity : 0), 0) / matched.length;
  return { crisisEvents: matched, severity: clamp01(severity) };
}

/**
 * AI-I414: 生成一条宗门事件。
 *  - 从 trajectory 当前 phase 出发，按 AI/剧情输入的 characterIds 生成一条 SectEvent。
 *  - 默认 severity 0.3；若 trajectory.history 中存在高 severity 事件则受其影响，向上修正。
 *  - 随机数通过 rand 参数注入；smoke 验证时使用固定 rand。
 */
export function generateSectEvent(
  trajectory: SectTrajectory | null | undefined,
  characterIds: string[],
  rand?: () => number,
): SectEvent {
  const r = typeof rand === 'function' ? rand : Math.random;
  const safeRand = Math.max(0, Math.min(1, r()));
  const phase = normalizePhase(trajectory?.phase);
  const safeChars = safeStringArray(characterIds);
  const sectId = (trajectory && typeof trajectory.sectId === 'string') ? trajectory.sectId : 'unknown-sect';

  let severity = 0.2 + safeRand * 0.3;
  if (trajectory && Array.isArray(trajectory.history) && trajectory.history.length > 0) {
    const lastSeverity = trajectory.history[trajectory.history.length - 1]?.severity ?? 0;
    if (typeof lastSeverity === 'number' && lastSeverity > 0.5) {
      severity = Math.min(1, severity + 0.2);
    }
  }

  const kindByPhase: Record<SectPhase, string> = {
    founding: 'founding',
    prosperous: 'blessing',
    stable: 'routine',
    declining: 'schism',
    crisis: 'war',
    scattered: 'dispersal',
    remnant: 'remnant',
  };
  const kind = kindByPhase[phase];

  const id = generateSectEventId(sectId, trajectory?.history?.length ?? 0, Math.floor(safeRand * 1000));

  const descriptionByPhase: Record<SectPhase, string> = {
    founding: '宗门初立，弟子开山授业，根基渐稳',
    prosperous: '宗门鼎盛，四方来朝，灵田广布',
    stable: '宗门循旧制，弟子按部就班修行',
    declining: '宗门气运渐衰，弟子星散，资源日减',
    crisis: '宗门遭逢大难，山门告急',
    scattered: '宗门离散，门人各自飘零',
    remnant: '宗门仅余残脉，传承不绝如缕',
  };

  return {
    id,
    sectId: '',
    phase,
    age: 0,
    kind,
    severity,
    description: descriptionByPhase[phase],
    narrative: descriptionByPhase[phase] || '',
    impact: typeof severity === 'number' ? severity : 0,
    characterIds: safeChars,
    worldFactIds: [],
  };
}

/**
 * AI-I415: 为 Prompt 摘要宗门兴衰轨迹。
 *  - 含 sectId / 当前阶段 / 凝聚度 / 最后指标 / 最近 3 条事件 / 掌门。
 *  - charLimit：限制最终返回字符串的最大字符数；超出时截断并加省略号。
 */
export function summarizeSectTrajectoryForPrompt(
  trajectory: SectTrajectory | null | undefined,
  charLimit: number,
): string {
  const limit = typeof charLimit === 'number' && !isNaN(charLimit) ? Math.max(80, Math.floor(charLimit)) : 400;
  if (!trajectory || typeof trajectory !== 'object') {
    return '[宗门轨迹缺失]';
  }
  const sectId = trajectory.sectId || 'unknown-sect';
  const phase = normalizePhase(trajectory.phase);
  const leader = trajectory.currentLeader || '无';
  const factionId = trajectory.factionId || '无';
  const fate = trajectory.fate || '未定';
  const history = Array.isArray(trajectory.history) ? trajectory.history : [];
  const lastMetric = Array.isArray(trajectory.powerCurve) && trajectory.powerCurve.length > 0
    ? trajectory.powerCurve[trajectory.powerCurve.length - 1]
    : null;

  const cohesion = lastMetric ? clamp01(lastMetric.internalCohesion) : 0.5;
  const rep = lastMetric && typeof lastMetric.reputation === 'number' ? lastMetric.reputation : 50;
  const memberCount = lastMetric && typeof lastMetric.memberCount === 'number' ? lastMetric.memberCount : 0;

  const recentEvents = history.slice(-3).map(e => {
    if (!e) return '';
    const ageStr = typeof e.age === "number" ? String(e.age) + "岁" : "";
    return (e.description || "") + "（" + ageStr + "）";
  }).filter(s => s.length > 0);

  let summary = "【宗门轨迹】" + phase + " | " + sectId + " | 掌门:" + leader + "\n";
  summary += "内部凝聚:" + Math.round(cohesion * 100) + "% / 声誉:" + rep + " / 弟子:" + memberCount + "\n";
  summary += "阵营:" + factionId + " / 命数:" + fate + "\n";

  if (summary.length > limit) {
    summary = summary.substring(0, limit - 1) + '…';
  }
  return summary;
}
// ==================== Phase-I Worker C 重做：命运回响系统 ====================
// 规则：不修改既有函数/类型；只在文件末尾追加 import 段与 5 个 export function。
// 引擎权威：检测 → 解决 → 传播 → 预测 → 注入提示词摘要。









// 命运回响检测：从角色当前状态 + 历史未决线索中识别应当被激活的回响。
//  - character:    角色状态（id/age/npcs/longTermMemory）
//  - history:      历史未决线索列表（PendingThread[]）
// 返回：当前应触发的回响触发器集合（去重 + 紧迫度归一）