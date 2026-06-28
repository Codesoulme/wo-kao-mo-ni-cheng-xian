// ECS 核心抽象（PoC 阶段 — TechDoc 18.6.3）
// 参考 Unity DOTS / Unreal Mass Entity / Bevy ECS 思路。
//
// 关键设计：
// - Entity 是 ID + Component 容器的薄包装
// - Component 是纯数据对象（marker 标识 + 字段）
// - System 是 process(world) → world 的纯函数（PoC 简化，不做 parallel scheduling）
// - World 是 Entity 集合 + System 列表
//
// PoC 阶段新 class 与现有 Character 实现并存，不替换。

export type EntityId = string;

/** Component marker 接口 — 所有 component 都实现 */
export interface Component {
  readonly __component: true;
  readonly __type: string;
}

export class Entity {
  readonly id: EntityId;
  private components = new Map<string, Component>();

  constructor(id: EntityId) {
    this.id = id;
  }

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.__type, component);
    return this;
  }

  removeComponent(type: string): this {
    this.components.delete(type);
    return this;
  }

  getComponent<T extends Component>(type: string): T | null {
    return (this.components.get(type) as T) ?? null;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  listComponents(): string[] {
    return Array.from(this.components.keys());
  }
}

export interface System {
  readonly __system: true;
  readonly name: string;
  readonly requiredComponents: readonly string[];

  /** PoC 简化：纯函数 (world → world)。真实应该用 parallel scheduling + deltaTime。 */
  process(world: World): World;
}

export class World {
  private entities = new Map<EntityId, Entity>();
  private systems: System[] = [];

  createEntity(id?: EntityId): Entity {
    const entityId =
      id ?? `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entity = new Entity(entityId);
    this.entities.set(entityId, entity);
    return entity;
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  getEntity(id: EntityId): Entity | null {
    return this.entities.get(id) ?? null;
  }

  listEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  addSystem(system: System): this {
    this.systems.push(system);
    return this;
  }

  listSystems(): System[] {
    return [...this.systems];
  }

  /** PoC 简化：跑所有 system。每个 system 拿到自己关心的 entity 子集。 */
  tick(): void {
    for (const system of this.systems) {
      system.process(this);
    }
  }

  /** 按 requiredComponents 过滤 entities 给 system。 */
  entitiesWithComponents(...types: string[]): Entity[] {
    return this.listEntities().filter((e) => types.every((t) => e.hasComponent(t)));
  }
}
