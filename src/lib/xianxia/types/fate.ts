import type { Realm } from './realm';




// ==================== 命节点 ====================



export interface FateNode {

  index: number;

  name: string;

  realm: Realm;

  triggerAge: { min: number; max: number };

  theme: string;

  coreConflict: string;

  narrativeGoal: string;

}




export const FATE_NODES: FateNode[] = [

  { index: 1, name: '灵根觉醒', realm: 'qi_refining',    triggerAge: { min: 6,  max: 16 },  theme: '天赋觉醒',    coreConflict: '凡人与修仙者的界限',         narrativeGoal: '确立主角修仙动机' },

  { index: 2, name: '初入宗门', realm: 'foundation',     triggerAge: { min: 14, max: 22 },  theme: '归属与认同',  coreConflict: '宗门选择与师承',             narrativeGoal: '确立主角的修仙路径' },

  { index: 3, name: '金丹大成', realm: 'golden_core',    triggerAge: { min: 50, max: 120 }, theme: '自我突破',    coreConflict: '内丹与外道的抉择',           narrativeGoal: '确立主角的道心' },

  { index: 4, name: '元婴出窍', realm: 'nascent_soul',   triggerAge: { min: 120,max: 300 }, theme: '神通与责任',  coreConflict: '力量使用的边界',             narrativeGoal: '确立主角的价值观' },

  { index: 5, name: '化神入道', realm: 'spirit_severing',triggerAge: { min: 300,max: 800 }, theme: '法则理解',    coreConflict: '个人与天道的关系',           narrativeGoal: '确立主角的世界观' },

  { index: 6, name: '大乘圆满', realm: 'great_vehicle',  triggerAge: { min: 800,max: 2000}, theme: '尘缘了断',    coreConflict: '情感与修行的冲突',           narrativeGoal: '确立主角的情感归属' },

  { index: 7, name: '渡劫考验', realm: 'tribulation',    triggerAge: { min: 2000,max:5000},theme: '生死考验',    coreConflict: '天劫与自我超越',             narrativeGoal: '确立主角的最终形态' },

  { index: 8, name: '飞升仙界', realm: 'ascension',      triggerAge: { min: 5000,max:9999},theme: '超脱与传承',  coreConflict: '留恋与放下的抉择',           narrativeGoal: '完成主角的修仙之路' },

];


// ==================== 鍛借繍鍥炲搷绯荤粺锛圥hase-I Worker C 閲嶅仛锛?====================



/**

 * AI-C4xx: 鍛借繍鍥炲搷绉嶇被鈥斺€斿懡杩愮綉瑙﹀彂妯″紡鐨勬灇涓俱€? *  - character-callback:    浜虹墿鍥炲搷锛堟棫璇嗛噸閫€佹仼浠囨竻绠楋級

 *  - place-resonance:       鍦扮偣鍥炲搷锛堟晠鍦伴噸杩斻€佹皵鏈哄叡楦ｏ級

 *  - item-recall:           鐗╁搧鍥炲搷锛堟硶瀹濊涓汇€侀仐鐗╂劅搴旓級

 *  - promise-fulfillment:   瑾撶害鍥炲搷锛堝綋骞翠箣绾︺€佷粖鏈濊返璇猴級

 *  - karma-debt:            鍥犳灉鍥炲搷锛堝鍊轰簡鏂€佹仼鎬ㄥ洖鎶ワ級

 *  - destiny-collision:     鍛芥暟纰版挒锛堜袱浣嶅懡杩愮浉绯讳箣浜虹浉閬囷級

 */

export enum FateEchoKind {

  CharacterCallback = 'character-callback',

  PlaceResonance = 'place-resonance',

  ItemRecall = 'item-recall',

  PromiseFulfillment = 'promise-fulfillment',

  KarmaDebt = 'karma-debt',

  DestinyCollision = 'destiny-collision',

}




