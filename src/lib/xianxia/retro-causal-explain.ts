// 逆向因果解释器：把「引擎判定拆了账面一致性」那一小类冲突，改写成世界观内的说法。
//
// ── 缘起 ────────────────────────────────────────────────────────────────
// 一份架构说明书主张：检测到有害/意外的状态变更时不回滚，改让模型编一段合乎设定的
// 说法把窟窿圆过去。说明书给的示例是裸奔式的一句 prompt 拼接（历史 + 意外结果 →
// 请生成解释）。那个形态放进本项目会直接长成一致性漏洞：模型有权重写既有事实、有权
// 顺手塞数值、每轮都能触发，最后账面靠一叠自相矛盾的补丁堆着。
//
// 本模块是受限版本，六条闸门写在代码里而不是写在注释里：
//   ① 产出物只有两个字符串（title / narrative）。模型返回的是纯文本，全程没有任何
//      代码路径能把它变成数值、物品、线索或库存变动 —— 见 assertNarrativeOnly。
//   ② 不动既有事实。产出物是一条新的 EventLog 行，靠 hiddenEventMeta 里的
//      retroCausalOf 反指原事件；原事件一个字都不改。
//   ③ 产出物回流引擎既有净化与边界校验（sanitizeEventOutput + validateAIBoundary），
//      不给它开后门。
//   ④ 每岁最多一条，闸门落在库里（见 isRetroCausalGateOpen 注释）。
//   ⑤ 只认 CONSISTENCY_BREAK_CODES 里那两个 code。「玩家没预料到」的意外一概不碰 ——
//      意外是这游戏的卖点，圆掉就废了。
//   ⑥ 生成失败 / 超时 / 返回垃圾一律返回 null，调用方原样往下走，玩家看不到半成品。
//
// ── 为什么只圈两个 code ──────────────────────────────────────────────────
// ai-boundary-validator.ts 共七组检查、三十余个 code，但绝大多数是「叙事交代得不够」
// 或「靠 hasMeaningfulOverlap 模糊撞名猜出来的」，两类都不该拿去圆：前者属于文笔问题，
// 后者本身就可能是误判，拿误判当前提编故事等于二次污染。
//
// 只有这两个满足「纯 id 比对零模糊匹配」+「引擎确实静默吞掉了这次操作」+
// 「账面与叙事互相打脸且玩家在面板上看得见」三条：
//
//   removed_unknown_item   —— removeItemsByIds 对不在 inventory ∪ equipped 的 id
//                             直接不收进 removed，什么也没发生。叙事写了服下/损毁，
//                             背包里那物件却根本不曾有过名字。
//   closed_thread_referenced —— completeThread / failThread 见到 resolved|failed 的线索
//                             原样 return state。叙事写了旧案今日方了，账上早有定论。
//
// 其余候选与落选理由：
//   unknown_thread_reference        引擎同样静默吞掉，但玩家从没见过那条线索，
//                                   面板上无处对照，谈不上打脸 —— 不值得动笔。
//   equip / unequip_unknown_item    同族但分量轻，佩上取下多是行文点缀，
//                                   面板下一轮自己就跟真实状态对齐了。
//   closed_thread_reopened_as_new   靠两字 token 命中，误判率高。
//   npc_*_without_cause             这是「交代不足」，且正是意外的味道，禁区。
//   unaddressed_high_priority_quest 疏忽而非矛盾，且几乎每轮都响。
//   unknown_*_reference（contract）   契约元数据，玩家侧不可见。

import { validateAIBoundary } from './ai-boundary-validator';
import { sanitizeNarrativeText } from './display';
import { sanitizeEventOutput } from './llm/response-parser';
import { hiddenEventMeta } from './world-time';
import type { AIEventOutput, CharacterState } from './types';

// ==================== 常量 ====================

/** 圈定范围。加 code 之前请先回读上面那段落选理由。 */
export const CONSISTENCY_BREAK_CODES = ['removed_unknown_item', 'closed_thread_referenced'] as const;

