export const BOSS_DB = {
  midgame: {
    id: 'midgame',
    name: 'Derek',
    title: 'Senior Performance Integration Manager',
    portrait: '👔',
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
    ],
    rewardPool: [
      { id:'br_wb20',      type:'STAT_BOOST', label:'+20 Wellbeing',         icon:'💚', desc:'Immediate stat boost.',              fx:{wb:+20} },
      { id:'br_tox20',     type:'STAT_BOOST', label:'−20 Toxicity',          icon:'🧹', desc:'Immediate stat boost.',              fx:{tox:-20} },
      { id:'br_coins5',    type:'STAT_BOOST', label:'+5 Budget',             icon:'💰', desc:'Immediate Corpo Coins.',             fx:{coins:+5} },
      { id:'br_extraplay', type:'EXTRA_PLAY', label:'Free Overtime Turn',    icon:'⏱️', desc:'Gain +1 play for the next week.',    fx:{} },
      { id:'br_passive',   type:'PASSIVE',    label:'Performance Pip',       icon:'📌', desc:'+10 Chips on every Production card.',
        passiveType:'PRODUCTION_CHIPS', passiveVal:10 },
      { id:'br_addcard',   type:'ADD_CARD',   label:'Executive Memo',        icon:'📄', desc:'Add 1 Crunch card to your deck.',    cardId:'crunch_001' },
      { id:'br_multboost', type:'STAT_BOOST', label:'+0.5× Permanent Mult', icon:'📈', desc:'Boosts every play for the rest of the game.', fx:{permMult:+0.5} },
    ],
  },
};
