// @ts-nocheck - api route, types not critical

// POST /api/game/ascension/end
// AI-68: 飞升结算
// P1-2 修复：前端不再发送 characterRoll/daoHeart/tribulationPassed/requirements，
// 全部由后端从 character 派生：characterRoll/daoHeart 走确定性 hash，tribulationPassed 从 character.tribulationResultJson 读取。
// P1 step2: 收 where: { id, userId } + hash seed 含 userId（防恶意调），dev 模式 userId: undefined → seed 退化为原值
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { resolveAscensionOutcome, type AscensionRequirement } from '@/lib/xianxia/engine';
import { db } from '@/lib/db';
import { appendEvent } from '@/lib/xianxia/events/store';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 10;

const schema = z.object({
  sessionId: z.string(),
  characterId: z.string().min(1),
});

function deriveRoll(seed: string): number {
  const hash = createHash('sha256').update(seed).digest();
  return hash.readUInt32BE(0) / 0x1_0000_0000;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  const data = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  let user: { id: string } | null = null;
  if (isProdMode) {
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  // P1-2: 加载角色，从 db 派生所有数值
  const char = await db.character.findUnique({ where: { id: data.characterId, userId: user?.id } });
  if (!char) {
    return NextResponse.json({ ok: false, error: '角色不存在' }, { status: 404 });
  }

  // tribulationPassed: 解析 tribulationResultJson，passed=true 即视为已渡劫
  let tribulationPassed = false;
  try {
    const parsedTrib = char.tribulationResultJson ? JSON.parse(char.tribulationResultJson) : null;
    if (parsedTrib && typeof parsedTrib === 'object' && 'passed' in parsedTrib) {
      tribulationPassed = Boolean((parsedTrib as { passed: boolean }).passed);
    }
  } catch {
    tribulationPassed = false;
  }

  // ascensionSessionJson 中应包含 requirements (fromTier/toTier/...) 持久化
  let requirements: AscensionRequirement = {
    fromTier: 'humanWorld',
    toTier: 'spiritWorld',
    minRealm: 'tribulation',
    tribulationPassed: true,
    lifespanMin: 0,
    reputationMin: 0,
    cultivationExpMin: 0,
    daoHeartMin: 0,
  } as AscensionRequirement;
  try {
    const ascSession = char.ascensionSessionJson ? JSON.parse(char.ascensionSessionJson) : null;
    if (ascSession && typeof ascSession === 'object' && (ascSession as any).requirements) {
      requirements = (ascSession as any).requirements as AscensionRequirement;
    }
  } catch {
    // 使用默认 requirements
  }

  // daoHeart 派生：按 悟性 + 修为综合（0-100 区间），与 schema 字段解耦
  const daoHeart = Math.max(
    0,
    Math.min(100, Math.round((char.comprehension + Math.min(100, char.cultivationExp / 100)) / 2))
  );

  // 确定性 hash 算 roll
  // P1 step2: seed 含 userId（dev 模式 userId 为 null/undefined 时与原值同效）—— 防止其他 user 拿到 characterId 也能调
  const userIdSeed = user?.id ?? (char.userId ?? 'anon');
  const characterRoll = deriveRoll(
    `${char.id}|${userIdSeed}|ascension|${char.age}|${char.realm}|${char.realmLevel}|${char.comprehension}|${char.heartDemon ?? 0}`
  );

  const result = resolveAscensionOutcome({
    characterRoll,
    daoHeart,
    tribulationPassed,
    requirements,
  });

  // Event Sourcing（PoC17）：ascension/end 在飞升成功时追加事件。
  // 语义映射：
  //   飞升成功 → character.realm.changed（from=当前 realm, to=requirements.toTier 标签, method=set）
  //   飞升成功 → character.alive.changed（alive=true 不变，cause=ascension 标记）
  //   飞升失败 → 不追加事件（保持主流程不变量）。
  // Worker G 确定性 hash（characterRoll / daoHeart / tribulationPassed）保持不变。
  // appendEvent 失败用 try/catch 兜底——不能影响主流程结算回执。
  if (result.passed) {
    try {
      await appendEvent({
        characterId: data.characterId,
        type: 'character.realm.changed',
        data: {
          type: 'character.realm.changed',
          from: char.realm,
          to: requirements.toTier,
          method: 'set',
        },
        source: 'system-tick',
        triggerActor: 'system',
        createdAtAge: char.age,
      });
      await appendEvent({
        characterId: data.characterId,
        type: 'character.alive.changed',
        data: {
          type: 'character.alive.changed',
          alive: true,
          cause: 'ascension',
        },
        source: 'system-tick',
        triggerActor: 'system',
        createdAtAge: char.age,
      });
    } catch (evtErr: any) {
      console.error('[ascension/end] appendEvent failed (non-fatal):', evtErr?.message || evtErr);
    }
  }

  return NextResponse.json({
    ok: true,
    settlement: {
      sessionId: data.sessionId,
      passed: result.passed,
      narrative: result.narrative,
    },
    // P1-2: 调试回执（仅测试可见）
    _debug: { characterRoll, daoHeart, tribulationPassed },
  });
}
