// 修仙模拟器 - LLM 输出 zod schema（TechDoc 18.6.5 强制 JSON Schema）
// 所有 LLM 调用的输出必须通过这些 schema 校验；
// 失败时 fallback 到 sanitize* 函数（不返 500）。

import { z } from 'zod';

// ===== 共用基础 schema =====

/** 灵根类型枚举（与 types.ts SpiritualRoot 对齐） */
export const SpiritualRootEnum = z.enum(['none', 'mixed', 'common', 'pure', 'heavenly', 'chaos']);

/** 灵根变化字段 */
export const SpiritualRootChangeSchema = z.object({
  spiritualRoot: SpiritualRootEnum,
  rootDetail: z.string().optional(),
  reason: z.string().optional(),
});

/** 选项条目（playerChoice 兼容 AI 多种 key 别名） */
export const ChoiceOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().optional(),
  label: z.string().optional(),
  option: z.string().optional(),
  hint: z.string().optional(),
  consequence: z.string().optional(),
});

/** 抉择提示 */
export const ChoicePromptSchema = z.object({
  prompt: z.string(),
  options: z.array(z.union([z.string(), ChoiceOptionSchema])).min(1),
}).optional();

/** 属性变化（changes 数组元素） */
export const AttributeChangeSchema = z.object({
  attribute: z.string(),
  delta: z.number(),
  reason: z.string().optional(),
});

/** 状态条目 */
export const StatusEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['attribute', 'skill', 'buff', 'debuff', 'special', 'identity', 'quest', 'environment', 'constitution']).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  duration: z.number().optional(),
  source: z.string().optional(),
  effects: z.array(z.object({
    target_attribute: z.string(),
    operation: z.enum(['add', 'multiply', 'override', 'cap', 'floor', 'trigger']).optional(),
    value: z.number(),
    description: z.string().optional(),
  })).optional(),
});

/** 物品条目 */
export const ItemEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  item_type: z.enum(['weapon', 'armor', 'accessory', 'artifact', 'consumable', 'material', 'tool', 'scripture']).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  effects: z.array(z.object({
    target_attribute: z.string(),
    operation: z.string().optional(),
    value: z.number(),
    description: z.string().optional(),
  })).optional(),
  source: z.string().optional(),
  equipNote: z.string().optional(),
});

/** 推进线索条目 */
export const AdvanceThreadSchema = z.object({
  id: z.string(),
  progressDelta: z.number().optional(),
  progress_delta: z.number().optional(),
  note: z.string().optional(),
});

/** 新增线索条目 */
export const NewThreadSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['competition', 'enemy', 'quest', 'promise', 'mystery', 'romance', 'debt', 'inheritance', 'exploration']).optional(),
  startAge: z.number().optional(),
  deadlineAge: z.number().optional(),
  reward: z.string().optional(),
  failureCost: z.string().optional(),
  dueInSameYear: z.boolean().optional(),
  followUpHint: z.string().optional(),
  realmId: z.string().optional(),
});

/** NPC 条目 */
export const NPCEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  role: z.string().optional(),
  realm: z.string().optional(),
  faction: z.string().optional(),
  attitude: z.enum(['ally', 'friendly', 'neutral', 'hostile', 'enemy', 'unknown']).optional(),
  relationshipScore: z.number().optional(),
  firstMetAge: z.number().optional(),
  lastSeenAge: z.number().optional(),
  lastKnownLocation: z.string().optional(),
  memory: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** 战斗敌人 */
export const CombatEnemySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  hp: z.number(),
  maxHp: z.number().optional(),
  attack: z.number(),
  defense: z.number().optional(),
  speed: z.number(),
  realm: z.string().optional(),
  lootItems: z.array(ItemEntrySchema).optional(),
  lootSpiritStones: z.number().optional(),
});

/** triggerCombat 字段 */
export const TriggerCombatSchema = z.object({
  enemies: z.array(CombatEnemySchema).min(1),
  contextTitle: z.string().optional(),
  contextNarrative: z.string().optional(),
  victoryDrops: z.array(ItemEntrySchema).optional(),
  defeatCost: z.string().optional(),
}).optional();

/** 灵宠条目 */
export const PetEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  species: z.enum(['fox', 'wolf', 'snake', 'turtle', 'eagle', 'ape', 'spider', 'butterfly', 'fish', 'tiger', 'phoenix', 'dragon']).optional(),
  description: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  realm: z.string().optional(),
  hp: z.number(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  speed: z.number(),
  element: z.enum(['metal', 'wood', 'water', 'fire', 'earth']).optional(),
  loyalty: z.number().optional(),
  satiety: z.number().optional(),
  level: z.number().optional(),
  exp: z.number().optional(),
  expToLevel: z.number().optional(),
  sourceAcquired: z.string().optional(),
  acquiredAge: z.number().optional(),
  skill: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    power: z.number().optional(),
    cooldown: z.number().optional(),
  }).optional(),
});

