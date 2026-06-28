// scripts/event-replay.ts
// 用法：
//   bun scripts/event-replay.ts <characterId> [version] [options]
//   bun scripts/event-replay.ts <characterId> --from v1 --to v2 [--diff] [--export path] [--type type]
//
// 选项：
//   --diff            与 base snapshot 对比字段差异
//   --export <path>   把结果写入 JSON 文件
//   --from <version>  replay 起始 version（含）
//   --to <version>    replay 截止 version（含）
//   --type <type>     只 replay 指定 type 的事件（如 character.realm.changed）
//
// 兼容旧用法：<characterId> <version> 不带 flag 时退化为单 version replay。
//
// 缺依赖（events/store.ts / reducer.ts 未就绪）→ 退化为 base snapshot + 友好提示。

import { db } from '../src/lib/db';
import { buildBaseSnapshot } from '../src/lib/xianxia/events/projector';
import type { CharacterEvent, CharacterStateSnapshot } from '../src/lib/xianxia/events/types';
import { reduceCharacterState } from '../src/lib/xianxia/events/reducer';
import * as fs from 'fs';

export interface ReplayOptions {
  characterId: string;
  version?: number;       // 单 version（向后兼容）
  fromVersion?: number;
  toVersion?: number;
  type?: string;
  diff?: boolean;
  exportPath?: string;
}

export interface ReplayDiff {
  [field: string]: { before: unknown; after: unknown };
}

export interface ReplayResult {
  characterId: string;
  totalEvents: number;
  replayedEvents: number;
  baseSnapshot: CharacterStateSnapshot;
  projectedState: CharacterStateSnapshot;
  diff: ReplayDiff | null;
  filter: {
    version?: number;
    fromVersion?: number;
    toVersion?: number;
    type?: string;
  };
  eventsUpToLastVersion: number; // 全事件链最后一条 version（即使 filter 后 replayedEvents=0）
}

// ---------- 内部 helpers ----------

async function loadBaseSnapshot(characterId: string): Promise<CharacterStateSnapshot | null> {
  const char = await db.character.findUnique({ where: { id: characterId } });
  if (!char) return null;
  return buildBaseSnapshot({
    characterId,
    name: char.name ?? '',
    age: char.age,
    lifespan: char.lifespan,
    realm: char.realm,
    cultivationExp: char.cultivationExp,
    hp: char.hp,
    maxHp: char.maxHp,
    spiritStones: char.spiritStones,
    alive: char.alive,
  });
}

async function loadEvents(characterId: string): Promise<CharacterEvent[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMod = require('../src/lib/xianxia/events/store');
    if (typeof storeMod.getEvents === 'function') {
      const r = await storeMod.getEvents(characterId);
      return Array.isArray(r) ? (r as CharacterEvent[]) : [];
    }
  } catch {
    // store 未就绪 → 0 事件
  }
  return [];
}

function applyReducerSafe(
  baseSnapshot: CharacterStateSnapshot,
  events: CharacterEvent[]
): { state: CharacterStateSnapshot; usedReducer: boolean } {
  try {
    return { state: reduceCharacterState(baseSnapshot, events), usedReducer: true };
  } catch (e) {
    console.warn(`(info) reducer 调用失败，回退到 base snapshot：${(e as Error).message}`);
    return { state: baseSnapshot, usedReducer: false };
  }
}

function computeDiff(
  before: CharacterStateSnapshot,
  after: CharacterStateSnapshot
): ReplayDiff {
  const diff: ReplayDiff = {};
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const a = (before as any)[key];
    const b = (after as any)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[key] = { before: a, after: b };
    }
  }
  return diff;
}

function filterEvents(
  events: CharacterEvent[],
  options: ReplayOptions
): CharacterEvent[] {
  let out = events;
  if (options.type) {
    out = out.filter((e) => e.type === options.type);
  }
  if (options.fromVersion !== undefined && options.toVersion !== undefined) {
    const from = options.fromVersion;
    const to = options.toVersion;
    out = out.filter((e) => e.aggregateVersion >= from && e.aggregateVersion <= to);
  } else if (options.fromVersion !== undefined) {
    const from = options.fromVersion;
    out = out.filter((e) => e.aggregateVersion >= from);
  } else if (options.toVersion !== undefined) {
    const to = options.toVersion;
    out = out.filter((e) => e.aggregateVersion <= to);
  } else if (options.version !== undefined) {
    const v = options.version;
    out = out.filter((e) => e.aggregateVersion <= v);
  }
  return out;
}

// ---------- 公共 API ----------

export async function replayAtVersion(
  characterId: string,
  targetVersion: number
): Promise<CharacterStateSnapshot | null> {
  const result = await replayAdvanced({
    characterId,
    version: targetVersion,
  });
  if (!result) return null;
  return result.projectedState;
}

