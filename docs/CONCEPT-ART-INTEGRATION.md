# 《我靠模拟成仙》概念图接入指南（Concept Art Integration）

> 把 439 张 minimaxi 概念图接到 UI 上的完整手册。
> 适用对象：UI 工程师、关卡 / 美术设计师、想看图的任何人。
> 关联文件：`docs/concept-art-catalog.md`（索引）、`D:\aigame_concepts\*.png`（图源）。

---

## 0. 一图速览（TL;DR）

1. **取图**：从 `D:\aigame_concepts\{n}_{topic}.png` 复制
2. **落位**：到 `E:\aigame2_publish\public\concepts\`
3. **引用**：`next/image` / `img src="/concepts/{n}_{topic}.png"`
4. **规范**：每个 UI 位置固定一个 aspect ratio + 一张图
5. **替换**：只换文件名，组件 props 不动

---

## 1. 适用场景 & aspect ratio 选图

| UI 位置 | 推荐 aspect ratio | 推荐主题（catalog §2.x） | 数量建议 |
|---|---|---|---|
| **启动屏**（`<SplashScreen>`） | 9:16 竖 | 三界 / 飞升 / 雷劫（§2.1 / §2.10） | 1 静 + 1 切场 |
| **Loading 屏** | 16:9 横 | 山水 / 天气 / 修炼（§2.7 / §2.15） | 3–5 张轮播 |
| **卡牌立绘 / 角色立绘** | 9:16 竖 | NPC / 道侣 / 师徒 / 灵兽（§2.2 / §2.6 / §2.12） | 一角色一图 |
| **宗门 / 城市面板 banner** | 4:3 | 宗门 / 坊市 / 拍卖（§2.14 / §2.3） | 静态 banner |
| **任务 / 秘境背景** | 16:9 横 | 秘境 / 遗迹 / 战斗（§2.11 / §2.1） | 按任务 |
| **结局 / CG** | 9:16 或 4:3 | 飞升 / 告别 / 突破（§2.10 / §2.8） | 关键节点 |
| **节气 / 季节装饰** | 1:1 或 16:9 | 节气 / 季节（§2.17 / §2.7） | 1 张 / 季 |

**快速判断**：
- **16:9 横** → Loading / 大背景 / 任务 banner
- **9:16 竖** → 启动屏 / 卡牌立绘 / 结局 CG
- **4:3** → 面板 banner / 缩略图 / 卡片

---

## 2. 文件命名约定（严格遵守）

### 2.1 概念图源（D 盘 → 复制到 aigame2_publish）

```
{编号}_{主题英文}.png
```

例：
```
01_three-realms.png
110_first-flying-sword.png
439_birthday-lantern.png
```

- 编号 3 位补零（`001_`–`999_`，目前用 1–440）
- 主题英文：snake_case（`three_realms` 不行，必须 `three-realms`）
- 不允许中文
- 重跑图加上后缀 `_v2`，例如 `114_shadow-cultivator_v2.png`（catalog §1 已标注）

### 2.2 接入 aigame2_publish 后的别名约定

`public/concepts/` 目录内允许一层 **UI 位置语义重命名**，例如：

```
public/concepts/
├── splash/
│   └── 01_three-realms.png          # 启动屏用
├── loading/
│   ├── 104_moon-sword-dance.png     # Loading 用
│   └── 179_misty-archipelago.png    # Loading 用
├── cards/
│   └── 06_master-disciple.png       # 师父立绘
└── banners/
    └── 50_sect-tournament.png       # 宗门 banner
```

**规则**：
- 文件名可以原封不动（即 `01_three-realms.png`），也可以在 `public/concepts/{slot}/` 下加 `manifest.json` 显式绑定
- 优先**原文件名 + 目录分类**，不引入新 ID

---

## 3. 接入代码骨架（Next.js 13+ App Router）

```tsx
// src/components/SplashScreen.tsx
import Image from "next/image";

export function SplashScreen() {
  // 9:16 竖屏，full bleed
  return (
    <Image
      src="/concepts/splash/01_three-realms.png"
      alt="三界宏图"
      width={1080}
      height={1920}
      priority
      className="object-cover w-full h-screen"
    />
  );
}
```

```tsx
// src/components/LoadingBackdrop.tsx — 多图轮播
"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  "/concepts/loading/104_moon-sword-dance.png",
  "/concepts/loading/179_misty-archipelago.png",
  "/concepts/loading/166_waterfall-training.png",
];

