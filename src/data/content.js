// ═══════════════════════════════════════════════════════
//  TEAMMATES DATABASE
// ═══════════════════════════════════════════════════════
export const TEAMMATES_DB = {
  gary:{
    id:'gary',name:'Gary',fullName:"Gary 'The Synergizer'",portrait:'🗣️',
    color:'#e8a000',
    desc:"Gary lives for meetings. He doesn't produce, but boy, does he 'circle back'. Gary is always in your calendar. Gary has never delivered a deck on time. Gary is your teammate this week.",
    buffText:'+0.5 Eff per 20% of current Toxicity at the start of each play action.',
    penaltyText:"Gary 'presents' one random card from your hand to the group each time you play, removing it.",
    tiers:[
      {tier:1,name:'Unusually Helpful',
       buffText:'+100 Output per card played — no removal.',
       penaltyText:'None.',
       triggerQuote:'I pre-read the brief. I know. Don\'t make it weird.'},
      {tier:2,name:'Corporate Synergizer',
       buffText:'+0.5 Eff per 20% of current Toxicity.',
       penaltyText:'Removes 1 random card from hand per play.',
       triggerQuote:'Circle back, unpack, ideate. Let\'s get this in the diary.'},
      {tier:3,name:'Chaotic Results Machine',
       buffText:'+1.0 Eff per 10% Toxicity (max +10!)',
       penaltyText:'Removes 2 cards per play. +5 Burnout per play.',
       triggerQuote:'I don\'t CARE how. The numbers are green. That\'s all that exists.'},
    ],
  },
  sarah:{
    id:'sarah',name:'Sarah',fullName:"Sarah 'The Ghoster'",portrait:'👻',
    color:'#6688cc',
    desc:"Sarah is a legend. Mostly because no one has seen her since the 2019 Christmas Party. She's technically still employed. Her badge still works. Someone saw her mug in the kitchen last Tuesday.",
    buffText:'-10% Toxicity at the start of every Week (she allegedly filed a wellness report).',
    penaltyText:'Max hand size reduced by 1 — you draw 6 cards instead of 7. Sarah has the other one.',
    tiers:[
      {tier:1,name:'Mysteriously Present',
       buffText:'-20 Tox at week start. +2 Wellbeing per play.',
       penaltyText:'Hand size -1.',
       triggerQuote:'I set up a retro board. The cat GIF stays. Non-negotiable.'},
      {tier:2,name:'The Ghoster',
       buffText:'-10 Tox at week start.',
       penaltyText:'Hand size -1.',
       triggerQuote:'I\'ll action this async. Ping me if urgent. Don\'t ping me.'},
      {tier:3,name:'Completely Missing',
       buffText:'+0.8 Eff per play (lean team).',
       penaltyText:'+15 Tox at week start. Hand size -2.',
       triggerQuote:'Her last Slack message was 6 days ago. It was just \'🙃\'.'},
    ],
  },
  ben:{
    id:'ben',name:'Ben',fullName:"Ben 'The Yes-Man'",portrait:'🙋',
    color:'#88cc44',
    desc:"Ben has the boss's personal mobile number. He sends birthday cards. He laughs at every joke. He is the most dangerous person in the office — because somehow, it works. Management loves him. You hate him. You also need him.",
    buffText:'Weekly KPI target reduced by 8% — Ben already told the boss you\'re exceeding expectations.',
    penaltyText:'+6% Toxicity each time you play a STRATEGY card — the team notices who\'s getting the favours.',
    tiers:[
      {tier:1,name:'Genuine Advocate',
       buffText:'KPI -12%. -3 Tox per STRATEGY card played.',
       penaltyText:'None.',
       triggerQuote:'I actually BELIEVE in you. Please don\'t tell anyone.'},
      {tier:2,name:'The Yes-Man',
       buffText:'KPI -8%.',
       penaltyText:'+6 Tox per STRATEGY card played.',
       triggerQuote:'I told the boss you\'re crushing it. Which… you\'d better now.'},
      {tier:3,name:'Over-Promised',
       buffText:'None.',
       penaltyText:'KPI -25%. +15 Tox per STRATEGY. +5 Burnout per play.',
       triggerQuote:'I told the board you\'d close Q4. Alone. By Friday. Go.'},
    ],
  },
  alex:{
    id:'alex',name:'Alex',fullName:"Alex 'The Alpha Trainee'",portrait:'🦈',
    color:'#cc4444',
    desc:"Alex doesn't work with you; he works at you. Hyper-competitive machine. He steals your best leads. He cc's your boss on everything. When he actually helps though, targets melt.",
    buffText:'+75 to +450 Output per card played (scales with your toxicity).',
    penaltyText:'Every 3rd week Alex is your teammate, he triggers an "HR Snitch" event: -15 Wellbeing, +10 Toxicity.',
    tiers:[
      {tier:1,name:'Competitive but Contained',
       buffText:'+75 Output per card.',
       penaltyText:'HR Snitch every 4th week: -10 WB, +8 Tox.',
       triggerQuote:'I\'m watching your metrics. Just friendly competition. Ha ha.'},
      {tier:2,name:'The Alpha Trainee',
       buffText:'+200 Output per card.',
       penaltyText:'HR Snitch every 3rd week: -15 WB, +10 Tox.',
       triggerQuote:'I CC\'d your boss on my 7am email. For visibility.'},
      {tier:3,name:'Full Predator Mode',
       buffText:'+450 Output per card.',
       penaltyText:'HR Snitch EVERY WEEK: -25 WB, +20 Tox.',
       triggerQuote:'I CC\'d the CEO on my therapy session notes. No regrets.'},
    ],
  },
  derek:{
    id:'derek',name:'Derek',fullName:"Derek 'The Micromanager'",portrait:'📋',
    color:'#ff8844',
    desc:"Derek reviews everything. Every card. Every play. Every decision you almost made. He means well. He doesn't. But PRODUCTION numbers have never been cleaner.",
    buffText:'+150 to +300 Output per PRODUCTION card played. He personally approves each deliverable.',
    penaltyText:'STRATEGY cards cost +8 Toxicity — "Why are we wasting time planning?"',
    tiers:[
      {tier:1,name:'Performance Coach',
       buffText:'+150 Output per PRODUCTION card. +5 WB per PRODUCTION played.',
       penaltyText:'None. He is having a good week.',
       triggerQuote:'I reviewed your work. It\'s adequate. That\'s a compliment from me.'},
      {tier:2,name:'The Micromanager',
       buffText:'+150 Output per PRODUCTION card.',
       penaltyText:'+8 Tox per STRATEGY card — "Less talking, more doing."',
       triggerQuote:'I need a status update on your status update. Is that done yet?'},
      {tier:3,name:'Total Control',
       buffText:'+300 Output per PRODUCTION card.',
       penaltyText:'+15 Tox per STRATEGY card. +3 Burnout per PRODUCTION played.',
       triggerQuote:'I own this outcome. You are a resource. Resources don\'t strategize.'},
    ],
  },
  priya:{
    id:'priya',name:'Priya',fullName:"Priya 'The Data Scientist'",portrait:'📊',
    color:'#44ccaa',
    desc:"Priya runs the numbers before anyone asks. Her STRATEGY insights are sharp, her RECOVERY recommendations are evidence-based. Under pressure though, she disappears into spreadsheets.",
    buffText:'STRATEGY cards gain +0.4 Eff. RECOVERY cards heal 50% more WB.',
    penaltyText:'T3: RECOVERY WB halved. +10 Tox at week start (deadline overload).',
    tiers:[
      {tier:1,name:'Insightful Analyst',
       buffText:'STRATEGY +0.2 Eff. RECOVERY cards: -10 bonus Tox.',
       penaltyText:'None.',
       triggerQuote:'The data says this works. I\'ve run 40 simulations. Trust the model.'},
      {tier:2,name:'The Data Scientist',
       buffText:'STRATEGY +0.4 Eff. RECOVERY WB healed ×1.5.',
       penaltyText:'None.',
       triggerQuote:'Statistically, you should be fine. The confidence interval is wide though.'},
      {tier:3,name:'Analysis Paralysis',
       buffText:'STRATEGY +0.6 Eff.',
       penaltyText:'+10 Tox at week start. RECOVERY WB halved — too busy modelling to rest.',
       triggerQuote:'I need more data before I can recommend recovery. Have you tried a pivot table?'},
    ],
  },
};


