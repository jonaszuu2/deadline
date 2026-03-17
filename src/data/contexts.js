// ═══════════════════════════════════════════════════════
//  DAILY CONTEXT SYSTEM
//  22 corporate events, one per workday (Mon–Fri).
//  Each context modifies how that day's play works.
// ═══════════════════════════════════════════════════════

export const CONTEXTS_DB = {

  // ── MONDAY POOL ────────────────────────────────────────
  mon_kickoff: {
    id:'mon_kickoff', name:'Fresh Start', icon:'☀️', pool:'monday',
    desc:'+1.5 Eff. Wchodzisz zmotywowany.',
    ctxMods: { extraMult: 1.5 },
  },
  mon_blues: {
    id:'mon_blues', name:'Monday Blues', icon:'😩', pool:'monday',
    desc:'−5 WB tej tury. Każda zagrana karta: +0.2 Eff.',
    preWbDelta: -5,
    ctxMods: { perCardMult: 0.2 },
  },
  mon_standup: {
    id:'mon_standup', name:'Sprint Kickoff', icon:'📋', pool:'monday',
    desc:'≥2 różne archetypy tej tury: +1.0 Eff.',
    ctxMods: { archComboMult: { minTypes: 2, bonus: 1.0 } },
  },
  mon_inbox: {
    id:'mon_inbox', name:'Full Inbox', icon:'📥', pool:'monday',
    desc:'+2 Discard w tym tygodniu. Zaległości od weekendu.',
    weekDiscExtra: 2,
    ctxMods: {},
  },
  mon_strategy: {
    id:'mon_strategy', name:'Weekly Sync', icon:'📊', pool:'monday',
    desc:'STRATEGY cards: Eff contribution ×2 tej tury.',
    ctxMods: { stratMultMult: 2.0 },
  },

  // ── FRIDAY POOL ────────────────────────────────────────
  fri_deadline: {
    id:'fri_deadline', name:'Deploy Day', icon:'🚀', pool:'friday',
    desc:'Score tej tury ×1.5. Deadline is real.',
    ctxMods: { scoreMult: 1.5 },
  },
  fri_drinks: {
    id:'fri_drinks', name:'Friday Drinks', icon:'🍺', pool:'friday',
    isChoice: true,
    desc:'Koniec tygodnia — drinksy czy zostać w biurze?',
    choices: [
      { id:'go',   label:'Idź na drinksy',   desc:'+25 WB, bez CRUNCH tej tury',  preWbDelta: 25,  blockArch: 'CRUNCH', ctxMods: {} },
      { id:'stay', label:'Zostań i pracuj',   desc:'CRUNCH Output ×2, −15 WB',     preWbDelta: -15, ctxMods: { crunchChipsMult: 2.0 } },
    ],
  },
  fri_release: {
    id:'fri_release', name:'Emergency Release', icon:'💥', pool:'friday',
    desc:'Możesz zagrać 4 karty tej tury. +20 TOX. Nikt nie planował tej zmiany.',
    maxCardsPlay: 4, preToxDelta: 20,
    ctxMods: {},
  },
  fri_retro: {
    id:'fri_retro', name:'Retrospective', icon:'🔄', pool:'friday',
    desc:'≥3 zagrane karty tej tury: +800 Output.',
    ctxMods: { minCardsChipsBonus: { min: 3, chips: 800 } },
  },
  fri_review: {
    id:'fri_review', name:'Performance Review', icon:'📈', pool:'friday',
    desc:'STRATEGY Eff ×2 tej tury. Dzień który liczy się dla managera.',
    ctxMods: { stratMultMult: 2.0, extraMult: 0.5 },
  },

  // ── GENERAL POOL ──────────────────────────────────────
  gen_deepwork: {
    id:'gen_deepwork', name:'Deep Work Block', icon:'🧠', pool:'general',
    desc:'Zagraj dokładnie 1 kartę tej tury → Score ×3. Zero rozpraszaczy.',
    ctxMods: { singleCardScoreMult: 3.0 },
  },
  gen_brainstorm: {
    id:'gen_brainstorm', name:'Brainstorm Session', icon:'💡', pool:'general',
    desc:'STRATEGY: +2.5 Eff tej tury. PRODUCTION: Output −50%.',
    ctxMods: { stratExtraMult: 2.5, prodChipsMult: 0.5 },
  },
  gen_allhands: {
    id:'gen_allhands', name:'All-Hands Meeting', icon:'👥', pool:'general',
    desc:'Każda zagrana karta: +0.4 Eff.',
    ctxMods: { perCardMult: 0.4 },
  },
  gen_clientdemo: {
    id:'gen_clientdemo', name:'Client Demo', icon:'💼', pool:'general',
    desc:'STRATEGY Output ×2 tej tury. Brak STRATEGY: −0.5 Eff.',
    ctxMods: { stratChipsMult: 2.0, noStratMultPenalty: -0.5 },
  },
  gen_sprintreview: {
    id:'gen_sprintreview', name:'Sprint Review', icon:'⚡', pool:'general',
    desc:'≥3 zagrane karty tej tury: +600 Output.',
    ctxMods: { minCardsChipsBonus: { min: 3, chips: 600 } },
  },
  gen_freelunch: {
    id:'gen_freelunch', name:'Free Lunch', icon:'🍕', pool:'general',
    desc:'+15 WB. Ktoś przyniósł pizzę.',
    preWbDelta: 15,
    ctxMods: {},
  },
  gen_officedrama: {
    id:'gen_officedrama', name:'Office Drama', icon:'🎭', pool:'general',
    desc:'−10 WB, +0.8 Eff tej tury. Wszyscy są naelektryzowani.',
    preWbDelta: -10,
    ctxMods: { extraMult: 0.8 },
  },
  gen_strongcoffee: {
    id:'gen_strongcoffee', name:'Triple Espresso', icon:'☕', pool:'general',
    desc:'Max 4 karty tej tury. +15 TOX. Nie jest to zdrowe.',
    maxCardsPlay: 4, preToxDelta: 15,
    ctxMods: {},
  },
  gen_wellnessday: {
    id:'gen_wellnessday', name:'Mandatory Wellness', icon:'🧘', pool:'general',
    desc:'−25 TOX, −10 WB. HR wymusiło jogę.',
    preToxDelta: -25, preWbDelta: -10,
    ctxMods: {},
  },
  gen_birthday: {
    id:'gen_birthday', name:"Someone's Birthday", icon:'🎂', pool:'general',
    desc:'+20 WB. Tort w kuchni.',
    preWbDelta: 20,
    ctxMods: {},
  },
  gen_meeting: {
    id:'gen_meeting', name:'Mandatory Meeting', icon:'📞', pool:'general',
    desc:'Max 2 karty tej tury. +4 CC kompensaty.',
    maxCardsPlay: 2, postCoins: 4,
    ctxMods: {},
  },
  gen_overtime: {
    id:'gen_overtime', name:'Voluntary Overtime', icon:'⏰', pool:'general',
    desc:'Możesz zagrać 4 karty tej tury. +20 TOX. Nikt nie prosił.',
    maxCardsPlay: 4, preToxDelta: 20,
    ctxMods: {},
  },
  gen_pairing: {
    id:'gen_pairing', name:'Pair Programming', icon:'👯', pool:'general',
    desc:'≥2 karty tego samego archetypu tej tury: +1.5 Eff.',
    ctxMods: { sameArchBonus: { min: 2, bonus: 1.5 } },
  },
  cho_1on1: {
    id:'cho_1on1', name:'1:1 z Managerem', icon:'👔', pool:'general',
    isChoice: true,
    desc:'Twój manager chce porozmawiać.',
    choices: [
      { id:'truth', label:'Powiedz prawdę',       desc:'−10 WB, +1.5 Eff tej tury', preWbDelta: -10, ctxMods: { extraMult: 1.5 } },
      { id:'safe',  label:'Zagraj bezpiecznie',    desc:'+5 WB, +0.3 Eff',           preWbDelta:   5, ctxMods: { extraMult: 0.3 } },
    ],
  },
  cho_scope: {
    id:'cho_scope', name:'Scope Creep', icon:'📌', pool:'general',
    isChoice: true,
    desc:'Klient dodał wymagania w ostatniej chwili.',
    choices: [
      { id:'accept', label:'Akceptuj',  desc:'+400 Output, +20 TOX', preToxDelta: 20, ctxMods: { extraChips: 400 } },
      { id:'reject', label:'Odrzuć',    desc:'−8 WB, bez bonusów',  preWbDelta:  -8, ctxMods: {} },
    ],
  },
};

export const CONTEXTS_MONDAY  = ['mon_kickoff','mon_blues','mon_standup','mon_inbox','mon_strategy'];
export const CONTEXTS_FRIDAY  = ['fri_deadline','fri_drinks','fri_release','fri_retro','fri_review'];
export const CONTEXTS_GENERAL = [
  'gen_deepwork','gen_brainstorm','gen_allhands','gen_clientdemo','gen_sprintreview',
  'gen_freelunch','gen_officedrama','gen_strongcoffee','gen_wellnessday','gen_birthday',
  'gen_meeting','gen_overtime','gen_pairing',
  'cho_1on1','cho_scope',
];
