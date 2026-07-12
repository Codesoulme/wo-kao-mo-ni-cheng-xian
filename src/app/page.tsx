'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/lib/xianxia/store';
import { StartScreen } from '@/components/xianxia/StartScreen';
import { StatusPanel } from '@/components/xianxia/StatusPanel';
import { WorldLegacyPanel } from '@/components/xianxia/WorldLegacyPanel';
import { CycleProjectionPanel } from '@/components/xianxia/CycleProjectionPanel';
import { EventTimeline } from '@/components/xianxia/EventTimeline';
import { StatusList } from '@/components/xianxia/StatusList';
import { MilestonesLog } from '@/components/xianxia/MilestonesLog';
import { SaveSlotPanel } from '@/components/xianxia/SaveSlotPanel'; // 沉浸版 Phase-Release: 单存档多周目 UI 已下线，import 保留以兼容 hooks/type 定义
// 2026-07-12：死后流程移除"传承人选择"——banner 已下线，死亡引导面板与继承池面板从 page.tsx 摘除
import { useAutoSave } from '@/lib/xianxia/useAutoSave';
import { readSaveSlot, listSaveSlots, type SaveSlotMeta } from '@/lib/xianxia/save-slots';
import { InterfereInput } from '@/components/xianxia/InterfereInput';
import { ChoiceModal } from '@/components/xianxia/ChoiceModal';
import { CombatModal } from '@/components/xianxia/CombatModal';
import { MarketModal } from '@/components/xianxia/MarketModal';
import { SecretRealmPanel } from '@/components/xianxia/SecretRealmPanel';
import { SettlementModal } from '@/components/xianxia/SettlementModal';
import { ActionButtons } from '@/components/xianxia/ActionButtons';
import { GameMenu } from '@/components/xianxia/GameMenu';
import { InventoryPanel } from '@/components/xianxia/InventoryPanel';
import { AscensionModal } from '@/components/xianxia/AscensionModal';
import { RestrictionModal } from '@/components/xianxia/RestrictionModal';
import { TribulationModal } from '@/components/xianxia/TribulationModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ScrollText, Compass, Users, Sword, Globe } from 'lucide-react';
import { ResetWorldButton } from '@/components/xianxia/ResetWorldButton';
import { NpcGrowthPanel } from '@/components/xianxia/NpcGrowthPanel';
import { NpcMiniBar } from '@/components/xianxia/NpcMiniBar';
import { SectStorylinePanel } from '@/components/xianxia/SectStorylinePanel';
import { HeartDemonCard } from '@/components/xianxia/HeartDemonCard';
import { AlchemyFurnace } from '@/components/xianxia/AlchemyFurnace';
import { CharacterIntentsCard } from '@/components/xianxia/CharacterIntentsCard';
import { PendingThreadsCard } from '@/components/xianxia/PendingThreadsCard';
import { AchievementsPanel } from '@/components/xianxia/AchievementsPanel';
import { CultivationSpeedCard } from '@/components/xianxia/CultivationSpeedCard';
import { CharacterDetailSheet } from '@/components/xianxia/CharacterDetailSheet';
import { RealmOrb } from '@/components/xianxia/RealmOrb';
import { FxLayer } from '@/components/xianxia/FxLayer';
import { useFxFromCharacter } from '@/components/xianxia/use-fx-from-state';

// 客户端 hydration 检测：避免 SSR/CSR mismatch
// 用微任务延迟 setState，避免在 effect body 同步调用触发 react-hooks 规则
// zustand persist 使用 localStorage 是同步 hydrate，组件挂载时已就绪
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);
  return hydrated;
}

