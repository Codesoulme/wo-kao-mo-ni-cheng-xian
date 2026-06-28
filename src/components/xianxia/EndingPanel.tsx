'use client';

import { useMemo, useState } from 'react';
import { previewEndingsForCharacter, ENDING_ARCHETYPE_LABELS, type EndingPreviewEntry } from '@/lib/xianxia/ending-preview';

interface Props {
  character: any;
  worldState?: any;
  defaultCollapsed?: boolean;
}

const TONE_COLOR: Record<EndingPreviewEntry['tone'], { bg: string; border: string; tag: string }> = {
  good:    { bg: '#f1f7e8', border: '#9bbf6c', tag: '吉相' },
  bad:     { bg: '#fbeaea', border: '#c87e7e', tag: '凶相' },
  neutral: { bg: '#f4ecd8', border: '#c4a76d', tag: '平常' },
  mystery: { bg: '#ece4f7', border: '#9a82c2', tag: '莫测' },
};

export function EndingPanel({ character, worldState, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const entries = useMemo(
    () => previewEndingsForCharacter(character, worldState),
    [character?.age, character?.realm, character?.faction, character?.causeOfDeath, worldState?.calendarYear],
  );

  const hasCharacter = !!character && typeof character === 'object';

  return (
    <section
      data-testid="ending-panel"
      style={{
        border: '1px solid #d4b478',
        borderRadius: '8px',
        background: 'rgba(255,253,247,0.94)',
        margin: '12px 0',
        padding: '12px 14px',
      }}
    >
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ marginRight: '8px', fontSize: '13px', color: '#5a3a18' }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#3a2818' }}>
          命途终章 · 结局谱
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8a6633' }}>
          {entries.length} 种归处
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '10px' }}>
          {!hasCharacter && (
            <div style={{ fontSize: '12px', color: '#9a7a5a', fontStyle: 'italic' }}>
              尚未有角色 · 待你落子后，此处将映出其命途八种归处。
            </div>
          )}

          {hasCharacter && (
            <>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '8px' }}>
                当前：{character?.name ?? '无名'} · {character?.realm ?? character?.cultivation ?? '凡人'} · {character?.age ?? 0}岁
                {character?.faction || character?.sect ? ` · ${character?.faction || character?.sect}` : ''}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {entries.map((e) => {
                  const c = TONE_COLOR[e.tone];
                  return (
                    <div
                      key={e.archetype}
                      data-testid={`ending-${e.archetype}`}
                      style={{
                        border: `1px solid ${c.border}`,
                        borderRadius: '6px',
                        padding: '8px 10px',
                        background: c.bg,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#2a1c10' }}>{e.label}</span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '10px',
                            color: c.border,
                            border: `1px solid ${c.border}`,
                            borderRadius: '4px',
                            padding: '1px 6px',
                          }}
                        >
                          {c.tag}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: '#5a3a18', marginBottom: '4px' }}>
                        <span style={{ marginRight: '4px' }}>机运</span>
                        <div style={{ flex: 1, height: '6px', background: '#e8d8b8', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(e.weight * 100)}%`, height: '100%', background: c.border }} />
                        </div>
                        <span style={{ marginLeft: '6px', fontVariantNumeric: 'tabular-nums' }}>
                          {(e.weight * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: '#5a3a18', marginBottom: '4px' }}>
                        <span style={{ marginRight: '4px' }}>进境</span>
                        <div style={{ flex: 1, height: '6px', background: '#e8d8b8', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${e.progress.overallPct}%`, height: '100%', background: '#8a6633' }} />
                        </div>
                        <span style={{ marginLeft: '6px', fontVariantNumeric: 'tabular-nums' }}>
                          {e.progress.overallPct}%
                        </span>
                      </div>

                      <div style={{ fontSize: '10px', color: '#7a5a3a' }}>
                        {e.progress.ageMet ? '✓年岁' : '○年岁'}
                        {' · '}
                        {e.progress.realmMet ? '✓境界' : '○境界'}
                        {e.progress.factionMet ? ' · ✓宗门' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#9a7a5a', fontStyle: 'italic' }}>
                机运 — 引擎基于年岁/境界/死因/宗门权重推算；进境 — 当前角色满足此结局的进度。两者皆为命途一隅，仅供参考。
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export const ENDING_TONE_COLOR = TONE_COLOR;
