import { clamp, KPI, TOTAL_WEEKS, PLAYS, MAX_SEL, CAREER_DB, UPGRADE_TIERS } from '../data/constants.js';
import { SHOP_DB, PACK_DB } from '../data/shop.js';
import { detectMeeting, getMeetingUpgradeHint, MEETING_TIER_COLORS, BASE_MEETINGS, SECRET_MEETINGS } from '../data/meetingTypes.js';
import { TEAMMATES_DB } from '../data/content.js';
import { DB } from '../data/cards.js';
import { getEffectiveFx, simulateTurn } from '../engine/calcTurn.js';
import { calculateFinalScore, predictCareerTier } from '../engine/scoring.js';
import { esc, fmt1 } from '../engine/utils.js';
import { initFinalReviewAnim, updateKpiBar, initScoringAnimation } from './animations.js';
import { _currentHandH, HAND_H_DEF, applyHandHeight } from './resize.js';
import { ovGameOver, ovWin, ovFinalReview } from './overlays.js';
import { buildManagerEmail, shouldShowEmail } from '../data/managerEmails.js';

export const ARCH_COLORS = {PRODUCTION:'#6ab4ff', STRATEGY:'#ff9090', CRUNCH:'#ff6030', RECOVERY:'#60ff80', SHOP:'#c8b8ff'};

// ═══════════════════════════════════════════════════════
//  MODULE STATE
// ═══════════════════════════════════════════════════════
let _lastPhase = null;
let _lastWscore = 0;

const _phaseFlashLabels = {
  play:            wk => `WEEK ${wk} — DELIVERABLES`,
  result:          ()  => 'WEEK COMPLETE',
  scoring:         ()  => 'SUBMITTING WORK',
  shop:            ()  => 'WEEKLY REVIEW',
  teammate_choice: ()  => 'STAFFING DECISION',
};

function _showPhaseFlash(phase, week) {
  const labelFn = _phaseFlashLabels[phase];
  if (!labelFn) return;
  const el = document.createElement('div');
  el.className = 'phase-flash';
  el.textContent = labelFn(week);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

// ═══════════════════════════════════════════════════════
//  STATUS BAR
// ═══════════════════════════════════════════════════════
export function renderStatusBar(G) {
  const tierInfo = G.tox >= 91 ? {cls:'tier-meltdown', lbl:'MELTDOWN ZONE'}
                 : G.tox >= 61 ? {cls:'tier-toxic',    lbl:'TOXIC CULTURE'}
                 : G.tox >= 31 ? {cls:'tier-passive',  lbl:'PASSIVE-AGGRESSIVE'}
                 :               {cls:'tier-pro',      lbl:'PROFESSIONAL'};

  const lastEntry = G.log ? [...G.log].reverse().find(e => !e.hidden) : null;
  const logText   = lastEntry ? lastEntry.t : 'System ready.';
  const logCls    = lastEntry?.cls === 'tg' ? 'ok'
                  : lastEntry?.cls === 'er' ? 'fail'
                  : lastEntry?.cls === 'sy' ? 'warn' : '';
  const dayNames  = ['MON','TUE','WED','THU','FRI'];
  const dayName   = dayNames[G.dayIndex ?? 0] || 'MON';
  const phase     = {play:'PLAY', result:'RESULT', shop:'SHOP', gameover:'GAME OVER',
                     win:'WIN', review:'REVIEW', draft:'DRAFT', teammate_choice:'STAFFING',
                     targeted_draw:'DRAW', scoring:'SCORING'}[G.phase] || G.phase.toUpperCase();

  // Apply class to statusbar
  const sb = document.getElementById('statusbar');
  if (sb) sb.className = 'new-sb';

  return `<div class="sb-dot"></div>
    <span class="sb-role">${tierInfo.lbl}</span>
    <div class="sb-vsep"></div>
    <span class="sb-log ${logCls}" id="status-log-line">${esc(logText.slice(0, 120))}</span>
    <span class="sb-right">v0.4 &nbsp;|&nbsp; ${dayName} &nbsp;|&nbsp; Week ${G.week}/${TOTAL_WEEKS} &nbsp;|&nbsp; ${phase}</span>`;
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
//  TOPBAR
// ═══════════════════════════════════════════════════════
export function renderTopbar(G) {
  const {week, coins, discs, wscore, plays} = G;
  const target  = G.kpi();
  const pct     = Math.min(100, target > 0 ? wscore / target * 100 : 0).toFixed(1);
  const willPass = wscore >= target;
  const barColor = wscore >= target ? '#00e090' : pct >= 70 ? '#ff9500' : '#ff2d55';

  const weekDots = Array.from({length: TOTAL_WEEKS}, (_, i) => {
    const wk   = i + 1;
    const hist = (G.weekHistory || []).find(h => h.week === wk);
    let cls = 'wd';
    if      (hist && hist.passed) cls += ' done-pass';
    else if (hist)                cls += ' done-fail';
    else if (wk === week)         cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');

  const pips = Array.from({length:(G.playsMax||PLAYS)}, (_, i) => {
    if (i >= plays) return `<div class="tp-pip used"></div>`;
    if (plays === 1) return `<div class="tp-pip last-pip"></div>`;
    return `<div class="tp-pip"></div>`;
  }).join('');

  const phase = {play:'PLAY', result:'RESULT', shop:'SHOP', gameover:'GAME OVER',
                 win:'WIN', review:'REVIEW', draft:'DRAFT', teammate_choice:'STAFFING',
                 targeted_draw:'DRAW', scoring:'SCORING'}[G.phase] || G.phase.toUpperCase();

  return `
    <div class="logo">DEAD<span>LINE</span></div>
    <div class="week-block">
      <span class="wb-label">WEEK</span>
      <span class="wb-num">${week}/${TOTAL_WEEKS}</span>
      <div class="wb-dots">${weekDots}</div>
    </div>
    <div class="target-block">
      <span class="tb-label">WEEKLY TARGET</span>
      <div class="tb-bar-wrap">
        <div class="tb-bar-bg">
          <div id="kpi-bar-inner" class="tb-bar-fill" style="width:${pct}%;background:${barColor};"></div>
        </div>
        <div class="tb-nums">
          <span style="color:${barColor}">$${wscore.toLocaleString()}</span>
          <span style="color:var(--color-text-muted)">$${target.toLocaleString()}</span>
        </div>
      </div>
      ${willPass ? `<div class="pass-badge">✓ PASS</div>` : ''}
    </div>
    <div class="topbar-right">
      <div class="topbar-pips">${pips}</div>
      <div class="cc-pill">
        <div class="cc-icon"></div>
        <span class="cc-val">${coins}</span>
        <span class="cc-label">CC</span>
      </div>
      <span class="discards-info">DISCARD: ${discs}</span>
      <button class="inbox-topbar-btn" onclick="G.openInbox()" title="Open Inbox">${(() => { const u = (G.inbox||[]).filter(e=>e.unread).length; return u > 0 ? `📬 <span class="inbox-unread-badge">${u}</span>` : '📭'; })()}</button>
      <div class="topbar-phase">${phase}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════
export function render(G) {
  if (G.phase !== _lastPhase) {
    _showPhaseFlash(G.phase, G.week);
    _lastPhase = G.phase;
  }

  // Always update topbar
  const tb = document.getElementById('topbar');
  if (tb) tb.innerHTML = renderTopbar(G);

  // Atmosphere on #win
  const win = document.getElementById('win');
  if (win) {
    const atm = ['atm-toxic','atm-meltdown','atm-wb-crit','atm-burnout','atm-pass'];
    atm.forEach(c => win.classList.remove(c));
    if      (G.tox >= 90)  win.classList.add('atm-meltdown');
    else if (G.tox >= 60)  win.classList.add('atm-toxic');
    if (G.wb  <  30)       win.classList.add('atm-wb-crit');
    else if (G.bo > 70)    win.classList.add('atm-burnout');
  }

  // Status bar
  const sb = document.getElementById('statusbar');
  if (sb) sb.innerHTML = renderStatusBar(G);

  const winBody = document.getElementById('win-body');

  if (G.inboxOpen) {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderInbox(G)}</div>`;
    return;
  }

  if (G.phase === 'teammate_choice') {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderTeammateChoice(G)}</div>`;
    return;
  }
  if (G.phase === 'targeted_draw') {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderTargetedDraw(G)}</div>`;
    return;
  }
  if (G.phase === 'scoring') {
    try {
      winBody.innerHTML = `<div class="full-phase-wrap">${renderScoring(G)}</div>`;
      initScoringAnimation(G);
    } catch(e) {
      console.error('[DEADLINE] renderScoring failed:', e);
      G.finishScoring();
    }
    return;
  }
  if (G.phase === 'upgrade_result') {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderUpgradeResult(G)}</div>`;
    return;
  }
  if (G.phase === 'shop') {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderShop(G)}</div>`;
    if (G.openedPack) setTimeout(() => window._initPackReveal?.(), 50);
    return;
  }
  // Desk item offer can appear during result phase
  if (G.deskItemOffer && G.deskItemOffer.length && G.phase === 'result') {
    winBody.innerHTML = `<div class="full-phase-wrap">${renderDeskItemOffer(G)}</div>`;
    return;
  }

  // ── PLAY / RESULT phase — 3-column layout ──
  const {week, wb, tox, bo, wscore, plays, discs, phase, hand, sel, log, playsMax} = G;
  const target   = G.kpi();
  const selCards = sel.map(uid => hand.find(c => c.uid === uid)).filter(Boolean);
  const preview  = selCards.length ? simulateTurn(selCards, G) : null;

  winBody.innerHTML = `
    <div class="main-3col">
      ${renderLeftPanel(G, preview, selCards)}
      <div class="center-panel">
        ${renderFormulaRow(preview, wscore, target, G)}
        <div class="hand-label-new">HAND (${hand.length}) · ${sel.length ? `${sel.length} selected` : `select 1–${G.maxSel()}`}</div>
        <div class="cards-area-new">
          ${hand.map(c => renderCard(c, sel, preview, G.passives, {target, wscore, crunchCount: G.weekCrunchCount, maxSel: G.maxSel()})).join('')}
        </div>
        ${renderDeskRow(G)}
        ${renderActionBarNew(G, preview)}
      </div>
      ${renderRightPanelNew(G)}
    </div>
    ${phase === 'gameover' ? ovGameOver(G) : ''}
    ${phase === 'win'      ? ovWin(G)      : ''}
    ${phase === 'review'   ? ovFinalReview(G) : ''}
  `;
  if (G.phase === 'review') {
    const s = calculateFinalScore(G);
    requestAnimationFrame(() => initFinalReviewAnim(s.total));
  }

  // Post-render micro-interactions (play phase only, on wscore increase)
  const prevWscore = _lastWscore;
  _lastWscore = wscore;
  if (G.phase === 'play' && wscore > prevWscore && prevWscore >= 0) {
    const activatedIds = new Set(G.lastActivatedDeskIds || []);
    const crossedTarget = wscore >= target && prevWscore < target;
    requestAnimationFrame(() => {
      // Step 2 (0ms): desk item pulse
      if (activatedIds.size > 0) {
        document.querySelectorAll('.desk-slot[data-id]').forEach(el => {
          if (activatedIds.has(el.dataset.id)) {
            el.classList.remove('just-activated');
            void el.offsetWidth;
            el.classList.add('just-activated');
            setTimeout(() => el.classList.remove('just-activated'), 350);
          }
        });
      }
      // Step 4 (200ms): revenue count-up from previous wscore
      const scoreEl = document.getElementById('revenue-val');
      setTimeout(() => {
        if (scoreEl) _startRevenueCountUp(scoreEl, prevWscore, wscore, target);
      }, 200);
      // Step 5 (1000ms): pass flash on REVENUE box
      if (crossedTarget) {
        setTimeout(() => {
          const fResult = document.querySelector('.f-result');
          if (fResult) {
            fResult.classList.remove('pass-flash');
            void fResult.offsetWidth;
            fResult.classList.add('pass-flash');
            setTimeout(() => fResult.classList.remove('pass-flash'), 550);
          }
        }, 1000);
      }
    });
  }
}

function _startRevenueCountUp(el, from, to, target) {
  const duration = 700;
  const interval = 25;
  const steps = Math.ceil(duration / interval);
  let step = 0;
  const timer = setInterval(() => {
    step++;
    const ease = 1 - Math.pow(1 - step / steps, 2);
    const val = Math.round(from + (to - from) * ease);
    const ratio = target > 0 ? val / target : 0;
    el.textContent = '$' + val.toLocaleString();
    el.style.color = ratio >= 1 ? '#4ade80' : ratio >= 0.70 ? '#ff9500' : '#ff2d55';
    if (step >= steps) {
      clearInterval(timer);
      el.style.color = '';  // let CSS class handle final color
    }
  }, interval);
}

// ── Desk item tier colors ──
const DESK_TIER_COLORS = {COMMON:'#7c3aed', UNCOMMON:'#b87cff', RARE:'#ff2d55', LEGENDARY:'#fbbf24'};

function renderDeskRow(G) {
  const items = G.deskItems || [];
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const item = items[i];
    if (item) {
      const col = DESK_TIER_COLORS[item.rarity] || '#7c3aed';
      const isActive = item.active === true && !(item.id === 'resignation_letter' && G.resignationLetterUsed);
      slots.push(`<div class="desk-slot${isActive ? ' ds-active' : ''}" data-id="${item.id}" style="--desk-tier-color:${col}">
        <div class="desk-slot-icon">${item.icon}</div>
        <div class="desk-slot-name">${esc(item.name)}</div>
        <div class="desk-slot-desc">${esc(item.desc)}</div>
      </div>`);
    } else {
      slots.push(`<div class="desk-slot desk-slot-empty">— pusty —</div>`);
    }
  }
  return `<div class="desk-row"><div class="desk-slots">${slots.join('')}</div></div>`;
}

