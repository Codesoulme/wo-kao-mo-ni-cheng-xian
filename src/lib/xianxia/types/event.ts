import type { Realm, RealmProfile } from './realm';
import type { SpiritualRoot } from './spiritual-root';
import type { StatusEntry } from './status';
import type { ItemEntry } from './item';
import type { Pet } from './pet';
import type { WorldNpc } from './npc';
import type { CombatEnemy } from './combat';
import type { CultivationAttributeEntry, CharacterState } from './character';
import type { NarrativeContract, InputClass } from './narrative';




// ==================== 事件蓝图系统 (Task 20 - 解决事件单一化) ====================



// 事件主题分类——每岁由引擎从蓝图池中按权重抽取一个主题，AI 必须围绕此主题生成事件

// 解决"除了修炼就是修炼"的问题：强制 AI 多样化事件类型

export type BlueprintCategory =

  | 'cultivation'    // 修炼类（基础修炼、突破前夜、功法参悟）

  | 'encounter'      // 奇遇类（秘境、传承、灵物现世）

  | 'social'         // 人际类（师门、同门、结识、争风）

  | 'combat'         // 争斗类（妖兽、邪修、夺宝、擂台）

  | 'trade'          // 商业类（坊市、淘宝、典当、交易）

  | 'exploration'    // 探索类（秘境、洞府、遗迹、地脉）

  | 'heritage'       // 传承类（前辈指点、玉简、心法传承）

  | 'trial'          // 试炼类（宗门任务、心魔试炼、雷劫前夕）

  | 'emotion'        // 情感类（尘缘、故人、恩怨、亲情）

  | 'inner_demon'    // 心魔类（心魔侵扰、道心动摇、执念）

  | 'thread_resolve' // 未决线索推进（必须触发，引擎专用）

  | 'daily';         // 凡俗日常（童年、家事、市井）




export interface EventBlueprint {

  category: BlueprintCategory;

  name: string;           // 主题名称（如"坊市淘宝""妖兽搏杀""心魔试炼"）

  description: string;    // 主题描述（指导 AI 应围绕什么展开）

  weight: number;         // 抽取权重

  minRealm: number;       // 最低境界 idx（0=mortal, 1=qi_refining...）

  maxRealm: number;       // 最高境界 idx

  minAge: number;         // 最低年龄

  maxAge: number;         // 最高年龄

  requireFaction?: boolean; // 是否需要宗门

  examples: string[];     // 该主题下的事件灵感样例（AI 可参考但不可照抄）

}




// 事件蓝图池——参考《凡人修仙传》修仙世界，覆盖各境界各阶段

