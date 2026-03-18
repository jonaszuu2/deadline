// ═══════════════════════════════════════════════════════
//  GAME PHASES
//  Phase transitions, week flow, shop/boss/draft/teammate screens,
//  end-of-run logic. Mixed into Game.prototype in game.js.
// ═══════════════════════════════════════════════════════
import { PLAYS, DISCS, TOTAL_WEEKS, clamp, FAIL_BO } from '../data/constants.js';
import { nextUid, shuffle, fmt1, getUnlockedTier, setUnlockedTier } from './utils.js';
import { DESK_ITEMS_BY_RARITY, DESK_ITEMS_LIST } from '../data/deskItems.js';
import { makeDeck, pickShopItems } from './deck.js';
import { calculateFinalScore } from './scoring.js';
import { TEAMMATES_DB } from '../data/content.js';
import { BOSS_DB } from '../data/boss.js';
import { SHOP_DB } from '../data/shop.js';
import { DB } from '../data/cards.js';
import { CONTEXTS_DB, CONTEXTS_MONDAY, CONTEXTS_FRIDAY, CONTEXTS_GENERAL } from '../data/contexts.js';
import { ui } from './uiStore.js';

// ═══════════════════════════════════════════════════════
//  RUN SETUP
// ═══════════════════════════════════════════════════════

export function startRun() {
  // Remove class select overlay from DOM
  const ov = document.getElementById('class-ov'); if (ov) ov.remove();
  this.start();
}

export function start() {
  this.playsMax = PLAYS;
  this.plays = this.playsMax;
  this.deck = makeDeck();
  if (this.legacyCard) {
    const at = Math.floor(Math.random() * (this.deck.length + 1));
    this.deck.splice(at, 0, this.legacyCard);
  }
  this._drawWeekContexts();
  this.drawUp();
  const yearLabel = this.promotionRun ? ` — YEAR ${this.promotionYear}` : '';
  const kpiLabel  = this.promotionRun ? ` [KPI ×${this.kpiMultiplier.toFixed(2)}]` : '';
  this.addLog('d', `> DEADLINE™ v0.5${yearLabel} — Week 1/${TOTAL_WEEKS}. KPI target: ${this.kpi()}${kpiLabel}`);
  this.addLog('i', `> 👥 Solo week — a teammate will join you from Week 2.`);
  this.teammate = null;
  this.phase = 'play';
  this._commit();
}

// ═══════════════════════════════════════════════════════
//  TEAMMATE SELECTION
// ═══════════════════════════════════════════════════════

export function prepareTeammateChoice() {
  const ids = Object.keys(TEAMMATES_DB);
  this.teammateOptions = shuffle([...ids]).slice(0, 2);
  this.transition('teammate_choice');
  this._commit();
}

