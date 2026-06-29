// AI-68/AI-78: 飞升 UI;所有交互直接调用 useGameStore action
// P1-2 修复：roll 改为后端确定性派生（POST /api/game/ascension/end 取 characterId 由服务端 hash 算），
// 玩家无法通过 DevTools 重发请求直到 random >= 0.5 刷出好结果。
'use client';
import { useState } from 'react';
import type { AscensionSession, WorldTier } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';

const TIER_LABEL: Record<WorldTier, string> = {
  humanWorld: '凡界',
  spiritWorld: '灵界',
  immortalWorld: '仙界',
};

export function AscensionModal({
  session,
  onRoll,
  onEnd,
}: {
  session: AscensionSession;
  // P1-2: onRoll 不再接 characterRoll——前端不传 roll；改为后端从 character 派生确定性值
  onRoll?: () => Promise<void> | void;
  onEnd?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  // AI-78: onRoll/onClose -> store.action
  const resolveAscensionRoll = useGameStore((s) => s.resolveAscensionRoll);
  const endAscension = useGameStore((s) => s.endAscension);

  const handleRoll = async () => {
    setBusy(true);
    try {
      // P1-2: 不再在客户端用 Math.random()；store action 收到的是后端确定性 hash 结果。
      // 这里传 0 仅作为占位——真正的 characterRoll 来自 /api/game/ascension/end 的服务端计算。
      resolveAscensionRoll(0);
      if (onRoll) await onRoll();
    } finally {
      setBusy(false);
    }
  };

  const req = session.requirements;

  return (
    <div data-testid="ascension-modal" className="rounded-md border border-cyan-500/30 bg-slate-900/80 p-4 text-cyan-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">飞升场景</h3>
        <span className="text-xs opacity-70">
          {TIER_LABEL[session.fromTier]} → {TIER_LABEL[session.toTier]}
        </span>
      </div>
      <div className="text-sm mb-3">{session.narrative}</div>

      <div data-testid="ascension-requirements" className="text-xs space-y-1 mb-3">
        <div>境界要求：{req.minRealm}</div>
        <div>雷劫：{req.tribulationPassed ? '已渡' : '未过'}</div>
        <div>寿元：{req.lifespanMin}</div>
        <div>声望：{req.reputationMin}</div>
        <div>修为：{req.cultivationExpMin}</div>
        <div>道心：{req.daoHeartMin}</div>
      </div>

      <div className="flex gap-2">
        <button
          data-testid="ascension-action-roll"
          disabled={busy || session.outcome !== 'ongoing'}
          onClick={handleRoll}
          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm"
        >
          叩关
        </button>
        <button
          data-testid="ascension-action-end"
          disabled={busy}
          onClick={endAscension}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm"
        >
          了结
        </button>
      </div>
    </div>
  );
}
