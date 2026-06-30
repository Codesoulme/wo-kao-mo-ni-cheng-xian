export async function ensureAIConfigured() {
  const res = await fetch('/api/ai-config', { cache: 'no-store' });
  const data = await res.json();
  if (!data.configured) {
    throw new Error('请先配置 AI 接口；这是 AI 驱动游戏，未配置时无法正常生成剧情。');
  }
  return data;
}