export function chooseTeammate(id) {
  if (!TEAMMATES_DB[id]) return;
  this.teammate = id;
  this.pendingSnitch = false;
  this.totalTeammateWeeks++;
  // Loyalty tracking
  if (id === this.loyaltyTeammateId) {
    this.consecutiveSameTeammate++;
    if (this.consecutiveSameTeammate === 3) this.addLog('sy', `> 🤝 Trusted Ally: ${TEAMMATES_DB[id]?.name} — 3 weeks together. +0.2 Eff/play`);
    else if (this.consecutiveSameTeammate === 5) this.addLog('sy', `> 🤝 Deep Partnership: ${TEAMMATES_DB[id]?.name} — 5 weeks together. +0.4 Eff/play`);
  } else {
    this.consecutiveSameTeammate = 1;
    this.loyaltyTeammateId = id;
  }
  const tm = TEAMMATES_DB[this.teammate];
  this.addLog('i', `> 👥 Teammate chosen: ${tm.fullName}`);
  // Sarah: tier-aware Tox change + remove 1-2 cards from hand
  if (this.teammate === 'sarah') {
    const tier = this.getTeammateTier();
    const toxChange = tier === 1 ? -20 : tier === 3 ? 15 : -10;
    const prev = this.tox;
    this.tox = clamp(this.tox + toxChange, 0, 100);
    if (toxChange < 0 && prev !== this.tox) {
      this.addLog('tl', `> 👻 [Sarah T${tier}] Filed a wellness report — -${prev - this.tox}% Toxicity → ${this.tox}%`);
    } else if (toxChange > 0) {
      this.addLog('tg', `> 👻 [Sarah T${tier} — MIA] Complete no-show fallout — +${this.tox - prev}% Toxicity → ${this.tox}%`);
    }
    const removals = tier === 3 ? 2 : 1;
    for (let i = 0; i < removals && this.hand.length > 0; i++) {
      const vi = Math.floor(Math.random() * this.hand.length);
      const victim = this.hand.splice(vi, 1)[0];
      this.pile.push(victim);
      this.addLog('ng', `> 👻 [Sarah] Pinched your "${victim.name}" — hand -1.`);
    }
  }
  // Ben buff: KPI reduction (tier-aware)
  if (this.teammate === 'ben') {
    const tier = this.getTeammateTier();
    const pct = tier === 1 ? 12 : tier === 3 ? 25 : 8;
    this.addLog(tier === 3 ? 'ng' : 'ok', `> 🙋 [Ben T${tier}] KPI this week: ${this.kpi()} (−${pct}%)`);
  }
  // Alex penalty tracker: tier-aware snitch
  if (this.teammate === 'alex') {
    this.alexWeeksCount++;
    const tier = this.getTeammateTier();
    const snitchEvery = tier === 1 ? 4 : tier === 3 ? 1 : 3;
    const snitchWb  = tier === 1 ? -10 : tier === 3 ? -25 : -15;
    const snitchTox = tier === 1 ?  8  : tier === 3 ?  20 :  10;
    if (this.alexWeeksCount % snitchEvery === 0) {
      this.wb  = clamp(this.wb  + snitchWb,  0, 100);
      this.tox = clamp(this.tox + snitchTox, 0, 100);
      this.pendingSnitch = true;
      this.addLog('ng', `> 🦈 [Alex T${tier} — HR Snitch] ${snitchWb} WB → ${this.wb}% | +${snitchTox} Tox → ${this.tox}%`);
    }
  }
  // Priya T3: +10 Tox at week start
  if (this.teammate === 'priya') {
    const tier = this.getTeammateTier();
    if (tier === 3) {
      this.tox = clamp(this.tox + 10, 0, 100);
      this.addLog('tg', `> 📊 [Priya T3 — Paralysis] Deadline overload — +10% Tox → ${this.tox}%`);
    } else if (tier === 1) {
      this.addLog('ok', `> 📊 [Priya T1 — Analyst] Ready to optimise your week.`);
    }
  }
  this.teammateTier = this.getTeammateTier();
  this.transition('play');
  this._commit();
  if (this.week === 1) {
    setTimeout(() => ui.showGuideTip?.('bars_intro'), 400);
    setTimeout(() => ui.showGuideTip?.('first_hand'), 5000);
  }
}

// ═══════════════════════════════════════════════════════
//  WEEK END / SHOP FLOW
// ═══════════════════════════════════════════════════════

export function openShop() {
  if (!this._processEndOfWeekStats()) return;
  const bt = this.justBreakthrough; this.justBreakthrough = false;
  const passed = this.weekHistory[this.weekHistory.length - 1]?.passed;
  if (passed) {
    this.draftPool = this._buildCardDraftPool();
    if (bt) ui.showComboAnnouncer('💥 BREAKTHROUGH!');
  } else {
    this.draftPool = [];
  }
  const bossId = {2:'early', 5:'midgame', 8:'late'}[this.week];
  if (bossId && !this.bossEncountersDone.has(this.week)) {
    this.transition('boss'); this.bossPhase = 'question'; this.bossQIdx = 0;
    this.bossAnswerLog = []; this.currentBoss = bossId;
    this._commit(); return;
  }
  this.shopItems = this._buildShopItems();
  this.transition('shop'); this._commit();
  if (this.week === 1) setTimeout(() => ui.showContextualTip?.('week_end_first'), 300);
  ui.checkFirstShopTutorial?.();
}

export function skipShop() {
  if (this.purchasedThisShop) return;
  if (this.phase === 'result') {
    const passed = this.wscore >= this.kpi();
    this.weekHistory.push({ week: this.week, passed });
    if (!passed) { this.failedWeeks++; this.bo = clamp(this.bo + FAIL_BO, 0, 100); }
  }
  this.coins += 3;
  this.addLog('ok', '> ⏭ Skipped shop — +3 Corpo Coins');
  this.startNextWeek();
}

