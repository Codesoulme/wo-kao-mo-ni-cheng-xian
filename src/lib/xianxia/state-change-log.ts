import type { AttributeChange, CharacterState } from './types';
import type { ValidationTrace } from './content-registry';
import type { EffectResolveTrace } from './types';
import type { BoundaryValidationTrace } from './ai-boundary-validator';

export type StateChangeLogSeverity = 'info' | 'warning' | 'error';
export type StateChangeLogSource = 'effect' | 'registry' | 'boundary' | 'thread' | 'combat' | 'npc' | 'system';

export interface StateChangeLogEntry {
  id: string;
  age: number;
  source: StateChangeLogSource;
  severity: StateChangeLogSeverity;
  code: string;
  message: string;
  refId?: string;
  attribute?: string;
  delta?: number;
  before?: number;
  after?: number;
  meta?: Record<string, unknown>;
}

export interface BuildStateChangeLogArgs {
  before: CharacterState;
  after: CharacterState;
  appliedChanges: AttributeChange[];
  rejectedChanges: AttributeChange[];
  contentRegistryTrace: ValidationTrace[];
  effectResolveTrace: EffectResolveTrace[];
  aiBoundaryTrace: BoundaryValidationTrace[];
}

function logId(source: string, code: string, index: number, age: number): string {
  return `scl_${age}_${source}_${code}_${index}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function severityOf(value: any): StateChangeLogSeverity {
  if (value === 'error') return 'error';
  if (value === 'warning') return 'warning';
  return 'info';
}

function push(
  out: StateChangeLogEntry[],
  age: number,
  source: StateChangeLogSource,
  severity: StateChangeLogSeverity,
  code: string,
  message: string,
  extra: Partial<StateChangeLogEntry> = {},
): void {
  out.push({ id: logId(source, code, out.length, age), age, source, severity, code, message, ...extra });
}

function summarizeThreadDiff(before: CharacterState, after: CharacterState, out: StateChangeLogEntry[]): void {
  const age = after.age;
  const beforeMap = new Map((before.pendingThreads || []).map(t => [t.id, t]));
  for (const thread of after.pendingThreads || []) {
    const prev = beforeMap.get(thread.id);
    if (!prev) {
      push(out, age, 'thread', 'info', 'thread_created', `Thread created: ${thread.title}`, { refId: thread.id, meta: { status: thread.status, progress: thread.progress } });
      continue;
    }
    if (prev.status !== thread.status) {
      push(out, age, 'thread', thread.status === 'failed' ? 'warning' : 'info', `thread_${thread.status}`, `Thread status changed: ${thread.title} (${prev.status} -> ${thread.status})`, { refId: thread.id });
    }
    if ((prev.progress || 0) !== (thread.progress || 0)) {
      push(out, age, 'thread', 'info', 'thread_progress', `Thread progress changed: ${thread.title} (${prev.progress || 0}% -> ${thread.progress || 0}%)`, { refId: thread.id, before: prev.progress || 0, after: thread.progress || 0 });
    }
  }
}

function summarizeStructuralDiff(before: CharacterState, after: CharacterState, out: StateChangeLogEntry[]): void {
  const age = after.age;
  const beforeNpcCount = before.npcs?.length || 0;
  const afterNpcCount = after.npcs?.length || 0;
  if (afterNpcCount > beforeNpcCount) {
    push(out, age, 'npc', 'info', 'npc_registered', `NPC registry gained ${afterNpcCount - beforeNpcCount} record(s).`, { before: beforeNpcCount, after: afterNpcCount });
  }
  if (!before.combatSession && after.combatSession) {
    push(out, age, 'combat', 'info', 'combat_started', `Combat started: ${after.combatSession.contextTitle}`, { refId: after.combatSession.id });
  }
  if (before.combatSession && !after.combatSession) {
    push(out, age, 'combat', before.combatSession.status === 'defeat' ? 'warning' : 'info', 'combat_ended', `Combat ended: ${before.combatSession.contextTitle || before.combatSession.status}`, { refId: before.combatSession.id, meta: { result: before.combatSession.status } });
  }
}

export function buildStateChangeLog(args: BuildStateChangeLogArgs): StateChangeLogEntry[] {
  const { before, after } = args;
  const age = after.age;
  const out: StateChangeLogEntry[] = [];

  for (const change of args.appliedChanges || []) {
    push(out, age, 'effect', 'info', 'attribute_applied', `Applied ${change.attribute} ${change.delta >= 0 ? '+' : ''}${change.delta}: ${change.reason || 'no reason'}`, {
      attribute: change.attribute,
      delta: change.delta,
    });
  }

  for (const change of args.rejectedChanges || []) {
    push(out, age, 'effect', 'warning', 'attribute_rejected', `Rejected ${change.attribute} ${change.delta >= 0 ? '+' : ''}${change.delta}: ${change.reason || 'no reason'}`, {
      attribute: change.attribute,
      delta: change.delta,
    });
  }

  for (const trace of args.effectResolveTrace || []) {
    if (trace.severity === 'info') continue;
    push(out, age, 'effect', severityOf(trace.severity), trace.code, trace.message, {
      attribute: trace.attribute,
      delta: trace.delta,
      before: trace.before,
      after: trace.after,
    });
  }

  for (const trace of args.contentRegistryTrace || []) {
    if ((trace as any).severity === 'info') continue;
    push(out, age, 'registry', severityOf((trace as any).severity), (trace as any).code || 'registry_trace', (trace as any).message || 'Content registry trace', {
      refId: (trace as any).id || (trace as any).refId,
      meta: { kind: (trace as any).kind, field: (trace as any).field },
    });
  }

  for (const trace of args.aiBoundaryTrace || []) {
    push(out, age, 'boundary', severityOf(trace.severity), trace.code, trace.message, {
      refId: trace.refId,
      meta: { field: trace.field },
    });
  }

  summarizeThreadDiff(before, after, out);
  summarizeStructuralDiff(before, after, out);

  return out.slice(-120);
}


export interface StateChangeAuditEffect {
  kind: '__audit_state_change_log';
  hidden: true;
  version: 1;
  entries: StateChangeLogEntry[];
}

export function buildStateChangeAuditEffect(entries: StateChangeLogEntry[] | undefined): StateChangeAuditEffect | null {
  const safeEntries = (entries || []).slice(-120);
  if (!safeEntries.length) return null;
  return {
    kind: '__audit_state_change_log',
    hidden: true,
    version: 1,
    entries: safeEntries,
  };
}

export function appendStateChangeAuditEffect<T>(effects: T[], entries: StateChangeLogEntry[] | undefined): Array<T | StateChangeAuditEffect> {
  const audit = buildStateChangeAuditEffect(entries);
  return audit ? [...effects, audit] : effects;
}
