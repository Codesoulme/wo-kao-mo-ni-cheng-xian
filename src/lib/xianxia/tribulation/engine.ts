// 沉浸版 PoC：雷劫判定引擎（纯函数 + 修仙常识概率 + LLM narrative hooks）。
// Phase-α 批 1 α-1：仅 PoC 范围——不写 DB，由调用方负责持久化。
//
// 设计原则：
// - 纯函数：输入 → 输出，不依赖 db / store / 路由。
// - 修仙常识概率（凡人修仙 / 诛仙参考）：
//   - 金丹→元婴 30% 陨落 / 10% 降境 / 20% 重伤 / 40% 淬体成功
//   - 元婴→化神 50% 陨落 / 10% 降境 / 20% 重伤 / 20% 淬体成功
//   - 凡人→炼气 / 炼气→筑基 / 筑基→金丹 陨落概率 0-15%，主体成功
// - 修正项：
//   - hpRatio < 0.3 → +20% fatal 概率（强约束：气血不足硬脆）
//   - heartDemon > 70 → +15% fatal（强约束：心魔深重）
//   - soulStrength > 70 → +10% success 概率（神识强易渡劫）
//   - hasBondedArtifact → +10% success（法宝护主）
//   - hasTribulationPill → -10% fatal（丹药兜底）
// - narrativeHooks：根据 outcome + cause + character 生成 3-5 条叙事钩子，给 LLM 润色用。

import {
  TRIBULATION_PROFILES,
  type TribulationInput,
  type TribulationResult,
  type NarrativeHook,
  type TribulationOutcome,
  type TribulationProfile,
  realmToMajor,
} from './types';

// ==================== 概率配置（修仙常识）====================

/**
 * BASE_PROBABILITIES: 目标境界 -> 基础四档概率(百分比, 和为 100)。
 *
 * 2026-08-31 三处改动:
 *   1. 键的语义从「起始境界」改成「突破到哪个境界」, 与取值方式对齐。
 *      原表注释写的是「筑基 -> 金丹」却挂在 foundation 键上, 而取值用的是目标境界,
 *      于是突破到筑基的人吃了本该给金丹的那一行, 整体错行一位。
 *   2. 按本主 2026-08-31 的要求, 每一档陨落各加 10 个点, 成功各减 10 个点。
 *      「元婴突破到化神再低一点, 前后境界也是」——落到表上就是 spirit_severing 一行
 *      成功 20 减到 10、陨落 50 抬到 60, 其余各行同幅平移。
 *   3. 补齐大乘 / 渡劫 / 飞升三行。此前这三个境界连键都没有, 顶上三次大突破整段无劫。
 *      这三行的数是照难度梯度续的, 未经玩法定夺, 要调直接改这里。
 */
interface BaseProbabilities {
  success: number;
  fall_realm: number;
  severe: number;
  fatal: number;
}

/**
 * TRIBULATION_FATAL_KILLS: 陨落是否真判死。
 *
 * 2026-08-31: 结果落地这一步接通时, 生死曲线本主尚未定夺, 故先关着闸门——
 * outcome 为 fatal 时角色落到濒死一线(气血 1)而不身死道消。
 * 要开真死亡把这里改 true, 一处改完全局生效; 回归里也盯着这个常量,
 * 免得哪天被顺手翻开却没人知道。
 */
export const TRIBULATION_FATAL_KILLS = false;

/** 渡劫辅助丹药的名目特征。物名由模型注册, 引擎只据名目做事实校验, 与本命法宝同一路数。 */
export const TRIBULATION_PILL_PATTERN = /渡劫|渡厄|护心|保命|化劫|抗雷|避雷/;

