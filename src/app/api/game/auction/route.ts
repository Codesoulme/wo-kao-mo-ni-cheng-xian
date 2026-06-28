// POST /api/game/auction
// 拍卖会 Lite：入场邀约 / 确认入场 / 出价结算，接入注册、NPC、线索与隐藏审计。

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  addItems,
  buildStateContext,
  addThreads,
  appendCausalGraph,
  causalId,
  dbToState,
  normalizeCultivationState,
  refreshWorldFacts,
  stateToResponse,
  upsertNpcs,
} from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { generateAuctionContent } from '@/lib/xianxia/llm';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { registerItem, registerMany, registerNpc, registerThread } from '@/lib/xianxia/content-registry';
import type { AttributeChange, AuctionAIOutcome, CausalEdge, CausalNode, CharacterState, ItemEntry, PendingThread, WorldNpc } from '@/lib/xianxia/types';
import type { ValidationTrace } from '@/lib/xianxia/content-registry';
import { z } from 'zod';

// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。
import { getCurrentUser } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 30;

type AuctionLot = {
  id: string;
  item: ItemEntry;
  startingPrice: number;
  currentBid: number;
  seller: string;
  desireTags: string[];
  sold?: boolean;
  winner?: string;
  rivalryHint?: string;
};

type AuctionBidder = {
  id: string;
  name: string;
  realm: string;
  assets: number;
  desireTags: string[];
  temperament: 'calm' | 'proud' | 'greedy' | 'secretive' | 'reckless';
};

type AuctionSession = {
  kind: 'auction-lite';
  id: string;
  title: string;
  age: number;
  location: string;
  invitation: string;
  lots: AuctionLot[];
  bidders: AuctionBidder[];
};

const RARITY_PRICE: Record<ItemEntry['rarity'], number> = {
  common: 30,
  uncommon: 90,
  rare: 260,
  epic: 900,
  legendary: 2600,
  mythic: 8000,
};

const LOT_SEEDS = [
  {
    name: '玄纹聚灵玉',
    description: '玉中纹路如细雨回环，可助静坐聚灵。',
    item_type: 'accessory',
    rarity: 'rare',
    tags: ['cultivation', 'jade'],
    effects: [{ target_attribute: 'cultivationExp', operation: 'multiply', value: 1.8, description: '静坐聚灵，修行更顺' }],
  },
  {
    name: '赤霞护身符',
    description: '符面留有赤霞余温，可挡一次重创之势。',
    item_type: 'artifact',
    rarity: 'uncommon',
    tags: ['defense', 'talisman'],
    effects: [{ target_attribute: 'defense', operation: 'add', value: 12, description: '护身符力，防御提升' }],
  },
  {
    name: '残卷·风雷步',
    description: '残缺身法手抄本，字里行间仍有风雷之意。',
    item_type: 'scripture',
    rarity: 'rare',
    tags: ['speed', 'scripture'],
    effects: [{ target_attribute: 'speed', operation: 'add', value: 8, description: '风雷步意，身法更疾' }],
  },
  {
    name: '寒泉凝魄丹',
    description: '丹色清寒，入口可稳心神、涨灵机。',
    item_type: 'consumable',
    rarity: 'rare',
    tags: ['pill', 'comprehension'],
    effects: [{ target_attribute: 'comprehension', operation: 'add', value: 3, description: '寒泉凝魄，悟性微涨' }],
  },
  {
    name: '旧洞府铜钥',
    description: '铜钥边缘磨损，似可开启某处旧洞府外禁。',
    item_type: 'tool',
    rarity: 'epic',
    tags: ['mystery', 'key'],
    effects: [],
  },
  {
    name: '青鳞储物袋',
    description: '以青鳞兽皮炼成，内里另有方寸空间。',
    item_type: 'tool',
    rarity: 'rare',
    tags: ['storage', 'bag'],
    effects: [{ target_attribute: 'storageCapacity', operation: 'add', value: 35, description: '方寸藏物，容量提升' }],
  },
] as const;

