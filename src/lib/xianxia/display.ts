export const ATTRIBUTE_LABEL: Record<string, string> = {
  age: '年龄',
  lifespan: '寿元',
  cultivationExp: '修为',
  expToBreak: '破境进度',
  hp: '气血',
  maxHp: '气血上限',
  mp: '灵力',
  maxMp: '灵力上限',
  attack: '\u7834\u52bf',
  defense: '\u62a4\u6301',
  speed: '\u673a\u53d8',
  luck: '气运',
  comprehension: '悟性',
  spiritStones: '灵石',
  reputation: '声望',
  heartDemon: '心魔',
  elementMetal: '金灵根',
  elementWood: '木灵根',
  elementWater: '水灵根',
  elementFire: '火灵根',
  elementEarth: '土灵根',
  storageCapacity: '储物容量',

  // 非角色数值属性，但可能出现在物品/事件效果里
  inventory: '物品',
  equipped: '装备',
  talisman_attack: '攻符威能',
  talisman_defense: '本回合减伤',
  talisman_heal: '气血回复',
  talisman_escape: '遁行符力',
  talisman_stun: '镇压符力',
  formationType: '阵盘类型',
};

export const HIDDEN_EFFECT_ATTRIBUTES = new Set([
  'formationType',
]);

export function attributeLabel(attr?: string): string {
  if (!attr) return '变化';
  return ATTRIBUTE_LABEL[attr] || '变化';
}

export function isInternalLikeAttr(attr?: string): boolean {
  if (!attr) return false;
  return /[A-Z_]/.test(attr) || attr.includes('_') || attr.includes('.') || attr.includes(':');
}

export function isVisibleNumericEventEffect(eff: any): boolean {
  if (!eff) return false;
  if (eff.kind) return Boolean(String(eff.name || '').trim());
  const attr = String(eff.attribute || '');
  if (!attr || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return false;
  const delta = Number(eff.delta || 0);
  if (delta === 0) return false;
  // 背包数量是内部计数，不用 +1/-1 打断沉浸；保留 reason，如"得 回春符""售 木剑"
  if (attr === 'inventory' && !String(eff.reason || '').trim()) return false;
  return true;
}

// ─── 文案过滤层：移除玩家可见叙事中的机制词 ────────────────────────────────────
// 策略：单次扫描文本，每段匹配到则替换/删除，跳过已处理区域，避免重复替换
// 何时调用：所有 API 返回 narrative/title 前

const MECHANISM_PATTERNS: Array<[RegExp, string | ((m: string) => string)]> = [
  // 内部字段名（全大写驼峰/蛇底，替换为玩家能理解的词）
  [/\bcultivationExp\b/gi, '修为'],
  [/\bheartDemon\b/gi, '心魔'],
  [/\bspiritStones?\b/gi, '灵石'],
  [/\bpendingThreads?\b/gi, '因缘线索'],
  [/\bquestEntries?\b/gi, '任务'],
  [/\bhp\b/gi, '气血'],
  [/\bmaxHp\b/gi, '气血上限'],
  [/\bmp\b/gi, '灵力'],
  [/\bmaxMp\b/gi, '灵力上限'],
  [/\battack\b/gi, '攻'],
  [/\bdefense\b/gi, '守'],
  [/\bspeed\b/gi, '敏'],
  [/\breputation\b/gi, '声望'],
  [/\blifespan\b/gi, '寿元'],
  // 数值变化词（AI叙事中最常见的泄露形式）
  [/[+\-×*]?\d{1,8}(?:点|层|颗|枚)/g, ''],
  [/(\+|\-|±)\d{1,8}(?!\w)/g, ''],
  [/[+\-]?\d{1,8}(?:%|％)/g, ''],
  // progress 裸值
  [/\bprogress\s*\d+/gi, ''],
  // 内部/调试元词
  [/\b(?:debug|log|error|test|cache|config|api|route)\b/gi, ''],
  [/\b(?:P0|P1|P2|P3|IDEMPOTENT|preload|pre_load|stateHash)\b/g, ''],
  // 括号内的数值摘要
  [/[（\(【\[][+\-]?\d+[】\)\]\)】]/g, ''],
];

