'use client';

import { useMemo, useState } from 'react';
import { useGameStore, type HeritageCategory, type HeritageItem } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SlidersHorizontal } from 'lucide-react';

const CATEGORY_LABEL: Record<HeritageCategory, string> = {
  scripture: '功法',
  fate: '命格',
  pet: '灵宠',
  artifact: '法宝',
  constitution: '体质',
  treasure: '奇物',
};

const CATEGORY_ORDER: HeritageCategory[] = ['scripture', 'fate', 'pet', 'artifact', 'constitution', 'treasure'];

const RARITY_LABEL: Record<string, string> = {
  common: '凡品',
  uncommon: '良品',
  rare: '珍稀',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

function isSelected(item: HeritageItem, selected: HeritageItem[]) {
  return selected.some((it) => it.id === item.id);
}

export function CustomSimulationDialog() {
  const { heritageVault, selectedHeritage, toggleSelectedHeritage, clearSelectedHeritage } = useGameStore();
  const [open, setOpen] = useState(false);
  const activeCategory = CATEGORY_ORDER.find((category) => heritageVault.some((item) => item.category === category)) || 'scripture';
  const selectedCount = Object.values(selectedHeritage).reduce((sum, items) => sum + (items?.length || 0), 0);

  const grouped = useMemo(() => {
    const map: Record<HeritageCategory, HeritageItem[]> = {
      scripture: [], fate: [], pet: [], artifact: [], constitution: [], treasure: [],
    };
    heritageVault.forEach((item) => map[item.category]?.push(item));
    return map;
  }, [heritageVault]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 font-serif-cn border-primary/30 text-primary hover:bg-primary/10">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          定制模拟
          {selectedCount > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{selectedCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn">定制下一世</DialogTitle>
          <DialogDescription className="font-serif-cn leading-relaxed">
            从传承池中挑选旧缘，下一次新开局会将这些因缘交给后端。它们只是开局伏笔，不直接给予修为。
          </DialogDescription>
        </DialogHeader>

        {heritageVault.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground leading-relaxed">
            传承池尚空。待一位角色死亡或飞升后完成轮回结算，旧物与因缘便会沉入此池。
          </div>
        ) : (
          <Tabs defaultValue={activeCategory} className="w-full">
            <TabsList className="grid grid-cols-3 h-auto gap-1 bg-muted/30 p-1">
              {CATEGORY_ORDER.map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs font-serif-cn">
                  {CATEGORY_LABEL[category]} {grouped[category].length || ''}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORY_ORDER.map((category) => {
              const selected = selectedHeritage[category] || [];
              return (
                <TabsContent key={category} value={category} className="mt-3 space-y-2">
                  {grouped[category].length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      暂无{CATEGORY_LABEL[category]}类传承。
                    </div>
                  ) : grouped[category].map((item) => {
                    const checked = isSelected(item, selected);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelectedHeritage(item)}
                        className="w-full rounded-lg border bg-card/70 p-3 text-left transition hover:bg-muted/40"
                      >
                        <div className="flex gap-3">
                          <Checkbox checked={checked} className="mt-1" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-serif-cn text-sm font-semibold truncate">{item.name}</span>
                              <Badge variant="outline" className="text-[10px]">{RARITY_LABEL[item.rarity] || item.rarity}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground/80">源自：{item.source}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        <Card className="border-primary/15 bg-primary/5">
          <CardContent className="pt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground leading-relaxed">
              已选 <span className="font-semibold text-primary">{selectedCount}</span> 项。再次点击可取消。
            </div>
            <Button size="sm" variant="ghost" onClick={clearSelectedHeritage} disabled={selectedCount === 0}>
              清空
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