export const BASE_PROBABILITIES: Record<string, BaseProbabilities> = {
  // 无人突破到凡人; 占位保覆盖。
  mortal:          { success: 100, fall_realm: 0,  severe: 0,  fatal: 0 },
  // 凡人 -> 炼气: 几乎稳成, 偶有走火。
  qi_refining:     { success: 75,  fall_realm: 0,  severe: 15, fatal: 10 },
  // 炼气 -> 筑基: 开始有跌境。
  foundation:      { success: 60,  fall_realm: 15, severe: 13, fatal: 12 },
  // 筑基 -> 金丹: 雷火初临。
  golden_core:     { success: 45,  fall_realm: 20, severe: 18, fatal: 17 },
  // 金丹 -> 元婴: 陨落已成常事。
  nascent_soul:    { success: 30,  fall_realm: 10, severe: 20, fatal: 40 },
  // 元婴 -> 化神: 全程最险的一关。
  spirit_severing: { success: 10,  fall_realm: 10, severe: 20, fatal: 60 },
  // 化神 -> 大乘: 净胜已无, 全靠带伤过关。
  great_vehicle:   { success: 0,   fall_realm: 5,  severe: 25, fatal: 70 },
  // 大乘 -> 渡劫期。
  tribulation:     { success: 0,   fall_realm: 5,  severe: 25, fatal: 70 },
  // 渡劫期 -> 飞升。
  ascension:       { success: 0,   fall_realm: 5,  severe: 25, fatal: 70 },
};

/**
 * clampProb：把概率夹在 [0, 1] 区间，且所有四项概率之和归一为 1。
 */
function normalizeProbs(probs: BaseProbabilities): BaseProbabilities {
  const total = probs.success + probs.fall_realm + probs.severe + probs.fatal;
  if (total === 0) return { success: 1, fall_realm: 0, severe: 0, fatal: 0 };
  return {
    success: probs.success / total,
    fall_realm: probs.fall_realm / total,
    severe: probs.severe / total,
    fatal: probs.fatal / total,
  };
}

/**
 * applyModifiers: 按角色状态修正基础概率。
 *
 * 2026-08-31: 单位对齐。底表是百分数(成功 30 表示三成), 而这里的修正项原本写成小数——
 * 「气血不足陨落 +20%」落到代码里是 fatal += 0.20, 加在 30 上变 30.2。
 * 实测裸身与「神识满 + 本命法宝 + 渡劫丹」齐备两组分布完全重合, 残血带心魔也照旧,
 * 五条修正项一条都没在生效。现统一改成百分点。
 * 返回值未归一, 由 normalizeProbs 收口。
 */
function applyModifiers(base: BaseProbabilities, input: TribulationInput): BaseProbabilities {
  const adjusted = { ...base };
  // 气血不足: 硬脆, 陨落大涨。
  if (input.hpRatio < 0.3) {
    adjusted.fatal += 20;
    adjusted.success -= 10;
    adjusted.fall_realm -= 5;
    adjusted.severe -= 5;
  }
  // 心魔深重: 内劫先溃。
  if (input.heartDemon > 70) {
    adjusted.fatal += 15;
    adjusted.success -= 10;
    adjusted.fall_realm -= 3;
    adjusted.severe -= 2;
  }
  // 神识强盛: 守得住神魂。
  if (input.soulStrength > 70) {
    adjusted.success += 10;
    adjusted.fatal -= 5;
    adjusted.fall_realm -= 2;
    adjusted.severe -= 3;
  }
  // 本命法宝: 器灵护主。
  if (input.hasBondedArtifact) {
    adjusted.success += 10;
    adjusted.fatal -= 5;
    adjusted.fall_realm -= 3;
    adjusted.severe -= 2;
  }
  // 渡劫丹: 保命而已, 换来的是重伤而非身死。
  if (input.hasTribulationPill) {
    adjusted.fatal -= 10;
    adjusted.success += 5;
    adjusted.severe += 3;
    adjusted.fall_realm += 2;
  }
  // 下界保护: 任何一项不能为负。
  adjusted.success = Math.max(0, adjusted.success);
  adjusted.fall_realm = Math.max(0, adjusted.fall_realm);
  adjusted.severe = Math.max(0, adjusted.severe);
  adjusted.fatal = Math.max(0, adjusted.fatal);
  return adjusted;
}

/**
 * rollOutcome：根据概率抽取 outcome。
 * 用确定性 hash 模拟 random（PoC 阶段：让 smoke 可重现）。
 */
function rollOutcome(probs: BaseProbabilities, seed: string): TribulationOutcome {
  // 简单 hash：字符 ASCII 之和 mod 10000 → 0-1
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = (h % 10000) / 10000;
  let cum = 0;
  cum += probs.success;
  if (r < cum) return 'success';
  cum += probs.fall_realm;
  if (r < cum) return 'fall_realm';
  cum += probs.severe;
  if (r < cum) return 'severe';
  return 'fatal';
}

