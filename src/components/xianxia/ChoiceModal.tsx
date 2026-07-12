'use client';

// 天道抉择——内联版。剧情文本框下方紧贴上一条事件出现，不再打断玩家。
// 组件名保留 ChoiceModal 是为了向后兼容 import 路径；实际实现是 ChoiceInline。

import { useGameStore } from '@/lib/xianxia/store';
import { Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatNarrativeForDisplay } from '@/lib/xianxia/narrative-format';
import { toast } from 'sonner';
import { ensureAIConfigured } from '@/lib/xianxia/ai-config-client';
import { humanizeError } from '@/lib/xianxia/error-humanize';
import { AIConfigDialog } from '@/components/xianxia/AIConfigDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FateChoiceCard } from './FateChoiceCard';

export function ChoiceModal() {
  const {
    character, pendingChoice, setPendingChoice, setLoading, setError,
    setCharacter, addEvent, addChoice, setLastChange,
  } = useGameStore();
  const [busy, setBusy] = useState(false);
  const [aiConfigPromptOpen, setAiConfigPromptOpen] = useState(false);

  // hooks 必须在无条件路径上调用，pendingChoice 缺失时的早返放在 hooks 之后
  const formattedPrompt = useMemo(
    () => pendingChoice?.prompt ? formatNarrativeForDisplay(pendingChoice.prompt) : '',
    [pendingChoice?.prompt],
  );

  if (!character || !pendingChoice) return null;

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
      setError(humanizeError(err));
      if (String(err.message || '').includes('请先配置 AI 接口')) {
        setAiConfigPromptOpen(true);
      } else {
        toast.error('选择失败', { description: humanizeError(err) });
      }
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <div data-testid="choice-inline" className="mt-3">
      {/* 沉浸版 Phase-Release: 抉择改成与剧情事件卡片一致的容器（paper-texture 边框）
          宽度 100% 自然被父级容器约束到剧情框同宽 */}
      <div className="paper-texture rounded-xl border border-primary/30 shadow-sm overflow-hidden">
        {/* 抉择标签条 */}
        <div className="px-3 py-2 border-b border-primary/20 bg-primary/5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-serif-cn font-semibold tracking-wider text-primary/90">天道抉择</span>
        </div>

        {/* 情境正文 */}
        <div className="px-3 py-3">
          <p className="text-sm leading-relaxed text-foreground font-serif-cn xianxia-prose">
            {formattedPrompt}
          </p>

          {/* 选项列表——用 FateChoiceCard 呈现（图标 + 大字选项 + 小字 hint） */}
          <FateChoiceCard
            options={pendingChoice.options}
            onChooseIndex={choose}
            busy={busy}
          />
        </div>
      </div>

      {busy && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
          <div className="rounded-lg bg-background/95 border border-primary/40 shadow-2xl px-6 py-3 flex items-center gap-2 text-sm text-foreground backdrop-blur-sm animate-pulse">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-serif-cn">因果流转中...</span>
          </div>
        </div>,
        document.body
      )}

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
