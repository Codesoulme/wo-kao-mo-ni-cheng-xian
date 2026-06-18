// POST /api/game/market
// 坊市交易 API：玩家主动访问坊市购买/出售物品
// action=list: 返回当前坊市可买物品列表（按角色境界生成 6-10 件）+ 玩家可出售物品（估价 0.6 倍）
// action=buy:  玩家购买指定物品（扣灵石，加物品到 inventory）
// action=sell: 玩家出售背包物品（加灵石，从 inventory 移除）

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import { dbToState, stateToResponse, addItems, removeItemsByIds, normalizeCultivationState } from '@/lib/xianxia/engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

// 坊市物品生成池（按境界分档）——参考《凡人修仙传》坊市设定
const MARKET_POOLS: Record<string, { name: string; description: string; item_type: string; rarity: string; basePrice: number; effects: any[] }[]> = {
  // 凡人/炼气期坊市
  mortal_qi: [
    { name: '木剑', description: '寻常木材所制，凡人防身足矣', item_type: 'weapon', rarity: 'common', basePrice: 5, effects: [{ target_attribute: 'attack', operation: 'add', value: 2, description: '木剑轻便，攻伐+2' }] },
    { name: '粗布衣', description: '粗麻织就，御寒而已', item_type: 'armor', rarity: 'common', basePrice: 5, effects: [{ target_attribute: 'defense', operation: 'add', value: 1, description: '粗布御寒，防御+1' }] },
    { name: '聚气丹', description: '低阶丹药，可微增修为', item_type: 'consumable', rarity: 'common', basePrice: 8, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 15, description: '聚气增修为+15' }] },
    { name: '疗伤丹', description: '常见疗伤丹药', item_type: 'consumable', rarity: 'common', basePrice: 6, effects: [{ target_attribute: 'hp', operation: 'add', value: 30, description: '疗伤复气血+30' }] },
    { name: '木灵符', description: '一次性的护身符箓', item_type: 'consumable', rarity: 'uncommon', basePrice: 15, effects: [{ target_attribute: 'maxHp', operation: 'add', value: 10, description: '木灵护体，气血上限+10' }] },
    { name: '初级储物袋', description: '可扩容 10 格的储物袋', item_type: 'tool', rarity: 'uncommon', basePrice: 30, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 10, description: '储物袋扩容+10' }] },
    { name: '引气诀', description: '最基础的引气功法', item_type: 'scripture', rarity: 'common', basePrice: 20, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.3, description: '引气入体，修为×1.3' }] },
    { name: '聚灵佩', description: '能聚拢灵气的玉佩', item_type: 'accessory', rarity: 'uncommon', basePrice: 25, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 5, description: '聚灵佩+5/岁' }, { target_attribute: 'luck', operation: 'add', value: 1, description: '玉佩养神+1气运' }] },
  ],
  // 筑基/金丹期坊市
  foundation: [
    { name: '青锋剑', description: '青云宗炼器师所制，含一丝灵气', item_type: 'weapon', rarity: 'uncommon', basePrice: 80, effects: [{ target_attribute: 'attack', operation: 'add', value: 15, description: '青锋+15攻' }] },
    { name: '玄铁甲', description: '玄铁所制，防御坚固', item_type: 'armor', rarity: 'uncommon', basePrice: 70, effects: [{ target_attribute: 'defense', operation: 'add', value: 10, description: '玄铁甲+10防' }] },
    { name: '凝气丹', description: '中阶丹药，加速修炼', item_type: 'consumable', rarity: 'uncommon', basePrice: 50, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 60, description: '凝气+60修为' }] },
    { name: '回春丹', description: '中阶疗伤圣药', item_type: 'consumable', rarity: 'uncommon', basePrice: 40, effects: [{ target_attribute: 'hp', operation: 'add', value: 100, description: '回春+100气血' }] },
    { name: '凝神丹', description: '可永久提升悟性 1-3 点', item_type: 'consumable', rarity: 'rare', basePrice: 120, effects: [{ target_attribute: 'comprehension', operation: 'add', value: 2, description: '凝神+2悟性' }] },
    { name: '中级储物袋', description: '可扩容 30 格', item_type: 'tool', rarity: 'rare', basePrice: 150, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 30, description: '扩容+30' }] },
    { name: '凝气诀', description: '中阶功法', item_type: 'scripture', rarity: 'uncommon', basePrice: 100, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.7, description: '凝气×1.7' }] },
    { name: '青云剑', description: '青云宗炼制，剑身含阵纹', item_type: 'weapon', rarity: 'rare', basePrice: 200, effects: [{ target_attribute: 'attack', operation: 'add', value: 30, description: '青云剑+30攻' }, { target_attribute: 'speed', operation: 'add', value: 5, description: '剑轻身+5速' }] },
  ],
  // 高阶坊市（金丹以上）
  golden: [
    { name: '紫电剑', description: '蕴含紫电之力', item_type: 'weapon', rarity: 'epic', basePrice: 800, effects: [{ target_attribute: 'attack', operation: 'add', value: 80, description: '紫电+80攻' }] },
    { name: '金丝软甲', description: '金丝编就，刀枪不入', item_type: 'armor', rarity: 'epic', basePrice: 700, effects: [{ target_attribute: 'defense', operation: 'add', value: 50, description: '金丝甲+50防' }] },
    { name: '九转回春丹', description: '高阶疗伤圣药', item_type: 'consumable', rarity: 'epic', basePrice: 500, effects: [{ target_attribute: 'hp', operation: 'add', value: 500, description: '九转+500气血' }] },
    { name: '筑基丹', description: '辅助筑基的丹药', item_type: 'consumable', rarity: 'rare', basePrice: 300, effects: [{ target_attribute: 'cultivationExp', operation: 'add', value: 200, description: '筑基+200修为' }] },
    { name: '玄铁储物戒', description: '可扩容 100 格', item_type: 'tool', rarity: 'epic', basePrice: 1000, effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 100, description: '玄铁戒+100容量' }] },
    { name: '紫霄诀', description: '高阶功法', item_type: 'scripture', rarity: 'epic', basePrice: 800, effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 3.5, description: '紫霄×3.5' }] },
  ],
};

