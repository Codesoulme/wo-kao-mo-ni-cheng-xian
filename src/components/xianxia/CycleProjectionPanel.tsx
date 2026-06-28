'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  projectInheritanceForUI,
  projectSectTrajectoryForUI,
  projectFateEchoForUI,
  projectEndingForUI,
  type PlayerUIProjection,
  type PlayerUISlotEntry,
} from '@/lib/xianxia/engine';
import { ChevronDown, ChevronUp, Users, Mountain, GitBranch, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CycleProjectionPanelProps {
  className?: string;
  character?: any;
  inheritanceChain?: any;
  sectState?: any;
  fateEchoes?: any;
  worldState?: any;
  defaultCollapsed?: boolean;
}

const TONE_CLASS: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  danger: 'bg-rose-50 text-rose-900 border-rose-300',
  mystery: 'bg-violet-50 text-violet-900 border-violet-300',
  neutral: 'bg-stone-50 text-stone-800 border-stone-200',
};

const TONE_ICON: Record<string, string> = {
  good: '○',
  danger: '△',
  mystery: '◇',
  neutral: '·',
};

const TAB_DEFS = [
  { key: 'inheritance', label: '传承', icon: Users },
  { key: 'sect', label: '宗门', icon: Mountain },
  { key: 'fate', label: '命网', icon: GitBranch },
  { key: 'ending', label: '结局', icon: Sparkles },
] as const;

type TabKey = typeof TAB_DEFS[number]['key'];

function renderSlots(slots: PlayerUISlotEntry[], expanded: boolean, max: number) {
  const visible = expanded ? slots : slots.slice(0, max);
  const hiddenCount = Math.max(0, slots.length - visible.length);
  if (visible.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic font-serif-cn text-center py-3">
        尚无可投影内容
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {visible.map((slot, i) => (
        <div
          key={`${'$'}{slot.slot}-${'$'}{slot.sourceId}-${'$'}{i}`}
          className={cn(
            'rounded-md border px-2 py-1.5 text-[11px] font-serif-cn',
            TONE_CLASS[slot.tone] || TONE_CLASS.neutral,
          )}
          data-testid={`cycle-slot-${'$'}{slot.slot}`}
        >
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-[10px] opacity-70 mt-0.5">
              {TONE_ICON[slot.tone] || TONE_ICON.neutral}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold">{slot.displayLabel}</span>
                <span className="text-[9px] opacity-60">
                  {slot.slot}
                </span>
              </div>
              {slot.description && (
                <div className="text-[10px] opacity-80 leading-relaxed mt-0.5">
                  {slot.description}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="text-[9px] text-muted-foreground text-center italic">
          …还有 {hiddenCount} 项
        </div>
      )}
    </div>
  );
}

export function CycleProjectionPanel({
  className,
  character: externalCharacter,
  inheritanceChain,
  sectState,
  fateEchoes,
  worldState,
  defaultCollapsed = true,
}: CycleProjectionPanelProps) {
  const { character: storeCharacter } = useGameStore();
  const character = externalCharacter || storeCharacter;
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [tab, setTab] = useState<TabKey>('inheritance');

  const projections = useMemo<Record<TabKey, PlayerUIProjection>>(() => {
    const ch = character || null;

    // Infer inheritance chain from character data when not provided externally.
    // Reuses AI-I401 inheritance field if present, otherwise derives a minimal
    // chain from character.master/parent/masterId so the panel never looks empty
    // for a character who has any lineage signal.
    const inheritedAbilities: string[] = Array.isArray(ch?.inheritedAbilities)
      ? ch.inheritedAbilities.filter((x: any) => typeof x === 'string')
      : [];
    const inferredInheritanceChain = inheritanceChain ?? (inheritedAbilities.length > 0 || ch?.master || ch?.parent
      ? {
          rootCharacterId: typeof ch.master === 'string' ? ch.master : (typeof ch.parent === 'string' ? ch.parent : (ch.id || 'c-root')),
          generations: inheritedAbilities.length > 0
            ? [{ characterId: ch.id || 'c-self', inheritedFromId: typeof ch.master === 'string' ? ch.master : (typeof ch.parent === 'string' ? ch.parent : 'c-root') }]
            : [],
          activeClaims: [],
          lostTechniques: [],
        }
      : null);

    const inferredSectState = sectState ?? (ch?.faction || ch?.sect
      ? {
          sectId: ch.faction || ch.sect,
          phase: ch?.sectPhase || 'stable',
          currentPower: typeof ch?.sectPower === 'number' ? ch.sectPower : 0.5,
          history: Array.isArray(ch?.sectHistory) ? ch.sectHistory : [],
        }
      : null);

    const inferredFateEchoes = fateEchoes ?? (Array.isArray(ch?.fateEchoes)
      ? ch.fateEchoes
      : (Array.isArray(ch?.fateNodes)
          ? ch.fateNodes.map((n: any) => ({ echoId: n?.id, resolved: n?.resolved === true, linkedThreadId: n?.linkedThreadId }))
          : []));

    const inferredWorldState = worldState ?? (ch?.age !== undefined
      ? {
          possibleEndings: Array.isArray(ch?.possibleEndings) ? ch.possibleEndings : [],
          fixedEndings: Array.isArray(ch?.fixedEndings) ? ch.fixedEndings : [],
          irreversibleChoices: Array.isArray(ch?.irreversibleChoices) ? ch.irreversibleChoices : [],
          endgameMeter: typeof ch?.endgameMeter === 'number' ? ch.endgameMeter : Math.min(1, Math.max(0, (ch.age || 0) / 200)),
        }
      : null);

    return {
      inheritance: projectInheritanceForUI(ch, inferredInheritanceChain),
      sect: projectSectTrajectoryForUI(ch, inferredSectState),
      fate: projectFateEchoForUI(ch, inferredFateEchoes),
      ending: projectEndingForUI(ch, inferredWorldState),
    };
  }, [character, inheritanceChain, sectState, fateEchoes, worldState]);

  const totalSlots =
    projections.inheritance.slots.length +
    projections.sect.slots.length +
    projections.fate.slots.length +
    projections.ending.slots.length;

  if (!character) {
    return (
      <Card className={cn('paper-texture', className)} data-testid="cycle-projection-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">轮回投影</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-[10px] text-muted-foreground italic font-serif-cn text-center py-4">
            尚未踏足修仙之路，轮回投影无从展开。
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('paper-texture', className)} data-testid="cycle-projection-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">轮回投影</span>
          </span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px]" data-testid="cycle-total-slots">
              {totalSlots}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? '折叠' : '展开'}
              data-testid="cycle-toggle"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              {TAB_DEFS.map((t) => {
                const Icon = t.icon;
                const count = projections[t.key].slots.length;
                return (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className="text-[10px] gap-1 h-7"
                    data-testid={`cycle-tab-${'$'}{t.key}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{t.label}</span>
                    {count > 0 && (
                      <span className="text-[9px] opacity-70">({count})</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {TAB_DEFS.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-2">
                <div
                  className="text-[10px] text-muted-foreground italic font-serif-cn mb-2"
                  data-testid={`cycle-narrative-${'$'}{t.key}`}
                >
                  {projections[t.key].narrative}
                </div>
                {renderSlots(projections[t.key].slots, true, 6)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