export async function replayAdvanced(options: ReplayOptions): Promise<ReplayResult | null> {
  if (!options.characterId) throw new Error('characterId is required');

  const baseSnapshot = await loadBaseSnapshot(options.characterId);
  if (!baseSnapshot) {
    console.error(`Character ${options.characterId} not found`);
    return null;
  }

  const allEvents = await loadEvents(options.characterId);
  const filteredEvents = filterEvents(allEvents, options);

  const { state: projectedState } = applyReducerSafe(baseSnapshot, filteredEvents);

  let diff: ReplayDiff | null = null;
  if (options.diff) {
    diff = computeDiff(baseSnapshot, projectedState);
  }

  const result: ReplayResult = {
    characterId: options.characterId,
    totalEvents: allEvents.length,
    replayedEvents: filteredEvents.length,
    baseSnapshot,
    projectedState,
    diff,
    filter: {
      version: options.version,
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      type: options.type,
    },
    eventsUpToLastVersion: allEvents.length > 0
      ? allEvents[allEvents.length - 1].aggregateVersion
      : 0,
  };

  return result;
}

export function printReplayResult(result: ReplayResult): void {
  const { filter, totalEvents, replayedEvents, baseSnapshot, projectedState, diff } = result;
  const header =
    filter.fromVersion !== undefined && filter.toVersion !== undefined
      ? `Replay range [${filter.fromVersion}, ${filter.toVersion}]`
      : filter.version !== undefined
      ? `Replay @ version ${filter.version}`
      : filter.type
      ? `Replay type=${filter.type}`
      : 'Replay (no filter)';
  console.log(`=== ${header} ===`);
  console.log(`Events replayed: ${replayedEvents} / ${totalEvents}`);
  if (filter.type) console.log(`Filter type: ${filter.type}`);
  if (diff) {
    const changedFields = Object.keys(diff);
    console.log(`Diff: ${changedFields.length} field(s) changed`);
    if (changedFields.length > 0) {
      console.log(JSON.stringify(diff, null, 2));
    }
  }
  console.log(`baseSnapshot: ${JSON.stringify(baseSnapshot)}`);
  console.log(`projectedState: ${JSON.stringify(projectedState)}`);
}

export function exportReplayResult(result: ReplayResult, exportPath: string): void {
  fs.writeFileSync(exportPath, JSON.stringify(result, null, 2));
  console.log(`Exported to ${exportPath}`);
}

// ---------- CLI ----------

function parseArgs(args: string[]): ReplayOptions {
  const options: ReplayOptions = { characterId: '' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = args[i + 1];
      switch (key) {
        case 'diff':
          options.diff = true;
          break;
        case 'export':
          if (!val || val.startsWith('--')) throw new Error('--export requires a path');
          options.exportPath = val;
          i++;
          break;
        case 'from':
          if (!val) throw new Error('--from requires a version number');
          options.fromVersion = parseInt(val, 10);
          i++;
          break;
        case 'to':
          if (!val) throw new Error('--to requires a version number');
          options.toVersion = parseInt(val, 10);
          i++;
          break;
        case 'type':
          if (!val) throw new Error('--type requires a type string');
          options.type = val;
          i++;
          break;
        case 'version':
          if (!val) throw new Error('--version requires a number');
          options.version = parseInt(val, 10);
          i++;
          break;
        default:
          console.warn(`(warn) unknown flag --${key}, ignoring`);
          if (val && !val.startsWith('--')) i++; // consume value if present
      }
    } else if (!options.characterId) {
      options.characterId = arg;
    } else if (options.version === undefined) {
      const v = parseInt(arg, 10);
      if (isNaN(v)) {
        throw new Error(`Invalid version: ${arg}`);
      }
      options.version = v;
    } else {
      console.warn(`(warn) extra positional arg "${arg}" ignored`);
    }
  }
  return options;
}

function printUsage(): void {
  console.log('Usage:');
  console.log('  bun scripts/event-replay.ts <characterId> [version]');
  console.log('  bun scripts/event-replay.ts <characterId> [--from v] [--to v] [--type t] [--diff] [--export path]');
  console.log('');
  console.log('Options:');
  console.log('  --diff            compare projectedState vs baseSnapshot, show changed fields');
  console.log('  --export <path>   write full replay result to JSON file');
  console.log('  --from <version>  filter: aggregateVersion >= from');
  console.log('  --to <version>    filter: aggregateVersion <= to');
  console.log('  --type <type>     filter: only events of given type (e.g. character.realm.changed)');
  console.log('');
  console.log('Examples:');
  console.log('  bun scripts/event-replay.ts abc123 50');
  console.log('  bun scripts/event-replay.ts abc123 --from 10 --to 20 --diff');
  console.log('  bun scripts/event-replay.ts abc123 --type character.realm.changed --export /tmp/realm.json');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let options: ReplayOptions;
  try {
    options = parseArgs(args);
  } catch (e) {
    console.error(`(error) ${(e as Error).message}`);
    printUsage();
    process.exit(1);
  }

  if (!options.characterId) {
    console.error('(error) characterId is required');
    printUsage();
    process.exit(1);
  }

  const result = await replayAdvanced(options);
  if (!result) process.exit(1);

  if (options.exportPath) {
    exportReplayResult(result, options.exportPath);
  } else {
    printReplayResult(result);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}