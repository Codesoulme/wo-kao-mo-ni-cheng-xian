// TechDoc 18.6.1: RAG 世界观事实检索 PoC
// 简化实现: 关键词 + 倒排索引, 替代真实向量 embedding
// 未来可替换为 OpenAI / 本地 sentence-transformers / pgvector

import type { WorldFact } from '../types';

/**
 * 简化版 tokenize: 中文按字 + 英文按词, 全部小写。
 * 比纯 split(/\s+/) 强一点, 能命中 CJK 关键词。
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  const out: string[] = [];
  // 拆 CJK 单字 + ASCII 单词
  const re = /([一-鿿])|([a-z0-9]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lowered)) !== null) {
    const tok = m[1] || m[2];
    if (tok) out.push(tok);
  }
  return out;
}

/**
 * 倒排索引结构: keyword -> Set<factId>
 * 模块级单例, buildInvertedIndex 会替换内容。
 */
let invertedIndex: Map<string, Set<string>> = new Map();
let factLookup: Map<string, WorldFact> = new Map();

/** 清空索引(测试用) */
export function resetRetrieverIndex(): void {
  invertedIndex = new Map();
  factLookup = new Map();
}

/** 把 WorldFact[] 灌入倒排索引 */
export function buildInvertedIndex(facts: WorldFact[]): void {
  invertedIndex = new Map();
  factLookup = new Map();
  for (const f of facts) {
    factLookup.set(f.id, f);
    const keywords = tokenize(`${f.title} ${f.summary} ${(f.tags || []).join(' ')} ${f.kind}`);
    for (const kw of keywords) {
      if (kw.length < 1) continue;
      let bucket = invertedIndex.get(kw);
      if (!bucket) {
        bucket = new Set();
        invertedIndex.set(kw, bucket);
      }
      bucket.add(f.id);
    }
  }
}

/** 索引条目数(测试可断言) */
export function indexSize(): number {
  return invertedIndex.size;
}

/** 索引中的事实数 */
export function indexedFactCount(): number {
  return factLookup.size;
}

/** 取某 id 的 fact(检索后查全字段用) */
export function getFactById(id: string): WorldFact | undefined {
  return factLookup.get(id);
}

/**
 * 检索结果: facts + 各 fact 的命中分数 + query 元信息
 */
export interface RetrievalResult {
  facts: WorldFact[];
  query: string;
  relevanceScores: Map<string, number>;
  queryKeywords: string[];
}

/**
 * 关键词检索: 累加命中 token 数作为相关度分数, 取 topK
 */
export function retrieveFacts(query: string, topK = 5): RetrievalResult {
  const queryKeywords = tokenize(query);
  const factScores = new Map<string, number>();
  if (queryKeywords.length === 0) {
    return { facts: [], query, relevanceScores: factScores, queryKeywords };
  }
  for (const kw of queryKeywords) {
    const bucket = invertedIndex.get(kw);
    if (!bucket) continue;
    for (const id of bucket) {
      factScores.set(id, (factScores.get(id) || 0) + 1);
    }
  }
  const sortedIds = [...factScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id);
  const facts: WorldFact[] = [];
  for (const id of sortedIds) {
    const f = factLookup.get(id);
    if (f) facts.push(f);
  }
  return { facts, query, relevanceScores: factScores, queryKeywords };
}

// ============================================================
// EmbeddingRetriever 接口 (为未来真向量检索预留)
// ============================================================

/**
 * 真实向量检索应有的接口。
 * 当前 keywordRetriever 假装实现, 仅 PoC 验证接口形态。
 */
export interface EmbeddingRetriever {
  embed(text: string): Promise<number[]>;
  search(queryEmbedding: number[], topK: number): Promise<WorldFact[]>;
}

const PROBE_DIM = 64;

/**
 * PoC 版 retriever: 把分词哈希到一个固定维度的稀疏向量,
 * search() 内部仍走关键词路径(返回真实的命中结果)。
 * 真实实现会改成 cosine / dot-product 排序。
 */
export const keywordRetriever: EmbeddingRetriever = {
  async embed(text: string): Promise<number[]> {
    const tokens = tokenize(text);
    const vec = new Array<number>(PROBE_DIM).fill(0);
    for (const t of tokens) {
      let h = 0;
      for (let i = 0; i < t.length; i++) {
        h = ((h << 5) - h + t.charCodeAt(i)) | 0;
      }
      vec[Math.abs(h) % PROBE_DIM] += 1;
    }
    return vec;
  },
  async search(_queryEmbedding: number[], topK: number): Promise<WorldFact[]> {
    // PoC: 不真用 embedding, 由调用方另传 query 走 retrieveFacts
    // 这里保留接口, 真实实现替换此处
    return [];
  },
};

/**
 * 便捷方法: 接收 query 字符串, 用关键词检索并返回 facts
 * (未来替换成 embed + cosine)
 */
export async function retrieveFactsViaEmbedding(
  query: string,
  topK = 5
): Promise<WorldFact[]> {
  const _vec = await keywordRetriever.embed(query);
  // PoC: 走关键词路径, ignore _vec
  return retrieveFacts(query, topK).facts;
}