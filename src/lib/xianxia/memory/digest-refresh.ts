// 纪要刷新与排期（摘要层接线 · 甲步）
//
// ── 甲步的定义 ──────────────────────────────────────────────
// 纯增量。**喂给模型的内容一个字都不改。**
// 本模块只做一件事：在响应已经关闭之后，把 EventLog 派生成 NarrativeDigest 行。
// 谁去读这些行、怎么注入 prompt，全是乙步的活，本批不碰。
// 具体地说，engine/lifecycle 的定长裁剪保持原样——那是模型输入，动它要另走终审。
//
// ── 为什么排在响应之后，而不是 done 之前 ────────────────────
// 玩家等的是下一岁的正文，不是纪要。纪要是旁路派生物，
// 让它占用哪怕一毫秒的等待都不划算，何况它可能读几百行 EventLog。
// 所以：先 close()，再排期；排期本身用宏任务丢出去，
// 连 ReadableStream 的 start() promise 都不等它。
// 由此得到三条保证：
//   1. 生成失败不影响玩家已经收到的内容——内容早已发完，连接早已关闭
//   2. 独立 try/catch，异常只落日志，绝不上抛
//   3. SSE 连接不会因为等它而延迟关闭
//
// ⚠ 部署形态提醒：本机与常驻 node 进程下宏任务必然执行；
// 若将来搬到响应结束即冻结的无服务器运行时，这一轮会被丢掉。
// 那种形态下纪要会滞后一轮，但**不会出错**——下次推进照样补上，
// 且指纹幂等保证不会写重。所以此处不做额外兜底。

import { db } from '../../db';
import { planDigests, type DigestSourceEvent } from './digest-generator';
import { loadRealmTimeline } from './realm-timeline';
import {
  upsertDigests,
  verifyDigestCoverage,
  type CoverageReport,
  type NarrativeDigestInput,
} from './digest-store';

/** 环境开关。置 '0' 可整体关掉自动生成，出问题时不用改代码就能止血 */
export const DIGEST_AUTO_ENV = 'XIANXIA_DIGEST_AUTO';

export interface DigestRefreshOptions {
  /** 角色当前大境界。调用方手上有就传，省一次查库 */
  currentRealm?: string;
  /** 角色当前岁数，仅用于日志 */
  currentAge?: number;
  /** 逐字保留的最近岁数，透传给 planDigests */
  l0RecentYears?: number;
}

export interface DigestRefreshReport {
  ok: boolean;
  characterId: string;
  /** EventLog 总条数 */
  totalEvents: number;
  /** 落在 L0 逐字区、不进纪要表的条数 */
  level0Count: number;
  /** 本轮生成的草稿数 */
  draftCount: number;
  /** 新建行数 */
  created: number;
  /** 命中已有指纹、被覆盖的行数。幂等重跑时应当全是这一栏 */
  updated: number;
  /** 境界时间线来源：'fallback' 表示零变更点走了单段兜底（常态） */
  realmSource: 'events' | 'fallback';
  realmPointCount: number;
  coverage: CoverageReport | null;
  /** 没生成时的原因（无事件 / 开关关闭 / 全在 L0 区） */
  skippedReason?: string;
  error?: string;
  elapsedMs: number;
}

function emptyReport(characterId: string, skippedReason: string, elapsedMs: number): DigestRefreshReport {
  return {
    ok: true,
    characterId,
    totalEvents: 0,
    level0Count: 0,
    draftCount: 0,
    created: 0,
    updated: 0,
    realmSource: 'fallback',
    realmPointCount: 0,
    coverage: null,
    skippedReason,
    elapsedMs,
  };
}

/**
 * 把一个角色的 EventLog 重新派生成纪要行。
 *
 * 幂等：写入走 digest-store.upsertDigests，去重键是
 * (characterId, boundaryFingerprint) 复合唯一索引。
 * 同一状态连续触发多次，只会把已有行覆盖成同样的内容，行数不变。
 *
 * 本函数**只写 NarrativeDigest 表**，不碰 EventLog、不碰 Character、
 * 不碰任何进入 prompt 的路径。
 */