function getPoolForRealm(realm: string): any[] {
  if (['mortal', 'qi_refining'].includes(realm)) return MARKET_POOLS.mortal_qi;
  if (['foundation', 'golden_core'].includes(realm)) return [...MARKET_POOLS.mortal_qi, ...MARKET_POOLS.foundation];
  return [...MARKET_POOLS.mortal_qi, ...MARKET_POOLS.foundation, ...MARKET_POOLS.golden];
}

// 生成坊市可买物品列表（每次访问随机 6-10 件，价格 ±20% 浮动）
function generateMarketItems(realm: string): any[] {
  const pool = getPoolForRealm(realm);
  const count = 6 + Math.floor(Math.random() * 5); // 6-10
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((item, idx) => {
    const priceVariance = 0.8 + Math.random() * 0.4; // ±20%
    return {
      id: `market_${Date.now().toString(36)}_${idx}`,
      name: item.name,
      description: item.description,
      item_type: item.item_type,
      rarity: item.rarity,
      price: Math.round(item.basePrice * priceVariance),
      effects: item.effects,
      source: '坊市所购',
    };
  });
}

// 估价：根据 rarity 与 effects 估算物品价值
function estimateValue(item: any): number {
  const rarityBase: Record<string, number> = {
    common: 5, uncommon: 20, rare: 80, epic: 300, legendary: 1000, mythic: 5000,
  };
  let base = rarityBase[item.rarity] || 5;
  // 含 cultivationExp multiply 效果的 scripture 价值翻倍
  if (item.effects?.some((e: any) => e.target_attribute === 'cultivationExp' && e.operation === 'multiply')) {
    base *= 2;
  }
  // 储物袋按 capacity 估值
  if (item.effects?.some((e: any) => e.target_attribute === 'storageCapacity')) {
    const capEff = item.effects.find((e: any) => e.target_attribute === 'storageCapacity');
    base += (capEff?.value || 0) * 3;
  }
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body?.characterId;
    const action = body?.action;
    const itemId = body?.itemId;

    if (!characterId || !action) {
      return NextResponse.json({ success: false, error: 'characterId 和 action 必填' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    await clearAdvancePreload(characterId);
    if (!char) return NextResponse.json({ success: false, error: 'Character not found' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });
    // 坊市交易期间不允许有未抉择的命节点（避免状态错乱）
    if (char.isAtChoice) {
      return NextResponse.json({ success: false, error: '当前有待抉择的命节点，请先完成抉择' }, { status: 400 });
    }
    // 战斗进行中不能进坊市
    if (char.combatStateJson) {
      try {
        const sess = JSON.parse(char.combatStateJson);
        if (sess && sess.status === 'ongoing') {
          return NextResponse.json({ success: false, error: '战斗进行中，无法前往坊市' }, { status: 400 });
        }
      } catch { /* ignore */ }
    }

    let state = dbToState(char as any);

    if (action === 'list') {
      // 返回当前坊市物品（每次访问重新生成）
      const items = generateMarketItems(state.realm);
      // 同时返回玩家背包中可出售物品（估价 = estimateValue * 0.6）
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

    if (action === 'buy') {
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      // 解析 itemId：market_<timestamp>_<idx>，但每次 list 都重新生成，无法直接对应
      // 简化方案：让客户端 buy 时传整个 item 对象
      const itemToBuy = body?.item;
      if (!itemToBuy || !itemToBuy.name || !itemToBuy.price) {
        return NextResponse.json({ success: false, error: '购买需传完整 item 对象（含 name/price/effects）' }, { status: 400 });
      }
      const price = Number(itemToBuy.price);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ success: false, error: '价格不合法' }, { status: 400 });
      }
      if (state.spiritStones < price) {
        return NextResponse.json({ success: false, error: `灵石不足，需 ${price} 灵石` }, { status: 400 });
      }
      // 检查储物袋容量
      if (state.inventory.length >= state.storageCapacity) {
        return NextResponse.json({ success: false, error: '储物袋已满，无法购入' }, { status: 400 });
      }
      // 扣灵石
      state.spiritStones -= price;
      // 加物品（生成新 id，避免与坊市列表 id 冲突）
      const newItem = {
        id: `item_buy_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: itemToBuy.name,
        description: itemToBuy.description || '',
        item_type: itemToBuy.item_type,
        rarity: itemToBuy.rarity,
        effects: itemToBuy.effects || [],
        source: '坊市所购',
      };
      state = addItems(state, [newItem]);
      state = normalizeCultivationState(state);
      // 持久化
      await db.character.update({
        where: { id: characterId },
        data: {
          spiritStones: state.spiritStones,
          inventoryJson: JSON.stringify(state.inventory),
          storageCapacity: state.storageCapacity,
          equippedJson: JSON.stringify(state.equipped || []),
          cultivationMultiplier: state.cultivationMultiplier ?? 0,
          cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
        },
      });
      // 写入事件日志（便于史册追溯）
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `坊市·购·${newItem.name}`,
          narrative: `于坊市购得「${newItem.name}」，花费灵石 ${price} 枚。`,
          eventType: 'trade',
          effects: JSON.stringify([
            { attribute: 'spiritStones', delta: -price, reason: `购 ${newItem.name}` },
            { attribute: 'inventory', delta: 1, reason: `得 ${newItem.name}` },
          ]),
        },
      });
      return NextResponse.json({
        success: true,
        message: `购得 ${newItem.name}，花费 ${price} 灵石`,
        boughtItem: newItem,
        price,
        state: stateToResponse(state),
      });
    }

    if (action === 'sell') {
      if (!itemId) return NextResponse.json({ success: false, error: 'itemId 必填' }, { status: 400 });
      const item = state.inventory.find(it => it.id === itemId);
      if (!item) return NextResponse.json({ success: false, error: '物品不在储物袋中' }, { status: 400 });
      const sellPrice = Math.max(1, Math.floor(estimateValue(item) * 0.6));
      // 移除物品
      const removed = removeItemsByIds(state, [itemId]);
      state = removed.state;
      // 加灵石
      state.spiritStones += sellPrice;
      state = normalizeCultivationState(state);
      await db.character.update({
        where: { id: characterId },
        data: {
          spiritStones: state.spiritStones,
          inventoryJson: JSON.stringify(state.inventory),
          storageCapacity: state.storageCapacity,
          equippedJson: JSON.stringify(state.equipped || []),
          cultivationMultiplier: state.cultivationMultiplier ?? 0,
          cultivationFactorsJson: JSON.stringify(state.cultivationFactors || []),
        },
      });
      // 写入事件日志
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: `坊市·售·${item.name}`,
          narrative: `于坊市售出「${item.name}」，得灵石 ${sellPrice} 枚。`,
          eventType: 'trade',
          effects: JSON.stringify([
            { attribute: 'inventory', delta: -1, reason: `售 ${item.name}` },
            { attribute: 'spiritStones', delta: sellPrice, reason: `售 ${item.name}` },
          ]),
        },
      });
      return NextResponse.json({
        success: true,
        message: `售出 ${item.name}，得 ${sellPrice} 灵石`,
        sellPrice,
        soldItem: { id: item.id, name: item.name },
        state: stateToResponse(state),
      });
    }

    return NextResponse.json({ success: false, error: '无效的 action' }, { status: 400 });
  } catch (err: any) {
    console.error('market error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process market action' },
      { status: 500 }
    );
  }
}
