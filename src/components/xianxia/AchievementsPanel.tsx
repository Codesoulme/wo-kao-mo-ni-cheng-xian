'use client';

/**
 * 沉浸版成就画廊：把 character.achievements 按 8 桶分类、按达成岁数倒序展示。
 * 数据流：引擎层每岁推进后由 LLM 输出 [ACHIEVEMENT:id] [REWARD:...] 标记
 *       → advance / advance-sse 解析后落入 store.achievements + store.heritageVault
 *       → 本组件只读，不写。
 *
 * 8 桶：年岁 / 境界 / 属性 / 战斗 / 师承 / 社交 / 剧情 / 轮回。
 * 桶色用 Tailwind 系（border + bg + text），不写裸 hex。
 * 每桶内部按 triggeredAge 倒序（最新在前）。
 * 顶部小计：已获 X / 30。
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Trophy, Sparkles, Mountain, Star, Sword, Crown, Users, BookOpen, Baby, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/lib/xianxia/store';
import {
  ACHIEVEMENT_BY_ID,
  ACHIEVEMENT_POOL,
  type AchievementBucket,
  type AchievementDefinition,
} from '@/lib/xianxia/achievements';

type BucketStyle = {
  border: string;
  bg: string;
  text: string;
  badge: string;
  icon: React.ReactNode;
  label: string;
};

const BUCKET_STYLE: Record<AchievementBucket, BucketStyle> = {
  age: {
    border: 'border-amber-300',
    bg: 'bg-amber-50/60',
    text: 'text-amber-900',
    badge: 'border-amber-300 text-amber-900 bg-amber-50',
    icon: <Baby className="w-4 h-4" />,
    label: '年岁',
  },
  realm: {
    border: 'border-violet-300',
    bg: 'bg-violet-50/60',
    text: 'text-violet-900',
    badge: 'border-violet-300 text-violet-900 bg-violet-50',
    icon: <Mountain className="w-4 h-4" />,
    label: '境界',
  },
  attribute: {
    border: 'border-sky-300',
    bg: 'bg-sky-50/60',
    text: 'text-sky-900',
    badge: 'border-sky-300 text-sky-900 bg-sky-50',
    icon: <Sparkles className="w-4 h-4" />,
    label: '属性',
  },
  combat: {
    border: 'border-rose-300',
    bg: 'bg-rose-50/60',
    text: 'text-rose-900',
    badge: 'border-rose-300 text-rose-900 bg-rose-50',
    icon: <Sword className="w-4 h-4" />,
    label: '战斗',
  },
  teacher: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/60',
    text: 'text-emerald-900',
    badge: 'border-emerald-300 text-emerald-900 bg-emerald-50',
    icon: <BookOpen className="w-4 h-4" />,
    label: '师承',
  },
  social: {
    border: 'border-orange-300',
    bg: 'bg-orange-50/60',
    text: 'text-orange-900',
    badge: 'border-orange-300 text-orange-900 bg-orange-50',
    icon: <Users className="w-4 h-4" />,
    label: '社交',
  },
  story: {
    border: 'border-amber-700/60',
    bg: 'bg-amber-100/40',
    text: 'text-amber-950',
    badge: 'border-amber-700/60 text-amber-950 bg-amber-100',
    icon: <ScrollText className="w-4 h-4" />,
    label: '剧情',
  },
  cycle: {
    border: 'border-stone-400',
    bg: 'bg-stone-100/60',
    text: 'text-stone-800',
    badge: 'border-stone-400 text-stone-800 bg-stone-100',
    icon: <Crown className="w-4 h-4" />,
    label: '轮回',
  },
};

const BUCKET_ORDER: AchievementBucket[] = [
  'age', 'realm', 'attribute', 'combat', 'teacher', 'social', 'story', 'cycle',
];

export function AchievementsPanel() {
  const character = useGameStore((s) => s.character);
  const achievements = useGameStore((s) => s.achievements);
  const heritageVault = useGameStore((s) => s.heritageVault);

  // 各桶独立折叠态（默认全部展开）
  const [openMap, setOpenMap] = useState<Record<AchievementBucket, boolean>>(() => {
    const init = {} as Record<AchievementBucket, boolean>;
    for (const b of BUCKET_ORDER) init[b] = true;
    return init;
  });

  // 按 bucket 归类 + 桶内按 triggeredAge 倒序
  const grouped = useMemo(() => {
    const list = Array.isArray(achievements) ? achievements : [];
    const map: Record<AchievementBucket, typeof list> = {
      age: [], realm: [], attribute: [], combat: [],
      teacher: [], social: [], story: [], cycle: [],
    };
    for (const r of list) {
      if (!r || !r.bucket) continue;
      if (!map[r.bucket]) map[r.bucket] = [];
      map[r.bucket].push(r);
    }
    for (const b of BUCKET_ORDER) {
      map[b].sort((a, b2) => (b2.triggeredAge ?? 0) - (a.triggeredAge ?? 0));
    }
    return map;
  }, [achievements]);

  // 顶部小计：已获 / 池总量
  const earnedCount = useMemo(
    () => (Array.isArray(achievements) ? achievements.length : 0),
    [achievements],
  );
  const totalCount = ACHIEVEMENT_POOL.length;

  // heritageVault 反查表：rewardId → HeritageItem
  const vaultById = useMemo(() => {
    const m: Record<string, any> = {};
    if (Array.isArray(heritageVault)) {
      for (const item of heritageVault) {
        if (item && item.id) m[item.id] = item;
      }
    }
    return m;
  }, [heritageVault]);

  if (!character) return null;

  const toggle = (b: AchievementBucket) =>
    setOpenMap((prev) => ({ ...prev, [b]: !prev[b] }));

  // 空态
  if (earnedCount === 0) {
    return (
      <Card className="paper-texture" data-testid="achievements-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">修为印记</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              0 / {totalCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-8 font-serif-cn">
            尚未有任何成就
          </p>
          <p className="text-[10px] text-muted-foreground text-center pb-2">
            修行路上若逢紧要之刻，自会镌刻于印记之上
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="achievements-panel">
      {/* 顶部小计 */}
      <div className="text-xs text-muted-foreground px-1 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <span className="font-serif-cn">修为印记 · 已获</span>
        </span>
        <span className="text-[10px] tabular-nums">
          {earnedCount} / {totalCount}
        </span>
      </div>

      {/* 8 桶分组 */}
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped[bucket] || [];
        if (items.length === 0) return null;
        const style = BUCKET_STYLE[bucket];
        const open = openMap[bucket];
        return (
          <Collapsible
            key={bucket}
            open={open}
            onOpenChange={() => toggle(bucket)}
          >
            <Card className="paper-texture overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader
                  className="pb-2 cursor-pointer hover:bg-secondary/30 transition-colors"
                  style={{ borderBottom: open ? `1px solid currentColor` : undefined }}
                >
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={style.text}>{style.icon}</span>
                      <span className="font-serif-cn">{style.label}印记</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] tabular-nums border', style.badge)}
                      >
                        {items.length}
                      </Badge>
                      <ChevronDown
                        className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-3 space-y-2">
                  {items.map((record) => {
                    const def: AchievementDefinition | undefined = ACHIEVEMENT_BY_ID[record.id];
                    const reward = record.rewardId ? vaultById[record.rewardId] : null;
                    const rewardName =
                      reward && typeof reward.name === 'string' && reward.name
                        ? reward.name
                        : (def ? `${def.name}之礼` : '印记之礼');
                    return (
                      <div
                        key={record.id}
                        data-testid={`achievement-item-${record.id}`}
                        className={cn(
                          'rounded-md border p-2 transition-colors hover:bg-secondary/20 min-w-0',
                          style.border,
                          style.bg,
                        )}
                      >
                        <div className="flex items-center justify-between mb-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn('text-[10px] font-bold font-serif-cn tabular-nums', style.text)}>
                              {record.triggeredAge ?? 0}岁
                            </span>
                            <span
                              className={cn(
                                'text-[9px] px-1 py-0.5 rounded border',
                                style.badge,
                              )}
                            >
                              {style.label}
                            </span>
                          </div>
                        </div>
                        <div className={cn('text-xs font-semibold font-serif-cn mb-1 xianxia-readable', style.text)}>
                          <Star className="w-3 h-3 inline mr-1 opacity-70" />
                          {def?.name || record.name || record.id}
                        </div>
                        <p className="text-[11px] text-foreground/80 leading-relaxed xianxia-prose">
                          {record.hint || def?.hint || ''}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-serif-cn">印记之物</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded border text-[10px] truncate max-w-[60%]',
                              style.badge,
                            )}
                            title={rewardName}
                          >
                            {rewardName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

export default AchievementsPanel;