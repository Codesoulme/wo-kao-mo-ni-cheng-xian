'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useGameStore } from '@/lib/xianxia/store';

export function ResetWorldButton() {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const resetWorldLocal = useGameStore((s) => s.resetWorldLocal);

  const resetWorld = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/game/reset-world', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '重置世界失败');

      resetWorldLocal();
      localStorage.removeItem('xianxia-game');
      toast.success('世界已重置', { description: '存档、传承池与仙路殿堂已清空。' });
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error('重置世界失败', { description: err?.message || '请稍后重试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full font-serif-cn gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
        >
          <RotateCcw className="w-4 h-4" />
          重置世界
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-destructive/30 bg-background/95">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif-cn text-destructive">重置整个测试世界？</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            这会清空所有角色存档、事件史册、选择记录、传承池、仙路殿堂、全局仙历与历代遗响。
            适合大版本改动后重新测试，但此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>暂不重置</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              resetWorld();
            }}
            disabled={busy}
          >
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />重置中</> : '确认重置'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
