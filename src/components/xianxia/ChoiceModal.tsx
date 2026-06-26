'use client';

import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mountain, Sparkles, BookOpen, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';
import { AIConfigDialog } from '@/components/xianxia/AIConfigDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ChoiceModal() {
  const {
    character, pendingChoice, setPendingChoice, setLoading, setError,
    setCharacter, addEvent, addChoice, setLastChange,
  } = useGameStore();
  const [busy, setBusy] = useState(false);
  const [aiConfigPromptOpen, setAiConfigPromptOpen] = useState(false);
  // 前情提要默认展开；用户可手动折叠以聚焦选项
  const [contextCollapsed, setContextCollapsed] = useState(false);

  if (!character || !pendingChoice) return null;

  const hasContext = !!(pendingChoice.contextNarrative || pendingChoice.contextTitle);

  const choose = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    setLoading(true);
    setError(null);
    try {
      await ensureAIConfigured();
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
      setPendingChoice(data.pendingChoice || null);
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
      if (String(err.message || '').includes('请先配置 AI 接口')) {
        setAiConfigPromptOpen(true);
      } else {
        toast.error('选择失败', { description: err.message });
      }
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md min-w-0 paper-texture border-primary/40 shadow-2xl scroll-reveal flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        <CardHeader className="pb-2 shrink-0">
          <CardTitle className="text-base flex items-center gap-2 font-serif-cn min-w-0 xianxia-readable">
            <Mountain className="w-4 h-4 text-primary" />
            天道抉择
            {pendingChoice.contextFateNodeName && (
              <span className="seal text-[10px] ml-1">{pendingChoice.contextFateNodeName}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative space-y-3 overflow-y-auto xianxia-scroll flex-1">
          {/* 前情提要：命节点事件叙事 */}
          {hasContext && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
              <button
                onClick={() => setContextCollapsed(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary/10 transition-colors min-w-0"
              >
                <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold font-serif-cn text-primary flex-1 min-w-0 xianxia-readable">
                  前情提要
                  {pendingChoice.contextAge !== undefined && (
                    <span className="text-muted-foreground font-normal ml-1">· {pendingChoice.contextAge}岁</span>
                  )}
                </span>
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0",
                  contextCollapsed ? "" : "rotate-180"
                )} />
              </button>
              {!contextCollapsed && (
                <div className="px-3 pb-3 pt-1 space-y-1.5">
                  {pendingChoice.contextTitle && (
                    <h4 className="text-sm font-bold font-serif-cn text-foreground xianxia-readable">
                      {pendingChoice.contextTitle}
                    </h4>
                  )}
                  {pendingChoice.contextNarrative && (
                    <p className="text-xs leading-relaxed text-foreground/85 font-serif-cn xianxia-prose">
                      {pendingChoice.contextNarrative}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 抉择情境 */}
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <p className="text-sm leading-relaxed text-foreground/90 font-serif-cn xianxia-prose">
              {pendingChoice.prompt}
            </p>
          </div>

          {/* 选项 */}
          <div className="space-y-2">
            {pendingChoice.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={busy}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all min-w-0",
                  "hover:border-primary hover:bg-primary/5 active:scale-[0.99]",
                  "border-border bg-card/60",
                  busy && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="seal shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold font-serif-cn xianxia-readable">{opt.text}</div>
                    {opt.hint && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 xianxia-readable">{opt.hint}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {busy && (
            <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-muted-foreground animate-pulse pointer-events-none">
              <Sparkles className="w-3 h-3 inline mr-1" />
              因果流转中...
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={aiConfigPromptOpen} onOpenChange={setAiConfigPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif-cn">灵桥未通</DialogTitle>
            <DialogDescription>
              天道抉择需借灵桥传讯，方能由天机推演后事。请先设灵桥，置妥后回到此处继续抉择。
            </DialogDescription>
          </DialogHeader>
          <AIConfigDialog variant="start" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