export type ConsistencyBreakCode = (typeof CONSISTENCY_BREAK_CODES)[number];

/** 新增 EventLog 行的 eventType。同时充当每岁闸门的查询键。 */
export const RETRO_CAUSAL_EVENT_TYPE = 'retro_causal';

/** hiddenEventMeta 里反指原事件的字段名。 */
export const RETRO_CAUSAL_META_KEY = 'retroCausalOf';

/** 说法正文长度区间。太短圆不住，太长会盖过当年主叙事。 */
const MIN_TEXT_LEN = 24;
const MAX_TEXT_LEN = 420;

/** 生成超时（毫秒）。到点当作没这回事，不重试。 */
export const RETRO_CAUSAL_TIMEOUT_MS = 20000;

/**
 * 机制词黑名单。命中即判为垃圾丢弃。
 * 模型偶尔会把「我在修正一处校验冲突」这类元叙事口吻直接写进正文，
 * 一旦露出来玩家立刻看穿是补丁，比不圆更糟。
 */
const META_WORD_RE = /引擎|校验|一致性|回滚|状态机|字段|数值|属性值|背包数据|日志|系统提示|矛盾|冲突判定|解释器|模型|生成器|AI|LLM|JSON|trace|patch/i;

/**
 * 落地时必须带的余波口吻。与 validateWorldFactConsistency 里那条正则同一套词，
 * 这样回流校验才不会自己打自己 —— 提到已闭线索却不摆成余波，本来就要报。
 */
const AFTERMATH_RE = /旧事|余波|传闻|后果|清算|回忆|遗留|残波|复盘/;

/**
 * sanitizeEventOutput 的兜底文案。正文为空时它会填这句，
 * 不拦掉就会拿这句去圆场，等于凭空多一条废事件。
 */
const SANITIZE_FALLBACK_HEAD = '这一年角色依旧在世间行走';

/**
 * 落地前逐个点检的载荷字段。任一非空 → 判定为有东西越过了纯叙事边界，整条丢弃。
 * 这是硬约束①的机器证明，不是口头承诺。
 */
const PAYLOAD_FIELDS = [
  'changes', 'newStatuses', 'newItems', 'removedItemIds', 'newEquippedItems',
  'equipItemIds', 'unequipItemIds', 'newNpcs', 'newThreads', 'advanceThreads',
  'completeThreadIds', 'failThreadIds', 'extraEvents',
] as const;

// ==================== 类型 ====================

/** 一处待圆的账面裂缝。 */
export interface RetroCausalCandidate {
  code: ConsistencyBreakCode;
  /** 冲突指向的物件 id 或线索 id。 */
  refId: string;
  /** 人话主题（线索标题；物件无名时为空串）。 */
  subject: string;
  /** 给日志看的一句话。 */
  detail: string;
}

/** 待落库的产出物。只有叙事字段 + 一条反向指针。 */
export interface RetroCausalDraft {
  title: string;
  narrative: string;
  eventType: typeof RETRO_CAUSAL_EVENT_TYPE;
  /** 直接塞 EventLog.effects（调用方负责 JSON.stringify）。 */
  effects: unknown[];
  /** 被反指的原 EventLog id。 */
  refEventId: string;
  code: ConsistencyBreakCode;
}

/** 供 explainRetroCausally 注入的生成函数。返回纯文本，不是 JSON。 */
export type RetroCausalGenerator = (system: string, user: string) => Promise<string>;

/** executeAIEvent 返回值里本模块真正读到的那几个字段。 */
export interface RetroCausalExecFacts {
  aiBoundaryTrace?: Array<{ severity?: string; code?: string; message?: string; refId?: string; field?: string }>;
  removedItemIds?: string[];
  state?: CharacterState;
  died?: boolean;
}

// ==================== ① 侦测 ====================

