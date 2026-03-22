// ═══════════════════════════════════════════════════════
//  GAME ACTIONS
//  Turn-level player actions: play, discard, draw, upgrade, etc.
//  Exported as plain functions — mixed into Game.prototype in game.js.
//  All functions use `this` as the Game instance (no arrow functions).
// ═══════════════════════════════════════════════════════
import { clamp, UPGRADE_TIERS } from '../data/constants.js';
import { fmt1, shuffle, nextUid } from './utils.js';
import { calcTurn } from './calcTurn.js';
import { TEAMMATES_DB } from '../data/content.js';
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
  const hasPIP = (this.deskItems||[]).some(d => d.id === 'performance_improvement_plan');
  const hasUPTO = (this.deskItems||[]).some(d => d.id === 'unlimited_pto');
  if (hasPIP) {
    this.addLog('ng', `> 📋 [Performance Improvement Plan] Discards disabled.`);
    return;
  }
  if (!hasUPTO && this.discs <= 0) return;
  if (!this.sel.length) return;
  const gone = this.hand.filter(c => this.sel.includes(c.uid));
  this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
  this.pile.push(...gone); this.sel = [];
  if (!hasUPTO) this.discs--;
  // unlimited_pto: +5 tox per card discarded
  if (hasUPTO && gone.length > 0) {
    const toxGain = gone.length * 5;
    this.tox = clamp(this.tox + toxGain, 0, 100);
    this.addLog('tg', `> 🏖️ [Unlimited PTO] ${gone.length} card(s) discarded — +${toxGain}% Tox → ${this.tox}%`);
  }
  let discardLog = `> Discarded ${gone.length} card(s).`;
  // Batch Discard: 2+ cards immediately reduce Tox by 10%
  if (gone.length >= 2) {
    const prev = this.tox;
    this.tox = clamp(this.tox - 10, 0, 100);
    discardLog += ` ♻ Batch Discard: -10% Tox (${prev}% → ${this.tox}%).`;
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

  const handSizeBeforePlay = this.hand.length - cards.length; // cards already removed below
  this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
  this.pile.push(...cards); this.sel = []; this.plays--;
  if (cards.some(c => c.archetype === 'CRUNCH')) { this.weekCrunched = true; }
  for (const card of cards) {
    if (card.exhaust) this.exhausted.add(card.uid);
  }

  // quarterly_roadmap: STRATEGY cards permanently +0.05 Eff
  if ((this.deskItems||[]).some(d => d.id === 'quarterly_roadmap')) {
    for (const c of cards) {
      if (c.archetype === 'STRATEGY') {
        this._mutateCard(c.uid, card => ({ fx: {...card.fx, mult: Number(fmt1((card.fx.mult||0) + 0.05))} }));
        this.addLog('sy', `> 📑 [Quarterly Roadmap] [${c.name}] gained +0.05 Eff permanently`, true);
      }
    }
  }
  // red_stapler: first PRODUCTION card played each week → +20 chips permanently
  if (this.firstCardThisWeek && (this.deskItems||[]).some(d => d.id === 'red_stapler')) {
    const firstProd = cards.find(c => c.archetype === 'PRODUCTION');
    if (firstProd) {
      this._mutateCard(firstProd.uid, card => ({ fx: {...card.fx, chips: (card.fx.chips||0) + 20} }));
      this.addLog('sy', `> ❤️ [Red Stapler] [${firstProd.name}] gained +20 chips permanently`);
    }
  }

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

  const res = this.processTurn(cards, {}, handSizeBeforePlay);
  const prevWscore = this.wscore;
  const prevWb    = this.wb;
  const prevPassed = this.wscore >= this.kpi();
  const newWscore  = this.wscore + res.score;

  this.log.push(...res.log);

  // Card Leveling: increment playCount via _mutateCard, upgrade every 5 plays
  for (const c of cards) {
    const updated = this._mutateCard(c.uid, card => {
      const newCount = (card.playCount || 0) + 1;
      const prevLvl  = card.level || 0;
      if (prevLvl >= 3 || newCount % 5 !== 0) return { playCount: newCount };
      const newLvl = prevLvl + 1;
      let fxPatch;
      if (newLvl === 1)      fxPatch = { chips: (card.fx.chips||0) + 200 };
      else if (newLvl === 2) fxPatch = { mult: Number(fmt1((card.fx.mult||0) + 0.2)) };
      else                   fxPatch = { chips: (card.fx.chips||0) + 250, mult: Number(fmt1((card.fx.mult||0) + 0.1)) };
      return { playCount: newCount, level: newLvl, fx: {...card.fx, ...fxPatch} };
    });
    if (updated && updated.level > (c.level || 0)) {
      const stars = '★'.repeat(updated.level);
      const desc = updated.level === 1 ? '+200 Output base' : updated.level === 2 ? '+0.2 Eff base' : '+250 Output +0.1 Eff base';
      this.addLog('sy', `> ${stars} [${updated.name}] LEVEL ${updated.level}! ${desc}`);
    }
  }

  for (const c of cards) this.weekArchetypes[c.archetype] = (this.weekArchetypes[c.archetype] || 0) + 1;
  for (const c of cards.filter(c => c.exhaust)) this.addLog('ng', `> ⊗ [${c.name}] exhausted — gone until next week.`);

  // ── Brief per-play effects ────────────────────────────
  if (this.brief === 'digital_transformation') {
    const stratCards = cards.filter(c => c.archetype === 'STRATEGY');
    for (const sc of stratCards) {
      const allCopies = [...this.deck, ...this.hand, ...this.pile].filter(c => c.id === sc.id);
      for (const copy of allCopies) this._mutateCard(copy.uid, card => ({ fx: {...card.fx, chips: (card.fx.chips || 0) + 3} }));
      this.briefProgress++;
      this.addLog('sy', `> 💻 [Digital Transformation] [${sc.name}] — all copies +3 chips · ${this.briefProgress}/25`);
    }
    if (!this.briefCompleted && this.briefProgress >= 25) {
      this.briefCompleted = true;
      this.permMult = fmt1((this.permMult || 0) + 1.0);
      this.addLog('sy', `> 💻 [Digital Transformation] OBJECTIVE COMPLETE — +1.0 perm Eff → ${this.permMult}×`);
    }
  }
  if (this.brief === 'sustainable_growth') {
    if (res.briefProgressDelta) {
      this.briefProgress += res.briefProgressDelta;
      if (!this.briefCompleted && this.briefProgress >= 3000) {
        this.briefCompleted = true;
        this.permMult = fmt1((this.permMult || 0) + 2.0);
        this.addLog('sy', `> 🌱 [Sustainable Growth] OBJECTIVE COMPLETE — +2.0 perm Eff → ${this.permMult}×`);
      }
    }
  }

  // Compute scoring reveal intensity
  const cm = res.comboMult || 1.0;
  const comboLabel = (res.log.filter(e => e.cls === 'sy' && e.t.includes('COMBO')).pop()?.t.match(/\[([^\]]+)\]/) || [])[1] || null;
  const hasScale = res.scaleLog?.length > 0;
  let intensity = 'normal';
  if      (hasScale || cm >= 2.0 || res.score >= 12000) intensity = 'epic';
  else if (cm >= 1.5 || res.score >= 5000)  intensity = 'great';
  else if (cm >= 1.2 || res.score >= 2000)  intensity = 'good';

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
    scaleLabel: hasScale ? `⚡ ${res.scaleLog.join(' · ')}` : null,
    crossedKpi: !res.gameOver && !prevPassed && newWscore >= this.kpi(),
    activeSynergies: res.activeSynergies,
    deskActivations: res.deskActivations || [],
    briefActivations: res.briefActivations || [],
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
  // this.bo is no longer used; kept in state for email template compat only
  this.lastScore = d.pendingScore;
  ui.animateWscore(d.prevWscore, d.pendingWscore, d.intensity);
  if (d.pendingScore > 0) ui.showScorePopup(d.pendingScore, d.intensity, d.comboLabel);
  if (d.crossedKpi) ui.triggerKpiFlash();
  const announceLabel = d.scaleLabel || d.comboLabel;
  if ((d.intensity === 'epic' || d.intensity === 'great') && announceLabel) ui.showComboAnnouncer(announceLabel);
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

