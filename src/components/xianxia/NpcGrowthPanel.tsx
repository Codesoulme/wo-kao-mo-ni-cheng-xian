'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Users, ChevronRight, Skull, ArrowUp, Clock, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { realmLabel, attitudeLabel } from '@/lib/xianxia/npc-growth';

interface NpcGrowthPanelProps {
  className?: string;
  defaultCollapsed?: boolean;
  character?: any;
}

// 2026-07-12：修真境界白名单——只有这些 key 才算"修行中人"。
// 与 npc-growth.ts 的 REALM_LABEL 表保持一致；其它脏数据（中文/乱码）一律视为凡人。
const CULTIVATOR_REALMS = new Set<string>([
  'qi_refining', 'foundation', 'golden_core', 'nascent_soul',
  'spirit_severing', 'great_vehicle', 'tribulation', 'ascension',
]);
function isCultivatorRealm(realm: unknown): boolean {
  return typeof realm === 'string' && CULTIVATOR_REALMS.has(realm.trim());
}

function testid(prefix, id) {
  return prefix + '-' + id;
}

export function NpcGrowthPanel({ className, defaultCollapsed = true }: NpcGrowthPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const character = useGameStore((s: any) => s.character);
  const npcs = useMemo(() => {
    const list = character && Array.isArray(character.npcs) ? character.npcs : [];
    return list.filter((n) => n && typeof n === 'object' && typeof n.id === 'string');
  }, [character]);

  // sorted 必须在所有早返之前调用，否则 npcs 由空变非空时 hook 数量会变，触发 React 报错
  // 2026-07-12：判定"已故"只看 memory 关键字（仙逝|陨落|归道|坐化|寿终），
  // 不再用 attitude==='unknown'——AI 偶发拼错 attitude 被归一为 unknown 时会误标活人"已故"
  const sorted = useMemo(() => {
    const list = [...npcs];
    const isDeadByMemory = (n: any): boolean =>
      typeof n.memory === 'string' && /仙逝|陨落|归道|坐化|寿终/.test(n.memory);
    list.sort((a, b) => {
      const aDead = isDeadByMemory(a);
      const bDead = isDeadByMemory(b);
      if (aDead !== bDead) return aDead ? -1 : 1;
      const relA = typeof a.relationshipScore === 'number' ? a.relationshipScore : 0;
      const relB = typeof b.relationshipScore === 'number' ? b.relationshipScore : 0;
      return relB - relA;
    });
    return list;
  }, [npcs]);

  if (!character) return null;
  if (character.alive === false || character.ascended === true) return null;

  if (npcs.length === 0) {
    return (
      <section
        data-testid="npc-growth-section"
        id="npc-growth-section"
        className={cn(
          'rounded-lg border border-stone-300/70 bg-gradient-to-b from-stone-50/80 to-amber-50/40 p-3 my-1 shadow-sm',
          className,
        )}
      >
        <header
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <span className="text-base text-stone-600">
            <Users className="w-4 h-4 inline" />
          </span>
          <h3 className="font-serif-cn font-bold text-sm tracking-wider text-stone-800">
            故交旧雨 · 仙途众生
          </h3>
          <span className="ml-auto text-[10px] text-stone-500 font-serif-cn">
            0 位故人
          </span>
          <span className="text-xs text-stone-500">{collapsed ? '▸' : '▾'}</span>
        </header>

        {!collapsed && (
          <div
            data-testid="npc-growth-empty"
            className="mt-2 text-[11px] text-stone-500 italic font-serif-cn py-3 text-center border border-dashed border-stone-300 rounded"
          >
            行至此处，尚未与任何修士结缘。
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="npc-growth-section"
      id="npc-growth-section"
      className={cn(
        'rounded-lg border border-stone-300/70 bg-gradient-to-b from-stone-50/80 to-amber-50/40 p-3 my-1 shadow-sm',
        className,
      )}
    >
      <header
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 cursor-pointer select-none"
      >
        <span className="text-base text-stone-600">
          <Users className="w-4 h-4 inline" />
        </span>
        <h3 className="font-serif-cn font-bold text-sm tracking-wider text-stone-800">
          故交旧雨 · 仙途众生
        </h3>
        <span className="ml-auto text-[10px] text-stone-500 font-serif-cn">
          {npcs.length} 位故人
        </span>
        <span className="text-xs text-stone-500">{collapsed ? '▸' : '▾'}</span>
      </header>

      {!collapsed && (
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-stone-600 font-serif-cn leading-relaxed">
            修仙路上不止你一人在变 —— 故交亦随岁月流转，有人破境、有人老去，亦有人悄然辞世。
          </div>

          <ul className="space-y-2" data-testid="npc-growth-list">
            {sorted.map((npc: any) => {
              const isExpanded = expandedId === npc.id;
              const isDead = npc.attitude === 'unknown' && /仙逝|陨落|归道/.test(npc.memory || '');
              const age = typeof npc.lastSeenAge === 'number' && npc.lastSeenAge > 0
                ? npc.lastSeenAge
                : (typeof npc.firstMetAge === 'number' ? npc.firstMetAge : 0);
              const rel = typeof npc.relationshipScore === 'number' ? npc.relationshipScore : 0;
              const tone = isDead
                ? 'border-stone-300 bg-stone-100/60'
                : rel >= 30
                  ? 'border-amber-300 bg-amber-50/60'
                  : rel <= -30
                    ? 'border-rose-300 bg-rose-50/60'
                    : 'border-stone-300 bg-stone-50/60';

              return (
                <li
                  key={npc.id}
                  data-testid={testid('npc-growth', npc.id)}
                  className={cn(
                    'rounded-md border p-2 transition-colors',
                    tone,
                    isDead && 'opacity-75',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif-cn font-bold text-sm text-stone-800">
                          {npc.name || '无名故人'}
                        </span>
                        {/* 沉浸版 Phase-Release: 关系/身份挪到头部，一眼看清是父/母/道侣/邻居 */}
                        {npc.role && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/8 text-primary/85 font-serif-cn">
                            {String(npc.role).slice(0, 12)}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-500">
                          {age} 岁 · {realmLabel(npc.realm)}
                        </span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border',
                          isDead
                            ? 'border-stone-400 bg-stone-200 text-stone-700'
                            : rel >= 30
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : rel <= -30
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : 'border-stone-300 bg-white/70 text-stone-700',
                        )}>
                          {attitudeLabel(npc.attitude)}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          亲疏 · {rel >= 0 ? '+' : ''}{rel.toFixed(1)}
                        </span>
                        {isDead && (
                          <span
                            data-testid={testid('npc-growth-died', npc.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-500 bg-stone-700 text-stone-50 font-bold"
                          >
                            ✗ 仙逝
                          </span>
                        )}
                        {/* 2026-07-12：修行中人判定只用 REALM_LABEL 白名单（修真境界 key 集），
                            避免脏数据（中文境界名/乱码/undefined）误标"修行中人" */}
                        {!isDead && isCultivatorRealm(npc.realm) && (
                          <span
                            data-testid={testid('npc-growth-realm', npc.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary"
                          >
                            <ArrowUp className="w-3 h-3 inline" /> 修行中人
                          </span>
                        )}
                      </div>

                      <YearChange npc={npc} />

                      {isExpanded && (
                        <div className="mt-2 space-y-1 text-[11px] text-stone-700 font-serif-cn leading-relaxed">
                          {npc.role && (
                            <div>
                              <span className="text-stone-500">身份：</span>
                              {npc.role}
                            </div>
                          )}
                          {npc.faction && (
                            <div>
                              <span className="text-stone-500">所属：</span>
                              {npc.faction}
                            </div>
                          )}
                          {npc.lastKnownLocation && (
                            <div>
                              <span className="text-stone-500">最后现身：</span>
                              {npc.lastKnownLocation}
                            </div>
                          )}
                          {(() => {
                            // 2026-07-12：AI 偶发返回"11m / 12m"这种短串当 source，
                            // 检测"全是数字+长度极短"时回退到根据 firstMetAge 生成可读描述，
                            // 避免详情里出现莫名其妙的"11m"。
                            const src = typeof npc.source === 'string' ? npc.source.trim() : '';
                            const looksLikeGarbage = /^\d+\s*[a-zA-Z]*$/.test(src) && src.length <= 8;
                            const readable = !looksLikeGarbage && src && src !== 'llm';
                            return (
                              <div>
                                <span className="text-stone-500">初逢：</span>
                                {readable ? src : (() => {
                                  const fAge = typeof npc.firstMetAge === 'number' ? npc.firstMetAge : null;
                                  if (fAge !== null && fAge > 0) return `你 ${fAge} 岁时结识`;
                                  return '昔日旧识';
                                })()}
                              </div>
                            );
                          })()}
                          {npc.memory && (
                            <div className="italic text-stone-600 border-l-2 border-stone-300 pl-2">
                              {npc.memory}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      data-testid={testid('npc-growth-toggle', npc.id)}
                      onClick={() => setExpandedId(isExpanded ? null : npc.id)}
                      className="shrink-0 text-[10px] text-stone-500 hover:text-stone-700 px-1"
                      aria-label={isExpanded ? '收起' : '展开详情'}
                    >
                      {isExpanded ? '收起' : '详情'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="text-[10px] text-stone-500 font-serif-cn italic pt-1 border-t border-stone-200/60">
            故交非草木 —— 修仙岁月里，亦会因疏于联络而转淡，因修为精进而破境。
          </div>
        </div>
      )}
    </section>
  );
}

function YearChange({ npc }: { npc: any }) {
  const mem = typeof npc.memory === 'string' ? npc.memory : '';
  const isDead = npc.attitude === 'unknown' && /仙逝|陨落|归道/.test(mem);
  const segments: { icon: any; text: string; tone: string; testid?: string }[] = [];

  if (isDead) {
    segments.push({
      icon: Skull,
      text: mem.split('｜').filter((s) => /仙逝|陨落|归道/.test(s)).pop() || '已辞世',
      tone: 'text-stone-700',
    });
  } else if (mem) {
    const latest = mem.split('｜').slice(-1)[0];
    if (/破境|突破/.test(latest)) {
      segments.push({ icon: ArrowUp, text: latest, tone: 'text-emerald-700' });
    } else if (/疏远|转淡|久未联络/.test(latest)) {
      segments.push({ icon: Heart, text: latest, tone: 'text-rose-700' });
    } else {
      segments.push({ icon: Clock, text: '年华流转', tone: 'text-stone-600' });
    }
  } else {
    segments.push({ icon: Clock, text: '年华流转', tone: 'text-stone-600' });
  }

  // 沉浸版 Phase-N: 渲染 NPC 自身属性年度变化微章（攻/防/速/血）
  const growth = npc && typeof npc === 'object' ? npc.lastGrowth : null;
  if (growth && typeof growth === 'object') {
    const attrEntries: { key: string; label: string; delta: number }[] = [
      { key: 'attack',  label: '攻', delta: Number(growth.attack)  || 0 },
      { key: 'defense', label: '防', delta: Number(growth.defense) || 0 },
      { key: 'speed',   label: '速', delta: Number(growth.speed)   || 0 },
      { key: 'maxHp',   label: '血', delta: Number(growth.maxHp)   || 0 },
    ];
    for (const entry of attrEntries) {
      if (entry.delta === 0) continue;
      const sign = entry.delta > 0 ? '+' : '−';
      const tone = entry.delta > 0 ? 'text-emerald-700' : 'text-rose-700';
      segments.push({
        icon: entry.delta > 0 ? ArrowUp : Heart,
        text: entry.label + sign + Math.abs(entry.delta),
        tone,
        testid: 'npc-growth-attr-' + npc.id + '-' + entry.key,
      });
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {segments.map((seg, i) => {
        const Icon = seg.icon;
        return (
          <span
            key={'change-' + npc.id + '-' + i}
            data-testid={seg.testid}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-white/70 inline-flex items-center gap-1',
              seg.tone,
            )}
          >
            <Icon className="w-3 h-3" />
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}