/**
 * 修真沉浸·叙事显示格式化（前端安全网）
 *
 * AI prompt 已经要求：用 \n\n 分段、每段以「\u3000\u3000」首行缩进。
 * 但 SSE 流式 + 部分模型偶发会让 AI 输出单段平铺，玩家看到的是一段没断行的长文。
 * 这里做一个只读不改意的兜底：识别 AI 是否合规，不合规就按句号/问号/感叹号分组重排。
 *
 * 规则：
 * - 已有 ≥ 2 处 \n\n 或已有 ≥ 2 处「\u3000\u3000」开头：信任 AI 输出，原样返回。
 * - 其它情况：把句子按句末标点「。，！？；）」切分，按 2-3 句一段重排。
 *   段首加「\u3000\u3000」，段间用「\n\n」分隔。
 * - 极短文本（≤ 60 字）保留为单段，不强行切分。
 *
 * 这只是"显示层"的兜底，不修改 store 里的原始 narrative。
 */

const PARAGRAPH_TARGET_MIN = 50; // 单段目标下限（字）

export function formatNarrativeForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 已是合规多段：信任原样
  const paraBreaks = (trimmed.match(/\n\s*\n/g) || []).length;
  const indentCount = (trimmed.match(/^[\u3000\s]+/gm) || []).filter(s => s.includes('\u3000')).length;
  if (paraBreaks >= 2 || indentCount >= 2) return trimmed;

  // 极短：保留单段 + 加首行缩进
  if (trimmed.length <= PARAGRAPH_TARGET_MIN) {
    return '\u3000\u3000' + trimmed;
  }

  // 按句末标点切分（保留标点）
  const parts: string[] = [];
  let buf = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    buf += ch;
    if ('。，！？；.!?;'.includes(ch)) {
      parts.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  if (parts.length <= 1) return '\u3000\u3000' + trimmed;

  // 按目标字数 60-120 分组（修真沉浸段目标 ~ 2-3 句）
  const groups: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (!cur) {
      cur = p;
    } else if (cur.length < PARAGRAPH_TARGET_MIN) {
      // 上一段还没凑到 60 字，继续加
      cur = cur + p;
    } else {
      // 上一段已够长，开始新段
      groups.push(cur);
      cur = p;
    }
  }
  if (cur) groups.push(cur);

  // 合并过短的尾部段到上一段（修真沉浸尾段不应只 1 句）
  if (groups.length >= 2 && groups[groups.length - 1].length < PARAGRAPH_TARGET_MIN) {
    const tail = groups.pop()!;
    groups[groups.length - 1] = groups[groups.length - 1] + tail;
  }

  return groups.map(g => '\u3000\u3000' + g).join('\n\n');
}
