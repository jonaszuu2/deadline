import { PLAYS, DISCS, HAND, MAX_SEL, TOX_DMG, FAIL_BO, TOTAL_WEEKS, CONTRACT_POOL, KPI, clamp } from './data/constants.js';
import { nextUid, shuffle, getUnlockedTier, setUnlockedTier, fmt1 } from './engine/utils.js';
import { makeDeck, makeClassDeck, wbEff, pickShopItems, DECK_BLUEPRINT } from './engine/deck.js';
import { calcTurn, simulateTurn, getRiskLevel } from './engine/calcTurn.js';
import { calculateFinalScore, calculateCareerOutcome } from './engine/scoring.js';
import { CLASS_DB, COMP_DB, TEAMMATES_DB } from './data/content.js';
import { BOSS_DB } from './data/boss.js';
import { SHOP_DB } from './data/shop.js';
import { DB } from './data/cards.js';

// UI functions resolved lazily at runtime to avoid circular dependency issues.
// These are set by main.js after all modules have loaded.
let render, scrollLog, showScorePopup, animateWscore, showWbDamage, showComboAnnouncer, triggerKpiFlash, showClassScreen, showUpgradeFlash, checkFirstShopTutorial, showContextualTip, resetCtxTips;

export function _setUIFunctions(fns) {
  render = fns.render;
  scrollLog = fns.scrollLog;
  showScorePopup = fns.showScorePopup;
  animateWscore = fns.animateWscore;
  showWbDamage = fns.showWbDamage;
  showComboAnnouncer = fns.showComboAnnouncer;
  triggerKpiFlash = fns.triggerKpiFlash;
  showClassScreen = fns.showClassScreen;
  checkFirstShopTutorial = fns.checkFirstShopTutorial;
  showContextualTip = fns.showContextualTip;
  resetCtxTips = fns.resetCtxTips;
}

export class Game {
  constructor() {
    this.week = 1; this.wb = 100; this.tox = 0; this.bo = 0;
    this.wscore = 0; this.playsMax = PLAYS; this.plays = PLAYS; this.discs = DISCS; this.coins = 0;
    this.passives = []; this.exhausted = new Set(); this.shopItems = [];
    this.purchasedThisShop = false; // track purchase to block skip

    this.phase = 'play'; this.deck = []; this.pile = []; this.hand = [];
    this.sel = []; this.log = []; this.lastScore = null; this.weekCrunched = false; this.weekCrunchCount = 0;
    this.consecutiveFails = 0; this.kpiMult = 1.0; this.supportInjected = false; this.firstDraw = true;
    // Competency state
    this.competencies = []; this.discardMultStack = 0; this.discardComboMult = 0; this.firstCrunchUsed = false; this.firstCardThisWeek = true;
    // Teammate state
    this.teammate = null; this.teammateOptions = []; this.alexWeeksCount = 0; this.pendingSnitch = false; this.teammateTier = 1;
    this.consecutiveSameTeammate = 0; this.loyaltyTeammateId = null;
    // End-game tracking
    this.totalRawChips = 0; this.peakTox = 0; this.totalTeammateWeeks = 0;
    this.totalMultSum = 0; this.totalPlayCount = 0; this.isTerminated = false;
    this.failedWeeks = 0; this.endCondition = 'annual'; // 'annual'|'burnout'|'terminated'
    this.weekHistory = []; // [{week:N, passed:bool}]
    // Strategic mechanics
    this.pendingRemove = false; this.pendingHold = false; this.heldCards = [];
    // Boss encounter
    this.bossEncounterDone = false; this.bossPhase = 'question'; this.bossQIdx = 0;
    this.bossAnswerLog = []; this.bossChosenRewards = []; this.bossRewardPool = [];
    this.bossExtraPlay = false; this.permMult = 0;
    // Draft state
    this.draftPool = []; this.pendingDraftCard = null;
    // Class state
    this.playerClass = null; this.classBlueprint = null;
    // Class Track
    this.classTrack = 0; this.classTrackLevel = 0;
    // Economy state
    this.freeRemovalUsed = false;
    // Decision Depth: Targeted Draw
    this.pendingTargetedDraw = false; this.targetedDrawOptions = [];
    // Decision Depth: Weekly Archetype Track
    this.weekArchetypes = {PRODUCTION:0,STRATEGY:0,CRUNCH:0,RECOVERY:0};
    this.archetypeMilestonesHit = new Set();
    // Decision Depth: misc
    this.pendingUpgrade = false; this.pressureReleaseUsed = false;
    // Build Identity: passive combo discovery
    this.discoveredCombos = new Set();
    // Power Progression: power spike events
    this.powerEventsDone = new Set(); this.powerEventOptions = [];
    // Power Progression: breakthrough flag
    this.justBreakthrough = false;
    // Overlay sort state
    this.overlaySort = 'name';
    // Run contracts (3 picked per run)
    this.runContracts = [];
    this.contractBonusPts = 0;
    // Promotion Run meta-state
    this.kpiMultiplier = 1.0;
    this.promotionRun = false;
    this.promotionYear = 1;
    this.legacyCard = null;
    this.previousRunScore = 0;
    // Contract tracking flags
    this.achievedBreakthrough = false;
    this.achievedLv3 = false;
    this.crunchPlayed = false;
    // Recovery path: weeks ending with WB ≥ 70%
    this.wellnessWeeks = 0;
  }

