﻿'use client';

/**
 * Phase-M #3: 继承池选择面板
 *
 * 触发条件：当前角色已陨落（character.alive === false 或 character.dead === true）
 * 且 store.inheritanceCandidates 非空时显示。
 *
 * 设计要点：
 *  - 候选者卡片化展示（视觉对比：灵根/血脉/因果/适配度差异）
 *  - 玩家点击"承此衣钵"后调用 store.claimInheritanceCandidate(candidateId)
 *    → engine.selectNextProtagonist 选出最终继承人 → 替换 character（age 重置、
 *    alive=true、causeOfDeath 清空、heritageVault 落地） → 关闭面板 → 由后续剧情承接
 *  - 文案全部使用世界内表达，不出现 "AI/引擎/缓存/失效/节点" 等机制词
 *  - 池子为空时显示空态（不强行渲染空卡）
 */

import { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { selectNextProtagonist } from '@/lib/xianxia/engine';
import { Sparkles, Users, Crown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateDisplay {
  id: string;
  name: string;
  age: number;
  realm: string;
  spiritualRoot: string;
  bloodline: string;
  karmaTags: string[];
  traitNarrative: string;
  /** 来自 engine.selectNextProtagonist 的本地复算：适配分（0-1） */
  eligibility: number;
  /** 评价短语：适配/上佳/中平/微薄 */
  evaluationLabel: string;
  /** 评价色调 */
  tone: 'good' | 'neutral' | 'mystery';
}

const KIND_LABEL: Record<string, string> = {
  technique: '功法',
  artifact: '法宝',
  bond: '灵宠羁绊',
  bloodline: '血脉',
  token: '信物',
  sect: '道场',
  'master-disciple': '师徒',
  'tribal-clan': '部族',
  'sect-lineage': '宗脉',
  'blood-oath': '血誓',
  'destiny-thread': '因缘',
};

function rootLabel(root: string): string {
  if (!root) return '凡根';
  if (/tianling|天灵|纯阳|纯阴|先天|primordial/i.test(root)) return '天灵根';
  if (/dual|双灵|single/i.test(root)) return '双/单灵根';
  if (/triple|三灵/i.test(root)) return '三灵根';
  if (/mixed|wu|杂灵/i.test(root)) return '杂灵根';
  return root;
}

function rootToneClass(root: string): string {
  if (/tianling|天灵|纯阳|纯阴|先天|primordial/i.test(root)) {
    return 'border-amber-300 bg-amber-50 text-amber-900';
  }
  if (/dual|双灵|single/i.test(root)) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  }
  if (/triple|三灵/i.test(root)) {
    return 'border-stone-300 bg-stone-50 text-stone-800';
  }
  return 'border-stone-200 bg-stone-50 text-stone-600';
}

function evaluateEligibility(score: number): { label: string; tone: 'good' | 'neutral' | 'mystery' } {
  if (score >= 0.7) return { label: '上佳', tone: 'good' };
  if (score >= 0.5) return { label: '适配', tone: 'neutral' };
  if (score >= 0.3) return { label: '中平', tone: 'neutral' };
  return { label: '微薄', tone: 'mystery' };
}

function buildCandidates(
  rawCandidates: any[],
  pool: any[],
  worldState: any,
): CandidateDisplay[] {
  if (!Array.isArray(rawCandidates)) return [];
  return rawCandidates.map((c) => {
    const selection = selectNextProtagonist(pool || [], worldState, [c]);
    const score = selection && typeof selection.eligibility === 'number' ? selection.eligibility : 0;
    const ev = evaluateEligibility(score);
    return {
      id: typeof c?.id === 'string' ? c.id : `cand-${Math.random().toString(36).slice(2, 8)}`,
      name: typeof c?.name === 'string' && c.name ? c.name : '无名',
      age: typeof c?.age === 'number' && c.age >= 0 ? c.age : 0,
      realm: typeof c?.realm === 'string' && c.realm ? c.realm : '凡人',
      spiritualRoot: typeof c?.spiritualRoot === 'string' && c.spiritualRoot ? c.spiritualRoot : '凡根',
      bloodline: typeof c?.bloodline === 'string' ? c.bloodline : '',
      karmaTags: Array.isArray(c?.karmaTags) ? c.karmaTags.filter((t: any) => typeof t === 'string') : [],
      traitNarrative: typeof c?.traitNarrative === 'string' ? c.traitNarrative : '',
      eligibility: score,
      evaluationLabel: ev.label,
      tone: ev.tone,
    };
  });
}

function describePool(pool: any[]): { kindText: string; slotText: string } {
  if (!Array.isArray(pool) || pool.length === 0) {
    return { kindText: '无传承', slotText: '无' };
  }
  const kinds = pool
    .map((p) => (p && typeof p.kind === 'string' ? KIND_LABEL[p.kind] || p.kind : ''))
    .filter(Boolean);
  const totalSlots = pool.reduce((sum, p) => sum + (typeof p?.availableSlots === 'number' ? p.availableSlots : 0), 0);
  return {
    kindText: kinds.length > 0 ? kinds.join('、') : '杂项',
    slotText: totalSlots > 0 ? `${totalSlots} 个名额` : '待定',
  };
}

interface InheritancePoolPanelProps {
  className?: string;
  defaultCollapsed?: boolean;
}

export function InheritancePoolPanel({ className, defaultCollapsed = true }: InheritancePoolPanelProps) {
  const character = useGameStore((s) => s.character);
  const inheritancePool = useGameStore((s) => s.inheritancePool);
  const inheritanceCandidates = useGameStore((s) => s.inheritanceCandidates);
  const claimInheritanceCandidate = useGameStore((s) => s.claimInheritanceCandidate);
  const worldCalendar = useGameStore((s) => s.worldCalendar);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 触发条件：角色已陨落（兼容 character.dead 或 !character.alive）
  const isDead =
    character &&
    typeof character === 'object' &&
    (character.dead === true || character.alive === false);

  const candidates = useMemo(
    () => buildCandidates(inheritanceCandidates || [], inheritancePool || [], worldCalendar),
    [inheritanceCandidates, inheritancePool, worldCalendar],
  );

  const poolInfo = useMemo(() => describePool(inheritancePool || []), [inheritancePool]);

  // 不可见时返回 null，让 page.tsx 用条件渲染而非 panel 自身隐藏
  if (!isDead) return null;

  const handleClaim = (id: string) => {
    if (selectedId) return;
    setSelectedId(id);
    try {
      claimInheritanceCandidate(id);
    } catch (e) {
      setSelectedId(null);
    }
  };

  return (
    <section
      data-testid="inheritance-section" id="inheritance-pool-section"
      className={cn(
        'rounded-lg border border-amber-300/70 bg-gradient-to-b from-amber-50/80 to-stone-50/80 p-3 my-1 shadow-sm',
        className,
      )}
    >
      <header
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 cursor-pointer select-none"
      >
        <span className="text-base text-amber-700">
          <Crown className="w-4 h-4 inline" />
        </span>
        <h3 className="font-serif-cn font-bold text-sm tracking-wider text-stone-800">
          衣钵待承 · 继承池
        </h3>
        <span className="ml-auto text-[10px] text-stone-500 font-serif-cn">
          池含 {poolInfo.kindText} · {poolInfo.slotText}
        </span>
        <span className="text-xs text-stone-500">{collapsed ? '▸' : '▾'}</span>
      </header>

      {!collapsed && (
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-stone-600 font-serif-cn leading-relaxed">
            {(character && character.name) ? character.name : '此人'}已陨；其一缕道韵未散，仍有
            {candidates.length > 0
              ? ` ${candidates.length} 位后辈可承接衣钵`
              : ' 些许传人待你寻访'}
            。
            {inheritancePool && inheritancePool.length > 0
              ? '继承者将承此池中道物、灵宠、道场与未竟之缘。'
              : '此生未留传承，轮转或需另寻新苗。'}
          </div>

          {/* 池子为空 + 候选也为空 → 空态 */}
          {candidates.length === 0 && (
            <div
              data-testid="inheritance-empty"
              className="text-[11px] text-stone-500 italic font-serif-cn py-3 text-center border border-dashed border-stone-300 rounded"
            >
              尚无可继承者候选 · 修仙轮转暂止
            </div>
          )}

          {/* 候选卡片 */}
          {candidates.length > 0 && (
            <ul className="space-y-2" data-testid="inheritance-candidate-list">
              {candidates.map((cand) => {
                const isExpanded = expandedId === cand.id;
                const isSelected = selectedId === cand.id;
                const toneClass =
                  cand.tone === 'good'
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : cand.tone === 'mystery'
                      ? 'border-violet-300 bg-violet-50/60'
                      : 'border-stone-300 bg-stone-50/60';
                return (
                  <li
                    key={cand.id}
                    data-testid={`inheritance-candidate-${cand.id}`}
                    className={cn(
                      'rounded-md border p-2 transition-colors',
                      toneClass,
                      isSelected && 'ring-2 ring-amber-400',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif-cn font-bold text-sm text-stone-800">
                            {cand.name}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {cand.age} 岁 · {cand.realm}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded border',
                              rootToneClass(cand.spiritualRoot),
                            )}
                          >
                            {rootLabel(cand.spiritualRoot)}
                          </span>
                          {cand.bloodline && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-900">
                              血脉 · {cand.bloodline}
                            </span>
                          )}
                        </div>

                        {cand.karmaTags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cand.karmaTags.slice(0, 4).map((tag, i) => (
                              <span
                                key={`${cand.id}-tag-${i}`}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-white/70 text-stone-600"
                              >
                                因缘 · {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {cand.traitNarrative && (
                          <div
                            className={cn(
                              'mt-1 text-[11px] font-serif-cn text-stone-700 leading-relaxed',
                              !isExpanded && 'line-clamp-2',
                            )}
                          >
                            {cand.traitNarrative}
                          </div>
                        )}

                        <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-500">
                          <span>
                            适配 ·{' '}
                            <span className="font-bold text-stone-700">
                              {(cand.eligibility * 100).toFixed(0)}%
                            </span>
                          </span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded border',
                              cand.tone === 'good'
                                ? 'border-emerald-300 text-emerald-800'
                                : cand.tone === 'mystery'
                                  ? 'border-violet-300 text-violet-800'
                                  : 'border-stone-300 text-stone-700',
                            )}
                          >
                            {cand.evaluationLabel}
                          </span>
                          <button
                            type="button"
                            data-testid={`inheritance-toggle-${cand.id}`}
                            onClick={() => setExpandedId(isExpanded ? null : cand.id)}
                            className="ml-auto text-[10px] text-stone-500 underline-offset-2 hover:underline"
                          >
                            <Eye className="w-3 h-3 inline" />{' '}
                            {isExpanded ? '收起' : '详述'}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`inheritance-claim-${cand.id}`}
                        onClick={() => handleClaim(cand.id)}
                        disabled={!!selectedId}
                        className={cn(
                          'shrink-0 px-2.5 py-1.5 rounded-md text-[11px] font-serif-cn font-bold border transition-colors',
                          selectedId
                            ? 'border-stone-300 text-stone-400 bg-stone-100 cursor-not-allowed'
                            : 'border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100',
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Sparkles className="w-3 h-3 inline mr-1" /> 承继中…
                          </>
                        ) : (
                          <>
                            <Users className="w-3 h-3 inline mr-1" /> 承此衣钵
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-[10px] text-stone-500 italic font-serif-cn">
            机运由命数基于灵根、血脉、因果与传承匹配推算；选其一即承继前缘、开新卷。
          </div>
        </div>
      )}
    </section>
  );
}

export default InheritancePoolPanel;

