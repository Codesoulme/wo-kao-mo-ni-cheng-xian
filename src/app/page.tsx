'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { StartScreen } from '@/components/xianxia/StartScreen';
import { StatusPanel } from '@/components/xianxia/StatusPanel';
import { EventTimeline } from '@/components/xianxia/EventTimeline';
import { StatusList } from '@/components/xianxia/StatusList';
import { FateNodes } from '@/components/xianxia/FateNodes';
import { MilestonesLog } from '@/components/xianxia/MilestonesLog';
import { InterfereInput } from '@/components/xianxia/InterfereInput';
import { ChoiceModal } from '@/components/xianxia/ChoiceModal';
import { CombatModal } from '@/components/xianxia/CombatModal';
import { ActionButtons } from '@/components/xianxia/ActionButtons';
import { GameMenu } from '@/components/xianxia/GameMenu';
import { InventoryPanel } from '@/components/xianxia/InventoryPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Scroll, Sparkles, Map, Package } from 'lucide-react';

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
    character, events, pendingChoice,
    setCharacter, setEvents, setChoices, setFateNodes, setPendingChoice,
  } = useGameStore();
  // 当有 pendingChoice 时自动聚焦到故事 Tab
  const [tab, setTab] = useState('story');
  const hydrated = useHydrated();
  const effectiveTab = pendingChoice ? 'story' : tab;

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
        // 恢复 pendingChoice（修复：页面刷新后 isAtChoice=true 但 pendingChoice 丢失导致卡死）
        if (data.pendingChoice && data.character?.isAtChoice) {
          setPendingChoice(data.pendingChoice);
        }
      } catch (e) {
        // 静默失败
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, character?.id, events.length, setCharacter, setEvents, setChoices, setFateNodes, setPendingChoice]);

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
            <span className="font-serif-cn text-sm font-bold tracking-wider">修仙模拟器</span>
          </div>
          {character && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-serif-cn">{character.name}</span>
                <span>·</span>
                <span>{character.age}岁</span>
                {character.alive ? (
                  character.ascended ? <span className="text-yellow-500">已飞升</span> : null
                ) : (
                  <span className="text-destructive">已陨落</span>
                )}
              </div>
              <GameMenu />
            </div>
          )}
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!character ? (
          <StartScreen />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col max-w-md mx-auto w-full">
            {/* 状态面板（常驻顶部 - 简化版） */}
            <div className="shrink-0 px-3 py-2">
              <StatusPanel character={character} />
            </div>

            {/* Tab 切换 */}
            <div className="shrink-0 px-3 pb-2">
              <Tabs value={effectiveTab} onValueChange={setTab} className="w-full">
                <TabsList className="grid grid-cols-5 w-full h-9 bg-muted/40">
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
                  <TabsTrigger value="fate" className="text-xs gap-1">
                    <Map className="w-3 h-3" />
                    <span className="hidden sm:inline">命</span>
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
                <TabsContent value="story" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto xianxia-scroll px-3 pb-2">
                      <EventTimeline events={events} />
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

                {/* 命节点 */}
                <TabsContent value="fate" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <FateNodes />
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
      {character && character.alive && !pendingChoice && (
        <div className="shrink-0 max-w-md mx-auto w-full">
          <InterfereInput />
        </div>
      )}

      {/* 选择弹窗 */}
      <ChoiceModal />

      {/* 战斗弹窗（全屏，最上层；combatSession.status='ongoing' 时显示） */}
      <CombatModal />
    </div>
  );
}