/**

 * AI-C4xx: 鍛借繍鍥炲搷瑙﹀彂鍣ㄢ€斺€斾粠鍘嗗彶涓瘑鍒嚭鐨勩€佸簲褰撹婵€娲荤殑鍛借繍鑺傜偣銆? *  - id:                  鍞竴 id锛堟寜瑙掕壊 + kind + 婧愪汉鐗?鐗╁搧鐢熸垚锛? *  - kind:                鍥炲搷绉嶇被

 *  - age:                 瑙﹀彂骞撮緞锛堣鑹插勾榫勫揩鐓э級

 *  - sourceCharacterId:   瑙﹀彂婧愶紙浜虹墿/鍦扮偣/鐗╁搧/瑾撶害鐨?id锛? *  - targetCharacterId:   琚洖鍝嶅嵎鍏ョ殑鐩爣浜虹墿 id锛堣嚜宸辨垨浠栦汉锛? *  - narrativeHook:       鐜╁鍙鐨勪笘鐣屽唴鍙欎簨閽╁瓙锛堜竴鍙ヨ瘽鎻愮ず锛? *  - urgency:             绱ц揩绋嬪害锛坙ow/normal/high/critical锛夛紝鍐冲畾鎺ㄨ繘鍔涘害

 */

export interface FateEchoTrigger {

  id: string;

  kind: FateEchoKind;

  age: number;

  sourceCharacterId: string;

  targetCharacterId: string;

  narrativeHook: string;

  urgency: 'low' | 'normal' | 'high' | 'critical';

}




/**

 * AI-C4xx: 鍛借繍鍥炲搷瑙ｅ喅缁撴灉鈥斺€斿懡杩愮綉涓殑涓€涓洖鍝嶈涓栫晫/鐜╁搴斿鍚庣殑鍥炲簲銆? *  - echoId:                瀵瑰簲鐨?FateEchoTrigger.id

 *  - resolvedAge:           瑙ｅ喅鏃剁殑瑙掕壊骞撮緞

 *  - outcome:               缁撳眬锛坒ulfilled=灞ョ害/transformed=杞寲/deferred=寤跺悗/severed=鏂粷锛? *  - narrativeConsequence:  鐜╁鍙鐨勪笘鐣屽唴褰卞搷鎻忚堪

 *  - involvedCharacterIds:  鍙備笌鍥炲搷鐨勬墍鏈変汉鐗?id锛堝惈鑷繁锛? */

export interface FateEchoResolution {

  echoId: string;

  resolvedAge: number;

  outcome: 'fulfilled' | 'transformed' | 'deferred' | 'severed';

  narrativeConsequence: string;

  involvedCharacterIds: string[];

}




/**

 * AI-C4xx: 鍛借繍缃戔€斺€旇鑹插綋鍓嶈儗璐熺殑鍛借繍鍥炲搷鍏ㄩ泦涓庣粐缃戠姸鎬併€? *  - echoes:          寰呭洖鍝嶉泦鍚? *  - resolutions:     宸茶В鍐冲洖鍝嶉泦鍚? *  - threadDensity:   缁囩綉瀵嗗害 0..1锛坋.g. echo/10 cap 鍒?1锛? *  - dominantKind:    涓诲鍥炲搷绉嶇被锛堝嚭鐜版渶澶氱殑锛夛紱鐢ㄤ簬 AI 涓婁笅鏂囪仛鐒? */

export interface FateWeb {

  echoes: FateEchoTrigger[];

  resolutions: FateEchoResolution[];

  threadDensity: number;

  dominantKind: FateEchoKind | null;

}




/**

 * AI-C4xx: 鍛借繍杞ㄨ抗棰勬祴鈥斺€斿熀浜庡懡杩愮綉 + 瑙掕壊鐘舵€侊紝鏈潵鑻ュ共骞寸殑鍛借繍棰勬祴鑺傜偣銆? *  - age:                  棰勬祴骞撮緞

 *  - predictedEvent:       棰勬祴浜嬩欢鍚嶏紙涓€鍙ヨ瘽锛? *  - probability:          姒傜巼 0..1

 *  - rationale:            鎺ㄦ柇鐞嗙敱锛堢帺瀹跺彲瑙佺殑涓枃鐭彞锛? *  - alternativeBranches:  澶囬€夊垎鏀簨浠舵弿杩帮紙鐜╁鍙鐭彞鍒楄〃锛? */

export interface FatePredictedOutcome {

  age: number;

  predictedEvent: string;

  probability: number;

  rationale: string;

  alternativeBranches: string[];

  predictedAge?: number;

  title?: string;

  eventKind?: string;

  narrative?: string;

  urgency?: 'low' | 'normal' | 'high' | 'critical';

}
