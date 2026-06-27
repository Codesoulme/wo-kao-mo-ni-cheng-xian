// AI-70/AI-78: 禁制 UI;所有交互直接调用 useGameStore action
'use client';
import { useState } from 'react';
import type { Restriction } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';

const METHOD_LABEL: Record<Restriction['accessMethod'], string> = {
  token: '信物',
  password: '口令',
  identity: '身份',
  key: '钥匙',
  timing: '时机',
  combat: '战斗',
};

const TYPE_LABEL: Record<Restriction['type'], string> = {
  door: '门禁',
  trap: '禁制陷阱',
  transport: '传送阵',
  seal: '封印',
  ward: '结界',
  barrier: '屏障',
};

export function RestrictionModal({
  restriction,
  onInteract,
}: {
  restriction: Restriction;
  onInteract?: (choice: 'attempt' | 'retreat' | 'combat', password?: string) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  // AI-78: onTryAccess -> store.tryRestrictionAccess / onCombat -> store.fightRestriction
  const tryRestrictionAccess = useGameStore((s) => s.tryRestrictionAccess);
  const fightRestriction = useGameStore((s) => s.fightRestriction);

  const handle = async (choice: 'attempt' | 'retreat' | 'combat') => {
    setBusy(true);
    try {
      const pwd = password || undefined;
      if (choice === 'combat') {
        fightRestriction(restriction);
      } else {
        // attempt 或 retreat 都先走 tryRestrictionAccess,引擎按 choice 区分
        tryRestrictionAccess(restriction, choice, pwd);
      }
      if (onInteract) await onInteract(choice, pwd);
    } finally {
      setBusy(false);
    }
  };

  const timingLabel = restriction.timingWindows ? restriction.timingWindows.join('、') : '';

  return (
    <div data-testid="restriction-modal" className="rounded-md border border-violet-500/30 bg-slate-900/80 p-4 text-violet-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">{restriction.name}</h3>
        <span className="text-xs opacity-70">{TYPE_LABEL[restriction.type]}</span>
      </div>
      <div className="text-sm mb-3">{restriction.description}</div>

      <div data-testid="restriction-method" className="text-xs space-y-1 mb-3">
        <div>通行方式：{METHOD_LABEL[restriction.accessMethod]}</div>
        <div>难度：{restriction.difficulty}/100</div>
        {restriction.requiredIdentity && <div>身份要求：{restriction.requiredIdentity}</div>}
        {restriction.timingWindows && <div>时机：{timingLabel}</div>}
        {restriction.combatPower !== undefined && <div>战力要求：{restriction.combatPower}</div>}
      </div>

      {restriction.accessMethod === 'password' && (
        <input
          data-testid="restriction-password-input"
          type="text"
          placeholder="输入口令"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-2 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm"
        />
      )}

      <div className="flex gap-2">
        <button
          data-testid="restriction-action-attempt"
          disabled={busy}
          onClick={() => handle('attempt')}
          className="px-3 py-1 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm"
        >
          尝试开启
        </button>
        <button
          data-testid="restriction-action-combat"
          disabled={busy}
          onClick={() => handle('combat')}
          className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm"
        >
          强攻破解
        </button>
        <button
          data-testid="restriction-action-retreat"
          disabled={busy}
          onClick={() => handle('retreat')}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm"
        >
          退去
        </button>
      </div>
    </div>
  );
}