export function startNextWeek() {
  this.week++; this.wscore = 0;
  this._drawWeekContexts();
  this.playsMax = PLAYS;
  this.plays = this.playsMax;
  this.discs = DISCS;
  // Toxicity Tier 3: Toxic Culture — -1 Discard
  if (this.tox >= 61 && this.tox < 91) {
    this.discs = Math.max(0, this.discs - 1);
    this.addLog('ng', `> ⚡ [Toxic Culture] Środowisko toksyczne — -1 Discard → ${this.discs}`);
  }
  this.weekCrunched = false; this.weekCrunchCount = 0; this.lastScore = null;
  this.exhausted = new Set(); this.discardComboMult = 0; this.firstDraw = true; this.supportInjected = false;
  this.weekArchetypes = {PRODUCTION:0, STRATEGY:0, CRUNCH:0, RECOVERY:0};
  this.archetypeMilestonesHit = new Set(); this.pressureReleaseUsed = false;
  this.firstCardThisWeek = true; this.firstCrunchUsed = false;
  // Boss extra play reward
  if (this.bossExtraPlay > 0) {
    this.plays += this.bossExtraPlay; this.playsMax += this.bossExtraPlay;
    this.addLog('ok', `> ⏱️ Boss Overtime — +${this.bossExtraPlay} play(s) this week.`);
    this.bossExtraPlay = 0;
  }
  // Held cards from Overtime Briefcase
  if (this.heldCards.length) {
    for (const c of this.heldCards) this.addLog('ok', `> 💼 [${c.name}] retrieved from briefcase.`);
    this.hand.push(...this.heldCards);
    this.heldCards = [];
  }
  this.drawUp();
  this.addLog('d', `> Week ${this.week}/${TOTAL_WEEKS}. KPI target: ${this.kpi()}`);
  if (this.week >= 2) {
    this.prepareTeammateChoice();
  } else {
    this.transition('play');
    this._commit();
  }
}

// ═══════════════════════════════════════════════════════
//  END-OF-WEEK STATS
// ═══════════════════════════════════════════════════════

export function _processEndOfWeekStats() {
  const passed = this.wscore >= this.kpi();
  this.weekHistory.push({ week: this.week, passed, score: this.wscore });
  if (this.wb >= 70) { this.wellnessWeeks++; this.addLog('wg', `> ❤ Wellness streak — WB ${this.wb}% ≥ 70% (${this.wellnessWeeks} wk)`); }
  this.purchasedThisShop = false;
  this.peakTox = Math.max(this.peakTox, this.tox);
  // Chronic Toxicity → Burnout bleed
  const toxBo = Math.floor(this.tox / 20);
  if (toxBo > 0) {
    this.bo = clamp(this.bo + toxBo, 0, 100);
    this.addLog('bo', `> ☣ Chronic Toxicity (${this.tox}%) — +${toxBo} Burnout → ${this.bo}%`);
    if (this.bo > 0) setTimeout(() => ui.showGuideTip?.('bo_first'), 300);
  }
  if (!passed) {
    this.failedWeeks++;
    const failBo = FAIL_BO;
    this.bo = clamp(this.bo + failBo, 0, 100);
    this.addLog('bo', `> Week ${this.week} FAILED (${this.failedWeeks}/3) — +${failBo} Burnout → ${this.bo}%`);
    if (this.failedWeeks === 1) setTimeout(() => ui.showContextualTip?.('kpi_fail'), 400);
    if (this.checkGameEndConditions(passed)) return false;
    const pct = this.wscore / this.kpi();
    const failReward = 2 + Math.floor(pct * 5);
    this.coins += failReward;
    this.addLog('i', `> Partial effort — +${failReward} CC (${Math.round(pct * 100)}% of target)`);
    this.consecutiveFails++;
    if (this.consecutiveFails >= 2) {
      this.kpiMult = Math.max(0.5, this.kpiMult - 0.15);
      this.bo = clamp(this.bo + 5, 0, 100);
      this.addLog('ng', `> Difficulty adjusted after ${this.consecutiveFails} fails — KPI now ${this.kpi()} (+5 BO → ${this.bo}%)`);
    }
  } else {
    this.consecutiveFails = 0;
    const overPct = this.wscore / this.kpi();
    const passReward = overPct >= 1.3 ? 12 : overPct >= 1.1 ? 9 : 6;
    this.coins += passReward;
    const bonusLabel = overPct >= 1.3 ? ' 🏆 Overperformance bonus!' : overPct >= 1.1 ? ' ⭐ Good work!' : '';
    if (!this.weekCrunched) { this.tox = clamp(this.tox - 5, 0, 100); this.addLog('tl', '> Clean week bonus — -5% Toxicity.'); }
    this.addLog('ok', `> Week ${this.week} PASSED! +${passReward} CC → ${this.coins} CC${bonusLabel}`);
    if (this.wscore >= this.kpi() * 2) {
      this.permMult = fmt1((this.permMult || 0) + 0.5);
      this.justBreakthrough = true;
      this.addLog('sy', `> 💥 BREAKTHROUGH! Revenue $${this.wscore.toLocaleString()} ≥ 2× Target — +0.5 permanent Eff → ${this.permMult}×`);
    }
    // SCALE_ON_KPI passive: each KPI pass → +0.3 perm Mult
    for (const p of this.passives) {
      if (p.passiveType === 'SCALE_ON_KPI') {
        this.permMult = fmt1((this.permMult || 0) + p.passiveVal);
        this.addLog('sy', `> 📈 [${p.name}] KPI passed — +${p.passiveVal} perm Eff → ${this.permMult}×`);
      }
    }
    if (this.checkGameEndConditions(passed)) return false;
  }
  for (const p of this.passives) {
    if (p.passiveType === 'TOX_PER_WEEK') {
      this.tox = clamp(this.tox - p.passiveVal, 0, 100);
      this.addLog('tl', `> ${p.name}: -${p.passiveVal}% Toxicity`);
    }
  }
  this._checkPassiveCombos();
  if (this.tox <= 30) {
    const bonus = 4;
    this.wb = clamp(this.wb + bonus, 0, 100);
    this.addLog('wg', `> ✅ [Professional] Niska toksyczność (${this.tox}%) → +${bonus} Wellbeing → ${this.wb}%`);
  }
  // ── Desk Item end-of-week effects ─────────────────────
  this._processDeskItemWeekEnd(passed);
  // ── Desk Item offer: WB ≥75% (always, pass or fail) ──
  if (this.wb >= 75 && (this.deskItems || []).length < 4) {
    this.deskItemOffer = this._buildDeskItemOffer(['COMMON', 'UNCOMMON']);
    this.addLog('ok', `> 🌟 [Wellness Reward] WB ${this.wb}% ≥ 75% — choose a Desk Item!`);
  }
  return true;
}

