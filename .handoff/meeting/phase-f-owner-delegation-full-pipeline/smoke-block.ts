// ==================== Worker A (AI-91~AI-103): 11 derived-fn smokes ====================
// Additive only. Each smoke targets one engine.ts function added in this batch.

function smokeAi91SanitizeCombatLog(): void {
  // AI-91: sanitizeCombatLog should strip zero-width chars and preserve isSystem flag
  const cleaned = sanitizeCombatLog({ text: 'you slash the foe\u200B', isSystem: false } as any);
  assert(cleaned.isSystem === false, "isSystem=false should be preserved");
  assert(!cleaned.text.includes('\u200B'), 'zero-width char should be stripped');
  assert(cleaned.text.includes('slash'), 'main text should remain');
  const sys = sanitizeCombatLog({ text: 'you took 3 dmg', isSystem: true } as any);
  assert(sys.isSystem === true, "isSystem=true should be preserved");
  const empty = sanitizeCombatLog({ text: '', isSystem: false } as any);
  assert(empty.text === '', 'empty text should remain empty');
  log('ai91-sanitize-combat-log', { passed: true, cleaned: cleaned.text, sysFlag: sys.isSystem });
}

function smokeAi91NovelizeCombatLog(): void {
  // AI-91: novelizeCombatLog should merge system entries into parenthetical notes
  const out = novelizeCombatLog([
    { text: 'you slash out.', isSystem: false } as any,
    { text: 'you took 5 dmg', isSystem: true } as any,
    { text: 'foe staggers back.', isSystem: false } as any,
  ]);
  assert(typeof out === 'string' && out.length > 0, 'novelize output should be non-empty');
  assert(out.includes('slash') && out.includes('staggers'), 'narrative text should be joined');
  assert(out.includes('5 dmg'), 'system entry should appear in parenthetical');
  const empty = novelizeCombatLog([]);
  assert(empty === '', 'empty log should return empty string');
  log('ai91-novelize-combat-log', { passed: true, length: out.length });
}

function smokeAi92LootFromOpponent(): void {
  // AI-92: deriveLootFromOpponent returns non-empty items without enemy-attribution prefix
  const loot = deriveLootFromOpponent({ id: 'enemy-1', name: 'foe-beast' }, 'qi_refining' as any);
  assert(Array.isArray(loot) && loot.length >= 2, "should return >=2 items, got=" + loot.length);
  for (const it of loot) {
    assert(typeof it.name === "string" && it.name.length > 0, "item name non-empty: " + it.name);
    assert(!/beast|foe-|enemy-of/.test(it.name), "item name should not carry enemy attribution, got=" + it.name);
  }
  log('ai92-loot-from-opponent', { passed: true, count: loot.length, names: loot.map(i => i.name) });
}

function smokeAi92ResolveLootConditions(): void {
  // AI-92: resolveLootConditions filters by conditions
  const baseChar: any = { realm: 'qi_refining', realmLevel: 1, statuses: [], faction: '', spiritStones: 100, id: 'char-1' };
  const lootTable: any = {
    id: 't1',
    items: [
      { id: 'a', name: 'A', description: 'd', item_type: 'material', rarity: 'common', effects: [], source: 's' },
      { id: 'b', name: 'B', description: 'd', item_type: 'material', rarity: 'common', effects: [], source: 's' },
    ],
    conditions: [
      { kind: 'min_realm', realm: 'foundation' },
    ],
  };
  const blocked = resolveLootConditions(lootTable, baseChar);
  assert(Array.isArray(blocked) && blocked.length === 0, "qi_refining should be blocked by foundation, got=" + blocked.length);
  lootTable.conditions = [{ kind: "min_level", minLevel: 0 }];
  const ok = resolveLootConditions(lootTable, baseChar);
  assert(ok.length === 2, "min_level=0 should allow, got=" + ok.length);
  lootTable.conditions = [{ kind: 'has_status', statusId: 'sick' }];
  const noneStatus = resolveLootConditions(lootTable, { ...baseChar, statuses: [] });
  assert(noneStatus.length === 0, 'no status should be blocked by has_status');
  log('ai92-resolve-loot-conditions', { passed: true, blocked: blocked.length, ok: ok.length });
}

