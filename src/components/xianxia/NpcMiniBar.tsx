'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { toast } from 'sonner';

/**
 * NPC 谱 mini 卡：列出前 6 个关系最强的 NPC，
 * 点击 chip 用 sonner toast 显示亲疏档案 3 句。纯展示，不写 store。
 */

const ROLE_COLOR: Record<string, string> = {
  master: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
  teacher: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
  benefactor: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  savior: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  enemy: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
  rival: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
  friend: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  sworn: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  spouse: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  'dao-companion': 'bg-amber-500/10 text-amber-700 border-amber-500/30',
};

const ROLE_LABEL: Record<string, string> = {
  master: '师',
  teacher: '师',
  benefactor: '恩',
  savior: '恩',
  enemy: '敌',
  rival: '敌',
  friend: '友',
  sworn: '友',
  spouse: '道',
  'dao-companion': '道',
};

function roleClass(role?: string): string {
  if (!role) return 'bg-muted text-muted-foreground border-border';
  return ROLE_COLOR[role] || 'bg-muted text-muted-foreground border-border';
}

function roleTag(role?: string): string {
  if (!role) return '识';
  return ROLE_LABEL[role] || '识';
}

function buildProfile(npc: any): string {
  const affinity = typeof npc?.affinity === 'number' ? npc.affinity
    : typeof npc?.relationshipScore === 'number' ? npc.relationshipScore
    : 0;
  const role = typeof npc?.role === 'string' ? npc.role : '';
  const lastSeen = typeof npc?.lastSeenAge === 'number' ? npc.lastSeenAge : null;
  const desc = typeof npc?.description === 'string' && npc.description.trim().length > 0
    ? npc.description.trim()
    : '';
  const stance = affinity > 30 ? '情谊甚笃'
    : affinity > 0 ? '互有往来'
    : affinity === 0 ? '平平淡淡'
    : affinity > -30 ? '心生罅隙'
    : '势同水火';
  const roleText = role ? `（${role}）` : '';
  const seenText = lastSeen !== null ? `，上次相见于 ${lastSeen} 岁。` : '。';
  const flavor = desc
    ? `${desc}。`
    : `此人与道途相伴${seenText}`;
  return [
    `「${npc?.name || '未名'}」${roleText} · 亲疏 ${affinity > 0 ? '+' : ''}${affinity}`,
    `势态：${stance}${seenText}`,
    flavor,
  ].slice(0, 3).join('\n');
}

export function NpcMiniBar() {
  const character = useGameStore((s: any) => s.character);
  const top = useMemo(() => {
    const npcs = character && Array.isArray(character.npcs) ? character.npcs : [];
    const list = npcs.filter((n: any) => n && typeof n === 'object' && (n.name || n.id));
    list.sort((a: any, b: any) => {
      const aa = typeof a?.affinity === 'number' ? a.affinity : (typeof a?.relationshipScore === 'number' ? a.relationshipScore : 0);
      const bb = typeof b?.affinity === 'number' ? b.affinity : (typeof b?.relationshipScore === 'number' ? b.relationshipScore : 0);
      return Math.abs(bb) - Math.abs(aa);
    });
    return list.slice(0, 6);
  }, [character]);

  if (!character) return null;

  return (
    <section
      className="px-3 pt-1.5"
      data-section="npc-mini-bar"
      data-testid="npc-mini-bar"
    >
      <div className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-[9px] text-muted-foreground shrink-0 font-serif-cn">故人谱</span>
          {top.length === 0 ? (
            <span className="text-[10px] text-muted-foreground italic">尚无深交</span>
          ) : (
            top.map((npc: any, idx: number) => {
              const affinity = typeof npc?.affinity === 'number' ? npc.affinity
                : typeof npc?.relationshipScore === 'number' ? npc.relationshipScore
                : 0;
              const tag = roleTag(npc?.role);
              const cls = roleClass(npc?.role);
              return (
                <button
                  key={npc?.id || npc?.name || idx}
                  type="button"
                  className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-serif-cn transition-transform hover:scale-[1.03] active:scale-95 ${cls}`}
                  title={`亲疏 ${affinity > 0 ? '+' : ''}${affinity}`}
                  onClick={() => toast(buildProfile(npc), { duration: 6000 })}
                >
                  <span className="shrink-0">[{tag}]</span>
                  <span className="max-w-[80px] truncate">{npc?.name || '未名'}</span>
                  <span className="tabular-nums shrink-0 opacity-80">{affinity > 0 ? '+' : ''}{affinity}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}