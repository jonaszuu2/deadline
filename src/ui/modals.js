import { TOTAL_WEEKS } from '../data/constants.js';
import { esc } from '../engine/utils.js';
import { DB } from '../data/cards.js';
import { CLASS_DB, TEAMMATES_DB } from '../data/content.js';
import { getStatEffect } from '../engine/scoring.js';

export function openHelp() {
  const existing = document.getElementById('help-modal');
  if (existing) { existing.remove(); return; }
  document.body.insertAdjacentHTML('beforeend', `<div id="help-modal" class="help-modal" onclick="if(event.target===this)this.remove()">
    <div class="help-win">
      <div class="help-tbar">📖 QUICK REFERENCE — DEADLINE™ <span class="help-close" onclick="document.getElementById('help-modal').remove()">✕</span></div>
      <div class="help-body">
        <div class="help-section">FORMULA</div>
        <div class="help-row help-formula-row">Score = <span class="help-chip">Chips</span> × <span class="help-mult">Mult</span></div>
        <div class="help-row"><span class="help-chip">🔵 Chips</span> — base points. Stack up from PRODUCTION cards.</div>
        <div class="help-row"><span class="help-mult">🔴 Mult</span> — multiplier on ALL Chips this play. Even 0.5× extra matters.</div>
        <div class="help-sep"></div>
        <div class="help-section">YOUR STATS</div>
        <div class="help-row"><b>❤️ WB — Wellbeing</b> — your HP. Hits 0% → game over.</div>
        <div class="help-row"><b>☣️ TOX — Toxicity</b> — office stress. High TOX = random WB damage after each play.</div>
        <div class="help-row"><b>🔥 BO — Burnout</b> — reaches 100% → immediate termination. Never resets.</div>
        <div class="help-sep"></div>
        <div class="help-section">CARD ARCHETYPES</div>
        <div class="help-row"><b style="color:#6ab4ff">PRODUCTION</b> — safe Chips. Good to start your combo.</div>
        <div class="help-row"><b style="color:#ff9090">STRATEGY</b> — Mult. Amplifies everything else you played this turn.</div>
        <div class="help-row"><b style="color:#ff6030">CRUNCH</b> — high Mult but raises TOX. Risk vs. reward.</div>
        <div class="help-row"><b style="color:#60ff80">RECOVERY</b> — heals WB, reduces TOX. Essential when stressed.</div>
        <div class="help-sep"></div>
        <div class="help-section">RISK LEVELS</div>
        <div class="help-row"><b style="color:#50ff78">SAFE</b> — no meaningful danger this play.</div>
        <div class="help-row"><b style="color:#ffcc44">CAUTION</b> — WB or TOX in warning range.</div>
        <div class="help-row"><b style="color:#ff8040">RISKY</b> — significant chance of WB damage.</div>
        <div class="help-row"><b style="color:#ff2020">LETHAL</b> — could end your run this turn.</div>
      </div>
    </div>
  </div>`);
}

export function showClassScreen() {
  document.getElementById('class-ov')?.remove();
  const classes = Object.values(CLASS_DB);
  const cardsHtml = classes.map(cls => {
    const archCounts = {};
    for (const [id, n] of Object.entries(cls.deck)) {
      const card = DB[id]; if (card) archCounts[card.archetype] = (archCounts[card.archetype] || 0) + n;
    }
    const deckTags = ['PRODUCTION','STRATEGY','CRUNCH','RECOVERY']
      .filter(a => archCounts[a])
      .map(a => `<span class="cls-deck-tag ${a}">${archCounts[a]}× ${a}</span>`)
      .join('');
    const passivesHtml = cls.passiveDescs.map(d => `<div class="cls-passive">⚡ ${esc(d)}</div>`).join('');
    return `<div class="cls-card" onclick="selectClass('${cls.id}')" style="--cls-color:${cls.color}">
      <div class="cls-icon">${cls.icon}</div>
      <div class="cls-name" style="color:${cls.color}">${esc(cls.name)}</div>
      <div class="cls-tagline">"${esc(cls.tagline)}"</div>
      <div class="cls-desc">${esc(cls.desc)}</div>
      <div class="cls-passives">${passivesHtml}</div>
      <div class="cls-deck-tags">${deckTags}</div>
      <button class="cls-pick-btn" style="border-color:${cls.color};color:${cls.color}">▶ Choose</button>
    </div>`;
  }).join('');
  document.body.insertAdjacentHTML('beforeend', `<div id="class-ov" class="class-ov">
    <div class="class-win">
      <div class="class-tbar">📋 DEADLINE™ — Department Assignment</div>
      <div class="class-body">
        <div class="class-intro">HR has assigned you to a department. Choose your <b>Corporate Identity</b>. This defines your starting deck and permanent abilities for the entire career.</div>
        <div class="class-cards">${cardsHtml}</div>
      </div>
    </div>
  </div>`);
}

