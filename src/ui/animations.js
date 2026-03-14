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
