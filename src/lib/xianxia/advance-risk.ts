// 行动前影子推演 + 风险评分（系统 1，0 次 LLM）。
//
// 背景：一次推进原本是纯单向管线——aiOutput 从 parse 出来直接进 executeAIEvent 落地，
// 中间没有任何评估。于是「本轮角色气血见底 / 心魔翻涌 / 当场陨落」这类结果，
// 玩家只能在结算后被动接受，叙事上常见「硬撑得胜」的突兀感。
//
// 本模块做的事：
//   1. structuredClone(state) 拿一份离线副本，打上影子标记；
//   2. 拿同一个 aiOutput 跑一次真正的 executeAIEvent（引擎是不可变风格准纯函数，
//      唯一副作用 appendEvent 已在 execute-ai-event.ts 由 __shadowRun 守卫屏蔽）；
//   3. 从结果里把散落各处的风险原料（died / hp 比例 / heartDemon / 寿元压力 /
//      边界告警条数）汇成加权因子，聚合成 0..1 的分数与五档等级；
//   4. 分数越阈值时产出一段只讲叙事约束的 advisoryPrompt，供 route 注入下一次生成。
//
// 设计约束：
// - 纯函数：不写库、不发请求、不改传入的 state。
// - 结果只是「本轮若按此 aiOutput 落地会怎样」的离线试算，绝不代替真实执行。
// - advisoryPrompt 只写叙事层要求，绝不出现任何机制词（预演 / 分数 / 阈值 / 引擎…），
//   因为它会原样进 prompt，而 prompt-builder 明令禁止元叙事口吻。

import { executeAIEvent } from './engine/execute-ai-event';
import { lifespanPressure } from './realm-lifespan';
import type { CharacterState, AIEventOutput } from './types';

/** 单条风险因子。weight 为该因子对总分的贡献（0..1），detail 是给日志看的人话说明。 */
export interface RiskFactor {
  code: string;
  weight: number;
  detail: string;
  refId?: string;
}

export interface RiskAssessment {
  /** 聚合风险分，0..1。 */
  score: number;
  /** 五档等级，与 ActionProjection.risk 同一套枚举。 */
  level: 'safe' | 'low' | 'medium' | 'high' | 'deadly';
  /** 命中的风险因子，按权重降序。 */
  factors: RiskFactor[];
  /** 叙事修正提示；score 未超阈值时为空串。 */
  advisoryPrompt: string;
  /** 影子推演落点快照（内部诊断用，不面向玩家）。 */
  shadow: {
    died: boolean;
    hpAfter: number;
    heartDemonAfter: number;
    ageAfter: number;
    boundaryWarningCount: number;
    breakthroughHappened: boolean;
  };
  /** 本次试算耗时（毫秒）。 */
  durationMs: number;
}

/** 超过此分数才产出 advisoryPrompt 并触发系统 2 修正。 */
export const DEFAULT_RISK_THRESHOLD = 0.8;

/**
 * 等级切分。deadly 只留给「确实死了」或分数极高的情形，
 * 免得寻常的一场恶战被判成必死之局、反而让叙事失了张力。
 */
function toLevel(score: number, died: boolean): RiskAssessment['level'] {
  if (died) return 'deadly';
  if (score >= 0.85) return 'deadly';
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  if (score >= 0.15) return 'low';
  return 'safe';
}

/**
 * 权重表。取值理由：
 * - died 0.75：单因子即可把分数顶到 deadly 档，因为陨落是不可逆终局。
 * - hp 见底 0.30 / 偏低 0.14：气血是最直观的濒危信号，但活着就还有转机，不给满权。
 * - 心魔缠身 0.26 / 初现 0.10：与 deriveHeartDemonProjection 的 81 / 51 分级同口径。
 * - 寿元 expired 0.30 / critical 0.18 / near_end 0.08：沿用 lifespanPressure 四档。
 * - 突破同轮 +0.10：大境突破会引雷劫判定，本轮天然更险。
 * - 边界告警每条 0.04（上限 0.16）：ai-boundary-validator 全文只 push info/warning，
 *   error 恒为零，所以这里只数 warning，不依赖 error 计数。
 */
