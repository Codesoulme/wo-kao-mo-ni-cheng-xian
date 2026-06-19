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
          {'\u4f20\u627f\u6c60'}
          {selectedCount > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{selectedCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn">{'\u4f20\u627f\u6c60'}</DialogTitle>
          <DialogDescription className="font-serif-cn leading-relaxed">
            {'\u6b64\u5904\u6c89\u6dc0\u524d\u4e16\u4f59\u54cd\u3001\u65e7\u7f18\u9057\u7269\u4e0e\u672a\u5c3d\u56e0\u679c\u3002\u5165\u4e16\u4e4b\u524d\uff0c\u53ef\u62e9\u5176\u4e00\u4e8c\u968f\u8eab\u800c\u884c\uff1b\u5b83\u4eec\u53ea\u662f\u56e0\u7f18\u7275\u5f15\uff0c\u4e0d\u4fdd\u8bc1\u6b64\u4e16\u987a\u9042\u3002'}
          </DialogDescription>
        </DialogHeader>

        {heritageVault.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground leading-relaxed">
            {'\u4f20\u627f\u6c60\u5c1a\u7a7a\u3002\u5f85\u4e00\u4e16\u5c18\u7f18\u843d\u5b9a\uff0c\u53ef\u627f\u4e4b\u7269\u81ea\u4f1a\u5f52\u5165\u6b64\u5904\u3002'}
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
                      {'\u6b64\u7c7b\u6682\u65e0\u53ef\u627f\u4e4b\u7269\u3002'}
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
                            <p className="text-[10px] text-muted-foreground/80">{'\u6765\u6e90\uff1a'}{item.source}</p>
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
              {'\u5df2\u62e9'} <span className="font-semibold text-primary">{selectedCount}</span> {'\u4ef6\u4f20\u627f\u3002\u518d\u70b9\u4e00\u6b21\u53ef\u653e\u56de\u6c60\u4e2d\u3002'}
            </div>
            <Button size="sm" variant="ghost" onClick={clearSelectedHeritage} disabled={selectedCount === 0}>
              {'\u4e00\u5e76\u653e\u56de'}
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