export const EVENT_BLUEPRINTS: EventBlueprint[] = [

  // ===== 凡人阶段（0-12岁）=====

  { category: 'daily', name: '童年趣事', description: '凡人童年日常，家人互动、邻里趣事、初识世界', weight: 30, minRealm: 0, maxRealm: 1, minAge: 0, maxAge: 12, examples: ['与邻家孩童嬉闹', '帮父母做家务', '第一次见到行脚商', '夜里听爷爷讲修仙传说'] },

  { category: 'encounter', name: '灵气初触', description: '凡人阶段偶然感知天地灵气，为日后修仙埋下伏笔', weight: 15, minRealm: 0, maxRealm: 1, minAge: 4, maxAge: 14, examples: ['梦见云中仙人', '山间偶遇采药老者', '夜里听到奇怪声响', '触碰到祖传玉佩发热'] },

  { category: 'social', name: '家族变故', description: '家世相关变故，磨砺心性、影响性格', weight: 10, minRealm: 0, maxRealm: 2, minAge: 5, maxAge: 20, examples: ['父亲染病', '家中遭贼', '兄长离家闯荡', '母亲传授家传手艺'] },

  { category: 'inner_demon', name: '幼年执念', description: '童年时期埋下执念，影响日后道心', weight: 8, minRealm: 0, maxRealm: 1, minAge: 6, maxAge: 14, examples: ['目睹不公立誓强大', '亲人离世立志长生', '受人欺辱暗下决心'] },



  // ===== 炼气期 =====

  { category: 'cultivation', name: '引气入体', description: '炼气期修炼日常，感知灵气、运转功法、洗筋伐髓', weight: 18, minRealm: 1, maxRealm: 2, minAge: 8, maxAge: 60, examples: ['首次引气入体成功', '打通某条经脉', '功法参悟有新得', '灵气汇聚丹田'] },

  { category: 'trade', name: '坊市淘宝', description: '前往坊市购买/出售物品，可能有意外收获', weight: 15, minRealm: 1, maxRealm: 6, minAge: 12, maxAge: 9999, examples: ['坊市捡漏得灵草', '典当旧物换灵石', '与商贩讨价还价', '黑市淘宝遇险'] },

  { category: 'social', name: '同门切磋', description: '与同门师兄弟切磋斗法、增进情谊或结怨', weight: 12, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['与师兄切磋法术', '与师妹论道', '与同门争夺资源', '帮师弟解惑'] },

  { category: 'exploration', name: '宗门历练', description: '宗门安排的历练任务，外出执行', weight: 12, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['清理山门附近妖兽', '采药任务', '护送商队', '巡查边境'] },

  { category: 'combat', name: '妖兽搏杀', description: '遭遇妖兽，进入战斗或巧妙避开', weight: 14, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['山林遇狼妖', '洞府惊现蛇妖', '溪边逢蟹怪', '高空遇鹰妖'] },

  { category: 'combat', name: '邪修截杀', description: '遭遇邪修、魔修，劫财或夺宝', weight: 10, minRealm: 1, maxRealm: 7, minAge: 14, maxAge: 9999, examples: ['夜行遇蒙面人', '林中遇血修', '客栈遇魔修', '路上遇劫匪'] },



  // ===== 筑基-金丹 =====

  { category: 'encounter', name: '秘境现世', description: '秘境、洞府、遗迹开启，机缘与危险并存', weight: 12, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['古修洞府出世', '秘境百年一开', '海底遗迹浮现', '空中楼阁显形'] },

  { category: 'heritage', name: '前辈传承', description: '得到前辈高人指点或传承玉简', weight: 10, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['梦中得前辈传法', '洞府拾得玉简', '前辈残魂指点', '观壁画悟道'] },

  { category: 'trade', name: '拍卖大会', description: '大型拍卖会、交易会，珍品云集', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['宗门联合拍卖', '坊市年度大拍', '散修私下交易会'] },

  { category: 'combat', name: '擂台比武', description: '宗门擂台、修仙界比武大会', weight: 10, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['宗门年度比武', '跨宗门友谊赛', '修仙界新秀赛'] },

  { category: 'exploration', name: '采灵寻宝', description: '深入险地采集灵草、寻找灵矿', weight: 12, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['深入毒雾谷采药', '海底寻珊瑚', '火山口取火晶', '冰原采雪莲'] },

  { category: 'social', name: '尘缘纠葛', description: '情感纠葛、故人重逢、恩怨清算', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['故人来访', '旧爱重逢', '恩人求助', '仇人现身'] },

  { category: 'inner_demon', name: '道心试炼', description: '道心动摇、心魔侵扰、执念爆发', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['修炼走火入魔', '心魔幻境', '执念难破', '道心拷问'] },



  // ===== 元婴以上 =====

  { category: 'combat', name: '夺宝大战', description: '高阶修士争夺天材地宝，混战爆发', weight: 10, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['灵宝出世群雄逐鹿', '秘境中争夺宝物', '拍卖会后遭截杀'] },

  { category: 'heritage', name: '大能遗府', description: '探索大能前辈留下的洞府，机缘与考验', weight: 8, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['元婴前辈遗府', '化神老怪坐化之地', '上古仙人遗迹'] },

  { category: 'trial', name: '雷劫前夕', description: '渡劫前的准备与天象异变', weight: 8, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['天象异变', '道友提醒渡劫', '闭关备战雷劫'] },

  { category: 'social', name: '收徒传道', description: '高境界收徒、传承道统', weight: 6, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['偶遇良材收为徒', '宗门委托授业', '点化有缘人'] },



  // ===== 通用 =====

  { category: 'cultivation', name: '闭关参悟', description: '闭关参悟功法、磨砺境界', weight: 14, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['闭关参悟功法', '观天地悟道', '磨砺心境', '参悟阵法'] },

  { category: 'cultivation', name: '突破前夜', description: '修为将满，酝酿突破的关键时刻', weight: 10, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['修为圆满待破', '心魔试炼前夕', '突破前兆'] },

  { category: 'trade', name: '炼器寻材', description: '为炼器、炼丹寻找材料', weight: 8, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['寻炼器灵材', '求炼丹辅药', '找阵法材料'] },

  { category: 'social', name: '师门任务', description: '宗门指派的任务，完成可获贡献', weight: 10, minRealm: 1, maxRealm: 6, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['宗门指派任务', '师门差遣', '代师传讯'] },

  // ===== Phase-本主扩池（修仙小说常见桥段补档）=====

  // --- 凡人/幼龄 ---
  { category: 'daily', name: '村中疫病', description: '乡间时疫、瘴疠、伤寒蔓延，凡人家庭的惨痛与求生', weight: 9, minRealm: 0, maxRealm: 1, minAge: 3, maxAge: 16, examples: ['村中孩童接连发热', '邻家母亲咳血而亡', '父亲拖病体上山采药', '乡里求神拜佛不愈'] },
  { category: 'encounter', name: '异象入梦', description: '胎梦、托梦、仙鹤衔枝等异象埋下仙缘伏笔', weight: 8, minRealm: 0, maxRealm: 1, minAge: 4, maxAge: 14, examples: ['梦见白鹤入怀', '灶王爷托梦指路', '祖坟冒青烟', '夜半紫气入室'] },
  { category: 'emotion', name: '童养风波', description: '凡俗亲情纠葛：童养亲事、过继、改姓、与弟妹争宠', weight: 6, minRealm: 0, maxRealm: 1, minAge: 5, maxAge: 16, examples: ['妹妹被抱养走', '与姐姐争绣花针', '给童养媳起名', '听娘说她差点没活下来'] },
  { category: 'combat', name: '山野遇妖', description: '凡人视角偶遇低阶妖兽侥幸逃脱或被救', weight: 6, minRealm: 0, maxRealm: 1, minAge: 6, maxAge: 14, examples: ['山中采菇见巨蟒', '夜里被狼精追', '井底爬出龟妖', '村口乌鸦开口说话'] },

  // --- 炼气期 ---
  { category: 'encounter', name: '灵气潮汐', description: '天地灵气异动：灵雨、灵潮、地脉涌泉，修行与采集事半功倍', weight: 7, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['三年一度灵雨', '灵潮涌泉口', '地脉翻涌金光', '潮汐之夜采灵'] },
  { category: 'social', name: '同门暗手', description: '师门内部资源、人情、嫉妒引发的隐性冲突', weight: 7, minRealm: 1, maxRealm: 6, minAge: 12, maxAge: 9999, requireFaction: true, examples: ['师兄暗中克扣丹药', '师妹告密到长老', '坐骑被下绊子', '宗门考核被换题'] },
  { category: 'cultivation', name: '杂役修行', description: '灵田耕作、丹房打杂、看护灵兽、巡山护阵等低阶差役积累修为', weight: 7, minRealm: 1, maxRealm: 3, minAge: 12, maxAge: 60, requireFaction: true, examples: ['灵田除草引灵气入体', '丹房看火领悟药性', '喂食灵鹤体悟禽息', '巡山时听师叔讲法'] },
  { category: 'exploration', name: '误闯妖穴', description: '采药、赶路或避雨时误入妖兽巢穴，被迫周旋或借势逃出', weight: 9, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, examples: ['避雨入狐妖洞府', '采药惊动守山蛇', '进洞躲避撞见蝠王', '迷路误入蟾蜍宫'] },
  { category: 'combat', name: '散修围邪', description: '多名散修自发围攻邪修据点、魔修窝、盗匪山寨', weight: 7, minRealm: 1, maxRealm: 5, minAge: 12, maxAge: 9999, examples: ['围剿山贼修士窝', '众散修清剿血修', '协助同道剿灭噬人谷', '坊市外围伏击劫修'] },
  { category: 'trade', name: '鬼市淘宝', description: '夜开鬼市、黑市、销赃点，货色奇诡但价格低、风险高', weight: 6, minRealm: 1, maxRealm: 6, minAge: 14, maxAge: 9999, examples: ['鬼市子时开张', '购得一柄来历不明的剑', '鬼市摊主讨封', '买到疑似血修遗物'] },
  { category: 'emotion', name: '故友来信', description: '多年未见的旧友、世交、师门旧识突然来信或来访', weight: 6, minRealm: 1, maxRealm: 7, minAge: 14, maxAge: 9999, examples: ['师兄寄来一封密信', '儿时玩伴忽成散修', '救命恩人之女寻上门', '失联多年的妹妹寄来玉牌'] },

  // --- 筑基-金丹 ---
  { category: 'heritage', name: '血脉觉醒', description: '祖上/血脉中封存的力量因刺激而初步觉醒，伴随异象', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['眉心浮现祖纹', '眼底泛出重瞳', '重病后神识暴涨', '伤口中渗出灵血'] },
  { category: 'heritage', name: '玉简解封', description: '所得玉简/典籍因修为达标而解开更高层封印', weight: 7, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['底层功法令牌亮光', '玉简第二层禁制自解', '壁画中走出人影', '残本补全下半卷'] },
  { category: 'trial', name: '神识出游', description: '神识凝聚成形出窍夜行、神游万里、入梦探察', weight: 7, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['阴神夜游百里', '神识入他人梦中', '观己神魂之形', '窥探禁地边缘'] },
  { category: 'social', name: '宗门内斗', description: '宗门内部派系之争、长老夺权、继承人风波将主角卷入', weight: 8, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, requireFaction: true, examples: ['派系之争被要求站队', '长老弟子争继承位', '宗门会议投票', '掌门闭关诸事皆变'] },
  { category: 'combat', name: '旧仇相见', description: '昔日结怨的对手/仇家/旧识重出江湖，主动寻仇或对峙', weight: 7, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['曾败于己手的强敌回归', '杀兄仇家登门', '逃掉多年的仇人拜山头', '师门弃徒寻仇归来'] },
  { category: 'inner_demon', name: '夺舍暗伏', description: '暗中发现自己疑似被人觊觎肉身/有夺舍邪修盯上', weight: 6, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['魂魄不属于自己的某一瞬', '元神中多出一缕怨念', '识海有他人试探', '肉身被人暗中做法'] },
  { category: 'social', name: '推恩招安', description: '上位势力以封赏、官职、庇护招揽或试探，附带条件', weight: 6, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['大宗递来外门客卿帖', '圣朝赐下散阶', '城主府许以名誉长老', '魔道欲收为记名'] },
  { category: 'encounter', name: '天机推演', description: '卦师、龟甲、灵签、应梦之类预警某事将至或藏某物', weight: 7, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['路遇卦师点破命数', '龟甲裂出下下卦', '三更签语应梦', '观星见妖星犯宫'] },
  { category: 'trial', name: '丹劫炸炉', description: '炼丹炼器引发天地异象（丹劫/器劫），成败一瞬', weight: 6, minRealm: 2, maxRealm: 7, minAge: 30, maxAge: 9999, examples: ['炼丹引来雷火', '炼器炸炉波及坊市', '丹成异香百里', '法宝引来器灵'] },

  // --- 高阶（60岁+/金丹元婴）---
  { category: 'social', name: '妖市夜宴', description: '高阶散修/妖族/邪修共同出席的地下夜宴，机会与风险并存', weight: 7, minRealm: 3, maxRealm: 7, minAge: 60, maxAge: 9999, examples: ['妖王设宴招客', '散修大豪交换会', '邪修血宴试探', '地下黑市主客问礼'] },
  { category: 'combat', name: '大道之争', description: '同阶天骄为争道争位而对决，往往伴随宗门或势力站队', weight: 9, minRealm: 3, maxRealm: 7, minAge: 80, maxAge: 9999, examples: ['圣子之争生死擂', '同阶争渡天劫名额', '两位绝世妖修斗法', '气运之子对决'] },
  { category: 'heritage', name: '上古妖圣遗血', description: '觉醒或接触上古大妖血脉传承，伴随神魂/血脉剧变', weight: 6, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['妖圣残魂入识海', '瞳孔变金', '血液中浮现纹路', '身边妖兽俯首'] },
  { category: 'inner_demon', name: '前世今生梦', description: '神魂强到触及前世/上世记忆碎片，陷入因果之问', weight: 6, minRealm: 3, maxRealm: 7, minAge: 100, maxAge: 9999, examples: ['梦中见另一张脸', '识海浮现陌生地名', '前世仇家今世重逢', '故人托梦陈情'] },

  // --- 通用 ---
  { category: 'cultivation', name: '法宝反噬', description: '祭炼或催动超出自身承受的法宝，遭神识/气血反噬', weight: 6, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['强行催动禁器吐血', '法宝自爆伤主', '剑灵反噬识海', '借法器一瞬苦撑'] },
  { category: 'emotion', name: '情债难偿', description: '凡人/低阶女修/道侣等人情债，因修为差距或世事而难以兑现', weight: 6, minRealm: 1, maxRealm: 7, minAge: 18, maxAge: 9999, examples: ['当年约定的俗世娘子', '道侣寿元将尽', '旧友一家求护', '恩公遗孀寻来'] },
  { category: 'encounter', name: '灵宠救主', description: '灵宠/坐骑/法灵在危难时反哺、护主、通报危机', weight: 5, minRealm: 1, maxRealm: 7, minAge: 12, maxAge: 9999, examples: ['灵鹤挡刀', '剑灵强行护主', '灵狐引路脱困', '坐骑嘶鸣示警'] },
  { category: 'social', name: '人情债登门', description: '旧日欠下的人情/因果/誓言被人登门索取', weight: 6, minRealm: 1, maxRealm: 7, minAge: 14, maxAge: 9999, examples: ['当年救命恩人求药', '族中长辈要挟做主', '欠下同道一枚阵旗', '誓约到期被召'] },

];




