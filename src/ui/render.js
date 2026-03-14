import { clamp, KPI, TOTAL_WEEKS, PLAYS, MAX_SEL, CAREER_DB } from '../data/constants.js';
import { SHOP_DB } from '../data/shop.js';
import { COMP_DB, TEAMMATES_DB, CLASS_DB } from '../data/content.js';
import { BOSS_DB } from '../data/boss.js';
import { DB } from '../data/cards.js';
import { getEffectiveFx, simulateTurn } from '../engine/calcTurn.js';
import { calculateFinalScore, predictCareerTier } from '../engine/scoring.js';
import { esc, fmt1 } from '../engine/utils.js';
import { initFinalReviewAnim, updateKpiBar } from './animations.js';
import { _currentHandH, HAND_H_DEF, applyHandHeight } from './resize.js';
import { ovGameOver, ovWin, ovFinalReview } from './overlays.js';

export const ARCH_COLORS = {PRODUCTION:'#6ab4ff', STRATEGY:'#ff9090', CRUNCH:'#ff6030', RECOVERY:'#60ff80', SHOP:'#c8b8ff'};

// ═══════════════════════════════════════════════════════
//  STATUS BAR
// ═══════════════════════════════════════════════════════
export function renderStatusBar(G) {
  const phaseLbl = {play:'PLAY', result:'RESULT', shop:'SHOP', boss:'BOSS REVIEW', gameover:'GAME OVER', win:'WIN', review:'REVIEW', draft:'CARD DRAFT', teammate_choice:'STAFFING', targeted_draw:'TARGETED DRAW', power_event:'POWER EVENT'};
  const boColor = G.bo >= 90 ? '#ff2020' : G.bo >= 70 ? '#ff8040' : G.bo >= 50 ? '#ffdd44' : '#808080';
  const boIcon  = G.bo >= 90 ? '🔥' : '🔥';
  const cells = [
    `Week ${G.week}/${TOTAL_WEEKS}`,
    `Score: ${G.wscore} / ${G.kpi()}`,
    `WB: ${G.wb}%`,
    `TOX: ${G.tox}%`,
    `<span style="color:${boColor}">${boIcon} ${G.bo}%</span>`,
    phaseLbl[G.phase] || G.phase.toUpperCase(),
    `<span class="sb-zoom" onclick="zoomOut()">A-</span>`,
    `<span class="sb-zoom" onclick="zoomIn()">A+</span>`,
  ];
  return cells.map(c => `<div class="sb-cell">${c}</div>`).join('<div class="sb-sep"></div>');
}

export function zoomIn() {
  const root = document.documentElement;
  let scale = parseFloat(getComputedStyle(root).getPropertyValue('--scale')) || 1;
  scale = Math.min(1.5, scale + 0.1);
  root.style.setProperty('--scale', scale);
  localStorage.setItem('scale', scale);
}
export function zoomOut() {
  const root = document.documentElement;
  let scale = parseFloat(getComputedStyle(root).getPropertyValue('--scale')) || 1;
  scale = Math.max(0.8, scale - 0.1);
  root.style.setProperty('--scale', scale);
  localStorage.setItem('scale', scale);
}

// ═══════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════
export function render(G) {
  const sb = document.getElementById('statusbar');
  if (sb) sb.innerHTML = renderStatusBar(G);
  updateKpiBar(G);
  const win = document.getElementById('win');
  if (win) win.classList.toggle('tox-atmos', G.tox >= 70);

  if (G.phase === 'teammate_choice') {
    document.getElementById('win-body').innerHTML = renderTeammateChoice(G);
    return;
  }
  if (G.phase === 'boss') {
    document.getElementById('win-body').innerHTML = renderBossEncounter(G);
    return;
  }
  if (G.phase === 'draft') {
    document.getElementById('win-body').innerHTML = renderDraft(G);
    return;
  }
  if (G.phase === 'targeted_draw') {
    document.getElementById('win-body').innerHTML = renderTargetedDraw(G);
    return;
  }
  if (G.phase === 'power_event') {
    document.getElementById('win-body').innerHTML = renderPowerEvent(G);
    return;
  }
  if (G.phase === 'upgrade_result') {
    document.getElementById('win-body').innerHTML = renderUpgradeResult(G);
    return;
  }
  if (G.phase === 'shop') {
    document.getElementById('win-body').innerHTML = renderShop(G);
    return;
  }
  const {week, wb, tox, bo, wscore, plays, discs, phase, hand, sel, log, lastScore, playsMax} = G;
  const target   = G.kpi();
  const selCards = sel.map(uid => hand.find(c => c.uid === uid)).filter(Boolean);
  const preview  = selCards.length ? simulateTurn(selCards, G) : null;

  document.getElementById('win-body').innerHTML = `
    ${renderHeader(G)}
    <div id="main-layout">
      <div id="main-col">
        <div id="top-row">
          ${renderEmployeeDashboard(wb, tox, bo, preview)}
          ${renderScoreMachine(preview, wscore, target, G)}
          ${renderActions(G, preview)}
        </div>
        ${renderHand(hand, sel, preview, G.exhausted, G.passives, G)}
        <div id="hand-resize-handle" onmousedown="startHandResize(event)"></div>
        <div id="bottom-row">
          ${renderDeckPanel(G)}
          ${renderLog(log, preview)}
        </div>
      </div>
      ${renderRightPanel(G)}
    </div>
    ${phase === 'gameover' ? ovGameOver(G) : ''}
    ${phase === 'win'      ? ovWin(G)      : ''}
    ${phase === 'review'   ? ovFinalReview(G) : ''}
  `;
  if (_currentHandH !== HAND_H_DEF) applyHandHeight(_currentHandH);
  if (G.phase === 'review') {
    const s = calculateFinalScore(G);
    requestAnimationFrame(() => initFinalReviewAnim(s.total));
  }
}

export function getPowerRating(G) {
  const allCards = [...(G.deck||[]), ...(G.hand||[]), ...(G.pile||[])];
  if (!allCards.length) return 0;
  const avgChips = allCards.reduce((s,c) => s+(c.fx.chips||0), 0) / allCards.length;
  const avgMult  = allCards.reduce((s,c) => s+(c.fx.mult||0),  0) / allCards.length + 1.0;
  const estWeek = avgChips * 2 * avgMult * (G.playsMax || 3);
  return Math.round(Math.min(250, estWeek / Math.max(1, G.kpi()) * 100));
}

export function getBuildName(G) {
  const allCards = [...(G.deck||[]), ...(G.hand||[]), ...(G.pile||[])];
  const counts = {PRODUCTION:0, STRATEGY:0, CRUNCH:0, RECOVERY:0};
  for (const c of allCards) if (counts[c.archetype] !== undefined) counts[c.archetype]++;
  const total = allCards.length || 1;
  const dom = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  const domPct = counts[dom] / total;
  const passiveIds = (G.passives||[]).map(p => p.itemId);
  const hasPerm = (G.permMult||0) >= 1.5;
  const cs = (G.classTrackLevel||0);
  if (G.playerClass === 'grinder' && cs >= 3) return '⚙ PRODUCTION MASTER';
  if (G.playerClass === 'strategist' && cs >= 3) return '🎯 CRUNCH TACTICIAN';
  if (G.playerClass === 'survivor' && cs >= 3) return '☣ UNKILLABLE';
  if (G.discoveredCombos?.has('combo_ergo') && counts.PRODUCTION >= 4) return '💻 THROUGHPUT ENGINE';
  if (G.discoveredCombos?.has('combo_zen')) return '🌿 ZEN OPERATOR';
  if (G.discoveredCombos?.has('combo_techLead')) return '📊 TECH LEAD';
  if (hasPerm) return '🚀 MULT MACHINE';
  if (counts.CRUNCH >= 3 && G.tox >= 60) return '🔥 BURNOUT GAMBLER';
  if (counts.STRATEGY >= 4 && passiveIds.includes('sh_coach')) return '🧠 SYNERGY BROKER';
  if (counts.PRODUCTION >= 4 && passiveIds.includes('sh_keyboard')) return '💻 CHIP FARMER';
  if (counts.RECOVERY >= 4 && G.wb >= 70) return '❤ WELLNESS WARRIOR';
  if (domPct >= 0.55) {
    const n = {PRODUCTION:'🏭 GRINDER', STRATEGY:'🎯 STRATEGIST', CRUNCH:'💥 SPEED RUNNER', RECOVERY:'🌿 SURVIVOR'};
    return n[dom] || '📋 BALANCED';
  }
  return '📋 BALANCED EMPLOYEE';
}

