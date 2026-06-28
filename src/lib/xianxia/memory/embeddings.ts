// TechDoc 18.6.6: 因果图 / 记忆的向量索引
// PoC：关键词 + Jaccard 相似度占位
// 未来：接 OpenAI embeddings / 本地 sentence-transformers / pgvector

/**
 * Jaccard 相似度：以分词集合的交并比衡量。
 * 适合 PoC 阶段做"关键词命中"近似。
 */
export function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const x of setA) if (setB.has(x)) intersect++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersect / union;
}

/**
 * 在候选集合里按相似度取 topK。
 * candidates: { id, text }
 */
export function searchBySimilarity(
  query: string,
  candidates: Array<{ id: string; text: string }>,
  topK = 5
): Array<{ id: string; score: number }> {
  return candidates
    .map((c) => ({ id: c.id, score: jaccardSimilarity(query, c.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * 简化版 embedding 占位：把字符串切成 token 数组。
 * 未来用真实模型替换。
 */
export function embed(text: string): number[] {
  // 用字符级 one-hot 风格的伪向量（PoC 永远不参与真实计算）
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const vec = new Array<number>(32).fill(0);
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) & 0xffff;
    vec[h % 32] += 1;
  }
  return vec;
}

/**
 * 余弦相似度（占位，与 embed 配套）
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}
