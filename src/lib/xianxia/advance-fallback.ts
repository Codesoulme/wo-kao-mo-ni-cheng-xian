/**
 * 智能 Fallback 引擎
 *
 * 当 AI 接口失败时，从该角色历史 AI 生成的文本中抽取元素，组合出"类 AI 续写"的叙事。
 * 核心策略：
 *  1. 叙事元素抽取：地点、NPC、未结线索、语气样本
 *  2. 同岁变体：取该角色前 N 岁的 AI 文本做改写
 *  3. 轻量句式变异：替换姓名/地点、加语气词
 *  4. 年龄守门：6 岁以下强制走幼童分支，不复用历史模板
 *  5. 模板兜底：无历史时用通用模板
 */

type HistoricalEvent = {
  age: number;
  title: string;
  narrative: string;
  eventType?: string;
};

type StoryElements = {
  recentLocations: string[];
  recentNpcs: string[];
  recentThreads: string[];
  styleSample: string;
  sameAgeVariants: string[];
};

type FallbackOptions = {
  recentEvents?: HistoricalEvent[];
};

const NPC_HINT_RE = /(?:[一-龥]{2,4})(?:老翁|老妪|老者|姑娘|小子|掌柜|师兄|师姐|师弟|师妹|师尊|长老|前辈|道友|师傅|师父|师叔|师妹|居士|散修|剑客|书生|樵夫|渔夫|药农|村妇|老汉|老者|老叟|老妪|娃儿|孩童|小儿|丫头|少年|少女|青年|中年|大汉|莽汉|老道|老僧)/g;
const LOCATION_HINT_RE = /(?:在|去|至|往|至|赴|抵|回到|回|出|从|于|路过|途径|走至|走到|进入|入|来到|赶至|驻足于|暂居于|留在)([一-龥]{2,8}(?:山|峰|谷|镇|村|城|坊|阁|楼|寺|观|洞|府|庄|院|铺|摊|门|堂|店|渡|桥|路|溪|江|湖|海|岭|崖|壁|岩|坡|渡口|山口|山脚|山下|山腰|山顶|林|林间|林中|林外|林边|林深|山野|山间|荒原|草原|平原|山坳|山腹|洞府|秘境|荒地|荒村|荒郊|野地|野店|客店|客栈|茶棚|茶楼|酒肆|酒馆|赌坊|勾栏|青楼|市集|集市|坊市|仙门|宗门|门派|洞府|宝库|禁地|山门|殿|殿中|大殿|前殿|后殿|内殿|外殿|偏殿|洞中|洞内|洞外|洞外|洞边|洞外|洞口|洞口处|洞口旁|山谷|谷中|谷内|谷外|谷边|谷底|山巅|山腰|山脚|山脚处|山脚旁|山腰处|山腰旁|山巅处|山巅旁|山脚边|山腰间|山腰间|山巅旁|山巅边))/g;
const THREAD_KEYWORDS = /(?:约定|欠下|许诺|承诺|记账|挂念|惦记|挂心|还欠|待办|未了|未完|日后|将来|他日|改日|明日|明日再|明日还|明年|明年再|三月后|三月之后|数月后|数月之后|半年后|半年之后|一年后|一年之后|待|欠|约)/;

