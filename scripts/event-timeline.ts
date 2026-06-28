// @ts-nocheck - script tool, no strict types needed

// scripts/event-timeline.ts
// 增强版：完整事件流查看工具
// 用法：
//   bun scripts/event-timeline.ts <characterId>
//   bun scripts/event-timeline.ts <characterId> --type character.realm.changed
//   bun scripts/event-timeline.ts <characterId> --since 1700000000000 --until 1800000000000
//   bun scripts/event-timeline.ts <characterId> --format json
//   bun scripts/event-timeline.ts <characterId> --format md --export /tmp/out.md
//   bun scripts/event-timeline.ts <characterId> --aggregate
//
// 支持：
//   1. 按 type 过滤（--type）
//   2. 时间范围过滤（--since / --until，毫秒时间戳或 ISO 字符串）
//   3. 导出 JSON / Markdown（--format json|md + 可选 --export <path>）
//   4. 聚合统计：每个 type 的事件计数（--aggregate 或 json/md 自动带）
//   5. 因果链高亮：如果 event 有 previousEventId，显示"← previous: vN"连接箭头

import { writeFileSync } from 'fs';
import type { CharacterEvent, EventType } from '../src/lib/xianxia/events/types';

export interface TimelineOptions {
  characterId: string;
  type?: EventType | string;
  since?: number;
  until?: number;
  format?: 'text' | 'json' | 'md';
  exportPath?: string;
  aggregate?: boolean;
}

interface TimelineResult {
  events: CharacterEvent[];
  aggregate: Record<string, number>;
  totalAfterFilter: number;
}

// parseTimestamp：接受毫秒数字或可被 Date 解析的字符串（ISO 等）。
// 失败返回 null。
function parseTimestamp(input: string): number | null {
  if (/^\d+$/.test(input)) return Number(input);
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : null;
}

// parseArgs：从 process.argv slice 提取已知 flag。
// 返回 { positional, options }。
function parseArgs(args: string[]): { positional: string[]; options: Record<string, string> } {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = 'true';
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, options };
}

function buildAggregate(events: CharacterEvent[]): Record<string, number> {
  const agg: Record<string, number> = {};
  for (const e of events) {
    agg[e.type] = (agg[e.type] || 0) + 1;
  }
  return agg;
}

function renderText(events: CharacterEvent[], options: TimelineOptions, aggregate: Record<string, number>): string {
  const lines: string[] = [];
  lines.push(`=== Event Timeline (${events.length} events) ===`);
  lines.push(`character: ${options.characterId}`);
  if (options.type) lines.push(`filter:   type=${options.type}`);
  if (options.since !== undefined) lines.push(`filter:   since=${new Date(options.since).toISOString()}`);
  if (options.until !== undefined) lines.push(`filter:   until=${new Date(options.until).toISOString()}`);
  lines.push('');

  if (options.aggregate) {
    lines.push('## Aggregate (sorted by count desc)');
    const entries = Object.entries(aggregate).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of entries) {
      lines.push(`  ${type.padEnd(48, ' ')} ${String(count).padStart(4, ' ')}`);
    }
    lines.push('');
  }

  for (const e of events) {
    const ts = new Date(e.timestamp).toISOString();
    const age = e.createdAtAge !== null && e.createdAtAge !== undefined ? `age=${e.createdAtAge}` : '';
    const verStr = String(e.aggregateVersion).padStart(3, ' ');
    lines.push(`[v${verStr}] ${ts} ${age} ${e.type}`);
    if (e.source === 'ai-output' && e.aiPromptHash) {
      lines.push(`       AI prompt hash: ${e.aiPromptHash}`);
    }
    if (e.data && typeof e.data === 'object') {
      lines.push(`       ${JSON.stringify(e.data)}`);
    }
    if (e.previousEventId) {
      // 因果链高亮：在 text 视图下显示上一条 aggregateVersion
      const prev = events.find((x) => x.id === e.previousEventId);
      const prevVer = prev ? `v${prev.aggregateVersion}` : '?';
      lines.push(`       ← previous: ${prevVer} (id=${e.previousEventId})`);
    }
  }
  return lines.join('\n');
}

