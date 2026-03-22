/**
 * DEADLINE™ Balance Simulation
 * Stage 1: 1000 games per strategy × brief combination.
 * Self-contained — no browser dependencies.
 * Simplified: no synergies, no desk items, no meetings.
 *             Accurate on: KPI curve, WB/TOX mechanics, brief multipliers,
 *             teammate effects, scoring formula, card values.
 */

// ── Constants ──────────────────────────────────────────
const KPI          = [2400, 3550, 4850, 6350, 7350, 8500, 9200, 11000, 13000, 15000]; // v2 FINAL
const TOTAL_WEEKS  = 10;
const PLAYS        = 5;
const HAND         = 5;
const MAX_SEL      = 3;
const FAIL_WB      = 20;
const clamp        = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt1         = v => Math.round(v * 10) / 10;

// ── wbEff: chip penalty from low WB ───────────────────
function wbEff(wb) {
  if (wb >= 60) return 1.0;
  if (wb >= 35) return 0.85;
  if (wb >= 15) return 0.65;
  return 0.45;
}

// ── Card Database (embedded, stripped to fx) ───────────
const CARDS = {
  // PRODUCTION
  prod_001:{id:'prod_001',arch:'PRODUCTION',rarity:'COMMON',  tier:0, fx:{chips:250, mult:0.1,  tox:0,  wb:0}},
  prod_002:{id:'prod_002',arch:'PRODUCTION',rarity:'COMMON',  tier:0, fx:{chips:200, mult:0,    tox:0,  wb:0}},
  prod_003:{id:'prod_003',arch:'PRODUCTION',rarity:'UNCOMMON',tier:2, fx:{chips:400, mult:0.2,  tox:0,  wb:0}},
  prod_004:{id:'prod_004',arch:'PRODUCTION',rarity:'UNCOMMON',tier:1, fx:{chips:225, mult:0,    tox:0,  wb:0}},
  prod_005:{id:'prod_005',arch:'PRODUCTION',rarity:'COMMON',  tier:0, fx:{chips:300, mult:0,    tox:5,  wb:0}},
  prod_007:{id:'prod_007',arch:'PRODUCTION',rarity:'UNCOMMON',tier:2, fx:{chips:250, mult:0.1,  tox:0,  wb:0}},
  prod_008:{id:'prod_008',arch:'PRODUCTION',rarity:'COMMON',  tier:0, fx:{chips:175, mult:0,    tox:0,  wb:5}},
  prod_009:{id:'prod_009',arch:'PRODUCTION',rarity:'UNCOMMON',tier:1, fx:{chips:100, mult:0,    tox:0,  wb:0}},
  prod_010:{id:'prod_010',arch:'PRODUCTION',rarity:'UNCOMMON',tier:1, fx:{chips:200, mult:0.1,  tox:0,  wb:0}},
  prod_011:{id:'prod_011',arch:'PRODUCTION',rarity:'RARE',    tier:2, fx:{chips:200, mult:0.1,  tox:5,  wb:0}},
  prod_012:{id:'prod_012',arch:'PRODUCTION',rarity:'RARE',    tier:2, fx:{chips:0,   mult:0,    tox:5,  wb:0}},
  prod_013:{id:'prod_013',arch:'PRODUCTION',rarity:'UNCOMMON',tier:1, fx:{chips:75,  mult:0,    tox:8,  wb:-8}},
  prod_014:{id:'prod_014',arch:'PRODUCTION',rarity:'COMMON',  tier:0, fx:{chips:150, mult:0.2,  tox:0,  wb:0}},
  prod_015:{id:'prod_015',arch:'PRODUCTION',rarity:'UNCOMMON',tier:2, fx:{chips:0,   mult:0.8,  tox:0,  wb:0}},
  prod_016:{id:'prod_016',arch:'PRODUCTION',rarity:'RARE',    tier:3, fx:{chips:1500,mult:0,    tox:20, wb:-20}, exhaust:true},
  prod_017:{id:'prod_017',arch:'PRODUCTION',rarity:'RARE',    tier:2, fx:{chips:500, mult:0,    tox:5,  wb:0}},
  prod_018:{id:'prod_018',arch:'PRODUCTION',rarity:'RARE',    tier:3, fx:{chips:1000,mult:0,    tox:10, wb:0},  exhaust:true},
  // STRATEGY
  strat_001:{id:'strat_001',arch:'STRATEGY',rarity:'COMMON',  tier:0, fx:{chips:100, mult:0.3,  tox:0,  wb:0}},
  strat_002:{id:'strat_002',arch:'STRATEGY',rarity:'COMMON',  tier:0, fx:{chips:0,   mult:0.5,  tox:0,  wb:0}},
  strat_003:{id:'strat_003',arch:'STRATEGY',rarity:'RARE',    tier:3, fx:{chips:0,   mult:0,    tox:0,  wb:0},  exhaust:true},
  strat_004:{id:'strat_004',arch:'STRATEGY',rarity:'UNCOMMON',tier:2, fx:{chips:150, mult:0.8,  tox:0,  wb:0}},
  strat_005:{id:'strat_005',arch:'STRATEGY',rarity:'COMMON',  tier:0, fx:{chips:0,   mult:0.6,  tox:0,  wb:-5}},
  strat_006:{id:'strat_006',arch:'STRATEGY',rarity:'COMMON',  tier:1, fx:{chips:75,  mult:0.4,  tox:0,  wb:0}},
  strat_007:{id:'strat_007',arch:'STRATEGY',rarity:'UNCOMMON',tier:2, fx:{chips:0,   mult:0.1,  tox:0,  wb:0}},
  strat_008:{id:'strat_008',arch:'STRATEGY',rarity:'COMMON',  tier:0, fx:{chips:50,  mult:0.4,  tox:0,  wb:0}},
  strat_009:{id:'strat_009',arch:'STRATEGY',rarity:'UNCOMMON',tier:1, fx:{chips:150, mult:0.3,  tox:-5, wb:0}},
  strat_010:{id:'strat_010',arch:'STRATEGY',rarity:'UNCOMMON',tier:1, fx:{chips:75,  mult:0.5,  tox:0,  wb:0}},
  strat_011:{id:'strat_011',arch:'STRATEGY',rarity:'RARE',    tier:2, fx:{chips:0,   mult:0.5,  tox:0,  wb:0},  exhaust:true},
  strat_012:{id:'strat_012',arch:'STRATEGY',rarity:'RARE',    tier:2, fx:{chips:0,   mult:1.2,  tox:10, wb:-5}},
  strat_013:{id:'strat_013',arch:'STRATEGY',rarity:'COMMON',  tier:0, fx:{chips:100, mult:0.2,  tox:-10,wb:0}},
  strat_014:{id:'strat_014',arch:'STRATEGY',rarity:'UNCOMMON',tier:2, fx:{chips:250, mult:0.3,  tox:8,  wb:0}},
  strat_015:{id:'strat_015',arch:'STRATEGY',rarity:'RARE',    tier:3, fx:{chips:0,   mult:2.5,  tox:30, wb:-20},exhaust:true},
  strat_016:{id:'strat_016',arch:'STRATEGY',rarity:'RARE',    tier:2, fx:{chips:0,   mult:1.5,  tox:0,  wb:0}},
  strat_017:{id:'strat_017',arch:'STRATEGY',rarity:'RARE',    tier:3, fx:{chips:0,   mult:3.0,  tox:5,  wb:0},  exhaust:true},
  // CRUNCH
  crunch_001:{id:'crunch_001',arch:'CRUNCH',rarity:'COMMON',  tier:0, fx:{chips:750, mult:0,    tox:15, wb:-8}},
  crunch_002:{id:'crunch_002',arch:'CRUNCH',rarity:'UNCOMMON',tier:1, fx:{chips:0,   mult:1.5,  tox:22, wb:-12}},
  crunch_003:{id:'crunch_003',arch:'CRUNCH',rarity:'RARE',    tier:3, fx:{chips:1000,mult:2.0,  tox:25, wb:-15},exhaust:true},
  crunch_004:{id:'crunch_004',arch:'CRUNCH',rarity:'COMMON',  tier:0, fx:{chips:200, mult:0.8,  tox:10, wb:-10}},
  crunch_005:{id:'crunch_005',arch:'CRUNCH',rarity:'UNCOMMON',tier:1, fx:{chips:500, mult:0.5,  tox:15, wb:-10}},
  crunch_006:{id:'crunch_006',arch:'CRUNCH',rarity:'RARE',    tier:2, fx:{chips:250, mult:1.2,  tox:15, wb:-15},exhaust:true},
  crunch_007:{id:'crunch_007',arch:'CRUNCH',rarity:'COMMON',  tier:0, fx:{chips:400, mult:0,    tox:8,  wb:-5}},
  crunch_008:{id:'crunch_008',arch:'CRUNCH',rarity:'UNCOMMON',tier:1, fx:{chips:250, mult:0.3,  tox:12, wb:-6}},
  crunch_009:{id:'crunch_009',arch:'CRUNCH',rarity:'COMMON',  tier:0, fx:{chips:150, mult:0.6,  tox:12, wb:-6}},
  crunch_010:{id:'crunch_010',arch:'CRUNCH',rarity:'UNCOMMON',tier:1, fx:{chips:550, mult:0,    tox:18, wb:-8}},
  crunch_011:{id:'crunch_011',arch:'CRUNCH',rarity:'RARE',    tier:2, fx:{chips:800, mult:0,    tox:22, wb:-15},exhaust:true},
  crunch_012:{id:'crunch_012',arch:'CRUNCH',rarity:'COMMON',  tier:0, fx:{chips:300, mult:0.2,  tox:10, wb:-6}},
  crunch_013:{id:'crunch_013',arch:'CRUNCH',rarity:'COMMON',  tier:1, fx:{chips:100, mult:0,    tox:5,  wb:8}},
  crunch_014:{id:'crunch_014',arch:'CRUNCH',rarity:'RARE',    tier:3, fx:{chips:2000,mult:0,    tox:35, wb:-30},exhaust:true},
  crunch_015:{id:'crunch_015',arch:'CRUNCH',rarity:'RARE',    tier:2, fx:{chips:800, mult:0,    tox:20, wb:-12}},
  // RECOVERY
  recov_001:{id:'recov_001',arch:'RECOVERY',rarity:'COMMON',  tier:0, fx:{chips:75,  mult:0,    tox:-15,wb:5}},
  recov_002:{id:'recov_002',arch:'RECOVERY',rarity:'COMMON',  tier:1, fx:{chips:150, mult:0.2,  tox:0,  wb:20}},
  recov_003:{id:'recov_003',arch:'RECOVERY',rarity:'UNCOMMON',tier:2, fx:{chips:75,  mult:0,    tox:-40,wb:-5}},
  recov_004:{id:'recov_004',arch:'RECOVERY',rarity:'COMMON',  tier:0, fx:{chips:200, mult:0,    tox:5,  wb:15}},
  recov_006:{id:'recov_006',arch:'RECOVERY',rarity:'COMMON',  tier:1, fx:{chips:100, mult:0,    tox:-25,wb:0}},
  recov_007:{id:'recov_007',arch:'RECOVERY',rarity:'COMMON',  tier:0, fx:{chips:75,  mult:0,    tox:-10,wb:10}},
  recov_008:{id:'recov_008',arch:'RECOVERY',rarity:'UNCOMMON',tier:1, fx:{chips:0,   mult:0.5,  tox:-5, wb:15}},
  recov_009:{id:'recov_009',arch:'RECOVERY',rarity:'UNCOMMON',tier:1, fx:{chips:0,   mult:0,    tox:-25,wb:35},exhaust:true},
  recov_010:{id:'recov_010',arch:'RECOVERY',rarity:'COMMON',  tier:0, fx:{chips:0,   mult:0.2,  tox:-5, wb:8}},
  recov_011:{id:'recov_011',arch:'RECOVERY',rarity:'COMMON',  tier:0, fx:{chips:125, mult:0.3,  tox:8,  wb:12}},
  recov_012:{id:'recov_012',arch:'RECOVERY',rarity:'RARE',    tier:2, fx:{chips:0,   mult:0.4,  tox:-12,wb:20}},
  recov_013:{id:'recov_013',arch:'RECOVERY',rarity:'RARE',    tier:2, fx:{chips:0,   mult:0,    tox:-30,wb:20},exhaust:true},
  recov_014:{id:'recov_014',arch:'RECOVERY',rarity:'COMMON',  tier:1, fx:{chips:50,  mult:0.1,  tox:-8, wb:5}},
  recov_015:{id:'recov_015',arch:'RECOVERY',rarity:'UNCOMMON',tier:1, fx:{chips:125, mult:0.2,  tox:-8, wb:12}},
  recov_016:{id:'recov_016',arch:'RECOVERY',rarity:'RARE',    tier:3, fx:{chips:0,   mult:0,    tox:-50,wb:50},exhaust:true},
  recov_017:{id:'recov_017',arch:'RECOVERY',rarity:'UNCOMMON',tier:2, fx:{chips:0,   mult:1.5,  tox:-12,wb:10}},
};

