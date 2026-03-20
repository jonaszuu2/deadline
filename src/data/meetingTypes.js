// ═══════════════════════════════════════════════════════
//  MEETING TYPES
//  Named play patterns — like poker hands, but corporate.
//  Base meetings always available. Secret meetings unlocked by desk items.
// ═══════════════════════════════════════════════════════

// ── Base Meeting Definitions (priority-ordered: highest first) ──
// match(prodCount, stratCount, crunchCount, recovCount, total, uniqueArchs)
// bonus: applied after card loop as a meeting bonus
//   chips: flat Output added
//   mult:  flat Eff added
//   chipsX: multiplier on existing chips (e.g. 1.2)
//   wb:    WB change
//   tox:   Tox change
export const BASE_MEETINGS = [
  {
    id: 'all_hands', name: 'All-Hands Meeting', icon: '📣', tier: 5,
    desc: '3+ different archetypes',
    bonusDesc: '+400 Output, +1.0 Eff, +5% Tox (politics)',
    bonus: { chips: 400, mult: 1.0, tox: 5 },
    match: (p, s, c, r, total, u) => u >= 3,
  },
  {
    id: 'sprint_review', name: 'Sprint Review', icon: '🏃', tier: 4,
    desc: '3× PRODUCTION',
    bonusDesc: '+250 Output',
    bonus: { chips: 250 },
    match: (p, s, c, r) => p >= 3 && s === 0 && c === 0 && r === 0,
  },
  {
    id: 'board_meeting', name: 'Board Meeting', icon: '🏢', tier: 4,
    desc: '3× STRATEGY',
    bonusDesc: '+1.5 Eff',
    bonus: { mult: 1.5 },
    match: (p, s, c, r) => s >= 3 && p === 0 && c === 0 && r === 0,
  },
  {
    id: 'cross_functional', name: 'Cross-functional Sync', icon: '🔄', tier: 3,
    desc: 'PRODUCTION + STRATEGY',
    bonusDesc: '+80 Output, +0.4 Eff',
    bonus: { chips: 80, mult: 0.4 },
    match: (p, s, c, r) => p >= 1 && s >= 1 && c === 0 && r === 0,
  },
  {
    id: 'crunch_time', name: 'Crunch Time', icon: '🔥', tier: 3,
    desc: 'Any CRUNCH card',
    bonusDesc: 'Output ×1.2',
    bonus: { chipsX: 1.2 },
    match: (p, s, c) => c >= 1,
  },
  {
    id: 'strategy_session', name: 'Strategy Session', icon: '📊', tier: 3,
    desc: '2× STRATEGY',
    bonusDesc: '+0.8 Eff',
    bonus: { mult: 0.8 },
    match: (p, s, c, r) => s >= 2 && p === 0 && c === 0 && r === 0,
  },
  {
    id: 'status_update', name: 'Status Update', icon: '📋', tier: 2,
    desc: '2× PRODUCTION',
    bonusDesc: '+100 Output',
    bonus: { chips: 100 },
    match: (p, s, c, r) => p >= 2 && s === 0 && c === 0 && r === 0,
  },
  {
    id: 'wellness_check', name: 'Wellness Check', icon: '💚', tier: 2,
    desc: 'RECOVERY card(s)',
    bonusDesc: '+15 WB, −5% Tox',
    bonus: { wb: 15, tox: -5 },
    match: (p, s, c, r) => r >= 1,
  },
  {
    id: 'one_on_one', name: 'One-on-One', icon: '👤', tier: 1,
    desc: '1× STRATEGY',
    bonusDesc: '+0.3 Eff',
    bonus: { mult: 0.3 },
    match: (p, s, c, r) => s >= 1 && p === 0 && c === 0 && r === 0,
  },
  {
    id: 'quick_email', name: 'Quick Email', icon: '📧', tier: 1,
    desc: '1× PRODUCTION',
    bonusDesc: '+40 Output',
    bonus: { chips: 40 },
    match: (p, s, c, r) => p >= 1 && s === 0 && c === 0 && r === 0,
  },
];