// ═══════════════════════════════════════════════════════
//  TUTORIAL DATABASE
// ═══════════════════════════════════════════════════════
export const TUTORIAL_DB = [
  {step:1,icon:'📋',title:'WELCOME TO DEADLINE™',
   content:'You are a valued employee. Your goal: <b>survive 10 weeks</b> of performance reviews. Each week, play cards to hit your KPI target. This tutorial will walk you through your first turn.',
   highlight:null,btn:'▶ BEGIN ONBOARDING'},
  {step:2,icon:'🎯',title:'YOUR CORE KPI: REVENUE',
   content:'To survive, you must generate <b>Output</b> (Base Production) and multiply it with <b>Efficiency</b> (Strategic Multiplier). The formula is simple: <b>REVENUE = OUTPUT × EFFICIENCY</b>. Your Weekly Revenue Target is shown in the header — it increases every week.',
   highlight:'#score-machine',btn:'UNDERSTOOD'},
  {step:3,icon:'📊',title:'MANAGING YOUR ASSETS',
   content:'You have limited resources per week: <b>3 PLAYS</b> and <b>2 DISCARDS</b>. Each play: select 1–3 cards and hit Submit. Discards cycle unwanted cards without spending a play. The KPI progress bar is shown in the header above.',
   highlight:'#hdr',btn:'NOTED'},
  {step:4,icon:'❤️',title:'THE EMPLOYEE DASHBOARD',
   content:'Monitor your stats at all times: <b>❤️ WB (Wellbeing)</b> — your HP, 0% = game over. <b>☣️ TOX (Toxicity)</b> — above 50% causes random WB damage after each play. <b>🔥 BO (Burnout)</b> — hits 100% = immediate termination, never resets.',
   highlight:'#employee-dashboard',btn:'ACKNOWLEDGED'},
  {step:5,icon:'🃏',title:'YOUR HAND',
   content:'<b>Click a card to select it</b> — you can select up to 3 per play. Each card shows its <b>Output</b> (base value), <b>Efficiency</b> (multiplier), any stat costs (TOX/WB), and optional synergy conditions. <b>Combine PRODUCTION + STRATEGY</b> cards for the most efficient plays.',
   highlight:'#hand',btn:'GOT IT'},
  {step:6,icon:'⚡',title:'LIVE PREVIEW',
   content:'<b>Select 2 or more cards now.</b> The Revenue Machine above updates in real time — showing projected Output × Efficiency, WB/TOX changes, and any synergies that will fire. <b>Always read the preview before hitting Submit.</b>',
   highlight:'#score-machine',btn:'CONTINUE →',waitForCards:true},
  {step:7,icon:'👥',title:'PERKS & TEAMMATES',
   content:'Your <b>Competencies (Perks)</b> are permanent bonuses from your class. Your <b>Teammate</b> rotates every week — granting buffs <i>and</i> penalties based on your current Toxicity level. Hover their name in the header to see active effects.',
   highlight:'#right-panel',btn:'CLEAR'},
  {step:8,icon:'✅',title:'MAKE YOUR FIRST PLAY',
   content:'You\'re ready. Select 1–3 cards — a <b>PRODUCTION + STRATEGY</b> combo is a strong start. Then hit <b>SUBMIT PLAY</b>. You have <b>3 plays and 2 discards</b> this week. Hit the KPI target before you run out of plays.',
   highlight:null,btn:'▶ LET\'S GO'},
];

// ── Brief ↔ Teammate friction (opposed = 0.8× teammate buff) ──────────
// Format: "brief_id:teammate_id"
// Aligned = 1.0 (no change). Opposed = 0.8 (friction signal).
export const BRIEF_TEAMMATE_FRICTION = new Set([
  'cost_reduction:sarah',   // CRUNCH brief vs RECOVERY specialist
  'cost_reduction:priya',   // CRUNCH brief vs STRATEGY/RECOVERY specialist
  'hyper_growth:ben',       // max pressure brief vs stress reducer
  'sustainable_growth:alex',// careful WB brief vs chaos agent
  'scale_or_fail:ben',      // harder KPI brief vs KPI reducer
]);
