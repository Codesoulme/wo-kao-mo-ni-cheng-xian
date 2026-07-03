import type { Realm } from './realm';
import type { ElementType } from './spiritual-root';
import type { ItemEntry } from './item';




// ==================== 战斗系统 (Task 20) ====================





export type CombatActionGroupKey = 'basicAttack' | 'technique' | 'spell' | 'defense' | 'item' | 'other';


export type CombatTempo = 'pressing' | 'stalemate' | 'opening' | 'danger' | 'flee_window' | 'turning' | 'chaos';


export type CombatActionOptionType = 'basic_attack' | 'technique' | 'spell' | 'defense' | 'item' | 'talisman' | 'other' | 'flee';


export type CombatActionOptionSource = 'body' | 'weapon' | 'technique' | 'spell' | 'artifact' | 'armor' | 'item' | 'environment' | 'social' | 'pet' | 'status' | 'ai';




// AI action palette: the combat UI is a projection of AI/world-state affordances.

// The engine validates hard facts (owned items, costs, statuses) instead of hard-coding all creative choices.

export interface CombatActionOption {

  id: string;

  name: string;

  description: string;

  actionType: CombatActionOptionType;

  source?: CombatActionOptionSource;

  enabled: boolean;

  disabledReason?: string;

  itemId?: string;

  skillIdx?: number;

  mpCost?: number;

  hpCost?: number;

  risk?: string;

  intent?: string;

  requiredItems?: string[];

  requiredStatuses?: string[];

  forbiddenStatuses?: string[];

  tags?: string[];

  // 意图作用范围：AI/引擎用于提示该动作是单体还是群攻；AI 仍可根据法术性质决定实际波及范围。

  targetScope?: 'single' | 'aoe';

}




export interface CombatActionGroup {

  enabled: boolean;

  label: string;

  disabledReason?: string;

  options: CombatActionOption[];

}




export interface CombatTacticalSituation {

  tempo: CombatTempo;

  advantage: 'player' | 'enemy' | 'even' | 'unclear';

  reason: string;

  playerOpening?: string;

  enemyPressure?: string;

  suggestedFocus?: string;

}




export interface CombatActionPalette {

  basicAttack: CombatActionGroup;

  technique: CombatActionGroup;

  spell: CombatActionGroup;

  defense: CombatActionGroup;

  item: CombatActionGroup;

  other: CombatActionGroup;

  generatedBy: 'engine-fallback' | 'ai' | 'hybrid';

  sceneHint?: string;

  tacticalSituation?: CombatTacticalSituation;

}




export interface CombatEnemy {

  id: string;

  name: string;             // 敌人名称

  description: string;       // 敌人描述

  hp: number; maxHp: number;

  attack: number; defense: number; speed: number;

  realm?: string;            // 敌人境界（用于战力参考）

  skills?: { name: string; description: string; cooldown: number; currentCooldown: number }[];

  // 敌人当前意图（AI 生成）：'attack' | 'skill' | 'defend' | 'flee'

  nextAction?: string;

  nextActionDesc?: string;

  drops?: { name: string; chance: number; rarity: string }[];

  // 敌方随身财物：被击败后，未毁掉者会作为战利品结算。

  lootItems?: ItemEntry[];

  lootSpiritStones?: number;

}




export interface CombatRound {

  round: number;

  playerAction: string;       // Player action label

  playerActionType: 'attack' | 'skill' | 'item' | 'defend' | 'flee' | 'scripture';

  playerDamage?: number;      // Damage dealt by player side

  playerHeal?: number;        // Healing received by player side

  enemyAction?: string;       // Enemy action label

  enemyActionType?: string;

  enemyDamage?: number;       // Damage dealt by enemy side

  narrative: string;          // In-world round narrative

  playerHpAfter: number;

  enemyHpAfter: number;

  playerMpAfter?: number;

  aiAudit?: string[];         // Engine audit trace for AI combat adjudication

  // 本节拍中所有参战敷人各自的行动（AI 推演、引擎 clamp 后落库）

  enemyActions?: {

    enemyIdx: number;

    name: string;

    action: string;

    actionType?: string;

    damage?: number;        // 对玩家造成的伤害

    hpAfter: number;        // 该敌本节结束后血量

    dead?: boolean;

  }[];

  // 玩家本节命中的敌人（可多个=群攻）

  playerHits?: { enemyIdx: number; name: string; damage: number; hpAfter: number; dead?: boolean }[];

  // 战斗对话（丰富叙事感，可选）

  dialogue?: { speaker: string; text: string }[];

  tacticalSituation?: CombatTacticalSituation;

}




// AI proposes a structured combat adjudication; the engine clamps and persists the authoritative result.

export interface CombatRoundProposal {

  playerActionLabel?: string;

  playerActionType?: CombatRound['playerActionType'];

  enemyAction?: string;

  enemyActionType?: string;

  playerDamage?: number;

  playerHeal?: number;

  enemyDamage?: number;