const W = {
  died: 0.75,
  hpCritical: 0.30,
  hpLow: 0.14,
  heartDemonHigh: 0.26,
  heartDemonMid: 0.10,
  lifespanExpired: 0.30,
  lifespanCritical: 0.18,
  lifespanNearEnd: 0.08,
  breakthrough: 0.10,
  boundaryWarningEach: 0.04,
  boundaryWarningCap: 0.16,
} as const;

/**
 * 叙事修正提示。只描述「本轮该往哪个方向改写」，不解释为什么。
 * 措辞刻意贴着角色主观视角（察觉 / 收手 / 求援 / 退避），
 * 这样 LLM 拿到后写出来的是人物判断，而不是旁白提醒。
 */
function buildAdvisoryPrompt(factors: RiskFactor[], shadow: RiskAssessment['shadow']): string {
  const codes = new Set(factors.map((f) => f.code));
  const lines: string[] = [];
  lines.push('【本轮走向修正】');

  if (codes.has('death')) {
    lines.push('- 本轮如实写下去角色会当场陨落。请改写：让角色在最险处先察觉危兆，选择收手、求援、退避或以代价换生路——可以断一臂、可以丢了要紧物件、可以留下未了的仇怨，但不要写成硬撑得胜，也不要写成安然无事。');
  } else if (codes.has('hp_critical')) {
    lines.push('- 本轮角色气血将见底。请让角色自己感到力竭、伤处发寒、握不稳兵刃，因而中途改主意：撤、拖、避、或求人相助。得手也要写成勉力挣来的，不要写成从容取胜。');
  } else if (codes.has('hp_low')) {
    lines.push('- 本轮角色会受不轻的伤。请把这份损耗写进动作与感觉里，让后半段的行事因伤而收敛。');
  }

  if (codes.has('heart_demon_high')) {
    lines.push('- 本轮角色心魔翻涌。请写出杂念上涌、旧事翻起、看人看物都生疑的那种失据感，让角色的决断因此偏移或迟疑，而不是照原计划稳稳做完。');
  } else if (codes.has('heart_demon_mid')) {
    lines.push('- 角色心绪不宁，落笔时给一两处失神或迟疑的细节。');
  }

  if (codes.has('lifespan_expired') || codes.has('lifespan_critical')) {
    lines.push('- 角色已近大限。请写出衰朽之相与不祥之兆——精力难以为继、旧伤发作、身边人的神色，让本轮的选择带上「时日无多」的分量。');
  } else if (codes.has('lifespan_near_end')) {
    lines.push('- 角色渐入暮年，笔下可有力不从心之处。');
  }

  if (codes.has('breakthrough_in_risk')) {
    lines.push('- 本轮涉及境界跃迁，且处境本就凶险。请把关口写足：先有征兆，再有煎熬，成与不成都要有代价，不要一笔带过。');
  }

  lines.push('- 以上只改本轮的走向与分量，其余照原有设定与线索继续，人物性情与笔触保持一致。');
  return lines.join('\n');
}

/**
 * assessAdvanceRisk：影子推演 + 风险评分。
 *
 * @param state    当前角色状态（不会被改动；内部走 structuredClone）
 * @param aiOutput 待落地的 AI 输出
 * @param options  threshold 默认 0.8——超过才产出 advisoryPrompt
 * @returns 评估结果；任何环节抛错返回 null（调用方一律沿用原 aiOutput）
 */
