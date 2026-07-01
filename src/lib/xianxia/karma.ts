// Phase-α 批 1 α-2: 因果业力（修仙沉浸感 PoC）
// 纯函数模块——只做数学，不落 state、不读 AI、不写事件。
// 玩家可见 narrative 不要透露以下机制词：karma / merit / sin / 算法 / 引擎 / 字段 / 概率。

// 善恶连续轴钳到 -1..+1（含端点）
export function clampKarma(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

export type KarmaDelta = {
  meritDelta?: number;
  sinDelta?: number;
  karmaDelta?: number;
};

export type KarmaApplyResult = {
  karma: number;
  merit: number;
  sin: number;
  applied: boolean;
};

// 应用一笔业力变化
// - merit / sin 单调递增（< 0 视为无效，钳到 0）
// - karma 由 merit / (merit + sin + 10) - sin / (merit + sin + 10) 派生，再加上传入的 karmaDelta，最后钳到 -1..+1
// - applied: deltas 中存在任意 > 0 的 merit / sin / karma 改动
export function applyKarmaDelta(
  state: { karma: number; merit: number; sin: number },
  delta: KarmaDelta,
): KarmaApplyResult {
  const meritIn = Number(delta.meritDelta || 0);
  const sinIn = Number(delta.sinDelta || 0);
  const karmaIn = Number(delta.karmaDelta || 0);
  const meritSafe = meritIn > 0 ? meritIn : 0;
  const sinSafe = sinIn > 0 ? sinIn : 0;
  const nextMerit = Math.max(0, state.merit + meritSafe);
  const nextSin = Math.max(0, state.sin + sinSafe);
  const total = nextMerit + nextSin + 10;
  const meritRatio = nextMerit / total;
  const sinRatio = nextSin / total;
  const derivedKarma = meritRatio - sinRatio;
  const nextKarma = clampKarma(derivedKarma + karmaSafe(karmaIn));
  const applied = meritSafe > 0 || sinSafe > 0 || karmaIn !== 0;
  return { karma: nextKarma, merit: nextMerit, sin: nextSin, applied };
}

function karmaSafe(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

// 善恶三类（用于 AI 叙事倾向判定）
export function classifyKarma(karma: number): '善' | '中性' | '恶' {
  if (karma > 0.2) return '善';
  if (karma < -0.2) return '恶';
  return '中性';
}

// 修仙叙事沉浸短语——只读返回 0~3 个中文短语，绝不暴露机制词
// 阈值基于修仙小说的常见设定（高积善 / 重杀业 / 隐隐波动）
export function karmaNarrativeTone(karma: number, merit: number, sin: number): string[] {
  const tones: string[] = [];
  if (karma > 0.5 && merit > 30) {
    tones.push('天降祥瑞', '善缘广布');
  } else if (karma < -0.5 && sin > 30) {
    tones.push('业火炙心', '怨债缠身');
  } else if (karma > 0.2 && karma <= 0.5) {
    tones.push('清风徐来');
  } else if (karma >= -0.5 && karma < -0.2) {
    tones.push('杀伐未净');
  }
  return tones;
}

// 事件 → 业力变化预估（基于 tags 命中）
// 命中「善举」tag → meritDelta=+1
// 命中「杀业」tag → sinDelta=+1
// 命中「义举」（功过相抵类）→ meritDelta=+1 且 sinDelta=+1
// 完全未命中 → null（调用方按 null 走 zero delta）
export function computeKarmaShiftFromEvent(event: {
  type?: string;
  tags?: string[];
  aiTag?: string;
  cause?: string;
  payload?: any;
}): { meritDelta?: number; sinDelta?: number; reason: string } | null {
  const tagsRaw: string[] = [];
  if (Array.isArray(event.tags)) tagsRaw.push(...event.tags.map(String));
  if (typeof event.aiTag === 'string' && event.aiTag) tagsRaw.push(event.aiTag);
  if (typeof event.cause === 'string' && event.cause) tagsRaw.push(event.cause);
  const tags = tagsRaw.map(t => t.toLowerCase());

  const hasAny = (kws: string[]): boolean => {
    for (const t of tags) {
      for (const k of kws) {
        if (t.includes(k.toLowerCase())) return true;
      }
    }
    return false;
  };

  const MERIT_KW = ['救人', '济世', '放过', '忏悔', '善缘', '渡化', '传法'];
  const SIN_KW = ['杀无辜', '灭门', '屠戮', '噬主', '背誓', '夺宝', '毁约'];
  const REDEEM_KW = ['大义灭亲', '杀仇敌', '正道伏魔'];

  const meritHit = hasAny(MERIT_KW);
  const sinHit = hasAny(SIN_KW);
  const redeemHit = hasAny(REDEEM_KW);

  if (redeemHit) {
    return { meritDelta: 1, sinDelta: 1, reason: '义举功过相抵' };
  }
  if (meritHit && sinHit) {
    return { meritDelta: 1, sinDelta: 1, reason: '因果纠缠' };
  }
  if (meritHit) {
    return { meritDelta: 1, reason: '行善积德' };
  }
  if (sinHit) {
    return { sinDelta: 1, reason: '罪业加身' };
  }
  return null;
}
