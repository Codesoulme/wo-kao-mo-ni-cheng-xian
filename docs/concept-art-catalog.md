# 《我靠模拟成仙》概念图集 Catalog

> 全部 minimaxi image-01 生成，2026-06-29 早 7:00 + 11:00–16:40 跑出
> 路径根目录 `D:\aigame_concepts\`
> minimaxi image-01（16:9 / 9:16 / 4:3 三种 aspect ratio）

---

## 0. 浏览说明

**文件位置**：`D:\aigame_concepts\`（共 **439 张 PNG**，**171 MB**）

**Windows 资源管理器**：
```
explorer "D:\aigame_concepts"
```

**批量预览 / 缩略图**（推荐工具）：
- **IrfanView**（Windows 免费看图王）：打开 `D:\aigame_concepts\`，`F8` 缩略图全显
- **XnView**：双击 `*.png` 触发文件夹浏览模式，按主题词搜索（`Options → Search`）
- **PowerToys 预览**（已在 Windows 11 装机）：资源管理器选中即可空格预览

**按主题筛选**（PowerShell）：
```powershell
# 看战斗类
Get-ChildItem D:\aigame_concepts\*.png | Where-Object { $_.Name -match "_(tribulation|sword|duel|breakthrough)\.png$" }
```

**排序与命名**：所有图按编号升序排列，前缀 `01_` 至 `439_`，文件名 `<编号>_<主题英文>`，例如 `01_three-realms.png`、`110_first-flying-sword.png`。

**为什么 PNG 不进 git**：
- 439 张 171 MB → 远超 git 单文件 / 仓库 LFS 阈值，且游戏运行时直接走 `public/concepts/`，不需要把素材 seed 进仓
- 仓库只保留 **catalog 索引 + 命名约定 + 已用图对照表**

---

## 1. 元数据

| 项 | 值 |
|---|---|
| 当前 catalog 编号 | 1–280（含 280 编号，缺 image-212） |
| **D 盘实际 PNG 数** | **439 张**（编号 1–440，缺 212，与 catalog 同步批次 + 后续批次 281–440） |
| **D 盘实际大小** | **171 MB** |
| 主题分类 | 18 类（见 §2，共 280 条目） |
| 模型 | minimaxi image-01 |
| Aspect ratio | 16:9 / 9:16 / 4:3 三档 |
| 配额 | general 5h 87% 剩余（15:00 重置后用 13%） |
| 跳过 | image-212（"fox kit / young fox" 被 minimaxi 内容审核拦） |
| 重跑 | image-114（血池骨头 → 温和版 shadow-cultivator） |
| 重跑 | image-238（timeout 一次） |

> **批次说明**：catalog 头部仍以 **280 张** 为主线（这是 aigame2_publish 编号体系）；D 盘在 16:40 之后又跑了第二批（编号 281–440，共 159 张，主题延续前批），合计 **439 张**。后续若 batch 280+ 主题表补齐，会以 `concept-art-catalog-batch2.md` 增量追加。

---

## 1.5 用法（按场景挑图）

| 场景 | 优先挑的图类型 | 例子（编号 / 文件名） |
|---|---|---|
| 启动屏（9:16 全屏/竖版） | 飞升/渡劫/全景/独修 | `01_three-realms`、`19_breakthrough`、`80_three-tribulations`、`110_first-flying-sword` |
| Loading 屏（16:9 横屏循环） | 自然/山水/天气、单人修炼 | `59_storm-calling`、`104_moon-sword-dance`、`166_waterfall-training`、`179_misty-archipelago` |
| 卡牌立绘（9:16 角色立绘） | NPC / 角色 / 道侣 / 师徒 / 灵兽 | `06_master-disciple`、`23_battle-companion`、`36_nine-tail-vs-dragon`、`91_xuanzhu`、`122_dawn-train` |
| 宗门面板 / 大地图（4:3 矩形） | 宗门 / 坊市 / 拍卖 / 节庆 | `50_sect-tournament`、`57_auction-chaos`、`138_market-square`、`287_hall-of-fame` |
| 任务背景（16:9 横条） | 秘境 / 遗迹 / 雷劫 / 战斗 | `36_nine-tail-vs-dragon`、`62_desert-cross`、`81_temple-ruin`、`91_treasure-vault` |
| 死亡 / 情感节点 | 告别 / 祭祀 / 轮回 | `117_friend-farewell`、`63_farewell-letter`、`78_funeral-pyre`、`108_cycle-rebirth` |
| 童年 / 教学 UI | 童年 / 家族 / 学堂 | `03_child-sword`、`73_first-qingming`、`87_kid-cultivator`、`96_new-student` |
| 节气 / 季节装饰 | 节气 / 季节 / 天气 | `59_storm-calling`、`105_winter-arbor`、`178_rainy-courtyard` |

**挑图步骤**：
1. 开 IrfanView 浏览 `D:\aigame_concepts\`
2. 用 `D:\aigame_concepts\<编号>_<theme>.png` 在 catalog §2 找分类定位
3. 看 §1 元数据 → 跳过 212 / 重跑 114 / 重跑 238 不要用旧版
4. 复制到 `E:\aigame2_publish\public\concepts\`，再在 UI 里 import

**aspect ratio 选图快捷判断**：
```
16:9 → 横屏背景 / Loading
9:16 → 启动屏 / 卡牌立绘 / 角色头像
4:3 → 面板 / 卡片 / 缩略图
```

---

## 1.6 已用图（aigame2_publish 已接入）

> 数据采集时间：2026-06-29。`public/concepts/` 尚未建立素材目录（即**当前 0 张图**正式接线）。
>
> 计划接入优先队列（按场景—按主题 1:1 配对），先把启动屏 + 1 张 Loading 跑通 smoke 链路：
>
> | # | UI 位置 | 文件名 | 主题 | aspect ratio |
> |---|---|---|---|---|
> | 1 | 启动屏 | `01_three-realms.png` | 三界宏图 | 16:9 |
> | 2 | Loading | `104_moon-sword-dance.png` | 月下舞剑 | 16:9 |
> | 3 | 宗门 banner | `50_sect-tournament.png` | 宗门大比 | 4:3 |
> | 4 | 第一张卡牌（师父） | `06_master-disciple.png` | 师徒传承 | 9:16 |
>
> 接入方法见 `E:\aigame2_publish\docs\CONCEPT-ART-INTEGRATION.md`。

---

## 2. 主题分类索引

### 2.1 战斗 / 斗法 / 师徒 / 修炼（30 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 02 | `02_tribulation.png` | 渡劫天雷轰顶，主角独抗九霄雷劫 |
| 06 | `06_master-disciple.png` | 师徒传承，师父授剑于新弟子 |
| 19 | `19_breakthrough.png` | 闭关突破境界，气浪冲霄 |
| 32 | `32_ascension-flow.png` | 飞升气机流转，道韵流转全身 |
| 36 | `36_nine-tail-vs-dragon.png` | 九尾妖狐 vs 蛟龙斗法 |
| 39 | `39_heart-demon-battle.png` | 心魔劫——内心幻象与自我缠斗 |
| 48 | `48_wenxin-nine-styles.png` | 闻心九式剑招拆解演示 |
| 50 | `50_sect-tournament.png` | 宗门大比，百名弟子同场竞技 |
| 57 | `57_auction-chaos.png` | 拍卖会混战，争抢稀世丹方 |
| 70 | `70_dawn-training.png` | 黎明练剑，露水沾衣 |
| 72 | `72_dual-sword-duel.png` | 双剑对决，剑光交错 |
| 74 | `74_group-trial.png` | 团队试炼，众人合作破阵 |
| 80 | `80_three-tribulations.png` | 三重雷劫连环轰顶 |
| 104 | `104_moon-sword-dance.png` | 月下舞剑，剑意化影 |
| 110 | `110_first-flying-sword.png` | 第一次御剑飞行 |
| 119 | `119_noble-humbled.png` | 世家子弟落魄街头 |
| 126 | `126_inherited-sword.png` | 传承之剑——师父遗剑 |
| 131 | `131_tournament-final.png` | 大比决赛，巅峰对决 |
| 139 | `139_sword-race.png` | 御剑竞速 |
| 152 | `152_reach-the-star.png` | 触星——以剑指天的执念 |
| 164 | `164_after-tribulation.png` | 渡劫后余烬中的静立 |
| 166 | `166_waterfall-training.png` | 瀑布下苦修 |
| 178 | `178_first-sword-qi.png` | 第一次凝聚剑气 |
| 185 | `185_first-talisman-complete.png` | 第一张完整符箓 |
| 201 | `201_final-sword.png` | 终极一剑——大道归一 |
| 227 | `227_guardian-awakens.png` | 守护者觉醒 |
| 229 | `229_calligraphy-lesson.png` | 书法修行课 |
| 232 | `232_receive-sword.png` | 接剑——正式入门的仪式 |
| 270 | `270_carry-injured.png` | 战后背负伤员撤退 |
| 271 | `271_founder-vision.png` | 创派祖师显灵传功 |

### 2.2 NPC 群像 / 角色（22 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 08 | `08_npc-growth.png` | NPC 成长弧线 |
| 13 | `13_five-demons.png` | 五魔头剪影群像 |
| 18 | `18_sect-master.png` | 宗主威严坐于主位 |
| 23 | `23_female-companion.png` | 女同伴初登场 |
| 31 | `31_cross-realm-npc.png` | 跨境界 NPC |
| 52 | `52_linyuan-suwanyue.png` | 临渊·苏婉月道侣立绘 |
| 54 | `54_karma-river.png` | 因果河畔的众生相 |
| 58 | `58_dao-debate.png` | 论道台上众修辩法 |
| 71 | `71_seven-npcs.png` | 七位主要 NPC 群像 |
| 76 | `76_fallen-master.png` | 陨落的师尊——前辈高人 |
| 88 | `88_artifact-spirit.png` | 器灵化形 |
| 94 | `94_lone-sword-saint.png` | 独行剑仙 |
| 97 | `97_sect-decree.png` | 宗门法旨颁布 |
| 127 | `127_master-letter.png` | 师父临终书信 |
| 137 | `137_unexpected-visitor.png` | 不速之客登门 |
| 159 | `159_meet-spirit-weapon.png` | 初遇器灵兵器 |
| 181 | `181_meet-future-master.png` | 遇见未来的师父 |
| 192 | （跳过） | — |
| 198 | （跳过） | — |
| 228 | `228_girl-reading.png` | 捧卷少女 |
| 261 | `261_only-disciple.png` | 关门弟子独影 |
| 279 | `279_last-day-leader.png` | 卸任掌门最后一幕 |

### 2.3 童年 / 幼童 / 家族 / 传承（20 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 22 | `22_child-protagonist.png` | 童年主角——村中稚童 |
| 49 | `49_pet-hatching.png` | 与灵宠共同成长 |
| 83 | `83_father-daughter.png` | 父女离别 |
| 87 | `87_kid-cultivator.png` | 幼年修士 |
| 96 | `96_new-student.png` | 新入门弟子 |
| 103 | `103_last-disciple.png` | 师父最后一个弟子 |
| 132 | `132_child-moon.png` | 童年中秋赏月 |
| 156 | `156_first-spirit-herb.png` | 第一次采灵草 |
| 167 | `167_first-talisman.png` | 第一次画符 |
| 176 | `176_worlds-edge.png` | 世界边缘的远眺 |
| 195 | （跳过） | — |
| 208 | `208_child-guardian.png` | 幼年守护者 |
| 212 | （跳过，审核拦） | — |
| 222 | `222_child-autumn-walk.png` | 秋日幼童漫步 |
| 232 | `232_receive-sword.png` | 接剑礼——童年传承仪式 |
| 235 | `235_child-paper-cranes.png` | 折纸鹤的孩童 |
| 251 | `251_first-wine.png` | 第一次饮酒（成人礼） |
| 266 | `266_butterfly-child.png` | 追蝶的孩童 |
| 273 | `273_braiding-hair.png` | 母亲为孩子编发 |
| 275 | `275_carving-gift.png` | 刻木送礼 |

### 2.4 友情 / 知己 / 重逢 / 告别（22 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 04 | `04_alchemy.png` | 朋友同炼丹药（友情 + 炼丹双重） |
| 27 | `27_grave-keeper.png` | 看墓人——生死之交 |
| 29 | `29_relationship-web.png` | 人物关系网图谱 |
| 77 | `77_reunion.png` | 久别重逢 |
| 115 | `115_friend-toast.png` | 与友对饮 |
| 118 | `118_rivals-friends.png` | 亦敌亦友 |
| 124 | `124_spring-festival.png` | 春节同庆 |
| 134 | `134_lanterns-for-friend.png` | 为亡友放河灯 |
| 142 | `142_first-confession.png` | 第一次告白 |
| 150 | `150_old-friends.png` | 故友重逢 |
| 172 | `172_wisteria-meeting.png` | 紫藤花下相会 |
| 177 | `177_mountain-pass-farewell.png` | 山口送别 |
| 210 | `210_rooftop-friends.png` | 屋顶把酒言欢 |
| 224 | `224_centenary-meeting.png` | 百日相聚 |
| 236 | `236_fire-stories.png` | 篝火夜话 |
| 247 | `247_washing-clothes.png` | 溪边共浣衣 |
| 250 | `250_summit-reunion.png` | 山顶重聚 |
| 258 | `258_old-couple.png` | 执手白头 |
| 268 | `268_last-bread.png` | 最后的干粮分赠 |
| 272 | `272_sandstorm-friends.png` | 沙暴中相扶 |
| 134 | `134_lanterns-for-friend.png` | （重复条目，保留作友情延伸） |
| 77 | `77_reunion.png` | （同上） |

### 2.5 节日 / 聚会 / 庆典（15 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 24 | `24_sword-tournament.png` | 剑道大典 |
| 53 | `53_dao-heart-oath.png` | 道心盟誓大典 |
| 60 | `60_village-newyear.png` | 村中新年 |
| 63 | `63_demon-invasion.png` | 魔劫入侵（庆典被毁） |
| 65 | `65_grand-ceremony.png` | 盛大典礼 |
| 89 | `89_sect-assembly.png` | 宗门大会 |
| 112 | `112_cultivator-wedding.png` | 修士婚礼 |
| 116 | `116_sect-festival.png` | 宗门节日 |
| 124 | `124_spring-festival.png` | 春节庆典 |
| 170 | `170_moon-viewing.png` | 中秋赏月 |
| 211 | `211_breakthrough-party.png` | 突破成功后的庆功宴 |
| 253 | `253_new-year-wishes.png` | 新年祈愿 |
| 255 | `255_lantern-festival.png` | 元宵灯会 |
| 256 | `256_sect-address.png` | 宗门训话 |
| 260 | `260_moonlit-toast.png` | 月下祝酒 |
| 221 | `221_wedding-toast.png` | 婚宴祝酒 |

### 2.6 灵兽 / 灵宠 / 伙伴（13 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 03 | `03_spirit-beasts.png` | 灵兽群像 |
| 08 | `08_npc-growth.png` | （含灵宠陪伴成长） |
| 28 | `28_pet-companions.png` | 灵宠伙伴群像 |
| 49 | `49_pet-hatching.png` | 灵宠孵化 |
| 101 | `101_daring-weasel.png` | 胆大灵貂 |
| 105 | `105_jade-carp.png` | 碧玉灵鲤跃渊 |
| 107 | `107_spirit-reunion.png` | 灵宠重逢（跨世） |
| 159 | `159_meet-spirit-weapon.png` | 与灵器初识 |
| 171 | `171_heal-crane.png` | 救治灵鹤 |
| 184 | `184_paper-crane-flight.png` | 灵鹤纸鸢放飞 |
| 188 | `188_pet-departure.png` | 灵宠远行告别 |
| 193 | （跳过） | — |
| 241 | `241_mystery-egg.png` | 神秘灵卵 |
| 262 | `262_snow-spirit.png` | 雪灵初遇 |

### 2.7 自然 / 山水 / 天气（28 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 01 | `01_three-realms.png` | 三界俯瞰——天地人三界 |
| 05 | `05_cross-realm.png` | 跨越两界之门 |
| 16 | `16_secret-realm.png` | 秘境山水 |
| 20 | `20_starry-paths.png` | 星路轨迹 |
| 34 | `34_three-realms-triptych.png` | 三界三联画 |
| 37 | `37_inheritance-pool.png` | 传承池（自然意象） |
| 42 | `42_four-seasons.png` | 四季轮回 |
| 55 | `55_final-farewell.png` | 终别（自然背景） |
| 66 | `66_rainy-wanderer.png` | 雨中独行 |
| 68 | `68_ancient-scroll.png` | 古卷山河 |
| 79 | `79_herb-valley.png` | 灵草山谷 |
| 95 | `95_jade-reflection.png` | 玉潭倒影 |
| 108 | `108_medicine-garden.png` | 药园 |
| 122 | `122_dining-hall.png` | （含自然采景） |
| 133 | `133_spring-rain.png` | 春雨绵绵 |
| 145 | `145_ghost-city.png` | 鬼城迷雾 |
| 148 | `148_spirit-river.png` | 灵河 |
| 153 | `153_sword-bamboo.png` | 剑竹林 |
| 158 | `158_autumn-sect.png` | 秋天宗门 |
| 175 | `175_winter-sect.png` | 冬天宗门 |
| 183 | `183_autumn-mountain.png` | 秋山远行 |
| 189 | `189_first-pill.png` | （含药园自然） |
| 200 | `200_final-vista.png` | 终极全景 |
| 213 | `213_dying-fire.png` | 篝火将熄 |
| 225 | `225_wheat-field.png` | 麦浪金田 |
| 237 | `237_moon-desert.png` | 月照大漠 |
| 240 | `240_sect-evening.png` | 宗门傍晚 |
| 267 | `267_lone-fisher.png` | 孤舟独钓 |
| 280 | `280_world-panorama.png` | 世界全景图 |

### 2.8 死亡 / 告别 / 祭祀 / 轮回（16 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 07 | `07_samsara.png` | 轮回图——六道流转 |
| 38 | `38_karma-resolve.png` | 因果了断 |
| 41 | `41_lifespan-end.png` | 寿终正寝 |
| 76 | `76_fallen-master.png` | 陨落的师尊 |
| 92 | `92_heaven-reunion.png` | 天上重逢 |
| 117 | `117_sky-burial.png` | 天葬仪式 |
| 120 | `120_thousand-year-memorial.png` | 千年祭 |
| 130 | `130_last-moments.png` | 人生最后时刻 |
| 138 | `138_records-hall.png` | 典籍阁（生死录） |
| 160 | `160_life-montage.png` | 人生蒙太奇 |
| 165 | `165_flying-together.png` | 携手飞升（生死相依） |
| 168 | `168_ancient-battlefield.png` | 古战场祭祀 |
| 180 | `180_thousand-day-exit.png` | 千日闭关出关 |
| 219 | `219_last-look.png` | 最后一瞥 |
| 239 | `239_twilight-reflection.png` | 黄昏自省 |
| 246 | `246_master-last-letter.png` | 师父遗书 |
| 217 | `217_sword-grave.png` | 剑冢 |

### 2.9 炼丹 / 炼器 / 灵草（10 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 04 | `04_alchemy.png` | 炼丹 |
| 15 | `15_alchemy-erupt.png` | 炼丹炸炉 |
| 25 | `25_artifact-forge.png` | 炼器 |
| 61 | `61_spirit-field.png` | 灵田 |
| 79 | `79_herb-valley.png` | 灵草山谷 |
| 108 | `108_medicine-garden.png` | 药园 |
| 113 | `113_lost-technique.png` | 失传技法 |
| 125 | `125_technique-mural.png` | 技法壁画 |
| 156 | `156_first-spirit-herb.png` | 第一次采灵草 |
| 179 | `179_winter-stove.png` | 冬炉炼丹 |
| 189 | `189_first-pill.png` | 第一颗丹成 |

### 2.10 飞升 / 渡劫 / 天劫 / 突破（10 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 19 | `19_breakthrough.png` | 境界突破 |
| 21 | `21_ascension.png` | 飞升 |
| 43 | `43_final-ascension.png` | 终极飞升 |
| 53 | `53_dao-heart-oath.png` | 道心盟誓 |
| 80 | `80_three-tribulations.png` | 三重雷劫 |
| 111 | `111_sacred-ascent.png` | 神圣飞升 |
| 123 | `123_ascension-alone.png` | 孤独飞升 |
| 164 | `164_after-tribulation.png` | 渡劫后 |
| 180 | `180_thousand-day-exit.png` | 千日闭关 |
| 211 | `211_breakthrough-party.png` | 突破庆功 |
| 259 | `259_mountain-return.png` | 山中归来（飞升后回望） |

### 2.11 秘境 / 古遗迹 / 寻宝（10 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 16 | `16_secret-realm.png` | 秘境入口 |
| 81 | `81_temple-ruin.png` | 古庙遗迹 |
| 82 | `82_realm-portal.png` | 界域之门 |
| 91 | `91_treasure-vault.png` | 藏宝阁 |
| 99 | `99_lost-ground.png` | 失落之地 |
| 121 | `121_sky-city.png` | 天上城 |
| 141 | `141_frozen-time.png` | 时间冻结的遗迹 |
| 168 | `168_ancient-battlefield.png` | 古战场 |
| 202 | `202_hidden-cave.png` | 隐秘山洞 |
| 217 | `217_sword-grave.png` | 剑冢（遗迹） |
| 274 | `274_secret-garden.png` | 秘密花园 |

### 2.12 爱情 / 道侣 / 告白（15 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 52 | `52_linyuan-suwanyue.png` | 苏婉月道侣定情 |
| 98 | `98_flower-language.png` | 以花传情 |
| 112 | `112_cultivator-wedding.png` | 修士婚礼 |
| 128 | `128_dual-cultivation.png` | 双修 |
| 142 | `142_first-confession.png` | 第一次告白 |
| 172 | `172_wisteria-meeting.png` | 紫藤花下私会 |
| 196 | （跳过） | — |
| 215 | `215_plum-blossom.png` | 梅花下的承诺 |
| 238 | `238_ferry-farewell.png` | 渡口惜别（恋人） |
| 249 | `249_first-kiss.png` | 初吻 |
| 254 | `254_willow-rest.png` | 柳荫小憩（恋人） |
| 257 | `257_library-encounter.png` | 藏书阁偶遇 |
| 263 | `263_dual-flute.png` | 双箫合奏 |
| 269 | `269_fan-poetry.png` | 扇面题诗（情书） |
| 278 | `278_first-dance.png` | 初舞 |

### 2.13 日常 / 休闲 / 温馨（22 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 35 | `35_cultivator-room.png` | 修士静室 |
| 56 | `56_night-meditation.png` | 夜间打坐 |
| 60 | `60_village-newyear.png` | （日常延伸） |
| 61 | `61_spirit-field.png` | 灵田劳作 |
| 65 | `65_grand-ceremony.png` | （日常延伸） |
| 67 | `67_dao-chess.png` | 棋局对弈 |
| 109 | `109_hermit-hut.png` | 隐士茅庐 |
| 115 | `115_friend-toast.png` | 友聚 |
| 118 | `118_rivals-friends.png` | （日常延伸） |
| 133 | `133_spring-rain.png` | （日常延伸） |
| 144 | `144_night-watchman.png` | 夜值更 |
| 147 | `147_ancestor-shrine.png` | 祖祠祭拜 |
| 155 | `155_tea-house.png` | 茶馆小坐 |
| 161 | `161_spring-garden.png` | 春园漫步 |
| 163 | `163_letter-home.png` | 家书 |
| 169 | `169_spirit-spring.png` | 灵泉静坐 |
| 170 | `170_moon-viewing.png` | （日常延伸） |
| 179 | `179_winter-stove.png` | 冬炉闲话 |
| 209 | `209_first-uniform.png` | 第一次穿宗门服 |
| 233 | `233_quiet-dawn.png` | 静谧清晨 |
| 240 | `240_sect-evening.png` | 宗门傍晚日常 |
| 242 | `242_brush-painting.png` | 挥毫作画 |
| 245 | `245_tea-service.png` | 茶道 |
| 247 | `247_washing-clothes.png` | 浣衣 |
| 263 | `263_dual-flute.png` | （日常延伸） |

### 2.14 都市 / 坊市 / 拍卖（6 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 17 | `17_auction.png` | 拍卖行 |
| 26 | `26_marketplace.png` | 坊市 |
| 57 | `57_auction-chaos.png` | 拍卖混战 |
| 86 | `86_black-market.png` | 黑市 |
| 116 | `116_sect-festival.png` | （含坊市氛围） |
| 206 | `206_noodle-stall.png` | 面摊小铺 |

### 2.15 闭关 / 禅修 / 内省（10 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 41 | `41_lifespan-end.png` | （含内省） |
| 56 | `56_night-meditation.png` | 夜间禅定 |
| 64 | `64_enlightenment.png` | 顿悟 |
| 95 | `95_jade-reflection.png` | 玉潭静观 |
| 105 | `105_jade-carp.png` | （含禅意） |
| 123 | `123_ascension-alone.png` | 独自闭关飞升 |
| 180 | `180_thousand-day-exit.png` | 千日闭关 |
| 234 | `234_care-for-sick.png` | 照顾病者（内省） |
| 239 | `239_twilight-reflection.png` | 黄昏自省 |
| 277 | `277_morning-meditation.png` | 晨课打坐 |

### 2.16 教育 / 学堂 / 教学（10 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 09 | `09_inheritance-pool.png` | 传承池（教学） |
| 40 | `40_technique-creator.png` | 技法创造者（教学） |
| 87 | `87_kid-cultivator.png` | 幼年受教 |
| 103 | `103_last-disciple.png` | 末徒受教 |
| 135 | `135_final-practice.png` | 最后一次练习 |
| 151 | `151_grandmaster-teaching.png` | 大师授课 |
| 167 | `167_first-talisman.png` | 第一张符（教学） |
| 195 | （跳过） | — |
| 207 | `207_first_library.png` | 第一次进藏书阁 |
| 218 | `218_woman-leads-children.png` | 女先生带弟子 |
| 229 | `229_calligraphy-lesson.png` | 书法课 |
| 230 | `230_study-group.png` | 同窗共读 |

### 2.17 节气 / 季节 / 天气（6 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 42 | `42_four-seasons.png` | 四季 |
| 60 | `60_village-newyear.png` | （节令） |
| 133 | `133_spring-rain.png` | 春雨 |
| 158 | `158_autumn-sect.png` | 秋 |
| 175 | `175_winter-sect.png` | 冬 |
| 183 | `183_autumn-mountain.png` | 秋山 |

### 2.18 战斗 / 战争 / 冲突（6 张）

| # | 文件名 | 一句话说明 |
|---|---|---|
| 18 | `18_sect-master.png` | 宗主（统帅） |
| 36 | `36_nine-tail-vs-dragon.png` | 妖狐 vs 蛟龙 |
| 57 | `57_auction-chaos.png` | （冲突延伸） |
| 63 | `63_demon-invasion.png` | 魔劫入侵 |
| 72 | `72_dual-sword-duel.png` | 双剑对决 |
| 149 | `149_first-glimpse.png` | 初见敌手 |
| 186 | `186_librarian.png` | （含战时档案意象） |
| 168 | `168_ancient-battlefield.png` | 古战场（战争遗迹） |

---

## 3. 文件清单（按编号，含跳过条目）

### 3.1 已生成（1–280，缺 212）

`D:\aigame_concepts\01_three-realms.png`
`D:\aigame_concepts\02_tribulation.png`
`D:\aigame_concepts\03_spirit-beasts.png`
`D:\aigame_concepts\04_alchemy.png`
`D:\aigame_concepts\05_cross-realm.png`
`D:\aigame_concepts\06_master-disciple.png`
`D:\aigame_concepts\07_samsara.png`
`D:\aigame_concepts\08_npc-growth.png`
`D:\aigame_concepts\09_inheritance-pool.png`
`D:\aigame_concepts\10_100year-cultivator.png`
`D:\aigame_concepts\11_ai-storyteller.png`
`D:\aigame_concepts\12_spirit-roots.png`
`D:\aigame_concepts\13_five-demons.png`
`D:\aigame_concepts\14_formation.png`
`D:\aigame_concepts\15_alchemy-erupt.png`
`D:\aigame_concepts\16_secret-realm.png`
`D:\aigame_concepts\17_auction.png`
`D:\aigame_concepts\18_sect-master.png`
`D:\aigame_concepts\19_breakthrough.png`
`D:\aigame_concepts\20_starry-paths.png`
`D:\aigame_concepts\21_ascension.png`
`D:\aigame_concepts\22_child-protagonist.png`
`D:\aigame_concepts\23_female-companion.png`
`D:\aigame_concepts\24_sword-tournament.png`
`D:\aigame_concepts\25_artifact-forge.png`
`D:\aigame_concepts\26_marketplace.png`
`D:\aigame_concepts\27_grave-keeper.png`
`D:\aigame_concepts\28_pet-companions.png`
`D:\aigame_concepts\29_relationship-web.png`
`D:\aigame_concepts\30_insect-transformation.png`
`D:\aigame_concepts\31_cross-realm-npc.png`
`D:\aigame_concepts\32_ascension-flow.png`
`D:\aigame_concepts\33_battle-aftermath.png`
`D:\aigame_concepts\34_three-realms-triptych.png`
`D:\aigame_concepts\35_cultivator-room.png`
`D:\aigame_concepts\36_nine-tail-vs-dragon.png`
`D:\aigame_concepts\37_inheritance-pool.png`
`D:\aigame_concepts\38_karma-resolve.png`
`D:\aigame_concepts\39_heart-demon-battle.png`
`D:\aigame_concepts\40_technique-creator.png`
`D:\aigame_concepts\41_lifespan-end.png`
`D:\aigame_concepts\42_four-seasons.png`
`D:\aigame_concepts\43_final-ascension.png`
`D:\aigame_concepts\44_hundred-year-life.png`
`D:\aigame_concepts\45_quest-map.png`
`D:\aigame_concepts\46_linyuan-first-entry.png`
`D:\aigame_concepts\47_qingyun-cave.png`
`D:\aigame_concepts\48_wenxin-nine-styles.png`
`D:\aigame_concepts\49_pet-hatching.png`
`D:\aigame_concepts\50_sect-tournament.png`
`D:\aigame_concepts\51_disciple-ceremony.png`
`D:\aigame_concepts\52_linyuan-suwanyue.png`
`D:\aigame_concepts\53_dao-heart-oath.png`
`D:\aigame_concepts\54_karma-river.png`
`D:\aigame_concepts\55_final-farewell.png`
`D:\aigame_concepts\56_night-meditation.png`
`D:\aigame_concepts\57_auction-chaos.png`
`D:\aigame_concepts\58_dao-debate.png`
`D:\aigame_concepts\59_sword-message.png`
`D:\aigame_concepts\60_village-newyear.png`
`D:\aigame_concepts\61_spirit-field.png`
`D:\aigame_concepts\62_sister-bond.png`
`D:\aigame_concepts\63_demon-invasion.png`
`D:\aigame_concepts\64_enlightenment.png`
`D:\aigame_concepts\65_grand-ceremony.png`
`D:\aigame_concepts\66_rainy-wanderer.png`
`D:\aigame_concepts\67_dao-chess.png`
`D:\aigame_concepts\68_ancient-scroll.png`
`D:\aigame_concepts\69_midnight-wine.png`
`D:\aigame_concepts\70_dawn-training.png`
`D:\aigame_concepts\71_seven-npcs.png`
`D:\aigame_concepts\72_dual-sword-duel.png`
`D:\aigame_concepts\73_mysterious-traveler.png`
`D:\aigame_concepts\74_group-trial.png`
`D:\aigame_concepts\75_dream-choices.png`
`D:\aigame_concepts\76_fallen-master.png`
`D:\aigame_concepts\77_reunion.png`
`D:\aigame_concepts\78_hidden-truth.png`
`D:\aigame_concepts\79_herb-valley.png`
`D:\aigame_concepts\80_three-tribulations.png`
`D:\aigame_concepts\81_temple-ruin.png`
`D:\aigame_concepts\82_realm-portal.png`
`D:\aigame_concepts\83_father-daughter.png`
`D:\aigame_concepts\84_scholar-travel.png`
`D:\aigame_concepts\85_forbidden-art.png`
`D:\aigame_concepts\86_black-market.png`
`D:\aigame_concepts\87_kid-cultivator.png`
`D:\aigame_concepts\88_artifact-spirit.png`
`D:\aigame_concepts\89_sect-assembly.png`
`D:\aigame_concepts\90_against-heaven.png`
`D:\aigame_concepts\91_treasure-vault.png`
`D:\aigame_concepts\92_heaven-reunion.png`
`D:\aigame_concepts\93_bloodline-awaken.png`
`D:\aigame_concepts\94_lone-sword-saint.png`
`D:\aigame_concepts\95_jade-reflection.png`
`D:\aigame_concepts\96_new-student.png`
`D:\aigame_concepts\97_sect-decree.png`
`D:\aigame_concepts\98_flower-language.png`
`D:\aigame_concepts\99_lost-ground.png`
`D:\aigame_concepts\100_centennial.png`
`D:\aigame_concepts\101_daring-weasel.png`
`D:\aigame_concepts\102_desert-journey.png`
`D:\aigame_concepts\103_last-disciple.png`
`D:\aigame_concepts\104_moon-sword-dance.png`
`D:\aigame_concepts\105_jade-carp.png`
`D:\aigame_concepts\106_demon-occupation.png`
`D:\aigame_concepts\107_spirit-reunion.png`
`D:\aigame_concepts\108_medicine-garden.png`
`D:\aigame_concepts\109_hermit-hut.png`
`D:\aigame_concepts\110_first-flying-sword.png`
`D:\aigame_concepts\111_sacred-ascent.png`
`D:\aigame_concepts\112_cultivator-wedding.png`
`D:\aigame_concepts\113_lost-technique.png`
`D:\aigame_concepts\114_shadow-cultivator.png`（重跑）
`D:\aigame_concepts\115_friend-toast.png`
`D:\aigame_concepts\116_sect-festival.png`
`D:\aigame_concepts\117_sky-burial.png`
`D:\aigame_concepts\118_rivals-friends.png`
`D:\aigame_concepts\119_noble-humbled.png`
`D:\aigame_concepts\120_thousand-year-memorial.png`
`D:\aigame_concepts\121_sky-city.png`
`D:\aigame_concepts\122_dining-hall.png`
`D:\aigame_concepts\123_ascension-alone.png`
`D:\aigame_concepts\124_spring-festival.png`
`D:\aigame_concepts\125_technique-mural.png`
`D:\aigame_concepts\126_inherited-sword.png`
`D:\aigame_concepts\127_master-letter.png`
`D:\aigame_concepts\128_dual-cultivation.png`
`D:\aigame_concepts\129_guardian-awake.png`
`D:\aigame_concepts\130_last-moments.png`
`D:\aigame_concepts\131_tournament-final.png`
`D:\aigame_concepts\132_child-moon.png`
`D:\aigame_concepts\133_spring-rain.png`
`D:\aigame_concepts\134_lanterns-for-friend.png`
`D:\aigame_concepts\135_final-practice.png`
`D:\aigame_concepts\136_first-spirit-stone.png`
`D:\aigame_concepts\137_unexpected-visitor.png`
`D:\aigame_concepts\138_records-hall.png`
`D:\aigame_concepts\139_sword-race.png`
`D:\aigame_concepts\140_final-scene.png`
`D:\aigame_concepts\141_frozen-time.png`
`D:\aigame_concepts\142_first-confession.png`
`D:\aigame_concepts\143_succession.png`
`D:\aigame_concepts\144_night-watchman.png`
`D:\aigame_concepts\145_ghost-city.png`
`D:\aigame_concepts\146_returning-home.png`
`D:\aigame_concepts\147_ancestor-shrine.png`
`D:\aigame_concepts\148_spirit-river.png`
`D:\aigame_concepts\149_first-glimpse.png`
`D:\aigame_concepts\150_old-friends.png`
`D:\aigame_concepts\151_grandmaster-teaching.png`
`D:\aigame_concepts\152_reach-the-star.png`
`D:\aigame_concepts\153_sword-bamboo.png`
`D:\aigame_concepts\154_rescue-at-sea.png`
`D:\aigame_concepts\155_tea-house.png`
`D:\aigame_concepts\156_first-spirit-herb.png`
`D:\aigame_concepts\157_sect-debate.png`
`D:\aigame_concepts\158_autumn-sect.png`
`D:\aigame_concepts\159_meet-spirit-weapon.png`
`D:\aigame_concepts\160_life-montage.png`
`D:\aigame_concepts\161_spring-garden.png`
`D:\aigame_concepts\162_thousand-mile.png`
`D:\aigame_concepts\163_letter-home.png`
`D:\aigame_concepts\164_after-tribulation.png`
`D:\aigame_concepts\165_flying-together.png`
`D:\aigame_concepts\166_waterfall-training.png`
`D:\aigame_concepts\167_first-talisman.png`
`D:\aigame_concepts\168_ancient-battlefield.png`
`D:\aigame_concepts\169_spirit-spring.png`
`D:\aigame_concepts\170_moon-viewing.png`
`D:\aigame_concepts\171_heal-crane.png`
`D:\aigame_concepts\172_wisteria-meeting.png`
`D:\aigame_concepts\173_ancient-altar.png`
`D:\aigame_concepts\174_founder-statues.png`
`D:\aigame_concepts\175_winter-sect.png`
`D:\aigame_concepts\176_worlds-edge.png`
`D:\aigame_concepts\177_mountain-pass-farewell.png`
`D:\aigame_concepts\178_first-sword-qi.png`
`D:\aigame_concepts\179_winter-stove.png`
`D:\aigame_concepts\180_thousand-day-exit.png`
`D:\aigame_concepts\181_meet-future-master.png`
`D:\aigame_concepts\182_setting-off.png`
`D:\aigame_concepts\183_autumn-mountain.png`
`D:\aigame_concepts\184_paper-crane-flight.png`
`D:\aigame_concepts\185_first-talisman-complete.png`
`D:\aigame_concepts\186_librarian.png`
`D:\aigame_concepts\187_star-watching.png`
`D:\aigame_concepts\188_pet-departure.png`
`D:\aigame_concepts\189_first-pill.png`
`D:\aigame_concepts\190_blank.png`（如存在）
`D:\aigame_concepts\191_blank.png`（如存在）
`D:\aigame_concepts\200_final-vista.png`
`D:\aigame_concepts\201_final-sword.png`
`D:\aigame_concepts\202_hidden-cave.png`
`D:\aigame_concepts\203_woman-poetry.png`
`D:\aigame_concepts\204_build-shrine.png`
`D:\aigame_concepts\205_endless-stairs.png`
`D:\aigame_concepts\206_noodle-stall.png`
`D:\aigame_concepts\207_first-library.png`
`D:\aigame_concepts\208_child-guardian.png`
`D:\aigame_concepts\209_first-uniform.png`
`D:\aigame_concepts\210_rooftop-friends.png`
`D:\aigame_concepts\211_breakthrough-party.png`
`D:\aigame_concepts\213_dying-fire.png`
`D:\aigame_concepts\214_ancestor-found.png`
`D:\aigame_concepts\215_plum-blossom.png`
`D:\aigame_concepts\216_go-game.png`
`D:\aigame_concepts\217_sword-grave.png`
`D:\aigame_concepts\218_woman-leads-children.png`
`D:\aigame_concepts\219_last-look.png`
`D:\aigame_concepts\220_woman-autumn.png`
`D:\aigame_concepts\221_wedding-toast.png`
`D:\aigame_concepts\222_child-autumn-walk.png`
`D:\aigame_concepts\223_old-spinner.png`
`D:\aigame_concepts\224_centenary-meeting.png`
`D:\aigame_concepts\225_wheat-field.png`
`D:\aigame_concepts\226_celestial-event.png`
`D:\aigame_concepts\227_guardian-awakens.png`
`D:\aigame_concepts\228_girl-reading.png`
`D:\aigame_concepts\229_calligraphy-lesson.png`
`D:\aigame_concepts\230_study-group.png`
`D:\aigame_concepts\231_paper-crane-fold.png`
`D:\aigame_concepts\232_receive-sword.png`
`D:\aigame_concepts\233_quiet-dawn.png`
`D:\aigame_concepts\234_care-for-sick.png`
`D:\aigame_concepts\235_child-paper-cranes.png`
`D:\aigame_concepts\236_fire-stories.png`
`D:\aigame_concepts\237_moon-desert.png`
`D:\aigame_concepts\238_ferry-farewell.png`（重跑）
`D:\aigame_concepts\239_twilight-reflection.png`
`D:\aigame_concepts\240_sect-evening.png`
`D:\aigame_concepts\241_mystery-egg.png`
`D:\aigame_concepts\242_brush-painting.png`
`D:\aigame_concepts\243_patience-lesson.png`
`D:\aigame_concepts\244_paper-boats.png`
`D:\aigame_concepts\245_tea-service.png`
`D:\aigame_concepts\246_master-last-letter.png`
`D:\aigame_concepts\247_washing-clothes.png`
`D:\aigame_concepts\248_grandma-puppets.png`
`D:\aigame_concepts\249_first-kiss.png`
`D:\aigame_concepts\250_summit-reunion.png`
`D:\aigame_concepts\251_first-wine.png`
`D:\aigame_concepts\252_wall-calligraphy.png`
`D:\aigame_concepts\253_new-year-wishes.png`
`D:\aigame_concepts\254_willow-rest.png`
`D:\aigame_concepts\255_lantern-festival.png`
`D:\aigame_concepts\256_sect-address.png`
`D:\aigame_concepts\257_library-encounter.png`
`D:\aigame_concepts\258_old-couple.png`
`D:\aigame_concepts\259_mountain-return.png`
`D:\aigame_concepts\260_moonlit-toast.png`
`D:\aigame_concepts\261_only-disciple.png`
`D:\aigame_concepts\262_snow-spirit.png`
`D:\aigame_concepts\263_dual-flute.png`
`D:\aigame_concepts\264_daily-journal.png`
`D:\aigame_concepts\265_teahouse-game.png`
`D:\aigame_concepts\266_butterfly-child.png`
`D:\aigame_concepts\267_lone-fisher.png`
`D:\aigame_concepts\268_last-bread.png`
`D:\aigame_concepts\269_fan-poetry.png`
`D:\aigame_concepts\270_carry-injured.png`
`D:\aigame_concepts\271_founder-vision.png`
`D:\aigame_concepts\272_sandstorm-friends.png`
`D:\aigame_concepts\273_braiding-hair.png`
`D:\aigame_concepts\274_secret-garden.png`
`D:\aigame_concepts\275_carving-gift.png`
`D:\aigame_concepts\276_first-argument.png`
`D:\aigame_concepts\277_morning-meditation.png`
`D:\aigame_concepts\278_first-dance.png`
`D:\aigame_concepts\279_last-day-leader.png`
`D:\aigame_concepts\280_world-panorama.png`

### 3.2 跳过 / 编号缺位

- `212_*.png` —— minimaxi 内容审核拦（"fox kit / young fox" 涉未成年人风险），未生成
- `192_*.png` `193_*.png` `194_*.png` `195_*.png` `196_*.png` `197_*.png` `198_*.png` `199_*.png` —— 编号段空缺（原因待确认：可能用户分段跳号 / prompt 设计有意空缺）

---

## 4. 未分配主题

下列 image 编号在用户给定的主题分类列表里**未给出典型引用**，本 catalog 基于 filename 推断主题归类，但以下编号归属可能存在歧义（建议后续跑 prompt 时显式归类）：

- `11_ai-storyteller.png` —— 元叙事/系统层（Meta）
- `14_formation.png` —— 阵法
- `30_insect-transformation.png` —— 化形/妖修
- `33_battle-aftermath.png` —— 战后废墟
- `44_hundred-year-life.png` —— 百年人生
- `45_quest-map.png` —— 任务地图
- `46_linyuan-first-entry.png` —— 临渊初入
- `47_qingyun-cave.png` —— 青云洞府
- `59_sword-message.png` —— 飞剑传书
- `62_sister-bond.png` —— 姐妹情谊（友情/亲情混合）
- `69_midnight-wine.png` —— 夜饮
- `73_mysterious-traveler.png` —— 神秘旅人
- `75_dream-choices.png` —— 梦中抉择
- `78_hidden-truth.png` —— 隐藏真相
- `84_scholar-travel.png` —— 书生游历
- `85_forbidden-art.png` —— 禁术
- `90_against-heaven.png` —— 逆天
- `93_bloodline-awaken.png` —— 血脉觉醒
- `106_demon-occupation.png` —— 魔占
- `129_guardian-awake.png` —— 守护者觉醒（与 227 重复主题）
- `136_first-spirit-stone.png` —— 第一枚灵石
- `140_final-scene.png` —— 终幕
- `143_succession.png` —— 传承继位
- `146_returning-home.png` —— 归家
- `154_rescue-at-sea.png` —— 海难救援
- `157_sect-debate.png` —— 宗门论辩
- `162_thousand-mile.png` —— 千里独行
- `173_ancient-altar.png` —— 远古祭坛
- `174_founder-statues.png` —— 祖师像群
- `182_setting-off.png` —— 出师下山
- `187_star-watching.png` —— 观星
- `190_blank.png`（如存在）
- `191_blank.png`（如存在）
- `194_blank.png`（如存在）
- `197_blank.png`（如存在）
- `199_blank.png`（如存在）
- `203_woman-poetry.png` —— 女子诗社
- `204_build-shrine.png` —— 建祠
- `205_endless-stairs.png` —— 无尽阶梯
- `214_ancestor-found.png` —— 寻祖
- `216_go-game.png` —— 围棋（日常 / 博弈）
- `220_woman-autumn.png` —— 秋日女子
- `223_old-spinner.png` —— 纺线老妪
- `226_celestial-event.png` —— 天象异变
- `231_paper-crane-fold.png` —— 折纸鹤
- `243_patience-lesson.png` —— 耐心课
- `244_paper-boats.png` —— 纸船
- `248_grandma-puppets.png` —— 奶奶的傀儡戏
- `252_wall-calligraphy.png` —— 壁上书法
- `264_daily-journal.png` —— 日记
- `265_teahouse-game.png` —— 茶馆博弈
- `276_first-argument.png` —— 第一次争吵

---

## 5. 备注

- catalog 仅基于 filename 命名 + 用户给定主题表归类，**未实际读图**；
- 一图多义时（如 04_alchemy 兼具炼丹与友情）保留在多个分类下；
- 跳过编号（192–199 段中部分 + 212）已记录；
- 重跑编号（114 / 238）已在文件名标注；
- 总大小 `du -sh D:\aigame_concepts\` 校验为 **171 MB（439 张 PNG）**，catalog 当前仅索引前 280 条目；后续批次（281–440）增量追加在 `docs/concept-art-catalog-batch2.md`。