'use client';

// 沉浸版 Phase-Z: 触觉反馈 + 全局点击波纹。
// 不引依赖，纯浏览器 API；SSR 安全（typeof navigator 守卫）。

let _enabled = true;

/** 启用 / 关闭（玩家可在设置里关） */
export function setHapticsEnabled(v: boolean): void {
  _enabled = v;
}

/**
 * 短震 / 选择反馈。常见：
 *   tap      — 5-10ms，按钮 tap
 *   hit      — 15ms，命中
 *   crit     — 30ms，暴击
 *   error    — [10, 30, 10] 错误
 */
export type HapticPattern = 'tap' | 'hit' | 'crit' | 'error' | 'success';

export function haptic(pattern: HapticPattern = 'tap'): void {
  if (typeof window === 'undefined') return;
  if (!_enabled) return;
  try {
    const nav = (navigator as any);
    if (nav?.vibrate) {
      switch (pattern) {
        case 'tap':     nav.vibrate(8); break;
        case 'hit':     nav.vibrate(15); break;
        case 'crit':    nav.vibrate(30); break;
        case 'error':   nav.vibrate([10, 30, 10]); break;
        case 'success': nav.vibrate([10, 10, 20]); break;
      }
      return;
    }
    // Capacitor Haptics（如果用 @capacitor/haptics 包装）
    const cap = (window as any).Capacitor?.Plugins?.Haptics;
    if (cap) {
      if (pattern === 'error') {
        cap.notification?.({ type: 'ERROR' });
      } else if (pattern === 'success') {
        cap.notification?.({ type: 'SUCCESS' });
      } else {
        cap.impact?.({ style: pattern === 'crit' ? 'HEAVY' : pattern === 'hit' ? 'MEDIUM' : 'LIGHT' });
      }
    }
  } catch {
    // 静默失败
  }
}