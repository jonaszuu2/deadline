/**
 * newCalcTurn.test.js — Vitest suite for the calcTurn engine.
 * Tests the current codebase. Meeting bonuses apply automatically:
 *   - 1× PRODUCTION → quick_email: +40 chips
 *   - Any CRUNCH   → crunch_time: chips ×1.2
 *   - 1× STRATEGY  → one_on_one: +0.3 Eff
 * Tests account for these when asserting exact values.
 */
import { describe, it, expect } from 'vitest';
import { calcTurn, getRiskLevel } from '../src/engine/calcTurn.js';

// ── Helpers ─────────────────────────────────────────────
let _uidN = 0;
const uid = () => `uid_${_uidN++}`;

const card = (archetype, fx = {}) => ({
  id: `test_${archetype.toLowerCase()}`,
  uid: uid(),
  name: archetype,
  archetype,
  fx: { chips: 0, mult: 0, wb: 0, tox: 0, ...fx },
  synergies: [],
  exhaust: false,
});

/** Minimal valid ctx — mirrors what processTurn() passes to calcTurn(). */
const baseCtx = {
  wb: 100, tox: 0, week: 1, plays: 3,
  teammate: null,
  consecutiveSameTeammate: 0,
  firstCardThisWeek: true,
  firstCrunchUsed: false,
  weekCrunchCount: 0,
  permMult: 0,
  deskItems: [],
  handSize: 0,
  totalPlayCount: 0,
  lastMeetingType: null,
  brief: null,
  weekEffBonus: 0,
  mode: 'real',
};

// ─────────────────────────────────────────────────────────
//  1a. Basic scoring: score = floor(chips × mult)
//
//  NOTE: Meeting bonuses always fire:
//    - 1× PRODUCTION alone → quick_email: +40 chips (total chips = card+40)
//    - 1× STRATEGY alone   → one_on_one:  +0.3 Eff
//    - Any CRUNCH          → crunch_time:  chips ×1.2 after card loop
//    - PRODUCTION+STRATEGY → cross_functional: +80 chips, +0.4 Eff
// ─────────────────────────────────────────────────────────
describe('calcTurn — scoring formula', () => {

  it('PRODUCTION solo: score includes quick_email +40 chips bonus', () => {
    // chips=500 card + 40 quick_email = 540, mult=1.0, score=540
    const res = calcTurn([card('PRODUCTION', { chips: 500 })], baseCtx);
    expect(res.chips).toBe(540);
    expect(res.score).toBe(540);
  });

  it('PRODUCTION+STRATEGY combo: cross_functional meeting fires (+80 chips, +0.4 Eff)', () => {
    // chips=200 (PROD) + 80 (cross_functional) = 280
    // mult = 1.0 (base) + 0.5 (STRAT card) + 0.4 (cross_functional) = 1.9
    // score = floor(280 * 1.9) = 532
    const res = calcTurn([
      card('PRODUCTION', { chips: 200 }),
      card('STRATEGY',   { mult: 0.5 }),
    ], baseCtx);
    expect(res.chips).toBe(280);
    expect(res.score).toBe(Math.floor(280 * 1.9));
  });

  it('permMult adds to base mult before card loop', () => {
    // permMult=1.0 → acc.mult = 1.0 + 1.0 = 2.0 before cards
    // PRODUCTION chips=100 + 40 quick_email = 140
    // score = floor(140 * 2.0) = 280
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, permMult: 1.0 },
    );
    expect(res.score).toBe(280);
  });

  it('empty card list: score=0, chips=0, gameOver=false', () => {
    const res = calcTurn([], baseCtx);
    expect(res.score).toBe(0);
    expect(res.chips).toBe(0);
    expect(res.gameOver).toBe(false);
  });

  it('score is always an integer (floor applied)', () => {
    const res = calcTurn([card('PRODUCTION', { chips: 10 })], baseCtx);
    expect(Number.isInteger(res.score)).toBe(true);
  });

  it('STRATEGY solo: one_on_one adds +0.3 Eff', () => {
    // 1× STRATEGY with mult=0.5 → acc.mult = 1.0 + 0.5 + 0.3 = 1.8
    // chips=0 → score=0 regardless of mult
    const res = calcTurn([card('STRATEGY', { mult: 0.5 })], baseCtx);
    expect(parseFloat(res.mult)).toBeCloseTo(1.8, 1);
    expect(res.score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
//  1b. TOX damage trigger
// ─────────────────────────────────────────────────────────
describe('calcTurn — toxicity zone penalties', () => {

  it('tox zone 4 (≥81): each card drains −2 WB', () => {
    // wb=50, tox=85, 1 card → wb reduced by 2
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 50, tox: 85 },
    );
    expect(res.wb).toBe(48);
  });

  it('tox zone 3 (61–80): each card drains −1 WB', () => {
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 50, tox: 65 },
    );
    expect(res.wb).toBe(49);
  });

  it('tox zone 2 (31–60): no WB drain per card', () => {
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 50, tox: 45 },
    );
    expect(res.wb).toBe(50);
  });

  it('tox zone 4 (≥81): acc.mult scaled ×1.6 post-loop (after WB penalty)', () => {
    // chips=100, no card mult, tox=85, wb=50 (35–59 range → ×0.85)
    // chips: 100 + 40 (quick_email) = 140, then WB penalty: floor(140*0.85)=119
    // mult: 1.0 × 1.6 (zone 4) = 1.6
    // score = floor(119 * 1.6) = 190
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 50, tox: 85 },
    );
    expect(res.score).toBe(Math.floor(Math.floor(140 * 0.85) * 1.6));
  });

  it('tox zone 3 (61–80): acc.mult scaled ×1.3 post-loop (after WB penalty)', () => {
    // chips=100 + 40 quick_email = 140
    // WB penalty: wbEff(50-1drain) = wbEff(49) = ×0.85 → chips = floor(140*0.85) = 119
    // mult: 1.0 × 1.3 (zone 3) = 1.3
    // score = floor(119 * 1.3) = 154
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 50, tox: 70 },
    );
    expect(res.score).toBe(Math.floor(Math.floor(140 * 0.85) * 1.3));
  });

  it('CRUNCH card tox fx.tox adds to running tox', () => {
    // CRUNCH with tox=15: crunch_time fires (chips ×1.2) but tox becomes 15
    const res = calcTurn(
      [card('CRUNCH', { chips: 500, tox: 15 })],
      { ...baseCtx, tox: 0 },
    );
    expect(res.tox).toBe(15);
  });

  it('toxChecks > 0 when tox ≥ 61 during play', () => {
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 80, tox: 65 },
    );
    expect(res.toxChecks).toBeGreaterThan(0);
    expect(res.expectedToxDmg).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