function extractStoryElements(events: HistoricalEvent[]): StoryElements {
  if (events.length === 0) {
    return { recentLocations: [], recentNpcs: [], recentThreads: [], styleSample: '', sameAgeVariants: [] };
  }

  const locationCount = new Map<string, number>();
  const npcCount = new Map<string, number>();
  const threads: string[] = [];
  const samples: string[] = [];

  for (const evt of events) {
    const text = `${evt.title || ''} ${evt.narrative || ''}`;
    if (!text) continue;

    // 抽地点
    let m: RegExpExecArray | null;
    const locRe = new RegExp(LOCATION_HINT_RE.source, 'g');
    while ((m = locRe.exec(text)) !== null) {
      const loc = m[1];
      if (loc && loc.length >= 2) {
        locationCount.set(loc, (locationCount.get(loc) || 0) + 1);
      }
    }

    // 抽 NPC
    const npcRe = new RegExp(NPC_HINT_RE.source, 'g');
    while ((m = npcRe.exec(text)) !== null) {
      const npc = m[0];
      if (npc && npc.length >= 2) {
        npcCount.set(npc, (npcCount.get(npc) || 0) + 1);
      }
    }

    // 抽未结线索
    if (THREAD_KEYWORDS.test(text)) {
      const sentence = text.split(/[，。；！？]/).find(s => THREAD_KEYWORDS.test(s));
      if (sentence && sentence.length <= 40) threads.push(sentence.trim());
    }

    // 收集句式样本
    if (evt.narrative && evt.narrative.length >= 30 && evt.narrative.length <= 200) {
      samples.push(evt.narrative);
    }
  }

  // 取出现 ≥2 次的地点/NPC（更稳定）
  const recentLocations = [...locationCount.entries()]
    .filter(([_, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([loc]) => loc);
  const recentNpcs = [...npcCount.entries()]
    .filter(([_, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([npc]) => npc);

  const styleSample = samples.length > 0
    ? samples[Math.floor(Math.random() * Math.min(samples.length, 5))]
    : '';

  return {
    recentLocations,
    recentNpcs,
    recentThreads: threads.slice(0, 3),
    styleSample,
    sameAgeVariants: [],
  };
}

function findSameAgeVariants(events: HistoricalEvent[], currentAge: number, range = 2): string[] {
  return events
    .filter(e => Math.abs(e.age - currentAge) <= range && e.narrative)
    .map(e => e.narrative)
    .filter(n => n.length >= 20 && n.length <= 250)
    .slice(0, 3);
}

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// 轻量变体函数：替换姓名/地点，加句末语气词
function remixNarrative(original: string, swaps: Record<string, string>): string {
  let result = original;
  for (const [from, to] of Object.entries(swaps)) {
    if (from && to && from !== to) {
      result = result.split(from).join(to);
    }
  }
  // 简单句式变异：随机加一句衔接
  return result;
}

export function buildFallbackAgeEvent(state: any, blueprint: any, ctx: any, isFateNode: boolean, options: FallbackOptions = {}) {
  const place = state.location || '暂居之地';
  const age = state.age;
  const rate = Number(ctx?.cultivationRate?.finalRate || state.cultivationMultiplier || 1) || 1;
  const baseGain = Math.max(5, Math.round(8 * rate));
  const seed = Math.abs((age * 37) + String(state.id || state.name || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0));
  const realmName = ctx?.character?.realmName || '炼气';
  const recentEvents = options.recentEvents || [];
  const storyElements = extractStoryElements(recentEvents);
  const sameAgeVariants = findSameAgeVariants(recentEvents, age);

  const combatNames = ['邪修截杀', '妖兽搏杀', '夺宝大战', '擂台比武'];
  const isCombatBlueprint = blueprint?.category === 'combat' || combatNames.some(name => String(blueprint?.name || '').includes(name));

  // ===== 战斗分支 =====
  if (isCombatBlueprint) {
    const isBeast = String(blueprint?.name || '').includes('妖兽');
    const isArena = String(blueprint?.name || '').includes('擂台');
    const enemyName = isBeast ? '山魈妖兽' : isArena ? '擂台对手' : '蒙面邪修';
    const npcFlavor = pickRandom(storyElements.recentNpcs) || '';
    const enemyDesc = isBeast
      ? `盘踞在${place}外山林的低阶妖兽，爪牙带腥，畏火却凶悍。`
      : isArena
        ? `与${state.name}境界相近的修士，出手谨慎，擅以法器试探。`
        : `一路尾随${state.name}的邪修，气息阴冷${npcFlavor ? '，连' + npcFlavor + '见到都绕道走' : '，意在劫财夺物'}。`;
    const enemyHp = Math.max(35, Math.round((state.maxHp || 60) * 0.65));
    const enemyAttack = Math.max(5, Math.round((state.attack || 10) * 0.75));
    const title = blueprint?.name || (isBeast ? '妖兽搏杀' : '邪修截杀');
    const narrative = isArena
      ? `${age}岁，${state.name}卷入一场修士斗法。对方先以法器试探，又借身法逼近，台下众人屏息观望；这一战不只是输赢，更关乎她这些年根基是否扎实。`
      : `${age}岁，${state.name}行至${place}外僻静处，忽觉风声一滞。${enemyName}自林影间现身，拦住去路，杀机直逼眉心。退路已断，唯有运转灵力应战。`;
    return {
      title,
      narrative,
      eventType: 'combat',
      changes: [],
      newStatuses: [],
      newItems: [],
      removedItemIds: [],
      newEquippedItems: [],
      equipItemIds: [],
      unequipItemIds: [],
      memory: `${age}岁遭遇${title}，被迫应战。`,
      cultivationInsight: ctx.cultivationInsight || '生死斗法最验根基，修行不只在静室之中。',
      hasChoice: false,
      choice: null,
      triggeredBreakthrough: false,
      causedDeath: false,
      causedAscension: false,
      newThreads: [],
      advanceThreads: [],
      completeThreadIds: [],
      failThreadIds: [],
      triggerCombat: {
        contextTitle: title,
        contextNarrative: narrative,
        enemies: [{
          id: `fallback_enemy_${Date.now().toString(36)}`,
          name: enemyName,
          description: enemyDesc,
          hp: enemyHp,
          maxHp: enemyHp,
          attack: enemyAttack,
          defense: Math.max(2, Math.round((state.defense || 6) * 0.65)),
          speed: Math.max(4, Math.round((state.speed || 10) * 0.9)),
          realm: realmName,
          skills: [{ name: isBeast ? '扑咬' : '阴风刃', description: isBeast ? '猛扑撕咬，逼人失位' : '阴冷灵刃割向经脉', cooldown: 3, currentCooldown: 0 }],
        }],
        victoryDrops: isArena ? [] : [{
          id: `fallback_drop_${Date.now().toString(36)}`,
          name: isBeast ? '妖兽爪骨' : '染血储物袋',
          description: isBeast ? '低阶妖兽留下的爪骨，可作炼器材料。' : '邪修随身小袋，内中或有零散灵材。',
          rarity: 'common',
          item_type: 'material',
          effects: [],
          source: title,
        }],
        defeatCost: isArena ? '擂台失利，声望受损' : '遭敌重创，可能遗失财物或留下伤势',
      },
      isFallbackGenerated: true,
      fallbackStrategy: 'combat',
    };
  }

  // ===== 6 岁以下幼童：硬守门，不复用历史模板 =====
  if (age < 6) {
    const infantTemplates = age < 1
      ? [
          {
            title: '襁褓之中',
            narrative: `${state.name}尚在襁褓之中，整日或是酣睡，或是因饥饿与不适而啼哭。窗外有鸟雀声、屋内有亲人低语，懵懂之间似在感受这世间的温度。`,
            changes: [{ attribute: 'hp', delta: 2, reason: '健康成长' }],
            insight: '襁褓之中，以养育为主。',
          },
          {
            title: '周岁将至',
            narrative: `${state.name}满周岁不久，肌肤娇嫩，所见不过母亲怀抱与屋顶光影。偶尔发热或夜惊，亲人彻夜照看。这一年里，她学会了在人怀中安睡。`,
            changes: [{ attribute: 'hp', delta: 3, reason: '周岁平安' }],
            insight: '周岁幼子，需细心呵护。',
          },
        ]
      : [
          {
            title: '蹒跚学步',
            narrative: `${age}岁，${state.name}在${place}蹒跚学步，偶有跌倒，但亲人及时扶起。一年里她学会了叫爸妈，见生人会害羞躲进大人身后，对家中圈养的小鸡格外好奇。`,
            changes: [{ attribute: 'hp', delta: 2, reason: '孩童发育' }],
            insight: '幼童成长，以养代修。',
          },
          {
            title: '童蒙初开',
            narrative: `${age}岁，${state.name}常被祖父抱在膝上讲故事，似懂非懂地听人提起"仙缘"二字。午后她在院中玩泥巴、追蝴蝶，偶尔被父亲抱到田间看人劳作。`,
            changes: [{ attribute: 'hp', delta: 2, reason: '童蒙发育' }],
            insight: '童蒙初开，心性纯然。',
          },
          {
            title: '山间童趣',
            narrative: `${age}岁，${state.name}在${place}附近的山坡上追兔子、摘野果，衣服总是弄得很脏，但少有危险。傍晚她蹲在溪边看小鱼，被爷爷肩头扛着回了家。`,
            changes: [{ attribute: 'hp', delta: 3, reason: '孩童发育' }],
            insight: '山野之间，童趣天成。',
          },
        ];
    const picked = infantTemplates[seed % infantTemplates.length];
    return {
      title: picked.title,
      narrative: picked.narrative,
      eventType: 'normal',
      changes: picked.changes,
      newStatuses: [],
      newItems: [],
      removedItemIds: [],
      newEquippedItems: [],
      equipItemIds: [],
      unequipItemIds: [],
      memory: `${age}岁，${picked.title}。`,
      cultivationInsight: picked.insight,
      hasChoice: false,
      choice: null,
      triggeredBreakthrough: false,
      causedDeath: false,
      causedAscension: false,
      newThreads: [],
      advanceThreads: [],
      completeThreadIds: [],
      failThreadIds: [],
      triggerCombat: null,
      isFallbackGenerated: true,
      fallbackStrategy: 'infant_template',
    };
  }

  // ===== 历史同岁变体：有现成 AI 文本时优先复用 =====
  if (sameAgeVariants.length > 0) {
    const picked = pickRandom(sameAgeVariants)!;
    // 轻量改写：替换姓名/地点（同名跳过）
    const swaps: Record<string, string> = {};
    if (state.name) swaps[state.name] = state.name; // 自指不动
    // 把历史中的"今年""此时"换成具体的当前岁
    const remixed = picked.replace(/(今|这|此|本)年/g, () => `${age}岁`);
    return {
      title: extractTitleFromNarrative(remixed) || '流年',
      narrative: remixed,
      eventType: 'normal',
      changes: [{ attribute: 'cultivationExp', delta: Math.max(3, Math.round(baseGain * 0.6)), reason: '往日回响' }],
      newStatuses: [],
      newItems: [],
      removedItemIds: [],
      newEquippedItems: [],
      equipItemIds: [],
      unequipItemIds: [],
      memory: `${age}岁，${extractTitleFromNarrative(remixed) || '流年'}（历史回响）。`,
      cultivationInsight: '时日流转，行止如旧。',
      hasChoice: false,
      choice: null,
      triggeredBreakthrough: false,
      causedDeath: false,
      causedAscension: false,
      newThreads: [],
      advanceThreads: [],
      completeThreadIds: [],
      failThreadIds: [],
      triggerCombat: null,
      isFallbackGenerated: true,
      fallbackStrategy: 'same_age_variant',
    };
  }

  // ===== 元素注入型模板：抽取历史地点/NPC，组合新叙事 =====
  const enrichedLocation = pickRandom(storyElements.recentLocations) || place;
  const enrichedNpc = pickRandom(storyElements.recentNpcs);
  const enrichedThread = pickRandom(storyElements.recentThreads);

  const actions = [
    {
      title: '静室温功',
      narrative: `${age}岁，${state.name}没有贸然远行，而是在${enrichedLocation}择一处清静屋舍温养气脉。晨起搬运周天，午后校正吐纳，夜里复盘旧日所学；日子看似平稳，丹田里的灵气却比往年凝实了几分。${enrichedNpc ? `偶有${enrichedNpc}路过，点头示意却不多话。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: baseGain, reason: '静修温功' },
        { attribute: 'mp', delta: Math.max(1, Math.round(baseGain / 2)), reason: '吐纳回气' },
      ],
      insight: `这一年以稳固根基为主，按当前修炼速度约积累${baseGain}点修行进境。`,
    },
    {
      title: '溪畔采药',
      narrative: `${age}岁，${state.name}沿${enrichedLocation}附近山水辨认草木。白日采药、问路、避开蛇虫瘴气，夜里借月色温习吐纳。此行没有惊动大势，却认得几味养气小草，也把脚下山川记熟了些。${enrichedNpc ? `${enrichedNpc}听说她常来这一带采药，便托她捎几株回去。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.75)), reason: '采药间体悟灵气流转' },
        { attribute: 'luck', delta: 1, reason: '熟悉附近山水草木' },
      ],
      insight: `采药与吐纳并行，修行进境约${Math.max(4, Math.round(baseGain * 0.75))}点。`,
    },
    {
      title: '尘中磨性',
      narrative: `${age}岁，${state.name}在${enrichedLocation}处理凡尘琐事：替人送信，帮老农驱兽，也听茶棚散修谈起远方风声。${enrichedNpc ? `${enrichedNpc}见多识广，偶尔指点她几句江湖门道。` : ''}忙碌不似闭关，却磨去了几分浮躁，使修行心性更稳。${enrichedThread ? `心里还惦记着：${enrichedThread}。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(3, Math.round(baseGain * 0.65)), reason: '尘事磨心' },
        { attribute: 'reputation', delta: 1, reason: '乡里略有善名' },
      ],
      insight: `凡事磨心，劳作后静修，仍得${Math.max(3, Math.round(baseGain * 0.65))}点修行进境。`,
    },
    {
      title: '残篇夜读',
      narrative: `${age}岁，${state.name}从旧摊上换得几页残破修行札记。纸上多是前人错漏与旁注，真正可用的不多；但逐句辨伪、对照自身经脉之后，仍悟出一两处可改的吐纳细节。${enrichedNpc ? `${enrichedNpc}听说此事，凑过来看了两眼，摇头说"你胆子不小"。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.8)), reason: '残篇印证修行' },
        { attribute: 'comprehension', delta: 1, reason: '辨伪旧札' },
      ],
      insight: `残篇不足成法，却能校正吐纳，约得${Math.max(4, Math.round(baseGain * 0.8))}点修行进境。`,
    },
    {
      title: '照料旧缘',
      narrative: `${age}岁，${state.name}没有急着追逐机缘，而是整理旧物、照料身边因缘，并把近年经历逐条记下。修行有时不在山崩海啸之间，也在这些不肯放松的细处。${enrichedNpc ? `${enrichedNpc}见她日子过得稳当，难得露了个笑。` : ''}${enrichedThread ? `她把心里惦记的事也写进了小册子里——${enrichedThread}。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(3, Math.round(baseGain * 0.55)), reason: '整理旧缘后心绪渐明' },
        { attribute: 'heartDemon', delta: -1, reason: '心绪稍安' },
      ],
      insight: `整理旧缘使心神稍定，修行虽慢，却少了些杂念。`,
    },
    {
      title: '山路听风',
      narrative: `${age}岁，${state.name}背着简囊在${enrichedLocation}外走了几日山路。途中没有遇见仙人遗府，只见溪石、樵夫与远处云影；可正是在这些寻常景象里，她把呼吸、步伐和灵力运转调得更顺。${enrichedNpc ? `山脚处遇到了${enrichedNpc}，两人结伴走了一程。` : ''}`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.7)), reason: '行路调息' },
        { attribute: 'speed', delta: 1, reason: '山路磨脚力' },
      ],
      insight: `行走山路亦是调息，身法与气脉略有长进。`,
    },
  ];
  const picked = actions[seed % actions.length];
  return {
    title: picked.title,
    narrative: picked.narrative,
    eventType: isFateNode ? 'fate_node' : 'normal',
    changes: picked.changes,
    newStatuses: [],
    newItems: [],
    removedItemIds: [],
    newEquippedItems: [],
    equipItemIds: [],
    unequipItemIds: [],
    memory: `${age}岁，${picked.title}。`,
    cultivationInsight: picked.insight,
    hasChoice: false,
    choice: null,
    triggeredBreakthrough: false,
    causedDeath: false,
    causedAscension: false,
    newThreads: [],
    advanceThreads: [],
    completeThreadIds: [],
    failThreadIds: [],
    triggerCombat: null,
    isFallbackGenerated: true,
    fallbackStrategy: storyElements.recentLocations.length > 0 || storyElements.recentNpcs.length > 0
      ? 'enriched_template'
      : 'plain_template',
  };
}

function extractTitleFromNarrative(narrative: string): string | null {
  // 尝试从叙事前几个字抽取主题词作为 title
  const m = narrative.match(/^[^，。；！？\n]{2,12}/);
  return m ? m[0].trim() : null;
}
