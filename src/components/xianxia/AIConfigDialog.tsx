'use client';

import { useEffect, useState } from 'react';
import { Settings, KeyRound, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type AIConfigStatus = {
  configured: boolean;
  config?: {
    baseUrl: string;
    apiKeyMasked: string;
    hasChatId: boolean;
    hasUserId: boolean;
    model?: string;
  } | null;
};

type AIConfigDialogProps = {
  variant?: 'icon' | 'start' | 'menu';
};

export function AIConfigDialog({ variant = 'icon' }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AIConfigStatus>({ configured: false, config: null });
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('ark-code-latest');
  const [chatId, setChatId] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/ai-config', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data);
      if (data.config?.baseUrl) setBaseUrl(data.config.baseUrl);
      if (data.config?.model) setModel(data.config.model);
    } catch {
      setStatus({ configured: false, config: null });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (open) loadStatus();
  }, [open]);

  const save = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, model, chatId, userId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '保存失败');
      setStatus({ configured: true, config: data.config });
      setApiKey('');
      toast.success('AI 接口配置已保存', { description: '已写入本地 .z-ai-config，不会提交到 Git' });
      setOpen(false);
    } catch (err: any) {
      toast.error('AI 配置保存失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, model, chatId, userId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '测试连接失败');
      toast.success('AI 连接测试成功', {
        description: `模型 ${data.model || model} 可用，耗时 ${data.elapsedMs ?? '?'}ms`,
      });
    } catch (err: any) {
      toast.error('AI 连接测试失败', { description: err.message });
    } finally {
      setTesting(false);
    }
  };

  const trigger = variant === 'menu' ? (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }} className="text-xs cursor-pointer">
      <Settings className="w-3.5 h-3.5 mr-2" />
      <span>AI 配置</span>
    </DropdownMenuItem>
  ) : variant === 'start' ? (
    <Button variant={status.configured ? 'outline' : 'default'} className="w-full font-serif-cn gap-2">
      {status.configured ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <KeyRound className="w-4 h-4" />}
      {status.configured ? 'AI 接口已配置' : '配置 AI 接口'}
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', !status.configured && 'text-amber-500')}
      title={status.configured ? 'AI 接口已配置' : '配置 AI 接口'}
    >
      {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif-cn flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            AI 接口配置
          </DialogTitle>
          <DialogDescription>
            本游戏依赖 AI 生成剧情。配置会保存到项目根目录 .z-ai-config，本地使用，不会上传仓库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={cn(
            'rounded-lg border p-3 text-xs flex items-start gap-2',
            status.configured ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
          )}>
            {status.configured ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
            <div className="space-y-1 min-w-0">
              <div className="font-medium">{status.configured ? '当前已配置 AI 接口' : '当前未配置 AI 接口'}</div>
              {status.config?.baseUrl && <div className="truncate text-muted-foreground">Base URL：{status.config.baseUrl}</div>}
              {status.config?.apiKeyMasked && <div className="text-muted-foreground">API Key：{status.config.apiKeyMasked}</div>}
              {status.config?.model && <div className="text-muted-foreground">模型：{status.config.model}</div>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">API Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如：https://api.example.com/v1"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">z-ai-web-dev-sdk 要求 baseUrl 通常包含 /v1。</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">API Key</label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status.configured ? '留空不会复用旧 key；如需更新请重新填写' : '请输入 API Key'}
              type="password"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">模型名</label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：ark-code-latest"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">火山 Ark 接口必须传 model；当前月卡配置可先用 ark-code-latest。</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">chatId（可选）</label>
              <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="可选" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">userId（可选）</label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="可选" autoComplete="off" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={testConnection}
              disabled={testing || loading || !baseUrl.trim() || (!status.configured && !apiKey.trim()) || !model.trim()}
            >
              {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />测试中</> : '测试连接'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loading || testing}>取消</Button>
              <Button className="flex-1" onClick={save} disabled={loading || testing || !baseUrl.trim() || (!status.configured && !apiKey.trim()) || !model.trim()}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中</> : '保存配置'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