export function assessAdvanceRisk(
  state: CharacterState,
  aiOutput: AIEventOutput,
  options?: { threshold?: number },
): RiskAssessment | null {
  const startedAt = Date.now();
  try {
    if (!state || !aiOutput) return null;
    const threshold = typeof options?.threshold === 'number' ? options.threshold : DEFAULT_RISK_THRESHOLD;

    // 影子副本 + 标记。标记走 __shadowRun，execute-ai-event.ts 里的 appendEvent 见此即跳过。
    const shadowState = structuredClone(state) as CharacterState;
    (shadowState as any).__shadowRun = true;

    const result = executeAIEvent(shadowState, aiOutput);
    const after = result.state;

    const hpAfter = Number(after?.hp ?? 0);
    const maxHpAfter = Number(after?.maxHp ?? 0);
    const hpRatio = maxHpAfter > 0 ? Math.max(0, Math.min(1, hpAfter / maxHpAfter)) : 1;
    const heartDemonAfter = Number((after as any)?.heartDemon ?? 0);
    const ageAfter = Number(after?.age ?? 0);
    const boundaryWarningCount = Array.isArray(result.aiBoundaryTrace)
      ? result.aiBoundaryTrace.filter((t) => t?.severity === 'warning').length
      : 0;

    const factors: RiskFactor[] = [];

    if (result.died) {
      factors.push({ code: 'death', weight: W.died, detail: `本轮落地即陨落（${result.deathReason || '未注明缘由'}）` });
    }

    if (!result.died) {
      if (hpRatio <= 0.15) {
        factors.push({ code: 'hp_critical', weight: W.hpCritical, detail: `气血见底 ${hpAfter}/${maxHpAfter}（${Math.round(hpRatio * 100)}%）` });
      } else if (hpRatio <= 0.35) {
        factors.push({ code: 'hp_low', weight: W.hpLow, detail: `气血偏低 ${hpAfter}/${maxHpAfter}（${Math.round(hpRatio * 100)}%）` });
      }
    }

    if (heartDemonAfter >= 81) {
      factors.push({ code: 'heart_demon_high', weight: W.heartDemonHigh, detail: `心魔缠身 ${heartDemonAfter}` });
    } else if (heartDemonAfter >= 51) {
      factors.push({ code: 'heart_demon_mid', weight: W.heartDemonMid, detail: `心魔初现 ${heartDemonAfter}` });
    }

    const pressure = lifespanPressure(ageAfter, Number(after?.lifespan ?? 0));
    if (pressure === 'expired') {
      factors.push({ code: 'lifespan_expired', weight: W.lifespanExpired, detail: `寿元已尽（${ageAfter}/${after?.lifespan}）` });
    } else if (pressure === 'critical') {
      factors.push({ code: 'lifespan_critical', weight: W.lifespanCritical, detail: `大限迫近（${ageAfter}/${after?.lifespan}）` });
    } else if (pressure === 'near_end') {
      factors.push({ code: 'lifespan_near_end', weight: W.lifespanNearEnd, detail: `寿元渐薄（${ageAfter}/${after?.lifespan}）` });
    }

    // 突破本身不算风险，只在已有其他险情时叠加——大境跃迁会引雷劫判定，雪上加霜才要提。
    if (result.breakthroughHappened && result.breakthroughMajor && factors.length > 0) {
      factors.push({ code: 'breakthrough_in_risk', weight: W.breakthrough, detail: `大境跃迁至 ${result.newRealm || '未知'}，本轮处境本已凶险` });
    }

    if (boundaryWarningCount > 0) {
      const w = Math.min(W.boundaryWarningCap, boundaryWarningCount * W.boundaryWarningEach);
      factors.push({ code: 'boundary_warnings', weight: w, detail: `边界告警 ${boundaryWarningCount} 条` });
    }

    // 聚合：概率式取补（1 - Π(1 - w)）而非直接相加。
    // 好处是多个中等因子会累积但永不越界，也不会因为凑够几条就误判成必死。
    let inverse = 1;
    for (const f of factors) inverse *= 1 - Math.max(0, Math.min(1, f.weight));
    const score = Math.max(0, Math.min(1, 1 - inverse));

    factors.sort((a, b) => b.weight - a.weight);

    const shadow = {
      died: !!result.died,
      hpAfter,
      heartDemonAfter,
      ageAfter,
      boundaryWarningCount,
      breakthroughHappened: !!result.breakthroughHappened,
    };

    return {
      score,
      level: toLevel(score, !!result.died),
      factors,
      advisoryPrompt: score > threshold ? buildAdvisoryPrompt(factors, shadow) : '',
      shadow,
      durationMs: Date.now() - startedAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[advance-risk] 影子试算失败（非致命，沿用原输出）：${msg}`);
    return null;
  }
}
