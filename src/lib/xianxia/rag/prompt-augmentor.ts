// TechDoc 18.6.1: prompt 注入 RAG 检索结果, 给 LLM 提供世界观上下文
// 注意: 标注"仅供上下文参考", 避免 LLM 直接复述事实(可能与玩家情境不符)

import { retrieveFacts } from './retriever';
import type { WorldFact } from '../types';

/**
 * 把检索到的 WorldFact 列表格式化为可读块
 */
export function formatFactsForPrompt(facts: WorldFact[]): string {
  if (facts.length === 0) return '(无相关世界观事实)';
  return facts
    .map((f, i) => {
      const tags = ((f.tags as string[] | undefined) || []).length ? ` [tags: ${(f.tags as string[]).join(',')}]` : '';
      return `${i + 1}. [${f.kind}] ${f.title} — ${f.summary} (置信度 ${f.confidence.toFixed(2)}, 来源 ${f.source}${tags})`;
    })
    .join('\n');
}

/**
 * 把检索结果注入到 prompt 末尾。
 * 若 query 没有命中任何事实, 返回原 prompt 不变。
 *
 * @param prompt  原 prompt (LLM 模板)
 * @param query   检索关键词 (一般是玩家当前行动 / 选项摘要)
 * @param topK    取 top 几条 (默认 3)
 */
export function augmentPromptWithFacts(
  prompt: string,
  query: string,
  topK = 3
): string {
  if (!query || !query.trim()) return prompt;
  const result = retrieveFacts(query, topK);
  if (result.facts.length === 0) return prompt;

  const factBlock = formatFactsForPrompt(result.facts);
  return `${prompt}

## 世界观事实检索（仅供上下文参考，不要直接复述）
${factBlock}
`;
}

/**
 * 干跑版: 给上层一个"如果注入会得到什么"的预览, 不修改 prompt。
 * 测试 / 调试用。
 */
export function previewAugmentedFacts(query: string, topK = 3): {
  query: string;
  keywords: string[];
  hits: Array<{ fact: WorldFact; score: number }>;
} {
  const r = retrieveFacts(query, topK);
  return {
    query,
    keywords: r.queryKeywords,
    hits: r.facts.map((f) => ({ fact: f, score: r.relevanceScores.get(f.id) || 0 })),
  };
}