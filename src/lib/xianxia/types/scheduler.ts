


export type ScheduledEventKind = 'quest' | 'deadline' | 'realm' | 'npc' | 'world' | 'downtime';


export type ScheduledEventAction = 'advance' | 'advance_or_resolve' | 'resolve_or_fail' | 'echo_or_develop' | 'background';


export type ScheduledEventResolutionStage = 'open' | 'escalating' | 'cooling' | 'background' | 'resolved' | 'failed';




export interface ScheduledEventHint {

  id: string;

  kind: ScheduledEventKind;

  priority: number;

  title: string;

  reason: string;

  sourceThreadId?: string;

  dueAge?: number;

  relatedFactIds?: string[];

  requiredAction: ScheduledEventAction;

  resolutionStage?: ScheduledEventResolutionStage;

  resolutionHint?: string;

}




export interface WorldPressureOpportunityMap {

  topThreat?: string;

  topOpportunity?: string;

  focalLocation?: string;

  focalActor?: string;

  likelyEventTypes: string[];

  summary: string;

}




export interface EventSchedulerPlan {

  generatedAtAge: number;

  focus?: ScheduledEventHint;

  hints: ScheduledEventHint[];

  pressureMap?: WorldPressureOpportunityMap;

  warnings: string[];

}