export function renderHeader(G) {
  const {week, plays, discs, coins, wscore, playsMax} = G;
  const target  = G.kpi();
  const pct     = Math.min(100, target > 0 ? wscore / target * 100 : 0).toFixed(1);
  const willPass = wscore >= target;
  const weekDots = Array.from({length: TOTAL_WEEKS}, (_, i) => {
    const wk = i + 1;
    const hist = (G.weekHistory || []).find(h => h.week === wk);
    if (hist) return `<div class="wk-dot ${hist.passed ? 'ok' : 'ng'}" title="Week ${wk}: ${hist.passed ? 'PASS' : 'FAIL'}"></div>`;
    if (wk === week) return `<div class="wk-dot cur" title="Week ${wk}: IN PROGRESS"></div>`;
    return `<div class="wk-dot" title="Week ${wk}"></div>`;
  }).join('');
  return `<div id="hdr">
    <div class="title">DEADLINE</div>
    <div class="hc">
      <div class="hc-top">
        <div class="wk-l">WEEK</div>
        <div class="wk-v">${week} / ${TOTAL_WEEKS}</div>
        <div class="wk-dots">${weekDots}</div>
      </div>
      <div class="hc-kpi">
        <div class="hc-kpi-row">
          <span class="hc-kpi-lbl">WEEKLY KPI TARGET</span>
          <span class="hc-kpi-nums${willPass ? ' pass' : ''}">${wscore} / ${target}${willPass ? ' ✓ PASS' : ''}</span>
        </div>
        <div class="hc-kpi-bar">
          <div class="hc-kpi-fill ${willPass ? 'pass' : pct >= 80 ? 'near' : pct >= 50 ? 'mid' : 'low'}" style="width:${pct}%"></div>
        </div>
      </div>
      ${(() => {
        const aC = {PRODUCTION:'#6ab4ff',STRATEGY:'#ff9090',CRUNCH:'#ff6030',RECOVERY:'#60ff80'};
        const wa = G.weekArchetypes || {};
        const mh = G.archetypeMilestonesHit || new Set();
        return `<div class="arch-track-row">${['PRODUCTION','STRATEGY','CRUNCH','RECOVERY'].map(a => {
          const cnt = wa[a] || 0; const hit = mh.has(a); const pct = Math.min(100, cnt / 4 * 100);
          return `<div class="at-item" title="${a}: ${cnt}/4${hit?' ★ MILESTONE':''}" >
            <span class="at-lbl" style="color:${aC[a]}">${a.slice(0,4)}</span>
            <div class="at-track"><div class="at-fill" style="width:${pct}%;background:${aC[a]}${hit?';box-shadow:0 0 6px '+aC[a]:''}"></div></div>
            <span class="at-cnt" style="color:${hit?'#ffdd44':'var(--dim)'}">${hit?'★':cnt+'/4'}</span>
          </div>`;
        }).join('')}</div>`;
      })()}
    </div>
    <div class="hr">
      <div class="coins-row">💰 ${coins} CC</div>
      <div class="plbl">PLAYS</div>
      <div class="pips">${Array.from({length:(G.playsMax||PLAYS)}, (_, i) => `<div class="pip${i >= plays ? ' used' : ''}"></div>`).join('')}</div>
      <div class="disc-lbl">DISCARDS: ${discs}</div>
      ${G.playerClass ? `<div class="build-name" title="Your build identity">${getBuildName(G)}</div>` : ''}
      ${(() => {
        const pwr = getPowerRating(G);
        const cls = pwr >= 120 ? 'pwr-high' : pwr >= 80 ? 'pwr-ok' : pwr >= 50 ? 'pwr-mid' : 'pwr-low';
        return `<div class="power-rating ${cls}" title="Deck power vs KPI: estimated ${pwr}% of weekly target achievable">PWR ${pwr}%</div>`;
      })()}
      ${(() => {
        const liveSc = calculateFinalScore(G).total;
        const t = predictCareerTier(liveSc);
        const next = CAREER_DB[CAREER_DB.indexOf(t) - 1];
        const tip = next ? `${liveSc} pts — need ${next.min} for T${next.tier}` : `${liveSc} pts — MAX TIER`;
        return `<div class="career-meter" style="color:${t.color}" title="${tip}">T${t.tier} ${esc(t.title)}</div>`;
      })()}
    </div>
  </div>`;
}

export function renderEmployeeDashboard(wb, tox, bo, preview) {
  const p   = preview;
  const wbD = p ? p.wbDelta  : 0;
  const toxD = p ? p.toxDelta : 0;
  const boD  = p ? p.boDelta  : 0;
  const toxRisk = p ? Math.min(p.expectedToxDmg, wb + wbD) : 0;

  function edStat(icon, label, val, fillCls, delta, color, extraCls = '', fcExtra = '') {
    const dSign  = delta > 0 ? '+' : '';
    const isGood = (fillCls === 'wb' && delta > 0) || (fillCls === 'tox' && delta < 0);
    const isBad  = (fillCls === 'wb' && delta < 0) || (fillCls === 'tox' && delta > 0) || (fillCls === 'bo' && delta > 0);
    const dColor = isGood ? '#80ffa8' : isBad ? '#ff8080' : '';
    const dHtml  = delta !== 0 && dColor ? `<span class="ed-delta" style="color:${dColor}">${dSign}${delta}%</span>` : '';
    let fc = '';
    if (delta < 0) { const s = clamp(val + delta, 0, 100); const w = Math.min(Math.abs(delta), 100 - s); if (w > 0) fc += `<div class="ed-fc loss" style="left:${s}%;width:${w}%"></div>`; }
    if (delta > 0 && (fillCls === 'tox' || fillCls === 'bo')) { const w = Math.min(delta, 100 - val); if (w > 0) fc += `<div class="ed-fc tox-g" style="left:${val}%;width:${w}%"></div>`; }
    if (delta > 0 && fillCls === 'wb') { const w = Math.min(delta, 100 - val); if (w > 0) fc += `<div class="ed-fc heal" style="left:${val}%;width:${w}%"></div>`; }
    fc += fcExtra;
    return `<div class="ed-stat${extraCls ? ` ${extraCls}` : ''}">
      <div class="ed-icon">${icon}</div>
      <div class="ed-info">
        <div class="ed-row">
          <span class="ed-label">${label}</span>
          <span class="ed-value" style="color:${color}">${val}%${dHtml}</span>
        </div>
        <div class="ed-track" data-stat="${fillCls}" data-val="${val}"><div class="ed-fill ${fillCls}" style="width:${val}%"></div>${fc}</div>
      </div>
    </div>`;
  }

  const wbRiskFc = toxRisk > 0 ? (() => {
    const base = clamp(wb + wbD, 0, 100);
    const rW = Math.min(toxRisk, base);
    return `<div class="ed-fc risk" style="left:${clamp(base - rW, 0, 100)}%;width:${rW}%"></div>`;
  })() : '';

  const tierInfo = tox >= 91 ? {cls:'tier-meltdown', lbl:'☣ MELTDOWN ZONE', tip:'Mult ×2 | 20% auto-exhaust'}
                 : tox >= 61 ? {cls:'tier-toxic',    lbl:'⚡ TOXIC CULTURE', tip:'+1 karta/play | -1 Discard/tydzień'}
                 : tox >= 31 ? {cls:'tier-passive',  lbl:'😶 PASSIVE-AGGRESSIVE', tip:'STRATEGY +0.2 Mult | -1 WB/karta'}
                 :              {cls:'tier-pro',      lbl:'✅ PROFESSIONAL', tip:'+4 WB na końcu tygodnia (jeśli Tox ≤30%)'};
  return `<div id="employee-dashboard">
    <div class="ed-title">EMPLOYEE DASHBOARD</div>
    ${edStat('❤️', 'Wellbeing', wb,  'wb',  wbD,  '#ff80c8', wb  < 25 ? 'danger' : '', wbRiskFc)}
    ${edStat('☣️', 'Toxicity',  tox, 'tox', toxD, '#50ffaa', tox > 50 ? 'danger' : '')}
    ${edStat('🔥', 'Burnout',   bo,  'bo',  boD,  '#ff6030', bo  > 75 ? 'danger' : '')}
    <div class="tox-tier-badge ${tierInfo.cls}" title="${tierInfo.tip}">${tierInfo.lbl}</div>
  </div>`;
}

export function renderScoreMachine(p, wscore, target, G) {
  const hasP      = !!p;
  const projTotal = wscore + (p ? p.score : 0);
  const willPass  = projTotal >= target;
  const chipsVal  = hasP ? p.chips : '—';
  const multVal   = hasP ? p.mult + '×' : '—';
  const scoreVal  = hasP ? (p.score > 0 ? '+' + p.score : p.score) : (wscore > 0 ? wscore : '—');
  const chipsCls  = hasP ? 'chips' : 'idle';
  const multCls   = hasP ? 'mult'  : 'idle';
  const scoreCls  = hasP ? (willPass ? 'score win' : 'score') : (wscore > 0 ? 'score' : 'idle');
  const leds = ['#6ab4ff','#ff7070','#50ffaa','#ff80c8','#ffdd44','#ff8800','#7070ff','#80ffcc'];
  const ledHtml = leds.map(c => `<div class="sm-led" style="background:${c};color:${c}"></div>`).join('');
  let weekHtml = '';
  if (hasP) {
    weekHtml = `<span class="sm-week${willPass ? ' pass' : ''}">
      <b>${wscore}</b> <span style="color:var(--dim);font-size:9px">+${p.score} →</span>
      <b>${projTotal}</b> / ${target} ${willPass ? '✓ PASS' : '✗'}
    </span>`;
  } else {
    const need = Math.max(0, target - wscore);
    weekHtml = `<span class="sm-week"><b>${wscore}</b> / ${target}${need > 0 ? ` · need <b>${need}</b> more` : ' ✓'}</span>`;
  }
  const toxWarn = hasP && p.toxChecks > 0
    ? `<span class="sm-tox-warn">☣ ${p.toxChecks} tox check${p.toxChecks > 1 ? 's' : ''} · est. −${p.expectedToxDmg} / worst −${p.maxToxDmg} HP</span>`
    : '';
  const wbWarn = hasP && p.effLabel
    ? `<span class="sm-wb-warn">${p.effLabel}</span>`
    : '';
  const formulaHtml = hasP
    ? `<div class="sm-formula">${p.chips} chips × ${p.mult}× = <b>+${p.score} pts</b> this play</div>`
    : '';
  return `<div id="score-machine">
    <div class="sm-led-strip">${ledHtml}</div>
    <div class="sm-displays">
      <div class="sm-panel"><div class="sm-lbl">CHIPS</div><div class="sm-display ${chipsCls}">${chipsVal}</div></div>
      <div class="sm-op">×</div>
      <div class="sm-panel"><div class="sm-lbl">MULT</div><div class="sm-display ${multCls}">${multVal}</div></div>
      <div class="sm-op">=</div>
      <div class="sm-panel"><div class="sm-lbl">KPI SCORE</div><div class="sm-display ${scoreCls}">${scoreVal}</div></div>
    </div>
    ${formulaHtml}
    <div class="sm-bottom">${weekHtml}${toxWarn}${wbWarn}</div>
  </div>`;
}

