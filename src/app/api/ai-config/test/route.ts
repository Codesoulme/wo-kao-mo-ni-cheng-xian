import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), '.xianxia-ai-config');

type SavedConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  chatId?: string;
  userId?: string;
};

async function readSavedConfig(): Promise<SavedConfig> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function errorMessageFromResponse(body: any, status: number) {
  const message = body?.error?.message || body?.message || body?.error || `HTTP ${status}`;
  const code = body?.error?.code || body?.code;
  return code ? `${code}: ${message}` : String(message);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const saved = await readSavedConfig();
    const baseUrl = normalizeBaseUrl(String(body?.baseUrl || saved.baseUrl || ''));
    const apiKey = String(body?.apiKey || saved.apiKey || '').trim();
    const model = String(body?.model || saved.model || 'ark-code-latest').trim();

    if (!baseUrl) {
      return NextResponse.json({ success: false, error: '请填写 API Base URL' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json({ success: false, error: 'Base URL 必须以 http:// 或 https:// 开头' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '请填写 API Key' }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ success: false, error: '请填写模型名' }, { status: 400 });
    }

    const isAnthropic = /anthropic/i.test(baseUrl) || model.toLowerCase().includes('claude');
    const started = Date.now();
    let res: Response;
    if (isAnthropic) {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 128,
          system: '你是一个接口连通性测试助手，只返回 OK。',
          messages: [{ role: 'user', content: '请只回复 OK' }],
        }),
      });
    } else {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一个接口连通性测试助手，只返回 OK。' },
            { role: 'user', content: '请只回复 OK' },
          ],
          max_tokens: 128,
          temperature: 0,
          thinking: { type: 'disabled' },
        }),
      });
    }
    const elapsedMs = Date.now() - started;
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: errorMessageFromResponse(data || text, res.status),
        status: res.status,
        elapsedMs,
      }, { status: 200 });
    }

    let reply = '';
    if (isAnthropic) {
      const blocks = data?.content || [];
      reply = blocks
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('\n');
    } else {
      reply = data?.choices?.[0]?.message?.content || '';
    }
    return NextResponse.json({
      success: true,
      status: res.status,
      elapsedMs,
      model,
      reply: String(reply).slice(0, 80),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '测试连接失败' }, { status: 200 });
  }
}
