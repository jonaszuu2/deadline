import { clamp, TOX_DMG } from '../data/constants.js';
import { rnd100, fmt1, getUnlockedTier, setUnlockedTier } from './utils.js';
import { wbEff } from './deck.js';
import { detectMeeting } from '../data/meetingTypes.js';
import { BRIEF_TEAMMATE_FRICTION } from '../data/content.js';

// ═══════════════════════════════════════════════════════
//  CARD FX — now desk-item based, no separate passive system
// ═══════════════════════════════════════════════════════
export function getEffectiveFx(card, _passives) {
  return card.fx;
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
  if (type === 'MOD_WB') {
    const before = gs.wb;
    const heal = p.v > 0 && before < 0 ? Math.min(p.v, -before) : p.v;
    gs.wb = clamp(before + heal, -100, 100);
  }
  if (type === 'MOD_TOX')  gs.tox = clamp(gs.tox + p.v, 0, 100);
  if (type === 'MOD_BO')   gs.wb  = clamp((gs.wb  || 0) - p.v, -100, 100);
  if (type === 'LEGACY_MULT')         acc.mult  += (snap.week || 1) * p.per;
  if (type === 'LEGACY_CHIPS')        acc.chips += (snap.week || 1) * p.per;
  if (type === 'MULT_PER_UNIQUE_ARCH') {
    const unique = new Set(log.map(r => r.arch)).size;
    acc.mult += unique * p.per;
  }
  if (type === 'MULT_PER_STAT') acc.mult += Math.floor((snap[p.stat] || 0) / p.div) * p.per;
  if (type === 'SCALE_CHIPS') { if (acc.scaleLog) acc.scaleLog.push(`OUTPUT ×${p.v}`); acc.chips = Math.round(acc.chips * p.v); }
  if (type === 'SCALE_MULT')  { if (acc.scaleLog) acc.scaleLog.push(`EFF ×${p.v}`);   acc.mult  = Number(fmt1(acc.mult * p.v)); }
  return true;
}

export function getRiskLevel(wb, tox) {
  if (wb <= -60 || (wb < 0 && tox > 60)) return 'LETHAL';
  if (wb < 0 || tox > 65 || wb <= 10)    return 'RISKY';
  if (tox > 50 || wb <= 30)              return 'CAUTION';
  return 'SAFE';
}

// ═══════════════════════════════════════════════════════
//  TURN ENGINE — PRIVATE HELPERS
//
//  All helpers share two mutable objects:
//    S   — game state snapshot (wb, tox, bo, etc.)
//    acc — play accumulator (chips, mult, scaleLog)
//  helpers = { lg, dlg, blg } — logging closures
//  desk(id) — returns true if desk item is active
// ═══════════════════════════════════════════════════════

