// ═══════════════════════════════════════════════════════
//  PROJECT BRIEFS
//  Shown after week 1 shop — defines run identity for weeks 2–10.
//  Each brief: one enable + one constraint + side objective.
// ═══════════════════════════════════════════════════════

export const BRIEFS_DB = {
  digital_transformation: {
    id: 'digital_transformation',
    name: 'DIGITAL TRANSFORMATION',
    tagline: 'Every STRATEGY play permanently upgrades your STRATEGY cards.',
    icon: '💻',
    color: '#7090ff',
    effectShort: 'STRATEGY played → all copies +3 chips permanently.',
    constraintShort: 'No constraint — commit to STRATEGY.',
    sideObjectiveDesc: 'Play STRATEGY cards 25× this run',
    sideRewardDesc: '+1.0 permanent Eff',
    sideTarget: 25,
  },
  cost_reduction: {
    id: 'cost_reduction',
    name: 'COST REDUCTION MANDATE',
    tagline: 'CRUNCH harder. Survive the consequences.',
    icon: '✂️',
    color: '#ff6030',
    effectShort: 'CRUNCH: chips ×1.6, WB damage +50%, +3% TOX per card.',
    constraintShort: '+3% TOX per CRUNCH card played.',
    sideObjectiveDesc: 'End 5 weeks with TOX below 35%',
    sideRewardDesc: 'Free card removal at next shop',
    sideTarget: 5,
  },
  sustainable_growth: {
    id: 'sustainable_growth',
    name: 'SUSTAINABLE GROWTH',
    tagline: 'Recovery is not weakness — it\'s revenue.',
    icon: '🌱',
    color: '#60ff80',
    effectShort: 'RECOVERY: +30 chips per 1% WB healed. Cannot reduce TOX.',
    constraintShort: 'RECOVERY cards no longer reduce Toxicity.',
    sideObjectiveDesc: 'Generate 3000+ chips from RECOVERY this run',
    sideRewardDesc: '+2.0 permanent Eff',
    sideTarget: 3000,
  },
  hyper_growth: {
    id: 'hyper_growth',
    name: 'HYPER-GROWTH MODE',
    tagline: 'Smaller team. Bigger output.',
    icon: '📈',
    color: '#ffdd44',
    effectShort: 'PRODUCTION: chips ×1.5. No PRODUCTION in a play: chips −20%. Hand −1.',
    constraintShort: 'Hand size −1 all run.',
    sideObjectiveDesc: 'Hit ≥150% KPI three weeks in a row',
    sideRewardDesc: '+1 play next week',
    sideTarget: 3,
  },
  restructure: {
    id: 'restructure',
    name: 'RESTRUCTURE PROTOCOL',
    tagline: 'Fewer cards. Stronger plays.',
    icon: '📉',
    color: '#cc99ff',
    effectShort: 'Deck ≤10 cards: +0.1 Eff/card below 10 per play. Removal always free.',
    constraintShort: 'Removal always free. New cards start weaker (3-play warmup).',
    sideObjectiveDesc: 'End run with ≤8 cards in deck',
    sideRewardDesc: '+3.0 permanent Eff',
    sideTarget: 8,
  },
  scale_or_fail: {
    id: 'scale_or_fail',
    name: 'SCALE OR FAIL',
    tagline: 'No salary. Only multipliers.',
    icon: '🚀',
    color: '#ff9966',
    effectShort: 'Passing gives +0.2/0.3/0.4 perm Eff instead of CC. KPI +15% harder.',
    constraintShort: 'KPI targets +15%. No CC from weekly pass.',
    sideObjectiveDesc: 'Pass 8 or more weeks',
    sideRewardDesc: 'Final perm Eff ×2',
    sideTarget: 8,
  },
};

export const BRIEFS_LIST = Object.values(BRIEFS_DB);