export async function refreshCharacterDigests(
  characterId: string,
  options: DigestRefreshOptions = {}
): Promise<DigestRefreshReport> {
  const started = Date.now();
  if (!characterId) return emptyReport('', '没有角色 id', Date.now() - started);
  if (process.env[DIGEST_AUTO_ENV] === '0') {
    return emptyReport(characterId, '自动生成开关已关闭', Date.now() - started);
  }

  try {
    const rows = await db.eventLog.findMany({
      where: { characterId },
      orderBy: [{ age: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, age: true, title: true, narrative: true, eventType: true },
    });
    if (rows.length === 0) {
      return emptyReport(characterId, '该角色还没有历史事件', Date.now() - started);
    }

    const events: DigestSourceEvent[] = rows.map((r) => ({
      id: r.id,
      age: r.age,
      title: r.title ?? '',
      narrative: r.narrative ?? '',
      eventType: r.eventType ?? 'normal',
    }));

    // 境界与岁数：调用方给了就用，没给再查库
    let currentRealm = options.currentRealm;
    if (!currentRealm) {
      const char = await db.character.findUnique({
        where: { id: characterId },
        select: { realm: true },
      });
      currentRealm = char?.realm ?? undefined;
    }

    const realm = await loadRealmTimeline(characterId, { currentRealm, birthAge: 0 });

    const plan = planDigests(events, realm.timeline, {
      ...(options.l0RecentYears !== undefined ? { l0RecentYears: options.l0RecentYears } : {}),
    });

    if (plan.drafts.length === 0) {
      return {
        ...emptyReport(characterId, '历史全部落在逐字区，还没有需要压缩的段', Date.now() - started),
        totalEvents: plan.totalEvents,
        level0Count: plan.level0.length,
        realmSource: realm.source,
        realmPointCount: realm.changePointCount,
      };
    }

    const inputs: NarrativeDigestInput[] = plan.drafts.map((d) => ({
      characterId,
      level: d.level,
      startAge: d.startAge,
      endAge: d.endAge,
      realmAtStart: d.realmAtStart,
      summary: d.summary,
      highlights: d.highlights,
      coveredEventCount: d.coveredEventCount,
      boundaryFingerprint: d.boundaryFingerprint,
    }));

    const written = await upsertDigests(inputs);
    const coverage = verifyDigestCoverage(written.rows, plan.level0.length, plan.totalEvents);

    return {
      ok: true,
      characterId,
      totalEvents: plan.totalEvents,
      level0Count: plan.level0.length,
      draftCount: plan.drafts.length,
      created: written.created,
      updated: written.updated,
      realmSource: realm.source,
      realmPointCount: realm.changePointCount,
      coverage,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ...emptyReport(characterId, '', Date.now() - started),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── 排期（响应之后的缝隙）─────────────────────────────────────

/**
 * 同角色在途标记。
 * 玩家连点推进时上一轮可能还在跑，重复排期只是白读一遍库——
 * 指纹幂等保证不会写重，但没必要浪费。跳过即可，不排队不重试：
 * 下一次推进本来就会重新派生一遍，漏一轮没有任何后果。
 */
const inFlight = new Set<string>();

export function digestRefreshInFlightCount(): number {
  return inFlight.size;
}

export interface ScheduleDigestInput {
  characterId: string;
  currentRealm?: string;
  currentAge?: number;
}

/**
 * 排一轮纪要刷新，立刻返回。
 *
 * **同步返回，不返回 promise，调用方无从 await**——这是刻意的：
 * 签名上就堵死"顺手 await 一下"，免得日后有人把它挪到 close() 之前
 * 再补个 await，悄悄变成阻塞项。
 */
export function scheduleDigestRefresh(input: ScheduleDigestInput): void {
  try {
    const characterId = input?.characterId;
    if (!characterId) return;
    if (process.env[DIGEST_AUTO_ENV] === '0') return;
    if (inFlight.has(characterId)) return;
    inFlight.add(characterId);

    // 宏任务丢出去：连 ReadableStream 的 start() promise 都不等它
    const timer = setTimeout(() => {
      refreshCharacterDigests(characterId, {
        currentRealm: input.currentRealm,
        currentAge: input.currentAge,
      })
        .then((report) => {
          if (!report.ok) {
            console.warn('[digest] 纪要生成失败（非致命，玩家侧无影响）:', report.error);
            return;
          }
          if (report.skippedReason) {
            console.log('[digest] 本轮不生成纪要：', report.skippedReason);
            return;
          }
          console.log(
            `[digest] 纪要已刷新：新建 ${report.created} / 覆盖 ${report.updated}，` +
              `境界时间线来源 ${report.realmSource}，缺口校验 ${report.coverage?.ok ? '通过' : report.coverage?.reason}`
          );
        })
        .catch((err) => {
          // 到这里说明连 refreshCharacterDigests 自己的兜底都没接住，仍然只记日志
          console.warn('[digest] 纪要生成抛出未捕获异常（非致命）:', err?.message || err);
        })
        .finally(() => {
          inFlight.delete(characterId);
        });
    }, 0);
    // 常驻进程里不让这颗定时器影响退出时机
    if (typeof (timer as { unref?: () => void })?.unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
  } catch (err) {
    // 排期本身都能失败的话，也只记日志。玩家已经拿到全部内容了
    console.warn('[digest] 纪要排期失败（非致命）:', err instanceof Error ? err.message : String(err));
  }
}
