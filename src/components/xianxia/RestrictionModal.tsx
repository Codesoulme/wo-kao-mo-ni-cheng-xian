// AI-70/AI-78: 禁制 UI——内联版
'use client';
import { useState } from 'react';
import type { Restriction } from '@/lib/xianxia/types';
import { useGameStore } from '@/lib/xianxia/store';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

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
  const tryRestrictionAccess = useGameStore((s) => s.tryRestrictionAccess);
  const fightRestriction = useGameStore((s) => s.fightRestriction);

  const handle = async (choice: 'attempt' | 'retreat' | 'combat') => {
    setBusy(true);
    try {
      const pwd = password || undefined;
      if (choice === 'combat') {
        fightRestriction(restriction);
      } else {
        tryRestrictionAccess(restriction, choice, pwd);
      }
      if (onInteract) await onInteract(choice, pwd);
    } finally {
      setBusy(false);
    }
  };

  const timingLabel = restriction.timingWindows ? restriction.timingWindows.join('、') : '';

  return (
    <div data-testid="restriction-modal" className="mt-3 rounded-lg paper-texture border border-violet-500/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif-cn text-base font-bold text-foreground flex items-center gap-2 xianxia-readable">
          <Shield className="w-4 h-4 text-violet-500" />
          {restriction.name}
        </h3>
        <span className="text-xs text-muted-foreground">{TYPE_LABEL[restriction.type]}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground font-serif-cn xianxia-prose">{restriction.description}</p>

      <div data-testid="restriction-method" className="text-xs space-y-1 text-muted-foreground">
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
          className="w-full px-2 py-1.5 bg-card/60 border border-border rounded text-sm font-serif-cn"
        />
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          data-testid="restriction-action-attempt"
          disabled={busy}
          onClick={() => handle('attempt')}
          size="sm"
          className="font-serif-cn"
        >
          尝试开启
        </Button>
        <Button
          data-testid="restriction-action-combat"
          disabled={busy}
          onClick={() => handle('combat')}
          size="sm"
          variant="destructive"
          className="font-serif-cn"
        >
          强攻破解
        </Button>
        <Button
          data-testid="restriction-action-retreat"
          disabled={busy}
          onClick={() => handle('retreat')}
          size="sm"
          variant="secondary"
          className="font-serif-cn"
        >
          退去
        </Button>
      </div>
    </div>
  );
}
