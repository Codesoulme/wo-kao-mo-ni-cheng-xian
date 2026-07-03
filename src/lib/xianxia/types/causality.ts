


export type CausalNodeType = 'event' | 'thread' | 'npc' | 'item' | 'status' | 'realm' | 'memory' | 'choice' | 'combat' | 'pet' | 'system';


export type CausalEdgeType = 'created' | 'updated' | 'resolved' | 'failed' | 'mentions' | 'caused' | 'rewards' | 'harms' | 'continues' | 'triggers';




export interface CausalNode {

  id: string;

  type: CausalNodeType;

  label: string;

  age: number;

  refId?: string;

  summary?: string;

  tags?: string[];

}




export interface CausalEdge {

  id: string;

  from: string;

  to: string;

  type: CausalEdgeType;

  age: number;

  summary?: string;

}




export interface CausalGraph {

  nodes: CausalNode[];

  edges: CausalEdge[];

  updatedAtAge?: number;

}
