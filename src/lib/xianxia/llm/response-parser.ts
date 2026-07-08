// 修仙模拟器 - LLM 服务 / 解析与净化域
// 拆分自 llm.ts：JSON 解析多层兜底(parseJSON/repairJSON/extractFields) + narrative 年龄清洗 + schema 校验 + 各 sanitize* 净化器
import {
  AIEventOutput,
  ChoiceResultOutput,
  InterfereOutput,
  InputClass,
  AttributeChange,
  ItemEntry,
  ChoicePrompt,
  SpiritualRoot,
  SpiritualRootChange,
  CultivationFactor,
  PendingThread,
  CombatEnemy,
} from '../types';
import { ensureUniqueIds, filterMeaningfulStatuses } from '../engine';
import { clampTimeAdvance, sanitizeActionProjections } from '../world-time';
import { safeValidate } from '../prompt-schema';

// 从 LLM 输出中提取 JSON（兼容 ```json ``` 包装、未转义字符、尾随逗号、中文标点等常见问题）
// 多层兜底：直接解析 → repairJSON → 字段抽取 → 最小可用 fallback
export function parseJSON(content: string): any {
  let s = content.trim();
  // 移除 markdown 代码块
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }
  // 找第一个 { 到最后一个 }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }

  // 策略 1: 直接解析
  try {
    return JSON.parse(s);
  } catch {
    /* 继续尝试 */
  }

  // 策略 2: repairJSON 修复后解析
  try {
    return JSON.parse(repairJSON(s));
  } catch {
    /* 继续尝试 */
  }

  // 策略 3: 替换中文标点为 ASCII（中文引号 " " → "、中文冒号 ：→ :）
  try {
    const s2 = s
      .replace(/\u201c/g, '"')  // "
      .replace(/\u201d/g, '"')  // "
      .replace(/\u2018/g, "'")  // '
      .replace(/\u2019/g, "'")  // '
      .replace(/\uff1a/g, ':')  // ：
      .replace(/\uff0c/g, ',')  // ，
      .replace(/\uff5b/g, '{')  // ｛
      .replace(/\uff5d/g, '}')  // ｝
      .replace(/\uff3b/g, '[')  // ［
      .replace(/\uff3d/g, ']'); // ］
    return JSON.parse(repairJSON(s2));
  } catch {
    /* 继续尝试 */
  }

  // 策略 4: 字段级抽取（最后兜底，至少保证 narrative/changes 等关键字段可用）
  const fallback = extractFields(s);
  if (fallback) return fallback;

  // 策略 5: 全失败，抛出原错误让上层 fallback 处理
  throw new Error(`JSON parse failed after all strategies: ${s.slice(0, 200)}`);
}

