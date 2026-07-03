
/**

 * AI-I401: 传承类型（角色之间传承关系的种类）。

 *  - bloodline         血脉：父母/祖辈/先天的修为与体质的血脉传承。

 *  - master-disciple   师徒：师门内部师徒单传的功法与心得。

 *  - tribal-clan       部族：氏族/部落的群体性图腾传承。

 *  - sect-lineage      宗门：宗派正统代际传承的功法与地位。

 *  - blood-oath        血誓：以血脉之约为契的传承（如结义金兰、歃血盟友）。

 *  - destiny-thread    因缘：命数/天机牵引的无形传承（如因果延续、仙缘牵引）。

 */

export type InheritanceKind =

  | 'bloodline'

  | 'master-disciple'

  | 'tribal-clan'

  | 'sect-lineage'

  | 'blood-oath'

  | 'destiny-thread'

  | 'mentor-guild'

  | 'artifact'

  | 'secret-tome'

  | 'talisman'

  | 'technique'

  | 'token'

  | 'bond';




/**

 * AI-I401: 传承接收人（被传承者）的结构化记录。

 *  - id                    唯一 id（与 CharacterState.id 区分；用于跨代谱系追踪）。

 *  - kind                  传承类型。

 *  - sourceCharacterId     传承来源角色 id（师、祖、血缘父/母等）。

 *  - targetCharacterId     接收人 id。

 *  - inheritedAbilities    实际继承到的功法/术法/体质/血脉名 id 列表。

 *  - inheritanceAge        接收人在该岁承接该传承。

 *  - narrative             世界内的因缘/桥段描述（一句话或一段）。

 *  - realmRequired         接收时的最低境界要求（Realm 字符串）。

 */

export interface InheritanceRecipient {

  id: string;

  kind: InheritanceKind;

  sourceCharacterId: string;

  targetCharacterId: string;

  inheritedAbilities: string[];

  inheritanceAge: number;

  narrative: string;

  realmRequired: string;

}




/**

 * AI-I401: 传承主张（角色对某项传承发起承接时的请求与状态）。

 *  - recipientId           主张发起的接收人 id（与 InheritanceRecipient.id 对应）。

 *  - claimAge              发起主张时的年龄。

 *  - claimReason           主张承接的理由（一句话，世界内表达）。

 *  - witnessIds            见证此次主张的角色 id 列表。

 *  - contested             是否存在竞争者（多人同源）。

 *  - resolved              是否已裁定（与 contested 配合使用）。

 */

export interface InheritanceClaim {

  recipientId: string;

  claimAge: number;

  claimReason: string;

  witnessIds: string[];

  contested: boolean;

  resolved: boolean;

}




/**

 * AI-I401: 跨代传承链（一棵根角色出发的多代谱系）。

 *  - rootCharacterId       根角色 id（通常是最初的传承源 / 始祖 / 开派祖师）。

 *  - generations           按代排列的接收人列表：generations[0] = 根的直系一代，generations[1] = 二代，以此类推。

 *  - activeClaims          当前尚未结案的主张（含未了因缘）。

 *  - lostTechniques        随传承链中断而失传的功法/术法 id 列表（无法自动恢复）。

 */

export interface InheritanceChain {

  rootCharacterId: string;

  generations: InheritanceRecipient[][];

  activeClaims: InheritanceClaim[];

  lostTechniques: string[];

}




/**

 * AI-I401: 传承池（某条传承源当前可用名额的容器；角色可从池中"承接"一个名额）。

 *  - id                    池 id。

 *  - name                  世界内名称（如"青岚剑意传承池"）。

 *  - kind                  传承类型。

 *  - availableSlots        剩余可承接名额（>=0；达到 0 后不再发放）。

 *  - lockedUntilAge        锁定到该岁之后才允许承接（0 表示无年龄锁）。

 *  - hostCharacterIds      当前持有/挂载此池的角色 id 列表（空表示该池尚未被认领）。

 */

export interface InheritancePool {

  id: string;

  name: string;

  kind: InheritanceKind;

  availableSlots: number;

  lockedUntilAge: number;

  hostCharacterIds: string[];

}
