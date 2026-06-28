'use client';

import { useState, useCallback } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import type { CharacterState } from '@/lib/xianxia/store';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface DeathGuidancePanelProps {
  character: CharacterState;
  defaultCollapsed?: boolean;
}

function isDeadLike(ch: CharacterState | null): boolean {
  if (!ch || typeof ch !== 'object') return false;
  if (ch.alive === false) return true;
  if (ch.dead === true) return true;
  if (typeof ch.causeOfDeath === 'string' && ch.causeOfDeath.trim().length > 0) return true;
  if (ch.ascended === true) return true;
  return false;
}

function describeEndingAge(ch: CharacterState): string {
  const era = (useGameStore.getState().worldCalendar?.eraName) || '青岚仙历';
  const year = useGameStore.getState().worldCalendar?.calendarYear || 0;
  return `${era}${year}年 · ${ch.age || 0}岁`;
}

export function DeathGuidancePanel({ character, defaultCollapsed = false }: DeathGuidancePanelProps) {
  const deathGuidanceDismissed = useGameStore((s) => s.deathGuidanceDismissed);
  const dismissDeathGuidance = useGameStore((s) => s.dismissDeathGuidance);
  const selectNextProtagonistAndContinue = useGameStore((s) => s.selectNextProtagonistAndContinue);
  const resetCharacterToMortalStart = useGameStore((s) => s.resetCharacterToMortalStart);

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [busy, setBusy] = useState<null | '轮回重开' | '回归入凡'>(null);
  const [hint, setHint] = useState<string | null>(null);

  // P1 修复: 死亡时最容易丢存档,在面板顶部也展示自动存档失败的红条
  // 通过 store 直接读最新 snapshot(避免闭包陷阱: 玩家死亡瞬间字符对象可能被替换)
  // P1 双写修复：不再调 useAutoSave，只从全局 store 读 lastAutoSaveError（避免 3 实例双写）
  const autoSaveError = useGameStore((s) => s.lastAutoSaveError);
  const clearAutoSaveError = useCallback(() => {
    useGameStore.getState().setLastAutoSaveError(null);
  }, []);

  if (!isDeadLike(character)) return null;
  if (deathGuidanceDismissed) return null;

  const cause = (typeof character.causeOfDeath === 'string' && character.causeOfDeath.trim())
    ? character.causeOfDeath.trim()
    : '寿终正寝 · 道消身殒';
  const eraLine = describeEndingAge(character);
  const isAscend = character.ascended === true;

  const handleReincarnate = () => {
    if (busy) return;
    setBusy('轮回重开');
    setHint(null);
    try {
      const res = selectNextProtagonistAndContinue();
      if (res && res.ok === true) {
        setHint(null);
      } else {
        setHint((res && res.narrative) || '无可继承之人，仙路轮转暂止。');
      }
    } catch (e) {
      setHint('传承评定未果，暂且按下。');
    } finally {
      setBusy(null);
    }
  };

  const handleResetToMortal = () => {
    if (busy) return;
    setBusy('回归入凡');
    setHint(null);
    try {
      resetCharacterToMortalStart();
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = () => {
    if (busy) return;
    dismissDeathGuidance();
  };

  return (
    <section
      className="rich-panel"
      data-testid="death-guidance-panel"
      style={{
        border: '1px solid #b8814a',
        borderRadius: '8px',
        background: 'linear-gradient(180deg, rgba(255,247,232,0.96), rgba(252,240,214,0.94))',
        margin: '12px 0',
        padding: '12px 14px',
        boxShadow: '0 1px 0 rgba(184,129,74,0.15) inset',
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
        <span style={{ marginRight: '8px', fontSize: '13px', color: '#7a3a18' }}>
          {collapsed ? '▸' : '▾'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#5a2410' }}>
          {isAscend ? '飞升证道 · 此生已尽' : '魂归道山 · 此生已尽'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8a4a28' }}>
          {eraLine}
        </span>
      </div>

      {autoSaveError && (
        <Alert
          variant="destructive"
          data-testid="death-guidance-autosave-error"
          style={{ marginTop: '10px' }}
        >
          <AlertTitle>上次自动存档失败</AlertTitle>
          <AlertDescription>
            角色年龄 {autoSaveError.age} 岁时自动存档失败（{autoSaveError.reason}）：{autoSaveError.error}
            <div style={{ marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => clearAutoSaveError()}
                style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  border: '1px solid currentColor',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                知道了
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!collapsed && (
        <div style={{ marginTop: '10px' }}>
          <div
            className="rich-card"
            style={{
              padding: '10px 12px',
              border: '1px solid #e8d2a8',
              borderRadius: '6px',
              background: 'rgba(255,253,247,0.7)',
              fontSize: '13px',
              color: '#4a2a14',
              lineHeight: 1.6,
            }}
          >
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#7a3a18', marginRight: '6px' }}>陨落因由</span>
              <span>{cause}</span>
            </div>
            <div>
              <span style={{ color: '#7a3a18', marginRight: '6px' }}>终年</span>
              <span>{eraLine}</span>
            </div>
            {hint && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderLeft: '2px solid #b8814a',
                  background: 'rgba(184,129,74,0.08)',
                  color: '#5a2410',
                  fontSize: '12px',
                }}
              >
                {hint}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#7a5a3a',
              letterSpacing: '0.04em',
            }}
          >
            道途未绝，择一续缘：
          </div>

          <div
            className="rich-button-row"
            style={{
              marginTop: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            <button
              type="button"
              className="rich-button"
              data-testid="death-guidance-reincarnate"
              onClick={handleReincarnate}
              disabled={busy !== null}
              style={{
                padding: '10px 8px',
                borderRadius: '6px',
                border: '1px solid #b8814a',
                background: busy === '轮回重开' ? '#f4dfb6' : '#fff5dc',
                color: '#5a2410',
                fontSize: '13px',
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                lineHeight: 1.3,
              }}
            >
              轮回重开
              <div style={{ fontSize: '10px', fontWeight: 400, color: '#7a4a28', marginTop: '2px' }}>
                承继衣钵，再世修真
              </div>
            </button>

            <button
              type="button"
              className="rich-button"
              data-testid="death-guidance-reset"
              onClick={handleResetToMortal}
              disabled={busy !== null}
              style={{
                padding: '10px 8px',
                borderRadius: '6px',
                border: '1px solid #b8814a',
                background: busy === '回归入凡' ? '#f4dfb6' : '#fff5dc',
                color: '#5a2410',
                fontSize: '13px',
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                lineHeight: 1.3,
              }}
            >
              回归入凡
              <div style={{ fontSize: '10px', fontWeight: 400, color: '#7a4a28', marginTop: '2px' }}>
                散尽修为，重新投胎
              </div>
            </button>

            <button
              type="button"
              className="rich-button"
              data-testid="death-guidance-observe"
              onClick={handleDismiss}
              disabled={busy !== null}
              style={{
                padding: '10px 8px',
                borderRadius: '6px',
                border: '1px solid #d8b888',
                background: '#fefcf5',
                color: '#5a3a18',
                fontSize: '13px',
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                lineHeight: 1.3,
              }}
            >
              继续旁观
              <div style={{ fontSize: '10px', fontWeight: 400, color: '#7a5a3a', marginTop: '2px' }}>
                收敛此篇，留待后人
              </div>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}