#!/usr/bin/env python3
"""
minimaxi-video.py \u2014 MiniMax \u89c6\u9891\u751f\u6210 CLI\uff08\u6587\u751f\u89c6\u9891 / \u56fe\u751f\u89c6\u9891\uff09\u3002

\u7528\u6cd5\uff08\u9ed8\u8ba4\u8bfb .env.local \u91cc\u7684 Key\uff09:
    # 1) \u6587\u751f\u89c6\u9891
    python scripts/minimaxi-video.py t2v \\
        --prompt "A woman walks on a misty mountain path" \\
        --duration 6 --resolution 1080P

    # 2) \u56fe\u751f\u89c6\u9891\uff08\u9996\u5e27\u672c\u5730\u56fe\uff09
    python scripts/minimaxi-video.py i2v \\
        --prompt "Slowly turns head, eyes glow" \\
        --first-frame ./ref.png

    # 3) \u56fe\u751f\u89c6\u9891\uff08\u9996\u5e27\u7f51\u5740\uff09
    python scripts/minimaxi-video.py i2v \\
        --prompt "Slowly turns head" \\
        --first-frame-url "https://example.com/x.png"

    # 4) \u67e5\u8be2\u4efb\u52a1
    python scripts/minimaxi-video.py query --task-id 12345

    # 5) \u4e0b\u8f7d\u89c6\u9891\u6587\u4ef6\uff08\u9700 file_id\uff09
    python scripts/minimaxi-video.py download --file-id 12345 --out ./out.mp4

\u8ba4\u8bc1: E:\\aigame2_publish\\.env.local \u7b2c\u4e00\u884c Bearer token\uff0c\u5728 .gitignore\u3002
"""
import os
import sys
import json
import time
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


def post(path: str, key: str, payload: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(
        API_BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def get(path: str, key: str, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        API_BASE + path,
        headers={"Authorization": "Bearer " + key},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def get_raw(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# -------- commands --------

def cmd_t2v(args, key):
    payload = {
        "model": "MiniMax-Hailuo-2.3",
        "prompt": args.prompt,
        "duration": args.duration,
        "resolution": args.resolution,
    }
    if args.first_frame_url:
        payload["first_frame_image"] = args.first_frame_url
    r = post("/v1/video_generation", key, payload)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    if r.get("task_id"):
        print("\n# poll with: python scripts/minimaxi-video.py query --task-id " + r["task_id"], file=sys.stderr)


def cmd_i2v(args, key):
    if args.first_frame:
        with open(args.first_frame, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        suffix = os.path.splitext(args.first_frame)[1].lstrip(".") or "png"
        first = "data:image/" + suffix + ";base64," + b64
    elif args.first_frame_url:
        first = args.first_frame_url
    else:
        raise SystemExit("i2v needs --first-frame (path) or --first-frame-url")

    payload = {
        "model": "MiniMax-Hailuo-2.3",
        "prompt": args.prompt,
        "first_frame_image": first,
        "duration": args.duration,
        "resolution": args.resolution,
    }
    r = post("/v1/video_generation", key, payload, timeout=120)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    if r.get("task_id"):
        print("\n# poll with: python scripts/minimaxi-video.py query --task-id " + r["task_id"], file=sys.stderr)


def cmd_query(args, key):
    r = get("/v1/query/video_generation?task_id=" + args.task_id, key)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    if r.get("status") == "Success" and r.get("file_id"):
        print("\n# download with: python scripts/minimaxi-video.py download --file-id " + r["file_id"], file=sys.stderr)


def cmd_download(args, key):
    # 1) get download_url via /v1/files/retrieve
    r = get("/v1/files/retrieve?file_id=" + args.file_id, key)
    dl_url = r.get("file", {}).get("download_url")
    if not dl_url:
        print("no download_url in response:", json.dumps(r, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)
    print("# downloading:", dl_url[:100] + "...", file=sys.stderr)
    data = get_raw(dl_url, timeout=300)
    out = args.out or ("video_" + args.file_id + ".mp4")
    if not os.path.isabs(out):
        out = os.path.abspath(out)
    with open(out, "wb") as f:
        f.write(data)
    print("saved:", out, "size:", len(data))


def cmd_wait(args, key):
    """Poll until success/fail, then auto-download if --out given."""
    r = get("/v1/query/video_generation?task_id=" + args.task_id, key)
    s = r.get("status")
    if s in ("Success", "Fail"):
        print(json.dumps(r, ensure_ascii=False, indent=2))
        if s == "Success" and r.get("file_id") and args.out:
            args.file_id = r["file_id"]
            cmd_download(args, key)
        return
    for i in range(args.max_polls):
        time.sleep(args.interval)
        r = get("/v1/query/video_generation?task_id=" + args.task_id, key)
        s = r.get("status")
        ts = datetime.now(BEIJING_TZ).strftime("%H:%M:%S")
        print("[" + ts + "] poll " + str(i + 1) + "/" + str(args.max_polls) + " status=" + str(s), file=sys.stderr)
        if s in ("Success", "Fail"):
            print(json.dumps(r, ensure_ascii=False, indent=2))
            if s == "Success" and r.get("file_id") and args.out:
                args.file_id = r["file_id"]
                cmd_download(args, key)
            return
    print("timed out after " + str(args.max_polls) + " polls", file=sys.stderr)
    sys.exit(2)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add_common(p):
        p.add_argument("--prompt", required=True)
        p.add_argument("--duration", type=int, default=6, choices=[6, 10])
        p.add_argument("--resolution", default="768P", choices=["768P", "1080P"])

    p_t2v = sub.add_parser("t2v", help="text-to-video")
    add_common(p_t2v)
    p_t2v.add_argument("--first-frame-url", help="optional first frame URL")

    p_i2v = sub.add_parser("i2v", help="image-to-video (first frame as data URL or http URL)")
    add_common(p_i2v)
    p_i2v.add_argument("--first-frame", help="local image path (will be base64 encoded)")
    p_i2v.add_argument("--first-frame-url", help="remote image URL")

    p_q = sub.add_parser("query", help="query video generation task status")
    p_q.add_argument("--task-id", required=True)

    p_d = sub.add_parser("download", help="download a finished video file")
    p_d.add_argument("--file-id", required=True)
    p_d.add_argument("--out", help="output path (default: ./video_<file_id>.mp4)")

    p_w = sub.add_parser("wait", help="poll until success, then optionally download")
    p_w.add_argument("--task-id", required=True)
    p_w.add_argument("--out", help="if given, download to this path on success")
    p_w.add_argument("--interval", type=int, default=15)
    p_w.add_argument("--max-polls", type=int, default=40)

    args = ap.parse_args()
    key = load_key()
    {
        "t2v": cmd_t2v,
        "i2v": cmd_i2v,
        "query": cmd_query,
        "download": cmd_download,
        "wait": cmd_wait,
    }[args.cmd](args, key)


if __name__ == "__main__":
    main()