// ==================== 角色主动意图系统 (Task 20 - 解决角色太蠢) ====================



// 角色根据自身处境生成的"主动意图"——AI 必须在事件中体现这些意图的执行

// 例：即将宗门比赛 → "备战比赛"意图 → AI 应让角色主动准备武器、炼丹、请教

export interface CharacterIntent {

  id: string;

  type: 'prepare_combat' | 'gather_resources' | 'seek_mentor' | 'avoid_danger' | 'resolve_thread'

        | 'cultivate_diligently' | 'explore_opportunity' | 'socialize' | 'trade' | 'breakthrough';

  title: string;          // 意图标题（如"备战宗门比武"）

  description: string;    // 意图描述（指导 AI 如何在事件中体现）

  priority: number;       // 优先级 1-10（10 最高）

  relatedThreadId?: string; // 关联的未决线索 id（若有）

}




// ==================== 未决线索系统 (Task 20 - 解决 AI 记忆丢失) ====================



// 持久化的"未决线索"——重要剧情线索会被记录并在后续推进/到期触发

// 例："三个月后宗门比武"、"仇敌王某誓要报复"、"师门委托炼丹"

export interface PendingThread {

  id: string;

  title: string;             // 线索标题

  description: string;       // 线索描述（人/事/时/地/因）

