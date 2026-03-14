export function initFinalReviewAnim(total) {
  const el = document.getElementById('apr-score-animated');
  if (!el) return;
  el.textContent = '0';
  const dur   = Math.min(1200, 600 + Math.floor(total / 20));
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(total * e).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = total.toLocaleString();
  }
  requestAnimationFrame(tick);
}

export function updateKpiBar(G) {
  const bar = document.getElementById('kpi-bar-inner');
  if (!bar) return;
  const pct = Math.min(100, G.wscore / G.kpi() * 100);
  bar.style.width = pct.toFixed(1) + '%';
  bar.classList.toggle('pass', G.wscore >= G.kpi());
}

export function showScorePopup(score, intensity = 'normal', comboLabel = null) {
  const calc = document.getElementById('calc');
  if (!calc) return;
  const rect = calc.getBoundingClientRect();
  const pop  = document.createElement('div');
  const baseSizes = {normal: 32, good: 38, great: 48, epic: 60};
  const base = baseSizes[intensity] || 32;
  const fsize = Math.min(base + 16, base + Math.floor(score / 80) * 2);
  pop.className = `score-pop score-pop-${intensity}`;
  pop.style.fontSize = fsize + 'px';
  if (comboLabel && (intensity === 'great' || intensity === 'epic')) {
    pop.innerHTML = `+${score}<br><span class="sp-combo-label">${comboLabel}</span>`;
  } else {
    pop.textContent = '+' + score;
  }
  pop.style.left = Math.round(rect.left + rect.width / 2 - 80) + 'px';
  pop.style.top  = Math.round(rect.top  + rect.height / 2 - 28) + 'px';
  document.body.appendChild(pop);
  if (intensity === 'epic' || intensity === 'great') {
    const flash = document.createElement('div');
    flash.className = `score-flash-${intensity}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), intensity === 'epic' ? 600 : 400);
    const sm = document.getElementById('score-machine');
    if (sm) {
      sm.classList.add(`shake-${intensity}`);
      setTimeout(() => sm.classList.remove(`shake-${intensity}`), 550);
    }
  }
  const dur = {normal: 1500, good: 1700, great: 2100, epic: 2500};
  setTimeout(() => pop.remove(), dur[intensity] || 1500);
}

export function animateWscore(from, to, intensity = 'normal') {
  const el = document.getElementById('week-score-val');
  if (!el) return;
  el.textContent = from;
  const bumpCls = intensity === 'epic' ? 'wscore-bump-epic' : intensity === 'great' ? 'wscore-bump-great' : 'wscore-bump';
  el.classList.add(bumpCls);
  const baseDurs = {normal: 300, good: 400, great: 550, epic: 750};
  const dur = Math.min((baseDurs[intensity] || 300) + 400, (baseDurs[intensity] || 300) + Math.floor((to - from) / 8));
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(tick);
    else { el.textContent = to; setTimeout(() => el.classList.remove(bumpCls), 200); }
  }
  requestAnimationFrame(tick);
}

export function scrollLog() {
  setTimeout(() => { const el = document.getElementById('log-body'); if (el) el.scrollTop = el.scrollHeight; }, 40);
}

export function showWbDamage(amount) {
  const flash = document.createElement('div');
  flash.className = 'wb-damage-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
  const wbTrack = document.querySelector('.ed-track[data-stat="wb"]');
  if (wbTrack) {
    const rect = wbTrack.getBoundingClientRect();
    const num = document.createElement('div');
    num.className = 'wb-hit-num';
    num.textContent = `-${amount}`;
    num.style.left = Math.round(rect.left + rect.width * 0.35) + 'px';
    num.style.top  = Math.round(rect.top - 8) + 'px';
    document.body.appendChild(num);
    setTimeout(() => num.remove(), 1300);
  }
}

export function showComboAnnouncer(label) {
  const existing = document.querySelector('.combo-announcer');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'combo-announcer';
  el.textContent = `★ ${label} ★`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

export function triggerKpiFlash() {
  const bar = document.getElementById('kpi-bar-inner');
  if (!bar) return;
  bar.classList.add('kpi-flash');
  setTimeout(() => bar.classList.remove('kpi-flash'), 900);
}

export function showUpgradeFlash(card) {
  document.querySelector('.upgrade-flash-overlay')?.remove();
  const upCount = card.upgrades || 1;
  const upLabel = upCount === 1 ? 'UPGRADED' : upCount === 2 ? 'DOUBLE UPGRADE' : `×${upCount} UPGRADES`;
  const tierCls = upCount >= 3 ? 'uf-tier3' : upCount === 2 ? 'uf-tier2' : 'uf-tier1';
  const el = document.createElement('div');
  el.className = `upgrade-flash-overlay ${tierCls}`;
  el.innerHTML = `
    <div class="uf-inner">
      <div class="uf-eyebrow">CARD UPGRADED</div>
      <div class="uf-name">${card.name}</div>
      <div class="uf-badge">&#8679; ${upLabel}</div>
      <div class="uf-stats">
        <span class="uf-chips">&#x1F535; ${card.fx.chips || 0} Chips</span>
        <span class="uf-sep">&middot;</span>
        <span class="uf-mult">&#x1F534; ×${(card.fx.mult || 0).toFixed(2)} Mult</span>
      </div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export function startUpgradeSpin(tier, onDone) {
  // Visible labels/colors for the slot display (same order as UPGRADE_TIERS)
  const ALL = [
    { label: 'STANDARD',    color: '#888888' },
    { label: 'IMPROVED',    color: '#60c060' },
    { label: 'EXCELLENT',   color: '#6090ff' },
    { label: 'EXCEPTIONAL', color: '#c060ff' },
    { label: 'LEGENDARY',   color: '#ffcc00' },
  ];
  // Deceleration: each value is ms to wait before the NEXT tick
  const schedule = [35,35,35,40,45,55,68,85,108,138,175,215,260,305,350,390];
  let step = 0;
  let idx = Math.floor(Math.random() * ALL.length);

  function tick() {
    const el = document.getElementById('upgr-slot-display');
    if (!el) return; // screen was closed
    const isLast = step >= schedule.length - 1;
    const shown  = isLast ? tier : ALL[idx % ALL.length];
    el.textContent = shown.label;
    el.style.color = shown.color;
    el.style.textShadow = `0 0 18px ${shown.color}, 0 0 5px ${shown.color}`;
    idx++;
    if (!isLast) {
      step++;
      setTimeout(tick, schedule[step]);
    } else {
      el.classList.add('upgr-slot-locked');
      setTimeout(onDone, 650);
    }
  }
  setTimeout(tick, 80);
}
