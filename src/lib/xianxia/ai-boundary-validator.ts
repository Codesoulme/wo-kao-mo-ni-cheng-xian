// AI 输出边界校验器（src/lib/xianxia/ai-boundary-validator.ts）
//
// 修真叙事"AI 双层保险"中的"引擎做事实校验 + 分类校准 + 文案清洗 + 硬约束拦截"
// 中的「事实校验」层。LLM 生成事件输出 → 在落库前由本模块扫描，把违规点以
// { trace: [{ code, severity, message }] } 形式返回，调用方可按 severity 决定
// 是 warn-and-keep / discard-and-retry / fallback-to-engine。
//
// 设计原则：
// 1. **不抛异常** —— 校验失败 ≠ 程序错误；调用方应能用结果做 soft warning
// 2. **沉浸版优先** —— message 用中文（"已了结的线索被重新开启"）而非技术行话
// 3. **可降级** —— state/output 字段缺失时按"宽容通过"处理，避免误杀
// 4. **无副作用** —— 仅纯函数；不修改 state、不打 console（除非显式 severity=error）
//
// 校验维度（phase-批 1 + narrative contract）：
//   - 物品一致性：removedItemIds / equipItemIds / unequipItemIds 是否真在背包
//   - 物品唯一性：newItems 是否重复 id（既有或本次新增内冲突）
//   - 线索一致性：closed/resolved 状态的 pendingThread 不应被 advanceThreads/completeThreadIds 引用
//   - 线索死灰复燃：newThreads 标题/描述命中已 closed 线索 → 报 "closed_thread_reopened_as_new"
//   - NPC 态度跃迁：hostile → friendly 需 relationshipCause 或 prevRelationshipScore 支撑
//   - NPC relationshipScore 跃迁幅度过大（>40）需因由
//   - narrativeContract：focus/outcome/hint/fact/npc 引用是否对应 state 中存在
//
// 演进：phase-α 批 1 (2026-06-30) 首次落地 stub，后续按 smoke 输出扩展。
// — 修真感 AI 项目 by Codesoulme

export interface AIBoundaryTraceEntry {
  /** 短英文 code 便于分支处理（参考 smoke 期望） */
  code: string;
  /** 'info' | 'warn' | 'error' —— 默认 'warn' */
  severity?: 'info' | 'warn' | 'error';
  /** 中文修真风味描述（≤80 字），用于 UI 提示或审计日志 */
  message: string;
  /** 关联字段路径，方便定位（optional） */
  path?: string;
}

export interface AIBoundaryResult {
  trace: AIBoundaryTraceEntry[];
  /** 是否有 error 级别违规 —— 调用方一般会 retry 或 fallback */
  hasError: boolean;
  /** 是否有 warn 级别违规 —— 调用方可保留但提示玩家 */
  hasWarn: boolean;
}

// ---------- 内部小工具 ----------

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function safeStr(v: any): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function pushWarn(
  trace: AIBoundaryTraceEntry[],
  code: string,
  message: string,
  path?: string
): void {
  trace.push({ code, severity: 'warn', message, path });
}

function pushError(
  trace: AIBoundaryTraceEntry[],
  code: string,
  message: string,
  path?: string
): void {
  trace.push({ code, severity: 'error', message, path });
}

// ---------- 主入口 ----------

