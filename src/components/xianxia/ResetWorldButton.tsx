'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/lib/xianxia/store';

export function ResetWorldButton() {
  const [busy, setBusy] = useState(false);
  const resetWorldLocal = useGameStore((s) => s.resetWorldLocal);

  const resetWorld = async () => {
    if (busy) return;
    const ok = window.confirm('???????????????????????????????????????????????');
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch('/api/game/reset-world', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '??????');

      resetWorldLocal();
      localStorage.removeItem('xianxia-game');
      toast.success('?????', { description: '????????????????????????' });
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error('??????', { description: err?.message || '?????' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full font-serif-cn gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={resetWorld}
      disabled={busy}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
      ????
    </Button>
  );
}
