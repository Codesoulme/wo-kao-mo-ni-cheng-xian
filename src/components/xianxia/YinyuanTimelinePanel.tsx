'use client';

import { useMemo, useState } from 'react';
import { buildYinyuanTimeline, YINYUAN_LABELS, type YinyuanTimelineEntry } from '@/lib/xianxia/yinyuan-timeline';

interface Props {
  character: any;
  fateNodes?: any[];
  web?: any;
  defaultCollapsed?: boolean;
}

const ARCHETYPE_BADGE: Record<YinyuanTimelineEntry['archetype'], string> = {
  'resolved': '已了',
  'echo-active': '回响中',
  'predicted': '预兆',
  'untriggered': '伏笔',
};

export function YinyuanTimelinePanel({ character, fateNodes, web, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const entries = useMemo(
    () => buildYinyuanTimeline({ character, fateNodes, web }),
    [character?.age, character?.fateNodes, character?.pendingThreads, character?.npcs],
  );

  const hasCharacter = !!character && typeof character === 'object';

  return (
    <section
      data-testid="yinyuan-timeline-panel"
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
          因缘长河 · 命途时间线
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8a6633' }}>
          {entries.length} 段因缘
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '10px' }}>
          {!hasCharacter && (
            <div style={{ fontSize: '12px', color: '#9a7a5a', fontStyle: 'italic' }}>
              尚未有角色 · 待你落子后，此处将映出其因缘长河。
            </div>
          )}

          {hasCharacter && entries.length === 0 && (
            <div style={{ fontSize: '12px', color: '#9a7a5a', fontStyle: 'italic' }}>
              此生暂无因缘留痕 · 静待岁月酝酿。
            </div>
          )}

          {hasCharacter && entries.length > 0 && (
            <>
              <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '8px' }}>
                主角 · {character?.name ?? '无名'} · {character?.age ?? 0}岁 · {character?.realmName ?? character?.realm ?? character?.cultivation ?? '凡人'}
              </div>

              <div style={{ position: 'relative', paddingLeft: '20px' }}>
                {/* 时间轴竖线 */}
                <div style={{
                  position: 'absolute', left: '7px', top: '4px', bottom: '4px',
                  width: '2px', background: '#e8d8b8',
                }} />

                {entries.map((e, idx) => {
                  const color = YINYUAN_LABELS.COLOR[e.archetype];
                  const archetypeLabel = ARCHETYPE_BADGE[e.archetype];
                  return (
                    <div
                      key={`${e.archetype}-${idx}`}
                      data-testid={`yinyuan-${e.archetype}-${idx}`}
                      style={{ position: 'relative', marginBottom: '10px' }}
                    >
                      {/* 时间轴圆点 */}
                      <div style={{
                        position: 'absolute', left: '-20px', top: '6px',
                        width: '12px', height: '12px',
                        borderRadius: '50%', background: color,
                        border: '2px solid #fff',
                      }} />
                      <div style={{
                        border: `1px solid ${color}`,
                        borderRadius: '4px',
                        padding: '6px 8px',
                        background: '#fefcf5',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 500, fontSize: '13px', color: '#2a1c10' }}>
                            {e.title}
                          </span>
                          <span style={{
                            marginLeft: 'auto', fontSize: '10px', color: color,
                            border: `1px solid ${color}`, borderRadius: '3px',
                            padding: '0px 5px',
                          }}>
                            {archetypeLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#7a5a3a', marginBottom: '2px' }}>
                          {e.age}岁 · {YINYUAN_LABELS.URGENCY[e.urgency] || e.urgency}
                        </div>
                        <div style={{ fontSize: '11px', color: '#5a3a18' }}>
                          {e.narrative}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '8px', fontSize: '10px', color: '#9a7a5a', fontStyle: 'italic' }}>
                图例：已了（绿）=已了结之因缘 · 回响中（褐）=尚待回应的命途 · 预兆（紫）=未来可能 · 伏笔（灰）=尚未触发之节点。
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
