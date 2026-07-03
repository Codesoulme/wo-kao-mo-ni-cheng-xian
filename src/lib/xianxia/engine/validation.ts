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
  seedInheritancePoolFromEnding,
  selectNextProtagonist,
  summarizeCycleForPrompt,
  triggerEndingEvaluation,
} from './ending-inheritance-fate';

export function validateCrossSystemContinuity(
  character: any,
  inheritanceChain: InheritanceChain | null,
  fateEchoes: FateEchoTrigger[] | null,
  sectState: { sectId?: string; sectName?: string; role?: string; [k: string]: any } | null,
): { breaks: Array<{ system: string; severity: 'info' | 'warn' | 'error'; reason: string }> } {
  const charId = typeof character?.id === 'string' ? character.id : null;
  const breaks: Array<{ system: string; severity: 'info' | 'warn' | 'error'; reason: string }> = [];
  const echoes = Array.isArray(fateEchoes) ? fateEchoes : [];
  const chain = inheritanceChain;

  // 1. 传承链交叉：rootCharacterId 不能为空；当前角色若是某代接收人
  //    应能在 generations 里被找到。兼容扁平与嵌套两种形式：
  //    - 扁平：generations = [recipient, recipient, ...]
  //    - 嵌套：generations = [[recipient, ...], [recipient, ...], ...]
  if (chain) {
    if (!chain.rootCharacterId || typeof chain.rootCharacterId !== 'string') {
      breaks.push({ system: 'inheritance', severity: 'error', reason: '传承链缺少根角色 id（rootCharacterId）' });
    } else {
      const generations = Array.isArray(chain.generations) ? chain.generations : [];
      let foundChar = false;
      for (const genOrRec of generations) {
        if (Array.isArray(genOrRec)) {
          for (const rec of genOrRec) {
            if (rec && rec.targetCharacterId === charId) { foundChar = true; break; }
          }
        } else if (genOrRec && typeof genOrRec === 'object' && (genOrRec as any).targetCharacterId === charId) {
          foundChar = true;
        }
        if (foundChar) break;
      }
      if (charId && !foundChar) {
        breaks.push({ system: 'inheritance', severity: 'info', reason: '当前角色尚未出现在传承链 generations 中（属正常：尚未承接）' });
      }
    }
    if (Array.isArray(chain.activeClaims)) {
      for (const c of chain.activeClaims) {
        if (!c || !c.recipientId || typeof c.recipientId !== 'string') {
          breaks.push({ system: 'inheritance', severity: 'error', reason: '传承链中存在 recipientId 缺失的 claim' });
        }
      }
    }
  }

  // 2. 命运回响交叉：每个 echo 必须有 id 与 source/target
  for (let i = 0; i < echoes.length; i++) {
    const e = echoes[i];
    if (!e || !e.id || typeof e.id !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'error', reason: '命运回响 #' + (i + 1) + ' 缺少 id' });
      continue;
    }
    if (!e.sourceCharacterId || typeof e.sourceCharacterId !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'error', reason: '回响 [' + e.id + '] 缺少 sourceCharacterId' });
    }
    if (!e.targetCharacterId || typeof e.targetCharacterId !== 'string') {
      breaks.push({ system: 'fateEcho', severity: 'warn', reason: '回响 [' + e.id + '] 缺少 targetCharacterId（可能是有意为之的世界回响）' });
    }
  }

  // 3. 宗门交叉：sectState 与命运回响的 source/target 是否冲突
  if (sectState && typeof sectState.sectId === 'string' && sectState.sectId.length > 0) {
    // 若当前宗门有宗主/长老类命运回响，应能关联到宗门叙事
    for (const e of echoes) {
      if (!e) continue;
      if (typeof e.narrativeHook !== 'string') continue;
      if (e.narrativeHook.indexOf(sectState.sectId) >= 0 && !e.sourceCharacterId) {
        breaks.push({ system: 'sect', severity: 'warn', reason: '回响 [' + (e.id || '?') + '] 提到当前宗门但缺少 sourceCharacterId' });
      }
    }
  } else if (echoes.length > 0) {
    // 角色无宗门但有牵涉宗门的回响
    const sectHint = echoes.some(e => e && typeof e.narrativeHook === 'string' && /(宗门|门派|山门|阁|峰|谷|宫)/.test(e.narrativeHook));
    if (sectHint) {
      breaks.push({ system: 'sect', severity: 'info', reason: '角色尚无宗门，但命运回响里出现宗门/门派类关键词' });
    }
  }

  // 4. 修仙特异化（constitution）与命运回响的连接：若角色 constitution 是命运系
  //    且回响主导为 karma-debt 或 destiny-collision，应标注提示
  if (character && character.constitution && typeof character.constitution === 'object') {
    const cat = character.constitution.category;
    if (cat === 'fate' || cat === 'karma') {
      const fateCount = echoes.filter((e: any) => e && (e.kind === FateEchoKind.KarmaDebt || e.kind === FateEchoKind.DestinyCollision)).length;
      if (fateCount === 0 && echoes.length > 0) {
        breaks.push({ system: 'constitution', severity: 'info', reason: '角色具备命运/因果系特异化，但当前回响中无因果/命数碰撞类节点' });
      }
    }
  }

  return { breaks };
}

/**
 * AI-J522: 找出指向不存在 ID 的跨系统引用
 *  - character:        当前角色（只用于日志和上下文）
 *  - allChains:        全部传承链（提供合法的 recipientId / rootCharacterId 集合）
 *  - allEchoes:        全部命运回响（提供合法的 echo id 集合）
 *  - allSects:         全部宗门节点（提供合法的 sectId 集合）
 * 返回 [{ refId, expectedSystem, actualSystem }]。
 * 注意：实际查找的"引用"主要来自 echoes 与 chain 的 activeClaims；
 * 如果某 echo 的 source/target 在其他系统里都不存在，则记录为 broken。
 */
