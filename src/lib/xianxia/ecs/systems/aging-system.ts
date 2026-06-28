// AgingSystem — 演示 system（PoC 阶段 — TechDoc 18.6.3）
// 操作 Meta component：每次 tick age + 1；age >= lifespan 时 alive = false。

import type { System, World } from '../core';
import type { MetaComponent } from '../components';

export const AgingSystem: System = {
  __system: true,
  name: 'AgingSystem',
  requiredComponents: ['Meta'],
  process(world: World): World {
    const entities = world.entitiesWithComponents('Meta');
    for (const entity of entities) {
      const meta = entity.getComponent<MetaComponent>('Meta')!;
      // PoC 简化：每次 tick age + 1
      (meta as any).age += 1;
      if (meta.age >= meta.lifespan) {
        (meta as any).alive = false;
      }
    }
    return world;
  },
};
