#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TapTap 横版封面 1920x1080
修真色调：青/紫/黑 + 金色高光
主视觉：雷火（03_thunder_fire.png）
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import os

ASSETS = r"E:\aigame2_publish\assets\tribulation\concepts"
OUT = r"E:\aigame2_publish\tap-tap-store-kit\covers"
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080
CYAN = (75, 235, 230)
PURPLE = (138, 79, 255)
GOLD = (255, 200, 80)
DEEP = (12, 6, 30)

def font(size):
    """跨平台字体加载 - 优先黑体/思源黑体"""
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\SourceHanSansCN-Bold.otf",
        r"C:\Windows\Fonts\NotoSansCJK-Bold.ttc",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()

def build_cover():
    """封面 - 雷火主视觉 + 修真大字"""
    # 1. 底图：深空黑紫渐变
    base = Image.new("RGB", (W, H), DEEP)
    bd = ImageDraw.Draw(base)
    for y in range(H):
        # 上深下深紫渐变
        t = y / H
        r = int(12 * (1 - t) + 28 * t)
        g = int(6 * (1 - t) + 8 * t)
        b = int(30 * (1 - t) + 65 * t)
        bd.line([(0, y), (W, y)], fill=(r, g, b))

    # 2. 主视觉：雷火图 cover 到 1920x1080
    fg = Image.open(os.path.join(ASSETS, "03_thunder_fire.png")).convert("RGBA")
    fw, fh = fg.size
    scale = max(W / fw, H / fh) * 1.10
    nw, nh = int(fw * scale), int(fh * scale)
    fg = fg.resize((nw, nh), Image.LANCZOS)
    left = (nw - W) // 2
    top = (nh - H) // 2
    fg = fg.crop((left, top, left + W, top + H))
    # 调暗并加青紫调
    fg = ImageEnhance.Brightness(fg).enhance(0.85)
    fg = ImageEnhance.Color(fg).enhance(1.25)
    base.paste(fg, (0, 0), fg)

    # 3. 顶部紫色光带
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(0, H, 2):
        if y < 120 or y > H - 120:
            od.line([(0, y), (W, y)], fill=(0, 0, 0, 70))
    base.paste(overlay, (0, 0), overlay)

    # 4. 主标题"我靠模拟成仙" - 居中下
    cover = base.convert("RGBA")
    td = ImageDraw.Draw(cover)
    title = "我靠模拟成仙"
    sub = "AI 驱动 · 修真模拟器"
    sub2 = "每一次渡劫 都是独一份奇遇"

    f_title = font(160)
    f_sub = font(46)
    f_sub2 = font(38)

    # 标题测量
    bb = td.textbbox((0, 0), title, font=f_title)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = (W - tw) // 2
    ty = H - 360

    # 描边（金色）+ 主体（白色）
    for dx in range(-4, 5, 2):
        for dy in range(-4, 5, 2):
            if dx * dx + dy * dy <= 16:
                td.text((tx + dx, ty + dy), title, font=f_title, fill=(0, 0, 0, 220))
    td.text((tx, ty), title, font=f_title, fill=(255, 245, 220, 255))

    # 副标题
    bb2 = td.textbbox((0, 0), sub, font=f_sub)
    sw2 = bb2[2] - bb2[0]
    sx2 = (W - sw2) // 2
    sy2 = ty + th + 20
    td.text((sx2, sy2), sub, font=f_sub, fill=GOLD + (255,))

    # 描述
    bb3 = td.textbbox((0, 0), sub2, font=f_sub2)
    sw3 = bb3[2] - bb3[0]
    sx3 = (W - sw3) // 2
    sy3 = sy2 + 70
    td.text((sx3, sy3), sub2, font=f_sub2, fill=(220, 230, 255, 230))

    # 5. 角标"修真"
    badge = Image.new("RGBA", (180, 70), (0, 0, 0, 0))
    bdd = ImageDraw.Draw(badge)
    bdd.rounded_rectangle([0, 0, 180, 70], radius=14, fill=PURPLE + (210,))
    bdd.rounded_rectangle([0, 0, 180, 70], radius=14, outline=GOLD + (255,), width=2)
    f_b = font(38)
    bt = "修真 · 渡劫"
    bbb = bdd.textbbox((0, 0), bt, font=f_b)
    bw = bbb[2] - bbb[0]
    bh = bbb[3] - bbb[1]
    bdd.text(((180 - bw) // 2, (70 - bh) // 2 - 4), bt, font=f_b, fill=(255, 255, 255, 255))
    cover.alpha_composite(badge, (50, 50))

    # 6. 顶部右侧 - 角标"AI 实时推演"
    badge2 = Image.new("RGBA", (240, 70), (0, 0, 0, 0))
    bdd2 = ImageDraw.Draw(badge2)
    bdd2.rounded_rectangle([0, 0, 240, 70], radius=14, fill=CYAN + (210,))
    bdd2.rounded_rectangle([0, 0, 240, 70], radius=14, outline=(255, 255, 255, 255), width=2)
    f_b2 = font(36)
    bt2 = "AI 实时推演"
    bbb2 = bdd2.textbbox((0, 0), bt2, font=f_b2)
    bw2 = bbb2[2] - bbb2[0]
    bh2 = bbb2[3] - bbb2[1]
    bdd2.text(((240 - bw2) // 2, (70 - bh2) // 2 - 4), bt2, font=f_b2, fill=(20, 10, 40, 255))
    cover.alpha_composite(badge2, (W - 50 - 240, 50))

    out_path = os.path.join(OUT, "cover_1920x1080.png")
    cover.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"[OK] 封面 -> {out_path}")

    # 备份：备选主视觉 - 修真全景
    base2 = Image.new("RGB", (W, H), DEEP)
    bd2 = ImageDraw.Draw(base2)
    for y in range(H):
        t = y / H
        r = int(8 * (1 - t) + 35 * t)
        g = int(4 * (1 - t) + 5 * t)
        b = int(25 * (1 - t) + 80 * t)
        bd2.line([(0, y), (W, y)], fill=(r, g, b))
    fg2 = Image.open(os.path.join(ASSETS, "01_panorama.png")).convert("RGBA")
    fw, fh = fg2.size
    scale = max(W / fw, H / fh) * 1.10
    fg2 = fg2.resize((int(fw * scale), int(fh * scale)), Image.LANCZOS)
    fg2 = fg2.crop(((fg2.size[0] - W) // 2, (fg2.size[1] - H) // 2,
                    (fg2.size[0] - W) // 2 + W, (fg2.size[1] - H) // 2 + H))
    fg2 = ImageEnhance.Color(fg2).enhance(1.15)
    base2.paste(fg2, (0, 0), fg2)
    base2 = base2.convert("RGBA")
    td2 = ImageDraw.Draw(base2)
    for dx in range(-4, 5, 2):
        for dy in range(-4, 5, 2):
            if dx * dx + dy * dy <= 16:
                td2.text((tx + dx, ty + dy), title, font=f_title, fill=(0, 0, 0, 220))
    td2.text((tx, ty), title, font=f_title, fill=(255, 245, 220, 255))
    bb2 = td2.textbbox((0, 0), sub, font=f_sub)
    sw2 = bb2[2] - bb2[0]
    td2.text(((W - sw2) // 2, sy2), sub, font=f_sub, fill=GOLD + (255,))
    bb3 = td2.textbbox((0, 0), sub2, font=f_sub2)
    sw3 = bb3[2] - bb3[0]
    td2.text(((W - sw3) // 2, sy3), sub2, font=f_sub2, fill=(220, 230, 255, 230))
    bd2d = ImageDraw.Draw(base2)
    bd2d.rounded_rectangle([50, 50, 230, 120], radius=14, fill=PURPLE + (210,))
    bd2d.rounded_rectangle([50, 50, 230, 120], radius=14, outline=GOLD + (255,), width=2)
    bd2d.text(((180 - bw) // 2 + 50, (70 - bh) // 2 - 4 + 50), bt, font=f_b, fill=(255, 255, 255, 255))
    bd2d.rounded_rectangle([W - 290, 50, W - 50, 120], radius=14, fill=CYAN + (210,))
    bd2d.rounded_rectangle([W - 290, 50, W - 50, 120], radius=14, outline=(255, 255, 255, 255), width=2)
    bd2d.text((W - 290 + (240 - bw2) // 2, 50 + (70 - bh2) // 2 - 4), bt2, font=f_b2, fill=(20, 10, 40, 255))
    out2 = os.path.join(OUT, "cover_1920x1080_alt_panorama.png")
    base2.convert("RGB").save(out2, "PNG", optimize=True)
    print(f"[OK] 备选封面 -> {out2}")

if __name__ == "__main__":
    build_cover()
