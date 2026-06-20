'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Mountain, Feather, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AIConfigDialog } from '@/components/xianxia/AIConfigDialog';
import { CustomSimulationDialog } from '@/components/xianxia/CustomSimulationDialog';
import { SimulationHallDialog } from '@/components/xianxia/SimulationHallDialog';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';

export function StartScreen() {
  const { setCharacter, setEvents, setChoices, setFateNodes, setPendingChoice, setLoading, selectedHeritage } = useGameStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [latestSave, setLatestSave] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/game/latest');
        const data = await res.json();
        if (!cancelled && data.success && data.hasSave) setLatestSave(data.character);
      } catch {
        // If the old path cannot be read, simply hide the continuation entrance.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const continueLatest = async () => {
    if (busy || !latestSave?.id) return;
    setBusy(true);
    setLoading(true);
    try {
      const stateRes = await fetch(`/api/game/state?characterId=${latestSave.id}`);
      const stateData = await stateRes.json();
      if (!stateData.success) throw new Error(stateData.error || '\u65e7\u9014\u5df2\u4e0d\u53ef\u5bfb');
      setCharacter(stateData.character);
      setFateNodes(stateData.fateNodes);
      setEvents(stateData.events || []);
      setChoices(stateData.choices || []);
      setPendingChoice(stateData.pendingChoice && stateData.character?.isAtChoice ? stateData.pendingChoice : null);
      toast.success('\u65e7\u9014\u5df2\u7eed', { description: `${stateData.character.name} \u00b7 ${stateData.character.age}\u5c81` });
    } catch (err: any) {
      toast.error('\u5bfb\u56de\u65e7\u9014\u5931\u8d25', { description: err.message });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setLoading(true);
    try {
      await ensureAIConfigured();

      const heritage = Object.values(selectedHeritage).flat();
      const res = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, heritage }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '开启失败');

      // 拉取完整状态
      const stateRes = await fetch(`/api/game/state?characterId=${data.characterId}`);
      const stateData = await stateRes.json();
      if (!stateData.success) throw new Error('初始化状态失败');

      setCharacter(stateData.character);
      setFateNodes(stateData.fateNodes);
      setEvents(stateData.events || []);
      setChoices(stateData.choices || []);

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
    <div className="flex-1 overflow-y-auto xianxia-scroll flex flex-col items-center justify-center min-h-full px-6 py-8">
      {/* 标题 */}
      <div className="text-center mb-8 scroll-reveal">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Mountain className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-serif-cn text-4xl font-bold mb-2 tracking-wider">
          {'\u6211\u9760\u6a21\u62df\u6210\u4ed9'}
        </h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          <span className="text-sm font-serif-cn">{'\u4e00\u5ff5\u5165\u4e16\uff0c\u767e\u5e74\u6c42\u4ed9'}</span>
          <span className="h-px w-8 bg-border" />
        </div>
        <p className="text-xs text-muted-foreground mt-4 max-w-xs mx-auto leading-relaxed">
          {'\u4ece\u51e1\u5c18\u8d77\u6b65\uff0c\u5728\u5c81\u6708\u3001\u56e0\u679c\u4e0e\u6289\u62e9\u4e2d\u8d70\u51fa\u81ea\u5df1\u7684\u4fee\u4ed9\u8def\u3002\u6b64\u4e16\u65e0\u5b9a\uff0c\u552f\u89c1\u771f\u5fc3\u3002'}
        </p>
      </div>

      {/* 开始卡片 */}
      <Card className="w-full max-w-sm paper-texture border-border/60 scroll-reveal" style={{ animationDelay: '0.1s' }}>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Feather className="w-3 h-3" />
              {'\u9053\u53f7\uff08\u53ef\u7559\u7a7a\uff0c\u7531\u5929\u547d\u81ea\u5b9a\uff09'}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={'\u4f8b\u5982\uff1a\u9752\u7384'}
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
              <><Sparkles className="w-4 h-4 mr-2 animate-spin" />{'\u63a8\u884d\u547d\u9014...'}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />{'\u8e0f\u5165\u6b64\u4e16'}</>
            )}
          </Button>
          {latestSave && (
            <Button
              onClick={continueLatest}
              disabled={busy}
              variant="outline"
              className="w-full h-10 font-serif-cn tracking-wider"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {'\u7eed\u5165\u65e7\u9014'}
              <span className="ml-2 text-[10px] text-muted-foreground font-normal truncate">
                {latestSave.name} {'\u00b7'} {latestSave.age}{'\u5c81'}
              </span>
            </Button>
          )}
          <div className="text-[10px] text-muted-foreground text-center leading-relaxed">
            {'\u5929\u673a\u63a8\u884d \u00b7 \u56e0\u679c\u7eed\u5199 \u00b7 \u6b64\u4e16\u65e0\u5e38'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CustomSimulationDialog />
            <SimulationHallDialog />
          </div>
          <AIConfigDialog variant="start" />
        </CardContent>
      </Card>
    </div>
  );
}
