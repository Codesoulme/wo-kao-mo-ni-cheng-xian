'use client';

import { useMemo, useState } from 'react';
import {
  listAvailableInheritance,
  summarizeInheritanceForDisplay,
  type CrossCycleInheritanceEntry,
} from '@/lib/xianxia/cross-cycle-inheritance';

interface Props {
  character: any;
  heritageVault?: any[];
  claimedPoolIds?: string[];
  defaultCollapsed?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  technique: '功法',
  artifact: '法宝',
  bond: '羁绊',
  bloodline: '血脉',
  sect: '宗统',
  token: '信物',
  unknown: '未明',
};

export function CrossCycleInheritancePanel({ character, heritageVault, claimedPoolIds, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const charAge = character?.age ?? 0;

  const entries = useMemo(
    () => listAvailableInheritance({
      heritageVault: heritageVault || character?.heritageVault || [],
      currentCharacterAge: charAge,
      claimedPoolIds: claimedPoolIds || character?.claimedPoolIds || [],
    }),
    [heritageVault, charAge, claimedPoolIds],
  );
  const summary = summarizeInheritanceForDisplay(entries);

  return (
    <section
      data-testid="cross-cycle-inheritance-panel"
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
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ marginRight: '8px', fontSize: '13px', color: '#5a3a18' }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#3a2818' }}>
          跨周目传承
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8a6633' }}>
          {summary.unlocked}/{summary.total} 可承
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '8px' }}>
            前世所留 · {summary.total} 项 · 可承 {summary.unlocked} · 已承 {summary.claimed} · 未解 {summary.locked}
            {summary.kinds.length > 0 ? ` · 含 ${summary.kinds.map((k) => KIND_LABEL[k] || k).join('、')}` : ''}
          </div>

          {entries.length === 0 && (
            <div style={{ fontSize: '12px', color: '#9a7a5a', fontStyle: 'italic' }}>
              此生尚无前世遗泽可承 · 或此为初世开局。
            </div>
          )}

          {entries.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {entries.map((e) => {
                const borderColor = e.isClaimed ? '#9bbf6c' : (e.isUnlocked ? '#c4a76d' : '#a89878');
                const bgColor = e.isClaimed ? '#f1f7e8' : (e.isUnlocked ? '#fefcf5' : '#f4ecd8');
                const statusText = e.isClaimed ? '已承' : (e.isUnlocked ? '可承' : `${e.lockedUntilAge}岁解`);
                return (
                  <div
                    key={e.poolId}
                    data-testid={`inheritance-item-${e.poolId}`}
                    style={{
                      border: `1px solid ${borderColor}`,
                      borderRadius: '4px',
                      padding: '6px 8px',
                      background: bgColor,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 500, fontSize: '12px', color: '#2a1c10' }}>
                        {e.poolName}
                      </span>
                      <span style={{
                        marginLeft: 'auto', fontSize: '10px', color: borderColor,
                        border: `1px solid ${borderColor}`, borderRadius: '3px', padding: '0px 5px',
                      }}>
                        {statusText}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#7a5a3a' }}>
                      {KIND_LABEL[e.kind] || e.kind} · 余 {e.availableSlots} 席 · 留于 {e.acquiredAtAge} 岁
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
