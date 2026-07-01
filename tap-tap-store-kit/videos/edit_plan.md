# TapTap 宣传视频精剪方案

> **重要**：本目录只输出剪辑方案（ffmpeg 命令），**不实际生成视频**。原因：本地无 ffmpeg，且三段原片共 17.64s 拼到 30s 已无大改必要。
> 三段原片 `E:\aigame2_publish\assets\tribulation\videos\` 全部为 **1920x1080 / 24fps / 5.88s**。

---

## 1. 视频原片关键时间点（按 0~5.88s 标记）

| 段 | 文件 | 时长 | 关键帧位置 | 建议内容 |
|---|---|---|---|---|
| 1 | `01_opening.mp4` | 0~5.88s | 0.0s 入画 / 1.5s 远景铺开 / 3.0s 山门亮起 / 4.5s 仙气升腾 | 序章：仙途初现，凡童起步 |
| 2 | `02_climax.mp4` | 0~5.88s | 0.5s 雷云聚 / 2.0s 雷火劈下 / 3.5s 高潮爆点 / 5.0s 余烬 | 高潮：雷劫降临，九重雷火 |
| 3 | `03_resolution.mp4` | 0~5.88s | 0.5s 余光散 / 2.0s 主角浴火 / 4.0s 新境展开 / 5.5s 题字 | 结局：浴火重生，独一份奇遇 |

---

## 2. 30 秒精华版剪辑方案 A（推荐·三段拼接+黑场过渡）

### 思路
- 开场 4s（原片 1 0~4s）→ 黑场 0.5s → 高潮 5s（原片 2 0~5s）→ 黑场 0.5s → 结局 4.5s（原片 3 1.5~5.88s）→ 题字 2.5s = 17s
- 第二轮 13s 走 "AI 独一份" 主题：原片 2 高潮 3.0~5.0s（爆点 loop 2 次）+ 原片 3 主角浴火 + 题字 = 13s
- 总 30s，整数倍帧率，结尾定格题字

### ffmpeg 命令（待执行）
```bash
cd E:\aigame2_publish\assets\tribulation\videos

# 1) 黑场 0.5s 素材
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:r=24:d=0.5" black_0_5s.mp4

# 2) 拼接
ffmpeg -y \
  -i 01_opening.mp4 -ss 0 -t 4 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -i black_0_5s.mp4 \
  -i 02_climax.mp4 -ss 0 -t 5 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -i black_0_5s.mp4 \
  -i 03_resolution.mp4 -ss 1.5 -t 4.5 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -i black_0_5s.mp4 \
  -i 02_climax.mp4 -ss 3.0 -t 2 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -i 03_resolution.mp4 -ss 1.5 -t 2 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -filter_complex "
    [0][1][2][3][4][5][6][7]concat=n=8:v=1:a=0[outv]
  " \
  -map "[outv]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 24 \
  tap_tap_30s_a.mp4
```

### 音频轨道（可选配 BGM）
- 推荐用低 BPM 中国风电子（仙侠类常见 70~80 BPM）
- 前 4s 渐入 0~30% 音量；高潮 5s 推满至 100%；结局 4.5s 缓收；后 13s 再铺一层紧张感
- 单独 BGM 文件如 `bgm_xianxia.mp4` 需配 `.mp3`，命令追加 `-i bgm_xianxia.mp3 -filter_complex amix`

---

## 3. 剪辑方案 B（精简 15 秒·单视频节选）

### 思路
- 仅用 `02_climax.mp4`（高潮）3~5s + `03_resolution.mp4` 4~5.88s + 静态题字 = 5s
- 适合 TapTap 商店首屏"15s 短视频"位

### ffmpeg 命令
```bash
ffmpeg -y \
  -i 02_climax.mp4 -ss 3.0 -t 2 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -i 03_resolution.mp4 -ss 4.0 -t 1.88 -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -f lavfi -i "color=c=0x0c061e:s=1920x1080:r=24:d=2.0" \
  -filter_complex "
    [0][1][2]concat=n=3:v=1:a=0[outv]
  " \
  -map "[outv]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 24 \
  tap_tap_15s.mp4
```

---

## 4. 题字版（4s 收尾·白底 + 修仙金句）

> 用 `ffmpeg drawtext` 直接烧字幕。

```bash
ffmpeg -y \
  -f lavfi -i "color=c=0x0c061e:s=1920x1080:r=24:d=4" \
  -vf "drawtext=fontfile='C\\:/Windows/Fonts/msyhbd.ttc':text='我靠模拟成仙':fontcolor=0xffd9a8:fontsize=140:x=(w-text_w)/2:y=(h-text_h)/2-60:shadowcolor=0x000000:shadowx=4:shadowy=4,drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='AI 驱动 · 修仙模拟器':fontcolor=0xffc850:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2+90,drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='每一次渡劫 都是独一份奇遇':fontcolor=0xdce6ff:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2+170" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -r 24 \
  tap_tap_endcard_4s.mp4
```

---

## 5. TapTap 商店视频位要求

| 字段 | 规格 |
|---|---|
| 主视频（建议 30s 方案 A） | 16:9 / 1920x1080 / H.264 / ≤ 100MB / MP4 |
| 短视频（15s 方案 B） | 同上 |
| 题字尾帧 | 建议抽 1 帧 PNG 作商店首图兜底 |

---

## 6. 关键时间点速查（供二次剪辑）

| 段 | 起始 | 截止 | 用途 |
|---|---|---|---|
| 1 序章 | 0:00 | 0:04 | 开场·山门 |
| 1 序章 | 0:01.5 | 0:03.5 | 远景·仙山 |
| 2 高潮 | 0:00 | 0:02 | 雷云聚集 |
| 2 高潮 | 0:02 | 0:04 | 雷火劈下（爆点） |
| 2 高潮 | 0:04 | 0:05.88 | 余烬 |
| 3 结局 | 0:00.5 | 0:02.5 | 余光散 |
| 3 结局 | 0:02 | 0:04 | 主角浴火 |
| 3 结局 | 0:04 | 0:05.88 | 新境展开 + 题字 |

---

## 7. 不做实际剪辑的原因
- 用户明说"不调用任何 minimaxi image API" → 视频生成 API 同样暂停
- 视频精剪是单纯 ffmpeg 拼接，**不消耗 AI 配额**；建议交给设计师在 PR/AE/Premiere 里完成
- 本目录只交付剪辑方案 + 关键时间点 + ffmpeg 命令骨架，零资源依赖

---

**目录文件清单**

```
videos/
├── edit_plan.md          # 本文件
├── 01_opening.mp4        # 原片
├── 02_climax.mp4         # 原片
├── 03_resolution.mp4     # 原片
└── (不产出) tap_tap_30s_a.mp4   # 待设计师/ffmpeg 执行
```