export function LoadingBackdrop() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 6_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Image
      src={SLIDES[idx]}
      alt="修炼图"
      width={1920}
      height={1080}
      className="object-cover w-full h-screen opacity-60"
      priority={idx === 0}
    />
  );
}
```

```tsx
// src/data/concepts.ts — 统一元数据
export const CONCEPT_REGISTRY = [
  {
    slot: "splash",
    src: "/concepts/splash/01_three-realms.png",
    catalogId: "01",
    theme: "three-realms",
    aspect: "9:16",
    source: "D:\\aigame_concepts\\01_three-realms.png",
  },
  // ...
] as const;
```

**为什么这样写**：
- `priority` 只给 splash，避免 LCP 抖动
- `next/image` 自动 webp / avif 转换
- 同一张图多处复用时，复制文件优于跨组件共享 cache

---

## 4. 18 主题分类快速参考（catalog §2）

| 编号 | 主题 | 张数 | 优先用在哪 |
|---|---|---|---|
| 2.1 | 战斗 / 斗法 / 师徒 / 修炼 | 30 | 卡牌 / 任务背景 / 启动屏 |
| 2.2 | NPC 群像 / 角色 | 22 | 卡牌立绘 / 选角界面 |
| 2.3 | 童年 / 幼童 / 家族 / 传承 | 20 | 童年剧情背景 / 教学节点 |
| 2.4 | 友情 / 知己 / 重逢 / 告别 | 22 | 剧情插图 / 情感节点 |
| 2.5 | 节日 / 聚会 / 庆典 | 15 | 节气 / 庆典礼 |
| 2.6 | 灵兽 / 灵宠 / 伙伴 | 13 | 卡牌 / 卡图 |
| 2.7 | 自然 / 山水 / 天气 | 28 | Loading / 地图背景 |
| 2.8 | 死亡 / 告别 / 祭祀 / 轮回 | 16 | 情感 CG / 结局 |
| 2.9 | 炼丹 / 炼器 / 灵草 | 10 | 炼丹系统面板 |
| 2.10 | 飞升 / 渡劫 / 天劫 / 突破 | 10 | 启动屏 / 结局 CG / 关键节点 |
| 2.11 | 秘境 / 古遗迹 / 寻宝 | 10 | 任务背景 / 秘境图 |
| 2.12 | 爱情 / 道侣 / 告白 | 15 | 情感节点 / CG |
| 2.13 | 日常 / 休闲 / 温馨 | 22 | 主界面背景 / 日常场景 |
| 2.14 | 都市 / 坊市 / 拍卖 | 6 | 宗门 / 坊市面板 |
| 2.15 | 闭关 / 禅修 / 内省 | 10 | 闭关动画 / 内省 UI |
| 2.16 | 教育 / 学堂 / 教学 | 10 | 教学 UI / 学堂背景 |
| 2.17 | 节气 / 季节 / 天气 | 6 | 装饰 / 季节 banner |
| 2.18 | 战斗 / 战争 / 冲突 | 6 | 宗门战 / 大型战役背景 |

> **注**：catalog 仅索引前 280 张（18 主题）；D 盘 281–440 后续增量见 `docs/concept-art-catalog-batch2.md`。

---

## 5. minimaxi prompt 复用（怎么改 prompt 跑新图）

### 5.1 端点

```
POST https://api.minimaxi.com/v1/image/generation
```

订阅 Key 在 `E:\aigame2_publish\.env.local`（`MINIMAXI_API_KEY`），5h 重置 01/06/11/16/21。

### 5.2 模板 prompt（沿用 catalog 编号 1–280 的 prompt 套路）

```yaml
model: image-01
prompt: |
  仙侠水墨风，画面正中一座刀削斧劈的山峰，山巅盘坐一名穿玄色道袍的青年，
  男子，天劫将至，天空紫色雷云翻涌，
  --aspect_ratio 9:16
  --num_images 1
```

**prompt 五个段落**：
1. **画风**：水墨仙侠 / 工笔重彩 / 浮世绘（一律水墨）
2. **主体**：人物 + 位置 + 姿态
3. **构图**：前景 / 中景 / 背景
4. **情绪**：孤独 / 激动 / 寂寥 / 激烈
5. **aspect ratio**：从 `9:16` / `16:9` / `4:3` 三选一

### 5.3 改 prompt 跑新图的流程

1. 选 catalog §2 一个主题
2. 复制一段类似编号的 prompt（§5.1 模板）
3. 替换主体 + 情绪 + aspect ratio
4. 喂给 `scripts/minimaxi-image.ts`（`aigame2_publish` 已有 worker）
5. 输出落到 `D:\aigame_concepts\{next-id}_{new-topic}.png`
6. 同步把新图加进 `docs/concept-art-catalog.md` §2 对应主题

### 5.4 已知会被 minimaxi 内容审核拦的 prompt

- **狐狸 / 幼狐 / young fox**（image-212 跳过）→ 改用 "九尾灵狐 adult" 绕开
- **过于血腥 / 暴力死法** → 改用 "气浪冲击"/"丹田破碎" 替代
- **敏感历史人物** → 改用"无名氏老人"

---

## 6. 检查表（接入前）

- [ ] 图文件名符合 `{编号}_{主题}.png` 命名
- [ ] 图来自 `D:\aigame_concepts\`，**未删未改源**
- [ ] UI 位置 aspect ratio 与图档匹配（9:16 / 16:9 / 4:3）
- [ ] `public/concepts/{slot}/` 目录已建
- [ ] `next/image` 已加 `priority`（仅首屏）
- [ ] alt 文本已写中文
- [ ] 该图不在跳过列表（image-212 不接）
- [ ] 重跑图选了 v2 版（114_v2 / 238_v2）

---

## 7. 后续计划

1. 接入 splash + loading + 1 张卡牌，跑通 smoke 链路
2. 再扩到 §2.6 灵兽 / §2.9 炼丹 / §2.14 坊市 三个面板
3. D 盘第二批 159 张（281–440）补完 catalog

---

**维护人**：UI / 美术设计师 + main session worker  
**最后更新**：2026-06-29（任务 F 落地）  
**关联 commit**：本次为 catalog 归档，git commit 由 main session 处理
