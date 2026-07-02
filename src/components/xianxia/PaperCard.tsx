'use client';

/**
 * PaperCard — 仙侠 UI 设计系统统一卡片
 *
 * 设计目标：
 *  - 取代散落在面板组件里的 raw <section style={{ border: '1px solid #d4b478', borderRadius: '8px', background: 'rgba(255,253,247,0.94)' }}>
 *  - 默认宣纸纹理（与全局 .paper-texture 协同），三种 tone：default | golden | purple
 *  - 透传 data-testid、className、事件等
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type PaperCardTone = 'default' | 'golden' | 'purple';

export interface PaperCardProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  /** 额外 className（叠加默认），便于面板拼接自有 util */
  className?: string;
  /** 卡片色调 */
  tone?: PaperCardTone;
  /** 强制启用 paper-texture（默认 true，可由 false 关闭） */
  textured?: boolean;
}

const TONE_STYLE: Record<PaperCardTone, React.CSSProperties> = {
  default: {
    border: '1px solid #d4b478',
    borderRadius: '8px',
    background: 'rgba(255,253,247,0.94)',
  },
  golden: {
    border: '1px solid #c4a76d',
    borderRadius: '8px',
    background: 'rgba(255,250,235,0.94)',
  },
  purple: {
    border: '1px solid #9a82c2',
    borderRadius: '8px',
    background: 'rgba(248,244,255,0.94)',
  },
};

export function PaperCard({
  children,
  className = '',
  tone = 'default',
  textured = true,
  ...rest
}: PaperCardProps) {
  return (
    <section
      {...rest}
      style={{
        ...TONE_STYLE[tone],
        padding: '16px',
        ...(rest.style ?? {}),
      }}
      className={cn(textured && 'paper-texture', className)}
    >
      {children}
    </section>
  );
}

export default PaperCard;
