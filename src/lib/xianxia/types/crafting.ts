import type { ElementType } from './spiritual-root';
import type { ItemEntry } from './item';
import type { AttributeChange } from './event';




// ==================== Phase-H Worker D: Crafting / Cultivation Study Skeleton ====================

// AI-H3xx additive types: 鐗╁搧鍚堟垚/鐐煎埗/淇範绯荤粺鐨勬渶灏忛鏋躲€?// 瑙勫垯锛?//  - 浠呰拷鍔狅紙additive only锛夛紝涓嶅姩鏃㈡湁 type/interface/function銆?//  - engine.ts 閰嶅 5 涓?engine 鍑芥暟浼氭秷璐硅繖浜涚被鍨嬨€?//  - CraftingSideEffect 鐢ㄤ綔 CraftingResult.sideEffects 鐨勫厓绱犵被鍨嬶紝閬垮厤 any銆?

/**

 * AI-H311: 鐐煎埗/鍚堟垚/淇範鐨勭绫绘灇涓俱€? *  - pill-refining:            鐐间腹

 *  - weapon-forging:           鐐煎櫒/閾稿叺

 *  - formation-drawing:        缁樺埗闃垫硶

 *  - technique-comprehension:  淇範鍔熸硶/鏈硶

 *  - item-synthesis:           鐗╁搧鍚堟垚锛堣嵂鏉愭嫾鍚堛€佺鏂欓厤姣旂瓑锛? *  - talisman-making:          绗︾畵鍒朵綔

 */

export type CraftingKind =

  | 'pill-refining'

  | 'weapon-forging'

  | 'formation-drawing'

  | 'technique-comprehension'

  | 'item-synthesis'

  | 'talisman-making';




/**

 * AI-H312: 鐐煎埗/鍚堟垚閰嶆柟瀹氫箟銆? *  - requiredRealm:    鏈€浣庡鐣岋紙Realm id 瀛楃涓诧紝濡?"mortal" / "qi_refining"锛夈€? *  - requiredElements: 鑷冲皯闇€瑕佸摢鍑犻」鍏冪礌浜插拰锛圥artial<Record<ElementType, number>>锛夈€? *  - materials:        鎵€闇€鏉愭枡鏉＄洰锛堟寜 id 鍛戒腑搴撳瓨锛夈€? *  - toolIds:          闇€瑕佺殑宸ュ叿/涓圭倝/绗︾瑪绛?id 鍒楄〃锛堜换涓€缂哄け鍗充笉鍙偧锛夈€? *  - successRate:      鍩虹鎴愬姛鐜?0-1銆? *  - sideEffectChance: 鍓綔鐢ㄨЕ鍙戞鐜?0-1銆? */

export interface CraftingRecipe {

  id: string;

  name: string;

  kind: CraftingKind;

  requiredRealm: string;

  requiredElements: Partial<Record<ElementType, number>>;

  materials: ItemEntry[];

  toolIds: string[];

  successRate: number;        // 0-1

  sideEffectChance: number;   // 0-1

}




/**

 * AI-H313: 涓€娆＄偧鍒?鍚堟垚浼氳瘽鐨勭姸鎬併€? *  - recipeId:          寮曠敤鐨勯厤鏂?id銆? *  - startedAge:        浼氳瘽寮€濮嬫椂鐨勮鑹插勾榫勩€? *  - currentStep/totalSteps: 澶氭鐐煎埗杩涘害銆? *  - materialsConsumed: 宸叉秷鑰楃殑鏉愭枡 id 鍒楄〃銆? *  - attempts:          褰撳墠浼氳瘽鍐呭皾璇曟鏁帮紙鐐煎簾閲嶅紑锛夈€? *  - currentSuccess:    褰撳墠绱鎴愬姛鐜囷紙鍙?realm/comprehension/elements 褰卞搷锛夈€? */

export interface CraftingSession {

  recipeId: string;

  startedAge: number;

  currentStep: number;

  totalSteps: number;

  materialsConsumed: string[];

  attempts: number;

  currentSuccess: number;   // 0-1

}




/**

 * AI-H314: 鐐煎埗/鍚堟垚鍓綔鐢ㄦ潯鐩紙閬垮厤 CraftingResult 鐩存帴鍚?any锛夈€? *  - kind:              鍓綔鐢ㄧ被鍨嬶紙鐘舵€?灞炴€?鍙椾激/璧扮伀鍏ラ瓟锛夈€? *  - severity:          涓ラ噸绋嬪害 0-1銆? *  - description:       鐜╁鍙鎻忚堪锛堜繚鎸佷慨浠欎笘鐣屽唴鍙欎簨锛夈€? *  - expiresAfterDays:  鍙€夛紝鑷姩娑堝け澶╂暟銆? */

export interface CraftingSideEffect {

  kind: 'status' | 'attribute' | 'injury' | 'qi-deviation';

  severity: number;             // 0-1

  description: string;

  expiresAfterDays?: number;

}




/**

 * AI-H315: 涓€娆＄偧鍒?鍚堟垚姝ラ鐨勭粨鏋溿€? *  - success:            鏈鏄惁鎴愬姛銆? *  - outputItems:        浜у嚭鐗╁搧锛堝彲鑳戒负绌鸿〃绀烘湭鎴愪腹/鐐煎簾锛夈€? *  - consumedMaterials:  鏈娑堣€楃殑鏉愭枡 id 鍒楄〃銆? *  - sideEffects:        鏈瑙﹀彂鐨勫壇浣滅敤銆? *  - attributeChanges:   鏈瀵硅鑹插睘鎬х殑褰卞搷锛堜笌 AttributeChange 瀵归綈锛夈€? *  - experienceGained:   鏈鑾峰緱鐨勭粡楠?鐔熺粌搴︺€? */

export interface CraftingResult {

  success: boolean;

  outputItems: ItemEntry[];

  consumedMaterials: string[];

  sideEffects: CraftingSideEffect[];

  attributeChanges: AttributeChange[];

  experienceGained: number;

}




/**

 * AI-H316: 鍔熸硶/鏈硶淇範杩涘害銆? *  - techniqueId:          鐩爣鍔熸硶 id銆? *  - currentProgress:      0-1 鐨勮繘搴︺€? *  - comprehensionEvents:  绱鐨勯】鎮?鐞嗚В浜嬩欢瀛楃涓插垪琛紙鎸夋椂闂撮『搴忚拷鍔狅級銆? *  - breakthroughs:        绱鐨勭獊鐮翠簨浠讹紙age/杩涘害璺冲彉/insight锛夈€? */

export interface TechniqueStudy {

  techniqueId: string;

  currentProgress: number;                  // 0-1

  comprehensionEvents: string[];

  breakthroughs: Array<{

    age: number;

    fromProgress: number;

    toProgress: number;

    insight: string;

  }>;

}
