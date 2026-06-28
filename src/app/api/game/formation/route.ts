// POST /api/game/formation
// body: { characterId, action: 'activate' | 'deactivate' | 'list', diskItemId?, formationId? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clearAdvancePreload } from '@/lib/xianxia/advance-preload';
import {
  activateFormation,
  dbToState,
  deactivateFormation,
  normalizeCultivationState,
  recordActionCausality,
  refreshWorldFacts,
  stateToResponse,
} from '@/lib/xianxia/engine';
import { buildEventDisplayEffects } from '@/lib/xianxia/event-effects';
import { appendStateChangeAuditEffect, buildStateChangeLog } from '@/lib/xianxia/state-change-log';
import { registerStatus } from '@/lib/xianxia/content-registry';
import type { AttributeChange, CharacterState } from '@/lib/xianxia/types';
import type { ValidationTrace } from '@/lib/xianxia/content-registry';

// P1 step2: 收 where: { id, userId }（dev 模式 userId: undefined，Prisma 自动忽略 → 不破 dev/smoke）
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。
import { getCurrentUser } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 30;

function persistableFormationStateData(state: ReturnType<typeof dbToState>) {
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
    worldFacts: [...(state.worldFacts || [])],
  };
}

function buildAttributeDiff(before: CharacterState, after: CharacterState, reason: string): AttributeChange[] {
  const changes: AttributeChange[] = [];
  const push = (attribute: string, beforeValue: number, afterValue: number) => {
    const delta = Number(afterValue || 0) - Number(beforeValue || 0);
    if (delta !== 0) changes.push({ attribute, delta, reason });
  };
  push('attack', before.attack, after.attack);
  push('defense', before.defense, after.defense);
  push('speed', before.speed, after.speed);
  push('luck', before.luck, after.luck);
  push('comprehension', before.comprehension, after.comprehension);
  push('cultivationMultiplier', before.cultivationMultiplier || 0, after.cultivationMultiplier || 0);
  push('elementMetal', before.elements.metal, after.elements.metal);
  push('elementWood', before.elements.wood, after.elements.wood);
  push('elementWater', before.elements.water, after.elements.water);
  push('elementFire', before.elements.fire, after.elements.fire);
  push('elementEarth', before.elements.earth, after.elements.earth);
  return changes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId = body?.characterId;
    const action = body?.action;
    const diskItemId = body?.diskItemId;
    const formationId = body?.formationId;

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

    let state = dbToState(char as any);

    if (action === 'list') {
      const disks = state.inventory.filter(it =>
        it.item_type === 'tool' &&
        (it.effects || []).some(e => e.target_attribute === 'formationType')
      );
      const activeFormations = state.activeStatuses.filter(s => s.name.startsWith('[阵]'));
      return NextResponse.json({
        success: true,
        disks,
        activeFormations: activeFormations.map(s => ({
          id: s.id,
          name: s.name.replace('[阵]', ''),
          description: s.description,
          rarity: s.rarity,
          effects: s.effects,
        })),
      });
    }

    const before = snapshotState(state);
    const contentRegistryTrace: ValidationTrace[] = [];
    const contentRegistryWarnings: string[] = [];
    let title = '';
    let narrative = '';
    let appliedChanges: AttributeChange[] = [];

    if (action === 'activate') {
      if (!diskItemId) return NextResponse.json({ success: false, error: '缺少 diskItemId' }, { status: 400 });
      const result = activateFormation(state, diskItemId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      state = normalizeCultivationState(refreshWorldFacts(result.state, 'formation-activate'));
      const activated = state.activeStatuses.find(s => s.id === result.formation?.id);
      if (activated) {
        const registered = registerStatus(activated, {
          source: 'formation-activate',
          age: state.age,
          existingIds: before.activeStatuses.map(status => status.id),
        });
        contentRegistryTrace.push(...registered.trace);
        contentRegistryWarnings.push(...registered.warnings);
      }
      appliedChanges = buildAttributeDiff(before, state, `激活阵法${result.formation?.name || ''}`);
      title = `阵启·${result.formation?.name || '阵法'}`;
      narrative = `阵盘灵纹依次亮起，“${result.formation?.name || '阵法'}”被引动，四周灵机随之改换。`;

      state = recordActionCausality(state, {
        actionId: `formation_activate_${state.age}_${result.formation?.id || diskItemId}`,
        actionType: 'formation',
        title,
        summary: narrative,
        tags: ['formation', 'activate'],
        usedItems: before.inventory.filter(item => item.id === diskItemId),
        statuses: activated ? [activated] : [],
      });
      const stateChangeLog = buildStateChangeLog({ before, after: state, appliedChanges, rejectedChanges: [], contentRegistryTrace, effectResolveTrace: [], aiBoundaryTrace: [] });
      const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges });
      const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

      await db.character.update({ where: { id: characterId, userId: user?.id }, data: persistableFormationStateData(state) });
      await db.eventLog.create({ data: { characterId, age: state.age, title, narrative, eventType: 'formation', effects: JSON.stringify(effectsWithAudit) } });

      return NextResponse.json({
        success: true,
        message: `阵法已启：${result.formation?.name}`,
        formation: result.formation,
        contentRegistryWarnings,
        stateChangeLog,
        state: stateToResponse(state),
      });
    }

    if (action === 'deactivate') {
      if (!formationId) return NextResponse.json({ success: false, error: '缺少 formationId' }, { status: 400 });
      const closing = state.activeStatuses.find(status => status.id === formationId);
      const result = deactivateFormation(state, formationId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      state = normalizeCultivationState(refreshWorldFacts(result.state, 'formation-deactivate'));
      appliedChanges = buildAttributeDiff(before, state, `关闭阵法${closing?.name.replace('[阵]', '') || ''}`);
      title = `阵息·${closing?.name.replace('[阵]', '') || '阵法'}`;
      narrative = `阵纹渐次暗下，“${closing?.name.replace('[阵]', '') || '阵法'}”归于沉寂，周遭灵机恢复平常。`;

      state = recordActionCausality(state, {
        actionId: `formation_deactivate_${state.age}_${formationId}`,
        actionType: 'formation',
        title,
        summary: narrative,
        tags: ['formation', 'deactivate'],
        statuses: closing ? [closing] : [],
      });
      const stateChangeLog = buildStateChangeLog({ before, after: state, appliedChanges, rejectedChanges: [], contentRegistryTrace, effectResolveTrace: [], aiBoundaryTrace: [] });
      const displayEffects = buildEventDisplayEffects({ before, after: state, changes: appliedChanges, removedItemIds: [] });
      const effectsWithAudit = appendStateChangeAuditEffect(displayEffects, stateChangeLog);

      await db.character.update({ where: { id: characterId, userId: user?.id }, data: persistableFormationStateData(state) });
      await db.eventLog.create({ data: { characterId, age: state.age, title, narrative, eventType: 'formation', effects: JSON.stringify(effectsWithAudit) } });

      return NextResponse.json({
        success: true,
        message: '阵法已关闭',
        contentRegistryWarnings,
        stateChangeLog,
        state: stateToResponse(state),
      });
    }

    return NextResponse.json({ success: false, error: '无效的 action' }, { status: 400 });
  } catch (err: any) {
    console.error('formation error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '阵法处理失败' },
      { status: 500 }
    );
  }
}
