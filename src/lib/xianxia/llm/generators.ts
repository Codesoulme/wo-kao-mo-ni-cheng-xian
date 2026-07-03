// 修仙模拟器 - LLM 服务 / 生成器域
// 拆分自 llm.ts：各 generate* 生成函数（年龄事件/选择/干扰/物品叙事/炼丹/坊市/拍卖/战利品/灵宠/结算/战斗/出生）
import {
  EngineStateContext,
  ItemEntry,
  Element,
  ELEMENTS,
  SpiritualRoot,
  SPIRITUAL_ROOTS,
  CombatRound,
  CombatRoundProposal,
  CombatSession,
  AlchemyAIOutcome,
  MarketAIOutcome,
  AuctionAIOutcome,
  CombatLootAIOutcome,
  PetBondAIOutcome,
  PetCareAIOutcome,
  Pet,
  getRealmInfo,
} from '../types';
import type { AIEventOutput, ChoiceResultOutput, InterfereOutput } from '../types';
import {
  AIEventOutputSchema,
  AIChoiceResultSchema,
  AIInterfereOutputSchema,
  AIItemActionNarrativeSchema,
  AIAlchemyOutcomeSchema,
  AIMarketOutcomeSchema,
  AIAuctionOutcomeSchema,
  AICombatLootSchema,
  AIPetBondSchema,
  AIPetCareSchema,
  AISettlementEvaluationSchema,
  AICombatRoundProposalSchema,
  AICombatRoundNarrativeSchema,
  AICombatEndNarrativeSchema,
  AIBirthSchema,
} from '../prompt-schema';
import { buildFallbackBackground, buildOriginPrompt, rollOrigin, type OriginRoll } from '../origins';
import { IDENTITY_PROMPT, SCENE_PROMPTS, assembleZonePrompt, buildAdvancePrompt, buildChoosePrompt, buildInterferePrompt, loadWorldKnowledge } from './prompt-builder';
import { callLLM, callLLMText, callLLMStream } from './client';
import { parseJSON, postParseSchemaCheck, sanitizeEventOutput, sanitizeChoiceOutput, sanitizeInterfereOutput, cleanNarrativeAge } from './response-parser';

export async function generateAgeEvent(ctx: EngineStateContext, isFateNode: boolean, qualityMode: 'full' | 'light' = 'full'): Promise<AIEventOutput> {
  // AI-61: 异步预加载 L1 世界观知识，并拼入 userPrompt
  const worldKnowledge = await loadWorldKnowledge();
  const userPrompt = buildAdvancePrompt(ctx, isFateNode, qualityMode) + worldKnowledge;
  const raw = await callLLM(IDENTITY_PROMPT, userPrompt, SCENE_PROMPTS.advance, { qualityMode });
  // TechDoc 18.6.5：post-parse zod schema 健康检查（失败仅 log，sanitize 兜底）
  postParseSchemaCheck(AIEventOutputSchema, raw, 'generateAgeEvent');
  const sanitized = sanitizeEventOutput(raw, ctx.character.age);
  // 后处理：修正 narrative 中主角年龄数字
  sanitized.narrative = cleanNarrativeAge(sanitized.narrative, ctx.character.age, ctx.character.name);
  if (Array.isArray(sanitized.extraEvents)) {
    sanitized.extraEvents = sanitized.extraEvents.map((event: any) => ({
      ...event,
      narrative: cleanNarrativeAge(String(event?.narrative || ''), ctx.character.age, ctx.character.name),
    }));
  }
  if (sanitized.choice?.prompt) {
    sanitized.choice.prompt = cleanNarrativeAge(sanitized.choice.prompt, ctx.character.age, ctx.character.name);
  }
  return sanitized;
}

/**
 * 流式生成 age event：LLM 用 stream=true 边读边回调 onNarrativeDelta
 * onNarrativeDelta: 增量 narrative 字符串（拼到已收到的 narrative 末尾）
 * 完整输出用 sanitizeEventOutput + cleanNarrativeAge 后处理
 */
export async function generateAgeEventStream(
  ctx: EngineStateContext,
  isFateNode: boolean,
  qualityMode: 'full' | 'light',
  onNarrativeDelta: (delta: string) => void | Promise<void>,
): Promise<AIEventOutput> {
  const worldKnowledge = await loadWorldKnowledge();
  const userPrompt = buildAdvancePrompt(ctx, isFateNode, qualityMode) + worldKnowledge;
  // TechDoc 18.6.5：流式场景也走 6 区架构（system = IDENTITY + SCENE + few-shot）
  const { systemPrompt: fullSystem } = assembleZonePrompt({
    systemIdentity: IDENTITY_PROMPT,
    sceneBehavior: SCENE_PROMPTS.advance,
  });

  // 调用流式LLM，收集完整的JSON响应
  const rawText = await callLLMStream(fullSystem, userPrompt, onNarrativeDelta, { qualityMode });

  // 尝试解析JSON响应
  let raw: any;
  let isParsed = false;
  try {
    // 使用与 generateAgeEvent（非流式）相同的 parseJSON 函数（多层兜底）
    raw = parseJSON(rawText);
    isParsed = true;
  } catch {
    // 如果解析失败，使用流式收集的内容作为narrative创建一个基本对象
    console.warn('[LLM stream] Failed to parse JSON, using raw text as narrative');
    raw = { narrative: rawText };
  }

  // TechDoc 18.6.5：post-parse zod schema 健康检查（失败仅 log）
  if (isParsed) postParseSchemaCheck(AIEventOutputSchema, raw, 'generateAgeEventStream');
  
  const sanitized = sanitizeEventOutput(raw, ctx.character.age);
  
  // 如果解析失败或返回的narrative看起来像是模板文本，标记为fallback
  if (!isParsed || (!sanitized.narrative || sanitized.narrative.length < 20 || 
    sanitized.narrative.includes('事件标题') || 
    sanitized.narrative.includes('叙事正文') ||
    sanitized.narrative.includes('JSON') ||
    sanitized.narrative.includes('schema'))) {
    sanitized.isFallbackGenerated = true;
    // 如果narrative无效，生成一个简单的fallback叙事
    if (!sanitized.narrative || sanitized.narrative.length < 20 || 
        sanitized.narrative.includes('事件标题') || 
        sanitized.narrative.includes('叙事正文')) {
      sanitized.narrative = `${ctx.character.name}在${ctx.character.location || '修炼之地'}静心修炼，感悟天地灵气流转。岁月悄然流逝，修为稳步增长。`;
      sanitized.title = '静心修炼';
    }
  }
  
  sanitized.narrative = cleanNarrativeAge(sanitized.narrative, ctx.character.age, ctx.character.name);
  if (Array.isArray(sanitized.extraEvents)) {
    sanitized.extraEvents = sanitized.extraEvents.map((event: any) => ({
      ...event,
      narrative: cleanNarrativeAge(String(event?.narrative || ''), ctx.character.age, ctx.character.name),
    }));
  }
  if (sanitized.choice?.prompt) {
    sanitized.choice.prompt = cleanNarrativeAge(sanitized.choice.prompt, ctx.character.age, ctx.character.name);
  }
  return sanitized;
}

export async function generateChoiceResult(
  ctx: EngineStateContext,
  choicePrompt: string,
  chosenText: string
): Promise<ChoiceResultOutput> {
  const userPrompt = buildChoosePrompt(ctx, choicePrompt, chosenText);
  try {
    const raw = await callLLM(IDENTITY_PROMPT, userPrompt, SCENE_PROMPTS.choose);
    // TechDoc 18.6.5：post-parse zod schema 健康检查（失败仅 log）
    postParseSchemaCheck(AIChoiceResultSchema, raw, 'generateChoiceResult');
    const sanitized = sanitizeChoiceOutput(raw);
    sanitized.narrative = cleanNarrativeAge(sanitized.narrative, ctx.character.age, ctx.character.name);
    return sanitized;
  } catch (err: any) {
    console.error('Choice generation failed, using fallback:', err?.message || err);
    return sanitizeChoiceOutput({
      narrative: `${ctx.character.name}选择「${chosenText}」，顺势应下这一段因果。局势暂且平稳，后续变化仍待天机显现。`,
      changes: [],
      newStatuses: [],
      newItems: [],
      removedItemIds: [],
      equipItemIds: [],
      unequipItemIds: [],
      newEquippedItems: [],
      newThreads: [],
      advanceThreads: [],
      completeThreadIds: [],
      failThreadIds: [],
      triggerCombat: null,
    });
  }
}

export async function generateInterfereResponse(
  ctx: EngineStateContext,
  playerInput: string
): Promise<InterfereOutput> {
  const userPrompt = buildInterferePrompt(ctx, playerInput);
  try {
    const raw = await callLLM(IDENTITY_PROMPT, userPrompt, SCENE_PROMPTS.interfere);
    // TechDoc 18.6.5：post-parse zod schema 健康检查（失败仅 log）
    postParseSchemaCheck(AIInterfereOutputSchema, raw, 'generateInterfereResponse');
    const sanitized = sanitizeInterfereOutput(raw, ctx.character.age);
    sanitized.narrative = cleanNarrativeAge(sanitized.narrative, ctx.character.age, ctx.character.name);
    return sanitized;
  } catch (err: any) {
    console.error('Interfere generation failed, using fallback:', err?.message || err);
    return sanitizeInterfereOutput({
      accepted: false,
      classification: 'dialogue',
      narrative: `天机沉寂，${ctx.character.name}心中闪过「${playerInput}」之念，却暂未掀起可见波澜。`,
      changes: [],
      newStatuses: [],
      newItems: [],
      removedItemIds: [],
      equipItemIds: [],
      unequipItemIds: [],
      newEquippedItems: [],
      newThreads: [],
      advanceThreads: [],
      completeThreadIds: [],
      failThreadIds: [],
      triggerCombat: null,
    });
  }
}

// ==================== 物品操作叙事生成（玩家装备/卸下/使用后调用） ====================

// 玩家在「宝」页点装备/卸下/使用物品后，调用此函数让 AI：
// 1. 生成一段简短叙事（30-80字）描述动作过程
// 2. 更新 cultivationInsight（反映装备变化对修炼速度的影响；来源条目由引擎权威计算，AI 不输出）
// 返回 { narrative, cultivationInsight }
export interface ItemActionNarrativeResult {
  narrative: string;
  cultivationInsight: string;
}

