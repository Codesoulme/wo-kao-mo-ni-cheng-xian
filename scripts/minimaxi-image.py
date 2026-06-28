#!/usr/bin/env python3
r"""
minimaxi-image.py — MiniMax 文生图 CLI

默认读 E:\aigame2_publish\.env.local 第一行作为 Bearer token。

用法：
    python scripts/minimaxi-image.py t2i \
        --prompt "水墨山水，三界层叠：凡界云海下方、灵界浮岛居中、仙界殿宇耸立顶端" \
        --out D:/aigame_concepts/three-realms.png \
        --aspect-ratio 16:9
"""
import os
import sys
import json
import argparse
import base64
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

API_BASE = "https://api.minimaxi.com"
BEIJING_TZ = timezone(timedelta(hours=8))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".env.local"))


def load_key() -> str:
    if not os.path.exists(ENV_FILE):
        raise FileNotFoundError(".env.local not found at " + ENV_FILE)
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                return line
    raise ValueError("no key in .env.local")


def post(path: str, key: str, payload: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        API_BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def t2i(prompt: str, aspect_ratio: str, out_path: str, model: str = "image-01", n: int = 1) -> dict:
    key = load_key()
    payload = {
        "model": model,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "n": n,
        "response_format": "base64",  # minimaxi 仅支持 url/base64
    }
    ts0 = datetime.now(BEIJING_TZ)
    r = post("/v1/image_generation", key, payload)
    elapsed = (datetime.now(BEIJING_TZ) - ts0).total_seconds()

    # 真实结构：{"id":..., "data": {"image_base64": ["..."] 或 "..."}, "base_resp":{...}}
    # 也兼容旧版 {"data": ["..."]}
    data = r.get("data")
    if data is None:
        print("[WARN] no data, raw =", json.dumps(r, ensure_ascii=False)[:500])
        return {"status": "no_data", "raw": r}

    if isinstance(data, dict):
        img_b64 = data.get("image_base64") or data.get("b64_json") or ""
    elif isinstance(data, list):
        first = data[0] if data else {}
        img_b64 = first.get("b64_json") or first.get("image_base64") or first if isinstance(first, str) else ""
    else:
        img_b64 = str(data)

    # 拆 list（minimaxi 返回 ["..."] 形式）
    if isinstance(img_b64, list):
        img_b64 = img_b64[0] if img_b64 else ""

    if not img_b64 or not isinstance(img_b64, str):
        print("[WARN] no image_base64 in data, raw =", json.dumps(r, ensure_ascii=False)[:500])
        return {"status": "no_image", "raw": r}

    img_bytes = base64.b64decode(img_b64)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(img_bytes)
    print(f"[OK] {out_path}  ({len(img_bytes)} bytes, {elapsed:.1f}s)")
    return {"status": "ok", "path": out_path, "bytes": len(img_bytes), "elapsed_s": elapsed}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["t2i"], help="t2i = text to image")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True, help="output png path")
    ap.add_argument("--aspect-ratio", default="16:9", choices=["1:1", "16:9", "9:16", "4:3", "3:4"])
    ap.add_argument("--n", type=int, default=1)
    ap.add_argument("--model", default="image-01")
    args = ap.parse_args()

    if args.mode == "t2i":
        result = t2i(args.prompt, args.aspect_ratio, args.out, args.model, args.n)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
