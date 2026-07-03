import type { Realm } from './realm';




export interface PetBondAIOutcome {

  name: string;

  species: PetSpecies;

  description: string;

  rarity: Pet['rarity'];

  element: Pet['element'];

  hp: number; attack: number; defense: number; speed: number;

  loyalty: number; satiety: number;

  sourceAcquired: string;

  skill: Pet['skill'];

  traits?: string[];

  passiveHint?: string;

  narrative: string;

}




export interface PetCareAIOutcome {

  satietyDelta: number;

  loyaltyDelta: number;

  expDelta: number;

  levelDelta?: number;

  attackDelta?: number;

  defenseDelta?: number;

  maxHpDelta?: number;

  narrative: string;

}




// 灵宠物种——参考《凡人修仙传》修仙世界常见灵宠

export type PetSpecies =

  | 'fox'          // 灵狐：幻术、敏捷

  | 'wolf'         // 灵狼：攻击、群战

  | 'snake'        // 灵蛇：毒术、阴狠

  | 'turtle'       // 灵龟：防御、长寿

  | 'eagle'        // 灵鹰：飞行、侦察

  | 'ape'          // 灵猿：力量、近战

  | 'spider'       // 灵蛛：织网、陷阱

  | 'butterfly'    // 灵蝶：迷幻、辅助

  | 'fish'         // 灵鱼：水系、灵动

  | 'tiger'        // 灵虎：威压、暴击

  | 'phoenix'      // 火凤：火系、复活

  | 'dragon';      // 幼龙：全能、稀有




export interface Pet {

  id: string;

  name: string;              // 灵宠名（玩家或 AI 起名）

  species: PetSpecies;       // 物种

  description: string;       // 描述

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  realm: Realm;              // 灵宠境界（决定基础属性）

  // 战斗属性

  hp: number;

  maxHp: number;

  attack: number;

  defense: number;

  speed: number;

  // 五行倾向（影响战斗属性与技能）

  element: 'metal' | 'wood' | 'water' | 'fire' | 'earth';

  // 情感状态

  loyalty: number;           // 忠诚度 0-100（低于 30 可能逃离）

  satiety: number;           // 饱食度 0-100（低于 30 忠诚度下降加速）

  // 成长

  level: number;             // 灵宠等级（喂养/战斗可提升）

  exp: number;               // 当前经验

  expToLevel: number;        // 升级所需经验

  // 来源

  sourceAcquired: string;    // 如何获得（"收服于青云山""前辈相赠"等）

  acquiredAge: number;       // 获得时的年龄

  // AI 生成的个体特性 / 被动倾向（仅作叙事与轻量加成参考，具体数值仍由引擎 clamp）

  traits?: string[];

  passiveHint?: string;

  // 主动技能（每只灵宠一个主动技能，参战时使用）

  skill: {

    name: string;            // 技能名（如"幻影分身""毒雾""烈焰冲击"）

    description: string;     // 技能描述

    power: number;           // 技能威力倍率（1.0=普通攻击等价）

    cooldown: number;        // 冷却回合数

  };

  // AI-65: 灵宠/灵虫区分

  type?: 'pet' | 'insect' | 'swarm' | 'beast';  // 默认 pet；灵虫=insect；群=swarm；神兽=beast

  swarmCount?: number;        // 灵虫群数量（仅 type=swarm/insect）

  combatSkillIds?: string[];  // 战斗技能 id 列表（用于多技能灵兽）

}




// 灵宠物种 → 默认属性模板

export const PET_SPECIES_TEMPLATES: Record<PetSpecies, {

  name: string;

  defaultElement: 'metal' | 'wood' | 'water' | 'fire' | 'earth';

  baseHp: number;

  baseAttack: number;

  baseDefense: number;

  baseSpeed: number;

  skillName: string;

  skillDesc: string;

  skillPower: number;

  skillCooldown: number;

}> = {

  fox:      { name: '灵狐',   defaultElement: 'water', baseHp: 60,  baseAttack: 12, baseDefense: 4,  baseSpeed: 18, skillName: '幻影分身', skillDesc: '化出数道幻影迷惑敌人', skillPower: 1.5, skillCooldown: 3 },

  wolf:     { name: '灵狼',   defaultElement: 'metal', baseHp: 80,  baseAttack: 16, baseDefense: 6,  baseSpeed: 14, skillName: '狼群围猎', skillDesc: '召唤同伴围攻敌人', skillPower: 1.8, skillCooldown: 4 },

  snake:    { name: '灵蛇',   defaultElement: 'wood',  baseHp: 50,  baseAttack: 14, baseDefense: 3,  baseSpeed: 12, skillName: '毒雾吐息', skillDesc: '喷吐毒雾持续伤害', skillPower: 1.4, skillCooldown: 3 },

  turtle:   { name: '灵龟',   defaultElement: 'water', baseHp: 120, baseAttack: 8,  baseDefense: 14, baseSpeed: 6,  skillName: '玄甲护主', skillDesc: '为玩家挡下伤害', skillPower: 1.0, skillCooldown: 3 },

  eagle:    { name: '灵鹰',   defaultElement: 'metal', baseHp: 55,  baseAttack: 15, baseDefense: 4,  baseSpeed: 20, skillName: '俯冲利爪', skillDesc: '从空中俯冲攻击要害', skillPower: 1.7, skillCooldown: 3 },

  ape:      { name: '灵猿',   defaultElement: 'earth', baseHp: 100, baseAttack: 18, baseDefense: 8,  baseSpeed: 10, skillName: '巨力猛砸', skillDesc: '巨力猛砸造成重创', skillPower: 2.0, skillCooldown: 4 },

  spider:   { name: '灵蛛',   defaultElement: 'wood',  baseHp: 45,  baseAttack: 11, baseDefense: 5,  baseSpeed: 13, skillName: '蛛网束缚', skillDesc: '吐蛛网束缚敌人减速', skillPower: 1.2, skillCooldown: 3 },

  butterfly:{ name: '灵蝶',   defaultElement: 'wood',  baseHp: 40,  baseAttack: 7,  baseDefense: 3,  baseSpeed: 16, skillName: '迷幻花粉', skillDesc: '散布花粉让敌人迷乱', skillPower: 0.8, skillCooldown: 2 },

  fish:     { name: '灵鱼',   defaultElement: 'water', baseHp: 65,  baseAttack: 10, baseDefense: 5,  baseSpeed: 15, skillName: '水刃冲击', skillDesc: '水刃冲击敌人', skillPower: 1.3, skillCooldown: 2 },

  tiger:    { name: '灵虎',   defaultElement: 'fire',  baseHp: 95,  baseAttack: 17, baseDefense: 7,  baseSpeed: 13, skillName: '虎威震慑', skillDesc: '虎威震慑降低敌人攻击', skillPower: 1.5, skillCooldown: 4 },

  phoenix:  { name: '火凤',   defaultElement: 'fire',  baseHp: 110, baseAttack: 20, baseDefense: 8,  baseSpeed: 17, skillName: '涅槃烈焰', skillDesc: '烈焰焚烧一切', skillPower: 2.2, skillCooldown: 5 },

  dragon:   { name: '幼龙',   defaultElement: 'metal', baseHp: 150, baseAttack: 22, baseDefense: 12, baseSpeed: 16, skillName: '龙息吐息', skillDesc: '龙息横扫战场', skillPower: 2.5, skillCooldown: 5 },

};