function smokeAi93StatusExpiryDerivation(): void {
  // AI-93: deriveStatusExpiry returns expiry age by rule
  const years = deriveStatusExpiry({ id: 's1', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [], expiryMeta: { rule: 'years', remaining: 5 } } as any, 20);
  assert(years === 25, "years rule + remaining=5 + currentAge=20 -> 25, got=" + years);
  const turns = deriveStatusExpiry({ id: 's2', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 3, effects: [], expiryMeta: { rule: 'turns' } } as any, 20);
  assert(turns === null, 'turns rule should return null');
  const cond = deriveStatusExpiry({ id: 's3', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 0, effects: [], expiryMeta: { rule: 'condition' } } as any, 20);
  assert(cond === null, 'condition rule should return null');
  log('ai93-status-expiry-derivation', { passed: true, years, turns, cond });
}

function smokeAi93ResolveStatusRemoval(): void {
  // AI-93: resolveStatusRemoval strips duration=0 / expired years statuses
  const baseChar: any = {
    id: 'c1', name: 'c', age: 30,
    statuses: [
      { id: 'a', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 0, effects: [] },
      { id: 'b', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [], expiryMeta: { rule: 'years', remaining: 1 } },
      { id: 'c', name: 'n', description: 'd', category: 'buff', rarity: 'common', duration: 5, effects: [] },
    ],
  };
  const removed = resolveStatusRemoval(baseChar as any, 32);
  assert(removed.statuses.length === 1, "should =1 (duration=0 + expired years stripped), got=" + removed.statuses.length);
  assert(removed.statuses[0].id === 'c', "should keep id=c, got=" + removed.statuses[0].id);
  log('ai93-resolve-status-removal', { passed: true, kept: removed.statuses.length });
}

function smokeAi95PetCultivationSuggestion(): void {
  // AI-95: derivePetCultivationSuggestion returns path by keyword
  const char: any = { id: 'c1', realm: 'qi_refining', realmLevel: 1 };
  const combatPet = derivePetCultivationSuggestion({ name: 'sharp claw beast', description: 'feral hunter' }, char as any);
  assert(combatPet === 'combat', "sharp/claw should -> combat, got=" + combatPet);
  const assistPet = derivePetCultivationSuggestion({ name: 'gentle spirit', description: 'guardian healer' }, char as any);
  assert(assistPet === 'assist', "gentle/guardian should -> assist, got=" + assistPet);
  const transformPet = derivePetCultivationSuggestion({ name: 'nine-tail fox', description: 'shapeshift' }, char as any);
  assert(transformPet === 'transform', "nine-tail/shapeshift should -> transform, got=" + transformPet);
  const contractPet = derivePetCultivationSuggestion({ name: 'heart-bond wisp', description: 'bond' }, char as any);
  assert(contractPet === 'contract', "heart/bond should -> contract, got=" + contractPet);
  log('ai95-pet-cultivation-suggestion', { passed: true, combatPet, assistPet, transformPet, contractPet });
}

function smokeAi95PetSkillLearn(): void {
  // AI-95: resolvePetSkillLearn allows new skill; duplicate skill returns same pet
  const base: any = { id: 'p1', name: 'p', skill: { name: 'lunge', power: 10, cooldown: 1 } };
  const learned = resolvePetSkillLearn(base, { name: 'bite', power: 15, cooldown: 2 });
  assert(learned.skill.name === 'bite' && learned.skill.power === 15, "should learn bite/15, got=" + learned.skill.name + '/' + learned.skill.power);
  const dup = resolvePetSkillLearn(base, { name: 'lunge', power: 99, cooldown: 9 });
  assert(dup === base || dup.skill.name === 'lunge', 'duplicate skill should not overwrite');
  log('ai95-pet-skill-learn', { passed: true, learned: learned.skill.name });
}

function smokeAi96RecipeUnlock(): void {
  // AI-96: deriveRecipeUnlock decides by realm + materials
  const char: any = { realm: 'qi_refining', realmLevel: 1, inventory: [{ id: 'm1', name: 'herb', description: '', item_type: 'material', rarity: 'common', effects: [], source: '' }] };
  const recipe: any = { id: 'r1', name: 'Recover Pill', description: 'd', rarity: 'common', unlockCondition: 'manual', requiredMaterials: ['m1', 'm2'], minRealmIdx: 1, mainElement: 'none' };
  const r1 = deriveRecipeUnlock(recipe, char);
  assert(r1.unlocked === false && r1.missing.includes('material:m2'), "missing material should = unlocked=false, got=" + JSON.stringify(r1));
  char.inventory.push({ id: 'm2', name: 'dew', description: '', item_type: 'material', rarity: 'common', effects: [], source: '' });
  const r2 = deriveRecipeUnlock(recipe, char);
  assert(r2.unlocked === true, "materials complete should unlock, got=" + JSON.stringify(r2));
  const r3 = deriveRecipeUnlock({ ...recipe, minRealmIdx: 4 }, char);
  assert(r3.unlocked === false && r3.missing.some((x) => x.startsWith('min_realm')), 'low realm should miss min_realm');
  log('ai96-recipe-unlock', { passed: true, unlocked: r2.unlocked, missing: r3.missing });
}