// ── Phase 1: Pre-play bonuses ─────────────────────────
// permMult, brief pre, desk item pre, teammate pre, tox tier setup.
// Mutates acc and S. Returns { toxTier, tmTier, alignMult }.
function _prePlay(cards, ctx, S, acc, { lg, blg, dlg }, desk) {
  const { permMult = 0, brief = null, teammate = null, weekEffBonus = 0 } = ctx;

  if (permMult > 0) {
    acc.mult += permMult;
    lg('sy', `  ★ [Breakthrough] +${fmt1(permMult)}× Permanent Eff`);
  }

  const alignMult = (brief && teammate && BRIEF_TEAMMATE_FRICTION.has(`${brief}:${teammate}`)) ? 0.8 : 1.0;
  if (alignMult < 1.0) lg('ng', `  ⚡ [${teammate}/${brief}] Misaligned approach — teammate effectiveness −20%`);

  if (brief === 'restructure' && weekEffBonus > 0) {
    acc.mult += weekEffBonus;
    blg('sy', `  📉 [Restructure] Lean deck bonus — +${fmt1(weekEffBonus)} Eff`);
  }

  // Desk item pre-play
  if (desk('stress_ball') && S.wb < 40) {
    acc.mult += 1.0;
    dlg('mu', `  🔴 [Stress Ball] Hanging on — WB ${S.wb}% < 40%: +1.0 Eff`);
  }
  if (desk('action_figure') && S.wb < 50) {
    acc.mult += 0.8;
    dlg('mu', `  🧸 [Action Figure] Low WB motivation — +0.8 Eff`);
  }
  if (desk('coffee_mug') && S.firstCardThisWeek) {
    acc.chips += 150;
    dlg('ch', `  ☕ [Coffee Mug] First play this week — +150 Output`);
  }
  if (desk('consultants_notes')) {
    const stratCount = cards.filter(c => c.archetype === 'STRATEGY').length;
    if (stratCount > 0) {
      const bonus = stratCount * 0.2;
      acc.mult += bonus;
      dlg('sy', `  📝 [Consultant's Notes] ${stratCount} STRATEGY card${stratCount > 1 ? 's' : ''} — +${fmt1(bonus)} Eff`);
    }
  }
  if (desk('org_chart')) {
    const unique = new Set(cards.map(c => c.archetype)).size;
    if (unique > 0) {
      const orgBonus = unique * 0.2;
      acc.mult += orgBonus;
      dlg('mu', `  🗺️ [Org Chart] ${unique} unique archetype${unique > 1 ? 's' : ''} — +${fmt1(orgBonus)} Eff`);
    }
  }
  if (desk('cactus')) {
    const cactusPer = S.tox >= 90 ? 120 : S.tox >= 60 ? 50 : 0;
    if (cactusPer > 0) {
      const cactusBonus = cactusPer * cards.length;
      acc.chips += cactusBonus;
      dlg('ch', `  🌵 [Cactus] Tox ${S.tox}% — +${cactusPer}×${cards.length} = +${cactusBonus} Output`);
    }
  }

  // Teammate pre-play
  const tmTier = S.tox >= 81 ? 3 : S.tox >= 31 ? 2 : 1;
  if (teammate === 'gary') {
    if (tmTier === 2) {
      const tb = Math.floor(S.tox / 20) * 0.5;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T2] Tox ${S.tox}% → +${fmt1(tb)} Eff`); }
    } else if (tmTier === 3) {
      const tb = Math.floor(S.tox / 10) * 1.0;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T3 — Meltdown] Tox ${S.tox}% → +${fmt1(tb)} Eff (max +10!)`); }
      S.bo = clamp(S.bo + 5, 0, 100);
      lg('bo', `  🗣️ [Gary T3 — Meltdown] Pushing hard — +5 Burnout → ${S.bo}%`);
    }
  }
  if (teammate === 'sarah') {
    if (tmTier === 1) { const h2 = S.wb < 0 ? Math.min(2, -S.wb) : 2; S.wb = clamp(S.wb + h2, -100, 100); lg('wg', `  👻 [Sarah T1 — Present!] Wellness check — +${h2} WB → ${S.wb}%`); }
    else if (tmTier === 3) { acc.mult += 0.8; lg('mu', `  👻 [Sarah T3 — Gone] Lean team bonus — +0.8 Eff`); }
  }
  if (teammate === 'alex') {
    const alexChips = tmTier === 1 ? 75 : tmTier === 3 ? 450 : 200;
    const ab = cards.length * alexChips;
    acc.chips += ab;
    lg('ch', `  🦈 [Alex T${tmTier}] +${ab} Output (${cards.length} card${cards.length > 1 ? 's' : ''} × ${alexChips})`);
  }
  const loyalty = ctx.consecutiveSameTeammate || 0;
  if (loyalty >= 3) {
    const loyaltyMult = loyalty >= 7 ? 0.6 : loyalty >= 5 ? 0.4 : 0.2;
    acc.mult += loyaltyMult;
    const label = loyalty >= 7 ? 'Unbreakable Bond' : loyalty >= 5 ? 'Deep Partnership' : 'Trusted Ally';
    lg('sy', `  🤝 [${label} — ${loyalty} wks] Workplace bond — +${loyaltyMult} Eff`);
  }

  // Tox tier (fixed for entire play, based on starting tox)
  const toxTier = S.tox >= 81 ? 4 : S.tox >= 61 ? 3 : S.tox >= 31 ? 2 : 1;
  if (desk('hostile_environment') && S.tox > 30) {
    const toxBonus = Math.floor((S.tox - 30) / 10) * 100;
    if (toxBonus > 0) { acc.chips += toxBonus; dlg('ch', `  ⚗️ [Hostile Environment] Tox ${Math.round(S.tox)}% → +${toxBonus} Output`); }
  }

  return { toxTier, tmTier, alignMult };
}