// ==================== AI-88: Pet Evolution ====================

// Worker B (xiaoxin-B) - additive only.



// 灵宠进阶阶段（不同阶段解锁不同技能/属性上限）

export type PetEvolutionStage =

  | 'infant'    // 幼生期：初始捕获阶段

  | 'youth'     // 成长期：基础技能解锁

  | 'mature'    // 成熟期：属性大幅提升

  | 'ascended'; // 化形期：解锁化形与高阶技能




// 单阶段进阶条件

export interface PetEvolutionRequirement {

  stage: PetEvolutionStage;

  // 最低年龄（角色持有该宠物的年限）

  minAge: number;

  // 最低境界（角色境界等级）

  minRealmLevel: number;

  // 必备材料 item id 列表

  materials: string[];

  // 最低忠诚度要求 0..100

  minLoyalty: number;

}




// 进阶资格校验结果

export interface PetEvolutionEligibility {

  petId: string;

  currentStage: PetEvolutionStage;

  nextStage?: PetEvolutionStage;

  eligible: boolean;

  missing: string[]; // 缺少的条件（如材料名/属性不足原因）

}




// ==================== AI-89: Pet Insight Communication ====================

// Worker B (xiaoxin-B) - additive only.



// 灵宠通过灵识传递给主人的顿悟片段

export interface PetInsight {

  petId: string;

  petName: string;

  insightName: string;     // 顿悟名称（如"风之呼吸""潮汐律动"）

  source: string;           // 顿悟来源（如"观海七日""与主人共同闭关"）

  learnedAge: number;       // 角色学习时的年龄

  // 顿悟可解锁的能力描述

  effect: {

    cultivationRateBonus?: number;   // 修炼速率加成（倍率）

    elementAffinity?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';

    techniqueHint?: string;          // 提示可修习的功法

  };

}




// 灵识对话的请求与响应

export interface PetCommunication {

  petId: string;

  messageType: 'idle' | 'combat' | 'mood' | 'discovery' | 'danger';

  trigger: string;          // 触发原因（世界内事件）

  response: string;         // 灵识传递的内容（角色可感知的一句话）

  learnedAge: number;

  // 可能附带的顿悟片段（不一定每次都有）

  insight?: PetInsight;

}




// ==================== AI-90: Pet Combat Skills ====================

// Worker B (xiaoxin-B) - additive only.



// 灵宠在战斗中可使用的技能定义

export interface PetCombatSkill {

  skillId: string;

  name: string;

  description: string;

  // 技能威力系数（相对基础攻击）

  power: number;

  // 冷却回合数

  cooldown: number;

  // 作用范围（单体/群体）

  range: 'single' | 'all_enemies' | 'all_allies' | 'self';

  // 技能效果类型

  effect: 'physical' | 'elemental' | 'heal' | 'buff' | 'debuff' | 'control';

  // 关联元素（用于元素克制计算）

  element?: 'metal' | 'wood' | 'water' | 'fire' | 'earth';

}




// 技能在战斗中的使用记录（用于冷却与次数控制）

export interface PetSkillUsage {

  skillId: string;

  lastUsedTurn: number;     // 上次使用的回合序号

  usesLeft: number;         // 剩余可用次数（-1 表示无限制）

}




// 单次技能使用产生的战斗事件

export interface PetCombatSkillEvent {

  petId: string;

  skillId: string;

  skillName: string;

  turn: number;

  targetId?: string;

  damage?: number;

  heal?: number;

  buffApplied?: string[];

  debuffApplied?: string[];

  narrativeHint: string;

}// ==================== AI-81: Combat Action Stance ====================




// ===== AI-95: Pet Cultivation Path =====

export type PetCultivationPath =

  | 'combat'

  | 'assist'

  | 'transform'

  | 'contract';