function _getActivationsForHover(card, deskItems, G) {
  const ids = new Set();
  const di = id => deskItems.some(d => d.id === id);
  if (card.archetype === 'STRATEGY')   { if (di('desk_lamp')) ids.add('desk_lamp'); }
  if (card.archetype === 'PRODUCTION') {
    if (di('calendar'))   ids.add('calendar');
    if (di('red_stapler') && G.firstCardThisWeek) ids.add('red_stapler');
  }
  if (card.archetype === 'RECOVERY')   { if (di('whitenoise_machine')) ids.add('whitenoise_machine'); }
  if (card.archetype === 'CRUNCH') {
    if (di('fidget_spinner')) ids.add('fidget_spinner');
    if (di('rubber_band_ball') && (G.weekCrunchCount || 0) > 0) ids.add('rubber_band_ball');
  }
  if (di('desk_fan')      && G.tox >= 50)   ids.add('desk_fan');
  if (di('stress_ball')   && G.wb  <  40)   ids.add('stress_ball');
  if (di('action_figure') && G.wb  <  50)   ids.add('action_figure');
  if (di('coffee_mug')    && G.firstCardThisWeek) ids.add('coffee_mug');
  if (di('paper_clip'))                      ids.add('paper_clip');
  if (di('cactus')        && G.tox >= 60)   ids.add('cactus');
  if (di('hourglass')     && G.plays === 1) ids.add('hourglass');
  if (di('golden_mug')    && ((G.totalPlayCount || 0) + 1) % 5 === 0) ids.add('golden_mug');
  if (di('org_chart'))                       ids.add('org_chart');
  return ids;
}

window._deskHover = function(cardUid) {
  if (!window.G) return;
  const card = (window.G.hand || []).find(c => c.uid === cardUid);
  if (!card) return;
  const ids = _getActivationsForHover(card, window.G.deskItems || [], window.G);
  document.querySelectorAll('.desk-slot[data-id]').forEach(el => {
    el.classList.toggle('will-activate', ids.has(el.dataset.id));
  });
};
window._deskUnhover = function() {
  document.querySelectorAll('.desk-slot.will-activate').forEach(el => el.classList.remove('will-activate'));
};

// ── Meeting type tooltip ──────────────────────────────
window._showMeetingTooltip = function(event, meetingId) {
  event.stopPropagation();
  document.querySelector('.meeting-tooltip')?.remove();

  const allMeetings = [...BASE_MEETINGS, ...SECRET_MEETINGS];
  const m = allMeetings.find(x => x.id === meetingId);
  if (!m) return;

  const color = MEETING_TIER_COLORS[m.tier] || '#888';
  const secretHtml = m.secret
    ? `<div class="mtt-secret">✦ SECRET — requires desk item</div>`
    : '';
  const bonusHtml = m.bonusDesc
    ? `<div class="mtt-bonus">${esc(m.bonusDesc)}</div>`
    : (m.desc ? `<div class="mtt-bonus">${esc(m.desc)}</div>` : '');

  const tt = document.createElement('div');
  tt.className = 'meeting-tooltip';
  tt.style.setProperty('--mc', color);
  tt.innerHTML = `
    <div class="mtt-header">
      <span class="mtt-icon">${m.icon}</span>
      <span class="mtt-name">${esc(m.name)}</span>
    </div>
    <div class="mtt-req">${esc(m.desc)}</div>
    ${bonusHtml}
    ${secretHtml}
    ${m.flavor ? `<div class="mtt-flavor">${esc(m.flavor)}</div>` : ''}
  `;
  document.body.appendChild(tt);

  const rect = event.currentTarget.getBoundingClientRect();
  const ttW = 200;
  let left = rect.left + rect.width / 2 - ttW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - ttW - 8));
  tt.style.left = left + 'px';
  tt.style.top  = (rect.top - 4) + 'px';
  tt.style.transform = 'translateY(-100%)';

  setTimeout(() => {
    document.addEventListener('click', () => document.querySelector('.meeting-tooltip')?.remove(), { once: true });
  }, 0);
};

// Step 1: card fly-off → then play (intercepted confirm handler)
window._animatedPlay = function() {
  const G = window.G;
  if (!G || G._busy || G.phase !== 'play' || !G.sel.length) return;
  // Fly off selected cards
  G.sel.forEach(uid => {
    const el = document.querySelector(`.card[data-uid="${uid}"]`);
    if (el) el.classList.add('card-fly-off');
  });
  // Step 2 (100ms): briefly highlight desk slots that will activate
  const selCards = G.sel.map(uid => (G.hand || []).find(c => c.uid === uid)).filter(Boolean);
  setTimeout(() => {
    const deskIds = new Set();
    selCards.forEach(card => _getActivationsForHover(card, G.deskItems || [], G).forEach(id => deskIds.add(id)));
    document.querySelectorAll('.desk-slot[data-id]').forEach(el => {
      if (deskIds.has(el.dataset.id)) {
        el.classList.add('will-activate');
        setTimeout(() => el.classList.remove('will-activate'), 300);
      }
    });
  }, 100);
  // After fly-off completes, trigger actual play
  setTimeout(() => G.playSelected(), 200);
};

// ═══════════════════════════════════════════════════════
//  NEW 3-COL LAYOUT HELPERS
// ═══════════════════════════════════════════════════════

// ── Meeting list groups (highest tier first = aspiration at top) ──
function renderMeetingList(G, activeMeetingId) {
  const deskIds = new Set((G.deskItems || []).map(d => d.id));

  // Filter trivial meetings, sort by tier descending (strongest first)
  const HIDDEN_MEETINGS = new Set(['quick_email', 'one_on_one']);
  const sorted = [...BASE_MEETINGS].filter(m => !HIDDEN_MEETINGS.has(m.id)).sort((a, b) => b.tier - a.tier);

  const baseHtml = sorted.map(m => {
    const isActive = activeMeetingId === m.id;
    const color = MEETING_TIER_COLORS[m.tier] || '#555';
    const activeCls = isActive ? ' lpm-active' : '';
    return `<div class="lpm-item${activeCls}" style="--mc:${color}">
      <span class="lpm-icon">${m.icon}</span>
      <span class="lpm-info">
        <span class="lpm-name">${esc(m.name)}</span>
        <span class="lpm-req">${esc(m.desc)}</span>
        <span class="lpm-bonus">${esc(m.bonusDesc || '')}</span>
      </span>
    </div>`;
  }).join('');

  // Secret meetings: show only if required desk item is present
  const unlockedSecrets = SECRET_MEETINGS.filter(sm => deskIds.has(sm.requires));
  const secretsHtml = unlockedSecrets.length ? `
    <div class="lpm-secret-divider">✦ UNLOCKED</div>
    ${unlockedSecrets.map(sm => {
      const isActive = activeMeetingId === sm.id;
      const activeCls = isActive ? ' lpm-active lpm-secret-active' : ' lpm-secret';
      return `<div class="lpm-item${activeCls}" style="--mc:#fbbf24">
        <span class="lpm-icon">${sm.icon}</span>
        <span class="lpm-info">
          <span class="lpm-name">${esc(sm.name)}</span>
          <span class="lpm-req">${esc(sm.desc)}</span>
          <span class="lpm-bonus">${esc(sm.bonusDesc || '')}</span>
        </span>
      </div>`;
    }).join('')}` : '';

  return `<div class="lpm-wrap">
    <div class="section-title">Meeting Types</div>
    ${baseHtml}
    ${secretsHtml}
  </div>`;
}

