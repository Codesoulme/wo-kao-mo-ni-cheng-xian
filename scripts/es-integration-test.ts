// @ts-nocheck - script tool, no strict types needed

// scripts/es-integration-test.ts
// 批 20b: Event Sourcing 真实链路集成测试
//
// 用法：
//   bun --db scripts/es-integration-test.ts            # 真实端到端跑（需 db）
//   bun scripts/es-integration-test.ts --help           # 看 usage
//
// 测试链路（每一步会 throw 终止后续）：
//   1. db.character.create 创建测试角色
//   2. appendEvent 追加 4 个事件（age / cultivationExp / realm / item）
//   3. getEvents 验证事件链（aggregateVersion + previousEventId 链）
//   4. reduceCharacterState 还原 state，断言字段一致
//   5. getProjectedState 走缓存路径（验证 hits / misses）
//   6. event-replay replayAdvanced 跑 replay + diff
//   7. event-timeline showTimelineAdvanced 导出 md + json
//   8. finally 清理测试数据（Event + Character）
//
// 默认需要 --db flag（参考 choose / interfere 真实链路模式）。
// 在 bun 命令下：bun --db scripts/es-integration-test.ts

import { db } from '../src/lib/db';
import {
  appendEvent,
  appendEventsBatch,
  getEvents,
  getLatestEvent,
} from '../src/lib/xianxia/events/store';
import { reduceCharacterState } from '../src/lib/xianxia/events/reducer';
import {
  getProjectedState,
  getProjectionCacheStats,
  clearProjectionCache,
} from '../src/lib/xianxia/events/projector';
import { replayAdvanced } from './event-replay';
import { showTimelineAdvanced } from './event-timeline';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';

export interface IntegrationTestResult {
  passed: number;
  failed: number;
  details: Array<{ test: string; passed: boolean; error?: string }>;
}

