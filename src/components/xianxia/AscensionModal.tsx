// AI-68/AI-78: 飞升 UI——内联版
// P1-2 修复：roll 改为后端确定性派生（POST /api/game/ascension/end 取 characterId 由服务端 hash 算），
// 玩家无法通过 DevTools 重发请求直到 random >= 0.5 刷出好结果。
'use client';
import { useState } from 'react';
import type { AscensionSession, WorldTier } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Cloud } from 'lucide-react';

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
  onRoll?: () => Promise<void> | void;
  onEnd?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
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
    <div data-testid="ascension-modal" className="mt-3 rounded-lg paper-texture border border-cyan-500/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif-cn text-base font-bold text-foreground flex items-center gap-2 xianxia-readable">
          <Cloud className="w-4 h-4 text-cyan-500" />
          飞升
        </h3>
        <span className="text-xs text-muted-foreground">
          {TIER_LABEL[session.fromTier]} → {TIER_LABEL[session.toTier]}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground font-serif-cn xianxia-prose">{session.narrative}</p>

      <div data-testid="ascension-requirements" className="text-xs space-y-1 text-muted-foreground">
        <div>境界已至此境：{req.minRealm}</div>
        <div>雷劫：{req.tribulationPassed ? '已历' : '未历'}</div>
        <div>寿元已逾 {req.lifespanMin}</div>
        <div>声名已至 {req.reputationMin}</div>
        <div>修为已达 {req.cultivationExpMin}</div>
        <div>道心已显 {req.daoHeartMin}</div>
      </div>

      <div className="flex gap-2">
        <Button
          data-testid="ascension-action-roll"
          disabled={busy || session.outcome !== 'ongoing'}
          onClick={handleRoll}
          size="sm"
          className="font-serif-cn"
        >
          叩关
        </Button>
        <Button
          data-testid="ascension-action-end"
          disabled={busy}
          onClick={endAscension}
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
