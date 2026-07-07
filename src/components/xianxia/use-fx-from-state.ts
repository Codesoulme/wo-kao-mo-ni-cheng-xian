'use client';

// 沉浸版 Phase-Z: 把 character 上的"瞬时事件"翻译成 FxEvent，自动 emit。
// 字段：__lastAnnualGrowth / __lastBreakthrough / __lastAchievements / __lastHeritageAdditions
// 调用方在 useEffect 里 watch character 即可。

import { useEffect, useRef } from 'react';
import { emitFxs, fxId, type FxEvent } from './fx-store';

export interface FxFromStateInput {
  character: any;
  // 可选：前一次触发过的 achievement id 集合（同会话去重 + 防止 SSR 重复 emit）
  alreadyEmittedAchievements?: Set<string>;
  // 可选：上次破境 realm（去重，避免同 realm 反复 emit）
  lastSeenBreakthroughRealm?: string | null;
  onBreakthroughSeen?: (toRealm: string) => void;
}

export function useFxFromCharacter(input: FxFromStateInput): void {
  const {
    character,
    alreadyEmittedAchievements,
    lastSeenBreakthroughRealm,
    onBreakthroughSeen,
  } = input;
  const lastAgeRef = useRef<number>(character?.age ?? 0);
  const alreadyRef = useRef<Set<string>>(alreadyEmittedAchievements ?? new Set<string>());

  useEffect(() => {
    if (!character) return;
    const events: FxEvent[] = [];

    // 1. 主角年度属性成长 → 飘字
    const growth = character.__lastAnnualGrowth;
    if (growth && typeof growth === 'object') {
      const map: { key: string; label: string; tone: 'emerald' | 'rose' | 'amber' | 'sky' }[] = [
        { key: 'attack',  label: '攻',   tone: 'emerald' },
        { key: 'defense', label: '防',   tone: 'emerald' },
        { key: 'speed',   label: '速',   tone: 'emerald' },
        { key: 'spiritualSense',     label: '神识', tone: 'sky' },
        { key: 'soulStrength',       label: '魂魄', tone: 'sky' },
        { key: 'physicalFoundation', label: '体魄', tone: 'sky' },
        { key: 'force',   label: '破势', tone: 'amber' },
        { key: 'guard',   label: '护持', tone: 'amber' },
        { key: 'agility', label: '机变', tone: 'amber' },
      ];
      for (const m of map) {
        const v = Number(growth[m.key]);
        if (!v || v === 0) continue;
        events.push({
          id: fxId('delta-main'),
          kind: 'delta',
          label: m.label,
          value: v,
          origin: 'main',
          tone: m.tone,
        });
      }
    }

    // 2. 境界突破 → 过场
    const br = character.__lastBreakthrough;
    if (br && br.toRealm && br.toRealm !== lastSeenBreakthroughRealm) {
      events.push({
        id: fxId('breakthrough'),
        kind: 'breakthrough',
        fromRealm: br.fromRealm,
        toRealm: br.toRealm,
        triggeredAge: Number(character.age ?? 0),
      });
      if (onBreakthroughSeen) onBreakthroughSeen(br.toRealm);
    }

    // 3. AI 成就达成 → toast
    const achievements = character.__lastAchievements;
    if (Array.isArray(achievements) && achievements.length > 0) {
      for (const a of achievements) {
        if (!a || !a.id) continue;
        if (alreadyRef.current.has(a.id)) continue;
        alreadyRef.current.add(a.id);
        const reward = a.reward || {};
        events.push({
          id: fxId('achievement'),
          kind: 'achievement',
          achievementId: a.id,
          name: a.name,
          bucket: a.bucket,
          rewardName: reward.name || '传承之物',
          rewardRarity: reward.rarity || 'common',
        });
      }
    }

    // 4. 稀有物品掉落 → 全屏光柱
    const drops = character.__lastDrops;
    if (Array.isArray(drops) && drops.length > 0) {
      for (const d of drops) {
        if (!d || !d.name) continue;
        const rarity = ['rare','epic','legendary','mythic'].includes(String(d.rarity)) ? d.rarity : 'rare';
        events.push({
          id: fxId('drop'),
          kind: 'drop',
          name: String(d.name),
          rarity: rarity as any,
          category: String(d.category ?? ''),
        });
      }
    }

    if (events.length > 0) emitFxs(events);

    // 5. 自动清理已消费字段，避免下次 useEffect 重复触发
    if (events.length > 0 && typeof character === 'object') {
      try {
        delete (character as any).__lastAnnualGrowth;
        delete (character as any).__lastBreakthrough;
        delete (character as any).__lastAchievements;
        delete (character as any).__lastDrops;
      } catch {}
    }

    lastAgeRef.current = Number(character.age ?? lastAgeRef.current);
  }, [character?.age, character?.realm, character?.__lastBreakthrough?.toRealm, character?.__lastAchievements, character?.__lastDrops]);
}