export function checkGameEndConditions(passed) {
  if (this.bo >= 100) {
    this.isTerminated = true; this.endCondition = 'burnout';
    this.checkRunUnlocks(); this.transition('review'); this._commit(); return true;
  }
  if (!passed && this.failedWeeks >= 3) {
    this.isTerminated = true; this.endCondition = 'terminated';
    this.checkRunUnlocks(); this.transition('review'); this._commit(); return true;
  }
  if (passed && this.week >= TOTAL_WEEKS) {
    this.isTerminated = false; this.endCondition = 'annual';
    this.checkRunUnlocks(); this.transition('review'); this._commit(); return true;
  }
  return false;
}

export function checkRunUnlocks() {
  // Card tier unlocks
  const s = calculateFinalScore(this);
  const cur = getUnlockedTier();
  let next = cur;
  if (cur < 1 && (this.week >= 4 || s.total >= 7000)) next = 1;
  if (cur < 2 && (this.week >= 7 || s.total >= 20000)) next = 2;
  if (cur < 3 && this.endCondition === 'annual') next = 3;
  if (next > cur) { setUnlockedTier(next); this.newUnlockTier = next; }
  else { this.newUnlockTier = null; }
}

// ═══════════════════════════════════════════════════════
//  DRAFT
// ═══════════════════════════════════════════════════════

export function claimDraftCard(cardId) {
  const cardDef = DB[cardId];
  if (!cardDef) return;
  if (this.deckSize() >= 24) {
    this.pendingDraftCard = cardId;
    this.pendingRemove = true;
    this.addLog('ng', `> ⚠ Deck full (${this.deckSize()}/24) — shred a card first, then draft card will be added.`);
    this._commit(); return;
  }
  const newCard = {...cardDef, uid:`${cardId}_${nextUid()}`};
  const at = Math.floor(Math.random() * (this.deck.length + 1));
  this.deck.splice(at, 0, newCard);
  this.addLog('ok', `> 📋 Draft: ${cardDef.name} added to deck. (${this.deckSize()}/24)`);
  this.draftPool = [];
  this._commit();
}

export function skipDraft() {
  this.addLog('ok', '> ✗ Draft skipped — deck unchanged.');
  this.draftPool = [];
  this._commit();
}

