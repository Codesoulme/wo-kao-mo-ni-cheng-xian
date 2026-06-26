# 角色传承蓝图（Inheritance Blueprint）

> 本表界定游戏中"角色死亡/飞升/放弃 → 新角色继承"的机制、数据契约、AI 接管。
>
> **设计原则**：传承不是简单数值传递，而是"命格因果"延续；新角色与前世有真实联系。

---

## 1. 触发条件

| 触发 | 条件 | 玩家可见提示 |
|------|------|------|
| 飞升 | 修为达化神期满 | 「此身证道，从此飞升上界」 |
| 死亡 | 气血 ≤ 0 | 「此身命数已尽」 |
| 放弃 | 玩家主动 | 「此身缘尽，当另开新篇」 |
| 心魔失控 | 心魔 ≥ 90 且走火 | 「此身被心魔所夺」 |

---

## 2. 传承类型

### 2.1 命格传承

| 类型 | 内部 enum | 玩家可见 label | 强度 |
|------|------|------|------|
| 血脉 | `bloodline` | 「此身血脉所遗」 | 弱-中 |
| 命格 | `fateMark` | 「前缘所系」 | 中-强 |
| 执念 | `obsession` | 「未竟之念」 | 强 |
| 因果 | `karma` | 「此界因果」 | 极强 |

### 2.2 传承选择

**规则**：玩家**必须选且只能选 1 项**传承到下一世。

| 传承项 | 来源 | 效果 |
|------|------|------|
| 灵根 | 前世灵根 | 新角色继承灵根类型 |
| 一项功法 | 前世习得 | 新角色初始习得 |
| 一段记忆 | 前世 memory | 新角色开局有此线索 |
| 一缕神识 | 前世 soulRealm | 新角色初期 +10% 神识 |
| 一位故人 | 前世 NPC | 1 位 NPC 主动寻新角色 |
| 一枚信物 | 前世物品 | 新角色开局有此物品 |

---

## 3. 数据契约

```ts
interface SettlementResult {
  previousCharacterId: string;
  causeOfDeath: 'ascension' | 'death' | 'abandon' | 'heartDemon';
  deathAge: number;
  finalRealm: RealmEnum;
  inheritanceChoice: InheritanceChoice;  // 玩家选的那一项
  inheritanceOptions: InheritanceChoice[];  // 候选
  bloodlineTendency: BloodlineTendency;  // AI 写前世血脉倾向
  unfulfilledOaths: string[];           // 未了因果（传给新角色）
  worldChanged: WorldChangeSummary;     // 世界因前世而变的内容
}

interface InheritanceChoice {
  type: 'spiritualRoot' | 'technique' | 'memory' | 'soulFragment' | 'oldFriend' | 'token';
  sourceId: string;
  displayLabel: string;  // 玩家可见中文
  effectDescription: string;
}
```

---

## 4. AI 接管

### 4.1 传承叙事

- 玩家选传承 → AI 写一段"前世缘尽，新身初生"的 50-100 字叙事
- AI 写"新角色继承后第一件事"（如：前世仇敌找上门 / 故人送贺礼 / 梦到前世事）

### 4.2 未了因果

- 前世的未了线索（pendingThreads）部分传给新角色
- 传给哪几条由 AI 据"因果亲密度"决定
- 传给新角色时，title/description 自动改写为新角色视角

### 4.3 世界变化

- AI 总结"前世离世后，世界有何变化"：
  - 前世仇敌 → 修为/势力变化
  - 前世宗门 → 兴衰
  - 前世秘境 → 关闭/开放
  - 前世故人 → 后续命运

---

## 5. 玩家可见文案

- 结算标题：「前缘已尽，新身初降」
- 传承选择界面：「此身可遗」「此身可继」
- 未了因果提示：「此身未了之事，将由后身承之」
- 世界变化提示：「你离去后，江湖已变」

---

## 6. Smoke 验证清单

| Smoke | 验证项 |
|------|------|
| `smokeInheritanceChoiceExactlyOne` | 必须且只能选 1 项 |
| `smokeInheritanceTypesExist` | 6 种传承类型完整 |
| `smokeInheritanceAiNarrative` | AI 写传承叙事 |
| `smokeInheritanceBlueprint` | 蓝图文档完整 |

---

## 7. 边界约束

- **单存档清理**：settlement 完成后原存档清空，避免与新存档冲突
- **传承数 ≤ 1**：违反则报错
- **AI 不能改变已选传承**：玩家选完后不可改
- **未了因果不可丢失**：前世 pendingThreads 强制传给新角色至少 1 条

---

## 8. 与其他蓝图的关系

- `save-load-blueprint.md`：settlement 是特殊的"存档写入路径"
- `ending-spectrum-blueprint.md`：飞升/死亡是不同的结局类型
- `causality-net-blueprint.md`：传承是因果网"跨角色连接"