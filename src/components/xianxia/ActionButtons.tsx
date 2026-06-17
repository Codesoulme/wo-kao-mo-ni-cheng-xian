'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Play, SkipForward, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ActionButtons() {
  const {
    character, pendingChoice, loading,
    setCharacter, addEvent, setPendingChoice,
    setLastChange, setLastBreakthrough, setLoading, setError,
    reset,
  } = useGameStore();

  if (!character) return null;

  const isDead = !character.alive;
  const isAscended = character.ascended;
  const atChoice = !!pendingChoice;

  const advance = async () => {
    if (loading || atChoice || isDead || isAscended) return;
    setLoading(true);
    setError(null);
    setLastChange(null);
    setLastBreakthrough(null);
    try {
      const res = await fetch('/api/game/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '推进失败');

      // 更新角色
      setCharacter({ ...character, ...data.state });
      setLastChange(data.changes || null);
      if (data.breakthrough) setLastBreakthrough(data.breakthrough);

      // 添加事件
      addEvent({
        id: `event-${Date.now()}`,
        age: data.event.age,
        title: data.event.title,
        narrative: data.event.narrative,
        eventType: data.event.eventType,
        effects: data.changes || [],
        isFateNode: data.isFateNode,
        fateNodeName: data.fateNodeName,
        createdAt: new Date().toISOString(),
      });

      // 设置待选择
      if (data.hasChoice && data.choice) {
        setPendingChoice(data.choice);
        toast('命节点触发', { description: '请做出你的抉择' });
      }

      if (data.breakthrough) {
        toast.success('境界突破！', { description: `踏入新境界` });
      }
      if (data.died) {
        toast.error('角色陨落', { description: data.deathReason });
      }
      if (data.ascended) {
        toast.success('飞升仙界！', { description: '超脱凡俗，与天地同寿' });
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('推进失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    if (!confirm('确定要重新开始吗？当前角色将被放弃。')) return;
    reset();
    toast('已重置，可重新开始');
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={advance}
        disabled={loading || atChoice || isDead || isAscended}
        className={cn(
          "flex-1 h-10 font-serif-cn tracking-wider",
          isDead || isAscended
            ? "bg-muted text-muted-foreground"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />天道演算...</>
        ) : isDead ? (
          <><RotateCcw className="w-4 h-4 mr-2" />已陨落</>
        ) : isAscended ? (
          <><Play className="w-4 h-4 mr-2" />已飞升</>
        ) : atChoice ? (
          <><SkipForward className="w-4 h-4 mr-2" />待抉择</>
        ) : (
          <><SkipForward className="w-4 h-4 mr-2" />岁月流转一载</>
        )}
      </Button>
      {(isDead || isAscended) && (
        <Button
          onClick={restart}
          variant="outline"
          className="h-10 px-3"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