//  1c. KPI pass: wscore + score can reach KPI[0] = 2400
// ─────────────────────────────────────────────────────────
describe('calcTurn — KPI targeting', () => {

  it('score is deterministic given identical input', () => {
    const cardSet = [card('PRODUCTION', { chips: 1000 })];
    const r1 = calcTurn(cardSet, baseCtx);
    // Reset uids for second call
    const cardSet2 = [card('PRODUCTION', { chips: 1000 })];
    const r2 = calcTurn(cardSet2, baseCtx);
    expect(r1.score).toBe(r2.score);
  });

  it('gameOver remains false for a normal play', () => {
    const res = calcTurn(
      [card('PRODUCTION', { chips: 500 })],
      baseCtx,
    );
    expect(res.gameOver).toBe(false);
  });

  it('score > 0 for non-zero chips', () => {
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      baseCtx,
    );
    expect(res.score).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
//  1d. getRiskLevel transitions
// ─────────────────────────────────────────────────────────
describe('getRiskLevel', () => {

  it('SAFE: wb=100, tox=0', () => {
    expect(getRiskLevel(100, 0)).toBe('SAFE');
  });

  it('CAUTION: wb=30, tox=0 (wb ≤ 30)', () => {
    expect(getRiskLevel(30, 0)).toBe('CAUTION');
  });

  it('CAUTION: wb=50, tox=55 (tox > 50)', () => {
    expect(getRiskLevel(50, 55)).toBe('CAUTION');
  });

  it('RISKY: wb=10, tox=80 (wb ≤ 10)', () => {
    expect(getRiskLevel(10, 80)).toBe('RISKY');
  });

  it('RISKY: wb=-1, tox=0 (wb < 0 but tox ≤ 60)', () => {
    expect(getRiskLevel(-1, 0)).toBe('RISKY');
  });

  it('LETHAL: wb=-61, tox=0 (wb ≤ -60)', () => {
    expect(getRiskLevel(-61, 0)).toBe('LETHAL');
  });

  it('LETHAL: wb=-1, tox=65 (wb < 0 AND tox > 60)', () => {
    expect(getRiskLevel(-1, 65)).toBe('LETHAL');
  });
});

// ─────────────────────────────────────────────────────────
//  1e. Brief effects (calcTurn-level)
// ─────────────────────────────────────────────────────────
describe('calcTurn — brief effects', () => {

  it('sustainable_growth: RECOVERY wb heal generates briefProgressDelta (wb × 15)', () => {
    // RECOVERY with wb=+10 heals 10 → briefProgressDelta = 10 * 15 = 150
    const res = calcTurn(
      [card('RECOVERY', { wb: 10 })],
      { ...baseCtx, brief: 'sustainable_growth' },
    );
    expect(res.briefProgressDelta).toBe(150);
  });

  it('sustainable_growth: RECOVERY tox reduction IS blocked (fx.tox zeroed)', () => {
    // sustainable_growth zeroes fx.tox for RECOVERY, but wellness_check meeting
    // fires for RECOVERY and gives -5 tox on top. So we check that tox drops
    // by 5 (only from meeting), NOT by 20+5 from the card fx.
    // Starting tox=50, wellness_check gives -5 → expected 45
    const res = calcTurn(
      [card('RECOVERY', { tox: -20 })],
      { ...baseCtx, tox: 50, brief: 'sustainable_growth' },
    );
    // 50 - 5 (wellness_check meeting) = 45 (not 30 which would include the card fx)
    expect(res.tox).toBe(45);
  });

  it('cost_reduction: CRUNCH chips ×1.6, then crunch_time ×1.2 after', () => {
    // CRUNCH chips=100: brief makes 160, then crunch_time meeting ×1.2 → 192
    const res = calcTurn(
      [card('CRUNCH', { chips: 100 })],
      { ...baseCtx, brief: 'cost_reduction' },
    );
    expect(res.chips).toBe(192);
  });

  it('hyper_growth: PRODUCTION chips ×1.5, then quick_email +40', () => {
    // PRODUCTION chips=100: ×1.5 = 150, + 40 quick_email = 190
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, brief: 'hyper_growth' },
    );
    expect(res.chips).toBe(190);
  });

  it('hyper_growth: no PRODUCTION → chips −20% (from 0 = still 0)', () => {
    // Only STRATEGY played, chips=0 → score=0
    const res = calcTurn(
      [card('STRATEGY', { mult: 1.0 })],
      { ...baseCtx, brief: 'hyper_growth' },
    );
    expect(res.score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
//  WB chip penalty (wbEff thresholds from deck.js)
//  NOTE: quick_email adds +40 to single PRODUCTION plays.
// ─────────────────────────────────────────────────────────
describe('calcTurn — WB chip penalty (wbEff)', () => {

  it('wb ≥ 60: no penalty, chips = card chips + meeting bonus', () => {
    // 100 + 40 quick_email = 140, no penalty
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 60 },
    );
    expect(res.chips).toBe(140);
  });

  it('wb 35–59: chips ×0.85 applied to (card chips + meeting bonus)', () => {
    // (100 + 40) * 0.85 = floor(140 * 0.85) = 119
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 40 },
    );
    expect(res.chips).toBe(Math.floor(140 * 0.85));
  });

  it('wb 15–34: chips ×0.65', () => {
    // floor(140 * 0.65) = 91
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 20 },
    );
    expect(res.chips).toBe(Math.floor(140 * 0.65));
  });

  it('wb < 15: chips ×0.45', () => {
    // floor(140 * 0.45) = 63
    const res = calcTurn(
      [card('PRODUCTION', { chips: 100 })],
      { ...baseCtx, wb: 5 },
    );
    expect(res.chips).toBe(Math.floor(140 * 0.45));
  });
});

// ─────────────────────────────────────────────────────────
//  Game over detection
// ─────────────────────────────────────────────────────────
describe('calcTurn — game over', () => {

  it('wb reaching ≤ −100 triggers gameOver=true, score=0', () => {
    // wb=-90, tox=85 → −2 WB drain per card (zone 4), CRUNCH fx.wb=-10
    // -90 - 2 (tox drain) - 10 (fx) = -102 → clamped -100 → game over
    const res = calcTurn(
      [card('CRUNCH', { wb: -10 })],
      { ...baseCtx, wb: -90, tox: 85, mode: 'real' },
    );
    expect(res.gameOver).toBe(true);
    expect(res.score).toBe(0);
  });
});
