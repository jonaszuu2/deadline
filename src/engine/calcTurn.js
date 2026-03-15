import { clamp, TOX_DMG } from '../data/constants.js';
import { rnd100, fmt1, getUnlockedTier, setUnlockedTier } from './utils.js';
import { wbEff } from './deck.js';

// ═══════════════════════════════════════════════════════
//  PASSIVE SYSTEM
// ═══════════════════════════════════════════════════════
export function getEffectiveFx(card, passives) {
  if (!passives || !passives.length) return card.fx;
  const fx = {...card.fx};
  for (const p of passives) {
    switch (p.passiveType) {
      case 'WB_COST_FLAT':
        if (fx.wb < 0) fx.wb = Math.min(0, fx.wb + p.passiveVal); break;
      case 'PRODUCTION_CHIPS':
        if (card.archetype === 'PRODUCTION') fx.chips = (fx.chips || 0) + p.passiveVal; break;
      case 'STRATEGY_MULT':
        if (card.archetype === 'STRATEGY') fx.mult = (fx.mult || 0) + p.passiveVal; break;
      case 'RECOVERY_BOOST':
        if (card.archetype === 'RECOVERY') {
          if (fx.wb > 0) fx.wb = Math.round(fx.wb * p.passiveVal);
          if (fx.tox < 0) fx.tox = Math.round(fx.tox * p.passiveVal);
        } break;
      case 'CRUNCH_WB_HALVE':
        if (card.archetype === 'CRUNCH' && fx.wb < 0)
          fx.wb = Math.round(fx.wb * p.passiveVal); break;
      case 'COMP_PROD_CHIPS_PCT':
        if (card.archetype === 'PRODUCTION' && fx.chips > 0)
          fx.chips = Math.round(fx.chips * (1 + p.passiveVal)); break;
      case 'COMP_RECOVERY_CHIPS':
        if (card.archetype === 'RECOVERY') fx.chips = (fx.chips || 0) + p.passiveVal; break;
      case 'COMP_STRATEGY_BOOST':
        if (card.archetype === 'STRATEGY') {
          if (fx.chips > 0) fx.chips = Math.round(fx.chips * p.passiveVal);
          if (fx.mult > 0) fx.mult = fmt1(fx.mult * p.passiveVal);
          if (fx.wb > 0) fx.wb = Math.round(fx.wb * p.passiveVal);
        } break;
    }
  }
  return fx;
}

// ═══════════════════════════════════════════════════════
//  SYNERGY ENGINE
// ═══════════════════════════════════════════════════════
export const condEval = {
  ALWAYS: () => true,
  ARCH_COUNT: ({arch, min}, log) => log.filter(r => r.arch === arch).length >= min,
  CARD_COUNT: ({id, min}, log) => log.filter(r => r.id === id).length >= min,
  STATE_ABOVE: ({stat, thresh}, _l, sn) => (sn[stat] || 0) > thresh,
  STATE_BELOW: ({stat, thresh}, _l, sn) => (sn[stat] || 0) < thresh,
  POSITION: ({pos}, log) => log.length === pos,
  PLAYS_REMAINING: ({n}, _l, sn) => sn.plays !== undefined && sn.plays <= n,
};

export function evalSyn(syn, acc, log, snap, gs) {
  const ok = syn.conds.every(c => {
    const fn = condEval[c.type];
    return fn ? fn(c.p, log, snap) : false;
  });
  if (!ok) return false;
  const {type, p} = syn.eff;
  if (type === 'ADD_CHIPS')    acc.chips += p.v;
  if (type === 'ADD_MULT')     acc.mult += p.v;
  if (type === 'MULT_PER_ARCH') {
    const cnt = Math.min(log.filter(r => r.arch === p.arch).length, p.cap);
    acc.mult += cnt * p.per;
  }
  if (type === 'MOD_WB')   gs.wb  = clamp(gs.wb  + p.v, 0, 100);
  if (type === 'MOD_TOX')  gs.tox = clamp(gs.tox + p.v, 0, 100);
  if (type === 'MOD_BO')   gs.bo  = clamp((gs.bo  || 0) + p.v, 0, 100);
  if (type === 'LEGACY_MULT')         acc.mult  += (snap.week || 1) * p.per;
  if (type === 'LEGACY_CHIPS')        acc.chips += (snap.week || 1) * p.per;
  if (type === 'MULT_PER_UNIQUE_ARCH') {
    const unique = new Set(log.map(r => r.arch)).size;
    acc.mult += unique * p.per;
  }
  if (type === 'MULT_PER_STAT') acc.mult += Math.floor((snap[p.stat] || 0) / p.div) * p.per;
  if (type === 'SCALE_CHIPS') { if (acc.scaleLog) acc.scaleLog.push(`CHIPS ×${p.v}`); acc.chips = Math.round(acc.chips * p.v); }
  if (type === 'SCALE_MULT')  { if (acc.scaleLog) acc.scaleLog.push(`MULT ×${p.v}`);  acc.mult  = Number(fmt1(acc.mult * p.v)); }
  return true;
}