export function findBrokenCrossRefs(
  character: any,
  allChains: InheritanceChain[] | null,
  allEchoes: FateEchoTrigger[] | null,
  allSects: SectNode[] | null,
): Array<{ refId: string; expectedSystem: string; actualSystem: string }> {
  const out: Array<{ refId: string; expectedSystem: string; actualSystem: string }> = [];
  // Collect known good ids first, then scan refs; this prevents claim.recipientId
  // from masking itself by being added to chainIds before the broken check.
  const knownChainIds = new Set<string>();
  const chainRoots = new Set<string>();
  const claimRecipientIds: string[] = [];
  if (Array.isArray(allChains)) {
    for (const ch of allChains) {
      if (!ch) continue;
      if (ch.rootCharacterId) chainRoots.add(ch.rootCharacterId);
      const gens = Array.isArray(ch.generations) ? ch.generations : [];
      for (const g of gens) {
        // Support both flat (single recipient) and nested (recipient[]) shapes.
        if (Array.isArray(g)) {
          for (const r of g) {
            if (r && r.targetCharacterId) knownChainIds.add(r.targetCharacterId);
            if (r && r.sourceCharacterId) knownChainIds.add(r.sourceCharacterId);
          }
        } else if (g && typeof g === 'object') {
          const rec: any = g;
          if (rec.targetCharacterId) knownChainIds.add(rec.targetCharacterId);
          if (rec.sourceCharacterId) knownChainIds.add(rec.sourceCharacterId);
        }
      }
      if (Array.isArray(ch.activeClaims)) {
        for (const c of ch.activeClaims) {
          const rec: any = c;
          if (rec && rec.recipientId) claimRecipientIds.push(rec.recipientId);
        }
      }
    }
  }
  const chainIds = knownChainIds;
  // The character itself is a known entity: add its id to the known set.
  if (character && typeof character.id === 'string' && character.id.length > 0) {
    chainIds.add(character.id);
  }
  // Also accept a list of known character ids passed alongside the character.
  if (character && Array.isArray(character.knownCharacterIds)) {
    for (const kcid of character.knownCharacterIds) {
      if (typeof kcid === 'string' && kcid.length > 0) chainIds.add(kcid);
    }
  }

  const echoIds = new Set<string>();
  const echoSources = new Set<string>();
  if (Array.isArray(allEchoes)) {
    for (const e of allEchoes) {
      if (!e) continue;
      if (e.id) echoIds.add(e.id);
      if (e.sourceCharacterId) echoSources.add(e.sourceCharacterId);
      if (e.targetCharacterId) echoSources.add(e.targetCharacterId);
    }
  }
  const sectIds = new Set<string>();
  if (Array.isArray(allSects)) {
    for (const s of allSects) {
      if (s && s.id) sectIds.add(s.id);
    }
  }

  // 检查每个 echo 的 source/target 是否能在任意一个系统里被定位
  if (Array.isArray(allEchoes)) {
    for (const e of allEchoes) {
      if (!e) continue;
      const tag = e.id || '(no-id)';
      // source 应在传承链的 generations 或 roots 集合中，或在其它 echo 的 source 集合中
      if (e.sourceCharacterId) {
        const inChain = chainIds.has(e.sourceCharacterId) || chainRoots.has(e.sourceCharacterId);
        if (!chainIds.has(e.sourceCharacterId) && !chainRoots.has(e.sourceCharacterId)) {
          out.push({ refId: e.sourceCharacterId, expectedSystem: 'fateEcho.source', actualSystem: 'unknown' });
        }
      }
      if (e.targetCharacterId) {
        const inChain = chainIds.has(e.targetCharacterId) || chainRoots.has(e.targetCharacterId);
        if (!chainIds.has(e.targetCharacterId) && !chainRoots.has(e.targetCharacterId)) {
          out.push({ refId: e.targetCharacterId, expectedSystem: 'fateEcho.target', actualSystem: 'unknown' });
        }
      }
    }
  }

  // 检查 chain.activeClaims 的 recipientId 是否能在 echo 或其它 chain 找到
  // Check each collected claim.recipientId against the (pre-augment) known id set.
  for (const rid of claimRecipientIds) {
    if (!rid) continue;
    if (chainIds.has(rid) || chainRoots.has(rid) || echoIds.has(rid)) continue;
    // Not found in any known system: flag as broken.
    out.push({ refId: rid, expectedSystem: 'inheritance.claim.recipient', actualSystem: 'unknown' });
  }

  // 角色宗门是否在宗门节点集合中
  if (character && typeof character.sectId === 'string' && character.sectId.length > 0) {
    if (!sectIds.has(character.sectId)) {
      out.push({ refId: character.sectId, expectedSystem: 'sect.node', actualSystem: 'unknown' });
    }
  }

  return out;
}

/**
 * AI-J523: 命运回响与传承池的衔接性判断
 *  - fateEcho:        命运回响（其 source/target/urgency 等）
 *  - inheritancePool: 传承池（其 kind/host/availableSlots 等）
 * 返回 { compatible, suggestedNarrative }：
 *  - compatible:           是否能衔接（age、kind、host 都对得上）
 *  - suggestedNarrative:   给出世界内可读的衔接描述（用于 AI 上下文或玩家旁白）
 */
export function summarizeContinuityForPrompt(
  character: any,
  breaks: Array<{ system: string; severity: string; reason: string }> | null,
  charLimit: number = 240,
): string {
  let list: Array<{ system: string; severity: string; reason: string }>;
  if (Array.isArray(breaks)) {
    list = breaks;
  } else {
    const fallback = validateCrossSystemContinuity(character, null, null, null);
    list = fallback.breaks;
  }
  const errCount = list.filter(b => b && b.severity === 'error').length;
  const warnCount = list.filter(b => b && b.severity === 'warn').length;
  const infoCount = list.filter(b => b && b.severity === 'info').length;
  const name = (character && (character.name || character.id)) || '当前角色';
  const lines: string[] = [];
  lines.push('因果链健康：' + name + '（error=' + errCount + ', warn=' + warnCount + ', info=' + infoCount + '）');
  const sampleCount = Math.min(list.length, 4);
  for (let i = 0; i < sampleCount; i++) {
    const b = list[i];
    if (!b) continue;
    lines.push('- [' + (b.severity || '?') + '·' + (b.system || '?') + '] ' + (b.reason || '需关注'));
  }
  let summary = lines.join('\n');
  if (summary.length > charLimit) summary = summary.slice(0, Math.max(0, charLimit - 1)) + '…';
  return summary;
}

