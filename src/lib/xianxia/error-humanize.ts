/**
 * error-humanize —— 将技术性错误消息转为世界化文案的过滤层
 *
 * 玩家可见 UI 里不应出现 "SSE / HTTP / Failed / undefined / EAI_ / prisma"
 * 之类的内部词。此文件提供 `humanizeError` 与 `humanizeAutoSaveError`,
 * 对错误 message 做黑名单检测,命中即替换为道门世界化短语。
 */

// 一批世界化候选短语,按错误分类挑选,避免每次同一句
const HUMANIZED_LINES = {
  // 天机/推演类:advance / SSE / 流式响应类
  reasoning: [
    '天机线断,推演未竟,稍待再试',
    '灵桥未通,道机暂歇',
    '天机紊乱,一时难以窥探',
    '推演之流忽断,须重续机缘',
  ],
  // 网络/接口/超时类
  network: [
    '符箓封存不畅,待片刻再试',
    '灵讯迷雾未散,音书难达',
    '灵桥雾遮,尚需片刻通达',
    '此路灵息未至,稍候再来',
  ],
  // 数据/结构/schema 类
  data: [
    '此段道纹残缺,难以解读',
    '天机残页,字迹模糊难辨',
    '所载符文不整,须重新推演',
  ],
  // 配额/上限类
  quota: [
    '灵力耗竭,须待新时',
    '天机额度已尽,静候恢复',
    '本日推演之力已用罄',
  ],
  // 存档/落笔类
  save: [
    '封存不畅,道章未能落笔',
    '此段记忆未能收入玉简',
    '玉简回响未至,存境暂闭',
  ],
  // 通用兜底
  generic: [
    '此番机缘未通,请稍后再试',
    '道途一时受阻,再寻机会',
    '灵机未至,少顷再议',
  ],
} as const;

type Category = keyof typeof HUMANIZED_LINES;

// 黑名单关键词:命中任一即视为技术性 message
const TECHNICAL_TOKENS = [
  'sse', 'http', 'fetch', 'failed', 'undefined', 'null', 'nan',
  'json', 'schema', 'prompt', 'token', 'ai 接口',
  'eai_', 'econn', 'abort', 'timeout', 'timed out',
  'prisma', 'indexeddb', 'quota_exceeded', 'write_failed',
  'response', 'body', 'stream', 'chunk', 'parse',
  'network', 'socket', 'refused', 'reset',
  'unexpected', 'invalid', 'error:', 'exception',
  'stacktrace', 'trace', '500', '502', '503', '504',
  'no response', 'not found', 'bad gateway',
];

function containsTechnical(msg: string): boolean {
  const lower = msg.toLowerCase();
  return TECHNICAL_TOKENS.some((t) => lower.includes(t));
}

function hasAscii(msg: string): boolean {
  // 只要包含较多 ASCII 字母,就当作可能技术性
  const ascii = msg.match(/[a-zA-Z]/g);
  return !!ascii && ascii.length >= 3;
}

function categorize(msg: string): Category {
  const lower = msg.toLowerCase();
  if (lower.includes('quota') || lower.includes('额度') || lower.includes('灵力耗竭')) return 'quota';
  if (lower.includes('save') || lower.includes('存档') || lower.includes('write_failed') || lower.includes('落笔')) return 'save';
  if (lower.includes('sse') || lower.includes('stream') || lower.includes('推演') || lower.includes('advance')) return 'reasoning';
  if (lower.includes('http') || lower.includes('fetch') || lower.includes('network') || lower.includes('econn') || lower.includes('eai_') || lower.includes('timeout') || lower.includes('abort')) return 'network';
  if (lower.includes('schema') || lower.includes('json') || lower.includes('parse') || lower.includes('invalid')) return 'data';
  return 'generic';
}

function pick(category: Category, seed: number): string {
  const arr = HUMANIZED_LINES[category];
  const idx = Math.abs(seed) % arr.length;
  return arr[idx];
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * 将任意 error 转为一条玩家可见的世界化文案
 * 若已是纯中文且不含技术词,原样返回
 */
export function humanizeError(err: unknown): string {
  let raw: string;
  if (err instanceof Error) {
    raw = err.message ?? '';
  } else if (typeof err === 'string') {
    raw = err;
  } else if (err == null) {
    raw = '';
  } else {
    try {
      raw = String(err);
    } catch {
      raw = '';
    }
  }

  const trimmed = raw.trim();
  if (!trimmed) return pick('generic', 0);

  // 已经是世界化短语(纯中文、无 ASCII 字母、且无技术黑名单),原样返回
  if (!hasAscii(trimmed) && !containsTechnical(trimmed)) {
    return trimmed;
  }

  // 命中技术黑名单或含较多英文,替换
  const cat = categorize(trimmed);
  return pick(cat, hashSeed(trimmed));
}

/**
 * 将自动存档失败结构转为一句世界化提示
 */
export function humanizeAutoSaveError(autoSaveError: {
  age?: number;
  reason?: string;
  error?: string;
}): string {
  const age = autoSaveError?.age;
  const reasonRaw = (autoSaveError?.reason ?? '').toLowerCase();
  const errRaw = (autoSaveError?.error ?? '').toLowerCase();

  // 映射 reason / error 到世界化短语
  let phrase = '此段记忆未能落笔';
  if (reasonRaw.includes('quota') || errRaw.includes('quota') || errRaw.includes('quota_exceeded')) {
    phrase = '存境已满,难以再纳新章';
  } else if (reasonRaw.includes('write_failed') || errRaw.includes('write_failed') || errRaw.includes('write')) {
    phrase = '封存不畅,道章未能落玉简';
  } else if (reasonRaw.includes('breakthrough') || reasonRaw.includes('突破')) {
    phrase = '突破之际,玉简回响未至';
  } else if (reasonRaw.includes('death') || reasonRaw.includes('陨落')) {
    phrase = '陨落之瞬,道章未及落笔';
  } else if (reasonRaw.includes('age') || reasonRaw.includes('推进')) {
    phrase = '岁月推移间,道章一时未能封存';
  }

  const agePart = typeof age === 'number' ? `年岁 ${age} 之际,` : '';
  return `${agePart}${phrase}`;
}
