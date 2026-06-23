export function buildFallbackAgeEvent(state: any, blueprint: any, ctx: any, isFateNode: boolean) {
  const place = state.location || '暂居之地';
  const age = state.age;
  const rate = Number(ctx?.cultivationRate?.finalRate || state.cultivationMultiplier || 1) || 1;
  const baseGain = Math.max(5, Math.round(8 * rate));
  const seed = Math.abs((age * 37) + String(state.id || state.name || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0));
  const realmName = ctx?.character?.realmName || '炼气';
  const combatNames = ['邪修截杀', '妖兽搏杀', '夺宝大战', '擂台比武'];
  const isCombatBlueprint = blueprint?.category === 'combat' || combatNames.some(name => String(blueprint?.name || '').includes(name));

  if (isCombatBlueprint) {
    const isBeast = String(blueprint?.name || '').includes('妖兽');
    const isArena = String(blueprint?.name || '').includes('擂台');
    const enemyName = isBeast ? '山魈妖兽' : isArena ? '擂台对手' : '蒙面邪修';
    const enemyDesc = isBeast
      ? `盘踞在${place}外山林的低阶妖兽，爪牙带腥，畏火却凶悍。`
      : isArena
        ? `与${state.name}境界相近的修士，出手谨慎，擅以法器试探。`
        : `一路尾随${state.name}的邪修，气息阴冷，意在劫财夺物。`;
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
    };
  }

  // 6岁以下幼童：只写被动感知、基本生理反应、在成人协助下的简单互动
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
    };
  }

  const actions = [
    {
      title: '静室温功',
      narrative: `${age}岁，${state.name}没有贸然远行，而是在${place}择一处清静屋舍温养气脉。晨起搬运周天，午后校正吐纳，夜里复盘旧日所学；日子看似平稳，丹田里的灵气却比往年凝实了几分。`,
      changes: [
        { attribute: 'cultivationExp', delta: baseGain, reason: '静修温功' },
        { attribute: 'mp', delta: Math.max(1, Math.round(baseGain / 2)), reason: '吐纳回气' },
      ],
      insight: `这一年以稳固根基为主，按当前修炼速度约积累${baseGain}点修行进境。`,
    },
    {
      title: '溪畔采药',
      narrative: `${age}岁，${state.name}沿${place}附近山水辨认草木。白日采药、问路、避开蛇虫瘴气，夜里借月色温习吐纳。此行没有惊动大势，却认得几味养气小草，也把脚下山川记熟了些。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.75)), reason: '采药间体悟灵气流转' },
        { attribute: 'luck', delta: 1, reason: '熟悉附近山水草木' },
      ],
      insight: `采药与吐纳并行，修行进境约${Math.max(4, Math.round(baseGain * 0.75))}点。`,
    },
    {
      title: '尘中磨性',
      narrative: `${age}岁，${state.name}在${place}处理凡尘琐事：替人送信，帮老农驱兽，也听茶棚散修谈起远方风声。忙碌不似闭关，却磨去了几分浮躁，使修行心性更稳。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(3, Math.round(baseGain * 0.65)), reason: '尘事磨心' },
        { attribute: 'reputation', delta: 1, reason: '乡里略有善名' },
      ],
      insight: `凡事磨心，劳作后静修，仍得${Math.max(3, Math.round(baseGain * 0.65))}点修行进境。`,
    },
    {
      title: '残篇夜读',
      narrative: `${age}岁，${state.name}从旧摊上换得几页残破修行札记。纸上多是前人错漏与旁注，真正可用的不多；但逐句辨伪、对照自身经脉之后，仍悟出一两处可改的吐纳细节。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(4, Math.round(baseGain * 0.8)), reason: '残篇印证修行' },
        { attribute: 'comprehension', delta: 1, reason: '辨伪旧札' },
      ],
      insight: `残篇不足成法，却能校正吐纳，约得${Math.max(4, Math.round(baseGain * 0.8))}点修行进境。`,
    },
    {
      title: '照料旧缘',
      narrative: `${age}岁，${state.name}没有急着追逐机缘，而是整理旧物、照料身边因缘，并把近年经历逐条记下。修行有时不在山崩海啸之间，也在这些不肯放松的细处。`,
      changes: [
        { attribute: 'cultivationExp', delta: Math.max(3, Math.round(baseGain * 0.55)), reason: '整理旧缘后心绪渐明' },
        { attribute: 'heartDemon', delta: -1, reason: '心绪稍安' },
      ],
      insight: `整理旧缘使心神稍定，修行虽慢，却少了些杂念。`,
    },
    {
      title: '山路听风',
      narrative: `${age}岁，${state.name}背着简囊在${place}外走了几日山路。途中没有遇见仙人遗府，只见溪石、樵夫与远处云影；可正是在这些寻常景象里，她把呼吸、步伐和灵力运转调得更顺。`,
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
  };
}