/** 已闭线索：resolved / failed 两态。 */
function isClosedThread(t: { status?: string } | undefined): boolean {
  return t?.status === 'resolved' || t?.status === 'failed';
}

/**
 * detectConsistencyBreak：从 EngineExecutionResult 里挑出唯一一处值得圆的裂缝。
 *
 * 不新建检测器 —— 信号本来就在 aiBoundaryTrace 里躺着。本函数做的是收窄 + 复核：
 * 圈定 code 之后，还要拿引擎的实际落点再确认一遍「这次操作确实被吞了」，
 * 只信 trace 不复核的话，一旦校验器与处理器行为哪天分叉，就会凭空圆一个不存在的裂缝。
 *
 * 一轮最多返回一处（挑第一个命中的），因为每岁只准写一条。
 *
 * @returns 命中的裂缝；无则 null。任何异常也返回 null。
 */
export function detectConsistencyBreak(
  state: CharacterState,
  aiOutput: AIEventOutput,
  exec: RetroCausalExecFacts,
): RetroCausalCandidate | null {
  try {
    if (!state || !aiOutput || !exec) return null;
    // 本轮陨落就不圆了。临终那条独立事件之后再补一段考据，读着极别扭。
    if (exec.died) return null;

    const trace = Array.isArray(exec.aiBoundaryTrace) ? exec.aiBoundaryTrace : [];
    if (!trace.length) return null;

    const after = exec.state || state;
    const actuallyRemoved = new Set(Array.isArray(exec.removedItemIds) ? exec.removedItemIds : []);

    for (const t of trace) {
      const code = String(t?.code || '');
      const refId = String(t?.refId || '');
      if (!refId) continue;
      if (!(CONSISTENCY_BREAK_CODES as readonly string[]).includes(code)) continue;

      if (code === 'removed_unknown_item') {
        // 复核：引擎真的没删掉它。若不知怎么还是删了，账面与叙事其实吻合，无须动笔。
        if (actuallyRemoved.has(refId)) continue;
        const held = [...(after.inventory || []), ...(after.equipped || [])].find(i => i?.id === refId);
        // 复核：它也确实不在身上。还在身上说明是别的岔子，不属本模块管辖。
        if (held) continue;
        return {
          code: 'removed_unknown_item',
          refId,
          subject: '',
          detail: `叙事声称消耗或损毁 ${refId}，账面从无此物`,
        };
      }

      if (code === 'closed_thread_referenced') {
        const thread = (after.pendingThreads || []).find(x => x?.id === refId);
        // 复核：执行完它仍是已闭态 —— 引擎确实原样退回了这次改动。
        if (!thread || !isClosedThread(thread)) continue;
        return {
          code: 'closed_thread_referenced',
          refId,
          subject: String(thread.title || ''),
          detail: `叙事重开已了结的线索「${thread.title || refId}」，引擎未受理`,
        };
      }
    }
    return null;
  } catch (e) {
    console.warn(`[retro-causal] 侦测失败（非致命，跳过）：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// ==================== ② 闸门 ====================

/**
 * isRetroCausalGateOpen：每岁一次的硬闸门。
 *
 * 闸门实体是库里的行数本身 —— 调用方对 EventLog 数
 * { characterId, age, eventType: 'retro_causal' }，非零即关。选它的理由：
 *   - 天然持久：进程重启、页面刷新、同一岁反复推进都不会重开；
 *   - 零 schema 改动，直接吃现成的 @@index([characterId, age])；
 *   - 与产出物同一条行，不存在「计数器和事实分家」的漂移。
 *
 * 内存计数器和 route 局部变量都做不到第一条，SSE 每次请求都是新作用域。
 */
export function isRetroCausalGateOpen(priorCountThisAge: number): boolean {
  return Number(priorCountThisAge || 0) <= 0;
}

// ==================== ③ 组 prompt ====================

/** 截断上下文，别把整轮叙事全灌进去。 */
function clip(text: unknown, max: number): string {
  const s = String(text || '').trim();
  return s.length > max ? `${s.slice(0, max)}……` : s;
}

/**
 * buildRetroCausalPrompt：按裂缝种类给不同的圆场方向。
 *
 * 措辞刻意只谈世间说法（旁人如何议、事后如何看），不提任何判定口吻。
 * 两个方向都不去否认玩家看到的结果，只补一层来龙去脉 —— 这是「不改历史事实」在
 * 文字层面的落法：叙事只能往上叠一层解释，不能反口说前面那段没发生。
 */
export function buildRetroCausalPrompt(
  candidate: RetroCausalCandidate,
  state: CharacterState,
): { system: string; user: string } {
  const system = [
    '你在写一部修仙长篇里的一小段补叙。',
    '要求：纯白话叙述，第三人称，不用半文言腔，不写标题，不写小标题，不用列表。',
    '只写世间见闻与事后议论，不评点、不总结、不出现任何游戏用语或后台用语。',
    '篇幅一段，八十到二百字。',
  ].join('\n');

  const who = String(state?.name || '此人');
  const age = Number(state?.age ?? 0);
  const where = String(state?.location || '不知何处');

  const lines: string[] = [];
  lines.push(`人物：${who}，年岁 ${age}，身在${where}。`);

  if (candidate.code === 'removed_unknown_item') {
    lines.push('');
    lines.push('要补的一处来龙去脉：');
    lines.push('前文提到他手上有一件物什，用过之后便没了。可细究起来，这件物什从未真正记在他名下。');
    lines.push('');
    lines.push('请补一段说法，把这件事说圆。可走的路子（择一，不要都写）：');
    lines.push('- 那物什本是旁人临时递到他手里的，事毕即收回，从头到尾不曾归他；');
    lines.push('- 那是件仿的、或是一时幻影所化，一经动用就散了，自然留不下痕迹；');
    lines.push('- 他当时借势而为，用的是别处的力，事后旁人才发觉他两手空空。');
    lines.push('');
    lines.push('不要否认前文发生过的事，只补上旁人此刻才想明白的那一层。不要写他因此得了新东西。');
  } else {
    lines.push('');
    lines.push('要补的一处来龙去脉：');
    lines.push(`一桩旧事「${candidate.subject || '前情'}」早已有了定论，可前文又像是把它重新收了一遍。`);
    lines.push('');
    lines.push('请补一段说法，把这件事说圆。可走的路子（择一，不要都写）：');
    lines.push('- 此番了结的其实只是那桩旧事留下的余波，正案的定论一直未变；');
    lines.push('- 外间传闻把两桩同源的事混作一桩，他这回收的是另一头；');
    lines.push('- 他事后回忆起来才分清先后，当时只当是旧账重提。');
    lines.push('');
    lines.push('落笔时要让人看出这是旧事的后续或余波，不是把定论推翻重来。不要写出新的悬案或新的约定。');
  }

  return { system, user: lines.join('\n') };
}

// ==================== ④ 收口：净化 + 回流校验 ====================

/**
 * coerceGeneratedExplanation：粗筛模型返回值。
 * 空 / 非串 / 太短 / 太长 / 像 JSON / 带后台口吻 —— 一律判垃圾返回 null。
 */
export function coerceGeneratedExplanation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text) return null;
  // 模型偶尔裹一层 code fence 或整个塞进 JSON，两种都不要
  if (/^```/.test(text) || /^[[{]/.test(text)) return null;
  text = text.replace(/^["'「『]|["'」』]$/g, '').trim();
  if (text.length < MIN_TEXT_LEN) return null;
  if (text.length > MAX_TEXT_LEN) return null;
  if (META_WORD_RE.test(text)) return null;
  return text;
}

/**
 * assertNarrativeOnly：点检 sanitizeEventOutput 的产出，任一载荷字段非空即 false。
 * 硬约束①的机器证明。理论上喂进去只有 title/narrative 就不该有东西，
 * 但这道检查的意义正在于「不靠推理，靠断言」。
 */
function assertNarrativeOnly(out: AIEventOutput): boolean {
  for (const f of PAYLOAD_FIELDS) {
    const v = (out as unknown as Record<string, unknown>)[f];
    if (Array.isArray(v) && v.length > 0) return false;
  }
  if (out.hasChoice) return false;
  if (out.triggerCombat) return false;
  if (out.triggeredBreakthrough) return false;
  if (out.causedDeath || out.causedAscension) return false;
  if (out.spiritualRootChange) return false;
  if (out.realmProfilePatch) return false;
  // timeAdvance 不在点检范围：clampTimeAdvance 无入参时按默认「一年」填，
  // 拿它当越界信号会把每条都毙掉。真正的保障是产出物根本不带这个字段 ——
  // RetroCausalDraft 只有 title / narrative / eventType / effects 四项，
  // 落库的 EventLog 行没有任何时间字段可推，补叙动不了世界时序。
  return true;
}

/**
 * 回流校验里唯一会拦人的 code。
 *
 * 不能一见 warning 就拦：拿一份只有正文的输出去跑 validateAIBoundary，
 * unaddressed_high_priority_quest / missing_narrative_contract 这类必然会响，
 * 那是「本轮没推线索」引起的，与正文写得好坏无关，一刀切会把每条都毙掉。
 * 真正由我们这段文字招来的只有下面这一条：提了已闭线索却没摆成余波口吻。
 */
const REFLOW_BLOCKING_CODES = new Set(['closed_thread_mentioned_without_aftermath_frame']);

/**
 * finalizeRetroCausalDraft：把一段生成文本收成可落库的产出物。整条链路同步、可单测。
 *
 * 顺序：粗筛 → 引擎净化 → 纯叙事断言 → 边界校验回流 → 余波口吻复查 → 装配。
 * 任一环不过返回 null，调用方静默放弃。
 *
 * @param rawText   模型返回值（也可以是 null / Error / 任意垃圾，一律安全）
 * @param refEventId 被反指的原 EventLog id
 */
export function finalizeRetroCausalDraft(
  rawText: unknown,
  state: CharacterState,
  candidate: RetroCausalCandidate,
  refEventId: string,
): RetroCausalDraft | null {
  try {
    if (!state || !candidate || !refEventId) return null;

    const coerced = coerceGeneratedExplanation(rawText);
    if (!coerced) return null;

    const age = Number(state.age ?? 0);
    const title = candidate.code === 'closed_thread_referenced' ? '旧事余波' : '来处无名';

    // 回流引擎既有净化：走的就是主链路那个 sanitizeEventOutput，不开小灶。
    const sanitized = sanitizeEventOutput({ title, narrative: coerced }, age);

    // 净化器正文为空时会填一句兜底文案。拿兜底去圆场等于凭空多一条废事件。
    if (!sanitized.narrative || sanitized.narrative.startsWith(SANITIZE_FALLBACK_HEAD)) return null;

    // 再过一遍叙事文本净化（年龄口径 + 机制词清洗），与主链路同一支。
    const cleaned = sanitizeNarrativeText(sanitized.narrative, age).trim();
    if (!cleaned) return null;
    // 净化后可能被削短或重新露出后台口吻，复筛一次。
    const recoerced = coerceGeneratedExplanation(cleaned);
    if (!recoerced) return null;

    const finalOutput: AIEventOutput = { ...sanitized, narrative: recoerced, title };

    // 硬约束①：确认没有任何载荷越界。
    if (!assertNarrativeOnly(finalOutput)) {
      console.warn('[retro-causal] 产出物含非叙事载荷，丢弃');
      return null;
    }

    // 硬约束③：回流边界校验。只拦由本段文字引起的那条 code。
    const boundary = validateAIBoundary(state, finalOutput);
    if (boundary.errors.length > 0) return null;
    for (const t of boundary.trace) {
      if (REFLOW_BLOCKING_CODES.has(String(t?.code || ''))) {
        console.warn(`[retro-causal] 回流校验拦下（${t.code}），丢弃`);
        return null;
      }
    }

    // 已闭线索那一路必须带余波口吻，否则读起来就是推翻定论。
    if (candidate.code === 'closed_thread_referenced' && !AFTERMATH_RE.test(recoerced)) {
      console.warn('[retro-causal] 正文缺余波口吻，丢弃');
      return null;
    }

    return {
      title,
      narrative: recoerced,
      eventType: RETRO_CAUSAL_EVENT_TYPE,
      // 硬约束②：反向指针写在 hiddenEventMeta 里，原事件一个字不改。
      effects: [hiddenEventMeta({
        [RETRO_CAUSAL_META_KEY]: refEventId,
        retroCausalCode: candidate.code,
        retroCausalRefId: candidate.refId,
      })],
      refEventId,
      code: candidate.code,
    };
  } catch (e) {
    console.warn(`[retro-causal] 收口失败（非致命，丢弃）：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

// ==================== ⑤ 编排 ====================

export interface ExplainRetroCausalInput {
  state: CharacterState;
  aiOutput: AIEventOutput;
  exec: RetroCausalExecFacts;
  /** 被反指的原 EventLog id。 */
  refEventId: string;
  /** 本岁已有的 retro_causal 行数（闸门读数）。 */
  priorCountThisAge: number;
  /** 注入的生成函数。测例传 mock，绝不真调。 */
  generate: RetroCausalGenerator;
  timeoutMs?: number;
}

/**
 * explainRetroCausally：唯一的对外入口。
 *
 * 整体是一层 try/catch 壳，实质判断全在上面那些同步函数里，本函数只负责
 * 「闸门 → 侦测 → 一次生成 → 交给 finalize」。不重试、不递归。
 * 生成抛错或超时都不往外抛，一律 null。
 */
export async function explainRetroCausally(
  input: ExplainRetroCausalInput,
): Promise<RetroCausalDraft | null> {
  const startedAt = Date.now();
  try {
    if (!input) return null;
    const { state, aiOutput, exec, refEventId, priorCountThisAge, generate } = input;

    // 硬约束④：闸门先行，不满足连侦测都不跑。
    if (!isRetroCausalGateOpen(priorCountThisAge)) {
      console.log(`[retro-causal] 本岁闸门已闭（已有 ${priorCountThisAge} 条），跳过`);
      return null;
    }
    if (typeof generate !== 'function') return null;

    const candidate = detectConsistencyBreak(state, aiOutput, exec);
    if (!candidate) return null;
    console.log(`[retro-causal] 命中 code=${candidate.code} ref=${candidate.refId} —— ${candidate.detail}`);

    const { system, user } = buildRetroCausalPrompt(candidate, state);
    const timeoutMs = Number(input.timeoutMs ?? RETRO_CAUSAL_TIMEOUT_MS);

    // 超时走 resolve(null) 而非 reject：到点当没这回事，与「返回垃圾」同一条处置路径。
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raced = await Promise.race([
      generate(system, user).catch((e: unknown) => {
        console.warn(`[retro-causal] 生成失败（非致命，放弃）：${e instanceof Error ? e.message : String(e)}`);
        return null;
      }),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (timer) clearTimeout(timer);

    const draft = finalizeRetroCausalDraft(raced, state, candidate, refEventId);
    if (!draft) {
      console.log(`[retro-causal] 未产出可用说法（${Date.now() - startedAt}ms），静默放弃`);
      return null;
    }
    console.log(`[retro-causal] 产出说法 ${draft.narrative.length} 字（${Date.now() - startedAt}ms），反指 ${refEventId}`);
    return draft;
  } catch (e) {
    console.warn(`[retro-causal] 编排失败（非致命，放弃）：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
