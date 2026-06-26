// AI-67: 天劫 + 心魔独立战斗 UI
// 显示 9 道天雷进度 + 心魔试炼面板
'use client';

import { useState } from 'react';
import type { TribulationSession, TribulationStage, HeartDemonType } from '@/lib/xianxia/types';

const HEART_DEMON_LABEL: Record<HeartDemonType, string> = {
  obsession: '执念',
  hatred: '恨意',
  love: '情爱',
  fear: '恐惧',
  regret: '悔意',
};

const STAGE_LABEL: Record<TribulationStage, string> = {
  opening: '开劫',
  bolt1: '一雷', bolt2: '二雷', bolt3: '三雷', bolt4: '四雷', bolt5: '五雷',
  bolt6: '六雷', bolt7: '七雷', bolt8: '八雷', bolt9: '九雷',
  passed: '渡过', failed: '兵解',
};

export function TribulationModal({
  session,
  onBolt,
  onHeartDemon,
  onEnd,
}: {
  session: TribulationSession;
  onBolt: (boltNumber: number) => Promise<void> | void;
  onHeartDemon: (demon: HeartDemonType) => Promise<void> | void;
  onEnd: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const nextBolt = session.boltsCompleted + 1;
  const remainingBolts = 9 - session.boltsCompleted;

  const handleBolt = async () => {
    setBusy(true);
    try { await onBolt(Math.min(9, nextBolt)); } finally { setBusy(false); }
  };

  return (
    <div data-testid="tribulation-modal" className="rounded-md border border-amber-500/30 bg-slate-900/80 p-4 text-amber-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">天劫试炼</h3>
        <span className="text-xs opacity-70">当前：{STAGE_LABEL[session.currentStage]}</span>
      </div>
      <div className="text-sm mb-3">{session.narrative}</div>

      <div className="grid grid-cols-9 gap-1 mb-3" data-testid="tribulation-bolts">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            data-testid={`tribulation-bolt-${n}`}
            className={`h-2 rounded ${n <= session.boltsCompleted ? 'bg-amber-400' : 'bg-slate-700'}`}
            title={`第 ${n} 道天雷${n <= session.boltsCompleted ? '（已渡）' : ''}`}
          />
        ))}
      </div>
      <div className="text-xs mb-3">气血剩余：{session.hpRemaining}% ｜ 剩余雷数：{remainingBolts}</div>

      {session.heartDemonActive && (
        <div data-testid="tribulation-heart-demon" className="mb-3 p-2 rounded bg-red-900/30 border border-red-500/30">
          <span className="text-xs">心魔试炼：</span>
          <span className="font-bold">{HEART_DEMON_LABEL[session.heartDemonActive]}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          data-testid="tribulation-action-bolt"
          disabled={busy || session.currentStage === 'passed' || session.currentStage === 'failed'}
          onClick={handleBolt}
          className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm"
        >
          渡雷
        </button>
        <button
          data-testid="tribulation-action-end"
          disabled={busy}
          onClick={onEnd}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm"
        >
          结束
        </button>
      </div>
    </div>
  );
}