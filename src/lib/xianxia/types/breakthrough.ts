import type { Realm } from './realm';




// ==================== AI-83: Breakthrough Stage Refinement ====================

// Worker A (xiaoxin-A) - additive only.



// 突破阶段（一次大境界突破内部可拆分的微观步骤）

export type BreakthroughStage =

  | 'perception'  // 感悟：感知境界门槛

  | 'condense'    // 凝聚：凝聚真元冲击关隘

  | 'storm'       // 风暴：内景风雷动

  | 'stabilize'   // 稳固：稳定新境界

  | 'passed';     // 已通过




// 单次突破尝试的状态（多次尝试/外援/时间累计）

export interface BreakthroughAttempt {

  realmBefore: Realm;

  realmAfter: Realm;

  stage: BreakthroughStage;

  attemptNumber: number;       // 第几次尝试（>=1）

  helperCount: number;         // 护法/外援人数

  startedAge: number;          // 开始时的角色年龄

  // 当前阶段已消耗的回合/天数

  elapsedTurns: number;

}




// 突破阶段的中文标签

export const BREAKTHROUGH_STAGE_LABEL: Record<BreakthroughStage, string> = {

  perception: '感悟',

  condense: '凝聚',

  storm: '风暴',

  stabilize: '稳固',

  passed: '已过',

};
