import type { AttributeChange } from './event';




// ==================== Task 21: 阵法系统 ====================



export type FormationType =

  | 'spirit_gathering'  // 聚灵阵：增加修炼速度

  | 'protection'        // 护体阵：增加防御

  | 'concealment'       // 迷踪阵：增加气运/避敌

  | 'killing'           // 杀阵：增加攻击（战斗中生效）

  | 'illusion'          // 幻阵：影响敌人命中率

  | 'fire'              // 火阵：火属性加成

  | 'water'             // 水阵：水属性加成

  | 'wood'              // 木阵：木属性加成

  | 'metal'             // 金阵：金属性加成

  | 'earth';            // 土阵：土属性加成




export interface Formation {

  id: string;

  name: string;             // 阵法名（如"小聚灵阵""九宫护体阵"）

  type: FormationType;

  description: string;       // 阵法描述

  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

  // 阵法效果（激活后应用到角色）

  effects: {

    target_attribute: string;

    operation: 'add' | 'multiply';

    value: number;

    description: string;

  }[];

  // 激活所需条件

  requirements: {

    minRealm?: string;       // 最低境界

    minComprehension?: number; // 最低悟性

    spiritStoneCost?: number;  // 每岁维持灵石消耗

  };

  // 阵盘物品 id（对应的 tool 类物品）

  formationDiskItemId?: string;

  // 是否已激活

  active: boolean;

}




// AI-62: 阵法分类（6 类：困/杀/幻/防/辅/陷）—— 已有 FormationType 不动，此为细分类

export type FormationCategory = 'binding' | 'slaughter' | 'illusion' | 'defense' | 'support' | 'trap';




// ==================== AI-87: Formation Drawing Process ====================

// Worker B (xiaoxin-B) - additive only.



// 阵法绘制的连续步骤（必须按顺序完成才能激活阵法）

export type FormationDrawingStep =

  | 'meditate'    // 入定：心神沉入阵眼所在位置

  | 'trace'       // 走线：以灵力勾勒阵纹走向

  | 'infuse'      // 注灵：将材料灵气注入阵纹节点

  | 'anchor'      // 定锚：锁定阵法根基，防止走线崩溃

  | 'activate';   // 启阵：阵法生效




// 单次阵法绘制会话（玩家在战斗中或闭关中尝试刻画一道阵法）

export interface FormationDrawingSession {

  id: string;

  formationId: string;

  formationName: string;

  characterId: string;

  startedAge: number;             // 开始的角色年龄

  currentStep: FormationDrawingStep;

  completedSteps: FormationDrawingStep[];

  // 已消耗的材料 item id 列表（防止重复消耗）

  materialsUsed: string[];

  // 每一步的成功率 0..1，由引擎派生

  stepSuccessChance: number;

  // 累计失败次数（达到阈值则绘制失败，需从头开始）

  failureStreak: number;

  // 是否已完成（成功/失败）

  finished: boolean;

  success?: boolean;

  // 已消耗回合数（用于战斗内节奏控制）

  turnsSpent: number;

}




// 绘制进度推进结果

export interface FormationDrawingProgress {

  session: FormationDrawingSession;

  advanced: boolean;              // 是否推进到下一步

  failed: boolean;                // 本步是否失败

  finished: boolean;              // 整个会话是否结束

  attributeChanges: AttributeChange[];

  narrativeHint?: string;

}




// ===== AI-97: Formation Stack =====

export type FormationStackRule =

  | 'independent'

  | 'boosted'

  | 'conflict'

  | 'replace';




export interface FormationStackResult {

  totalEffect: number;

  warnings: string[];

  appliedRule: FormationStackRule;

  winners: string[];

}
