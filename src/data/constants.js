// ─── Utility ─────────────────────────────────────────────────────────────────
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════
//  GAME CONSTANTS & KPI
// ═══════════════════════════════════════════════════════
export const KPI = [240, 360, 490, 640, 740, 860, 1200, 1380, 1560, 1750];
export const TOTAL_WEEKS = 10;
export const PLAYS = 3;
export const DISCS = 2;
export const HAND = 5;
export const MAX_SEL = 3;
export const TOX_DMG = 10;
export const FAIL_BO = 20;

// ═══════════════════════════════════════════════════════
//  STATUS EFFECTS DATABASE
// ═══════════════════════════════════════════════════════
export const STATUS_EFFECTS_DB = {
  wb:[
    {min:60,max:100,label:'Optimal Health',color:'#80ffa8',
     desc:'No penalties. Keep it up.'},
    {min:30,max:59,label:'Fatigued',color:'#ffdd44',
     desc:'All Mult reduced by 10%. The meetings are getting to you.'},
    {min:1,max:29,label:'Critically Ill',color:'#ff8040',
     desc:'All Chips reduced by 25%. All Mult reduced by 20%. You should not be here.'},
    {min:0,max:0,label:'GAME OVER',color:'#ff2020',
     desc:'You have burned out completely. HR is filing the paperwork.'},
  ],
  tox:[
    {min:0,max:39,label:'Safe Environment',color:'#80ffa8',
     desc:'No penalties. Someone even brought cake today. End of week: +0 Burnout.'},
    {min:40,max:69,label:'Hostile Office',color:'#ffdd44',
     desc:'Toxic checks active above 50%: each card risks −10 Wellbeing. End of week: +2 Burnout.'},
    {min:70,max:89,label:'Toxic Culture',color:'#ff8040',
     desc:'High damage risk per card. The stress is becoming structural. End of week: +3–4 Burnout.'},
    {min:90,max:99,label:'Hazardous',color:'#ff2020',
     desc:'Critical chronic exposure. End of week: +4 Burnout. You are surviving, not working.'},
    {min:100,max:100,label:'Atmosphere Critical',color:'#ff0000',
     desc:'Maximum toxicity. End of week: +5 Burnout. The damage is permanent. Consider a LinkedIn update.'},
  ],
  bo:[
    {min:0,max:49,label:'Healthy Stress Levels',color:'#80ffa8',
     desc:'No penalties. Sustainable pace. Enjoy it while it lasts.'},
    {min:50,max:79,label:'Stressed',color:'#ffdd44',
     desc:'Mult from cards reduced by 20%. You keep re-reading the same email.'},
    {min:80,max:89,label:'System Failure',color:'#ff8040',
     desc:'Max PLAYS reduced by 1. Max DISCARDS reduced by 1. Your brain has throttled itself.'},
    {min:90,max:99,label:'Nearing Collapse',color:'#ff2020',
     desc:'Wellbeing cannot be healed. Only PRODUCTION cards can be played. Pure survival mode.'},
    {min:100,max:100,label:'GAME OVER',color:'#ff0000',
     desc:'Total burnout. You are done. The laptop stays with the company.'},
  ],
};

// ═══════════════════════════════════════════════════════
//  RUN CONTRACT POOL (3 random picked per run)
// ═══════════════════════════════════════════════════════
export const CONTRACT_POOL = [
  {id:'no_fails',     icon:'🏆', pts:200, desc:'Complete all weeks without failing any KPI',
   check: G => G.failedWeeks === 0},
  {id:'wb_65',        icon:'❤',  pts:100, desc:'End the run with Wellbeing ≥ 65%',
   check: G => G.wb >= 65},
  {id:'tox_50',       icon:'☣',  pts:150, desc:'Never exceed 50% Toxicity (peak)',
   check: G => G.peakTox <= 50},
  {id:'bo_25',        icon:'🧠', pts:120, desc:'End the run with Burnout below 25%',
   check: G => G.bo < 25},
  {id:'breakthrough', icon:'💥', pts:150, desc:'Score 2× KPI or more in any single week',
   check: G => G.achievedBreakthrough === true},
  {id:'lv3_card',     icon:'★',  pts:150, desc:'Level any card up to LV3',
   check: G => G.achievedLv3 === true},
  {id:'combo_disc',   icon:'🔗', pts:120, desc:'Discover at least one passive combo',
   check: G => (G.discoveredCombos?.size || 0) > 0},
  {id:'class_t3',     icon:'🎯', pts:130, desc:'Reach Class Track Level 3',
   check: G => (G.classTrackLevel || 0) >= 3},
  {id:'three_pass',   icon:'⚡', pts:110, desc:'Collect 3 or more passive items from the shop',
   check: G => (G.passives || []).filter(p => !p.isComp).length >= 3},
  {id:'big_deck',     icon:'🃏', pts:100, desc:'Finish with 14 or more cards in your deck',
   check: G => ([...(G.deck||[]),...(G.pile||[])].length) >= 14},
  {id:'perm_mult_2',  icon:'🚀', pts:180, desc:'Accumulate 2.0+ permanent Mult bonus (permMult)',
   check: G => (G.permMult || 0) >= 2.0},
  {id:'no_crunch',    icon:'🕊', pts:160, desc:'Complete the run without playing any CRUNCH cards',
   check: G => G.crunchPlayed !== true},
];

