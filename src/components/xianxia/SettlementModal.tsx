'use client';

import { useState } from 'react';
import { useGameStore, type HeritageItem } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const RARITY_LABEL: Record<string, string> = {
  common: '凡品',
  uncommon: '良品',
  rare: '珍稀',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const RARITY_CLASS: Record<string, string> = {
  common: 'border-slate-400/40 text-slate-600',
  uncommon: 'border-emerald-500/40 text-emerald-600',
  rare: 'border-blue-500/40 text-blue-600',
  epic: 'border-purple-500/40 text-purple-600',
  legendary: 'border-amber-500/50 text-amber-600',
  mythic: 'border-pink-500/50 text-pink-600',
};

export function SettlementModal() {
  const { settlementResult, setSettlementResult, addHeritageItems, addHallRecord, reset } = useGameStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const options = settlementResult?.options || [];
  const selectedItem = options.find((option) => selectedIds.includes(option.id));

  if (!settlementResult) return null;

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return [];
      return [id];
    });
  };

  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    const heritageItems: HeritageItem[] = selectedItem ? [selectedItem].map(({ reason: _reason, ...item }) => item) : [];

    try {
      const res = await fetch('/api/game/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: settlementResult.characterId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || '归档旧世失败');
    } catch (err: any) {
      setConfirming(false);
      toast.error('归档旧世失败', { description: err?.message || '请稍后重试' });
      return;
    }

    addHeritageItems(heritageItems);
    addHallRecord({ ...settlementResult.hallRecord, carriedOut: heritageItems });
    setSettlementResult(null);
    setSelectedIds([]);
    setConfirming(false);
    reset();
    toast.success('轮回结算已归档', {
      description: heritageItems.length ? `已收入传承池：${heritageItems.map((item) => item.name).join('、')}` : '未选择带出物，仅留名仙路殿堂。',
    });
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            {settlementResult.title}
          </DialogTitle>
          <DialogDescription className="leading-relaxed font-serif-cn">
            轮回不携一世修为，只认尚未散尽的旧缘。请在天命浮现的旧物、命格、灵宠、法宝或体质中择其一，留作下一世开端。
          </DialogDescription>
        </DialogHeader>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">总体评价</span>
              <Badge variant="secondary" className="font-serif-cn">{settlementResult.rank}</Badge>
            </div>
            <div className="text-2xl font-bold text-primary tabular-nums">{settlementResult.score}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {settlementResult.summary}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-serif-cn font-semibold">可带出传承</div>
            <div className="text-xs text-muted-foreground">{selectedIds.length}/1</div>
          </div>
          {options.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              此世因缘尚浅，未凝出可带走之物。入殿留名，来世再问天命。
            </div>
          ) : (
            options.map((option) => {
              const checked = selectedIds.includes(option.id);
              return (
                <div
                  key={option.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(option.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggle(option.id);
                    }
                  }}
                  className="w-full cursor-pointer text-left rounded-lg border bg-card/70 p-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <div className="flex gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(option.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-serif-cn text-sm font-semibold truncate">{option.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${RARITY_CLASS[option.rarity] || RARITY_CLASS.common}`}>
                          {RARITY_LABEL[option.rarity] || option.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{option.description}</p>
                      <p className="text-[10px] text-primary/80 leading-relaxed">{option.reason}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button onClick={confirm} disabled={confirming} className="w-full font-serif-cn tracking-wider">
            <Sparkles className={`w-4 h-4 mr-2 ${confirming ? 'animate-spin' : ''}`} />
            {confirming ? '归档旧世...' : '归入轮回，开启下一世'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
