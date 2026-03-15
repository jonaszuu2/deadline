import { describe, it, expect } from 'vitest';
import { calcTurn } from '../src/engine/calcTurn.js';

// ── Minimal card factory ──────────────────────────────
const uid = (() => { let n = 0; return () => `uid_${n++}`; })();
const card = (archetype, fx = {}) => ({
  id: `card_${archetype}`, uid: uid(), name: archetype, archetype,
  fx: { chips: 0, mult: 0, wb: 0, tox: 0, ...fx },
  synergies: [], exhaust: false,
});

const base = {
  wb: 100, tox: 0, bo: 0, week: 1, plays: 3,
  passives: [], competencies: [], teammate: null,
  discardComboMult: 0, discardMultStack: 0,
  firstCardThisWeek: true, firstCrunchUsed: false, weekCrunchCount: 0,
  permMult: 0, brief: null,
};

describe('calcTurn — scoring formula', () => {
  it('chips × mult = score (base mult starts at 1.0)', () => {
    // chips=100, card mult=+1.0 → acc.mult=2.0, score=200
    const res = calcTurn([card('PRODUCTION', { chips: 100, mult: 1.0 })], base);
    expect(res.score).toBe(200);
    expect(res.chips).toBe(100);
  });

  it('empty card list scores 0', () => {
    const res = calcTurn([], base);
    expect(res.score).toBe(0);
    expect(res.chips).toBe(0);
  });

  it('permMult adds to base mult', () => {
    // mult = 1.0 + 0.5 = 1.5, chips = 100 → score = 150
    const res = calcTurn([card('PRODUCTION', { chips: 100 })], { ...base, permMult: 0.5 });
    expect(res.score).toBe(150);
  });

  it('discardComboMult adds to mult before card loop', () => {
    // mult = 1.0 + 0.8 = 1.8, chips = 100 → score = 180
    const res = calcTurn([card('PRODUCTION', { chips: 100 })], { ...base, discardComboMult: 0.8 });
    expect(res.score).toBe(180);
  });
});

describe('calcTurn — brief modifiers', () => {
  it('cost_reduction: CRUNCH chips ×1.4', () => {
    const res = calcTurn([card('CRUNCH', { chips: 100 })], { ...base, brief: 'cost_reduction' });
    expect(res.chips).toBe(140);
  });

  it('cost_reduction: CRUNCH wb cost doubled', () => {
    // wb: -10 → -20 under cost_reduction
    const res = calcTurn([card('CRUNCH', { chips: 50, wb: -10 })], { ...base, wb: 100, brief: 'cost_reduction' });
    expect(res.wb).toBe(80);
  });

  it('hyper_growth: PRODUCTION chips ×1.5', () => {
    const res = calcTurn([card('PRODUCTION', { chips: 100 })], { ...base, brief: 'hyper_growth' });
    expect(res.chips).toBe(150);
  });

  it('non-matching brief does not affect chips', () => {
    // wellness_initiative has no chip modifiers
    const res = calcTurn([card('PRODUCTION', { chips: 100 })], { ...base, brief: 'wellness_initiative' });
    expect(res.chips).toBe(100);
  });
});

describe('calcTurn — passives', () => {
  it('PRODUCTION_CHIPS passive adds flat chips to PRODUCTION cards', () => {
    const ctx = { ...base, passives: [{ passiveType: 'PRODUCTION_CHIPS', passiveVal: 20 }] };
    const res = calcTurn([card('PRODUCTION', { chips: 50 })], ctx);
    expect(res.chips).toBe(70);
  });

  it('PRODUCTION_CHIPS passive does not affect STRATEGY cards', () => {
    const ctx = { ...base, passives: [{ passiveType: 'PRODUCTION_CHIPS', passiveVal: 20 }] };
    const res = calcTurn([card('STRATEGY', { chips: 50 })], ctx);
    expect(res.chips).toBe(50);
  });
});

describe('calcTurn — combo multipliers', () => {
  it('triple PRODUCTION gives 1.3× combo mult', () => {
    const cards = [
      card('PRODUCTION', { chips: 30 }),
      card('PRODUCTION', { chips: 30 }),
      card('PRODUCTION', { chips: 30 }),
    ];
    const res = calcTurn(cards, base);
    // PRODUCTION CHAIN adds +10% chips per extra card: 90 + round(90 * 2 * 0.1) = 108
    // score = floor(108 * 1.3) = 140
    expect(res.comboMult).toBe(1.3);
    expect(res.score).toBe(Math.floor(108 * 1.3));
  });

  it('triple CRUNCH gives 1.4× combo mult', () => {
    const cards = [
      card('CRUNCH', { chips: 20 }),
      card('CRUNCH', { chips: 20 }),
      card('CRUNCH', { chips: 20 }),
    ];
    // weekCrunchCount starts at 0 → 2nd CRUNCH gets fatigue tox, but chips sum = 60
    const res = calcTurn(cards, base);
    expect(res.comboMult).toBe(1.4);
  });
});

describe('calcTurn — stat tracking', () => {
  it('tox accumulates from CRUNCH cards', () => {
    const res = calcTurn([card('CRUNCH', { chips: 20, tox: 15 })], { ...base, tox: 0 });
    expect(res.tox).toBe(15);
  });

  it('wb decreases from negative wb fx', () => {
    const res = calcTurn([card('CRUNCH', { wb: -10 })], { ...base, wb: 80 });
    expect(res.wb).toBe(70);
  });

  it('wb penalty applied when wb < 60 (low WB ×0.85)', () => {
    // At wb=35, chips penalty ×0.85 applied
    const res = calcTurn([card('PRODUCTION', { chips: 100 })], { ...base, wb: 35 });
    expect(res.chips).toBe(Math.floor(100 * 0.85));
  });
});
