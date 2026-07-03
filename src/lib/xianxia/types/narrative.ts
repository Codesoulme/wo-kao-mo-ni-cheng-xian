


export type InputClass = 'action' | 'dialogue' | 'overreach' | 'rule_manipulation';




export type NarrativeFocusKind = 'threat' | 'opportunity' | 'location' | 'npc' | 'faction' | 'realm' | 'daily';


export type NarrativeOutcomeKind = 'advanced' | 'resolved' | 'failed' | 'deferred' | 'echoed' | 'ignored';




export interface NarrativeContract {

  narrativeFocus?: NarrativeFocusKind;

  narrativeOutcome?: NarrativeOutcomeKind;

  usedScheduleHintIds?: string[];

  usedWorldFactIds?: string[];

  usedNpcIds?: string[];

  contractNote?: string;

}




export interface NarrativeContractFeedbackEntry {

  age: number;

  title: string;

  narrativeFocus?: NarrativeFocusKind;

  narrativeOutcome?: NarrativeOutcomeKind;

  contractNote?: string;

  focusHintId?: string;

  focusHintTitle?: string;

  topThreat?: string;

  topOpportunity?: string;

  usedScheduleHintIds: string[];

  usedWorldFactIds: string[];

  usedNpcIds: string[];

  warningCodes: string[];

}
