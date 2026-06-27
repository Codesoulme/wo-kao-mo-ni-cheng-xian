#!/usr/bin/env python3
"""minimaxi-quota.py — query MiniMax Token Plan live quota."""
import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

API_URL = "https://api.minimaxi.com/v1/token_plan/remains"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".env.local"))
BEIJING_TZ = timezone(timedelta(hours=8))


def load_key() -> str:
    if not os.path.exists(ENV_FILE):
        raise FileNotFoundError(".env.local not found at " + ENV_FILE)
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                return line
    raise ValueError("no key found in .env.local")


def fetch(key: str) -> dict:
    req = urllib.request.Request(
        API_URL,
        method="GET",
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError("HTTP " + str(e.code) + ": " + body) from e


def fmt_countdown(ms: int) -> str:
    if ms <= 0:
        return "reset"
    s = ms // 1000
    h = s // 3600
    m = (s % 3600) // 60
    if h > 0:
        return str(h) + "h" + str(m) + "m"
    return str(m) + "m"


def fmt_ts(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=BEIJING_TZ).strftime("%m-%d %H:%M")


def summarize(data: dict) -> str:
    if data.get("base_resp", {}).get("status_code", -1) != 0:
        return "API error: " + str(data.get("base_resp", {}))
    rows = []
    for r in data.get("model_remains", []):
        rows.append(
            "  - " + str(r["model_name"]).ljust(8) + " | "
            + "5h left " + str(r["current_interval_remaining_percent"]).rjust(3) + "% "
            + "(" + fmt_countdown(r["remains_time"]) + " until reset / " + fmt_ts(r["end_time"]) + ") "
            + "| weekly left " + str(r["current_weekly_remaining_percent"]).rjust(3) + "% "
            + "(" + fmt_countdown(r["weekly_remains_time"]) + " until reset / " + fmt_ts(r["weekly_end_time"]) + ") "
            + "| 5h used " + str(r["current_interval_usage_count"]) + "/" + str(r["current_interval_total_count"] or "-")
        )
    return "\n".join(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="only output JSON")
    ap.add_argument("--watch", type=int, default=0, metavar="SEC", help="poll every N seconds")
    args = ap.parse_args()

    key = load_key()
    while True:
        try:
            data = fetch(key)
        except Exception as e:
            ts = datetime.now(BEIJING_TZ).strftime("%H:%M:%S")
            print("[" + ts + "] ERROR: " + str(e), file=sys.stderr)
            if not args.watch:
                sys.exit(1)
            time.sleep(args.watch)
            continue
        ts = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
        if args.json:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print("\n[" + ts + "] MiniMax Token Plan live quota")
            print(summarize(data))
        if not args.watch:
            return
        time.sleep(args.watch)


if __name__ == "__main__":
    main()