/** 叙事契约字段 */
export const NarrativeContractSchema = z.object({
  narrativeFocus: z.enum(['threat', 'opportunity', 'location', 'npc', 'faction', 'realm', 'daily']).optional(),
  narrativeOutcome: z.enum(['advanced', 'resolved', 'failed', 'deferred', 'echoed', 'ignored']).optional(),
  usedScheduleHintIds: z.array(z.string()).optional(),
  usedWorldFactIds: z.array(z.string()).optional(),
  usedNpcIds: z.array(z.string()).optional(),
  contractNote: z.string().optional(),
}).optional();

/** extraEvents 子项 */
export const ExtraEventSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  eventType: z.enum(['normal', 'fate_node', 'choice', 'combat', 'breakthrough', 'death', 'ascension']).optional(),
  timeAdvance: z.object({
    amount: z.number().optional(),
    unit: z.string().optional(),
    label: z.string().optional(),
    reason: z.string().optional(),
    ageDeltaYears: z.number().optional(),
    elapsedDays: z.number().optional(),
  }).optional(),
  actionProjections: z.array(z.any()).optional(),
});

/** timeAdvance 字段 */
export const TimeAdvanceSchema = z.object({
  amount: z.number().optional(),
  unit: z.string().optional(),
  label: z.string().optional(),
  reason: z.string().optional(),
  ageDeltaYears: z.number().optional(),
  elapsedDays: z.number().optional(),
}).optional();

/** realmProfilePatch 字段 */
export const RealmProfilePatchSchema = z.object({
  name: z.string().optional(),
  shortName: z.string().optional(),
  color: z.string().optional(),
  maxLevel: z.number().optional(),
  powerMultiplier: z.number().optional(),
  expMultiplier: z.number().optional(),
  reason: z.string().optional(),
}).optional();

// ===== 顶层 schema =====

/** advance / stream 事件（最完整的 schema） */
export const AIEventOutputSchema = z.object({
  title: z.string().optional(),
  narrative: z.string(),
  eventType: z.enum(['normal', 'fate_node', 'choice', 'combat', 'breakthrough', 'death', 'ascension']).optional(),
  changes: z.array(AttributeChangeSchema).optional(),
  newStatuses: z.array(StatusEntrySchema).optional(),
  newItems: z.array(ItemEntrySchema).optional(),
  removedItemIds: z.array(z.string()).optional(),
  newEquippedItems: z.array(ItemEntrySchema).optional(),
  equipItemIds: z.array(z.string()).optional(),
  unequipItemIds: z.array(z.string()).optional(),
  memory: z.string().optional(),
  cultivationInsight: z.string().optional(),
  timeAdvance: TimeAdvanceSchema,
  actionProjections: z.array(z.any()).optional(),
  hasChoice: z.boolean().optional(),
  choice: ChoicePromptSchema,
  triggeredBreakthrough: z.boolean().optional(),
  breakthroughReason: z.string().optional(),
  breakthroughTargetLevel: z.number().optional(),
  breakthroughTargetRealm: z.string().optional(),
  realmProfilePatch: RealmProfilePatchSchema,
  extraEvents: z.array(ExtraEventSchema).optional(),
  causedDeath: z.boolean().optional(),
  deathReason: z.string().optional(),
  causedAscension: z.boolean().optional(),
  newNpcs: z.array(NPCEntrySchema).optional(),
  newThreads: z.array(NewThreadSchema).optional(),
  advanceThreads: z.array(AdvanceThreadSchema).optional(),
  completeThreadIds: z.array(z.string()).optional(),
  failThreadIds: z.array(z.string()).optional(),
  triggerCombat: TriggerCombatSchema,
  narrativeContract: NarrativeContractSchema,
  spiritualRootChange: SpiritualRootChangeSchema.optional(),
  newPets: z.array(PetEntrySchema).optional(),
});