function smokeAi96PillCrafting(): void {
  // AI-96: resolvePillCrafting with/without materials returns success/failure
  const recipe: any = { id: 'r1', name: 'Recover Pill', description: 'd', rarity: 'common', unlockCondition: 'manual', requiredMaterials: ['m1'], minRealmIdx: 1, mainElement: 'none' };
  const fail = resolvePillCrafting(recipe, []);
  assert(fail.success === false, 'missing materials should fail');
  const results: any[] = [];
  for (let i = 0; i < 30; i++) {
    results.push(resolvePillCrafting(recipe, [{ id: 'm1' }]));
  }
  const successes = results.filter((r) => r.success).length;
  assert(successes >= 1, "30 tries should include success, got=" + successes);
  log('ai96-pill-crafting', { passed: true, successes });
}

function smokeAi97FormationStack(): void {
  // AI-97: deriveFormationStack by rule
  const independent = deriveFormationStack([{ id: 'a', value: 10 }, { id: 'b', value: 5 }]);
  assert(independent.totalEffect === 15 && independent.appliedRule === 'independent', "independent should =15, got=" + independent.totalEffect);
  const boosted = deriveFormationStack([{ id: 'a', value: 10, rule: 'boosted' }, { id: 'b', value: 10, rule: 'boosted' }]);
  assert(boosted.totalEffect === 25, "boosted 10+10*1.25=25, got=" + boosted.totalEffect);
  const conflict = deriveFormationStack([{ id: 'a', value: 10, rule: 'conflict' }, { id: 'b', value: 10, rule: 'conflict' }]);
  assert(conflict.totalEffect < 20 && conflict.warnings.length >= 1, "conflict should weaken + warn, got=" + conflict.totalEffect);
  const replace = deriveFormationStack([{ id: 'a', value: 10, rule: 'replace' }, { id: 'b', value: 5, rule: 'replace' }]);
  assert(replace.totalEffect === 10 && replace.winners.length === 1, "replace should keep high =10, got=" + replace.totalEffect);
  log('ai97-formation-stack', { passed: true, independent: independent.totalEffect, boosted: boosted.totalEffect });
}

function smokeAi97FormationConflict(): void {
  // AI-97: resolveFormationConflict by tag
  const winner = resolveFormationConflict({ id: 'f1', tag: 'fire', value: 5 }, { id: 'f2', tag: 'fire', value: 8 });
  assert(winner === 'f2', "same-tag high value should win, got=" + winner);
  const none = resolveFormationConflict({ id: 'f1', tag: 'fire' }, { id: 'f2', tag: 'water' });
  assert(none === null, "different tag should =null, got=" + none);
  log('ai97-formation-conflict', { passed: true, winner });
}

function smokeAi98BidderAction(): void {
  // AI-98: deriveBidderAction by personality decides bid/pass/hostile
  const cautious = deriveBidderAction({ id: 'b1', personality: 'cautious', assets: 100 }, { basePrice: 100 }, 100);
  assert(cautious.kind === 'bid' || cautious.kind === 'pass', "cautious should bid/pass, got=" + cautious.kind);
  const aggressive = deriveBidderAction({ id: 'b2', personality: 'aggressive', assets: 10000 }, { basePrice: 100 }, 100);
  assert(aggressive.kind === 'bid', "aggressive w/ funds should bid, got=" + aggressive.kind);
  const hostile = deriveBidderAction({ id: 'b3', personality: 'hostile', assets: 10000 }, { basePrice: 100 }, 100);
  assert(hostile.kind === 'hostile', "hostile should = hostile, got=" + hostile.kind);
  log('ai98-bidder-action', { passed: true, cautious: cautious.kind, aggressive: aggressive.kind, hostile: hostile.kind });
}

function smokeAi98AuctionEnd(): void {
  // AI-98: resolveAuctionEnd returns winner + finalPrice + drama
  const auction: any = {
    lots: [{ item: { id: 'it', name: 'treasure', description: '', item_type: 'material', rarity: 'rare', effects: [], source: '' }, startingPrice: 100, seller: 's1' }],
    bidders: [
      { id: 'b1', personality: 'cautious', assets: 1000 },
      { id: 'b2', personality: 'aggressive', assets: 1000 },
    ],
  };
  const result = resolveAuctionEnd(auction);
  assert(typeof result.finalPrice === 'number', 'finalPrice should be number');
  assert(typeof result.drama === 'string' && result.drama.length > 0, 'drama should be non-empty');
  log('ai98-auction-end', { passed: true, winner: result.winner, finalPrice: result.finalPrice });
}

