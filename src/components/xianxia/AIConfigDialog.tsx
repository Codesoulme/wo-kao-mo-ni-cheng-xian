'use client';

import { useEffect, useState } from 'react';
import { Settings, KeyRound, CheckCircle2, AlertTriangle, Loader2, Plus, Trash2, Zap, Edit3, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ProfileListItem = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  hasChatId: boolean;
  hasUserId: boolean;
};

type AIConfigStatus = {
  configured: boolean;
  activeId: string | null;
  profiles: ProfileListItem[];
  config?: {
    baseUrl: string;
    apiKeyMasked: string;
    hasChatId: boolean;
    hasUserId: boolean;
    model: string;
  } | null;
};

type AIConfigDialogProps = {
  variant?: 'icon' | 'start' | 'menu';
};

// 生产模式鉴权：服务端 requireAuth 需要 x-admin-token header。
// dev 模式下 NEXT_PUBLIC_ADMIN_TOKEN 为空 → 不带 header → 后端走 dev 默认放行。
function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (token && token.length > 0) {
    headers['x-admin-token'] = token;
  }
  return headers;
}

export function AIConfigDialog({ variant = 'icon' }: AIConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AIConfigStatus>({ configured: false, activeId: null, profiles: [], config: null });
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // 编辑状态：undefined=关闭编辑, null=新建, string=编辑现有
  const [editingProfileId, setEditingProfileId] = useState<string | null | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editModel, setEditModel] = useState('ark-code-latest');
  const [editChatId, setEditChatId] = useState('');
  const [editUserId, setEditUserId] = useState('');

  const loadStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/ai-config', { cache: 'no-store', headers: buildAuthHeaders() });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false, activeId: null, profiles: [], config: null });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => { if (open) loadStatus(); }, [open]);

  // 开始编辑某个现有接口
  const startEdit = (profile: ProfileListItem) => {
    setEditingProfileId(profile.id);
    setEditName(profile.name);
    setEditBaseUrl(profile.baseUrl);
    setEditApiKey(''); // 不回显key，让用户选择是否更新
    setEditModel(profile.model);
    setEditChatId('');
    setEditUserId('');
  };

  // 开始新建接口
  const startNew = () => {
    setEditingProfileId(null);
    setEditName('');
    setEditBaseUrl('');
    setEditApiKey('');
    setEditModel('ark-code-latest');
    setEditChatId('');
    setEditUserId('');
  };

  // 保存当前编辑的接口
  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'save',
          profileId: editingProfileId || undefined,
          name: editName,
          baseUrl: editBaseUrl,
          apiKey: editApiKey,
          model: editModel,
          chatId: editChatId,
          userId: editUserId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '保存失败');
      setStatus({ ...status, activeId: data.activeId, profiles: data.profiles, configured: true });
      setEditingProfileId(undefined);
      toast.success('接口配置已保存');
    } catch (err: any) {
      toast.error('保存失败', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // 切换当前使用的接口
  const switchProfile = async (profileId: string) => {
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'switch', activeId: profileId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '切换失败');
      setStatus({ ...status, activeId: data.activeId, profiles: data.profiles });
      toast.success(`已切换到「${data.profiles.find((p: ProfileListItem) => p.id === data.activeId)?.name || ''}」`);
    } catch (err: any) {
      toast.error('切换失败', { description: err.message });
    }
  };

  // 删除接口
  const deleteProfile = async (profileId: string) => {
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'delete', profileId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '删除失败');
      setStatus({
        ...status,
        configured: data.configured ?? data.profiles?.length > 0,
        activeId: data.activeId,
        profiles: data.profiles || [],
      });
      toast.success('接口已删除');
    } catch (err: any) {
      toast.error('删除失败', { description: err.message });
    }
  };

  // 测试连接（使用当前编辑的参数）
  const testConnection = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ baseUrl: editBaseUrl, apiKey: editApiKey, model: editModel }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '测试连接失败');
      toast.success('连接测试成功', { description: `模型 ${data.model || editModel} 可用，耗时 ${data.elapsedMs ?? '—'}ms` });
    } catch (err: any) {
      toast.error('连接测试失败', { description: err.message });
    } finally {
      setTesting(false);
    }
  };

  // 快速测试某个已保存的接口
  const quickTest = async (profileId: string) => {
    try {
      const res = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '测试失败');
      const profile = status.profiles.find(p => p.id === profileId);
      toast.success(`「${profile?.name || ''}」连接成功`, { description: `耗时 ${data.elapsedMs ?? '—'}ms` });
    } catch (err: any) {
      toast.error('测试失败', { description: err.message });
    }
  };

  const showEditForm = editingProfileId !== undefined;
  const activeId = status.activeId;

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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingProfileId(undefined); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif-cn flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            AI 接口配置
          </DialogTitle>
          <DialogDescription>
            支持添加多个 AI 接口，自定义名称，选择使用。配置保存到本地，不会上传仓库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 接口列表 */}
          {status.profiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">已添加的接口</div>
              {status.profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={cn(
                    'rounded-lg border p-2 text-xs flex items-start gap-2 transition-colors',
                    profile.id === activeId
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border/60 bg-card/80 hover:border-primary/30'
                  )}
                >
                  {/* 使用标记 */}
                  <div className="shrink-0 mt-0.5">
                    {profile.id === activeId
                      ? <Radio className="w-3.5 h-3.5 text-primary fill-primary" />
                      : <Radio className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="font-medium flex items-center gap-1">
                      {profile.name}
                      {profile.id === activeId && <span className="text-primary text-[9px]">使用中</span>}
                    </div>
                    <div className="truncate text-muted-foreground">{profile.baseUrl}</div>
                    <div className="text-muted-foreground">{profile.model} · Key: {profile.apiKeyMasked}</div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="shrink-0 flex items-center gap-0.5">
                    {profile.id !== activeId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="切换使用"
                        onClick={() => switchProfile(profile.id)}
                      >
                        <Radio className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="测试连接"
                      onClick={() => quickTest(profile.id)}
                    >
                      <Zap className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="编辑"
                      onClick={() => startEdit(profile)}
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/70 hover:text-destructive"
                      title="删除"
                      onClick={() => deleteProfile(profile.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 无接口提示 */}
          {status.profiles.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">当前未配置 AI 接口</div>
                <div className="text-muted-foreground">请添加至少一个接口以开始游戏</div>
              </div>
            </div>
          )}

          {/* 添加新接口按钮 */}
          {editingProfileId === undefined && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={startNew}
            >
              <Plus className="w-4 h-4" />
              添加新接口
            </Button>
          )}

          {/* 编辑/新建表单 */}
          {editingProfileId !== undefined && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="text-xs font-medium">
                {editingProfileId ? '编辑接口' : '新建接口'}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">接口名称</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="例如：豆包、DeepSeek、本地模型"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">API Base URL</label>
                <Input
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  placeholder="例如：https://api.example.com/v1"
                  autoComplete="off"
                />
                <p className="text-[10px] text-muted-foreground">兼容 OpenAI Chat Completions 的 Base URL</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">API Key</label>
                <Input
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder={editingProfileId ? '留空保留原 Key；如需更新请重新填写' : '请输入 API Key'}
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">模型名</label>
                <Input
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  placeholder="例如：ark-code-latest、deepseek-chat"
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium">chatId（可选）</label>
                  <Input value={editChatId} onChange={(e) => setEditChatId(e.target.value)} placeholder="可选" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">userId（可选）</label>
                  <Input value={editUserId} onChange={(e) => setEditUserId(e.target.value)} placeholder="可选" autoComplete="off" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={testConnection}
                  disabled={testing || saving || !editBaseUrl.trim() || (!editingProfileId && !editApiKey.trim()) || !editModel.trim()}
                >
                  {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />测试中</> : <><Zap className="w-3.5 h-3.5 mr-1.5" />测试</>}
                </Button>
                <Button
                  className="flex-1"
                  onClick={saveProfile}
                  disabled={saving || testing || !editBaseUrl.trim() || (!editingProfileId && !status.configured && !editApiKey.trim()) || !editModel.trim()}
                >
                  {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中</> : '保存'}
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setEditingProfileId(undefined)}
              >
                取消编辑
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
