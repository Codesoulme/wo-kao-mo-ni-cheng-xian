// POST /api/game/market
// 坊市交易 API：列出、购买、出售物品，并写入隐藏审计。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  addItems,
  buildStateContext,
  dbToState,
  normalizeCultivationState,
  recordActionCausality,
  refreshWorldFacts,
  removeItemsByIds,
  stateToResponse,
} from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { generateMarketOfferings } from '@/lib/xianxia/llm';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { registerItem } from '@/lib/xianxia/content-registry';
// 批 16: market 路由接 Event Sourcing PoC — buy/sell 触发 spirit-stones.changed + item.added/removed
// appendEvent 失败不影响主流程；保留 ContentRegistry 校验 + 鉴权 + db.character.update 全部原逻辑。
import { appendEvent } from '@/lib/xianxia/events/store';
import type { AttributeChange } from '@/lib/xianxia/types';
import type { ValidationTrace } from '@/lib/xianxia/content-registry';

// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。
import { getCurrentUser } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MARKET_POOLS: Record<string, { name: string; description: string; item_type: string; rarity: string; basePrice: number; effects: any[] }[]> = {
  mortal_qi: [
    { name: '木剑', description: '寻常木剑，适合初学者防身。', item_type: 'weapon', rarity: 'common', basePrice: 5, effects: [{ target_attribute: 'attack', operation: 'add', value: 2, description: '木剑在手，攻击+2' }] },
    { name: '粗布甲', description: '粗布缝制，可略挡风寒。', item_type: 'armor', rarity: 'common', basePrice: 5, effects: [{ target_attribute: 'defense', operation: 'add', value: 1, description: '粗布护身，防御+1' }] },
    { name: '聚气散', description: '低阶丹药，可微增修为。', item_type: 'consumable', rarity: 'common', basePrice: 8, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 15, description: '聚气入体，修为+15' }] },
    { name: '疗伤丹', description: '常见疗伤丹药。', item_type: 'consumable', rarity: 'common', basePrice: 6, effects: [{ target_attribute: 'hp', operation: 'add', value: 30, description: '疗伤回气血+30' }] },
    { name: '木灵符', description: '一次性的护体灵符。', item_type: 'consumable', rarity: 'uncommon', basePrice: 15, effects: [{ target_attribute: 'maxHp', operation: 'add', value: 10, description: '木灵护体，气血上限+10' }] },
    { name: '小储物袋', description: '可额外容纳 10 件杂物。', item_type: 'tool', rarity: 'uncommon', basePrice: 30, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 10, description: '储物容量+10' }] },
    { name: '吐纳诀', description: '入门修炼法门。', item_type: 'scripture', rarity: 'common', basePrice: 20, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.3, description: '吐纳炼气，修为增长×1.3' }] },
    { name: '青珠', description: '清心静气的小珠，可稳固心神。', item_type: 'accessory', rarity: 'uncommon', basePrice: 25, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 5, description: '修炼+5/年' }, { target_attribute: 'luck', operation: 'add', value: 1, description: '机缘+1' }] },
  ],
  foundation: [
    { name: '青锋剑', description: '筑基修士常用法剑，带一丝灵光。', item_type: 'weapon', rarity: 'uncommon', basePrice: 80, effects: [{ target_attribute: 'attack', operation: 'add', value: 15, description: '锋锐+15' }] },
    { name: '灵纹甲', description: '刻有灵纹的轻甲。', item_type: 'armor', rarity: 'uncommon', basePrice: 70, effects: [{ target_attribute: 'defense', operation: 'add', value: 10, description: '防御+10' }] },
    { name: '筑元丹', description: '中阶丹药，温养根基。', item_type: 'consumable', rarity: 'uncommon', basePrice: 50, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 60, description: '修为+60' }] },
    { name: '大还丹', description: '中阶疗伤圣药。', item_type: 'consumable', rarity: 'uncommon', basePrice: 40, effects: [{ target_attribute: 'hp', operation: 'add', value: 100, description: '大还气血+100' }] },
    { name: '悟道茶', description: '清明心神，可短暂增悟。', item_type: 'consumable', rarity: 'rare', basePrice: 120, effects: [{ target_attribute: 'comprehension', operation: 'add', value: 2, description: '悟性+2' }] },
    { name: '中储物袋', description: '可额外容纳 30 件。', item_type: 'tool', rarity: 'rare', basePrice: 150, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 30, description: '储物容量+30' }] },
    { name: '灵息诀', description: '中阶功法。', item_type: 'scripture', rarity: 'uncommon', basePrice: 100, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.7, description: '修炼增长×1.7' }] },
    { name: '流光剑', description: '剑身如流光，出手迅疾。', item_type: 'weapon', rarity: 'rare', basePrice: 200, effects: [{ target_attribute: 'attack', operation: 'add', value: 30, description: '流光剑+30' }, { target_attribute: 'speed', operation: 'add', value: 5, description: '速度+5' }] },
  ],
  golden: [
    { name: '紫电剑', description: '蕴含紫电之力的法剑。', item_type: 'weapon', rarity: 'epic', basePrice: 800, effects: [{ target_attribute: 'attack', operation: 'add', value: 80, description: '紫电+80' }] },
    { name: '金丝法袍', description: '金丝织就，可避刀兵。', item_type: 'armor', rarity: 'epic', basePrice: 700, effects: [{ target_attribute: 'defense', operation: 'add', value: 50, description: '金丝护体+50' }] },
    { name: '九转大还丹', description: '高阶疗伤圣药。', item_type: 'consumable', rarity: 'epic', basePrice: 500, effects: [{ target_attribute: 'hp', operation: 'add', value: 500, description: '九转回春+500气血' }] },
    { name: '金髓丹', description: '淬炼金丹根基的丹药。', item_type: 'consumable', rarity: 'rare', basePrice: 300, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 200, description: '修为+200' }] },
    { name: '乾坤储物袋', description: '内有乾坤，可容纳 100 件。', item_type: 'tool', rarity: 'epic', basePrice: 1000, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 100, description: '储物容量+100' }] },
    { name: '太虚经', description: '高阶功法。', item_type: 'scripture', rarity: 'epic', basePrice: 800, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 3.5, description: '修炼增长×3.5' }] },
  ],
};

