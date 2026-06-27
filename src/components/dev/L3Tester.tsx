// AI-75: L3 机制测试 UI（仅 dev 模式使用）
'use client';

import { useState } from 'react';
import {
  deriveTribulationTrigger,
  resolveTribulationBolt,
  resolveHeartDemon,
  deriveAscensionRequirements,
  checkAscensionEligibility,
  deriveAscensionTrigger,
  resolveAscensionOutcome,
  deriveCrossRealmPaths,
  checkRestrictionAccess,
  resolveRestrictionInteraction,
  deriveRealmRestrictionCheck,
} from '@/lib/xianxia/engine';
import type { Restriction, Realm } from '@/lib/xianxia/types';

interface TestResult { name: string; passed: boolean; detail: string }

export function L3Tester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const out: TestResult[] = [];

    try {
      // 飞升
      const req = deriveAscensionRequirements('humanWorld');
      out.push({
        name: '飞升要求 humanWorld → spiritWorld',
        passed: req.toTier === 'spiritWorld' && req.minRealm === 'mahayana',
        detail: `toTier=${req.toTier}, minRealm=${req.minRealm}`,
      });

      const ok = checkAscensionEligibility(
        { realm: 'mahayana', cultivationExp: 200000, lifespan: 600, reputation: 8000, daoHeart: 90 },
        req,
      );
      out.push({
        name: '飞升资格 OK（境界/寿命/声望/修为/道心全满足）',
        passed: ok.eligible,
        detail: ok.eligible ? 'eligible' : `missing: ${ok.missing.join(', ')}`,
      });

      // 跨域
      const paths = deriveCrossRealmPaths('humanWorld');
      out.push({
        name: `跨域通道 humanWorld（${paths.length} 条）`,
        passed: paths.length >= 1,
        detail: paths.map((p) => `${p.from}→${p.to}`).join(', '),
      });

      // 天劫
      const t = deriveTribulationTrigger('golden_core', 'deity_transformation');
      out.push({
        name: '天劫触发（化神+）',
        passed: t.triggered,
        detail: t.reason,
      });

      const bolt = resolveTribulationBolt({
        boltNumber: 1, characterRoll: 1.0, heartDemon: 0, soulStrength: 100, bondedArtifactResonance: true,
      });
      out.push({
        name: '天雷 1 道（强 roll + 本命法宝共鸣）',
        passed: bolt.passed,
        detail: `passed=${bolt.passed}, hp=${bolt.hpRemaining}`,
      });

      // 心魔
      const hd = resolveHeartDemon({
        innerState: { obsession: 10, hatred: 10, love: 10, fear: 100, regret: 10 },
        resolveRoll: 0.9,
      });
      out.push({
        name: '心魔类型 = fear（恐惧主导）',
        passed: hd.demonType === 'fear',
        detail: `demonType=${hd.demonType}, passed=${hd.passed}`,
      });

      // 禁制
      const k: Restriction = {
        id: 'r1', name: '测试禁门', type: 'door', accessMethod: 'key', requiredItemId: 'k1',
        description: '', difficulty: 50,
      };
      const a1 = checkRestrictionAccess(k, { inventory: [], realm: 'qi_refining' as Realm });
      out.push({
        name: '禁制 key 缺失',
        passed: !a1.accessible,
        detail: a1.reason,
      });

      // 洞府联动
      const r = deriveRealmRestrictionCheck(
        { id: 'r1', requiredRestrictionsPassed: ['r1'], restrictions: [k] },
        ['r1'],
      );
      out.push({
        name: '洞府禁制已通过（可进入）',
        passed: r.canEnter,
        detail: r.reason,
      });
    } catch (err) {
      out.push({ name: '异常', passed: false, detail: String(err) });
    }

    setResults(out);
    setRunning(false);
  };

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div data-testid="l3-tester" className="rounded-md border border-emerald-500/30 bg-slate-900/80 p-4 text-emerald-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">L3 机制测试器（Dev）</h3>
        <span className="text-xs opacity-70">{passedCount}/{results.length} 通过</span>
      </div>
      <button
        data-testid="l3-tester-run"
        disabled={running}
        onClick={run}
        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm mb-3"
      >
        {running ? '运行中...' : '运行 L3 测试'}
      </button>
      <div className="space-y-1 text-xs">
        {results.map((r, i) => (
          <div key={i} className={r.passed ? 'text-emerald-300' : 'text-red-300'}>
            <span className="font-bold">{r.passed ? '✓' : '✗'}</span> {r.name}
            <span className="ml-2 opacity-70">{r.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}