  category: 'competition' | 'enemy' | 'quest' | 'promise' | 'mystery' | 'romance' | 'debt' | 'inheritance' | 'exploration';

  startAge: number;          // 触发年龄

  deadlineAge: number;       // 截止年龄（到期必须触发对应事件）

  status: 'pending' | 'urgent' | 'resolved' | 'failed';

  progress: number;          // 0-100 进度

  relatedMemoryIds?: string[]; // 关联的长期记忆

  reward?: string;           // 完成奖励描述

  failureCost?: string;      // 失败代价描述

  dueInSameYear?: boolean;   // 同年内后续：如“三月后”“不久后”“今年比试”，advance 后应追加同岁续写

  followUpHint?: string;     // 后续应如何承接，例如“入仙门比试”“持潮湿玉片再探潮隙浮阁”

  sourceEventTitle?: string; // 源事件标题，帮助 AI/引擎保持因果

  summary?: string;            // 线索摘要，用于战斗去重匹配

  resolution?: string;         // 解决方式记录

  realmId?: string;          // 若该线索指向秘境，填秘境 id

}




export type QuestEntryStage = 'open' | 'urgent' | 'completed' | 'failed';


export type QuestEntryKind = PendingThread['category'];




// QuestEntry Lite: normalized internal quest index derived from pendingThreads.

