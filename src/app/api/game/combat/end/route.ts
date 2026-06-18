// POST /api/game/combat/end
// 结束战斗：清理 combatSession，应用战利品，生成战后叙事（联动未决线索/新线索/新物品）
// 请求体：{ characterId }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  dbToState, endCombat, buildStateContext, stateToResponse,
  addItems, addThreads, completeThread, resolveHeartDemonTrial,
} from '@/lib/xianxia/engine';
import { generateCombatEndNarrative } from '@/lib/xianxia/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const characterId: string | undefined = body?.characterId;
    if (!characterId) {
      return NextResponse.json({ success: false, error: 'characterId 必填' }, { status: 400 });
    }

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });

    let state = dbToState(char as any);

    if (!state.combatSession) {
      return NextResponse.json({ success: false, error: '当前无战斗会话' }, { status: 400 });
    }

    // 缓存战斗信息（endCombat 会清掉 combatSession）
    const session = state.combatSession;
    const enemies = session.enemies || [];
    const endStatus = session.status; // 'ongoing' | 'victory' | 'defeat' | 'fled'

    // 引擎：清理 combatSession + 应用战利品（victory 时）
    // 注意：endCombat 的 applyDrops=true 会调 addItems 应用 victoryDrops
    // 但我们想让 LLM 决定是否重复给（generateCombatEndNarrative 会提示 AI "战利品不要重复给"）
    // 所以先 endCombat(applyDrops=true) 应用 drops，再调 LLM 让它生成新物品（不重复）
    const endResult = endCombat(state, true);
    state = endResult.state;
    const appliedDrops = endResult.drops || [];

    // Task 22: 心魔试炼战斗后特殊结算——根据胜负调整心魔值
    const wasHeartDemonTrial = !!(session as any).isHeartDemonTrial;
    if (wasHeartDemonTrial) {
      const victory = endStatus === 'victory';
      state = resolveHeartDemonTrial(state, victory);
    } else if (endStatus === 'victory') {
      // Task 22: 普通战斗胜利也轻微增加心魔（杀生扰动道心）
      // 心魔试炼战斗不计入（避免循环）
      state = { ...state, heartDemon: Math.min(100, (state.heartDemon ?? 0) + 3) };
      console.log(`[Task 22] Combat victory +3 heartDemon (kill disturbs dao heart) → ${state.heartDemon}`);
    }

    // 调用 LLM 生成战后叙事 + 联动线索/物品
    let narrative = '';
    let llmNewItems: any[] = [];
    let llmNewThreads: any[] = [];
    let llmCompleteThreadIds: string[] = [];
    try {
      // 取最近事件用于上下文
      const recentEventsDb = await db.eventLog.findMany({
        where: { characterId },
        orderBy: { age: 'desc' },
        take: 3,
      });
      const recentEvents = recentEventsDb.reverse().map(e => ({
        age: e.age,
        title: e.title,
        narrative: e.narrative,
      }));
      const ctx = buildStateContext(state, recentEvents);

      // 战斗结果必须是 victory/defeat/fled 之一才调 LLM
      const resultForLlm = (endStatus === 'victory' || endStatus === 'defeat' || endStatus === 'fled')
        ? endStatus
        : 'fled'; // 兜底

      const llmResult = await generateCombatEndNarrative(
        ctx,
        resultForLlm as 'victory' | 'defeat' | 'fled',
        enemies,
        appliedDrops,
      );
      narrative = llmResult.narrative || '';
      llmNewItems = llmResult.newItems || [];
      llmNewThreads = llmResult.newThreads || [];
      llmCompleteThreadIds = llmResult.completeThreadIds || [];

      // 应用 LLM 新物品（不重复——AI 已被提示 drops 已给过）
      if (llmNewItems.length) {
        state = addItems(state, llmNewItems);
      }
      // 应用新线索
      if (llmNewThreads.length) {
        state = addThreads(state, llmNewThreads);
      }
      // 完成关联线索（如敌人是某个 enemy 类线索的目标）
      for (const tid of llmCompleteThreadIds) {
        if (tid) state = completeThread(state, tid);
      }
    } catch (err: any) {
      // LLM 失败不阻塞战斗结束，仅无叙事
      console.error('combat end narrative failed:', err?.message || err);
      narrative = endStatus === 'victory'
        ? '战场归于沉寂，你立于残垣之间，胜负已分。'
        : endStatus === 'defeat'
        ? '你气血耗尽，倒于战场之上...'
        : '你身形一闪，遁入山林，远离战场。';
    }

    // 持久化：清空 combatStateJson + 应用 drops/新物品 + 新线索 + HP/MP/inventory
    await db.character.update({
      where: { id: characterId },
      data: {
        hp: state.hp,
        mp: state.mp,
        alive: state.alive,
        causeOfDeath: state.causeOfDeath || '',
        inventoryJson: JSON.stringify(state.inventory || []),
        equippedJson: JSON.stringify(state.equipped || []),
        // Task 20: 战斗结束后清空 combatSession
        combatStateJson: '',
        // Task 20: 同步未决线索（LLM 可能加新线索或完成旧线索）
        pendingThreadsJson: JSON.stringify(state.pendingThreads || []),
        // Task 22: 心魔值
        heartDemon: state.heartDemon ?? 0,
        // Task 23: 灵宠（战斗结束后灵宠 HP 需要持久化——但当前灵宠快照存在 combatSession.petCombatant，未来可考虑回写到 state.pets）
        petsJson: JSON.stringify(state.pets || []),
      },
    });

    // 写入战斗事件日志（让史册可查）
    try {
      await db.eventLog.create({
        data: {
          characterId,
          age: state.age,
          title: endStatus === 'victory'
            ? `战斗·胜·${(enemies[0]?.name || '敌').slice(0, 6)}`
            : endStatus === 'defeat'
            ? `战斗·陨·${(enemies[0]?.name || '敌').slice(0, 6)}`
            : `战斗·遁·${(enemies[0]?.name || '敌').slice(0, 6)}`,
          narrative,
          eventType: 'combat',
          effects: JSON.stringify(
            appliedDrops.length
              ? appliedDrops.map(d => ({ attribute: 'inventory', delta: 1, reason: `得 ${d.name}` }))
              : []
          ),
        },
      });
    } catch {
      // 日志写入失败不影响主流程
    }

    return NextResponse.json({
      success: true,
      // 战斗结果
      result: endStatus,
      // 战后叙事
      narrative,
      // 实际获得的战利品（含引擎应用的 + LLM 新给的）
      drops: [...appliedDrops, ...llmNewItems],
      // LLM 联动：新线索 / 完成的线索
      newThreads: llmNewThreads,
      completeThreadIds: llmCompleteThreadIds,
      // 完整状态（combatSession 已被清空）
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('combat end error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '战斗结算失败' },
      { status: 500 }
    );
  }
}
