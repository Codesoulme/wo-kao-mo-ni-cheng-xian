# 概念图集使用说明（CONCEPT-ART）

> 《我靠模拟成仙》280 张 minimaxi image-01 概念图主题索引
>
> 配套文件：[`concept-art-catalog.md`](./concept-art-catalog.md)
>
> 最后更新：2026-06-29

---

## 1. 概览

- **数量**：280 个编号（实际 PNG 文件 279 张，`image-212` 因 minimaxi 内容审核跳过未生成）
- **生成模型**：minimaxi `image-01`（2026-06-29 早 7:00 + 11:00–16:40 跑出）
- **三种长宽比**：16:9 / 9:16 / 4:3
- **总大小**：112 MB（**不**进 git）

## 2. 文件位置

> 重要：280 张 PNG **仅放在 D 盘**，**不**复制到 `aigame2_publish` 仓库（避免 112 MB 进 git）。

```
D:\aigame_concepts\
├── 01_three-realms.png
├── 02_tribulation.png
├── ...
└── 280_<topic>.png
```

`E:\aigame2_publish\docs\concept-art-catalog.md` 是**纯文本主题索引**（32 KB，可进 git），列出了每张图的：

- 编号（#01–#280）
- 文件名（与 D 盘一一对应）
- 一句话说明（场景 / 角色 / 氛围）
- 适用尺寸

设计师 / 玩家 / 程序只需打开 catalog.md 就能查到想要哪张图，再到 D 盘取用。

## 3. catalog.md 用途

- **玩家**浏览：挑喜欢的图当桌面 / 头像
- **设计师**选图：决定哪些图用作 UI 背景、Loading 画面、宣传图
- **程序**取图：知道每张图对应哪个场景、哪个事件、哪个 NPC

## 4. 选图规则（按长宽比）

| 比例 | 适用场景 | 例子 |
|---|---|---|
| **16:9** | Loading 画面 / 横幅 / Banner / 视频封面 | 渡劫、飞升、宗门大比等全景 |
| **9:16** | 启动屏 / 卡牌 / 角色立绘 / 海报 | 人物半身像、法宝特写、灵兽立绘 |
| **4:3** | 面板配图 / 事件插图 / 对话框背景 | 炼丹、交易、师徒对话等近景 |

> 详细分配见 catalog.md 第 3 节"尺寸分布"。

## 5. 使用流程

1. **打开** `docs/concept-art-catalog.md`
2. **按编号**找图 → 看主题分类（第 2 节）
3. **按比例**过滤 → 看尺寸分布（第 3 节）
4. **到 D 盘取图** → `D:\aigame_concepts\<编号>_<topic>.png`
5. **不要**把 PNG 复制到本仓库（112 MB 不进 git）

## 6. 命名约定

```
<编号 3 位>_<英文主题>.png
例：02_tribulation.png
    36_nine-tail-vs-dragon.png
    212 (跳过：minimaxi 内容审核)
```

英文主题用 kebab-case（连字符），便于命令行 / URL / 跨平台引用。

## 7. 注意事项

- **不进 git**：D 盘 112 MB PNG 是设计资产，**不**进 `aigame2_publish` 仓库
- **catalog 必进 git**：`docs/concept-art-catalog.md` 是纯文本索引，必须随仓库走
- **后续扩充**：如再生成新图（#281–#400 等），更新 catalog.md 即可，PNG 仍放 D 盘
- **版权 / API**：所有图均由 minimaxi image-01 生成，使用需遵守 minimaxi 服务条款

---

## 附录：minimaxi image-01 配额参考

- 配额窗口：5 小时滚动
- 重置时间：01:00 / 06:00 / 11:00 / 16:00 / 21:00（本地）
- 详细 API 速查：见 `reference-minimaxi-api.md`（记忆库）

---

*本 README 与 `concept-art-catalog.md` 配套使用。改动任一文件时请同步另一份。*