export function sanitizeNarrativeText(text: string, currentAge?: number): string {
  if (!text || typeof text !== 'string') return text ?? '';
  let result = '';
  let lastIndex = 0;

  // 全局查找所有匹配片段并去重（处理重叠/嵌套匹配）
  type Segment = { start: number; end: number; replacement: string };
  const segments: Segment[] = [];

  for (const [pattern, replacement] of MECHANISM_PATTERNS) {
    pattern.lastIndex = 0; // reset per pattern
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const rep = typeof replacement === 'function' ? replacement(match[0]) : replacement;
      // 保留最长 replacement（去重）
      const existing = segments.findIndex(s => s.start === start && s.end === end);
      if (existing === -1 || rep.length > segments[existing].replacement.length) {
        if (existing !== -1) segments.splice(existing, 1);
        segments.push({ start, end, replacement: rep });
      }
      // 防止死循环：单字符匹配无进展时跳到下一位置
      if (end === start) pattern.lastIndex = start + 1;
    }
  }

  // 无匹配直接返回原文本
  if (!segments.length) return text;

  // 按位置顺序合并重叠片段
  segments.sort((a, b) => a.start - b.start || b.replacement.length - a.replacement.length);
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      // 重叠：保留较长 replacement 的那个
      if (seg.replacement.length > last.replacement.length) {
        merged[merged.length - 1] = seg;
      }
    } else {
      merged.push(seg);
    }
  }

  // 重建文本
  let pos = 0;
  for (const seg of merged) {
    result += text.slice(pos, seg.start);
    result += seg.replacement;
    pos = seg.end;
  }
  result += text.slice(pos);

  // 清理多余空格
  result = result.replace(/ {2,}/g, ' ').trim();
  result = result.replace(/[，,。\.、;：:]{2,}/g, '，').trim();

  // 校准叙事里的"X岁"与当前年龄一致
  // 例：玩家5岁，AI 写了"六岁生辰"或"七岁时他上山"——前者是"生辰"= N+1（合理），后者是事实错位（必须改）
  if (typeof currentAge === 'number' && Number.isFinite(currentAge) && currentAge >= 0) {
    // 收集"X岁"所有出现位置，对每处检查"前/后语境"决定是否替换
    const ageRe = /(\d+)\s*岁(?![\d])/g;
    const targets: { start: number; end: number; num: number; before: string; after: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = ageRe.exec(result)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const num = parseInt(m[1], 10);
      const before = result.slice(Math.max(0, start - 8), start);
      const after = result.slice(end, Math.min(result.length, end + 8));
      targets.push({ start, end, num, before, after });
    }
    // 倒序替换，避免位移
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t.num === currentAge) continue;
      // 白名单：后跟"生辰/生日/周岁/满"，表示"将/已到达 N 岁"
      if (/(生辰|生日|周岁|满)[\u00b7\.\s\u3000]?$/.test(t.after)) continue;
      // 白名单：年长者称呼，如"百岁老翁" "千岁老祖"等不影响主角
      // 替换成 currentAge
      result = result.slice(0, t.start) + `${currentAge}岁` + result.slice(t.end);
    }
  }
  return result;
}

export function sanitizeEventDraft<T extends { title?: string; narrative?: string }>(draft: T, currentAge?: number): T {
  return {
    ...draft,
    title: draft.title ? sanitizeNarrativeText(draft.title, currentAge) : draft.title,
    narrative: draft.narrative ? sanitizeNarrativeText(draft.narrative, currentAge) : draft.narrative,
  };
}

export function formatEventEffectLabel(eff: any): string {
  if (!eff) return '';
  if (eff.kind) {
    const label = String(eff.label || '获得');
    const name = String(eff.name || '').trim();
    if (!name) return label;
    if (label === '获得状态' || label === '收服灵宠') return `${label}：${name}`;
    return `${label}${name}`;
  }
  const attr = String(eff.attribute || '');
  const reason = String(eff.reason || '').trim();
  const delta = Number(eff.delta || 0);

  if (attr === 'inventory') {
    return reason || (delta > 0 ? '获得物品' : '失去物品');
  }
  if (attr === 'equipped') {
    return reason || (delta > 0 ? '装备入手' : '装备失去');
  }

  const label = attributeLabel(attr);
  const amount = `${delta > 0 ? '+' : ''}${delta}`;
  return `${label}${amount}`;
}

export function eventEffectTone(eff: { attribute?: string; delta?: number; kind?: string; tone?: 'positive' | 'negative' | 'neutral' }): 'positive' | 'negative' | 'neutral' {
  if (eff.tone) return eff.tone;
  const delta = Number(eff.delta || 0);
  if (delta === 0) return 'neutral';
  if ((eff.attribute || '') === 'heartDemon') return delta > 0 ? 'negative' : 'positive';
  return delta > 0 ? 'positive' : 'negative';
}

export function formatItemEffectLabel(eff: any): string {
  const attr = String(eff?.target_attribute || eff?.attribute || '');
  if (!attr || HIDDEN_EFFECT_ATTRIBUTES.has(attr)) return '';
  const zh = attributeLabel(attr);
  const op = eff?.operation || 'add';
  const value = eff?.value ?? eff?.delta ?? '';
  if (op === 'add') return `${zh}${Number(value) > 0 ? '+' : ''}${value}`;
  if (op === 'multiply') return `${zh}×${value}`;
  if (op === 'override') return `${zh}改为${value}`;
  if (op === 'cap') return `${zh}上限${value}`;
  if (op === 'floor') return `${zh}下限${value}`;
  return `${zh}${value !== '' ? String(value) : ''}`;
}