function renderMarkdown(events: CharacterEvent[], options: TimelineOptions, aggregate: Record<string, number>): string {
  const lines: string[] = [];
  lines.push(`# Event Timeline: ${options.characterId}`);
  lines.push('');
  lines.push(`- Total events (after filter): **${events.length}**`);
  if (options.type) lines.push(`- Filter: type=\`${options.type}\``);
  if (options.since !== undefined) lines.push(`- Filter: since=\`${new Date(options.since).toISOString()}\``);
  if (options.until !== undefined) lines.push(`- Filter: until=\`${new Date(options.until).toISOString()}\``);
  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  lines.push('| Type | Count |');
  lines.push('|------|-------|');
  const entries = Object.entries(aggregate).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of entries) {
    lines.push(`| \`${type}\` | ${count} |`);
  }
  lines.push('');
  lines.push('## Events');
  lines.push('');
  for (const e of events) {
    const ts = new Date(e.timestamp).toISOString();
    const age = e.createdAtAge !== null && e.createdAtAge !== undefined ? ` (age=${e.createdAtAge})` : '';
    lines.push(`### [v${e.aggregateVersion}] ${ts}${age} ${e.type}`);
    lines.push('');
    lines.push(`- id: \`${e.id}\``);
    lines.push(`- source: \`${e.source}\``);
    lines.push(`- triggerActor: \`${e.triggerActor}\``);
    if (e.aiPromptHash) lines.push(`- aiPromptHash: \`${e.aiPromptHash}\``);
    if (e.data && typeof e.data === 'object') {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(e.data, null, 2));
      lines.push('```');
    }
    if (e.previousEventId) {
      const prev = events.find((x) => x.id === e.previousEventId);
      const prevVer = prev ? `v${prev.aggregateVersion}` : '?';
      lines.push('');
      lines.push(`← **previous**: ${prevVer} (id=\`${e.previousEventId}\`)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderJson(events: CharacterEvent[], aggregate: Record<string, number>, totalAfterFilter: number): string {
  return JSON.stringify({ totalAfterFilter, aggregate, events }, null, 2);
}

async function loadEvents(characterId: string): Promise<CharacterEvent[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMod = require('../src/lib/xianxia/events/store');
    if (typeof storeMod.getEvents === 'function') {
      const r = await storeMod.getEvents(characterId);
      return Array.isArray(r) ? (r as CharacterEvent[]) : [];
    }
    console.warn('(info) store.getEvents 未导出');
    return [];
  } catch (e) {
    console.error(`events/store 模块未就绪：${(e as Error).message}`);
    return null;
  }
}

// showTimeline：保留 X2 原版签名——无选项时输出与之前一致。
// 用于向后兼容（smoke 与其他脚本 import 仍可用）。
export async function showTimeline(characterId: string): Promise<CharacterEvent[] | null> {
  return showTimelineAdvanced({ characterId });
}

// showTimelineAdvanced：增强版，支持过滤/导出/聚合/因果链。
export async function showTimelineAdvanced(options: TimelineOptions): Promise<TimelineResult | null> {
  const all = await loadEvents(options.characterId);
  if (all === null) return null;

  let events = all;
  if (options.type !== undefined) {
    events = events.filter((e) => e.type === options.type);
  }
  if (options.since !== undefined) {
    events = events.filter((e) => e.timestamp >= options.since!);
  }
  if (options.until !== undefined) {
    events = events.filter((e) => e.timestamp <= options.until!);
  }

  const aggregate = buildAggregate(events);
  const format = options.format ?? 'text';

  let out: string;
  if (format === 'json') {
    out = renderJson(events, aggregate, events.length);
  } else if (format === 'md') {
    out = renderMarkdown(events, options, aggregate);
  } else {
    out = renderText(events, options, aggregate);
  }

  if (options.exportPath) {
    writeFileSync(options.exportPath, out);
    console.error(`(exported ${events.length} events → ${options.exportPath})`);
  } else {
    console.log(out);
  }

  return { events, aggregate, totalAfterFilter: events.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: bun scripts/event-timeline.ts <characterId> [--type <t>] [--since <ts>] [--until <ts>] [--format text|json|md] [--export <path>] [--aggregate]');
    process.exit(1);
  }
  const { positional, options: flags } = parseArgs(args);
  const characterId = positional[0];
  const opts: TimelineOptions = { characterId };

  if (flags.type) opts.type = flags.type as EventType;
  if (flags.since) {
    const t = parseTimestamp(flags.since);
    if (t === null) {
      console.error(`(error) invalid --since timestamp: ${flags.since}`);
      process.exit(2);
    }
    opts.since = t;
  }
  if (flags.until) {
    const t = parseTimestamp(flags.until);
    if (t === null) {
      console.error(`(error) invalid --until timestamp: ${flags.until}`);
      process.exit(2);
    }
    opts.until = t;
  }
  if (flags.format === 'json' || flags.format === 'md' || flags.format === 'text') {
    opts.format = flags.format;
  } else if (flags.format) {
    console.error(`(error) invalid --format: ${flags.format} (expected text|json|md)`);
    process.exit(2);
  }
  if (flags.export) opts.exportPath = flags.export;
  if (flags.aggregate === 'true' || flags.aggregate === undefined && false) {
    // 仅当 --aggregate 显式出现时启用
    opts.aggregate = true;
  }
  // 重新判断：args 中是否有 --aggregate flag
  if (args.includes('--aggregate')) opts.aggregate = true;

  showTimelineAdvanced(opts)
    .then((res) => {
      if (!res) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { parseArgs, parseTimestamp, buildAggregate };
