/**
 * scoring.test.js — Vitest suite for the scoring engine.
 */
import { describe, it, expect } from 'vitest';
import { calculateFinalScore, computeAchievements, predictCareerTier } from '../src/engine/scoring.js';

// ── Minimal mock GameState ───────────────────────────────
function mockG(overrides = {}) {
  return {
    wb: 100,
    tox: 0,
    peakTox: 0,
    totalRawChips: 0,
    totalMultSum: 0,
    totalPlayCount: 0,
    totalTeammateWeeks: 0,
    wellnessWeeks: 0,
    failedWeeks: 0,
    week: 10,
    endCondition: 'annual',
    isTerminated: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
//  calculateFinalScore — component breakdown
// ─────────────────────────────────────────────────────────
describe('calculateFinalScore', () => {

  it('wbPts = G.wb * 10', () => {
    const G = mockG({ wb: 80 });
    const s = calculateFinalScore(G);
    expect(s.wbPts).toBe(80 * 10);
  });

  it('wbPts is negative when wb < 0', () => {
    const G = mockG({ wb: -20 });
    const s = calculateFinalScore(G);
    expect(s.wbPts).toBe(-200);
  });

  it('toxPts = peakTox * −5', () => {
    const G = mockG({ peakTox: 60 });
    const s = calculateFinalScore(G);
    expect(s.toxPts).toBe(-300);
  });

  it('rawPts = totalRawChips', () => {
    const G = mockG({ totalRawChips: 12000 });
    const s = calculateFinalScore(G);
    expect(s.rawPts).toBe(12000);
  });

  it('synPts = totalTeammateWeeks * 50', () => {
    const G = mockG({ totalTeammateWeeks: 8 });
    const s = calculateFinalScore(G);
    expect(s.synPts).toBe(400);
  });

  it('wellnessPts = wellnessWeeks * 150', () => {
    const G = mockG({ wellnessWeeks: 6 });
    const s = calculateFinalScore(G);
    expect(s.wellnessPts).toBe(900);
  });

  it('total = all components + achievement pts', () => {
    const G = mockG({
      wb: 100, peakTox: 0, totalRawChips: 5000,
      totalTeammateWeeks: 0, wellnessWeeks: 0,
      totalPlayCount: 10, totalMultSum: 15,
    });
    const s = calculateFinalScore(G);
    const expected = s.rawPts + s.multPts + s.wellnessPts + s.wbPts + s.toxPts + s.synPts + s.achPts;
    expect(s.total).toBe(expected);
  });

  it('multPts = floor(avgMult * 1000)', () => {
    const G = mockG({ totalPlayCount: 4, totalMultSum: 8.0 });
    const s = calculateFinalScore(G);
    expect(s.multPts).toBe(Math.floor(2.0 * 1000));
  });

  it('totalPlayCount=0 does not divide by zero (avgMult defaults to 1.0)', () => {
    const G = mockG({ totalPlayCount: 0, totalMultSum: 0 });
    const s = calculateFinalScore(G);
    expect(s.multPts).toBe(Math.floor(1.0 * 1000));
  });
});

// ─────────────────────────────────────────────────────────
//  predictCareerTier
// ─────────────────────────────────────────────────────────
describe('predictCareerTier', () => {

  it('score = 0 → tier 1 (Unmotivated Intern)', () => {
    const tier = predictCareerTier(0);
    expect(tier.tier).toBe(1);
  });

  it('score = 3000 → tier 2 (The Trainee)', () => {
    const tier = predictCareerTier(3000);
    expect(tier.tier).toBe(2);
  });

  it('score = 50000 → tier 10 (VP of Synergy Marketing)', () => {
    const tier = predictCareerTier(50000);
    expect(tier.tier).toBe(10);
  });

  it('score at tier 7 boundary (24000) → tier 7', () => {
    const tier = predictCareerTier(24000);
    expect(tier.tier).toBe(7);
  });

  it('negative score → tier 1', () => {
    const tier = predictCareerTier(-9999);
    expect(tier.tier).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
//  computeAchievements
// ─────────────────────────────────────────────────────────
describe('computeAchievements', () => {

  it('"Perfect Attendance" awarded when failedWeeks=0 and week=TOTAL_WEEKS (10)', () => {
    const G = mockG({ failedWeeks: 0, week: 10, endCondition: 'annual' });
    const badges = computeAchievements(G, 10000, 2.0, 5000);
    const badge = badges.find(b => b.label === 'Perfect Attendance');
    expect(badge).toBeDefined();
    expect(badge.pts).toBe(200);
  });

  it('"Perfect Attendance" NOT awarded when failedWeeks > 0', () => {
    const G = mockG({ failedWeeks: 1, week: 10, endCondition: 'annual' });
    const badges = computeAchievements(G, 10000, 2.0, 5000);
    const badge = badges.find(b => b.label === 'Perfect Attendance');
    expect(badge).toBeUndefined();
  });

  it('"Burnout Survivor" awarded for annual endCondition, positive pts', () => {
    const G = mockG({ endCondition: 'annual' });
    const badges = computeAchievements(G, 5000, 1.5, 2000);
    const badge = badges.find(b => b.label === 'Burnout Survivor');
    expect(badge).toBeDefined();
    expect(badge.pts).toBeGreaterThan(0);
  });

  it('"Scorched Earth" awarded for burnout endCondition, negative pts', () => {
    const G = mockG({ endCondition: 'burnout', isTerminated: true });
    const badges = computeAchievements(G, 3000, 1.0, 1000);
    const badge = badges.find(b => b.label === 'Scorched Earth');
    expect(badge).toBeDefined();
    expect(badge.pts).toBeLessThan(0);
  });

  it('"Zen Master" awarded when final wb ≥ 80', () => {
    const G = mockG({ wb: 85 });
    const badges = computeAchievements(G, 10000, 2.0, 5000);
    const badge = badges.find(b => b.label === 'Zen Master');
    expect(badge).toBeDefined();
  });

  it('"High Voltage" penalty when peakTox ≥ 80, negative pts', () => {
    const G = mockG({ peakTox: 85 });
    const badges = computeAchievements(G, 10000, 2.0, 5000);
    const badge = badges.find(b => b.label === 'High Voltage');
    expect(badge).toBeDefined();
    expect(badge.pts).toBeLessThan(0);
  });

  it('"Team Player" awarded when totalTeammateWeeks ≥ 5', () => {
    const G = mockG({ totalTeammateWeeks: 5 });
    const badges = computeAchievements(G, 10000, 2.0, 5000);
    const badge = badges.find(b => b.label === 'Team Player');
    expect(badge).toBeDefined();
  });

  it('"High Achiever" awarded when baseTotal ≥ 30000', () => {
    const G = mockG({});
    const badges = computeAchievements(G, 30000, 2.0, 15000);
    const badge = badges.find(b => b.label === 'High Achiever');
    expect(badge).toBeDefined();
    expect(badge.pts).toBe(250);
  });
});
