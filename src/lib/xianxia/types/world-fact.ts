


export type WorldFactKind = 'location' | 'faction' | 'realm' | 'npc' | 'relationship' | 'rule' | 'lore' | 'resource' | 'event';




export interface WorldFact {

  id: string;

  kind: WorldFactKind;

  title: string;

  summary: string;

  confidence: number;

  firstSeenAge: number;

  lastSeenAge: number;

  source: string;

  refIds?: string[];

  tags?: string[];

}