function smokeAi99ThreadChain(): void {
  // AI-99: deriveThreadChain from current node back to root
  const threads: any[] = [
    { id: 't1', title: 'root', description: '', category: 'mystery', startAge: 10, deadlineAge: 20, status: 'resolved', progress: 100, parentThreadId: undefined },
    { id: 't2', title: 'mid', description: '', category: 'mystery', startAge: 20, deadlineAge: 30, status: 'resolved', progress: 100, parentThreadId: 't1' },
    { id: 't3', title: 'now', description: '', category: 'mystery', startAge: 30, deadlineAge: 40, status: 'pending', progress: 10, parentThreadId: 't2' },
  ];
  const chain = deriveThreadChain('t3', threads);
  assert(chain.length === 3, "should =3 (root/mid/now), got=" + chain.length);
  assert(chain[0].threadId === 't1' && chain[2].threadId === 't3', "chain order t1->t2->t3, got=" + chain.map((c) => c.threadId).join(','));
  const orphan = deriveThreadChain('t3', [threads[2]]);
  assert(orphan.length === 1 && orphan[0].threadId === 't3', 'no root should return just current');
  log('ai99-thread-chain', { passed: true, length: chain.length });
}

function smokeAi99ThreadContinuation(): void {
  // AI-99: resolveThreadContinuation closes completed + may open new
  const char: any = { id: 'c1', age: 30, alive: true };
  const threads: any[] = [
    { id: 'a', title: 'A', description: '', category: 'mystery', startAge: 10, deadlineAge: 20, status: 'resolved', progress: 100 },
    { id: 'b', title: 'B', description: '', category: 'mystery', startAge: 20, deadlineAge: 30, status: 'pending', progress: 50 },
  ];
  const out = resolveThreadContinuation(threads, char);
  assert(out.closeThreadIds.includes('a'), 'completed should be closed');
  assert(!out.closeThreadIds.includes('b'), 'in-progress should not be closed');
  assert(out.newThread !== null, 'alive should open new thread');
  log('ai99-thread-continuation', { passed: true, closeCount: out.closeThreadIds.length, newThread: !!out.newThread });
}

function smokeAi100BottleSpiritAffect(): void {
  // AI-100: deriveBottleSpiritAffect only returns status when revealed=true
  const empty = deriveBottleSpiritAffect({ id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [] } as any);
  assert(empty === null, 'no bottle spirit should =null');
  const hidden = deriveBottleSpiritAffect({ id: 'c2', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], bottleSpirits: [{ spiritId: 'b1', sourceName: 'bottle', visibleEffect: 'v', hiddenEffect: 'h', revealed: false, awakenedAge: 0 }] } as any);
  assert(hidden === null, 'unrevealed should =null');
  const revealed = deriveBottleSpiritAffect({ id: 'c3', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], bottleSpirits: [{ spiritId: 'b1', sourceName: 'ancient-bottle', visibleEffect: 'spirit-clears', hiddenEffect: 'h', revealed: true, awakenedAge: 10 }] } as any);
  assert(revealed !== null && revealed.name.includes('ancient-bottle'), "revealed should return source name, got=" + (revealed && revealed.name));
  log('ai100-bottle-spirit-affect', { passed: true, statusName: revealed && revealed.name });
}

function smokeAi100SwordAptitudeProgress(): void {
  // AI-100: deriveSwordAptitudeProgress advances by accumulated practice
  const char: any = { id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [] };
  const novice = deriveSwordAptitudeProgress(char, { hours: 50, talent: 1 });
  assert(novice === 'untrained', "no cross tier -> untrained, got=" + novice);
  const advanced = deriveSwordAptitudeProgress({ ...char, swordPracticeAcc: 200 }, { hours: 50, talent: 1 });
  assert(advanced === 'adept' || advanced === 'novice', "accumulated 200 + inc 0.5 -> novice/adept, got=" + advanced);
  log('ai100-sword-aptitude-progress', { passed: true, novice, advanced });
}

