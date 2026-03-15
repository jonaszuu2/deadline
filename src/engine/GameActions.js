// ═══════════════════════════════════════════════════════
//  GAME ACTIONS
//  Turn-level player actions: play, discard, draw, upgrade, etc.
//  Exported as plain functions — mixed into Game.prototype in game.js.
//  All functions use `this` as the Game instance (no arrow functions).
// ═══════════════════════════════════════════════════════
import { clamp, UPGRADE_TIERS } from '../data/constants.js';
import { fmt1, shuffle, nextUid } from './utils.js';
import { calcTurn } from './calcTurn.js';
import { COMP_DB, TEAMMATES_DB } from '../data/content.js';
import { DB } from '../data/cards.js';
import { ui } from './uiStore.js';

// ── Local helper: weighted random upgrade tier roll ──
function _rollUpgradeTier() {
  const total = UPGRADE_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of UPGRADE_TIERS) { r -= t.weight; if (r <= 0) return t; }
  return UPGRADE_TIERS[0];
}

// ═══════════════════════════════════════════════════════
//  HAND MANAGEMENT
// ═══════════════════════════════════════════════════════

export function drawUp() {
  if (this.firstDraw && this.hand.length === 0 && this.deck.length > 0) {
    this.firstDraw = false;
    const hasScoring = this.deck.some(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
    if (hasScoring) {
      const deckLen = this.deck.length;
      const handSize = this.handLimit();
      const tail = this.deck.slice(-Math.min(handSize, deckLen));
      const tailHasScoring = tail.some(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
      if (!tailHasScoring) {
        const scoringIdx = this.deck.findIndex(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
        if (scoringIdx >= 0) {
          const swapPos = deckLen - 1 - Math.floor(Math.random() * Math.min(handSize, deckLen));
          [this.deck[scoringIdx], this.deck[swapPos]] = [this.deck[swapPos], this.deck[scoringIdx]];
        }
      }
    }
  }
  while (this.hand.length < this.handLimit()) {
    if (!this.deck.length) {
      if (!this.pile.length) break;
      const fresh = this.pile.filter(c => !this.exhausted.has(c.uid));
      if (!fresh.length) break;
      this.deck = shuffle(fresh);
      this.pile = this.pile.filter(c => this.exhausted.has(c.uid));
      this.addLog('d', '> Deck reshuffled from discard pile.');
    }
    const card = this.deck.pop(); if (card) this.hand.push(card);
  }
}

export function toggle(uid) {
  const i = this.sel.indexOf(uid);
  if (i >= 0) this.sel.splice(i, 1);
  else if (this.sel.length < this.maxSel()) this.sel.push(uid);
  this._commit();
}

// ═══════════════════════════════════════════════════════
//  DISCARD
// ═══════════════════════════════════════════════════════

export function discardSelected() {
  if (this.discs <= 0 || !this.sel.length) return;
  const gone = this.hand.filter(c => this.sel.includes(c.uid));
  this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
  this.pile.push(...gone); this.sel = []; this.discs--;
  let discardLog = `> Discarded ${gone.length} card(s).`;

  // Batch Discard Combo: 2+ cards stacks Mult on next play
  if (gone.length >= 2) {
    const comboBonus = fmt1((gone.length - 1) * 0.4);
    this.discardComboMult = fmt1(this.discardComboMult + Number(comboBonus));
    discardLog += ` ♻ Batch Discard: +${comboBonus}× Mult stacked (${this.discardComboMult}× ready).`;
  }
  // Risk Mitigator: additional mult stack
  if (this.hasComp('comp_riskmitigator')) {
    const bonus = gone.length * COMP_DB.comp_riskmitigator.passiveVal;
    this.discardMultStack = fmt1(this.discardMultStack + bonus);
    discardLog += ` 🗑️ Risk Mitigator: +${fmt1(bonus)} Mult (total ${this.discardMultStack}×).`;
  }
  // Brief: restructure — +3% Tox per card discarded
  if (this.brief === 'restructure') {
    const toxGain = gone.length * 3;
    this.tox = clamp(this.tox + toxGain, 0, 100);
    discardLog += ` 🔄 [RESTRUCTURE] +${toxGain}% Tox.`;
    this.briefProgress += gone.length;
    if (this.briefProgress >= 30 && !this.briefSideAchieved) {
      this.briefSideAchieved = true;
      this.pendingUpgrade = true;
      this.addLog('ch', discardLog);
      this.addLog('sy', '> 🔄 [RESTRUCTURE] 30 discards — Free Performance Upgrade unlocked!');
      this.drawUp(); this._commit(); return;
    }
  }
  this.addLog('ch', discardLog);
  this.drawUp(); this._commit();
}

// ═══════════════════════════════════════════════════════
//  PLAY
// ═══════════════════════════════════════════════════════

export function playSelected() {
  if (this._busy || this.plays <= 0 || !this.sel.length || this.phase !== 'play') return;
  this._busy = true;
  const cards = this.sel.map(uid => this.hand.find(c => c.uid === uid)).filter(Boolean);
  this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
  this.pile.push(...cards); this.sel = []; this.plays--;
  if (cards.some(c => c.archetype === 'CRUNCH')) { this.weekCrunched = true; this.crunchPlayed = true; }
  for (const card of cards) if (card.exhaust) this.exhausted.add(card.uid);

  // Gary penalty: "presents" cards before scoring (tier-aware)
  if (this.teammate === 'gary') {
    const garyTier = this.getTeammateTier();
    const removals = garyTier === 1 ? 0 : garyTier === 3 ? 2 : 1;
    for (let i = 0; i < removals && this.hand.length > 0; i++) {
      const vi = Math.floor(Math.random() * this.hand.length);
      const victim = this.hand.splice(vi, 1)[0];
      this.pile.push(victim);
      this.addLog('ng', `> 🗣️ Gary "presents" [${victim.name}] to the group. Removed.`);
    }
  }

  const res = this.processTurn(cards);
  this._advanceClassTrack(cards, res);
  const prevWscore = this.wscore;
  const prevWb    = this.wb;
  const prevPassed = this.wscore >= this.kpi();
  const newWscore  = this.wscore + res.score;

  this.log.push(...res.log);

  // Card Leveling: increment playCount, upgrade every 5 plays
  for (const c of cards) {
    c.playCount = (c.playCount || 0) + 1;
    const prevLvl = c.level || 0;
    if (prevLvl < 3 && c.playCount % 5 === 0) {
      c.level = prevLvl + 1;
      if (c.level === 1)      c.fx = {...c.fx, chips: (c.fx.chips||0) + 40};
      else if (c.level === 2) c.fx = {...c.fx, mult: Number(fmt1((c.fx.mult||0) + 0.2))};
      else                    { c.fx = {...c.fx, chips: (c.fx.chips||0) + 50, mult: Number(fmt1((c.fx.mult||0) + 0.1))}; this.achievedLv3 = true; }
      const stars = '★'.repeat(c.level);
      const desc = c.level === 1 ? '+40 Chips base' : c.level === 2 ? '+0.2 Mult base' : '+50 Chips +0.1 Mult base';
      this.addLog('sy', `> ${stars} [${c.name}] LEVEL ${c.level}! ${desc}`);
    }
  }

  // Brief: digital_transformation
  if (this.brief === 'digital_transformation') {
    const stratCards = cards.filter(c => c.archetype === 'STRATEGY');
    for (const c of stratCards) {
      c.fx = {...c.fx, chips: (c.fx.chips || 0) + 5};
      this.briefProgress++;
    }
    if (stratCards.length > 0) {
      this.addLog('sy', `> 💻 [DIGITAL TRANSFORMATION] ${stratCards.length} STRATEGY card(s) +5 Chips. (${this.briefProgress}/20)`);
      if (this.briefProgress >= 20 && !this.briefSideAchieved) {
        this.briefSideAchieved = true;
        this.permMult = fmt1(this.permMult + 1.0);
        this.addLog('sy', `> 💻 [DIGITAL TRANSFORMATION] 20 STRATEGY plays — +1.0 permanent Mult → ${this.permMult}×!`);
      }
    }
  }

  // Brief: hyper_growth
  if (this.brief === 'hyper_growth') {
    const prodCount = cards.filter(c => c.archetype === 'PRODUCTION').length;
    if (prodCount > 0) {
      this.briefProgress += prodCount;
      if (this.briefProgress >= 40 && !this.briefSideAchieved) {
        this.briefSideAchieved = true;
        const allCards = [...this.deck, ...this.pile, ...this.hand];
        let count = 0;
        for (const c of allCards) {
          if (c.archetype === 'PRODUCTION') { c.fx = {...c.fx, chips: (c.fx.chips || 0) + 50}; count++; }
        }
        this.addLog('sy', `> 🚀 [HYPER-GROWTH] 40 PRODUCTION plays — +50 Chips to all ${count} PRODUCTION cards!`);
      }
    }
  }

  for (const c of cards) this.weekArchetypes[c.archetype] = (this.weekArchetypes[c.archetype] || 0) + 1;
  this._checkArchetypeMilestones();
  for (const c of cards.filter(c => c.exhaust)) this.addLog('ng', `> ⊗ [${c.name}] exhausted — gone until next week.`);

  // Compute scoring reveal intensity
  const cm = res.comboMult || 1.0;
  const comboLabel = (res.log.filter(e => e.cls === 'sy' && e.t.includes('COMBO')).pop()?.t.match(/\[([^\]]+)\]/) || [])[1] || null;
  let intensity = 'normal';
  if      (cm >= 2.0 || res.score >= 500) intensity = 'epic';
  else if (cm >= 1.5 || res.score >= 300) intensity = 'great';
  else if (cm >= 1.2 || res.score >= 150) intensity = 'good';

  let nextPhase;
  if (res.gameOver) nextPhase = 'review';
  else if (newWscore >= this.kpi() || this.plays <= 0) nextPhase = 'result';
  else nextPhase = 'draw_continue';

  this.scoringDisplay = {
    chips: res.chips, mult: parseFloat(res.mult),
    comboMult: res.comboMult, baseScore: res.baseScore ?? res.score,
    score: res.score, wbDelta: res.wbDelta, toxDelta: res.toxDelta, boDelta: res.boDelta,
    prevWscore, pendingScore: res.score, pendingWscore: newWscore,
    pendingWb: res.wb, pendingTox: res.tox, pendingBo: res.bo,
    intensity, comboLabel,
    crossedKpi: !res.gameOver && !prevPassed && newWscore >= this.kpi(),
    activeSynergies: res.activeSynergies,
    playedCards: cards.map(c => ({ name: c.name, archetype: c.archetype })),
    nextPhase,
  };
  this.transition('scoring');
  this._commit();
  if (prevWb > res.wb) ui.showWbDamage(prevWb - res.wb);
}

// ── Dismiss scoring reveal → continue game ──
export function finishScoring() {
  const d = this.scoringDisplay;
  if (!d) return;
  this.scoringDisplay = null;
  this._nextPhase = null;
  this.wscore    = d.pendingWscore;
  this.wb        = d.pendingWb;
  this.tox       = d.pendingTox;
  this.bo        = d.pendingBo;
  this.lastScore = d.pendingScore;
  ui.animateWscore(d.prevWscore, d.pendingWscore, d.intensity);
  if (d.pendingScore > 0) ui.showScorePopup(d.pendingScore, d.intensity, d.comboLabel);
  if (d.crossedKpi) ui.triggerKpiFlash();
  if ((d.intensity === 'epic' || d.intensity === 'great') && d.comboLabel) ui.showComboAnnouncer(d.comboLabel);
  this._busy = false;
  if (d.nextPhase === 'review') { this.isTerminated = true; this.transition('review'); }
  else if (d.nextPhase === 'result') this.transition('result');
  else { this.drawUp(); this.transition('play'); }
  this._commit();
  if (this.week === 1) setTimeout(() => ui.showGuideTip?.('score_formula'), 300);
  if (d.crossedKpi)    setTimeout(() => ui.showGuideTip?.('kpi_hit'), 500);
  if (d.nextPhase !== 'review') {
    const toxDmgFired = this.log.some(e => e.cls === 'dm' && e.t.includes('TOXIC'));
    if (toxDmgFired) setTimeout(() => ui.showContextualTip?.('tox_damage'), 400);
    else if (this.wb < 60) setTimeout(() => ui.showContextualTip?.('low_wb'), 400);
    if (d.activeSynergies?.size > 0) setTimeout(() => ui.showContextualTip?.('first_synergy'), 600);
  }
}

// ═══════════════════════════════════════════════════════
//  TURN ENGINE WRAPPER
// ═══════════════════════════════════════════════════════

export function processTurn(cards) {
  this.updateTeammateBehavior();
  const result = calcTurn(cards, {
    wb: this.wb, tox: this.tox, bo: this.bo,
    week: this.week, plays: this.plays,
    passives:                this.passives,
    competencies:            this.competencies,
    teammate:                this.teammate,
    consecutiveSameTeammate: this.consecutiveSameTeammate,
    discardComboMult:        this.discardComboMult,
    discardMultStack:        this.discardMultStack,
    firstCardThisWeek:       this.firstCardThisWeek,
    firstCrunchUsed:         this.firstCrunchUsed,
    weekCrunchCount:         this.weekCrunchCount,
    permMult:                this.permMult,
    brief:                   this.brief,
    mode: 'real',
  });
  this.discardComboMult = 0;
  if (this.hasComp('comp_riskmitigator') && this.discardMultStack > 0) this.discardMultStack = 0;
  this.firstCrunchUsed   = result.firstCrunchUsed;
  this.weekCrunchCount   = result.weekCrunchCount;
  this.firstCardThisWeek = result.firstCardThisWeek;
  for (const uid of result.newExhausted) this.exhausted.add(uid);
  this.peakTox = Math.max(this.peakTox, result.tox);
  if (!result.gameOver) {
    this.totalRawChips += result.chips;
    this.totalMultSum  += result.mult;
    this.totalPlayCount++;
  }
  return result;
}

export function updateTeammateBehavior() {
  const newTier = this.getTeammateTier();
  if (this.teammate && newTier !== this.teammateTier) {
    this.teammateTier = newTier;
    const tm = TEAMMATES_DB[this.teammate];
    const tierData = tm?.tiers?.[newTier - 1];
    if (tierData?.triggerQuote) {
      const label = newTier === 3 ? 'ng' : newTier === 2 ? 'i' : 'ok';
      this.addLog(label, `> 💬 [${tm.name} — Tier ${newTier}: ${tierData.name}] "${tierData.triggerQuote}"`);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  CLASS TRACK
// ═══════════════════════════════════════════════════════

export function _advanceClassTrack(cards, res) {
  if (!this.playerClass) return;
  let gain = 0;
  if (this.playerClass === 'grinder') {
    gain = cards.filter(c => c.archetype === 'PRODUCTION').length;
  } else if (this.playerClass === 'strategist') {
    gain = cards.filter(c => c.archetype === 'STRATEGY' || c.archetype === 'CRUNCH').length;
  } else if (this.playerClass === 'survivor') {
    for (const c of cards) {
      if (c.fx.wb > 0) gain += c.fx.wb;
      if (c.fx.tox < 0) gain += Math.abs(c.fx.tox);
    }
  }
  if (gain <= 0) return;
  this.classTrack += gain;
  const thresholds = this.playerClass === 'survivor'
    ? [0, 60, 130, 220, 330, 450]
    : [0, 8, 18, 30, 45, 60];
  const newLevel = thresholds.filter(t => this.classTrack >= t).length - 1;
  if (newLevel > this.classTrackLevel) {
    this.classTrackLevel = newLevel;
    this._applyClassTrackReward(newLevel);
  }
}

export function _applyClassTrackReward(level) {
  const rewards = {
    grinder:   [null, {coins:3,msg:'⚙ [GRINDER L1] Momentum — +3 CC'}, {plays:1,msg:'⚙ [GRINDER L2] Second Wind — +1 Play this week'}, {wb:20,msg:'⚙ [GRINDER L3] Recovery Break — +20 Wellbeing'}, {tox:-15,msg:'⚙ [GRINDER L4] Clean Workspace — -15% Toxicity'}, {permMult:1.0,msg:'⚙ [GRINDER L5] MASTERY UNLOCKED — +1.0 permanent Mult'}],
    strategist:[null, {coins:3,msg:'🎯 [STRATEGIST L1] Insight — +3 CC'}, {permMult:0.5,msg:'🎯 [STRATEGIST L2] Leverage — +0.5 permanent Mult'}, {wb:20,tox:-10,msg:'🎯 [STRATEGIST L3] Strategic Recovery — +20 WB, -10% Tox'}, {plays:1,msg:'🎯 [STRATEGIST L4] Overtime Approved — +1 Play this week'}, {permMult:1.0,msg:'🎯 [STRATEGIST L5] DOMINANCE UNLOCKED — +1.0 permanent Mult'}],
    survivor:  [null, {tox:-15,msg:'☣ [SURVIVOR L1] Tox Flush — -15% Toxicity'}, {wb:25,msg:'☣ [SURVIVOR L2] Resilience — +25 Wellbeing'}, {tox:-20,msg:'☣ [SURVIVOR L3] Deep Cleanse — -20% Toxicity'}, {wb:35,msg:'☣ [SURVIVOR L4] Iron Will — +35 Wellbeing'}, {wb:25,bo:-20,msg:'☣ [SURVIVOR L5] IMMORTAL UNLOCKED — +25 WB, -20 Burnout'}],
  };
  const r = rewards[this.playerClass]?.[level];
  if (!r) return;
  if (r.coins)    this.coins    = Math.max(0, this.coins + r.coins);
  if (r.plays)  { this.plays   += r.plays; this.playsMax += r.plays; }
  if (r.wb)       this.wb       = clamp(this.wb  + r.wb,  0, 100);
  if (r.tox)      this.tox      = clamp(this.tox + r.tox, 0, 100);
  if (r.bo)       this.bo       = clamp(this.bo  + r.bo,  0, 100);
  if (r.permMult) this.permMult = fmt1((this.permMult || 0) + r.permMult);
  this.addLog('sy', `> ${r.msg}`);
}

// ═══════════════════════════════════════════════════════
//  ARCHETYPE MILESTONES + PASSIVE COMBOS
// ═══════════════════════════════════════════════════════

export function _checkArchetypeMilestones() {
  const T = 4;
  if (!this.archetypeMilestonesHit.has('PRODUCTION') && (this.weekArchetypes.PRODUCTION || 0) >= T) {
    this.archetypeMilestonesHit.add('PRODUCTION'); this.wscore += 150;
    this.addLog('sy', '> ★ PRODUCTION MILESTONE — +150 bonus pts!');
  }
  if (!this.archetypeMilestonesHit.has('STRATEGY') && (this.weekArchetypes.STRATEGY || 0) >= T) {
    this.archetypeMilestonesHit.add('STRATEGY'); this.wscore += 120;
    this.addLog('sy', '> ★ STRATEGY MILESTONE — +120 bonus pts!');
  }
  if (!this.archetypeMilestonesHit.has('CRUNCH') && (this.weekArchetypes.CRUNCH || 0) >= T) {
    this.archetypeMilestonesHit.add('CRUNCH'); this.wscore += 200;
    this.wb = clamp(this.wb - 10, 0, 100);
    this.addLog('sy', '> ★ CRUNCH MILESTONE — +200 pts but −10 WB!');
  }
  if (!this.archetypeMilestonesHit.has('RECOVERY') && (this.weekArchetypes.RECOVERY || 0) >= T) {
    this.archetypeMilestonesHit.add('RECOVERY');
    this.wb = clamp(this.wb + 15, 0, 100);
    this.addLog('sy', '> ★ RECOVERY MILESTONE — +15 Wellbeing!');
  }
}

export function _checkPassiveCombos() {
  const owned = new Set(this.passives.map(p => p.itemId));
  const combos = [
    {id:'combo_ergo',     needs:['sh_chair','sh_keyboard'],
     msg:'★ PASSIVE COMBO: Ergonomics Expert (Chair + Keyboard) — +0.5 permanent Mult',
     apply: g => { g.permMult = fmt1((g.permMult||0)+0.5); }},
    {id:'combo_zen',      needs:['sh_plant','sh_cooler'],
     msg:'★ PASSIVE COMBO: Zen Office (Plant + Cooler) — -10% Toxicity',
     apply: g => { g.tox = clamp(g.tox-10,0,100); }},
    {id:'combo_techLead', needs:['sh_keyboard','sh_coach'],
     msg:'★ PASSIVE COMBO: Tech Leadership (Keyboard + Coach) — +0.3 Mult, +10 WB',
     apply: g => { g.permMult = fmt1((g.permMult||0)+0.3); g.wb = clamp(g.wb+10,0,100); }},
  ];
  for (const c of combos) {
    if (!this.discoveredCombos.has(c.id) && c.needs.every(id => owned.has(id))) {
      this.discoveredCombos.add(c.id);
      c.apply(this);
      this.addLog('sy', `> ${c.msg}`);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  UTILITY ACTIONS
// ═══════════════════════════════════════════════════════

export function bankRemainingPlays() {
  if (this.plays <= 0 || this.phase !== 'result') return;
  const earned = this.plays * 4;
  this.coins += earned;
  this.addLog('ok', `> 💰 Banked ${this.plays} play${this.plays > 1 ? 's' : ''} — +${earned} CC → ${this.coins} CC`);
  this.plays = 0;
  this._commit();
}

export function releasePressure() {
  if (this.pressureReleaseUsed || this.discs <= 0 || this.phase !== 'play') return;
  this.discs--;
  this.pressureReleaseUsed = true;
  this.tox = clamp(this.tox - 15, 0, 100);
  this.addLog('tl', `> 💨 [Pressure Release] −15% Toxicity → ${this.tox}% (1 discard used)`);
  this._commit();
}

export function cancelAction() {
  this.pendingRemove = false;
  this.pendingHold = false;
  this.pendingUpgrade = false;
  this._commit();
}

export function setOverlaySort(key) { this.overlaySort = key; this._commit(); }

// ═══════════════════════════════════════════════════════
//  CARD UPGRADE / REMOVE / HOLD
// ═══════════════════════════════════════════════════════

export function upgradeCard(uid) {
  const orig = [...this.deck, ...this.pile].find(c => c.uid === uid);
  if (!orig) return;
  const tier = _rollUpgradeTier();
  const arch = orig.archetype;

  let updater, logDesc;
  if (arch === 'PRODUCTION') {
    updater = c => ({ fx: {...c.fx, chips: (c.fx.chips || 0) + tier.chips} });
    logDesc = `+${tier.chips} Chips`;
  } else if (arch === 'STRATEGY' || arch === 'CRUNCH') {
    updater = c => ({ fx: {...c.fx, mult: Number(fmt1((c.fx.mult || 0) + tier.mult))} });
    logDesc = `+${tier.mult} Mult`;
  } else if (arch === 'RECOVERY') {
    const wbBoost  = orig.fx.wb  > 0 ? Math.round(tier.chips / 4) : 0;
    const toxBoost = orig.fx.tox < 0 ? -Math.round(tier.chips / 4) : 0;
    updater = c => ({
      fx: {
        ...c.fx,
        wb:  wbBoost  ? (c.fx.wb  || 0) + wbBoost  : c.fx.wb,
        tox: toxBoost ? (c.fx.tox || 0) + toxBoost : c.fx.tox,
      }
    });
    logDesc = wbBoost ? `+${wbBoost} WB heal` : `-${Math.abs(toxBoost)}% Tox cleanse`;
  } else {
    // SHOP cards — both stats
    updater = c => ({
      fx: {...c.fx, chips: (c.fx.chips || 0) + tier.chips, mult: Number(fmt1((c.fx.mult || 0) + tier.mult))}
    });
    logDesc = `+${tier.chips} Chips, +${tier.mult} Mult`;
  }

  const card = this._mutateCard(uid, c => ({...updater(c), upgrades: (c.upgrades || 0) + 1}));
  this.pendingUpgrade = false;
  this.upgradeResultCard = card;
  this.upgradeResultFrom = { chips: orig.fx.chips || 0, mult: orig.fx.mult || 0 };
  this.upgradeResultTier = tier;
  this.upgradeSpinning = true;
  this.transition('upgrade_result');
  this.addLog('ok', `> ⬆️ [${card.name}] upgraded (${tier.label}): ${logDesc} permanently.`);
  this._commit();
  ui.startUpgradeSpin(tier, () => this.stopUpgradeSpin());
}

export function stopUpgradeSpin() {
  this.upgradeSpinning = false;
  this._commit();
}

export function dismissUpgradeResult() {
  this.upgradeResultCard = null;
  this.upgradeResultFrom = null;
  this.upgradeResultTier = null;
  this.upgradeSpinning = false;
  this.transition('shop');
  this._commit();
}

export function removeCard(uid) {
  const card = [...this.deck, ...this.pile].find(c => c.uid === uid);
  this.deck = this.deck.filter(c => c.uid !== uid);
  this.pile = this.pile.filter(c => c.uid !== uid);
  this.pendingRemove = false;
  if (card) {
    this.addLog('ok', `> 🗑️ [${card.name}] permanently shredded.`);
    if (this.pendingDraftCard) {
      const cardDef = DB[this.pendingDraftCard];
      this.pendingDraftCard = null;
      if (cardDef) {
        const newCard = {...cardDef, uid:`${cardDef.id}_${nextUid()}`};
        const at = Math.floor(Math.random() * (this.deck.length + 1));
        this.deck.splice(at, 0, newCard);
        this.addLog('ok', `> 📋 Draft: ${cardDef.name} added to deck.`);
        this._openShopAfterDraft();
        return;
      }
    }
  }
  this._commit();
}

export function holdCard(uid) {
  const card = this.pile.find(c => c.uid === uid);
  if (!card) return;
  this.pile = this.pile.filter(c => c.uid !== uid);
  this.heldCards.push(card);
  this.pendingHold = false;
  this.addLog('ok', `> 💼 [${card.name}] secured in briefcase — ready next week.`);
  this._commit();
}