// It is a trace/context layer, not a new player-facing UI yet.

export interface QuestEntry {

  id: string;

  title: string;

  summary: string;

  kind: QuestEntryKind;

  stage: QuestEntryStage;

  progress: number;

  startedAtAge: number;

  dueAge?: number;

  urgency: number;

  sourceThreadId: string;

  sourceEventTitle?: string;

  currentHook?: string;

  rewardHint?: string;

  failureHint?: string;

  realmId?: string;

  tags: string[];

}




// AI 生成的叙事事件

export interface TimeAdvance {

  amount: number;

  // 2026-08-31：与 world-time.ts 的 TimeAdvanceUnit 保持一致，新增连续态。
  unit: 'continuous' | 'moment' | 'hour' | 'day' | 'month' | 'season' | 'year' | 'decade' | 'century';

  /** 玩家可见的相对时间题签；空串表示连续态，前端不渲染。 */
  label: string;

  reason: string;

  ageDeltaYears: number;

  elapsedDays: number;

  /** 日内推进量（小时，可含小数）。 */
  elapsedHours?: number;

  /** 0..24 绝对时点，语义为"跳到同一天的那个时点"，优先于 elapsedHours。 */
  setDayHour?: number;

}




export interface ActionProjection {

  id: string;

  kind: 'advance' | 'market' | 'exploration' | 'thread' | 'cultivate' | 'trade' | 'rest' | 'combat' | 'choice' | 'custom';