// ═══════════════════════════════════════════════════════
//  UPGRADE TIER TABLE  (gambling roll on Performance Upgrade)
// ═══════════════════════════════════════════════════════
export const UPGRADE_TIERS = [
  { id:'standard',    chips:20,  mult:0.25, weight:50, label:'STANDARD',    color:'#888888', msg:'A solid, if unremarkable, improvement.' },
  { id:'improved',    chips:35,  mult:0.40, weight:25, label:'IMPROVED',    color:'#60c060', msg:'Better than expected. Nice.' },
  { id:'excellent',   chips:55,  mult:0.60, weight:15, label:'EXCELLENT',   color:'#6090ff', msg:'Outstanding execution.' },
  { id:'exceptional', chips:80,  mult:0.85, weight: 8, label:'EXCEPTIONAL', color:'#c060ff', msg:'Exceptional performance. Noted.' },
  { id:'legendary',   chips:120, mult:1.20, weight: 2, label:'LEGENDARY',   color:'#ffcc00', msg:'A once-in-a-career result.' },
];

export const CAREER_DB = [
  {tier:10,min:15000,title:'VP of Synergy Marketing',
   desc:"I don't work. I am the vision. The entire Q4 target is my coffee budget.",
   raiseMin:12.1,raiseMax:15.0,color:'#ffdd44'},
  {tier:9,min:11000,title:'Director of Innovation',
   desc:"My slides are pure art. They don't mean anything, but they're beautiful.",
   raiseMin:10.1,raiseMax:12.0,color:'#ffcc44'},
  {tier:8,min:9000,title:'Senior Manager',
   desc:"I manage managers who manage interns. The cycle of bureaucracy is complete.",
   raiseMin:8.1,raiseMax:10.0,color:'#ffaa44'},
  {tier:7,min:7000,title:'Team Lead',
   desc:"I get CC'd on everything. My Inbox is a cry for help.",
   raiseMin:6.1,raiseMax:8.0,color:'#88ccff'},
  {tier:6,min:5500,title:'Project Manager',
   desc:"I update the spreadsheet. The spreadsheet updates me. We are one.",
   raiseMin:5.1,raiseMax:6.0,color:'#88aaff'},
  {tier:5,min:4500,title:'Analyst',
   desc:"I found a macro that does my job. Now I play DEADLINE all day.",
   raiseMin:4.1,raiseMax:5.0,color:'#aaaaff'},
  {tier:4,min:3000,title:'Associate',
   desc:"I submitted my first HR compliant report. The photocopier knows my name.",
   raiseMin:3.1,raiseMax:4.0,color:'#b8b8d8'},
  {tier:3,min:1800,title:'Junior Associate',
   desc:"I can reply to an email in under 3 hours. Efficiency is coming.",
   raiseMin:2.1,raiseMax:3.0,color:'#909090'},
  {tier:2,min:1000,title:'The Trainee',
   desc:"I think my chair is broken. Gary helps first, Gary helps first.",
   raiseMin:1.1,raiseMax:2.0,color:'#707070'},
  {tier:1,min:-Infinity,title:'Unmotivated Intern',
   desc:"Someone took my stapler. I haven't slept in 3 days. I miss my family.",
   raiseMin:0.0,raiseMax:1.0,color:'#505050'},
];