const BIDDER_SEEDS = [
  { name: '白眉散人', realm: '筑基后期', assets: 900, desireTags: ['jade', 'cultivation', 'pill'], temperament: 'calm' },
  { name: '赤袍女修', realm: '筑基中期', assets: 700, desireTags: ['talisman', 'defense', 'artifact'], temperament: 'proud' },
  { name: '阴鸦客', realm: '练气圆满', assets: 520, desireTags: ['mystery', 'key', 'scripture'], temperament: 'secretive' },
  { name: '罗三刀', realm: '筑基初期', assets: 430, desireTags: ['weapon', 'speed', 'storage'], temperament: 'reckless' },
  { name: '青衣掌柜', realm: '练气九层', assets: 1200, desireTags: ['bag', 'storage', 'jade'], temperament: 'greedy' },
] as const;

function persistableAuctionStateData(state: ReturnType<typeof dbToState>) {
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

function snapshotState(state: ReturnType<typeof dbToState>): CharacterState {
  return {
    ...state,
    inventory: [...(state.inventory || [])],
    equipped: [...(state.equipped || [])],
    activeStatuses: [...(state.activeStatuses || [])],
    pendingThreads: [...(state.pendingThreads || [])],
    npcs: [...(state.npcs || [])],
    worldFacts: [...(state.worldFacts || [])],
    pets: [...(state.pets || [])],
  };
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function priceFor(seed: typeof LOT_SEEDS[number], luck: number) {
  const base = RARITY_PRICE[seed.rarity as ItemEntry['rarity']] || 60;
  const luckDiscount = Math.max(0.85, 1.08 - Math.max(0, luck) / 1000);
  return Math.max(5, Math.round(base * luckDiscount));
}

function buildAuctionSession(state: ReturnType<typeof dbToState>, aiContent?: any): AuctionSession {
  const location = state.location || '坊市偏楼';
  if (aiContent?.lots?.length && aiContent?.bidders?.length) {
    const lots = aiContent.lots.slice(0, 6).map((raw: any) => ({
      id: makeId('lot'), item: { ...raw.item, id: makeId('auction_item'), source: raw.item?.source || '拍卖会' },
      startingPrice: Math.max(5, Math.round(Number(raw.startingPrice) || 30)), currentBid: Math.max(5, Math.round(Number(raw.startingPrice) || 30)),
      seller: raw.seller || '寄拍修士', desireTags: Array.isArray(raw.desireTags) ? raw.desireTags : [],
    }));
    const bidders = aiContent.bidders.slice(0, 6).map((raw: any) => ({ id: makeId('bidder'), name: raw.name, realm: raw.realm, assets: Math.max(20, Math.round(Number(raw.assets) || 200)), desireTags: Array.isArray(raw.desireTags) ? raw.desireTags : [], temperament: raw.temperament as AuctionBidder['temperament'] }));
    return { kind: 'auction-lite', id: makeId('auction'), title: aiContent.title || `${location}暗香拍卖`, age: state.age, location, invitation: aiContent.invitation || `入夜后，${location}有素笺递至，请${state.name}赴一场小拍。`, lots, bidders };
  }
  const lots = LOT_SEEDS.slice(0, 5).map((seed, idx) => {
    const item: ItemEntry = {
      id: makeId('auction_item'),
      name: seed.name,
      description: seed.description,
      item_type: seed.item_type as ItemEntry['item_type'],
      rarity: seed.rarity as ItemEntry['rarity'],
      effects: seed.effects as any,
      source: '拍卖会',
    };
    const startingPrice = priceFor(seed, state.luck);
    return {
      id: makeId('lot'),
      item,
      startingPrice,
      currentBid: startingPrice,
      seller: idx % 2 === 0 ? '寄拍修士' : '坊中掌柜',
      desireTags: [...seed.tags],
    };
  });
  const bidders = BIDDER_SEEDS.map(seed => ({
    id: makeId('bidder'),
    name: seed.name,
    realm: seed.realm,
    assets: seed.assets,
    desireTags: [...seed.desireTags],
    temperament: seed.temperament as AuctionBidder['temperament'],
  }));
  return {
    kind: 'auction-lite',
    id: makeId('auction'),
    title: `${location}暗香拍卖`,
    age: state.age,
    location,
    invitation: `入夜后，${location}一隅灯影低垂，有掌柜递来素笺，请${state.name}赴一场只认灵石与眼力的小拍。`,
    lots,
    bidders,
  };
}

function publicSession(session: AuctionSession) {
  return {
    id: session.id,
    title: session.title,
    invitation: session.invitation,
    location: session.location,
    age: session.age,
    lots: session.lots.map(lot => ({
      id: lot.id,
      item: lot.item,
      startingPrice: lot.startingPrice,
      currentBid: lot.currentBid,
      seller: lot.seller,
      sold: lot.sold || false,
      winner: lot.winner,
    })),
    bidders: session.bidders.map(b => ({ id: b.id, name: b.name, realm: b.realm, temperament: b.temperament })),
  };
}

function loadAuctionSession(raw: string): AuctionSession | null {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.auctionSession?.kind === 'auction-lite') return parsed.auctionSession as AuctionSession;
    if (parsed?.kind === 'auction-lite') return parsed as AuctionSession;
  } catch { /* ignore */ }
  return null;
}

