'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mountain, Check } from 'lucide-react';
import { REALMS } from '@/lib/xianxia/types';

interface FateNodesProps {
  onSelect?: () => void;
}

export function FateNodes({ onSelect }: FateNodesProps) {
  const { character, fateNodes } = useGameStore();

  if (!character) return null;

  const completed = new Set(character.fateNodes);
  // 找当前境界索引
  const currentRealmIdx = REALMS.findIndex(r => r.id === character.realm);

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground px-1 mb-2">
        因缘转折 · 主线八大关口
      </div>
      <div className="relative">
        {/* 主线 */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
        <div className="space-y-2">
          {fateNodes.map((node) => {
            const isCompleted = completed.has(node.index);
            const nodeRealmIdx = REALMS.findIndex(r => r.id === node.realm);
            const isCurrent = !isCompleted && nodeRealmIdx <= currentRealmIdx + 1 && character.age >= node.triggerAge.min;
            const isLocked = !isCompleted && nodeRealmIdx > currentRealmIdx + 1;

            return (
              <div key={node.index} className="relative pl-10">
                <div
                  className={cn(
                    "absolute left-[8px] top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10",
                    isCompleted ? "bg-primary border-primary text-primary-foreground" :
                    isCurrent ? "bg-primary/20 border-primary text-primary animate-pulse" :
                    "bg-card border-border text-muted-foreground"
                  )}
                >
                  {isCompleted && <Check className="w-2.5 h-2.5" />}
                  {!isCompleted && !isLocked && (
                    <span className="text-[9px] font-bold">{node.index}</span>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-md border p-2 text-xs",
                    isCompleted ? "border-primary/30 bg-primary/5" :
                    isCurrent ? "border-primary/40 bg-primary/5" :
                    "border-border/40 bg-muted/30 opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold font-serif-cn">{node.index}. {node.name}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {isCompleted ? '已过' : isCurrent ? '当前' : isLocked ? '未启' : '将至'}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {node.theme} · 境界 {REALMS.find(r => r.id === node.realm)?.name || '？'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    触发：{node.triggerAge.min}-{node.triggerAge.max} 岁
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