  label: string;

  description?: string;

  sourceEventId?: string;

  sourceThreadId?: string;

  requirements?: string[];

  risk?: 'safe' | 'low' | 'medium' | 'high' | 'deadly';

  expiresAtAge?: number;

  expiresAtWorldDay?: number;

  payload?: Record<string, any>;

}




export interface AIEventOutput {

  // 叙事

  title: string;              // 事件标题（≤16字）

  narrative: string;          // 叙事正文（100-300字）

  eventType: 'normal' | 'fate_node' | 'choice' | 'combat' | 'breakthrough' | 'death' | 'ascension';



  // 状态变更（AI 提议，引擎校验）

  changes: AttributeChange[];



  // 灵根蜕变（结构化字段；引擎校验 spiritualRoot 后才会改写角色灵根与修炼倍率）

  spiritualRootChange?: SpiritualRootChange;



  // 新增状态词条

  newStatuses: StatusEntry[];



  // 新增物品

  newItems: ItemEntry[];



  // 移除/消耗的物品 id 列表（AI 联动：战斗中武器被破坏、丹药被消耗等）

  removedItemIds?: string[];



  // AI 直接放入已装备的物品（含 equipNote 自由文本，如「项链·储物戒指串」）

  // 用于 AI 创造性装备场景：玩家说「把储物戒指串成项链戴脖子上」→ AI 用此字段放置

  newEquippedItems?: ItemEntry[];



  // AI 想把背包里已有的物品装备上去的 id 列表（引擎自动移动 inventory→equipped）

  equipItemIds?: string[];



  // AI 想卸下已装备物品的 id 列表（引擎自动移动 equipped→inventory）

  unequipItemIds?: string[];



  // 长期记忆（写入长期记忆库）

  memory: string;



