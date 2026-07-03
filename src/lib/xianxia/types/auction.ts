


// ===== AI-98: Auction AI =====

export type BidderPersonality =

  | 'cautious'

  | 'aggressive'

  | 'random'

  | 'hostile';




export interface BidderAction {

  bidderId: string;

  kind: 'bid' | 'pass' | 'hostile';

  newBid?: number;

  reason?: string;

}




/**

 * AI-G113: 竞拍出价者的人格原型，用于决定竞价模式、最大出价与敌意倾向。

 * - wealthy-elder: 财雄势大的长老

 * - hot-blooded-young: 热血青年

 * - scheming-cultivator: 算计深沉的同阶修士

 * - casual-pilgrim: 随性游历者

 * - shadow-bidder: 暗中出价的影子买家

 */

export type BidderArchetype =

  | 'wealthy-elder'

  | 'hot-blooded-young'

  | 'scheming-cultivator'

  | 'casual-pilgrim'

  | 'shadow-bidder';




export interface BidderBehaviorProfile {

  archetype: BidderArchetype;

  wealth: number;        // 现有灵石

  maxBid: number;        // 本轮最大可承受出价

  aggressive: boolean;   // 是否主动加价

  hostile: boolean;      // 是否对角色有敌意

}
