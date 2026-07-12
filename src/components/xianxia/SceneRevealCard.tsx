'use client';

/**
 * 生成式 UI DEMO #3 —— 场景现身卡
 *
 * 触发条件：event.blueprint?.category 命中 exploration|secret_realm|travel|encounter
 * 数据来源：EventTimeline 传入 location / categoryLabel / narrative
 * 视觉：宽卡片 + 场景类型 emoji + 大字地点 + 一小段场景摘要（水墨中性色）
 */

import { cn } from '@/lib/utils';

interface SceneRevealCardProps {
  /** 地点名（character.location 或 blueprint.name） */
  location: string;
  /** 分类中文标签（如"奇遇"、"探幽"、"秘境"、"游历"） */
  categoryLabel?: string;
  /** 事件叙事正文（取前 40 字做摘要） */
  narrative?: string;
}

// 关键词 → 场景 emoji 映射（简单关键词匹配）
const SCENE_KEYWORDS: Array<{ pattern: RegExp; icon: string; label: string }> = [
  { pattern: /坊市|集市|市/, icon: '🌆', label: '坊市' },
  { pattern: /海|江|湖|溪|潭|瀑/, icon: '🌊', label: '水岸' },
  { pattern: /密林|林|森|竹|柏/, icon: '🌲', label: '林野' },
  { pattern: /秘境|遗迹|遗府/, icon: '🏜', label: '秘境' },
  { pattern: /宗门|门派|殿|阁|楼|台/, icon: '🏛', label: '宗门' },
  { pattern: /洞府|洞|穴|窟/, icon: '🕳', label: '洞府' },
  { pattern: /山谷|谷|涧/, icon: '🏔', label: '山谷' },
  { pattern: /山|峰|岭|岗|崖/, icon: '🏔', label: '山岭' },
];

function sceneIconFor(location: string): { icon: string; hint: string } {
  const src = String(location || '');
  for (const rule of SCENE_KEYWORDS) {
    if (rule.pattern.test(src)) return { icon: rule.icon, hint: rule.label };
  }
  return { icon: '✦', hint: '风景' };
}

/** 取 narrative 前 40 字，过滤掉标点结尾，做场景摘要 */
function digestNarrative(text: string, limit = 40): string {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const cut = s.length > limit ? s.slice(0, limit) : s;
  // 去掉行尾的标点，让摘要看起来干净
  return cut.replace(/[，。；！？、,.;!?]+$/g, '').trim();
}

export function SceneRevealCard({ location, categoryLabel, narrative }: SceneRevealCardProps) {
  const trimmed = String(location || '').trim();
  if (!trimmed) return null;

  const { icon, hint } = sceneIconFor(trimmed);
  const digest = digestNarrative(narrative || '');
  const chipLabel = String(categoryLabel || hint).trim() || hint;

  return (
    <div
      data-testid="scene-reveal-card"
      className={cn(
        'relative mt-3 rounded-xl border-2 px-4 py-3 paper-texture overflow-hidden',
        'border-stone-300 bg-stone-50/60',
        'animate-in fade-in zoom-in-95 duration-500',
      )}
    >
      {/* 中性水墨光晕 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle at 85% 15%, rgba(180,180,170,0.4) 0%, transparent 60%)',
        }}
      />

      <div className="relative flex items-center gap-3">
        {/* 场景 emoji */}
        <div
          className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-3xl border border-stone-300 bg-stone-100/70"
          aria-hidden
        >
          {icon}
        </div>

        {/* 主体 */}
        <div className="flex-1 min-w-0">
          {/* 顶栏 chip */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border border-stone-300 bg-stone-100/70 text-stone-700 font-serif-cn tracking-wider">
              {chipLabel}
            </span>
          </div>

          {/* 中央大字：地点名 */}
          <div className="font-serif-cn font-bold text-lg text-stone-800 tracking-wider truncate">
            {trimmed}
          </div>

          {/* 场景摘要 */}
          {digest && (
            <p className="mt-1 text-xs text-stone-600/85 leading-relaxed font-serif-cn xianxia-prose">
              {digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
