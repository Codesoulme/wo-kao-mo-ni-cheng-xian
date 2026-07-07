// AI-67/AI-77: 渡劫 + 心魔场景 UI——内联版
// 显示 9 道雷劫进度 + 心魔选项;所有交互直接调用 useGameStore action
'use client';

import { useState } from 'react';
import type { TribulationSession, TribulationStage, HeartDemonType } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

const HEART_DEMON_LABEL: Record<HeartDemonType, string> = {
  obsession: '执念',
  hatred: '怨恨',
  love: '痴缠',
  fear: '恐惧',
  regret: '悔恨',
};

const STAGE_LABEL: Record<TribulationStage, string> = {
  opening: '初启',
  bolt1: '一雷', bolt2: '二雷', bolt3: '三雷', bolt4: '四雷', bolt5: '五雷',
  bolt6: '六雷', bolt7: '七雷', bolt8: '八雷', bolt9: '九雷',
  passed: '已渡', failed: '已败',
};

export function TribulationModal({
  session,
  onBolt,
  onHeartDemon,
  onEnd,
}: {
  session: TribulationSession;
  onBolt?: (boltNumber: number) => Promise<void> | void;
  onHeartDemon?: (demon: HeartDemonType) => Promise<void> | void;
  onEnd?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const recordTribulationBolt = useGameStore((s) => s.recordTribulationBolt);
  const resolveTribulationHeartDemon = useGameStore((s) => s.resolveTribulationHeartDemon);
  const endTribulation = useGameStore((s) => s.endTribulation);

  const nextBolt = session.boltsCompleted + 1;
  const remainingBolts = 9 - session.boltsCompleted;

  const handleBolt = async () => {
    setBusy(true);
    try {
      const boltNo = Math.min(9, nextBolt);
      recordTribulationBolt(boltNo);
      if (onBolt) await onBolt(boltNo);
    } finally {
      setBusy(false);
    }
  };

  const handleHeartDemon = async () => {
    if (!session.heartDemonActive) return;
    setBusy(true);
    try {
      resolveTribulationHeartDemon(session.heartDemonActive);
      if (onHeartDemon) await onHeartDemon(session.heartDemonActive);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    setBusy(true);
    try {
      endTribulation();
      if (onEnd) await onEnd();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="tribulation-modal" className="mt-3 rounded-lg paper-texture border border-amber-500/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif-cn text-base font-bold text-foreground flex items-center gap-2 xianxia-readable">
          <Zap className="w-4 h-4 text-amber-500" />
          渡劫
        </h3>
        <span className="text-xs text-muted-foreground">当前：{STAGE_LABEL[session.currentStage]}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground font-serif-cn xianxia-prose">{session.narrative}</p>

      <div className="grid grid-cols-9 gap-1" data-testid="tribulation-bolts">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            data-testid={`tribulation-bolt-${n}`}
            className={`h-2 rounded ${n <= session.boltsCompleted ? 'bg-amber-500' : 'bg-muted'}`}
            title={`第 ${n} 道雷劫${n <= session.boltsCompleted ? '（已挡）' : ''}`}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground">气血剩余：{session.hpRemaining}% · 剩余天雷：{remainingBolts}</div>

      {session.heartDemonActive && (
        <div data-testid="tribulation-heart-demon" className="rounded-lg border border-red-500/40 bg-red-500/5 p-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">心魔来袭：</span>
          <span className="text-sm font-serif-cn font-semibold text-foreground">{HEART_DEMON_LABEL[session.heartDemonActive]}</span>
          <Button
            data-testid="tribulation-action-heart-demon"
            disabled={busy}
            onClick={handleHeartDemon}
            size="sm"
            variant="destructive"
            className="ml-auto h-7 text-xs"
          >
            破魔
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          data-testid="tribulation-action-bolt"
          disabled={busy || session.currentStage === 'passed' || session.currentStage === 'failed'}
          onClick={handleBolt}
          size="sm"
          className="font-serif-cn"
        >
          接雷
        </Button>
        <Button
          data-testid="tribulation-action-end"
          disabled={busy}
          onClick={handleEnd}
          size="sm"
          variant="secondary"
          className="font-serif-cn"
        >
          了结
        </Button>
      </div>
    </div>
  );
}
