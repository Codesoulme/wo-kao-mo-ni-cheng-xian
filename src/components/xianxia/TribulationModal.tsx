// AI-67/AI-77: 渡劫 + 心魔场景战斗 UI
// 显示 9 道雷劫进度 + 心魔选项;所有交互直接调用 useGameStore action
'use client';

import { useState } from 'react';
import type { TribulationSession, TribulationStage, HeartDemonType } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';

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
  // AI-77: 直接从 store 拿 action,onRoll/onClose 不再是外部 callback 而是 store 调度
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

  const boltClass = (n: number) => (n <= session.boltsCompleted ? 'bg-amber-400' : 'bg-slate-700');
  const boltTitle = (n: number) => '第 ' + n + ' 道雷劫' + (n <= session.boltsCompleted ? '（已挡）' : '');

  return (
    <div data-testid="tribulation-modal" className="rounded-md border border-amber-500/30 bg-slate-900/80 p-4 text-amber-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">渡劫场景</h3>
        <span className="text-xs opacity-70">当前：{STAGE_LABEL[session.currentStage]}</span>
      </div>
      <div className="text-sm mb-3">{session.narrative}</div>

      <div className="grid grid-cols-9 gap-1 mb-3" data-testid="tribulation-bolts">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            data-testid={`tribulation-bolt-${n}`}
            className={`h-2 rounded ${n <= session.boltsCompleted ? 'bg-amber-400' : 'bg-slate-700'}`}
            title={`第 ${n} 道雷劫${n <= session.boltsCompleted ? '（已挡）' : ''}`}
          />
        ))}
      </div>
      <div className="text-xs mb-3">气血剩余：{session.hpRemaining}% · 剩余天雷：{remainingBolts}</div>

      {session.heartDemonActive && (
        <div data-testid="tribulation-heart-demon" className="mb-3 p-2 rounded bg-red-900/30 border border-red-500/30">
          <span className="text-xs">心魔来袭：</span>
          <span className="font-bold">{HEART_DEMON_LABEL[session.heartDemonActive]}</span>
          <button
            data-testid="tribulation-action-heart-demon"
            disabled={busy}
            onClick={handleHeartDemon}
            className="ml-2 px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs"
          >
            破魔
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          data-testid="tribulation-action-bolt"
          disabled={busy || session.currentStage === 'passed' || session.currentStage === 'failed'}
          onClick={handleBolt}
          className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm"
        >
          接雷
        </button>
        <button
          data-testid="tribulation-action-end"
          disabled={busy}
          onClick={handleEnd}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm"
        >
          了结
        </button>
      </div>
    </div>
  );
}
