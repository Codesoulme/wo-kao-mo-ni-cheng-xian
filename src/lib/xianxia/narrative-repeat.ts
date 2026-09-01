/**
 * 开笔复读体检。
 *
 * 2026-08-31 实跑症候：连着三条主事件开头几乎一字不差 ——
 *   「秦老客把那张旧帖子又推近了些，砚书没急着收」写了两遍，
 *   「砚书把灶膛边那只旧木匣重新推回灰堆旁」写了三遍。
 *
 * 我起初把它记成候选预载被重放，读完代码发现判错了：活路由每轮都现算候选，
 * 从不读 advancePreload 那张表。真正的缘由在喂给模型的上下文形状上——
 * 近期事件一律取 narrative 的**前** 80 字，也就是每一幕**怎么开头**的。
 * 于是模型被告知"紧接上一幕"，手上却只有上一幕的开场，不知道那一幕收在哪里；
 * 它能做的最合理的事，就是把那个开场再写一遍。
 *
 * 这里给两件东西：让模型看见上一幕的收尾（生成侧），
 * 以及写完之后量一次开笔像不像（校验侧）。
 */

/** 比对前先把版式噪声抹平：缩进、全角空格、引号、标点一概不算内容。 */
function normalizeForCompare(text: string): string {
  return String(text || '')
    .replace(/[\s　]+/g, '')
    .replace(/[，。！？；：、"'「」『』（）《》…—·,.!?;:()"']/g, '');
}

/**
 * 取开笔：正文头一两个分句。
 * 报时词（月余后、当晚）不算开笔内容——两幕都从"月余后"起笔并不算复读，
 * 真正该抓的是后面那句动作。
 */
export function openingClause(text: string, maxLen = 28): string {
  const raw = String(text || '').replace(/^[\s　]+/, '');
  const clauses = raw.split(/[，。！？；\n]/).filter((c) => c.trim());
  let taken = '';
  for (const c of clauses) {
    const stripped = c.replace(/^(月余后|旬日后|数日后|翌日|次日|当晚|当夜|入夜后|午后|凌晨|拂晓|清晨|黄昏|夜半|一季后|闭关\S{0,4}后|\S{0,6}年后)/, '');
    taken += stripped;
    if (normalizeForCompare(taken).length >= 12) break;
  }
  return normalizeForCompare(taken || raw).slice(0, maxLen);
}

/** 字二连的 Dice 相似度。0 = 毫不相干，1 = 一模一样。 */
export function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i + 1 < s.length; i += 1) out.push(s.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.length || !gb.length) return 0;
  const pool = new Map<string, number>();
  for (const g of gb) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0;
  for (const g of ga) {
    const n = pool.get(g) || 0;
    if (n > 0) { hit += 1; pool.set(g, n - 1); }
  }
  return (2 * hit) / (ga.length + gb.length);
}

/**
 * 相似到这个程度就算复读。
 *
 * 用实跑抓到的样本标定过，不是拍的：
 *   1.00  同一句起笔原样再写一遍（「秦老客把那张旧帖子又推近了些」两遍）
 *   0.57  换了主语但仍在重摆同一件东西（「砚书把旧木匣推回灰堆旁」vs「父亲让砚书把旧木匣搬近些」）
 *   0.16  同人物换场（秦老客在后门米筐边 vs 递帖子）
 *   0.11  另起一幕（月余后回抄经房 vs 当夜经房夜话）
 *   0.00  彻底另一场戏
 * 0.52 这条线把上面两档判成复读、下面三档放过：0.57 那种读起来确实是卡住了
 * ——同一件物件被反复摆来摆去，玩家看到的就是剧情在原地打转。
 */
export const OPENING_REPEAT_THRESHOLD = 0.52;

export type OpeningRepeatVerdict = {
  repeated: boolean;
  ratio: number;
  /** 撞上的是近期第几条（0 = 上一幕），供日志定位 */
  againstIndex: number;
  against: string;
  opening: string;
};

/**
 * 量本轮开笔与近期几幕的开笔像不像。recentNarratives 按时间正序，末尾是上一幕。
 * 只比开笔，不比全篇：同一场戏本就该沿用人物与场景，复读的病灶在起笔那一下。
 */
export function detectOpeningRepeat(
  narrative: string,
  recentNarratives: string[],
  threshold = OPENING_REPEAT_THRESHOLD,
): OpeningRepeatVerdict {
  const opening = openingClause(narrative);
  let worst: OpeningRepeatVerdict = { repeated: false, ratio: 0, againstIndex: -1, against: '', opening };
  if (opening.length < 8) return worst;
  const pool = recentNarratives.slice(-3);
  for (let i = pool.length - 1; i >= 0; i -= 1) {
    const other = openingClause(pool[i]);
    if (other.length < 8) continue;
    const ratio = bigramSimilarity(opening, other);
    if (ratio > worst.ratio) {
      worst = { repeated: ratio >= threshold, ratio, againstIndex: pool.length - 1 - i, against: other, opening };
    }
  }
  return worst;
}

/** 生成侧：列出已用过的开笔，明写不得再用。 */
export function formatUsedOpenings(recentNarratives: string[]): string {
  const items = recentNarratives.slice(-3)
    .map((n) => openingClause(n))
    .filter((o) => o.length >= 8);
  if (!items.length) return '';
  return `【已用过的开笔·不得重复】\n${items.map((o) => `- ${o}……`).join('\n')}\n本幕不得复述上面任何一句的动作或物件摆位（"把某物又推近了些""重新推回原处"这类重摆动作尤其不要），换新的动作、对白或感官起笔。`;
}

/** 校验侧撞线后的重写告示。 */
export function buildRepeatAdvisory(verdict: OpeningRepeatVerdict): string {
  return `【重写告示·开笔撞了前文】\n本轮开笔「${verdict.opening}……」与前一幕的「${verdict.against}……」几乎是同一句，读者会以为剧情卡住了。\n请保留本轮要发生的事，只把起笔换掉：从下一个动作往前推进（对方已经把话说到哪、手上东西已经交到谁手里），或换人物视角、换感官切入。不要再从前一幕的场面重新摆一次。`;
}