// Starting deck (2× prod_001, 2× prod_002, etc.)
const DECK_BLUEPRINT = {
  prod_001:2, prod_002:2, prod_005:2,
  strat_001:2, strat_002:2, strat_005:1,
  crunch_001:2, crunch_004:1,
  recov_001:2, recov_004:2,
};

// Cards available in shop/packs (tier ≥ 1, not in starting deck)
const SHOP_POOL = Object.values(CARDS).filter(c =>
  c.tier >= 1 && !DECK_BLUEPRINT[c.id]
);

// ── Shuffle ────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Make initial deck ──────────────────────────────────
function makeDeck() {
  const deck = [];
  for (const [id, n] of Object.entries(DECK_BLUEPRINT)) {
    const card = CARDS[id];
    for (let i = 0; i < n; i++) deck.push({ ...card });
  }
  return shuffle(deck);
}

// ── Briefs ─────────────────────────────────────────────
const BRIEFS = [
  'digital_transformation',
  'cost_reduction',
  'sustainable_growth',
  'hyper_growth',
  'restructure',
  'scale_or_fail',
];

// ── Teammates ──────────────────────────────────────────
const TEAMMATES = ['gary', 'sarah', 'derek', 'priya', 'ben', 'alex'];

// ── RNG ────────────────────────────────────────────────
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }

