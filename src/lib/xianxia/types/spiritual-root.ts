


// ==================== 灵根系统 ====================



export type SpiritualRoot =

  | 'none'         // 无灵根

  | 'mixed'        // 杂灵根（5种）

  | 'common'       // 普通灵根（2-3种）

  | 'pure'         // 单灵根

  | 'heavenly'     // 天灵根

  | 'chaos';       // 混沌灵根




export interface SpiritualRootInfo {

  id: SpiritualRoot;

  name: string;

  multiplier: number;  // 修炼速度倍率

  rarity: number;      // 出现概率权重

  description: string;

}




export const SPIRITUAL_ROOTS: Record<SpiritualRoot, SpiritualRootInfo> = {

  none:     { id: 'none',     name: '无灵根',     multiplier: 0,    rarity: 30, description: '与修行无缘，寿终正寝。' },

  mixed:    { id: 'mixed',    name: '杂灵根',     multiplier: 0.3,  rarity: 25, description: '五行皆有，修炼极慢。' },

  common:   { id: 'common',   name: '凡灵根',     multiplier: 0.8,  rarity: 20, description: '两三种属性，可入修行。' },

  pure:     { id: 'pure',     name: '真灵根',     multiplier: 1.5,  rarity: 15, description: '单属性灵根，修炼神速。' },

  heavenly: { id: 'heavenly', name: '天灵根',     multiplier: 3.0,  rarity: 8,  description: '天赐灵根，万中无一。' },

  chaos:    { id: 'chaos',    name: '混沌灵根',   multiplier: 5.0,  rarity: 2,  description: '混沌之体，亘古难寻。' },

};




// ==================== 五行属性 ====================



export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth';


export type ElementType = Element;




export const ELEMENTS: Record<Element, { name: string; color: string; icon: string }> = {

  metal: { name: '金', color: '#d4af37', icon: '⚔' },

  wood:  { name: '木', color: '#22c55e', icon: '🌿' },

  water: { name: '水', color: '#3b82f6', icon: '🌊' },

  fire:  { name: '火', color: '#ef4444', icon: '🔥' },

  earth: { name: '土', color: '#a16207', icon: '⛰' },

};
