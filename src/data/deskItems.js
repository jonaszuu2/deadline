// ═══════════════════════════════════════════════════════
//  DESK ITEMS DATABASE
//  25 office objects that change HOW you play.
//  Like Jokers — rule-changers, not stat bumps.
// ═══════════════════════════════════════════════════════

export const DESK_ITEMS_DB = {
  // ── COMMON ──────────────────────────────────────────
  coffee_mug: {
    id:'coffee_mug', name:'Coffee Mug', icon:'☕', rarity:'COMMON',
    desc:'First play each week: +50 Chips.',
    flavor:"Lukewarm. Bought at 7am. Undrinkable by 7:05.",
  },
  sticky_notes: {
    id:'sticky_notes', name:'Sticky Notes', icon:'🟨', rarity:'COMMON',
    desc:'Playing 3 cards at once: +20 Chips per card beyond 2.',
    flavor:"A wall of yellow. 90% are 'TODO: handle this later'.",
  },
  desk_fan: {
    id:'desk_fan', name:'Desk Fan', icon:'🌀', rarity:'COMMON',
    desc:'Each play: if Toxicity ≥50%, reduce it by 3 before scoring.',
    flavor:"Oscillates between 'barely on' and 'papers everywhere'.",
  },
  stapler: {
    id:'stapler', name:'Stapler', icon:'🔩', rarity:'COMMON',
    desc:'Playing exactly 2 cards: +30 bonus Chips.',
    flavor:"Has never been refilled. Somehow still works.",
  },
  paper_clip: {
    id:'paper_clip', name:'Paper Clip Chain', icon:'📎', rarity:'COMMON',
    desc:'+5 Chips per card remaining in hand (not played this turn).',
    flavor:"Hand made. 47 links. 3 hours of your life.",
  },
  stress_ball: {
    id:'stress_ball', name:'Stress Ball', icon:'🔴', rarity:'COMMON',
    desc:'Wellbeing < 40%: +0.5 bonus Mult on this play.',
    flavor:"Given by HR after the restructure. Feels like an apology.",
  },
  calendar: {
    id:'calendar', name:'Wall Calendar', icon:'📅', rarity:'COMMON',
    desc:'PRODUCTION cards: +[current week number] bonus Chips each.',
    flavor:"The cats in each month seem increasingly judgemental.",
  },
  whiteboard: {
    id:'whiteboard', name:'Whiteboard', icon:'🖊️', rarity:'COMMON',
    desc:'End of week: all 4 archetypes used ≥1× → +0.3 permanent Mult.',
    flavor:"Covered in diagrams no one remembers drawing.",
  },
  // ── UNCOMMON ────────────────────────────────────────
  rubber_duck: {
    id:'rubber_duck', name:'Rubber Duck', icon:'🦆', rarity:'UNCOMMON',
    desc:"Solo play (1 card only): that play's Chips ×2.",
    flavor:"Your only functional colleague. Tells HR nothing.",
  },
  desk_lamp: {
    id:'desk_lamp', name:'Desk Lamp', icon:'💡', rarity:'UNCOMMON',
    desc:'STRATEGY cards: +15 bonus Chips each.',
    flavor:"Bought for ambience. Now essential. Won't work without it.",
  },
  nameplate: {
    id:'nameplate', name:'Nameplate', icon:'🪪', rarity:'UNCOMMON',
    desc:'KPI pass week: +5 bonus Coins at end of week.',
    flavor:"Your name, misspelled. You've given up correcting it.",
  },
  inbox_tray: {
    id:'inbox_tray', name:'Inbox Tray', icon:'📥', rarity:'UNCOMMON',
    desc:'Playing 3+ cards at once: +0.3 bonus Mult.',
    flavor:"Full. Always. You process one email a fortnight.",
  },
  fidget_spinner: {
    id:'fidget_spinner', name:'Fidget Spinner', icon:'🌪️', rarity:'UNCOMMON',
    desc:'CRUNCH cards: Toxicity cost −5 (minimum 0).',
    flavor:"2017 called. You kept it. No regrets. Many regrets.",
  },
  mouse_pad: {
    id:'mouse_pad', name:'Motivational Mouse Pad', icon:'🖱️', rarity:'UNCOMMON',
    desc:'End of week: Toxicity ≤10% → +0.5 permanent Mult.',
    flavor:'"HUSTLE HARDER" — says the man who left at 3pm.',
  },
  company_mug: {
    id:'company_mug', name:'Company Award Mug', icon:'🏆', rarity:'UNCOMMON',
    desc:'Each KPI pass: +0.1 permanent Mult (stacks each week).',
    flavor:"Employee of Q3, 2018. Still coasting on it.",
  },
  // ── RARE ────────────────────────────────────────────
  rubber_band_ball: {
    id:'rubber_band_ball', name:'Rubber Band Ball', icon:'🟠', rarity:'RARE',
    desc:'2nd+ CRUNCH this turn: Crunch Fatigue Tox cost halved.',
    flavor:"Grown over 4 years. Somehow has structural integrity.",
  },
  hourglass: {
    id:'hourglass', name:'Hourglass', icon:'⏳', rarity:'RARE',
    desc:'Last play of the week (1 play remaining): Chips ×1.5.',
    flavor:"Ornamental. Time-keeping responsibility outsourced to phone.",
  },
  cactus: {
    id:'cactus', name:'Cactus', icon:'🌵', rarity:'RARE',
    desc:'Tox ≥60%: +50 bonus Chips/card. Tox ≥90%: +120 Chips/card instead.',
    flavor:"The one plant that thrived in your environment. Relatable.",
  },
  whitenoise_machine: {
    id:'whitenoise_machine', name:'White Noise Machine', icon:'🔊', rarity:'RARE',
    desc:'RECOVERY cards: +0.2 bonus Mult each.',
    flavor:"Drowns out Gary. Not legally. But effectively.",
  },
  red_stapler: {
    id:'red_stapler', name:'Red Stapler', icon:'❤️', rarity:'RARE',
    desc:"First play of week + first card is PRODUCTION: +100 Chips.",
    flavor:"Milton's, actually. Don't touch it. He knows.",
  },
  action_figure: {
    id:'action_figure', name:'Action Figure', icon:'🧸', rarity:'RARE',
    desc:'Wellbeing < 50%: +0.3 bonus Mult on this play.',
    flavor:"Bought at peak desperation. Ironically, helps.",
  },
  // ── LEGENDARY ───────────────────────────────────────
  golden_mug: {
    id:'golden_mug', name:'Golden Mug', icon:'🥇', rarity:'LEGENDARY',
    desc:'Every 5th play of the run: Chips ×2 on that play.',
    flavor:'"Sales Champion Q2" — a title held for 9 minutes.',
  },
  org_chart: {
    id:'org_chart', name:'Org Chart', icon:'🗺️', rarity:'LEGENDARY',
    desc:'Each play: +0.2 Mult per unique archetype in the combo (max +0.8).',
    flavor:"A document that causes more confusion than it solves. Classic.",
  },
  broken_printer: {
    id:'broken_printer', name:'Broken Printer', icon:'🖨️', rarity:'LEGENDARY',
    desc:'A play that generates 0 Chips: +6 Coins and −10 Tox.',
    flavor:"Error 47: Success. The printer now works on its own terms.",
  },
  resignation_letter: {
    id:'resignation_letter', name:'Resignation Letter', icon:'📄', rarity:'LEGENDARY',
    active: true,
    desc:"[ACTIVE] Once per run: auto-PASS the current week's KPI target.",
    flavor:"Draft #19. Never sent. But knowing it exists is enough.",
  },
};

export const DESK_ITEMS_LIST = Object.values(DESK_ITEMS_DB);
export const DESK_ITEMS_BY_RARITY = {
  COMMON:    DESK_ITEMS_LIST.filter(d => d.rarity === 'COMMON'),
  UNCOMMON:  DESK_ITEMS_LIST.filter(d => d.rarity === 'UNCOMMON'),
  RARE:      DESK_ITEMS_LIST.filter(d => d.rarity === 'RARE'),
  LEGENDARY: DESK_ITEMS_LIST.filter(d => d.rarity === 'LEGENDARY'),
};