// ── Phase 2: Per-card fx modification ────────────────
// Applies desk item and brief modifications to card fx values.
// Also has side effects on acc (wellness_program, sustainable_growth chips)
// and S (cost_reduction tox). Returns the modified fx object.
function _modifyCardFx(card, ctx, S, acc, { lg, blg, dlg }, desk, toxTier) {
  const fx = { ...card.fx };
  const { brief = null } = ctx;

  // Desk item per-card fx mods
  if (desk('calendar') && card.archetype === 'PRODUCTION')
    fx.chips = (fx.chips || 0) + (ctx.week || 1) * 2;
  if (desk('crunch_mode_poster') && card.archetype === 'CRUNCH') {
    if (fx.wb < 0) fx.wb = Math.round(fx.wb * 0.2);
    if (fx.chips)  fx.chips = Math.round(fx.chips * 1.5);
    if (fx.tox > 0) fx.tox = Math.round(fx.tox * 2);
  }
  if (desk('burnout_culture_trophy') && card.archetype === 'CRUNCH') {
    if (fx.tox > 0) fx.tox = 0;
    if (fx.wb < 0)  fx.wb  = 0;
    if (fx.chips)   fx.chips = Math.round(fx.chips * 2.5);
  }
  if (desk('mindfulness_app') && card.archetype === 'RECOVERY') {
    if (S.wb < 40) {
      if (fx.chips) fx.chips = fx.chips * 2;
      if (fx.wb > 0) fx.wb = fx.wb * 2;
    } else if (S.wb > 70) {
      fx.chips = 0;
    }
  }
  if (desk('wellness_program') && card.archetype === 'RECOVERY') {
    if (fx.tox < 0) fx.tox = 0;
    if (fx.wb > 0) {
      const wbonus = fx.wb * 25;
      acc.chips += wbonus;
      dlg('ch', `  💊 [Wellness Program] ${fx.wb}% WB healed → +${wbonus} Output`);
    }
  }
  if (desk('strategy_deck') && card.archetype === 'STRATEGY' && fx.mult)
    fx.mult = fx.mult * 2;

  // Converted passive desk item effects
  if (desk('ergonomic_chair') && fx.wb < 0)  fx.wb = Math.min(0, fx.wb + 2);
  if (desk('mechanical_keyboard') && card.archetype === 'PRODUCTION') fx.chips = (fx.chips||0) + 50;
  if (desk('water_cooler') && card.archetype === 'RECOVERY') {
    if (fx.wb > 0)  fx.wb  = Math.round(fx.wb  * 1.25);
    if (fx.tox < 0) fx.tox = Math.round(fx.tox * 1.25);
  }
  if (desk('agile_coach') && card.archetype === 'STRATEGY')
    fx.mult = (fx.mult||0) + 0.1;
  if (desk('crisis_mode') && card.archetype === 'CRUNCH' && fx.wb < 0)
    fx.wb = Math.round(fx.wb * 0.5);

  // Brief per-card effects
  if (brief === 'cost_reduction' && card.archetype === 'CRUNCH') {
    if (fx.chips)   fx.chips = Math.round(fx.chips * 1.6);
    if (fx.wb < 0)  fx.wb   = Math.round(fx.wb * 1.5);
    S.tox = clamp(S.tox + 3, 0, 100); S.toxGained += 3;
    blg('ch', `  ✂️ [Cost Reduction] CRUNCH: chips ×1.6, WB +50% dmg, +3% TOX → ${S.tox}%`);
  }
  if (brief === 'sustainable_growth' && card.archetype === 'RECOVERY') {
    if (fx.tox < 0) fx.tox = 0;
    if (fx.wb > 0) {
      const sgBonus = fx.wb * 15;
      acc.chips += sgBonus; S.briefProgressDelta += sgBonus;
      blg('ch', `  🌱 [Sustainable Growth] ${fx.wb}% WB healed → +${sgBonus} chips`);
    }
  }
  if (brief === 'hyper_growth' && card.archetype === 'PRODUCTION')
    if (fx.chips) fx.chips = Math.round(fx.chips * 1.5);

  // Tox Zone 2 (31-60%): CRUNCH gets +40% Output
  if (toxTier === 2 && card.archetype === 'CRUNCH' && fx.chips > 0) {
    fx.chips = Math.round(fx.chips * 1.4);
    lg('ch', `  🔥 [Hostile Office] CRUNCH +40% Output → ${fx.chips}`, true);
  }

  return fx;
}

