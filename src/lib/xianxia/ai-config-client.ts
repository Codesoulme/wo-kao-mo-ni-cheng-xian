export async function ensureAIConfigured() {
  const res = await fetch('/api/ai-config', { cache: 'no-store' });
  const data = await res.json();
  if (!data.configured) {
    throw new Error('请先配置 AI 接口；未配置时无法生成后续剧情。');
  }
  return data;
}
