// ═══════════════════════════════════════════════════════
//  PASSIVE SKILL TREE — run-wide build system
//  Inspired by Path of Exile: you start at your class node
//  and expand outward. Can never unlock everything.
// ═══════════════════════════════════════════════════════

export const TREE_NODES = {
  // ── PRODUCTION cluster (top-left) ──────────────────
  p_chips:  { id:'p_chips',  x:1, y:1, cost:1, arch:'PRODUCTION', type:'stat',
    name:'Efficiency Drive',   short:'+150 Chips to every PRODUCTION card played',
    connects:['p_plays','p_chain'] },
  p_plays:  { id:'p_plays',  x:0, y:2, cost:2, arch:'PRODUCTION', type:'stat',
    name:'Overtime Approved',  short:'+1 Play available every week',
    connects:['p_chips'] },
  p_chain:  { id:'p_chain',  x:2, y:2, cost:1, arch:'PRODUCTION', type:'synergy',
    name:'Assembly Line',      short:'Pure PRODUCTION turn: Chips ×1.25',
    connects:['p_chips','p_engine','h_ps'] },
  p_engine: { id:'p_engine', x:1, y:3, cost:2, arch:'PRODUCTION', type:'synergy',
    name:'Flow State',         short:'Each PRODUCTION card in play: other PRODs +75 Chips',
    connects:['p_chain','p_cap','h_pr'] },
  p_cap:    { id:'p_cap',    x:0, y:4, cost:3, arch:'PRODUCTION', type:'capstone',
    name:'NEVER CLOCK OUT',    short:'PRODUCTION cards never exhaust — play them every turn',
    connects:['p_engine'] },

  // ── STRATEGY cluster (top-right) ───────────────────
  s_mult:   { id:'s_mult',   x:5, y:1, cost:1, arch:'STRATEGY',   type:'stat',
    name:'Strategic Vision',   short:'+0.3 permanent Mult (applied immediately)',
    connects:['s_first','s_stack'] },
  s_first:  { id:'s_first',  x:6, y:2, cost:1, arch:'STRATEGY',   type:'synergy',
    name:'First Mover',        short:'First STRATEGY each turn: its Mult contribution doubled',
    connects:['s_mult'] },
  s_stack:  { id:'s_stack',  x:4, y:2, cost:2, arch:'STRATEGY',   type:'synergy',
    name:'Momentum Build',     short:'Each STRATEGY played this week: +0.1 Mult all future turns',
    connects:['s_mult','s_flow','h_ps'] },
  s_flow:   { id:'s_flow',   x:5, y:3, cost:2, arch:'STRATEGY',   type:'synergy',
    name:'Pure Execution',     short:'STRATEGY with no PRODUCTION in play: +0.6 extra Mult',
    connects:['s_stack','s_cap','h_sc'] },
  s_cap:    { id:'s_cap',    x:6, y:4, cost:3, arch:'STRATEGY',   type:'capstone',
    name:'LEVERAGE',           short:'Permanent Mult counted TWICE in final score calculation',
    connects:['s_flow'] },

  // ── RECOVERY cluster (bottom-left) ─────────────────
  r_heal:   { id:'r_heal',   x:1, y:5, cost:1, arch:'RECOVERY',   type:'stat',
    name:'Better Benefits',    short:'RECOVERY cards heal +60% more WB',
    connects:['r_tox','r_glow'] },
  r_tox:    { id:'r_tox',    x:0, y:6, cost:1, arch:'RECOVERY',   type:'stat',
    name:'Detox Protocol',     short:'Playing RECOVERY: −6% extra TOX reduction',
    connects:['r_heal','r_shield'] },
  r_glow:   { id:'r_glow',   x:2, y:6, cost:2, arch:'RECOVERY',   type:'synergy',
    name:'Peak Performance',   short:'WB ≥ 80% at turn start: +0.2 Mult this turn',
    connects:['r_heal','r_shield','h_pr','h_rc'] },
  r_shield: { id:'r_shield', x:1, y:7, cost:2, arch:'RECOVERY',   type:'synergy',
    name:'Stress Resistance',  short:'All WB damage (TOX drain, card costs) reduced by 30%',
    connects:['r_tox','r_glow','r_cap'] },
  r_cap:    { id:'r_cap',    x:0, y:8, cost:3, arch:'RECOVERY',   type:'capstone',
    name:'BURNOUT IMMUNITY',   short:'WB cannot drop below 20% — ever',
    connects:['r_shield'] },

  // ── CRUNCH cluster (bottom-right) ──────────────────
  c_chips:  { id:'c_chips',  x:5, y:5, cost:1, arch:'CRUNCH',     type:'stat',
    name:'Crunch Bonus',       short:'CRUNCH cards generate +50% Chips',
    connects:['c_resist','c_clean'] },
  c_resist: { id:'c_resist', x:6, y:6, cost:1, arch:'CRUNCH',     type:'stat',
    name:'Thick Skin',         short:'TOX atmospheric drain to WB reduced by 40%',
    connects:['c_chips','c_rage'] },
  c_clean:  { id:'c_clean',  x:4, y:6, cost:2, arch:'CRUNCH',     type:'synergy',
    name:'Calculated Risk',    short:'CRUNCH + PRODUCTION in same play: CRUNCH gains no TOX',
    connects:['c_chips','c_rage','h_sc','h_rc'] },
  c_rage:   { id:'c_rage',   x:5, y:7, cost:2, arch:'CRUNCH',     type:'synergy',
    name:'Toxic Fuel',         short:'TOX > 50%: CRUNCH Mult contribution doubled',
    connects:['c_resist','c_clean','c_cap'] },
  c_cap:    { id:'c_cap',    x:6, y:8, cost:3, arch:'CRUNCH',     type:'capstone',
    name:'PRESSURE COOKER',    short:'Every 10% TOX above 30% adds +0.15 Mult to all plays',
    connects:['c_rage'] },

  // ── Hybrid / Center ─────────────────────────────────
  center:   { id:'center',   x:3, y:4, cost:2, arch:'HYBRID',     type:'synergy',
    name:'Cross-Functional',   short:'Play all 4 archetypes in one week: +0.3 permanent Mult',
    connects:['h_ps','h_pr','h_sc','h_rc'] },
  h_ps:     { id:'h_ps',     x:3, y:2, cost:2, arch:'HYBRID',     type:'synergy',
    name:'Synergy Sprint',     short:'Turn with PRODUCTION + STRATEGY together: +2.0 Mult',
    connects:['p_chain','s_stack','center'] },
  h_pr:     { id:'h_pr',     x:2, y:4, cost:2, arch:'HYBRID',     type:'synergy',
    name:'Work-Life Balance',  short:'RECOVERY + PRODUCTION in same play: WB heal doubled',
    connects:['p_engine','center','r_glow'] },
  h_sc:     { id:'h_sc',     x:4, y:4, cost:2, arch:'HYBRID',     type:'synergy',
    name:'Chaos Strategy',     short:'STRATEGY when TOX > 40%: +0.8 Mult per STRATEGY card',
    connects:['s_flow','center','c_clean'] },
  h_rc:     { id:'h_rc',     x:3, y:6, cost:2, arch:'HYBRID',     type:'synergy',
    name:'Desperate Sprint',   short:'WB < 50%: each CRUNCH card gets +500 Chips',
    connects:['center','r_glow','c_clean'] },
};

// Auto-generate connection pairs (deduped)
export const TREE_CONNECTIONS = (() => {
  const pairs = new Set();
  for (const node of Object.values(TREE_NODES)) {
    for (const to of (node.connects || [])) {
      const key = [node.id, to].sort().join('|');
      pairs.add(key);
    }
  }
  return [...pairs].map(k => k.split('|'));
})();

export const CLASS_START_NODES = {
  grinder:    'p_chips',
  strategist: 's_mult',
  survivor:   'r_heal',
};
