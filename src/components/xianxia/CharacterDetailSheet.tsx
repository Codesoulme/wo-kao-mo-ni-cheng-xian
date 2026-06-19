'use client';

import { CharacterState, useGameStore } from '@/lib/xianxia/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Sparkles, Sword, Shield, Zap, Clover, Brain, Coins, Star, MapPin, Users, GraduationCap, Flame, Info } from 'lucide-react';
import { REALMS, ELEMENTS, SPIRITUAL_ROOTS } from '@/lib/xianxia/types';
import { filterMeaningfulStatuses } from '@/lib/xianxia/engine';
import { useState } from 'react';

interface CharacterDetailSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  character: CharacterState;
}

export function CharacterDetailSheet({ open, onOpenChange, character }: CharacterDetailSheetProps) {
  const liveCharacter = useGameStore(s => s.character);
  const current = liveCharacter?.id === character.id ? liveCharacter : character;
  const realmInfo = REALMS.find(r => r.id === current.realm);
  const rootInfo = SPIRITUAL_ROOTS[current.spiritualRoot as keyof typeof SPIRITUAL_ROOTS];
  const lifespanLeft = current.lifespan - current.age;
  const genderLabel = current.gender === 'male' ? '男' : current.gender === 'female' ? '女' : current.gender || '未知';
  const visibleStatuses = filterMeaningfulStatuses(current.activeStatuses || []);
  const dynamicAttributes = (current.cultivationAttributes || []).filter((attr: any) => attr && attr.visible !== false && attr.name);
  const [selectedAttr, setSelectedAttr] = useState<AttributeInfo | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto xianxia-scroll p-0">
        <SheetHeader className="px-4 pt-4 pb-2 pr-12 border-b border-border/40 bg-gradient-to-b from-secondary/40 to-transparent">
          <SheetTitle className="font-serif-cn flex items-center gap-2 min-w-0">
            <span className="seal shrink-0">道</span>
            <span className="truncate">{current.name}</span>
            <span className="shrink-0 text-[10px] font-normal text-muted-foreground rounded-full border border-border/60 bg-background/60 px-1.5 py-0.5">
              {genderLabel} · {current.age}岁
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 space-y-4">
          {/* 境界详情 */}
          <section>
            <SectionTitle icon={<Sparkles className="w-3.5 h-3.5" />} title="境界·修为" />
            <div
              className="rounded-lg border p-3 mt-1.5"
              style={{
                borderColor: `${current.realmColor}50`,
                background: `linear-gradient(135deg, ${current.realmColor}10, transparent)`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif-cn font-bold text-lg" style={{ color: current.realmColor }}>
                  {current.realmName}
                  {current.realmMaxLevel > 0 && (
                    <span className="text-xs ml-1 text-muted-foreground">
                      {current.realmLevel + 1} / {current.realmMaxLevel} 层
                    </span>
                  )}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: `${current.realmColor}20`,
                  color: current.realmColor,
                }}>
                  寿元上限 {current.lifespan}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {realmInfo?.description}
              </p>
            </div>

            {/* 修为进度 */}
            <div className="mt-2 space-y-2">
              <ProgressBar
                label="修为进度"
                current={current.cultivationExp}
                max={current.expToBreak}
                color={current.realmColor}
                showText={`${current.cultivationExp} / ${current.expToBreak}`}
                icon={<Sparkles className="w-3 h-3" />}
                onClick={() => setSelectedAttr(ATTRIBUTE_INFO.cultivationExp)}
              />
              <ProgressBar
                label="寿元"
                current={current.age}
                max={current.lifespan}
                color="#c8453c"
                showText={`${current.age} / ${current.lifespan}（余 ${lifespanLeft} 年）`}
                icon={<Heart className="w-3 h-3" />}
                onClick={() => setSelectedAttr(ATTRIBUTE_INFO.lifespan)}
              />
            </div>
          </section>

          {/* 灵根 */}
          <section>
            <SectionTitle icon={<Star className="w-3.5 h-3.5" />} title="灵根·天赋" />
            <button type="button" onClick={() => setSelectedAttr(ATTRIBUTE_INFO.spiritualRoot)} className="w-full text-left rounded-lg border border-border/60 p-3 mt-1.5 bg-card/40 transition hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-serif-cn font-semibold text-sm" style={{
                  color: current.rootMultiplier >= 1.5 ? '#c8453c' : current.rootMultiplier >= 0.8 ? '#2e5c8a' : undefined,
                }}>
                  {current.rootDetail}
                </span>
                {current.rootMultiplier > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    修炼 ×{current.rootMultiplier}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{rootInfo?.description}</p>
              <p className="mt-1 text-[10px] text-primary/70 flex items-center gap-1"><Info className="w-3 h-3" />点按查看影响</p>
            </button>

            {/* 五行 */}
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {(['metal', 'wood', 'water', 'fire', 'earth'] as const).map(el => {
                const v = current.elements[el];
                return (
                  <button key={el} type="button" onClick={() => setSelectedAttr(ATTRIBUTE_INFO[`element_${el}`])} className="text-center rounded-md p-1 transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25">
                    <div className="text-[10px]" style={{ color: ELEMENTS[el].color }}>
                      {ELEMENTS[el].icon}{ELEMENTS[el].name}
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${v}%`, background: ELEMENTS[el].color }}
                      />
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{v}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 气血灵力 */}
          <section>
            <SectionTitle icon={<Heart className="w-3.5 h-3.5" />} title="气血·灵力" />
            <div className="space-y-2 mt-1.5">
              <ProgressBar
                label="生命"
                current={current.hp}
                max={current.maxHp}
                color="#dc2626"
                showText={`${current.hp} / ${current.maxHp}`}
                icon={<Heart className="w-3 h-3" />}
                onClick={() => setSelectedAttr(ATTRIBUTE_INFO.hp)}
              />
              <ProgressBar
                label="灵力"
                current={current.mp}
                max={current.maxMp}
                color="#2e5c8a"
                showText={`${current.mp} / ${current.maxMp}`}
                icon={<Sparkles className="w-3 h-3" />}
                onClick={() => setSelectedAttr(ATTRIBUTE_INFO.mp)}
              />
            </div>
          </section>

          {/* 战斗属性 */}
          <section>
            <SectionTitle icon={<Sword className="w-3.5 h-3.5" />} title="武学·属性" />
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <StatCard icon={<Sword className="w-3 h-3" />} label="攻击" value={current.attack} color="#c8453c" info={ATTRIBUTE_INFO.attack} onClick={setSelectedAttr} />
              <StatCard icon={<Shield className="w-3 h-3" />} label="防御" value={current.defense} color="#2e5c8a" info={ATTRIBUTE_INFO.defense} onClick={setSelectedAttr} />
              <StatCard icon={<Zap className="w-3 h-3" />} label="速度" value={current.speed} color="#d4af37" info={ATTRIBUTE_INFO.speed} onClick={setSelectedAttr} />
              <StatCard icon={<Clover className="w-3 h-3" />} label="气运" value={current.luck} color="#22c55e" info={ATTRIBUTE_INFO.luck} onClick={setSelectedAttr} />
              <StatCard icon={<Brain className="w-3 h-3" />} label="悟性" value={current.comprehension} color="#a855f7" info={ATTRIBUTE_INFO.comprehension} onClick={setSelectedAttr} />
              <StatCard icon={<Coins className="w-3 h-3" />} label="灵石" value={current.spiritStones} color="#d4af37" info={ATTRIBUTE_INFO.spiritStones} onClick={setSelectedAttr} />
              <StatCard icon={<Star className="w-3 h-3" />} label="声望" value={current.reputation} color="#f97316" info={ATTRIBUTE_INFO.reputation} onClick={setSelectedAttr} />
              <StatCard icon={<Flame className="w-3 h-3" />} label="心魔" value={(current as any).heartDemon ?? 0} color={(current as any).heartDemon >= 60 ? '#dc2626' : (current as any).heartDemon >= 30 ? '#d97706' : '#65a30d'} info={ATTRIBUTE_INFO.heartDemon} onClick={setSelectedAttr} />
              <StatCard icon={<Users className="w-3 h-3" />} label="阵营" value={current.faction || '散修'} color="#6b7280" isText info={ATTRIBUTE_INFO.faction} onClick={setSelectedAttr} />
            </div>
          </section>

          {/* 师承·所在 */}
          <section>
            <SectionTitle icon={<GraduationCap className="w-3.5 h-3.5" />} title="师承·所在" />
            <div className="rounded-lg border border-border/60 p-3 mt-1.5 bg-card/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> 师承
                </span>
                <span className="font-serif-cn">{current.master || '无'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> 所在
                </span>
                <span className="font-serif-cn">{current.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> 宗门
                </span>
                <span className="font-serif-cn">{current.faction || '散修'}</span>
              </div>
            </div>
          </section>

          {/* 状态摘要 */}
          <section>
            <SectionTitle icon={<Star className="w-3.5 h-3.5" />} title={`状态 (${visibleStatuses.length})`} />
            <div className="rounded-lg border border-border/60 p-2 mt-1.5 bg-card/40">
              {visibleStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">尚无状态</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {visibleStatuses.map((s: any, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: `${RARITY_COLORS[s.rarity] || '#6b7280'}40`,
                        color: RARITY_COLORS[s.rarity] || '#6b7280',
                        background: `${RARITY_COLORS[s.rarity] || '#6b7280'}10`,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 背包摘要 */}
          <section className="pb-4">
            <SectionTitle icon={<Coins className="w-3.5 h-3.5" />} title={`储物袋 (${current.inventory.length})`} />
            <div className="rounded-lg border border-border/60 p-2 mt-1.5 bg-card/40">
              {current.inventory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">储物袋空空如也</p>
              ) : (
                <div className="space-y-1">
                  {current.inventory.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-serif-cn" style={{ color: RARITY_COLORS[item.rarity] || '#6b7280' }}>
                        {item.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {RARITY_LABEL[item.rarity] || item.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
      <AttributeInfoDialog info={selectedAttr} onOpenChange={(nextOpen) => !nextOpen && setSelectedAttr(null)} />
    </Sheet>
  );
}

type AttributeInfo = {
  title: string;
  summary: string;
  affects: string[];
};

const ATTRIBUTE_INFO: Record<string, AttributeInfo> = {
  spiritualRoot: { title: '灵根', summary: '决定修行根基与修炼速度，是角色能否入道、修得快慢和奇遇承载力的核心天赋。', affects: ['修炼速度倍率与修为增长', '突破底气与高阶传承适配', '宗门收徒、师承眼缘和资源倾斜', '洗髓、夺舍、血脉觉醒等长期剧情'] },
  cultivationExp: { title: '修为', summary: '代表灵力积累与境界进度，达到门槛后才有破境可能。', affects: ['境界突破与连破判定', '高境界事件、秘境和敌人的出现范围', '部分功法、法宝和宗门身份的使用门槛', '战斗基础强度与叙事中的威慑力'] },
  lifespan: { title: '寿元', summary: '寿元是角色仍能在人间修行的时间。年龄逼近上限时，闭关、求丹、突破会变得更紧迫。', affects: ['寿尽坐化风险', '延寿丹药、秘境机缘和突破收益', '长期任务的时间压力', '老迈、伤病和传承安排叙事'] },
  hp: { title: '气血', summary: '气血衡量肉身承伤与当前伤势。气血过低时，角色更容易避战、疗伤或在战斗中败亡。', affects: ['战斗存活与受伤结算', '疗伤、休养、丹药使用事件', '探索危险秘境时的风险', '重伤状态与后续行动倾向'] },
  mp: { title: '灵力', summary: '灵力是施展法术、御器和支撑阵法的消耗根基。', affects: ['战斗技能释放与持续作战', '阵法、法宝、符箓等消耗判断', '闭关调息、灵力枯竭相关事件', '高强度探索或斗法的风险'] },
  attack: { title: '攻击', summary: '攻击影响斗法中的杀伤力，也代表角色主动破局的锋芒。', affects: ['战斗造成伤害', '狩猎、劫斗、比试等事件胜算', '对弱小敌人的威慑', '武器、功法、灵宠加成收益'] },
  defense: { title: '防御', summary: '防御影响承受攻击的能力，也代表护体法门和肉身韧性。', affects: ['战斗减伤与败亡风险', '秘境陷阱、妖兽冲撞和天劫余波', '护甲、阵法、防御符的收益', '受伤后是否需要长期休养'] },
  speed: { title: '速度', summary: '速度影响出手、闪避、追逃和游历效率。', affects: ['战斗先手与闪避叙事', '逃离追杀或追击敌人', '赶赴约期、秘境潮汐等时间事件', '遁术、身法、飞行法器收益'] },
  luck: { title: '气运', summary: '气运影响机缘的临门一脚，也会改变风险事件的走向。', affects: ['奇遇、宝物、贵人相助概率', '探索和拍卖中遇见好物的机会', '灾厄、走火入魔和意外损失的缓冲', 'AI 生成事件时的机会/风险权重'] },
  comprehension: { title: '悟性', summary: '悟性影响理解功法、顿悟和把经历化为修为的能力。', affects: ['修炼、闭关和参悟类事件收益', '学习功法、法术、阵道丹道的速度', '突破时对瓶颈的理解', '同等机缘下能否领会隐藏传承'] },
  spiritStones: { title: '灵石', summary: '灵石是修仙界通用资源，既是交易筹码，也是修炼与行动的底气。', affects: ['购买丹药、法宝、材料和情报', '拍卖会出价与竞争上限', '传送、秘境准备、疗伤和打点人情', '贫富差距带来的机缘或劫修风险'] },
  reputation: { title: '声望', summary: '声望代表角色在周边修仙界的名气与可信度。', affects: ['宗门、坊市、散修圈的态度', '求助、结盟、交易、拜师成功率', '仇敌盯上或强者注意的概率', '称号、身份和势力关系推进'] },
  heartDemon: { title: '心魔', summary: '心魔越高，道心越不稳；它既能带来执念推进，也会引发修炼与战斗风险。', affects: ['修炼效率与走火入魔风险', '心魔试炼、幻境、执念相关事件', '杀伐、邪功、屈辱和仇恨的后果', '清心丹、顿悟、了却因果的收益'] },
  faction: { title: '阵营/宗门', summary: '阵营决定角色背后的资源、人情、规矩和敌友关系。', affects: ['师承、任务、俸禄和宗门庇护', '宗门冲突、比试、追责和身份限制', 'NPC 态度与势力地图变化', '长期因果线索的承接方向'] },
  element_metal: { title: '金行', summary: '金行偏锋锐、杀伐、器物和决断。', affects: ['金系功法、剑诀、炼器适配', '攻击、破甲、肃杀类事件倾向', '对应秘境、法宝和敌人的亲和/克制'] },
  element_wood: { title: '木行', summary: '木行偏生机、疗愈、草木和绵长。', affects: ['木系功法、灵植、炼丹材料亲和', '疗伤、恢复、培育灵宠与灵田事件', '生机传承和毒草瘴林类秘境'] },
  element_water: { title: '水行', summary: '水行偏流转、隐匿、寒意和柔韧。', affects: ['水系功法、遁术、幻术和控场', '江河湖海、寒潭、雾楼等地点机缘', '闪避、潜行、调息类叙事倾向'] },
  element_fire: { title: '火行', summary: '火行偏爆发、炼化、丹火和心性炽烈。', affects: ['火系功法、炼丹、爆发斗法', '火脉、丹炉、炎域等机缘', '心魔、血战、急进突破相关风险'] },
  element_earth: { title: '土行', summary: '土行偏厚重、防护、承载和阵势。', affects: ['土系功法、阵法、防御和地脉亲和', '洞府、矿脉、山岳秘境机缘', '防御、储物、护宗阵势类事件'] },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#6b7280', uncommon: '#22c55e', rare: '#3b82f6',
  epic: '#a855f7', legendary: '#d4af37', mythic: '#ec4899',
};
const RARITY_LABEL: Record<string, string> = {
  common: '凡品', uncommon: '良品', rare: '稀有',
  epic: '史诗', legendary: '传说', mythic: '神话',
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-foreground">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-serif-cn font-semibold tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-border/40 ml-1" />
    </div>
  );
}

function StatCard({ icon, label, value, color, isText, info, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; isText?: boolean; info?: AttributeInfo; onClick?: (info: AttributeInfo) => void;
}) {
  const clickable = Boolean(info && onClick);
  const content = (
    <>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
        {clickable && <Info className="w-2.5 h-2.5 ml-auto text-primary/60" />}
      </div>
      <div className="text-sm font-semibold mt-0.5 font-serif-cn truncate" style={{ color }}>
        {isText ? value : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </>
  );
  if (!clickable || !info || !onClick) return <div className="rounded-md border border-border/60 p-2 bg-card/40">{content}</div>;
  const handleClick = () => onClick(info);
  return (
    <button type="button" onClick={handleClick} className="text-left rounded-md border border-border/60 p-2 bg-card/40 transition hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25">
      {content}
    </button>
  );
}

function ProgressBar({ label, current, max, color, showText, icon, onClick }: {
  label: string; current: number; max: number; color: string; showText?: string; icon?: React.ReactNode; onClick?: () => void;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const body = (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
          {onClick && <Info className="w-2.5 h-2.5 text-primary/60" />}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{showText}</span>
      </div>
      <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 relative"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}aa, ${color})`,
            boxShadow: `0 0 6px ${color}66`,
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)'
          }} />
        </div>
      </div>
    </div>
  );
  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-md p-1 -m-1 transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25">
      {body}
    </button>
  );
}


function AttributeInfoDialog({ info, onOpenChange }: { info: AttributeInfo | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(info)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif-cn flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            {info?.title || '属性说明'}
          </DialogTitle>
        </DialogHeader>
        {info && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">{info.summary}</p>
            <div>
              <div className="text-xs font-semibold mb-1.5 text-foreground">会影响</div>
              <ul className="space-y-1.5">
                {info.affects.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