export function _buildCardDraftPool() {
  const tier = getUnlockedTier();
  const eligible = shuffle(Object.values(DB).filter(c => (c.tier || 0) <= tier));
  const pool = []; const seen = new Set();
  for (const c of eligible) {
    if (pool.length >= 4) break;
    if (!seen.has(c.id)) { pool.push({...c}); seen.add(c.id); }
  }
  // Synergy metadata: flag cards whose archetype would enable an ARCH_COUNT condition
  const allDeckCards = [...this.deck, ...this.hand, ...this.pile];
  const archSynergyMap = {};
  for (const dc of allDeckCards) {
    for (const syn of dc.synergies || []) {
      for (const cond of syn.conds || []) {
        if (cond.type === 'ARCH_COUNT' && cond.p?.arch) {
          if (!archSynergyMap[cond.p.arch]) archSynergyMap[cond.p.arch] = [];
          if (!archSynergyMap[cond.p.arch].includes(dc.name))
            archSynergyMap[cond.p.arch].push(dc.name);
        }
      }
    }
  }
  for (const c of pool) {
    const enables = archSynergyMap[c.archetype];
    if (enables?.length) c.synergyWith = enables[0];
  }
  return pool;
}

// ═══════════════════════════════════════════════════════
//  SHOP
// ═══════════════════════════════════════════════════════

export function buyItem(itemId) {
  // Desk item shop slot
  if (itemId === 'shop_desk_item') {
    const cost = 5;
    if (this.coins < cost) return;
    const offer = this._buildDeskItemOffer(['COMMON', 'UNCOMMON']);
    if (!offer || !offer.length) return;
    this.coins -= cost;
    this.purchasedThisShop = true;
    this.deskItemOffer = offer;
    this.shopItems = this.shopItems.filter(id => id !== 'shop_desk_item');
    this.addLog('ok', `> 🗂️ Desk Item — choose from 3 options. (-5 CC → ${this.coins} CC)`);
    this._commit(); return;
  }
  const item = SHOP_DB[itemId]; if (!item || this.coins < item.cost) return;
  this.coins -= item.cost;
  this.purchasedThisShop = true;
  if (item.type === 'CONSUMABLE') {
    const fx = item.effects;
    if (fx.wb)  this.wb  = clamp(this.wb  + fx.wb,  0, 100);
    if (fx.tox) this.tox = clamp(this.tox + fx.tox, 0, 100);
    if (fx.bo)  this.bo  = clamp(this.bo  + fx.bo,  0, 100);
    this.addLog(fx.logCls, `> ${fx.logMsg}`);
  } else if (item.type === 'PASSIVE') {
    this.passives.push({itemId, name:item.name, passiveType:item.passiveType, passiveVal:item.passiveVal});
    this.addLog('ok', `> Passive unlocked: ${item.name}`);
  } else if (item.type === 'ADD_CARD') {
    const newCard = {...item.card, uid:`${item.card.id}_${nextUid()}`};
    const at = Math.floor(Math.random() * (this.deck.length + 1));
    this.deck.splice(at, 0, newCard);
    this.addLog('ok', `> ${item.name} added to deck.`);
  } else if (item.type === 'REMOVE_CARD') {
    this.pendingRemove = true;
    this.addLog('ok', `> 🗑️ Performance Review — choose a card to permanently remove.`);
  } else if (item.type === 'HOLD_CARD') {
    this.pendingHold = true;
    this.addLog('ok', `> 💼 Overtime Briefcase — choose a card to hold for next week.`);
  } else if (item.type === 'UPGRADE_CARD') {
    this.pendingUpgrade = true;
    this.addLog('ok', `> ⬆️ Performance Upgrade — choose a card to improve permanently.`);
  }
  this.shopItems = this.shopItems.filter(id => id !== itemId);
  this._commit();
}

export function startRemoval() {
  const cost = this.freeRemovalUsed ? 3 : 0;
  if (cost > 0 && this.coins < cost) return;
  this.coins -= cost;
  this.freeRemovalUsed = true;
  this.pendingRemove = true;
  const label = cost === 0 ? 'FREE' : `-${cost} CC`;
  this.addLog('ok', `> 🗑️ Shredder activated (${label}) — choose a card to remove.`);
  this._commit();
}

export function _buildShopItems() {
  const ownedIds = this.passives.map(p => p.itemId);
  const items = pickShopItems(ownedIds);
  // Add a desk item slot if desk isn't full
  if ((this.deskItems || []).length < 4) {
    items.push('shop_desk_item');
  }
  return items;
}