export function renderForecastPanel(G) {
  const s = calculateFinalScore(G);
  const tier = predictCareerTier(s.total);
  const tierIdx = CAREER_DB.indexOf(tier);
  const nextTier = tierIdx > 0 ? CAREER_DB[tierIdx - 1] : null;
  const sign = n => n >= 0 ? `+${n}` : String(n);
  const col = n => n >= 0 ? 'color:var(--chip)' : 'color:#ff7070';

  let progressHtml = '';
  if (nextTier) {
    const pct = Math.min(100, Math.max(0,
      ((s.total - tier.min) / (nextTier.min - tier.min)) * 100
    )).toFixed(0);
    const needed = nextTier.min - s.total;
    progressHtml = `
      <div class="rp-proj-bar"><div class="rp-proj-bar-fill" style="width:${pct}%"></div></div>
      <div class="rp-proj-next">+${needed.toLocaleString()} pts → ${esc(nextTier.title)}</div>`;
  } else {
    progressHtml = `<div class="rp-proj-next" style="color:var(--chip)">★ MAX TIER</div>`;
  }

  const achRows = [
    {icon:'🔥', label:'Burnout Survivor', done: G.endCondition !== 'burnout' && G.endCondition !== 'terminated', pts:100, hint:'survive 10 wks'},
    {icon:'🎯', label:'Perfect Attendance', done: G.failedWeeks === 0, pts:200, hint:`${G.failedWeeks}/3 fails`},
    {icon:'🧘', label:'Zen Master', done: G.wb >= 80, pts:150, hint:`WB ${G.wb}% / 80%`},
    {icon:'🤝', label:'Team Player', done: G.totalTeammateWeeks >= 5, pts:100, hint:`${G.totalTeammateWeeks}/5 wks`},
    {icon:'🔄', label:'Efficiency Expert', done: parseFloat(s.avgMult) >= 3.0, pts:150, hint:`${s.avgMult}× / 3.0×`},
    {icon:'💥', label:'Chip Monster', done: s.chips >= 3000, pts:150, hint:`${s.chips}/${3000}`},
  ].map(a => {
    const cls = a.done ? 'ach-done' : 'ach-pending';
    const check = a.done ? '✓' : '○';
    return `<div class="rp-ach-row ${cls}"><span>${check} ${a.icon} ${a.label}</span><span>${a.done ? '+'+a.pts : a.hint}</span></div>`;
  }).join('');

  return `
    <div class="rp-section-hdr">CAREER FORECAST</div>
    <div style="padding:4px 2px">
      <div class="rp-proj-stat"><span>Chips</span><span>${s.chips.toLocaleString()}</span></div>
      <div class="rp-proj-stat"><span>Avg ×</span><span>${s.avgMult}×</span></div>
      <div class="rp-proj-stat"><span>WB</span><span style="${col(s.wbPts)}">${sign(s.wbPts)}</span></div>
      <div class="rp-proj-stat"><span>BO</span><span style="${col(s.boPts)}">${sign(s.boPts)}</span></div>
      <div class="rp-proj-divider"></div>
      <div class="rp-proj-score">${s.total.toLocaleString()} pts</div>
      <div class="rp-proj-tier" style="color:${tier.color}">→ ${esc(tier.title)}</div>
      ${progressHtml}
      <div class="rp-proj-divider" style="margin-top:6px"></div>
      <div class="rp-section-hdr" style="margin-top:4px">ACHIEVEMENTS</div>
      ${achRows}
    </div>`;
}

export function checkContractLive(c, G) {
  switch(c.id) {
    case 'no_fails':    return G.failedWeeks > 0 ? 'failed' : 'pending';
    case 'wb_65':       return G.wb >= 65 ? 'done' : 'pending';
    case 'tox_50':      return G.peakTox > 50 ? 'failed' : 'pending';
    case 'bo_25':       return G.bo >= 25 ? 'failed' : 'pending';
    case 'breakthrough':return G.achievedBreakthrough ? 'done' : 'pending';
    case 'lv3_card':    return G.achievedLv3 ? 'done' : 'pending';
    case 'combo_disc':  return (G.discoveredCombos?.size||0) > 0 ? 'done' : 'pending';
    case 'class_t3':    return (G.classTrackLevel||0) >= 3 ? 'done' : 'pending';
    case 'three_pass':  return (G.passives||[]).filter(p=>!p.isComp).length >= 3 ? 'done' : 'pending';
    case 'big_deck':    return ([...(G.deck||[]),...(G.pile||[]),...(G.hand||[])].length) >= 14 ? 'done' : 'pending';
    case 'perm_mult_2': return (G.permMult||0) >= 2.0 ? 'done' : 'pending';
    case 'no_crunch':   return G.crunchPlayed ? 'failed' : 'pending';
    default:            return 'pending';
  }
}

export function renderRightPanel(G) {
  const allPerks = [
    ...(G.passives || []).filter(p => !p.isComp).map(p => ({icon: SHOP_DB[p.itemId]?.icon || '⚡', name: p.name, desc: p.passiveType + ' ×' + p.passiveVal})),
    ...(G.competencies || []).map(id => { const c = COMP_DB[id]; return c ? {icon:c.icon, name:c.name, desc:c.effect} : null; }).filter(Boolean),
  ];
  const perksHtml = allPerks.length
    ? allPerks.map(pk => `<div class="rp-perk">
        <div class="rp-perk-icon">${pk.icon}</div>
        <div><div class="rp-perk-name">${esc(pk.name)}</div><div class="rp-perk-desc">${esc(pk.desc)}</div></div>
      </div>`).join('')
    : `<div class="rp-empty">No perks installed.</div>`;
  let tmHtml = '<div class="rp-empty">No teammate assigned.</div>';
  if (G.teammate && TEAMMATES_DB[G.teammate]) {
    const tm = TEAMMATES_DB[G.teammate];
    const curTier = G.getTeammateTier ? G.getTeammateTier() : 1;
    const tierData = tm.tiers ? tm.tiers[curTier - 1] : null;
    const buffText = tierData ? tierData.buffText : tm.buffText;
    const penaltyText = tierData ? tierData.penaltyText : tm.penaltyText;
    const tierLabel = tierData
      ? `<div class="rp-tm-tier">T${curTier}: ${esc(tierData.name)}</div>`
      : '';
    const snitch = G.pendingSnitch ? `<div class="rp-snitch">⚠ HR SNITCH ACTIVE</div>` : '';
    const loyalty = G.consecutiveSameTeammate || 0;
    const loyaltyHtml = loyalty >= 7
      ? `<div class="rp-tm-loyalty bond">🤝 Unbreakable Bond (${loyalty} wks) +0.6 Mult/play</div>`
      : loyalty >= 5
      ? `<div class="rp-tm-loyalty deep">🤝 Deep Partnership (${loyalty} wks) +0.4 Mult/play</div>`
      : loyalty >= 3
      ? `<div class="rp-tm-loyalty">🤝 Trusted Ally (${loyalty} wks) +0.2 Mult/play</div>`
      : loyalty >= 2
      ? `<div class="rp-tm-loyalty dim">⏳ ${loyalty} wks together</div>`
      : '';
    tmHtml = `<div class="rp-teammate">
      <span class="rp-tm-portrait" style="color:${tm.color}">${tm.portrait}</span>
      <div class="rp-tm-name" style="color:${tm.color}">${tm.fullName}</div>
      ${tierLabel}
      <div class="rp-tm-buff">▲ ${esc(buffText)}</div>
      <div class="rp-tm-penalty">▼ ${esc(penaltyText)}</div>
      ${loyaltyHtml}
      ${snitch}
    </div>`;
  }
  let classTrackHtml = '';
  if (G.playerClass && G.classTrackLevel !== undefined) {
    const cls = CLASS_DB[G.playerClass];
    const thresholds = G.playerClass === 'survivor' ? [0,60,130,220,330,450] : [0,8,18,30,45,60];
    const maxLevel = thresholds.length - 1;
    const lvl = G.classTrackLevel;
    const nextThresh = thresholds[lvl + 1] ?? thresholds[maxLevel];
    const barPct = lvl >= maxLevel ? 100 : Math.round(((G.classTrack - thresholds[lvl]) / (nextThresh - thresholds[lvl])) * 100);
    const pips = Array.from({length: maxLevel}, (_, i) =>
      `<div class="ct-pip${i < lvl ? ' done' : i === lvl ? ' active' : ''}"></div>`
    ).join('');
    classTrackHtml = `<div class="rp-section-hdr">CLASS TRACK</div>
    <div class="ct-wrap">
      <div class="ct-name" style="color:${cls.color}">${cls.icon} ${cls.name} — Lvl ${lvl}</div>
      <div class="ct-pips">${pips}</div>
      <div class="ct-bar-bg"><div class="ct-bar-fill" style="width:${barPct}%;background:${cls.color}"></div></div>
      <div class="ct-pts" style="color:var(--dim)">${G.classTrack} pts${lvl < maxLevel ? ` → ${nextThresh} for Lvl ${lvl+1}` : ' MAX'}</div>
    </div>`;
  }
  let contractsHtml = '';
  if (G.runContracts?.length) {
    const rows = G.runContracts.map(c => {
      const state = checkContractLive(c, G);
      const statusIcon = state === 'done' ? '✓' : state === 'failed' ? '✗' : '○';
      const cls = state === 'done' ? 'rc-done' : state === 'failed' ? 'rc-fail' : 'rc-pend';
      return `<div class="rp-contract ${cls}">
        <div class="rc-head"><span class="rc-ci">${c.icon}</span><span class="rc-si">${statusIcon}</span><span class="rc-pts">+${c.pts}</span></div>
        <div class="rc-desc">${esc(c.desc)}</div>
      </div>`;
    }).join('');
    contractsHtml = `<div class="rp-section-hdr">RUN CONTRACTS</div><div class="rp-contracts">${rows}</div>`;
  }
  return `<div id="right-panel">
    ${contractsHtml}
    ${classTrackHtml}
    <div class="rp-section-hdr">PERKS</div>
    ${perksHtml}
    <div class="rp-section-hdr">TEAMMATE</div>
    ${tmHtml}
    ${renderForecastPanel(G)}
  </div>`;
}