function smokeAi100FakeDeath(): void {
  // AI-100: resolveFakeDeath by rule
  const noRule = resolveFakeDeath({ id: 'c1', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], hp: 1, maxHp: 100 } as any, 50);
  assert(noRule.isFake === false && noRule.ruleApplied === false, 'no rule should = not fake');
  const lowHp = resolveFakeDeath({ id: 'c2', name: 'c', realm: 'qi_refining', realmLevel: 1, activeStatuses: [], hp: 5, maxHp: 100, fakeDeathRules: [{ trigger: 'low_hp', fakeDurationTurns: 3, revealChance: 0.3, freezeActions: true }] } as any, 10);
  assert(lowHp.isFake === true && lowHp.ruleApplied === true, 'low hp should trigger fake death');
  log('ai100-fake-death', { passed: true, noRule: noRule.isFake, lowHp: lowHp.isFake });
}

function smokeAi101NPCMemoryUpdate(): void {
  // AI-101: deriveNPCMemoryUpdate returns importance-clamped entry with kind
  const m1 = deriveNPCMemoryUpdate({ id: 'n1', name: 'passerby' }, { summary: 'met at corner', importance: 200 }, 30);
  assert(m1.importance === 100, "importance 200 should clamp to 100, got=" + m1.importance);
  assert(m1.npcId === 'n1' && m1.eventSummary.includes('corner'), 'npcId/summary should remain');
  const m2 = deriveNPCMemoryUpdate({ id: 'n2', name: 'b' }, { summary: 'gave me wine', kind: 'kindness' }, 25);
  assert(m2.kind === 'kindness', "kind should =kindness, got=" + m2.kind);
  log('ai101-npc-memory-update', { passed: true, m1: m1.importance, m2: m2.kind });
}

function smokeAi101NPCBehavior(): void {
  // AI-101: deriveNPCBehavior by betrayal/kindness ratio
  const empty = deriveNPCBehavior({ id: 'n1', memories: [] });
  assert(empty === 'neutral-watch', "empty memory should =neutral-watch, got=" + empty);
  const betrayed = deriveNPCBehavior({ id: 'n2', memories: [
    { npcId: 'n2', eventSummary: 'a', importance: 50, age: 20, kind: 'betrayal' },
    { npcId: 'n2', eventSummary: 'b', importance: 50, age: 20, kind: 'betrayal' },
    { npcId: 'n2', eventSummary: 'c', importance: 50, age: 20, kind: 'kindness' },
  ] });
  assert(betrayed === 'wary-resentment', "2 betrayal vs 1 kind should =wary-resentment, got=" + betrayed);
  const kind = deriveNPCBehavior({ id: 'n3', memories: [
    { npcId: 'n3', eventSummary: 'a', importance: 50, age: 20, kind: 'kindness' },
    { npcId: 'n3', eventSummary: 'b', importance: 50, age: 20, kind: 'kindness' },
    { npcId: 'n3', eventSummary: 'c', importance: 50, age: 20, kind: 'betrayal' },
  ] });
  assert(kind === 'gracious', "2 kind vs 1 betrayal should =gracious, got=" + kind);
  log('ai101-npc-behavior', { passed: true, empty, betrayed, kind });
}

function smokeAi103RumorTrigger(): void {
  // AI-103: deriveRumorTrigger by significance
  const noRumor = deriveRumorTrigger({ title: 'small', significance: 10 }, 'region-A');
  assert(noRumor === null, "significance<30 should =null, got=" + noRumor);
  const big = deriveRumorTrigger({ title: 'anomaly', significance: 80 }, 'region-A');
  assert(big !== null && big.regionScope === 'region-A' && big.reliability > 0, "high significance should produce rumor, got=" + JSON.stringify(big));
  const noRegion = deriveRumorTrigger({ title: 'anomaly', significance: 80 }, null);
  assert(noRegion === null, 'no region should =null');
  log('ai103-rumor-trigger', { passed: true, bigReliability: big && big.reliability });
}

function smokeAi103RumorReliability(): void {
  // AI-103: resolveRumorReliability decays per year, floor 0.05, zero at 100y
  const baseRumor: any = { rumorId: 'r', source: 's', content: 'c', reliability: 0.8, originAge: 0 };
  const after5 = resolveRumorReliability(baseRumor, 5);
  assert(after5 < 0.8 && after5 > 0.05, "after 5y should decay, got=" + after5);
  const after100 = resolveRumorReliability(baseRumor, 100);
  assert(after100 === 0, "100y should =0, got=" + after100);
  const after0 = resolveRumorReliability(baseRumor, 0);
  assert(after0 >= 0.05, '0y should keep non-zero');
  log('ai103-rumor-reliability', { passed: true, after5, after100 });
}
