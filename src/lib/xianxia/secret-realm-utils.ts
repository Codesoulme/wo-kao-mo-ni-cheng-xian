export function normalizeRealmRequirementText(text: string): string {
  return String(text || '').replace(/[\s·•，。；、：:！!？?「」『』“”\"'（）()\[\]【】]/g, '');
}

export function hasRealmEntryRequirement(
  state: { inventory?: any[]; equipped?: any[]; activeStatuses?: any[] },
  requirement?: string
): boolean {
  if (!requirement) return true;
  const req = normalizeRealmRequirementText(requirement);
  const entries = [...(state.inventory || []), ...(state.equipped || []), ...(state.activeStatuses || [])];
  const texts = entries.map((it: any) => normalizeRealmRequirementText(`${it.name || ''}${it.description || ''}${it.source || ''}`));
  if (texts.some(text => text.includes(req))) return true;
  if (req.includes('玉片')) return texts.some(text => text.includes('玉片') && (!req[0] || text.includes(req[0])));
  if (req.includes('信物')) return texts.some(text => /信物|玉片|钥|令牌|残图|符令|禁制/.test(text));
  return false;
}