// ══════════════════════════════════════════════════════
//  TURN SCORING ENGINE (simplified, no synergies)
// ══════════════════════════════════════════════════════
function scoreTurn(selectedCards, state, brief) {
  let acc = { chips: 0, mult: 1.0 + (state.permMult || 0) };
  let wb = state.wb;
  let tox = state.tox;
  const wbBefore = wb;

  // Restructure: lean deck Eff bonus
  if (brief === 'restructure') {
    const deckSz = state.deck.length + state.hand.length + state.pile.length;
    if (deckSz <= 10) acc.mult += Math.round((10 - deckSz) * 0.1 * 10) / 10;
  }

  for (const card of selectedCards) {
    let fx = { ...card.fx };

    // Brief per-card effects
    if (brief === 'cost_reduction' && card.arch === 'CRUNCH') {
      fx.chips = Math.round(fx.chips * 1.6);
      fx.wb    = Math.round(fx.wb * 1.5);
      tox     += 3;
    }
    if (brief === 'hyper_growth' && card.arch === 'PRODUCTION') {
      fx.chips = Math.round(fx.chips * 1.5);
    }
    if (brief === 'sustainable_growth' && card.arch === 'RECOVERY') {
      const healPct = Math.max(0, fx.wb);
      fx.chips += healPct * 15; // v3: reduced from 30
      fx.tox    = 0; // RECOVERY no longer reduces TOX
    }

    // Tox zone 2 (31-60): CRUNCH +40% chips
    if (card.arch === 'CRUNCH' && tox >= 31 && tox <= 60) {
      fx.chips = Math.round(fx.chips * 1.4);
    }

    // Accumulate
    acc.chips += fx.chips;
    acc.mult  += fx.mult;
    wb = clamp(wb + (fx.wb || 0), -100, 100);
    if (fx.tox) tox = clamp(tox + fx.tox, 0, 100);

    // TOX zone 3/4 WB drain per card
    if (tox >= 81) wb = clamp(wb - 2, -100, 100);
    else if (tox >= 61) wb = clamp(wb - 1, -100, 100);
  }

  // Hyper-growth penalty: no PRODUCTION in play → chips × 0.8
  if (brief === 'hyper_growth' && !selectedCards.some(c => c.arch === 'PRODUCTION')) {
    acc.chips = Math.round(acc.chips * 0.8);
  }

  // TOX zone mult bonus (post-loop)
  if (tox >= 81) acc.mult = fmt1(acc.mult * 1.6);
  else if (tox >= 61) acc.mult = fmt1(acc.mult * 1.3);

  // WB chip penalty
  const chipMult = wbEff(wb);
  const finalChips = Math.round(acc.chips * chipMult);
  const score = Math.max(0, Math.floor(finalChips * acc.mult));

  // Gameoveer check
  const gameOver = wb <= -100;

  return { score, wbDelta: wb - wbBefore, toxDelta: tox - state.tox, newWb: wb, newTox: tox, mult: acc.mult, chips: finalChips, gameOver };
}

// ══════════════════════════════════════════════════════
//  AI STRATEGIES
// ══════════════════════════════════════════════════════

// Greedy: pick up to MAX_SEL cards that maximize expected chips × mult
function selectGreedy(hand, state, brief) {
  // Try all 1-3 card combos, pick highest score
  const maxSel = Math.min(MAX_SEL, hand.length);
  let best = null, bestScore = -1;
  for (let size = 1; size <= maxSel; size++) {
    const combos = combinations(hand, size);
    for (const combo of combos) {
      const result = scoreTurn(combo, state, brief);
      if (!result.gameOver && result.score > bestScore) {
        bestScore = result.score;
        best = combo;
      }
    }
  }
  return best || hand.slice(0, 1);
}

// Safe: prioritize WB/TOX management; if critical, play recovery first
function selectSafe(hand, state, brief) {
  const critical = state.wb < 30 || state.tox > 60;
  if (critical) {
    // Try to pick recovery-heavy combo or low-damage combo
    const recov = hand.filter(c => c.arch === 'RECOVERY');
    if (recov.length >= 1) return recov.slice(0, Math.min(2, recov.length));
    // Otherwise pick lowest damage cards
    const sorted = [...hand].sort((a, b) => {
      const harmA = (a.fx.tox || 0) - (a.fx.wb || 0); // negative wb = more harm
      const harmB = (b.fx.tox || 0) - (b.fx.wb || 0);
      return harmA - harmB;
    });
    return sorted.slice(0, 2);
  }
  // Not critical: like greedy but penalize tox/wb-damaging combos
  const maxSel = Math.min(MAX_SEL, hand.length);
  let best = null, bestScore = -1;
  for (let size = 1; size <= maxSel; size++) {
    const combos = combinations(hand, size);
    for (const combo of combos) {
      const result = scoreTurn(combo, state, brief);
      // Penalize combos that push tox high or drain WB
      const penalty = Math.max(0, result.newTox - 50) * 30 + Math.max(0, 30 - result.newWb) * 20;
      const adjScore = result.score - penalty;
      if (!result.gameOver && adjScore > bestScore) {
        bestScore = adjScore;
        best = combo;
      }
    }
  }
  return best || hand.slice(0, 1);
}

// Random: pick 1-3 random cards
function selectRandom(hand) {
  const n = 1 + rnd(Math.min(MAX_SEL, hand.length));
  return shuffle(hand).slice(0, n);
}

