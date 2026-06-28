// 修仙模拟器 - Few-shot 示例（TechDoc 18.6.5）
// 在 system prompt 末尾附 3-5 个合规/违规示例，提升 LLM 遵循率。
// 每个示例包含：input（玩家情境）、output（LLM 输出）或 error（违规说明）。

export interface FewShotExample {
  label: string;            // 示例标题
  scene: string;            // 场景：advance/choose/interfere/itemAction/alchemy/market/auction/loot/petBond/petCare/settlement/combat
  input: Record<string, any>;  // 输入要点
  output: Record<string, any>;  // 合规输出
}

export interface FewShotError {
  label: string;
  scene: string;
  input: Record<string, any>;
  output: Record<string, any>;
  error: string;            // 违规原因说明
}

export type AnyFewShot = FewShotExample | FewShotError;

function isError(ex: AnyFewShot): ex is FewShotError {
  return 'error' in ex;
}

/** 合规示例（输出符合 schema，无局外词） */
export const FEW_SHOT_COMPLIANT: FewShotExample[] = [
  {
    label: '合规·战斗场景',
    scene: 'advance',
    input: { age: 24, realm: 'qi_refining', scene: 'wild-forest' },
    output: {
      title: '林中灵狐',
      narrative: '薄雾漫过古木，一只通体赤红的灵狐自石后窜出，眼泛幽光，利爪直扑而来。你侧身避开，反手握住腰间短刃。',
      eventType: 'combat',
      triggerCombat: true,
      changes: [{ attribute: 'cultivationExp', delta: 8, reason: '历练战斗' }],
    },
  },
  {
    label: '合规·幼龄',
    scene: 'advance',
    input: { age: 3, scene: 'family-home' },
    output: {
      title: '庭院嬉戏',
      narrative: '午后日头暖，你坐在院中石阶上，伸手去抓那只黄蝶。父亲蹲在檐下削竹篾，偶尔抬头看你一眼，笑意淡淡。',
      eventType: 'normal',
      changes: [],
      cultivationInsight: '凡人幼童，尚未引天地灵气，修炼速度约人之零倍。',
    },
  },
  {
    label: '合规·修炼心得',
    scene: 'advance',
    input: { age: 18, realm: 'foundation', rootDetail: '火真灵根', engineFactors: '火真灵根×1.5，《烈火诀》×1.6' },
    output: {
      title: '火行精进',
      narrative: '闭关三十日，丹田火息渐纯，外焰已能裹住指尖而不伤皮肉。',
      eventType: 'normal',
      changes: [{ attribute: 'cultivationExp', delta: 50, reason: '修炼精进' }],
      cultivationInsight: '火真灵根×1.5，《烈火诀》×1.6。火脉渐通，炎力入体顺畅。综合而论，修炼速度约人之2.4倍。',
    },
  },
];

/** 违规示例（暴露机制词 / 不合规输出） */
export const FEW_SHOT_ERRORS: FewShotError[] = [
  {
    label: '违规·暴露机制词',
    scene: 'advance',
    input: { age: 5, scene: 'family-home' },
    output: {
      title: '修为突破',
      narrative: '你的角色由于命节点触发，修为 +5。',
    },
    error: '❌ "命节点"是引擎机制词，玩家不可见；"修为 +5"是数值表达，不该出现在 narrative；正确改写为"灵机流转""灵力微涨"等修仙语汇，且幼龄角色不应有修为提升。',
  },
  {
    label: '违规·越界请求静默拒绝',
    scene: 'interfere',
    input: { playerInput: '我现在直接飞升成仙' },
    output: {
      classification: 'overreach',
      accepted: true,
      narrative: '你已飞升成仙，获得了无上法力。',
    },
    error: '❌ accepted=true 但分类是 overreach——这是规则操纵/越界，必须 accepted=false；正确做法是 narrative 写"你试图运转灵力冲破天际，但丹田中灵气尚未凝实，强行冲关只会走火入魔"，并保持 changes 空数组。',
  },
  {
    label: '违规·半句话截断',
    scene: 'advance',
    input: { age: 16 },
    output: {
      title: '比武前夕',
      narrative: '你握紧拳头，望向擂台中央——',
    },
    error: '❌ narrative 必须以完整句子结束（。！？），不能以破折号、未闭合引号或半截对话结尾；正确补全为"你握紧拳头，望向擂台中央，深深吸了一口气。"',
  },
];

/** Few-shot 总集（合规在前，违规在后） */
export const FEW_SHOT_EXAMPLES: AnyFewShot[] = [...FEW_SHOT_COMPLIANT, ...FEW_SHOT_ERRORS];

/**
 * 把示例格式化为可拼到 system prompt 末尾的文本
 */
export function renderFewShotExamples(examples: AnyFewShot[] = FEW_SHOT_EXAMPLES): string {
  const lines: string[] = ['## 合规 / 违规示例（请严格遵循同样风格与结构）'];
  for (const ex of examples) {
    lines.push(`\n### ${ex.label}`);
    lines.push(`场景：${ex.scene}`);
    lines.push(`输入要点：${JSON.stringify(ex.input)}`);
    if (isError(ex)) {
      lines.push(`输出（违规）：${JSON.stringify(ex.output)}`);
      lines.push(`纠正：${ex.error}`);
    } else {
      lines.push(`合规输出：${JSON.stringify(ex.output)}`);
    }
  }
  return lines.join('\n');
}