export async function runIntegrationTest(): Promise<IntegrationTestResult> {
  const results: IntegrationTestResult['details'] = [];
  let passed = 0;
  let failed = 0;

  // 1. 创建测试 character
  const testChar = await db.character.create({
    data: {
      name: 'es-integration-test',
      age: 20,
      realm: 'mortal',
      cultivationExp: 0,
      hp: 100,
      maxHp: 100,
      spiritStones: 100,
      alive: true,
      lifespan: 100,
    },
  });
  console.log(`[1] Created test character: ${testChar.id}`);

  try {
    // 2. append 4 个事件
    await appendEvent({
      characterId: testChar.id,
      type: 'character.age.advanced',
      data: { type: 'character.age.advanced', from: 20, to: 21 },
      source: 'system-tick',
      triggerActor: 'system',
      createdAtAge: 21,
    });
    await appendEvent({
      characterId: testChar.id,
      type: 'character.cultivation-exp.changed',
      data: {
        type: 'character.cultivation-exp.changed',
        delta: 10,
        newValue: 10,
        reason: 'integration-test',
      },
      source: 'user-action',
      triggerActor: 'player',
      createdAtAge: 21,
    });
    await appendEvent({
      characterId: testChar.id,
      type: 'character.realm.changed',
      data: {
        type: 'character.realm.changed',
        from: 'mortal',
        to: 'qi_refining',
        method: 'breakthrough',
      },
      source: 'system-tick',
      triggerActor: 'system',
      createdAtAge: 21,
    });
    await appendEvent({
      characterId: testChar.id,
      type: 'character.item.added',
      data: {
        type: 'character.item.added',
        itemId: 'test-item-1',
        item: { name: '测试剑', attack: 10 },
      },
      source: 'user-action',
      triggerActor: 'player',
      createdAtAge: 21,
    });
    console.log(`[2] Appended 4 events`);

    // 3. getEvents 验证事件链
    {
      const events = await getEvents(testChar.id);
      if (events.length !== 4) {
        throw new Error(`Expected 4 events, got ${events.length}`);
      }
      if (events[0].aggregateVersion !== 0) {
        throw new Error(`First event version should be 0, got ${events[0].aggregateVersion}`);
      }
      if (events[1].previousEventId !== events[0].id) {
        throw new Error(`Chain link broken at event 1 (prev=${events[1].previousEventId} vs e0=${events[0].id})`);
      }
      if (events[3].previousEventId !== events[2].id) {
        throw new Error(`Chain link broken at event 3 (prev=${events[3].previousEventId} vs e2=${events[2].id})`);
      }
      const latest = await getLatestEvent(testChar.id);
      if (!latest || latest.aggregateVersion !== 3) {
        throw new Error(`Latest event version should be 3, got ${latest?.aggregateVersion}`);
      }
      console.log(
        `[3] Event chain validated (4 events, version 0-3, chain OK, latest=v${latest.aggregateVersion})`,
      );
      passed++;
      results.push({ test: 'event-chain', passed: true });
    }

    // 4. reduceCharacterState 还原 state
    {
      const events = await getEvents(testChar.id);
      const baseSnapshot = {
        characterId: testChar.id,
        name: testChar.name ?? '',
        age: testChar.age,
        realm: testChar.realm,
        cultivationExp: testChar.cultivationExp,
        hp: testChar.hp,
        maxHp: testChar.maxHp,
        spiritStones: testChar.spiritStones,
        alive: testChar.alive,
        lifespan: testChar.lifespan,
        inventory: [] as Array<{ id: string; item: any }>,
      };
      const reduced = reduceCharacterState(baseSnapshot, events);
      if (reduced.age !== 21) {
        throw new Error(`Reduced age should be 21, got ${reduced.age}`);
      }
      if (reduced.cultivationExp !== 10) {
        throw new Error(`Reduced cultivationExp should be 10, got ${reduced.cultivationExp}`);
      }
      if (reduced.realm !== 'qi_refining') {
        throw new Error(`Reduced realm should be qi_refining, got ${reduced.realm}`);
      }
      if (reduced.inventory.length !== 1) {
        throw new Error(`Reduced inventory should have 1 item, got ${reduced.inventory.length}`);
      }
      console.log(
        `[4] State reduction validated (age=${reduced.age}, cultivationExp=${reduced.cultivationExp}, realm=${reduced.realm}, inventory.size=${reduced.inventory.length})`,
      );
      passed++;
      results.push({ test: 'state-reduction', passed: true });
    }

    // 5. projector 缓存路径
    {
      clearProjectionCache();
      const stats0 = getProjectionCacheStats();
      const projected1 = await getProjectedState(testChar.id);
      const stats1 = getProjectionCacheStats();
      const projected2 = await getProjectedState(testChar.id);
      const stats2 = getProjectionCacheStats();

      if (stats1.hits !== stats0.hits) {
        throw new Error(`After first call, hits should not increase (was ${stats0.hits}, now ${stats1.hits})`);
      }
      if (stats2.hits !== stats1.hits + 1) {
        throw new Error(
          `After second call, hits should increase by 1 (was ${stats1.hits}, now ${stats2.hits})`,
        );
      }
      if (projected1.age !== projected2.age || projected1.realm !== projected2.realm) {
        throw new Error(
          `Cache miss and hit should return same state (miss.age=${projected1.age}, hit.age=${projected2.age})`,
        );
      }
      console.log(
        `[5] Projector cache validated (hits: ${stats0.hits} -> ${stats1.hits} -> ${stats2.hits}, miss/hit state一致)`,
      );
      passed++;
      results.push({ test: 'projector-cache', passed: true });
    }

    // 6. event-replay replay + diff
    {
      const replayResult = await replayAdvanced({
        characterId: testChar.id,
        version: 2,
        diff: true,
      });
      if (!replayResult) {
        throw new Error(`replay returned null`);
      }
      if (replayResult.projectedState.age !== 21) {
        throw new Error(`Replay at v2 should have age=21, got ${replayResult.projectedState.age}`);
      }
      if (!replayResult.diff) {
        throw new Error(`Diff should be present`);
      }
      if (!('realm' in replayResult.diff)) {
        throw new Error(
          `Diff should include realm change (got keys: ${Object.keys(replayResult.diff).join(',')})`,
        );
      }
      if (replayResult.replayedEvents !== 3) {
        throw new Error(`Replay at v2 should include 3 events, got ${replayResult.replayedEvents}`);
      }
      console.log(
        `[6] Event replay validated (v2 replayed=${replayResult.replayedEvents}/${replayResult.totalEvents}, diff keys=${Object.keys(replayResult.diff).join(',')})`,
      );
      passed++;
      results.push({ test: 'event-replay', passed: true });
    }

    // 7. event-timeline 导出 md + json
    {
      const stamp = Date.now();
      const mdExportPath = `E:\\aigame2_publish\\scripts\\.es-timeline-${stamp}.md`;
      const jsonExportPath = `E:\\aigame2_publish\\scripts\\.es-timeline-${stamp}.json`;

      await showTimelineAdvanced({
        characterId: testChar.id,
        format: 'md',
        exportPath: mdExportPath,
        aggregate: true,
      });
      const md = readFileSync(mdExportPath, 'utf-8');
      // 实际渲染标题是 "# Event Timeline: <characterId>"
      if (!md.includes('# Event Timeline')) {
        throw new Error(`MD export missing title (got first 80 chars: ${md.slice(0, 80)})`);
      }
      if (!md.includes('## Aggregate')) {
        throw new Error(`MD export missing aggregate section`);
      }
      if (!md.includes('## Events')) {
        throw new Error(`MD export missing events section`);
      }
      unlinkSync(mdExportPath);

      await showTimelineAdvanced({
        characterId: testChar.id,
        format: 'json',
        exportPath: jsonExportPath,
      });
      const jsonRaw = readFileSync(jsonExportPath, 'utf-8');
      const parsed = JSON.parse(jsonRaw);
      if (!Array.isArray(parsed.events) || parsed.events.length !== 4) {
        throw new Error(`JSON export should contain 4 events, got ${parsed.events?.length}`);
      }
      if (!parsed.aggregate || Object.keys(parsed.aggregate).length === 0) {
        throw new Error(`JSON export aggregate should be present`);
      }
      unlinkSync(jsonExportPath);

      console.log(
        `[7] Timeline export validated (md+json, md sections OK, json events=${parsed.events.length})`,
      );
      passed++;
      results.push({ test: 'timeline-export', passed: true });
    }

    // 8. appendEventsBatch 批量提交
    {
      // 拿当前最新 version（前面 4 个 event 后 → v3）
      const before = await getLatestEvent(testChar.id);
      const startVersion = before?.aggregateVersion ?? -1;

      // 一次事务提交 3 个事件
      const created = await appendEventsBatch(testChar.id, [
        {
          type: 'character.cultivation-exp.changed',
          data: { type: 'character.cultivation-exp.changed', delta: 50, newValue: 60, reason: 'batch-1' },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: 22,
        },
        {
          type: 'character.hp.changed',
          data: { type: 'character.hp.changed', delta: -10, newValue: 90, reason: 'batch-2' },
          source: 'system-tick',
          triggerActor: 'system',
          createdAtAge: 22,
        },
        {
          type: 'character.item.added',
          data: { type: 'character.item.added', itemId: 'batch-item-3', item: { name: '批量剑' } },
          source: 'user-action',
          triggerActor: 'player',
          createdAtAge: 22,
        },
      ]);
      if (created.length !== 3) {
        throw new Error(`Batch should create 3 events, got ${created.length}`);
      }
      // 链式引用 + aggregateVersion 连续
      if (created[0].aggregateVersion !== startVersion + 1) {
        throw new Error(`Batch[0] version should be ${startVersion + 1}, got ${created[0].aggregateVersion}`);
      }
      if (created[1].aggregateVersion !== startVersion + 2) {
        throw new Error(`Batch[1] version should be ${startVersion + 2}, got ${created[1].aggregateVersion}`);
      }
      if (created[2].aggregateVersion !== startVersion + 3) {
        throw new Error(`Batch[2] version should be ${startVersion + 3}, got ${created[2].aggregateVersion}`);
      }
      if (created[0].previousEventId !== before?.id) {
        throw new Error(`Batch[0] prev should be latest (${before?.id}), got ${created[0].previousEventId}`);
      }
      if (created[1].previousEventId !== created[0].id) {
        throw new Error(`Batch[1] prev should be Batch[0].id, got ${created[1].previousEventId}`);
      }
      if (created[2].previousEventId !== created[1].id) {
        throw new Error(`Batch[2] prev should be Batch[1].id, got ${created[2].previousEventId}`);
      }
      // 总数应该是 4 + 3 = 7
      const all = await getEvents(testChar.id);
      if (all.length !== 7) {
        throw new Error(`After batch, total events should be 7, got ${all.length}`);
      }
      // reducer 验证 batch 后 state 正确
      const reduced = reduceCharacterState(
        {
          characterId: testChar.id,
          name: testChar.name ?? '',
          age: testChar.age,
          realm: testChar.realm,
          cultivationExp: 0,
          hp: 100,
          maxHp: 100,
          spiritStones: testChar.spiritStones,
          alive: testChar.alive,
          lifespan: testChar.lifespan,
          inventory: [] as Array<{ id: string; item: any }>,
        },
        all
      );
      if (reduced.cultivationExp !== 60) {
        throw new Error(`After batch, cultivationExp should be 60, got ${reduced.cultivationExp}`);
      }
      if (reduced.hp !== 90) {
        throw new Error(`After batch, hp should be 90, got ${reduced.hp}`);
      }
      if (reduced.inventory.length !== 2) {
        throw new Error(`After batch, inventory should have 2 items, got ${reduced.inventory.length}`);
      }
      // 空数组边界
      const empty = await appendEventsBatch(testChar.id, []);
      if (empty.length !== 0) {
        throw new Error(`Empty batch should return [], got length ${empty.length}`);
      }
      console.log(
        `[8] Batch append validated (3 events chain v${created[0].aggregateVersion}..v${created[2].aggregateVersion}, total=${all.length}, empty batch returns [])`,
      );
      passed++;
      results.push({ test: 'batch-append', passed: true });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FAIL] ${msg}`);
    failed++;
    results.push({ test: 'integration-error', passed: false, error: msg });
  } finally {
    // 8. 清理测试数据
    try {
      await db.event.deleteMany({ where: { characterId: testChar.id } });
      await db.character.delete({ where: { id: testChar.id } });
      console.log(`[8] Cleanup done (characterId=${testChar.id})`);
    } catch (cleanupErr) {
      console.error(
        `[WARN] cleanup failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
      );
    }
  }

  return { passed, failed, details: results };
}

function printUsage(): void {
  console.log('Usage:');
  console.log('  bun --db scripts/es-integration-test.ts   # 真实端到端跑（需 db）');
  console.log('');
  console.log('测试链路:');
  console.log('  1. db.character.create 创建测试角色');
  console.log('  2. appendEvent 追加 4 个事件');
  console.log('  3. getEvents 验证事件链（aggregateVersion + previousEventId）');
  console.log('  4. reduceCharacterState 还原 state');
  console.log('  5. getProjectedState 走缓存路径');
  console.log('  6. event-replay replayAdvanced + diff');
  console.log('  7. event-timeline 导出 md + json');
  console.log('  8. 清理测试数据');
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  runIntegrationTest()
    .then((result) => {
      console.log(`\n=== Integration Test: ${result.passed} pass / ${result.failed} fail ===`);
      console.log(JSON.stringify(result.details, null, 2));
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}

export { writeFileSync, readFileSync, unlinkSync };