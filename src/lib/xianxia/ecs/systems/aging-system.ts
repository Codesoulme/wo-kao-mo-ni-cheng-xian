// AgingSystem — 操作 Meta component（TechDoc 18.6.3）
// 每次 tick 按 meta.ageDelta 推进年岁（缺省 0）；age >= lifespan 时 alive = false。
//
// 2026-08-31 改：原先写死 age += 1。tick 被 11 条路由共用，坊市、斗法、炼丹
// 每调一次就长一岁，玩家看到的就是"随手做点事，一年没了"。
// 年岁归时序推进独家掌管，本 system 只负责把它交代的增量落到 component 上，
// 顺带守住寿元这道线。

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
      const delta = Number(meta.ageDelta) || 0;
      if (delta > 0) {
        (meta as any).age += delta;
      }
      if (meta.age >= meta.lifespan) {
        (meta as any).alive = false;
      }
    }
    return world;
  },
};
