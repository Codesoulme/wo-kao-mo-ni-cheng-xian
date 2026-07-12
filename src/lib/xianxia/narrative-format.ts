/**
 * 沉浸版·叙事显示格式化
 *
 * 分段本身完全交给 AI prompt——前端不再"按句号强行切段"（历史上那个兜底会在
 * 流式写完切静态时把段落重排一次，视觉上就是"写完还跳一下"）。
 *
 * 2026-07-12 用户反馈补充：
 *  - AI 偶发会在逗号/顿号后打 `\n\n`，把一句话拦腰断成两段——这个必须收；
 *  - `white-space: pre-line` 下 AI 打的 `\n\n` 会渲染出一整行空白，段间显得空旷——
 *    把连续换行折成单换行，段间就是紧邻一行，不留空白行。
 *
 * 因此这里只做两件事：
 *  1. trim ASCII 两端空白（JS `\s` 会吃 U+3000 全角空格，必须自定义字符集）；
 *  2. 收紧 AI 换行：逗号/顿号后的换行合并回同一段；`\n{2,}` → `\n`。
 *
 * 不切段、不加缩进——这些交给 AI prompt 与 CSS。
 */

// 只匹配 ASCII 空白：普通空格、制表、换行、回车、垂直/换页、BOM——不含 U+3000
const ASCII_WS_TRIM_RE = /^[ \t\r\n\v\f﻿]+|[ \t\r\n\v\f﻿]+$/g;

// 逗号/顿号（含中英文）后紧跟换行：AI 把一句话拦腰断段，吃掉这个换行
const COMMA_LINEBREAK_RE = /([，、,])[ \t]*\n+[ \t　]*/g;

// 连续换行折成单换行：段间只留一行分隔，不留空白行
const MULTI_LINEBREAK_RE = /\n{2,}/g;

export function formatNarrativeForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(ASCII_WS_TRIM_RE, '')
    .replace(COMMA_LINEBREAK_RE, '$1')
    .replace(MULTI_LINEBREAK_RE, '\n');
}