function rivalBidFor(lot: AuctionLot, bidder: AuctionBidder) {
  const desire = lot.desireTags.some(tag => bidder.desireTags.includes(tag));
  const temperamentBoost = bidder.temperament === 'proud' || bidder.temperament === 'reckless' ? 1.35 : bidder.temperament === 'greedy' ? 1.15 : 1;
  const max = Math.floor((desire ? 0.72 : 0.38) * bidder.assets * temperamentBoost);
  if (max <= lot.currentBid) return 0;
  const step = Math.max(5, Math.ceil(lot.currentBid * 0.1));
  return Math.min(max, lot.currentBid + step + Math.floor(Math.random() * step));
}

function settleRivals(session: AuctionSession, lot: AuctionLot) {
  const rivalLines: string[] = [];
  let current = lot.currentBid;
  let winner = lot.winner;
  for (const bidder of session.bidders) {
    const bid = rivalBidFor({ ...lot, currentBid: current }, bidder);
    if (bid > current) {
      current = bid;
      winner = bidder.name;
      bidder.assets -= bid;
      rivalLines.push(`${bidder.name}望了望${lot.item.name}，出价 ${bid} 灵石。`);
    }
  }
  lot.currentBid = current;
  lot.winner = winner;
  return rivalLines;
}

function auctionNpcs(session: AuctionSession, age: number): Partial<WorldNpc>[] {
  return session.bidders.map(bidder => ({
    id: `auction_npc_${bidder.name}`,
    name: bidder.name,
    description: `${session.title}中露面的竞拍者，${bidder.realm}修为，性情${bidder.temperament}。`,
    role: '竞拍者',
    realm: bidder.realm,
    attitude: bidder.temperament === 'secretive' ? 'unknown' : 'neutral',
    relationshipScore: 0,
    firstMetAge: age,
    lastSeenAge: age,
    lastKnownLocation: session.location,
    source: 'auction',
    memory: `曾在${session.title}竞拍。`,
    tags: ['auction', bidder.temperament],
  }));
}

function interestedAuctionRival(session: AuctionSession, lot: AuctionLot, excludeName?: string) {
  const temperamentRank: Record<AuctionBidder['temperament'], number> = { secretive: 5, reckless: 4, greedy: 3, proud: 2, calm: 1 };
  return [...session.bidders]
    .filter(bidder => bidder.name !== excludeName)
    .map(bidder => ({
      bidder,
      interest: lot.desireTags.filter(tag => bidder.desireTags.includes(tag)).length,
      rank: temperamentRank[bidder.temperament] || 0,
    }))
    .filter(entry => entry.interest > 0)
    .sort((a, b) => (b.interest * 10 + b.rank + b.bidder.assets / 1000) - (a.interest * 10 + a.rank + a.bidder.assets / 1000))[0]?.bidder;
}

