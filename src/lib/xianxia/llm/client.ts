// 修仙模拟器 - LLM 服务 / 客户端与流式域
// 拆分自 llm.ts：运行时配置加载 + apiKey 解析 + 短时缓存 + callLLM/callLLMText/callLLMStream + parseJSON 复用
import { promises as fs } from 'fs';
import path from 'path';
import { assembleZonePrompt } from './prompt-builder';
import { parseJSON } from './response-parser';
import { recordOpenAIUsage, recordAnthropicUsage, type LLMScene } from './usage-tracker';

type RuntimeAIConfig = {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  model: string;
  liteModel?: string;
};

let cachedAIConfig: RuntimeAIConfig | null = null;

// 同 prompt 短时缓存：避免误操作/双击导致重复 LLM 调用
type CacheEntry = { value: string; expiresAt: number };
const llmCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

export function hashCacheKey(s: string): string {
  // 简单 hash，O(n) 不依赖 node:crypto
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return `llm_${h}`;
}

function getCachedLLM(key: string): string | null {
  const entry = llmCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    llmCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedLLM(key: string, value: string): void {
  llmCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  // 简单 LRU：超过 50 条清理最旧
  if (llmCache.size > 50) {
    const firstKey = llmCache.keys().next().value;
    if (firstKey) llmCache.delete(firstKey);
  }
}

export function resetGameAI() {
  cachedAIConfig = null;
}

async function loadAIConfig(): Promise<RuntimeAIConfig> {
  if (cachedAIConfig) return cachedAIConfig;

  // 沉浸版 Phase-Release: profiles 为空时静默 fallback 到主公内置 key
  //   - 优先读 .xianxia-ai-config（玩家自己在设置里填的）
  //   - 没有再 fallback 到环境变量 MINIMAX_M3_KEY（主公服务器的临时额度）
  //   - UI 上不暴露 fallback 来源（AIConfigDialog 只显示 profiles 列表，玩家永远看到空列表）
  const cfgPath = path.join(process.cwd(), '.xianxia-ai-config');
  let cfg: any = null;
  try {
    const raw = await fs.readFile(cfgPath, 'utf-8');
    cfg = JSON.parse(raw);
  } catch {
    cfg = null;
  }

  // 玩家自己填的 profiles 优先
  if (cfg && Array.isArray(cfg?.profiles) && cfg.profiles.length > 0) {
    const activeId = String(cfg.activeId || cfg.profiles[0]?.id || '');
    const active = cfg.profiles.find((p: any) => p.id === activeId) || cfg.profiles[0];
    if (active?.baseUrl && active?.apiKey) {
      cachedAIConfig = {
        baseUrl: String(active.baseUrl).trim().replace(/\/+$/, ''),
        apiKey: resolveApiKey(active.apiKey),
        model: String(active.model || 'ark-code-latest').trim() || 'ark-code-latest',
        liteModel: active.liteModel ? String(active.liteModel).trim() : undefined,
        chatId: active.chatId ? String(active.chatId) : undefined,
        userId: active.userId ? String(active.userId) : undefined,
      };
      return cachedAIConfig;
    }
  }

  // 旧格式兼容
  if (cfg && cfg?.baseUrl && cfg?.apiKey) {
    cachedAIConfig = {
      baseUrl: String(cfg.baseUrl).trim().replace(/\/+$/, ''),
      apiKey: resolveApiKey(cfg.apiKey),
      model: String(cfg?.model || cfg?.modelName || 'ark-code-latest').trim() || 'ark-code-latest',
      liteModel: cfg?.liteModel ? String(cfg.liteModel).trim() : undefined,
      chatId: cfg?.chatId ? String(cfg.chatId) : undefined,
      userId: cfg?.userId ? String(cfg.userId) : undefined,
    };
    return cachedAIConfig;
  }

  // Fallback：主公内置 minimax M3（玩家看到的就是"游戏自动帮配好"）
  const fbKey = process.env.MINIMAX_M3_KEY || process.env.MINIMAX_API_KEY;
  if (fbKey) {
    cachedAIConfig = {
      baseUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: fbKey,
      model: 'MiniMax-M3',
    };
    console.log('[AI] fallback to built-in MINIMAX_M3 key (no user profile)');
    return cachedAIConfig;
  }

  throw new Error('游戏 AI 配置不可用：玩家未配置 + 服务端无内置 key');
}

/**
 * Resolve an apiKey value from config.
 * - "env:VAR_NAME"  -> process.env.VAR_NAME
 * - any other value -> returned as-is (legacy plaintext)
 * Throws when env var is referenced but missing.
 */
function resolveApiKey(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (s.startsWith('env:')) {
    const varName = s.slice(4).trim();
    if (!varName) {
      throw new Error('AI 配置 apiKey 形式为 "env:VAR_NAME"，但变量名为空');
    }
    const v = process.env[varName];
    if (!v) {
      throw new Error(`AI 配置引用了环境变量 ${varName}，但 process.env.${varName} 未设置`);
    }
    return v;
  }
  return s;
}



function aiErrorMessage(body: any, status: number) {
  const message = body?.error?.message || body?.message || body?.error || `HTTP ${status}`;
  const code = body?.error?.code || body?.code;
  return code ? `${code}: ${message}` : String(message);
}
// ==================== LLM 调用 ====================

export async function callLLM(systemPrompt: string, userPrompt: string, scenePrompt: string, options: { qualityMode?: 'full' | 'light'; scene?: LLMScene } = {}): Promise<any> {
  // TechDoc 18.6.5：6 区架构——把 scene 拼到 system 区，user 不变
  // 借助 assembleZonePrompt 把 scene 归为 Scene 区（input classification 由调用方按需附加）
  const { systemPrompt: fullSystem, userPrompt: fullUser } = assembleZonePrompt({
    systemIdentity: systemPrompt,
    sceneBehavior: scenePrompt,
    userPrefix: userPrompt,
  });
  const content = await callLLMText(fullSystem, fullUser, options);
  return parseJSON(content);
}

export async function callLLMText(systemPrompt: string, userPrompt: string, options: { qualityMode?: 'full' | 'light'; scene?: LLMScene } = {}): Promise<string> {
  // 缓存命中：避免重复请求
  const cacheKey = hashCacheKey(`${options.qualityMode || 'full'}|${systemPrompt.slice(0, 200)}|${userPrompt}`);
  const cached = getCachedLLM(cacheKey);
  if (cached) {
    console.log('[LLM] cache hit, skip request');
    return cached;
  }
  try {
    const cfg = await loadAIConfig();
    // 轻量模式：非命节点用小模型，推理快 2-3x
    const isLite = options.qualityMode === 'light';
    const model = isLite && cfg.liteModel ? cfg.liteModel : cfg.model;
    const isAnthropic = /anthropic/i.test(cfg.baseUrl) || model?.toLowerCase().includes('claude');
    let res: Response;
    if (isAnthropic) {
      // Anthropic 协议：/v1/messages，x-api-key + anthropic-version
      const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/v1/messages`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      };
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
    } else {
      // OpenAI 协议：/chat/completions，Authorization: Bearer
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      };
      if (cfg.chatId) headers['X-Chat-Id'] = cfg.chatId;
      if (cfg.userId) headers['X-User-Id'] = cfg.userId;
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.15,
          frequency_penalty: 0.8,
          presence_penalty: 0.6,
          stop: ["\u4fee\u771f\u4fee\u771f", "\u6c89\u6d78\u6c89\u6d78"],
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          thinking: { type: 'disabled' },
        }),
      });
    }
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new Error(`AI 接口请求失败：${aiErrorMessage(data || text, res.status)}`);
    let content = '';
    let stopReason = '';
    if (isAnthropic) {
      // 埋点 1/3：Anthropic 分支 usage（input_tokens 已排除缓存，cache_read_input_tokens 单列）
      recordAnthropicUsage(model, data?.usage, options.scene || 'aux');
      // Anthropic 响应：content 是数组，type=text
      const contentBlocks = data?.content || [];
      content = contentBlocks
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('\n');
      stopReason = data?.stop_reason || '';
      if (stopReason === 'max_tokens') {
        console.warn(`[LLM] Anthropic 响应因 max_tokens 被截断（实际输出 ${data?.usage?.output_tokens || '?'} tokens）。考虑降低 narrative 字数或拆分请求。`);
      }
    } else {
      // 埋点 2/3：OpenAI 兼容分支 usage（方舟 prompt_tokens 含命中缓存，tracker 内部减掉 cached_tokens）
      recordOpenAIUsage(model, data?.usage, options.scene || 'aux');
      content = data?.choices?.[0]?.message?.content || '';
      stopReason = data?.choices?.[0]?.finish_reason || '';
    }
    if (!content) throw new Error('AI 接口返回为空');
    // 沉浸版 Phase-Release: 被截断的响应不进缓存——否则同 prompt 后续调用永远吐这条坏 JSON
    const truncated =
      stopReason === 'max_tokens' ||
      stopReason === 'length' ||
      stopReason === 'content_filter';
    if (!truncated) {
      setCachedLLM(cacheKey, content);
    } else {
      console.warn(`[LLM] 响应被截断（stopReason=${stopReason}），跳过缓存，本次仍返回给调用方以走 fallback 分支`);
    }
    return content;
  } catch (err: any) {
    console.error('LLM call failed:', err?.message || err);
    throw err;
  }
}

/**
 * 流式 LLM 调用：边读边触发 onDelta 回调
 * 协议：OpenAI stream 格式（chunked SSE），Anthropic stream 格式
 * 返回最终的完整 content 字符串
 */
export async function callLLMStream(
  systemPrompt: string,
  userPrompt: string,
  onDelta: (delta: string) => void | Promise<void>,
  options: { qualityMode?: 'full' | 'light'; scene?: LLMScene } = {},
): Promise<string> {
  const cfg = await loadAIConfig();
  const isLite = options.qualityMode === 'light';
  const model = isLite && cfg.liteModel ? cfg.liteModel : cfg.model;
  const isAnthropic = /anthropic/i.test(cfg.baseUrl) || model?.toLowerCase().includes('claude');
  const headers: Record<string, string> = isAnthropic
    ? {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      }
    : {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(cfg.chatId ? { 'X-Chat-Id': cfg.chatId } : {}),
        ...(cfg.userId ? { 'X-User-Id': cfg.userId } : {}),
      };
  const body = isAnthropic
    ? JSON.stringify({
        model,
        max_tokens: 16384,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
    : JSON.stringify({
          model,
          stream: true,
          // 观测层：OpenAI 兼容流式默认不回传 usage，须显式要末帧统计帧。
          // 该帧 choices 为空数组，下方 delta 解析天然跳过，不影响正文。
          stream_options: { include_usage: true },
          max_tokens: 16384,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.15,
          frequency_penalty: 0.8,
          presence_penalty: 0.6,
          stop: ["\u4fee\u771f\u4fee\u771f", "\u6c89\u6d78\u6c89\u6d78"],
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          thinking: { type: 'disabled' },
        });
  const endpoint = isAnthropic
    ? `${cfg.baseUrl.replace(/\/+$/, '')}/v1/messages`
    : `${cfg.baseUrl}/chat/completions`;
  const res = await fetch(endpoint, { 
    method: 'POST', 
    headers, 
    body,
    // 禁用请求缓冲，确保流式数据立即传输
    cache: 'no-store',
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI stream failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let total = '';
  let chunkCount = 0;
  // 埋点 3/3 准备：流式 usage 不在正文帧里。
  //   OpenAI 兼容：末帧（choices 空）带完整 usage，整体覆盖即可
  //   Anthropic：message_start 给输入侧，message_delta 给输出侧，要分别攒
  let streamUsage: any = null;
  let anthropicInput = 0;
  let anthropicCacheRead = 0;
  let anthropicCacheWrite = 0;
  let anthropicOutput = 0;
  console.log('[LLM Stream] Started reading response stream');
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('[LLM Stream] Complete, total chunks:', chunkCount, 'total length:', total.length);
      break;
    }
    chunkCount++;
    const chunkText = decoder.decode(value, { stream: true });
    buffer += chunkText;
    // OpenAI 用 \n\n 分隔；Anthropic 也类似
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 保留未完整行
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let data = '';
      if (isAnthropic) {
        // Anthropic: "event: content_block_delta\ndata: {...}"
        if (trimmed.startsWith('event:')) continue;
        if (!trimmed.startsWith('data:')) continue;
        data = trimmed.slice(5).trim();
      } else {
        if (!trimmed.startsWith('data:')) continue;
        data = trimmed.slice(5).trim();
      }
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        // 埋点 3/3 采集：统计帧不带正文，采完照常往下走 delta 解析（会天然跳过）
        if (isAnthropic) {
          if (json.type === 'message_start' && json.message?.usage) {
            anthropicInput = json.message.usage.input_tokens || 0;
            anthropicCacheRead = json.message.usage.cache_read_input_tokens || 0;
            anthropicCacheWrite = json.message.usage.cache_creation_input_tokens || 0;
          } else if (json.type === 'message_delta' && json.usage) {
            anthropicOutput = json.usage.output_tokens || anthropicOutput;
          }
        } else if (json.usage) {
          streamUsage = json.usage;
        }
        let delta = '';
        if (isAnthropic) {
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            delta = json.delta.text || '';
          }
        } else {
          delta = json.choices?.[0]?.delta?.content || '';
        }
        if (delta) {
          total += delta;
          console.log('[LLM Stream] Delta received:', delta.length, 'chars, total:', total.length);
          await onDelta(delta);
        }
      } catch {
        // 忽略单行解析错误
      }
    }
  }
  // 埋点 3/3 落账：读完整个流才拿得到完整 usage。
  // 全零一律视作 provider 没回传，宁可不记也不写假数据——记 0 会把命中率算高。
  const streamScene = options.scene || 'aux';
  if (isAnthropic) {
    if (anthropicInput || anthropicOutput || anthropicCacheRead) {
      recordAnthropicUsage(
        model,
        {
          input_tokens: anthropicInput,
          output_tokens: anthropicOutput,
          cache_read_input_tokens: anthropicCacheRead,
          cache_creation_input_tokens: anthropicCacheWrite,
        },
        streamScene,
      );
    } else {
      console.warn('[usage] 流式未取到 usage（Anthropic 分支），本次不记账');
    }
  } else if (streamUsage) {
    recordOpenAIUsage(model, streamUsage, streamScene);
  } else {
    console.warn('[usage] 流式未取到 usage（OpenAI 兼容分支），本次不记账');
  }
  return total;
}
