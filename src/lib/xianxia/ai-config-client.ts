export async function ensureAIConfigured() {
  const res = await fetch('/api/ai-config', { cache: 'no-store' });
  const data = await res.json();
  if (!data.configured) {
    throw new Error('请先立下天机通路；通路未立时，天道暂不能续写后续剧情。');
  }
  return data;
}