// ======================== Phase-J Worker B (anti-pattern-collapse): UI Slot Boundary Guard ========================
// Additive only. These four exports protect the slot registry from AI-generated
// categories / displayGroup / tone / renderHint that do not match the whitelist
// enforced by src/lib/xianxia/display-registry.ts.
//
// The engine should be the last line of defense BEFORE the frontend renders a
// slot, so the constraints here mirror what display-registry.ts already does
// (SLOT_SET + category heuristics). We also expose a heuristic text->slot
// inferrer for upstream AI prompts, and a stable "currently registered slots"
// summary that can be injected into the LLM system prompt.

// Canonical sets - must stay in sync with display-registry.ts.
const SLOT_BOUNDARY_KNOWN_SLOTS: ReadonlyArray<string> = [
  "topTags",
  "characterDetail",
  "statusPage",
  "threadPage",
  "combatPanel",
  "inventoryPanel",
  "worldLegacy",
];
const SLOT_BOUNDARY_KNOWN_TONES: ReadonlyArray<string> = [
  "neutral",
  "good",
  "bad",
  "rare",
  "danger",
  "mystery",
];
const SLOT_BOUNDARY_KNOWN_RENDER_HINTS: ReadonlyArray<string> = [
  "badge",
  "card",
  "meter",
  "timeline",
  "action",
  "detail",
];
// Whitelisted display groups (matches groupFromStatus in display-registry.ts).
const SLOT_BOUNDARY_KNOWN_GROUPS: ReadonlyArray<string> = [
  "identity",
  "constitution",
  "attribute",
  "fate",
  "debuff",
  "buff",
  "misc",
];
// Whitelisted categories (the engine creates these; AI should pick from this
// list or rely on inference / clamping).
const SLOT_BOUNDARY_KNOWN_CATEGORIES: ReadonlyArray<string> = [
  "attribute",
  "status",
  "special",
  "identity",
  "quest",
  "thread",
  "fate",
  "injury",
  "buff",
  "debuff",
  "constitution",
  "item",
  "technique",
  "realm",
  "misc",
  "uncategorized",
];

// Quick-lookup sets (built once at module load).
const SLOT_BOUNDARY_SLOT_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_SLOTS);
const SLOT_BOUNDARY_TONE_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_TONES);
const SLOT_BOUNDARY_RENDER_HINT_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_RENDER_HINTS);
const SLOT_BOUNDARY_GROUP_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_GROUPS);
const SLOT_BOUNDARY_CATEGORY_SET: Set<string> = new Set(SLOT_BOUNDARY_KNOWN_CATEGORIES);

// 1) validateUISlotMapping
//  - slot: a partial slot mapping that AI / pipeline produced
//  - returns: { valid: boolean, warnings: string[] }
//    valid is true ONLY when no required field is missing AND every present
//    field passes its whitelist. warnings collects soft issues (e.g. extra
//    unknown displaySlots, empty displayGroup) so callers can choose to log
//    but still render.
export interface UISlotMappingInput {
  category?: string;
  displayGroup?: string;
  displaySlots?: string[];
  tone?: string;
  renderHint?: string;
}
export interface UISlotValidationResult {
  valid: boolean;
  warnings: string[];
}
export function validateUISlotMapping(slot: UISlotMappingInput | null | undefined): UISlotValidationResult {
  const warnings: string[] = [];
  if (!slot || typeof slot !== "object") {
    return { valid: false, warnings: ["slot_missing"] };
  }
  let valid = true;

  // category: required, must be in whitelist
  if (typeof slot.category !== "string" || slot.category.length === 0) {
    warnings.push("category_missing");
    valid = false;
  } else if (!SLOT_BOUNDARY_CATEGORY_SET.has(slot.category)) {
    warnings.push("category_unknown:" + slot.category);
    valid = false;
  }

  // displayGroup: recommended, must be in whitelist when present
  if (slot.displayGroup === undefined || slot.displayGroup === null || slot.displayGroup === "") {
    warnings.push("displayGroup_missing");
  } else if (typeof slot.displayGroup !== "string" || !SLOT_BOUNDARY_GROUP_SET.has(slot.displayGroup)) {
    warnings.push("displayGroup_unknown:" + String(slot.displayGroup));
  }

  // displaySlots: must be an array; every entry must be in the slot whitelist
  if (slot.displaySlots === undefined || slot.displaySlots === null) {
    warnings.push("displaySlots_missing");
  } else if (!Array.isArray(slot.displaySlots)) {
    warnings.push("displaySlots_not_array");
    valid = false;
  } else {
    if (slot.displaySlots.length === 0) {
      warnings.push("displaySlots_empty");
    }
    const seen: Set<string> = new Set();
    for (const s of slot.displaySlots) {
      if (typeof s !== "string") {
        warnings.push("displaySlots_non_string_entry");
        valid = false;
        continue;
      }
      if (!SLOT_BOUNDARY_SLOT_SET.has(s)) {
        warnings.push("displaySlots_unknown:" + s);
        valid = false;
      }
      if (seen.has(s)) {
        warnings.push("displaySlots_duplicate:" + s);
      }
      seen.add(s);
    }
  }

  // tone: must be in whitelist when present
  if (slot.tone === undefined || slot.tone === null) {
    warnings.push("tone_missing");
  } else if (typeof slot.tone !== "string" || !SLOT_BOUNDARY_TONE_SET.has(slot.tone)) {
    warnings.push("tone_unknown:" + String(slot.tone));
  }

  // renderHint: must be in whitelist when present
  if (slot.renderHint === undefined || slot.renderHint === null) {
    warnings.push("renderHint_missing");
  } else if (typeof slot.renderHint !== "string" || !SLOT_BOUNDARY_RENDER_HINT_SET.has(slot.renderHint)) {
    warnings.push("renderHint_unknown:" + String(slot.renderHint));
  }

  return { valid, warnings };
}

