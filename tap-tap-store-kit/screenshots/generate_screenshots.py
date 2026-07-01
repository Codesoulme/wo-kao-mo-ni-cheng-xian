#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TapTap 商店截图集 1080x1920 (手机竖屏)
从 7 张概念图中精选 + 修仙字样 + 修仙色边
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import os

ASSETS = r"E:\aigame2_publish\assets\tribulation\concepts"
OUT = r"E:\aigame2_publish\tap-tap-store-kit\screenshots"
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1920
CYAN = (75, 235, 230)
PURPLE = (138, 79, 255)
GOLD = (255, 200, 80)
DEEP = (12, 6, 30)

def font(size):
    for c in [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\SourceHanSansCN-Bold.otf",
    ]:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()

# 截图设计 (顺序 修仙用户旅程：开篇 -> 试炼 -> 雷劫 -> 天象 -> 心火 -> 后果 -> 主角)
# 每张: 概念图 cover + 修仙色边 + 标题 + 副标题 + 角标
SHOTS = [
    {
        "src": "01_panorama.png",
        "name": "01_opening",
        "title": "开篇·仙途初现",
        "sub": "凡童起步 遍历八境",
        "tag": "序章",
        "tag_color": PURPLE,
    },
    {
        "src": "03_thunder_fire.png",
        "name": "02_thunder_fire",
        "title": "雷火·淬体",
        "sub": "九重雷劫 一念生死",
        "tag": "渡劫",
        "tag_color": GOLD,
    },
    {
        "src": "02_heart_demon.png",
        "name": "03_heart_demon",
        "title": "心魔·试炼",
        "sub": "道心未坚 一朝入魔",
        "tag": "心魔",
        "tag_color": PURPLE,
    },
    {
        "src": "04_celestial_omen.png",
        "name": "04_celestial_omen",
        "title": "天象·异动",
        "sub": "紫气东来 星河倒悬",
        "tag": "天象",
        "tag_color": CYAN,
    },
    {
        "src": "05_heart_fire.png",
        "name": "05_heart_fire",
        "title": "心火·锻神",
        "sub": "三昧真火 炼神返虚",
        "tag": "心火",
        "tag_color": GOLD,
    },
    {
        "src": "06_consequences_4grid.png",
        "name": "06_consequences",
        "title": "因果·四宫格",
        "sub": "一念善恶 皆有回响",
        "tag": "抉择",
        "tag_color": PURPLE,
    },
    {
        "src": "07_protagonist.png",
        "name": "07_protagonist",
        "title": "主角·独一份",
        "sub": "AI 实时推演 仙路无雷同",
        "tag": "你",
        "tag_color": CYAN,
    },
]

def make_shot(cfg, idx):
    src_path = os.path.join(ASSETS, cfg["src"])
    src = Image.open(src_path).convert("RGBA")
    sw, sh = src.size
    # cover to 1080x1920
    scale = max(W / sw, H / sh) * 1.08
    nw, nh = int(sw * scale), int(sh * scale)
    src = src.resize((nw, nh), Image.LANCZOS)
    src = src.crop(((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H))
    src = ImageEnhance.Color(src).enhance(1.10)
    src = ImageEnhance.Contrast(src).enhance(1.05)

    # 加修仙渐变
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(H):
        # 顶部渐暗
        if y < 280:
            a = int(180 * (1 - y / 280))
            od.line([(0, y), (W, y)], fill=(12, 6, 30, a))
        # 底部渐暗
        if y > H - 700:
            a = int(220 * ((y - (H - 700)) / 700))
            od.line([(0, y), (W, y)], fill=(12, 6, 30, a))
    src.alpha_composite(overlay)
    src = src.convert("RGBA")

    td = ImageDraw.Draw(src)
    f_title = font(80)
    f_sub = font(42)
    f_brand = font(32)
    f_tag = font(36)

    # 顶部品牌字
    td.text((50, 50), "我靠模拟成仙", font=f_brand, fill=GOLD + (240,))
    td.text((50, 90), "AI 驱动 · 修仙模拟器", font=font(26), fill=(220, 230, 255, 200))

    # 角标
    bx, by = W - 180, 50
    td.rounded_rectangle([bx, by, bx + 130, by + 70], radius=14,
                         fill=cfg["tag_color"] + (230,))
    td.rounded_rectangle([bx, by, bx + 130, by + 70], radius=14,
                         outline=GOLD + (255,), width=2)
    tag = cfg["tag"]
    tbb = td.textbbox((0, 0), tag, font=f_tag)
    tw = tbb[2] - tbb[0]
    th = tbb[3] - tbb[1]
    td.text((bx + (130 - tw) // 2, by + (70 - th) // 2 - 4), tag,
            font=f_tag, fill=(255, 255, 255, 255))

    # 底部大字标题
    title = cfg["title"]
    sub = cfg["sub"]
    tbb = td.textbbox((0, 0), title, font=f_title)
    tw = tbb[2] - tbb[0]
    th = tbb[3] - tbb[1]
    tx = (W - tw) // 2
    ty = H - 280
    # 描边
    for dx in range(-3, 4, 2):
        for dy in range(-3, 4, 2):
            if dx * dx + dy * dy <= 9:
                td.text((tx + dx, ty + dy), title, font=f_title, fill=(0, 0, 0, 230))
    td.text((tx, ty), title, font=f_title, fill=(255, 245, 220, 255))

    # 副标题
    sbb = td.textbbox((0, 0), sub, font=f_sub)
    sw = sbb[2] - sbb[0]
    td.text(((W - sw) // 2, ty + th + 24), sub, font=f_sub, fill=GOLD + (240,))

    # 角标底部"修仙 · 第 X 幕"
    bottom_tag = f"修仙 · 第 {idx + 1} 幕 · 独一份奇遇"
    f_bt = font(28)
    btbb = td.textbbox((0, 0), bottom_tag, font=f_bt)
    btw = btbb[2] - btbb[0]
    bth = btbb[3] - btbb[1]
    bx2 = (W - btw) // 2
    by2 = H - 80
    td.rounded_rectangle([bx2 - 20, by2 - 8, bx2 + btw + 20, by2 + bth + 12],
                         radius=20, fill=(12, 6, 30, 200))
    td.rounded_rectangle([bx2 - 20, by2 - 8, bx2 + btw + 20, by2 + bth + 12],
                         radius=20, outline=GOLD + (180,), width=1)
    td.text((bx2, by2), bottom_tag, font=f_bt, fill=(255, 230, 180, 255))

    out = os.path.join(OUT, f"shot_{cfg['name']}.png")
    src.convert("RGB").save(out, "PNG", optimize=True)
    print(f"[OK] {out}")

if __name__ == "__main__":
    for i, cfg in enumerate(SHOTS):
        make_shot(cfg, i)
    print(f"\n[OK] 截图集 {len(SHOTS)} 张全部产出")