function auctionAftermath(session: AuctionSession, lot: AuctionLot, state: ReturnType<typeof dbToState>, playerWon: boolean) {
  const rivalName = playerWon ? interestedAuctionRival(session, lot)?.name : lot.winner;
  const rival = session.bidders.find(b => b.name === rivalName);
  const highValue = ['epic', 'legendary', 'mythic'].includes(lot.item.rarity) || lot.desireTags.includes('mystery') || lot.desireTags.includes('key');
  if (!rival || (!highValue && rival.temperament === 'calm')) {
    return { threads: [] as Partial<PendingThread>[], npcs: [] as Partial<WorldNpc>[], narrativeLines: [] as string[] };
  }
  const npc: Partial<WorldNpc> = {
    id: `auction_npc_${rival.name}`,
    name: rival.name,
    description: `${session.title}中对${lot.item.name}格外在意的竞拍者，${rival.realm}修为，性情${rival.temperament}。`,
    role: playerWon ? '竞拍失利者' : '拍品得主',
    realm: rival.realm,
    attitude: rival.temperament === 'secretive' || rival.temperament === 'reckless' ? 'hostile' : 'neutral',
    relationshipScore: playerWon ? -25 : -8,
    firstMetAge: state.age,
    lastSeenAge: state.age,
    lastKnownLocation: session.location,
    source: 'auction-aftermath',
    memory: playerWon
      ? `在${session.title}中因${lot.item.name}落入${state.name}手中而记下一笔。`
      : `在${session.title}中拍得${lot.item.name}，此物后续或仍牵动因果。`,
    tags: ['auction', 'aftermath', rival.temperament, playerWon ? 'rivalry' : 'winner'],
  };
  const thread: Partial<PendingThread> = playerWon ? {
    id: `auction_aftermath_${session.id}_${lot.id}_rivalry`,
    title: `${rival.name}的暗中盯梢`,
    description: `${state.name}在${session.title}拍得${lot.item.name}后，${rival.name}神色微冷，似将此事记在心中。`,
    category: 'quest',
    startAge: state.age,
    deadlineAge: state.age + 1,
    status: 'pending',
    progress: 10,
    reward: '化解仇怨、反夺线索或获得额外消息',
    failureCost: '坊市外被盯梢、截杀或被引入圈套',
    followUpHint: `后续流年可让${rival.name}因${lot.item.name}盯上角色，低频触发盯梢、试探、劫杀或交易。`,
    sourceEventTitle: session.title,
  } : {
    id: `auction_aftermath_${session.id}_${lot.id}_winner`,
    title: `${rival.name}拍得${lot.item.name}`,
    description: `${rival.name}在${session.title}中拍得${lot.item.name}，此物可能牵出后续秘闻、交易或争夺。`,
    category: lot.desireTags.includes('mystery') || lot.desireTags.includes('key') ? 'mystery' : 'quest',
    startAge: state.age,
    deadlineAge: state.age + 2,
    status: 'pending',
    progress: 10,
    reward: '追踪拍品去向或另获机缘',
    failureCost: '拍品因果被他人先行消化',
    followUpHint: `后续可在${rival.name}行踪、坊市传闻或${lot.item.name}相关地点中回响。`,
    sourceEventTitle: session.title,
  };
  lot.rivalryHint = thread.followUpHint;
  return {
    threads: [thread],
    npcs: [npc],
    narrativeLines: playerWon
      ? [`帘角处，${rival.name}多看了${lot.item.name}一眼，目光很快敛入袖中。`]
      : [`${rival.name}收起${lot.item.name}时，似有意避开众人视线。`],
  };
}
function recordAuctionCausality(
  state: ReturnType<typeof dbToState>,
  session: AuctionSession,
  action: 'enter' | 'bid',
  lot?: AuctionLot,
  threads: PendingThread[] = [],
  npcs: WorldNpc[] = [],
): ReturnType<typeof dbToState> {
  const eventId = causalId('event', `${session.id}_${action}_${lot?.id || 'hall'}`);
  const nodes: CausalNode[] = [{
    id: eventId,
    type: 'event',
    label: action === 'enter' ? session.title : `${session.title}·${lot?.item.name || '落槌'}`,
    age: state.age,
    summary: action === 'enter' ? session.invitation : `${lot?.item.name || '拍品'}在拍卖中落槌。`,
    tags: ['auction', action],
  }];
  const edges: CausalEdge[] = [];

  for (const npc of npcs) {
    if (!npc?.id) continue;
    const nodeId = causalId('npc', npc.id);
    nodes.push({ id: nodeId, type: 'npc', label: npc.name, age: npc.firstMetAge || state.age, refId: npc.id, summary: npc.memory || npc.description, tags: ['auction', npc.attitude, npc.role || 'npc'].filter(Boolean) });
    edges.push({ id: causalId('edge', `${eventId}_mentions_${nodeId}`), from: eventId, to: nodeId, type: 'mentions', age: state.age, summary: `${npc.name}在拍卖会上露面。` });
  }

  if (lot?.item?.id) {
    const itemId = causalId('item', lot.item.id);
    nodes.push({ id: itemId, type: 'item', label: lot.item.name, age: state.age, refId: lot.item.id, summary: lot.item.description, tags: [lot.item.rarity, lot.item.item_type, 'auction'].filter(Boolean) });
    edges.push({ id: causalId('edge', `${eventId}_rewards_${itemId}`), from: eventId, to: itemId, type: 'rewards', age: state.age, summary: `拍卖落槌所得：${lot.item.name}` });
  }

  for (const thread of threads) {
    const nodeId = causalId('thread', thread.id);
    nodes.push({ id: nodeId, type: 'thread', label: thread.title, age: thread.startAge || state.age, refId: thread.id, summary: thread.description, tags: [thread.status, thread.category, 'auction'].filter(Boolean) });
    edges.push({ id: causalId('edge', `${eventId}_created_${nodeId}`), from: eventId, to: nodeId, type: 'created', age: state.age, summary: thread.followUpHint || thread.description });
  }

  return appendCausalGraph(state, nodes, edges) as ReturnType<typeof dbToState>;
}