// 字段级抽取：从残缺 JSON 中提取关键字段，保证游戏不卡死
// 适用场景：LLM 输出的 JSON 严重畸形但关键文本字段（narrative/title/memory 等）仍可识别
function extractFields(s: string): any {
  const result: any = {
    title: '岁月更迭',
    narrative: '',
    eventType: 'normal',
    changes: [],
    newStatuses: [],
    newItems: [],
    removedItemIds: [],
    newEquippedItems: [],
    equipItemIds: [],
    unequipItemIds: [],
    memory: '',
    cultivationInsight: '',
    hasChoice: false,
    choice: null,
    triggeredBreakthrough: false,
    causedDeath: false,
    causedAscension: false,
    newNpcs: [],
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [],
    failThreadIds: [],
    triggerCombat: null,
  };
  let found = false;

  // 提取字符串字段：抓取 "field": "value" 或 "field":"value" 模式
  // value 可含中文标点、引号；用非贪婪 + 终止于 ", " 或 "\n  " 或 行尾
  const strFields = ['title', 'narrative', 'memory', 'cultivationInsight', 'deathReason'];
  for (const field of strFields) {
    // 匹配 "field": "..."（value 内可能含 \" 转义）
    const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`, 's');
    const m = s.match(re);
    if (m && m[1]) {
      // 反转义
      const val = m[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      (result as any)[field] = val;
      found = true;
    }
  }

  // 提取布尔字段
  const boolFields = ['hasChoice', 'triggeredBreakthrough', 'causedDeath', 'causedAscension'];
  for (const field of boolFields) {
    const re = new RegExp(`"${field}"\\s*:\\s*(true|false)`, 'i');
    const m = s.match(re);
    if (m) {
      (result as any)[field] = m[1] === 'true';
      found = true;
    }
  }

  // 提取 eventType
  const evtMatch = s.match(/"eventType"\s*:\s*"(normal|fate_node|choice|combat|breakthrough|death|ascension)"/);
  if (evtMatch) {
    result.eventType = evtMatch[1];
    found = true;
  }

  // 若连 narrative 都没提取到，整个原文当 narrative（保证事件至少有内容）
  if (!result.narrative) {
    // 抓取第一个看起来像 narrative 的长字符串
    const narMatch = s.match(/"narrative"\s*:\s*"([\s\S]*?)(?:",\s*"|"\\n)/);
    if (narMatch && narMatch[1]) {
      result.narrative = narMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').slice(0, 500);
      found = true;
    }
  }

  if (!found) return null;
  // 若 narrative 仍为空，给个占位避免空白事件
  if (!result.narrative) {
    result.narrative = '这一年角色依旧在世间行走，日复一日，修行也好，谋生也罢，皆在道途之上。';
  }
  return result;
}

// 修复 LLM 输出 JSON 的常见问题：
// 1. 字符串值内未转义的双引号（如 narrative: "他说"你好"了"）
// 2. 字符串值内的裸换行符（JSON 标准要求 \n）
// 3. 尾随逗号
// 策略：逐字符扫描，仅在字符串外应用结构修复，字符串内转义裸引号/换行
function repairJSON(s: string): string {
  let out = '';
  let inStr = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        // 判断这是字符串结束还是裸引号：
        // 看后面（跳过空格）是否是 , } ] : —— 若是则视为字符串结束，否则视为裸引号需转义
        let j = i + 1;
        while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++;
        const nextCh = s[j];
        if (nextCh === ',' || nextCh === '}' || nextCh === ']' || nextCh === ':' || nextCh === undefined) {
          out += ch;
          inStr = false;
        } else {
          // 裸引号，转义
          out += '\\"';
        }
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') {
        inStr = true;
        out += ch;
      } else {
        out += ch;
      }
    }
  }
  // 移除尾随逗号（,} 或 ,]）
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return out;
}

// ==================== 对外接口 ====================

// 后处理：修正 narrative 中主角年龄数字（AI 偶发幻觉会把年龄写错，如3岁写成"四岁"）
// 策略：匹配紧邻主角名或句首的"数字+岁"，若数字≠正确年龄则替换为正确年龄（支持中文数字与阿拉伯数字）
const ZH_DIGIT: Record<string, number> = { 零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10 };
const ZH_AGE: Record<number, string> = { 0:'零',1:'一',2:'二',3:'三',4:'四',5:'五',6:'六',7:'七',8:'八',9:'九',10:'十' };

// 中文数字（0-99）转 number，非中文数字返回 null
function zhAgeToNum(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (!/^[\u96f6\u4e00\u4e8c\u4e24\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+$/.test(s)) return null;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (ZH_DIGIT[s[1]] ?? 0);
  if (s.endsWith('十')) return (ZH_DIGIT[s[0]] ?? 0) * 10;
  if (s.includes('十')) {
    const parts = s.split('十');
    return (ZH_DIGIT[parts[0]] ?? 0) * 10 + (ZH_DIGIT[parts[1]] ?? 0);
  }
  // 单字
  if (s.length === 1 && s in ZH_DIGIT) return ZH_DIGIT[s];
  return null;
}

// number → 中文数字（0-99），用于替换文案
function numToZhAge(n: number): string {
  if (n in ZH_AGE) return ZH_AGE[n];
  if (n < 20) return '十' + (ZH_AGE[n - 10] ?? String(n - 10));
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (ZH_AGE[tens] ?? String(tens)) + '十' + (ones ? (ZH_AGE[ones] ?? String(ones)) : '');
}

function fixNarrativeAge(narrative: string, correctAge: number, charName?: string): string {
  if (!narrative) return narrative;
  const safeCharName = String(charName || '').trim();
  let out = narrative;
  // 匹配"数字+岁+的+角色名"或"数字+岁+的+主角"等明确指代主角的模式
  // 中文数字或阿拉伯数字，0-99
  const numPat = '([0-9]+|[零一二三四五六七八九十]{1,3})';
  // 模式1："X岁的{name}" / "X岁那年{name}" / "X岁时，{name}"
  const re1 = safeCharName ? new RegExp(`${numPat}岁(?:的|那年|时[，,]?)(.{0,2}?)${escapeRegExp(safeCharName)}`, 'g') : null;
  // 模式2：句首"X岁，"或"X岁的"开头（通常指代主角）
  const re2 = new RegExp(`^${numPat}岁(?:的|，|时|那年)`, 'g');
  // 模式3："{name}...X岁" 紧邻（中间部分用非捕获组，保证数字是第一个捕获组）
  const re3 = safeCharName ? new RegExp(`${escapeRegExp(safeCharName)}(?:[\\s\\S]{0,8}?)${numPat}岁`, 'g') : null;

  const replaceNum = (m: string, g1: string, ...rest: any[]) => {
    const num = zhAgeToNum(g1);
    if (num === null || num === correctAge) return m; // 无法解析或本来就对，不动
    if (num < 0 || num > 150) return m; // 明显是别的语境（如寿元、年份）
    // 替换为正确年龄（保持原格式：若原文是阿拉伯数字就用阿拉伯，否则用中文）
    const isArabic = /[0-9]/.test(g1);
    const replacement = isArabic ? String(correctAge) : numToZhAge(correctAge);
    return m.replace(g1, replacement);
  };

  if (re1) out = out.replace(re1, replaceNum);
  out = out.replace(re2, replaceNum);
  if (re3) out = out.replace(re3, replaceNum);
  return out;
}

function reduceNarrativeAgeMentions(narrative: string, correctAge: number, charName?: string): string {
  // \u6c89\u6d78\u7248 Phase-Release: \u4fdd\u7559 AI \u5199\u7684\u5e74\u9f84\u63d0\u53ca\u4e0d\u518d\u66b4\u529b\u64e6\u9664\u3002
  // \u539f\u903b\u8f91\u4f1a\u628a "X\u5c81\u7684{\u89d2\u8272\u540d}" / "X\u5c81\u65f6\uff0c" / "X\u5c81\u7684\u4ed6/\u5979/\u5b69\u5b50" \u7b49\u6574\u4f53\u5220\u9664\u6216\u66ff\u6362\u4e3a\u89d2\u8272\u540d\uff0c\u5bfc\u81f4\uff1a
  //   - \u73a9\u5bb6\u770b\u5230\u6d41\u5f0f\u5199\u51fa\u7684\u6b63\u6587\u4e0e\u843d\u5e93\u540e\u6b63\u6587\u4e0d\u4e00\u81f4\uff08"\u683c\u5f0f\u7a81\u7136\u53d8\u4e86"\uff09
  //   - \u597d\u53e5\u5b50\u88ab\u786c\u5207
  //   - "\u521a\u6ee1X\u5c81"\u8fd9\u79cd\u81ea\u7136\u53d9\u8ff0\u88ab\u7a7a\u6807\u70b9\u53d6\u4ee3
  // \u73b0\u5728\u53ea\u4ea4\u7531 fixNarrativeAge \u4fee\u6b63\u660e\u663e\u9519\u7684\u6570\u5b57\uff1b\u6b63\u786e\u7684\u3001\u4ee5\u53ca \u00b11 \u5c81\u7684\u5408\u7406\u8868\u8ff0\u4e00\u5f8b\u4fdd\u7559\u3002
  return narrative;
}

function _reduceNarrativeAgeMentions_legacy(narrative: string, correctAge: number, charName?: string): string {
  if (!narrative) return narrative;
  const safeCharName = String(charName || '').trim();
  const ageWords = Array.from(new Set([String(correctAge), numToZhAge(correctAge)].filter(Boolean))).map(escapeRegExp).join('|');
  if (!ageWords) return narrative;
  let out = narrative;
  const sentenceBoundary = '\\u3002\\uff01\\uff1f\\uff1b\\n';
  if (safeCharName) {
    const name = escapeRegExp(safeCharName);
    out = out.replace(new RegExp(`(^|[${sentenceBoundary}])\\s*(?:${ageWords})\\u5c81(?:\\u7684)?${name}`, 'g'), `$1${safeCharName}`);
    out = out.replace(new RegExp(`(?:${ageWords})\\u5c81(?:\\u7684)?${name}`, 'g'), safeCharName);
  }
  out = out.replace(new RegExp(`(^|[${sentenceBoundary}])\\s*(?:${ageWords})\\u5c81(?:\\u65f6|\\u90a3\\u5e74|\\u7684)?[\\uff0c,\\u3001]?\\s*`, 'g'), '$1');
  out = out.replace(new RegExp(`(?:${ageWords})\\u5c81\\u7684(\\u4ed6|\\u5979|\\u5b69\\u5b50|\\u5c11\\u5e74|\\u5c11\\u5973|\\u89d2\\u8272|\\u5e7c\\u7ae5|\\u5b69\\u7ae5|\\u5a74\\u5b69|\\u5a03\\u513f)`, 'g'), '$1');
  out = out.replace(new RegExp(`(?:${ageWords})\\u5c81(?:\\u65f6|\\u90a3\\u5e74)[\\uff0c,\\u3001]?\\s*`, 'g'), '');
  return out.replace(/^[\uff0c,\u3001\s]+/, '').replace(/[\u3002\uff01\uff1f\uff1b]\s+[\u3002\uff01\uff1f\uff1b]/g, (m) => m[0]);
}

export function cleanNarrativeAge(narrative: string, correctAge: number, charName?: string): string {
  return reduceNarrativeAgeMentions(fixNarrativeAge(narrative, correctAge, charName), correctAge, charName);
}

function escapeRegExp(s: string): string {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// ==================== 输出净化与校验 ====================

/**
 * TechDoc 18.6.5：post-parse zod schema 校验
 * 失败时 console.error 但不阻断主流程（让 sanitize 函数兜底）
 * 返回原 raw（不修改结构）——sanitize 函数会兜底
 */
export function postParseSchemaCheck<T>(schema: any, raw: any, label: string): any {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  try {
    const result = safeValidate(schema, raw, label);
    if (!result.ok) {
      // 已 log；继续走 sanitize 兜底，不阻断主流程
      return raw;
    }
    return raw;
  } catch {
    return raw;
  }
}

function extractChoiceOption(o: any, i: number): { text: string; hint?: string } {
  if (typeof o === 'string') return { text: o.trim().slice(0, 80) || `选项${i + 1}` };
  if (!o || typeof o !== 'object') return { text: `选项${i + 1}` };
  // AI 可能用不同键名表达选项文字，宽容多种别名，避免退化成「选项N」
  const textKeys = ['text', 'option', 'label', 'content', 'title', 'name', 'choice', 'action', 'optionText'];
  let txt = '';
  let usedKey = '';
  for (const k of textKeys) {
    const v = o[k];
    if (v != null && String(v).trim()) { txt = String(v).trim(); usedKey = k; break; }
  }
  const hintKeys = ['hint', 'tip', 'detail', 'consequence', 'subtext', 'note'];
  let hint = '';
  for (const k of hintKeys) {
    const v = o[k];
    if (v != null && String(v).trim()) { hint = String(v).trim(); break; }
  }
  const desc = o.description ?? o.desc;
  if (!txt && desc != null && String(desc).trim()) txt = String(desc).trim();
  else if (!hint && desc != null && String(desc).trim() && usedKey !== 'description' && usedKey !== 'desc') hint = String(desc).trim();
  return { text: (txt || `选项${i + 1}`).slice(0, 80), hint: hint ? hint.slice(0, 120) : undefined };
}

export function sanitizeEventOutput(raw: any, currentAge = 0): AIEventOutput {
  const changes: AttributeChange[] = Array.isArray(raw?.changes) ? raw.changes.map((c: any) => ({
    attribute: String(c.attribute || ''),
    delta: Number(c.delta) || 0,
    reason: String(c.reason || ''),
  })).filter((c: AttributeChange) => c.attribute) : [];

  const { statuses, items } = ensureUniqueIds(
    Array.isArray(raw?.newStatuses) ? raw.newStatuses : [],
    Array.isArray(raw?.newItems) ? raw.newItems : []
  );

  const hasChoice = Boolean(raw?.hasChoice);
  const choice = hasChoice && raw?.choice ? {
    prompt: String(raw.choice.prompt || ''),
    options: Array.isArray(raw.choice.options)
      ? raw.choice.options.map((o: any, i: number) => extractChoiceOption(o, i)).filter((o: any) => o.text).slice(0, 4)
      : [],
  } : undefined;

  return {
    title: String(raw?.title || '岁月更迭').slice(0, 32),
    narrative: String(raw?.narrative || '这一年角色依旧在世间行走，日复一日，修行也好，谋生也罢，皆在道途之上。'),
    eventType: ['normal','fate_node','choice','combat','breakthrough','death','ascension'].includes(raw?.eventType) ? raw.eventType : 'normal',
    changes,
    newStatuses: filterMeaningfulStatuses(statuses as any),
    newItems: items,
    removedItemIds: Array.isArray(raw?.removedItemIds) ? raw.removedItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    newEquippedItems: sanitizeItems(raw?.newEquippedItems),
    equipItemIds: Array.isArray(raw?.equipItemIds) ? raw.equipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    unequipItemIds: Array.isArray(raw?.unequipItemIds) ? raw.unequipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    memory: String(raw?.memory || ''),
    cultivationInsight: raw?.cultivationInsight ? String(raw.cultivationInsight).slice(0, 400) : '',
    timeAdvance: clampTimeAdvance(raw?.timeAdvance, undefined),
    actionProjections: sanitizeActionProjections(raw?.actionProjections),
    hasChoice,
    choice,
    triggeredBreakthrough: Boolean(raw?.triggeredBreakthrough),
    breakthroughReason: raw?.breakthroughReason ? String(raw.breakthroughReason).slice(0, 240) : '',
    breakthroughTargetLevel: raw?.breakthroughTargetLevel ? Number(raw.breakthroughTargetLevel) : undefined,
    breakthroughTargetRealm: ['mortal','qi_refining','foundation','golden_core','nascent_soul','spirit_severing','great_vehicle','tribulation','ascension'].includes(raw?.breakthroughTargetRealm) ? raw.breakthroughTargetRealm : undefined,
    realmProfilePatch: sanitizeRealmProfilePatch(raw?.realmProfilePatch),
    extraEvents: Array.isArray(raw?.extraEvents) ? raw.extraEvents.map((e: any) => ({
      title: String(e?.title || '余波').slice(0, 32),
      narrative: String(e?.narrative || '').slice(0, 1500),
      eventType: ['normal','fate_node','choice','combat','breakthrough','death','ascension'].includes(e?.eventType) ? e.eventType : 'normal',
    })).filter((e: any) => e.narrative.trim()).slice(0, 3) : [],
    causedDeath: Boolean(raw?.causedDeath),
    deathReason: raw?.deathReason ? String(raw.deathReason) : undefined,
    causedAscension: Boolean(raw?.causedAscension),
    // ===== Task 20 新增 =====
    newNpcs: sanitizeNpcs(raw?.newNpcs, currentAge),
    newThreads: sanitizeThreads(raw?.newThreads, currentAge),
    advanceThreads: sanitizeAdvanceThreads(raw?.advanceThreads),
    completeThreadIds: Array.isArray(raw?.completeThreadIds) ? raw.completeThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    failThreadIds: Array.isArray(raw?.failThreadIds) ? raw.failThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    triggerCombat: sanitizeTriggerCombat(raw?.triggerCombat),
    spiritualRootChange: sanitizeSpiritualRootChange(raw?.spiritualRootChange),
  };
}

function sanitizeRealmProfilePatch(raw: any) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: any = {};
  if (raw.name) out.name = String(raw.name).slice(0, 16);
  if (raw.shortName) out.shortName = String(raw.shortName).slice(0, 8);
  if (raw.color) out.color = String(raw.color).slice(0, 32);
  if (Number.isFinite(Number(raw.maxLevel))) out.maxLevel = Math.max(1, Math.min(999, Math.round(Number(raw.maxLevel))));
  if (Number.isFinite(Number(raw.powerMultiplier))) out.powerMultiplier = Math.max(0.5, Math.min(9, Number(raw.powerMultiplier)));
  if (Number.isFinite(Number(raw.expMultiplier))) out.expMultiplier = Math.max(0.2, Math.min(20, Number(raw.expMultiplier)));
  if (raw.reason) out.reason = String(raw.reason).slice(0, 160);
  return Object.keys(out).length ? out : undefined;
}

// 净化物品数组（用于 newEquippedItems）
function sanitizeItems(raw: any): ItemEntry[] {
  if (!Array.isArray(raw)) return [];
  const { items } = ensureUniqueIds([], raw);
  return items;
}

// 净化修炼速度来源条目数组
function sanitizeFactors(raw: any): CultivationFactor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(f => f && f.name && typeof f.value === 'number')
    .slice(0, 12)
    .map(f => ({
      name: String(f.name).slice(0, 24),
      value: Number(f.value) || 0,
      operation: f.operation === 'add' ? 'add' : 'multiply',
      rarity: ['common','uncommon','rare','epic','legendary','mythic'].includes(f.rarity) ? f.rarity : undefined,
      note: f.note ? String(f.note).slice(0, 40) : undefined,
    }));
}

// 净化未决线索数组

function sanitizeNpcs(raw: any, currentAge: number): any[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(n => n && n.name)
    .slice(0, 8)
    .map((n, idx) => ({
      id: n.id ? String(n.id).slice(0, 80) : 'npc_' + Date.now().toString(36) + '_' + idx,
      name: String(n.name).slice(0, 40),
      description: String(n.description || n.name).slice(0, 400),
      role: n.role ? String(n.role).slice(0, 40) : undefined,
      realm: n.realm ? String(n.realm).slice(0, 40) : undefined,
      faction: n.faction ? String(n.faction).slice(0, 60) : undefined,
      attitude: ['ally','friendly','neutral','hostile','enemy','unknown'].includes(n.attitude) ? n.attitude : 'unknown',
      relationshipScore: Math.max(-100, Math.min(100, Number(n.relationshipScore) || 0)),
      firstMetAge: Math.max(0, Number(n.firstMetAge) || currentAge),
      lastSeenAge: Math.max(0, Number(n.lastSeenAge) || currentAge),
      lastKnownLocation: n.lastKnownLocation ? String(n.lastKnownLocation).slice(0, 80) : undefined,
      source: n.source ? String(n.source).slice(0, 80) : 'llm',
      memory: n.memory ? String(n.memory).slice(0, 300) : undefined,
      relatedThreadIds: Array.isArray(n.relatedThreadIds) ? n.relatedThreadIds.map((x: any) => String(x).slice(0, 80)).filter(Boolean) : undefined,
      tags: Array.isArray(n.tags) ? n.tags.map((x: any) => String(x).slice(0, 40)).filter(Boolean).slice(0, 8) : undefined,
    }));
}

function sanitizeThreads(raw: any, currentAge: number): PendingThread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(t => t && t.title && t.description && t.category)
    .slice(0, 8)
    .map(t => {
      const startAge = Number(t.startAge) || currentAge;
      const rawDeadline = Number(t.deadlineAge);
      const dueInSameYear = Boolean(t.dueInSameYear) || /\u4eca\u5e74|\u672c\u5e74|\u5f53\u5e74|\u4e0d\u4e45|\u4e09\u6708|\u6570\u6708|\u534a\u6708|\u6570\u65e5|\u51e0\u65e5|\u4e09\u65e5|\u4e24\u65e5|\u660e\u65e5|\u534a\u5e74|\u5165\u591c|\u5f53\u591c|\u591c\u91cc|\u9ec4\u660f|\u6e05\u6668|\u7fcc\u65e5|\u8f6c\u65e5|\u4e34\u8d70\u524d|\u4e34\u884c|\u4e34\u522b|\u8d70\u524d|\u79bb\u5f00\u524d/.test(`${t.title || ''}${t.description || ''}${t.followUpHint || ''}`);
      const deadlineAge = Number.isFinite(rawDeadline) ? rawDeadline : (dueInSameYear ? currentAge : currentAge + 1);
      return {
        id: String(t.id || `thread_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
        title: String(t.title).slice(0, 24),
        description: String(t.description).slice(0, 260),
        category: ['competition','enemy','quest','promise','mystery','romance','debt','inheritance','exploration'].includes(t.category) ? t.category : 'quest',
        startAge,
        deadlineAge: dueInSameYear ? Math.max(deadlineAge, currentAge) : Math.max(deadlineAge, currentAge + 1),
        status: 'pending' as const,
        progress: Math.max(0, Math.min(99, Number(t.progress) || 0)),
        reward: t.reward ? String(t.reward).slice(0, 120) : undefined,
        failureCost: t.failureCost ? String(t.failureCost).slice(0, 120) : undefined,
        dueInSameYear,
        followUpHint: t.followUpHint ? String(t.followUpHint).slice(0, 160) : undefined,
        sourceEventTitle: t.sourceEventTitle ? String(t.sourceEventTitle).slice(0, 32) : undefined,
        realmId: t.realmId ? String(t.realmId).slice(0, 64) : undefined,
      };
    });
}

