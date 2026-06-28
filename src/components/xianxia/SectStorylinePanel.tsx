'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  buildQuestEntriesFromThreads,
  evaluateSectPhase,
  summarizeSectTrajectoryForPrompt,
  type QuestEntry,
} from '@/lib/xianxia/engine';

type SectHistoryEntry = {
  age: number;
  event: string;
  phase?: string;
  promotion?: string;
  narrative?: string;
};
import { ChevronDown, ChevronUp, Mountain, Scroll, Shield, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectStorylinePanelProps {
  className?: string;
  character?: any;
  defaultCollapsed?: boolean;
  trajectory?: any;
}

const PROMOTION_PATH = ['外门弟子', '内门弟子', '真传弟子', '长老', '宗主'] as const;

const CATEGORY_LABEL: Record<string, string> = {
  competition: '比试',
  enemy: '宿敌',
  quest: '宗务',
  promise: '旧约',
  mystery: '悬疑',
  romance: '姻缘',
  debt: '因果',
  inheritance: '传承',
  exploration: '探幽',
};

const PHASE_LABEL: Record<string, string> = {
  founding: '草创',
  prosperous: '鼎盛',
  stable: '稳态',
  declining: '式微',
  crisis: '危局',
  scattered: '流散',
  remnant: '余脉',
};
const PHASE_TONE: Record<string, string> = {
  founding: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  prosperous: 'bg-amber-50 text-amber-900 border-amber-300',
  stable: 'bg-stone-50 text-stone-800 border-stone-200',
  declining: 'bg-orange-50 text-orange-900 border-orange-300',
  crisis: 'bg-rose-50 text-rose-900 border-rose-300',
  scattered: 'bg-violet-50 text-violet-900 border-violet-300',
  remnant: 'bg-sky-50 text-sky-900 border-sky-300',
};

function inferRank(character: any): string {
  const realm = String(character?.realm || character?.cultivation || '');
  const age = Number(character?.age || 0);
  const power = Number(character?.cultivationPower || character?.combatProjection?.totalPower || 0);

  if (realm.includes('渡劫') || realm.includes('大乘')) return '长老';
  if (realm.includes('化神') || realm.includes('元婴')) return '真传弟子';
  if (realm.includes('结丹') || realm.includes('金丹')) return '内门弟子';
  if (realm.includes('筑基')) return '内门弟子';
  if (realm.includes('炼气')) {
    if (age >= 25 && power > 30) return '内门弟子';
    return '外门弟子';
  }
  if (age === 0) return '尚在襁褓';
  return '外门弟子';
}

function selectShortTermQuests(character: any, maxCount = 5): QuestEntry[] {
  if (!character || typeof character !== 'object') return [];
  const threads = Array.isArray(character.pendingThreads) ? character.pendingThreads : [];
  const entries = Array.isArray(character.questEntries) && character.questEntries.length > 0
    ? character.questEntries
    : buildQuestEntriesFromThreads(threads, Number(character.age || 0));
  return entries
    .filter((e) => e && (e.stage === 'open' || e.stage === 'urgent'))
    .sort((a, b) => {
      const da = typeof a.dueAge === 'number' ? a.dueAge : Number.MAX_SAFE_INTEGER;
      const db = typeof b.dueAge === 'number' ? b.dueAge : Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, maxCount);
}

function selectRecentSectEvents(character: any, maxCount = 3): { id: string; label: string; age?: number; tone: string }[] {
  const out: { id: string; label: string; age?: number; tone: string }[] = [];
  if (!character || typeof character !== 'object') return out;

  const history: SectHistoryEntry[] = Array.isArray(character.sectHistory) ? character.sectHistory : [];
  for (const h of history.slice(-3)) {
    if (!h || typeof h !== 'object') continue;
    const reasonLabel: Record<string, string> = {
      joined: '入宗门',
      left: '别宗门',
      banished: '被逐出宗门',
      ascended: '举宗飞升',
      retired: '退隐宗门',
      martyred: '殉宗',
    };
    out.push({
      id: `hist-${h.sectId || '?'}-${h.joinedAge || 0}`,
      label: `${reasonLabel[h.reason] || h.reason}：${h.sectName || h.sectId || '宗门'}`,
      age: typeof h.joinedAge === 'number' ? h.joinedAge : undefined,
      tone: h.reason === 'martyred' || h.reason === 'banished' ? 'danger' : h.reason === 'ascended' ? 'good' : 'neutral',
    });
  }

  const trajHistory = Array.isArray(character?.trajectory?.history) ? character.trajectory.history : [];
  for (const e of trajHistory.slice(-3)) {
    if (!e || typeof e !== 'object') continue;
    out.push({
      id: `evt-${e.id || Math.random().toString(36).slice(2, 8)}`,
      label: e.description || e.kind || '宗门异动',
      age: typeof e.age === 'number' ? e.age : undefined,
      tone: typeof e.severity === 'number' && e.severity >= 0.6 ? 'danger' : e.severity >= 0.3 ? 'neutral' : 'good',
    });
  }

  const recent = Array.isArray(character.recentEvents) ? character.recentEvents : [];
  const faction = String(character.faction || character.sect || '');
  for (const r of recent.slice(-10)) {
    if (!r || typeof r !== 'object') continue;
    const txt = String(r.title || r.narrative || '');
    if (faction && (txt.includes(faction) || txt.includes('宗门') || txt.includes('山门') || (Array.isArray(r.tags) && r.tags.includes('sect')))) {
      out.push({
        id: `rec-${r.age || 0}-${r.title || ''}`,
        label: r.title || r.narrative || '宗门记闻',
        age: typeof r.age === 'number' ? r.age : undefined,
        tone: r.eventType === 'sect_event' || r.eventType === 'crisis' ? 'danger' : 'neutral',
      });
    }
  }

  const seen = new Set<string>();
  const deduped: { id: string; label: string; age?: number; tone: string }[] = [];
  const sorted = [...out].sort((a, b) => (b.age || 0) - (a.age || 0));
  for (const e of sorted) {
    const k = `${e.label}|${e.age}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(e);
    if (deduped.length >= maxCount) break;
  }
  return deduped;
}

function promotionIndex(currentRank: string): number {
  const idx = PROMOTION_PATH.findIndex((r) => r === currentRank);
  if (idx >= 0) return idx;
  if (currentRank === '长老') return 3;
  if (currentRank === '宗主') return 4;
  return 0;
}

export function SectStorylinePanel({
  className,
  character: externalCharacter,
  defaultCollapsed = true,
  trajectory,
}: SectStorylinePanelProps) {
  const { character: storeCharacter } = useGameStore();
  const character = externalCharacter || storeCharacter;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const sectName = useMemo(() => {
    if (!character) return '';
    return String(character.faction || character.sect || '').trim();
  }, [character?.faction, character?.sect]);

  const currentRank = useMemo(() => {
    if (!character) return '外门弟子';
    const explicit = String(character.sectRank || character.position || '').trim();
    if (explicit) return explicit;
    return inferRank(character);
  }, [character?.sectRank, character?.position, character?.realm, character?.age]);

  const phase = useMemo(() => {
    if (!character) return { phase: 'stable' as const, reason: '宗门轨迹尚未显化，暂以稳态相待' };
    if (trajectory && typeof trajectory === 'object') {
      const res = evaluateSectPhase(trajectory, Number(character.age || 0));
      return res;
    }
    return {
      phase: (character.sectPhase || 'stable') as any,
      reason: character.sectPhaseReason || '循宗门旧例，暂以稳态相待',
    };
  }, [trajectory, character?.age, character?.sectPhase, character?.sectPhaseReason]);

  const quests = useMemo(() => selectShortTermQuests(character, 5), [
    character?.pendingThreads,
    character?.questEntries,
    character?.age,
  ]);

  const recentEvents = useMemo(() => selectRecentSectEvents(character, 3), [
    character?.sectHistory,
    character?.trajectory,
    character?.recentEvents,
    character?.faction,
  ]);

  const trajectorySummary = useMemo(() => {
    if (!trajectory || typeof trajectory !== 'object') return '';
    try {
      return summarizeSectTrajectoryForPrompt(trajectory, 240);
    } catch {
      return '';
    }
  }, [trajectory]);

  if (!sectName) {
    return null;
  }

  const rankIdx = promotionIndex(currentRank);
  const totalRanks = PROMOTION_PATH.length;

  return (
    <Card
      data-testid="sect-storyline-panel"
      className={cn(
        'bg-gradient-to-br from-amber-50/80 to-stone-50/70 border-amber-300/60',
        className,
      )}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold font-serif-cn flex items-center gap-1.5 text-amber-900">
            <Mountain className="h-4 w-4 text-amber-700" />
            <span>宗门长策 · {sectName}</span>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-serif-cn',
                PHASE_TONE[phase.phase] || PHASE_TONE.stable,
              )}
              data-testid="sect-storyline-phase"
            >
              {PHASE_LABEL[phase.phase] || phase.phase}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setCollapsed((c) => !c)}
              data-testid="sect-storyline-toggle"
            >
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {!collapsed && phase.reason && (
          <div className="text-[10px] text-stone-600 italic font-serif-cn mt-1 leading-relaxed">
            {phase.reason}
          </div>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-1 pb-3 px-3 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-serif-cn" data-testid="sect-storyline-rank">
            <Shield className="h-3.5 w-3.5 text-amber-700" />
            <span className="text-stone-700">现居：</span>
            <span className="font-bold text-amber-900">{currentRank}</span>
            {character?.master && (
              <span className="text-stone-500 ml-2">
                · 师承：{character.master}
              </span>
            )}
          </div>

          <div data-testid="sect-storyline-promotion">
            <div className="text-[10px] text-stone-600 font-serif-cn mb-1.5">升迁路径</div>
            <div className="flex items-center flex-wrap gap-1">
              {PROMOTION_PATH.map((r, i) => {
                const reached = i <= rankIdx;
                const isCurrent = i === rankIdx;
                return (
                  <div key={r} className="flex items-center gap-1">
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border font-serif-cn',
                        isCurrent
                          ? 'bg-amber-200 text-amber-900 border-amber-500 font-bold ring-1 ring-amber-500'
                          : reached
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-stone-50 text-stone-500 border-stone-200',
                      )}
                      data-testid={isCurrent ? 'sect-storyline-rank-current' : undefined}
                    >
                      {reached && <Star className="inline h-2.5 w-2.5 mr-0.5" />}
                      {r}
                    </span>
                    {i < totalRanks - 1 && (
                      <span className="text-stone-400 text-[10px]">→</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div data-testid="sect-storyline-quests">
            <div className="flex items-center gap-1.5 text-[10px] text-stone-600 font-serif-cn mb-1.5">
              <Scroll className="h-3.5 w-3.5" />
              <span>近期宗务（{quests.length}）</span>
            </div>
            {quests.length === 0 ? (
              <div
                className="text-[10px] text-stone-500 italic font-serif-cn px-2 py-1.5 bg-stone-50/60 rounded border border-stone-200"
                data-testid="sect-storyline-quests-empty"
              >
                暂无未了宗务 · 宗门暂无派下的当务。
              </div>
            ) : (
              <div className="space-y-1.5">
                {quests.map((q) => {
                  const pct = Math.max(0, Math.min(100, Number(q.progress || 0)));
                  const dueLabel = typeof q.dueAge === 'number'
                    ? `截止 ${q.dueAge} 岁`
                    : '不限期限';
                  const cat = CATEGORY_LABEL[q.kind as string] || q.kind || '宗务';
                  return (
                    <div
                      key={q.id}
                      className="rounded-md border border-amber-200/70 bg-white/70 px-2 py-1.5"
                      data-testid={`sect-storyline-quest-${q.id}`}
                    >
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-[11px] font-bold text-amber-900 font-serif-cn leading-tight">
                          {q.title}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] px-1 py-0.5 rounded shrink-0 font-serif-cn',
                            q.stage === 'urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800',
                          )}
                        >
                          {cat}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[9px] text-stone-600 font-mono shrink-0">{pct}%</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-stone-600 font-serif-cn">
                        <span>{dueLabel}</span>
                        {q.rewardHint && (
                          <span className="text-emerald-700 truncate" title={q.rewardHint}>
                            赏：{q.rewardHint}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div data-testid="sect-storyline-events">
            <div className="text-[10px] text-stone-600 font-serif-cn mb-1">近期宗门事件</div>
            {recentEvents.length === 0 ? (
              <div className="text-[10px] text-stone-500 italic font-serif-cn">山门安静，未闻异动。</div>
            ) : (
              <ul className="space-y-1 text-[10px] font-serif-cn">
                {recentEvents.map((e) => (
                  <li
                    key={e.id}
                    className={cn(
                      'flex items-center gap-1.5 px-1.5 py-1 rounded border',
                      e.tone === 'danger'
                        ? 'bg-rose-50 text-rose-900 border-rose-200'
                        : e.tone === 'good'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-stone-50 text-stone-800 border-stone-200',
                    )}
                  >
                    <span className="font-mono text-[9px] text-stone-500 shrink-0">
                      {typeof e.age === 'number' ? `${e.age}岁` : '昔年'}
                    </span>
                    <span className="leading-relaxed">{e.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {trajectorySummary && (
            <details className="text-[10px] text-stone-500 font-serif-cn">
              <summary className="cursor-pointer hover:text-stone-700">轨迹摘要（供调试用）</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[9px] leading-relaxed bg-stone-50 p-1.5 rounded border border-stone-200">
                {trajectorySummary}
              </pre>
            </details>
          )}
        </CardContent>
      )}
    </Card>
  );
}