export function renderDeckPanel(G) {
  const deckCount = (G.deck || []).length;
  const pileCount = (G.pile || []).length;
  const topCard   = G.hasComp && G.hasComp('comp_visionary') && G.deck && G.deck.length > 0 ? G.deck[G.deck.length - 1] : null;
  const archColors = {PRODUCTION:'#6ab4ff', STRATEGY:'#ff9090', CRUNCH:'#ff6030', RECOVERY:'#60ff80'};
  const peekHtml = topCard ? `<div class="dp-peek">
    <div class="dp-peek-lbl">NEXT CARD ▶</div>
    <div class="dp-peek-name">${esc(topCard.name)}</div>
    <div class="dp-peek-arch" style="color:${archColors[topCard.archetype] || '#fff'}">${topCard.archetype}</div>
  </div>` : '';
  return `<div id="deck-panel">
    <div class="dp-hdr">DECK</div>
    <div class="dp-row"><span class="dp-lbl">REMAINING</span><span class="dp-val">${deckCount}</span></div>
    <div class="dp-row"><span class="dp-lbl">PILE</span><span class="dp-val">${pileCount}</span></div>
    ${peekHtml}
  </div>`;
}

export function renderHand(hand, sel, preview, exhausted, passives, G) {
  const ms    = G ? G.maxSel() : MAX_SEL;
  const maxed = sel.length >= ms;
  const riskColors = {SAFE:'#50ff78', CAUTION:'#ffcc44', RISKY:'#ff8040', LETHAL:'#ff2020'};
  const riskHint   = preview
    ? `<span class="hdr-risk" style="color:${riskColors[preview.riskLevel]}">${preview.riskLevel}</span>`
    : `<span style="color:var(--dim)">select 1–${ms} cards</span>`;
  const topCard = G && G.hasComp('comp_visionary') && G.deck && G.deck.length > 0 ? G.deck[G.deck.length - 1] : null;
  const nextPeek = topCard
    ? `<div id="next-card-peek"><span class="ncp-label">NEXT CARD ▶</span><span class="ncp-name">${esc(topCard.name)}</span><span class="ncp-arch ncp-${topCard.archetype}">${topCard.archetype}</span></div>`
    : '';
  const crunchFree = !!(G && G.hasComp && G.hasComp('comp_networker') && !G.firstCrunchUsed);
  const isFirstPlay = !!(G && G.week === 1 && G.plays === (G.playsMax || PLAYS));
  const ctx = {showPct:!!(G && G.hasComp('comp_spreadsheet')), target:G ? G.kpi() : 0, wscore:G ? G.wscore : 0, crunchFree, crunchCount: G ? G.weekCrunchCount : 0, isFirstPlay};
  return `<div id="hand-wrap">
    <div id="hand-hdr"><span>HAND — ${hand.length} cards | selected: ${sel.length} / ${ms}</span>${riskHint}</div>
    ${nextPeek}
    <div id="hand" class="${maxed ? 'hand-maxed' : ''}">
      ${hand.map(c => renderCard(c, sel, preview, passives, ctx)).join('')}
    </div>
  </div>`;
}

export function renderCard(c, sel, preview, passives, ctx = {}) {
  const idx = sel.indexOf(c.uid), isSel = idx >= 0;
  const isSynActive = preview && c.synergies.some(s => preview.activeSynergies.has(s.id));
  const fx = getEffectiveFx(c, passives || []);
  const isFreeThisPlay = !!(ctx.crunchFree && c.archetype === 'CRUNCH');
  const effects = [];
  if (fx.chips)   effects.push(`<div class="fx c">+${fx.chips} Chips</div>`);
  if (fx.mult)    effects.push(`<div class="fx m">+${fx.mult.toFixed(2)} Mult</div>`);
  if (isFreeThisPlay) {
    if (fx.tox > 0) effects.push(`<div class="fx tn fx-waived">+${fx.tox}% Tox <span class="fx-waive-lbl">WAIVED</span></div>`);
    if (fx.wb < 0)  effects.push(`<div class="fx wn fx-waived">${fx.wb} WB <span class="fx-waive-lbl">WAIVED</span></div>`);
  } else {
    if (fx.tox > 0) effects.push(`<div class="fx tn">+${fx.tox}% Toxicity</div>`);
    if (fx.wb < 0)  effects.push(`<div class="fx wn">${fx.wb} Wellbeing</div>`);
  }
  if (fx.tox < 0) effects.push(`<div class="fx tp">${fx.tox}% Toxicity</div>`);
  if (fx.wb > 0)  effects.push(`<div class="fx wp">+${fx.wb} Wellbeing</div>`);
  if (!fx.chips && !fx.mult && !fx.tox && !fx.wb) effects.push(`<div class="fx" style="color:var(--dim)">—</div>`);
  const syns = c.synergies.map(s => {
    const active = preview && preview.activeSynergies.has(s.id);
    return `<div class="csyn${active ? ' active' : ''}">${active ? '⚡ ' : '★ '}${s.desc}</div>`;
  }).join('');
  const comboPos = (isSel && preview)
    ? `<div style="font-size:8px;color:var(--dim);margin-top:3px;border-top:1px solid rgba(255,255,255,.08);padding-top:3px">${['1st','2nd','3rd','4th'][idx]} in combo</div>`
    : '';
  const exhaust = c.exhaust ? `<div class="cexh">⊗ EXHAUST</div>` : '';
  const pctHtml = (ctx.showPct && ctx.target > 0 && fx.chips > 0)
    ? `<div class="card-pct">~${Math.round(fx.chips / ctx.target * 100)}%</div>` : '';
  const crunchFreeBadge = isFreeThisPlay ? `<div class="crunch-free-badge">🤝 FREE CRUNCH</div>` : '';
  const crunchFatigueBadge = (c.archetype === 'CRUNCH' && ctx.crunchCount > 0)
    ? `<div class="crunch-fatigue-badge">⚠ +${ctx.crunchCount * 12}% Fatigue Tox</div>`
    : '';
  const isFirstHint = !!(ctx.isFirstPlay && c.archetype === 'PRODUCTION');
  const firstHintBadge = isFirstHint ? `<div class="first-card-hint">▲ Start here</div>` : '';
  const cardLevel = c.level || 0;
  const upgCount = c.upgrades || 0;
  const upgCls = upgCount >= 3 ? ' card-up3' : upgCount === 2 ? ' card-up2' : upgCount >= 1 ? ' card-up1' : '';
  const levelStars = cardLevel > 0 ? `<div class="card-level-stars" title="Card Level ${cardLevel}">${'★'.repeat(cardLevel)}${'☆'.repeat(3-cardLevel)}</div>` : '';
  const playCountHint = cardLevel < 3
    ? `<div class="card-play-count" title="Plays: ${c.playCount||0}">${(c.playCount||0) % 5}/5 ▶ Lv${cardLevel+1}</div>` : '';
  return `<div class="card ${c.archetype}${isSel ? ' sel' : ''}${isSynActive ? ' syn-active' : ''}${isFirstHint ? ' first-hint' : ''}${cardLevel > 0 ? ` card-lv${cardLevel}` : ''}${upgCls}" onclick="G.toggle('${c.uid}')">
    <div class="cbadge">${idx + 1}</div>
    <div class="ctag">${c.archetype}</div>
    ${levelStars}
    <div class="cname">${c.name}</div>
    <div class="cfx">${effects.join('')}${exhaust}</div>
    ${syns}${comboPos}
    ${crunchFreeBadge}${crunchFatigueBadge}${firstHintBadge}${pctHtml}${playCountHint}
  </div>`;
}

