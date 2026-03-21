// ═══════════════════════════════════════════════════════
//  DESK ITEMS DATABASE
//  Office objects that change HOW you play.
//  Like Jokers — rule-changers, not stat bumps.
// ═══════════════════════════════════════════════════════

export const DESK_ITEMS_DB = {
  // ── COMMON ──────────────────────────────────────────
  office_plant: {
    id:'office_plant', name:'Office Plant', icon:'🌿', rarity:'COMMON', passive: true,
    desc:'End of each week: −3% Toxicity.',
    flavor:'"The only living thing that survived the Q3 restructure."',
  },
  coffee_mug: {
    id:'coffee_mug', name:'Coffee Mug', icon:'☕', rarity:'COMMON',
    desc:'First play each week: +150 Output.',
    flavor:"Lukewarm. Bought at 7am. Undrinkable by 7:05.",
  },
  stress_ball: {
    id:'stress_ball', name:'Stress Ball', icon:'🔴', rarity:'COMMON',
    desc:'Wellbeing < 40%: +1.0 bonus Eff on this play.',
    flavor:"Given by HR after the restructure. Feels like an apology.",
  },
  calendar: {
    id:'calendar', name:'Wall Calendar', icon:'📅', rarity:'COMMON',
    desc:'PRODUCTION cards: +[week × 2] bonus Output each.',
    flavor:"The cats in each month seem increasingly judgemental.",
  },
  whiteboard: {
    id:'whiteboard', name:'Whiteboard', icon:'🖊️', rarity:'COMMON',
    desc:'End of week: all 4 archetypes used ≥1× → +0.5 permanent Eff.',
    flavor:"Covered in diagrams no one remembers drawing.",
  },
  // ── UNCOMMON ────────────────────────────────────────
  ergonomic_chair: {
    id:'ergonomic_chair', name:'Ergonomic Chair', icon:'🪑', rarity:'UNCOMMON', passive: true,
    desc:'All cards: WB damage reduced by 2 per card.',
    flavor:'"Lumbar support. The only support HR provides."',
  },
  mechanical_keyboard: {
    id:'mechanical_keyboard', name:'Mechanical Keyboard', icon:'⌨️', rarity:'UNCOMMON', passive: true,
    desc:'PRODUCTION cards: +50 Output each.',
    flavor:'"Clicky. Loud. Passive-aggressive at volume."',
  },
  water_cooler: {
    id:'water_cooler', name:'Water Cooler', icon:'💧', rarity:'UNCOMMON', passive: true,
    desc:'RECOVERY cards: healing and Tox reduction both ×1.25.',
    flavor:'"The true meeting room. No agenda. No notes. No follow-ups."',
  },
  agile_coach: {
    id:'agile_coach', name:'Agile Coach', icon:'📊', rarity:'UNCOMMON', passive: true,
    desc:'STRATEGY cards: +0.1 Eff each.',
    flavor:'"Charges by the hour. Delivers by the quarter."',
  },
  performance_bonus: {
    id:'performance_bonus', name:'Performance Bonus', icon:'💰', rarity:'UNCOMMON', passive: true,
    desc:'Each card played this turn: +75 Output.',
    flavor:'"Discretionary. Subject to change. Probably already changed."',
  },
  rubber_duck: {
    id:'rubber_duck', name:'Rubber Duck', icon:'🦆', rarity:'UNCOMMON',
    desc:"Solo play (1 card only): that play's Output ×2.",
    flavor:"Your only functional colleague. Tells HR nothing.",
  },
  company_mug: {
    id:'company_mug', name:'Company Award Mug', icon:'🏆', rarity:'UNCOMMON',
    desc:'Each KPI pass: +0.2 permanent Eff (stacks each week).',
    flavor:"Employee of Q3, 2018. Still coasting on it.",
  },
  mouse_pad: {
    id:'mouse_pad', name:'Motivational Mouse Pad', icon:'🖱️', rarity:'UNCOMMON',
    desc:'End of week: Toxicity ≤20% → +0.8 permanent Eff.',
    flavor:'"HUSTLE HARDER" — says the man who left at 3pm.',
  },
  action_figure: {
    id:'action_figure', name:'Action Figure', icon:'🧸', rarity:'UNCOMMON',
    desc:'Wellbeing < 50%: +0.8 bonus Eff on this play.',
    flavor:"Bought at peak desperation. Ironically, helps.",
  },
  // ── UNCOMMON (new — PRODUCTION build) ───────────────
  assembly_line: {
    id:'assembly_line', name:'Assembly Line', icon:'🏭', rarity:'UNCOMMON',
    desc:'2+ PRODUCTION cards in one play: chips ×1.8. Playing solo PRODUCTION: chips −30%.',
    flavor:'"Output at scale. Individual performance is a legacy concept."',
  },
  // ── UNCOMMON (new — STRATEGY build) ─────────────────
  consultants_notes: {
    id:'consultants_notes', name:"Consultant's Notes", icon:'📝', rarity:'UNCOMMON',
    desc:'Each STRATEGY card in a play gives +0.2 Eff immediately.',
    flavor:'"Expensive advice. Rarely implemented. Always expensed."',
  },
  // ── UNCOMMON (new — CRUNCH build) ───────────────────
  red_bull_stash: {
    id:'red_bull_stash', name:'Red Bull Stash', icon:'🥤', rarity:'UNCOMMON',
    desc:'Each CRUNCH card in a play: +0.4 Eff (stacks within turn). Each CRUNCH also adds +2 Burnout directly.',
    flavor:'"Sponsored by necessity. Unsustainable by design."',
  },
  // ── UNCOMMON (new — RECOVERY build) ─────────────────
  mindfulness_app: {
    id:'mindfulness_app', name:'Mindfulness App', icon:'🧘', rarity:'UNCOMMON',
    desc:'WB < 40%: RECOVERY cards give ×2 chips and ×2 healing this turn. WB > 70%: RECOVERY gives 0 chips.',
    flavor:'"Breathe in. Breathe out. Submit your deliverable."',
  },
  // ── RARE ────────────────────────────────────────────
  crisis_mode: {
    id:'crisis_mode', name:'Crisis Mode', icon:'🚨', rarity:'RARE',
    desc:'CRUNCH cards: WB damage halved.',
    flavor:'"The alarm is just background noise now."',
  },
  compound_interest: {
    id:'compound_interest', name:'Compound Interest', icon:'📈', rarity:'RARE',
    desc:'Each KPI pass: +0.3 permanent Eff (stacks every week).',
    flavor:'"Your resilience compounds. So does your overtime."',
  },
  hostile_environment: {
    id:'hostile_environment', name:'Hostile Environment', icon:'⚗️', rarity:'RARE',
    desc:'Tox > 30%: +100 Output per 10% Tox above 30% each play.',
    flavor:'"Channel the dysfunction. It\'s a feature now."',
  },
  hourglass: {
    id:'hourglass', name:'Hourglass', icon:'⏳', rarity:'RARE',
    desc:'Last play of the week (1 play remaining): Revenue ×1.5.',
    flavor:"Ornamental. Time-keeping responsibility outsourced to phone.",
  },
  cactus: {
    id:'cactus', name:'Cactus', icon:'🌵', rarity:'RARE',
    desc:'Tox ≥60%: +50 bonus Output/card. Tox ≥90%: +120 Output/card instead.',
    flavor:"The one plant that thrived in your environment. Relatable.",
  },
  red_stapler: {
    id:'red_stapler', name:'Red Stapler', icon:'❤️', rarity:'RARE',
    desc:'First PRODUCTION card played each week: permanently gains +20 chips to base stats.',
    flavor:"Milton's, actually. Don't touch it. He knows.",
  },
  // ── RARE (new — PRODUCTION build) ───────────────────
  kpi_dashboard: {
    id:'kpi_dashboard', name:'KPI Dashboard', icon:'📊', rarity:'RARE',
    desc:'Each KPI pass: all PRODUCTION cards in deck permanently +15 chips. Each fail: −10 chips (min 50).',
    flavor:'"Real-time metrics. Nobody looks at them in real time."',
  },
  // ── RARE (new — STRATEGY build) ─────────────────────
  quarterly_roadmap: {
    id:'quarterly_roadmap', name:'Quarterly Roadmap', icon:'📑', rarity:'RARE',
    desc:'Each STRATEGY card played permanently gains +0.05 Eff to its base stats (stacks every play).',
    flavor:'"A living document. It died in Q2."',
  },
  // ── RARE (new — CRUNCH build) ────────────────────────
  crunch_mode_poster: {
    id:'crunch_mode_poster', name:'Crunch Mode Poster', icon:'📌', rarity:'RARE',
    desc:'CRUNCH: WB damage −80%, chips ×1.5. Tox cost ×2.',
    flavor:'"Move fast. Break yourself. Repeat."',
  },
  // ── RARE (new — RECOVERY build) ─────────────────────
  wellness_program: {
    id:'wellness_program', name:'Wellness Program', icon:'💊', rarity:'RARE',
    desc:'RECOVERY: each 1% WB healed = +25 bonus Output. RECOVERY no longer reduces Toxicity.',
    flavor:'"Company-approved recovery. Results may not include actual recovery."',
  },
  // ── RARE (new — rule breakers) ───────────────────────
  flex_schedule: {
    id:'flex_schedule', name:'Flex Schedule', icon:'🗓️', rarity:'RARE',
    desc:'+1 play per week. Hand size −1 throughout the run.',
    flavor:'"Work when you want. Just work more."',
  },
  performance_improvement_plan: {
    id:'performance_improvement_plan', name:'Performance Improvement Plan', icon:'📋', rarity:'RARE',
    desc:'KPI targets −25% permanently. You cannot discard cards.',
    flavor:'"We believe in you. Also, we\'re watching you."',
  },
  // ── LEGENDARY ───────────────────────────────────────
  golden_mug: {
    id:'golden_mug', name:'Golden Mug', icon:'🥇', rarity:'LEGENDARY',
    desc:'Every 5th play of the run: Revenue ×2 on that play.',
    flavor:'"Sales Champion Q2" — a title held for 9 minutes.',
  },
  org_chart: {
    id:'org_chart', name:'Org Chart', icon:'🗺️', rarity:'LEGENDARY',
    desc:'Each play: +0.2 Eff per unique archetype in the combo (max +0.8).',
    flavor:"A document that causes more confusion than it solves. Classic.",
  },
  broken_printer: {
    id:'broken_printer', name:'Broken Printer', icon:'🖨️', rarity:'LEGENDARY',
    desc:'A play that generates 0 Output: +6 Coins and −10 Tox.',
    flavor:"Error 47: Success. The printer now works on its own terms.",
  },
  resignation_letter: {
    id:'resignation_letter', name:'Resignation Letter', icon:'📄', rarity:'LEGENDARY',
    active: true,
    desc:"[ACTIVE] Once per run: auto-PASS the current week's KPI target.",
    flavor:"Draft #19. Never sent. But knowing it exists is enough.",
  },
  // ── LEGENDARY (new — PRODUCTION build) ──────────────
  overtime_log: {
    id:'overtime_log', name:'Overtime Log', icon:'📒', rarity:'LEGENDARY',
    desc:"PRODUCTION played alone (1 card): Output ×4. PRODUCTION played with other archetypes: PRODUCTION chips don't count.",
    flavor:'"Logged. Tracked. Ignored by payroll."',
  },
  // ── LEGENDARY (new — STRATEGY build) ────────────────
  strategy_deck: {
    id:'strategy_deck', name:'Strategy Deck', icon:'🃏', rarity:'LEGENDARY',
    desc:"STRATEGY cards: their Eff bonus counts twice in the formula. Max selection reduced to 2 cards.",
    flavor:'"Less is more. Unless it\'s headcount. Then less is less."',
  },
  // ── LEGENDARY (new — CRUNCH build) ──────────────────
  burnout_culture_trophy: {
    id:'burnout_culture_trophy', name:'Burnout Culture Trophy', icon:'🏅', rarity:'LEGENDARY',
    desc:'CRUNCH: 0 Tox, 0 WB damage, chips ×2.5. Each CRUNCH adds +4 Burnout directly.',
    flavor:'"Awarded for \'going above and beyond\'. The trophy is made of rubber."',
  },
  // ── LEGENDARY (new — RECOVERY build) ────────────────
  sick_day_policy: {
    id:'sick_day_policy', name:'Sick Day Policy', icon:'🤒', rarity:'LEGENDARY',
    desc:'WB can never drop below 20% from a single play. RECOVERY Output ×3. Max 4 plays per week instead of 5.',
    flavor:'"You have 3 sick days. Use them wisely. HR is watching."',
  },
  // ── LEGENDARY (new — rule breakers) ─────────────────
  budget_freeze: {
    id:'budget_freeze', name:'Budget Freeze', icon:'🧊', rarity:'LEGENDARY',
    desc:'All packs cost 0 CC. Maximum 1 pack purchase per shop visit.',
    flavor:'"Spending frozen. Expectations unchanged."',
  },
  unlimited_pto: {
    id:'unlimited_pto', name:'Unlimited PTO', icon:'🏖️', rarity:'LEGENDARY',
    desc:'No discard limit. Each card discarded adds +5% Toxicity.',
    flavor:'"Take all the time off you need. It will cost you."',
  },
};

export const DESK_ITEMS_LIST = Object.values(DESK_ITEMS_DB);
export const DESK_ITEMS_BY_RARITY = {
  COMMON:    DESK_ITEMS_LIST.filter(d => d.rarity === 'COMMON'),
  UNCOMMON:  DESK_ITEMS_LIST.filter(d => d.rarity === 'UNCOMMON'),
  RARE:      DESK_ITEMS_LIST.filter(d => d.rarity === 'RARE'),
  LEGENDARY: DESK_ITEMS_LIST.filter(d => d.rarity === 'LEGENDARY'),
};