function renderLeftPanel(G, preview, selCards = []) {
  const {wb, tox, bo} = G;

  // Detect active meeting from current selection
  const activeMeeting = selCards.length
    ? detectMeeting(selCards, G.deskItems || [], { lastMeetingType: G.lastMeetingType || null })
    : null;

  // Stat bars
  const wbDanger  = wb  < 25  ? ' wb-danger'  : '';
  const toxDanger = tox > 80  ? ' tox-danger' : '';
  const statBars = `
    <div>
      <div class="section-title">Employee Status</div>
      <div class="lp-stat-bars">
        <div class="lp-sb-row${wbDanger}">
          <span class="lp-sb-label">Wellbeing</span>
          <div class="lp-sb-track"><div class="lp-sb-fill" style="width:${wb}%;background:var(--color-wellbeing);"></div></div>
          <span class="lp-sb-val" style="color:var(--color-wellbeing);">${wb}%</span>
        </div>
        <div class="lp-sb-row${toxDanger}">
          <span class="lp-sb-label">Toxicity</span>
          <div class="lp-sb-track"><div class="lp-sb-fill" style="width:${tox}%;background:var(--color-toxicity);"></div></div>
          <span class="lp-sb-val" style="color:var(--color-toxicity);">${tox}%</span>
        </div>
        <div class="lp-sb-row">
          <span class="lp-sb-label">Burnout</span>
          <div class="lp-sb-track"><div class="lp-sb-fill" style="width:${bo}%;background:var(--color-burnout);"></div></div>
          <span class="lp-sb-val" style="color:${bo > 0 ? 'var(--color-burnout)' : 'var(--color-text-muted)'};">${bo}%</span>
        </div>
      </div>
    </div>`;

  const tierInfo = tox >= 91 ? {lbl:'☣ MELTDOWN', color:'var(--color-fail)'}
                 : tox >= 61 ? {lbl:'⚡ TOXIC',   color:'var(--color-warning)'}
                 : tox >= 31 ? {lbl:'😶 PASSIVE-AGG', color:'var(--color-text-muted)'}
                 :              {lbl:'✅ PROFESSIONAL', color:'var(--color-pass)'};
  const tierBadge = `<div class="lp-tox-tier" style="color:${tierInfo.color};border-color:${tierInfo.color};">${tierInfo.lbl}</div>`;

  const meetingList = renderMeetingList(G, activeMeeting?.id || null);

  const recentLog = (G.log || []).slice(-5);
  const miniLog = recentLog.length ? `
    <div>
      <div class="section-title">Activity Log</div>
      <div class="mini-log">
        ${recentLog.map(e => `<div class="mini-log-entry ${e.cls||''}">${e.t}</div>`).join('')}
      </div>
    </div>` : '';

  return `<div class="left-panel">${statBars}${tierBadge}${meetingList}${miniLog}</div>`;
}

function renderFormulaRow(preview, wscore, target, G) {
  const hasP   = !!preview;
  const isResult = G.phase === 'result';

  // OUTPUT — always visible when cards selected (additive, no surprise)
  const chipsVal = hasP ? preview.chips.toLocaleString() : '—';
  const chipsCls = hasP ? 'f-val live chips' : 'f-val';

  // EFFICIENCY — visible (helps planning), REVENUE — hidden until scoring animation
  // In result phase, show actuals from accumulated wscore
  const multVal  = hasP ? preview.mult.toFixed(2) + '×' : '—';
  const scoreVal = isResult ? '$' + wscore.toLocaleString() : (hasP ? '?' : '$0');
  const multCls  = hasP ? 'f-val live mult' : 'f-val';
  const scoreCls = isResult ? (wscore >= target ? 'f-val live score win' : 'f-val live score') : (hasP ? 'f-val mystery' : 'f-val');

  const toxWarn = hasP && !isResult && preview.toxChecks > 0
    ? `<div class="f-warn">☣ up to −${preview.maxToxDmg} WB risk</div>` : '';

  let weekProgress;
  if (isResult) {
    weekProgress = wscore >= target
      ? `<div class="f-sub f-sub-pass">✓ cel osiągnięty</div>`
      : `<div class="f-sub f-sub-fail">✗ brakuje $${(target - wscore).toLocaleString()}</div>`;
  } else if (!hasP) {
    weekProgress = `<div class="f-sub f-sub-idle">wybierz karty</div>`;
  } else {
    weekProgress = `<div class="f-sub f-sub-idle">${preview.cards?.length || ''} kart — zatwierdź</div>`;
  }

  return `<div class="formula-row">
    <div class="f-slot">
      <div class="f-label">OUTPUT</div>
      <div class="${chipsCls}">${chipsVal}</div>
      <div class="f-sub">cards played</div>
    </div>
    <div class="f-op">×</div>
    <div class="f-slot">
      <div class="f-label">EFFICIENCY</div>
      <div class="${multCls}">${multVal}</div>
      <div class="f-sub">active bonus</div>
    </div>
    <div class="f-op">=</div>
    <div class="f-result">
      <div class="f-label">REVENUE</div>
      <div class="${scoreCls}" id="revenue-val">${scoreVal}</div>
      ${weekProgress}
      ${toxWarn}
    </div>
  </div>`;
}

// Meeting type rows: always-visible reference ladder (like poker hand list in Balatro)
const _MEETING_ROWS = [
  // PRODUCTION ladder
  [
    { id: 'quick_email',    req: '1 PROD' },
    { id: 'status_update',  req: '2 PROD' },
    { id: 'sprint_review',  req: '3 PROD' },
  ],
  // STRATEGY ladder
  [
    { id: 'one_on_one',       req: '1 STRAT' },
    { id: 'strategy_session', req: '2 STRAT' },
    { id: 'board_meeting',    req: '3 STRAT' },
  ],
  // Mixed + special
  [
    { id: 'cross_functional', req: 'PROD+STRAT' },
    { id: 'crunch_time',      req: 'CRUNCH' },
    { id: 'wellness_check',   req: 'RECOVERY' },
    { id: 'all_hands',        req: '3 arch' },
  ],
];

function renderMeetingBadge(selCards, G) {
  const ctx = { lastMeetingType: G.lastMeetingType || null };
  const deskItems = G.deskItems || [];
  const activeMeeting = selCards.length ? detectMeeting(selCards, deskItems, ctx) : null;
  const deskIds = new Set(deskItems.map(d => d.id));

  // Lookup map for fast access
  const meetingById = {};
  for (const m of BASE_MEETINGS) meetingById[m.id] = m;
  for (const m of SECRET_MEETINGS) meetingById[m.id] = m;

  // Build ladder rows
  const rowsHtml = _MEETING_ROWS.map(row => {
    const pills = row.map(({ id, req }) => {
      const m = meetingById[id];
      if (!m) return '';
      const isActive = activeMeeting?.id === id;
      const color = MEETING_TIER_COLORS[m.tier] || '#555';
      // Check if this meeting has a secret upgrade available
      const hasSecret = SECRET_MEETINGS.some(sm => sm.requires && deskIds.has(sm.requires) &&
        // Secret meeting for same base pattern
        (sm.id === 'agile_sprint' && id === 'sprint_review' ||
         sm.id === 'executive_brief' && id === 'board_meeting' ||
         sm.id === 'mental_health_day' && id === 'wellness_check' ||
         sm.id === 'death_march' && id === 'crunch_time'));
      return `<div class="mr-pill${isActive ? ' mr-pill-active' : ''}" style="--mc:${color}" onclick="window._showMeetingTooltip(event,'${id}')">
        <span class="mr-icon">${m.icon}</span>
        <span class="mr-name">${esc(m.name)}</span>
        <span class="mr-req">${req}</span>
        ${hasSecret ? `<span class="mr-secret-dot">✦</span>` : ''}
      </div>`;
    }).join('');
    return `<div class="mr-row">${pills}</div>`;
  }).join('');

  // If a secret meeting is active, show a special header instead
  let secretBanner = '';
  if (activeMeeting?.secret) {
    const hint = getMeetingUpgradeHint(activeMeeting, deskItems, ctx);
    secretBanner = `<div class="mr-secret-banner">
      <span>${activeMeeting.icon} ${esc(activeMeeting.name)}</span>
      <span class="meeting-secret-tag">SECRET</span>
      <span class="mr-secret-desc">${esc(activeMeeting.desc)}</span>
    </div>`;
  }

  // Near-miss hint when cards are selected but no secret
  let hintRow = '';
  if (activeMeeting && !activeMeeting.secret) {
    const hint = getMeetingUpgradeHint(activeMeeting, deskItems, ctx);
    if (hint) {
      hintRow = `<div class="mr-hint${hint.special ? ' mr-hint-special' : ''}">${esc(hint.text)}</div>`;
    }
  }

  return `<div class="meeting-ref">
    ${secretBanner}
    ${rowsHtml}
    ${hintRow}
  </div>`;
}