// ── Phase 3: Per-card effects application ────────────
// Applies base fx to acc, then all per-card teammate effects,
// tox cap, wb/tox state changes, crunch fatigue.
// Mutates acc and S.
function _applyCardEffects(card, fx, ctx, S, acc, { lg, dlg }, desk, toxTier, tmTier, alignMult) {
  const { teammate = null } = ctx;

  // Base chips + mult
  if (fx.chips) { acc.chips += fx.chips; lg('ch', `  [${card.name}] +${fx.chips} Output`, true); }
  if (fx.chips && card.archetype === 'PRODUCTION') S.prodChips += fx.chips;
  if (fx.mult)  { acc.mult  += fx.mult;  lg('mu', `  [${card.name}] +${fx.mult.toFixed(2)} Eff`, true); }

  // Per-card teammate effects
  if (teammate === 'gary' && tmTier === 1) {
    acc.chips += Math.round(100 * alignMult);
    lg('ch', `  🗣️ [Gary T1 — Helpful] Pre-read the brief — +${Math.round(100 * alignMult)} Output`, true);
  }
  if (desk('performance_bonus')) {
    acc.chips += 75;
    dlg('ch', `  💰 [Performance Bonus] +75 Output`);
  }
  if (desk('red_bull_stash') && card.archetype === 'CRUNCH') {
    acc.mult += 0.4; S.bo = clamp(S.bo + 2, 0, 100);
    dlg('mu', `  🥤 [Red Bull Stash] CRUNCH +0.4 Eff → ${fmt1(acc.mult)}× (+2 BO → ${S.bo}%)`);
  }
  if (desk('burnout_culture_trophy') && card.archetype === 'CRUNCH') {
    S.bo = clamp(S.bo + 4, 0, 100);
    dlg('bo', `  🏅 [Burnout Culture Trophy] CRUNCH — +4 Burnout → ${S.bo}%`);
  }

  if (card.archetype === 'STRATEGY' && teammate === 'ben') {
    if (tmTier === 1) { S.tox = clamp(S.tox - 3, 0, 100); lg('tl', `  🙋 [Ben T1 — Advocate] Team appreciated the strategy — -3% Tox → ${S.tox}%`); }
    else if (tmTier === 2) { S.tox = clamp(S.tox + 6, 0, 100); lg('tg', `  🙋 [Ben T2 — Yes-Man] Colleagues noticed the favouritism — +6% Tox → ${S.tox}%`); }
    else {
      S.tox = clamp(S.tox + 15, 0, 100); S.bo = clamp(S.bo + 5, 0, 100);
      lg('tg', `  🙋 [Ben T3 — Over-Promised] Board pressure — +15% Tox → ${S.tox}%`);
      lg('bo', `  🙋 [Ben T3] Overcommitted everywhere — +5 Burnout → ${S.bo}%`);
    }
  }

  if (teammate === 'derek') {
    if (card.archetype === 'PRODUCTION') {
      const mc = Math.round((tmTier === 3 ? 300 : 150) * alignMult);
      acc.chips += mc;
      lg('ch', `  📋 [Derek T${tmTier}] Deliverable approved — +${mc} Output`, true);
      if (tmTier === 1) { const h5 = S.wb < 0 ? Math.min(5, -S.wb) : 5; S.wb = clamp(S.wb + h5, -100, 100); lg('wg', `  📋 [Derek T1] Good work noted — +${h5} WB → ${S.wb}%`, true); }
      if (tmTier === 3) { S.bo = clamp(S.bo + 3, 0, 100); lg('bo', `  📋 [Derek T3] Running you ragged — +3 Burnout → ${S.bo}%`, true); }
    }
    if (card.archetype === 'STRATEGY' && tmTier >= 2) {
      const mt = tmTier === 3 ? 15 : 8;
      S.tox = clamp(S.tox + mt, 0, 100);
      lg('tg', `  📋 [Derek T${tmTier}] "Why are we planning?!" — +${mt}% Tox → ${S.tox}%`, true);
    }
  }

  if (teammate === 'priya' && card.archetype === 'STRATEGY') {
    const pm = (tmTier === 1 ? 0.2 : tmTier === 3 ? 0.6 : 0.4) * alignMult;
    acc.mult += pm;
    lg('mu', `  📊 [Priya T${tmTier}] Strategic insight — +${pm.toFixed(2)} Eff`, true);
  }

  // Tox cap: max +40 per turn (Balance Guard #1)
  if (fx.tox > 0) {
    const cap  = Math.max(0, 40 - S.toxGained);
    const atox = Math.min(fx.tox, cap);
    S.tox = clamp(S.tox + atox, 0, 100); S.toxGained += atox;
    if (atox < fx.tox) lg('tl', `  [${card.name}] +${atox}% Tox (${fx.tox - atox}% absorbed by cap) → ${S.tox}%`, true);
    else               lg('tg', `  [${card.name}] +${atox}% Toxicity → ${S.tox}%`, true);
  }

  if (fx.wb < 0) { S.wb = clamp(S.wb + fx.wb, -100, 100); lg('wl', `  [${card.name}] ${fx.wb} Wellbeing → ${S.wb}%`, true); }
  if (fx.tox < 0) { S.tox = clamp(S.tox + fx.tox, 0, 100); lg('tl', `  [${card.name}] ${fx.tox}% Toxicity → ${S.tox}%`, true); }
  if (fx.tox < 0 && teammate === 'priya' && tmTier === 1 && card.archetype === 'RECOVERY') {
    S.tox = clamp(S.tox - 10, 0, 100);
    lg('tl', `  📊 [Priya T1] Data-optimised recovery — -10 bonus Tox → ${S.tox}%`, true);
  }
  if (fx.wb > 0) {
    const healAmt = S.wb < 0 ? Math.min(fx.wb, -S.wb) : fx.wb;
    S.wb = clamp(S.wb + healAmt, -100, 100);
    lg('wg', `  [${card.name}] +${healAmt} Wellbeing → ${S.wb}%`, true);
  }
  if (teammate === 'priya' && card.archetype === 'RECOVERY' && fx.wb > 0) {
    if (tmTier === 2) {
      const bonus = S.wb < 0 ? Math.min(Math.floor(fx.wb * 0.5), -S.wb) : Math.floor(fx.wb * 0.5);
      S.wb = clamp(S.wb + bonus, -100, 100);
      lg('wg', `  📊 [Priya T2] Recovery plan optimised — +${bonus} bonus WB → ${S.wb}%`, true);
    } else if (tmTier === 3) {
      const loss = Math.floor(fx.wb * 0.5);
      S.wb = clamp(S.wb - loss, -100, 100);
      lg('wl', `  📊 [Priya T3 — Paralysis] Too busy modelling — -${loss} WB → ${S.wb}%`, true);
    }
  }
  if (!fx.chips && !fx.mult && !fx.tox && !fx.wb) lg('i', `  [${card.name}] played`, true);

  // Crunch Fatigue: 2nd+ CRUNCH costs extra Tox
  if (card.archetype === 'CRUNCH') {
    if (S.weekCrunchCount > 0) {
      const fatigueTox = S.weekCrunchCount * 12;
      S.tox = clamp(S.tox + fatigueTox, 0, 100);
      lg('tg', `  ⚠ [Crunch Fatigue] ${S.weekCrunchCount}× overload this week — +${fatigueTox}% Tox → ${S.tox}%`);
    }
    S.weekCrunchCount++;
  }
}

