'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  listSaveSlots, readSaveSlot, writeSaveSlot, deleteSaveSlot,
  exportSaveSlot, importSaveSlot, summarizeCharacterForSlot,
  SAVE_SLOT_LIMIT, type SaveSlotMeta, type SlotId,
} from '@/lib/xianxia/save-slots';
import { useGameStore } from '@/lib/xianxia/store';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface Props {
  // Snapshot of current persistable state from the page.
  snapshot: any;
  // Optional human-readable name for the slot (e.g. auto-save vs manual).
  defaultSlotName?: (slotId: SlotId) => string;
  // Callback fired after a slot is loaded; page can re-hydrate the store.
  onLoadSlot?: (payload: any, meta: SaveSlotMeta) => void;
  // Force a refresh signal (e.g. character.age changes).
  refreshKey?: number;
}

export function SaveSlotPanel(props: Props) {
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // P1 修复: 订阅全局 store 的自动存档失败状态（不再本地 useAutoSave，避免 3 组件实例双写）
  const autoSaveError = useGameStore((s) => s.lastAutoSaveError);
  const clearAutoSaveError = useCallback(() => {
    useGameStore.getState().setLastAutoSaveError(null);
  }, []);

  const refresh = useCallback(() => {
    setSlots(listSaveSlots());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, props.refreshKey]);

  const character = props.snapshot?.character;

  const handleSave = (slotId: SlotId) => {
    setBusy(true); setMsg(null);
    try {
      const summary = summarizeCharacterForSlot(character);
      const wc = props.snapshot?.worldCalendar ?? {};
      const result = writeSaveSlot(slotId, props.snapshot, {
        name: props.defaultSlotName?.(slotId) ?? (slotId === 3 ? '自动档' : `手动档 ${slotId}`),
        savedAt: new Date().toISOString(),
        savedAge: summary.age,
        savedCalendarYear: typeof wc.calendarYear === 'number' ? wc.calendarYear : 0,
        savedRealm: summary.realm,
        characterName: summary.name,
        eraName: typeof wc.eraName === 'string' ? wc.eraName : '',
        eventsCount: Array.isArray(props.snapshot?.events) ? props.snapshot.events.length : 0,
        isAutoSave: slotId === 3,
      });
      if (!result.ok) {
        // P1 关键修复: 失败时不再显示"已存档"误导文案
        const errMsg = result.error || '存储空间不足或浏览器拒绝了写入';
        setMsg(`存档失败：${errMsg}`);
        try { toast.error(`存档失败：${errMsg}`); } catch { /* sonner not ready */ }
        return;
      }
      const meta = result.meta;
      setMsg(`已存档到槽 ${slotId}：${meta.characterName}（${meta.savedRealm}）`);
      try { toast.success(`已存档到槽 ${slotId}`); } catch { /* sonner not ready */ }
      // 手动存档成功一次,顺手清掉自动存档残留错误,让顶部红条消失
      if (autoSaveError) clearAutoSaveError();
      refresh();
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      setMsg(`存档失败：${errMsg}`);
      try { toast.error(`存档失败：${errMsg}`); } catch { /* sonner not ready */ }
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = (slotId: SlotId) => {
    const slot = readSaveSlot(slotId);
    if (!slot) { setMsg(`槽 ${slotId} 为空`); return; }
    if (props.onLoadSlot) {
      props.onLoadSlot(slot.payload, slot.meta);
      setMsg(`已读取槽 ${slotId}：${slot.meta.characterName}（${slot.meta.savedRealm}）`);
    } else {
      setMsg('当前页未提供读取回调');
    }
  };

  const handleDelete = (slotId: SlotId) => {
    if (typeof window !== 'undefined' && !window.confirm(`确认删除槽 ${slotId}？`)) return;
    deleteSaveSlot(slotId);
    refresh();
    setMsg(`已删除槽 ${slotId}`);
  };

  const handleExport = (slotId: SlotId) => {
    const json = exportSaveSlot(slotId);
    if (!json) { setMsg(`槽 ${slotId} 为空`); return; }
    if (typeof window === 'undefined') return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xianxia-save-${slotId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg(`已导出槽 ${slotId}`);
  };

  const handleImport = (slotId: SlotId) => {
    if (typeof window === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = (ev: any) => {
      const file = ev?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const meta = importSaveSlot(text, slotId);
        if (meta) { refresh(); setMsg(`已导入到槽 ${slotId}：${meta.characterName}`); }
        else { setMsg('导入失败：JSON 不合法'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const slotMetas: SlotId[] = [1, 2, 3];

  return (
    <section className="rich-panel" data-testid="save-slot-panel" style={{ padding: '16px', border: '1px solid #d4b478', borderRadius: '8px', background: 'rgba(255,253,247,0.92)', margin: '12px 0' }}>
      <div className="rich-panel-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#5a3a18' }}>
        轮回手札 · 存档
      </div>
      {autoSaveError && (
        <Alert
          variant="destructive"
          data-testid="save-slot-autosave-error"
          style={{ marginBottom: '12px' }}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {slotMetas.map((id) => {
          const meta = slots.find((m) => m.slotId === id);
          return (
            <div key={id} data-testid={`save-slot-${id}`} style={{ border: '1px solid #e8d8b8', borderRadius: '6px', padding: '10px', background: meta?.isAutoSave ? '#fff7e6' : '#fefcf5' }}>
              <div style={{ fontSize: '12px', color: '#8a6633', marginBottom: '4px' }}>槽 {id}{meta?.isAutoSave ? '（自动）' : ''}</div>
              {meta ? (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#3a2818' }}>{meta.characterName}</div>
                  <div style={{ fontSize: '11px', color: '#7a5a3a', marginBottom: '6px' }}>{meta.savedRealm} · {meta.savedAge}岁</div>
                  <div style={{ fontSize: '10px', color: '#9a7a5a', marginBottom: '8px' }}>
                    {new Date(meta.savedAt).toLocaleString('zh-CN')}<br />
                    {meta.eraName} {meta.savedCalendarYear} · 事件 {meta.eventsCount} 条
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <button onClick={() => handleLoad(id)} disabled={busy} style={{ fontSize: '11px', padding: '3px 8px' }}>读取</button>
                    <button onClick={() => handleSave(id)} disabled={busy || !character} style={{ fontSize: '11px', padding: '3px 8px' }}>覆盖</button>
                    <button onClick={() => handleExport(id)} disabled={busy} style={{ fontSize: '11px', padding: '3px 8px' }}>导出</button>
                    <button onClick={() => handleDelete(id)} disabled={busy} style={{ fontSize: '11px', padding: '3px 8px' }}>删</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: '#bfa07a', marginBottom: '8px', fontStyle: 'italic' }}>空白</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <button onClick={() => handleSave(id)} disabled={busy || !character} style={{ fontSize: '11px', padding: '3px 8px' }}>{character ? '存档' : '需先有角色'}</button>
                    <button onClick={() => handleImport(id)} disabled={busy} style={{ fontSize: '11px', padding: '3px 8px' }}>导入</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {msg && <div style={{ marginTop: '10px', fontSize: '12px', color: '#6a4a2a' }}>{msg}</div>}
    </section>
  );
}
