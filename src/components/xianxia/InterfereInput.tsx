'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Zap, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';

const INTERFERE_COOLDOWN = 10; // \u5341\u8f7d\u4e00\u6b21

export function InterfereInput() {
  const { character, setLoading, setError, setCharacter, addEvent, setLastInterfere, lastInterfereAge, setLastInterfereAge } = useGameStore();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (!character || !character.alive) return null;

  const remaining = lastInterfereAge != null
    ? Math.max(0, INTERFERE_COOLDOWN - (character.age - lastInterfereAge))
    : 0;
  const onCooldown = remaining > 0;

  const submit = async () => {
    if (!value.trim() || busy || onCooldown) return;
    const ageAtInterfere = character.age;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      await ensureAIConfigured();
      const res = await fetch('/api/game/interfere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, input: value.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '\u5e72\u9884\u5931\u8d25');

      // \u66f4\u65b0\u89d2\u8272
      setCharacter({ ...character, ...data.state });
      setLastInterfere({
        classification: data.classification,
        accepted: data.accepted,
        narrative: data.narrative,
      });

      // \u4ec5\u5728\u5929\u9053\u63a5\u7eb3\u5e72\u9884\u65f6\u8d77\u51b7\u5374\uff08\u8d8a\u754c/\u64cd\u7eb5\u88ab\u62d2\u4e0d\u6d88\u8017\u5341\u8f7d\uff09
      if (data.accepted) {
        setLastInterfereAge(ageAtInterfere);
      }

      // \u8bb0\u5f55\u4e8b\u4ef6
      addEvent({
        id: `interfere-${Date.now()}`,
        age: data.state.age,
        title: data.accepted ? '\u5929\u673a\u00b7\u5e72\u9884\u663e\u73b0' : '\u5929\u673a\u00b7\u4e16\u754c\u5982\u5e38',
        narrative: data.narrative,
        eventType: 'interference',
        effects: data.accepted ? data.changes : [],
        createdAt: new Date().toISOString(),
      });

      // \u63d0\u793a
      const clsLabel: Record<string, string> = {
        action: '\u884c\u52a8', dialogue: '\u5bf9\u8bdd', overreach: '\u8d8a\u754c', rule_manipulation: '\u64cd\u7eb5',
      };
      if (data.accepted) {
        toast.success(`\u5e72\u9884\u663e\u73b0 \u00b7 ${clsLabel[data.classification] || data.classification}`, {
          description: data.narrative.slice(0, 60) + '...',
        });
      } else {
        toast(`\u5929\u9053\u62d2\u7edd \u00b7 ${clsLabel[data.classification] || data.classification}`, {
          description: '\u53ef\u6362\u4e00\u79cd\u65b9\u5f0f\u518d\u8bd5',
        });
      }

      if (data.died) {
        toast.error('\u89d2\u8272\u8eab\u9668', { description: data.deathReason });
      }

      setValue('');
    } catch (err: any) {
      setError(err.message);
      toast.error('\u5e72\u9884\u5931\u8d25', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div className="relative border-t border-border/60 bg-card/95 backdrop-blur px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 shrink-0">
          {onCooldown ? (
            <Hourglass className="w-3.5 h-3.5 text-muted-foreground/70" />
          ) : (
            <Zap className={cn('w-3.5 h-3.5', busy ? 'text-primary animate-pulse' : 'text-muted-foreground')} />
          )}
          <span className="text-[10px] text-muted-foreground font-serif-cn">{'\u5e72\u9884\u6a21\u62df'}</span>
        </div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={onCooldown ? `\u5929\u673a\u521a\u88ab\u6270\u52a8\uff0c\u9700\u9759\u5f85${remaining}\u8f7d\u65b9\u53ef\u518d\u884c\u5e72\u9884\u2026` : '\u8f93\u5165\u884c\u52a8/\u5bf9\u8bdd/\u613f\u671b\u2026'}
          disabled={busy || onCooldown}
          className="text-xs h-9 bg-background/60 border-border/60"
          maxLength={200}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={busy || onCooldown || !value.trim()}
          className="h-9 px-3 bg-primary hover:bg-primary/90 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
      {busy && (
        <div className="pointer-events-none absolute left-1/2 -top-2 z-20 -translate-x-1/2 -translate-y-full flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-[11px] font-serif-cn text-primary shadow-lg backdrop-blur animate-pulse">
          <Zap className="w-3 h-3 animate-pulse" />
          {'\u5929\u9053\u6743\u8861\u4e2d\u2026'}
        </div>
      )}
      {!busy && onCooldown && (
        <div className="text-[10px] text-muted-foreground/80 mt-1 px-1 font-serif-cn">
          {`\u4e00\u8650\u5929\u673a\uff0c\u987b\u9759\u5019\u5341\u8f7d\u65b9\u80fd\u518d\u6b21\u5e72\u9884\uff08\u8fd8\u9700 ${remaining} \u8f7d\uff09`}
        </div>
      )}
    </div>
  );
}
