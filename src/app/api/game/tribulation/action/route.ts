// POST /api/game/tribulation/action
// AI-67: 渡劫行动——执行一道雷或一次心魔判定
// P1-2 修复：前端不再发送 characterRoll/heartDemon/soulStrength/bondedArtifactResonance，
// 全部由后端从 character 派生：数值字段从 db 取，characterRoll 用确定性 hash(characterId+boltNumber+age+realm+comprehension) 计算。
// 这保证玩家无法通过 DevTools 反复重发请求直到 random >= 0.5 刷出好结果。
// P1 step2: 收 where: { id, userId } + hash seed 含 userId（防恶意调），dev 模式 userId: undefined → seed 退化为原值
// ADMIN_TOKEN 未设时跳过 auth（user=null），沿用原行为。

import { getCurrentUser } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  resolveTribulationBolt,
  resolveHeartDemon,
} from '@/lib/xianxia/engine';
import { db } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 15;

const schema = z.object({
  action: z.enum(['bolt', 'heart_demon']),
  characterId: z.string().min(1),
  boltNumber: z.number().int().min(1).max(9).optional(),
  innerState: z
    .object({
      obsession: z.number(),
      hatred: z.number(),
      love: z.number(),
      fear: z.number(),
      regret: z.number(),
    })
    .optional(),
});

/**
 * P1-2: 确定性 hash 算 characterRoll。
 * 输入 = characterId + userId + boltNumber + 角色年龄 + 境界 + 悟性 + 心魔值
 * 输出 = [0, 1) 之间的伪随机数（同一输入永远给同一输出）。
 * 玩家无法通过改参数来"刷"roll，但角色状态/装备的改变会改变后续 roll。
 * P1 step2: 加 userId 到 seed 防恶意调（同 characterId 跨 user 不能撞 roll）。
 */
function deriveCharacterRoll(input: {
  characterId: string;
  userIdSeed: string;
  boltNumber: number;
  age: number;
  realm: string;
  realmLevel: number;
  comprehension: number;
  heartDemon: number;
}): number {
  const seed = [
    input.characterId,
    input.userIdSeed,
    input.boltNumber,
    input.age,
    input.realm,
    input.realmLevel,
    input.comprehension,
    input.heartDemon,
  ].join('|');
  const hash = createHash('sha256').update(seed).digest();
  // 取前 4 字节转 uint32，再除以 2^32 得到 [0, 1)
  const u32 = hash.readUInt32BE(0);
  return u32 / 0x1_0000_0000;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const data = parsed.data;

  const isProdMode = !!process.env.ADMIN_TOKEN;
  let user: { id: string } | null = null;
  if (isProdMode) {
    user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  // P1-2: 加载角色，所有派生值从 db 取
  const char = await db.character.findUnique({ where: { id: data.characterId, userId: user?.id } });
  if (!char) {
    return NextResponse.json({ ok: false, error: '角色不存在' }, { status: 404 });
  }

  // P1 step2: userId 参与 seed（dev 模式 userId 为 null/undefined 时用 char.userId 兜底 → 与原行为一致）
  const userIdSeed = user?.id ?? (char.userId ?? 'anon');

  if (data.action === 'bolt') {
    if (!data.boltNumber) {
      return NextResponse.json({ ok: false, error: 'boltNumber 必填' }, { status: 400 });
    }
    // P1-2: soulStrength 在 db schema 中没有直接字段，按"悟性 + 修为"派生（100 上限），
    // 维持与原 0-100 区间一致。
    const soulStrength = Math.max(0, Math.min(100, Math.round((char.comprehension + Math.min(100, char.cultivationExp / 100)) / 2)));
    // bondedArtifactResonance: 已装备物品中含 "本命" 标签则触发共鸣。
    const equipped: Array<{ name?: string; boundTo?: string; rarity?: string }> = (() => {
      try {
        const parsedEq = JSON.parse(char.equippedJson || '[]');
        return Array.isArray(parsedEq) ? parsedEq : [];
      } catch {
        return [];
      }
    })();
    const bondedArtifactResonance = equipped.some(
      (it) => it?.boundTo === char.id || (typeof it?.name === 'string' && /本命|命魂|本命法宝/.test(it.name))
    );

    const characterRoll = deriveCharacterRoll({
      characterId: char.id,
      userIdSeed,
      boltNumber: data.boltNumber,
      age: char.age,
      realm: char.realm,
      realmLevel: char.realmLevel,
      comprehension: char.comprehension,
      heartDemon: char.heartDemon ?? 0,
    });

    const result = resolveTribulationBolt({
      boltNumber: data.boltNumber,
      characterRoll,
      heartDemon: char.heartDemon ?? 0,
      soulStrength,
      bondedArtifactResonance,
    });
    return NextResponse.json({
      ok: true,
      result,
      // P1-2: 调试回执，便于回归测试断言（不暴露在生产 UI）
      _debug: { characterRoll, heartDemon: char.heartDemon ?? 0, soulStrength, bondedArtifactResonance },
    });
  }

  // heart_demon: 心魔试炼
  if (!data.innerState) {
    return NextResponse.json({ ok: false, error: 'innerState 必填' }, { status: 400 });
  }
  // P1-2: 心魔试炼的 resolveRoll 也走确定性 hash（用 characterId+userId+age+comprehension 作 seed）
  // P1 step2: seed 加 userId
  const seed = `${char.id}|${userIdSeed}|heart_demon|${char.age}|${char.comprehension}|${char.heartDemon ?? 0}`;
  const hash = createHash('sha256').update(seed).digest();
  const resolveRoll = hash.readUInt32BE(0) / 0x1_0000_0000;

  const result = resolveHeartDemon({
    innerState: data.innerState,
    resolveRoll,
  });
  return NextResponse.json({ ok: true, result });
}