/** 玩家选择结果 schema */
export const AIChoiceResultSchema = z.object({
  narrative: z.string(),
  changes: z.array(AttributeChangeSchema).optional(),
  newStatuses: z.array(StatusEntrySchema).optional(),
  newItems: z.array(ItemEntrySchema).optional(),
  removedItemIds: z.array(z.string()).optional(),
  newEquippedItems: z.array(ItemEntrySchema).optional(),
  equipItemIds: z.array(z.string()).optional(),
  unequipItemIds: z.array(z.string()).optional(),
  nextChoice: ChoicePromptSchema,
  memory: z.string().optional(),
  cultivationInsight: z.string().optional(),
  causedDeath: z.boolean().optional(),
  deathReason: z.string().optional(),
  newNpcs: z.array(NPCEntrySchema).optional(),
  newThreads: z.array(NewThreadSchema).optional(),
  advanceThreads: z.array(AdvanceThreadSchema).optional(),
  completeThreadIds: z.array(z.string()).optional(),
  failThreadIds: z.array(z.string()).optional(),
  triggerCombat: TriggerCombatSchema,
  spiritualRootChange: SpiritualRootChangeSchema.optional(),
});

/** 玩家干扰 schema */
export const AIInterfereOutputSchema = z.object({
  classification: z.enum(['action', 'dialogue', 'overreach', 'rule_manipulation']).optional(),
  accepted: z.boolean().optional(),
  narrative: z.string().optional(),
  changes: z.array(AttributeChangeSchema).optional(),
  newStatuses: z.array(StatusEntrySchema).optional(),
  newItems: z.array(ItemEntrySchema).optional(),
  removedItemIds: z.array(z.string()).optional(),
  newEquippedItems: z.array(ItemEntrySchema).optional(),
  equipItemIds: z.array(z.string()).optional(),
  unequipItemIds: z.array(z.string()).optional(),
  memory: z.string().optional(),
  cultivationInsight: z.string().optional(),
  ageAdvance: z.number().optional(),
  newNpcs: z.array(NPCEntrySchema).optional(),
  newThreads: z.array(NewThreadSchema).optional(),
  advanceThreads: z.array(AdvanceThreadSchema).optional(),
  completeThreadIds: z.array(z.string()).optional(),
  failThreadIds: z.array(z.string()).optional(),
  triggerCombat: TriggerCombatSchema,
  spiritualRootChange: SpiritualRootChangeSchema.optional(),
});

/** 物品操作叙事 schema */
export const AIItemActionNarrativeSchema = z.object({
  narrative: z.string(),
  cultivationInsight: z.string().optional(),
});

/** 炼丹结果 schema */
export const AIAlchemyOutcomeSchema = z.object({
  success: z.boolean(),
  pillName: z.string(),
  pillDescription: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  mainElement: z.enum(['fire', 'water', 'wood', 'metal', 'earth', 'none']).optional(),
  effects: z.array(z.object({
    target_attribute: z.string(),
    operation: z.enum(['add', 'multiply']).optional(),
    value: z.number(),
    description: z.string().optional(),
  })).optional(),
  narrative: z.string().optional(),
  accident: z.string().optional(),
});

/** 坊市 schema */
export const AIMarketOutcomeSchema = z.object({
  marketName: z.string().optional(),
  atmosphere: z.string().optional(),
  items: z.array(ItemEntrySchema.extend({
    price: z.number().optional(),
    reason: z.string().optional(),
  })).optional(),
});

/** 拍卖会 schema */
export const AIAuctionOutcomeSchema = z.object({
  title: z.string().optional(),
  invitation: z.string().optional(),
  lots: z.array(z.object({
    item: ItemEntrySchema,
    startingPrice: z.number().optional(),
    seller: z.string().optional(),
    desireTags: z.array(z.string()).optional(),
  })).optional(),
  bidders: z.array(z.object({
    name: z.string(),
    realm: z.string().optional(),
    assets: z.number().optional(),
    desireTags: z.array(z.string()).optional(),
    temperament: z.enum(['calm', 'proud', 'greedy', 'secretive', 'reckless']).optional(),
  })).optional(),
});

/** 战后战利品 schema */
export const AICombatLootSchema = z.object({
  items: z.array(ItemEntrySchema).optional(),
  spiritStones: z.number().optional(),
  narrativeHint: z.string().optional(),
});

/** 灵宠结缘 schema */
export const AIPetBondSchema = z.object({
  name: z.string(),
  species: z.enum(['fox', 'wolf', 'snake', 'turtle', 'eagle', 'ape', 'spider', 'butterfly', 'fish', 'tiger', 'phoenix', 'dragon']).optional(),
  description: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  element: z.enum(['metal', 'wood', 'water', 'fire', 'earth']).optional(),
  hp: z.number(),
  attack: z.number(),
  defense: z.number(),
  speed: z.number(),
  loyalty: z.number().optional(),
  satiety: z.number().optional(),
  sourceAcquired: z.string().optional(),
  skill: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    power: z.number().optional(),
    cooldown: z.number().optional(),
  }).optional(),
  traits: z.array(z.string()).optional(),
  passiveHint: z.string().optional(),
  narrative: z.string().optional(),
});

