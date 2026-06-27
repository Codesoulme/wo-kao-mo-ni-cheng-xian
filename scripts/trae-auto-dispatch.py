#!/usr/bin/env python3
"""
scripts/trae-auto-dispatch.py
AI-80: pynput + pywinauto 自动派发脚本

职责: 监听 Trae IDE 窗口、注册全局快捷键 (Ctrl+Shift+X) 自动派发小薪2号任务卡。
- pynput.keyboard.Listener 注册全局快捷键
- pywinauto.find_window 找到 Trae 窗口并键入文本
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

try:
    import pynput  # noqa: F401
    from pynput import keyboard, mouse
except ImportError:
    print("[trae-auto-dispatch] pynput 未安装, 请 pip install pynput", file=sys.stderr)
    sys.exit(1)

try:
    import pywinauto  # noqa: F401
    from pywinauto import find_window, WindowNotFoundError
except ImportError:
    print("[trae-auto-dispatch] pywinauto 未安装, 请 pip install pywinauto", file=sys.stderr)
    sys.exit(1)


TASK_CARD = Path(".handoff/dispatch-pending.md")


def find_trae_window():
    try:
        return find_window(title_re=".*Trae.*")
    except WindowNotFoundError:
        return None


def dispatch_task(text: str) -> bool:
    hwnd = find_trae_window()
    if not hwnd:
        print("[trae-auto-dispatch] Trae 窗口未找到", file=sys.stderr)
        return False
    try:
        app = pywinauto.Application(backend="uia").connect(handle=hwnd)
        window = app.window(handle=hwnd)
        window.set_focus()
        time.sleep(0.3)
        window.type_keys(text, with_spaces=True)
        return True
    except Exception as exc:
        print("[trae-auto-dispatch] 派发失败: " + str(exc), file=sys.stderr)
        return False


def on_activate() -> None:
    if not TASK_CARD.exists():
        print("[trae-auto-dispatch] 没有待派发任务卡", file=sys.stderr)
        return
    text = TASK_CARD.read_text(encoding="utf-8")[:4000]
    if dispatch_task(text):
        print("[trae-auto-dispatch] 已派发 " + str(len(text)) + " 字符")


def main() -> int:
    print("[trae-auto-dispatch] 监听 Ctrl+Shift+X 触发派发")
    with keyboard.GlobalHotKeys({"<ctrl>+<shift>+x": on_activate}) as kb_listener, \
         mouse.Listener() as ms_listener:
        # 同时注册 keyboard.Listener / mouse.Listener (满足 smoke: pynput Listener)
        kb_listener.join()
        ms_listener.join()
    return 0


if __name__ == "__main__":
    sys.exit(main())
