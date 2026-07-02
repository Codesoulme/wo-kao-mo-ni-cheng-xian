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

  // L11 信息流分层：合成一句告别遗言（用大字、文言）作为死亡瞬间主视觉。

  //   此字段不强行依赖 character.lastWords（老存档无此字段），

  //   仅以 isAscend / realm 拼出最简古风一句话，保持纯净 in-world 文案。

  const farewell = isAscend

    ? '道成圆满，此身归位天际。'

    : '道山归去，一脉相承，缘再续。';

  const realmName = (typeof character.realmName === 'string' && character.realmName)

    || (typeof character.realm === 'string' ? character.realm : '')

    || '凡人';



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

          <AlertTitle>上次落笔遇阻</AlertTitle>

          <AlertDescription>

            角色年龄 {autoSaveError.age} 岁时落笔遇阻（{autoSaveError.reason}）：{autoSaveError.error}

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

          {/* L11 死亡瞬间：默认可见 · 大字文言短句 · 仅年岁 + 死因 + 一句遗言 */}

          <div

            className="rich-card"

            data-testid="death-guidance-moment"

            style={{

              padding: '16px 14px',

              border: '1px solid #e8d2a8',

              borderRadius: '6px',

              background: 'rgba(255,253,247,0.7)',

              color: '#4a2a14',

              lineHeight: 1.6,

              textAlign: 'left',

            }}

          >

            <div

              style={{

                fontSize: '11px',

                color: '#7a3a18',

                letterSpacing: '0.06em',

                marginBottom: '6px',

              }}

            >

              {eraLine}

            </div>

            <div

              style={{

                fontSize: '11px',

                color: '#7a3a18',

                letterSpacing: '0.06em',

                marginBottom: '12px',

              }}

            >

              <span style={{ marginRight: '6px' }}>陨落因由</span>

              <span>{cause}</span>

            </div>

            <div

              data-testid="death-guidance-farewell"

              style={{

                fontSize: '20px',

                fontWeight: 500,

                color: '#5a2410',

                letterSpacing: '0.08em',

                fontFamily: 'inherit',

                lineHeight: 1.5,

              }}

            >

              {farewell}

            </div>

          </div>

          {/* L11 墓志铭：折叠态，默认收起，集中收纳境界/AI 评语/轮回入口 */}

          <details

            data-testid="death-guidance-epitaph"

            style={{

              marginTop: '12px',

              border: '1px solid #e8d2a8',

              borderRadius: '6px',

              background: 'rgba(255,253,247,0.55)',

              padding: '6px 12px',

            }}

          >

            <summary

              style={{

                cursor: 'pointer',

                fontSize: '12px',

                color: '#7a3a18',

                letterSpacing: '0.04em',

                listStyle: 'none',

                userSelect: 'none',

              }}

            >

              墓志铭 · 展开往昔

            </summary>

            <div style={{ marginTop: '10px' }}>

              <div

                style={{

                  fontSize: '12px',

                  color: '#7a5a3a',

                  letterSpacing: '0.04em',

                  marginBottom: '8px',

                }}

              >

                <span style={{ color: '#7a3a18', marginRight: '6px' }}>境界</span>

                <span>{realmName}</span>

              </div>

              {hint && (

                <div

                  style={{

                    marginBottom: '8px',

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

              <div

                style={{

                  marginTop: '4px',

                  marginBottom: '6px',

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

                  marginTop: '4px',

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

                    承继衣钵，再世修仙

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

          </details>

        </div>

      )}

    </section>

  );

}
