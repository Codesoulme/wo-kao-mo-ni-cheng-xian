// CultivationSystem — 演示 system（PoC 阶段 — TechDoc 18.6.3）
// 操作 Cultivation + Stats component：每次 tick 增加修为 = cultivationSpeed * comprehension * 0.1。

import type { System, World } from '../core';
import type { CultivationComponent, StatsComponent } from '../components';

export const CultivationSystem: System = {
  __system: true,
  name: 'CultivationSystem',
  requiredComponents: ['Cultivation', 'Stats'],
  process(world: World): World {
    const entities = world.entitiesWithComponents('Cultivation', 'Stats');
    for (const entity of entities) {
      const cultivation = entity.getComponent<CultivationComponent>('Cultivation')!;
      const stats = entity.getComponent<StatsComponent>('Stats')!;
      // PoC 简化：每次 tick 增加修为
      const delta = cultivation.cultivationSpeed * stats.comprehension * 0.1;
      (cultivation as any).cultivationExp += delta;
    }
    return world;
  },
};