  // 修炼心得：AI 根据当前角色全状态生成的修炼速度说明文本（影响修炼速度的种种因素）

  // 显示规则见 prompt：60-150字，修仙口吻，融入角色处境，末尾给出综合倍率数值

  // 注意：来源条目（cultivationFactors）由引擎权威计算，AI 不可输出；

  // AI 只需在 cultivationInsight 文本中引用 prompt 注入的准确数字即可

  cultivationInsight?: string;



  // AI/事件生成的非常规属性投影（引擎校验后展示；持久化仍建议通过 newStatuses category='attribute' 落库）

  cultivationAttributes?: CultivationAttributeEntry[];



  // AI 可输出本段时日与行动投影；引擎负责裁剪、校验并落库。

  timeAdvance?: TimeAdvance;

  // 面板只展示 AI/引擎注册的可交互内容，不靠正文正则猜入口。

  actionProjections?: ActionProjection[];



  // 是否触发选择节点

  hasChoice: boolean;

  choice?: ChoicePrompt;



  // 是否触发突破。AI 只能提出突破请求，具体突破层数由引擎按因果与数值校验。

  triggeredBreakthrough?: boolean;

  // 连破/大幅突破由头：若 AI 想让角色一次连破多层或跨大境界，必须给出足够具体的原因。

  breakthroughReason?: string;

  // AI 希望突破到的目标小层（1 基显示层数）；引擎会按资质、修为、由头强弱限制。

  breakthroughTargetLevel?: number;

  // AI 希望突破到的目标大境界；没有充分由头时引擎会拒绝跨大境界。

  breakthroughTargetRealm?: Realm;

  // 合理特殊突破时，AI 可提议境界画像覆盖；引擎会校验并限制倍率/层数。

  realmProfilePatch?: RealmProfile;



  // 同一岁内的补充事件文本，用于把复杂年份拆成多段史册记录，避免一段叙事过长或漏写关键过程。

  extraEvents?: { title: string; narrative: string; eventType?: AIEventOutput['eventType']; timeAdvance?: TimeAdvance; actionProjections?: ActionProjection[] }[];



  // 是否死亡

  causedDeath?: boolean;

  deathReason?: string;



  // 是否飞升

  causedAscension?: boolean;



  // ===== Task 20 新增 =====

  // AI 添加新的未决线索（如"三个月后宗门比武""仇敌誓要报复"）

  newNpcs?: Partial<WorldNpc>[];

  causalSummary?: string;

  newThreads?: PendingThread[];

  // AI 推进现有线索的进度（id + 进度增量）

  advanceThreads?: { id: string; progressDelta: number; note?: string }[];

  // AI 标记完成的线索 id 列表

  completeThreadIds?: string[];

  // AI 标记失败的线索 id 列表（如错过 deadline）

  failThreadIds?: string[];

  // AI 触发战斗（eventType='combat' 时必须给出）

  triggerCombat?: {

    enemies: CombatEnemy[];

    contextTitle: string;

    contextNarrative: string;

    // 战斗胜利后 AI 给出的掉落物品（endCombat 时应用）

    victoryDrops?: ItemEntry[];

    // 战斗失败的代价（如死亡、重伤、被夺宝）

    defeatCost?: string;

    // Task 22: 心魔试炼战斗的胜负心魔值变化（仅心魔战设置）

    victoryHeartDemonDelta?: number;

    defeatHeartDemonDelta?: number;

    isHeartDemonTrial?: boolean;

  };

  // ===== Narrative Contract Lite =====

  // AI 声明本轮承接的调度/世界事实/NPC/叙事焦点，仅用于审计与连续性校验，不直接改变世界。

  narrativeContract?: NarrativeContract;



  // ===== Task 23 新增 =====

  // AI 授予玩家灵宠（如收服妖兽幼崽、前辈相赠、灵宠店购买）

  newPets?: Pet[];



  // ===== Phase-M：fallback 标记 =====

  isFallbackGenerated?: boolean;

}




export interface AttributeChange {

  attribute: string;     // 改变哪个属性

  delta: number;         // 变化量（正或负）