export async function generateItemActionNarrative(
  ctx: EngineStateContext,
  action: 'equip' | 'unequip' | 'use',
  item: ItemEntry,
): Promise<ItemActionNarrativeResult> {
  const sc = ctx.character;
  const actionZh = action === 'equip' ? '装备' : action === 'unequip' ? '卸下' : '使用';
  const eqArr = Array.isArray(ctx.equipped) ? ctx.equipped : [];
  const eqList = eqArr.length
    ? eqArr.map((it: any) => `${it.name}(id:${it.id})${it.equipNote ? `·${it.equipNote}` : ''}`).join('，')
    : '无';
  const storageCap = ctx.storageCapacity ?? 5;
  const invCount = ctx.inventory.length;
  const hasBag = invCount > 0 && ctx.inventory.some(i => i.item_type === 'tool' && (i.effects || []).some(e => e.target_attribute === 'storageCapacity'));
  const storageDesc = `${invCount}/${storageCap}件${hasBag ? '（已有储物袋）' : '（无储物袋）'}`;
  const mult = ctx.cultivationMultiplier || 0;
  const curInsight = ctx.cultivationInsight || '';
  // 引擎权威计算的来源条目（数字准确，AI 必须在文本中引用这些数字）
  const engineFactors = (ctx.cultivationFactors && ctx.cultivationFactors.length)
    ? ctx.cultivationFactors.map(f => `${f.name}(${f.operation === 'multiply' ? '×' : '+'}${f.value})`).join('，')
    : '无';

  const system = `${IDENTITY_PROMPT}

【当前场景：物品操作叙事】
玩家在「宝」页对物品进行了操作。你需要：
1. 生成一段 30-80 字的简短叙事，描述动作过程（用修仙口吻，融入角色当前处境）
2. 更新 cultivationInsight（60-150 字，规则同 advance 场景：必须引用引擎提供的准确来源名称与数字）
来源条目由引擎权威计算，你不可输出 cultivationFactors 字段（已从 schema 移除）。

严格 JSON 输出。`;

  const user = `【状态快照】
角色：${sc.name}，${sc.age}岁，${sc.realmName}${sc.realmMaxLevel > 0 ? `（${sc.realmLevel + 1}层）` : ''}
灵根：${sc.rootDetail || sc.spiritualRoot}
修为：${sc.cultivationExp}/${sc.expToBreak}（修炼速度：${mult.toFixed(2)}倍）
所在：${sc.location}  宗门：${sc.faction || '散修'}
背包（${storageDesc}）：${ctx.inventory.map(i => `${i.name}(id:${i.id})`).join('、') || '无'}
已装备：${eqList}
上一轮修炼心得：${curInsight || '（无）'}
引擎权威来源条目（数字准确，须在心得中引用）：${engineFactors}

【玩家操作】
${actionZh}：${item.name}（${item.rarity}/${item.item_type}）
${item.description}
${item.effects && item.effects.length ? '效果：' + item.effects.map(e => `${e.operation === 'add' ? '+' : '×'}${e.value} ${e.target_attribute}`).join('，') : '无效果'}
${item.equipNote ? '装备位置：' + item.equipNote : ''}

请生成 JSON：
{
  "narrative": "${actionZh}过程叙事（30-80字，修仙口吻，融入角色处境）",
  "cultivationInsight": "更新后的修炼心得（60-150字，必须引用引擎提供的准确来源名称与数字，反映本次操作对修炼的影响）"
}

注意：
- 若操作不影响修炼速度（如装备武器加 attack），cultivationInsight 仍要生成（反映当前整体状态），但可保持与上一轮相近
- 若操作影响修炼速度（如装备/卸下功法、使用丹药加 cultivationExp），insight 必须明显体现这一变化
- ${actionZh}narrative 简短自然，例如装备功法可写"你将《引气诀》摊开研读，灵气运转之法渐明，遂将其铭记于心，时时修习。"
- 严禁 JSON 转义问题：文本内不得出现裸双引号、裸换行符`;

  try {
    const content = await callLLMText(system, user);
    const raw = parseJSON(content);
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIItemActionNarrativeSchema, raw, 'generateItemActionNarrative');
    return {
      narrative: String(raw?.narrative || `${actionZh}了${item.name}`).slice(0, 200),
      cultivationInsight: raw?.cultivationInsight ? String(raw.cultivationInsight).slice(0, 400) : curInsight,
    };
  } catch (err: any) {
    console.error('generateItemActionNarrative failed:', err?.message || err);
    // 失败时返回最小可用结果（不阻塞物品操作）
    return {
      narrative: `${actionZh}了${item.name}。`,
      cultivationInsight: curInsight,
    };
  }
}

// ==================== 炼丹 AI 产出 ====================

export async function generateAlchemyOutcome(
  ctx: EngineStateContext,
  materials: ItemEntry[],
  hints: { baseSuccessRate: number; suggestedRarity: string; dominantElement: string; spiritStoneCost: number },
): Promise<AlchemyAIOutcome | null> {
  const sc = ctx.character;
  const matList = materials.map(m => {
    const eff = (m.effects || []).map(e => `${e.operation === 'multiply' ? '×' : '+'}${e.value} ${e.target_attribute}`).join('，') || '无显效';
    return `${m.name}（${m.rarity}/${m.item_type}）：${m.description || ''}｜药性：${eff}`;
  }).join('\n');

  const system = `${IDENTITY_PROMPT}

【当前场景：开炉炼丹】
玩家投入数味材料与灵石开炉炼丹。你扮演天道，依据【材料药性·相性·品阶】【角色丹道造诣（悟性/灵根/境界）】【世界因果】判定这一炉的结果。

判断要点：
- 成丹与否由材料相性与火候掌控（悟性/境界/灵根契合）共同决定；引擎给出的成功率仅供参考，可结合因果上调或下调。
- 材料药性相冲、品阶悬殊或造诣不足时，更易炸炉、出废丹或产生异变（丹成带毒、药力暴走反噬等）。
- 成丹时丹名须自拟，禁止照搬材料名；丹效方向应与投入材料药性自洽（疗伤材料→偏回血，灵气/修为材料→偏增修为，攻伐材料→偏攻），并贴合产出品阶。
- 失败时也要给出一枚产物（焦丹/异丹/毒丹等）及对应的少量或负面效果。

严格 JSON 输出，不要任何解释性文字。`;

  const user = `【炼丹者】
${sc.name}，${sc.age}岁，${sc.realmName}${sc.realmMaxLevel > 0 ? `（${sc.realmLevel + 1}层）` : ''}
灵根：${sc.rootDetail || sc.spiritualRoot}｜悟性：${sc.comprehension}
所在：${sc.location}｜宗门：${sc.faction || '散修'}

【入炉材料】
${matList}
灵石投入：${hints.spiritStoneCost}

【引擎参考（仅供参考，可调整）】
基准成功率：${Math.round(hints.baseSuccessRate)}%
建议品阶档位：${hints.suggestedRarity}（可上下浮动一档，需因果支撑）
主导元素倾向：${hints.dominantElement}

请生成 JSON：
{
  "success": true 或 false,
  "pillName": "自拟丹名（2-6字，勿照搬材料名）",
  "pillDescription": "丹药说明（20-60字，沉浸式修仙口吻）",
  "rarity": "common|uncommon|rare|epic|legendary|mythic 之一",
  "mainElement": "fire|water|wood|metal|earth|none 之一",
  "effects": [{ "target_attribute": "属性名", "operation": "add 或 multiply", "value": 数字, "description": "效果说明" }],
  "narrative": "开炉过程叙事（40-100字，修仙口吻，体现成败与火候）",
  "accident": "可选：若炸炉/异变/反噬，简述意外；正常成丹可省略"
}

可用属性：attack, defense, speed, luck, comprehension, hp, maxHp, mp, maxMp, cultivationExp
- add 直接加数值；multiply 用于 cultivationExp 等倍率（取值 1.05~3.5）
- 效果 1-2 条即可；数值会被引擎按品阶上限校正，不必追求极大
- 严禁 JSON 转义问题：文本内不得出现裸双引号、裸换行符`;

  try {
    const content = await callLLMText(system, user);
    const raw = parseJSON(content);
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIAlchemyOutcomeSchema, raw, 'generateAlchemyOutcome');
    if (!raw || typeof raw !== 'object') return null;
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const elements = ['fire', 'water', 'wood', 'metal', 'earth', 'none'];
    const effects = Array.isArray(raw.effects)
      ? raw.effects.filter((e: any) => e && e.target_attribute).map((e: any) => ({
          target_attribute: String(e.target_attribute),
          operation: e.operation === 'multiply' ? 'multiply' : 'add',
          value: Number(e.value) || 0,
          description: String(e.description || ''),
        }))
      : [];
    return {
      success: !!raw.success,
      pillName: (String(raw.pillName || '').trim().slice(0, 12)) || '无名丹',
      pillDescription: String(raw.pillDescription || '').slice(0, 200),
      rarity: rarities.includes(raw.rarity) ? raw.rarity : 'common',
      mainElement: elements.includes(raw.mainElement) ? raw.mainElement : 'none',
      effects: effects as any,
      narrative: String(raw.narrative || '').slice(0, 300),
      accident: raw.accident ? String(raw.accident).slice(0, 200) : undefined,
    } as AlchemyAIOutcome;
  } catch (err: any) {
    console.error('generateAlchemyOutcome failed:', err?.message || err);
    return null;
  }
}

// ==================== AI 内容生成：坊市 / 拍卖 / 战利品 / 灵宠 ====================

