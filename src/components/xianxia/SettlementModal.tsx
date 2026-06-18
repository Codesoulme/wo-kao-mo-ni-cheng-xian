'use client';

import { useMemo, useState } from 'react';
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

  const options = settlementResult?.options || [];
  const selectedItems = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
    [options, selectedIds],
  );

  if (!settlementResult) return null;

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        toast.warning('轮回之门狭窄', { description: '此版最多带出三项传承。' });
        return current;
      }
      return [...current, id];
    });
  };

  const confirm = () => {
    const heritageItems: HeritageItem[] = selectedItems.map(({ reason: _reason, ...item }) => item);
    addHeritageItems(heritageItems);
    addHallRecord({ ...settlementResult.hallRecord, carriedOut: heritageItems });
    setSettlementResult(null);
    setSelectedIds([]);
    reset();
    toast.success('轮回结算已归档', {
      description: heritageItems.length ? `已收入传承池：${heritageItems.map((item) => item.name).join('、')}` : '未选择带出物，仅留名模拟殿堂。',
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) confirm(); }}>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            {settlementResult.title}
          </DialogTitle>
          <DialogDescription className="leading-relaxed font-serif-cn">
            {settlementResult.summary}
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
              结算只允许带出旧物、命格、灵宠、法宝、体质等因缘；修为不会成为奖励。
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-serif-cn font-semibold">可带出传承</div>
            <div className="text-xs text-muted-foreground">{selectedIds.length}/3</div>
          </div>
          {options.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              此世因缘尚浅，未凝出可带走之物。入殿留名，来世再问天命。
            </div>
          ) : (
            options.map((option) => {
              const checked = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className="w-full text-left rounded-lg border bg-card/70 p-3 transition hover:bg-muted/40"
                >
                  <div className="flex gap-3">
                    <Checkbox checked={checked} className="mt-1" />
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
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button onClick={confirm} className="w-full font-serif-cn tracking-wider">
            <Sparkles className="w-4 h-4 mr-2" />
            归入轮回，开启下一世
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