// Combinator helper
function combinations(arr, size) {
  if (size === 1) return arr.map(x => [x]);
  const result = [];
  for (let i = 0; i < arr.length - size + 1; i++) {
    const rest = combinations(arr.slice(i + 1), size - 1);
    for (const combo of rest) result.push([arr[i], ...combo]);
  }
  return result;
}

// ══════════════════════════════════════════════════════
//  TEAMMATE SELECTION
// ══════════════════════════════════════════════════════
function chooseTeammate(strategy, state) {
  // All strategies pick randomly for v1 (teammate data isn't known in advance)
  return pick(TEAMMATES);
}

// Apply teammate week-start effects to state
function applyTeammateStart(teammate, state) {
  if (teammate === 'sarah') {
    const tier = state.tox >= 81 ? 3 : state.tox >= 31 ? 2 : 1;
    const toxChange = tier === 1 ? -20 : tier === 3 ? 15 : -10;
    state.tox = clamp(state.tox + toxChange, 0, 100);
    // Sarah removes 1 card from hand (already drawn before this, so just note it)
    state.sarahHandPenalty = tier === 3 ? 2 : 1;
  }
  if (teammate === 'alex') {
    state.alexWarning = true; // might snitch later if tox > 60
  }
  if (teammate === 'priya') {
    const tier = state.tox >= 81 ? 3 : state.tox >= 31 ? 2 : 1;
    if (tier === 3) state.tox = clamp(state.tox + 10, 0, 100);
  }
}

// Per-card teammate bonus applied during play
function teammateCardBonus(teammate, card, state) {
  let chipsBonus = 0, multBonus = 0;
  const tier = state.tox >= 81 ? 3 : state.tox >= 31 ? 2 : 1;

  if (teammate === 'gary' && card.arch === 'PRODUCTION') {
    // Gary T1: +75 chips per PRODUCTION (approximate from calcTurn)
    chipsBonus = tier === 1 ? 75 : tier === 3 ? -50 : 50;
  }
  if (teammate === 'derek' && card.arch === 'CRUNCH') {
    // Derek: +0.3 mult per CRUNCH at T1
    multBonus = tier === 1 ? 0.3 : tier === 3 ? -0.2 : 0.15;
  }
  if (teammate === 'priya' && card.arch === 'STRATEGY') {
    // Priya T1: +0.25 mult per STRATEGY
    multBonus = tier === 1 ? 0.25 : tier === 3 ? 0 : 0.1;
  }
  return { chipsBonus, multBonus };
}

// ══════════════════════════════════════════════════════
//  BRIEF PROGRESS TRACKING
// ══════════════════════════════════════════════════════
function updateBriefProgress(brief, state, weekCards, weekWb, weekTox) {
  if (brief === 'digital_transformation') {
    // Count STRATEGY plays this week
    state.briefProgress = (state.briefProgress || 0) + weekCards.filter(c => c.arch === 'STRATEGY').length;
    if (!state.briefCompleted && state.briefProgress >= 25) {
      state.briefCompleted = true;
      state.permMult = fmt1((state.permMult || 0) + 1.0);
    }
  }
  if (brief === 'cost_reduction') {
    if (weekTox < 35) {
      state.briefProgress = (state.briefProgress || 0) + 1;
      if (!state.briefCompleted && state.briefProgress >= 5) {
        state.briefCompleted = true;
        state.freeRemoval = true;
      }
    }
  }
  if (brief === 'sustainable_growth') {
    // briefProgress tracks chips from RECOVERY this run (approximate via wb healed)
    // already tracked in scoreTurn via chips accumulation; just check total
  }
  if (brief === 'scale_or_fail') {
    // handled in _processEndOfWeek
  }
  if (brief === 'wellness_initiative') {
    if (weekWb >= 70) {
      state.permMult = fmt1((state.permMult || 0) + 0.3);
    }
  }
  if (brief === 'restructure') {
    // deck ≤ 8 at end: handled at scoring
  }
}

