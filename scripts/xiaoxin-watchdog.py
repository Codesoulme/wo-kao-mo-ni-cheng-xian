#!/usr/bin/env python3
"""xiaoxin-watchdog.py - ?? .handoff/meeting/ ??, ??????????."""

import os, sys, time, json, argparse
from pathlib import Path
from datetime import datetime

def log_alert(alert_dir, message):
    log_path = alert_dir.parent.parent / "WATCHDOG-ALERT.log"
    timestamp = datetime.now().isoformat()
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")
    print(f"[ALERT] {message}")

def scan_meetings(meeting_dir):
    current_state = {}
    if not meeting_dir.exists():
        return current_state
    for meeting in sorted(meeting_dir.iterdir()):
        if not meeting.is_dir():
            continue
        files = {}
        for f in sorted(meeting.iterdir()):
            if f.is_file():
                files[f.name] = {
                    "size": f.stat().st_size,
                    "mtime": f.stat().st_mtime,
                }
        current_state[meeting.name] = files
    return current_state

def diff_states(prev, curr):
    alerts = []
    new_meetings = set(curr.keys()) - set(prev.keys())
    for m in sorted(new_meetings):
        alerts.append(f"NEW_MEETING: {m}")
    for m in sorted(curr.keys() & prev.keys()):
        changed = []
        for fname, info in curr[m].items():
            if fname not in prev[m] or prev[m][fname]["mtime"] < info["mtime"]:
                changed.append(fname)
        if changed:
            alerts.append(f"UPDATED: {m} -> {chr(44).join(changed)}")
    return alerts

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch-dir", default="E:/aigame2_publish/.handoff/meeting")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--interval", type=int, default=60)
    args = parser.parse_args()
    watch_dir = Path(args.watch_dir)
    state_file = watch_dir.parent / "watchdog-state.json"
    print(f"[WATCHDOG] watch: {watch_dir}")
    prev_state = {}
    if state_file.exists():
        try:
            prev_state = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[WARN] state load fail: {e}")
    curr_state = scan_meetings(watch_dir)
    for a in diff_states(prev_state, curr_state):
        log_alert(watch_dir, a)
    state_file.write_text(json.dumps(curr_state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[WATCHDOG] saved, watching {len(curr_state)} meetings")
    if args.once:
        return
    while True:
        time.sleep(args.interval)
        new_state = scan_meetings(watch_dir)
        new_alerts = diff_states(curr_state, new_state)
        for a in new_alerts:
            log_alert(watch_dir, a)
        if new_alerts:
            state_file.write_text(json.dumps(new_state, ensure_ascii=False, indent=2), encoding="utf-8")
            curr_state = new_state

if __name__ == "__main__":
    main()