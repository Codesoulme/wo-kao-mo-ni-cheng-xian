import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { resetZAI } from '@/lib/xianxia/llm';

type ZAIConfig = {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
};

const CONFIG_PATH = path.join(process.cwd(), '.z-ai-config');

function maskKey(key: string) {
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

async function readConfig(): Promise<ZAIConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);
    if (!cfg?.baseUrl || !cfg?.apiKey) return null;
    return {
      baseUrl: String(cfg.baseUrl),
      apiKey: String(cfg.apiKey),
      chatId: cfg.chatId ? String(cfg.chatId) : undefined,
      userId: cfg.userId ? String(cfg.userId) : undefined,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const cfg = await readConfig();
  return NextResponse.json({
    configured: !!cfg,
    config: cfg
      ? {
          baseUrl: cfg.baseUrl,
          apiKeyMasked: maskKey(cfg.apiKey),
          hasChatId: !!cfg.chatId,
          hasUserId: !!cfg.userId,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baseUrl = String(body?.baseUrl || '').trim().replace(/\/+$/, '');
    const apiKey = String(body?.apiKey || '').trim();
    const chatId = String(body?.chatId || '').trim();
    const userId = String(body?.userId || '').trim();

    if (!baseUrl) {
      return NextResponse.json({ success: false, error: '请填写 API Base URL' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json({ success: false, error: 'Base URL 必须以 http:// 或 https:// 开头' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '请填写 API Key' }, { status: 400 });
    }

    const config: ZAIConfig = { baseUrl, apiKey };
    if (chatId) config.chatId = chatId;
    if (userId) config.userId = userId;

    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
    resetZAI();

    return NextResponse.json({
      success: true,
      configured: true,
      config: {
        baseUrl,
        apiKeyMasked: maskKey(apiKey),
        hasChatId: !!chatId,
        hasUserId: !!userId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '保存 AI 配置失败' }, { status: 500 });
  }
}
