




// ==================== Worker C (phase-h-p2-mid): 完整世界地图与世界地点 ====================

// 说明：

// - 这些类型是 phase-h-p2-mid 第 3 期世界地点扩展的类型与最小可落库契约；

// - 不动既有 engine / types 任何函数；只在文件末尾追加。

// - 命名沿用英文 id + 中文注释，便于 AI 在生成世界/剧情时直接复用现有 import。

// ============================================================================



/**

 * AI-H321 世界八大区域。

 * - central-plains:    中原腹地（人族与正统仙门核心）

 * - eastern-sea:       东海仙岛（散修、海族、海外宗门）

 * - northern-waste:    北境荒原（妖兽、苦寒散修）

 * - southern-jungle:   南疆密林（蛊修、毒瘴、异族）

 * - western-desert:    西域大漠（佛门、佛修、沙海秘传）

 * - sky-citadel:       天外仙宫（飞升者、上界投影）

 * - underworld-court:  幽冥地府（鬼修、轮回、残魂）

 * - outer-realm-rift:  域外裂隙（魔修、虚空、上古遗种）

 */

export type WorldRegion =

  | 'central-plains'

  | 'eastern-sea'

  | 'northern-waste'

  | 'southern-jungle'

  | 'western-desert'

  | 'sky-citadel'

  | 'underworld-court'

  | 'outer-realm-rift';




/**

 * AI-H322 地点层级 / 危险度大致划分。

 * - mortal-village:    凡尘村镇（凡人聚居、低灵气）

 * - cultivation-town:  修行坊市（散修与商会汇聚）

 * - immortal-city:     仙门大城（宗门外门、内门分坛）

 * - sacred-ground:     灵山福地（宗门外景、师长道场）

 * - forbidden-zone:    禁地秘境（高危险度、高回报）

 * - outer-realm:       域外之境（跨界或飞升者所至）

 */

export type RegionTier =

  | 'mortal-village'

  | 'cultivation-town'

  | 'immortal-city'

  | 'sacred-ground'

  | 'forbidden-zone'

  | 'outer-realm';




/**

 * AI-H323 单个世界地点。

 * - id:                 唯一 id（建议用拼音或中文 hash，如 "luoyu-village"）

 * - name:               玩家可见的世界内地点名（如"落羽村""流云坊"）

 * - region:             所属八大区域

 * - tier:               地点层级（村镇/坊市/大城/灵山/禁地/域外）

 * - dangerLevel:        危险度 0-100；>70 时应有相关因缘提示

 * - spiritualDensity:   灵气浓度 0-100；与修炼速度、产出品质相关

 * - resources:          主要特产标签（如 "灵石矿""灵草""妖兽材料"）

 * - controllingFaction: 掌控宗门/家族（无则空串）

 * - hiddenEntrance:     是否存在隐藏入口（用于支线、秘境、隐藏 NPC）

 */

export interface LocationNode {

  id: string;

  name: string;

  region: WorldRegion;

  tier: RegionTier;

  dangerLevel: number;

  spiritualDensity: number;

  resources: string[];

  controllingFaction: string;

  hiddenEntrance: boolean;

}




/**

 * AI-H324 两个地点之间的可通行路径。

 * - from / to:            起点 / 终点 LocationNode.id

 * - distanceDays:         凡人脚程所需天数（修士可缩短）

 * - dangerLevel:          路上危险度 0-100

 * - requiredRealm:        最低境界（Realm id 字符串，如 "mortal"/"qi_refining"）

 * - hiddenRequirements:   其它隐藏条件（如"需持某宗门令牌""需通过某任务"），可空数组

 */

export interface TravelRoute {

  from: string;

  to: string;

  distanceDays: number;

  dangerLevel: number;

  requiredRealm: string;

  hiddenRequirements: string[];

}




/**

 * AI-H325 当前世界地图。

 * - nodes:                已注册的全部地点（含未发现的）

 * - routes:               全部可通行路径

 * - currentLocationId:    角色当前所在地点 id

 * - discoveredLocationIds: 玩家已发现/已踏足过的地点 id 集合

 */

export interface WorldMap {

  nodes: LocationNode[];

  routes: TravelRoute[];

  currentLocationId: string;

  discoveredLocationIds: string[];

}