// ══════════════════════════════════════════════════════
//  SINGLE GAME SIMULATION
// ══════════════════════════════════════════════════════
function simGame(strategyFn, brief, options = {}) {
  const verbose = options.verbose || false;

  // Game state
  const state = {
    week: 1,
    wb: 100,
    tox: 0,
    permMult: 0,
    deck: makeDeck(),
    hand: [],
    pile: [],
    plays: PLAYS,
    discs: 3,
    coins: 0,
    brief: null,         // assigned after week 1
    teammate: null,
    failedWeeks: 0,
    endCondition: 'annual',
    totalRawChips: 0,
    totalMultSum: 0,
    totalPlayCount: 0,
    peakTox: 0,
    wellnessWeeks: 0,
    totalTeammateWeeks: 0,
    briefProgress: 0,
    briefCompleted: false,
    kpiMult: 1.0,
    consecutiveFails: 0,
    // Tracking
    weekResults: [],
    cardPlayCounts: {},
    weeklyCC: [],
    playsUsed: 0,
    playsSkipped: 0,
    recoveryCardsPlayed: 0,
    recoveryInWinningRun: false,
    weeklyWb: [],
    weeklyTox: [],
  };

  // Draw up to HAND limit
  function drawUp(handLimit) {
    const lim = handLimit || HAND;
    while (state.hand.length < lim) {
      if (state.deck.length === 0) {
        state.deck = shuffle([...state.pile]);
        state.pile = [];
        if (state.deck.length === 0) break;
      }
      state.hand.push(state.deck.shift());
    }
  }

  function getKpi() {
    const base = KPI[Math.min(state.week - 1, KPI.length - 1)];
    let kpi = Math.floor(base * state.kpiMult);
    if (brief === 'scale_or_fail') kpi = Math.floor(kpi * 1.10); // v2: reduced from 1.15
    // Ben's KPI reduction (T1)
    if (state.teammate === 'ben') {
      const tier = state.tox >= 81 ? 3 : state.tox >= 31 ? 2 : 1;
      const pct = tier === 1 ? 0.12 : tier === 3 ? 0.25 : 0.08;
      kpi = Math.floor(kpi * (1 - pct));
    }
    return kpi;
  }

  // Week loop
  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    state.week = week;
    state.plays = PLAYS;
    state.discs = 3;

    // Assign brief after week 1 (use the passed-in brief)
    if (week === 2 && !state.brief) {
      state.brief = brief;
    }

    // Tox zone 4 (81+): -1 discard
    if (state.tox >= 81) state.discs = Math.max(0, state.discs - 1);

    // Draw initial hand
    const handLimit = brief === 'hyper_growth' ? HAND - 1 : HAND;
    drawUp(handLimit);

    // Teammate effects (week 2+)
    if (week >= 2) {
      state.teammate = pick(TEAMMATES);
      state.totalTeammateWeeks++;
      applyTeammateStart(state.teammate, state);
      // Sarah hand penalty: remove cards from hand
      if (state.sarahHandPenalty) {
        for (let i = 0; i < state.sarahHandPenalty && state.hand.length > 0; i++) {
          state.pile.push(state.hand.pop());
        }
        delete state.sarahHandPenalty;
      }
    }

    // Play phase
    let weekScore = 0;
    let weekCards = [];
    const kpi = getKpi();

    for (let play = 0; play < PLAYS; play++) {
      if (state.hand.length === 0) break;

      // Exhaust cards (simplified: exhaust cards go to pile after use)
      const availHand = state.hand.filter(c => !c._exhaustedThisWeek);
      if (availHand.length === 0) break;

      // AI selects cards
      let selected;
      if (strategyFn === 'greedy') selected = selectGreedy(availHand, state, state.brief);
      else if (strategyFn === 'safe') selected = selectSafe(availHand, state, state.brief);
      else selected = selectRandom(availHand);

      if (!selected || selected.length === 0) break;

      // Apply teammate per-card bonuses (simplified: add to base chips/mult)
      const modifiedSelected = selected.map(c => {
        if (!state.teammate) return c;
        const { chipsBonus, multBonus } = teammateCardBonus(state.teammate, c, state);
        return chipsBonus || multBonus
          ? { ...c, fx: { ...c.fx, chips: (c.fx.chips || 0) + chipsBonus, mult: (c.fx.mult || 0) + multBonus } }
          : c;
      });

      const result = scoreTurn(modifiedSelected, state, state.brief);

      // Update state
      state.wb  = result.newWb;
      state.tox = result.newTox;
      weekScore += result.score;
      state.totalRawChips += result.chips;
      state.totalMultSum  += result.mult;
      state.totalPlayCount++;
      state.playsUsed++;

      // Track card plays
      for (const c of selected) {
        state.cardPlayCounts[c.id] = (state.cardPlayCounts[c.id] || 0) + 1;
        weekCards.push(c);
        if (c.arch === 'RECOVERY') state.recoveryCardsPlayed++;
        // Exhaust handling
        if (c.exhaust) c._exhaustedThisWeek = true;
        // Remove from hand
        const idx = state.hand.findIndex(h => h === c);
        if (idx >= 0) state.hand.splice(idx, 1);
        state.pile.push(c);
      }

      // Redraw (draw 1 per card played)
      drawUp(handLimit);

      // Game over check
      if (result.gameOver || state.wb <= -100) {
        state.endCondition = 'burnout';
        state.weekResults.push({ week, passed: false, score: weekScore, kpi, wb: state.wb, tox: state.tox });
        state.weeklyWb.push(state.wb);
        state.weeklyTox.push(state.tox);
        state.weeklyCC.push(state.coins);
        return finalize(state, week);
      }

      // Alex snitch: if warned and tox > 60, 50% chance per week
      if (state.teammate === 'alex' && state.alexWarning && state.tox > 60 && Math.random() < 0.5) {
        const tier = state.tox >= 81 ? 3 : state.tox >= 31 ? 2 : 1;
        const snitchWb  = tier === 1 ? -10 : tier === 3 ? -25 : -15;
        const snitchTox = tier === 1 ?  8  : tier === 3 ?  20 :  10;
        state.wb  = clamp(state.wb  + snitchWb, -100, 100);
        state.tox = clamp(state.tox + snitchTox, 0, 100);
        state.alexWarning = false;
      }
    }

    // Reset exhausted cards
    for (const c of [...state.hand, ...state.pile, ...state.deck]) {
      delete c._exhaustedThisWeek;
    }

    // Auto-bank unused plays: +2 CC, -1 tox per unused play
    const unusedPlays = Math.max(0, PLAYS - state.playsUsed % PLAYS);
    if (unusedPlays > 0 && unusedPlays < PLAYS) {
      state.coins  += unusedPlays * 2;
      state.tox     = clamp(state.tox - unusedPlays, 0, 100);
      state.playsSkipped += unusedPlays;
    }

    // ── End of Week Stats ──────────────────────────────
    state.peakTox = Math.max(state.peakTox, state.tox);

    // Chronic toxicity WB drain: floor(tox/20) per week
    const toxDmg = Math.floor(state.tox / 20);
    if (toxDmg > 0) state.wb = clamp(state.wb - toxDmg, -100, 100);

    // Wellness week tracking
    if (state.wb >= 70) state.wellnessWeeks++;

    const passed = weekScore >= kpi;

    if (!passed) {
      state.failedWeeks++;
      state.wb = clamp(state.wb - FAIL_WB, -100, 100);
      // Partial CC reward on fail
      const pct = weekScore / kpi;
      const failReward = 2 + Math.floor(pct * 5);
      state.coins += failReward;
      state.consecutiveFails++;
      // KPI reduction after consecutive fails
      if (state.consecutiveFails >= 2) {
        state.kpiMult = Math.max(0.5, state.kpiMult - 0.15);
      }
      // Termination check
      if (state.failedWeeks >= 3) {
        state.endCondition = 'terminated';
        state.weekResults.push({ week, passed: false, score: weekScore, kpi, wb: state.wb, tox: state.tox });
        state.weeklyWb.push(state.wb);
        state.weeklyTox.push(state.tox);
        state.weeklyCC.push(state.coins);
        return finalize(state, week);
      }
      // WB game over check
      if (state.wb <= -100) {
        state.endCondition = 'burnout';
        state.weekResults.push({ week, passed: false, score: weekScore, kpi, wb: state.wb, tox: state.tox });
        state.weeklyWb.push(state.wb);
        state.weeklyTox.push(state.tox);
        state.weeklyCC.push(state.coins);
        return finalize(state, week);
      }
    } else {
      state.consecutiveFails = 0;
      // CC reward based on performance margin
      const overPct = weekScore / kpi;
      if (brief === 'scale_or_fail') {
        // perm Eff instead of CC — v2: increased reward (+50% per tier)
        const mult = overPct >= 1.3 ? 0.6 : overPct >= 1.1 ? 0.5 : 0.4;
        state.permMult = fmt1((state.permMult || 0) + mult);
        state.briefProgress = (state.briefProgress || 0) + 1;
        if (!state.briefCompleted && state.briefProgress >= 8) state.briefCompleted = true;
      } else {
        const passReward = overPct >= 1.3 ? 12 : overPct >= 1.1 ? 9 : 6;
        state.coins += passReward;
      }
      // Breakthrough bonus: score ≥ 2× KPI → +0.5 perm Eff
      if (weekScore >= kpi * 2) {
        state.permMult = fmt1((state.permMult || 0) + 0.5);
      }
    }

    // Brief end-of-week
    if (brief === 'wellness_initiative' && state.wb >= 70) {
      state.permMult = fmt1((state.permMult || 0) + 0.3);
    }
    if (brief === 'cost_reduction' && state.tox < 35) {
      state.briefProgress = (state.briefProgress || 0) + 1;
      if (!state.briefCompleted && state.briefProgress >= 5) {
        state.briefCompleted = true;
      }
    }

    // Simple shop: buy 1 random card if enough CC (cost ~4 CC)
    if (state.coins >= 4) {
      const available = SHOP_POOL.filter(c => !state.brief || c.tier <= 2);
      if (available.length > 0) {
        const newCard = pick(available);
        state.deck.push({ ...newCard });
        state.coins -= 4;
      }
    }

    state.weekResults.push({ week, passed, score: weekScore, kpi, wb: state.wb, tox: state.tox });
    state.weeklyWb.push(state.wb);
    state.weeklyTox.push(state.tox);
    state.weeklyCC.push(state.coins);

    // Alex warning: set after first non-snitch week at high tox
    if (state.teammate === 'alex' && state.tox > 60 && !state.alexSnitched) {
      state.alexWarning = true;
    }

    // Move pile → deck (recycle) if deck almost empty
    if (state.deck.length <= 2 && state.pile.length > 0) {
      state.deck.push(...shuffle([...state.pile]));
      state.pile = [];
    }
  }

  return finalize(state, TOTAL_WEEKS);
}