// 2) clampCategoryToKnownSlot
//  - slot: a slot mapping (any shape, the function only cares about category + displayGroup)
//  - knownCategories: Set of categories the caller is willing to accept
//  - returns: { clampedSlot, fallbackUsed }
//    When category is unknown, replaces it with "misc" (or "uncategorized" if
//    "misc" is also not in knownCategories). The returned slot is a shallow
//    copy so callers can mutate it without touching the input.
export interface UISlotClampResult {
  clampedSlot: UISlotMappingInput;
  fallbackUsed: boolean;
}
export function clampCategoryToKnownSlot(
  slot: UISlotMappingInput | null | undefined,
  knownCategories: Set<string> | ReadonlyArray<string> | null | undefined,
): UISlotClampResult {
  const base: UISlotMappingInput = slot && typeof slot === "object" ? { ...slot } : {};
  const known: Set<string> = knownCategories instanceof Set
    ? knownCategories
    : (Array.isArray(knownCategories) ? new Set(knownCategories) : new Set(SLOT_BOUNDARY_KNOWN_CATEGORIES));

  const original = typeof base.category === "string" ? base.category : "";
  let fallbackUsed = false;
  if (!original || !known.has(original)) {
    // Pick the best fallback the caller is willing to accept.
    if (known.has("misc")) {
      base.category = "misc";
    } else if (known.has("uncategorized")) {
      base.category = "uncategorized";
    } else if (known.size > 0) {
      base.category = Array.from(known)[0]!;
    } else {
      base.category = "misc";
    }
    fallbackUsed = true;
  }

  // Also clamp displayGroup if it is not in the global group set, but DO NOT
  // drop it - fall back to "misc" so the slot is still renderable.
  if (base.displayGroup && !SLOT_BOUNDARY_GROUP_SET.has(base.displayGroup)) {
    base.displayGroup = "misc";
  }

  // Filter displaySlots to known slots; if everything is filtered out, leave
  // an empty array (the caller is responsible for picking a default).
  if (Array.isArray(base.displaySlots)) {
    base.displaySlots = base.displaySlots.filter((s) => typeof s === "string" && SLOT_BOUNDARY_SLOT_SET.has(s));
  }

  // Clamp tone / renderHint to the global whitelists.
  if (base.tone && !SLOT_BOUNDARY_TONE_SET.has(base.tone)) {
    base.tone = "neutral";
  }
  if (base.renderHint && !SLOT_BOUNDARY_RENDER_HINT_SET.has(base.renderHint)) {
    base.renderHint = "badge";
  }

  return { clampedSlot: base, fallbackUsed };
}

// 3) inferSlotFromNarrativeText
//  - text: a piece of narrative (event draft, status prose, item description)
//  - hints: optional string array of pre-classification hints
//  - returns: { suggestedCategory, suggestedDisplayGroup, confidence (0..1) }
//    Pure heuristic. Uses ASCII pinyin + Latin keyword matching + hint bonus;
//    never throws. Confidence falls back to 0.3 on totally unrecognized text
//    so callers can decide whether to trust the inference.
export interface UISlotInferenceResult {
  suggestedCategory: string;
  suggestedDisplayGroup: string;
  confidence: number;
}
// Pinyin / Latin keyword table - chosen so the source stays ASCII-safe and
// grep-friendly. Each rule contributes a weight when its regex matches.
const SLOT_BOUNDARY_KEYWORD_RULES: ReadonlyArray<{ key: string; group: string; category: string; weight: number }> = [
  { key: "tizhi|jiangu|daotai|xuemai|physique|constitution", group: "constitution", category: "constitution", weight: 1.0 },
  { key: "tianfu|linggen|wuxing|qiyun|attribute|talent|spiritualRoot", group: "attribute", category: "attribute", weight: 0.95 },
  { key: "shenfen|zongmen|zhiwei|identity|faction|role|sect", group: "identity", category: "identity", weight: 0.9 },
  { key: "xianyuan|yinyuan|chuancheng|yinji|yixiang|fate|karma|omen|destiny", group: "fate", category: "fate", weight: 0.9 },
  { key: "shoushang|zhoudu|wandu|xinmo|injury|curse|wound|poison|debuff", group: "debuff", category: "debuff", weight: 0.85 },
  { key: "zengyi|zhufu|jiachi|buff|blessing", group: "buff", category: "buff", weight: 0.85 },
  { key: "dongzuo|fashu|jinzhi|action|skill|move|combat|chongtu|technique|spell", group: "misc", category: "technique", weight: 0.7 },
  { key: "wupin|lingbao|fabao|lingpai|item|loot|relic|talisman", group: "misc", category: "item", weight: 0.7 },
  { key: "xianji|jingjie|realm|breakthrough|cultivation", group: "misc", category: "realm", weight: 0.7 },
  { key: "shijian|weituo|renwu|quest|task|mission", group: "misc", category: "quest", weight: 0.6 },
  { key: "xiansuo|weiwan|zhongduo|thread|unfinished", group: "fate", category: "thread", weight: 0.7 },
];
const SLOT_BOUNDARY_HINT_BONUS: ReadonlyArray<{ key: string; group: string; category: string; weight: number }> = [
  { key: "identity|faction|role|shenfen|zongmen", group: "identity", category: "identity", weight: 0.2 },
  { key: "constitution|physique|tizhi|jiangu", group: "constitution", category: "constitution", weight: 0.2 },
  { key: "attribute|talent|tianfu|linggen", group: "attribute", category: "attribute", weight: 0.2 },
  { key: "fate|karma|omen|thread|xianyuan|yinyuan", group: "fate", category: "fate", weight: 0.2 },
  { key: "debuff|injury|poison|curse|shoushang|zhoudu", group: "debuff", category: "debuff", weight: 0.2 },
  { key: "buff|blessing|zengyi|zhufu", group: "buff", category: "buff", weight: 0.2 },
  { key: "item|loot|relic|wupin|lingbao", group: "misc", category: "item", weight: 0.15 },
  { key: "technique|skill|action|fashu|jinzhi", group: "misc", category: "technique", weight: 0.15 },
  { key: "realm|breakthrough|jingjie|cultivation", group: "misc", category: "realm", weight: 0.15 },
];
export function inferSlotFromNarrativeText(
  text: string | null | undefined,
  hints?: string[] | null,
): UISlotInferenceResult {
  const safeText = typeof text === "string" ? text.toLowerCase() : "";
  const safeHints = Array.isArray(hints) ? hints.filter((h) => typeof h === "string") : [];
  const scores = new Map<string, { group: string; category: string; score: number }>();

  for (const rule of SLOT_BOUNDARY_KEYWORD_RULES) {
    try {
      const re = new RegExp(rule.key, "i");
      if (re.test(safeText)) {
        const key = rule.group + "|" + rule.category;
        const cur = scores.get(key) || { group: rule.group, category: rule.category, score: 0 };
        cur.score += rule.weight;
        scores.set(key, cur);
      }
    } catch {
      // ignore bad regex (defensive)
    }
  }
  for (const hint of safeHints) {
    for (const rule of SLOT_BOUNDARY_HINT_BONUS) {
      try {
        const re = new RegExp(rule.key, "i");
        if (re.test(hint.toLowerCase())) {
          const key = rule.group + "|" + rule.category;
          const cur = scores.get(key) || { group: rule.group, category: rule.category, score: 0 };
          cur.score += rule.weight;
          scores.set(key, cur);
        }
      } catch {
        // ignore bad regex
      }
    }
  }

  if (scores.size === 0) {
    return { suggestedCategory: "misc", suggestedDisplayGroup: "misc", confidence: 0.3 };
  }
  let best: { group: string; category: string; score: number } | null = null;
  for (const v of scores.values()) {
    if (!best || v.score > best.score) best = v;
  }
  if (!best) {
    return { suggestedCategory: "misc", suggestedDisplayGroup: "misc", confidence: 0.3 };
  }
  // Normalize confidence: best.score is roughly 0.7-1.4 in practice; cap at 1.
  const confidence = Math.max(0.3, Math.min(1, best.score / 1.2));
  return {
    suggestedCategory: best.category,
    suggestedDisplayGroup: best.group,
    confidence,
  };
}

