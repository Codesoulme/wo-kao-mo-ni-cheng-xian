'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Mountain, Feather } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function StartScreen() {
  const { setCharacter, addEvent, setFateNodes, setLoading } = useGameStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setLoading(true);
    try {
      const res = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '开启失败');

      // 拉取完整状态
      const stateRes = await fetch(`/api/game/state?characterId=${data.characterId}`);
      const stateData = await stateRes.json();
      if (!stateData.success) throw new Error('初始化状态失败');

      setCharacter(stateData.character);
      setFateNodes(stateData.fateNodes);
      addEvent({
        id: `birth-${Date.now()}`,
        age: 0,
        title: '降生于世',
        narrative: data.birth.background,
        eventType: 'normal',
        effects: [],
        createdAt: new Date().toISOString(),
      });

      toast.success('道途初启', {
        description: `${data.birth.name} · ${data.birth.rootDetail}`,
      });
    } catch (err: any) {
      toast.error('开启失败', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-8">
      {/* 标题 */}
      <div className="text-center mb-8 scroll-reveal">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Mountain className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-serif-cn text-4xl font-bold mb-2 tracking-wider">
          修仙模拟器
        </h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          <span className="text-sm font-serif-cn">我要修真</span>
          <span className="h-px w-8 bg-border" />
        </div>
        <p className="text-xs text-muted-foreground mt-4 max-w-xs mx-auto leading-relaxed">
          天道执笔，演绎修真之路。每岁一事，命节点抉择，天地因果自相循。
        </p>
      </div>

      {/* 开始卡片 */}
      <Card className="w-full max-w-sm paper-texture border-border/60 scroll-reveal" style={{ animationDelay: '0.1s' }}>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Feather className="w-3 h-3" />
              道号（留空则由天道赐名）
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：李青云"
              maxLength={12}
              className="bg-background/60 font-serif-cn"
              onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
            />
          </div>
          <Button
            onClick={start}
            disabled={busy}
            className={cn(
              "w-full h-11 font-serif-cn text-base tracking-widest",
              "bg-primary hover:bg-primary/90"
            )}
          >
            {busy ? (
              <><Sparkles className="w-4 h-4 mr-2 animate-spin" />天道降生...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />入道开局</>
            )}
          </Button>
          <div className="text-[10px] text-muted-foreground text-center leading-relaxed">
            灵根随机 · 命运无常 · 天道不佑
          </div>
        </CardContent>
      </Card>

      {/* 特色 */}
      <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm w-full scroll-reveal" style={{ animationDelay: '0.2s' }}>
        {[
          { icon: '🎯', title: '命节点', desc: '八大关口' },
          { icon: '⚡', title: '干扰模拟', desc: '随时介入' },
          { icon: '📜', title: '天道叙事', desc: 'AI 演绎' },
        ].map((f, i) => (
          <div key={i} className="text-center p-2 rounded-lg border border-border/40 bg-card/50">
            <div className="text-lg mb-1">{f.icon}</div>
            <div className="text-[11px] font-semibold font-serif-cn">{f.title}</div>
            <div className="text-[9px] text-muted-foreground">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