// ── Phase 4: Post-loop resolution ────────────────────
// Brief post, desk post, ON_SCORE synergies, tox zone Eff mults,
// tox tier transition, meeting bonuses, WB penalty, score.
// Mutates acc and S. Returns { score, eff, detectedMeeting }.
function _postLoop(cards, ctx, S, acc, { lg, blg, dlg }, desk, playLog, toxLevels, activeSynergies) {
  const { mode = 'preview', brief = null, totalPlayCount = 0,
          lastMeetingType = null, deskItems = [] } = ctx;

  // Brief post-loop
  if (brief === 'hyper_growth') {
    const hasProd = cards.some(c => c.archetype === 'PRODUCTION');
    if (!hasProd && acc.chips > 0) {
      const before = acc.chips; acc.chips = Math.round(acc.chips * 0.8);
      blg('ng', `  📈 [Hyper-Growth] No PRODUCTION — chips −20%: ${before} → ${acc.chips}`);
    }
  }

  // Desk post-loop
  if (desk('rubber_duck') && cards.length === 1) {
    const before = acc.chips; acc.chips = Math.round(acc.chips * 2);
    dlg('ch', `  🦆 [Rubber Duck] Solo play — Output ×2: ${before} → ${acc.chips}`);
  }
  const prodCardCount = cards.filter(c => c.archetype === 'PRODUCTION').length;
  if (desk('assembly_line') && prodCardCount > 0) {
    if (prodCardCount >= 2) {
      const before = acc.chips; acc.chips = Math.round(acc.chips * 1.8);
      dlg('ch', `  🏭 [Assembly Line] ${prodCardCount} PRODUCTION — chips ×1.8: ${before} → ${acc.chips}`);
    } else {
      const before = acc.chips; acc.chips = Math.round(acc.chips * 0.7);
      dlg('ng', `  🏭 [Assembly Line] Solo PRODUCTION — chips ×0.7: ${before} → ${acc.chips}`);
    }
  }
  if (desk('overtime_log') && prodCardCount > 0) {
    if (cards.length === 1 && cards[0].archetype === 'PRODUCTION') {
      const before = acc.chips; acc.chips = Math.round(acc.chips * 4);
      dlg('ch', `  📒 [Overtime Log] Solo PRODUCTION — Output ×4: ${before} → ${acc.chips}`);
    } else if (cards.length > 1 && prodCardCount > 0 && S.prodChips > 0) {
      acc.chips = Math.max(0, acc.chips - S.prodChips);
      dlg('ng', `  📒 [Overtime Log] Mixed play — PRODUCTION chips negated (−${S.prodChips})`);
    }
  }

  // ON_SCORE synergies
  for (const card of cards) {
    const rec = playLog.find(r => r.uid === card.uid); if (!rec) continue;
    for (const syn of card.synergies.filter(s => s.trigger === 'ON_SCORE')) {
      const gs = { wb: S.wb, tox: S.tox };
      if (evalSyn(syn, acc, playLog, rec.snap, gs)) {
        activeSynergies.add(syn.id);
        lg('sy', `  ★ SYNERGY [${syn.desc}]`);
        // Note: gs.wb/gs.tox changes from ON_SCORE synergies are intentionally not applied
        // back to S (matches original behaviour — state changes only happen during card loop)
      }
    }
  }

  // Tox zone Eff multipliers (post-loop, based on end-of-loop tox)
  if (S.tox >= 81) {
    const before = acc.mult; acc.mult = Number(fmt1(acc.mult * 1.6));
    lg('mu', `  ☣ [Hazardous (${Math.round(S.tox)}%)] ALL Eff ×1.6: ${fmt1(before)} → ${fmt1(acc.mult)}`);
  } else if (S.tox >= 61) {
    const before = acc.mult; acc.mult = Number(fmt1(acc.mult * 1.3));
    lg('mu', `  ⚡ [Toxic Culture (${Math.round(S.tox)}%)] ALL Eff ×1.3: ${fmt1(before)} → ${fmt1(acc.mult)}`);
  }

  // Tox tier transition announcement (real mode only)
  if (mode === 'real') {
    const tierBefore = ctx.tox >= 81 ? 4 : ctx.tox >= 61 ? 3 : ctx.tox >= 31 ? 2 : 1;
    const tierAfter  = S.tox >= 81  ? 4 : S.tox >= 61  ? 3 : S.tox >= 31  ? 2 : 1;
    if (tierAfter > tierBefore) {
      const names = ['','','HOSTILE OFFICE','TOXIC CULTURE','☣ HAZARDOUS'];
      const effs  = ['','','CRUNCH +40% Output','Eff ×1.3 | −1 WB/card','Eff ×1.6 | −2 WB/card | −1 Discard'];
      lg('tg', `  !! TOX ZONE UP → [${names[tierAfter]}] ${effs[tierAfter]}`);
    }
  }

  // Meeting detection + bonuses
  const detectedMeeting = detectMeeting(cards, deskItems, { lastMeetingType });
  if (detectedMeeting) {
    if (detectedMeeting.secret) {
      lg('sy', `  ✨ SECRET MEETING: ${detectedMeeting.icon} ${detectedMeeting.name}`);
      if (detectedMeeting.id === 'agile_sprint') { const b = acc.chips; acc.chips = Math.round(acc.chips * 1.5); lg('ch', `  ⚡ [Agile Sprint] Consecutive Sprint Reviews — Output ×1.5: ${b} → ${acc.chips}`); }
      if (detectedMeeting.id === 'executive_brief') { acc.mult += 2.0; lg('mu', `  💼 [Executive Brief] Board Meeting after Strategy Session — +2.0 Eff`); }
      if (detectedMeeting.id === 'mental_health_day') { const b = acc.chips; acc.chips = Math.round(acc.chips * 3); lg('ch', `  🌿 [Mental Health Day] Solo RECOVERY — Output ×3: ${b} → ${acc.chips}`); }
      if (detectedMeeting.id === 'strategic_pivot') { acc.mult += 1.0; lg('mu', `  🔀 [Strategic Pivot] Cross-functional Sync with active carry — +1.0 Eff`); }
      // death_march handled post-score below
    } else {
      const b = detectedMeeting.bonus || {};
      if (b.chips)  { acc.chips += b.chips;  lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: +${b.chips} Output`); }
      if (b.mult)   { acc.mult  += b.mult;   lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: +${fmt1(b.mult)} Eff`); }
      if (b.chipsX) { const bef = acc.chips; acc.chips = Math.round(acc.chips * b.chipsX); lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: Output ×${b.chipsX} (${bef}→${acc.chips})`); }
      if (b.wb)     { const mwb = b.wb > 0 && S.wb < 0 ? Math.min(b.wb, -S.wb) : b.wb; S.wb = clamp(S.wb + mwb, -100, 100); lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: ${mwb > 0 ? '+' : ''}${mwb} WB → ${Math.round(S.wb)}%`); }
      if (b.tox)    { S.tox = clamp(S.tox + b.tox, 0, 100);
                      if (b.tox < 0) lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: ${b.tox}% Tox → ${Math.round(S.tox)}%`);
                      else           lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting politics: +${b.tox}% Tox → ${Math.round(S.tox)}%`); }
      if (!b.chips && !b.mult && !b.chipsX && !b.wb && !b.tox) lg('d', `  ${detectedMeeting.icon} ${detectedMeeting.name}`);
    }
  }

  // WB penalty (Balance Guard #2)
  const eff = wbEff(Math.round(S.wb));
  if (eff.mult < 1.0) { const raw = acc.chips; acc.chips = Math.floor(acc.chips * eff.mult); lg('wl', `  ${eff.label} (${raw}→${acc.chips})`); }

  // Score
  let score = Math.floor(acc.chips * acc.mult);
  if (detectedMeeting?.id === 'death_march') {
    const before = score; score = score * 2; S.bo = clamp(S.bo + 15, 0, 100);
    lg('sc', `  💀 [Death March] Limit break — Revenue ×2: ${before} → ${score} (+15 BO → ${S.bo}%)`);
  }
  if (desk('hourglass') && ctx.plays === 1) { const hb = score; score = Math.floor(score * 1.5); dlg('sc', `  ⏳ [Hourglass] Last play of week — Revenue ×1.5: ${hb} → ${score}`); }
  if (desk('golden_mug') && (totalPlayCount + 1) % 5 === 0) { const gb = score; score = score * 2; dlg('sc', `  🥇 [Golden Mug] Play #${totalPlayCount + 1} — every 5th play: Revenue ×2: ${gb} → ${score}`); }

  lg('sc', `  ▶ REVENUE: $${acc.chips.toLocaleString()} × ${fmt1(acc.mult)} = $${score.toLocaleString()}`);
  return { score, eff, detectedMeeting };
}

