'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { StartScreen } from '@/components/xianxia/StartScreen';
import { StatusPanel } from '@/components/xianxia/StatusPanel';
import { WorldLegacyPanel } from '@/components/xianxia/WorldLegacyPanel';
import { CycleProjectionPanel } from '@/components/xianxia/CycleProjectionPanel';
import { EventTimeline } from '@/components/xianxia/EventTimeline';
import { StatusList } from '@/components/xianxia/StatusList';
import { MilestonesLog } from '@/components/xianxia/MilestonesLog';
import { SaveSlotPanel } from '@/components/xianxia/SaveSlotPanel';
import { EndingPanel } from '@/components/xianxia/EndingPanel';
import { InheritancePoolPanel } from '@/components/xianxia/InheritancePoolPanel';
import { DeathGuidancePanel } from '@/components/xianxia/DeathGuidancePanel';
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
import { BookOpen, Scroll, Sparkles, Package } from 'lucide-react';
import { YinyuanTimelinePanel } from '@/components/xianxia/YinyuanTimelinePanel';
import { TechniqueCreatorPanel } from '@/components/xianxia/TechniqueCreatorPanel';
import { NpcGrowthPanel } from '@/components/xianxia/NpcGrowthPanel';
import { CrossCycleInheritancePanel } from '@/components/xianxia/CrossCycleInheritancePanel';
import { SectStorylinePanel } from '@/components/xianxia/SectStorylinePanel';
import { HeartDemonCard } from '@/components/xianxia/HeartDemonCard';
import { HeartIntentPanel } from '@/components/xianxia/HeartIntentPanel';
import { PetPanel } from '@/components/xianxia/PetPanel';
import { AlchemyFurnace } from '@/components/xianxia/AlchemyFurnace';
import { FormationPanel } from '@/components/xianxia/FormationPanel';
import { CharacterIntentsCard } from '@/components/xianxia/CharacterIntentsCard';
import { PendingThreadsCard } from '@/components/xianxia/PendingThreadsCard';
import { FateNodes } from '@/components/xianxia/FateNodes';
import { CultivationSpeedCard } from '@/components/xianxia/CultivationSpeedCard';
import { CharacterDetailSheet } from '@/components/xianxia/CharacterDetailSheet';
import { RealmOrb } from '@/components/xianxia/RealmOrb';

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
  const effectiveTab = pendingChoice || combatResultPending ? 'story' : tab;
  const storyScrollRef = useRef<HTMLDivElement | null>(null);
  const storyScrollTopRef = useRef(0);
  const settlingCharacterIdRef = useRef<string | null>(null);

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
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-background paper-texture ink-wash">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background paper-texture ink-wash">
      {/* 顶部装饰 */}
      <header className="shrink-0 border-b border-border/40 bg-card/40 backdrop-blur">
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
            {/* 状态面板（常驻顶部 - 简化版） */}
            <div className="shrink-0 px-3 py-2">
              <StatusPanel character={character} />
            </div>

            {/* AI-60: WorldLegacyPanel 折叠区（默认折叠，限 3 条，展开全部） */}
            <div className="shrink-0 px-3 pb-1" data-testid="world-legacy-section">
              <WorldLegacyPanel character={character} defaultCollapsed={true} maxCollapsed={3} />
            </div>

            {/* Phase-L: 轮回投影面板 - 接入 phase-k B 的 4 个 UI 投影函数 */}
            <div className="shrink-0 px-3 pb-1" data-testid="cycle-projection-section">
              <CycleProjectionPanel
                character={character}
                defaultCollapsed={true}
              />
            </div>

              {/* Phase-M: da cf cao ping mian */}
              <div className="shrink-0 px-3 pb-1" data-testid="save-slot-section">
                <SaveSlotPanel
                  snapshot={fullSnapshot}
                  onLoadSlot={handleLoadSlot}
                  refreshKey={slotRefresh}
                />
              </div>

                {/* Phase-M #1: Ending spectrum panel - 8 ending archetypes preview */}
                <div className="shrink-0 px-3 pb-1" data-testid="ending-section">
                  <EndingPanel
                    character={character}
                    worldState={useGameStore.getState().worldCalendar}
                    defaultCollapsed={true}
                  />
                </div>

                {/* Phase-M #2: 死亡后引导 — 三个选项（轮回重开 / 回归入凡 / 继续旁观） */}
                
              {/* Phase-U #5: 因缘时间线 (4 archetype) */}
              <div className="shrink-0 px-3 pb-1" data-testid="yinyuan-timeline-section">
                <YinyuanTimelinePanel
                  character={character}
                  defaultCollapsed={true}
                />
              </div>

              {/* Phase-V #6: 自创功法 */}
              <div className="shrink-0 px-3 pb-1" data-testid="technique-creator-section">
                <TechniqueCreatorPanel
                  defaultCollapsed={true}
                />
              </div>

              {/* Phase-T #9: NPC 自生长 */}
              <div className="shrink-0 px-3 pb-1" data-testid="npc-growth-section">
                <NpcGrowthPanel
                  character={character}
                  defaultCollapsed={true}
                />
              </div>

              {/* Phase-R #8: 宗门剧情 */}
              <div className="shrink-0 px-3 pb-1" data-testid="sect-storyline-section">
                <SectStorylinePanel
                  character={character}
                  defaultCollapsed={true}
                />
              </div>

              {/* Phase-W #10: 跨周目传承 */}
              <div className="shrink-0 px-3 pb-1" data-testid="cross-cycle-section">
                <CrossCycleInheritancePanel
                  character={character}
                  defaultCollapsed={true}
                />
              </div>

              <div className="shrink-0 px-3 pb-1" data-testid="death-guidance-section">
                  <DeathGuidancePanel character={character} defaultCollapsed={false} />
                </div>

              {/* Phase-M #3: 继承池选择面板 - 角色陨落后、归凡前浮现 */}
              <div className="shrink-0 px-3 pb-1" data-testid="inheritance-section-wrapper">
                <InheritancePoolPanel defaultCollapsed={true} />
              </div>

            {/* AI-72: L3 modals 占位（飞升/禁制），按 character 状态条件渲染 */}
            {character.ascensionPending && (
              <div className="shrink-0 px-3 pb-2" data-testid="ascension-section">
                <AscensionModal
                  session={character.ascensionPending}
                  onRoll={async () => {/* 由 store / route 触发 */}}
                  onEnd={async () => {/* 由 store / route 触发 */}}
                />
              </div>
            )}
            {character.restrictionPending && (
              <div className="shrink-0 px-3 pb-2" data-testid="restriction-section">
                <RestrictionModal
                  restriction={character.restrictionPending}
                  onInteract={async () => {/* 由 store / route 触发 */}}
                />
              </div>
            )}

            {/* AI-74: TribulationModal 接入（onBolt → /api/game/tribulation/action, onEnd → /api/game/tribulation/end） */}
            {character.tribulationPending && (
              <div className="shrink-0 px-3 pb-2" data-testid="tribulation-section">
                <TribulationModal
                  session={character.tribulationPending}
                  onBolt={async (boltNumber) => {
                    await fetch('/api/game/tribulation/action', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'bolt',
                        boltNumber,
                        characterRoll: Math.random(),
                        heartDemon: 0,
                        soulStrength: 50,
                        bondedArtifactResonance: false,
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

            {/* Tab 切换 */}
            <div className="shrink-0 px-3 pb-2">
              <Tabs value={effectiveTab} onValueChange={setTab} className="w-full">
                <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/40">
                  <TabsTrigger value="story" className="text-xs gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span className="hidden sm:inline">传</span>
                  </TabsTrigger>
                  <TabsTrigger value="status" className="text-xs gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden sm:inline">态</span>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="text-xs gap-1">
                    <Package className="w-3 h-3" />
                    <span className="hidden sm:inline">宝</span>
                  </TabsTrigger>
                  <TabsTrigger value="scroll" className="text-xs gap-1">
                    <Scroll className="w-3 h-3" />
                    <span className="hidden sm:inline">史</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={effectiveTab} onValueChange={setTab} className="h-full">
                {/* 故事 - 默认，可折叠 */}
                <TabsContent value="story" forceMount className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full flex flex-col">
                    <div
                      ref={storyScrollRef}
                      onScroll={(e) => { storyScrollTopRef.current = e.currentTarget.scrollTop; }}
                      className="flex-1 overflow-y-auto xianxia-scroll px-3 pb-2"
                    >
                      <EventTimeline events={events} newEventRange={newEventRange ?? undefined} streamingEvent={streamingNarrative ?? undefined} settlingHint={settlingHint} />
                    </div>
                    {/* 推进按钮 */}
                    <div className="shrink-0 px-3 py-2 border-t border-border/40 bg-card/40">
                      <ActionButtons />
                    </div>
                  </div>
                </TabsContent>

                {/* 状态 */}
                <TabsContent value="status" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <StatusList />
                  </div>
                </TabsContent>

                {/* 宝物 - 装备/储物袋 */}
                <TabsContent value="inventory" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <InventoryPanel />
                  </div>
                </TabsContent>

                {/* 史册 - 关键节点记录 */}
                <TabsContent value="scroll" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <MilestonesLog />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      {/* 底部干扰输入（常驻） */}
      {character && !showHome && character.alive && !pendingChoice && !combatResultPending && (
        <div className="shrink-0 max-w-md mx-auto w-full">
          <InterfereInput />
        </div>
      )}

      {/* 选择弹窗 */}
      {!showHome && <ChoiceModal />}

      {/* 战斗弹窗（全屏，最上层；combatSession.status='ongoing' 时显示） */}
      {!showHome && <CombatModal />}

      {/* 坊市交易弹窗（z-[55]，介于 ChoiceModal 与 CombatModal 之间） */}
      {!showHome && <MarketModal />}

      {/* 秘境探索弹窗（z-[55]，与坊市同层；探索结果 z-[60]） */}
      {!showHome && <SecretRealmPanel />}

      {/* 轮回结算 */}
      <SettlementModal />
    </div>
  );
}
