
/**

 * Phase-I Worker D: 结局光谱（Ending Spectrum）。

 * 角色一生最终命轨的元数据契约：

 *  - archetype: 8 种正典结局原型（成仙 / 坐化 / 入魔 / 立宗 / 转世 / 脱世界 / 天地崩 / 凡人隐）

 *  - condition: 触发该结局所需条件清单 + 权重 + 叙事预览

 *  - choice: 角色在某个年纪做出的「关键抉择」记录（可逆性 + 替代路径）

 *  - outcome: 真正落库的世界结果（含世界余波及继承人）

 *  - pathMap: 角色生涯内的结局/抉择/落库结果聚合

 *

 * 本合约由引擎 evaluate/select/apply/branch/summarize 五个函数操作；

 * AI/前端只能消费它们输出，不得自行捏造结局字段。

 */



/**

 * AI-I4xx: 正典结局原型（8 种）。

 *  - ascend-immortal: 飞升成仙

 *  - sit-death:        坐化陨落（未成仙、自然死亡、寿尽）

 *  - fall-demonic:     堕入魔道

 *  - found-sect:       立宗立派

 *  - reincarnate:      转世重生

 *  - escape-world:     脱出本界（离开此方天地）

 *  - world-collapse:   随天地共灭

 *  - fade-into-mortal: 褪去修为隐于凡尘

 */

export type EndingArchetype =

  | 'ascend-immortal'

  | 'sit-death'

  | 'fall-demonic'

  | 'found-sect'

  | 'reincarnate'

  | 'escape-world'

  | 'world-collapse'

  | 'fade-into-mortal';




/**

 * AI-I431: 结局触发条件。

 *  - id:               唯一 id，引擎按 id 查表

 *  - archetype:        该条件对应结局原型

 *  - requirements:     触发条件清单（元素 / 境界 / 资源 / 因缘状态等可读标记）

 *  - weight:           0-1 的相对权重，selectEndingPath 用于加权抽样

 *  - narrativePreview: 给 AI/前端用的叙事预览（一行中文短句）

 */

export interface EndingCondition {

  id: string;

  archetype: EndingArchetype;

  requirements: string[];

  weight: number;

  narrativePreview: string;

}




/**

 * AI-I432: 角色在某一刻做出的「关键抉择」。

 *  - endingId:         选定的 EndingCondition id（可空：尚未落定）

 *  - age:              抉择时的年龄

 *  - reason:           角色动机（一行中文，引擎校验后写入史册）

 *  - alternativePaths: 同时存在的替代路径 id（可能因后续因缘改写）

 *  - irreversibility:  是否不可逆（true 表示锁死结局）

 */

export interface EndingChoice {

  endingId: string;

  age: number;

  reason: string;

  alternativePaths: string[];

  irreversibility: boolean;

}




/**

 * AI-I433: 结局实际落库结果。

 *  - endingId:             对应 EndingCondition id

 *  - archetype:            落定的原型

 *  - age:                  落定时的年龄

 *  - summary:              一句话总结（引擎校验后写入史册）

 *  - worldStateAftermath:  世界余波（受影响的世界事实 / 宗门 / 因缘）

 *  - heirIds:              继承人 id 列表（角色物品/衣钵/道统的承接者）

 */

export interface EndingOutcome {

  endingId: string;

  archetype: EndingArchetype;

  age: number;

  summary: string;

  worldStateAftermath: string[];

  heirIds: string[];

}




/**

 * AI-I434: 单个角色生涯内的「结局路径全图」。

 *  - endings:           所有可见/可达的结局条件（evaluateEndingConditions 输出）

 *  - characterChoices:  角色在生涯内做过的关键抉择

 *  - outcomeHistory:    已经实际落定的结局（按 age 升序）

 */

export interface EndingPathMap {

  endings: EndingCondition[];

  characterChoices: EndingChoice[];

  outcomeHistory: EndingOutcome[];

}
