// ═══════════════════════════════════════════════════════
//  GAME PHASES
//  Phase transitions, week flow, shop/boss/draft/teammate screens,
//  end-of-run logic. Mixed into Game.prototype in game.js.
// ═══════════════════════════════════════════════════════
import { PLAYS, DISCS, TOTAL_WEEKS, clamp, FAIL_BO } from '../data/constants.js';
import { BRIEFS_DB } from '../data/briefs.js';
import { nextUid, shuffle, fmt1, getUnlockedTier, setUnlockedTier } from './utils.js';
import { DESK_ITEMS_BY_RARITY, DESK_ITEMS_LIST, DESK_COMBO_PAIRS } from '../data/deskItems.js';
import { makeDeck, pickShopItems } from './deck.js';
import { calculateFinalScore } from './scoring.js';
import { TEAMMATES_DB } from '../data/content.js';
import { SHOP_DB, PACK_DB, NEGATIVE_ITEMS } from '../data/shop.js';
import { DB } from '../data/cards.js';
import { shouldShowEmail, buildManagerEmail, WEEK1_HOOK_EMAIL, BANKING_HINT_EMAIL_1, BANKING_HINT_EMAIL_2 } from '../data/managerEmails.js';
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
  // Alex penalty tracker: tier-aware snitch (Beat 3 — only fires after alexWarning)
  if (this.teammate === 'alex') {
    this.alexWeeksCount++;
    const tier = this.getTeammateTier();
    if (this.alexWarning && this.tox > 60) {
      const snitchWb  = tier === 1 ? -10 : tier === 3 ? -25 : -15;
      const snitchTox = tier === 1 ?  8  : tier === 3 ?  20 :  10;
      this.wb  = clamp(this.wb  + snitchWb,  0, 100);
      this.tox = clamp(this.tox + snitchTox, 0, 100);
      this.pendingSnitch = true;
      this.alexWarning = false;
      this.addLog('ng', `> 🦈 [Alex T${tier} — HR Snitch] "Look, I had to. You understand." ${snitchWb} WB → ${this.wb}% | +${snitchTox}% Tox → ${this.tox}%`);
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
  // Store email in inbox
  const emailCtx = { prevWscore: this.wscore, score: 0 };
  if (shouldShowEmail(this, emailCtx)) {
    const email = buildManagerEmail(this, emailCtx);
    this.inbox.unshift({ ...email, id: Date.now(), unread: true, storedWeek: this.week });
  }
  // Week 1 hook — "It's mostly true" — fires once, first time player opens shop
  if (this.week === 1 && !this.week1HookShown) {
    this.week1HookShown = true;
    this.inbox.unshift({ ...WEEK1_HOOK_EMAIL, id: Date.now() + 2, unread: true, storedWeek: 1 });
  }
  // Banking discovery hint — diegetic tutorial
  if (!this.bankingHintShown) {
    if (this.week === 1 && this.wscore >= this.kpi() && this.plays > 0) {
      // Player hit KPI with plays left — they could have banked
      this.bankingHintShown = true;
      this.inbox.unshift({ ...BANKING_HINT_EMAIL_1, id: Date.now() + 1, unread: true, storedWeek: 1 });
    } else if (this.week === 2 && !this.bankingEverUsed) {
      // Week 2 fallback — player still hasn't discovered banking
      this.bankingHintShown = true;
      this.inbox.unshift({ ...BANKING_HINT_EMAIL_2, id: Date.now() + 1, unread: true, storedWeek: 2 });
    }
  }
  if (bt) ui.showComboAnnouncer('💥 BREAKTHROUGH!');
  this.shopPackIds = shuffle(Object.keys(PACK_DB)).slice(0, 2); // 2 of 3 rolled each week
  this.shopPacksBought = 0;
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

export function selectBrief(id) {
  if (this.brief || !BRIEFS_DB[id]) return;
  this.brief = id;
  const b = BRIEFS_DB[id];
  this.addLog('sy', `> 📋 Brief assigned: ${b.name}`);
  this.addLog('i',  `> Effect: ${b.effectShort}`);
  this.startNextWeek();
}

export function startNextWeek() {
  // Brief select: intercept after week 1 shop, before week 2 starts
  if (this.week === 1 && !this.brief) {
    if (!this.briefOptions) {
      const keys = Object.keys(BRIEFS_DB);
      // shuffle and pick 3
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      this.briefOptions = keys.slice(0, 3);
    }
    this.phase = 'brief_select';
    this._commit();
    return;
  }

  this.week++; this.wscore = 0;
  this.playsMax = PLAYS;
  this.plays = this.playsMax;
  if (this.nextWeekPlaysBonus !== 0) {
    this.plays = Math.max(1, this.plays + this.nextWeekPlaysBonus);
    this.playsMax = this.plays;
    if (this.nextWeekPlaysBonus < 0) this.addLog('ng', `> 📢 [All-Hands] -${Math.abs(this.nextWeekPlaysBonus)} play this week → ${this.plays}`);
    this.nextWeekPlaysBonus = 0;
  }
  // Failed weeks permanently reduce max plays (cap: -2)
  const failPenalty = Math.min(this.failedWeeks, 2);
  if (failPenalty > 0) {
    this.plays = Math.max(3, this.plays - failPenalty);
    this.playsMax = this.plays;
    if (failPenalty === 1) this.addLog('ng', `> 📉 [Performance Record] 1 failed week — max plays reduced to ${this.plays}`);
    else this.addLog('ng', `> 📉 [Performance Record] ${failPenalty} failed weeks — max plays reduced to ${this.plays}`);
  }
  this.discs = DISCS;
  // Toxicity Zone 3 (81%+): Toxic Culture — -1 Discard
  if (this.tox >= 81) {
    this.discs = Math.max(0, this.discs - 1);
    this.addLog('ng', `> ⚡ [Toxic Culture] Środowisko krytycznie toksyczne — -1 Discard → ${this.discs}`);
  }
  this.weekCrunched = false; this.weekCrunchCount = 0; this.lastScore = null;
  this.exhausted = new Set(); this.firstDraw = true; this.supportInjected = false;
  this.weekArchetypes = {PRODUCTION:0, STRATEGY:0, CRUNCH:0, RECOVERY:0};
  this.firstCardThisWeek = true; this.firstCrunchUsed = false;
  // Brief: restructure — weekEffBonus based on deck size
  this.weekEffBonus = 0;
  if (this.brief === 'restructure') {
    const deckSz = this.deckSize();
    if (deckSz <= 10) {
      this.weekEffBonus = Math.round((10 - deckSz) * 0.1 * 10) / 10;
      this.addLog('sy', `> 📉 [Restructure] Deck ${deckSz} cards — +${fmt1(this.weekEffBonus)} Eff bonus this week`);
    }
    // Card removal always free
    this.freeRemovalUsed = false;
  }
  // flex_schedule: +1 play per week
  if ((this.deskItems||[]).some(d => d.id === 'flex_schedule')) {
    this.plays++;
    this.playsMax++;
    this.addLog('ok', `> 🗓️ [Flex Schedule] +1 play this week → ${this.plays}`);
  }
  // sick_day_policy: max 4 plays per week
  if ((this.deskItems||[]).some(d => d.id === 'sick_day_policy')) {
    if (this.plays > 4) {
      this.plays = 4;
      this.playsMax = 4;
      this.addLog('ok', `> 🤒 [Sick Day Policy] Max 4 plays this week`);
    }
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
  this.totalEarnings += this.wscore;
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
    // scale_or_fail: pass gives perm Eff instead of CC
    if (this.brief === 'scale_or_fail') {
      const mult = overPct >= 1.3 ? 0.4 : overPct >= 1.1 ? 0.3 : 0.2;
      this.permMult = fmt1((this.permMult || 0) + mult);
      this.briefProgress++;
      this.addLog('sy', `> 🚀 [Scale or Fail] Pass → +${mult} perm Eff → ${this.permMult}× (no CC) · weeks passed: ${this.briefProgress}`);
      if (!this.briefCompleted && this.briefProgress >= 8) {
        this.briefCompleted = true;
        this.addLog('sy', `> 🚀 [Scale or Fail] OBJECTIVE COMPLETE — perm Eff ×2 at run end`);
      }
    } else {
      const passReward = overPct >= 1.3 ? 12 : overPct >= 1.1 ? 9 : 6;
      this.coins += passReward;
      const bonusLabel = overPct >= 1.3 ? ' 🏆 Overperformance bonus!' : overPct >= 1.1 ? ' ⭐ Good work!' : '';
      this.addLog('ok', `> Week ${this.week} PASSED! +${passReward} CC → ${this.coins} CC${bonusLabel}`);
    }
    if (this.wscore >= this.kpi() * 2) {
      this.permMult = fmt1((this.permMult || 0) + 0.5);
      this.justBreakthrough = true;
      this.addLog('sy', `> 💥 BREAKTHROUGH! Revenue $${this.wscore.toLocaleString()} ≥ 2× Target — +0.5 permanent Eff → ${this.permMult}×`);
    }
    if (this.checkGameEndConditions(passed)) return false;
  }
  // ── Brief end-of-week effects ─────────────────────────
  if (this.brief === 'cost_reduction' && !this.briefCompleted && this.tox < 35) {
    this.briefProgress++;
    this.addLog('sy', `> ✂️ [Cost Reduction] TOX ${this.tox}% < 35% — ${this.briefProgress}/5 low-tox weeks`);
    if (this.briefProgress >= 5) {
      this.briefCompleted = true;
      this.freeRemovalUsed = false;
      this.addLog('sy', `> ✂️ [Cost Reduction] OBJECTIVE COMPLETE — free card removal next shop`);
    }
  }
  if (this.brief === 'hyper_growth' && !this.briefCompleted) {
    const overPct2 = this.wscore / this.kpi();
    if (passed && overPct2 >= 1.5) {
      this.briefConsecutiveWeeks++;
      this.addLog('sy', `> 📈 [Hyper-Growth] ${Math.round(overPct2*100)}% KPI — streak ${this.briefConsecutiveWeeks}/3`);
      if (this.briefConsecutiveWeeks >= 3) {
        this.briefCompleted = true;
        this.nextWeekPlaysBonus += 1;
        this.addLog('sy', `> 📈 [Hyper-Growth] OBJECTIVE COMPLETE — +1 play next week`);
      }
    } else {
      if (this.briefConsecutiveWeeks > 0) this.addLog('i', `> 📈 [Hyper-Growth] Streak broken (${this.briefConsecutiveWeeks}/3)`);
      this.briefConsecutiveWeeks = 0;
    }
  }

  // Office Plant: -3% Tox at end of each week
  if ((this.deskItems||[]).some(d => d.id === 'office_plant')) {
    this.tox = clamp(this.tox - 3, 0, 100);
    this.addLog('tl', `> 🌿 [Office Plant] -3% Tox → ${this.tox}%`);
  }
  if (this.tox <= 30) {
    const bonus = 4;
    this.wb = clamp(this.wb + bonus, 0, 100);
    this.addLog('wg', `> ✅ [Professional] Niska toksyczność (${this.tox}%) → +${bonus} Wellbeing → ${this.wb}%`);
  }
  // ── Desk Item end-of-week effects ─────────────────────
  this._processDeskItemWeekEnd(passed);
  // kpi_dashboard: PRODUCTION cards +15 chips on pass, -10 on fail
  if ((this.deskItems||[]).some(d => d.id === 'kpi_dashboard')) {
    const delta = passed ? 15 : -10;
    const allCards = [...this.deck, ...this.pile, ...this.hand];
    for (const c of allCards) {
      if (c.archetype === 'PRODUCTION') {
        c.fx = {...c.fx, chips: Math.max(50, (c.fx.chips||0) + delta)};
      }
    }
    if (passed) this.addLog('sy', `> 📊 [KPI Dashboard] KPI passed — all PRODUCTION cards +15 chips`);
    else this.addLog('ng', `> 📊 [KPI Dashboard] KPI failed — all PRODUCTION cards −10 chips`);
  }
  // ── Wellness Reward: WB ≥75% → +5 CC ──
  if (this.wb >= 75) {
    this.coins += 5;
    this.addLog('ok', `> 🌟 [Wellness Reward] WB ${this.wb}% ≥ 75% — +5 CC → ${this.coins} CC`);
  }
  // ── Alex snitch Beat 1: Signal ─────────────────────
  if (this.teammate === 'alex' && this.tox > 70) {
    this.alexWarning = true;
    this.addLog('ng', `> 🦈 [Alex] Alex has been unusually quiet this week.`);
  } else if (this.tox <= 60) {
    this.alexWarning = false; // TOX recovered — warning clears
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
    // scale_or_fail: double permMult if side objective completed
    if (this.brief === 'scale_or_fail' && this.briefCompleted) {
      const before = this.permMult;
      this.permMult = fmt1(this.permMult * 2);
      this.addLog('sy', `> 🚀 [Scale or Fail] OBJECTIVE BONUS — perm Eff ×2: ${before}× → ${this.permMult}×`);
    }
    // restructure: +3.0 perm Eff if deck ≤8
    if (this.brief === 'restructure' && !this.briefCompleted && this.deckSize() <= 8) {
      this.briefCompleted = true;
      this.permMult = fmt1((this.permMult || 0) + 3.0);
      this.addLog('sy', `> 📉 [Restructure] OBJECTIVE COMPLETE — deck ${this.deckSize()} ≤ 8 — +3.0 perm Eff → ${this.permMult}×`);
    }
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
  const item = SHOP_DB[itemId]; if (!item || this.coins < item.cost) return;
  this.coins -= item.cost;
  this.purchasedThisShop = true;
  if (item.type === 'CONSUMABLE') {
    const fx = item.effects;
    if (fx.wb)  this.wb  = clamp(this.wb  + fx.wb,  0, 100);
    if (fx.tox) this.tox = clamp(this.tox + fx.tox, 0, 100);
    if (fx.bo)  this.bo  = clamp(this.bo  + fx.bo,  0, 100);
    this.addLog(fx.logCls, `> ${fx.logMsg}`);
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

export function _buildShopItems() { return []; }

// ═══════════════════════════════════════════════════════
//  PACK SYSTEM
// ═══════════════════════════════════════════════════════

export function buyPack(packId) {
  const pack = PACK_DB[packId];
  if (!pack) return;
  const hasBudgetFreeze = (this.deskItems||[]).some(d => d.id === 'budget_freeze');
  // budget_freeze: max 1 pack per shop
  if (hasBudgetFreeze && (this.shopPacksBought||0) >= 1) {
    this.addLog('ng', `> 🧊 [Budget Freeze] Only 1 pack per shop visit.`);
    return;
  }
  const cost = hasBudgetFreeze ? 0 : pack.cost;
  if (this.coins < cost) return;
  this.coins -= cost;
  this.purchasedThisShop = true;
  this.shopPacksBought = (this.shopPacksBought||0) + 1;
  const items = this._rollPackItems(packId);
  this.openedPack = { packId, items };
  this.addLog('ok', `> 📦 [${pack.name}] opened${hasBudgetFreeze ? ' (FREE — Budget Freeze)' : ''} — choose 1 of 3`);
  this._commit();
}

export function claimPackItem(idx) {
  if (!this.openedPack || idx < 0 || idx >= this.openedPack.items.length) return;
  const item = this.openedPack.items[idx];
  this.openedPack = null;
  this._applyPackItem(item);
  this._commit();
}

export function skipPackItem() {
  if (!this.openedPack) return;
  this.addLog('ok', '> ✗ Pack contents skipped.');
  this.openedPack = null;
  this._commit();
}

export function _rollPackItems(packId) {
  if (packId === 'standard') {
    // Standard Issue: consumables or common desk items
    const consumables = ['sh_espresso','sh_aspirin','sh_headphones','sh_salad','sh_therapy','sh_pizza'];
    const ownedIds = new Set((this.deskItems||[]).map(d => d.id));
    const deskPool = DESK_ITEMS_LIST.filter(d => ['COMMON','UNCOMMON'].includes(d.rarity) && !ownedIds.has(d.id));
    const deskItems = shuffle([...deskPool]).slice(0,2).map(d => ({ type:'DESK_ITEM', id:d.id, name:d.name, icon:d.icon, rarity:d.rarity, desc:d.effect||d.desc||'', negative:false, data:d }));
    const consumableItems = shuffle([...consumables]).slice(0,2).map(id => this._packifyShopItem(id)).filter(Boolean);
    const pool = shuffle([...deskItems, ...consumableItems]);
    return pool.slice(0, 3);
  }
  if (packId === 'talent_acq') {
    const cards = this._buildCardDraftPool().slice(0, 2).map(c => this._packifyCard(c));
    const holdItem = { type:'HOLD_CARD', id:'hold_card', name:'Overtime Briefcase', icon:'💼', rarity:'UNCOMMON', desc:'Hold 1 card from discard pile for next week\'s opening hand.', negative:false, data:{} };
    return shuffle([...cards, holdItem]).slice(0, 3);
  }
  if (packId === 'executive') {
    const ownedIds = new Set((this.deskItems||[]).map(d => d.id));
    const rareDeskPool = DESK_ITEMS_LIST.filter(d => ['RARE','LEGENDARY'].includes(d.rarity) && !ownedIds.has(d.id));
    const upgradeItem = { type:'UPGRADE_CARD', id:'upgrade_card', name:'Performance Upgrade', icon:'⬆️', rarity:'RARE', desc:'Permanently upgrade 1 card: +80 Output & +0.3 Eff added to base stats.', negative:false, data:{} };
    const rareDesks = shuffle([...rareDeskPool]).slice(0,3).map(d => ({ type:'DESK_ITEM', id:d.id, name:d.name, icon:d.icon, rarity:d.rarity, desc:d.effect||d.desc||'', flavor:d.flavor||'', negative:false, data:d }));
    const pool = shuffle([...rareDesks, upgradeItem]);
    while (pool.length < 3) pool.push(upgradeItem);
    return pool.slice(0, 3);
  }
  return [];
}

export function _packifyShopItem(id) {
  const item = SHOP_DB[id];
  if (!item) return null;
  return {
    type: item.type,
    id,
    name: item.name,
    icon: item.icon,
    rarity: item.type === 'PASSIVE' ? 'UNCOMMON' : 'COMMON',
    desc: item.desc,
    negative: false,
    data: item,
  };
}

export function _packifyCard(c) {
  const archIcons = { PRODUCTION:'🔵', STRATEGY:'🔴', CRUNCH:'🔥', RECOVERY:'💚' };
  const fxParts = [];
  if (c.fx.chips) fxParts.push(`+${c.fx.chips} Output`);
  if (c.fx.mult)  fxParts.push(`+${c.fx.mult}× Eff`);
  if (c.fx.tox > 0) fxParts.push(`+${c.fx.tox}% Tox`);
  if (c.fx.wb < 0)  fxParts.push(`${c.fx.wb} WB`);
  return {
    type: 'CARD',
    id: c.id,
    name: c.name,
    icon: archIcons[c.archetype] || '🃏',
    rarity: c.rarity || 'COMMON',
    desc: fxParts.join(' · ') || 'Special effect',
    negative: false,
    data: c,
    archetype: c.archetype,
    flavor: c.flavor,
  };
}

export function _applyPackItem(item) {
  if (item.type === 'CONSUMABLE') {
    const fx = item.data.effects;
    if (fx.wb)  this.wb  = clamp(this.wb  + fx.wb,  0, 100);
    if (fx.tox) this.tox = clamp(this.tox + fx.tox, 0, 100);
    if (fx.bo)  this.bo  = clamp(this.bo  + fx.bo,  0, 100);
    this.addLog(fx.logCls, `> ${fx.logMsg}`);
  } else if (item.type === 'DESK_ITEM') {
    if ((this.deskItems||[]).length < 5) {
      this.deskItems = [...(this.deskItems||[]), item.data];
      this.addLog('ok', `> 🗂️ [${item.name}] placed on desk.`);
      // Check for newly completed combo pairs → inject FACILITIES MEMO
      const currentIds = new Set(this.deskItems.map(d => d.id));
      for (const combo of DESK_COMBO_PAIRS) {
        const key = combo.ids.slice().sort().join('+');
        if (!this.discoveredCombos.has(key) && combo.ids.every(id => currentIds.has(id))) {
          this.discoveredCombos.add(key);
          this.inbox.unshift({
            id: Date.now() + Math.random(),
            unread: true,
            storedWeek: this.week,
            type: 'desk_combo',
            mgr: { name: 'Facilities Management', title: 'Office Ops', email: 'facilities@deadline-corp.com' },
            subject: combo.subject,
            body: combo.body,
            ps: combo.ps || null,
            dayName: 'Today',
            passed: true,
          });
        }
      }
    } else {
      // Desk full — offer swap
      this.pendingDeskSwap = { item: item.data };
      this.addLog('i', `> 🗂️ Desk full — choose an item to replace with [${item.name}].`);
    }
  } else if (item.type === 'CARD') {
    const cardDef = DB[item.id];
    if (!cardDef) return;
    if (this.deckSize() >= 24) {
      this.pendingDraftCard = item.id;
      this.pendingRemove = true;
      this.addLog('ng', `> ⚠ Deck full (${this.deckSize()}/24) — shred a card first.`);
      return;
    }
    const newCard = {...cardDef, uid:`${item.id}_${nextUid()}`};
    const at = Math.floor(Math.random() * (this.deck.length + 1));
    this.deck.splice(at, 0, newCard);
    this.addLog('ok', `> ✓ [${cardDef.name}] added to deck. (${this.deckSize()}/24)`);
  } else if (item.type === 'HOLD_CARD') {
    this.pendingHold = true;
    this.addLog('ok', `> 💼 Overtime Briefcase — choose a card to hold for next week.`);
  } else if (item.type === 'UPGRADE_CARD') {
    this.pendingUpgrade = true;
    this.addLog('ok', `> ⬆️ Performance Upgrade — choose a card to improve.`);
  } else if (item.type === 'NEGATIVE') {
    const fx = item.effect;
    if (fx.playsNext)     { this.nextWeekPlaysBonus = (this.nextWeekPlaysBonus||0) + fx.playsNext; this.addLog('ng', `> 📢 [${item.name}] — applied for next week`); }
    if (fx.coins != null) { this.coins = Math.max(0, this.coins + fx.coins); this.addLog('ng', `> 🧊 [${item.name}] — ${fx.coins > 0 ? '+' : ''}${fx.coins} CC → ${this.coins} CC`); }
    if (fx.resetLoyalty)  { this.consecutiveSameTeammate = 0; this.loyaltyTeammateId = null; this.addLog('ng', `> 🤵 [${item.name}] — teammate loyalty reset`); }
    if (fx.removeDeskItem && this.deskItems?.length) { const ri = Math.floor(Math.random()*this.deskItems.length); const rm = this.deskItems.splice(ri,1)[0]; this.addLog('ng', `> 🗃️ [${item.name}] — [${rm.name}] removed from desk`); }
    if (fx.tox) { this.tox = clamp(this.tox + fx.tox, 0, 100); this.addLog('tg', `> 📋 [${item.name}] — +${fx.tox}% Tox → ${this.tox}%`); }
    if (fx.bo)  { this.bo  = clamp(this.bo  + fx.bo,  0, 100); this.addLog('ng', `> 🔥 [${item.name}] — +${fx.bo}% BO → ${this.bo}%`); }
  }
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
      this.permMult = fmt1((this.permMult || 0) + 0.5);
      this.addLog('sy', `> 🖊️ [Whiteboard] All 4 archetypes used this week — +0.5 perm Eff → ${this.permMult}×`);
    }
  }
  // company_mug: pass → +0.2 perm mult
  if (desk('company_mug') && passed) {
    this.permMult = fmt1((this.permMult || 0) + 0.2);
    this.addLog('sy', `> 🏆 [Company Mug] KPI passed — +0.2 perm Eff → ${this.permMult}×`);
  }
  // mouse_pad: tox ≤ 20 → +0.8 perm mult
  if (desk('mouse_pad') && this.tox <= 20) {
    this.permMult = fmt1((this.permMult || 0) + 0.8);
    this.addLog('sy', `> 🖱️ [Mouse Pad] Clean week (Tox ${this.tox}%) — +0.8 perm Eff → ${this.permMult}×`);
  }
  // compound_interest: KPI pass → +0.3 perm Eff
  if (desk('compound_interest') && passed) {
    this.permMult = fmt1((this.permMult || 0) + 0.3);
    this.addLog('sy', `> 📈 [Compound Interest] KPI passed — +0.3 perm Eff → ${this.permMult}×`);
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
