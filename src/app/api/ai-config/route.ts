import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { resetGameAI } from '@/lib/xianxia/llm';

// ===== 多接口配置数据结构 =====
type AIProfile = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  chatId?: string;
  userId?: string;
};

type MultiConfig = {
  activeId: string;
  profiles: AIProfile[];
};

// 旧格式（单接口）
type LegacyConfig = {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  model?: string;
};

const CONFIG_PATH = path.join(process.cwd(), '.xianxia-ai-config');

function maskKey(key: string) {
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function generateId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function readMultiConfig(): Promise<MultiConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);

    // 新格式：有 profiles 数组
    if (Array.isArray(cfg?.profiles) && cfg.profiles.length > 0) {
      return {
        activeId: String(cfg.activeId || cfg.profiles[0]?.id || ''),
        profiles: cfg.profiles.map((p: any) => ({
          id: String(p.id || generateId()),
          name: String(p.name || '未命名'),
          baseUrl: String(p.baseUrl || ''),
          apiKey: String(p.apiKey || ''),
          model: String(p.model || 'ark-code-latest'),
          chatId: p.chatId ? String(p.chatId) : undefined,
          userId: p.userId ? String(p.userId) : undefined,
        })),
      };
    }

    // 旧格式兼容：自动转换为新格式
    if (cfg?.baseUrl && cfg?.apiKey) {
      const legacy: LegacyConfig = cfg;
      const profile: AIProfile = {
        id: 'legacy_default',
        name: '默认接口',
        baseUrl: String(legacy.baseUrl),
        apiKey: String(legacy.apiKey),
        model: String(legacy.model || 'ark-code-latest'),
        chatId: legacy.chatId,
        userId: legacy.userId,
      };
      const newConfig: MultiConfig = { activeId: profile.id, profiles: [profile] };
      // 立即写回新格式
      await fs.writeFile(CONFIG_PATH, `${JSON.stringify(newConfig, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
      return newConfig;
    }

    return null;
  } catch {
    return null;
  }
}

async function writeMultiConfig(config: MultiConfig) {
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
  resetGameAI();
}

// GET：返回所有接口配置 + 当前选中
export async function GET() {
  const config = await readMultiConfig();
  if (!config) {
    return NextResponse.json({ configured: false, activeId: null, profiles: [] });
  }
  const activeProfile = config.profiles.find(p => p.id === config.activeId) || config.profiles[0];
  return NextResponse.json({
    configured: !!activeProfile,
    activeId: config.activeId || config.profiles[0]?.id,
    profiles: config.profiles.map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKeyMasked: maskKey(p.apiKey),
      model: p.model,
      hasChatId: !!p.chatId,
      hasUserId: !!p.userId,
    })),
    config: activeProfile
      ? {
          baseUrl: activeProfile.baseUrl,
          apiKeyMasked: maskKey(activeProfile.apiKey),
          hasChatId: !!activeProfile.chatId,
          hasUserId: !!activeProfile.userId,
          model: activeProfile.model,
        }
      : null,
  });
}

// POST：支持多种操作
// action=save: 更新某个接口配置（可新建）
// action=switch: 切换 activeId
// action=delete: 删除某个接口
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || 'save').trim();
    let config = await readMultiConfig();

    // 如果还没有配置文件，初始化
    if (!config) {
      config = { activeId: '', profiles: [] };
    }

    if (action === 'switch') {
      // 切换当前使用的接口
      const targetId = String(body?.activeId || '').trim();
      const exists = config.profiles.find(p => p.id === targetId);
      if (!exists) {
        return NextResponse.json({ success: false, error: '接口不存在' }, { status: 400 });
      }
      config.activeId = targetId;
      await writeMultiConfig(config);
      return NextResponse.json({
        success: true,
        activeId: config.activeId,
        profiles: config.profiles.map(p => ({
          id: p.id, name: p.name, baseUrl: p.baseUrl,
          apiKeyMasked: maskKey(p.apiKey), model: p.model,
          hasChatId: !!p.chatId, hasUserId: !!p.userId,
        })),
      });
    }

    if (action === 'delete') {
      const targetId = String(body?.profileId || '').trim();
      config.profiles = config.profiles.filter(p => p.id !== targetId);
      if (config.profiles.length === 0) {
        // 删光了，删除配置文件
        try { await fs.unlink(CONFIG_PATH); } catch { /* ignore */ }
        resetGameAI();
        return NextResponse.json({ success: true, configured: false, activeId: null, profiles: [] });
      }
      // 如果删的是当前活跃的，切换到第一个
      if (config.activeId === targetId) {
        config.activeId = config.profiles[0].id;
      }
      await writeMultiConfig(config);
      return NextResponse.json({
        success: true,
        activeId: config.activeId,
        profiles: config.profiles.map(p => ({
          id: p.id, name: p.name, baseUrl: p.baseUrl,
          apiKeyMasked: maskKey(p.apiKey), model: p.model,
          hasChatId: !!p.chatId, hasUserId: !!p.userId,
        })),
      });
    }

    // action=save: 保存/更新接口配置
    const profileId = String(body?.profileId || '').trim(); // 空=新建
    const name = String(body?.name || '').trim() || '未命名';
    const baseUrl = String(body?.baseUrl || '').trim().replace(/\/+$/, '');
    const model = String(body?.model || 'ark-code-latest').trim() || 'ark-code-latest';
    const chatId = String(body?.chatId || '').trim();
    const userId = String(body?.userId || '').trim();

    // apiKey：如果传了就用新的，没传就用旧的（不允许留空新建）
    let apiKey = String(body?.apiKey || '').trim();

    if (!baseUrl) {
      return NextResponse.json({ success: false, error: '请填写 API Base URL' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json({ success: false, error: 'Base URL 必须以 http:// 或 https:// 开头' }, { status: 400 });
    }

    if (profileId) {
      // 更新现有接口
      const existing = config.profiles.find(p => p.id === profileId);
      if (!existing) {
        return NextResponse.json({ success: false, error: '接口不存在' }, { status: 400 });
      }
      if (!apiKey) apiKey = existing.apiKey; // 没传新key就保留旧key
      if (!apiKey) {
        return NextResponse.json({ success: false, error: '请填写 API Key' }, { status: 400 });
      }
      existing.name = name;
      existing.baseUrl = baseUrl;
      existing.apiKey = apiKey;
      existing.model = model;
      existing.chatId = chatId || undefined;
      existing.userId = userId || undefined;
    } else {
      // 新建接口
      if (!apiKey) {
        return NextResponse.json({ success: false, error: '请填写 API Key' }, { status: 400 });
      }
      const newId = generateId();
      const newProfile: AIProfile = {
        id: newId, name, baseUrl, apiKey, model,
        chatId: chatId || undefined, userId: userId || undefined,
      };
      config.profiles.push(newProfile);
      // 新建后自动切换到该接口
      config.activeId = newId;
    }

    await writeMultiConfig(config);
    return NextResponse.json({
      success: true,
      activeId: config.activeId,
      profiles: config.profiles.map(p => ({
        id: p.id, name: p.name, baseUrl: p.baseUrl,
        apiKeyMasked: maskKey(p.apiKey), model: p.model,
        hasChatId: !!p.chatId, hasUserId: !!p.userId,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '保存 AI 配置失败' }, { status: 500 });
  }
}