export function processTurn(cards, _unused = {}, handSizeBeforePlay = 0) {
  this.updateTeammateBehavior();
  const result = calcTurn(cards, {
    wb: this.wb, tox: this.tox,
    week: this.week, plays: this.plays,
    passives:                this.passives,
    teammate:                this.teammate,
    consecutiveSameTeammate: this.consecutiveSameTeammate,
    firstCardThisWeek:       this.firstCardThisWeek,
    firstCrunchUsed:         this.firstCrunchUsed,
    weekCrunchCount:         this.weekCrunchCount,
    permMult:                this.permMult,
    deskItems:               this.deskItems || [],
    handSize:                handSizeBeforePlay,
    totalPlayCount:          this.totalPlayCount || 0,
    lastMeetingType:         this.lastMeetingType || null,
    brief:                   this.brief || null,
    weekEffBonus:            this.weekEffBonus || 0,
    mode: 'real',
  });
  this.firstCrunchUsed   = result.firstCrunchUsed;
  this.weekCrunchCount   = result.weekCrunchCount;
  this.firstCardThisWeek = result.firstCardThisWeek;
  // Update lastMeetingType for secret meeting detection
  this.lastMeetingType = result.meetingType?.id || null;
  for (const uid of result.newExhausted) this.exhausted.add(uid);
  // Track which desk items fired this turn (for UI pulse)
  this.lastActivatedDeskIds = new Set();
  for (const entry of result.log) {
    const match = entry.t?.match(/\[([^\]]+)\]/);
    if (match) {
      const name = match[1].trim();
      const item = (this.deskItems || []).find(d => d.name === name);
      if (item) this.lastActivatedDeskIds.add(item.id);
    }
  }
  this.peakTox = Math.max(this.peakTox, result.tox);
  if (!result.gameOver) {
    this.totalRawChips += result.chips;
    this.totalMultSum  += result.mult;
    this.totalPlayCount++;
    // Desk Item: broken_printer — 0 Chips play → +6 Coins, -10 Tox
    if ((this.deskItems || []).some(d => d.id === 'broken_printer') && result.chips === 0 && result.score === 0) {
      this.coins += 6;
      this.tox = clamp(this.tox - 10, 0, 100);
      this.addLog('ok', `> 🖨️ [Broken Printer] Zero chips play — +6 CC → ${this.coins} CC, -10% Tox → ${this.tox}%`);
    }
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
//  UTILITY ACTIONS
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  DESK ITEM ACTIONS
// ═══════════════════════════════════════════════════════

export function claimDeskItem(itemId) {
  if (!this.deskItemOffer) return;
  const found = this.deskItemOffer.find(d => d.id === itemId);
  if (!found) return;
  this.deskItemOffer = null;
  if ((this.deskItems || []).length >= 5) {
    // Desk full — offer swap
    this.pendingDeskSwap = { item: found };
    this.addLog('i', `> 🗂️ Desk full (5/5) — choose an item to swap out for [${found.icon} ${found.name}].`);
    this._commit(); return;
  }
  this.deskItems = [...(this.deskItems || []), found];
  this.addLog('ok', `> 🗂️ [Desk] ${found.icon} ${found.name} placed on your desk.`);
  this._commit();
}

export function skipDeskOffer() {
  this.deskItemOffer = null;
  this.addLog('i', '> [Desk Offer] Passed on the item.');
  this._commit();
}

export function confirmDeskSwap(removeId) {
  if (!this.pendingDeskSwap) return;
  const { item } = this.pendingDeskSwap;
  this.pendingDeskSwap = null;
  const removedItem = (this.deskItems || []).find(d => d.id === removeId);
  this.deskItems = [...(this.deskItems || []).filter(d => d.id !== removeId), item];
  this.addLog('ok', `> 🗂️ Swapped: ${removedItem?.icon || ''} ${removedItem?.name || removeId} → ${item.icon} ${item.name}`);
  this._commit();
}

export function skipDeskSwap() {
  this.pendingDeskSwap = null;
  this.addLog('i', '> [Desk] Kept current desk layout.');
  this._commit();
}

export function useResignationLetter() {
  if (this.resignationLetterUsed) return;
  if (!(this.deskItems || []).some(d => d.id === 'resignation_letter')) return;
  if (this.phase !== 'play' && this.phase !== 'result') return;
  this.resignationLetterUsed = true;
  const needed = Math.max(0, this.kpi() - this.wscore);
  this.wscore = this.kpi();
  this.addLog('ok', `> 📄 [Resignation Letter] Auto-PASS activated — +${needed} Score → ${this.wscore} (KPI met)`);
  if (this.phase === 'play') this.transition('result');
  this._commit();
}

export function bankRemainingPlays() {
  if (this.plays <= 0 || this.phase !== 'result') return;
  this.bankingEverUsed = true;
  // Scaling reward: 4 + 6 + 8 + 10 + ... (triangular, +2 per play)
  let earned = 0;
  for (let i = 0; i < this.plays; i++) earned += 4 + i * 2;
  const toxRecovery = this.plays * 5;
  this.coins += earned;
  const prevTox = this.tox;
  this.tox = clamp(this.tox - toxRecovery, 0, 100);
  const actualToxDrop = prevTox - this.tox;
  let msg = `> 💰 Banked ${this.plays} play${this.plays > 1 ? 's' : ''} — +${earned} CC → ${this.coins} CC`;
  if (actualToxDrop > 0) msg += ` · -${actualToxDrop}% TOX → ${this.tox}%`;
  this.addLog('ok', msg);
  this.plays = 0;
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
    logDesc = `+${tier.chips} Output`;
  } else if (arch === 'STRATEGY' || arch === 'CRUNCH') {
    updater = c => ({ fx: {...c.fx, mult: Number(fmt1((c.fx.mult || 0) + tier.mult))} });
    logDesc = `+${tier.mult} Eff`;
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
    logDesc = `+${tier.chips} Output, +${tier.mult} Eff`;
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

export function openInbox() {
  this.inbox.forEach(e => { e.unread = false; });
  this.inboxSelected = 0;
  this.inboxOpen = true;
  this._commit();
}

export function closeInbox() {
  this.inboxOpen = false;
  this._commit();
}

export function selectInboxEmail(idx) {
  this.inboxSelected = idx;
  this._commit();
}

const _CHOICE_FX = {
  overtime_project: {
    accept(G) {
      G.nextWeekPlaysBonus = (G.nextWeekPlaysBonus || 0) + 3;
      G.pendingWbStart = (G.pendingWbStart || 0) - 10;
      G.addLog('ok', '> 📋 [Optional Project] Accepted — +3 plays next week, −10 WB at week start.');
    },
    decline(G) {
      G.addLog('i', '> 📋 [Optional Project] Passed. Brad has noted this. Somewhere.');
    },
  },
  wellness_survey: {
    honest(G) {
      G.tox = Math.max(0, G.tox - 10);
      G.nextWeekDiscsBonus = (G.nextWeekDiscsBonus || 0) + 1;
      G.addLog('ok', `> 📋 [HR Survey] Admitted workload — −10 Tox → ${G.tox}%, +1 Discard next week.`);
    },
    deny(G) {
      G.tox = Math.min(100, G.tox + 5);
      G.addLog('ng', `> 📋 [HR Survey] "Everything is fine." +5 Tox → ${G.tox}%.`);
    },
  },
  team_offsite: {
    attend(G) {
      G.wb  = Math.min(100, G.wb  + 20);
      G.tox = Math.max(0,   G.tox - 15);
      G.nextWeekPlaysBonus = (G.nextWeekPlaysBonus || 0) - 1;
      G.addLog('ok', `> 📋 [Offsite] Attended — +20 WB → ${G.wb}%, −15 Tox → ${G.tox}%, −1 play next week.`);
    },
    skip(G) {
      G.tox = Math.min(100, G.tox + 6);
      G.addLog('ng', `> 📋 [Offsite] Skipped. +6 Tox → ${G.tox}%. Engagement score updated.`);
    },
  },
  side_deal: {
    accept(G) {
      G.coins = (G.coins || 0) + 10;
      G.nextWeekKpiMult = 1.15;
      G.addLog('ok', `> 📋 [Side Deal] Accepted — +10 CC → ${G.coins} CC. KPI +15% next week.`);
    },
    decline(G) {
      G.addLog('i', "› 📋 [Side Deal] Declined. Kevin notes it. That's fine.");
    },
  },
};

export function resolveInboxChoice(emailId, choiceKey) {
  const email = (this.inbox || []).find(e => e.id === emailId);
  if (!email || !email.choices || email.choiceKey !== null) return;
  email.choiceKey = choiceKey;
  const handler = _CHOICE_FX[email.choiceId]?.[choiceKey];
  if (handler) handler(this);
  this._commit();
}

