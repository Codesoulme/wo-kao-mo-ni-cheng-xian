'use client';

import { useMemo } from 'react';

/**
 * 异象词徽章：从最近若干条 narrative 扫描命中关键词，
 * 命中即出轻量 chip。空态返回 null。
 *
 * 只读 props.narratives，不动 store；接受数组即用。
 */

interface XianxiaRibbonProps {
  narratives: string[];
}

const RIBBON_KEYWORDS: { word: string; icon: string }[] = [
  { word: '玉佩', icon: '⚡' },
  { word: '灵光', icon: '✦' },
  { word: '紫气', icon: '☁' },
  { word: '入梦', icon: '☾' },
  { word: '雷云', icon: '⚡' },
  { word: '龙凤', icon: '✺' },
  { word: '灵鹤', icon: '✦' },
  { word: '神光', icon: '✧' },
  { word: '魂光', icon: '✦' },
  { word: '金虹', icon: '☀' },
  { word: '阴阳', icon: '☯' },
  { word: '红鸾', icon: '✿' },
  { word: '青鸾', icon: '❀' },
  { word: '天机', icon: '☄' },
];

export function XianxiaRibbon({ narratives }: XianxiaRibbonProps) {
  const hits = useMemo(() => {
    const seen = new Set<string>();
    const text = (Array.isArray(narratives) ? narratives : []).filter(Boolean).join('\n');
    if (!text) return [] as { word: string; icon: string }[];
    const result: { word: string; icon: string }[] = [];
    for (const kw of RIBBON_KEYWORDS) {
      if (text.includes(kw.word) && !seen.has(kw.word)) {
        seen.add(kw.word);
        result.push(kw);
      }
    }
    return result;
  }, [narratives]);

  if (hits.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap px-3 py-1.5 mb-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5"
      data-section="xianxia-ribbon"
      data-testid="xianxia-ribbon"
    >
      <span className="text-[9px] text-amber-700/80 font-serif-cn shrink-0">天象</span>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {hits.map((h) => (
          <span
            key={h.word}
            className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 font-serif-cn"
            title={`近事提及「${h.word}」`}
          >
            <span aria-hidden>{h.icon}</span>
            <span>{h.word}</span>
          </span>
        ))}
      </div>
    </div>
  );
}