// ═══════════════════════════════════════════════════════
//  BOSS
// ═══════════════════════════════════════════════════════

export function answerBossQuestion(optionIdx) {
  const boss = BOSS_DB[this.currentBoss];
  const q = boss.questions[this.bossQIdx];
  const opt = q.options[optionIdx];
  const fx = opt.fx;
  if (fx.wb)      this.wb     = clamp(this.wb     + fx.wb,     0, 100);
  if (fx.tox)     this.tox    = clamp(this.tox    + fx.tox,    0, 100);
  if (fx.bo)      this.bo     = clamp(this.bo     + fx.bo,     0, 100);
  if (fx.coins)   this.coins  = Math.max(0, this.coins + fx.coins);
  if (fx.kpiMult) this.kpiMult = fmt1(this.kpiMult * fx.kpiMult);
  const fxParts = [];
  if (fx.wb)      fxParts.push(`${fx.wb > 0 ? '+' : ''}${fx.wb} WB`);
  if (fx.tox)     fxParts.push(`${fx.tox > 0 ? '+' : ''}${fx.tox}% Tox`);
  if (fx.bo)      fxParts.push(`${fx.bo > 0 ? '+' : ''}${fx.bo}% BO`);
  if (fx.coins)   fxParts.push(`${fx.coins > 0 ? '+' : ''}${fx.coins} CC`);
  if (fx.kpiMult) fxParts.push(`KPI ×${fx.kpiMult}`);
  this.addLog('i', `> [${boss.name} Q${this.bossQIdx + 1}] "${opt.label}" — ${fxParts.join(', ')}`);
  this.bossAnswerLog.push({qId: q.id, optIdx: optionIdx, opt, fx});
  this.bossPhase = 'result';
  this._commit();
}

export function advanceBoss() {
  const boss = BOSS_DB[this.currentBoss];
  if (this.bossQIdx < boss.questions.length - 1) {
    this.bossQIdx++; this.bossPhase = 'question';
  } else {
    this.bossPhase = 'reward';
    this.bossRewardPool = this._buildBossRewardPool();
  }
  this._commit();
}

export function claimBossReward(rewardId) {
  // Special case: boss desk item offer
  if (rewardId === 'boss_desk_item') {
    const offer = this._buildDeskItemOfferRare();
    if (offer && offer.length && (this.deskItems || []).length < 4) {
      this.deskItemOffer = offer;
      this.addLog('ok', `> 🎁 Boss Reward: Rare Desk Item — choose one!`);
    }
    this.bossEncountersDone.add(this.week);
    this.bossChosenRewards.push(rewardId);
    this.shopItems = this._buildShopItems();
    this.transition('shop'); this._commit();
    if (this.week === 1) setTimeout(() => ui.showContextualTip?.('week_end_first'), 300);
    ui.checkFirstShopTutorial?.();
    return;
  }
  const reward = this.bossRewardPool.find(r => r.id === rewardId);
  if (!reward) return;
  if (reward.type === 'STAT_BOOST') {
    const fx = reward.fx;
    if (fx.wb)       this.wb       = clamp(this.wb      + fx.wb,       0, 100);
    if (fx.tox)      this.tox      = clamp(this.tox     + fx.tox,      0, 100);
    if (fx.bo)       this.bo       = clamp(this.bo      + fx.bo,       0, 100);
    if (fx.coins)    this.coins    = Math.max(0, this.coins + fx.coins);
    if (fx.permMult) this.permMult = fmt1((this.permMult || 0) + fx.permMult);
    this.addLog('ok', `> 🎁 Boss Reward claimed: ${reward.label}`);
  } else if (reward.type === 'EXTRA_PLAY') {
    const extra = reward.fx.extraPlays || 1;
    this.bossExtraPlay = (this.bossExtraPlay || 0) + extra;
    this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} — +${extra} play(s) next week!`);
  } else if (reward.type === 'PASSIVE') {
    this.passives.push({itemId: reward.id, name: reward.label, passiveType: reward.passiveType, passiveVal: reward.passiveVal});
    this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} passive installed.`);
  } else if (reward.type === 'ADD_CARD') {
    const cardDef = DB[reward.cardId];
    if (cardDef) {
      const newCard = {...cardDef, uid:`${reward.cardId}_${nextUid()}`};
      const at = Math.floor(Math.random() * (this.deck.length + 1));
      this.deck.splice(at, 0, newCard);
      this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} added to deck.`);
    }
  } else if (reward.type === 'REMOVE') {
    this.pendingRemove = true;
    this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} — choose a card to remove.`);
  } else if (reward.type === 'UPGRADE') {
    this.pendingUpgrade = true;
    this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} — choose a card to upgrade.`);
  } else if (reward.type === 'REMOVE_ADD') {
    this.pendingRemove = true;
    this.pendingDraftCard = true;
    this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} — remove a card, then draft a replacement.`);
  }
  this.bossEncountersDone.add(this.week);
  this.bossChosenRewards.push(rewardId);
  this.shopItems = this._buildShopItems();
  this.transition('shop'); this._commit();
  if (this.week === 1) setTimeout(() => ui.showContextualTip?.('week_end_first'), 300);
  ui.checkFirstShopTutorial?.();
}

