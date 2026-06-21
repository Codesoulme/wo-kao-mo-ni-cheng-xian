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
import { SlidersHorizontal, X } from 'lucide-react';

const CATEGORY_LABEL: Record<HeritageCategory, string> = {
  scripture: '\u529f\u6cd5',
  fate: '\u547d\u683c',
  pet: '\u7075\u5ba0',
  artifact: '\u6cd5\u5b9d',
  constitution: '\u4f53\u8d28',
  treasure: '\u5947\u7269',
};

const CATEGORY_ORDER: HeritageCategory[] = ['scripture', 'fate', 'pet', 'artifact', 'constitution', 'treasure'];

const RARITY_LABEL: Record<string, string> = {
  common: '\u51e1\u54c1',
  uncommon: '\u826f\u54c1',
  rare: '\u73cd\u7a00',
  epic: '\u53f2\u8bd7',
  legendary: '\u4f20\u8bf4',
  mythic: '\u795e\u8bdd',
};

type FilterKey = 'all' | HeritageCategory;

export function CustomSimulationDialog() {
  const { heritageVault, selectedHeritage, toggleSelectedHeritage, clearSelectedHeritage } = useGameStore();
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const selectedItems = useMemo(
    () => Object.values(selectedHeritage).flat().filter(Boolean) as HeritageItem[],
    [selectedHeritage],
  );
  const selectedCount = selectedItems.length;
  const selectedIds = useMemo(() => new Set(selectedItems.map((it) => it.id)), [selectedItems]);

  // \u8d8a\u665a\u83b7\u5f97\u7684\u4f20\u627f\u6392\u5728\u8d8a\u524d\uff08vault \u6309\u83b7\u5f97\u987a\u5e8f\u8ffd\u52a0\uff0c\u6700\u65b0\u5728\u672b\u5c3e\uff09
  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    heritageVault.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [heritageVault]);

  const categoryCounts = useMemo(() => {
    const map: Record<HeritageCategory, number> = {
      scripture: 0, fate: 0, pet: 0, artifact: 0, constitution: 0, treasure: 0,
    };
    heritageVault.forEach((item) => { if (map[item.category] != null) map[item.category] += 1; });
    return map;
  }, [heritageVault]);

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: '\u5168\u90e8', count: heritageVault.length },
    ...CATEGORY_ORDER
      .filter((category) => categoryCounts[category] > 0)
      .map((category) => ({ key: category as FilterKey, label: CATEGORY_LABEL[category], count: categoryCounts[category] })),
  ];

  const visibleItems = useMemo(() => {
    const pool = activeFilter === 'all'
      ? heritageVault
      : heritageVault.filter((item) => item.category === activeFilter);
    return pool.slice().sort((a, b) => (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0));
  }, [activeFilter, heritageVault, orderIndex]);

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
          <div className="space-y-3">
            <div className="flex flex-wrap justify-start gap-1.5">
              {filters.map((filter) => {
                const active = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-serif-cn transition ${
                      active
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className="text-[10px] tabular-nums opacity-70">{filter.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {visibleItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {'\u6b64\u7c7b\u6682\u65e0\u53ef\u627f\u4e4b\u7269\u3002'}
                </div>
              ) : visibleItems.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelectedHeritage(item)}
                    className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${
                      checked ? 'border-primary/50 bg-primary/5' : 'bg-card/70'
                    }`}
                  >
                    <div className="flex gap-3">
                      <Checkbox checked={checked} className="mt-1" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif-cn text-sm font-semibold truncate">{item.name}</span>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{CATEGORY_LABEL[item.category]}</Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0">{RARITY_LABEL[item.rarity] || item.rarity}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground/80">{'\u6765\u6e90\uff1a'}{item.source}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Card className="border-primary/15 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground leading-relaxed">
                {'\u5df2\u62e9'} <span className="font-semibold text-primary">{selectedCount}</span> {'\u4ef6\u4f20\u627f\u3002\u70b9\u9009\u4e0b\u65b9\u53ef\u653e\u56de\u6c60\u4e2d\u3002'}
              </div>
              <Button size="sm" variant="ghost" onClick={clearSelectedHeritage} disabled={selectedCount === 0}>
                {'\u4e00\u5e76\u653e\u56de'}
              </Button>
            </div>
            {selectedCount === 0 ? (
              <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
                {'\u5c1a\u672a\u62e9\u53d6\u4f20\u627f\u3002\u4ece\u4e0a\u65b9\u70b9\u9009\u5373\u53ef\u643a\u5165\u6b64\u4e16\u3002'}
              </div>
            ) : (
              <div className="flex flex-wrap justify-start gap-1.5">
                {selectedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelectedHeritage(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-serif-cn text-primary transition hover:bg-primary/20"
                    title={'\u70b9\u51fb\u653e\u56de\u4f20\u627f\u6c60'}
                  >
                    <span className="max-w-[10rem] truncate">{item.name}</span>
                    <X className="w-3 h-3 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
