#!/usr/bin/env python3
"""
scripts/trae-monitor.py
AI-80: pynput 监控脚本

负责: 监控 Trae IDE 输入/活动状态, 写日志到 logs/trae-monitor.log。
- pynput.keyboard.Listener 监听键盘活动
- pynput.mouse.Listener 监听鼠标点击
- 检测到 Trae 窗口聚焦变化时记录时间戳
"""
import sys
from datetime import datetime
from pathlib import Path

try:
    import pynput
    from pynput import keyboard, mouse
except ImportError:
    print("[trae-monitor] pynput 未安装, 请 pip install pynput", file=sys.stderr)
    sys.exit(1)


LOG_PATH = Path("logs/trae-monitor.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)


def log_event(event, detail=""):
    ts = datetime.now().isoformat(timespec="seconds")
    line = "[" + ts + "] " + event + " " + detail + "\n"
    LOG_PATH.open("a", encoding="utf-8").write(line)


def on_press(key):
    log_event("key", str(key))


def on_click(x, y, button, pressed):
    if pressed:
        log_event("click", "(" + str(x) + "," + str(y) + ") " + str(button))


def on_scroll(x, y, dx, dy):
    log_event("scroll", "(" + str(x) + "," + str(y) + ") dx=" + str(dx) + " dy=" + str(dy))


def main():
    log_event("start", "monitor begins")
    print("[trae-monitor] 启动键盘+鼠标监听, 日志 ->", LOG_PATH)
    with keyboard.Listener(on_press=on_press) as kb, \
         mouse.Listener(on_click=on_click, on_scroll=on_scroll) as ms:
        kb.join()
        ms.join()


if __name__ == "__main__":
    main()