export function renderActions(G, preview) {
  const {sel, plays, discs, phase, wscore, week} = G;
  const target = G.kpi();
  let playBtn = '';
  let bankBtn = '';
  if (phase === 'result') {
    const passed = wscore >= target;
    if (G.plays > 0) {
      bankBtn = `<button class="btn btn-bank" onclick="G.bankRemainingPlays()">💰 BANK ${G.plays} UNUSED PLAY${G.plays > 1 ? 'S' : ''} (+${G.plays * 4} CC)</button>`;
    }
    playBtn = passed && week >= TOTAL_WEEKS
      ? `<button class="btn btn-safe" onclick="G.openShop()">🏆 CLAIM VICTORY</button>`
      : `<div style="display:flex;gap:8px">
          <button class="btn btn-next" onclick="G.openShop()" style="flex:1">${passed ? '✓ PASSED — VISIT SHOP' : '✗ FAILED — VISIT SHOP'}</button>
          <button class="btn btn-safe" onclick="G.skipShop()" title="Skip Shop: +3 Corpo Coins. Keep deck lean.">⏭ SKIP (+3 CC)</button>
        </div>`;
  } else if (!sel.length) {
    playBtn = `<button class="btn btn-safe" disabled>▶ PLAY (select cards)</button>`;
  } else if (plays <= 0 || phase !== 'play') {
    playBtn = `<button class="btn btn-safe" disabled>▶ PLAY [no plays left]</button>`;
  } else if (!preview) {
    playBtn = `<button class="btn btn-safe" onclick="G.playSelected()">▶ PLAY (${sel.length} cards)</button>`;
  } else {
    const {riskLevel, score} = preview;
    const projTotal = wscore + score;
    const willPass = projTotal >= target;
    const pm = willPass ? ' ✓' : '';
    if      (riskLevel === 'LETHAL')  playBtn = `<button class="btn btn-lethal"  onclick="G.playSelected()">💀 DESPERATE MOVE (+${score}${pm})</button>`;
    else if (riskLevel === 'RISKY')   playBtn = `<button class="btn btn-risky"   onclick="G.playSelected()">⚡ RISKY PLAY (+${score}${pm})</button>`;
    else if (riskLevel === 'CAUTION') playBtn = `<button class="btn btn-caution" onclick="G.playSelected()">⚠ CAUTIOUS PLAY (+${score}${pm})</button>`;
    else                              playBtn = `<button class="btn btn-safe"    onclick="G.playSelected()">✓ SUBMIT WORK (+${score}${pm})</button>`;
  }
  const ms = G.maxSel ? G.maxSel() : MAX_SEL;
  const discBtn = phase === 'play'
    ? `<button class="btn btn-disc" ${discs <= 0 || !sel.length ? 'disabled' : ''} onclick="G.discardSelected()">✕ DISCARD +10/card (${discs} left)</button>`
    : '';
  const crisisBanner = (plays === 1 && wscore < target && phase === 'play')
    ? `<div class="crisis-banner">⚡ LAST PLAY — need ${target - wscore} more pts</div>` : '';
  const toxRiskLine = (preview && preview.toxChecks > 0 && phase === 'play')
    ? `<div class="play-tox-risk">☣ ${preview.toxChecks} tox check${preview.toxChecks > 1 ? 's' : ''} · est. −${preview.expectedToxDmg} WB · worst −${preview.maxToxDmg} WB</div>` : '';
  const ventBtn = (phase === 'play' && !G.pressureReleaseUsed && G.discs > 0 && G.tox > 0)
    ? `<button class="btn btn-vent" onclick="G.releasePressure()" title="Use 1 discard slot — reduce Toxicity by 15%">💨 VENT (−15% Tox)</button>` : '';
  return `<div id="actions">${crisisBanner}${bankBtn}${playBtn}${toxRiskLine}<div style="display:flex;gap:6px">${discBtn}${ventBtn}</div></div>`;
}

export function renderLog(log, preview) {
  const riskColors = {SAFE:'#50ff78', CAUTION:'#ffdd44', RISKY:'#ff8040', LETHAL:'#ff2020'};
  let previewLine = '';
  if (preview) {
    const col  = riskColors[preview.riskLevel];
    const wbStr = preview.wbDelta  !== 0 ? ` | WB ${preview.wbDelta  > 0 ? '+' : ''}${preview.wbDelta}%`  : '';
    const tStr  = preview.toxDelta !== 0 ? ` | TOX ${preview.toxDelta > 0 ? '+' : ''}${preview.toxDelta}%` : '';
    const bStr  = preview.boDelta  !== 0 ? ` | BO +${preview.boDelta}%` : '';
    const rStr  = preview.toxChecks > 0  ? ` | ☣ up to -${preview.maxToxDmg} HP risk` : '';
    previewLine = `<div class="ll preview" style="color:${col}">↓ [${preview.riskLevel}] +${preview.score} Score${wbStr}${tStr}${bStr}${rStr}</div>`;
  }
  const logHtml = log.slice(-80).filter(e => !e.hidden).reduce((acc, e, i, arr) => {
    acc += `<div class="ll ${e.cls}">${esc(e.t)}</div>`;
    if (e.cls === 'sc' && i < arr.length - 1) acc += `<div class="ll-sep"></div>`;
    return acc;
  }, '');
  return `<div id="log-wrap">
    <div id="log-hdr">TURN LOG</div>
    <div id="log-body">${logHtml}${previewLine}</div>
  </div>`;
}

export function _fxBadges(fx) {
  const parts = [];
  if (fx.wb)       parts.push([`${fx.wb > 0 ? '+' : ''}${fx.wb} WB`,       fx.wb   > 0]);
  if (fx.tox)      parts.push([`${fx.tox > 0 ? '+' : ''}${fx.tox}% Tox`,   fx.tox  < 0]);
  if (fx.bo)       parts.push([`${fx.bo > 0 ? '+' : ''}${fx.bo}% BO`,       fx.bo   < 0]);
  if (fx.coins)    parts.push([`${fx.coins > 0 ? '+' : ''}${fx.coins} CC`,  fx.coins > 0]);
  if (fx.kpiMult)  parts.push([`KPI ×${fx.kpiMult}`,                         fx.kpiMult < 1]);
  if (fx.permMult) parts.push([`+${fx.permMult}× Perm Mult`,                 true]);
  return parts.map(([txt, good]) => `<span class="boss-fx-${good ? 'pos' : 'neg'}">${txt}</span>`).join('');
}