const AI_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const AI_ITEM_TYPES = ['weapon', 'armor', 'accessory', 'consumable', 'material', 'scripture', 'tool', 'artifact'];
const AI_EFFECT_TARGETS = new Set(['attack', 'defense', 'speed', 'luck', 'comprehension', 'hp', 'maxHp', 'mp', 'maxMp', 'cultivationExp', 'storageCapacity']);
function sanitizeAiEffects(raw: any, limit = 3): any[] {
  return Array.isArray(raw) ? raw.slice(0, limit).filter(e => e && AI_EFFECT_TARGETS.has(String(e.target_attribute))).map(e => ({
    target_attribute: String(e.target_attribute),
    operation: e.operation === 'multiply' ? 'multiply' : 'add',
    value: e.operation === 'multiply' ? Math.max(1.02, Math.min(3.5, Number(e.value) || 1.05)) : Math.max(-5000, Math.min(5000, Math.round(Number(e.value) || 0))),
    description: String(e.description || '灵机变化').slice(0, 80),
  })).filter(e => e.operation === 'multiply' || e.value !== 0) : [];
}
function stripLootOwnerPrefix(name?: string): string {
  const text = String(name || '').trim();
  const match = text.match(/^(.{1,10})的(.{2,24})$/u);
  if (!match) return text;
  const [, owner, objectName] = match;
  const ownerLooksLikeEnemy = /修|汉|客|匪|贼|妖|魔|邪|劫|道人|真人|老祖|敌|疤|牙|瘦|胖|黑衣|蒙面/.test(owner);
  const objectLooksLikeLoot = /符|剑|刀|珠|环|甲|袍|幡|铃|镜|印|袋|丹|诀|经|玉简|法器|法宝|护/.test(objectName);
  return ownerLooksLikeEnemy && objectLooksLikeLoot ? objectName : text;
}