  mpCost?: number;

  consumeItem?: boolean;

  fleeOutcome?: 'success' | 'failed';

  narrative?: string;

  auditHints?: string[];

  // AI 推演：本节所有存活敌人各自的行动（多敌同台）

  enemyBeats?: {

    enemyId?: string;

    enemyIdx?: number;

    action?: string;

    actionType?: string;

    damageToPlayer?: number;

  }[];

  // AI 推演：玩家这一手命中的敌人与各自伤害（群攻/波及）

  playerHits?: { enemyId?: string; enemyIdx?: number; damage?: number }[];

  // AI 生成的战斗对话

  dialogue?: { speaker?: string; text?: string }[];

  // AI 推演：本节过后角色陷入需玩家决策的处境/本能想用某物的冲动

  playerImpulse?: { kind?: 'item' | 'contingency'; prompt?: string; itemId?: string; itemName?: string };

  tacticalSituation?: Partial<CombatTacticalSituation>;

  nextActions?: Partial<CombatActionOption>[];

}




export interface CombatSession {

  id: string;

  enemies: CombatEnemy[];     // 敌人列表（支持多敌）

  currentEnemyIdx: number;    // 当前攻击的敌人索引

  round: number;              // 当前回合数

  log: CombatRound[];         // 战斗日志

  status: 'ongoing' | 'victory' | 'defeat' | 'fled';

  startAge: number;           // 战斗开始时的年龄

  contextTitle?: string;      // 战斗背景标题

  contextNarrative?: string;  // 战斗背景叙事

  // 玩家战斗属性快照（含装备加成）

  playerHp: number; playerMaxHp: number;

  playerMp: number; playerMaxMp: number;

  playerAttack: number; playerDefense: number; playerSpeed: number;

  // 修仙三宝·身神 8 维快照（开打时定下，战斗内不变）—— 让 8 维真正进战斗公式

  playerForce?: number;        // 破势 = attack + spiritualSense*0.12 + comprehension*0.08

  playerGuard?: number;        // 护持 = defense + physicalFoundation*0.16 + soulStrength*0.06

  playerAgility?: number;      // 机变 = speed + spiritualSense*0.10 + luck*0.04

  playerSpiritualSense?: number;

  playerSoulStrength?: number;

  playerPhysicalFoundation?: number;

  playerLuck?: number;

  playerComprehension?: number;

  // 玩家可用的法术/法宝（从 equipped 提取）

  playerSkills?: { itemId?: string; name: string; description: string; mpCost: number; power: number; element?: ElementType | 'none'; adaptation?: number; sourceType?: string }[];

  // AI/engine current action palette: UI renders available interactions from this, not fixed combat assumptions.

  actionPalette?: CombatActionPalette;

  // AI/engine validated current battlefield read; UI displays it as world-state, not debug info.

  tacticalSituation?: CombatTacticalSituation;

  // AI proposed, engine-validated临场动作。面板只是投影这些可行动作。

  aiActionOptions?: CombatActionOption[];

  // 玩家可用的丹药（从 inventory 的 consumable 提取）

  playerItems?: { itemId: string; name: string; description: string; effect: string }[];

  // 战斗胜利后掉落（由 AI 在结束叙事中给出，引擎在 endCombat 中应用）

  victoryDrops?: ItemEntry[];

  // Task 22: 心魔试炼战斗的胜负心魔值变化（仅心魔战设置）

  victoryHeartDemonDelta?: number;

  defeatHeartDemonDelta?: number;

  // Task 22: 是否为心魔试炼战斗（用于战斗结束后特殊结算）

  isHeartDemonTrial?: boolean;

  // ===== Task 23 新增 =====

  // 参战灵宠快照（含 hp/attack/defense/speed/skill 与当前 cooldown）

  // 战斗中灵宠每回合自动追加一次攻击（伤害为玩家 attack 的 30-50%）

  petCombatant?: {

    id: string;

    name: string;

    species: string;

    hp: number;

    maxHp: number;

    attack: number;

    defense: number;

    speed: number;

    skillName: string;

    skillDesc: string;

    skillPower: number;

    skillCooldown: number;

    currentCooldown: number;

    element: string;

  };

  // Task 23: 符箓效果临时状态（本回合减伤、本回合敌人眩晕等）

  talismanDefenseActive?: number;  // 本回合减伤数值

  enemyStunned?: boolean;          // 敌人本回合是否被镇符眩晕

  tacticalInsights?: {

    id: string;

    enemyIdx: number;

    kind: 'weakness';

    stacks: number;

    bonusPct: number;

    expiresRound: number;

    source: string;

    note: string;

  }[];

  // 角色本能想法/应变关口：AI 判定玩家陷入需决策的处境（如中迷幻/被控/濒危）时产出；

  // kind='item' 时附上一件玩家现有、可对症的道具，UI 弹窗让玩家决定是否使用；kind='contingency' 为应变提示横幅。