function finalize(state, finalWeek) {
  const chips = state.totalRawChips;
  const avgMult = state.totalPlayCount > 0 ? state.totalMultSum / state.totalPlayCount : 1.0;
  const rawPts      = chips;
  const multPts     = Math.floor(avgMult * 1000);
  const wellnessPts = (state.wellnessWeeks || 0) * 150;
  const wbPts       = state.wb * 10;
  const toxPts      = state.peakTox * (-5);
  const synPts      = state.totalTeammateWeeks * 50;
  const total       = rawPts + multPts + wellnessPts + wbPts + toxPts + synPts;
  const survived    = state.endCondition === 'annual';

  return {
    survived,
    endCondition: state.endCondition,
    finalWeek,
    failedWeeks: state.failedWeeks,
    weekResults: state.weekResults,
    finalWb: state.wb,
    finalTox: state.tox,
    peakTox: state.peakTox,
    wellnessWeeks: state.wellnessWeeks,
    totalTeammateWeeks: state.totalTeammateWeeks,
    totalRawChips: chips,
    avgMult: fmt1(avgMult),
    finalScore: total,
    coins: state.coins,
    cardPlayCounts: state.cardPlayCounts,
    briefCompleted: state.briefCompleted,
    weeklyCC: state.weeklyCC,
    weeklyWb: state.weeklyWb,
    weeklyTox: state.weeklyTox,
    recoveryCardsPlayed: state.recoveryCardsPlayed,
    playsSkipped: state.playsSkipped,
  };
}

// ══════════════════════════════════════════════════════
//  BATCH SIMULATION
// ══════════════════════════════════════════════════════
function runBatch(strategy, brief, n = 1000) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(simGame(strategy, brief));
  }
  return results;
}

function analyzeResults(results, strategy, brief) {
  const n = results.length;
  const survived = results.filter(r => r.survived).length;
  const terminated = results.filter(r => r.endCondition === 'terminated').length;
  const burned = results.filter(r => r.endCondition === 'burnout').length;

  // Win rate per week (pass rate)
  const weekPassRates = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const weekResults = results.flatMap(r => r.weekResults.filter(wr => wr.week === w));
    if (weekResults.length === 0) { weekPassRates.push(null); continue; }
    const passed = weekResults.filter(wr => wr.passed).length;
    weekPassRates.push(passed / weekResults.length);
  }

  // Average score
  const avgScore = results.reduce((s, r) => s + r.finalScore, 0) / n;

  // Average final WB and TOX
  const avgFinalWb  = results.reduce((s, r) => s + r.finalWb,  0) / n;
  const avgFinalTox = results.reduce((s, r) => s + r.finalTox, 0) / n;
  const avgPeakTox  = results.reduce((s, r) => s + r.peakTox,  0) / n;

  // Brief completion rate
  const briefCompleted = results.filter(r => r.briefCompleted).length / n;

  // Recovery card usage in wins
  const wins = results.filter(r => r.survived);
  const recoveryInWins = wins.length > 0
    ? wins.filter(r => r.recoveryCardsPlayed > 0).length / wins.length
    : 0;

  // Average CC at end
  const avgFinalCC = results.reduce((s, r) => s + r.coins, 0) / n;

  // Card play frequency (aggregate)
  const cardTotals = {};
  for (const r of results) {
    for (const [id, count] of Object.entries(r.cardPlayCounts)) {
      cardTotals[id] = (cardTotals[id] || 0) + count;
    }
  }
  const totalPlays = Object.values(cardTotals).reduce((s, v) => s + v, 0);
  const cardFreq = Object.fromEntries(
    Object.entries(cardTotals)
      .map(([id, cnt]) => [id, cnt / totalPlays])
      .sort((a, b) => b[1] - a[1])
  );

  // Weekly CC curve (avg)
  const weeklyCC = [];
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const ccAtWeek = results.map(r => r.weeklyCC[w] || 0);
    weeklyCC.push(ccAtWeek.reduce((s, v) => s + v, 0) / ccAtWeek.length);
  }

  // Weekly WB/TOX averages
  const weeklyWb  = [];
  const weeklyTox = [];
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    weeklyWb.push( results.map(r => r.weeklyWb[w]  ?? 100).reduce((s, v) => s + v, 0) / n);
    weeklyTox.push(results.map(r => r.weeklyTox[w] ?? 0  ).reduce((s, v) => s + v, 0) / n);
  }

  // Banking: plays skipped
  const avgPlaysSkipped = results.reduce((s, r) => s + r.playsSkipped, 0) / n;

  return {
    strategy, brief, n,
    winRate: survived / n,
    terminationRate: terminated / n,
    burnoutRate: burned / n,
    weekPassRates,
    avgScore: Math.round(avgScore),
    avgFinalWb: Math.round(avgFinalWb * 10) / 10,
    avgFinalTox: Math.round(avgFinalTox * 10) / 10,
    avgPeakTox: Math.round(avgPeakTox * 10) / 10,
    briefCompletionRate: briefCompleted,
    recoveryInWins,
    avgFinalCC: Math.round(avgFinalCC * 10) / 10,
    cardFreq,
    weeklyCC: weeklyCC.map(v => Math.round(v * 10) / 10),
    weeklyWb:  weeklyWb.map(v  => Math.round(v  * 10) / 10),
    weeklyTox: weeklyTox.map(v => Math.round(v * 10) / 10),
    avgPlaysSkipped: Math.round(avgPlaysSkipped * 10) / 10,
  };
}

