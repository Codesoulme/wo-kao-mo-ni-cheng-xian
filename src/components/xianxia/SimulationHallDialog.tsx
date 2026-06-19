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
          {'\u4ed9\u8def\u6bbf\u5802'}
          {hallOfSimulations.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{hallOfSimulations.length}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[86dvh] overflow-y-auto paper-texture">
        <DialogHeader>
          <DialogTitle className="font-serif-cn">{'\u4ed9\u8def\u6bbf\u5802'}</DialogTitle>
          <DialogDescription className="font-serif-cn leading-relaxed">
            {'\u6b64\u6bbf\u8bb0\u4e0b\u6bcf\u4e00\u6761\u8d70\u5230\u7ec8\u5904\u7684\u4ed9\u8def\u3002\u6709\u4e9b\u6b62\u4e8e\u5c18\u52ab\uff0c\u6709\u4e9b\u7a7f\u8fc7\u957f\u751f\uff1b\u5176\u9057\u54cd\u53ef\u5316\u4f5c\u540e\u4e16\u4f20\u627f\u3002'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {hallOfSimulations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground leading-relaxed">
              {'\u4ed9\u8def\u6bbf\u5802\u5c1a\u65e0\u7559\u540d\u3002\u5f85\u4e00\u4e16\u7ec8\u5c40\u843d\u5b9a\uff0c\u6b64\u5904\u4fbf\u4f1a\u8bb0\u4e0b\u5176\u9053\u9014\u3002'}
            </div>
          ) : (
            hallOfSimulations.map((record) => (
              <Card key={record.id} className="bg-card/70">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-serif-cn font-semibold text-base">{record.characterName}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.gender || '\u672a\u77e5'} {'\u00b7'} {record.age}{'\u5c81'} {'\u00b7'} {record.highestRealm}
                      </div>
                    </div>
                    <Badge variant={record.ending === 'ascension' ? 'default' : 'secondary'} className="font-serif-cn">
                      {record.evaluationTitle}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">{'\u7559\u540d\u4e8b\u8ff9'}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {record.notableDeeds.map((deed, index) => (
                        <span key={`${record.id}-deed-${index}`} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px]">
                          {deed}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">{'\u5e26\u51fa\u4f20\u627f'}</div>
                    {record.carriedOut.length === 0 ? (
                      <div className="text-xs text-muted-foreground/80">{'\u672a\u7559\u4e0b\u53ef\u4f20\u4e4b\u7269\u3002'}</div>
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