export function validateAIBoundary(state: any, output: any): AIBoundaryResult {
  const trace: AIBoundaryTraceEntry[] = [];
  if (!state || typeof state !== 'object') {
    pushError(trace, 'invalid_state', '校验状态缺失或非对象', 'state');
    return { trace, hasError: true, hasWarn: false };
  }
  if (!output || typeof output !== 'object') {
    pushError(trace, 'invalid_output', '待校验输出缺失或非对象', 'output');
    return { trace, hasError: true, hasWarn: false };
  }

  // 1. 物品一致性
  const inventoryIds = new Set(asArray<any>(state.inventory).map(it => safeStr(it?.id)).filter(Boolean));
  const equippedIds = new Set(asArray<any>(state.equipped).map(it => safeStr(it?.id)).filter(Boolean));
  const knownItemIds = new Set<string>([...inventoryIds, ...equippedIds]);

  for (const id of asArray<string>(output.removedItemIds)) {
    if (!knownItemIds.has(id)) {
      pushWarn(trace, 'removed_unknown_item', `AI 申请移除不存在的物品「${id}」`, 'removedItemIds');
    }
  }
  for (const id of asArray<string>(output.equipItemIds)) {
    if (!inventoryIds.has(id)) {
      pushWarn(trace, 'equip_unknown_item', `AI 申请装备未在背包的物品「${id}」`, 'equipItemIds');
    }
  }
  for (const id of asArray<string>(output.unequipItemIds)) {
    if (!equippedIds.has(id)) {
      pushWarn(trace, 'unequip_unknown_item', `AI 申请卸下未装备的物品「${id}」`, 'unequipItemIds');
    }
  }

  // 2. 物品唯一性（newItems 内部冲突 + 与既有冲突）
  const newItems = asArray<any>(output.newItems);
  const seenNewIds = new Set<string>();
  for (const it of newItems) {
    const id = safeStr(it?.id);
    if (!id) continue;
    if (knownItemIds.has(id)) {
      pushWarn(trace, 'new_item_duplicate_id', `AI 产出物品「${id}」与既有物品重名`, 'newItems');
    }
    if (seenNewIds.has(id)) {
      pushWarn(trace, 'new_item_duplicate_id', `AI 同一轮产出两件同名物品「${id}」`, 'newItems');
    }
    seenNewIds.add(id);
  }

  // 3. 线索一致性
  const pendingThreads = asArray<any>(state.pendingThreads);
  const closedThreadIds = new Set<string>();
  const openThreadIds = new Set<string>();
  for (const t of pendingThreads) {
    const id = safeStr(t?.id);
    if (!id) continue;
    const status = safeStr(t?.status) || 'pending';
    if (status === 'resolved' || status === 'failed' || status === 'closed') {
      closedThreadIds.add(id);
    } else {
      openThreadIds.add(id);
    }
  }

  for (const ref of asArray<any>(output.advanceThreads)) {
    const id = safeStr(ref?.id);
    if (id && closedThreadIds.has(id)) {
      pushWarn(trace, 'closed_thread_referenced', `AI 推进已了结的线索「${id}」`, 'advanceThreads');
    }
  }
  for (const id of asArray<string>(output.completeThreadIds)) {
    if (closedThreadIds.has(id)) {
      pushWarn(trace, 'closed_thread_referenced', `AI 完成已了结的线索「${id}」`, 'completeThreadIds');
    }
  }
  for (const id of asArray<string>(output.failThreadIds)) {
    if (closedThreadIds.has(id)) {
      pushWarn(trace, 'closed_thread_referenced', `AI 失败已了结的线索「${id}」`, 'failThreadIds');
    }
  }

  // 4. 线索死灰复燃
  const closedTitles = new Set<string>();
  for (const t of pendingThreads) {
    if (closedThreadIds.has(safeStr(t?.id) || '')) {
      const title = safeStr(t?.title);
      if (title) closedTitles.add(title);
    }
  }
  for (const nt of asArray<any>(output.newThreads)) {
    const title = safeStr(nt?.title);
    if (title && closedTitles.has(title)) {
      pushWarn(trace, 'closed_thread_reopened_as_new', `已了结的线索「${title}」被重新开启为新线索`, 'newThreads');
    }
  }

  // 5. NPC 态度 / 关系分跃迁
  const npcs = asArray<any>(state.npcs);
  const npcById = new Map<string, any>();
  for (const n of npcs) {
    const id = safeStr(n?.id);
    if (id) npcById.set(id, n);
  }
  const newNpcs = asArray<any>(output.newNpcs);
  for (const n of newNpcs) {
    const id = safeStr(n?.id);
    if (!id) continue;
    const prev = npcById.get(id);
    const newAtt = safeStr(n?.attitude);
    const newScore = typeof n?.relationshipScore === 'number' ? n.relationshipScore : null;
    const hasCause = safeStr(n?.relationshipCause) || safeStr(n?.causeOfChange);
    if (prev) {
      const prevAtt = safeStr(prev?.attitude);
      const prevScore = typeof prev?.relationshipScore === 'number' ? prev.relationshipScore : 0;
      // 敌意 → 友善且无因由
      if (prevAtt === 'hostile' && newAtt === 'friendly' && !hasCause) {
        pushWarn(trace, 'npc_hostile_to_friendly_without_cause', `「${safeStr(n?.name) || id}」从敌意忽然转为友善，缺少因由`, 'newNpcs');
      }
      // 关系分跃迁 > 40 且无因由
      if (newScore !== null && Math.abs(newScore - prevScore) > 40 && !hasCause) {
        pushWarn(trace, 'npc_relationship_jump_without_cause', `「${safeStr(n?.name) || id}」关系分由 ${prevScore} 跃迁至 ${newScore}，缺少因由`, 'newNpcs');
      }
    }
  }

  // 6. narrativeContract（修真叙事契约）
  const contract = output?.narrativeContract;
  const schedule = state?.eventSchedule;
  const hasPressureMap = !!(schedule && (schedule.pressureMap || (Array.isArray(schedule.hints) && schedule.hints.length > 0)));
  if (hasPressureMap && (!contract || typeof contract !== 'object')) {
    pushWarn(trace, 'missing_narrative_contract', '事件调度器已给出舆图，但 AI 输出缺少 narrativeContract 承接', 'narrativeContract');
  } else if (contract && typeof contract === 'object') {
    const validOutcomes = new Set(['advanced', 'resolved', 'deferred', 'complicated', 'vanished']);
    const outcome = safeStr(contract.narrativeOutcome);
    if (outcome && !validOutcomes.has(outcome)) {
      pushWarn(trace, 'invalid_narrative_outcome', `narrativeOutcome 「${outcome}」不在合法集合`, 'narrativeContract.narrativeOutcome');
    }
    // hint/fact/npc 引用是否对应 state 中存在
    const hintIds = new Set(asArray<any>(schedule?.hints).map(h => safeStr(h?.id)).filter(Boolean));
    const factIds = new Set(asArray<any>(state?.worldFacts).map(w => safeStr(w?.id)).filter(Boolean));
    const npcIds = new Set(asArray<any>(state?.npcs).map(n => safeStr(n?.id)).filter(Boolean));
    for (const hid of asArray<string>(contract.usedScheduleHintIds)) {
      if (!hintIds.has(hid)) {
        pushWarn(trace, 'unknown_schedule_hint_reference', `narrativeContract 引用未知 schedule hint「${hid}」`, 'narrativeContract.usedScheduleHintIds');
      }
    }
    for (const fid of asArray<string>(contract.usedWorldFactIds)) {
      if (!factIds.has(fid)) {
        pushWarn(trace, 'unknown_world_fact_reference', `narrativeContract 引用未知 world fact「${fid}」`, 'narrativeContract.usedWorldFactIds');
      }
    }
    for (const nid of asArray<string>(contract.usedNpcIds)) {
      if (!npcIds.has(nid)) {
        pushWarn(trace, 'unknown_npc_contract_reference', `narrativeContract 引用未知 NPC「${nid}」`, 'narrativeContract.usedNpcIds');
      }
    }
  }

  const hasError = trace.some(t => t.severity === 'error');
  const hasWarn = trace.some(t => t.severity === 'warn');
  return { trace, hasError, hasWarn };
}