  getTeammateTier() { return this.tox >= 81 ? 3 : this.tox >= 31 ? 2 : 1; }

  updateTeammateBehavior() {
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

  kpi() {
    const benMult = this.teammate === 'ben'
      ? (this.getTeammateTier() === 1 ? 0.88 : this.getTeammateTier() === 3 ? 0.75 : 0.92)
      : 1.0;
    return Math.floor(KPI[this.week - 1] * this.kpiMult * benMult * this.kpiMultiplier);
  }
  hasComp(id) { return this.competencies.includes(id); }
  maxSel()  {
    const base = MAX_SEL + ((this.hasComp('comp_bigpicture') || this.hasComp('comp_mule')) ? 1 : 0);
    return base + (this.tox >= 61 && this.tox < 91 ? 1 : 0); // Toxic Culture: +1 karta per grana tura
  }

  prepareTeammateChoice() {
    const ids = Object.keys(TEAMMATES_DB);
    const shuffled = shuffle([...ids]);
    this.teammateOptions = shuffled.slice(0, 2);
    this.phase = 'teammate_choice';
    this._commit();
  }

  chooseTeammate(id) {
    this.teammate = id;
    this.pendingSnitch = false;
    this.totalTeammateWeeks++;
    // Loyalty tracking
    if (id === this.loyaltyTeammateId) {
      this.consecutiveSameTeammate++;
      if (this.consecutiveSameTeammate === 3) this.addLog('sy', `> 🤝 Trusted Ally: ${TEAMMATES_DB[id]?.name} — 3 weeks together. +0.2 Mult/play`);
      else if (this.consecutiveSameTeammate === 5) this.addLog('sy', `> 🤝 Deep Partnership: ${TEAMMATES_DB[id]?.name} — 5 weeks together. +0.4 Mult/play`);
    } else {
      this.consecutiveSameTeammate = 1;
      this.loyaltyTeammateId = id;
    }
    const tm = TEAMMATES_DB[this.teammate];
    this.addLog('i', `> 👥 Teammate chosen: ${tm.fullName}`);
    // Sarah: tier-aware Tox change at week start + remove 1-2 cards from hand
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
    // Priya T3: +10 Tox at week start (deadline overload)
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
    this.phase = 'play';
    this._commit();
  }

  startWithClass(classId) {
    const cls = CLASS_DB[classId];
    if (!cls) return;
    this.playerClass = classId;
    this.classBlueprint = cls.deck;
    this.competencies = cls.passiveIds;
    // Push simple stat passives into the passive system
    const simplePassiveTypes = ['COMP_PROD_CHIPS_PCT', 'COMP_RECOVERY_CHIPS', 'COMP_STRATEGY_BOOST'];
    for (const id of cls.passiveIds) {
      const c = COMP_DB[id];
      if (c && simplePassiveTypes.includes(c.passiveType)) {
        this.passives.push({itemId:id, name:c.name, passiveType:c.passiveType, passiveVal:c.passiveVal, isComp:true});
      }
    }
    const ov = document.getElementById('class-ov'); if (ov) ov.remove();
    this.playsMax = PLAYS + (this.hasComp('comp_mule') ? 1 : 0);
    this.start();
  }

  start() {
    this.playsMax = PLAYS + (this.hasComp('comp_mule') ? 1 : 0);
    this.plays = this.playsMax;
    this.deck = this.classBlueprint ? makeClassDeck(this.classBlueprint) : makeDeck();
    // Inject legacy card at random position if promotion run
    if (this.legacyCard) {
      const at = Math.floor(Math.random() * (this.deck.length + 1));
      this.deck.splice(at, 0, this.legacyCard);
    }
    // Pick 3 random run contracts
    const pool = shuffle([...CONTRACT_POOL]);
    this.runContracts = pool.slice(0, 3).map(c => ({...c, achieved: false}));
    this.drawUp();
    const yearLabel = this.promotionRun ? ` — YEAR ${this.promotionYear}` : '';
    const kpiLabel = this.promotionRun ? ` [KPI ×${this.kpiMultiplier.toFixed(2)}]` : '';
    this.addLog('d', `> DEADLINE™ v0.5${yearLabel} — Week 1/${TOTAL_WEEKS}. KPI target: ${this.kpi()}${kpiLabel}`);
    this.prepareTeammateChoice();
  }

  drawUp() {
    if (this.firstDraw && this.hand.length === 0 && this.deck.length > 0) {
      this.firstDraw = false;
      const hasScoring = this.deck.some(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
      if (hasScoring) {
        const deckLen = this.deck.length;
        const tail = this.deck.slice(-Math.min(HAND, deckLen));
        const tailHasScoring = tail.some(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
        if (!tailHasScoring) {
          const scoringIdx = this.deck.findIndex(c => c.archetype === 'PRODUCTION' || c.archetype === 'STRATEGY');
          if (scoringIdx >= 0) {
            const swapPos = deckLen - 1 - Math.floor(Math.random() * Math.min(HAND, deckLen));
            [this.deck[scoringIdx], this.deck[swapPos]] = [this.deck[swapPos], this.deck[scoringIdx]];
          }
        }
      }
    }
    while (this.hand.length < HAND) {
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

  toggle(uid) {
    const i = this.sel.indexOf(uid);
    if (i >= 0) this.sel.splice(i, 1);
    else if (this.sel.length < this.maxSel()) this.sel.push(uid);
    this._commit();
  }

  discardSelected() {
    if (this.discs <= 0 || !this.sel.length) return;
    const gone = this.hand.filter(c => this.sel.includes(c.uid));
    this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
    this.pile.push(...gone); this.sel = []; this.discs--;
    const chipBonus = gone.length * 20; this.wscore += chipBonus;
    let discardLog = `> Discarded ${gone.length} card(s) — +${chipBonus} Chips.`;
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
    // Targeted Draw: if deck has 3+ cards, offer choice instead of random draw
    if (this.deck.length >= 3) {
      this.targetedDrawOptions = this.deck.slice(-3).reverse(); // top 3 cards
      this.phase = 'targeted_draw';
      this.addLog('ch', discardLog + ' Choose a card to draw.');
      this._commit();
    } else {
      this.addLog('ch', discardLog + ' Drawing...');
      this.drawUp(); this._commit();
    }
  }

  playSelected() {
    if (this.plays <= 0 || !this.sel.length || this.phase !== 'play') return;
    const cards = this.sel.map(uid => this.hand.find(c => c.uid === uid)).filter(Boolean);
    this.hand = this.hand.filter(c => !this.sel.includes(c.uid));
    this.pile.push(...cards); this.sel = []; this.plays--;
    if (cards.some(c => c.archetype === 'CRUNCH')) { this.weekCrunched = true; this.crunchPlayed = true; }
    for (const card of cards) if (card.exhaust) this.exhausted.add(card.uid);
    // ── Gary penalty: "presents" cards before scoring (tier-aware) ──
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
    this.wscore += res.score; this.wb = res.wb; this.tox = res.tox; this.bo = res.bo;
    this.lastScore = res.score; this.log.push(...res.log);
    // ── Card Leveling: increment playCount, apply upgrade every 5 plays ──
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
    for (const c of cards) this.weekArchetypes[c.archetype] = (this.weekArchetypes[c.archetype] || 0) + 1;
    this._checkArchetypeMilestones();
    for (const c of cards.filter(c => c.exhaust)) this.addLog('ng', `> ⊗ [${c.name}] exhausted — gone until next week.`);
    if (!res.gameOver && !prevPassed && this.wscore >= this.kpi()) triggerKpiFlash();
    if (res.gameOver) { this.isTerminated = true; this.phase = 'review'; }
    else if (this.wscore >= this.kpi() || this.plays <= 0) this.phase = 'result';
    else { this.drawUp(); }
    this._commit();
    // ── WB damage feedback ──
    if (prevWb > res.wb) showWbDamage(prevWb - res.wb);
    if (!res.gameOver && res.score > 0) {
      const cm = res.comboMult || 1.0;
      const comboLabel = (res.log.filter(e => e.cls === 'sy' && e.t.includes('COMBO')).pop()?.t.match(/\[([^\]]+)\]/) || [])[1] || null;
      let intensity = 'normal';
      if      (cm >= 2.0 || res.score >= 500) intensity = 'epic';
      else if (cm >= 1.5 || res.score >= 300) intensity = 'great';
      else if (cm >= 1.2 || res.score >= 150) intensity = 'good';
      showScorePopup(res.score, intensity, comboLabel);
      animateWscore(prevWscore, this.wscore, intensity);
      // ── Combo announcer for great/epic plays ──
      if ((intensity === 'epic' || intensity === 'great') && comboLabel) showComboAnnouncer(comboLabel);
    }
    // ── Contextual tutorial tips ──
    if (!res.gameOver) {
      const toxDmgFired = res.log.some(e => e.cls === 'dm' && e.t.includes('TOXIC'));
      if (toxDmgFired) setTimeout(() => showContextualTip?.('tox_damage'), 600);
      else if (res.wb < 60) setTimeout(() => showContextualTip?.('low_wb'), 600);
      const synergyFired = res.activeSynergies && res.activeSynergies.length > 0;
      if (synergyFired) setTimeout(() => showContextualTip?.('first_synergy'), 900);
    }
  }

  _advanceClassTrack(cards, res) {
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

  _applyClassTrackReward(level) {
    const rewards = {
      grinder: [
        null,
        {coins:3,       msg:'⚙ [GRINDER L1] Momentum — +3 CC'},
        {plays:1,       msg:'⚙ [GRINDER L2] Second Wind — +1 Play this week'},
        {wb:20,         msg:'⚙ [GRINDER L3] Recovery Break — +20 Wellbeing'},
        {tox:-15,       msg:'⚙ [GRINDER L4] Clean Workspace — -15% Toxicity'},
        {permMult:1.0,  msg:'⚙ [GRINDER L5] MASTERY UNLOCKED — +1.0 permanent Mult'},
      ],
      strategist: [
        null,
        {coins:3,       msg:'🎯 [STRATEGIST L1] Insight — +3 CC'},
        {permMult:0.5,  msg:'🎯 [STRATEGIST L2] Leverage — +0.5 permanent Mult'},
        {wb:20,tox:-10, msg:'🎯 [STRATEGIST L3] Strategic Recovery — +20 WB, -10% Tox'},
        {plays:1,       msg:'🎯 [STRATEGIST L4] Overtime Approved — +1 Play this week'},
        {permMult:1.0,  msg:'🎯 [STRATEGIST L5] DOMINANCE UNLOCKED — +1.0 permanent Mult'},
      ],
      survivor: [
        null,
        {tox:-15,       msg:'☣ [SURVIVOR L1] Tox Flush — -15% Toxicity'},
        {wb:25,         msg:'☣ [SURVIVOR L2] Resilience — +25 Wellbeing'},
        {tox:-20,       msg:'☣ [SURVIVOR L3] Deep Cleanse — -20% Toxicity'},
        {wb:35,         msg:'☣ [SURVIVOR L4] Iron Will — +35 Wellbeing'},
        {wb:25,bo:-20,  msg:'☣ [SURVIVOR L5] IMMORTAL UNLOCKED — +25 WB, -20 Burnout'},
      ],
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

  // ── Passive combo discovery — called at end of each week ──
  _checkPassiveCombos() {
    const owned = new Set(this.passives.map(p => p.itemId));
    const combos = [
      {id:'combo_ergo',    needs:['sh_chair','sh_keyboard'],
       msg:'★ PASSIVE COMBO: Ergonomics Expert (Chair + Keyboard) — +0.5 permanent Mult',
       apply: g => { g.permMult = fmt1((g.permMult||0)+0.5); }},
      {id:'combo_zen',     needs:['sh_plant','sh_cooler'],
       msg:'★ PASSIVE COMBO: Zen Office (Plant + Cooler) — -10% Toxicity',
       apply: g => { g.tox = clamp(g.tox-10,0,100); }},
      {id:'combo_techLead',needs:['sh_keyboard','sh_coach'],
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

  // ── processTurn: thin wrapper around calcTurn (single source of truth) ──
  processTurn(cards) {
    this.updateTeammateBehavior();
    const result = calcTurn(cards, {
      wb: this.wb, tox: this.tox, bo: this.bo,
      week: this.week, plays: this.plays,
      passives:          this.passives,
      competencies:      this.competencies,
      teammate:                this.teammate,
      consecutiveSameTeammate: this.consecutiveSameTeammate,
      discardComboMult:  this.discardComboMult,
      discardMultStack:  this.discardMultStack,
      firstCardThisWeek: this.firstCardThisWeek,
      firstCrunchUsed:   this.firstCrunchUsed,
      weekCrunchCount:   this.weekCrunchCount,
      permMult:          this.permMult,
      mode: 'real',
    });
    // Apply mutable flags back from result
    this.discardComboMult = 0; // always consumed on play
    if (this.hasComp('comp_riskmitigator') && this.discardMultStack > 0) this.discardMultStack = 0;
    this.firstCrunchUsed  = result.firstCrunchUsed;
    this.weekCrunchCount  = result.weekCrunchCount;
    this.firstCardThisWeek = result.firstCardThisWeek;
    for (const uid of result.newExhausted) this.exhausted.add(uid);
    // Update end-game tracking stats
    if (!result.gameOver) {
      this.totalRawChips += result.chips;
      this.totalMultSum  += result.mult;
      this.totalPlayCount++;
      this.peakTox = Math.max(this.peakTox, result.tox);
    } else {
      this.peakTox = Math.max(this.peakTox, result.tox);
    }
    return result;
  }

  // ── Targeted Draw: player picks 1 of 3 top deck cards ──
  claimTargetedDraw(uid) {
    const card = this.targetedDrawOptions.find(c => c.uid === uid);
    if (!card) return;
    this.deck = this.deck.filter(c => c.uid !== uid);
    this.hand.push(card);
    this.targetedDrawOptions = [];
    this.phase = 'play';
    this.addLog('ch', `> 🎯 Targeted Draw: [${card.name}] pulled from deck.`);
    this.drawUp();
    this._commit();
  }

  // ── Archetype milestone bonuses ──
  _checkArchetypeMilestones() {
    const T = 4;
    if (!this.archetypeMilestonesHit.has('PRODUCTION') && (this.weekArchetypes.PRODUCTION || 0) >= T) {
      this.archetypeMilestonesHit.add('PRODUCTION');
      this.wscore += 150;
      this.addLog('sy', '> ★ PRODUCTION MILESTONE — +150 bonus pts!');
    }
    if (!this.archetypeMilestonesHit.has('STRATEGY') && (this.weekArchetypes.STRATEGY || 0) >= T) {
      this.archetypeMilestonesHit.add('STRATEGY');
      this.wscore += 120;
      this.addLog('sy', '> ★ STRATEGY MILESTONE — +120 bonus pts!');
    }
    if (!this.archetypeMilestonesHit.has('CRUNCH') && (this.weekArchetypes.CRUNCH || 0) >= T) {
      this.archetypeMilestonesHit.add('CRUNCH');
      this.wscore += 200;
      this.wb = clamp(this.wb - 10, 0, 100);
      this.addLog('sy', '> ★ CRUNCH MILESTONE — +200 pts but −10 WB!');
    }
    if (!this.archetypeMilestonesHit.has('RECOVERY') && (this.weekArchetypes.RECOVERY || 0) >= T) {
      this.archetypeMilestonesHit.add('RECOVERY');
      this.wb = clamp(this.wb + 15, 0, 100);
      this.addLog('sy', '> ★ RECOVERY MILESTONE — +15 Wellbeing!');
    }
  }

  // ── Bank remaining plays for CC ──
  bankRemainingPlays() {
    if (this.plays <= 0 || this.phase !== 'result') return;
    const earned = this.plays * 4;
    this.coins += earned;
    this.addLog('ok', `> 💰 Banked ${this.plays} play${this.plays > 1 ? 's' : ''} — +${earned} CC → ${this.coins} CC`);
    this.plays = 0;
    this._commit();
  }

  // ── Permanently upgrade a card ──
  upgradeCard(uid) {
    const card = [...this.deck, ...this.pile].find(c => c.uid === uid);
    if (!card) return;
    card.fx = {...card.fx, chips: (card.fx.chips || 0) + 80, mult: Number(fmt1((card.fx.mult || 0) + 0.3))};
    this.pendingUpgrade = false;
    this.addLog('ok', `> ⬆️ [${card.name}] upgraded: +80 Chips, +0.3 Mult permanently.`);
    this._commit();
  }

  // ── Pressure Release: spend 1 discard → -15% Tox ──
  releasePressure() {
    if (this.pressureReleaseUsed || this.discs <= 0 || this.phase !== 'play') return;
    this.discs--;
    this.pressureReleaseUsed = true;
    this.tox = clamp(this.tox - 15, 0, 100);
    this.addLog('tl', `> 💨 [Pressure Release] −15% Toxicity → ${this.tox}% (1 discard used)`);
    this._commit();
  }

  checkRunUnlocks() {
    // Evaluate run contracts
    let bonusPts = 0;
    for (const c of this.runContracts) {
      c.achieved = c.check(this);
      if (c.achieved) bonusPts += c.pts;
    }
    this.contractBonusPts = bonusPts;
    // Card tier unlocks
    const s = calculateFinalScore(this);
    const cur = getUnlockedTier();
    let next = cur;
    if (cur < 1 && (this.week >= 4 || s.total >= 1500)) next = 1;
    if (cur < 2 && (this.week >= 7 || s.total >= 4000)) next = 2;
    if (cur < 3 && this.endCondition === 'annual') next = 3;
    if (next > cur) { setUnlockedTier(next); this.newUnlockTier = next; }
    else { this.newUnlockTier = null; }
  }

  checkGameEndConditions(passed) {
    // Condition 2: Burnout 100% → System Failure (Balance Guard #5)
    if (this.bo >= 100) { this.isTerminated = true; this.endCondition = 'burnout'; this.checkRunUnlocks(); this.phase = 'review'; this._commit(); return true; }
    // Condition 1: 3 failed weeks → Termination (Balance Guard #7)
    if (!passed && this.failedWeeks >= 3) { this.isTerminated = true; this.endCondition = 'terminated'; this.checkRunUnlocks(); this.phase = 'review'; this._commit(); return true; }
    // Condition 3: Week 10 complete → Annual Review
    if (passed && this.week >= TOTAL_WEEKS) { this.isTerminated = false; this.endCondition = 'annual'; this.checkRunUnlocks(); this.phase = 'review'; this._commit(); return true; }
    return false;
  }

  _processEndOfWeekStats() {
    const passed = this.wscore >= this.kpi();
    this.weekHistory.push({ week: this.week, passed, score: this.wscore });
    if (this.wb >= 70) { this.wellnessWeeks++; this.addLog('wg', `> ❤ Wellness streak — WB ${this.wb}% ≥ 70% (${this.wellnessWeeks} wk)`); }
    this.purchasedThisShop = false;
    this.peakTox = Math.max(this.peakTox, this.tox);
    // ── Chronic Toxicity → Burnout bleed ──
    const toxBo = Math.floor(this.tox / 20);
    if (toxBo > 0) {
      this.bo = clamp(this.bo + toxBo, 0, 100);
      this.addLog('bo', `> ☣ Chronic Toxicity (${this.tox}%) — +${toxBo} Burnout → ${this.bo}%`);
    }
    if (!passed) {
      this.failedWeeks++;
      this.bo = clamp(this.bo + FAIL_BO, 0, 100);
      this.addLog('bo', `> Week ${this.week} FAILED (${this.failedWeeks}/3) — +${FAIL_BO} Burnout → ${this.bo}%`);
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
      // Breakthrough: score ≥ 2× KPI → permanent Mult bonus
      if (this.wscore >= this.kpi() * 2) {
        this.permMult = fmt1((this.permMult || 0) + 0.5);
        this.justBreakthrough = true;
        this.achievedBreakthrough = true;
        this.addLog('sy', `> 💥 BREAKTHROUGH! Score ${this.wscore} ≥ 2× KPI — +0.5 permanent Mult → ${this.permMult}×`);
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
    // ── Toxicity Tier 1: Professional — bonus WB za niską toksyczność ──
    if (this.tox <= 30) {
      const bonus = 4;
      this.wb = clamp(this.wb + bonus, 0, 100);
      this.addLog('wg', `> ✅ [Professional] Niska toksyczność (${this.tox}%) → +${bonus} Wellbeing → ${this.wb}%`);
    }
    return true;
  }

  _buildCardDraftPool() {
    const tier = getUnlockedTier();
    const eligible = Object.values(DB).filter(c => (c.tier || 0) <= tier);
    // Class-biased draft: 70% preferred archetype, 30% wild
    const classArch = {grinder:['PRODUCTION'], strategist:['STRATEGY','CRUNCH'], survivor:['RECOVERY']};
    const preferred = this.playerClass ? classArch[this.playerClass] || [] : [];
    const preferredCards = preferred.length ? shuffle(eligible.filter(c => preferred.includes(c.archetype))) : [];
    const otherCards     = shuffle(eligible.filter(c => !preferred.includes(c.archetype)));
    const pool = []; const seen = new Set();
    // Fill 2 from preferred, 1 from others (or all 3 from others if no class)
    const want = preferred.length ? [preferredCards, preferredCards, otherCards] : [otherCards, otherCards, otherCards];
    for (const src of want) {
      for (const c of src) { if (!seen.has(c.id)) { pool.push(c); seen.add(c.id); break; } }
      if (pool.length >= 3) break;
    }
    // Fallback: fill from eligible if not enough
    for (const c of shuffle(eligible)) { if (!seen.has(c.id) && pool.length < 3) { pool.push(c); seen.add(c.id); } }
    return pool;
  }

  deckSize() {
    return this.deck.length + this.hand.length + this.pile.length;
  }

  claimDraftCard(cardId) {
    const cardDef = DB[cardId];
    if (!cardDef) return;
    if (this.deckSize() >= 24) {
      // Deck full — must remove a card first, then complete draft
      this.pendingDraftCard = cardId;
      this.pendingRemove = true;
      this.addLog('ng', `> ⚠ Deck full (${this.deckSize()}/24) — shred a card first, then draft card will be added.`);
      this._commit();
      return;
    }
    const newCard = {...cardDef, uid:`${cardId}_${nextUid()}`};
    const at = Math.floor(Math.random() * (this.deck.length + 1));
    this.deck.splice(at, 0, newCard);
    this.addLog('ok', `> 📋 Draft: ${cardDef.name} added to deck. (${this.deckSize()}/24)`);
    this._openShopAfterDraft();
  }

  skipDraft() {
    this.addLog('ok', '> ✗ Draft skipped — deck unchanged.');
    this._openShopAfterDraft();
  }

  _openShopAfterDraft() {
    this.draftPool = [];
    if (this.week === 5 && !this.bossEncounterDone) {
      this.phase = 'boss'; this.bossPhase = 'question'; this.bossQIdx = 0; this.bossAnswerLog = [];
      this._commit(); return;
    }
    // Power Spike Event — runs after draft on weeks 3, 6, 9
    if ([3,6,9].includes(this.week) && !this.powerEventsDone.has(this.week)) {
      this.powerEventsDone.add(this.week);
      this.powerEventOptions = this._buildPowerEventOptions();
      this.phase = 'power_event'; this._commit(); return;
    }
    this.shopItems = this._buildShopItems();
    this.phase = 'shop'; this._commit();
    checkFirstShopTutorial?.();
  }

  _buildShopItems() {
    const ownedIds = this.passives.map(p => p.itemId);
    const items = pickShopItems(ownedIds);
    // Inject class-exclusive item as guaranteed 4th slot if not yet owned
    const classItemMap = {grinder:'sh_grinder_perk', strategist:'sh_strategist_perk', survivor:'sh_survivor_perk'};
    const classItem = this.playerClass && classItemMap[this.playerClass];
    if (classItem && !ownedIds.includes(classItem) && !items.includes(classItem)) {
      items.push(classItem);
    }
    return items;
  }

  _buildPowerEventOptions() {
    const all = [
      {id:'pe_promotion',   icon:'🏆', name:'PROMOTION',
       desc:'+1.0 permanent Mult — costs +10 Burnout', fx:{permMult:1.0, bo:10}},
      {id:'pe_sideproject', icon:'📦', name:'SIDE PROJECT',
       desc:'Add 2 random cards to your deck for free', fx:{addCards:2}},
      {id:'pe_training',    icon:'🎓', name:'CORPORATE TRAINING',
       desc:'+20 Wellbeing, +5 CC, free card upgrade', fx:{wb:20, coins:5, upgrade:true}},
      {id:'pe_restructure', icon:'🔄', name:'RESTRUCTURING',
       desc:'+0.5 permanent Mult, −15% Tox, +3 CC', fx:{permMult:0.5, tox:-15, coins:3}},
      {id:'pe_bonus',       icon:'💵', name:'PERFORMANCE BONUS',
       desc:'+15 CC and a free card removal', fx:{coins:15, remove:true}},
    ];
    return shuffle([...all]).slice(0, 3);
  }

  claimPowerEvent(optionId) {
    const opt = this.powerEventOptions.find(o => o.id === optionId);
    if (!opt) return;
    const {fx} = opt;
    if (fx.permMult) this.permMult = fmt1((this.permMult||0) + fx.permMult);
    if (fx.bo)       this.bo       = clamp(this.bo  + fx.bo,  0, 100);
    if (fx.wb)       this.wb       = clamp(this.wb  + fx.wb,  0, 100);
    if (fx.tox)      this.tox      = clamp(this.tox + fx.tox, 0, 100);
    if (fx.coins)    this.coins    = Math.max(0, this.coins + fx.coins);
    if (fx.upgrade)  this.pendingUpgrade = true;
    if (fx.remove)   this.pendingRemove  = true;
    if (fx.addCards) {
      const tier = getUnlockedTier();
      const eligible = shuffle(Object.values(DB).filter(c => (c.tier||0) <= tier));
      for (let i = 0; i < fx.addCards && i < eligible.length; i++) {
        const card = eligible[i];
        const newCard = {...card, uid:`${card.id}_${nextUid()}`};
        this.deck.splice(Math.floor(Math.random()*(this.deck.length+1)), 0, newCard);
        this.addLog('ok', `> 📦 [Side Project] ${card.name} added to deck.`);
      }
    }
    this.addLog('sy', `> 🏢 [POWER EVENT: ${opt.name}] ${opt.desc}`);
    this.powerEventOptions = [];
    this.shopItems = this._buildShopItems();
    this.phase = 'shop'; this._commit();
  }

  openShop() {
    if (!this._processEndOfWeekStats()) return;
    const bt = this.justBreakthrough; this.justBreakthrough = false;
    const passed = this.weekHistory[this.weekHistory.length - 1]?.passed;
    if (passed) {
      this.draftPool = this._buildCardDraftPool();
      this.phase = 'draft';
      this._commit();
      if (bt) showComboAnnouncer('💥 BREAKTHROUGH!');
      return;
    }
    // Failed week: check for power spike event
    if ([3,6,9].includes(this.week) && !this.powerEventsDone.has(this.week)) {
      this.powerEventsDone.add(this.week);
      this.powerEventOptions = this._buildPowerEventOptions();
      this.phase = 'power_event'; this._commit(); return;
    }
    if (this.week === 5 && !this.bossEncounterDone) {
      this.phase = 'boss'; this.bossPhase = 'question'; this.bossQIdx = 0; this.bossAnswerLog = [];
      this._commit(); return;
    }
    this.shopItems = this._buildShopItems();
    this.phase = 'shop'; this._commit();
    checkFirstShopTutorial?.();
  }

  answerBossQuestion(optionIdx) {
    const boss = BOSS_DB.midgame;
    const q = boss.questions[this.bossQIdx];
    const opt = q.options[optionIdx];
    const fx = opt.fx;
    if (fx.wb)       this.wb     = clamp(this.wb     + fx.wb,     0, 100);
    if (fx.tox)      this.tox    = clamp(this.tox    + fx.tox,    0, 100);
    if (fx.bo)       this.bo     = clamp(this.bo     + fx.bo,     0, 100);
    if (fx.coins)    this.coins  = Math.max(0, this.coins + fx.coins);
    if (fx.kpiMult)  this.kpiMult = fmt1(this.kpiMult * fx.kpiMult);
    const fxParts = [];
    if (fx.wb)      fxParts.push(`${fx.wb > 0 ? '+' : ''}${fx.wb} WB`);
    if (fx.tox)     fxParts.push(`${fx.tox > 0 ? '+' : ''}${fx.tox}% Tox`);
    if (fx.bo)      fxParts.push(`${fx.bo > 0 ? '+' : ''}${fx.bo}% BO`);
    if (fx.coins)   fxParts.push(`${fx.coins > 0 ? '+' : ''}${fx.coins} CC`);
    if (fx.kpiMult) fxParts.push(`KPI ×${fx.kpiMult}`);
    this.addLog('i', `> [Derek Q${this.bossQIdx + 1}] "${opt.label}" — ${fxParts.join(', ')}`);
    this.bossAnswerLog.push({qId: q.id, optIdx: optionIdx, opt, fx});
    this.bossPhase = 'result';
    this._commit();
  }

  advanceBoss() {
    const boss = BOSS_DB.midgame;
    if (this.bossQIdx < boss.questions.length - 1) {
      this.bossQIdx++; this.bossPhase = 'question';
    } else {
      this.bossPhase = 'reward';
      this.bossRewardPool = this._buildBossRewardPool();
    }
    this._commit();
  }

  _buildBossRewardPool() {
    const pool = [...BOSS_DB.midgame.rewardPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  claimBossReward(rewardId) {
    const reward = this.bossRewardPool.find(r => r.id === rewardId);
    if (!reward) return;
    if (reward.type === 'STAT_BOOST') {
      const fx = reward.fx;
      if (fx.wb)       this.wb      = clamp(this.wb      + fx.wb,       0, 100);
      if (fx.tox)      this.tox     = clamp(this.tox     + fx.tox,      0, 100);
      if (fx.bo)       this.bo      = clamp(this.bo      + fx.bo,       0, 100);
      if (fx.coins)    this.coins   = Math.max(0, this.coins   + fx.coins);
      if (fx.permMult) this.permMult = fmt1((this.permMult || 0) + fx.permMult);
      this.addLog('ok', `> 🎁 Boss Reward claimed: ${reward.label}`);
    } else if (reward.type === 'EXTRA_PLAY') {
      this.bossExtraPlay = true;
      this.addLog('ok', `> 🎁 Boss Reward: ${reward.label} — one extra play next week!`);
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
    }
    this.bossEncounterDone = true;
    this.bossChosenRewards.push(rewardId);
    this.shopItems = this._buildShopItems();
    this.phase = 'shop'; this._commit();
  }

  buyItem(itemId) {
    const item = SHOP_DB[itemId]; if (!item || this.coins < item.cost) return;
    this.coins -= item.cost;
    // mark that something was bought this shop session
    this.purchasedThisShop = true;
    if (item.type === 'CONSUMABLE') {
      const fx = item.effects;
      if (fx.wb)  this.wb  = clamp(this.wb  + fx.wb,  0, 100);
      if (fx.tox) this.tox = clamp(this.tox + fx.tox, 0, 100);
      if (fx.bo)  this.bo  = clamp(this.bo  + fx.bo,  0, 100);
      this.addLog(fx.logCls, `> ${fx.logMsg}`);
    }
    else if (item.type === 'PASSIVE') {
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
    this.shopItems = this.shopItems.filter(id => id !== itemId); this._commit();
  }

  startRemoval() {
    const cost = this.freeRemovalUsed ? 3 : 0;
    if (cost > 0 && this.coins < cost) return;
    this.coins -= cost;
    this.freeRemovalUsed = true;
    this.pendingRemove = true;
    const label = cost === 0 ? 'FREE' : `-${cost} CC`;
    this.addLog('ok', `> 🗑️ Shredder activated (${label}) — choose a card to remove.`);
    this._commit();
  }

  removeCard(uid) {
    const card = [...this.deck, ...this.pile].find(c => c.uid === uid);
    this.deck = this.deck.filter(c => c.uid !== uid);
    this.pile = this.pile.filter(c => c.uid !== uid);
    this.pendingRemove = false;
    if (card) {
      this.addLog('ok', `> 🗑️ [${card.name}] permanently shredded.`);
      // if this removal was triggered by a pending draft, complete the draft now
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

  holdCard(uid) {
    const card = this.pile.find(c => c.uid === uid);
    if (!card) return;
    this.pile = this.pile.filter(c => c.uid !== uid);
    this.heldCards.push(card);
    this.pendingHold = false;
    this.addLog('ok', `> 💼 [${card.name}] secured in briefcase — ready next week.`);
    this._commit();
  }

  cancelAction() {
    this.pendingRemove = false;
    this.pendingHold = false;
    this.pendingUpgrade = false;
    this._commit();
  }

  setOverlaySort(key) { this.overlaySort = key; this._commit(); }

  skipShop() {
    // don't allow skip if purchase already made
    if (this.purchasedThisShop) return;
    // if called directly from result phase, record week outcome (openShop not called)
    if (this.phase === 'result') {
      const passed = this.wscore >= this.kpi();
      this.weekHistory.push({ week: this.week, passed });
      if (!passed) { this.failedWeeks++; this.bo = clamp(this.bo + FAIL_BO, 0, 100); }
    }
    // Add +3 coins
    this.coins += 3;
    this.addLog('ok', '> ⏭ Skipped shop — +3 Corpo Coins');
    // Continue to next week
    this.startNextWeek();
  }



  startNextWeek() {
    this.week++; this.wscore = 0; 
    // update plays based on Mule competency
    this.playsMax = PLAYS + (this.hasComp('comp_mule') ? 1 : 0);
    this.plays = this.playsMax;
    this.discs = DISCS;
    // ── Toxicity Tier 3: Toxic Culture — -1 Discard ──
    if (this.tox >= 61 && this.tox < 91) {
      this.discs = Math.max(0, this.discs - 1);
      this.addLog('ng', `> ⚡ [Toxic Culture] Środowisko toksyczne — -1 Discard → ${this.discs}`);
    }
    this.weekCrunched = false; this.weekCrunchCount = 0; this.phase = 'play'; this.lastScore = null;
    this.exhausted = new Set(); this.discardComboMult = 0; this.firstDraw = true; this.supportInjected = false;
    this.weekArchetypes = {PRODUCTION:0,STRATEGY:0,CRUNCH:0,RECOVERY:0};
    this.archetypeMilestonesHit = new Set(); this.pressureReleaseUsed = false;
    // Reset per-week competency flags
    this.firstCardThisWeek = true; this.firstCrunchUsed = false;
    // Office Sunshine: +WB at week start
    if (this.hasComp('comp_sunshine')) {
      this.wb = clamp(this.wb + COMP_DB.comp_sunshine.passiveVal, 0, 100);
      this.addLog('wg', `> ☀ [Office Sunshine] Start of week — +${COMP_DB.comp_sunshine.passiveVal} Wellbeing → ${this.wb}%`);
    }
    // Boss extra play reward
    if (this.bossExtraPlay) {
      this.plays++; this.playsMax++; this.bossExtraPlay = false;
      this.addLog('ok', `> ⏱️ Free Overtime turn granted — +1 play this week.`);
    }
    // Held cards from Overtime Briefcase — added directly to hand
    if (this.heldCards.length) {
      for (const c of this.heldCards) this.addLog('ok', `> 💼 [${c.name}] retrieved from briefcase.`);
      this.hand.push(...this.heldCards);
      this.heldCards = [];
    }
    this.drawUp();
    this.addLog('d', `> Week ${this.week}/${TOTAL_WEEKS}. KPI target: ${this.kpi()}`);
    this.prepareTeammateChoice();
  }


  addLog(cls, t) { this.log.push({cls, t}); }

  // ── Central render + scroll — all state changes go through here ──
  _commit() { render(this); scrollLog(); }

  restart() {
    resetCtxTips?.();
    const g = new Game();
    window.G = g;
    showClassScreen();
  }

  acceptPromotion() {
    const s = calculateFinalScore(this);
    const allCards = [...this.deck, ...this.pile, ...this.hand];
    const best = allCards.slice().sort((a,b) => (b.level||0)-(a.level||0) || (b.fx.chips||0)-(a.fx.chips||0))[0];
    const legacy = best ? {...best, uid:`legacy_${nextUid()}`, rarity:'LEGENDARY'} : null;
    const g = new Game();
    g.promotionRun = true;
    g.promotionYear = this.promotionYear + 1;
    g.kpiMultiplier = parseFloat((this.kpiMultiplier * 1.25).toFixed(4));
    g.previousRunScore = (this.previousRunScore || 0) + s.total;
    g.legacyCard = legacy;
    window.G = g;
    showClassScreen();
  }
}