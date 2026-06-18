'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RotateCcw, ScrollText, Info, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { AIConfigDialog } from '@/components/xianxia/AIConfigDialog';

export function GameMenu() {
  const { character, events, choices, reset } = useGameStore();
  const [resetOpen, setResetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);


  const handleReset = () => {
    reset();
    setResetOpen(false);
    toast('已放弃模拟', { description: '主动放弃不会获得本次模拟结算奖励。' });
  };

  const totalEvents = events.length;
  const totalChoices = choices.length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-border/50 bg-card/60 hover:bg-accent/10 hover:border-accent/40 transition-colors text-foreground/80"
            aria-label="设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {character && (
            <DropdownMenuItem
              onClick={() => setAboutOpen(true)}
              className="text-xs cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 mr-2" />
              <span>本局概况</span>
            </DropdownMenuItem>
          )}
          <AIConfigDialog variant="menu" />
          {character && <DropdownMenuSeparator />}
          {character && (
            <DropdownMenuItem
              onClick={() => setResetOpen(true)}
              className="text-xs cursor-pointer text-destructive focus:text-destructive"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-2" />
              <span>放弃模拟</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 放弃模拟确认 */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="max-w-[300px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-cn text-base">放弃模拟？</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              放弃后会回到首页，本次模拟不会进入结算，也不会获得可带入下一世的选项。确定要舍弃此世因果吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">再思片刻</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              确认放弃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 本局概况 */}
      {character && <AlertDialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <AlertDialogContent className="max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-cn text-base flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              本局概况
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs space-y-1.5 pt-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">道号</span>
                  <span className="text-foreground font-serif-cn">{character.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">灵根</span>
                  <span className="text-foreground">{character.rootDetail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">境界</span>
                  <span className="text-foreground" style={{ color: character.realmColor }}>
                    {character.realmName}
                    {character.realmMaxLevel > 0 ? ` ${character.realmLevel + 1}层` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">年岁</span>
                  <span className="text-foreground">{character.age} / {character.lifespan} 岁</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">命节点</span>
                  <span className="text-foreground">{character.fateNodes.length} / 8 已过</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">流年记事</span>
                  <span className="text-foreground">{totalEvents} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">抉择次数</span>
                  <span className="text-foreground">{totalChoices} 次</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">所在</span>
                  <span className="text-foreground">{character.location || '—'}</span>
                </div>
                {character.faction && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">宗门</span>
                    <span className="text-foreground">{character.faction}</span>
                  </div>
                )}
                {character.master && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">师承</span>
                    <span className="text-foreground">{character.master}</span>
                  </div>
                )}
                {!character.alive && (
                  <div className="pt-1 mt-1 border-t border-border/50 text-destructive">
                    已陨落 · {character.causeOfDeath || '天道无常'}
                  </div>
                )}
                {character.ascended && (
                  <div className="pt-1 mt-1 border-t border-border/50 text-yellow-600">
                    已飞升仙界 · 与天地同寿
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="h-8 text-xs">了悟</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </>
  );
}
