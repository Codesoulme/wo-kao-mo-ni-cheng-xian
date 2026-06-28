// 修仙模拟器 - Prompt 六区结构常量（TechDoc 5.1 + 18.6.5）
// 六区：恒定身份 / 场景行为 / 输入分类 / 状态快照 / 向量记忆 / 短期对话
// 利用 LLM 的 system 优先级：恒定身份 + 场景行为 + 输入分类放入 system；
// 动态数据（状态/记忆/对话）放入 user。

/** Prompt 六区 key 常量 */
export const PROMPT_ZONES = {
  SYSTEM_IDENTITY: 'system-identity',        // 恒定：身份 + 硬规则
  SCENE_BEHAVIOR: 'scene-behavior',          // 按场景加载
  INPUT_CLASSIFICATION: 'input-classification', // 每次注入
  STATE_SNAPSHOT: 'state-snapshot',          // 动态：角色状态
  RETRIEVED_MEMORIES: 'retrieved-memories',  // 长期记忆 / 任务索引
  RECENT_DIALOGUE: 'recent-dialogue',        // 最近事件 / 对话
} as const;

export type PromptZone = typeof PROMPT_ZONES[keyof typeof PROMPT_ZONES];

/** 各区 token 预算（用于规划 prompt 总量控制） */
export const TOKEN_BUDGETS: Record<PromptZone, number> = {
  [PROMPT_ZONES.SYSTEM_IDENTITY]: 2000,    // 不可压缩
  [PROMPT_ZONES.SCENE_BEHAVIOR]: 1500,
  [PROMPT_ZONES.INPUT_CLASSIFICATION]: 800,
  [PROMPT_ZONES.STATE_SNAPSHOT]: 1200,
  [PROMPT_ZONES.RETRIEVED_MEMORIES]: 1000,
  [PROMPT_ZONES.RECENT_DIALOGUE]: 1500,
};

/** 是否为 system 区（不可变身份 + 硬规则） */
export function isSystemZone(zone: PromptZone): boolean {
  return zone === PROMPT_ZONES.SYSTEM_IDENTITY
    || zone === PROMPT_ZONES.SCENE_BEHAVIOR
    || zone === PROMPT_ZONES.INPUT_CLASSIFICATION;
}

/** 是否为 user 区（玩家输入 + 动态状态） */
export function isUserZone(zone: PromptZone): boolean {
  return zone === PROMPT_ZONES.STATE_SNAPSHOT
    || zone === PROMPT_ZONES.RETRIEVED_MEMORIES
    || zone === PROMPT_ZONES.RECENT_DIALOGUE;
}