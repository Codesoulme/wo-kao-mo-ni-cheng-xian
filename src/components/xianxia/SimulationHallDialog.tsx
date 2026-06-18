'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Landmark } from 'lucide-react';

export function SimulationHallDialog() {
  const { hallOfSimulations } = useGameStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 font-serif-cn border-amber-500/30 text-amber-700 hover:bg-amber-500/10">
          <Landmark className="w-4 h-4 mr-2" />
          模拟殿堂
          {hallOfSimulations.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{hallOfSimulations.length}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn">模拟殿堂</DialogTitle>
          <DialogDescription className="font-serif-cn leading-relaxed">
            此处供奉历次轮回的名字、境界与带出的旧缘。重开不会抹去殿堂记录。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hallOfSimulations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground leading-relaxed">
              殿堂尚空。待一世落幕，第一盏魂灯便会在此点亮。
            </div>
          ) : (
            hallOfSimulations.map((record) => (
              <Card key={record.id} className="bg-card/70">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-serif-cn font-semibold text-base">{record.characterName}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.gender || '未知'} · {record.age}岁 · {record.highestRealm}
                      </div>
                    </div>
                    <Badge variant={record.ending === 'ascension' ? 'default' : 'secondary'} className="font-serif-cn">
                      {record.evaluationTitle}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">突出战绩</div>
                    <div className="flex flex-wrap gap-1.5">
                      {record.notableDeeds.map((deed, index) => (
                        <span key={`${record.id}-deed-${index}`} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px]">
                          {deed}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">带出物</div>
                    {record.carriedOut.length === 0 ? (
                      <div className="text-xs text-muted-foreground/80">未带出传承，仅留魂灯一盏。</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {record.carriedOut.map((item) => (
                          <span key={item.id} className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
