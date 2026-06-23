// 风格锚定：让 AI 续写时维持同一笔触，让 fallback 离线生成时模仿 AI 韵律
// 设计：每次 AI 输出成功后，提取风格指标 + 一段代表性样本；存 Character.styleAnchorsJson
// 用法：buildAdvancePrompt 顶部拼装最近 3 条；fallback 生成时取最近 1 条作韵律参考

import type { Character } from '@prisma/client';

export type StyleAnchor = {
  age: number;                              // 当时年龄
  tone: 'tender' | 'tense' | 'mellow' | 'somber' | 'epic';
  avgSentenceLen: number;                   // 平均句长（字）
  punctuation: { comma: number; period: number; dash: number; quote: number };
  openingPattern: string;                   // "在XXX，..." / "那年..." / "暮春..."
  sampleSnippet: string;                    // 60-100 字最具代表性片段
  capturedAt: string;                       // ISO 时间
};

const MAX_ANCHORS = 3;

function splitSentences(text: string): string[] {
  // 中文标点切句
  return text
    .replace(/([。！？!?])/g, '$1\u0001')
    .split('\u0001')
    .map(s => s.trim())
    .filter(Boolean);
}

function classifyTone(text: string): StyleAnchor['tone'] {
  // 简易情绪分类
  const warm = /(?:笑|暖|温|轻|软|甜|乐|喜|抱|亲|家|娘|爷|爸|妈|吃|睡|玩|瞧|看|摸)/g;
  const tense = /(?:剑|杀|血|战|斗|破|裂|急|危|逼|攻|逃|冲|断|惊|恨|怒|烈)/g;
  const mellow = /(?:过|旧|往|昔|曾|回|思|念|远|漫|长|慢|轻声道|微)/g;
  const somber = /(?:死|亡|丧|哭|泪|悲|孤|冷|寂|空|失|殁|葬|墓)/g;
  const epic = /(?:天|地|神|仙|道|法|气|灵|境|劫|渡|破境|天劫|飞升|大道)/g;
  const score = { warm: 0, tense: 0, mellow: 0, somber: 0, epic: 0 };
  for (const m of text.matchAll(warm)) score.warm++;
  for (const m of text.matchAll(tense)) score.tense++;
  for (const m of text.matchAll(mellow)) score.mellow++;
  for (const m of text.matchAll(somber)) score.somber++;
  for (const m of text.matchAll(epic)) score.epic++;
  // 取最高分
  const top = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] === 0) return 'mellow';
  // 映射到合法枚举：warm->tender
  const toneMap: Record<string, StyleAnchor['tone']> = {
    warm: 'tender',
    tense: 'tense',
    mellow: 'mellow',
    somber: 'somber',
    epic: 'epic',
  };
  return toneMap[top[0]] || 'mellow';
}

function detectOpeningPattern(text: string): string {
  const first = text.slice(0, 40);
  // "在XX..." / "那年..." / "暮春..." / "X岁..." / "一X后..."
  if (/^在[\u4e00-\u9fa5]/.test(first)) return first.slice(0, 18);
  if (/^[那这]年/.test(first)) return first.slice(0, 18);
  if (/^[孟仲暮春夏秋冬]/.test(first)) return first.slice(0, 18);
  if (/^\d+岁/.test(first)) return first.slice(0, 18);
  if (/^[一二三四五六七八九十]+日后?[，。]/.test(first)) return first.slice(0, 18);
  if (/^[\u4e00-\u9fa5]{2,4}后[，。]/.test(first)) return first.slice(0, 18);
  return first.slice(0, 18);
}

function countPunctuation(text: string) {
  return {
    comma: (text.match(/[，,]/g) || []).length,
    period: (text.match(/[。.]/g) || []).length,
    dash: (text.match(/[——]/g) || []).length,
    quote: (text.match(/[""''「」『』"]/g) || []).length,
  };
}

function pickRepresentativeSnippet(text: string): string {
  // 优先取"动作密集"段（动词多）；找不到就取中间 80 字
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text.slice(0, 80);
  // 找含 3 个以上动词的句
  const verbRe = /(?:了|着|去|来|上|下|进|出|回|走|跑|看|听|说|笑|哭|抱|拿|放|摸|打|踢|推|拉|摘|采|背|挑)/g;
  let best = sentences[Math.floor(sentences.length / 2)];
  let bestScore = (best.match(verbRe) || []).length;
  for (const s of sentences) {
    const score = (s.match(verbRe) || []).length;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (best.length > 100) best = best.slice(0, 100);
  return best;
}

/**
 * 从一段 narrative 提取风格锚定
 */
export function extractStyleAnchor(age: number, narrative: string): StyleAnchor {
  const sentences = splitSentences(narrative);
  const avgSentenceLen = sentences.length
    ? Math.round(sentences.reduce((a, s) => a + s.length, 0) / sentences.length)
    : 0;
  return {
    age,
    tone: classifyTone(narrative),
    avgSentenceLen,
    punctuation: countPunctuation(narrative),
    openingPattern: detectOpeningPattern(narrative),
    sampleSnippet: pickRepresentativeSnippet(narrative),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * 把新 anchor 合并到 character.styleAnchorsJson；保留最近 MAX_ANCHORS 条（LRU）
 */
export function mergeStyleAnchor(character: Character, anchor: StyleAnchor): string {
  let arr: StyleAnchor[] = [];
  try { arr = JSON.parse(character.styleAnchorsJson || '[]'); } catch {}
  arr.push(anchor);
  // 保留最新 MAX_ANCHORS 条
  if (arr.length > MAX_ANCHORS) arr = arr.slice(arr.length - MAX_ANCHORS);
  return JSON.stringify(arr);
}

/**
 * 从 character 取最近一条 anchor（fallback 用）
 */
export function getLatestStyleAnchor(character: Character): StyleAnchor | null {
  try {
    const arr: StyleAnchor[] = JSON.parse(character.styleAnchorsJson || '[]');
    return arr.length ? arr[arr.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * 把 anchor 数组拼成给 AI 看的"风格锚定"提示
 */
export function formatStyleAnchorsForPrompt(anchors: StyleAnchor[]): string {
  if (!anchors.length) return '';
  const lines: string[] = [];
  lines.push('【风格锚定 - 必须保持与此一致】');
  lines.push('（这是你之前自己生成的笔触样本，续写时必须维持相同语感、句长、对话密度、修辞习惯）');
  for (const a of anchors) {
    lines.push(`- ${a.age}岁 · ${a.tone} · 平均句长${a.avgSentenceLen}字 · 标点密度：逗号${a.punctuation.comma}/句号${a.punctuation.period}/引号${a.punctuation.quote}/破折号${a.punctuation.dash}`);
    lines.push(`  开头习惯：「${a.openingPattern}」`);
    lines.push(`  代表片段：「${a.sampleSnippet}」`);
  }
  return lines.join('\n');
}
