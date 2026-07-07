'use client';

// 沉浸版 Phase-Z: 全局特效层（飘字 / 突破过场 / 稀有掉落光柱 / 成就达成）
// 任意处 emitFxs([...]) 即可弹出，FxLayer 顶层 portal 渲染。
// 不用 framer-motion，只用 CSS keyframes + setTimeout，零依赖、低延迟。

import { create } from 'zustand';

export type FxKind = 'delta' | 'breakthrough' | 'drop' | 'achievement';

export interface FxDelta {
  id: string;
  kind: 'delta';
  label: string;        // 攻 / 防 / 速 / 血 / 神识 / 体魄 / 魂魄 / 破势 / 护持 / 机变
  value: number;        // 正负
  origin?: 'main' | 'npc';
  tone?: 'emerald' | 'rose' | 'amber' | 'sky';
}

export interface FxBreakthrough {
  id: string;
  kind: 'breakthrough';
  fromRealm?: string;
  toRealm: string;
  triggeredAge: number;
}

export interface FxDrop {
  id: string;
  kind: 'drop';
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  category?: string;
}

export interface FxAchievement {
  id: string;
  kind: 'achievement';
  achievementId: string;
  name: string;
  bucket?: string;
  rewardName: string;
  rewardRarity: string;
}

export type FxEvent = FxDelta | FxBreakthrough | FxDrop | FxAchievement;

interface FxState {
  events: FxEvent[];
  push: (e: FxEvent | FxEvent[]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useFxStore = create<FxState>((set) => ({
  events: [],
  push: (e) => set((s) => ({
    events: Array.isArray(e) ? [...s.events, ...e] : [...s.events, e],
  })),
  remove: (id) => set((s) => ({ events: s.events.filter((x) => x.id !== id) })),
  clear: () => set({ events: [] }),
}));

// 便捷 helper：业务代码 import 后直接 push
export function emitFxs(events: FxEvent[]): void {
  if (!Array.isArray(events) || events.length === 0) return;
  useFxStore.getState().push(events);
}

// 唯一 ID 生成（前端无需 secure）
let _fxId = 0;
export function fxId(prefix = 'fx'): string {
  _fxId += 1;
  return `${prefix}-${Date.now().toString(36)}-${_fxId}`;
}