/** 灵宠喂养 schema */
export const AIPetCareSchema = z.object({
  satietyDelta: z.number().optional(),
  loyaltyDelta: z.number().optional(),
  expDelta: z.number().optional(),
  levelDelta: z.number().optional(),
  attackDelta: z.number().optional(),
  defenseDelta: z.number().optional(),
  maxHpDelta: z.number().optional(),
  narrative: z.string().optional(),
});

/** 结算评价 schema */
export const AISettlementEvaluationSchema = z.object({
  title: z.string(),
  summary: z.string(),
  rank: z.string(),
  optionIds: z.array(z.string()).optional(),
  reasons: z.record(z.string(), z.string()).optional(),
});

/** 战斗回合推进 schema */
export const AICombatRoundProposalSchema = z.object({
  playerActionLabel: z.string().optional(),
  playerActionType: z.string().optional(),
  enemyAction: z.string().optional(),
  enemyActionType: z.string().optional(),
  playerDamage: z.number().optional(),
  playerHeal: z.number().optional(),
  enemyDamage: z.number().optional(),
  mpCost: z.number().optional(),
  consumeItem: z.boolean().optional(),
  fleeOutcome: z.enum(['success', 'failed']).optional(),
  narrative: z.string().optional(),
  auditHints: z.array(z.string()).optional(),
  enemyBeats: z.array(z.object({
    enemyIdx: z.number(),
    action: z.string().optional(),
    actionType: z.string().optional(),
    damageToPlayer: z.number().optional(),
  })).optional(),
  playerHits: z.array(z.object({
    enemyIdx: z.number(),
    damage: z.number(),
  })).optional(),
  dialogue: z.array(z.object({
    speaker: z.string().optional(),
    text: z.string(),
  })).optional(),
  tacticalSituation: z.object({
    tempo: z.enum(['pressing', 'stalemate', 'opening', 'danger', 'flee_window', 'turning', 'chaos']).optional(),
    advantage: z.enum(['player', 'enemy', 'even', 'unclear']).optional(),
    reason: z.string().optional(),
    playerOpening: z.string().optional(),
    enemyPressure: z.string().optional(),
    suggestedFocus: z.string().optional(),
  }).optional(),
  nextActions: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string(),
    actionType: z.string().optional(),
    risk: z.string().optional(),
    intent: z.string().optional(),
    mpCost: z.number().optional(),
    tags: z.array(z.string()).optional(),
  })).optional(),
  playerImpulse: z.object({
    kind: z.enum(['item', 'contingency']).optional(),
    prompt: z.string().optional(),
    itemId: z.string().optional(),
    itemName: z.string().optional(),
  }).optional(),
});

/** 战斗回合叙事 schema */
export const AICombatRoundNarrativeSchema = z.object({
  narrative: z.string(),
});

/** 战斗结束叙事 schema */
export const AICombatEndNarrativeSchema = z.object({
  narrative: z.string().optional(),
  newThreads: z.array(NewThreadSchema).optional(),
  completeThreadIds: z.array(z.string()).optional(),
  newItems: z.array(ItemEntrySchema).optional(),
});

/** 出生事件 schema */
export const AIBirthSchema = z.object({
  name: z.string(),
  gender: z.enum(['male', 'female']).optional(),
  rootDetail: z.string().optional(),
  birthplace: z.string().optional(),
  family: z.string().optional(),
  background: z.string().optional(),
});

// ===== 安全校验工具 =====

export type SafeParseResult<T> = { ok: true; data: T } | { ok: false; error: z.ZodError };

/**
 * 安全 parse + 失败时 console.error 并返回原始对象（不阻断主流程）
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, raw: any, label: string): { ok: true; data: T } | { ok: false; error: z.ZodError; raw: any } {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  console.error(`[llm] schema validation failed (${label}):`, result.error.issues.slice(0, 5));
  return { ok: false, error: result.error, raw };
}

/**
 * 校验并尽量补全默认值的轻量版（用于流式场景）
 * 返回值始终是 object，不抛错
 */
export function validateOrFallback<T>(schema: z.ZodSchema<T>, raw: any, fallback: T, label: string): T {
  const result = safeValidate(schema, raw, label);
  if (result.ok) return result.data;
  // 失败时合并部分成功字段 + 缺失字段用 fallback
  if (raw && typeof raw === 'object') {
    return { ...(fallback as any), ...raw } as T;
  }
  return fallback;
}