function getPoolForRealm(realm: string): any[] {
  if (['mortal', 'qi_refining'].includes(realm)) return MARKET_POOLS.mortal_qi;
  if (['foundation', 'golden_core'].includes(realm)) return [...MARKET_POOLS.mortal_qi, ...MARKET_POOLS.foundation];
  return [...MARKET_POOLS.mortal_qi, ...MARKET_POOLS.foundation, ...MARKET_POOLS.golden];
}

function generateMarketItems(realm: string): any[] {
  const pool = getPoolForRealm(realm);
  const count = 6 + Math.floor(Math.random() * 5);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((item, idx) => {
    const priceVariance = 0.8 + Math.random() * 0.4;
    return {
      id: `market_${Date.now().toString(36)}_${idx}`,
      name: item.name,
      description: item.description,
      item_type: item.item_type,
      rarity: item.rarity,
      price: Math.round(item.basePrice * priceVariance),
      effects: item.effects,
      source: '坊市',
    };
  });
}

function estimateValue(item: any): number {
  const rarityBase: Record<string, number> = {
    common: 5, uncommon: 20, rare: 80, epic: 300, legendary: 1000, mythic: 5000,
  };
  let base = rarityBase[item.rarity] || 5;
  if (item.effects?.some((e: any) => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) base *= 2;
  if (item.effects?.some((e: any) => e.target_attribute === 'storageCapacity')) {
    const capEff = item.effects.find((e: any) => e.target_attribute === 'storageCapacity');
    base += (capEff?.value || 0) * 3;
  }
  return base;
}

function persistableMarketStateData(state: ReturnType<typeof dbToState>) {
  return {
    age: state.age,
    lifespan: state.lifespan,
    realm: state.realm,
    realmLevel: state.realmLevel,
    cultivationExp: state.cultivationExp,
    expToBreak: state.expToBreak,
    elementMetal: state.elements.metal,
    elementWood: state.elements.wood,
    elementWater: state.elements.water,
    elementFire: state.elements.fire,
    elementEarth: state.elements.earth,
    hp: state.hp,
    maxHp: state.maxHp,
    mp: state.mp,
    maxMp: state.maxMp,
    attack: state.attack,
    defense: state.defense,
    speed: state.speed,
    luck: state.luck,
    comprehension: state.comprehension,
    spiritStones: state.spiritStones,
    reputation: state.reputation,
    alive: state.alive,
    ascended: state.ascended,
    causeOfDeath: state.causeOfDeath || '',
    faction: state.faction,
    master: state.master,
    location: state.location,
    fateNodes: state.fateNodes.join(','),
    isAtChoice: state.isAtChoice,
    lastEventAge: state.lastEventAge,
    statusJson: JSON.stringify(state.activeStatuses),
    inventoryJson: JSON.stringify(state.inventory || []),
    equippedJson: JSON.stringify(state.equipped || []),
    storageCapacity: state.storageCapacity ?? 5,
    cultivationMultiplier: state.cultivationMultiplier ?? 1.0,
    cultivationInsight: state.cultivationInsight || '',
    cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
    memoryJson: JSON.stringify(state.longTermMemory || []),
    pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
    characterIntentsJson: JSON.stringify(state.characterIntents || []),
    combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
    npcsJson: JSON.stringify(state.npcs || []),
    causalGraphJson: JSON.stringify(state.causalGraph || { nodes: [], edges: [] }),
    worldFactsJson: JSON.stringify(state.worldFacts || []),
    heartDemon: state.heartDemon ?? 0,
    petsJson: JSON.stringify(state.pets || []),
    exploredRealmsJson: JSON.stringify(state.exploredRealms || []),
  };
}

function snapshotState(state: ReturnType<typeof dbToState>) {
  return {
    ...state,
    inventory: [...(state.inventory || [])],
    equipped: [...(state.equipped || [])],
    activeStatuses: [...(state.activeStatuses || [])],
    pendingThreads: [...(state.pendingThreads || [])],
    worldFacts: [...(state.worldFacts || [])],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body?.characterId;
    const action = body?.action;
    const itemId = body?.itemId;

    if (!characterId || !action) {
      return NextResponse.json({ success: false, error: '缺少 characterId 或 action' }, { status: 400 });
    }

    const isProdMode = !!process.env.ADMIN_TOKEN;
    let user: { id: string } | null = null;
    if (isProdMode) {
      user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const char = await db.character.findUnique({ where: { id: characterId, userId: user?.id } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    if (char.isAtChoice) {
      return NextResponse.json({ success: false, error: '当前还有未处理的抉择，请先完成决定' }, { status: 400 });
    }
    if (char.combatStateJson) {
      try {
        const sess = JSON.parse(char.combatStateJson);
        if (sess && sess.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗尚未结束，无法前往坊市' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }

    let state = dbToState(char as any);

    if (action === 'list') {
      let items = generateMarketItems(state.realm);
      try {
        const recentDb = await db.eventLog.findMany({ where: { characterId }, orderBy: { age: 'desc' }, take: 3 });
        const recent = recentDb.reverse().map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType }));
        const aiMarket = await generateMarketOfferings(buildStateContext(state, recent));
        if (aiMarket?.items?.length) items = aiMarket.items;
      } catch (err: any) {
        console.error('market AI offerings failed, fallback to pool:', err?.message || err);
      }
      const sellable = state.inventory.map(it => ({
        ...it,
        sellPrice: Math.max(1, Math.floor(estimateValue(it) * 0.6)),
      }));
      return NextResponse.json({
        success: true,
        marketItems: items,
        sellableItems: sellable,
        playerSpiritStones: state.spiritStones,
        storageCapacity: state.storageCapacity,
        inventoryCount: state.inventory.length,
      });
    }

    const before = snapshotState(state);
    const contentRegistryTrace: ValidationTrace[] = [];
    const contentRegistryWarnings: string[] = [];
    const effectResolveTrace: any[] = [];
    const appliedChanges: AttributeChange[] = [];
    let title = '';
    let narrative = '';
    let newItems: any[] = [];
    let removedItemIds: string[] = [];

    if (action === 'buy') {
      if (!itemId) return NextResponse.json({ success: false, error: '缺少 itemId' }, { status: 400 });
      const itemToBuy = body?.item;
      if (!itemToBuy || !itemToBuy.name || !itemToBuy.price) {
        return NextResponse.json({ success: false, error: '购买时需传入 item 对象（含 name/price/effects）' }, { status: 400 });
      }
      const price = Number(itemToBuy.price);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ success: false, error: '价格不合法' }, { status: 400 });
      }
      if (state.spiritStones < price) {
        return NextResponse.json({ success: false, error: `灵石不足，需 ${price} 灵石` }, { status: 400 });
      }
      if (state.inventory.length >= state.storageCapacity) {
        return NextResponse.json({ success: false, error: '储物空间不足，无法购买' }, { status: 400 });
      }

      const rawItem = {
        id: `item_buy_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: itemToBuy.name,
        description: itemToBuy.description || '',
        item_type: itemToBuy.item_type,
        rarity: itemToBuy.rarity,
        effects: itemToBuy.effects || [],
        source: '坊市购得',
      };
      const registered = registerItem(rawItem, {
        source: 'market-buy',
        age: state.age,
        existingIds: [...state.inventory, ...(state.equipped || [])].map(item => item.id),
      });
      contentRegistryTrace.push(...registered.trace);
      contentRegistryWarnings.push(...registered.warnings);
      if (!registered.ok || !registered.content) {
        return NextResponse.json({ success: false, error: registered.rejectedReason || '物品登记失败', contentRegistryWarnings }, { status: 400 });
      }

      state = { ...state, spiritStones: state.spiritStones - price };
      state = addItems(state, [registered.content]);
      state = normalizeCultivationState(state);
      state = refreshWorldFacts(state, 'market-buy');
      newItems = [registered.content];
      state = recordActionCausality(state, {
        actionId: `market_buy_${state.age}_${registered.content.id}`,
        actionType: 'trade',
        title: `坊市购得${registered.content.name}`,
        summary: `以 ${price} 枚灵石购得${registered.content.name}`,
        tags: ['market', 'buy'],
        newItems,
      });
      appliedChanges.push(
        { attribute: 'spiritStones', delta: -price, reason: `购入${registered.content.name}` },
        { attribute: 'inventory', delta: 1, reason: `购入${registered.content.name}` } as any,
      );
      title = `坊市·购得${registered.content.name}`;
      narrative = `在坊市购得“${registered.content.name}”，耗去灵石 ${price} 枚。`;

      const stateChangeLog = buildStateChangeLog({ before, after: state, appliedChanges, rejectedChanges: [], contentRegistryTrace, effectResolveTrace, aiBoundaryTrace: [] });
      const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges, newItems });
      const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

      // Event Sourcing PoC: buy 触发 spirit-stones.changed + item.added。
      // 失败不阻断主流程——appendEvent 在 db.character.update 之前写入事件流。
      try {
        await appendEvent({
          characterId,
          type: 'character.spirit-stones.changed',
          data: { type: 'character.spirit-stones.changed', delta: -price, newValue: state.spiritStones, reason: 'market-buy' },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
        await appendEvent({
          characterId,
          type: 'character.item.added',
          data: { type: 'character.item.added', itemId: registered.content.id, item: registered.content },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
      } catch (evtErr: any) {
        console.error('[market] buy event append failed (non-fatal):', evtErr?.message || evtErr);
      }

      await db.character.update({ where: { id: characterId, userId: user?.id }, data: persistableMarketStateData(state) });
      await db.eventLog.create({ data: { characterId, age: state.age, title, narrative, eventType: 'trade', effects: JSON.stringify(effectsWithAudit) } });

      return NextResponse.json({
        success: true,
        message: `买下 ${registered.content.name}，花费 ${price} 灵石`,
        boughtItem: registered.content,
        price,
        contentRegistryWarnings,
        stateChangeLog,
        state: stateToResponse(state),
      });
    }

    if (action === 'sell') {
      if (!itemId) return NextResponse.json({ success: false, error: '缺少 itemId' }, { status: 400 });
      const item = state.inventory.find(it => it.id === itemId);
      if (!item) return NextResponse.json({ success: false, error: '物品不在储物袋中' }, { status: 400 });
      const sellPrice = Math.max(1, Math.floor(estimateValue(item) * 0.6));
      const removed = removeItemsByIds(state, [itemId]);
      state = removed.state;
      effectResolveTrace.push(...(removed.effectResolveTrace || []));
      state = { ...state, spiritStones: state.spiritStones + sellPrice };
      state = normalizeCultivationState(state);
      state = refreshWorldFacts(state, 'market-sell');
      removedItemIds = [itemId];
      state = recordActionCausality(state, {
        actionId: `market_sell_${state.age}_${item.id}`,
        actionType: 'trade',
        title: `坊市售出${item.name}`,
        summary: `售出${item.name}，换得 ${sellPrice} 枚灵石`,
        tags: ['market', 'sell'],
        removedItems: [item],
      });
      appliedChanges.push(
        ...(removed.appliedChanges || []),
        { attribute: 'inventory', delta: -1, reason: `售出${item.name}` } as any,
        { attribute: 'spiritStones', delta: sellPrice, reason: `售出${item.name}` },
      );
      title = `坊市·售出${item.name}`;
      narrative = `在坊市售出“${item.name}”，换得灵石 ${sellPrice} 枚。`;

      const stateChangeLog = buildStateChangeLog({ before, after: state, appliedChanges, rejectedChanges: removed.rejectedChanges || [], contentRegistryTrace, effectResolveTrace, aiBoundaryTrace: [] });
      const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges, removedItemIds });
      const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

      // Event Sourcing PoC: sell 触发 item.removed + spirit-stones.changed (delta > 0)。
      // 失败不阻断主流程。
      try {
        await appendEvent({
          characterId,
          type: 'character.item.removed',
          data: { type: 'character.item.removed', itemId: item.id, reason: 'market-sell' },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
        await appendEvent({
          characterId,
          type: 'character.spirit-stones.changed',
          data: { type: 'character.spirit-stones.changed', delta: sellPrice, newValue: state.spiritStones, reason: 'market-sell' },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: state.age,
        });
      } catch (evtErr: any) {
        console.error('[market] sell event append failed (non-fatal):', evtErr?.message || evtErr);
      }

      await db.character.update({ where: { id: characterId, userId: user?.id }, data: persistableMarketStateData(state) });
      await db.eventLog.create({ data: { characterId, age: state.age, title, narrative, eventType: 'trade', effects: JSON.stringify(effectsWithAudit) } });

      return NextResponse.json({
        success: true,
        message: `售出 ${item.name}，获得 ${sellPrice} 灵石`,
        sellPrice,
        soldItem: { id: item.id, name: item.name },
        contentRegistryWarnings,
        stateChangeLog,
        state: stateToResponse(state),
      });
    }

    return NextResponse.json({ success: false, error: '无效的 action' }, { status: 400 });
  } catch (err: any) {
    console.error('market error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '坊市交易失败' },
      { status: 500 }
    );
  }
}
