// 世界大事年表（单例，跨角色持久化）
// AI 在角色出生时按世界日历年预排 500 年大事件，玩家不感知调度。
// 事件从 scheduled → active → concluded；事件本身有"预定年 + 允许浮动 ±N 年"，实际触发年记录下来。

import type { WorldEventType } from './world-event-scheduler';

export type ScheduledStatus = 'scheduled' | 'active' | 'concluded' | 'canceled';

export interface ScheduledWorldEvent {
  /** we-<year>-<type>-<rand4> */
  id: string;
  /** 复用现有 30 种 WorldEventType（同类型可多次） */
  type: WorldEventType;
  status: ScheduledStatus;
  /** 预定发生的世界日历年 */
  scheduledYear: number;
  /** 允许浮动 ±N 年（按 rarity 派生：mythic/legendary=8, epic=5, rare=3, uncommon/common=2） */
  scheduledDrift: number;
  /** 实际开始年（从 scheduled 转 active 时写入） */
  actualStartYear?: number;
  /** 实际结束年（从 active 转 concluded 时写入） */
  actualEndYear?: number;
  /** 计划持续年数（模板给的 duration；-1 表瞬时/永久） */
  plannedDuration: number;
  /** 实际持续年数（若被 AI 干预或事件浮动会改变） */
  actualDuration?: number;
  /** AI 排定时给的一句种子（约 20-40 字） */
  narrativeSeed: string;
  /** 实际发生时 LLM 扩写的 narrative；若 LLM 未扩写则用 seed */
  narrativeActual?: string;
  /** 由谁/什么引起（angel/character/npc/organic） */
  causedBy?: {
    kind: 'character' | 'npc' | 'organic';
    id?: string;
    reason?: string;
  };
  /** 受影响的角色 id 列表（narrative 中明确涉及） */
  affectedCharacterIds: string[];
  /** 关联的 pendingThread 标题（若事件产生了 thread） */
  linkedThreadTitles: string[];
  telemetry: {
    /** 生成时的世界年 */
    generatedAtYear: number;
    /** 触发生成的角色 id */
    generatedForCharacterId: string;
    /** 由哪条通道生成 */
    generatedByModel: 'llm' | 'rng';
    /** rarity roll（用于生成侧调试） */
    rarityRoll: number;
  };
}

export interface WorldChronicleShape {
  id: string;
  eraName: string;
  currentYear: number;
  generatedUntilYear: number;
  schedule: ScheduledWorldEvent[];
  history: ScheduledWorldEvent[];
  updatedAt: Date;
}

export function driftForRarity(rarity: string): number {
  switch (rarity) {
    case 'mythic':
    case 'legendary':
      return 8;
    case 'epic':
      return 5;
    case 'rare':
      return 3;
    default:
      return 2;
  }
}
