// ═══════════════════════════════════════════════════════
//  GAME STATE
//  Pure state container + query methods.
//  No game logic, no phase transitions, no UI calls except _commit.
// ═══════════════════════════════════════════════════════
import { PLAYS, DISCS, HAND, MAX_SEL, KPI, clamp } from '../data/constants.js';
import { ui } from './uiStore.js';

// ── Valid phase transitions (warning-only guard) ──────
const VALID_TRANSITIONS = {
  teammate_choice: ['play'],
  play:            ['scoring'],
  scoring:         ['play', 'result', 'review'],
  result:          ['shop', 'review'],
  shop:            ['teammate_choice', 'upgrade_result', 'play'],
  upgrade_result:  ['shop'],
  review:          [],
};

export class GameState {
  constructor() {
    this.week = 1; this.wb = 100; this.tox = 0; this.bo = 0;
    this.wscore = 0; this.playsMax = PLAYS; this.plays = PLAYS; this.discs = DISCS; this.coins = 0;
    this.exhausted = new Set(); this.shopItems = [];
    this.purchasedThisShop = false;
    this.openedPack = null;       // { packId, items:[{type,id,name,icon,rarity,desc,negative,data,archetype?,flavor?}] } | null
    this.nextWeekPlaysBonus = 0;  // applied at start of next week

    this.phase = 'play'; this.deck = []; this.pile = []; this.hand = [];
    this.sel = []; this.log = []; this.lastScore = null; this.weekCrunched = false; this.weekCrunchCount = 0;
    this.consecutiveFails = 0; this.kpiMult = 1.0; this.supportInjected = false; this.firstDraw = true;

    // Discard/crunch state
    this.firstCrunchUsed = false; this.firstCardThisWeek = true;

    // Teammate state
    this.teammate = null; this.teammateOptions = []; this.alexWeeksCount = 0;
    this.pendingSnitch = false; this.teammateTier = 1;
    this.consecutiveSameTeammate = 0; this.loyaltyTeammateId = null;

    // End-game tracking
    this.totalRawChips = 0; this.peakTox = 0; this.totalTeammateWeeks = 0;
    this.totalMultSum = 0; this.totalPlayCount = 0; this.isTerminated = false;
    this.failedWeeks = 0; this.endCondition = 'annual';
    this.weekHistory = [];

    // Scoring reveal
    this.scoringDisplay = null; this._nextPhase = null;

    // Upgrade reveal
    this.upgradeResultCard = null; this.upgradeResultFrom = null;
    this.upgradeResultTier = null; this.upgradeSpinning = false;

    // Strategic mechanics
    this.pendingRemove = false; this.pendingHold = false; this.heldCards = [];

    // Permanent multiplier (desk items, breakthroughs)
    this.permMult = 0;

    // Draft state (pendingDraftCard still used when deck is full during pack claim)
    this.pendingDraftCard = null;

    // Meeting type tracking
    this.lastMeetingType = null;  // id of the last meeting played (for secret meeting detection)

    // Shop pack selection (3 of 5 rolled each week)
    this.shopPackIds = [];

    // Economy state
    this.freeRemovalUsed = false;

    // Decision Depth
    this.pendingTargetedDraw = false; this.targetedDrawOptions = [];
    this.weekArchetypes = {PRODUCTION:0, STRATEGY:0, CRUNCH:0, RECOVERY:0};
    this.pendingUpgrade = false;

    // Desk Items
    this.deskItems = [];           // up to 5 active desk items
    this.deskItemOffer = null;     // [{item, source}] offer pending player choice
    this.pendingDeskSwap = null;   // {item} — new item waiting when desk is full
    this.resignationLetterUsed = false;

    // Power Progression
    this.justBreakthrough = false;

    // Inbox
    this.inbox = []; this.inboxOpen = false; this.inboxSelected = 0;

    // UI state
    this.overlaySort = 'name'; this._busy = false;

    // Promotion run meta-state
    this.kpiMultiplier = 1.0;
    this.promotionRun = false;
    this.promotionYear = 1;
    this.legacyCard = null;
    this.previousRunScore = 0;

    // Wellness tracking
    this.wellnessWeeks = 0;

    // Desk item carry state
    this.shopPacksBought = 0; // budget_freeze: 1 pack per shop limit

  }

  // ── Queries ──────────────────────────────────────────
  getTeammateTier() { return this.tox >= 81 ? 3 : this.tox >= 31 ? 2 : 1; }

  kpi() {
    const benMult = this.teammate === 'ben'
      ? (this.getTeammateTier() === 1 ? 0.88 : this.getTeammateTier() === 3 ? 0.75 : 0.92)
      : 1.0;
    const pipMult = (this.deskItems||[]).some(d => d.id === 'performance_improvement_plan') ? 0.75 : 1.0;
    return Math.floor(KPI[this.week - 1] * this.kpiMult * benMult * this.kpiMultiplier * pipMult);
  }

  handLimit() {
    return HAND + ((this.deskItems||[]).some(d => d.id === 'flex_schedule') ? -1 : 0);
  }
  maxSel() {
    const strategyDeck = (this.deskItems||[]).some(d => d.id === 'strategy_deck');
    const toxBonus = this.tox >= 61 && this.tox < 91 ? 1 : 0;
    return (strategyDeck ? 2 : MAX_SEL) + toxBonus;
  }
  deckSize() { return this.deck.length + this.hand.length + this.pile.length; }

  // ── Phase transition ─────────────────────────────────
  transition(newPhase) {
    const allowed = VALID_TRANSITIONS[this.phase];
    if (allowed && !allowed.includes(newPhase)) {
      console.warn(`[DEADLINE] Invalid transition: ${this.phase} → ${newPhase}`);
    }
    this.phase = newPhase;
  }

  // ── Immutable card mutation ───────────────────────────
  _mutateCard(uid, updater) {
    for (const arr of [this.deck, this.pile, this.hand]) {
      const i = arr.findIndex(c => c.uid === uid);
      if (i >= 0) { arr[i] = {...arr[i], ...updater(arr[i])}; return arr[i]; }
    }
    return null;
  }

  // ── Logging + commit ─────────────────────────────────
  addLog(cls, t) { this.log.push({cls, t}); }
  _commit() { ui.render(this); ui.scrollLog(); }
}