// 4) summarizeSlotMappingForPrompt
//  - activeSlots: array of registered slot mappings (any shape; we read
//    category / displayGroup / displaySlots / tone / renderHint defensively)
//  - charLimit: max characters of the produced summary (default 480)
//  - returns: a single string suitable for injection into the AI system prompt
//    so the LLM knows which slot vocabulary is currently legal. Falls back
//    to a one-line "no slots registered" string on empty input.
export function summarizeSlotMappingForPrompt(
  activeSlots: ReadonlyArray<UISlotMappingInput> | null | undefined,
  charLimit: number = 480,
): string {
  const limit = Math.max(40, Math.floor(charLimit));
  const slots = Array.isArray(activeSlots) ? activeSlots.filter((s) => s && typeof s === "object") : [];
  if (slots.length === 0) {
    return "[UI slot registry] no slots registered; use misc fallback category.";
  }
  const lines: string[] = [];
  lines.push("[UI slot registry] " + slots.length + " slots currently registered; do not invent new categories:");
  // Unique categories (in registration order)
  const cats: string[] = [];
  for (const s of slots) {
    if (s.category && !cats.includes(s.category)) cats.push(s.category);
  }
  lines.push("- registered categories: " + (cats.length ? cats.join(", ") : "(none)"));
  // Unique displaySlots
  const slotList: string[] = [];
  for (const s of slots) {
    if (Array.isArray(s.displaySlots)) {
      for (const sl of s.displaySlots) {
        if (typeof sl === "string" && !slotList.includes(sl)) slotList.push(sl);
      }
    }
  }
  lines.push("- registered displaySlots: " + (slotList.length ? slotList.join(", ") : "(none)"));
  // Tone palette actually in use
  const tones: string[] = [];
  for (const s of slots) {
    if (s.tone && !tones.includes(s.tone)) tones.push(s.tone);
  }
  lines.push("- tone palette: " + (tones.length ? tones.join(", ") : "neutral"));
  // Top 3 render hints
  const renderHints: string[] = [];
  for (const s of slots) {
    if (s.renderHint && !renderHints.includes(s.renderHint)) renderHints.push(s.renderHint);
  }
  lines.push("- renderHint hints: " + (renderHints.length ? renderHints.slice(0, 3).join(", ") : "badge/card"));
  // Sample of display groups (max 4)
  const groups: string[] = [];
  for (const s of slots) {
    if (s.displayGroup && !groups.includes(s.displayGroup)) groups.push(s.displayGroup);
  }
  lines.push("- displayGroup samples: " + (groups.length ? groups.slice(0, 4).join(", ") : "misc"));
  let summary = lines.join("\n");
  if (summary.length > limit) summary = summary.slice(0, Math.max(0, limit - 1)) + "\u2026";
  return summary;
}

// ==================== Phase-J Worker A 文本去重与心跳检测 ====================
// AI-J501~J504：检测并防止模式崩溃 ——
//   1. detectRepetitiveText        最近 windowSize 条 narrative 中的重复字符串
//   2. deduplicateNarrativeHooks   与已存在 hook 的相似度去重（>0.7 丢弃）
//   3. detectStaleTemplatePhrases  检测 AI 输出是否复用模板口头禅
//   4. summarizeTextHealthForPrompt 给 AI 上下文的"最近文字风格摘要"
//
// 这些函数只读 narrative/事件 metadata，不改状态、不调外部副作用；
// 引擎在收 AI 输出后用它们做静态校验，配合 prompt 双层保险。

// 计算两个字符串的 Jaccard 字符 bigram 相似度（0~1）。
function _bigramJaccardSimilarity(a: string, b: string): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;
  if (a.length === 0 || b.length === 0) return 0;
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa === bb) return 1;
  const gramsA = new Map<string, number>();
  for (let i = 0; i < aa.length - 1; i++) {
    const g = aa.substring(i, i + 2);
    gramsA.set(g, (gramsA.get(g) || 0) + 1);
  }
  let inter = 0;
  const gramsB = new Map<string, number>();
  for (let i = 0; i < bb.length - 1; i++) {
    const g = bb.substring(i, i + 2);
    gramsB.set(g, (gramsB.get(g) || 0) + 1);
  }
  for (const [g, cnt] of gramsB.entries()) {
    const a = gramsA.get(g) || 0;
    inter += Math.min(a, cnt);
  }
  const denom = gramsA.size + gramsB.size - inter;
  if (gramsA.size === 0 || gramsB.size === 0) return 0;
  if (denom <= 0) return 1;
  return inter / denom;
}

