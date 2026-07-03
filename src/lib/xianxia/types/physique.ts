


// ===== AI-100: Special Physiques (6 kinds) =====

export interface BottleSpirit {

  spiritId: string;

  sourceName: string;

  visibleEffect: string;

  hiddenEffect: string;

  revealed: boolean;

  awakenedAge: number;

}




export type SwordAptitude =

  | 'untrained'

  | 'novice'

  | 'adept'

  | 'master';




export type InnatePhysique =

  | 'waste_body'

  | 'spirit_vein'

  | 'frozen_blood'

  | 'flame_heart'

  | 'dao_bone'

  | 'chaos_eye';




export interface FakeDeathRule {

  trigger: string;

  fakeDurationTurns: number;

  revealChance: number;

  freezeActions: boolean;

}