export function selectClass(classId) {
  window.G.startWithClass(classId);
}

export function showTeammateModal(G) {
  const existing = document.getElementById('tm-ov'); if (existing) existing.remove();
  const tm = TEAMMATES_DB[G.teammate]; if (!tm) return;
  const curTier = G.getTeammateTier ? G.getTeammateTier() : 1;
  const snitchHtml = G.pendingSnitch
    ? `<div class="tm-snitch">⚠ HR SNITCH TRIGGERED — Alex filed a formal complaint this week. Check the game log for details.</div>`
    : '';
  const weekLabel = `Week ${G.week} / ${TOTAL_WEEKS}`;
  let effectsHtml;
  if (tm.tiers) {
    const tierLabels = ['TOX 0–30%', 'TOX 31–80%', 'TOX 81–100%'];
    effectsHtml = `<div class="tm-tiers">${tm.tiers.map((t, i) => {
      const active = t.tier === curTier;
      return `<div class="tm-tier${active ? ' active' : ''}">
        <div class="tm-tier-hdr">
          <span class="tm-tier-num">T${t.tier}</span>
          <span class="tm-tier-name">${esc(t.name)}</span>
          <span class="tm-tier-range">${tierLabels[i]}</span>
        </div>
        <div class="tm-tier-buff">▲ ${esc(t.buffText)}</div>
        <div class="tm-tier-penalty">▼ ${esc(t.penaltyText)}</div>
        ${active ? `<div class="tm-tier-quote">"${esc(t.triggerQuote)}"</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  } else {
    effectsHtml = `<div class="tm-effects">
      <div class="tm-buff"><b>▲ BUFF:</b> ${esc(tm.buffText)}</div>
      <div class="tm-penalty"><b>▼ PENALTY:</b> ${esc(tm.penaltyText)}</div>
    </div>`;
  }
  document.body.insertAdjacentHTML('beforeend', `<div class="tm-ov" id="tm-ov">
    <div class="tm-win">
      <div class="tm-tbar">👥 DEADLINE™ — Weekly Team Allocation · ${weekLabel}</div>
      <div class="tm-body">
        <div class="tm-portrait">${tm.portrait}</div>
        <div class="tm-fullname" style="color:${tm.color}">${tm.fullName}</div>
        <div class="tm-label">YOUR TEAMMATE THIS WEEK · <span style="color:${tm.color}">TIER ${curTier} ACTIVE</span></div>
        <div class="tm-desc">${esc(tm.desc)}</div>
        ${snitchHtml}
        ${effectsHtml}
      </div>
      <div class="tm-footer">
        <button class="w95-btn" onclick="dismissTeammateModal()">NOTED.</button>
      </div>
    </div>
  </div>`);
}

export function dismissTeammateModal() {
  const el = document.getElementById('tm-ov'); if (el) el.remove();
}

export const STAT_META = {
  wb:  {icon:'❤️', label:'WELLBEING'},
  tox: {icon:'☣️', label:'TOXICITY'},
  bo:  {icon:'🔥', label:'BURNOUT'},
};

export function initStatTooltip() {
  if (document.getElementById('stat-tooltip')) return;
  const el = document.createElement('div');
  el.id = 'stat-tooltip';
  el.innerHTML = '<div class="stt-header"><span class="stt-icon"></span><span class="stt-label"></span><span class="stt-val"></span></div><div class="stt-status"></div><div class="stt-desc"></div>';
  document.body.appendChild(el);

  const tip = document.getElementById('stat-tooltip');

  document.addEventListener('mousemove', e => {
    const bar = e.target.closest('[data-stat]');
    if (!bar) { tip.classList.remove('visible'); return; }
    const stat   = bar.dataset.stat;
    const val    = parseInt(bar.dataset.val, 10);
    const meta   = STAT_META[stat];
    const effect = getStatEffect(stat, val);
    if (!meta || !effect) { tip.classList.remove('visible'); return; }
    tip.querySelector('.stt-icon').textContent   = meta.icon;
    tip.querySelector('.stt-label').textContent  = meta.label;
    tip.querySelector('.stt-val').textContent    = val + '%';
    tip.querySelector('.stt-val').style.color    = effect.color;
    tip.querySelector('.stt-status').textContent = effect.label;
    tip.querySelector('.stt-status').style.color = effect.color;
    tip.querySelector('.stt-desc').textContent   = effect.desc;
    const TW = tip.offsetWidth || 240, TH = tip.offsetHeight || 70;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + TW > window.innerWidth  - 8) x = e.clientX - TW - 6;
    if (y + TH > window.innerHeight - 8) y = e.clientY - TH - 6;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    tip.classList.add('visible');
  });

  document.addEventListener('mouseleave', () => {
    document.getElementById('stat-tooltip')?.classList.remove('visible');
  });
}