// ── Secret Meeting Definitions (each requires a specific desk item) ──
// Discovered mid-run when desk item + right combo + right context align.
// ctx: { lastMeetingType, stratCarryMult }
export const SECRET_MEETINGS = [
  {
    id: 'agile_sprint', name: 'AGILE SPRINT', icon: '⚡', tier: 6, secret: true,
    requires: 'assembly_line',
    desc: 'Consecutive Sprint Reviews: Output ×1.5',
    flavor: '"Velocity metrics through the roof. Nobody slept."',
    match: (p, s, c, r, total, u, ctx) =>
      p >= 3 && s === 0 && c === 0 && r === 0 && ctx.lastMeetingType === 'sprint_review',
  },
  {
    id: 'executive_brief', name: 'EXECUTIVE BRIEF', icon: '💼', tier: 6, secret: true,
    requires: 'strategy_deck',
    desc: 'Board Meeting after Strategy Session: +2.0 Eff',
    flavor: '"Slides approved. Nobody read them. Success."',
    match: (p, s, c, r, total, u, ctx) =>
      s >= 3 && p === 0 && c === 0 && r === 0 && ctx.lastMeetingType === 'strategy_session',
  },
  {
    id: 'death_march', name: 'DEATH MARCH', icon: '💀', tier: 6, secret: true,
    requires: 'burnout_culture_trophy',
    desc: '3× CRUNCH: Revenue ×2, +15 Burnout',
    flavor: '"We move fast. Some of us don\'t make it."',
    match: (p, s, c, r) => c >= 3 && p === 0 && s === 0 && r === 0,
  },
  {
    id: 'mental_health_day', name: 'MENTAL HEALTH DAY', icon: '🌿', tier: 5, secret: true,
    requires: 'wellness_program',
    desc: 'Solo RECOVERY: Output ×3',
    flavor: '"Taking the day. For strategic reasons."',
    match: (p, s, c, r, total) => r === 1 && p === 0 && s === 0 && c === 0 && total === 1,
  },
  {
    id: 'strategic_pivot', name: 'STRATEGIC PIVOT', icon: '🔀', tier: 5, secret: true,
    requires: 'consultants_notes',
    desc: 'Cross-functional Sync with active carry: +1.0 Eff',
    flavor: '"Leveraging prior learnings to synergize forward momentum."',
    match: (p, s, c, r, total, u, ctx) =>
      p >= 1 && s >= 1 && c === 0 && r === 0 && (ctx.stratCarryMult || 0) > 0,
  },
];

// ── Detection ─────────────────────────────────────────
export function detectMeeting(cards, deskItems = [], ctx = {}) {
  if (!cards || !cards.length) return null;
  const p = cards.filter(c => c.archetype === 'PRODUCTION').length;
  const s = cards.filter(c => c.archetype === 'STRATEGY').length;
  const cr = cards.filter(c => c.archetype === 'CRUNCH').length;
  const r = cards.filter(c => c.archetype === 'RECOVERY').length;
  const total = cards.length;
  const u = new Set(cards.map(c => c.archetype)).size;

  const deskIds = new Set((deskItems || []).map(d => d.id));

  // Secret meetings first (require specific desk item)
  for (const sm of SECRET_MEETINGS) {
    if (deskIds.has(sm.requires) && sm.match(p, s, cr, r, total, u, ctx)) {
      return sm;
    }
  }

  // Base meetings
  for (const bm of BASE_MEETINGS) {
    if (bm.match(p, s, cr, r, total, u)) {
      return bm;
    }
  }

  return null;
}

// ── Near-miss hint: what 1 card addition would upgrade the meeting ──
// Returns { addArch, nextMeeting } or null
const _upgradePaths = {
  quick_email:       { addArch: 'PRODUCTION', nextId: 'status_update'   },
  status_update:     { addArch: 'PRODUCTION', nextId: 'sprint_review'    },
  one_on_one:        { addArch: 'STRATEGY',   nextId: 'strategy_session' },
  strategy_session:  { addArch: 'STRATEGY',   nextId: 'board_meeting'    },
  wellness_check:    null,
  cross_functional:  null,
  crunch_time:       null,
  sprint_review:     null, // handled separately (agile_sprint)
  board_meeting:     null, // handled separately (executive_brief)
  all_hands:         null,
};

export function getMeetingUpgradeHint(meeting, deskItems = [], ctx = {}) {
  if (!meeting) return null;

  const deskIds = new Set((deskItems || []).map(d => d.id));

  // Check for secret meeting unlock hints
  if (meeting.id === 'sprint_review' && deskIds.has('assembly_line')) {
    return { special: true, text: `Next Sprint Review → ⚡ AGILE SPRINT!` };
  }
  if (meeting.id === 'strategy_session' && deskIds.has('strategy_deck')) {
    return { special: true, text: `Add 1 STRATEGY → 💼 EXECUTIVE BRIEF!` };
  }
  if (meeting.id === 'cross_functional' && deskIds.has('consultants_notes') && ctx.stratCarryMult > 0) {
    return { special: true, text: `Carry active → 🔀 STRATEGIC PIVOT!` };
  }

  // Standard upgrade path
  const path = _upgradePaths[meeting.id];
  if (!path) return null;
  const next = BASE_MEETINGS.find(m => m.id === path.nextId);
  if (!next) return null;
  return { special: false, addArch: path.addArch, text: `+1 ${path.addArch} → ${next.icon} ${next.name}` };
}

// Tier color for display
export const MEETING_TIER_COLORS = {
  1: '#888',
  2: '#aaa',
  3: '#6ab4ff',
  4: '#ff9500',
  5: '#ff2d55',
  6: '#fbbf24',
};