export function renderBossEncounter(G) {
  const boss = BOSS_DB[G.currentBoss] || BOSS_DB.midgame;
  const cssVars = `--bc:${boss.color};--bce:${boss.colorEnd}`;

  const identityPanel = `
    <div class="be-left">
      <div class="be-portrait">${boss.portrait}</div>
      <div class="be-name">${esc(boss.name)}</div>
      <div class="be-title">${esc(boss.title)}</div>
      <div class="be-id-stats">
        <div class="be-id-stat${G.tox >= 60 ? ' be-id-warn' : ''}">☣ TOX <b>${G.tox}%</b></div>
        <div class="be-id-stat${G.wb <= 30 ? ' be-id-warn' : ''}">❤ WB <b>${G.wb}%</b></div>
        <div class="be-id-stat">🔥 BO <b>${G.bo}%</b></div>
      </div>
    </div>`;

  let rightPanel;

  if (G.bossPhase === 'question') {
    const q    = boss.questions[G.bossQIdx];
    const dots = boss.questions.map((_, i) => {
      const cls = i < G.bossQIdx ? ' be-dot-done' : i === G.bossQIdx ? ' be-dot-cur' : '';
      return `<span class="be-dot${cls}">${i < G.bossQIdx ? '◆' : i === G.bossQIdx ? '◈' : '◇'}</span>`;
    }).join('');
    const intro = G.bossQIdx === 0
      ? `<div class="be-intro">${esc(boss.intro)}</div>` : '';
    const opts = q.options.map((o, i) =>
      `<button class="be-opt" onclick="G.answerBossQuestion(${i})">
        <span class="be-opt-key">${String.fromCharCode(65 + i)}</span>
        <span class="be-opt-label">${esc(o.label)}</span>
      </button>`
    ).join('');
    rightPanel = `
      <div class="be-right">
        <div class="be-progress">${dots}<span class="be-prog-lbl">Q${G.bossQIdx + 1} / ${boss.questions.length}</span></div>
        ${intro}
        <div class="be-q-text">${esc(q.text)}</div>
        <div class="be-opts">${opts}</div>
      </div>`;

  } else if (G.bossPhase === 'result') {
    const entry  = G.bossAnswerLog[G.bossAnswerLog.length - 1];
    const isLast = G.bossQIdx >= boss.questions.length - 1;
    const badges = _fxBadges(entry.fx);
    rightPanel = `
      <div class="be-right be-right-result">
        <div class="be-result-lbl">RESPONSE</div>
        <div class="be-flavor">${esc(entry.opt.flavor)}</div>
        ${badges ? `<div class="be-fx-row">${badges}</div>` : ''}
        <button class="be-next-btn" onclick="G.advanceBoss()">${isLast ? 'Review complete →' : 'Next question →'}</button>
      </div>`;

  } else {
    const rewards = G.bossRewardPool.map(r =>
      `<div class="be-reward" onclick="G.claimBossReward('${r.id}')">
        <div class="be-rw-icon">${r.icon}</div>
        <div class="be-rw-label">${esc(r.label)}</div>
        <div class="be-rw-desc">${esc(r.desc)}</div>
      </div>`
    ).join('');
    return `<div class="be-root" style="${cssVars}">
      <div class="be-banner">
        <span class="be-banner-ico">⚠</span>
        <span class="be-banner-week">WEEK ${G.week}</span>
        <span class="be-banner-sep">·</span>
        <span class="be-banner-enc">${esc(boss.encounter)}</span>
      </div>
      <div class="be-reward-screen">
        <div class="be-rw-header">
          <div class="be-rw-portrait">${boss.portrait}</div>
          <div>
            <div class="be-rw-complete">REVIEW COMPLETE</div>
            <div class="be-rw-sub">${esc(boss.name)} closes their notebook. Select your performance bonus.</div>
          </div>
        </div>
        <div class="be-reward-grid">${rewards}</div>
      </div>
    </div>`;
  }

  return `<div class="be-root" style="${cssVars}">
    <div class="be-banner">
      <span class="be-banner-ico">⚠</span>
      <span class="be-banner-week">WEEK ${G.week}</span>
      <span class="be-banner-sep">·</span>
      <span class="be-banner-enc">${esc(boss.encounter)}</span>
      <span class="be-banner-sep">·</span>
      <span class="be-banner-name">${esc(boss.name.toUpperCase())}</span>
    </div>
    <div class="be-body">
      ${identityPanel}
      ${rightPanel}
    </div>
  </div>`;
}

export function renderCardOverlay(G, cards, actionFn, emptyMsg, mode = 'remove') {
  if (!cards.length) return `<div class="ov-card-empty">${emptyMsg}</div>`;
  const sortKey = G?.overlaySort || 'name';
  const sorted = [...cards].sort((a, b) => {
    if (sortKey === 'chips') return (b.fx.chips||0) - (a.fx.chips||0);
    if (sortKey === 'mult')  return (b.fx.mult||0)  - (a.fx.mult||0);
    return a.name.localeCompare(b.name);
  });
  const btnLabel = mode === 'upgrade' ? '⬆ Upgrade This Card' : mode === 'hold' ? '💼 Hold This Card' : '🗑 Remove This Card';
  const btnCls   = mode === 'upgrade' ? 'oc-btn-upgrade' : mode === 'hold' ? 'oc-btn-hold' : 'oc-btn-remove';
  const sortBar = `<div class="oc-sort-row">
    <span class="oc-sort-label">Sort:</span>
    <button class="oc-sort-btn${sortKey==='name'?' oc-sort-active':''}" onclick="G.setOverlaySort('name')">Name</button>
    <button class="oc-sort-btn${sortKey==='chips'?' oc-sort-active':''}" onclick="G.setOverlaySort('chips')">Chips ↓</button>
    <button class="oc-sort-btn${sortKey==='mult'?' oc-sort-active':''}" onclick="G.setOverlaySort('mult')">Mult ↓</button>
  </div>`;
  const cardsHtml = sorted.map(c => {
    const lvl   = c.level || 0;
    const upg     = c.upgrades || 0;
    const upgCls  = upg >= 3 ? ' card-up3' : upg === 2 ? ' card-up2' : upg >= 1 ? ' card-up1' : '';
    const upgBadge = upg > 0 ? `<span class="oc-up-badge${upg >= 3 ? ' up3' : upg === 2 ? ' up2' : ''}">&#8679; ×${upg} UPG</span>` : '';
    const lvlBadge = lvl > 0 ? `<span class="oc-lv-badge lv${lvl}">LV${lvl}</span>` : '';
    const stars = lvl > 0 ? `<span class="oc-stars">${'★'.repeat(lvl)}</span>` : '';
    const fxParts = [
      c.fx.chips > 0 ? `<span class="oc-fx-chip">🔵 ${c.fx.chips} Chips</span>` : '',
      c.fx.mult  > 0 ? `<span class="oc-fx-mult">🔴 ×${c.fx.mult.toFixed(2)} Mult</span>` : '',
      c.fx.tox   > 0 ? `<span class="oc-fx-tox">☣ +${c.fx.tox}% Tox</span>` : '',
      c.fx.tox   < 0 ? `<span class="oc-fx-toxg">☣ ${c.fx.tox}% Tox</span>` : '',
      c.fx.wb    > 0 ? `<span class="oc-fx-wb">❤ +${c.fx.wb} WB</span>` : '',
      c.fx.wb    < 0 ? `<span class="oc-fx-wbn">❤ ${c.fx.wb} WB</span>` : '',
    ].filter(Boolean).join(' ');
    const upgradePreview = mode === 'upgrade'
      ? `<div class="oc-upgrade-preview">
          <span class="oc-fx-chip">🔵 ${(c.fx.chips||0)+80}</span>
          <span class="oc-fx-mult">🔴 ×${((c.fx.mult||0)+0.3).toFixed(2)}</span>
          <span class="oc-upgrade-delta">↑ +80 Chips / +0.3 Mult</span>
        </div>` : '';
    const playInfo = c.playCount !== undefined
      ? `<div class="oc-plays">${c.playCount||0} plays${lvl < 3 ? ` · ${(c.playCount||0)%5}/5 → Lv${lvl+1}` : ' · MAX LVL'}</div>` : '';
    return `<div class="oc-card ${c.archetype}${lvl > 0 ? ` card-lv${lvl}` : ''}${upgCls}" onclick="${actionFn}('${c.uid}')">
      <div class="oc-top">
        <span class="oc-arch">${c.archetype}</span>
        <span class="oc-rarity">${c.rarity}${stars}</span>
      </div>
      ${lvlBadge}${upgBadge}
      <div class="oc-name">${esc(c.name)}</div>
      ${c.flavor ? `<div class="oc-flavor">"${esc(c.flavor)}"</div>` : ''}
      <div class="oc-fx-row">${fxParts || '<span style="color:var(--dim)">—</span>'}</div>
      ${upgradePreview}
      ${playInfo}
      <button class="oc-btn ${btnCls}">${btnLabel}</button>
    </div>`;
  }).join('');
  return sortBar + cardsHtml;
}

export function renderTeammateChoice(G) {
  const tierColors = {1:'#88cc44', 2:'#ffaa00', 3:'#ff5555'};
  const tierLabels = {1:'NORMAL ENV', 2:'ELEVATED TOX', 3:'HIGH TOX'};
  const toxTier = G.tox >= 81 ? 3 : G.tox >= 31 ? 2 : 1;

  const cardsHtml = (G.teammateOptions || []).map(id => {
    const tm = TEAMMATES_DB[id];
    const tierData = tm.tiers[toxTier - 1];
    const isCurrent = id === G.loyaltyTeammateId;
    const streak = isCurrent ? (G.consecutiveSameTeammate || 0) : 0;
    const loyaltyTag = streak >= 7
      ? `<div class="tmc-loyalty bond">🤝 Unbreakable Bond (${streak} wks) — +0.6 Mult/play</div>`
      : streak >= 5
      ? `<div class="tmc-loyalty deep">🤝 Deep Partnership (${streak} wks) — +0.4 Mult/play</div>`
      : streak >= 3
      ? `<div class="tmc-loyalty">🤝 Trusted Ally (${streak} wks) — +0.2 Mult/play</div>`
      : streak >= 2
      ? `<div class="tmc-loyalty dim">⏳ ${streak} wks together — ${3 - streak} more for Trusted Ally</div>`
      : streak === 1
      ? `<div class="tmc-loyalty dim">⏳ Week 1 together — 2 more for Trusted Ally</div>`
      : '';
    // Tier proximity warning
    const toxToNext = toxTier === 1 ? 30 - G.tox : toxTier === 2 ? 81 - G.tox : null;
    const tierWarn = toxToNext !== null && toxToNext <= 15
      ? `<div class="tmc-tier-warn">⚠ ${toxToNext}% TOX → tier escalates to T${toxTier + 1}</div>`
      : `<div class="tmc-tier-thresholds">T1 &lt;30% · T2 &lt;81% · T3 81%+</div>`;
    // Gary live Mult preview
    let garyPreview = '';
    if (id === 'gary' && toxTier >= 2) {
      const bonus = toxTier === 2
        ? fmt1(Math.floor(G.tox / 20) * 0.5)
        : fmt1(Math.min(10, Math.floor(G.tox / 10) * 1.0));
      garyPreview = `<div class="tmc-gary-preview">≈ +${bonus} Mult @ ${G.tox}% TOX now</div>`;
    }
    return `<div class="tmc-card${isCurrent && streak >= 2 ? ' returning' : ''}" onclick="G.chooseTeammate('${id}')">
      <div class="tmc-portrait" style="color:${tm.color}">${tm.portrait}</div>
      <div class="tmc-name" style="color:${tm.color}">${esc(tm.fullName)}</div>
      <div class="tmc-tier" style="color:${tierColors[toxTier]}">T${toxTier} — ${tierLabels[toxTier]}</div>
      ${tierWarn}
      <div class="tmc-desc">${esc(tierData.name)}</div>
      <div class="tmc-effects">
        <div class="tmc-buff">▲ ${esc(tierData.buffText)}</div>
        <div class="tmc-penalty">▼ ${esc(tierData.penaltyText)}</div>
      </div>
      ${garyPreview}
      ${loyaltyTag}
      <div class="tmc-quote">"${esc(tierData.triggerQuote)}"</div>
      <button class="tmc-btn">ASSIGN THIS COLLEAGUE</button>
    </div>`;
  }).join('');

  const toxNote = toxTier > 1
    ? `<div class="tmc-tox-note" style="color:${tierColors[toxTier]}">⚠ High Toxicity (${G.tox}%) — colleague behavior is escalated this week</div>`
    : `<div class="tmc-tox-note">Current Toxicity: ${G.tox}% — colleague behavior is calm this week</div>`;

  return `<div class="tm-choice-screen">
    <div class="tm-choice-header">
      <div class="tm-choice-title">👥 WEEKLY STAFFING DECISION</div>
      <div class="tm-choice-sub">Week ${G.week} — Select your colleague for this deliverable period</div>
      ${toxNote}
    </div>
    <div class="tmc-cards">${cardsHtml}</div>
  </div>`;
}

