'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/xianxia/store';
import { StartScreen } from '@/components/xianxia/StartScreen';
import { StatusPanel } from '@/components/xianxia/StatusPanel';
import { EventTimeline } from '@/components/xianxia/EventTimeline';
import { StatusList } from '@/components/xianxia/StatusList';
import { FateNodes } from '@/components/xianxia/FateNodes';
import { InterfereInput } from '@/components/xianxia/InterfereInput';
import { ChoiceModal } from '@/components/xianxia/ChoiceModal';
import { ActionButtons } from '@/components/xianxia/ActionButtons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Scroll, Sparkles, Map } from 'lucide-react';

export default function Home() {
  const { character, events, pendingChoice } = useGameStore();
  // 当有 pendingChoice 时自动聚焦到故事 Tab
  const [tab, setTab] = useState('story');
  const effectiveTab = pendingChoice ? 'story' : tab;

  return (
    <div className="min-h-screen flex flex-col bg-background paper-texture ink-wash">
      {/* 顶部装饰 */}
      <header className="shrink-0 border-b border-border/40 bg-card/40 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⛰</span>
            <span className="font-serif-cn text-sm font-bold tracking-wider">修仙模拟器</span>
          </div>
          {character && (
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
          )}
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!character ? (
          <StartScreen />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col max-w-md mx-auto w-full">
            {/* 状态面板（常驻顶部） */}
            <div className="shrink-0 px-3 py-2">
              <StatusPanel character={character} compact />
            </div>

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
                {/* 故事 - 默认 */}
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

                {/* 命节点 */}
                <TabsContent value="fate" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <FateNodes />
                  </div>
                </TabsContent>

                {/* 史册 */}
                <TabsContent value="scroll" className="h-full m-0 data-[state=inactive]:hidden">
                  <div className="h-full overflow-y-auto xianxia-scroll px-3 pb-4">
                    <EventTimeline events={events} />
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
    </div>
  );
}