/**
 * AI-J501: 在最近 windowSize 条 narrative 中找出重复字符串
 *  - texts:     按时间顺序排列的 narrative 文本列表（最新在末尾）
 *  - windowSize: 窗口大小（取最后 windowSize 条），<=0 或 > texts.length 时取全部
 *  返回 { duplicates: Array<{ text, count, lastSeenAt }> }
 *    - text:       重复出现的原文（取最后一次出现的字面量）
 *    - count:      在窗口内出现次数（>=2 才会被报告）
 *    - lastSeenAt: 在窗口中的 1-based 位置（窗口内最后一处）
 * 匹配规则：trim 后完全相等视为重复；空字符串与长度 < 2 的串被忽略（避免噪声）。
 */
export function detectRepetitiveText(
  texts: string[],
  windowSize: number,
): { duplicates: Array<{ text: string; count: number; lastSeenAt: number }> } {
  const list = Array.isArray(texts) ? texts : [];
  const size = (typeof windowSize === 'number' && windowSize > 0) ? Math.min(windowSize, list.length) : list.length;
  const window = list.slice(list.length - size);
  const seen = new Map<string, { text: string; count: number; lastSeenAt: number }>();
  for (let i = 0; i < window.length; i++) {
    const raw = window[i];
    if (typeof raw !== 'string') continue;
    const norm = raw.trim();
    if (norm.length < 2) continue;
    const key = norm;
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
      existing.lastSeenAt = i + 1;
      existing.text = raw;
    } else {
      seen.set(key, { text: raw, count: 1, lastSeenAt: i + 1 });
    }
  }
  const duplicates: Array<{ text: string; count: number; lastSeenAt: number }> = [];
  for (const rec of seen.values()) {
    if (rec.count >= 2) duplicates.push(rec);
  }
  duplicates.sort((a, b) => (b.count - a.count) || (b.lastSeenAt - a.lastSeenAt));
  return { duplicates };
}

/**
 * AI-J502: 与已存在 hook 比较，相似度 > threshold 的丢掉（默认 0.7）
 *  - hooks:         候选 hook 列表
 *  - existingHooks: 已存在的 hook 列表（被丢弃的 hook 也按已存在对待）
 *  - threshold:     相似度阈值（可选，默认 0.7）
 *  返回 { kept, dropped }，保持原顺序；空串/非字符串被跳过。
 * 相似度算法：Jaccard 字符 bigram；完全相等视作 1.0。
 */
export function deduplicateNarrativeHooks(
  hooks: string[],
  existingHooks: string[],
  threshold?: number,
): { kept: string[]; dropped: string[] } {
  const candidates = Array.isArray(hooks) ? hooks.filter((h): h is string => typeof h === 'string') : [];
  const seed = Array.isArray(existingHooks) ? existingHooks.filter((h): h is string => typeof h === 'string') : [];
  const limit = (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) ? threshold : 0.7;
  const kept: string[] = [];
  const dropped: string[] = [];
  const seen = seed.slice();
  for (const h of candidates) {
    if (h.trim().length < 2) { dropped.push(h); continue; }
    let tooSimilar = false;
    for (const e of seen) {
      const sim = _bigramJaccardSimilarity(h, e);
      if (sim > limit) { tooSimilar = true; break; }
    }
    if (tooSimilar) {
      dropped.push(h);
    } else {
      kept.push(h);
      seen.push(h);
    }
  }
  return { kept, dropped };
}

/**
 * AI-J503: 检测 AI 输出是否复用模板口头禅
 *  - events:          事件数组，每个至少含 { id, narrative?, text?, summary? }
 *                     引擎会扫描 string 字段里是否包含 blacklist 中任意子串
 *  - phraseBlacklist: 黑名单短语数组（如 "天机晦暗"、"细碎积累"）
 *  返回 { stale: Array<{ eventId, phrase }> }，一个 eventId 可对应多个 phrase
 * 大小写不敏感；忽略空 event、非字符串短语。
 */
export function detectStaleTemplatePhrases(
  events: any[],
  phraseBlacklist: string[],
): { stale: Array<{ eventId: string; phrase: string }> } {
  const evs = Array.isArray(events) ? events : [];
  const phrases = Array.isArray(phraseBlacklist)
    ? phraseBlacklist.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : [];
  const stale: Array<{ eventId: string; phrase: string }> = [];
  for (const e of evs) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' ? e.id : '(no-id)';
    const fields: string[] = [];
    for (const key of ['narrative', 'text', 'summary', 'description', 'content']) {
      const v = (e as any)[key];
      if (typeof v === 'string') fields.push(v);
    }
    if (fields.length === 0) continue;
    const haystack = fields.join('\n').toLowerCase();
    for (const p of phrases) {
      if (haystack.indexOf(p.toLowerCase()) >= 0) {
        stale.push({ eventId: id, phrase: p });
      }
    }
  }
  return { stale };
}

/**
 * AI-J504: 给 AI 上下文的"最近文字风格摘要"
 *  - textHistory: 按时间顺序的 narrative 文本片段（最新在末尾）
 *  - charLimit:   摘要长度上限（可选，默认 280）
 *  返回一个紧凑字符串，用于注入到 AI prompt 的"近期文字风格"段。
 * 内容包含：
 *   - 样本数 / 平均长度 / 重复串数
 *   - 1-2 句用 AI 友好的中文概括整体风格（避免出现未在样本中出现的具体字眼）
 *   - 若发现模板口头禅（内置轻量黑名单），会额外提示"少用 X、Y"
 */