// ==================== 主函数：attemptTribulation ====================

/**
 * attemptTribulation：渡劫判定主函数（纯函数）。
 * - 输入：TribulationInput
 * - 输出：TribulationResult（包含 outcome + cause + narrativeHooks）
 * - 副作用：无（不写 DB，不改 state）
 *
 * 调用方负责：
 * - 根据 outcome 写状态（境界变更 / 气血调整 / alive 标记）
 * - 通过 appendEvent 落 character.tribulation.attempted 事件
 * - 把 narrativeHooks 喂给 LLM 生成叙事
 */
export function attemptTribulation(input: TribulationInput): TribulationResult {
  // 2026-08-31: 先把目标境界归到权威键, 再查表。
  //   原先两张表都拿原始字符串直接取键, 于是 deity_transformation / soul_formation /
  //   mahayana / immortal 这些旧写法一律查不着 —— 落进下面的降级分支, 成功且无劫。
  //   realmToMajor 本来就是为这件事写的, 之前根本没在这里用上。
  const realmKey = realmToMajor(input.targetRealm);
  const profile: TribulationProfile | undefined = realmKey ? TRIBULATION_PROFILES[realmKey] : undefined;
  if (!profile) {
    // 目标境界不在 PoC 映射表内——返回降级结果（成功但无叙事）。
    return {
      outcome: 'success',
      cause: `${input.targetRealm} 不在 PoC 渡劫表内，跳过判定`,
      hpDelta: 0,
      narrativeHooks: [],
      kind: 'heart_demon',
      difficulty: 0,
    };
  }

  const base = BASE_PROBABILITIES[realmKey!] || { success: 80, fall_realm: 5, severe: 10, fatal: 5 };
  const adjusted = applyModifiers(base, input);
  const normalized = normalizeProbs(adjusted);

  // 种子 = characterId + targetRealm + age + 输入参数拼接，保证同一输入 → 同一结果（PoC 可重现）
  const seed = [
    input.character.id,
    input.targetRealm,
    input.character.age,
    Math.round(input.hpRatio * 100),
    input.soulStrength,
    input.heartDemon,
    input.hasBondedArtifact ? '1' : '0',
    input.hasTribulationPill ? '1' : '0',
  ].join('|');
  const outcome = rollOutcome(normalized, seed);

  // 计算 hpDelta
  let hpDelta: number;
  switch (outcome) {
    case 'success': hpDelta = -10; break;   // 成功也耗气血（淬体代价）
    case 'severe':  hpDelta = -60; break;
    case 'fall_realm': hpDelta = -40; break;
    case 'fatal':   hpDelta = -100; break;   // 陨落 hp=0
  }

  // 计算 cause
  const cause = deriveCause(outcome, input, profile);

  // 生成 narrative hooks
  const hooks = buildNarrativeHooks(outcome, input, profile);

  return {
    outcome,
    cause,
    hpDelta,
    narrativeHooks: hooks,
    kind: profile.kind,
    difficulty: profile.difficulty,
  };
}

/**
 * deriveCause：根据 outcome + 输入推导叙事归因。
 * 简单字符串拼接，调用方可改写。
 */
function deriveCause(outcome: TribulationOutcome, input: TribulationInput, profile: TribulationProfile): string {
  const target = input.targetRealm;
  const hp = Math.round(input.hpRatio * 100);
  const reasons: string[] = [];
  if (input.hpRatio < 0.3) reasons.push(`气血仅余${hp}%`);
  if (input.heartDemon > 70) reasons.push(`心魔深重(${input.heartDemon})`);
  if (input.soulStrength > 70) reasons.push(`神识坚定(${input.soulStrength})`);
  if (input.hasBondedArtifact) reasons.push('本命法宝共鸣');
  if (input.hasTribulationPill) reasons.push('渡劫丹药护体');

  const reasonSuffix = reasons.length ? `（${reasons.join('、')}）` : '';
  switch (outcome) {
    case 'success':
      return `${profile.description} 渡${target}劫成功，淬体凝神${reasonSuffix}`;
    case 'severe':
      return `${profile.description} 渡劫重伤${reasonSuffix}`;
    case 'fall_realm':
      return `${profile.description} 渡劫失败，跌落境界${reasonSuffix}`;
    case 'fatal':
      return `${profile.description} 渡劫陨落${reasonSuffix}`;
  }
}