  pendingImpulse?: { kind: 'item' | 'contingency'; prompt: string; itemId?: string; itemName?: string; reason?: 'danger' | 'stalemate' | 'control' | 'unknown' };

  // 连续低进展交锋计数；用于识别互相破不了防、日志重复、只剩机械消耗的僵局，并触发 AI/玩家破局时停。

  stalemateStreak?: number;

}


// Worker A (xiaoxin-A) - additive only, do not modify existing enums/interfaces.



// 战斗姿态枚举（角色在战斗中选择的主攻/防守/诱敌/脱身态度）

export type CombatStance =

  | 'aggressive'  // 猛攻：连打连击，放手抢攻

  | 'defensive'   // 守御：缩紧防圈，等待破绽

  | 'cunning'     // 诱敌：佯攻露绽，诱敌深入

  | 'retreat';    // 脱身：保留撤退余力




// 单次战斗姿态的使用记录（剩余回合 + 冷却）

export interface CombatStanceUsage {

  stance: CombatStance;

  // 当前姿态剩余回合数（0 = 已失效）

  usesLeft: number;

  // 切换到其他姿态后，本姿态的冷却回合

  cooldownTurns: number;

  // 该姿态在战斗中已经生效的回合

  turnsActive: number;

}




// ==================== AI-82: Combat Resource Management ====================

// Worker A (xiaoxin-A) - additive only.



// 战斗资源类型（行动消耗的不同维度）

export type CombatResourceType =

  | 'qi'        // 真元：功法/法术消耗

  | 'soul'      // 神识：神识类技能消耗

  | 'stamina'   // 体魄：硬功/体力消耗

  | 'focus';    // 心神：读心/识破/走神消耗




// 战斗资源当前快照（供 UI 显示与引擎决策使用）

export interface CombatResourceUsage {

  type: CombatResourceType;

  current: number;

  max: number;

  // 每回合自然回复（休整/调息等可临时调整）

  regenPerTurn: number;

  // 该资源在上一回合的消耗峰值（用于告警）

  recentDrain?: number;

}




// ==================== AI-85: Combat Combo Chain ====================

// Worker A (xiaoxin-A) - additive only.



// 连击记录（一串连续命中/连招产生的连击链）

export interface ComboChain {

  comboName: string;     // 连击名（如"三连刺""寒霜七击"）

  hits: number;          // 当前连击段数

  multiplier: number;    // 连击伤害乘数（>=1.0）

  expiresTurn: number;   // 在哪个回合号之后失效（不接续则断连）

}




// ==================== AI-81/AI-82/AI-83/AI-85 Helpers ====================



// 战斗姿态的中文标签（UI 显示用；引擎只关心枚举值）

export const COMBAT_STANCE_LABEL: Record<CombatStance, string> = {

  aggressive: '猛攻',

  defensive: '守御',

  cunning: '诱敌',

  retreat: '脱身',

};




// 战斗资源的中文标签

export const COMBAT_RESOURCE_LABEL: Record<CombatResourceType, string> = {

  qi: '真元',

  soul: '神识',

  stamina: '体魄',

  focus: '心神',

};








// ==================== AI-91/AI-92/AI-93/AI-95/AI-96/AI-97/AI-98/AI-99/AI-100/AI-101/AI-103 Types ====================

// Worker A (xiaoxin-A) - additive only. Do not modify existing enums/interfaces.



// ===== AI-91: Combat Log System =====

export interface CombatLogEntry {

  text: string;

  isSystem: boolean;

  round?: number;

  speaker?: string;

  timestamp?: number;

}




// ===== AI-92: Loot AI System =====

export interface LootTable {

  id: string;

  items: ItemEntry[];

  conditions: LootCondition[];

}




export interface LootCondition {

  kind: 'min_realm' | 'min_level' | 'has_status' | 'has_tag' | 'random' | 'faction' | 'spirit_stones';

  realm?: Realm;

  minLevel?: number;

  statusId?: string;

  tag?: string;

  chance?: number;

  faction?: string;

  minStones?: number;

}




/**

 * AI-G115: 战斗因果链。一拍战斗由「动作 → 触发 → 对手反应 → 环境效果」组成。

 * engine 用其校准 AI 出招的内在因果是否合理。

 */

export interface CombatCauseChain {

  action: string;             // 玩家/AI 当前动作描述

  trigger: string;            // 触发该动作的原因

  opponentResponse: string;   // 对手可能的回应

  environmentalEffect: string; // 环境/天地灵气等产生的次生效果

}




/**

 * AI-G116: 战斗陷入僵局时的破局选项。

 * engine 在 detectCombatStalemate=true 时根据角色与局势选其一作为下一步引导。

 */

export type StalemateExit =

  | 'deception'         // 诈退诱敌

  | 'risky-strike'      // 行险一击

  | 'disengage'         // 抽身脱离

  | 'ally-intervention' // 同门/盟友介入

  | 'terrain-shift';    // 地利变化（地形/灵气潮）
