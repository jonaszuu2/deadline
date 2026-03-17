export const BOSS_DB = {

  // ── Week 2: Sandra — HR Early Check-In ──────────────────────────────────
  early: {
    id: 'early',
    name: 'Sandra',
    title: 'HR Coordinator',
    portrait: '👩‍💼',
    encounter: 'EARLY CHECK-IN',
    color: '#005080',
    colorEnd: '#1084d0',
    intro: '"Just a quick check-in. HR likes to touch base in the first weeks. How are you finding things so far?"',
    questions: [
      {
        id: 'q1',
        text: 'How are you settling in? What\'s your preferred work style?',
        options: [
          { id:'a', label:'I work best autonomously',    flavor:'"Self-sufficient. Good."',                     fx:{tox:-5} },
          { id:'b', label:'I thrive on collaboration',   flavor:'She smiles. "We love that here."',             fx:{wb:+5, coins:+2} },
          { id:'c', label:'Still figuring it out',       flavor:'She makes a note. "We\'ll monitor closely."',  fx:{tox:+8} },
        ],
      },
      {
        id: 'q2',
        text: 'A teammate keeps scheduling meetings during your focus hours. You:',
        options: [
          { id:'a', label:'Block my calendar aggressively', flavor:'"Boundary setting. Noted."',                 fx:{tox:-8} },
          { id:'b', label:'Attend to stay visible',         flavor:'She nods approvingly. "Smart optics."',      fx:{tox:+15, coins:+3} },
          { id:'c', label:'Push back politely once',        flavor:'"Very reasonable. We appreciate that."',     fx:{tox:-5, wb:+5} },
        ],
      },
      {
        id: 'q3',
        text: 'What\'s your approach to the weekly KPI targets?',
        options: [
          { id:'a', label:'Hit them at any cost',         flavor:'She pauses. "...Ambitious."',                       fx:{tox:+10} },
          { id:'b', label:'Sustainable pace is key',      flavor:'"Wellness-forward. HR approves."',                  fx:{wb:+10} },
          { id:'c', label:'What\'s the real goal behind them?', flavor:'She raises an eyebrow. "Strategic thinker."', fx:{coins:+3, wb:+5} },
        ],
      },
    ],
    rewardPool: [
      { id:'br_s_wb25',     type:'STAT_BOOST', label:'+25 Wellbeing',          icon:'💚', desc:'HR wellness program kicks in.',          fx:{wb:+25} },
      { id:'br_s_tox20',    type:'STAT_BOOST', label:'−20 Toxicity',           icon:'🧹', desc:'Sandra schedules a team debrief.',        fx:{tox:-20} },
      { id:'br_s_mult02',   type:'STAT_BOOST', label:'+0.2× Permanent Eff',  icon:'📈', desc:'Early recognition pays off.',             fx:{permMult:+0.2} },
      { id:'br_s_remove',   type:'REMOVE',     label:'Free Card Removal',      icon:'🗑️', desc:'HR helps you offload a responsibility.',  fx:{} },
      { id:'br_s_coins3',   type:'STAT_BOOST', label:'+3 Budget',              icon:'💰', desc:'Onboarding bonus approved.',              fx:{coins:+3} },
      { id:'br_s_recovery', type:'ADD_CARD',   label:'Wellness Initiative',    icon:'🌿', desc:'Add 1 Recovery card to your deck.',       cardId:'recovery_001' },
      { id:'br_s_bo10',     type:'STAT_BOOST', label:'−10 Burnout',            icon:'🔋', desc:'Sandra books you a recovery day.',        fx:{bo:-10} },
    ],
  },

  // ── Week 5: Derek — Q2 Performance Review ───────────────────────────────
  midgame: {
    id: 'midgame',
    name: 'Derek',
    title: 'Senior Performance Integration Manager',
    portrait: '👔',
    encounter: 'Q2 REVIEW',
    color: '#800000',
    colorEnd: '#c01020',
    intro: '"Let\'s do a quick alignment check. I just need a few minutes of your time."',
    questions: [
      {
        id: 'q1',
        text: 'The Q2 roadmap deadline is tomorrow. How do you handle the crunch?',
        options: [
          { id:'a', label:'Pull an all-nighter',    flavor:'Classic dedication.',        fx:{tox:+15, wb:-10} },
          { id:'b', label:'Cut scope ruthlessly',    flavor:'Strategic. Derek nods.',    fx:{tox:-5, kpiMult:0.9} },
          { id:'c', label:'Delegate and document',   flavor:'He writes something down.', fx:{wb:+8, coins:+2} },
        ],
      },
      {
        id: 'q2',
        text: 'A colleague takes credit for your work in the all-hands. You:',
        options: [
          { id:'a', label:'Correct the record publicly', flavor:'Derek raises an eyebrow.', fx:{bo:+10, wb:-5} },
          { id:'b', label:'Bring it up 1:1 later',       flavor:'"Very professional."',     fx:{wb:+5, tox:-8} },
          { id:'c', label:'Let it go this time',         flavor:'He seems pleased.',         fx:{coins:+3, bo:-5} },
        ],
      },
      {
        id: 'q3',
        text: 'You\'re ahead on a deliverable. Derek eyes your bandwidth. "Can you take on the Martinez account too?"',
        options: [
          { id:'a', label:'Sure, I can make it work',    flavor:'"That\'s what we like to hear."',    fx:{tox:+15, coins:+5} },
          { id:'b', label:'I\'d need to drop something', flavor:'He taps his pen. "Fair enough."',    fx:{tox:-5, wb:-5} },
          { id:'c', label:'Let me check my capacity',    flavor:'"Responsible answer."',              fx:{wb:+3} },
        ],
      },
    ],
    rewardPool: [
      { id:'br_wb20',      type:'STAT_BOOST', label:'+20 Wellbeing',         icon:'💚', desc:'Immediate stat boost.',              fx:{wb:+20} },
      { id:'br_tox20',     type:'STAT_BOOST', label:'−20 Toxicity',          icon:'🧹', desc:'Immediate stat boost.',              fx:{tox:-20} },
      { id:'br_coins5',    type:'STAT_BOOST', label:'+5 Budget',             icon:'💰', desc:'Immediate Corpo Coins.',             fx:{coins:+5} },
      { id:'br_extraplay', type:'EXTRA_PLAY', label:'Free Overtime Turn',    icon:'⏱️', desc:'Gain +1 play for the next week.',    fx:{} },
      { id:'br_passive',   type:'PASSIVE',    label:'Performance Pip',       icon:'📌', desc:'+10 Output on every Production card.',
        passiveType:'PRODUCTION_CHIPS', passiveVal:10 },
      { id:'br_addcard',   type:'ADD_CARD',   label:'Executive Memo',        icon:'📄', desc:'Add 1 Crunch card to your deck.',    cardId:'crunch_001' },
      { id:'br_multboost', type:'STAT_BOOST', label:'+0.5× Permanent Eff', icon:'📈', desc:'Boosts every play for the rest of the game.', fx:{permMult:+0.5} },
    ],
  },

  // ── Week 8: Richard — Strategic Alignment Review ────────────────────────
  late: {
    id: 'late',
    name: 'Richard',
    title: 'VP of Organizational Excellence',
    portrait: '🧑‍💼',
    encounter: 'STRATEGIC ALIGNMENT',
    color: '#3a2a00',
    colorEnd: '#806010',
    intro: '"Close the door. I\'ll be direct. We need to talk about sustainability — yours and the team\'s."',
    questions: [
      {
        id: 'q1',
        text: 'Our competitors are shipping three times faster. What\'s blocking us?',
        options: [
          { id:'a', label:'Legacy process constraints',    flavor:'He writes: "blame-shifting." You earn points anyway.', fx:{tox:+10, coins:+3} },
          { id:'b', label:'We need to cut technical debt', flavor:'"Finally someone who gets it."',                        fx:{bo:-10} },
          { id:'c', label:'I have a proposal ready',       flavor:'"Let\'s hear it after this." He looks impressed.',     fx:{coins:+5, wb:+10} },
        ],
      },
      {
        id: 'q2',
        text: 'Someone on your team is underperforming. I want them managed out. What do you do?',
        options: [
          { id:'a', label:'Done. I\'ll handle it today',  flavor:'Richard nods. The guilt stays with you.',         fx:{tox:+15, wb:-10} },
          { id:'b', label:'I\'ll put them on a PIP first',flavor:'"By the book. Fine."',                            fx:{tox:+5} },
          { id:'c', label:'Give them one more shot',       flavor:'"Soft. But it\'s your call." He marks something.', fx:{tox:-5, bo:-5} },
        ],
      },
      {
        id: 'q3',
        text: 'If you had to sacrifice your work-life balance to hit Q4 targets, would you?',
        options: [
          { id:'a', label:'Without hesitation',           flavor:'"Noted. And noted."',                       fx:{tox:+20, coins:+5} },
          { id:'b', label:'For a critical sprint, yes',   flavor:'He leans back. "Pragmatic."',               fx:{tox:+8} },
          { id:'c', label:'I\'d find a smarter solution', flavor:'"Ambitious. Let\'s see if you can."',        fx:{wb:+5, tox:-5} },
        ],
      },
    ],
    rewardPool: [
      { id:'br_r_permMult',   type:'STAT_BOOST', label:'+1.0× Permanent Eff',  icon:'📈', desc:'Executive endorsement. Permanent boost.',              fx:{permMult:+1.0} },
      { id:'br_r_tox30',      type:'STAT_BOOST', label:'−30 Toxicity',          icon:'🧹', desc:'Richard reassigns your most toxic responsibility.',     fx:{tox:-30} },
      { id:'br_r_coins8',     type:'STAT_BOOST', label:'+8 Budget',             icon:'💰', desc:'Q4 discretionary spend approved.',                      fx:{coins:+8} },
      { id:'br_r_plays2',     type:'EXTRA_PLAY', label:'Two Overtime Turns',    icon:'⏱️', desc:'Gain +2 plays for the next week.',                      fx:{extraPlays:2} },
      { id:'br_r_upgrade',    type:'UPGRADE',    label:'Executive Upgrade',     icon:'⚡', desc:'Upgrade one card of your choice.',                      fx:{} },
      { id:'br_r_wb20bo10',   type:'STAT_BOOST', label:'+20 WB / −10 Burnout', icon:'💊', desc:'Corporate wellness package. Immediate effect.',         fx:{wb:+20, bo:-10} },
      { id:'br_r_removeadd',  type:'REMOVE_ADD', label:'Portfolio Restructure', icon:'🔄', desc:'Remove a card and add a powerful replacement.',         fx:{} },
    ],
  },
};