export function summarizeTextHealthForPrompt(
  textHistory: string[],
  charLimit?: number,
): string {
  const history = Array.isArray(textHistory) ? textHistory.filter((s): s is string => typeof s === 'string') : [];
  const sampleSize = Math.min(history.length, 6);
  const sample = history.slice(history.length - sampleSize);
  const avgLen = sampleSize > 0
    ? Math.round(sample.reduce((sum, s) => sum + s.length, 0) / sampleSize)
    : 0;
  const dupResult = detectRepetitiveText(history, 8);
  const dupCount = dupResult.duplicates.length;
  const blacklist = ['天机晦暗', '细碎积累', '冥冥之中', '此间因果', '冥冥注定'];
  const staleResult = detectStaleTemplatePhrases(
    sample.map((s, i) => ({ id: 'sample-' + (i + 1), narrative: s })),
    blacklist,
  );
  const stalePhrases: string[] = [];
  for (const s of staleResult.stale) {
    if (stalePhrases.indexOf(s.phrase) < 0) stalePhrases.push(s.phrase);
  }
  const lines: string[] = [];
  lines.push('近期文字：样本 ' + sampleSize + ' 条，平均 ' + avgLen + ' 字，重复串 ' + dupCount + ' 个。');
  if (stalePhrases.length > 0) {
    lines.push('口头禅提示：少用 "' + stalePhrases.join('"、"') + '" 等套话。');
  } else {
    lines.push('未发现模板口头禅，可继续当前语气。');
  }
  if (dupCount > 0) {
    lines.push('提示：近 ' + Math.min(history.length, 8) + ' 条中存在重复句式，请换用不同表达。');
  }
  let summary = lines.join(' ');
  const limit = (typeof charLimit === 'number' && charLimit > 0) ? charLimit : 280;
  if (summary.length > limit) summary = summary.slice(0, Math.max(0, limit - 1)) + '\u2026';
  return summary;
}



// ======================== Phase-K Worker C: LLM prompt augmentation wires (engine.ts half) ========================
// Goal: project Phase-J anti-pattern-collapse helpers (summarizeTextHealthForPrompt /
// summarizeSlotMappingForPrompt / summarizeContinuityForPrompt) into compact, well-labelled
// snippets that the LLM-side helper in llm.ts can splice into the system prompt tail.
//
// These four exports are additive only. They wrap the existing helpers and emit
// { hookName, hookPosition, promptSnippet, charLimit, snippetId } so the registry in llm.ts
// can index them by hookName and append them in a deterministic order.
//
// Contract:
//  - Each wire* returns a promptSnippet that begins with [Phase-K:<hookKey> <charLimit>] so
//    verifyLLMPromptAugmentation can detect the hook via indexOf('[Phase-K:').
//  - hookName is one of PHASE_K_LLM_PROMPT_HOOK_MARKERS.{registry,textHealth,slotMapping,continuity}.
//  - hookPosition is fixed to 'tail' (the LLM helper appends after the base system prompt).
//  - charLimit defaults to 280 (textHealth) / 480 (slotMapping) / 320 (continuity); callers can override.
//  - snippetId is per-call random so the LLM can tell when a fresh snippet was emitted.
//  - All four functions are defensive: null/undefined input never throws.

export const PHASE_K_LLM_PROMPT_HOOK_MARKERS = {
  registry: "PHASE_K_LLM_PROMPT_AUGMENTATION_REGISTRY",
  textHealth: "PHASE_K_LLM_PROMPT_HOOK_TEXT_HEALTH",
  slotMapping: "PHASE_K_LLM_PROMPT_HOOK_SLOT_MAPPING",
  continuity: "PHASE_K_LLM_PROMPT_HOOK_CROSS_SYSTEM_CONTINUITY",
};

// Marker strings llm.ts is expected to contain after wiring. Keep stable.
export interface PhaseKLLMPromptSnippet {
  hookName: string;
  hookPosition: 'tail' | 'head';
  promptSnippet: string;
  charLimit: number;
  snippetId: string;
}

export interface PhaseKLLMAugmentationVerifyResult {
  wiredCount: number;
  missingHooks: string[];
  allHooks: string[];
  registryPresent: boolean;
  sampleSnippet: string;
}

/**
 * Phase-K wire 1/4: text health snippet.
 *  - history:    recent narrative history (string[]). Last 12 entries are summarized.
 *  - limit:      optional charLimit override; default 280.
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet is purely additive -- it does NOT mutate history or engine state.
 */
export function wireTextHealthToLLMPrompt(
  history: string[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 280, 280);
  const tail = Array.isArray(history) ? history.slice(-12) : [];
  let inner = '';
  try {
    if (tail.length > 0 && typeof summarizeTextHealthForPrompt === 'function') {
      inner = summarizeTextHealthForPrompt(tail);
    } else {
      inner = '近期 0 条文本未发现重复句式或陈旧模板口癖，叙事节奏正常。';
    }
  } catch {
    inner = '近期文本健康摘要暂不可用，请保持当下语势继续叙事。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:textHealth ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '近况：近期文本健康摘要，供 LLM 了解重复句式 / 模板口癖。\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.textHealth,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-textHealth'),
  };
}

/**
 * Phase-K wire 2/4: slot mapping snippet.
 *  - activeSlots: currently registered UI slot mappings (any shape; defensively read)
 *  - limit:      optional charLimit override; default 480
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet lists registered categories / displaySlots / tones so the LLM does not
 *  invent new ones.
 */
export function wireSlotMappingToLLMPrompt(
  activeSlots: any[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 480, 480);
  let inner = '';
  try {
    if (Array.isArray(activeSlots) && activeSlots.length > 0 && typeof summarizeSlotMappingForPrompt === 'function') {
      inner = summarizeSlotMappingForPrompt(activeSlots, charLimit);
    } else {
      inner = '当前 UI 注册表为空（no slots registered），所有新分类必须先注册才能落到对应槽位。';
    }
  } catch {
    inner = '当前 UI 槽位摘要暂不可用，请保持默认分类边界。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:slotMapping ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '当前已注册 UI 槽位约束（请勿发明未注册分类，使用已注册 displaySlots）：\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.slotMapping,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-slotMapping'),
  };
}

/**
 * Phase-K wire 3/4: cross-system continuity snippet.
 *  - character: current character snapshot (any shape; defensively read)
 *  - breaks:    array of { system, severity, reason } cross-system breaks
 *  - limit:     optional charLimit override; default 320
 *  Returns { hookName, hookPosition, promptSnippet, charLimit, snippetId }.
 *  The snippet explains causal-chain health so the LLM can avoid orphan threads.
 */
