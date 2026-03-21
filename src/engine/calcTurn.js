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
  if (type === 'SCALE_CHIPS') { if (acc.scaleLog) acc.scaleLog.push(`OUTPUT ×${p.v}`); acc.chips = Math.round(acc.chips * p.v); }
  if (type === 'SCALE_MULT')  { if (acc.scaleLog) acc.scaleLog.push(`EFF ×${p.v}`);   acc.mult  = Number(fmt1(acc.mult * p.v)); }
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
  const log = [];
  const deskActivations = [];
  const lg = (cls, t, hidden = false) => {
    if (mode === 'real') log.push(hidden ? {cls, t, hidden: true} : {cls, t});
    else if (mode === 'preview') log.push({cls, t});
  };
  // dlg = desk item log — appears in both main log AND activation strip
  const dlg = (cls, t) => {
    log.push({cls, t});
    deskActivations.push({cls, t});
  };
  // blg = brief log — appears in main log AND brief strip
  const briefActivations = [];
  const blg = (cls, t) => {
    log.push({cls, t});
    briefActivations.push({cls, t});
  };

  let wb = ctx.wb, tox = ctx.tox, bo = ctx.bo;
  let firstCardThisWeek = ctx.firstCardThisWeek !== undefined ? ctx.firstCardThisWeek : true;
  let firstCrunchUsed   = ctx.firstCrunchUsed  || false;
  let weekCrunchCount   = ctx.weekCrunchCount   || 0;
  const newExhausted = new Set();

  const acc = {chips: 0, mult: 1.0, scaleLog: []};
  const playLog = [], activeSynergies = new Set(), toxLevels = [];
  let toxGained = 0, gameOver = false, prodChips = 0, briefProgressDelta = 0;

  log.push({cls:'d', t:`── Play: ${cards.map(c => c.name).join(', ')} ──`});

  // ── Pre-play bonuses ──────────────────────────────────
  if (permMult > 0) {
    acc.mult += permMult;
    lg('sy', `  ★ [Breakthrough] +${fmt1(permMult)}× Permanent Eff`);
  }

  // ── Teammate alignment friction ──────────────────────
  const alignMult = (brief && teammate && BRIEF_TEAMMATE_FRICTION.has(`${brief}:${teammate}`)) ? 0.8 : 1.0;
  if (alignMult < 1.0) lg('ng', `  ⚡ [${teammate}/${brief}] Misaligned approach — teammate effectiveness −20%`);

  // ── Brief pre-play effects ────────────────────────────
  // restructure: weekEffBonus Eff per play
  if (brief === 'restructure' && weekEffBonus > 0) {
    acc.mult += weekEffBonus;
    blg('sy', `  📉 [Restructure] Lean deck bonus — +${fmt1(weekEffBonus)} Eff`);
  }
  // hyper_growth: pre-check if no PRODUCTION cards → chips penalty applied post-loop
  // cost_reduction / sustainable_growth: handled in card loop below

  // ── Desk Item pre-play effects ────────────────────────
  if (desk('stress_ball') && wb < 40) {
    acc.mult += 1.0;
    dlg('mu', `  🔴 [Stress Ball] Hanging on — WB ${wb}% < 40%: +1.0 Eff`);
  }
  if (desk('action_figure') && wb < 50) {
    acc.mult += 0.8;
    dlg('mu', `  🧸 [Action Figure] Low WB motivation — +0.8 Eff`);
  }
  if (desk('coffee_mug') && firstCardThisWeek) {
    acc.chips += 150;
    dlg('ch', `  ☕ [Coffee Mug] First play this week — +150 Output`);
  }
  // Desk Item: consultants_notes — static +0.2 Eff per STRATEGY card in this play
  if (desk('consultants_notes')) {
    const stratCount = cards.filter(c => c.archetype === 'STRATEGY').length;
    if (stratCount > 0) {
      const bonus = stratCount * 0.2;
      acc.mult += bonus;
      dlg('sy', `  📝 [Consultant's Notes] ${stratCount} STRATEGY card${stratCount > 1 ? 's' : ''} — +${fmt1(bonus)} Eff`);
    }
  }
  // Org Chart: +0.2 Eff per unique archetype in combo
  if (desk('org_chart')) {
    const unique = new Set(cards.map(c => c.archetype)).size;
    if (unique > 0) {
      const orgBonus = unique * 0.2;
      acc.mult += orgBonus;
      dlg('mu', `  🗺️ [Org Chart] ${unique} unique archetype${unique > 1 ? 's' : ''} — +${fmt1(orgBonus)} Eff`);
    }
  }
  // Cactus: bonus Output per card based on tox
  if (desk('cactus')) {
    const cactusPer = tox >= 90 ? 120 : tox >= 60 ? 50 : 0;
    if (cactusPer > 0) {
      const cactusBonus = cactusPer * cards.length;
      acc.chips += cactusBonus;
      dlg('ch', `  🌵 [Cactus] Tox ${tox}% — +${cactusPer}×${cards.length} = +${cactusBonus} Output`);
    }
  }
  // Hourglass: last play of week → Revenue ×1.5 (applied after card loop)
  // Golden Mug: every 5th total play → Revenue ×2 (applied after card loop)

  // ── Teammate pre-play bonuses ─────────────────────────
  const tmTier = tox >= 81 ? 3 : tox >= 31 ? 2 : 1;
  if (teammate === 'gary') {
    if (tmTier === 2) {
      const tb = Math.floor(tox / 20) * 0.5;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T2] Tox ${tox}% → +${fmt1(tb)} Eff`); }
    } else if (tmTier === 3) {
      const tb = Math.floor(tox / 10) * 1.0;
      if (tb > 0) { acc.mult += tb; lg('sy', `  🗣️ [Gary T3 — Meltdown] Tox ${tox}% → +${fmt1(tb)} Eff (max +10!)`); }
      bo = clamp(bo + 5, 0, 100);
      lg('bo', `  🗣️ [Gary T3 — Meltdown] Pushing hard — +5 Burnout → ${bo}%`);
    }
  }
  if (teammate === 'sarah') {
    if (tmTier === 1) { wb = clamp(wb + 2, 0, 100); lg('wg', `  👻 [Sarah T1 — Present!] Wellness check — +2 WB → ${wb}%`); }
    else if (tmTier === 3) { acc.mult += 0.8; lg('mu', `  👻 [Sarah T3 — Gone] Lean team bonus — +0.8 Eff`); }
  }
  if (teammate === 'alex') {
    const alexChips = tmTier === 1 ? 75 : tmTier === 3 ? 450 : 200;
    const ab = cards.length * alexChips;
    acc.chips += ab;
    lg('ch', `  🦈 [Alex T${tmTier}] +${ab} Output (${cards.length} card${cards.length > 1 ? 's' : ''} × ${alexChips})`);
  }
  // Loyalty bonus: consecutive weeks with same teammate
  const loyalty = ctx.consecutiveSameTeammate || 0;
  if (loyalty >= 3) {
    const loyaltyMult = loyalty >= 7 ? 0.6 : loyalty >= 5 ? 0.4 : 0.2;
    acc.mult += loyaltyMult;
    const label = loyalty >= 7 ? 'Unbreakable Bond' : loyalty >= 5 ? 'Deep Partnership' : 'Trusted Ally';
    lg('sy', `  🤝 [${label} — ${loyalty} wks] Workplace bond — +${loyaltyMult} Eff`);
  }

  // ── Toxicity tier (based on starting tox) ────────────
  // Zone 1: 0-30% Safe | Zone 2: 31-60% Hostile | Zone 3: 61-80% Toxic | Zone 4: 81%+ Hazardous
  const toxTier = tox >= 81 ? 4 : tox >= 61 ? 3 : tox >= 31 ? 2 : 1;

  // Hostile Environment: +100 Output per 10% Tox above 30% (pre-loop, flat bonus)
  if (desk('hostile_environment') && tox > 30) {
    const toxBonus = Math.floor((tox - 30) / 10) * 100;
    if (toxBonus > 0) {
      acc.chips += toxBonus;
      dlg('ch', `  ⚗️ [Hostile Environment] Tox ${Math.round(tox)}% → +${toxBonus} Output`);
    }
  }

  // ── Card loop ─────────────────────────────────────────
  for (const card of cards) {
    const snap = {wb, tox, bo, week: ctx.week, plays: ctx.plays};
    const rec  = {id: card.id, arch: card.archetype, uid: card.uid, snap};
    const fx   = {...card.fx};


    // Desk Item: calendar — PRODUCTION +[week × 2] Chips
    if (desk('calendar') && card.archetype === 'PRODUCTION') {
      fx.chips = (fx.chips || 0) + (ctx.week || 1) * 2;
    }

    // ── New desk item per-card modifications ──────────────────

    // crunch_mode_poster: CRUNCH WB -80%, chips ×1.5, Tox ×2
    if (desk('crunch_mode_poster') && card.archetype === 'CRUNCH') {
      if (fx.wb < 0) fx.wb = Math.round(fx.wb * 0.2);
      if (fx.chips) fx.chips = Math.round(fx.chips * 1.5);
      if (fx.tox > 0) fx.tox = Math.round(fx.tox * 2);
    }
    // burnout_culture_trophy: CRUNCH 0 tox, 0 WB, chips ×2.5
    if (desk('burnout_culture_trophy') && card.archetype === 'CRUNCH') {
      if (fx.tox > 0) fx.tox = 0;
      if (fx.wb < 0) fx.wb = 0;
      if (fx.chips) fx.chips = Math.round(fx.chips * 2.5);
    }
    // mindfulness_app: WB < 40 → RECOVERY ×2; WB > 70 → RECOVERY 0 chips
    if (desk('mindfulness_app') && card.archetype === 'RECOVERY') {
      if (wb < 40) {
        if (fx.chips) fx.chips = fx.chips * 2;
        if (fx.wb > 0) fx.wb = fx.wb * 2;
      } else if (wb > 70) {
        fx.chips = 0;
      }
    }
    // wellness_program: RECOVERY no Tox reduction; WB healed → +25 Output per %
    if (desk('wellness_program') && card.archetype === 'RECOVERY') {
      if (fx.tox < 0) fx.tox = 0;
      if (fx.wb > 0) {
        const wbonus = fx.wb * 25;
        acc.chips += wbonus;
        dlg('ch', `  💊 [Wellness Program] ${fx.wb}% WB healed → +${wbonus} Output`);
      }
    }
    // strategy_deck: STRATEGY Eff counts twice
    if (desk('strategy_deck') && card.archetype === 'STRATEGY' && fx.mult) {
      fx.mult = fx.mult * 2;
    }

    // ── Converted passive desk item effects ──────────────
    // Ergonomic Chair: WB damage -2 per card
    if (desk('ergonomic_chair') && fx.wb < 0) fx.wb = Math.min(0, fx.wb + 2);
    // Mechanical Keyboard: PRODUCTION +50 Output
    if (desk('mechanical_keyboard') && card.archetype === 'PRODUCTION') fx.chips = (fx.chips||0) + 50;
    // Water Cooler: RECOVERY heals & cleanses ×1.25
    if (desk('water_cooler') && card.archetype === 'RECOVERY') {
      if (fx.wb > 0)  fx.wb  = Math.round(fx.wb  * 1.25);
      if (fx.tox < 0) fx.tox = Math.round(fx.tox * 1.25);
    }
    // Agile Coach: STRATEGY +0.1 Eff
    if (desk('agile_coach') && card.archetype === 'STRATEGY') fx.mult = (fx.mult||0) + 0.1;
    // Crisis Mode: CRUNCH WB damage halved
    if (desk('crisis_mode') && card.archetype === 'CRUNCH' && fx.wb < 0) fx.wb = Math.round(fx.wb * 0.5);

    // ── Brief per-card effects ────────────────────────────
    if (brief === 'cost_reduction' && card.archetype === 'CRUNCH') {
      if (fx.chips) fx.chips = Math.round(fx.chips * 1.6);
      if (fx.wb < 0) fx.wb   = Math.round(fx.wb * 1.5);
      tox = clamp(tox + 3, 0, 100); toxGained += 3;
      blg('ch', `  ✂️ [Cost Reduction] CRUNCH: chips ×1.6, WB +50% dmg, +3% TOX → ${tox}%`);
    }
    if (brief === 'sustainable_growth' && card.archetype === 'RECOVERY') {
      if (fx.tox < 0) fx.tox = 0; // no TOX reduction
      if (fx.wb > 0) {
        const sgBonus = fx.wb * 30;
        acc.chips += sgBonus;
        briefProgressDelta += sgBonus;
        blg('ch', `  🌱 [Sustainable Growth] ${fx.wb}% WB healed → +${sgBonus} chips`);
      }
    }
    if (brief === 'hyper_growth' && card.archetype === 'PRODUCTION') {
      if (fx.chips) fx.chips = Math.round(fx.chips * 1.5);
    }

    // Tox Zone 2 (31-60%): CRUNCH gets +40% Output
    if (toxTier === 2 && card.archetype === 'CRUNCH' && fx.chips > 0) {
      fx.chips = Math.round(fx.chips * 1.4);
      lg('ch', `  🔥 [Hostile Office] CRUNCH +40% Output → ${fx.chips}`, true);
    }

    // Context archetype modifiers

    if (fx.chips) { acc.chips += fx.chips; lg('ch', `  [${card.name}] +${fx.chips} Output`, true); }
    if (fx.chips && card.archetype === 'PRODUCTION') prodChips += fx.chips;
    if (fx.mult)  { acc.mult  += fx.mult;  lg('mu', `  [${card.name}] +${fx.mult.toFixed(2)} Eff`, true); }

    // Gary T1: +100 Output per card
    if (teammate === 'gary' && tmTier === 1) {
      acc.chips += Math.round(100 * alignMult);
      lg('ch', `  🗣️ [Gary T1 — Helpful] Pre-read the brief — +${Math.round(100 * alignMult)} Output`, true);
    }
    // Performance Bonus: +75 Output per card played
    if (desk('performance_bonus')) {
      acc.chips += 75;
      dlg('ch', `  💰 [Performance Bonus] +75 Output`);
    }

    // red_bull_stash: CRUNCH → +0.4 Eff stacking + +2 BO
    if (desk('red_bull_stash') && card.archetype === 'CRUNCH') {
      acc.mult += 0.4;
      bo = clamp(bo + 2, 0, 100);
      dlg('mu', `  🥤 [Red Bull Stash] CRUNCH +0.4 Eff → ${fmt1(acc.mult)}× (+2 BO → ${bo}%)`);
    }
    // burnout_culture_trophy: +4 BO per CRUNCH
    if (desk('burnout_culture_trophy') && card.archetype === 'CRUNCH') {
      bo = clamp(bo + 4, 0, 100);
      dlg('bo', `  🏅 [Burnout Culture Trophy] CRUNCH — +4 Burnout → ${bo}%`);
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

    // Derek: PRODUCTION chips / STRATEGY tox
    if (teammate === 'derek') {
      if (card.archetype === 'PRODUCTION') {
        const mc = Math.round((tmTier === 3 ? 300 : 150) * alignMult);
        acc.chips += mc;
        lg('ch', `  📋 [Derek T${tmTier}] Deliverable approved — +${mc} Output`, true);
        if (tmTier === 1) { wb = clamp(wb + 5, 0, 100); lg('wg', `  📋 [Derek T1] Good work noted — +5 WB → ${wb}%`, true); }
        if (tmTier === 3) { bo = clamp(bo + 3, 0, 100); lg('bo', `  📋 [Derek T3] Running you ragged — +3 Burnout → ${bo}%`, true); }
      }
      if (card.archetype === 'STRATEGY' && tmTier >= 2) {
        const mt = tmTier === 3 ? 15 : 8;
        tox = clamp(tox + mt, 0, 100);
        lg('tg', `  📋 [Derek T${tmTier}] "Why are we planning?!" — +${mt}% Tox → ${tox}%`, true);
      }
    }
    // Priya: STRATEGY mult / RECOVERY modifier
    if (teammate === 'priya') {
      if (card.archetype === 'STRATEGY') {
        const pm = (tmTier === 1 ? 0.2 : tmTier === 3 ? 0.6 : 0.4) * alignMult;
        acc.mult += pm;
        lg('mu', `  📊 [Priya T${tmTier}] Strategic insight — +${pm.toFixed(2)} Eff`, true);
      }
    }

    // Tox cap: max +40 per turn (Balance Guard #1)
    if (fx.tox > 0) {
      const cap = Math.max(0, 40 - toxGained);
      const atox = Math.min(fx.tox, cap);
      tox = clamp(tox + atox, 0, 100); toxGained += atox;
      if (atox < fx.tox) lg('tl', `  [${card.name}] +${atox}% Tox (${fx.tox - atox}% absorbed by cap) → ${tox}%`, true);
      else               lg('tg', `  [${card.name}] +${atox}% Toxicity → ${tox}%`, true);
    }
    if (fx.wb < 0) { wb = clamp(wb + fx.wb, 0, 100); lg('wl', `  [${card.name}] ${fx.wb} Wellbeing → ${wb}%`, true); }
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

    // Tox Zone 3 (61-80%): per-card WB drain + Eff ×1.3 applied post-loop
    // Tox Zone 4 (81%+): per-card WB drain × 2 + Eff ×1.6 applied post-loop
    if (tox >= 61) {
      const drain = tox >= 81 ? 2 : 1;
      wb = clamp(wb - drain, 0, 100);
      lg('dm', `  ☣ Toxic Atmosphere (${tox}%) −${drain} WB → ${wb}%`, true);
      if (wb === 0) {
        bo = clamp(bo + drain, 0, 100);
        lg('bo', `  🔥 OVERFLOW → +${drain} Burnout → ${bo}%`);
        if (mode === 'real' && bo >= 100) { gameOver = true; lg('dm', `  !! BURNOUT 100% — GAME OVER !!`); }
      }
      toxLevels.push(tox);
    }

    // sick_day_policy: WB never drops below 20% from a single play
    if (desk('sick_day_policy') && wb < 20) {
      wb = 20;
      dlg('ok', `  🤒 [Sick Day Policy] WB floored at 20%`);
    }

    playLog.push(rec);
    if (gameOver) break;
  }

  // ── Brief post-loop effects ───────────────────────────
  if (brief === 'hyper_growth' && !gameOver) {
    const hasProd = cards.some(c => c.archetype === 'PRODUCTION');
    if (!hasProd && acc.chips > 0) {
      const before = acc.chips;
      acc.chips = Math.round(acc.chips * 0.8);
      blg('ng', `  📈 [Hyper-Growth] No PRODUCTION — chips −20%: ${before} → ${acc.chips}`);
    }
  }

  // ── Desk Item post-loop effects ───────────────────────
  // rubber_duck: solo play → Chips ×2
  if (desk('rubber_duck') && cards.length === 1 && !gameOver) {
    const before = acc.chips;
    acc.chips = Math.round(acc.chips * 2);
    dlg('ch', `  🦆 [Rubber Duck] Solo play — Output ×2: ${before} → ${acc.chips}`);
  }

  // assembly_line: PRODUCTION chip modifier
  const prodCardCount = cards.filter(c => c.archetype === 'PRODUCTION').length;
  if (desk('assembly_line') && prodCardCount > 0 && !gameOver) {
    if (prodCardCount >= 2) {
      const before = acc.chips;
      acc.chips = Math.round(acc.chips * 1.8);
      dlg('ch', `  🏭 [Assembly Line] ${prodCardCount} PRODUCTION — chips ×1.8: ${before} → ${acc.chips}`);
    } else {
      // solo PRODUCTION: −30%
      const before = acc.chips;
      acc.chips = Math.round(acc.chips * 0.7);
      dlg('ng', `  🏭 [Assembly Line] Solo PRODUCTION — chips ×0.7: ${before} → ${acc.chips}`);
    }
  }

  // overtime_log: PRODUCTION solo ×4; mixed PRODUCTION chips don't count
  if (desk('overtime_log') && prodCardCount > 0 && !gameOver) {
    if (cards.length === 1 && cards[0].archetype === 'PRODUCTION') {
      const before = acc.chips;
      acc.chips = Math.round(acc.chips * 4);
      dlg('ch', `  📒 [Overtime Log] Solo PRODUCTION — Output ×4: ${before} → ${acc.chips}`);
    } else if (cards.length > 1 && prodCardCount > 0) {
      // PRODUCTION chips don't count in mixed play — subtract prodChips
      if (prodChips > 0) {
        acc.chips = Math.max(0, acc.chips - prodChips);
        dlg('ng', `  📒 [Overtime Log] Mixed play — PRODUCTION chips negated (−${prodChips})`);
      }
    }
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

    // Tox Zone Eff multipliers (post-loop)
    if (tox >= 81 && !gameOver) {
      const before = acc.mult;
      acc.mult = Number(fmt1(acc.mult * 1.6));
      lg('mu', `  ☣ [Hazardous (${Math.round(tox)}%)] ALL Eff ×1.6: ${fmt1(before)} → ${fmt1(acc.mult)}`);
    } else if (tox >= 61 && !gameOver) {
      const before = acc.mult;
      acc.mult = Number(fmt1(acc.mult * 1.3));
      lg('mu', `  ⚡ [Toxic Culture (${Math.round(tox)}%)] ALL Eff ×1.3: ${fmt1(before)} → ${fmt1(acc.mult)}`);
    }

    // Toxicity Tier Transition announcement (real only)
    if (mode === 'real') {
      const tierBefore = ctx.tox >= 81 ? 4 : ctx.tox >= 61 ? 3 : ctx.tox >= 31 ? 2 : 1;
      const tierAfter  = tox >= 81 ? 4 : tox >= 61 ? 3 : tox >= 31 ? 2 : 1;
      if (tierAfter > tierBefore) {
        const names = ['','','HOSTILE OFFICE','TOXIC CULTURE','☣ HAZARDOUS'];
        const effs  = ['','','CRUNCH +40% Output','Eff ×1.3 | −1 WB/card','Eff ×1.6 | −2 WB/card | −1 Discard'];
        log.push({cls:'tg', t:`  !! TOX ZONE UP → [${names[tierAfter]}] ${effs[tierAfter]}`});
      }
    }

    // ── Meeting Type Detection + Bonuses ──────────────────
    const detectedMeeting = detectMeeting(cards, deskItems, { lastMeetingType });
    if (detectedMeeting) {
      if (detectedMeeting.secret) {
        lg('sy', `  ✨ SECRET MEETING: ${detectedMeeting.icon} ${detectedMeeting.name}`);
        if (detectedMeeting.id === 'agile_sprint') {
          const before = acc.chips;
          acc.chips = Math.round(acc.chips * 1.5);
          lg('ch', `  ⚡ [Agile Sprint] Consecutive Sprint Reviews — Output ×1.5: ${before} → ${acc.chips}`);
        }
        if (detectedMeeting.id === 'executive_brief') {
          acc.mult += 2.0;
          lg('mu', `  💼 [Executive Brief] Board Meeting after Strategy Session — +2.0 Eff`);
        }
        if (detectedMeeting.id === 'mental_health_day') {
          const before = acc.chips;
          acc.chips = Math.round(acc.chips * 3);
          lg('ch', `  🌿 [Mental Health Day] Solo RECOVERY — Output ×3: ${before} → ${acc.chips}`);
        }
        if (detectedMeeting.id === 'strategic_pivot') {
          acc.mult += 1.0;
          lg('mu', `  🔀 [Strategic Pivot] Cross-functional Sync with active carry — +1.0 Eff`);
        }
        // death_march handled post-score
      } else {
        // Apply base meeting bonus
        const b = detectedMeeting.bonus || {};
        if (b.chips)  { acc.chips += b.chips;  lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: +${b.chips} Output`); }
        if (b.mult)   { acc.mult  += b.mult;   lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: +${fmt1(b.mult)} Eff`); }
        if (b.chipsX) { const before = acc.chips; acc.chips = Math.round(acc.chips * b.chipsX); lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: Output ×${b.chipsX} (${before}→${acc.chips})`); }
        if (b.wb)     { wb = clamp(wb + b.wb, 0, 100);   lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: ${b.wb > 0 ? '+' : ''}${b.wb} WB → ${Math.round(wb)}%`); }
        if (b.tox)    { tox = clamp(tox + b.tox, 0, 100); if (b.tox < 0) lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting bonus: ${b.tox}% Tox → ${Math.round(tox)}%`);
                        else lg('sy', `  ${detectedMeeting.icon} [${detectedMeeting.name}] Meeting politics: +${b.tox}% Tox → ${Math.round(tox)}%`); }
        if (!b.chips && !b.mult && !b.chipsX && !b.wb && !b.tox) lg('d', `  ${detectedMeeting.icon} ${detectedMeeting.name}`);
      }
    }

    // WB penalty (Balance Guard #2)
    const eff = wbEff(Math.round(wb));
    if (eff.mult < 1.0) {
      const raw = acc.chips; acc.chips = Math.floor(acc.chips * eff.mult);
      lg('wl', `  ${eff.label} (${raw}→${acc.chips})`);
    }

    let score = Math.floor(acc.chips * acc.mult);
    // death_march: 3× CRUNCH → Revenue ×2, +15 Burnout
    if (detectedMeeting?.id === 'death_march') {
      const before = score;
      score = score * 2;
      bo = clamp(bo + 15, 0, 100);
      lg('sc', `  💀 [Death March] Limit break — Revenue ×2: ${before} → ${score} (+15 BO → ${bo}%)`);
    }

    // Desk Item: hourglass — last play of week → Chips ×1.5
    if (desk('hourglass') && ctx.plays === 1) {
      const hbefore = score;
      score = Math.floor(score * 1.5);
      dlg('sc', `  ⏳ [Hourglass] Last play of week — Revenue ×1.5: ${hbefore} → ${score}`);
    }
    // Desk Item: golden_mug — every 5th play (totalPlayCount is BEFORE this play)
    if (desk('golden_mug') && (totalPlayCount + 1) % 5 === 0) {
      const gbefore = score;
      score = score * 2;
      dlg('sc', `  🥇 [Golden Mug] Play #${totalPlayCount + 1} — every 5th play: Revenue ×2: ${gbefore} → ${score}`);
    }
    lg('sc', `  ▶ REVENUE: $${acc.chips.toLocaleString()} × ${fmt1(acc.mult)} = $${score.toLocaleString()}`);

    const finalWb = Math.round(wb), finalTox = Math.round(tox), finalBo = Math.round(bo);
    const expectedToxDmg = toxLevels.reduce((s, t) => s + Math.round(TOX_DMG * (t / 100)), 0);
    const maxToxDmg = toxLevels.length * TOX_DMG;
    const riskWb = clamp(finalWb - expectedToxDmg, 0, 100);

    return {
      score, baseScore: score, wb: finalWb, tox: finalTox, bo: finalBo, gameOver: false,
      comboMult: 1.0, chips: acc.chips, mult: fmt1(acc.mult),
      scaleLog: acc.scaleLog,
      log, activeSynergies, deskActivations, briefActivations, briefProgressDelta,
      firstCrunchUsed, weekCrunchCount, firstCardThisWeek, newExhausted,
      effLabel: eff.label,
      wbDelta: finalWb - ctx.wb, toxDelta: finalTox - ctx.tox, boDelta: finalBo - ctx.bo,
      finalWb, finalTox, finalBo,
      toxChecks: toxLevels.length, expectedToxDmg, maxToxDmg,
      riskLevel: getRiskLevel(riskWb, finalTox, finalBo),
      meetingType: detectedMeeting || null,
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