export function _buildBossRewardPool() {
  const pool = [...BOSS_DB[this.currentBoss].rewardPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const rewards = pool.slice(0, 2);
  // Add desk item option if desk isn't full
  if ((this.deskItems || []).length < 4) {
    rewards.push({
      id: 'boss_desk_item',
      type: 'DESK_ITEM',
      icon: '🗂️',
      label: 'Rare Desk Item',
      desc: 'Pick 1 of 3 Rare/Legendary office items for your desk.',
    });
  } else if (rewards.length < 3) {
    rewards.push(pool[2]);
  }
  return rewards;
}

// ═══════════════════════════════════════════════════════
//  TARGETED DRAW
// ═══════════════════════════════════════════════════════

export function claimTargetedDraw(uid) {
  const card = this.targetedDrawOptions.find(c => c.uid === uid);
  if (!card) return;
  this.deck = this.deck.filter(c => c.uid !== uid);
  this.hand.push(card);
  this.targetedDrawOptions = [];
  this.transition('play');
  this.addLog('ch', `> 🎯 Targeted Draw: [${card.name}] pulled from deck.`);
  this.drawUp();
  this._commit();
}

// ═══════════════════════════════════════════════════════
//  DAILY CONTEXT SYSTEM
// ═══════════════════════════════════════════════════════

export function _drawWeekContexts() {
  const mon = shuffle([...CONTEXTS_MONDAY])[0];
  const fri = shuffle([...CONTEXTS_FRIDAY])[0];
  // Fill Tue/Wed/Thu from general pool — max 1 choice event per week
  const pool = shuffle([...CONTEXTS_GENERAL]);
  const middle = [];
  let choiceCount = 0;
  for (const id of pool) {
    if (middle.length >= 3) break;
    const ctx = CONTEXTS_DB[id];
    if (ctx.isChoice && choiceCount >= 1) continue;
    middle.push(id);
    if (ctx.isChoice) choiceCount++;
  }
  this.weekContexts = [mon, ...middle, fri];
  this.dayIndex = 0;
  this.pendingChoice = null;
  this.activeContextMods = {};
  this.activeContextPre  = {};
  this.activeContextPost = {};
  this.ctxMaxCards  = null;
  this.ctxBlockArch = null;
  this._setupDay(0);
}

export function _setupDay(idx) {
  const ctxId = this.weekContexts?.[idx];
  if (!ctxId) return;
  const ctx = CONTEXTS_DB[ctxId];
  if (!ctx) return;
  // Reset per-day overrides
  this.ctxMaxCards  = ctx.maxCardsPlay ?? null;
  this.ctxBlockArch = null;
  this.activeContextMods = {};
  this.activeContextPre  = {};
  this.activeContextPost = {};

  if (ctx.isChoice) {
    this.pendingChoice = ctxId;
    this._commit();
    return;
  }
  // Apply week-level effects immediately
  if (ctx.weekDiscExtra) {
    this.discs = Math.min(this.discs + ctx.weekDiscExtra, 7);
    this.addLog('ok', `> 📋 [${ctx.name}] +${ctx.weekDiscExtra} Discard tej tury → ${this.discs}`);
  }
  // Store pre/post effects and ctxMods for playSelected to use
  this.activeContextPre  = { preWbDelta: ctx.preWbDelta || 0, preToxDelta: ctx.preToxDelta || 0 };
  this.activeContextPost = { postCoins: ctx.postCoins || 0 };
  this.activeContextMods = ctx.ctxMods || {};
  this.addLog('sy', `> 📋 [${ctx.name}] ${ctx.desc}`);
}

export function resolveContextChoice(choiceId) {
  const ctxId = this.pendingChoice;
  if (!ctxId) return;
  const ctx = CONTEXTS_DB[ctxId];
  if (!ctx?.isChoice) return;
  const choice = ctx.choices.find(c => c.id === choiceId);
  if (!choice) return;
  this.pendingChoice = null;
  this.ctxMaxCards   = choice.maxCardsPlay ?? (ctx.maxCardsPlay ?? null);
  this.ctxBlockArch  = choice.blockArch ?? null;
  this.activeContextPre  = { preWbDelta: choice.preWbDelta || 0, preToxDelta: choice.preToxDelta || 0 };
  this.activeContextPost = { postCoins: choice.postCoins || 0 };
  this.activeContextMods = choice.ctxMods || {};
  this.addLog('sy', `> 📋 [${ctx.name}] → "${choice.label}" — ${choice.desc}`);
  this._commit();
}

// ═══════════════════════════════════════════════════════
//  RUN END
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  DESK ITEMS
// ═══════════════════════════════════════════════════════

export function _processDeskItemWeekEnd(passed) {
  const desk = id => (this.deskItems || []).some(d => d.id === id);
  // whiteboard: all 4 archetypes used ≥1×
  if (desk('whiteboard')) {
    const wa = this.weekArchetypes || {};
    const allFour = ['PRODUCTION','STRATEGY','CRUNCH','RECOVERY'].every(a => (wa[a] || 0) >= 1);
    if (allFour) {
      this.permMult = fmt1((this.permMult || 0) + 0.3);
      this.addLog('sy', `> 🖊️ [Whiteboard] All 4 archetypes used this week — +0.3 perm Eff → ${this.permMult}×`);
    }
  }
  // nameplate: pass → +5 coins
  if (desk('nameplate') && passed) {
    this.coins += 5;
    this.addLog('ok', `> 🪪 [Nameplate] KPI passed — +5 CC → ${this.coins} CC`);
  }
  // company_mug: pass → +0.1 perm mult
  if (desk('company_mug') && passed) {
    this.permMult = fmt1((this.permMult || 0) + 0.1);
    this.addLog('sy', `> 🏆 [Company Mug] KPI passed — +0.1 perm Eff → ${this.permMult}×`);
  }
  // mouse_pad: tox ≤ 10 → +0.5 perm mult
  if (desk('mouse_pad') && this.tox <= 10) {
    this.permMult = fmt1((this.permMult || 0) + 0.5);
    this.addLog('sy', `> 🖱️ [Mouse Pad] Clean week (Tox ${this.tox}%) — +0.5 perm Eff → ${this.permMult}×`);
  }
}

export function _buildDeskItemOffer(rarities = ['COMMON', 'UNCOMMON']) {
  const ownedIds = new Set((this.deskItems || []).map(d => d.id));
  const pool = DESK_ITEMS_LIST.filter(d => rarities.includes(d.rarity) && !ownedIds.has(d.id));
  if (!pool.length) return null;
  const shuffled = shuffle([...pool]);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

export function _buildDeskItemOfferRare() {
  const ownedIds = new Set((this.deskItems || []).map(d => d.id));
  const pool = DESK_ITEMS_LIST.filter(d => ['RARE','LEGENDARY'].includes(d.rarity) && !ownedIds.has(d.id));
  if (!pool.length) return this._buildDeskItemOffer(['UNCOMMON', 'RARE']);
  const shuffled = shuffle([...pool]);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

export function restart() {
  ui.resetCtxTips?.();
  const g = new this.constructor();
  window.G = g;
  g.startRun();
}

export function acceptPromotion() {
  const s = calculateFinalScore(this);
  const allCards = [...this.deck, ...this.pile, ...this.hand];
  const best = allCards.slice().sort((a,b) => (b.level||0)-(a.level||0) || (b.fx.chips||0)-(a.fx.chips||0))[0];
  const legacy = best ? {...best, uid:`legacy_${nextUid()}`, rarity:'LEGENDARY'} : null;
  const g = new this.constructor();
  g.promotionRun = true;
  g.promotionYear = this.promotionYear + 1;
  g.kpiMultiplier = parseFloat((this.kpiMultiplier * 1.25).toFixed(4));
  g.previousRunScore = (this.previousRunScore || 0) + s.total;
  g.legacyCard = legacy;
  window.G = g;
  g.startRun();
}