function renderActionBarNew(G, preview) {
  const {sel, plays, discs, phase, wscore} = G;
  const target = G.kpi();

  // Deck tracker
  const deckN = (G.deck || []).length;
  const pileN = (G.pile || []).length;
  const handN = (G.hand || []).length;
  const deckTracker = `<div class="deck-tracker">
    <div class="dt-item"><span class="dt-label">DECK</span><span style="color:var(--color-card-strategy);">${deckN}</span></div>
    <div class="dt-sep"></div>
    <div class="dt-item"><span class="dt-label">DISCARD</span><span style="color:var(--color-fail);">${pileN}</span></div>
    <div class="dt-sep"></div>
    <div class="dt-item"><span class="dt-label">HAND</span><span style="color:var(--color-text-primary);">${handN}</span></div>
  </div>`;

  if (phase === 'result') {
    const passed = wscore >= target;
    const bankBtn = G.plays > 0
      ? `<button class="btn-skip-new" onclick="G.bankRemainingPlays()">💰 BANK ${G.plays} PLAYS (+${G.plays * 4} CC)</button>`
      : '';
    const nextBtn = passed && G.week >= TOTAL_WEEKS
      ? `<button class="btn-confirm ready" onclick="G.openShop()">🏆 CLAIM VICTORY</button>`
      : `<button class="btn-confirm ready" onclick="G.openShop()">${passed ? '✓ PASSED — SHOP' : '✗ FAILED — SHOP'}</button>`;
    const skipBtn = `<button class="btn-skip-new" onclick="G.skipShop()" title="Skip Shop: +3 CC">⏭ SKIP (+3 CC)</button>`;
    const hintCls  = passed ? 'ok' : 'bad';
    const hintText = passed ? `PASS — $${wscore.toLocaleString()} / $${target.toLocaleString()}` : `FAIL — need $${(target-wscore).toLocaleString()} more`;
    return `<div class="action-bar-new">${deckTracker}<div class="action-hint ${hintCls}">${hintText}</div>${bankBtn}${skipBtn}${nextBtn}</div>`;
  }

  // Build confirm button
  let confirmBtn = '';
  let hintText = '';
  let hintCls  = '';
  if (!sel.length) {
    confirmBtn = `<button class="btn-confirm" disabled>Zatwierdź wybór</button>`;
    hintText = `Select 1–${G.maxSel()} cards to play`;
    hintCls  = '';
  } else if (plays <= 0) {
    confirmBtn = `<button class="btn-confirm" disabled>No plays left</button>`;
    hintText = 'No plays remaining';
    hintCls  = 'bad';
  } else if (preview) {
    const risk = preview.riskLevel;
    const mt   = preview.meetingType;
    const mtLabel = mt ? `${mt.icon} ${mt.name}` : `${sel.length} card${sel.length > 1 ? 's' : ''}`;
    if      (risk === 'LETHAL')  { confirmBtn = `<button class="btn-confirm danger"  onclick="_animatedPlay()">💀 DESPERATE MOVE</button>`; hintCls = 'bad'; }
    else if (risk === 'RISKY')   { confirmBtn = `<button class="btn-confirm risky"   onclick="_animatedPlay()">⚡ RISKY PLAY</button>`;      hintCls = 'warn'; }
    else if (risk === 'CAUTION') { confirmBtn = `<button class="btn-confirm caution" onclick="_animatedPlay()">▶ ${esc(mtLabel)}</button>`;  hintCls = 'warn'; }
    else                         { confirmBtn = `<button class="btn-confirm ready"   onclick="_animatedPlay()">▶ ${esc(mtLabel)}</button>`;  hintCls = ''; }
    hintText = mt ? `${mt.bonusDesc || mt.desc} · ${risk}` : `${sel.length} card${sel.length > 1 ? 's' : ''} selected · ${risk}`;
  } else {
    confirmBtn = `<button class="btn-confirm ready" onclick="_animatedPlay()">Zatwierdź (${sel.length} cards)</button>`;
    hintText = `${sel.length} card(s) selected`;
    hintCls  = '';
  }

  const discBtn = (phase === 'play' && discs > 0 && sel.length)
    ? `<button class="btn-skip-new" onclick="G.discardSelected()">✕ DISCARD [${discs}]</button>` : '';
  const crisisBanner = (plays === 1 && wscore < target && phase === 'play')
    ? `<span style="font-size:9px;color:var(--color-fail);font-family:var(--font-data);">⚡ LAST PLAY</span>` : '';

  return `<div class="action-bar-new">${deckTracker}<div class="action-hint ${hintCls}">${crisisBanner}${hintText}</div>${discBtn}${confirmBtn}</div>`;
}