export function getRiskLevel(wb, tox, bo) {
  if (bo >= 80 || wb <= 5)           return 'LETHAL';
  if (tox > 65 || wb <= 15 || bo >= 60) return 'RISKY';
  if (tox > 50 || wb <= 30)         return 'CAUTION';
  return 'SAFE';
}

// ═══════════════════════════════════════════════════════
//  TURN ENGINE
// ═══════════════════════════════════════════════════════
export function calcTurn(cards, ctx) {
  const {
    passives = [], competencies = [], teammate = null,
    discardComboMult = 0, discardMultStack = 0, permMult = 0,
    brief = null, unlockedNodes = new Set(), stratWeekStack = 0,
    mode = 'preview',
    ctxMods = {},
  } = ctx;
  const tree = id => unlockedNodes.has(id);

  const hasComp = id => competencies.includes(id);
  const log = [];
  const lg = (cls, t, hidden = false) => {
    if (mode === 'real') log.push(hidden ? {cls, t, hidden: true} : {cls, t});
  };

  let wb = ctx.wb, tox = ctx.tox, bo = ctx.bo;
  let firstCardThisWeek = ctx.firstCardThisWeek !== undefined ? ctx.firstCardThisWeek : true;
  let firstCrunchUsed   = ctx.firstCrunchUsed  || false;
  let weekCrunchCount   = ctx.weekCrunchCount   || 0;
  const newExhausted = new Set();

  const acc = {chips: 0, mult: 1.0, scaleLog: []};
  const playLog = [], activeSynergies = new Set(), toxLevels = [];
  let toxGained = 0, gameOver = false, prodChips = 0;

  if (mode === 'real') log.push({cls:'d', t:`── Play: ${cards.map(c => c.name).join(', ')} ──`});

  // ── Pre-play bonuses ──────────────────────────────────
  if (hasComp('comp_toxsponge')) {
    const tb = Math.floor(tox / 20) * 0.5;
    if (tb > 0) { acc.mult += tb; lg('sy', `  ⚙ [Toxicity Sponge] Tox ${tox}% → +${fmt1(tb)} Mult`); }
  }
  if (discardComboMult > 0) {
    acc.mult += discardComboMult;
    lg('sy', `  ♻ [Batch Discard] Consuming +${fmt1(discardComboMult)}× stacked Mult`);
  }
  if (hasComp('comp_riskmitigator') && discardMultStack > 0) {
    acc.mult += fmt1(discardMultStack);
    lg('sy', `  ⚙ [Risk Mitigator] Consuming ${fmt1(discardMultStack)}× stacked Mult`);
  }
  if (hasComp('comp_laserfocus') && firstCardThisWeek) {
    acc.mult += 1.0; firstCardThisWeek = false;
    lg('sy', `  ⚙ [Laser Focus] First play of the week — +1.0 Mult`);
  }
  if (permMult > 0) {
    acc.mult += permMult;
    lg('sy', `  ★ [Boss Bonus] +${fmt1(permMult)}× Permanent Mult`);
  }
  // Context flat bonuses
  if (ctxMods.extraMult)  { acc.mult  += ctxMods.extraMult;  lg('sy', `  📋 [Context] +${fmt1(ctxMods.extraMult)}× Mult`); }
  if (ctxMods.extraChips) { acc.chips += ctxMods.extraChips; lg('ch', `  📋 [Context] +${ctxMods.extraChips} Chips`); }
  // s_cap: permanent Mult counted TWICE
  if (tree('s_cap') && permMult > 0) {
    acc.mult += permMult;
    lg('sy', `  🌿 [LEVERAGE] Permanent Mult doubled: +${fmt1(permMult)}× extra`);
  }
  // s_stack: cumulative STRATEGY-plays-this-week bonus
  if (stratWeekStack > 0) {
    const stackBonus = fmt1(stratWeekStack * 0.1);
    acc.mult += Number(stackBonus);
    lg('sy', `  🌿 [MOMENTUM BUILD] ${stratWeekStack} STRATEGY this week +${stackBonus}× Mult`);
  }
  // r_glow: WB ≥ 80% at turn start → +0.2 Mult
  if (tree('r_glow') && wb >= 80) {
    acc.mult += 0.2;
    lg('sy', `  🌿 [PEAK PERFORMANCE] WB ${wb}% ≥ 80% — +0.2 Mult`);
  }
  // c_cap: every 10% TOX above 30% → +0.15 Mult
  if (tree('c_cap') && tox > 30) {
    const cCapBonus = fmt1(Math.floor((tox - 30) / 10) * 0.15);
    if (cCapBonus > 0) { acc.mult += Number(cCapBonus); lg('sy', `  🌿 [PRESSURE COOKER] Tox ${tox}% — +${cCapBonus}× Mult`); }
  }

  // TOX_TO_CHIPS passive: +passiveVal Chips per 10% Tox above 30%
  for (const p of passives) {
    if (p.passiveType === 'TOX_TO_CHIPS' && tox > 30) {
      const toxBonus = Math.floor((tox - 30) / 10) * p.passiveVal;
      if (toxBonus > 0) { acc.chips += toxBonus; lg('ch', `  ★ [${p.name}] Tox ${tox}% — +${toxBonus} Chips`); }
    }
  }

  // ── Teammate pre-play bonuses ─────────────────────────
  const tmTier = tox >= 81 ? 3 : tox >= 31 ? 2 : 1;
  if (teammate === 'gary') {
    if (tmTier === 2) {
      const tb = Math.floor(tox / 20) * 0.5;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T2] Tox ${tox}% → +${fmt1(tb)} Mult`); }
    } else if (tmTier === 3) {
      const tb = Math.floor(tox / 10) * 1.0;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T3 — Meltdown] Tox ${tox}% → +${fmt1(tb)} Mult (max +10!)`); }
      bo = clamp(bo + 5, 0, 100);
      lg('bo', `  🗣️ [Gary T3 — Meltdown] Pushing hard — +5 Burnout → ${bo}%`);
    }
  }
  if (teammate === 'sarah') {
    if (tmTier === 1) { wb = clamp(wb + 2, 0, 100); lg('wg', `  👻 [Sarah T1 — Present!] Wellness check — +2 WB → ${wb}%`); }
    else if (tmTier === 3) { acc.mult += 0.8; lg('mu', `  👻 [Sarah T3 — Gone] Lean team bonus — +0.8 Mult`); }
  }
  if (teammate === 'alex') {
    const alexChips = tmTier === 1 ? 40 : tmTier === 3 ? 250 : 100;
    const ab = cards.length * alexChips;
    acc.chips += ab;
    lg('ch', `  🦈 [Alex T${tmTier}] +${ab} Chips (${cards.length} card${cards.length > 1 ? 's' : ''} × ${alexChips})`);
  }
  // Loyalty bonus: consecutive weeks with same teammate
  const loyalty = ctx.consecutiveSameTeammate || 0;
  if (loyalty >= 3) {
    const loyaltyMult = loyalty >= 7 ? 0.6 : loyalty >= 5 ? 0.4 : 0.2;
    acc.mult += loyaltyMult;
    const label = loyalty >= 7 ? 'Unbreakable Bond' : loyalty >= 5 ? 'Deep Partnership' : 'Trusted Ally';
    lg('sy', `  🤝 [${label} — ${loyalty} wks] Workplace bond — +${loyaltyMult} Mult`);
  }

  // ── Toxicity tier (based on starting tox) ────────────
  const toxTier = tox >= 91 ? 4 : tox >= 61 ? 3 : tox >= 31 ? 2 : 1;
  if (toxTier === 4) { acc.mult *= 2; lg('sy', `  ☣ [Meltdown Zone] All Mult ×2 → ${fmt1(acc.mult)}×`); }

  // ── Card loop ─────────────────────────────────────────
  for (const card of cards) {
    const snap = {wb, tox, bo, week: ctx.week, plays: ctx.plays};
    const rec  = {id: card.id, arch: card.archetype, uid: card.uid, snap};
    const fx   = {...getEffectiveFx(card, passives)};

    // Charming Networker: first CRUNCH free
    const isCrunchFree = card.archetype === 'CRUNCH' && hasComp('comp_networker') && !firstCrunchUsed;
    if (isCrunchFree) {
      firstCrunchUsed = true;
      if (fx.tox > 0) fx.tox = 0;
      if (fx.wb < 0)  fx.wb  = 0;
      lg('sy', `  ⚙ [Charming Networker] First CRUNCH this week — Tox & WB cost waived!`);
    }

    // Brief modifiers applied to fx before scoring
    if (brief === 'cost_reduction' && card.archetype === 'CRUNCH' && !isCrunchFree) {
      if (fx.chips > 0) { fx.chips = Math.round(fx.chips * 1.4); }
      if (fx.wb < 0) fx.wb = Math.round(fx.wb * 2);
    }
    if (brief === 'hyper_growth' && card.archetype === 'PRODUCTION' && fx.chips > 0) {
      fx.chips = Math.round(fx.chips * 1.5);
    }

    // ── Passive Tree per-card modifiers ──
    // p_chips: +150 Chips to every PRODUCTION card
    if (tree('p_chips') && card.archetype === 'PRODUCTION') {
      fx.chips = (fx.chips || 0) + 150;
    }
    // c_chips: CRUNCH cards +50% Chips
    if (tree('c_chips') && card.archetype === 'CRUNCH' && fx.chips > 0) {
      fx.chips = Math.round(fx.chips * 1.5);
    }
    // r_heal: RECOVERY cards heal +60% more WB
    if (tree('r_heal') && card.archetype === 'RECOVERY' && fx.wb > 0) {
      fx.wb = Math.round(fx.wb * 1.6);
    }
    // r_tox: RECOVERY playing → extra -6% TOX reduction
    if (tree('r_tox') && card.archetype === 'RECOVERY' && fx.tox < 0) {
      fx.tox = fx.tox - 6;
    }
    // r_shield: WB damage (wb cost) reduced by 30%
    if (tree('r_shield') && fx.wb < 0) {
      fx.wb = Math.round(fx.wb * 0.7);
    }
    // h_pr: RECOVERY + PRODUCTION in same play → WB heal doubled
    if (tree('h_pr') && card.archetype === 'RECOVERY' && fx.wb > 0) {
      const hasProd = cards.some(c => c.archetype === 'PRODUCTION');
      if (hasProd) fx.wb = Math.round(fx.wb * 2);
    }
    // h_rc: WB < 50% → CRUNCH cards +500 Chips
    if (tree('h_rc') && card.archetype === 'CRUNCH' && wb < 50) {
      fx.chips = (fx.chips || 0) + 500;
    }
    // c_clean: CRUNCH + PRODUCTION in same play → CRUNCH no TOX
    if (tree('c_clean') && card.archetype === 'CRUNCH' && !isCrunchFree) {
      const hasProd = cards.some(c => c.archetype === 'PRODUCTION');
      if (hasProd && fx.tox > 0) { fx.tox = 0; lg('tl', `  🌿 [CALCULATED RISK] CRUNCH+PROD — TOX waived`, true); }
    }
    // c_rage: TOX > 50% → CRUNCH Mult contribution doubled
    if (tree('c_rage') && card.archetype === 'CRUNCH' && tox > 50 && fx.mult > 0) {
      fx.mult = fmt1(fx.mult * 2);
      lg('mu', `  🌿 [TOXIC FUEL] Tox ${tox}% — CRUNCH Mult ×2: ${fx.mult}`, true);
    }
    // s_first: first STRATEGY card in turn — its Mult contribution doubled
    if (tree('s_first') && card.archetype === 'STRATEGY' && playLog.filter(r => r.arch === 'STRATEGY').length === 0 && fx.mult > 0) {
      fx.mult = fmt1(fx.mult * 2);
      lg('mu', `  🌿 [FIRST MOVER] First STRATEGY — Mult ×2: ${fx.mult}`, true);
    }
    // h_sc: STRATEGY when TOX > 40% → +0.8 Mult per STRATEGY card
    if (tree('h_sc') && card.archetype === 'STRATEGY' && tox > 40) {
      acc.mult += 0.8;
      lg('mu', `  🌿 [CHAOS STRATEGY] Tox ${tox}% — +0.8 Mult`, true);
    }

    // Context archetype modifiers
    if (ctxMods.stratChipsMult && card.archetype === 'STRATEGY'  && fx.chips > 0) fx.chips = Math.round(fx.chips * ctxMods.stratChipsMult);
    if (ctxMods.prodChipsMult  && card.archetype === 'PRODUCTION' && fx.chips > 0) fx.chips = Math.round(fx.chips * ctxMods.prodChipsMult);
    if (ctxMods.crunchChipsMult && card.archetype === 'CRUNCH'   && fx.chips > 0) fx.chips = Math.round(fx.chips * ctxMods.crunchChipsMult);
    if (ctxMods.stratMultMult  && card.archetype === 'STRATEGY'  && fx.mult  > 0) fx.mult  = fmt1(fx.mult  * ctxMods.stratMultMult);
    if (ctxMods.stratExtraMult && card.archetype === 'STRATEGY')                   fx.mult  = fmt1((fx.mult || 0) + ctxMods.stratExtraMult);

    if (fx.chips) { acc.chips += fx.chips; lg('ch', `  [${card.name}] +${fx.chips} Chips`, true); }
    if (fx.chips && card.archetype === 'PRODUCTION') prodChips += fx.chips;
    if (fx.mult)  { acc.mult  += fx.mult;  lg('mu', `  [${card.name}] +${fx.mult.toFixed(2)} Mult`, true); }
    // Context per-card mult
    if (ctxMods.perCardMult) { acc.mult += ctxMods.perCardMult; }

    // Gary T1: +25 chips per card
    if (teammate === 'gary' && tmTier === 1) {
      acc.chips += 25;
      lg('ch', `  🗣️ [Gary T1 — Helpful] Pre-read the brief — +25 Chips`, true);
    }
    // CHIPS_PER_PLAY passive: +passiveVal Chips per card played
    for (const p of passives) {
      if (p.passiveType === 'CHIPS_PER_PLAY') {
        acc.chips += p.passiveVal;
        lg('ch', `  ★ [${p.name}] +${p.passiveVal} Chips`, true);
      }
    }

    // Ben: tier-aware STRATEGY effect
    if (card.archetype === 'STRATEGY' && teammate === 'ben') {
      if (tmTier === 1) {
        tox = clamp(tox - 3, 0, 100);
        lg('tl', `  🙋 [Ben T1 — Advocate] Team appreciated the strategy — -3% Tox → ${tox}%`);
      } else if (tmTier === 2) {
        tox = clamp(tox + 6, 0, 100);
        lg('tg', `  🙋 [Ben T2 — Yes-Man] Colleagues noticed the favouritism — +6% Tox → ${tox}%`);
      } else {
        tox = clamp(tox + 15, 0, 100); bo = clamp(bo + 5, 0, 100);
        lg('tg', `  🙋 [Ben T3 — Over-Promised] Board pressure — +15% Tox → ${tox}%`);
        lg('bo', `  🙋 [Ben T3] Overcommitted everywhere — +5 Burnout → ${bo}%`);
      }
    }

    // Marcus: PRODUCTION chips / STRATEGY tox
    if (teammate === 'marcus') {
      if (card.archetype === 'PRODUCTION') {
        const mc = tmTier === 3 ? 200 : 100;
        acc.chips += mc;
        lg('ch', `  📋 [Marcus T${tmTier}] Deliverable approved — +${mc} Chips`, true);
        if (tmTier === 1) { wb = clamp(wb + 5, 0, 100); lg('wg', `  📋 [Marcus T1] Good work noted — +5 WB → ${wb}%`, true); }
        if (tmTier === 3) { bo = clamp(bo + 3, 0, 100); lg('bo', `  📋 [Marcus T3] Running you ragged — +3 Burnout → ${bo}%`, true); }
      }
      if (card.archetype === 'STRATEGY' && tmTier >= 2) {
        const mt = tmTier === 3 ? 15 : 8;
        tox = clamp(tox + mt, 0, 100);
        lg('tg', `  📋 [Marcus T${tmTier}] "Why are we planning?!" — +${mt}% Tox → ${tox}%`, true);
      }
    }
    // Priya: STRATEGY mult / RECOVERY modifier
    if (teammate === 'priya') {
      if (card.archetype === 'STRATEGY') {
        const pm = tmTier === 1 ? 0.2 : tmTier === 3 ? 0.6 : 0.4;
        acc.mult += pm;
        lg('mu', `  📊 [Priya T${tmTier}] Strategic insight — +${pm.toFixed(1)} Mult`, true);
      }
    }

    // Tox cap: max +40 per turn (Balance Guard #1)
    if (fx.tox > 0 && !isCrunchFree) {
      const cap = Math.max(0, 40 - toxGained);
      const atox = Math.min(fx.tox, cap);
      tox = clamp(tox + atox, 0, 100); toxGained += atox;
      if (atox < fx.tox) lg('tl', `  [${card.name}] +${atox}% Tox (${fx.tox - atox}% absorbed by cap) → ${tox}%`, true);
      else               lg('tg', `  [${card.name}] +${atox}% Toxicity → ${tox}%`, true);
    }
    if (fx.wb < 0 && !isCrunchFree) { wb = clamp(wb + fx.wb, 0, 100); lg('wl', `  [${card.name}] ${fx.wb} Wellbeing → ${wb}%`, true); }
    if (fx.tox < 0)                  { tox = clamp(tox + fx.tox, 0, 100); lg('tl', `  [${card.name}] ${fx.tox}% Toxicity → ${tox}%`, true); }
    if (fx.tox < 0 && teammate === 'priya' && tmTier === 1 && card.archetype === 'RECOVERY') {
      tox = clamp(tox - 10, 0, 100);
      lg('tl', `  📊 [Priya T1] Data-optimised recovery — -10 bonus Tox → ${tox}%`, true);
    }
    if (fx.wb > 0)                   { wb = clamp(wb + fx.wb, 0, 100); lg('wg', `  [${card.name}] +${fx.wb} Wellbeing → ${wb}%`, true); }
    // Priya RECOVERY WB modifier
    if (teammate === 'priya' && card.archetype === 'RECOVERY' && fx.wb > 0) {
      if (tmTier === 2) {
        const bonus = Math.floor(fx.wb * 0.5);
        wb = clamp(wb + bonus, 0, 100);
        lg('wg', `  📊 [Priya T2] Recovery plan optimised — +${bonus} bonus WB → ${wb}%`, true);
      } else if (tmTier === 3) {
        const loss = Math.floor(fx.wb * 0.5);
        wb = clamp(wb - loss, 0, 100);
        lg('wl', `  📊 [Priya T3 — Paralysis] Too busy modelling — -${loss} WB → ${wb}%`, true);
      }
    }
    if (!fx.chips && !fx.mult && !fx.tox && !fx.wb) lg('i', `  [${card.name}] played`, true);

    // Toxicity Tier 2: Passive-Aggressive
    if (toxTier === 2) {
      wb = clamp(wb - 1, 0, 100); lg('wl', `  [Passive-Aggressive] -1 WB → ${wb}%`, true);
      if (card.archetype === 'STRATEGY') { acc.mult += 0.2; lg('mu', `  [Passive-Aggressive] STRATEGY: +0.2 Mult`, true); }
    }

    // Crunch Fatigue: 2nd+ CRUNCH costs extra Tox
    if (card.archetype === 'CRUNCH') {
      if (weekCrunchCount > 0) {
        const fatigueTox = weekCrunchCount * 12;
        tox = clamp(tox + fatigueTox, 0, 100);
        lg('tg', `  ⚠ [Crunch Fatigue] ${weekCrunchCount}× overload this week — +${fatigueTox}% Tox → ${tox}%`);
      }
      weekCrunchCount++;
    }

    // ON_PLAY synergies
    for (const syn of card.synergies.filter(s => s.trigger === 'ON_PLAY')) {
      const gs = {wb, tox, bo};
      if (evalSyn(syn, acc, playLog, snap, gs)) {
        activeSynergies.add(syn.id); wb = gs.wb; tox = gs.tox; bo = gs.bo;
        lg('sy', `  ★ SYNERGY [${syn.desc}]`);
      }
    }

    // Meltdown auto-exhaust (real mode only)
    if (toxTier === 4 && mode === 'real' && rnd100() < 20) {
      newExhausted.add(card.uid);
      lg('ng', `  ☣ [Meltdown] ${card.name} wypalona (auto-exhaust)`);
    }

    // Toxic Atmosphere damage (deterministic: tier-based drain per card played)
    if (tox > 35) {
      let drain = tox >= 90 ? 4 : tox >= 70 ? 2 : 1;
      // r_shield: atmospheric drain reduced 30% | c_resist: reduced 40%
      if (tree('r_shield')) drain = Math.max(0, Math.round(drain * 0.7));
      if (tree('c_resist')) drain = Math.max(0, Math.round(drain * 0.6));
      wb = clamp(wb - drain, 0, 100);
      lg('dm', `  ☣ Toxic Atmosphere (${tox}%) −${drain} WB → ${wb}%`);
      if (wb === 0) {
        bo = clamp(bo + drain, 0, 100);
        lg('bo', `  🔥 OVERFLOW → +${drain} Burnout → ${bo}%`);
        if (mode === 'real' && bo >= 100) { gameOver = true; lg('dm', `  !! BURNOUT 100% — GAME OVER !!`); }
      }
      toxLevels.push(tox);
    }

    // r_cap: WB cannot drop below 20%
    if (tree('r_cap') && wb < 20) {
      wb = 20;
      lg('wg', `  🌿 [BURNOUT IMMUNITY] WB floor 20% enforced`, true);
    }
    playLog.push(rec);
    if (gameOver) break;
  }

  // ── Post-loop ─────────────────────────────────────────
  if (!gameOver) {
    // ON_SCORE synergies
    for (const card of cards) {
      const rec = playLog.find(r => r.uid === card.uid); if (!rec) continue;
      for (const syn of card.synergies.filter(s => s.trigger === 'ON_SCORE')) {
        const gs = {wb, tox, bo};
        if (evalSyn(syn, acc, playLog, rec.snap, gs)) {
          activeSynergies.add(syn.id);
          lg('sy', `  ★ SYNERGY [${syn.desc}]`);
        }
      }
    }

    // Balanced Employee: triple arch → tox reset
    if (hasComp('comp_balanced')) {
      const archs = new Set(cards.map(c => c.archetype));
      if (archs.has('PRODUCTION') && archs.has('STRATEGY') && archs.has('CRUNCH')) {
        tox = 0; lg('tl', `  ⚙ [Balanced Employee] All three archetypes played — Toxicity reset to 0!`);
      }
    }

    // Archetype Combo Bonuses → ComboMult (multiplicative)
    const archCounts = {};
    for (const c of cards) archCounts[c.archetype] = (archCounts[c.archetype] || 0) + 1;
    let comboMult = 1.0;
    for (const [arch, cnt] of Object.entries(archCounts)) {
      if (cnt >= 3) {
        if (arch === 'PRODUCTION') { comboMult *= 1.3; lg('sy', `  🔵 [FULL SPRINT] Triple PRODUCTION! ×1.3 ComboMult`); }
        else if (arch === 'STRATEGY') { comboMult *= 1.2; lg('sy', `  🔴 [ALIGNED VISION] Triple STRATEGY! ×1.2 ComboMult`); }
        else if (arch === 'CRUNCH')   { comboMult *= 1.4; lg('sy', `  🔥 [MANIC SPRINT] Triple CRUNCH! ×1.4 ComboMult`); }
        else if (arch === 'RECOVERY') {
          tox = clamp(tox - 30, 0, 100); wb = clamp(wb + 15, 0, 100); comboMult *= 1.2;
          lg('sy', `  💚 [DEEP RESET] Triple RECOVERY! -30% Tox | +15 WB | ×1.2 ComboMult`);
        }
      }
    }

    // ── Passive Tree post-loop effects ────────────────────
    const treeArchs = new Set(cards.map(c => c.archetype));
    const treeProdCards = cards.filter(c => c.archetype === 'PRODUCTION');
    const treeStratCards = cards.filter(c => c.archetype === 'STRATEGY');
    // p_chain: pure PRODUCTION turn → Chips ×1.25
    if (tree('p_chain') && treeProdCards.length > 0 && treeArchs.size === 1 && treeArchs.has('PRODUCTION')) {
      const bonus = Math.round(acc.chips * 0.25);
      acc.chips += bonus;
      lg('ch', `  🌿 [ASSEMBLY LINE] Pure PRODUCTION — +${bonus} Chips (×1.25)`);
    }
    // p_engine: each PRODUCTION card gives other PRODs +75 Chips
    if (tree('p_engine') && treeProdCards.length >= 2) {
      const n = treeProdCards.length;
      const engineBonus = n * (n - 1) * 75;
      acc.chips += engineBonus;
      lg('ch', `  🌿 [FLOW STATE] ${n} PRODUCTION cards — +${engineBonus} Chips`);
    }
    // s_flow: STRATEGY with no PRODUCTION → +0.6 extra Mult per STRATEGY
    if (tree('s_flow') && treeStratCards.length > 0 && !treeArchs.has('PRODUCTION')) {
      const flowBonus = fmt1(treeStratCards.length * 0.6);
      acc.mult += Number(flowBonus);
      lg('mu', `  🌿 [PURE EXECUTION] No PROD — +${flowBonus}× Mult`);
    }
    // h_ps: PRODUCTION + STRATEGY together → +2.0 Mult
    if (tree('h_ps') && treeArchs.has('PRODUCTION') && treeArchs.has('STRATEGY')) {
      acc.mult += 2.0;
      lg('mu', `  🌿 [SYNERGY SPRINT] PROD+STRAT — +2.0 Mult`);
    }

    // PRODUCTION Combo Scaling: +10% Chips per extra PRODUCTION card
    const prodCardCount = cards.filter(c => c.archetype === 'PRODUCTION').length;
    if (prodCardCount >= 2 && prodChips > 0) {
      const chainBonus = Math.round(prodChips * (prodCardCount - 1) * 0.05);
      acc.chips += chainBonus;
      lg('sy', `  🔵 [PRODUCTION CHAIN] ${prodCardCount} PROD cards — +${chainBonus} Combo Chips (+${(prodCardCount-1)*10}%)`);
    }

    // ── Context post-loop effects ─────────────────────
    if (ctxMods.archComboMult) {
      const types = new Set(cards.map(c => c.archetype)).size;
      if (types >= ctxMods.archComboMult.minTypes) {
        acc.mult += ctxMods.archComboMult.bonus;
        lg('sy', `  📋 [Context] ${types} archetypy → +${ctxMods.archComboMult.bonus} Mult`);
      }
    }
    if (ctxMods.sameArchBonus) {
      const cnts = {}; for (const c of cards) cnts[c.archetype] = (cnts[c.archetype]||0)+1;
      const maxSame = Math.max(...Object.values(cnts));
      if (maxSame >= ctxMods.sameArchBonus.min) {
        acc.mult += ctxMods.sameArchBonus.bonus;
        lg('sy', `  📋 [Context] ${maxSame}× sam archetype → +${ctxMods.sameArchBonus.bonus} Mult`);
      }
    }
    if (ctxMods.noStratMultPenalty && !cards.some(c => c.archetype === 'STRATEGY')) {
      acc.mult += ctxMods.noStratMultPenalty;
      lg('mu', `  📋 [Context] Brak STRATEGY — ${ctxMods.noStratMultPenalty} Mult`);
    }
    if (ctxMods.minCardsChipsBonus && cards.length >= ctxMods.minCardsChipsBonus.min) {
      acc.chips += ctxMods.minCardsChipsBonus.chips;
      lg('ch', `  📋 [Context] ${cards.length} karty → +${ctxMods.minCardsChipsBonus.chips} Chips`);
    }

    // Toxicity Tier Transition announcement (real only)
    if (mode === 'real') {
      const tierBefore = ctx.tox >= 91 ? 4 : ctx.tox >= 61 ? 3 : ctx.tox >= 31 ? 2 : 1;
      const tierAfter  = tox >= 91 ? 4 : tox >= 61 ? 3 : tox >= 31 ? 2 : 1;
      if (tierAfter > tierBefore) {
        const names = ['','','PASSIVE-AGGRESSIVE','TOXIC CULTURE','☣ MELTDOWN ZONE'];
        const effs  = ['','','+0.2 Mult/STRATEGY | −1 WB/card','−1 Discard next week','ALL MULT ×2 | 20% auto-exhaust'];
        log.push({cls:'tg', t:`  !! TIER UP → [${names[tierAfter]}] ${effs[tierAfter]}`});
      }
    }

    // WB penalty (Balance Guard #2)
    const eff = wbEff(Math.round(wb));
    if (eff.mult < 1.0) {
      const raw = acc.chips; acc.chips = Math.floor(acc.chips * eff.mult);
      lg('wl', `  ${eff.label} (${raw}→${acc.chips})`);
    }

    const baseScore = Math.floor(acc.chips * acc.mult);
    let score = comboMult > 1.0 ? Math.floor(baseScore * comboMult) : baseScore;
    if (ctxMods.scoreMult && ctxMods.scoreMult !== 1.0) {
      score = Math.floor(score * ctxMods.scoreMult);
      if (mode === 'real') log.push({cls:'sc', t:`  📋 [Context] Score ×${ctxMods.scoreMult} → ${score}`});
    }
    if (ctxMods.singleCardScoreMult && cards.length === 1) {
      score = Math.floor(score * ctxMods.singleCardScoreMult);
      if (mode === 'real') log.push({cls:'sc', t:`  📋 [Context] 1 karta → Score ×${ctxMods.singleCardScoreMult} → ${score}`});
    }
    if (mode === 'real') {
      const comboTag = comboMult > 1.0 ? ` × ${fmt1(comboMult)} COMBO` : '';
      log.push({cls:'sc', t:`  ▶ SCORE: ${acc.chips} × ${fmt1(acc.mult)}${comboTag} = ${score}`});
    }

    const finalWb = Math.round(wb), finalTox = Math.round(tox), finalBo = Math.round(bo);
    const expectedToxDmg = toxLevels.reduce((s, t) => s + Math.round(TOX_DMG * (t / 100)), 0);
    const maxToxDmg = toxLevels.length * TOX_DMG;
    const riskWb = clamp(finalWb - expectedToxDmg, 0, 100);
    return {
      score, baseScore, wb: finalWb, tox: finalTox, bo: finalBo, gameOver: false,
      comboMult, chips: acc.chips, mult: fmt1(acc.mult),
      scaleLog: acc.scaleLog,
      log, activeSynergies,
      firstCrunchUsed, weekCrunchCount, firstCardThisWeek, newExhausted,
      effLabel: eff.label,
      wbDelta: finalWb - ctx.wb, toxDelta: finalTox - ctx.tox, boDelta: finalBo - ctx.bo,
      finalWb, finalTox, finalBo,
      toxChecks: toxLevels.length, expectedToxDmg, maxToxDmg,
      riskLevel: getRiskLevel(riskWb, finalTox, finalBo),
    };
  }

  // Game Over path
  const finalWb = Math.round(wb), finalTox = Math.round(tox), finalBo = Math.round(bo);
  return {
    score: 0, wb: finalWb, tox: finalTox, bo: finalBo, gameOver: true,
    comboMult: 1.0, chips: 0, mult: 1.0,
    log, activeSynergies,
    firstCrunchUsed, weekCrunchCount, firstCardThisWeek, newExhausted,
    riskLevel: 'LETHAL',
  };
}

// ── simulateTurn: thin preview wrapper around calcTurn ──
export function simulateTurn(cards, G) {
  if (!cards.length) return null;
  return calcTurn(cards, {
    wb: G.wb, tox: G.tox, bo: G.bo, week: G.week || 1, plays: G.plays,
    passives:           G.passives    || [],
    competencies:       G.competencies || [],
    teammate:               G.teammate,
    consecutiveSameTeammate: G.consecutiveSameTeammate || 0,
    discardComboMult:   G.discardComboMult  || 0,
    discardMultStack:   G.discardMultStack  || 0,
    firstCardThisWeek:  G.firstCardThisWeek !== undefined ? G.firstCardThisWeek : true,
    firstCrunchUsed:    G.firstCrunchUsed  || false,
    weekCrunchCount:    G.weekCrunchCount   || 0,
    permMult:           G.permMult || 0,
    brief:              G.brief || null,
    unlockedNodes:      G.unlockedNodes || new Set(),
    stratWeekStack:     G.stratWeekStack || 0,
    mode: 'preview',
  });
}