function auctionThread(session: AuctionSession, lot: AuctionLot, age: number): Partial<PendingThread> | null {
  if (!lot.item.name.includes('铜钥') && !lot.desireTags.includes('mystery')) return null;
  return {
    id: `auction_thread_${session.id}_${lot.id}`,
    title: `${lot.item.name}的旧主线索`,
    description: `${lot.item.name}在${session.title}露面，阴鸦客等人对此物格外在意，或牵出旧洞府与截杀因果。`,
    category: 'mystery',
    startAge: age,
    deadlineAge: age + 2,
    status: 'pending',
    progress: 15,
    reward: '旧洞府线索或钥纹传承',
    failureCost: '被他人捷足先登，或在坊市外被盯上',
    followUpHint: '后续可在坊市、荒山旧洞府或阴鸦客行踪中回响。',
    sourceEventTitle: session.title,
  };
}

function validateCharacterCanAct(char: any) {
  if (!char) return { ok: false, status: 404, error: '角色不在此界' };
  if (!char.alive) return { ok: false, status: 400, error: '此身已陨，不能赴会' };
  if (char.combatStateJson) {
    try {
      const sess = JSON.parse(char.combatStateJson);
      if (sess && sess.status === 'ongoing') return { ok: false, status: 400, error: '斗法未歇，不能赴会' };
    } catch { /* ignore */ }
  }
  return { ok: true, status: 200, error: '' };
}