/**
 * buildNarrativeHooks：根据 outcome 生成 3-5 条 narrative hooks。
 * 每条 hook 含 category（setting/emotion/action/aftermath）+ text + weight（1-3）。
 */
function buildNarrativeHooks(
  outcome: TribulationOutcome,
  input: TribulationInput,
  profile: TribulationProfile
): NarrativeHook[] {
  const hooks: NarrativeHook[] = [];
  const target = input.targetRealm;
  const kindText = kindToChinese(profile.kind);

  // 通用 setting hook
  hooks.push({
    category: 'setting',
    text: `${kindText}降临，天地色变，${input.character.name}立于山巅。`,
    weight: 2,
  });

  // outcome 专属 hooks
  switch (outcome) {
    case 'success':
      hooks.push({
        category: 'emotion',
        text: '识海澄澈如镜，天道之音在耳畔回响。',
        weight: 3,
      });
      hooks.push({
        category: 'action',
        text: '灵台重聚，肉身淬炼如新，灵力流转间境界跃升。',
        weight: 2,
      });
      hooks.push({
        category: 'aftermath',
        text: `${target}境界稳固，寿元大涨。`,
        weight: 1,
      });
      break;
    case 'severe':
      hooks.push({
        category: 'emotion',
        text: '天雷灌体，五脏六腑俱震，识海几近崩溃。',
        weight: 3,
      });
      hooks.push({
        category: 'action',
        text: '本命法宝嗡鸣护主，勉强护住心脉。',
        weight: 2,
      });
      hooks.push({
        category: 'aftermath',
        text: '境界虽保，却需闭关数年修养。',
        weight: 1,
      });
      break;
    case 'fall_realm':
      hooks.push({
        category: 'emotion',
        text: '丹田中传来裂帛之声，灵力急速溃散。',
        weight: 3,
      });
      hooks.push({
        category: 'action',
        text: '跌落境界的瞬间，识海中闪过前尘往事。',
        weight: 2,
      });
      hooks.push({
        category: 'aftermath',
        text: '虽未身死道消，却元气大伤。',
        weight: 1,
      });
      break;
    case 'fatal':
      hooks.push({
        category: 'emotion',
        text: '天雷贯穿识海，往事如走马灯般闪过。',
        weight: 3,
      });
      hooks.push({
        category: 'action',
        text: '肉身在天劫下寸寸崩解，神魂亦随之消散。',
        weight: 3,
      });
      hooks.push({
        category: 'aftermath',
        text: '一世修行，化作尘埃。',
        weight: 2,
      });
      break;
  }

  return hooks;
}

/**
 * kindToChinese：劫型 → 中文描述（供 narrative hook 使用）。
 */
function kindToChinese(kind: string): string {
  switch (kind) {
    case 'heart_demon': return '心魔劫';
    case 'thunder_fire': return '雷火劫';
    case 'celestial_omen': return '天象劫';
    case 'heart_fire': return '心火劫';
    default: return '天劫';
  }
}

// ==================== pickNarrativeHooks：把 hooks 翻译成 LLM prompt 字符串 ====================

/**
 * pickNarrativeHooks：把 TribulationResult.narrativeHooks 列表拼成单行 prompt 字符串。
 * - 按 weight 降序排序
 * - 总字符数不超过 charLimit
 * - 格式：`[setting] xxx [emotion] yyy ...`
 *
 * PoC 阶段简单实现：按 weight 排序后累加，截断到 charLimit。
 */
export function pickNarrativeHooks(result: TribulationResult, charLimit: number = 600): string {
  const sorted = [...result.narrativeHooks].sort((a, b) => b.weight - a.weight);
  const parts: string[] = [];
  let total = 0;
  for (const h of sorted) {
    const piece = `[${h.category}] ${h.text}`;
    if (total + piece.length + 1 > charLimit) break;
    parts.push(piece);
    total += piece.length + 1;
  }
  return parts.join(' ');
}

// ==================== 探针（smoke 用）====================

/**
 * _tribulationVersion：返回引擎版本字符串（供 smoke import 校验）。
 */
export function _tribulationVersion(): string {
  return 'tribulation-poc-α-1';
}