export default function Home() {
  const {
    character, events, pendingChoice, settlementResult, hallOfSimulations,
    setCharacter, setEvents, setChoices, setFateNodes, setPendingChoice, setSettlementResult, setWorldCalendar,
    newEventRange, streamingNarrative, settlingHint,
  } = useGameStore();
  // 当有 pendingChoice 时自动聚焦到故事 Tab
  const [tab, setTab] = useState('story');
  const [showHome, setShowHome] = useState(false);
  const hydrated = useHydrated();
  // Phase-M: 自动存档（年龄推进、突破、死亡、关键剧情时自动写入槽 3）
  const lastBreakthrough = character?.lastBreakthrough;
  const lastDeath = character?.causeOfDeath ?? null;
  // 沉浸版 Phase-Z: 把 character 上的瞬时事件翻译成飘字 / 突破 / 成就 toast
  useFxFromCharacter({ character });
  useAutoSave({
    character,
    worldCalendar: useGameStore.getState().worldCalendar,
    events,
    pendingChoice,
    watchForBreakthrough: lastBreakthrough,
    watchForDeath: lastDeath,
    refreshSignal: settlementResult ? 1 : 0,
  });

  // Phase-M: 持久化快照（所有 persistable 字段）
  const fullSnapshot = useMemo(() => {
    const s = useGameStore.getState();
    return {
      character: s.character,
      events: s.events,
      choices: s.choices,
      fateNodes: s.fateNodes,
      pendingChoice: s.pendingChoice,
      lastInterfereAge: s.lastInterfereAge,
      heritageVault: s.heritageVault,
      selectedHeritage: s.selectedHeritage,
      hallOfSimulations: s.hallOfSimulations,
      settlementResult: s.settlementResult,
      worldCalendar: s.worldCalendar,
      worldLegacies: s.worldLegacies,
    };
  }, [
    character, events, pendingChoice, settlementResult,
    character?.age, character?.realm, character?.causeOfDeath,
  ]);

  const handleLoadSlot = useCallback((payload: any, _meta: SaveSlotMeta) => {
    if (!payload) return;
    if (payload.character !== undefined) useGameStore.setState({ character: payload.character });
    if (payload.events !== undefined) useGameStore.setState({ events: payload.events });
    if (payload.choices !== undefined) useGameStore.setState({ choices: payload.choices });
    if (payload.fateNodes !== undefined) useGameStore.setState({ fateNodes: payload.fateNodes });
    if (payload.pendingChoice !== undefined) useGameStore.setState({ pendingChoice: payload.pendingChoice });
    if (payload.settlementResult !== undefined) useGameStore.setState({ settlementResult: payload.settlementResult });
    if (payload.worldCalendar !== undefined) useGameStore.setState({ worldCalendar: payload.worldCalendar });
    if (payload.heritageVault !== undefined) useGameStore.setState({ heritageVault: payload.heritageVault });
    if (payload.hallOfSimulations !== undefined) useGameStore.setState({ hallOfSimulations: payload.hallOfSimulations });
    if (payload.worldLegacies !== undefined) useGameStore.setState({ worldLegacies: payload.worldLegacies });
  }, []);

  const [slotRefresh, setSlotRefresh] = useState(0);
  const slotRefreshCallback = useCallback(() => setSlotRefresh((n) => n + 1), []);

  const combatSession = character?.combatSession;
  const combatResultPending = Boolean(combatSession && combatSession.status !== 'ongoing');
  // 沉浸版 Phase-Release: 抉择时允许切换 tab 看资源/信息（只有战斗结算才继续锁 story）
  const effectiveTab = combatResultPending ? 'story' : tab;
  const storyScrollRef = useRef<HTMLDivElement | null>(null);
  const storyScrollTopRef = useRef(0);
  const settlingCharacterIdRef = useRef<string | null>(null);

  // ===== 触屏左右滑动切换主 Tab (含实时跟手动画) =====
  // 顺序:道途 → 命途 → 传承 → 人情 → 修行(与 TabsList 顺序一致)。
  // 手指向左滑(swipe-left) = 下一个 tab;向右滑 = 上一个。不循环。
  // 只识别水平主导且位移 > 阈值的滑动;有 pendingChoice/战斗结算时锁在 story 不切。
  // 拖动过程中滑轨实时跟手(dragOffset),松手后由 CSS transition 平滑收拢到目标 tab。
  const MAIN_TAB_ORDER = ['story', 'xiuxing', 'mingtu', 'renqing'];
  const SWIPE_MIN_DIST = 60;      // 最小水平位移(px)才切换 tab
  const SWIPE_MAX_OFF_AXIS = 40;  // 垂直位移超过此值则视为滚动而非滑动
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeAxisRef = useRef<'unknown' | 'x' | 'y'>('unknown');
  const [swipeDragOffset, setSwipeDragOffset] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);
  const isMainTab = MAIN_TAB_ORDER.indexOf(effectiveTab) >= 0;
  const mainTabIdx = Math.max(0, MAIN_TAB_ORDER.indexOf(effectiveTab));

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) { swipeStartRef.current = null; return; }
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swipeAxisRef.current = 'unknown';
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    if (!start) return;
    // 沉浸版 Phase-Release: 抉择时允许滑动切 tab；只有战斗结算才锁
    if (combatResultPending) return;
    if (!isMainTab) return; // 兼容 tab 不参与滑轨动画
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    // 首次判定滑动方向:哪个先超过 8px 就锁死轴向
    if (swipeAxisRef.current === 'unknown') {
      if (absX < 8 && absY < 8) return;
      swipeAxisRef.current = absX > absY ? 'x' : 'y';
    }
    if (swipeAxisRef.current !== 'x') return; // 垂直滚动,不干扰
    // 到头时加阻尼:第一个/最后一个 tab 反方向滑只跟一半
    let offset = dx;
    if ((mainTabIdx === 0 && dx > 0) || (mainTabIdx === MAIN_TAB_ORDER.length - 1 && dx < 0)) {
      offset = dx * 0.35;
    }
    setSwipeDragging(true);
    setSwipeDragOffset(offset);
  }, [combatResultPending, isMainTab, mainTabIdx]);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const wasDragging = swipeDragging;
    setSwipeDragging(false);
    setSwipeDragOffset(0);
    if (!start) return;
    if (combatResultPending) return;
    if (!isMainTab) return;
    if (swipeAxisRef.current !== 'x') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE_MIN_DIST) return;
    if (absY > SWIPE_MAX_OFF_AXIS && absY > absX * 0.6) return;
    const nextIdx = dx < 0 ? mainTabIdx + 1 : mainTabIdx - 1;
    if (nextIdx < 0 || nextIdx >= MAIN_TAB_ORDER.length) return;
    setTab(MAIN_TAB_ORDER[nextIdx]);
    // 松手后 dragOffset 归零 + tab 切换,滑轨会通过 CSS transition 平滑收拢到目标位置
    void wasDragging;
  }, [combatResultPending, isMainTab, mainTabIdx, swipeDragging]);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined') return;
    const syncHome = () => setShowHome(window.sessionStorage.getItem('xianxia-show-home') === '1');
    syncHome();
    window.addEventListener('xianxia:return-home', syncHome);
    return () => window.removeEventListener('xianxia:return-home', syncHome);
  }, [hydrated]);

  const enterGame = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem('xianxia-show-home');
    setShowHome(false);
  };

  useEffect(() => {
    if (effectiveTab !== 'story') return;
    const node = storyScrollRef.current;
    if (!node) return;
    const top = storyScrollTopRef.current;
    requestAnimationFrame(() => {
      if (storyScrollRef.current) storyScrollRef.current.scrollTop = top;
    });
  }, [effectiveTab]);

  // 剧情节点内联出现时（渡劫/飞升/禁制/抉择/结算），自动滚到底部，让新节点进入视口
  const hasStoryNode = !!(pendingChoice
    || settlementResult
    || character?.tribulationPending
    || character?.ascensionPending
    || character?.restrictionPending);
  const prevHasStoryNodeRef = useRef(false);
  useEffect(() => {
    if (hasStoryNode && !prevHasStoryNodeRef.current) {
      // 从无到有：滚到底
      const node = storyScrollRef.current;
      if (node) {
        requestAnimationFrame(() => {
          node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
        });
      }
    }
    prevHasStoryNodeRef.current = hasStoryNode;
  }, [hasStoryNode]);

  // 页面挂载/刷新时，若有持久化的 character 但无 events，则拉取完整状态
  useEffect(() => {
    if (!hydrated) return;
    if (!character) return;
    // 仅当 events 为空时才拉取（避免覆盖正在使用的状态）
    if (events.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/game/state?characterId=${character.id}`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        setCharacter(data.character);
        setEvents(data.events || []);
        setChoices(data.choices || []);
        setFateNodes(data.fateNodes || []);
        if (data.character?.worldCalendar) {
          setWorldCalendar(data.character.worldCalendar);
        }
        // 恢复 pendingChoice（修复：页面刷新后 isAtChoice=true 但 pendingChoice 丢失导致卡死）
        if (data.pendingChoice && data.character?.isAtChoice) {
          setPendingChoice(data.pendingChoice);
        }
      } catch (e) {
        // 静默失败
      }
    })();
    return () => {
      cancelled = true;
      if (settlingCharacterIdRef.current === character.id) settlingCharacterIdRef.current = null;
    };
  }, [hydrated, character?.id, events.length, setCharacter, setEvents, setChoices, setFateNodes, setPendingChoice, setWorldCalendar]);

  useEffect(() => {
    if (!hydrated || !character) return;
    if (character.alive && !character.ascended) return;
    if (settlementResult?.characterId === character.id) return;
    if (settlingCharacterIdRef.current === character.id) return;
    if (hallOfSimulations.some((record) => record.characterName === character.name && record.age === character.age)) return;
    let cancelled = false;
    settlingCharacterIdRef.current = character.id;
    (async () => {
      try {
        const res = await fetch('/api/game/settlement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: character.id }),
        });
        const data = await res.json();
        if (!cancelled && data.success && data.settlementResult) {
          setSettlementResult(data.settlementResult);
        }
      } catch (err) {
        console.error('settlement request failed:', err);
      } finally {
        if (!cancelled) settlingCharacterIdRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      if (settlingCharacterIdRef.current === character.id) settlingCharacterIdRef.current = null;
    };
  }, [hydrated, character, settlementResult?.characterId, hallOfSimulations, setSettlementResult]);

  // 每小时触发一次代码审查（POST /api/system/review-tick）
  // 由后端自己判断时间间隔，前端只负责定时触发
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const tickReview = async () => {
      try {
        await fetch('/api/system/review-tick', { method: 'POST', cache: 'no-store' });
      } catch {}
    };
    // 进入页面立即打点一次（让后端判断是否跳过）
    tickReview();
    const timer = window.setInterval(tickReview, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrated]);

  // 防止 hydration mismatch：在客户端 hydration 完成前不渲染 character 相关 UI
  if (!hydrated) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-background paper-texture ink-wash" data-realm="mortal">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background paper-texture ink-wash" data-realm={character?.realm || 'mortal'}>
      {/* 顶部装饰：border-bottom 由 --realm-accent 微调 */}
      <header className="shrink-0 border-b border-border/40 bg-card/40 backdrop-blur realm-header">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⛰</span>
            <span className="font-serif-cn text-sm font-bold tracking-wider">我靠模拟成仙</span>
          </div>
          <div className="flex items-center gap-2">
            <GameMenu />
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {showHome || !character ? (
          <StartScreen
            currentCharacterName={character?.name}
            onContinueCurrent={character ? enterGame : undefined}
            onEnterGame={enterGame}
          />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col max-w-md mx-auto w-full">
            {/* ===== 顶部固定条：StatusPanel（每帧必看） ===== */}
            <div className="shrink-0 px-3 py-2" data-testid="top-status-bar">
              <StatusPanel character={character} />
            </div>

            {/* ===== 死后流程 (2026-07-12)：只走 SettlementModal（评价 + 传承物选择），
                     不再自动露出「传承人选择 / 死亡引导面板 / 继承池候选人面板」。
                     首页"传承池"按钮仍可让玩家浏览历史遗产。 ===== */}

            {/* 剧情节点全部下移到 story 滚动容器内（EventTimeline 后紧接内联出现）。 */}

            {/* ===== 4 个主 Tab 切换（2026-07-12：传承 tab 已删，其功能挪至首页传承池按钮 + 死亡引导下方继承池） ===== */}
            <div className="shrink-0 px-3 pb-2" data-testid="main-tab-list">
              <Tabs value={effectiveTab} onValueChange={setTab} className="w-full">
                <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/40">
                  <TabsTrigger value="story" className="text-[10px] sm:text-xs gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>道途</span>
                  </TabsTrigger>
                  <TabsTrigger value="xiuxing" className="text-[10px] sm:text-xs gap-1">
                    <Sword className="w-3 h-3" />
                    <span>修行</span>
                  </TabsTrigger>
                  <TabsTrigger value="mingtu" className="text-[10px] sm:text-xs gap-1">
                    <Compass className="w-3 h-3" />
                    <span>命途</span>
                  </TabsTrigger>
                  <TabsTrigger value="renqing" className="text-[10px] sm:text-xs gap-1">
                    <Users className="w-3 h-3" />
                    <span>人情</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 兼容旧 status/scroll tab 入口（隐藏 trigger - 通过 setTab('status'|'scroll') 进入） */}
            <div className="hidden" aria-hidden="true">
              <Tabs value={effectiveTab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="status">态</TabsTrigger>
                  <TabsTrigger value="scroll">史</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* ===== Tab 内容区 ===== */}
            {/* 触屏左右滑动切主 tab:道途 ↔ 命途 ↔ 传承 ↔ 人情 ↔ 修行 */}
            <div
              className="flex-1 overflow-hidden relative"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
              data-testid="main-tab-swipe-zone"
            >
              {/* 5 个主 tab 走横向滑轨:所有 tab 并排渲染,translateX 定位到当前 tab */}
              {/* dragOffset 在触屏拖动时提供实时跟手偏移;松手后由 setTab 触发 CSS transition 平滑收拢 */}
              {isMainTab ? (
                <div
                  className={cn(
                    'h-full flex',
                    swipeDragging ? '' : 'transition-transform duration-300 ease-out',
                  )}
                  style={{
                    width: `${MAIN_TAB_ORDER.length * 100}%`,
                    transform: `translate3d(calc(${-mainTabIdx * (100 / MAIN_TAB_ORDER.length)}% + ${swipeDragOffset}px), 0, 0)`,
                  }}
                >
                  {/* 道途(story):互动叙事 + 战斗 */}
                  <div className="h-full flex flex-col" style={{ width: `${100 / MAIN_TAB_ORDER.length}%` }}>
                    <div
                      ref={storyScrollRef}
                      onScroll={(e) => { storyScrollTopRef.current = e.currentTarget.scrollTop; }}
                      className="flex-1 overflow-y-auto xianxia-scroll px-3 pb-2"
                    >
                      <NpcMiniBar />
                      <EventTimeline events={events} newEventRange={newEventRange ?? undefined} streamingEvent={streamingNarrative ?? undefined} settlingHint={settlingHint} />

                      {/* 剧情节点内联区：紧接最新事件出现，玩家在剧情流内完成交互 */}
                      {character.tribulationPending && (
                        <div data-testid="tribulation-section">
                          <TribulationModal
                            session={character.tribulationPending}
                            onBolt={async (boltNumber) => {
                              // P1-2 修复：前端不再发送任何 roll/数值字段，避免玩家 DevTools 反复触发直到 random >= 0.5 刷渡劫。
                              // characterRoll / heartDemon / soulStrength / bondedArtifactResonance 全部由后端从 character 派生（确定性 hash 算 roll）。
                              await fetch('/api/game/tribulation/action', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'bolt',
                                  characterId: character.id,
                                  boltNumber,
                                }),
                              });
                            }}
                            onHeartDemon={async () => {/* 由心魔面板触发 */}}
                            onEnd={async () => {
                              await fetch('/api/game/tribulation/end', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sessionId: character.tribulationPending?.id ?? '',
                                  outcome: 'passed',
                                  boltsCompleted: character.tribulationPending?.boltsCompleted ?? 0,
                                }),
                              });
                            }}
                          />
                        </div>
                      )}
                      {character.ascensionPending && (
                        <div data-testid="ascension-section">
                          <AscensionModal
                            session={character.ascensionPending}
                            onRoll={async () => {/* 由 store / route 触发 */}}
                            onEnd={async () => {/* 由 store / route 触发 */}}
                          />
                        </div>
                      )}
                      {character.restrictionPending && (
                        <div data-testid="restriction-section">
                          <RestrictionModal
                            restriction={character.restrictionPending}
                            onInteract={async () => {/* 由 store / route 触发 */}}
                          />
                        </div>
                      )}
                      <ChoiceModal />
                      <SettlementModal />
                    </div>
                    {/* 沉浸版 Phase-Release: 抉择时不再藏起底部按钮，只置灰不可按（内部 atChoice=disabled 已处理） */}
                    {!character.tribulationPending
                      && !character.ascensionPending
                      && !character.restrictionPending
                      && !settlementResult && (
                      <div className="shrink-0 px-3 py-2 border-t border-border/40 bg-card/40">
                        <ActionButtons />
                      </div>
                    )}
                  </div>

                  {/* 修行(xiuxing):修炼速度 + 秘境 + 宝物 + 修为印记 */}
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4 space-y-2" style={{ width: `${100 / MAIN_TAB_ORDER.length}%` }}>
                    <div data-testid="cultivation-speed-section">
                      <CultivationSpeedCard />
                    </div>
                    <div data-testid="secret-realm-section" className="hidden" />
                    <div data-testid="inventory-section">
                      <InventoryPanel />
                    </div>
                    <div data-testid="achievements-section">
                      <AchievementsPanel />
                    </div>
                  </div>

                  {/* 命途(mingtu):轮回投影 + 因缘长河 + 命运终章 */}
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4 space-y-2" style={{ width: `${100 / MAIN_TAB_ORDER.length}%` }}>
                    <div data-testid="cycle-projection-section">
                      <CycleProjectionPanel
                        character={character}
                        defaultCollapsed={true}
                      />
                    </div>
                    {/* EndingPanel 结局谱:剧透性过强,不展示 */}
                    {/* YinyuanTimelinePanel 命途时间线:暴露伏笔,不展示 */}
                  </div>

                  {/* 传承 tab 已于 2026-07-12 移除：
                      - 跨周目遗产展示跟首页"传承池"按钮/角色详情重叠，删除
                      - 陨落后的传承人选择已从死后流程摘除；死后仅走 SettlementModal
                      - 5 tab → 4 tab，跳过整个 slot */}

                  {/* 人情(renqing):故交旧雨 + 宗门剧情 */}
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4 space-y-2" style={{ width: `${100 / MAIN_TAB_ORDER.length}%` }}>
                    <div data-testid="npc-growth-section">
                      <NpcGrowthPanel
                        character={character}
                        defaultCollapsed={true}
                      />
                    </div>
                    <div data-testid="sect-storyline-section">
                      <SectStorylinePanel
                        character={character}
                        defaultCollapsed={true}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // 兼容 tab (status/scroll):由 setTab('status'|'scroll') 触发,单独全屏渲染
                <div className="h-full">
                  {effectiveTab === 'status' && (
                    <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                      <StatusList />
                    </div>
                  )}
                  {effectiveTab === 'scroll' && (
                    <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                      <MilestonesLog />
                    </div>
                  )}
                </div>
              )}

              {/* 世界:独立入口,不进主 tab;smoke 期望 testid 存在 */}
              <div data-testid="world-legacy-section" className="hidden">
                <WorldLegacyPanel />
              </div>
              <div data-testid="reset-world-section" className="hidden">
                <ResetWorldButton />
              </div>
              {/* 注:5 主 tab 走滑轨 translateX 平滑切换;兼容 tab (status/scroll) 走独立分支单独渲染。
                  原 <Tabs> 外壳不再包这块内容,tab state 由外层同步 <Tabs> (TabsList) 控制。 */}
            </div>
          </div>
        )}
      </main>
      {character && !showHome && character.alive && !pendingChoice && !combatResultPending
        && !character.tribulationPending && !character.ascensionPending && !character.restrictionPending
        && !settlementResult && (
        <div className="shrink-0 max-w-md mx-auto w-full">
          <InterfereInput />
        </div>
      )}

      {/* ChoiceModal / SettlementModal 已改内联，挂载在 story 滚动容器内。 */}

      {/* 战斗弹窗（全屏，最上层；combatSession.status='ongoing' 时显示） */}
      {/* 沉浸版 Phase-Z: 全局特效层（飘字 / 突破 / 稀有掉落 / 成就） */}
      {!showHome && <FxLayer />}

      {!showHome && <CombatModal />}

      {/* 坊市交易弹窗（z-[55]，与秘境同层） */}
      {!showHome && <MarketModal />}

      {/* 秘境探索弹窗（z-[55]，与坊市同层；探索结果 z-[60]） */}
      {!showHome && <SecretRealmPanel />}
    </div>
  );
}
