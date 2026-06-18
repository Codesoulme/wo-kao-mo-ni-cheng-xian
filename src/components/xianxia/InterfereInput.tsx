'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function InterfereInput() {
  const { character, setLoading, setError, setCharacter, addEvent, setLastInterfere } = useGameStore();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (!character || !character.alive) return null;

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/interfere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, input: value.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '干扰失败');

      // 更新角色
      setCharacter({ ...character, ...data.state });
      setLastInterfere({
        classification: data.classification,
        accepted: data.accepted,
        narrative: data.narrative,
      });

      // 添加事件
      addEvent({
        id: `interfere-${Date.now()}`,
        age: data.state.age,
        title: data.accepted ? '干扰·天道回响' : '干扰·世界如常',
        narrative: data.narrative,
        eventType: 'interference',
        effects: data.accepted ? data.changes : [],
        createdAt: new Date().toISOString(),
      });

      // 提示
      const clsLabel: Record<string, string> = {
        action: '行动', dialogue: '对话', overreach: '越界', rule_manipulation: '操纵',
      };
      if (data.accepted) {
        toast.success(`天道回响 · ${clsLabel[data.classification] || data.classification}`, {
          description: data.narrative.slice(0, 60) + '...',
        });
      } else {
        toast(`静默拒绝 · ${clsLabel[data.classification] || data.classification}`, {
          description: '世界自按其轨运行',
        });
      }

      if (data.died) {
        toast.error('角色已陨落', { description: data.deathReason });
      }

      setValue('');
    } catch (err: any) {
      setError(err.message);
      toast.error('干扰失败', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border/60 bg-card/95 backdrop-blur px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 shrink-0">
          <Zap className={cn("w-3.5 h-3.5", busy ? "text-primary animate-pulse" : "text-muted-foreground")} />
          <span className="text-[10px] text-muted-foreground font-serif-cn">干扰模拟</span>
        </div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="输入行动/对话/愿求..."
          disabled={busy}
          className="text-xs h-9 bg-background/60 border-border/60"
          maxLength={200}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={busy || !value.trim()}
          className="h-9 px-3 bg-primary hover:bg-primary/90 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      {busy && (
        <div className="text-[10px] text-muted-foreground mt-1 px-1 animate-pulse">
          天道权衡中...
        </div>
      )}
    </div>
  );
}
