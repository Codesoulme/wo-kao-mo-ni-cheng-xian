import { Prisma } from '@prisma/client';

/**
 * 构建 AI 推进后的角色状态 update data。
 * SSE 路径与 non-SSE 路径必须走同一个函数，避免出现
 * 「non-SSE 写了 X 字段但 SSE 没写 → 玩家切路径后丢数据」。
 *
 * 字段映射约定：
 *   - state.*     ↔ Character 普通字段
 *   - state.*Json ↔ 由 state 内部对象/数组 JSON.stringify 后写入
 *   - 缺省 null/Prisma.JsonNull 兜底，避免误覆盖 DB 默认值
 */
export function buildAdvanceStateData(state: any, opts?: {
  pendingChoiceJson?: string;
  worldCalendar?: any;
  recentEventTypes?: string[];
  recentBlueprintCategories?: string[];
  causeOfDeath?: string;
  lastEventAge?: number;
}): Prisma.CharacterUpdateInput {
  const pendingChoiceJson = opts?.pendingChoiceJson ?? '';
  const worldCalendar = opts?.worldCalendar ?? state.worldCalendar;
  const recentEventTypes = opts?.recentEventTypes ?? (state as any)._recentEventTypes ?? [];
  const recentBlueprintCategories = opts?.recentBlueprintCategories ?? (state as any)._recentBlueprintCategories ?? [];

  return {
    age: state.age,
    lifespan: state.lifespan,
    realm: state.realm,
    spiritualRoot: state.spiritualRoot,
    rootDetail: state.rootDetail ?? Prisma.JsonNull,
    realmLevel: state.realmLevel,
    cultivationExp: state.cultivationExp,
    expToBreak: state.expToBreak,
    hp: state.hp,
    maxHp: state.maxHp,
    mp: state.mp,
    maxMp: state.maxMp,
    attack: state.attack,
    defense: state.defense,
    speed: state.speed,
    luck: state.luck,
    comprehension: state.comprehension,
    spiritStones: state.spiritStones,
    alive: state.alive,
    ascended: state.ascended ?? false,
    isAtChoice: state.isAtChoice ?? false,
    pendingChoiceJson,
    worldCalendarJson: worldCalendar ? JSON.stringify(worldCalendar) : '{"eraName":"青岚仙历","calendarYear":5000,"elapsedDays":0}',
    causeOfDeath: opts?.causeOfDeath ?? state.causeOfDeath ?? null,
    // realmProfile: state.realmProfile ?? Prisma.JsonNull,  // Prisma schema 没此字段
    cultivationMultiplier: state.cultivationMultiplier,
    cultivationInsight: state.cultivationInsight ?? null,
    cultivationFactorsJson: state.cultivationFactors ? JSON.stringify(state.cultivationFactors) : '[]',
    statusJson: state.activeStatuses ? JSON.stringify(state.activeStatuses) : '[]',
    inventoryJson: state.inventory ? JSON.stringify(state.inventory) : '[]',
    equippedJson: state.equipped ? JSON.stringify(state.equipped) : '[]',
    storageCapacity: state.storageCapacity,
    memoryJson: state.longTermMemory ? JSON.stringify(state.longTermMemory) : '[]',
    pendingThreadsJson: state.pendingThreads ? JSON.stringify(state.pendingThreads) : '[]',
    characterIntentsJson: state.characterIntents ? JSON.stringify(state.characterIntents) : '[]',
    combatStateJson: state.combatSession ? String(state.combatSession) : 'null',
    npcsJson: state.npcs ? JSON.stringify(state.npcs) : '[]',
    causalGraphJson: state.causalGraph ? JSON.stringify(state.causalGraph) : '{"nodes":[],"edges":[]}',
    worldFactsJson: state.worldFacts ? JSON.stringify(state.worldFacts) : '[]',
    recentEventTypesJson: JSON.stringify(recentEventTypes),
    recentBlueprintCategoriesJson: JSON.stringify(recentBlueprintCategories),
    heartDemon: state.heartDemon,
    petsJson: state.pets ? JSON.stringify(state.pets) : '[]',
    exploredRealmsJson: state.exploredRealms ? JSON.stringify(state.exploredRealms) : '[]',
    styleAnchorsJson: state.styleAnchors ? JSON.stringify(state.styleAnchors) : '[]',
    entityEntriesJson: state.entityEntries ? JSON.stringify(state.entityEntries) : '[]',
    lastEventAge: opts?.lastEventAge ?? state.age,
  };
}
