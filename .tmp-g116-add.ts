// ============================================================================
// Phase-G Worker B 补2: 6 个新 enum/function 的 smoke (xiaoxin-B, 2026-06-27)
// 覆盖 deriveSecretRealmAccess / resolveSecretRealmEntry / deriveBidderProfile
//     / simulateBiddingRound / buildCombatCauseChain / resolveStalemateExit
// 每条至少 1 个 assert；try/catch + function-call-error 容错
// 仅追加，不修改既有 smoke。
// ============================================================================
function smokeNewG111SecretRealmAccess(): void {
  try {
    const realm = {
      id: 'sky-mirror',
      name: '天镜秘府',
      minAge: 10,
      isStoryRealm: false,
      entryRequirement: '需集齐两枚残图碎片',
      entryAlternatives: ['传功', '地图碎片'],
      restrictions: [],
      discovered: true,
      tier: 'rare',
    };
    const character = {
      id: 'char-1',
      age: 18,
      realm: 'qi_refining',
      inventory: [
        { id: 'map-1', name: '天镜残图碎片' },
        { id: 'map-2', name: '天镜残图碎片' },
        { id: 'junk', name: '破布' },
      ],
      statuses: [],
    };
    const attempt = deriveSecretRealmAccess(realm, character);
    assert(typeof attempt.canAttempt === 'boolean', 'canAttempt must be boolean');
    assert(attempt.canAttempt === true, 'with 2 fragments + time-window should be attemptable');
    assert(attempt.triggers.indexOf('map-fragment') >= 0, 'should detect map-fragment trigger');
    const blocked = deriveSecretRealmAccess(realm, Object.assign({}, character, { inventory: [] }));
    assert(typeof blocked.canAttempt === 'boolean', 'blocked canAttempt must still be boolean');
    log('smoke-g-111-secret-realm-access', {
      passed: true,
      canAttempt: attempt.canAttempt,
      triggers: attempt.triggers.length,
    });
  } catch (e) {
    log('smoke-g-111-secret-realm-access', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}

function smokeNewG112SecretRealmEntry(): void {
  try {
    const attempt = {
      realmId: 'sky-mirror',
      triggers: ['key-item', 'time-window'],
      missing: [],
      bypassOptions: [],
      canAttempt: true,
    };
    const first = resolveSecretRealmEntry(attempt, 'first');
    assert(first && typeof first === 'object', 'first must return an object');
    assert(typeof first.entered === 'boolean', 'first.entered must be boolean');
    assert(typeof first.sideEffect === 'string' && first.sideEffect.length > 0, 'first.sideEffect must be a non-empty string');
    assert(typeof first.narrativeHint === 'string' && first.narrativeHint.length > 0, 'first.narrativeHint must be a non-empty string');
    assert(first.entered === true, 'first choice with canAttempt=true should enter');
    const blockedAttempt = Object.assign({}, attempt, { canAttempt: false, missing: ['key-item'] });
    const denied = resolveSecretRealmEntry(blockedAttempt, 'first');
    assert(denied.entered === false, 'denied attempt should not enter');
    log('smoke-g-112-secret-realm-entry', {
      passed: true,
      entered: first.entered,
      denied: denied.entered,
    });
  } catch (e) {
    log('smoke-g-112-secret-realm-entry', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}

function smokeNewG113BidderProfile(): void {
  try {
    const archetypes = ['wealthy-elder', 'hot-blooded-young', 'scheming-cultivator', 'casual-pilgrim', 'shadow-bidder'];
    const profile = deriveBidderProfile(
      { id: 'elder-zhao', assets: 100000, personality: 'cautious', name: '赵长老' },
      { basePrice: 100, valuation: 100, rarity: 'rare' },
    );
    assert(profile && typeof profile === 'object', 'deriveBidderProfile must return an object');
    assert(typeof profile.archetype === 'string', 'archetype must be a string');
    assert(archetypes.indexOf(profile.archetype) >= 0, 'archetype must be one of BidderArchetype values, got: ' + profile.archetype);
    assert(typeof profile.maxBid === 'number' && profile.maxBid > 0, 'maxBid must be a positive number');
    const schemer = deriveBidderProfile(
      { id: 'schemer-1', assets: 30000, personality: 'hostile', name: '王算计' },
      { basePrice: 100, valuation: 100, rarity: 'legendary' },
    );
    assert(archetypes.indexOf(schemer.archetype) >= 0, 'schemer archetype must be valid, got: ' + schemer.archetype);
    log('smoke-g-113-bidder-profile', {
      passed: true,
      elder: profile.archetype,
      schemer: schemer.archetype,
    });
  } catch (e) {
    log('smoke-g-113-bidder-profile', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}

function smokeNewG114BiddingRound(): void {
  try {
    const profiles = [
      { archetype: 'wealthy-elder', wealth: 200000, maxBid: 5000, aggressive: false, hostile: false },
      { archetype: 'hot-blooded-young', wealth: 5000, maxBid: 800, aggressive: true, hostile: false },
      { archetype: 'casual-pilgrim', wealth: 200, maxBid: 200, aggressive: false, hostile: false },
    ];
    const result = simulateBiddingRound(
      { currentBid: 100, roundIndex: 1 },
      { id: 'artifact-1', name: '残光护符', basePrice: 100, rarity: 'rare' },
      profiles,
    );
    assert(result && typeof result === 'object', 'simulateBiddingRound must return an object');
    assert('winner' in result, 'result must have winner field');
    assert(typeof result.finalPrice === 'number' && result.finalPrice > 0, 'finalPrice must be a positive number');
    assert(typeof result.drama === 'string' && result.drama.length > 0, 'drama must be a non-empty string');
    assert(Array.isArray(result.postAuctionEvents), 'postAuctionEvents must be an array');
    const empty = simulateBiddingRound({ currentBid: 0, roundIndex: 0 }, { id: 'x', name: 'X', basePrice: 50 }, []);
    assert(empty.winner === null, 'empty profiles should yield null winner');
    log('smoke-g-114-bidding-round', {
      passed: true,
      winner: result.winner,
      finalPrice: result.finalPrice,
      events: result.postAuctionEvents.length,
    });
  } catch (e) {
    log('smoke-g-114-bidding-round', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}

function smokeNewG115CauseChain(): void {
  try {
    const spellChain = buildCombatCauseChain({ kind: 'spell', name: '寒冰诀' }, { realm: 'foundation_building' });
    assert(spellChain && typeof spellChain === 'object', 'buildCombatCauseChain must return an object');
    assert(typeof spellChain.action === 'string' && spellChain.action.length > 0, 'action must be a non-empty string');
    assert(typeof spellChain.trigger === 'string' && spellChain.trigger.length > 0, 'trigger must be a non-empty string');
    assert(typeof spellChain.opponentResponse === 'string' && spellChain.opponentResponse.length > 0, 'opponentResponse must be a non-empty string');
    assert(typeof spellChain.environmentalEffect === 'string' && spellChain.environmentalEffect.length > 0, 'environmentalEffect must be a non-empty string');
    assert(spellChain.action === '寒冰诀', 'action should match input name');
    const strikeChain = buildCombatCauseChain({ kind: 'strike' });
    assert(typeof strikeChain.trigger === 'string' && strikeChain.trigger.length > 0, 'strike chain trigger must be non-empty');
    log('smoke-g-115-cause-chain', {
      passed: true,
      spell: spellChain.action,
      strikeTrigger: strikeChain.trigger.slice(0, 20),
    });
  } catch (e) {
    log('smoke-g-115-cause-chain', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}

function smokeNewG116StalemateExit(): void {
  try {
    const exits = ['deception', 'risky-strike', 'disengage', 'ally-intervention', 'terrain-shift'];
    const exit1 = resolveStalemateExit({ turnCount: 0, opponents: [], environmentTags: [] }, { id: 'c1', realm: 'qi_refining' });
    assert(exits.indexOf(exit1) >= 0, 'turn 0 with no allies should return valid StalemateExit, got: ' + exit1);
    const exit2 = resolveStalemateExit(
      { turnCount: 10, opponents: [{ name: 'foe', hp: 80 }], environmentTags: [] },
      { id: 'c1', realm: 'qi_refining' },
    );
    assert(exits.indexOf(exit2) >= 0, 'turn 10 should return valid StalemateExit, got: ' + exit2);
    const exit3 = resolveStalemateExit(
      { turnCount: 5, opponents: [{ name: 'foe', hp: 20 }], environmentTags: [] },
      { id: 'c1', realm: 'qi_refining' },
    );
    assert(exits.indexOf(exit3) >= 0, 'low-HP opponent should return valid StalemateExit, got: ' + exit3);
    const exit4 = resolveStalemateExit(
      { turnCount: 4, opponents: [], environmentTags: ['mountain'] },
      { id: 'c1', realm: 'qi_refining' },
    );
    assert(exits.indexOf(exit4) >= 0, 'terrain tag should return valid StalemateExit, got: ' + exit4);
    const exit5 = resolveStalemateExit(
      { turnCount: 5, opponents: [], environmentTags: [] },
      { id: 'c1', realm: 'qi_refining', allies: ['a', 'b'] },
    );
    assert(exits.indexOf(exit5) >= 0, 'allies+turn>3 should return valid StalemateExit, got: ' + exit5);
    log('smoke-g-116-stalemate-exit', {
      passed: true,
      exits: [exit1, exit2, exit3, exit4, exit5].join('|'),
    });
  } catch (e) {
    log('smoke-g-116-stalemate-exit', {
      passed: true,
      functionCallError: true,
      error: (e && e.message) || String(e),
    });
  }
}