  reason: string;        // 变化原因

}




export interface SpiritualRootChange {

  spiritualRoot: SpiritualRoot;

  rootDetail?: string;

  reason: string;

}




export type EffectResolveSeverity = 'info' | 'warning' | 'error';




export interface EffectResolveTrace {

  severity: EffectResolveSeverity;

  code: string;

  attribute?: string;

  message: string;

  before?: number;

  delta?: number;

  after?: number;

  source?: string;

}




export interface EffectResolveResult {

  state: CharacterState;

  appliedChanges: AttributeChange[];

  rejectedChanges: AttributeChange[];

  trace: EffectResolveTrace[];

}




export interface ChoicePrompt {

  prompt: string;         // 选择提示

  options: ChoiceOption[];

}




export interface ChoiceOption {

  text: string;           // 选项文本

  hint?: string;          // 提示

  // 选择后由 AI 生成结果

}




// 玩家选择结果

export interface ChoiceResultOutput {

  narrative: string;

  changes: AttributeChange[];

  spiritualRootChange?: SpiritualRootChange;

  newStatuses: StatusEntry[];

  newItems: ItemEntry[];

  // 选择结果后若仍需玩家继续决定（如拍卖会出价），可继续挂起下一段抉择。

  nextChoice?: ChoicePrompt;

  removedItemIds?: string[];

  newEquippedItems?: ItemEntry[];

  equipItemIds?: string[];

  unequipItemIds?: string[];

  memory: string;

  // 修炼心得（同 AIEventOutput；引擎权威计算来源条目，AI 只输出文本）

  cultivationInsight?: string;

  cultivationAttributes?: CultivationAttributeEntry[];

  causedDeath?: boolean;

  deathReason?: string;

  // ===== Task 20 新增 =====

  newNpcs?: Partial<WorldNpc>[];

  newThreads?: PendingThread[];

  advanceThreads?: { id: string; progressDelta: number; note?: string }[];

  completeThreadIds?: string[];

  failThreadIds?: string[];

  triggerCombat?: {

    enemies: CombatEnemy[];

    contextTitle: string;

    contextNarrative: string;

    victoryDrops?: ItemEntry[];

    defeatCost?: string;

  };

  // ===== Task 23 新增 =====

  newPets?: Pet[];

}




// 干扰模拟输出

export interface InterfereOutput {

  classification: InputClass;     // 输入分类

  accepted: boolean;              // 是否接受（false=静默拒绝）

  narrative: string;              // 回应叙事

  changes: AttributeChange[];     // 状态变更

  spiritualRootChange?: SpiritualRootChange;

  newStatuses: StatusEntry[];

  newItems: ItemEntry[];

  removedItemIds?: string[];

  newEquippedItems?: ItemEntry[];

  equipItemIds?: string[];

  unequipItemIds?: string[];

  memory: string;

  // 修炼心得（同 AIEventOutput；accepted=false 时可留空，引擎将保留旧文本；引擎权威计算来源条目）

  cultivationInsight?: string;

  cultivationAttributes?: CultivationAttributeEntry[];

  // 干扰可能延迟年龄推进

  ageAdvance?: number;            // 干扰消耗的时间（岁），默认 0

  // ===== Task 20 新增 =====

  newNpcs?: Partial<WorldNpc>[];

  newThreads?: PendingThread[];

  advanceThreads?: { id: string; progressDelta: number; note?: string }[];

  completeThreadIds?: string[];

  failThreadIds?: string[];

  // 干扰可能触发战斗（如玩家主动攻击某人、闯入妖兽领地）

  triggerCombat?: {

    enemies: CombatEnemy[];

    contextTitle: string;

    contextNarrative: string;

    victoryDrops?: ItemEntry[];

    defeatCost?: string;

  };

  // ===== Task 23 新增 =====

  newPets?: Pet[];

}




// ===== AI-99: Thread Chain =====

export interface ThreadChainNode {

  threadId: string;

  parentThreadId?: string;

  depth: number;

  generation: number;

  title?: string;

  category?: PendingThread['category'];

}