// 净化推进线索数组
function sanitizeAdvanceThreads(raw: any): { id: string; progressDelta: number; note?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(a => a && a.id)
    .map(a => ({
      id: String(a.id),
      progressDelta: Math.max(-50, Math.min(80, Number(a.progressDelta) || 0)),
      note: a.note ? String(a.note).slice(0, 60) : undefined,
    }))
    .slice(0, 8);
}

// 净化战斗敌人
function sanitizeCombatEnemy(raw: any): CombatEnemy | null {
  if (!raw || !raw.name) return null;
  const hp = Math.max(1, Math.min(99999, Number(raw.hp) || 30));
  const attack = Math.max(1, Math.min(9999, Number(raw.attack) || 10));
  const defense = Math.max(0, Math.min(9999, Number(raw.defense) || 0));
  const speed = Math.max(1, Math.min(9999, Number(raw.speed) || 10));
  return {
    id: String(raw.id || `enemy_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    name: String(raw.name).slice(0, 16),
    description: String(raw.description || '').slice(0, 120),
    hp, maxHp: Math.max(hp, Number(raw.maxHp) || hp),
    attack, defense, speed,
    realm: raw.realm ? String(raw.realm).slice(0, 20) : undefined,
    drops: Array.isArray(raw.drops) ? raw.drops.slice(0, 4).map((d: any) => ({
      name: String(d?.name || '').slice(0, 16),
      chance: Math.max(0, Math.min(1, Number(d?.chance) || 0.5)),
      rarity: String(d?.rarity || 'common'),
    })) : undefined,
    lootItems: sanitizeItems(raw.lootItems).slice(0, 6),
    lootSpiritStones: Math.max(0, Math.min(999999, Math.floor(Number(raw.lootSpiritStones) || 0))),
  };
}

// 净化 triggerCombat 字段
function sanitizeTriggerCombat(raw: any): AIEventOutput['triggerCombat'] | undefined {
  if (!raw || !Array.isArray(raw.enemies) || raw.enemies.length === 0) return undefined;
  const enemies = raw.enemies.map(sanitizeCombatEnemy).filter(Boolean) as CombatEnemy[];
  if (!enemies.length) return undefined;
  return {
    enemies,
    contextTitle: String(raw.contextTitle || '战斗').slice(0, 24),
    contextNarrative: String(raw.contextNarrative || '').slice(0, 400),
    victoryDrops: sanitizeItems(raw.victoryDrops),
    defeatCost: raw.defeatCost ? String(raw.defeatCost).slice(0, 100) : undefined,
  };
}


function sanitizeChoicePrompt(raw: any): ChoicePrompt | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const prompt = String(raw.prompt || '').trim();
  const options = Array.isArray(raw.options)
    ? raw.options.map((o: any, i: number) => extractChoiceOption(o, i)).filter((o: any) => o.text).slice(0, 4)
    : [];
  if (!prompt || options.length < 2) return undefined;
  return { prompt: prompt.slice(0, 800), options };
}

function sanitizeSpiritualRootChange(raw: any): SpiritualRootChange | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const root = String(raw.spiritualRoot || '');
  if (!['mixed','common','pure','heavenly','chaos','none'].includes(root)) return undefined;
  return {
    spiritualRoot: root as SpiritualRoot,
    rootDetail: raw.rootDetail ? String(raw.rootDetail).slice(0, 48) : undefined,
    reason: raw.reason ? String(raw.reason).slice(0, 120) : '灵根生变',
  };
}

export function sanitizeChoiceOutput(raw: any): ChoiceResultOutput {
  const changes: AttributeChange[] = Array.isArray(raw?.changes) ? raw.changes.map((c: any) => ({
    attribute: String(c.attribute || ''),
    delta: Number(c.delta) || 0,
    reason: String(c.reason || ''),
  })).filter((c: AttributeChange) => c.attribute) : [];

  const { statuses, items } = ensureUniqueIds(
    Array.isArray(raw?.newStatuses) ? raw.newStatuses : [],
    Array.isArray(raw?.newItems) ? raw.newItems : []
  );

  return {
    narrative: String(raw?.narrative || '选择已定，前路已开。'),
    changes,
    newStatuses: filterMeaningfulStatuses(statuses as any),
    newItems: items,
    nextChoice: sanitizeChoicePrompt(raw?.nextChoice),
    removedItemIds: Array.isArray(raw?.removedItemIds) ? raw.removedItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    newEquippedItems: sanitizeItems(raw?.newEquippedItems),
    equipItemIds: Array.isArray(raw?.equipItemIds) ? raw.equipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    unequipItemIds: Array.isArray(raw?.unequipItemIds) ? raw.unequipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    memory: String(raw?.memory || ''),
    cultivationInsight: raw?.cultivationInsight ? String(raw.cultivationInsight).slice(0, 400) : '',
    causedDeath: Boolean(raw?.causedDeath),
    deathReason: raw?.deathReason ? String(raw.deathReason) : undefined,
    // ===== Task 20 新增（ChoiceResultOutput 类型暂未声明这些字段，使用 type assertion 注入；引擎可在后续 task 扩展类型） =====
    newNpcs: sanitizeNpcs(raw?.newNpcs, 0),
    newThreads: sanitizeThreads(raw?.newThreads, 0),
    advanceThreads: sanitizeAdvanceThreads(raw?.advanceThreads),
    completeThreadIds: Array.isArray(raw?.completeThreadIds) ? raw.completeThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    failThreadIds: Array.isArray(raw?.failThreadIds) ? raw.failThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    triggerCombat: sanitizeTriggerCombat(raw?.triggerCombat),
    spiritualRootChange: sanitizeSpiritualRootChange(raw?.spiritualRootChange),
  } as ChoiceResultOutput;
}

export function sanitizeInterfereOutput(raw: any, currentAge = 0): InterfereOutput {
  const cls: InputClass = ['action','dialogue','overreach','rule_manipulation'].includes(raw?.classification)
    ? raw.classification : 'action';
  const accepted = raw?.accepted !== false && cls !== 'overreach' && cls !== 'rule_manipulation';

  const changes: AttributeChange[] = accepted && Array.isArray(raw?.changes)
    ? raw.changes.map((c: any) => ({
        attribute: String(c.attribute || ''),
        delta: Number(c.delta) || 0,
        reason: String(c.reason || ''),
      })).filter((c: AttributeChange) => c.attribute)
    : [];

  const { statuses, items } = ensureUniqueIds(
    accepted && Array.isArray(raw?.newStatuses) ? raw.newStatuses : [],
    accepted && Array.isArray(raw?.newItems) ? raw.newItems : []
  );

  return {
    classification: cls,
    accepted,
    narrative: String(raw?.narrative || (accepted ? '天道如是。' : '世界自按其轨运行。')),
    changes,
    newStatuses: filterMeaningfulStatuses(statuses as any),
    newItems: items,
    removedItemIds: accepted && Array.isArray(raw?.removedItemIds) ? raw.removedItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    newEquippedItems: accepted ? sanitizeItems(raw?.newEquippedItems) : [],
    equipItemIds: accepted && Array.isArray(raw?.equipItemIds) ? raw.equipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    unequipItemIds: accepted && Array.isArray(raw?.unequipItemIds) ? raw.unequipItemIds.map((x: any) => String(x)).filter(Boolean) : [],
    memory: accepted ? String(raw?.memory || '') : '',
    cultivationInsight: accepted && raw?.cultivationInsight ? String(raw.cultivationInsight).slice(0, 400) : '',
    ageAdvance: accepted ? Math.max(0, Math.min(5, Number(raw?.ageAdvance) || 0)) : 0,
    // ===== Task 20 新增（accepted=false 时全为空数组/null，不可推进剧情） =====
    newNpcs: accepted ? sanitizeNpcs(raw?.newNpcs, currentAge) : [],
    newThreads: accepted ? sanitizeThreads(raw?.newThreads, currentAge) : [],
    advanceThreads: accepted ? sanitizeAdvanceThreads(raw?.advanceThreads) : [],
    completeThreadIds: accepted && Array.isArray(raw?.completeThreadIds) ? raw.completeThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    failThreadIds: accepted && Array.isArray(raw?.failThreadIds) ? raw.failThreadIds.map((x: any) => String(x)).filter(Boolean) : [],
    triggerCombat: accepted ? sanitizeTriggerCombat(raw?.triggerCombat) : undefined,
    spiritualRootChange: accepted ? sanitizeSpiritualRootChange(raw?.spiritualRootChange) : undefined,
  };
}