function eventTitle(action: string, session?: AuctionSession) {
  if (action === 'invite') return '坊中素笺';
  if (action === 'enter') return session?.title || '暗香拍卖';
  return '槌音落定';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['invite', 'enter', 'bid', 'leave']),
      lotId: z.string().optional(),
      bid: z.number().int().positive().optional(),
    }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: '来意不明' }, { status: 400 });
    const { characterId, action, lotId, bid } = parsed.data;

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
    const canAct = validateCharacterCanAct(char);
    if (!canAct.ok) return NextResponse.json({ success: false, error: canAct.error }, { status: canAct.status });

    let state = dbToState(char as any);
    const before = snapshotState(state);
    const contentRegistryTrace: ValidationTrace[] = [];
    const contentRegistryWarnings: string[] = [];
    const appliedChanges: AttributeChange[] = [];
    let newItems: ItemEntry[] = [];
    let newThreads: PendingThread[] = [];
    let newNpcs: WorldNpc[] = [];
    let narrative = '';
    let session = loadAuctionSession(char!.pendingChoiceJson || '');

    if (action === 'invite') {
      let aiAuction: AuctionAIOutcome | null = null;
      try {
        const recentDb = await db.eventLog.findMany({ where: { characterId }, orderBy: { age: 'desc' }, take: 3 });
        const recent = recentDb.reverse().map(e => ({ age: e.age, title: e.title, narrative: e.narrative, eventType: e.eventType }));
        aiAuction = await generateAuctionContent(buildStateContext(state, recent));
      } catch (err: any) { console.error('auction AI content failed, fallback to seeds:', err?.message || err); }
      session = buildAuctionSession(state, aiAuction);
      await db.character.update({
        where: { id: characterId, userId: user?.id },
        data: {
          isAtChoice: true,
          pendingChoiceJson: JSON.stringify({
            prompt: session.invitation,
            options: [
              { text: '赴会入楼', hint: '入场后再看拍品与竞价' },
              { text: '收起素笺', hint: '不赴此会' },
            ],
            contextTitle: '坊中素笺',
            contextNarrative: session.invitation,
            contextAge: state.age,
            auctionSession: session,
          }),
        },
      });
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: '坊中素笺',
          narrative: session.invitation,
          eventType: 'choice',
          effects: JSON.stringify([]),
        },
      });
      return NextResponse.json({ success: true, invitation: session.invitation, auction: publicSession(session), pendingChoice: true });
    }

    if (!session) {
      session = buildAuctionSession(state);
    }

    if (action === 'leave') {
      await db.character.update({ where: { id: characterId, userId: user?.id }, data: { isAtChoice: false, pendingChoiceJson: '' } });
      narrative = `${state.name}收起素笺，没有踏入${session.title}。楼中槌声隔墙而起，片刻后又归于夜色。`;
      await db.eventLog.create({ data: { characterId, age: state.age, title: '错身槌声', narrative, eventType: 'normal', effects: JSON.stringify([]) } });
      return NextResponse.json({ success: true, narrative, state: stateToResponse({ ...state, isAtChoice: false }) });
    }

    if (action === 'enter') {
      const registeredNpcs = registerMany(auctionNpcs(session, state.age), registerNpc, {
        source: 'auction-enter',
        age: state.age,
        existingIds: (state.npcs || []).map(n => n.id),
      });
      contentRegistryTrace.push(...registeredNpcs.trace);
      contentRegistryWarnings.push(...registeredNpcs.warnings);
      newNpcs = registeredNpcs.accepted;
      state = upsertNpcs(state, newNpcs);
      state = recordAuctionCausality(state, session, 'enter', undefined, [], newNpcs);
      state = normalizeCultivationState(refreshWorldFacts({ ...state, isAtChoice: false }, 'auction-enter'));
      narrative = [`${state.name}入了${session.title}。`, '帘后灵灯压低，主持人含笑举槌，诸修各按心思落座。', ...session.lots.map((l, i) => `第${i + 1}件，${l.item.name}，起价 ${l.startingPrice} 灵石。`)].join('\n');
    } else if (action === 'bid') {
      const lot = session.lots.find(l => l.id === lotId);
      if (!lot) return NextResponse.json({ success: false, error: '此件拍品已不在槌下' }, { status: 400 });
      if (lot.sold) return NextResponse.json({ success: false, error: '此件拍品已落槌' }, { status: 400 });
      const offered = Number(bid || 0);
      if (!Number.isFinite(offered) || offered < lot.currentBid) {
        return NextResponse.json({ success: false, error: `出价至少需 ${lot.currentBid} 灵石` }, { status: 400 });
      }
      if (state.spiritStones < offered) {
        return NextResponse.json({ success: false, error: '囊中灵石不足，举牌只会惹人侧目' }, { status: 400 });
      }
      lot.currentBid = offered;
      lot.winner = state.name;
      const rivalLines = settleRivals(session, lot);
      if (lot.winner === state.name) {
        lot.sold = true;
        state.spiritStones -= lot.currentBid;
        appliedChanges.push({ attribute: 'spiritStones', delta: -lot.currentBid, reason: `拍得${lot.item.name}` });
        const registeredItem = registerItem(lot.item, { source: 'auction-bid', age: state.age, existingIds: (state.inventory || []).map(i => i.id) });
        contentRegistryTrace.push(...registeredItem.trace);
        contentRegistryWarnings.push(...registeredItem.warnings);
        if (registeredItem.content) {
          newItems = [registeredItem.content];
          state = addItems(state, newItems);
        }
        const threadRaw = auctionThread(session, lot, state.age);
        if (threadRaw) {
          const registeredThread = registerThread(threadRaw, { source: 'auction-bid', age: state.age, existingIds: (state.pendingThreads || []).map(t => t.id) });
          contentRegistryTrace.push(...registeredThread.trace);
          contentRegistryWarnings.push(...registeredThread.warnings);
          if (registeredThread.content) {
            newThreads = [registeredThread.content];
            state = addThreads(state, newThreads);
          }
        }
        const aftermath = auctionAftermath(session, lot, state, true);
        if (aftermath.threads.length) {
          const registeredAftermathThreads = registerMany(aftermath.threads, registerThread, { source: 'auction-aftermath', age: state.age, existingIds: (state.pendingThreads || []).map(t => t.id) });
          contentRegistryTrace.push(...registeredAftermathThreads.trace);
          contentRegistryWarnings.push(...registeredAftermathThreads.warnings);
          if (registeredAftermathThreads.accepted.length) {
            newThreads = [...newThreads, ...registeredAftermathThreads.accepted];
            state = addThreads(state, registeredAftermathThreads.accepted);
          }
        }
        if (aftermath.npcs.length) {
          const registeredAftermathNpcs = registerMany(aftermath.npcs, registerNpc, { source: 'auction-aftermath', age: state.age, existingIds: (state.npcs || []).map(n => n.id) });
          contentRegistryTrace.push(...registeredAftermathNpcs.trace);
          contentRegistryWarnings.push(...registeredAftermathNpcs.warnings);
          if (registeredAftermathNpcs.accepted.length) {
            newNpcs = [...newNpcs, ...registeredAftermathNpcs.accepted];
            state = upsertNpcs(state, registeredAftermathNpcs.accepted);
          }
        }
        narrative = [`${state.name}举牌出价 ${offered} 灵石。`, ...rivalLines, `槌音三落，${lot.item.name}归入${state.name}手中。`, ...aftermath.narrativeLines].join('\n');
      } else {
        const aftermath = auctionAftermath(session, lot, state, false);
        if (aftermath.threads.length) {
          const registeredAftermathThreads = registerMany(aftermath.threads, registerThread, { source: 'auction-aftermath', age: state.age, existingIds: (state.pendingThreads || []).map(t => t.id) });
          contentRegistryTrace.push(...registeredAftermathThreads.trace);
          contentRegistryWarnings.push(...registeredAftermathThreads.warnings);
          if (registeredAftermathThreads.accepted.length) {
            newThreads = [...newThreads, ...registeredAftermathThreads.accepted];
            state = addThreads(state, registeredAftermathThreads.accepted);
          }
        }
        if (aftermath.npcs.length) {
          const registeredAftermathNpcs = registerMany(aftermath.npcs, registerNpc, { source: 'auction-aftermath', age: state.age, existingIds: (state.npcs || []).map(n => n.id) });
          contentRegistryTrace.push(...registeredAftermathNpcs.trace);
          contentRegistryWarnings.push(...registeredAftermathNpcs.warnings);
          if (registeredAftermathNpcs.accepted.length) {
            newNpcs = [...newNpcs, ...registeredAftermathNpcs.accepted];
            state = upsertNpcs(state, registeredAftermathNpcs.accepted);
          }
        }
        narrative = [`${state.name}举牌出价 ${offered} 灵石。`, ...rivalLines, `最终${lot.winner}以 ${lot.currentBid} 灵石压过众人，${lot.item.name}未入囊中。`, ...aftermath.narrativeLines].join('\n');
      }
      if (lot.winner === state.name || newThreads.length || newNpcs.length) {
        state = recordAuctionCausality(state, session, 'bid', lot, newThreads, newNpcs);
      }
      state = normalizeCultivationState(refreshWorldFacts(state, 'auction-bid'));
    }

    const stateChangeLog = buildStateChangeLog({
      before,
      after: state,
      appliedChanges,
      rejectedChanges: [],
      contentRegistryTrace,
      effectResolveTrace: [],
      aiBoundaryTrace: [],
    });
    const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges, newItems });
    const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

    await db.character.update({
      where: { id: characterId, userId: user?.id },
      data: {
        ...persistableAuctionStateData(state),
        isAtChoice: false,
        pendingChoiceJson: JSON.stringify({ auctionSession: session }),
      },
    });
    await db.eventLog.create({
      data: {
        characterId,
        age: state.age,
        title: eventTitle(action, session),
        narrative,
        eventType: action === 'bid' ? 'trade' : 'normal',
        effects: JSON.stringify(effectsWithAudit),
      },
    });

    return NextResponse.json({
      success: true,
      narrative,
      auction: publicSession(session),
      wonItems: newItems,
      newThreads,
      newNpcs,
      contentRegistryWarnings,
      stateChangeLog,
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('auction error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to process auction' }, { status: 500 });
  }
}