// ══════════════════════════════════════════════════════
//  MAIN — RUN ALL COMBINATIONS
// ══════════════════════════════════════════════════════
const STRATEGIES = ['greedy', 'safe', 'random'];
const N = 1000;

console.log(`\n${'═'.repeat(72)}`);
console.log(`  DEADLINE™ BALANCE SIMULATION — ${N} games per (strategy × brief)`);
console.log(`  Total games: ${STRATEGIES.length * BRIEFS.length * N}`);
console.log(`${'═'.repeat(72)}\n`);

const allStats = [];

for (const strategy of STRATEGIES) {
  for (const brief of BRIEFS) {
    const results = runBatch(strategy, brief, N);
    const stats = analyzeResults(results, strategy, brief);
    allStats.push(stats);
  }
}

// ── Report 1: Win rates overview ───────────────────────
console.log('\n━━━ WIN RATES (survived 10 weeks) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Strategy  '.padEnd(10) + ' ' + 'Brief'.padEnd(26) + ' ' + 'Win%'.padStart(5) + '  ' + 'Burn%'.padStart(5) + '  ' + 'Term%'.padStart(5) + '  ' + 'Score'.padStart(7) + '  ' + 'BriefOK'.padStart(7));
console.log('─'.repeat(72));
for (const s of allStats) {
  const briefShort = s.brief.replace('_',' ').toUpperCase().slice(0, 25);
  console.log(
    `${(s.strategy).padEnd(10)} ${(briefShort).padEnd(26)} ${(s.winRate*100).toFixed(1).padStart(5)}%` +
    `  ${(s.burnoutRate*100).toFixed(1).padStart(5)}%` +
    `  ${(s.terminationRate*100).toFixed(1).padStart(5)}%` +
    `  ${String(s.avgScore).padStart(7)}` +
    `  ${(s.briefCompletionRate*100).toFixed(1).padStart(6)}%`
  );
}

// ── Report 2: Win rates by brief (across strategies) ──
console.log('\n━━━ BRIEF WIN RATE COMPARISON (avg across strategies) ━━━━━━━━━━━━━━━━━━\n');
const briefStats = {};
for (const brief of BRIEFS) {
  const forBrief = allStats.filter(s => s.brief === brief);
  briefStats[brief] = {
    avgWin: forBrief.reduce((s, r) => s + r.winRate, 0) / forBrief.length,
    greedyWin: forBrief.find(s => s.strategy === 'greedy')?.winRate || 0,
    safeWin: forBrief.find(s => s.strategy === 'safe')?.winRate || 0,
    randomWin: forBrief.find(s => s.strategy === 'random')?.winRate || 0,
    briefCompletion: forBrief.reduce((s, r) => s + r.briefCompletionRate, 0) / forBrief.length,
  };
}
const briefRanked = Object.entries(briefStats).sort((a, b) => b[1].avgWin - a[1].avgWin);
console.log('Brief'.padEnd(26) + '  ' + 'Avg Win%'.padStart(7) + '  ' + 'Greedy'.padStart(6) + '  ' + 'Safe'.padStart(6) + '  ' + 'Random'.padStart(6) + '  ' + 'BriefOK'.padStart(6));
console.log('─'.repeat(72));
for (const [brief, s] of briefRanked) {
  console.log(
    `${(brief.replace(/_/g,' ').toUpperCase().slice(0,25)).padEnd(26)}` +
    `  ${(s.avgWin*100).toFixed(1).padStart(7)}%` +
    `  ${(s.greedyWin*100).toFixed(1).padStart(6)}%` +
    `  ${(s.safeWin*100).toFixed(1).padStart(6)}%` +
    `  ${(s.randomWin*100).toFixed(1).padStart(6)}%` +
    `  ${(s.briefCompletion*100).toFixed(1).padStart(6)}%`
  );
}

// ── Report 3: Difficulty curve by week ────────────────
console.log('\n━━━ DIFFICULTY CURVE (pass rate per week per strategy) ━━━━━━━━━━━━━━━━━\n');
console.log(' Wk | Greedy  |  Safe   | Random  | Target(G) | Target(R)');
console.log('─'.repeat(60));
const targets_greedy = [0.95,0.90,0.88,0.75,0.70,0.70,0.60,0.55,0.50,0.45];
const targets_random = [0.85,0.80,0.70,0.65,0.55,0.55,0.50,0.45,0.40,0.35];
for (let w = 1; w <= TOTAL_WEEKS; w++) {
  const greedyPassRates = allStats.filter(s => s.strategy === 'greedy').map(s => s.weekPassRates[w-1] || 0);
  const safePassRates   = allStats.filter(s => s.strategy === 'safe').map(s => s.weekPassRates[w-1] || 0);
  const randomPassRates = allStats.filter(s => s.strategy === 'random').map(s => s.weekPassRates[w-1] || 0);
  const avgGreedy = greedyPassRates.reduce((s, v) => s + v, 0) / greedyPassRates.length;
  const avgSafe   = safePassRates.reduce((s, v) => s + v, 0) / safePassRates.length;
  const avgRandom = randomPassRates.reduce((s, v) => s + v, 0) / randomPassRates.length;
  const tg = targets_greedy[w-1], tr = targets_random[w-1];
  const flagG = avgGreedy < tg ? ' ✗' : ' ✓';
  const flagR = avgRandom < tr ? ' ✗' : ' ✓';
  console.log(`${String(w).padStart(3)} | ${(avgGreedy*100).toFixed(1).padStart(6)}% | ${(avgSafe*100).toFixed(1).padStart(6)}% | ${(avgRandom*100).toFixed(1).padStart(6)}% | ${(tg*100).toFixed(0).padStart(4)}%${flagG}     | ${(tr*100).toFixed(0).padStart(4)}%${flagR}`);
}

// ── Report 4: Card play frequency ─────────────────────
console.log('\n━━━ CARD PLAY FREQUENCY (aggregated, top/bottom 10) ━━━━━━━━━━━━━━━━━━━\n');
const allCardTotals = {};
for (const s of allStats) {
  for (const [id, freq] of Object.entries(s.cardFreq)) {
    allCardTotals[id] = (allCardTotals[id] || 0) + freq;
  }
}
const cardList = Object.entries(allCardTotals)
  .map(([id, total]) => ({ id, avg: total / allStats.length, card: CARDS[id] }))
  .sort((a, b) => b.avg - a.avg);