function sanitizeAiItem(raw: any, source: string, fallbackName = '无名灵物'): ItemEntry {
  const rarity = AI_RARITIES.includes(raw?.rarity) ? raw.rarity : 'common';
  const itemType = AI_ITEM_TYPES.includes(raw?.item_type) ? raw.item_type : 'material';
  return {
    id: String(raw?.id || `${source}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    name: (source === '战利所得' ? stripLootOwnerPrefix(String(raw?.name || fallbackName)) : String(raw?.name || fallbackName)).slice(0, 24),
    description: String(raw?.description || '来历未明的灵物。').slice(0, 180),
    item_type: itemType as ItemEntry['item_type'],
    rarity: rarity as ItemEntry['rarity'],
    effects: sanitizeAiEffects(raw?.effects),
    source,
  };
}

export async function generateMarketOfferings(ctx: EngineStateContext): Promise<MarketAIOutcome | null> {
  const sc = ctx.character;
  const system = `${IDENTITY_PROMPT}

【当前场景：坊市货品生成】
你要根据角色所在地点、境界、近期因果、世界局势生成此刻坊市可见货品。面板只是展示你的货品输出；引擎会校验价格、物品结构和效果数值。
严格 JSON 输出。`;
  const recent = ctx.recentEvents.slice(-3).map(e => `${e.age}岁·${e.title}:${e.narrative.slice(0, 80)}`).join('\n') || '无';
  const facts = (ctx.worldFacts || []).slice(0, 6).map(f => `${f.kind}:${f.title}`).join('，') || '无';
  const user = `角色：${sc.name}，${sc.realmName}，灵石${sc.spiritStones}，所在${sc.location}，名声${sc.reputation}
近期事件：
${recent}
世界事实：${facts}

请生成 6-9 件坊市货品 JSON：
{
  "marketName":"坊市/摊位名",
  "atmosphere":"20-60字坊市氛围",
  "items":[{"name":"物名","description":"说明","item_type":"weapon|armor|accessory|consumable|material|scripture|tool|artifact","rarity":"common|uncommon|rare|epic|legendary|mythic","price":价格数字,"effects":[{"target_attribute":"属性","operation":"add|multiply","value":数字,"description":"效果"}],"reason":"为何此地会卖此物"}]
}
价格要符合角色阶段和当地供需；不要只给固定入门货。`;
  try {
    const raw = parseJSON(await callLLMText(system, user));
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIMarketOutcomeSchema, raw, 'generateMarketOfferings');
    const items = Array.isArray(raw?.items) ? raw.items.slice(0, 9).map((it: any, idx: number) => ({
      ...sanitizeAiItem({ ...it, id: `market_ai_${Date.now().toString(36)}_${idx}` }, '坊市'),
      price: Math.max(1, Math.min(999999, Math.round(Number(it.price) || 10))),
      reason: it.reason ? String(it.reason).slice(0, 120) : undefined,
    })) : [];
    return items.length ? { marketName: String(raw.marketName || '').slice(0, 40), atmosphere: String(raw.atmosphere || '').slice(0, 120), items } : null;
  } catch (err: any) { console.error('generateMarketOfferings failed:', err?.message || err); return null; }
}

export async function generateAuctionContent(ctx: EngineStateContext): Promise<AuctionAIOutcome | null> {
  const sc = ctx.character;
  const system = `${IDENTITY_PROMPT}

【当前场景：拍卖会内容生成】
你要生成一场轻量拍卖会的拍品、竞拍者和入场邀请。流程由引擎主持，内容由你根据地点、境界、因果生成。严格 JSON 输出。`;
  const threads = (ctx.pendingThreads || []).slice(0, 5).map(t => `${t.title}:${t.description.slice(0, 60)}`).join('\n') || '无';
  const user = `角色：${sc.name}，${sc.realmName}，灵石${sc.spiritStones}，所在${sc.location}，气运${sc.luck}
未了因缘：
${threads}

请生成 JSON：
{"title":"拍卖会名","invitation":"入场邀约（40-90字）","lots":[{"item":{物品字段同 ItemEntry，不要 id},"startingPrice":起价,"seller":"寄拍方","desireTags":["标签"]}],"bidders":[{"name":"竞拍者名","realm":"境界","assets":灵石资产,"desireTags":["偏好"],"temperament":"calm|proud|greedy|secretive|reckless"}]}
拍品 4-6 件；竞拍者 4-6 人；高价值物应能牵动后续因果。`;
  try {
    const raw = parseJSON(await callLLMText(system, user));
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIAuctionOutcomeSchema, raw, 'generateAuctionContent');
    const lots = Array.isArray(raw?.lots) ? raw.lots.slice(0, 6).map((lot: any) => ({
      item: sanitizeAiItem(lot.item || lot, '拍卖会', '拍卖灵物'),
      startingPrice: Math.max(5, Math.min(999999, Math.round(Number(lot.startingPrice) || 30))),
      seller: String(lot.seller || '寄拍修士').slice(0, 30),
      desireTags: Array.isArray(lot.desireTags) ? lot.desireTags.slice(0, 6).map(String) : [],
    })) : [];
    const temps = ['calm', 'proud', 'greedy', 'secretive', 'reckless'];
    const bidders = Array.isArray(raw?.bidders) ? raw.bidders.slice(0, 6).map((b: any) => ({
      name: String(b.name || '无名竞拍者').slice(0, 18), realm: String(b.realm || '散修').slice(0, 20),
      assets: Math.max(20, Math.min(999999, Math.round(Number(b.assets) || 200))),
      desireTags: Array.isArray(b.desireTags) ? b.desireTags.slice(0, 8).map(String) : [],
      temperament: temps.includes(b.temperament) ? b.temperament : 'calm',
    })) : [];
    return lots.length && bidders.length ? { title: String(raw.title || '暗香拍卖').slice(0, 40), invitation: String(raw.invitation || '').slice(0, 160), lots, bidders } as any : null;
  } catch (err: any) { console.error('generateAuctionContent failed:', err?.message || err); return null; }
}

export async function generateCombatLootProposal(ctx: EngineStateContext, session: CombatSession): Promise<CombatLootAIOutcome | null> {
  if (session.status !== 'victory') return null;
  const enemies = (session.enemies || []).map(e => `${e.name}(${e.realm || '未知'}):${e.description || ''}`).join('\n');
  const system = `${IDENTITY_PROMPT}

【当前场景：战后战利品提案】
根据敌人身份、境界、携带资源、战斗损毁情况生成合理战利品。引擎会校验物品结构、去重、储物和灵石。严格 JSON 输出。`;
  const user = `角色：${ctx.character.name}，${ctx.character.realmName}，地点${ctx.character.location}
击败敌人：
${enemies}

请生成 JSON：{"items":[ItemEntry字段，不要id，最多6件],"spiritStones":灵石数,"narrativeHint":"战利品如何得来（30-80字）"}
应优先给敌人合理携带且未毁坏的装备、法器、丹药、储物袋、材料；不要只给无用碎片。
物品名不要写成“某某的XX”“从某某身上搜得的XX”，归属和来历写进 description/source；物品名只写器物本名，例如“残光护符”“潮纹护珠”。
若给法宝/法器且自带术式，必须在 technique.artifactAbilities 写独立术式名，例如“残光护幕”，不能让术式名复用法宝名。`;
  try {
    const raw = parseJSON(await callLLMText(system, user));
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AICombatLootSchema, raw, 'generateCombatLootProposal');
    const items = Array.isArray(raw?.items) ? raw.items.slice(0, 6).map((it: any) => sanitizeAiItem(it, '战利所得', '战利灵物')) : [];
    return { items, spiritStones: Math.max(0, Math.min(999999, Math.round(Number(raw?.spiritStones) || 0))), narrativeHint: raw?.narrativeHint ? String(raw.narrativeHint).slice(0, 160) : undefined };
  } catch (err: any) { console.error('generateCombatLootProposal failed:', err?.message || err); return null; }
}

export async function generatePetBond(ctx: EngineStateContext, requested?: { species?: string; rarity?: string }): Promise<PetBondAIOutcome | null> {
  const sc = ctx.character;
  const species = requested?.species || '自定';
  const rarity = requested?.rarity || '自定';
  const system = `${IDENTITY_PROMPT}

【当前场景：灵宠结缘】
根据角色地点、境界、因果与玩家请求生成一只独特灵宠。引擎会校验物种、品阶和数值范围。严格 JSON 输出。`;
  const user = `角色：${sc.name}，${sc.realmName}，所在${sc.location}，灵根${sc.rootDetail || sc.spiritualRoot}
玩家倾向：species=${species}, rarity=${rarity}

输出 JSON：{"name":"灵宠名","species":"fox|wolf|snake|turtle|eagle|ape|spider|butterfly|fish|tiger|phoenix|dragon","description":"描述","rarity":"common|uncommon|rare|epic|legendary|mythic","element":"metal|wood|water|fire|earth","hp":数值,"attack":数值,"defense":数值,"speed":数值,"loyalty":0-100,"satiety":0-100,"sourceAcquired":"如何结缘","skill":{"name":"技能名","description":"技能描述","power":倍率,"cooldown":回合},"traits":["特性"],"passiveHint":"被动倾向","narrative":"结缘叙事（40-100字）"}`;
  try {
    const raw = parseJSON(await callLLMText(system, user));
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIPetBondSchema, raw, 'generatePetBond');
    const speciesList = ['fox','wolf','snake','turtle','eagle','ape','spider','butterfly','fish','tiger','phoenix','dragon'];
    const elements = ['metal','wood','water','fire','earth'];
    const rarities = AI_RARITIES;
    return {
      name: String(raw.name || '灵兽').slice(0, 18),
      species: (speciesList.includes(raw.species) ? raw.species : 'fox') as any,
      description: String(raw.description || '').slice(0, 180),
      rarity: (rarities.includes(raw.rarity) ? raw.rarity : 'uncommon') as any,
      element: (elements.includes(raw.element) ? raw.element : 'wood') as any,
      hp: Number(raw.hp) || 60, attack: Number(raw.attack) || 10, defense: Number(raw.defense) || 6, speed: Number(raw.speed) || 10,
      loyalty: Number(raw.loyalty) || 70, satiety: Number(raw.satiety) || 80,
      sourceAcquired: String(raw.sourceAcquired || '灵缘结契').slice(0, 80),
      skill: { name: String(raw.skill?.name || '灵息护主').slice(0, 20), description: String(raw.skill?.description || '').slice(0, 120), power: Number(raw.skill?.power) || 1.2, cooldown: Number(raw.skill?.cooldown) || 3 },
      traits: Array.isArray(raw.traits) ? raw.traits.slice(0, 5).map(String) : [],
      passiveHint: raw.passiveHint ? String(raw.passiveHint).slice(0, 120) : undefined,
      narrative: String(raw.narrative || '').slice(0, 220),
    } as PetBondAIOutcome;
  } catch (err: any) { console.error('generatePetBond failed:', err?.message || err); return null; }
}

export async function generatePetCareOutcome(ctx: EngineStateContext, pet: Pet, item: ItemEntry): Promise<PetCareAIOutcome | null> {
  const system = `${IDENTITY_PROMPT}

【当前场景：灵宠喂养反应】
根据灵宠血脉、当前状态和喂养物药性，生成本次喂养的成长反应。引擎会 clamp 数值并消耗物品。严格 JSON 输出。`;
  const eff = (item.effects || []).map(e => `${e.target_attribute}${e.operation}${e.value}`).join('，') || '无显效';
  const user = `角色：${ctx.character.name}
灵宠：${pet.name}（${pet.species}/${pet.rarity}），忠诚${pet.loyalty}，饱食${pet.satiety}，等级${pet.level}，特性${(pet.traits || []).join('、') || '无'}
喂养物：${item.name}（${item.rarity}/${item.item_type}）${item.description}｜效果:${eff}

输出 JSON：{"satietyDelta":数字,"loyaltyDelta":数字,"expDelta":数字,"levelDelta":数字可0,"attackDelta":数字可0,"defenseDelta":数字可0,"maxHpDelta":数字可0,"narrative":"喂养叙事（40-100字）"}`;
  try {
    const raw = parseJSON(await callLLMText(system, user));
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIPetCareSchema, raw, 'generatePetCareOutcome');
    return { satietyDelta: Number(raw.satietyDelta) || 0, loyaltyDelta: Number(raw.loyaltyDelta) || 0, expDelta: Number(raw.expDelta) || 0, levelDelta: Number(raw.levelDelta) || 0, attackDelta: Number(raw.attackDelta) || 0, defenseDelta: Number(raw.defenseDelta) || 0, maxHpDelta: Number(raw.maxHpDelta) || 0, narrative: String(raw.narrative || '').slice(0, 220) };
  } catch (err: any) { console.error('generatePetCareOutcome failed:', err?.message || err); return null; }
}


// ==================== 战斗回合叙事润色 ====================

function sanitizeCombatRoundProposal(raw: any): CombatRoundProposal {
  const allowedActionTypes = new Set(['attack', 'skill', 'item', 'defend', 'flee', 'scripture']);
  const allowedTempos = new Set(['pressing', 'stalemate', 'opening', 'danger', 'flee_window', 'turning', 'chaos']);
  const allowedAdvantages = new Set(['player', 'enemy', 'even', 'unclear']);
  const sanitizeActionType = (value: any): any => ['basic_attack', 'defense', 'other', 'flee', 'item', 'talisman', 'technique', 'spell'].includes(String(value || '')) ? String(value) : 'other';
  return {
    playerActionLabel: raw?.playerActionLabel ? String(raw.playerActionLabel).slice(0, 40) : undefined,
    playerActionType: allowedActionTypes.has(raw?.playerActionType) ? raw.playerActionType : undefined,
    enemyAction: raw?.enemyAction ? String(raw.enemyAction).slice(0, 40) : undefined,
    enemyActionType: raw?.enemyActionType ? String(raw.enemyActionType).slice(0, 24) : undefined,
    playerDamage: Math.max(0, Math.floor(Number(raw?.playerDamage) || 0)),
    playerHeal: Math.max(0, Math.floor(Number(raw?.playerHeal) || 0)),
    enemyDamage: Math.max(0, Math.floor(Number(raw?.enemyDamage) || 0)),
    mpCost: raw?.mpCost == null ? undefined : Math.max(0, Math.floor(Number(raw.mpCost) || 0)),
    consumeItem: raw?.consumeItem === false ? false : raw?.consumeItem === true ? true : undefined,
    fleeOutcome: raw?.fleeOutcome === 'success' ? 'success' : raw?.fleeOutcome === 'failed' ? 'failed' : undefined,
    narrative: raw?.narrative ? String(raw.narrative).slice(0, 320) : undefined,
    auditHints: Array.isArray(raw?.auditHints) ? raw.auditHints.map((x: any) => String(x).slice(0, 80)).filter(Boolean).slice(0, 4) : [],
    enemyBeats: Array.isArray(raw?.enemyBeats) ? raw.enemyBeats.map((b: any) => ({
      enemyId: b?.enemyId != null ? String(b.enemyId) : undefined,
      enemyIdx: b?.enemyIdx == null ? undefined : Math.max(0, Math.floor(Number(b.enemyIdx) || 0)),
      action: b?.action ? String(b.action).slice(0, 40) : undefined,
      actionType: b?.actionType ? String(b.actionType).slice(0, 24) : undefined,
      damageToPlayer: Math.max(0, Math.floor(Number(b?.damageToPlayer) || 0)),
    })).slice(0, 12) : undefined,
    playerHits: Array.isArray(raw?.playerHits) ? raw.playerHits.map((h: any) => ({
      enemyId: h?.enemyId != null ? String(h.enemyId) : undefined,
      enemyIdx: h?.enemyIdx == null ? undefined : Math.max(0, Math.floor(Number(h.enemyIdx) || 0)),
      damage: Math.max(0, Math.floor(Number(h?.damage) || 0)),
    })).slice(0, 12) : undefined,
    dialogue: Array.isArray(raw?.dialogue) ? raw.dialogue.map((d: any) => ({
      speaker: d?.speaker ? String(d.speaker).slice(0, 24) : undefined,
      text: d?.text ? String(d.text).slice(0, 120) : undefined,
    })).filter((d: any) => d.text).slice(0, 6) : undefined,
    tacticalSituation: raw?.tacticalSituation ? {
      tempo: allowedTempos.has(raw.tacticalSituation.tempo) ? raw.tacticalSituation.tempo : 'chaos',
      advantage: allowedAdvantages.has(raw.tacticalSituation.advantage) ? raw.tacticalSituation.advantage : 'unclear',
      reason: raw.tacticalSituation.reason ? String(raw.tacticalSituation.reason).slice(0, 90) : '',
      playerOpening: raw.tacticalSituation.playerOpening ? String(raw.tacticalSituation.playerOpening).slice(0, 80) : undefined,
      enemyPressure: raw.tacticalSituation.enemyPressure ? String(raw.tacticalSituation.enemyPressure).slice(0, 80) : undefined,
      suggestedFocus: raw.tacticalSituation.suggestedFocus ? String(raw.tacticalSituation.suggestedFocus).slice(0, 60) : undefined,
    } : undefined,
    nextActions: Array.isArray(raw?.nextActions) ? raw.nextActions.map((a: any, idx: number) => ({
      id: a?.id ? String(a.id).slice(0, 48) : `ai-action-${idx}`,
      name: a?.name ? String(a.name).slice(0, 18) : '临机应变',
      description: a?.description ? String(a.description).slice(0, 90) : '顺着当前战势临机处置。',
      actionType: sanitizeActionType(a?.actionType),
      source: 'ai' as const,
      enabled: a?.enabled === false ? false : true,
      disabledReason: a?.disabledReason ? String(a.disabledReason).slice(0, 50) : undefined,
      mpCost: a?.mpCost == null ? 0 : Math.max(0, Math.floor(Number(a.mpCost) || 0)),
      risk: a?.risk ? String(a.risk).slice(0, 50) : undefined,
      intent: a?.intent ? String(a.intent).slice(0, 70) : undefined,
      tags: Array.isArray(a?.tags) ? a.tags.map((x: any) => String(x).slice(0, 20)).filter(Boolean).slice(0, 5) : ['ai-context'],
    })).filter((a: any) => a.name && a.description).slice(0, 5) : undefined,
     playerImpulse: raw?.playerImpulse && (raw.playerImpulse.prompt || raw.playerImpulse.itemId || raw.playerImpulse.itemName) ? {
      kind: raw.playerImpulse.kind === 'item' ? 'item' as const : 'contingency' as const,
      prompt: raw.playerImpulse.prompt ? String(raw.playerImpulse.prompt).slice(0, 160) : undefined,
      itemId: raw.playerImpulse.itemId != null ? String(raw.playerImpulse.itemId) : undefined,
      itemName: raw.playerImpulse.itemName ? String(raw.playerImpulse.itemName).slice(0, 40) : undefined,
    } : undefined,
  };
}


export async function generateSettlementEvaluation(args: {
  character: any;
  events: any[];
  candidateOptions: any[];
  fallback: { title: string; summary: string; rank: string; score: number };
}): Promise<{ title: string; summary: string; rank: string; optionIds: string[]; reasons: Record<string, string> }> {
  const { character, events, candidateOptions, fallback } = args;
  const importantEvents = (events || [])
    .filter((event) => ['birth', 'fate_node', 'choice', 'interference', 'combat', 'breakthrough', 'death', 'auction', 'exploration', 'normal'].includes(String(event.eventType || 'normal')))
    .slice(-18);
  const recentEvents = importantEvents.map((event) => ({
    age: event.age,
    title: event.title,
    eventType: event.eventType,
    narrative: String(event.narrative || '').slice(0, 260),
  }));
  const candidates = (candidateOptions || []).slice(0, 12).map((option) => ({
    id: option.id,
    name: option.name,
    category: option.category,
    rarity: option.rarity,
    source: option.source,
    description: String(option.description || '').slice(0, 120),
    engineReason: String(option.reason || '').slice(0, 120),
  }));

  const system = `${IDENTITY_PROMPT}

【当前任务：一世轮回结算】
你负责根据角色真实经历，为这一世写出一段传记式结语，并从引擎提供的候选传承中挑出最有价值、最值得展示给玩家的选项。

硬规则：
- 只能从 candidateOptions 中选择 optionIds，严禁创造不存在的传承。
- optionIds 数量由你根据评价、角色厚度和候选质量决定；没有合适就空，普通一世可给 1-3 个，厚重一世可给 4-5 个，但极少超过 5 个。
- 玩家最终只会选择其中一个，因此同一类高度相似候选应当精简，不要为了凑数量而塞满。
- summary 必须像人物小传/墓志铭/仙路评传，不要只写一句模板。优先按“姓名与资质/根骨 → 早年或出身 → 关键年龄节点与事件 → 机缘、战斗、秘境、拍卖、突破或牵挂 → 终局评价”的顺序组织。
- 必须尽量引用 recentEvents 中真实发生的年龄、事件标题或结果；如果事件很少，也要结合灵根、境界、主动放弃/死亡/飞升原因写出具体评语，不能写成“止步于0岁”“一世虽终”这类机械兜底。
- 若 ending/causeOfDeath 是“主动放下此世因果”，语气应是“此番暂按因果、收束推演/参悟旧路，但其在此世仍曾奔赴自己的仙路”，不要把它写成死亡或失败判词。
- 若死亡，应写清何因而终、其道途遗憾与可留之缘；若飞升，应写成叩开天门后的总结。
- 文案必须沉浸在修仙世界内表达，不要出现 AI、系统、版本、缓存、配置、接口、抽卡等局外词。
- 禁止旁白口吻：summary 中不得出现"此人"、"此生"、"纵观"、"可见"、"足见"、"堪称"等第三人称观察者评述语气，也不许用"他/她这一生"、"其人"、"这位修士"等旁观视角。应以角色第一人称或世界本身的口吻叙述，如仙门记、墓志铭、命数推演，让玩家感觉是世界在讲述而非旁白在点评。
- 视为世界本身对这段人生的判词，可以提及其心性、境遇、资质、抉择、战斗、机缘与遗憾。
- 严格返回 JSON。`;

  const user = `【角色】
姓名：${character.name}
年岁：${character.age}/${character.lifespan}
境界：${character.realmName || getRealmInfo(character.realm)?.name || character.realm} ${character.realmLevel ? `${character.realmLevel + 1}层` : ''}
灵根：${character.rootDetail || character.spiritualRoot}
结局：${character.ascended ? '飞升' : character.causeOfDeath || '此世终了'}
灵石：${character.spiritStones || 0}
声望：${character.reputation || 0}

【近年关键经历】
${JSON.stringify(recentEvents, null, 2)}

【可被挑选的真实候选传承】
${JSON.stringify(candidates, null, 2)}

【引擎基础评价】
${JSON.stringify(fallback, null, 2)}

请输出 JSON：
{
  "title": "8-18字，像一世结语，不要写系统词",
  "summary": "100-220字，以仙门记/墓志铭口吻写此生因果、执念与余韵，自然说明为何有这些传承浮现，不可用旁白评述语气",
  "rank": "2-8字评价称号",
  "optionIds": ["只能填候选传承中的 id，数量由你判断，玩家最终只能选一个"],
  "reasons": { "候选id": "20-60字，说明此物/此缘为何值得留入下一世" }
}`;

  const content = await callLLMText(system, user);
  const raw = parseJSON(content);
  // TechDoc 18.6.5：post-parse zod schema 健康检查
  postParseSchemaCheck(AISettlementEvaluationSchema, raw, 'generateSettlementEvaluation');
  const validIds = new Set<string>(candidates.map((option) => String(option.id)));
  const optionIds: string[] = Array.from(new Set<string>(Array.isArray(raw?.optionIds) ? raw.optionIds.map(String) : []))
    .filter((id: string) => validIds.has(id))
    .slice(0, 5);
  const reasons: Record<string, string> = {};
  const rawReasons: Record<string, any> = raw?.reasons && typeof raw.reasons === 'object' ? raw.reasons : {};
  for (const id of optionIds) {
    const reason = String(rawReasons[id] || '').trim();
    if (reason) reasons[id] = reason.slice(0, 90);
  }
  return {
    title: String(raw?.title || fallback.title).trim().slice(0, 36) || fallback.title,
    summary: String(raw?.summary || fallback.summary).trim().slice(0, 520) || fallback.summary,
    rank: String(raw?.rank || fallback.rank).trim().slice(0, 12) || fallback.rank,
    optionIds,
    reasons,
  };
}

export async function generateCombatRoundProposal(args: {
  ctx: EngineStateContext;
  sessionBefore: CombatSession;
  action: 'attack' | 'skill' | 'item' | 'talisman' | 'defend' | 'flee' | 'other';
  payload?: { skillIdx?: number; itemId?: string; optionId?: string };
}): Promise<CombatRoundProposal> {
  const { ctx, sessionBefore, action, payload } = args;
  const sc = ctx.character;
  const enemy = sessionBefore.enemies?.[sessionBefore.currentEnemyIdx];
  const palette = sessionBefore.actionPalette;
  const allOptions = palette ? [palette.basicAttack, palette.technique, palette.spell, palette.defense, palette.item, palette.other].flatMap(g => g?.options || []) : [];
  const option = payload?.optionId ? allOptions.find(o => o.id === payload.optionId) : undefined;
  const skill = option?.skillIdx != null ? sessionBefore.playerSkills?.[option.skillIdx] : payload?.skillIdx != null ? sessionBefore.playerSkills?.[payload.skillIdx] : undefined;
  const item = payload?.itemId ? (sessionBefore.playerItems || []).find(it => it.itemId === payload.itemId) : undefined;
  const recentLog = (sessionBefore.log || []).slice(-3).map(r => `第${r.round}合：${r.narrative}`).join('\n') || '（尚无旧回合）';
  const tacticMemory = (sessionBefore.tacticalInsights || [])
    .filter((x: any) => x.stacks > 0 && x.expiresRound >= sessionBefore.round)
    .map((x: any) => `针对[${x.enemyIdx}]：${x.kind === 'weakness' ? '破绽' : x.kind}x${x.stacks}（${x.note || ''}，限第${x.expiresRound}合）`)
    .join('\n') || '（暂无战术洞察）';
  const aliveEnemies = (sessionBefore.enemies || []).map((e, i) => ({ e, i })).filter(x => x.e.hp > 0);
  const enemiesDesc = aliveEnemies
    .map(({ e, i }) => `[${i}] ${e.name}（${e.realm || '未知境界'}，气血${e.hp}/${e.maxHp} 攻${e.attack} 御${e.defense} 速${e.speed}）${(e.nextActionDesc || e.nextAction) ? `｜意图：${e.nextActionDesc || e.nextAction}` : ''}${e.description ? ` ｜${e.description}` : ''}`)
    .join('\n') || '（无存活敌人）';
  const targetIdx = sessionBefore.currentEnemyIdx;
  const targetDesc = enemy && enemy.hp > 0 ? `[${targetIdx}] ${enemy.name}` : '（未指定明确目标，按战场局势推演）';
  const isAoe = option?.targetScope === 'aoe' || (option?.tags || []).includes('aoe');
  const aoeHint = isAoe ? '本动作为【群攻】：请用 playerHits 给出命中的多个敌人与各自伤害，可只波及部分敌人。' : '本动作默认作用于上方指定目标；如法术性质天然波及他人，可酌情用 playerHits。';
  const statusDesc = (ctx.activeStatuses || []).map(s => s.name).join('、') || '无特殊状态';
  const impulseDesc = sessionBefore.pendingImpulse?.prompt ? `${sessionBefore.pendingImpulse.reason === 'stalemate' ? '破局关口' : '应变关口'}：${sessionBefore.pendingImpulse.prompt}` : '无';

  const system = `${IDENTITY_PROMPT}

【你正在推演一个修仙战斗节拍】你根据场景、角色状态、玩家这一手的意图，推演这一拍里【所有参战者】的行动，并产出结构化结果与小说化叙事。引擎只做事实校验与数值边界，你负责世界内合理的推演。
硬规则：
- 这是多方混战：玩家这一手之后，【所有存活的敌人】都会各自行动一次（攻击/施法/防御/逃跑/被压制/掠阵等），不是只有一个敌人还手。请为每个存活敌人在 enemyBeats 里各给一条（用 enemyIdx 对应上方编号）。
- 敌人行动要贴合各自身份、境界、性格与战场局势：弱者可能怯战、退避、求饶或趁乱偷袭；悍勇者拼命强攻；群敌会围攻、夹击、抢攻、护住同伴或牵制玩家。
- 不要主角光环：敌我实力悬殊时，敌方可合力重创甚至击杀玩家；玩家被控、被压制、被多人缠住时，这一拍可能只能挨打、被动招架或仅能护身。
- 数值不可凭空夸大，受双方攻防、境界差、资源、状态约束；引擎会按事实上限 clamp，超出会被截断。
- 玩家若指定攻击某目标，playerDamage 作用于该目标；若是群攻，用 playerHits 给出命中的多个敌人与各自伤害。
- 逃跑只能在玩家这一手是逃跑动作时判定 fleeOutcome，并按速度、被缠程度、敌众寡综合判断。
- narrative 写成小说化战斗段落：动作、气机、招式轨迹、环境、心理与转折俱全；可穿插简短对话（敌人叫阵、玩家冷喝、同伴提醒），对话同时单独放进 dialogue 数组。
- 凡人修仙传风格战斗：可描写古宝激发、阵盘激活、傀儡出击、符箓燃烧、丹药服用（战前或战中补益）等手段；不只写刀剑拳脚，远程操控、傀儡布阵、以物代攻同样是修士常见战法。
- 必须给 tacticalSituation：判断当前战势节奏（压制、僵持、破绽、濒危、脱身窗口、反转、混乱）、谁占优、原因、玩家可抓的破口、敌方压力。
- 必须给 nextActions 2-4 个【下一拍临场动作】：它们是 UI 面板的交互投影，应根据当前战势自然生成，例如诱敌露绽、借地形拉开、以法器硬换、佯败脱身；不要只给固定普攻。除非使用真实背包物，否则 actionType 优先用 other/defense/flee/basic_attack。
- 严禁机械战报：不得出现"造成X点伤害""受到X点伤害""HP""扣血""本回合""结算""公式"等字样；数值只作为幕后事实，叙事一律文学化转写（如"血光迸现""真气一窒""踉跄半步"）。
严格只返回 JSON。`;

  const user = `角色：${sc.name}，${sc.age}岁，${sc.realmName}
气血/灵力：${sessionBefore.playerHp}/${sessionBefore.playerMaxHp}，${sessionBefore.playerMp}/${sessionBefore.playerMaxMp}
战斗属性：攻${sessionBefore.playerAttack} 御${sessionBefore.playerDefense} 速${sessionBefore.playerSpeed}
状态：${statusDesc}

战斗缘由：${sessionBefore.contextTitle || '遭遇战斗'}
${sessionBefore.contextNarrative || ''}

存活敌人（共${aliveEnemies.length}）：
${enemiesDesc}

玩家这一手针对的目标：${targetDesc}
玩家本回合动作：${action}
所选选项：${option ? `${option.name}（${option.description}）意图：${option.intent || '无'}` : '未指定具体选项'}
法术：${skill ? `${skill.name}（耗灵力${skill.mpCost}，威力${skill.power}）${skill.description}` : '无'}
物品：${item ? `${item.name}（${item.effect}）` : '无'}
随身物品（可供角色临机取用或破解处境）：${(sessionBefore.playerItems || []).map(it => `${it.name}（${it.effect || it.description || ''}）[id=${it.itemId}]`).join('；') || '无'}
${aoeHint}
【角色本能/应变】若这一拍过后角色陷入【需玩家亲自决断】的处境（如中迷幻、被控、中毒、识海受扰、濒危被围），请输出 playerImpulse：
- 当随身物品里恰有一件可对症破解此处境的道具，且以角色心性此刻会本能地想取用，则 kind="item"，itemId 填该物品真实 id（只能用上方列出的物品，不可杜撰），itemName 填其名，prompt 用角色内心念头式的沉浸表达（如"迷烟入鼻，识海晃荡，怀中那枚清心丹隐隐发烫……"）。
- 若没有对症之物，但局势正逼角色当机立断（突围、挣脱、舍物保命、行险一搏等），则 kind="contingency"，prompt 描述这一危急关口，留待玩家以应变/物品自行解决，不要替玩家决定。
- 若当前关口是“破局关口”或最近回合显示互耗僵持，本拍应优先推演破局尝试、诱敌露绽、脱身窗口或代价升级；不要继续写双方无意义硬拼。
- 处境寻常、无需玩家特别决断时，省略 playerImpulse。
当前关口：${impulseDesc}
战斗记忆：
${tacticMemory}

最近回合：
${recentLog}

返回 JSON：
{
  "playerActionLabel": "玩家动作描述（≤20字）",
  "playerActionType": "attack|skill|item|defend|flee",
  "playerDamage": 0,
  "playerHits": [{"enemyIdx": 0, "damage": 0}],
  "playerHeal": 0,
  "mpCost": 0,
  "consumeItem": true,
  "fleeOutcome": "success|failed",
  "enemyBeats": [
    {"enemyIdx": 0, "action": "该敌这一拍的动作", "actionType": "attack|skill|defend|flee|stunned", "damageToPlayer": 0}
  ],
  "dialogue": [{"speaker": "角色名或敌人名", "text": "简短台词"}],
  "tacticalSituation": {"tempo": "pressing|stalemate|opening|danger|flee_window|turning|chaos", "advantage": "player|enemy|even|unclear", "reason": "战势判断原因", "playerOpening": "玩家可抓破口", "enemyPressure": "敌方压力", "suggestedFocus": "下一拍建议方向"},
  "nextActions": [{"id": "短id", "name": "临场动作名", "description": "为何此刻可行", "actionType": "other|defense|flee|basic_attack", "intent": "动作意图", "risk": "可选风险", "mpCost": 0, "tags": ["ai-context"]}],
  "playerImpulse": {"kind": "item|contingency", "prompt": "角色内心念头式的沉浸描述", "itemId": "仅当kind=item，填上方真实物品id", "itemName": "物品名"},
  "narrative": "120-260字小说化战斗叙事，含动作、气机、转折，可穿插对话；禁止机械战报",
  "auditHints": ["可选：需要引擎特别留意的事实"]
}
要求：enemyBeats 必须覆盖【所有存活敌人】，每个敌人一条（用 enemyIdx 对应编号）；单体攻击可省略 playerHits 只填 playerDamage，群攻则用 playerHits。`;
  const content = await callLLMText(system, user);
  const _roundRaw = parseJSON(content);
  // TechDoc 18.6.5：post-parse zod schema 健康检查
  postParseSchemaCheck(AICombatRoundProposalSchema, _roundRaw, 'generateCombatRoundProposal');
  return sanitizeCombatRoundProposal(_roundRaw);
}

export async function generateCombatRoundNarrative(args: {
  ctx: EngineStateContext;
  sessionBefore: CombatSession;
  round: CombatRound;
  enemyName?: string;
}): Promise<string> {
  const { ctx, sessionBefore, round } = args;
  const sc = ctx.character;
  const enemy = args.enemyName || sessionBefore.enemies?.[sessionBefore.currentEnemyIdx]?.name || '敌手';
  const rawSummary = [
    `第${round.round}回合`,
    `玩家行动：${round.playerAction || '交锋'}`,
    typeof round.playerDamage === 'number' ? `玩家造成伤害：${round.playerDamage}` : '',
    typeof round.playerHeal === 'number' && round.playerHeal > 0 ? `玩家回复：${round.playerHeal}` : '',
    typeof round.enemyDamage === 'number' && round.enemyDamage > 0 ? `敌人造成伤害：${round.enemyDamage}` : '',
    `玩家气血剩余：${round.playerHpAfter}`,
    `敌方气血剩余：${round.enemyHpAfter}`,
    `引擎原始描述：${round.narrative}`,
  ].filter(Boolean).join('\n');

  const system = `${IDENTITY_PROMPT}

【当前场景：战斗回合叙事润色】
你只负责把既定战斗结果写成更有小说感的回合描述，不得改写胜负、伤害、治疗、死亡、逃跑等事实。
写法要求：
- 禁止写成“你造成X点伤害，敌人反扑造成Y点伤害”的战报模板。
- 不要暴露血量数字、伤害数字、公式、AI、审计、判定等局外词；把数字事实转译为伤势和局势。
- 参考词语：剑光、刀芒、符火、雷纹、灵压、罡风、血雾、护体灵光、法器嗡鸣、衣袍猎猎、碎石飞溅、雨幕、江雾、夜色、经脉震颤、虎口发麻、气血翻涌、破绽一闪、身形错步、贴地掠出、余波震开。
- 参考句法：先写玩家出手的意图和轨迹，再写敌方如何格挡/闪避/反击，最后写伤势、退步、气机变化或战局倾斜。
严格 JSON 输出。`;

  const user = `【角色】${sc.name}，${sc.age}岁，${sc.realmName}
【战斗缘由】${sessionBefore.contextTitle || '战斗'}：${sessionBefore.contextNarrative || '战端已起'}
【对手】${enemy}

【本回合事实】
${rawSummary}

请输出 JSON：
{
  "narrative": "80-180字，修仙小说口吻，画面感强；将伤害和气血变化转写为伤势、气机、护光、步伐和环境反应；不要堆数字，不要改变事实。"
}`;

  try {
    const content = await callLLMText(system, user);
    const raw = parseJSON(content);
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AICombatRoundNarrativeSchema, raw, 'generateCombatRoundNarrative');
    const narrative = String(raw?.narrative || '').trim();
    return narrative ? narrative.slice(0, 260) : round.narrative;
  } catch (err: any) {
    console.error('generateCombatRoundNarrative failed:', err?.message || err);
    return round.narrative;
  }
}

// ==================== 战斗结束叙事生成 ====================

export interface CombatEndResult {
  narrative: string;
  newThreads?: any[];
  completeThreadIds?: string[];
  newItems?: any[];
}

export async function generateCombatEndNarrative(
  ctx: EngineStateContext,
  result: 'victory' | 'defeat' | 'fled',
  enemies: any[],
  drops?: any[],
): Promise<CombatEndResult> {
  const sc = ctx.character;
  const enemyNames = enemies.map(e => e.name).join('、');
  const system = `${IDENTITY_PROMPT}

【当前场景：战斗结束叙事】
战斗刚刚结束，你需要生成战后叙事（80-200字），描述：
1. 战斗结局（${result === 'victory' ? '胜利' : result === 'defeat' ? '败北' : '逃离'}）
2. 战后情境（伤亡、收获、心境变化）
3. 可能的后续影响（如仇敌逃脱会报复、战胜获名望、败北重伤需疗养）
${result === 'victory' && drops?.length ? `4. 战利品获得：${drops.map(d => d.name).join('、')}` : ''}
${result === 'defeat' ? '4. 败北代价：可能重伤、失去物品、声望大跌' : ''}

严格 JSON 输出。`;

  const user = `【状态快照】
角色：${sc.name}，${sc.age}岁，${sc.realmName}
生命：${sc.hp}/${sc.maxHp}  灵力：${sc.mp}/${sc.maxMp}
攻击：${sc.attack}  防御：${sc.defense}  速度：${sc.speed}
灵石：${sc.spiritStones}  声望：${sc.reputation}
所在：${sc.location}

【战斗情况】
对手：${enemyNames}
结局：${result === 'victory' ? '胜利' : result === 'defeat' ? '败北' : '逃离'}
${drops?.length ? `战利品：${drops.map(d => `${d.name}(${d.rarity})`).join('、')}` : '无战利品'}

【未决线索】
${ctx.pendingThreads?.length ? ctx.pendingThreads.map(t => `- ${t.title}（截止 ${t.deadlineAge} 岁）`).join('\n') : '无'}

请生成 JSON：
{
  "narrative": "战后叙事(80-200字，修仙口吻)",
  "newThreads": [],
  "completeThreadIds": [],
  "newItems": []
}

注意：
- 若战胜了 pendingThreads 中的 enemy 类线索，把该线索 id 填入 completeThreadIds
- 若敌人逃脱，可加新线索 {category:"enemy",title:"${enemyNames}逃脱报复",deadlineAge: 当前age+10~30}
- 若有战利品，不要在 newItems 重复给（引擎已应用 drops），仅叙事提及即可`;

  try {
    const content = await callLLMText(system, user);
    const raw = parseJSON(content);
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AICombatEndNarrativeSchema, raw, 'generateCombatEndNarrative');
    return {
      narrative: String(raw?.narrative || `${result === 'victory' ? '胜了' : result === 'defeat' ? '败了' : '脱身了'}`).slice(0, 400),
      newThreads: Array.isArray(raw?.newThreads) ? raw.newThreads : [],
      completeThreadIds: Array.isArray(raw?.completeThreadIds) ? raw.completeThreadIds.map((x: any) => String(x)) : [],
      newItems: Array.isArray(raw?.newItems) ? raw.newItems : [],
    };
  } catch (err: any) {
    console.error('generateCombatEndNarrative failed:', err?.message || err);
    return {
      narrative: result === 'victory' ? '战场归于沉寂，你胜了。' : result === 'defeat' ? '你败下阵来，黯然退去。' : '你转身遁走，避此一劫。',
    };
  }
}
// ==================== 出生事件生成 ====================

// 引擎权威：灵根类型与五行组合由后端按概率随机生成（LLM 不可自由发挥，避免每次重生结果趋同）
// 灵根类型按 rarity 权重抽取（none30/mixed25/common20/pure15/heavenly8/chaos2）

const ALL_ELEMENTS: Element[] = ['metal', 'wood', 'water', 'fire', 'earth'];

function rollSpiritualRoot(): SpiritualRoot {
  const entries = Object.entries(SPIRITUAL_ROOTS) as [SpiritualRoot, { rarity: number }][];
  const total = entries.reduce((s, [, v]) => s + v.rarity, 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) {
    r -= v.rarity;
    if (r <= 0) return k;
  }
  return 'mixed';
}

// 根据灵根类型随机生成五行倾向（哪些元素突出），并返回初始五行数值
// 返回 { elements, picked }：picked 为本次突出的元素列表（用于让 LLM 生成 rootDetail）
function rollElements(root: SpiritualRoot): { elements: Record<Element, number>; picked: Element[] } {
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  switch (root) {
    case 'none':
      // 无灵根：五行都很低
      return { elements: { metal: 8, wood: 8, water: 8, fire: 8, earth: 8 }, picked: [] };
    case 'mixed':
      // 杂灵根：五行皆中等
      return { elements: { metal: 18, wood: 18, water: 18, fire: 18, earth: 18 }, picked: shuffle(ALL_ELEMENTS).slice(0, 5) };
    case 'common': {
      // 凡灵根：2-3 种属性突出
      const count = 2 + Math.floor(Math.random() * 2); // 2 或 3
      const picked = shuffle(ALL_ELEMENTS).slice(0, count);
      const elements: Record<Element, number> = { metal: 8, wood: 8, water: 8, fire: 8, earth: 8 };
      for (const e of picked) elements[e] = 30 + Math.floor(Math.random() * 11); // 30-40
      return { elements, picked };
    }
    case 'pure': {
      // 真灵根：单属性突出
      const picked = shuffle(ALL_ELEMENTS).slice(0, 1);
      const elements: Record<Element, number> = { metal: 5, wood: 5, water: 5, fire: 5, earth: 5 };
      elements[picked[0]] = 50 + Math.floor(Math.random() * 11); // 50-60
      return { elements, picked };
    }
    case 'heavenly': {
      // 天灵根：单属性极突出
      const picked = shuffle(ALL_ELEMENTS).slice(0, 1);
      const elements: Record<Element, number> = { metal: 3, wood: 3, water: 3, fire: 3, earth: 3 };
      elements[picked[0]] = 70 + Math.floor(Math.random() * 11); // 70-80
      return { elements, picked };
    }
    case 'chaos':
      // 混沌灵根：五行皆高
      return { elements: { metal: 45, wood: 45, water: 45, fire: 45, earth: 45 }, picked: shuffle(ALL_ELEMENTS).slice(0, 5) };
    default:
      return { elements: { metal: 18, wood: 18, water: 18, fire: 18, earth: 18 }, picked: [] };
  }
}

// 把元素列表转中文描述（如 ["fire","wood"] → "火木"）
function elementsToZh(els: Element[]): string {
  return els.map(e => ELEMENTS[e].name).join('');
}

export interface BirthResult {
  name: string;
  gender: 'male' | 'female';
  rootDetail: string;
  spiritualRoot: string;
  background: string;
  birthplace: string;
  family: string;
  // 后端 roll 出的五行数值（route 层用来覆盖默认 20/20/20/20/20）
  elements: { metal: number; wood: number; water: number; fire: number; earth: number };
}

const FALLBACK_SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜', '戚', '谢', '邹', '喻', '柏', '水', '竦', '云', '苏', '潘', '葛', '奚', '范', '彭', '郎', '鲁', '韦', '昌', '马', '苗', '凤', '花', '方', '俞', '任', '袍', '柳', '酆', '鲍', '史', '唐', '费', '廉', '岑', '薛', '雷', '贺', '倪', '汤', '滕', '殷', '罗', '毕', '郝', '邶', '安', '常', '乐', '于', '时', '傅', '皮', '卞', '齐', '康', '伍', '余', '元', '卜', '顾', '孟', '平', '黄', '和', '穆', '萧', '尹', '姚', '邵', '湛', '汏', '汪', '祁', '毛', '禹', '狄', '米', '贝', '明', '臧', '计', '伏', '成', '戴', '谈', '宋', '茅', '庞', '熊', '纪', '舒', '屈', '项', '祝', '董', '梁', '杜', '阮', '蓝', '闽', '席', '季', '麻', '强', '贾', '路', '娄', '危', '江', '童', '颜', '郭', '梅', '盛', '林', '刁', '锺', '徐', '丘', '骆', '高', '夏', '蔡', '田', '樊', '胡', '凌', '霍', '虞', '万', '支', '柯', '昝', '管', '卢', '莫', '经', '房', '裘', '缪', '干', '解', '应', '宗', '丁', '宣', '贲', '邓', '郁', '单', '杭', '洪', '包', '诸', '左', '石', '崔', '吉', '钮', '龚', '程', '嵇', '邢', '滑', '裴', '陆', '荣', '罁', '荀', '羊', '於', '惠', '甄', '麹', '家', '封', '芮', '羿', '储', '靳', '汵', '厲', '戎', '祖', '武', '符', '刘', '景', '詹', '束', '龙', '叶', '幸', '司', '韶', '郜', '黎', '蒓', '温', '则'];
const FALLBACK_GIVEN_NAMES = ['青云', '长风', '问尘', '玄微', '知秋', '云舟', '听澜', '照夜', '明河', '归元', '扶摇', '星阑', '映雪', '怀瑾', '清辞', '若虚', '灵均', '无咎', '望川', '听澎', '抱朴', '歸真', '守拙', '昆吾', '渊', '辞', '思殆', '谦和', '淅渊', '泊舱', '珠', '沐雨', '淮安', '望山', '云深', '清挪', '沐逸', '逸尘', '拓', '镶', '峙', '玩', '寒潮', '越石', '望舒'];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateFallbackName(): string {
  return `${pickRandom(FALLBACK_SURNAMES)}${pickRandom(FALLBACK_GIVEN_NAMES)}`;
}

// 轮回带入的遗产条目（与 api/game/new/route.ts 中 previousWorldLegacies 形状对齐）
export interface PreviousWorldLegacy {
  name?: string;
  category?: string;
  type?: string;
  description?: string;
  rarity?: string;
  payload?: any;
  [key: string]: any;
}

/**
 * 从轮回带入的 legacy 列表抽出 LLM 可读的简短描述行。
 * - 仅截取前 N 条避免 token 爆炸
 * - 缺失字段用占位文本，避免 LLM 看到 undefined
 */
function summarizeLegaciesForPrompt(legacies: PreviousWorldLegacy[] | undefined, max = 6): string {
  if (!Array.isArray(legacies) || legacies.length === 0) return '（无轮回带入）';
  const lines: string[] = [];
  for (let i = 0; i < Math.min(legacies.length, max); i++) {
    const it = legacies[i] || {};
    const name = String(it.name || it.payload?.name || `遗物${i + 1}`).slice(0, 16);
    const category = String(it.category || it.type || it.kind || 'unknown').slice(0, 16);
    const desc = String(it.description || it.payload?.description || '前世因果随身之物').slice(0, 80);
    const rarity = String(it.rarity || it.payload?.rarity || 'rare').slice(0, 12);
    lines.push(`${i + 1}. ${name}（${category}/${rarity}）— ${desc}`);
  }
  return lines.join('\n');
}

/**
 * LLM 失败时的兜底：依据 legacy 列表拼一段简短的前世暗示叙事。
 * 每件 legacy 至少给出 1 句暗示（异象 / 直觉 / 巧合），不直说"前世"二字。
 * - 输出约 80-160 字，适合拼到 birth.background 后面
 */
export function buildPreviousLifeBackground(legacies: PreviousWorldLegacy[] | undefined): string {
  if (!Array.isArray(legacies) || legacies.length === 0) return '';

  const hints: string[] = [];
  for (let i = 0; i < legacies.length; i++) {
    const it = legacies[i] || {};
    const name = String(it.name || it.payload?.name || '此物').slice(0, 12);
    const category = String(it.category || it.type || it.kind || '').toLowerCase();
    const desc = String(it.description || it.payload?.description || '').slice(0, 40);

    if (category.includes('scripture') || category.includes('功法') || category.includes('technique')) {
      hints.push(`梦中常有玄奥符文流转，醒时唯余几笔，疑是久远前的手泽。`);
    } else if (category.includes('artifact') || category.includes('法宝') || category.includes('weapon') || category.includes('armor')) {
      hints.push(`此子落地时左掌紧握一缕寒光，似器似刃，父母不敢强取。`);
    } else if (category.includes('pet') || category.includes('灵宠')) {
      hints.push(`伴生有灵物相随，见之者皆言其目光老成，不似初生。`);
    } else if (category.includes('bond') || category.includes('命格') || category.includes('fate')) {
      hints.push(`村中老人偶尔低语："这孩子的命数，似在哪儿见过。"`);
    } else if (desc) {
      hints.push(`襁褓之中偶有异香，似与"${name}"暗合，村人啧啧称奇。`);
    } else {
      hints.push(`此子周岁抓周时，独取那物不放，旁人皆笑。`);
    }
  }

  // 取前 3 条避免 narrative 膨胀
  const picked = hints.slice(0, 3);
  return `降生之夜另有异处：${picked.join(' ') || '似有旧缘未散。'}`;
}

export async function generateBirthEvent(
  name?: string,
  previousWorldLegacies?: PreviousWorldLegacy[],
  origin?: OriginRoll,
): Promise<BirthResult> {
  // 1. 引擎权威：后端先 roll 灵根类型和五行组合（LLM 不可自由发挥）
  const root = rollSpiritualRoot();
  const { elements, picked } = rollElements(root);
  const rootInfo = SPIRITUAL_ROOTS[root];
  const pickedZh = elementsToZh(picked);
  const seededName = name && name.trim() ? name.trim() : generateFallbackName();
  const hasLegacies = Array.isArray(previousWorldLegacies) && previousWorldLegacies.length > 0;
  const legacyBlock = hasLegacies ? summarizeLegaciesForPrompt(previousWorldLegacies, 6) : '';
  // 族裔 / 出身 / 伴生灵物 / 封印命格（若未传入则后端 roll）
  const effectiveOrigin: OriginRoll = origin || rollOrigin({});
  const originBlock = buildOriginPrompt(effectiveOrigin);

  // 给 LLM 的灵根类型说明 + 已确定的五行组合
  const rootTypeHint: Record<SpiritualRoot, string> = {
    none: '无灵根（与修行无缘，五行皆弱）',
    mixed: `五行杂灵根（金木水火土皆有，无突出）`,
    common: `凡灵根（突出属性：${pickedZh}）`,
    pure: `真灵根（单属性突出：${pickedZh}）`,
    heavenly: `天灵根（单属性极突出：${pickedZh}，天赐之资）`,
    chaos: '混沌灵根（五行皆强，亘古难寻）',
  };

  const system = `${IDENTITY_PROMPT}

【当前场景：角色出生】
生成一名修仙主角的出生背景。要求：
- 姓名：${name ? `玩家指定「${name}」，请采用并补充姓氏（若只有名）` : `请以「${seededName}」作为主角姓名，或在保持古风的前提下微调。姓氏应参照百家姓广泛选取，不要总是重复「沈」「苏」「林」「陆」等少数姓氏，也不要反复使用「砸」等同一单字`}。
- 性别：随机 male 或 female。
- 灵根：已由天道判定为「${rootInfo.name}」，灵根详情请基于以下信息生成：${rootTypeHint[root]}。
- 灵根详情 rootDetail 格式：如"${pickedZh}凡灵根"、"${pickedZh}真灵根"、"五行杂灵根"、"无灵根"、"${pickedZh}天灵根"、"混沌灵根"。必须与上述灵根类型和突出属性一致。
${originBlock}
- 出生地：修仙世界地点（如"青云山下一处凡人村落"、"东海之滨渔村"、"北荒边陲小镇"等），需与族裔/出身契合。
- 家世：凡人家庭/落魄修士之后/书香门第/农户/猎户/商户等。尽量选择**非农非猎户**的家庭（如落魄散修之后/书香门第/前朝遗族/边境驿丞/退隐老兵/药商/故旧之后等），增加家世多样性；若出身为妖族/巫族/羽族/海族/灵族，请按其族裔特征描写（妖族可能带鳞片/角/异瞳，巫族可能带纹身/灵巫之力）。
- 背景：100-200字描写出生时的情境、天象、家世氛围，可暗示灵根特征（如天灵根降生时有异象）。若附带伴生灵物，请叙述其来历（胎里带来/出生异象/父母遗物）；若附带先天封印/命格，请暗示角色被封印的特殊命格与解封契机。
${hasLegacies ? `
【前世因果——必须遵守】
天道传入 previousWorldLegacies（轮回带入），你必须为每件遗产生成前世故事，并在 narrative 中自然呈现：
- 前世身份（如"前朝剑修/边陲小派掌门/灭门遗孤/散修/魔门弃徒/坊市老药师/洞府守墓人..."）
- 死亡原因（如"渡劫失败/被人暗算/与敌同归于尽/寿终正寝/坐化/为护弟子而亡/心魔反噬..."）
- 携带物品来历（与前世身份/死亡原因挂钩，不要凭空出现；物品自带"旧主残意"）
- 残留执念（如"未竟的仇怨/未修成的功法/未能相守的人/未了的心愿/未找到的真相"）
- 与今生的巧合（如"转世投到仇人村/父母是前世旧识/灵根与前世功法契合/幼时常做同一个梦/家乡地名与前世山门相近"）
- 前世故事在 narrative 中要**自然暗示**（不要直接说"前世"二字，用巧合/直觉/梦境/旧物相认/老人隐约低语/出生异象等方式呈现）
- 必须给主角安排**至少 2-3 处与前世相关的小细节**（异象/直觉/巧合/梦中声音/老物相认），分散嵌在背景叙事中
- legacy 在 narrative 中可以是"父母口中传下来的旧物/梦中反复出现的符号/周岁抓周时独取之物/邻家老者一句嘀咕"，避免直白叙述
` : ''}
严格 JSON 输出。`;

  const user = `请生成主角出生信息 JSON：
{
  "name": "姓名",
  "gender": "male|female",
  "rootDetail": "灵根详情（必须符合：${rootInfo.name}，突出属性：${pickedZh || '无'}）",
  "birthplace": "出生地",
  "family": "家世（10-30字）",
  "background": "出生背景叙事（100-200字）"
}

注意：不要输出 spiritualRoot 字段，灵根类型已由天道判定为「${root}」，你只需生成对应的 rootDetail 文字描述。${hasLegacies ? `

【前世带入（previousWorldLegacies）—— 必须落实到 narrative】
以下为天道传入的轮回带入清单（最多 6 件）：
${legacyBlock}

要求：
- 在 narrative 中**自然呈现前世因果**（前面原则）
- 至少 2-3 处与前世相关的小细节（异象/直觉/巧合/梦中声音/老物相认/老人低语）
- legacy 在 narrative 中用暗示方式嵌入（不要罗列、不要直接说"前世"二字）
- 每件 legacy 至少对应 1 处暗示（物品来历 / 旧主残意 / 与今生的巧合）` : ''}`;

  // AI-61: 在出生事件 user prompt 注入 L1 世界观知识
  const worldKnowledge = await loadWorldKnowledge();

  try {
    const content = await callLLMText(system, user + worldKnowledge);
    const raw = parseJSON(content);
    // TechDoc 18.6.5：post-parse zod schema 健康检查
    postParseSchemaCheck(AIBirthSchema, raw, 'generateBirthEvent');
    return {
      name: String(raw.name || name || '佚名').slice(0, 12),
      gender: raw.gender === 'female' ? 'female' : 'male',
      // 灵根类型来自后端 roll，不信任 LLM 输出
      spiritualRoot: root,
      rootDetail: String(raw.rootDetail || `${rootInfo.name}`).slice(0, 40),
      birthplace: String(raw.birthplace || '凡间一村落').slice(0, 50),
      family: String(raw.family || '凡人家庭').slice(0, 50),
      background: String(raw.background || '降生于凡间').slice(0, 600),
      elements,
    };
  } catch (err) {
    console.error('Birth generation failed:', err);
    // fallback：仍使用后端 roll 的结果，保证灵根随机性；按族裔/出身选模板，如有轮回带入拼前世暗示
    const previousLifeHint = buildPreviousLifeBackground(previousWorldLegacies);
    const originFallback = buildFallbackBackground(effectiveOrigin);
    const fallbackFamily = hasLegacies ? '没落散修之后' : originFallback.family;
    const fallbackBirthplace = hasLegacies ? '旧朝故地一处山中村落' : originFallback.birthplace;
    const companionHint = effectiveOrigin.companionItems.length
      ? `生而伴有${effectiveOrigin.companionItems.map((c) => c.name).join('、')}。`
      : '';
    const sealedHint = effectiveOrigin.sealedFate
      ? `命数另有异处：${effectiveOrigin.sealedFate.name}，${effectiveOrigin.sealedFate.unlockHint}`
      : '';
    const fallbackBackground = hasLegacies
      ? `${originFallback.background}${companionHint}${sealedHint}${previousLifeHint}`
      : `${originFallback.background}${companionHint}${sealedHint}`;
    return {
      name: name?.trim() || generateFallbackName(),
      gender: Math.random() > 0.5 ? 'male' : 'female',
      spiritualRoot: root,
      rootDetail: root === 'none'
        ? '无灵根'
        : pickedZh
          ? `${pickedZh}${rootInfo.name}`
          : rootInfo.name,
      birthplace: fallbackBirthplace,
      family: fallbackFamily,
      background: fallbackBackground,
      elements,
    };
  }
}
