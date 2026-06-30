#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TapTap 应用图标多尺寸生成
主视觉: 07_protagonist.png (864x1152, 主角图)
修真色: 青/紫/黑 + 金色高光 + 仙气光晕
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os, math

SRC = r"E:\aigame2_publish\assets\tribulation\concepts\07_protagonist.png"
OUT = r"E:\aigame2_publish\tap-tap-store-kit\icons"
os.makedirs(OUT, exist_ok=True)

# 修真色
CYAN = (75, 235, 230)      # 青
PURPLE = (138, 79, 255)    # 紫
GOLD = (255, 200, 80)      # 金
DEEP = (15, 8, 35)         # 深空

def to_square_square(src_path, size, out_path, rounded=False):
    """方形版图标 - 直接 cover 到目标尺寸"""
    im = Image.open(src_path).convert("RGBA")
    # cover 模式缩放（短边居中裁切）
    w, h = im.size
    scale = max(size / w, size / h)
    nw, nh = int(w * scale), int(h * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    # 中心裁切
    left = (nw - size) // 2
    top = (nh - size) // 2
    im = im.crop((left, top, left + size, top + size))
    # 加仙气光晕 (径向青紫)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(size // 2, 0, -2):
        a = int(60 * (1 - r / (size / 2)) ** 2)
        gd.ellipse([size//2 - r, size//2 - r, size//2 + r, size//2 + r],
                   fill=(75, 235, 230, a))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 30))
    im.alpha_composite(glow)
    # 轻微提亮
    im = ImageEnhance.Brightness(im).enhance(1.08)
    im = ImageEnhance.Contrast(im).enhance(1.12)
    if rounded:
        # 圆角 18%
        mask = Image.new("L", (size, size), 0)
        mdraw = ImageDraw.Draw(mask)
        rad = int(size * 0.18)
        mdraw.rounded_rectangle([0, 0, size, size], radius=rad, fill=255)
        im.putalpha(mask)
    im.save(out_path, "PNG", optimize=True)
    print(f"  -> {out_path} ({size}x{size})")

def to_square_circle(src_path, size, out_path):
    """圆形版图标 - TapTap 推荐圆形主图标"""
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    scale = max(size / w, size / h) * 1.05
    nw, nh = int(w * scale), int(h * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - size) // 2
    top = (nh - size) // 2
    im = im.crop((left, top, left + size, top + size))
    # 仙气光晕
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(size // 2, 0, -2):
        a = int(80 * (1 - r / (size / 2)) ** 2)
        gd.ellipse([size//2 - r, size//2 - r, size//2 + r, size//2 + r],
                   fill=(138, 79, 255, a))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 24))
    im.alpha_composite(glow)
    # 圆形 mask
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.ellipse([0, 0, size, size], fill=255)
    im.putalpha(mask)
    # 圆形描边 (金色)
    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.ellipse([2, 2, size - 2, size - 2], outline=GOLD + (220,), width=max(2, size // 128))
    im.alpha_composite(border)
    im.save(out_path, "PNG", optimize=True)
    print(f"  -> {out_path} ({size}x{size} circle)")

# 主视觉输出尺寸
sizes_square = [512, 192, 96, 72, 48]
sizes_circle = [512, 192, 96, 72, 48]

print("[*] 方形圆角图标:")
for s in sizes_square:
    p = os.path.join(OUT, f"icon_{s}x{s}_rounded.png")
    to_square_square(SRC, s, p, rounded=True)

print("[*] 圆形主图标:")
for s in sizes_circle:
    p = os.path.join(OUT, f"icon_{s}x{s}_circle.png")
    to_square_circle(SRC, s, p)

print("[OK] 图标全套产出完毕")
