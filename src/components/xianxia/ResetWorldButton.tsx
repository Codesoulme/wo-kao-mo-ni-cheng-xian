'use client';

import { useState } from 'react';
import { RotateCcw, Eraser, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useGameStore } from '@/lib/xianxia/store';

const CONFIRM_WORD = '重置';

export function ResetWorldButton() {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [cleanBusy, setCleanBusy] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const resetWorldLocal = useGameStore((s) => s.resetWorldLocal);

  const resetWorld = async () => {
    if (busy) return;
    if (confirmText !== CONFIRM_WORD) {
      toast.error('请输入「重置」二字以确认');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/game/reset-world', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '重置世界失败');

      resetWorldLocal();
      localStorage.removeItem('xianxia-game');
      toast.success('世界已重置', { description: '存档、传承池与仙路殿堂已清空。' });
      setOpen(false);
      setConfirmText('');
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error('重置世界失败', { description: err?.message || '请稍后重试' });
    } finally {
      setBusy(false);
    }
  };

  // 轻量清理：只清坏事件/preload/干扰，不删角色
  const cleanTestArtifacts = async () => {
    if (cleanBusy) return;
    setCleanBusy(true);
    try {
      const res = await fetch('/api/game/clean-test-artifacts', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '清理失败');
      toast.success('测试残留已清理', { description: `已清空 ${data.cleared?.events || 0} 条事件 / ${data.cleared?.preload || 0} 条预加载 / ${data.cleared?.interferences || 0} 条干扰。` });
      setCleanOpen(false);
    } catch (err: any) {
      toast.error('清理失败', { description: err?.message || '请稍后重试' });
    } finally {
      setCleanBusy(false);
    }
  };

  return (
    <>
      <AlertDialog open={cleanOpen} onOpenChange={(next) => !cleanBusy && setCleanOpen(next)}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full font-serif-cn gap-2 border-amber-500/30 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
            disabled={cleanBusy}
          >
            <Eraser className="w-4 h-4" />
            清理测试残留
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-amber-500/30 bg-background/95">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-cn text-amber-700">清理测试残留？</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              仅清空事件史册、推进预加载、玩家干扰记录。不会删除角色存档。
              适合发现叙事/数据错乱时快速回到干净状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleanBusy}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(event) => {
                event.preventDefault();
                cleanTestArtifacts();
              }}
              disabled={cleanBusy}
            >
              {cleanBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />清理中</> : '确认清理'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={open} onOpenChange={(next) => { if (busy) return; setOpen(next); if (!next) setConfirmText(''); }}>
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
              <div className="mt-3 text-foreground">
                请输入 <span className="font-bold text-destructive">「{CONFIRM_WORD}」</span> 以确认：
                <Input
                  className="mt-2"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  disabled={busy}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                resetWorld();
              }}
              disabled={busy || confirmText !== CONFIRM_WORD}
            >
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />重置中</> : '确认重置'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