export function renderPowerEvent(G) {
  const weekLabel = {3:'MID-QUARTER',6:'Q3 PERFORMANCE REVIEW',9:'YEAR-END PUSH'};
  const optHtml = (G.powerEventOptions || []).map(opt => {
    const fxBadges = [];
    const {fx} = opt;
    if (fx.permMult) fxBadges.push(`<span class="pe-fx-good">+${fx.permMult} perm Mult</span>`);
    if (fx.bo)       fxBadges.push(`<span class="pe-fx-bad">+${fx.bo} Burnout</span>`);
    if (fx.wb)       fxBadges.push(`<span class="pe-fx-good">+${fx.wb} WB</span>`);
    if (fx.tox)      fxBadges.push(`<span class="pe-fx-good">${fx.tox}% Tox</span>`);
    if (fx.coins)    fxBadges.push(`<span class="pe-fx-good">+${fx.coins} CC</span>`);
    if (fx.upgrade)  fxBadges.push(`<span class="pe-fx-good">Free upgrade</span>`);
    if (fx.remove)   fxBadges.push(`<span class="pe-fx-good">Free removal</span>`);
    if (fx.addCards) fxBadges.push(`<span class="pe-fx-good">+${fx.addCards} free cards</span>`);
    return `<div class="pe-option" onclick="G.claimPowerEvent('${opt.id}')">
      <div class="pe-opt-icon">${opt.icon}</div>
      <div class="pe-opt-name">${opt.name}</div>
      <div class="pe-opt-desc">${esc(opt.desc)}</div>
      <div class="pe-opt-fx">${fxBadges.join('')}</div>
      <button class="pe-opt-btn">▶ CLAIM</button>
    </div>`;
  }).join('');
  return `<div class="power-event-screen">
    <div class="pe-header">
      <div class="pe-eyebrow">CORPORATE ANNOUNCEMENT</div>
      <div class="pe-title">⚡ ${weekLabel[G.week] || 'POWER EVENT'}</div>
      <div class="pe-sub">Week ${G.week} milestone — choose your reward</div>
    </div>
    <div class="pe-options">${optHtml}</div>
  </div>`;
}

export function renderDraft(G) {
  const cardsHtml = G.draftPool.map(c => {
    const fxLines = [
      c.fx.chips ? `🔵 +${c.fx.chips} Chips` : '',
      c.fx.mult  ? `🔴 +${c.fx.mult}× Mult` : '',
      c.fx.tox > 0 ? `☣ +${c.fx.tox}% Tox` : '',
      c.fx.tox < 0 ? `☣ ${c.fx.tox}% Tox` : '',
      c.fx.wb > 0  ? `❤ +${c.fx.wb} WB` : '',
      c.fx.wb < 0  ? `❤ ${c.fx.wb} WB` : '',
    ].filter(Boolean).join('<br>');
    const synDesc = c.synergies?.[0]?.desc ? `<div class="dr-syn">★ ${esc(c.synergies[0].desc)}</div>` : '';
    return `<div class="dr-card ${c.archetype}" onclick="G.claimDraftCard('${c.id}')">
      <div class="dr-arch">${c.archetype}</div>
      <div class="dr-rarity">${c.rarity}</div>
      <div class="dr-name">${esc(c.name)}</div>
      <div class="dr-flavor">"${esc(c.flavor)}"</div>
      <div class="dr-fx">${fxLines}</div>
      ${synDesc}
      <button class="dr-pick-btn">＋ Add to Deck</button>
    </div>`;
  }).join('');

  return `<div class="draft-screen">
    <div class="dr-header">
      <div class="dr-title">📋 WEEKLY CARD DRAFT</div>
      <div class="dr-sub">Week ${G.week} passed — choose 1 card to add to your deck permanently</div>
      <div class="dr-sub" style="margin-top:3px;color:${(G.deck.length+G.hand.length+G.pile.length)>=24?'#ff8040':'var(--dim)'}">Deck: ${G.deck.length+G.hand.length+G.pile.length} / 24 cards${(G.deck.length+G.hand.length+G.pile.length)>=24?' — FULL: adding will require shredding one card':''}</div>
    </div>
    <div class="dr-cards">${cardsHtml}</div>
    <div class="dr-skip-row">
      <button class="dr-skip-btn" onclick="G.skipDraft()">✗ Skip — keep deck lean</button>
    </div>
  </div>`;
}

export function renderTargetedDraw(G) {
  const cardsHtml = (G.targetedDrawOptions || []).map(c => {
    const fxLines = [
      c.fx.chips   ? `🔵 +${c.fx.chips} Chips` : '',
      c.fx.mult    ? `🔴 +${c.fx.mult}× Mult`  : '',
      c.fx.tox > 0 ? `☣ +${c.fx.tox}% Tox`   : '',
      c.fx.tox < 0 ? `☣ ${c.fx.tox}% Tox`    : '',
      c.fx.wb  > 0 ? `❤ +${c.fx.wb} WB`      : '',
      c.fx.wb  < 0 ? `❤ ${c.fx.wb} WB`       : '',
    ].filter(Boolean).join('<br>');
    return `<div class="dr-card ${c.archetype}" onclick="G.claimTargetedDraw('${c.uid}')">
      <div class="dr-arch">${c.archetype}</div>
      <div class="dr-rarity">${c.rarity}</div>
      <div class="dr-name">${esc(c.name)}</div>
      <div class="dr-flavor">"${esc(c.flavor)}"</div>
      <div class="dr-fx">${fxLines || '<span style="color:var(--dim)">No direct effect</span>'}</div>
      <button class="dr-pick-btn">▶ Draw This Card</button>
    </div>`;
  }).join('');
  return `<div class="draft-screen">
    <div class="dr-header">
      <div class="dr-title">🎯 TARGETED DRAW</div>
      <div class="dr-sub">Top 3 cards from your deck — choose 1 to draw into your hand</div>
    </div>
    <div class="dr-cards">${cardsHtml}</div>
  </div>`;
}

