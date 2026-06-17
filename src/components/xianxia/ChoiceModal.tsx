'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mountain, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ChoiceModal() {
  const {
    character, pendingChoice, setPendingChoice, setLoading, setError,
    setCharacter, addEvent, addChoice, setLastChange,
  } = useGameStore();
  const [busy, setBusy] = useState(false);

  if (!character || !pendingChoice) return null;

  const choose = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          chosenIndex: idx,
          choicePrompt: pendingChoice.prompt,
          options: pendingChoice.options,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '选择失败');

      setCharacter({ ...character, ...data.state });
      setPendingChoice(null);
      setLastChange(data.changes || null);

      // 记录选择
      addChoice({
        id: `choice-${Date.now()}`,
        age: data.state.age,
        prompt: pendingChoice.prompt,
        options: pendingChoice.options,
        chosenIndex: idx,
        chosenText: pendingChoice.options[idx]?.text || '',
        result: data.narrative,
        createdAt: new Date().toISOString(),
      });

      addEvent({
        id: `choice-${Date.now()}`,
        age: data.state.age,
        title: '抉择之后',
        narrative: data.narrative,
        eventType: 'choice',
        effects: data.changes || [],
        createdAt: new Date().toISOString(),
      });

      if (data.died) {
        toast.error('角色陨落', { description: data.deathReason });
      } else if (data.newStatuses?.length) {
        toast.success(`获得新状态：${data.newStatuses.map((s: any) => s.name).join('、')}`);
      }
      if (data.newItems?.length) {
        toast.success(`获得物品：${data.newItems.map((i: any) => i.name).join('、')}`);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('选择失败', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md paper-texture border-primary/40 shadow-2xl scroll-reveal">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn">
            <Mountain className="w-4 h-4 text-primary" />
            天道抉择
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90 font-serif-cn whitespace-pre-wrap">
            {pendingChoice.prompt}
          </p>
          <div className="space-y-2">
            {pendingChoice.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={busy}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  "hover:border-primary hover:bg-primary/5",
                  "border-border bg-card/60",
                  busy && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="seal shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold font-serif-cn">{opt.text}</div>
                    {opt.hint && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {busy && (
            <div className="text-center text-xs text-muted-foreground animate-pulse pt-1">
              <Sparkles className="w-3 h-3 inline mr-1" />
              因果流转中...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