function renderRightPanelNew(G) {
  // Teammate
  let tmHtml = `<div class="empty-slot-new">No teammate.<br>Assigned at week start.</div>`;
  if (G.teammate && TEAMMATES_DB[G.teammate]) {
    const tm = TEAMMATES_DB[G.teammate];
    const curTier = G.getTeammateTier ? G.getTeammateTier() : 1;
    const tierData = tm.tiers ? tm.tiers[curTier - 1] : null;
    const buffText    = tierData ? tierData.buffText : tm.buffText;
    const penaltyText = tierData ? tierData.penaltyText : tm.penaltyText;
    const tierColor   = curTier === 3 ? 'var(--color-fail)' : curTier === 2 ? 'var(--color-warning)' : 'var(--color-pass)';
    const nextTierTox = curTier === 1 ? 31 : curTier === 2 ? 81 : null;
    const tierHint    = nextTierTox ? ` <span style="font-size:7px;color:var(--color-text-muted);">(Tox ${nextTierTox}%→T${curTier+1})</span>` : '';
    const tierLabel   = tierData ? `<div class="tm-role-new" style="color:${tierColor};">T${curTier}: ${esc(tierData.name)}${tierHint}</div>` : '';
    const loyalty = G.consecutiveSameTeammate || 0;
    const loyaltyHtml = loyalty >= 3
      ? `<div class="tm-loyalty-new">🤝 ${loyalty >= 7 ? 'Unbreakable Bond' : loyalty >= 5 ? 'Deep Partnership' : 'Trusted Ally'} (${loyalty} wks)</div>`
      : '';
    const snitchHtml = G.pendingSnitch ? `<div style="font-size:9px;color:var(--color-fail);margin-top:4px;">⚠ HR SNITCH ACTIVE</div>` : '';
    const initials = tm.fullName.split(' ').map(w=>w[0]).join('').slice(0,2);
    tmHtml = `<div class="tm-card-new">
      <div class="tm-head">
        <div class="tm-avatar" style="color:${tm.color};border-color:${tm.color}">${initials}</div>
        <div>
          <div class="tm-name-new" style="color:${tm.color}">${esc(tm.fullName)}</div>
          ${tierLabel}
        </div>
      </div>
      <div class="tm-buff-new">▲ ${esc(buffText)}</div>
      <div class="tm-nerf-new">▼ ${esc(penaltyText)}</div>
      ${loyaltyHtml}${snitchHtml}
    </div>`;
  }

  // Perks
  const perksHtml = (G.passives || []).length
    ? (G.passives || []).map(p => {
        const icon = SHOP_DB[p.itemId]?.icon || '⚡';
        return `<div class="rp-perk-new">
          <span style="font-size:14px;flex-shrink:0">${icon}</span>
          <div><div class="rp-perk-name-new">${esc(p.name)}</div><div class="rp-perk-desc-new">${p.passiveType} ×${p.passiveVal}</div></div>
        </div>`;
      }).join('')
    : `<div class="empty-slot-new">No perks.<br>Buy in shop after each week.</div>`;

  // Build name + career forecast (compact)
  const pwr = getPowerRating(G);
  const s = calculateFinalScore(G);
  const tier = predictCareerTier(s.total);
  const pwrCls = pwr >= 120 ? 'var(--color-pass)' : pwr >= 80 ? 'var(--color-currency)' : pwr >= 50 ? 'var(--color-warning)' : 'var(--color-fail)';
  const buildInfo = `<div style="font-size:9px;font-family:var(--font-data);color:var(--color-text-muted);line-height:1.7">
    <span style="color:var(--color-text-primary);font-weight:bold">${esc(getBuildName(G))}</span><br>
    <span style="color:${tier.color}">T${tier.tier} ${esc(tier.title)}</span> &nbsp;·&nbsp;
    <span style="color:${pwrCls}">PWR ${pwr}%</span><br>
    <span style="color:var(--color-revenue)">${s.total.toLocaleString()} pts</span>
  </div>`;

  return `<div class="right-panel-outer">
    <div>
      <div class="section-title">Teammate</div>
      ${tmHtml}
    </div>
    <div>
      <div class="section-title">Perks</div>
      ${perksHtml}
    </div>
    <div>
      <div class="section-title">Build</div>
      ${buildInfo}
    </div>
    ${renderForecastPanel(G)}
  </div>`;
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
          <span class="hc-kpi-lbl">WEEKLY REVENUE TARGET</span>
          <span class="hc-kpi-nums${willPass ? ' pass' : ''}">$${wscore.toLocaleString()} / $${target.toLocaleString()}${willPass ? ' ✓ PASS' : ''}</span>
        </div>
        <div class="hc-kpi-bar">
          <div class="hc-kpi-fill ${willPass ? 'pass' : pct >= 80 ? 'near' : pct >= 50 ? 'mid' : 'low'}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
    <div class="hr">
      <div class="hr-row1">
        <span class="coins-row">💰 ${coins} CC</span>
        <div class="pips">${Array.from({length:(G.playsMax||PLAYS)}, (_, i) => `<div class="pip${i >= plays ? ' used' : ''}"></div>`).join('')}</div>
        <span class="disc-lbl">DISCARDS: ${discs}</span>
      </div>
      ${(() => {
        const pwr = getPowerRating(G);
        const liveSc = calculateFinalScore(G).total;
        const t = predictCareerTier(liveSc);
        const next = CAREER_DB[CAREER_DB.indexOf(t) - 1];
        const tip = next ? `${liveSc} pts → need ${next.min} for T${next.tier}` : `${liveSc} pts — MAX TIER`;
        const pwrCls = pwr >= 120 ? '#60ff80' : pwr >= 80 ? '#ffdd44' : pwr >= 50 ? '#ff9840' : '#ff5050';
        return `<div class="hr-row2" title="${tip}"><b>${getBuildName(G)}</b> · <span style="color:${t.color}">T${t.tier} ${esc(t.title)}</span> · <span style="color:${pwrCls}">PWR ${pwr}%</span></div>`;
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

  const tierInfo = tox >= 91 ? {cls:'tier-meltdown', lbl:'☣ MELTDOWN ZONE', tip:'Efficiency ×2 | 20% auto-exhaust'}
                 : tox >= 61 ? {cls:'tier-toxic',    lbl:'⚡ TOXIC CULTURE', tip:'+1 karta/play | -1 Discard/tydzień'}
                 : tox >= 31 ? {cls:'tier-passive',  lbl:'😶 PASSIVE-AGGRESSIVE', tip:'STRATEGY +0.2 Eff | -1 WB/karta'}
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
  const chipsVal  = hasP ? p.chips.toLocaleString() : '—';
  const multVal   = hasP ? p.mult + '×' : '—';
  const scoreVal  = hasP ? '???' : (wscore > 0 ? '$' + wscore.toLocaleString() : '—');
  const chipsCls  = hasP ? 'chips' : 'idle';
  const multCls   = hasP ? 'mult'  : 'idle';
  const scoreCls  = hasP ? 'score score-hidden' : (wscore > 0 ? 'score' : 'idle');
  const need = Math.max(0, target - wscore);
  const weekHtml = `<span class="sm-week"><b>$${wscore.toLocaleString()}</b> / $${target.toLocaleString()}${need > 0 ? ` · need <b>$${need.toLocaleString()}</b> more` : ' ✓'}</span>`;
  const toxWarn = hasP && p.toxChecks > 0
    ? `<span class="sm-tox-warn">☣ ${p.toxChecks} tox check${p.toxChecks > 1 ? 's' : ''} · est. −${p.expectedToxDmg} / worst −${p.maxToxDmg} HP</span>`
    : '';
  const wbWarn = hasP && p.effLabel
    ? `<span class="sm-wb-warn">${p.effLabel}</span>`
    : '';
  return `<div id="score-machine">
    <div class="sm-displays">
      <div class="sm-panel"><div class="sm-lbl">OUTPUT</div><div class="sm-display ${chipsCls}">${chipsVal}</div></div>
      <div class="sm-op">×</div>
      <div class="sm-panel"><div class="sm-lbl">EFFICIENCY</div><div class="sm-display ${multCls}">${multVal}</div></div>
      <div class="sm-op">=</div>
      <div class="sm-panel"><div class="sm-lbl">REVENUE</div><div class="sm-display ${scoreCls}">${scoreVal}</div></div>
    </div>
    <div class="sm-bottom">${weekHtml}${toxWarn}${wbWarn}</div>
  </div>`;
}

export function renderForecastPanel(G) {
  const s = calculateFinalScore(G);
  if (!G.weekHistory?.length && G.wscore === 0) return '';
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
    <details class="forecast-details">
      <summary class="rp-section-hdr forecast-summary">CAREER FORECAST ▸</summary>
      <div style="padding:4px 2px">
        <div class="rp-proj-stat"><span>Output</span><span>${s.chips.toLocaleString()}</span></div>
        <div class="rp-proj-stat"><span>Avg Eff</span><span>${s.avgMult}×</span></div>
        <div class="rp-proj-stat"><span>WB</span><span style="${col(s.wbPts)}">${sign(s.wbPts)}</span></div>
        <div class="rp-proj-stat"><span>BO</span><span style="${col(s.boPts)}">${sign(s.boPts)}</span></div>
        <div class="rp-proj-divider"></div>
        <div class="rp-proj-score">${s.total.toLocaleString()} pts</div>
        <div class="rp-proj-tier" style="color:${tier.color}">→ ${esc(tier.title)}</div>
        ${progressHtml}
        <div class="rp-proj-divider" style="margin-top:6px"></div>
        <div class="rp-section-hdr" style="margin-top:4px">ACHIEVEMENTS</div>
        ${achRows}
      </div>
    </details>`;
}

export function renderRightPanel(G) {
  // Perks from shop passives
  const perksHtml = (G.passives || []).length
    ? (G.passives || []).map(p => {
        const icon = SHOP_DB[p.itemId]?.icon || '⚡';
        return `<div class="rp-perk">
          <div class="rp-perk-icon">${icon}</div>
          <div><div class="rp-perk-name">${esc(p.name)}</div><div class="rp-perk-desc">${p.passiveType} ×${p.passiveVal}</div></div>
        </div>`;
      }).join('')
    : `<div class="rp-empty">No perks installed.</div>`;

  // Teammate
  let tmHtml = '<div class="rp-empty">No teammate assigned.</div>';
  if (G.teammate && TEAMMATES_DB[G.teammate]) {
    const tm = TEAMMATES_DB[G.teammate];
    const curTier = G.getTeammateTier ? G.getTeammateTier() : 1;
    const tierData = tm.tiers ? tm.tiers[curTier - 1] : null;
    const buffText = tierData ? tierData.buffText : tm.buffText;
    const penaltyText = tierData ? tierData.penaltyText : tm.penaltyText;
    const tierLabel = tierData ? `<div class="rp-tm-tier">T${curTier}: ${esc(tierData.name)}</div>` : '';
    const snitch = G.pendingSnitch ? `<div class="rp-snitch">⚠ HR SNITCH ACTIVE</div>` : '';
    const loyalty = G.consecutiveSameTeammate || 0;
    const loyaltyHtml = loyalty >= 7
      ? `<div class="rp-tm-loyalty bond">🤝 Unbreakable Bond (${loyalty} wks) +0.6 Eff/play</div>`
      : loyalty >= 5 ? `<div class="rp-tm-loyalty deep">🤝 Deep Partnership (${loyalty} wks) +0.4 Eff/play</div>`
      : loyalty >= 3 ? `<div class="rp-tm-loyalty">🤝 Trusted Ally (${loyalty} wks) +0.2 Eff/play</div>`
      : loyalty >= 2 ? `<div class="rp-tm-loyalty dim">⏳ ${loyalty} wks together</div>` : '';
    tmHtml = `<div class="rp-teammate">
      <span class="rp-tm-portrait" style="color:${tm.color}">${tm.portrait}</span>
      <div class="rp-tm-name" style="color:${tm.color}">${tm.fullName}</div>
      ${tierLabel}
      <div class="rp-tm-buff">▲ ${esc(buffText)}</div>
      <div class="rp-tm-penalty">▼ ${esc(penaltyText)}</div>
      ${loyaltyHtml}${snitch}
    </div>`;
  }

  // DESK — active desk items
  const deskItems = G.deskItems || [];
  const rarityColors = {COMMON:'#aaaaaa', UNCOMMON:'#50d8a0', RARE:'#7090ff', LEGENDARY:'#ffd700'};
  let deskHtml = `<div class="rp-section-hdr" style="margin-top:8px">DESK <span style="color:var(--dim);font-size:9px">(${deskItems.length}/4)</span></div>`;
  if (!deskItems.length) {
    deskHtml += `<div class="rp-empty" style="color:#888;font-size:10px;text-align:center;padding:10px 4px">No desk items yet.<br>Earn one by ending a week with WB ≥75%.</div>`;
  } else {
    deskHtml += `<div class="rp-desk-grid">${deskItems.map(d => {
      const col = rarityColors[d.rarity] || '#aaa';
      const isResig = d.id === 'resignation_letter';
      const usedBadge = isResig && G.resignationLetterUsed ? `<div class="rp-desk-used">USED</div>` : '';
      const activeBtn = isResig && !G.resignationLetterUsed && (G.phase === 'play' || G.phase === 'result')
        ? `<button class="rp-desk-use-btn" onclick="useResignationLetter()" title="${esc(d.desc)}">USE</button>` : '';
      return `<div class="rp-desk-item${isResig && G.resignationLetterUsed ? ' rp-desk-item-used' : ''}" title="${esc(d.name)}: ${esc(d.desc)}&#10;${esc(d.flavor)}">
        <div class="rp-desk-icon">${d.icon}</div>
        <div class="rp-desk-name" style="color:${col}">${esc(d.name)}</div>
        <div class="rp-desk-rarity" style="color:${col}">${d.rarity}</div>
        ${usedBadge}${activeBtn}
      </div>`;
    }).join('')}</div>`;
  }

  return `<div id="right-panel">
    <div class="rp-section-hdr">PERKS</div>${perksHtml}
    <div class="rp-section-hdr" style="margin-top:8px">TEAMMATE</div>${tmHtml}
    ${deskHtml}
    ${renderForecastPanel(G)}
  </div>`;
}

export function renderDeckPanel(G) {
  const deckCount = (G.deck || []).length;
  const pileCount = (G.pile || []).length;
  return `<div id="deck-panel">
    <div class="dp-hdr">DECK</div>
    <div class="dp-row"><span class="dp-lbl">REMAINING</span><span class="dp-val">${deckCount}</span></div>
    <div class="dp-row"><span class="dp-lbl">PILE</span><span class="dp-val">${pileCount}</span></div>
  </div>`;
}

export function renderHand(hand, sel, preview, exhausted, passives, G) {
  const ms    = G ? G.maxSel() : MAX_SEL;
  const maxed = sel.length >= ms;
  const riskColors = {SAFE:'#50ff78', CAUTION:'#ffcc44', RISKY:'#ff8040', LETHAL:'#ff2020'};
  const riskHint   = preview
    ? `<span class="hdr-risk" style="color:${riskColors[preview.riskLevel]}">${preview.riskLevel}</span>`
    : `<span style="color:var(--dim)">select 1–${ms} cards</span>`;
  const ctx = {target:G ? G.kpi() : 0, wscore:G ? G.wscore : 0, crunchCount: G ? G.weekCrunchCount : 0};
  return `<div id="hand-wrap">
    <div id="hand-hdr"><span>HAND (${hand.length}) · ${sel.length ? `${sel.length}/${ms} selected` : `pick 1–${ms}`}</span>${riskHint}</div>
    <div id="hand" class="${maxed ? 'hand-maxed' : ''}">
      ${hand.map(c => renderCard(c, sel, preview, passives, ctx)).join('')}
    </div>
  </div>`;
}

export function renderCard(c, sel, preview, passives, ctx = {}) {
  const idx = sel.indexOf(c.uid), isSel = idx >= 0;
  const isDisabled = !isSel && ctx.maxSel > 0 && sel.length >= ctx.maxSel;
  const isSynActive = preview && c.synergies.some(s => preview.activeSynergies.has(s.id));
  const fx = getEffectiveFx(c, passives || []);

  const archConfig = {
    PRODUCTION: {icon:'⬡', label:'Production', color:'var(--color-card-production)'},
    STRATEGY:   {icon:'◆', label:'Strategy',   color:'var(--color-card-strategy)'},
    CRUNCH:     {icon:'⚡', label:'Crunch',     color:'var(--color-card-crunch)'},
    RECOVERY:   {icon:'◈', label:'Recovery',   color:'var(--color-card-recovery)'},
  };
  const arch = archConfig[c.archetype] || {icon:'■', label:c.archetype, color:'var(--color-text-primary)'};

  // Main effect line
  let mainHtml = '';
  if (fx.chips && fx.mult) {
    mainHtml = `<div class="c-main" style="color:var(--color-revenue);">+${fx.chips.toLocaleString()} Output</div>
    <div class="c-cost" style="color:var(--color-card-strategy);">×${fx.mult.toFixed(2)} Efficiency</div>`;
  } else if (fx.chips) {
    mainHtml = `<div class="c-main" style="color:var(--color-revenue);">+${fx.chips.toLocaleString()} Output</div>`;
  } else if (fx.mult) {
    mainHtml = `<div class="c-main" style="color:var(--color-card-strategy);">×${fx.mult.toFixed(2)} Efficiency</div>`;
  } else {
    mainHtml = `<div class="c-main" style="color:var(--color-text-ghost);">—</div>`;
  }

  // Side effects
  const sides = [];
  if (fx.tox > 0) sides.push(`+${fx.tox}% <span style="color:var(--color-warning)">Toxicity</span>`);
  if (fx.wb  < 0) sides.push(`${fx.wb} <span style="color:var(--color-fail)">Wellbeing</span>`);
  if (fx.tox < 0) sides.push(`${fx.tox}% <span style="color:var(--color-pass)">Toxicity</span>`);
  if (fx.wb  > 0) sides.push(`+${fx.wb} <span style="color:var(--color-pass)">Wellbeing</span>`);
  const costHtml = sides.length ? `<div class="c-cost" style="color:var(--color-text-muted);font-size:10px;">${sides.join(' · ')}</div>` : '';

  // Synergies — full text, no truncation
  const synsHtml = c.synergies.map(s => {
    const active = preview && preview.activeSynergies.has(s.id);
    return `<div class="c-passive${active ? ' syn-active' : ''}"><em>${active ? '⚡' : '★'}</em> ${esc(s.desc)}</div>`;
  }).join('');

  // Exhaust
  const exhaustHtml = c.exhaust ? `<div class="c-exhaust">⊗ EXHAUST</div>` : '';

  // Crunch fatigue
  const crunchWarn = (c.archetype === 'CRUNCH' && ctx.crunchCount > 0)
    ? `<div class="c-crunch-warn">⚠ +${ctx.crunchCount * 12}% Fatigue</div>` : '';

  // Footer: play progress
  const cardLevel = c.level || 0;
  const playCount = c.playCount || 0;
  const footerText = cardLevel >= 3 ? `${playCount} plays · MAX` : `${playCount % 5}/5 ► Lv${cardLevel + 1}`;

  const upgCount = c.upgrades || 0;
  const upgCls = upgCount >= 3 ? ' card-up3' : upgCount === 2 ? ' card-up2' : upgCount >= 1 ? ' card-up1' : '';

  // combo position hint
  const comboPosHtml = (isSel && preview)
    ? `<div style="font-size:8px;color:var(--color-text-ghost);margin-top:2px">${['1st','2nd','3rd','4th'][idx]} in combo</div>`
    : '';

  return `<div class="card new-card ${c.archetype}${isSel ? ' selected' : ''}${isDisabled ? ' card-disabled' : ''}${isSynActive ? ' syn-active' : ''}${cardLevel > 0 ? ` card-lv${cardLevel}` : ''}${upgCls}" data-uid="${c.uid}" onclick="${isDisabled ? '' : `G.toggle('${c.uid}')`}" onmouseenter="_deskHover('${c.uid}')" onmouseleave="_deskUnhover()">
    <div class="c-type" style="color:${arch.color};">${arch.icon} ${arch.label}</div>
    <div class="c-name">${esc(c.name)}</div>
    ${mainHtml}${costHtml}
    ${synsHtml ? `<div class="c-divider"></div>${synsHtml}` : ''}
    ${exhaustHtml}
    <div class="c-footer">
      <span class="c-uses">${footerText}</span>
      ${crunchWarn}
    </div>
    ${comboPosHtml}
    <div class="sel-mark">${isSel ? (idx + 1) : ''}</div>
  </div>`;
}

const DAY_NAMES = ['MON','TUE','WED','THU','FRI'];

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
    const scoreStr = '+$' + score.toLocaleString();
    if      (riskLevel === 'LETHAL')  playBtn = `<button class="btn btn-lethal"  onclick="G.playSelected()">💀 DESPERATE MOVE (${scoreStr}${pm})</button>`;
    else if (riskLevel === 'RISKY')   playBtn = `<button class="btn btn-risky"   onclick="G.playSelected()">⚡ RISKY PLAY (${scoreStr}${pm})</button>`;
    else if (riskLevel === 'CAUTION') playBtn = `<button class="btn btn-caution" onclick="G.playSelected()">⚠ CAUTIOUS PLAY (${scoreStr}${pm})</button>`;
    else                              playBtn = `<button class="btn btn-safe"    onclick="G.playSelected()">✓ SUBMIT WORK (${scoreStr}${pm})</button>`;
  }
  const ms = G.maxSel ? G.maxSel() : MAX_SEL;
  const discBtn = phase === 'play'
    ? `<button class="btn btn-disc" ${discs <= 0 || !sel.length ? 'disabled' : ''} onclick="G.discardSelected()">✕ DISCARD +10/card [${discs}]</button>`
    : '';
  const crisisBanner = (plays === 1 && wscore < target && phase === 'play')
    ? `<div class="crisis-banner">⚡ LAST PLAY — need $${(target - wscore).toLocaleString()} more revenue</div>` : '';
  const toxRiskLine = (preview && preview.toxChecks > 0 && phase === 'play')
    ? `<div class="play-tox-risk">☣ ${preview.toxChecks} tox check${preview.toxChecks > 1 ? 's' : ''} · est. −${preview.expectedToxDmg} WB · worst −${preview.maxToxDmg} WB</div>` : '';
  return `<div id="actions">${crisisBanner}${bankBtn}${playBtn}${toxRiskLine}<div style="display:flex;gap:6px">${discBtn}</div></div>`;
}

export function renderLog(log, preview) {
  const riskColors = {SAFE:'#50ff78', CAUTION:'#ffdd44', RISKY:'#ff8040', LETHAL:'#ff2020'};

  if (preview?.log?.length > 0) {
    const col  = riskColors[preview.riskLevel];
    const wbStr = preview.wbDelta  !== 0 ? ` | WB ${preview.wbDelta  > 0 ? '+' : ''}${preview.wbDelta}%`  : '';
    const tStr  = preview.toxDelta !== 0 ? ` | TOX ${preview.toxDelta > 0 ? '+' : ''}${preview.toxDelta}%` : '';
    const bStr  = preview.boDelta  !== 0 ? ` | BO +${preview.boDelta}%` : '';
    const rStr  = preview.toxChecks > 0  ? ` | ☣ up to -${preview.maxToxDmg} HP risk` : '';
    const sumLine = `<div class="ll preview" style="color:${col}">↓ [${preview.riskLevel}] +$${preview.score.toLocaleString()} Revenue${wbStr}${tStr}${bStr}${rStr}</div>`;
    const breakdownHtml = preview.log.reduce((acc, e, i, arr) => {
      acc += `<div class="ll ${e.cls}">${esc(e.t)}</div>`;
      if (e.cls === 'sc' && i < arr.length - 1) acc += `<div class="ll-sep"></div>`;
      return acc;
    }, '');
    return `<div id="log-wrap">
      <div id="log-hdr">📊 BREAKDOWN</div>
      <div id="log-body">${breakdownHtml}${sumLine}</div>
    </div>`;
  }

  let previewLine = '';
  if (preview) {
    const col  = riskColors[preview.riskLevel];
    const wbStr = preview.wbDelta  !== 0 ? ` | WB ${preview.wbDelta  > 0 ? '+' : ''}${preview.wbDelta}%`  : '';
    const tStr  = preview.toxDelta !== 0 ? ` | TOX ${preview.toxDelta > 0 ? '+' : ''}${preview.toxDelta}%` : '';
    const bStr  = preview.boDelta  !== 0 ? ` | BO +${preview.boDelta}%` : '';
    const rStr  = preview.toxChecks > 0  ? ` | ☣ up to -${preview.maxToxDmg} HP risk` : '';
    previewLine = `<div class="ll preview" style="color:${col}">↓ [${preview.riskLevel}] +$${preview.score.toLocaleString()} Revenue${wbStr}${tStr}${bStr}${rStr}</div>`;
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
    <button class="oc-sort-btn${sortKey==='chips'?' oc-sort-active':''}" onclick="G.setOverlaySort('chips')">Output ↓</button>
    <button class="oc-sort-btn${sortKey==='mult'?' oc-sort-active':''}" onclick="G.setOverlaySort('mult')">Eff ↓</button>
  </div>`;
  const cardsHtml = sorted.map(c => {
    const lvl   = c.level || 0;
    const upg     = c.upgrades || 0;
    const upgCls  = upg >= 3 ? ' card-up3' : upg === 2 ? ' card-up2' : upg >= 1 ? ' card-up1' : '';
    const upgBadge = upg > 0 ? `<span class="oc-up-badge${upg >= 3 ? ' up3' : upg === 2 ? ' up2' : ''}">&#8679; ×${upg} UPG</span>` : '';
    const lvlBadge = lvl > 0 ? `<span class="oc-lv-badge lv${lvl}">LV${lvl}</span>` : '';
    const stars = lvl > 0 ? `<span class="oc-stars">${'★'.repeat(lvl)}</span>` : '';
    const fxParts = [
      c.fx.chips > 0 ? `<span class="oc-fx-chip">🔵 ${c.fx.chips.toLocaleString()} Output</span>` : '',
      c.fx.mult  > 0 ? `<span class="oc-fx-mult">🔴 ×${c.fx.mult.toFixed(2)} Eff</span>` : '',
      c.fx.tox   > 0 ? `<span class="oc-fx-tox">☣ +${c.fx.tox}% Tox</span>` : '',
      c.fx.tox   < 0 ? `<span class="oc-fx-toxg">☣ ${c.fx.tox}% Tox</span>` : '',
      c.fx.wb    > 0 ? `<span class="oc-fx-wb">❤ +${c.fx.wb} WB</span>` : '',
      c.fx.wb    < 0 ? `<span class="oc-fx-wbn">❤ ${c.fx.wb} WB</span>` : '',
    ].filter(Boolean).join(' ');
    const upgradePreview = mode === 'upgrade'
      ? `<div class="oc-upgrade-preview">
          <span class="oc-fx-chip">🔵 ${(c.fx.chips||0)+80}</span>
          <span class="oc-fx-mult">🔴 ×${((c.fx.mult||0)+0.3).toFixed(2)}</span>
          <span class="oc-upgrade-delta">↑ +80 Output / +0.3 Eff</span>
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
      ? `<div class="tmc-loyalty bond">🤝 Unbreakable Bond (${streak} wks) — +0.6 Eff/play</div>`
      : streak >= 5
      ? `<div class="tmc-loyalty deep">🤝 Deep Partnership (${streak} wks) — +0.4 Eff/play</div>`
      : streak >= 3
      ? `<div class="tmc-loyalty">🤝 Trusted Ally (${streak} wks) — +0.2 Eff/play</div>`
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
      garyPreview = `<div class="tmc-gary-preview">≈ +${bonus} Eff @ ${G.tox}% TOX now</div>`;
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



export function renderTargetedDraw(G) {
  const cardsHtml = (G.targetedDrawOptions || []).map(c => {
    const fxLines = [
      c.fx.chips   ? `🔵 +${c.fx.chips} Output` : '',
      c.fx.mult    ? `🔴 +${c.fx.mult}× Eff`   : '',
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

export function renderScoring(G) {
  const d = G.scoringDisplay;
  if (!d) return '';

  const wscore = d.prevWscore; // show OLD score during animation — suspense!
  const target = G.kpi();

  const cardBadges = (d.playedCards || []).map(c =>
    `<span class="sc-card-badge sc-cb-${(c.archetype||'').toLowerCase()}">${esc(c.name)}</span>`
  ).join('');

  const deltas = [
    d.wbDelta < 0 ? `<span class="sc-delta sc-d-bad">❤ ${d.wbDelta} WB</span>` : '',
    d.wbDelta > 0 ? `<span class="sc-delta sc-d-good">❤ +${d.wbDelta} WB</span>` : '',
    d.toxDelta > 0 ? `<span class="sc-delta sc-d-bad">☣ +${d.toxDelta}% TOX</span>` : '',
    d.toxDelta < 0 ? `<span class="sc-delta sc-d-good">☣ ${d.toxDelta}% TOX</span>` : '',
    d.boDelta  > 0 ? `<span class="sc-delta sc-d-bad">🔥 +${d.boDelta}% BO</span>` : '',
  ].filter(Boolean).join('');

  const comboRow = d.comboMult > 1 ? `
    <div class="sc-combo-row" id="sc-combo-row">
      <span class="sc-combo-mult">×${fmt1(d.comboMult)} COMBO</span>
      <span class="sc-combo-arrow">→</span>
      <span class="sc-combo-total" id="sc-combo-total">0</span>
    </div>` : '';

  const leds = ['#6ab4ff','#ff7070','#50ffaa','#ff80c8','#ffdd44','#ff8800','#7070ff','#80ffcc'];
  const ledHtml = leds.map(c => `<div class="sm-led" style="background:${c};color:${c}"></div>`).join('');

  // The scoring machine replaces the score machine in-place.
  // #sc-screen = click-to-skip target. #score-machine = shake animation target.
  const scoringMachine = `
    <div id="sc-screen" class="sm-scoring-mode">
      <div id="score-machine">
        <div class="sm-led-strip">${ledHtml}</div>
        <div class="sc-cards-row">${cardBadges}</div>
        <div class="sm-displays">
          <div class="sm-panel">
            <div class="sm-lbl">OUTPUT</div>
            <div class="sm-display sc-chips-color" id="sc-chips-val">0</div>
          </div>
          <div class="sm-op sc-f-op" id="sc-op-x">×</div>
          <div class="sm-panel" id="sc-mult-block">
            <div class="sm-lbl">EFFICIENCY</div>
            <div class="sm-display sc-mult-color" id="sc-mult-val">?</div>
          </div>
          <div class="sm-op sc-f-op" id="sc-op-eq">=</div>
          <div class="sm-panel" id="sc-score-block">
            <div class="sm-lbl">REVENUE</div>
            <div class="sm-display sc-score-color" id="sc-score-val">?</div>
          </div>
        </div>
        ${comboRow}
        <div class="sm-bottom">
          <div class="sc-deltas">${deltas}</div>
          <span class="sm-week"><b>${wscore}</b> / ${target}</span>
        </div>
        <div class="sc-hint" id="sc-hint">click to continue</div>
      </div>
    </div>`;

  // Build manager email — only when passing or out of plays
  const showEmail = shouldShowEmail(G, d);
  const email = showEmail ? buildManagerEmail(G, d) : null;
  const emailHtml = email ? `
    <div id="manager-email" class="mgr-email">
      <div class="mgr-titlebar">
        <span class="mgr-titlebar-icon">✉</span>
        <span class="mgr-titlebar-text">Outlook — New Message</span>
        <span class="mgr-titlebar-close" onclick="_dismissManagerEmail(event)">✕</span>
      </div>
      <div class="mgr-headers">
        <div class="mgr-hrow"><span class="mgr-hlbl">From:</span><span class="mgr-hval">${esc(email.mgr.name)} &lt;${esc(email.mgr.email)}&gt;</span></div>
        <div class="mgr-hrow"><span class="mgr-hlbl">To:</span><span class="mgr-hval">you@deadline-corp.com</span></div>
        <div class="mgr-hrow"><span class="mgr-hlbl">Date:</span><span class="mgr-hval">${email.dayName}, Week ${G.week}</span></div>
        <div class="mgr-hrow mgr-subj-row"><span class="mgr-hlbl">Subject:</span><span class="mgr-hval mgr-subj ${email.passed ? '' : 'mgr-tier-fail'}">${esc(email.subject)}</span></div>
      </div>
      <div class="mgr-sep"></div>
      <div class="mgr-body">
        <p>${esc(email.body)}</p>
        ${email.ps ? `<p class="mgr-ps">${esc(email.ps)}</p>` : ''}
        <p class="mgr-sign">— ${esc(email.mgr.name)}<br><span class="mgr-title">${esc(email.mgr.title)}</span></p>
      </div>
    </div>` : '';

  // Scoring uses a centered layout (no 3-col — scoring machine takes center stage)
  return `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;padding:20px;position:relative">
    ${scoringMachine}
    ${emailHtml}
  </div>`;
}

export function renderUpgradeResult(G) {
  const card = G.upgradeResultCard;
  const from = G.upgradeResultFrom || { chips: 0, mult: 0 };
  if (!card) { G.dismissUpgradeResult(); return ''; }

  // ── PHASE 1: slot machine spinning ─────────────────────
  if (G.upgradeSpinning) {
    const probBars = UPGRADE_TIERS.map(t => `
      <div class="upgr-prob-item">
        <div class="upgr-prob-bar" style="height:${Math.round(t.weight * 1.6)}px;background:${t.color}"></div>
        <div class="upgr-prob-pct" style="color:${t.color}">${t.weight}%</div>
        <div class="upgr-prob-name">${t.label}</div>
      </div>`).join('');
    return `<div class="upgr-screen">
      <div class="upgr-title">⬆ PERFORMANCE UPGRADE</div>
      <div class="upgr-subtitle">Rolling outcome...</div>
      <div class="upgr-slot-wrap">
        <div class="upgr-slot-box">
          <div class="upgr-slot-scanline"></div>
          <div id="upgr-slot-display" class="upgr-slot-display">???</div>
        </div>
        <div class="upgr-prob-strip">${probBars}</div>
      </div>
    </div>`;
  }

  // ── PHASE 2: reveal result ──────────────────────────────
  const tier     = G.upgradeResultTier || UPGRADE_TIERS[0];
  const upg      = card.upgrades || 0;
  const upgCls   = upg >= 3 ? ' card-up3' : upg === 2 ? ' card-up2' : upg >= 1 ? ' card-up1' : '';
  const archGlow = { PRODUCTION:'#3878cc', STRATEGY:'#be2828', CRUNCH:'#a02000', RECOVERY:'#1e8028' };
  const glow     = archGlow[card.archetype] || '#556';
  const newChips = card.fx.chips || 0;
  const newMult  = card.fx.mult  || 0;

  return `<div class="upgr-screen upgr-reveal">
    <div class="upgr-tier-badge" style="color:${tier.color};border-color:${tier.color}">${tier.label}</div>
    <div class="upgr-tier-msg" style="color:${tier.color}">${tier.msg}</div>
    <div class="upgr-card-wrap">
      <div class="upgr-glow" style="--glow-col:${glow}"></div>
      <div class="oc-card ${card.archetype}${upgCls} upgr-card">
        <div class="oc-top">
          <span class="oc-arch">${card.archetype}</span>
          <span class="oc-rarity">${card.rarity || ''}</span>
        </div>
        ${upg > 0 ? `<span class="oc-up-badge${upg >= 3 ? ' up3' : upg === 2 ? ' up2' : ''}">&#8679; ×${upg} UPG</span>` : ''}
        <div class="oc-name">${esc(card.name)}</div>
        ${card.flavor ? `<div class="oc-flavor">"${esc(card.flavor)}"</div>` : ''}
        <div class="oc-fx-row">
          ${newChips > 0 ? `<span class="oc-fx-chip">🔵 ${newChips} Output</span>` : ''}
          ${newMult  > 0 ? `<span class="oc-fx-mult">🔴 ×${newMult.toFixed(2)} Eff</span>` : ''}
        </div>
      </div>
    </div>
    <div class="upgr-compare">
      <div class="upgr-cmp-row">
        <span class="upgr-cmp-label">Output</span>
        <span class="upgr-cmp-before">${from.chips}</span>
        <span class="upgr-cmp-arrow">→</span>
        <span class="upgr-cmp-after upgr-cmp-chips">${newChips}</span>
        <span class="upgr-cmp-delta" style="color:${tier.color};border-color:${tier.color}60">+${tier.chips}</span>
      </div>
      <div class="upgr-cmp-row">
        <span class="upgr-cmp-label">Efficiency</span>
        <span class="upgr-cmp-before">×${from.mult.toFixed(2)}</span>
        <span class="upgr-cmp-arrow">→</span>
        <span class="upgr-cmp-after upgr-cmp-mult">×${newMult.toFixed(2)}</span>
        <span class="upgr-cmp-delta" style="color:${tier.color};border-color:${tier.color}60">+${tier.mult}</span>
      </div>
    </div>
    <button class="upgr-continue-btn" onclick="G.dismissUpgradeResult()">▶ CONTINUE TO SHOP</button>
  </div>`;
}

export function renderDeskItemOffer(G) {
  const offer = G.deskItemOffer || [];
  const rarityColors = {COMMON:'#aaaaaa', UNCOMMON:'#50d8a0', RARE:'#7090ff', LEGENDARY:'#ffd700'};
  const rarityOrder  = {COMMON:0, UNCOMMON:1, RARE:2, LEGENDARY:3};
  const source = G._deskOfferSource || 'Wellness Reward';
  const cardsHtml = offer.map(d => {
    const col = rarityColors[d.rarity] || '#aaa';
    const isActive = d.active ? `<div class="desk-offer-active">[ACTIVE ITEM]</div>` : '';
    return `<div class="desk-offer-card" onclick="claimDeskItem('${d.id}')">
      <div class="desk-offer-rarity" style="color:${col}">${d.rarity}</div>
      <div class="desk-offer-icon">${d.icon}</div>
      <div class="desk-offer-name" style="color:${col}">${esc(d.name)}</div>
      ${isActive}
      <div class="desk-offer-desc">${esc(d.desc)}</div>
      <div class="desk-offer-flavor">"${esc(d.flavor)}"</div>
      <button class="desk-offer-btn">＋ Place on Desk</button>
    </div>`;
  }).join('');
  const currentDesk = (G.deskItems || []).map(d => {
    const col = rarityColors[d.rarity] || '#aaa';
    return `<span class="desk-cur-item" title="${esc(d.desc)}">${d.icon} <span style="color:${col}">${esc(d.name)}</span></span>`;
  }).join('');
  const deskStatus = `<div class="desk-offer-current">CURRENT DESK (${(G.deskItems||[]).length}/4): ${currentDesk || '<span style="color:var(--dim)">empty</span>'}</div>`;
  return `<div class="draft-screen">
    <div class="dr-header">
      <div class="dr-title">🗂️ DESK ITEM — ${esc(source)}</div>
      <div class="dr-sub">Choose 1 item to place on your desk. Active effects last until the run ends.</div>
      ${deskStatus}
    </div>
    <div class="desk-offer-grid">${cardsHtml}</div>
    <div class="dr-skip-row">
      <button class="dr-skip-btn" onclick="skipDeskOffer()">✕ Skip — keep desk lean</button>
    </div>
  </div>`;
}

export function renderInbox(G) {
  const emails = G.inbox || [];
  const sel = emails[G.inboxSelected || 0];

  const listHtml = emails.length === 0
    ? `<div class="ibx-empty">No messages.</div>`
    : emails.map((e, i) => {
        const active = i === (G.inboxSelected || 0);
        const unread = e.unread;
        return `<div class="ibx-row${active ? ' ibx-row-active' : ''}${unread ? ' ibx-row-unread' : ''}" onclick="G.selectInboxEmail(${i})">
          <div class="ibx-row-from">${esc(e.mgr.name)}</div>
          <div class="ibx-row-subj">${esc(e.subject)}</div>
          <div class="ibx-row-meta">Week ${e.storedWeek} · ${esc(e.dayName)}</div>
        </div>`;
      }).join('');

  const previewHtml = sel ? `
    <div class="ibx-msg-header">
      <div class="ibx-msg-field"><span class="ibx-msg-lbl">From:</span> ${esc(sel.mgr.name)} &lt;${esc(sel.mgr.email)}&gt;</div>
      <div class="ibx-msg-field"><span class="ibx-msg-lbl">To:</span> employee@deadline-corp.com</div>
      <div class="ibx-msg-field"><span class="ibx-msg-lbl">Subject:</span> ${esc(sel.subject)}</div>
      <div class="ibx-msg-field"><span class="ibx-msg-lbl">Date:</span> ${esc(sel.dayName)}, Week ${sel.storedWeek}</div>
    </div>
    <div class="ibx-msg-body">
      <p>${esc(sel.body)}</p>
      ${sel.ps ? `<p class="ibx-msg-ps">${esc(sel.ps)}</p>` : ''}
    </div>
    <div class="ibx-msg-sig">
      <div class="ibx-sig-name">${esc(sel.mgr.name)}</div>
      <div class="ibx-sig-title">${esc(sel.mgr.title)}</div>
      <div class="ibx-sig-email">${esc(sel.mgr.email)}</div>
    </div>
  ` : `<div class="ibx-empty">Select a message to read.</div>`;

  return `<div class="ibx-screen">
    <div class="ibx-titlebar">
      <div class="ibx-title">📬 DEADLINE Corp — Internal Mail</div>
      <button class="ibx-close-btn" onclick="G.closeInbox()">✕ Close</button>
    </div>
    <div class="ibx-layout">
      <div class="ibx-list">${listHtml}</div>
      <div class="ibx-preview">${previewHtml}</div>
    </div>
  </div>`;
}

export function renderShop(G) {
  // ── Pending overlays (same as before) ──
  if (G.pendingUpgrade) {
    const allCards = [...G.deck, ...G.pile];
    return `<div class="draft-screen">
      <div class="dr-header">
        <div class="dr-title">⬆️ PERFORMANCE UPGRADE</div>
        <div class="dr-sub">Choose a card to permanently upgrade — +80 Output &amp; +0.3 Eff added to base stats</div>
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
  if (G.deskItemOffer && G.deskItemOffer.length) {
    return renderDeskItemOffer(G);
  }
  if (G.openedPack) {
    return renderPackReveal(G);
  }
  return renderPackShop(G);
}

export function renderPackReveal(G) {
  const pack = PACK_DB[G.openedPack.packId];
  const items = G.openedPack.items;
  const rarityColors = { COMMON:'#aaaaaa', UNCOMMON:'#50d8a0', RARE:'#7090ff', LEGENDARY:'#ffd700' };
  const archColors = { PRODUCTION:'#6ab4ff', STRATEGY:'#ff9090', CRUNCH:'#ff6030', RECOVERY:'#60ff80' };

  const slots = items.map((item, i) => {
    const isNeg = item.negative;
    const rc = rarityColors[item.rarity] || '#aaaaaa';
    const negBadge = isNeg ? `<div class="ps-neg-badge">⚠ NEGATIVE</div>` : '';
    const archBadge = item.archetype ? `<div class="ps-arch" style="color:${archColors[item.archetype]||'#aaa'}">${item.archetype}</div>` : '';
    const flavorHtml = item.flavor ? `<div class="ps-flavor">"${esc(item.flavor)}"</div>` : '';
    return `<div class="pack-slot pack-slot-spinning${isNeg ? ' pack-slot-neg' : ''}" id="pack-slot-${i}" style="--pack-color:${pack.color}">
      <div class="ps-spin-face"><span class="ps-spin-icon">${pack.icon}</span></div>
      <div class="ps-content">
        ${negBadge}
        <div class="ps-rarity" style="color:${rc}">${item.rarity || item.type}</div>
        ${archBadge}
        <div class="ps-icon">${item.icon}</div>
        <div class="ps-name">${esc(item.name)}</div>
        <div class="ps-desc">${esc(item.desc)}</div>
        ${flavorHtml}
        <button class="ps-pick-btn" disabled onclick="G.claimPackItem(${i})">
          ${isNeg ? '⚠ ACCEPT' : '✓ PICK THIS'}
        </button>
      </div>
    </div>`;
  }).join('');

  return `<div class="pack-reveal-screen" id="pack-reveal-root">
    <div class="pr-header">
      <span class="pr-pack-icon">${pack.icon}</span>
      <span class="pr-pack-name">${esc(pack.name)}</span>
      <span class="pr-instruction">— CHOOSE ONE —</span>
    </div>
    <div class="pr-slots">${slots}</div>
    <div class="pr-skip-row">
      <button class="dr-skip-btn" onclick="G.skipPackItem()">✗ Take nothing</button>
    </div>
  </div>`;
}

export function renderPackShop(G) {
  const { week, coins, wscore, passives } = G;
  const passed = wscore >= G.kpi();
  const wbColor  = G.wb  >= 70 ? '#70ff78' : G.wb  >= 40 ? '#ffdd44' : '#ff7070';
  const toxColor = G.tox >= 70 ? '#ff7070' : G.tox >= 40 ? '#ffdd44' : '#70ff78';
  const boColor  = G.bo  >= 90 ? '#ff2020' : G.bo  >= 70 ? '#ff8040' : G.bo >= 50 ? '#ffdd44' : '#808080';

  // Packs grid — all 3 always available
  const packsHtml = (G.shopPackIds || []).map(id => PACK_DB[id]).filter(Boolean).map(pack => {
    const canAfford = coins >= pack.cost;
    const poolDesc = {
      standard:   'Consumables + Common Desk Items',
      talent_acq: 'Cards for deck + Overtime Briefcase',
      executive:  'Rare Desk Items, passives, Upgrade Card',
    }[pack.id] || '';
    return `<div class="pack-card${canAfford ? ' pack-buyable' : ' pack-broke'}" ${canAfford ? `onclick="G.buyPack('${pack.id}')"` : ''} style="--pack-color:${pack.color}">
      <div class="pk-icon">${pack.icon}</div>
      <div class="pk-name">${esc(pack.name)}</div>
      <div class="pk-tagline">${esc(pack.tagline)}</div>
      <div class="pk-pool">${poolDesc}</div>
      <button class="pk-buy-btn${canAfford ? '' : ' pk-cant'}" ${canAfford ? '' : 'disabled'} onclick="event.stopPropagation();G.buyPack('${pack.id}')">
        ${canAfford ? `OPEN — ${pack.cost} CC` : `${pack.cost} CC — CAN'T AFFORD`}
      </button>
    </div>`;
  }).join('');

  const shopPassives = passives.filter(p => !p.isComp);
  const passiveList = shopPassives.length
    ? `<div class="sh2-installed">Installed: ${shopPassives.map(p => `<span class="sp-tag">${SHOP_DB[p.itemId]?.icon || '•'} ${p.name}</span>`).join('')}</div>`
    : '';
  const heldList = G.heldCards && G.heldCards.length
    ? `<div class="sh2-installed" style="color:#80ffa8">💼 Held: ${G.heldCards.map(c => `<span class="sp-tag">${c.name}</span>`).join('')}</div>`
    : '';

  const shredCost = G.freeRemovalUsed ? 3 : 0;
  const canAffordShred = shredCost === 0 || coins >= shredCost;
  const shredLabel = shredCost === 0 ? '🗑️ SHRED A CARD — FREE (1st use)' : `🗑️ SHRED A CARD — ${shredCost} CC`;
  const upgradeCost = SHOP_DB.sh_upgrade.cost;
  const canAffordUpgrade = coins >= upgradeCost;
  const upgradeLabel = `⬆️ UPGRADE A CARD — ${upgradeCost} CC`;
  const nextLabel = week >= TOTAL_WEEKS ? '✓ FINAL RESULTS' : `▶ START WEEK ${week + 1}`;
  const meltdownAdvisory = G.tox >= 91
    ? `<div class="meltdown-advisory" style="margin:6px 0 10px">☣ MELTDOWN ZONE — Efficiency ×2 all plays · 20% auto-exhaust risk per card</div>`
    : '';

  return `<div class="draft-screen">
    <div class="dr-header">
      <div class="dr-title">📊 WEEKLY REVIEW — WEEK ${week}</div>
      <div class="dr-sub" style="color:${passed ? '#70ff78' : '#ff7070'};font-weight:bold">${passed ? `✓ PASSED — ${wscore} / ${G.kpi()}` : `✗ FAILED — ${wscore} / ${G.kpi()}`}</div>
      <div class="sh2-stats">
        <span style="color:${wbColor}">❤ WB ${G.wb}%</span>
        <span style="color:${toxColor}">☣ TOX ${G.tox}%</span>
        <span style="color:${boColor}">🔥 BO ${G.bo}%</span>
        <span style="color:#ffdd44">💰 ${coins} CC</span>
      </div>
    </div>
    ${meltdownAdvisory}
    <div class="pack-shop-section">
      <div class="section-title" style="margin-bottom:8px">AVAILABLE PACKS</div>
      <div class="pack-grid">${packsHtml}</div>
    </div>
    <div class="sh2-actions">
      <button class="dr-skip-btn" ${canAffordShred ? '' : 'disabled'} onclick="G.startRemoval()">${shredLabel}</button>
      <button class="sh2-upgrade-btn" ${canAffordUpgrade ? '' : 'disabled'} onclick="G.buyItem('sh_upgrade')" title="+80 Output &amp; +0.3 Eff added permanently to 1 card">${upgradeLabel}</button>
    </div>
    ${passiveList}${heldList}
    <div class="sh2-footer">
      <button class="sh2-skip-btn" onclick="G.skipShop()" ${G.purchasedThisShop ? 'disabled' : ''}>⏭ SKIP (+3 CC)</button>
      <button class="sh2-next-btn" onclick="G.startNextWeek()">${nextLabel}</button>
    </div>
  </div>`;
}

