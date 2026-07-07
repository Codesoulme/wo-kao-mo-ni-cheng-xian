'use client';

// 沉浸版 Phase-Z: 全局点击波纹（ripple）。
// 监听 mousedown / touchstart，捕获点击位置画一个扩散圆，自动消失。
// 用 React portal 渲染到 body，避免被局部 overflow:hidden 切掉。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '@/lib/haptics';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: 'amber' | 'emerald' | 'sky';
}

let _seq = 0;

function colorFor(target: EventTarget | null): Ripple['hue'] {
  const el = target as HTMLElement | null;
  if (!el) return 'amber';
  // 关键按钮 → emerald；危险按钮 → amber；其他 → sky
  if (el.closest('[data-ripple-tone="emerald"]')) return 'emerald';
  if (el.closest('[data-ripple-tone="amber"]')) return 'amber';
  if (el.closest('[data-ripple-tone="sky"]')) return 'sky';
  return 'amber';
}

const TONE_CLASS: Record<Ripple['hue'], string> = {
  emerald: 'bg-emerald-400/40',
  amber:   'bg-amber-400/50',
  sky:     'bg-sky-400/40',
};

export function TapRipple() {
  const [mounted, setMounted] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    setMounted(true);
    let last = 0;
    const onPointerDown = (ev: PointerEvent | MouseEvent | TouchEvent) => {
      // 简单节流：40ms 内只允许一次
      const now = Date.now();
      if (now - last < 40) return;
      last = now;
      // 触发 haptic
      haptic('tap');

      let clientX = 0, clientY = 0;
      if ('clientX' in ev) {
        clientX = (ev as any).clientX;
        clientY = (ev as any).clientY;
      } else if ('touches' in ev && (ev as TouchEvent).touches?.[0]) {
        clientX = (ev as TouchEvent).touches[0].clientX;
        clientY = (ev as TouchEvent).touches[0].clientY;
      }
      const size = 64;
      const hue = colorFor(ev.target);
      const id = ++_seq;
      setRipples((prev) => [...prev, { id, x: clientX, y: clientY, size, hue }]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div aria-hidden="true" data-testid="tap-ripple-layer" className="pointer-events-none fixed inset-0 z-[90]">
      {ripples.map((r) => (
        <span
          key={r.id}
          data-testid="tap-ripple"
          className={`absolute rounded-full ${TONE_CLASS[r.hue]} animate-[fx-tap-ripple_0.55s_ease-out_forwards]`}
          style={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}