console.log('TOP 10 most played:');
for (const { id, avg, card } of cardList.slice(0, 10)) {
  console.log(`  ${id.padEnd(12)} [${(card?.arch||'?').padEnd(10)}] ${(avg*100).toFixed(2)}%`);
}
console.log('\nBOTTOM 10 least played (dead cards):');
for (const { id, avg, card } of cardList.slice(-10).reverse()) {
  console.log(`  ${id.padEnd(12)} [${(card?.arch||'?').padEnd(10)}] ${(avg*100).toFixed(2)}%`);
}

// ── Report 5: TOX analysis ────────────────────────────
console.log('\n━━━ TOXICITY ANALYSIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
// Win rate at different peak TOX levels
const toxBuckets = [
  { label: 'TOX 0-30',  min: 0,  max: 30  },
  { label: 'TOX 31-60', min: 31, max: 60  },
  { label: 'TOX 61-80', min: 61, max: 80  },
  { label: 'TOX 81+',   min: 81, max: 100 },
];
// Collect raw results from one re-run for TOX analysis
const toxResults = runBatch('greedy', 'cost_reduction', 2000);
console.log('(greedy + cost_reduction, n=2000)');
console.log('TOX Range    |     n |   Win% | Avg Score');
console.log('─'.repeat(42));
for (const { label, min, max } of toxBuckets) {
  const bucket = toxResults.filter(r => r.peakTox >= min && r.peakTox <= max);
  if (bucket.length === 0) { console.log(`${(label).padEnd(12)} |     0 |      - |         -`); continue; }
  const wins = bucket.filter(r => r.survived).length;
  const avgScore = bucket.reduce((s, r) => s + r.finalScore, 0) / bucket.length;
  console.log(`${(label).padEnd(12)} | ${String(bucket.length).padStart(5)} | ${(wins/bucket.length*100).toFixed(1).padStart(5)}% | ${Math.round(avgScore).toString().padStart(9)}`);
}

// ── Report 6: CC Economy ──────────────────────────────
console.log('\n━━━ CC ECONOMY (avg CC per week, greedy) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
const greedyNoSoF = allStats.filter(s => s.strategy === 'greedy' && s.brief !== 'scale_or_fail');
const avgWeeklyCC = [];
for (let w = 0; w < TOTAL_WEEKS; w++) {
  const vals = greedyNoSoF.map(s => s.weeklyCC[w] || 0);
  avgWeeklyCC.push(vals.reduce((s, v) => s + v, 0) / vals.length);
}
console.log('Week    Avg CC  Meaningful?  (≥10 CC = 2+ shop options)');
console.log('─'.repeat(35));
for (let w = 0; w < TOTAL_WEEKS; w++) {
  const cc = avgWeeklyCC[w];
  const meaningful = cc >= 10 ? '✓ YES' : cc >= 6 ? '~ BARELY' : '✗ NO';
  console.log(`${String(w+1).padStart(4)}  ${cc.toFixed(1).padStart(7)}  ${meaningful.padStart(11)}`);
}

// ── Report 7: Play banking ────────────────────────────
console.log('\n━━━ PLAY BANKING (avg plays skipped per run) ━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
for (const strategy of STRATEGIES) {
  const stats = allStats.filter(s => s.strategy === strategy);
  const avgSkipped = stats.reduce((s, r) => s + r.avgPlaysSkipped, 0) / stats.length;
  console.log(`  ${strategy.padEnd(10)} avg ${avgSkipped.toFixed(1)} plays banked/run`);
}

// ── Report 8: Recovery usage in wins ──────────────────
console.log('\n━━━ RECOVERY CARD USAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
for (const strategy of STRATEGIES) {
  const stats = allStats.filter(s => s.strategy === strategy);
  const avgRecovery = stats.reduce((s, r) => s + r.recoveryInWins, 0) / stats.length;
  console.log(`  ${strategy.padEnd(10)} recovery used in ${(avgRecovery*100).toFixed(1)}% of winning runs`);
}

// ── Summary: Targets analysis ─────────────────────────
console.log('\n━━━ STAGE 2 TARGETS — CURRENT STATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
const STAGE2_TARGETS = {
  'weeks1-3 greedy': { target: 0.85, label: 'Weeks 1-3 greedy pass rate ≥ 85%' },
  'weeks4-6 greedy': { target: 0.70, label: 'Weeks 4-6 greedy pass rate 65-75%' },
  'weeks7-9 greedy': { target: 0.55, label: 'Weeks 7-9 greedy pass rate 50-60%' },
  'week10 greedy':   { target: 0.45, label: 'Week 10 greedy pass rate 40-50%' },
};

// Compute aggregated pass rates
const greedyAll = allStats.filter(s => s.strategy === 'greedy');
function avgPassRateForWeeks(stats, weeks) {
  let total = 0, count = 0;
  for (const s of stats) {
    for (const w of weeks) {
      if (s.weekPassRates[w-1] !== null) { total += s.weekPassRates[w-1]; count++; }
    }
  }
  return count > 0 ? total / count : 0;
}

const checks = [
  { label: 'Weeks 1-3 greedy pass rate', target: 0.85, actual: avgPassRateForWeeks(greedyAll, [1,2,3]) },
  { label: 'Weeks 4-6 greedy pass rate', target: 0.70, actual: avgPassRateForWeeks(greedyAll, [4,5,6]) },
  { label: 'Weeks 7-9 greedy pass rate', target: 0.55, actual: avgPassRateForWeeks(greedyAll, [7,8,9]) },
  { label: 'Week 10 greedy pass rate',   target: 0.45, actual: avgPassRateForWeeks(greedyAll, [10]) },
  { label: 'Brief win rate spread ≤ 15%',
    target: 0.15,
    actual: Math.max(...Object.values(briefStats).map(b => b.greedyWin)) - Math.min(...Object.values(briefStats).map(b => b.greedyWin)),
    inverse: true },
];

for (const c of checks) {
  const ok = c.inverse ? c.actual <= c.target : c.actual >= c.target;
  const status = ok ? '✓ OK' : '✗ MISS';
  console.log(`  ${status}  ${c.label}: ${(c.actual * 100).toFixed(1)}% (target: ${c.inverse ? '≤' : '≥'}${(c.target*100).toFixed(0)}%)`);
}

console.log('\n' + '═'.repeat(72));
console.log('  SIMULATION COMPLETE');
console.log('═'.repeat(72) + '\n');