export function renderUpgradeResult(G) {
  const card = G.upgradeResultCard;
  const from = G.upgradeResultFrom || { chips: 0, mult: 0 };
  if (!card) { G.dismissUpgradeResult(); return ''; }

  const upg      = card.upgrades || 0;
  const upgCls   = upg >= 3 ? ' card-up3' : upg === 2 ? ' card-up2' : upg >= 1 ? ' card-up1' : '';
  const archColors = {
    PRODUCTION: { glow: '#3878cc', tag: '#6ab4ff' },
    STRATEGY:   { glow: '#be2828', tag: '#ff9090' },
    CRUNCH:     { glow: '#a02000', tag: '#ff6030' },
    RECOVERY:   { glow: '#1e8028', tag: '#60ff80' },
  };
  const ac = archColors[card.archetype] || { glow: '#558', tag: '#aaa' };

  const newChips = card.fx.chips || 0;
  const newMult  = card.fx.mult  || 0;

  return `<div class="upgr-screen">
    <div class="upgr-title">⬆ PERFORMANCE UPGRADE</div>
    <div class="upgr-subtitle">Card permanently improved</div>
    <div class="upgr-card-wrap">
      <div class="upgr-glow" style="--glow-col:${ac.glow}"></div>
      <div class="oc-card ${card.archetype}${upgCls} upgr-card">
        <div class="oc-top">
          <span class="oc-arch">${card.archetype}</span>
          <span class="oc-rarity">${card.rarity || ''}</span>
        </div>
        ${upg > 0 ? `<span class="oc-up-badge${upg >= 3 ? ' up3' : upg === 2 ? ' up2' : ''}">&#8679; ×${upg} UPG</span>` : ''}
        <div class="oc-name">${esc(card.name)}</div>
        ${card.flavor ? `<div class="oc-flavor">"${esc(card.flavor)}"</div>` : ''}
        <div class="oc-fx-row">
          ${newChips > 0 ? `<span class="oc-fx-chip">🔵 ${newChips} Chips</span>` : ''}
          ${newMult  > 0 ? `<span class="oc-fx-mult">🔴 ×${newMult.toFixed(2)} Mult</span>` : ''}
        </div>
      </div>
    </div>
    <div class="upgr-compare">
      <div class="upgr-cmp-row">
        <span class="upgr-cmp-label">Chips</span>
        <span class="upgr-cmp-before">${from.chips}</span>
        <span class="upgr-cmp-arrow">→</span>
        <span class="upgr-cmp-after upgr-cmp-chips">${newChips}</span>
        <span class="upgr-cmp-delta">+80</span>
      </div>
      <div class="upgr-cmp-row">
        <span class="upgr-cmp-label">Mult</span>
        <span class="upgr-cmp-before">×${from.mult.toFixed(2)}</span>
        <span class="upgr-cmp-arrow">→</span>
        <span class="upgr-cmp-after upgr-cmp-mult">×${newMult.toFixed(2)}</span>
        <span class="upgr-cmp-delta">+0.3</span>
      </div>
    </div>
    <button class="upgr-continue-btn" onclick="G.dismissUpgradeResult()">▶ CONTINUE TO SHOP</button>
  </div>`;
}

export function renderShop(G) {
  if (G.pendingUpgrade) {
    const allCards = [...G.deck, ...G.pile];
    return `<div class="draft-screen">
      <div class="dr-header">
        <div class="dr-title">⬆️ PERFORMANCE UPGRADE</div>
        <div class="dr-sub">Choose a card to permanently upgrade — +80 Chips &amp; +0.3 Mult added to base stats</div>
      </div>
      <div class="oc-grid">${renderCardOverlay(G, allCards, 'G.upgradeCard', 'No cards available to upgrade.', 'upgrade')}</div>
      <div class="dr-skip-row"><button class="dr-skip-btn" onclick="G.cancelAction()">✕ Cancel</button></div>
    </div>`;
  }
  if (G.pendingRemove) {
    const allCards = [...G.deck, ...G.pile];
    return `<div class="draft-screen">
      <div class="dr-header">
        <div class="dr-title">🗑️ PERFORMANCE REVIEW</div>
        <div class="dr-sub">Select a card to permanently shred — this cannot be undone</div>
      </div>
      <div class="oc-grid">${renderCardOverlay(G, allCards, 'G.removeCard', 'No cards available to remove.', 'remove')}</div>
      <div class="dr-skip-row"><button class="dr-skip-btn" onclick="G.cancelAction()">✕ Cancel</button></div>
    </div>`;
  }
  if (G.pendingHold) {
    const heldName = G.heldCards.length ? G.heldCards.map(c => c.name).join(', ') : null;
    return `<div class="draft-screen">
      <div class="dr-header">
        <div class="dr-title">💼 OVERTIME BRIEFCASE</div>
        <div class="dr-sub">Select a card from your discard to hold for next week</div>
        ${heldName ? `<div class="dr-sub" style="color:#80ffa8;margin-top:3px">💼 Already held: ${heldName}</div>` : ''}
      </div>
      <div class="oc-grid">${renderCardOverlay(G, G.pile, 'G.holdCard', 'Discard pile is empty.', 'hold')}</div>
      <div class="dr-skip-row"><button class="dr-skip-btn" onclick="G.cancelAction()">✕ Cancel</button></div>
    </div>`;
  }
  const {week, coins, shopItems, wscore, passives} = G;
  const passed = wscore >= G.kpi();
  const wbColor = G.wb >= 70 ? '#70ff78' : G.wb >= 40 ? '#ffdd44' : '#ff7070';
  const toxColor = G.tox >= 70 ? '#ff7070' : G.tox >= 40 ? '#ffdd44' : '#70ff78';
  const boColor = G.bo >= 90 ? '#ff2020' : G.bo >= 70 ? '#ff8040' : G.bo >= 50 ? '#ffdd44' : '#808080';
  const cardsHtml = shopItems.map(id => {
    const item = SHOP_DB[id];
    const isOwned = item.unique && passives.some(p => p.itemId === id);
    const canAfford = coins >= item.cost;
    let btnExtra = '', btnLabel, disabled = '';
    if (isOwned)        { btnLabel = 'OWNED'; disabled = 'disabled'; btnExtra = ' sh2-owned'; }
    else if (!canAfford){ btnLabel = `${item.cost} CC — INSUFFICIENT`; disabled = 'disabled'; btnExtra = ' sh2-cant'; }
    else                { btnLabel = `BUY — ${item.cost} CC`; }
    const clickable = !isOwned && canAfford;
    const isClassPerk = !!item.classExclusive;
    return `<div class="sh2-card${clickable ? ' sh2-buyable' : ''}${isClassPerk ? ' sh2-class-perk' : ''}" ${clickable ? `onclick="G.buyItem('${id}')"` : ''}>
      <div class="sh2-type">${isClassPerk ? '★ CLASS PERK' : item.type.replace('_', ' ')}</div>
      <div class="sh2-icon">${item.icon}</div>
      <div class="sh2-name">${item.name}</div>
      <div class="sh2-desc">${item.desc}</div>
      <button class="sh2-buy-btn${btnExtra}" ${disabled} onclick="event.stopPropagation();G.buyItem('${id}')">${btnLabel}</button>
    </div>`;
  }).join('');
  const shopPassives = passives.filter(p => !p.isComp);
  const passiveList = shopPassives.length
    ? `<div class="sh2-installed">Installed: ${shopPassives.map(p => `<span class="sp-tag">${SHOP_DB[p.itemId]?.icon || '•'} ${p.name}</span>`).join('')}</div>`
    : '';
  const heldList = G.heldCards && G.heldCards.length
    ? `<div class="sh2-installed" style="color:#80ffa8">💼 Held: ${G.heldCards.map(c => `<span class="sp-tag">${c.name}</span>`).join('')}</div>`
    : '';
  const meltdownAdvisory = G.tox >= 91
    ? `<div class="meltdown-advisory" style="margin:6px 0 10px">☣ MELTDOWN ZONE — Mult ×2 all plays · 20% auto-exhaust risk per card</div>`
    : '';
  const shredCost = G.freeRemovalUsed ? 3 : 0;
  const canAffordShred = shredCost === 0 || G.coins >= shredCost;
  const shredLabel = shredCost === 0 ? '🗑️ SHRED A CARD — FREE (1st use)' : `🗑️ SHRED A CARD — ${shredCost} CC`;
  const upgradeCost = SHOP_DB.sh_upgrade.cost;
  const canAffordUpgrade = coins >= upgradeCost;
  const upgradeLabel = `⬆️ UPGRADE A CARD — ${upgradeCost} CC`;
  const nextLabel = week >= TOTAL_WEEKS ? '✓ FINAL RESULTS' : `▶ START WEEK ${week + 1}`;
  return `<div class="draft-screen">
    <div class="dr-header">
      <div class="dr-title">🏪 CORPO-SHOP — WEEK ${week}</div>
      <div class="dr-sub" style="color:${passed ? '#70ff78' : '#ff7070'};font-weight:bold">${passed ? `✓ PASSED — ${wscore} / ${G.kpi()}` : `✗ FAILED — ${wscore} / ${G.kpi()}`}</div>
      <div class="sh2-stats">
        <span style="color:${wbColor}">❤ WB ${G.wb}%</span>
        <span style="color:${toxColor}">☣ TOX ${G.tox}%</span>
        <span style="color:${boColor}">🔥 BO ${G.bo}%</span>
        <span style="color:#ffdd44">💰 ${coins} CC</span>
      </div>
    </div>
    ${meltdownAdvisory}
    <div class="dr-cards">${cardsHtml || '<div style="color:var(--dim);padding:20px;font:12px Courier New">Shop is empty.</div>'}</div>
    <div class="sh2-actions">
      <button class="dr-skip-btn" ${canAffordShred ? '' : 'disabled'} onclick="G.startRemoval()">${shredLabel}</button>
      <button class="sh2-upgrade-btn" ${canAffordUpgrade ? '' : 'disabled'} onclick="G.buyItem('sh_upgrade')" title="+80 Chips &amp; +0.3 Mult added permanently to 1 card">${upgradeLabel}</button>
    </div>
    ${passiveList}${heldList}
    <div class="sh2-footer">
      <button class="sh2-skip-btn" onclick="G.skipShop()" ${G.purchasedThisShop ? 'disabled' : ''}>⏭ SKIP (+3 CC)</button>
      <button class="sh2-next-btn" onclick="G.startNextWeek()">${nextLabel}</button>
    </div>
  </div>`;
}