export function wireCrossSystemContinuityToLLMPrompt(
  character: any,
  breaks: any[] | null | undefined,
  limit?: number,
): PhaseKLLMPromptSnippet {
  const charLimit = _phaseKClampLimit(typeof limit === 'number' ? limit : 320, 320);
  let inner = '';
  try {
    if (Array.isArray(breaks) && typeof summarizeContinuityForPrompt === 'function') {
      inner = summarizeContinuityForPrompt(character, breaks);
    } else {
      inner = '因果链健康 error=0 warn=0 info=0 -- 未发现跨系统断点。';
    }
  } catch {
    inner = '因果链健康摘要暂不可用，请保持剧情内因果连贯。';
  }
  inner = _phaseKTruncateTail(inner, charLimit);
  const label = '[Phase-K:continuity ' + charLimit + ']';
  const promptSnippet =
    label + '\n' +
    '因果链健康摘要（error / warn / info），供 LLM 避免出现孤儿因果。\n' +
    inner + '\n';
  return {
    hookName: PHASE_K_LLM_PROMPT_HOOK_MARKERS.continuity,
    hookPosition: 'tail',
    promptSnippet,
    charLimit,
    snippetId: _phaseKRandomId('phasek-continuity'),
  };
}

/**
 * Phase-K wire 4/4: verify which hooks are actually present in llm.ts.
 *  - llmSource: optional explicit source string (mostly for tests); defaults to reading
 *               src/lib/xianxia/llm.ts via fs.
 *  - llmPath:   override path when llmSource is not supplied.
 * Returns: { wiredCount, missingHooks, allHooks, registryPresent, sampleSnippet }.
 * `sampleSnippet` returns the first detected snippet body (or empty string).
 *
 * The function NEVER throws - file read errors are reported via
 * { registryPresent: false, wiredCount: 0, missingHooks: [all], ... }.
 */
export function verifyLLMPromptAugmentation(
  llmSource?: string,
  llmPath?: string,
): PhaseKLLMAugmentationVerifyResult {
  const allHooks = [
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.textHealth,
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.slotMapping,
    PHASE_K_LLM_PROMPT_HOOK_MARKERS.continuity,
  ];
  const missingHooks: string[] = [];
  let source: string = "";
  let registryPresent = false;
  let sampleSnippet = "";
  let wiredCount = 0;
  // Phase-K k-624 修复：smoke 传 (undefined, 'src/lib/xianxia/llm.ts') 时也要能读到 marker。
  // 仅在 node 环境（require('fs') 可用）走文件读取；client bundle 走 catch fallback 保持空结果。
  const _fsModule: { readFileSync?: (p: string, enc: string) => string } | null = (() => {
    try {
      // @ts-ignore -- 动态 require 仅 server 端生效,client bundle 抛错被 catch
      return (typeof require === 'function' ? require('fs') : null) as any;
    } catch {
      return null;
    }
  })();
  try {
    if (typeof llmSource === 'string') {
      // Explicit string (including empty '') is honored as-is - no file fallback.
      source = llmSource;
    } else if (
      _fsModule &&
      typeof _fsModule.readFileSync === 'function' &&
      typeof llmPath === 'string' &&
      llmPath.length > 0
    ) {
      // 未传 source 但传了 path：server/node 环境同步读文件（smoke 默认走这条）。
      try {
        // @ts-ignore -- 动态 require 同上
        const _path = (typeof require === 'function' ? require('path') : null) as
          | { isAbsolute: (p: string) => boolean; resolve: (...a: string[]) => string }
          | null;
        const absPath =
          _path && _path.isAbsolute(llmPath)
            ? llmPath
            : _path
              ? _path.resolve(process.cwd(), llmPath)
              : llmPath;
        source = _fsModule.readFileSync(absPath, 'utf8') || '';
      } catch {
        source = '';
      }
    } else {
      // client bundle 走这里：直接返回空结果
      source = "";
    }
  } catch (_err) {
    return {
      wiredCount: 0,
      missingHooks: allHooks.slice(),
      allHooks,
      registryPresent: false,
      sampleSnippet: "",
    };
  }
  registryPresent = source.indexOf(PHASE_K_LLM_PROMPT_HOOK_MARKERS.registry) >= 0;
  for (const h of allHooks) {
    if (source.indexOf(h) >= 0) {
      wiredCount += 1;
    } else {
      missingHooks.push(h);
    }
  }
  try {
    const idx = source.indexOf("[Phase-K:");
    if (idx >= 0) {
      const endIdx = source.indexOf("]", idx);
      if (endIdx > idx) {
        const slice = source.slice(idx, Math.min(source.length, idx + 320));
        sampleSnippet = slice;
      }
    }
  } catch (_e) {
    sampleSnippet = "";
  }
  return {
    wiredCount,
    missingHooks,
    allHooks,
    registryPresent,
    sampleSnippet,
  };
}

// ----- helpers (private to this block) -----

function _phaseKRandomId(prefix: string): string {
  return prefix + '-' + Math.floor(Date.now() % 1e9).toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function _phaseKClampLimit(limit: number, fallback: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return fallback;
  return limit;
}

function _phaseKTruncateTail(s: string, max: number): string {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  const head = Math.max(1, Math.floor(max * 0.85));
  return s.slice(0, head) + '\u2026';
}
// ======================== Phase-K Worker A: 修仙轮转支撑 (engine.ts) ========================
// Goal: 给主循环接入「角色死亡 → 结局光谱 → 传承池 → 继承者」四段式钩子。
// 这 4 个 export function 全部只读 / 只新增，不修改任何现有函数。
//
// 设计约束：
//  - triggerEndingEvaluation 是死亡入口；返回所有可触发的结局与最可能落定的那一个，
//    同时把第一份传承池草稿写入 primaryEnding.inheritancePool
//  - seedInheritancePoolFromEnding 把上一份结局展开成可继承条目（功法/法宝/灵宠/血脉/
//    信物/道场/未完之事），并各自落到 InheritancePool[]
//  - selectNextProtagonist 综合灵根/血脉/因果承接/玩家介入偏好，挑选下一代主角
//  - summarizeCycleForPrompt 把这一代轮回摘要成 prompt-ready 字符串（含 ellipsis 截断）
//
// 所有函数对 null/undefined 输入都安全返回默认结构；不抛错。

// ---------- local types (engine.ts 私有) ----------