// ═══════════════════════════════════════════════════════
//  TURN ENGINE — PUBLIC
// ═══════════════════════════════════════════════════════
export function calcTurn(cards, ctx) {
  const {
    teammate = null,
    permMult = 0,
    mode = 'preview',
    deskItems = [],
    handSize = 0,
    totalPlayCount = 0,
    lastMeetingType = null,
    brief = null,
    weekEffBonus = 0,
  } = ctx;

  const desk = id => deskItems.some(it => it.id === id);

  // Logging setup — closures over shared arrays
  const log = [], deskActivations = [], briefActivations = [];
  const lg  = (cls, t, hidden = false) => {
    if (mode === 'real') log.push(hidden ? {cls, t, hidden: true} : {cls, t});
    else if (mode === 'preview') log.push({cls, t});
  };
  const dlg = (cls, t) => { log.push({cls, t}); deskActivations.push({cls, t}); };
  const blg = (cls, t) => { log.push({cls, t}); briefActivations.push({cls, t}); };
  const helpers = { lg, dlg, blg };

  // Mutable play state — all helpers read/write through this object
  const S = {
    wb: ctx.wb, tox: ctx.tox, bo: 0,
    toxGained: 0, gameOver: false,
    prodChips: 0, briefProgressDelta: 0,
    firstCardThisWeek: ctx.firstCardThisWeek !== undefined ? ctx.firstCardThisWeek : true,
    firstCrunchUsed:   ctx.firstCrunchUsed  || false,
    weekCrunchCount:   ctx.weekCrunchCount   || 0,
    newExhausted: new Set(),
  };

  const acc      = { chips: 0, mult: 1.0, scaleLog: [] };
  const playLog  = [], activeSynergies = new Set(), toxLevels = [];

  log.push({cls:'d', t:`── Play: ${cards.map(c => c.name).join(', ')} ──`});

  // ── Phase 1: Pre-play ─────────────────────────────────
  const { toxTier, tmTier, alignMult } = _prePlay(cards, ctx, S, acc, helpers, desk);

  // ── Phase 2 & 3: Card loop ────────────────────────────
  for (const card of cards) {
    const snap = { wb: S.wb, tox: S.tox, bo: S.bo, week: ctx.week, plays: ctx.plays };

    const fx = _modifyCardFx(card, ctx, S, acc, helpers, desk, toxTier);
    _applyCardEffects(card, fx, ctx, S, acc, helpers, desk, toxTier, tmTier, alignMult);

    // ON_PLAY synergies
    for (const syn of card.synergies.filter(s => s.trigger === 'ON_PLAY')) {
      const gs = { wb: S.wb, tox: S.tox };
      if (evalSyn(syn, acc, playLog, snap, gs)) {
        activeSynergies.add(syn.id); S.wb = gs.wb; S.tox = gs.tox;
        lg('sy', `  ★ SYNERGY [${syn.desc}]`);
      }
    }

    // Meltdown auto-exhaust (real mode only)
    if (toxTier === 4 && mode === 'real' && rnd100() < 20) {
      S.newExhausted.add(card.uid);
      lg('ng', `  ☣ [Meltdown] ${card.name} wypalona (auto-exhaust)`);
    }

    // Tox Zone 3 (61-80%): −1 WB/card  |  Zone 4 (81%+): −2 WB/card
    if (S.tox >= 61) {
      const drain = S.tox >= 81 ? 2 : 1;
      S.wb = clamp(S.wb - drain, -100, 100);
      lg('dm', `  ☣ Toxic Atmosphere (${S.tox}%) −${drain} WB → ${S.wb}%`, true);
      if (S.wb <= -100 && mode === 'real') { S.gameOver = true; lg('dm', `  !! BURNOUT — WB −100% — GAME OVER !!`); }
      toxLevels.push(S.tox);
    }

    // sick_day_policy: WB never drops below 0 from a single play
    if (desk('sick_day_policy') && S.wb < 0) {
      S.wb = 0;
      dlg('ok', `  🤒 [Sick Day Policy] WB floored at 20%`);
    }

    playLog.push({ id: card.id, arch: card.archetype, uid: card.uid, snap });
    if (S.gameOver) break;
  }

  // Game Over path
  if (S.gameOver) {
    return {
      score: 0, wb: Math.round(S.wb), tox: Math.round(S.tox), bo: Math.round(S.bo), gameOver: true,
      comboMult: 1.0, chips: 0, mult: 1.0,
      log, activeSynergies,
      firstCrunchUsed: S.firstCrunchUsed, weekCrunchCount: S.weekCrunchCount,
      firstCardThisWeek: S.firstCardThisWeek, newExhausted: S.newExhausted,
      riskLevel: 'LETHAL',
    };
  }

  // ── Phase 4: Post-loop ────────────────────────────────
  const { score, eff, detectedMeeting } = _postLoop(
    cards, ctx, S, acc, helpers, desk, playLog, toxLevels, activeSynergies
  );

  const finalWb  = Math.round(S.wb), finalTox = Math.round(S.tox), finalBo = Math.round(S.bo);
  const expectedToxDmg = toxLevels.reduce((s, t) => s + Math.round(TOX_DMG * (t / 100)), 0);
  const maxToxDmg = toxLevels.length * TOX_DMG;
  const riskWb    = clamp(finalWb - expectedToxDmg, 0, 100);

  return {
    score, baseScore: score, wb: finalWb, tox: finalTox, bo: finalBo, gameOver: false,
    comboMult: 1.0, chips: acc.chips, mult: fmt1(acc.mult),
    scaleLog: acc.scaleLog,
    log, activeSynergies, deskActivations, briefActivations,
    briefProgressDelta: S.briefProgressDelta,
    firstCrunchUsed: S.firstCrunchUsed, weekCrunchCount: S.weekCrunchCount,
    firstCardThisWeek: S.firstCardThisWeek, newExhausted: S.newExhausted,
    effLabel: eff.label,
    wbDelta: finalWb - ctx.wb, toxDelta: finalTox - ctx.tox, boDelta: 0,
    finalWb, finalTox, finalBo,
    toxChecks: toxLevels.length, expectedToxDmg, maxToxDmg,
    riskLevel: getRiskLevel(riskWb, finalTox),
    meetingType: detectedMeeting || null,
  };
}

// ── simulateTurn: thin preview wrapper around calcTurn ──
export function simulateTurn(cards, G) {
  if (!cards.length) return null;
  return calcTurn(cards, {
    wb: G.wb, tox: G.tox, week: G.week || 1, plays: G.plays,
    teammate:                G.teammate,
    consecutiveSameTeammate: G.consecutiveSameTeammate || 0,
    firstCardThisWeek:       G.firstCardThisWeek !== undefined ? G.firstCardThisWeek : true,
    firstCrunchUsed:         G.firstCrunchUsed || false,
    weekCrunchCount:         G.weekCrunchCount || 0,
    permMult:                G.permMult || 0,
    deskItems:               G.deskItems || [],
    handSize:                G.hand ? G.hand.length - cards.length : 0,
    totalPlayCount:          G.totalPlayCount || 0,
    lastMeetingType:         G.lastMeetingType || null,
    brief:                   G.brief || null,
    weekEffBonus:            G.weekEffBonus || 0,
    mode: 'preview',
  });
}
