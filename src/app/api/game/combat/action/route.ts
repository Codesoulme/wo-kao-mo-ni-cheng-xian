// POST /api/game/combat/action
// 战斗行动：玩家在战斗中执行一回合（普攻/法术/丹药/防御/逃跑）
// 请求体：{ characterId, action: 'attack'|'skill'|'item'|'defend'|'flee', payload?: { skillIdx?, itemId? } }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  dbToState, executeCombatRound, stateToResponse,
} from '@/lib/xianxia/engine';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      characterId: z.string(),
      action: z.enum(['attack', 'skill', 'item', 'talisman', 'defend', 'flee']),
      payload: z.object({
        skillIdx: z.number().optional(),
        itemId: z.string().optional(),
      }).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    const { characterId, action, payload } = parsed.data;

    const char = await db.character.findUnique({ where: { id: characterId } });
    if (!char) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    if (!char.alive) return NextResponse.json({ success: false, error: '角色已陨落' }, { status: 400 });

    let state = dbToState(char as any);

    // 必须有进行中的战斗
    if (!state.combatSession || state.combatSession.status !== 'ongoing') {
      return NextResponse.json({ success: false, error: '当前无进行中的战斗' }, { status: 400 });
    }

    // 执行战斗回合（引擎权威：计算伤害、扣血、扣灵力、消耗丹药、判定胜负）
    const result = executeCombatRound(state, action, payload || {});
    state = result.state;

    // 持久化：HP/MP/inventory（丹药可能被消耗）/ combatStateJson
    // 死亡时也要持久化 alive=false
    await db.character.update({
      where: { id: characterId },
      data: {
        hp: state.hp,
        mp: state.mp,
        maxHp: state.maxHp,
        maxMp: state.maxMp,
        alive: state.alive,
        causeOfDeath: state.causeOfDeath || '',
        inventoryJson: JSON.stringify(state.inventory || []),
        // Task 20: 持久化战斗会话（含 log、status、剩余敌人 HP 等）
        combatStateJson: state.combatSession ? JSON.stringify(state.combatSession) : '',
      },
    });

    return NextResponse.json({
      success: true,
      // 本回合战斗记录
      round: result.round,
      // 战斗是否结束
      ended: result.ended,
      endStatus: result.endStatus,
      // 战斗胜利掉落（仅 victory 时有值；实际应用在 /api/game/combat/end 中处理）
      victoryDrops: result.victoryDrops,
      // 完整状态（含更新后的 combatSession）
      state: stateToResponse(state),
    });
  } catch (err: any) {
    console.error('combat action error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '战斗行动失败' },
      { status: 500 }
    );
  }
}
