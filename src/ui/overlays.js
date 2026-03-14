import { TOTAL_WEEKS } from '../data/constants.js';
import { esc } from '../engine/utils.js';
import { DB } from '../data/cards.js';
import { calculateFinalScore, calculateCareerOutcome } from '../engine/scoring.js';

export function ovGameOver(G) {
  return `<div class="ov"><div class="ovb">
    <div class="ov-tbar">💀 DEADLINE™ — Critical Error</div>
    <div class="ov-body-inner">
      <span class="ov-ico">💀</span>
      <div class="ov-title">BURNOUT — FATAL EXCEPTION</div>
      <div class="ov-body">Your nervous system has performed an illegal operation<br>and will be shut down.<br>HR is processing your offboarding request.</div>
      <div class="ov-stat">Week: ${G.week} | WB: ${G.wb}% | TOX: ${G.tox}% | BO: ${G.bo}%</div>
      <div class="ov-btns"><button class="w95-btn" onclick="G.restart()">↩ New Game</button></div>
    </div>
  </div></div>`;
}

export function ovWin(G) {
  return `<div class="ov"><div class="ovb">
    <div class="ov-tbar">🏆 DEADLINE™ — Task Completed</div>
    <div class="ov-body-inner">
      <span class="ov-ico">🏆</span>
      <div class="ov-title">PROMOTED</div>
      <div class="ov-body">You survived 5 weeks of corporate hell.<br>You are now a <b>Senior Deadline Manager.</b><br>Next deadline in 8 hours.</div>
      <div class="ov-stat">WB: ${G.wb}% | TOX: ${G.tox}% | Burnout: ${G.bo}%</div>
      <div class="ov-btns"><button class="w95-btn" onclick="G.restart()">↩ New Game</button></div>
    </div>
  </div></div>`;
}

export function ovFinalReview(G) {
  const s = calculateFinalScore(G);
  const career = calculateCareerOutcome(s.total);
  const {tier, raise, isHighScore} = career;
  const sign = n => n >= 0 ? `+${n}` : String(n);
  const ptsClass = n => n > 0 ? 'pos' : n < 0 ? 'neg' : 'neu';
  const terminated = G.isTerminated;
  const endCond = G.endCondition || 'annual';
  const condLabels = {
    annual: 'Annual Review Complete',
    burnout: '⚠ SYSTEM FAILURE — Employee Burnout Critical',
    terminated: `⚠ PERFORMANCE TERMINATION — ${G.failedWeeks}/3 Failed Deliverables`,
  };
  const termBanner   = terminated ? `<div class="apr-terminated">${condLabels[endCond] || condLabels.terminated}</div>` : '';
  const hsBanner     = isHighScore ? `<div class="apr-hs">★ NEW HIGH SCORE ★</div>` : '';
  const weeksPassed  = G.week;
  const achievements = s.achievements;
  const badgesHtml   = achievements.map(b => {
    const ptsLabel = b.pts > 0 ? `+${b.pts}` : b.pts < 0 ? `${b.pts}` : '';
    return `<span class="apr-badge apr-badge-${b.cls}" title="${b.desc}">
      ${b.icon} ${b.label}${ptsLabel ? `<em class="apr-badge-pts">${ptsLabel}</em>` : ''}
    </span>`;
  }).join('');
  // Year banner for promotion runs
  const yearBanner = G.promotionYear > 1
    ? `<div class="apr-year-banner">YEAR ${G.promotionYear} — PROMOTION RUN · KPI ×${G.kpiMultiplier.toFixed(2)}</div>` : '';
  // Run contracts results
  const contractsResultHtml = (G.runContracts?.length)
    ? `<div class="apr-subtitle">── RUN CONTRACTS ──</div>
       <div class="apr-contracts-row">${G.runContracts.map(c => {
         const ok = c.achieved;
         return `<div class="apr-contract ${ok?'apr-rc-ok':'apr-rc-fail'}">
           <span class="apr-rc-icon">${c.icon}</span>
           <span class="apr-rc-status">${ok?'✓':'✗'}</span>
           <span class="apr-rc-desc">${esc(c.desc)}</span>
           <span class="apr-rc-pts ${ok?'pos':'neu'}">${ok?'+'+c.pts:'—'}</span>
         </div>`;}).join('')}</div>`
    : '';
  // Cumulative score for promotion runs
  const cumulativeHtml = G.previousRunScore > 0
    ? `<div class="apr-cumulative">Career Total: <strong>${G.previousRunScore + s.total}</strong> pts (Year ${G.promotionYear-1}: ${G.previousRunScore} + Year ${G.promotionYear}: ${s.total})</div>`
    : '';
  return `<div class="ov"><div class="ovb apr-ovb">
    <div class="ov-tbar apr-tbar">📊 DEADLINE™ — Annual Performance Review · Week ${weeksPassed}/${TOTAL_WEEKS}</div>
    <div class="apr-body">
      ${yearBanner}
      ${termBanner}
      ${hsBanner}
      <div class="apr-career-card">
        <div class="apr-cc-eyebrow">CORPORATE TITLE AWARDED · TIER ${tier.tier} / 10</div>
        <div class="apr-cc-title" style="color:${tier.color}">${tier.title}</div>
        <div class="apr-cc-tier">Score threshold: ${tier.min === -Infinity ? '—' : tier.min}+ pts · Your score: ${s.total}</div>
        <div class="apr-cc-desc">"${esc(tier.desc)}"</div>
      </div>
      <div class="apr-raise-row">
        <span class="apr-raise-lbl">📈 QUARTERLY RAISE AWARDED</span>
        <span class="apr-raise-val">+${raise}%</span>
      </div>
      ${(() => {
          let comment = '';
          if (raise < 3) comment = 'Everything\'s solid, but we\'re constrained at 3% this quarter.';
          else if (raise < 6) comment = 'Good job — you got some cushion, but don\'t spend it all in one place.';
          else comment = 'Exceptional work! Don\'t tell HR.';
          return `<div class="apr-comment" style="margin-top:6px;color:#555;font-size:12px">${comment}</div>`;
      })()}
      <div class="apr-subtitle">── PERFORMANCE BREAKDOWN ──</div>
      <div class="apr-lines">
        <div class="apr-line"><span class="apr-lbl">🔵 Chips Path — Total Chips</span><span class="apr-val">${s.chips.toLocaleString()}</span><span class="apr-pts ${ptsClass(s.rawPts)}">${sign(s.rawPts)} pts</span></div>
        <div class="apr-line"><span class="apr-lbl">🔴 Mult Path — Avg Multiplier</span><span class="apr-val">${s.avgMult}× (×250)</span><span class="apr-pts ${ptsClass(s.multPts)}">${sign(s.multPts)} pts</span></div>
        <div class="apr-line"><span class="apr-lbl">❤ Wellness Path — WB≥70% weeks</span><span class="apr-val">${G.wellnessWeeks || 0} / ${TOTAL_WEEKS} (×150)</span><span class="apr-pts ${ptsClass(s.wellnessPts)}">${sign(s.wellnessPts)} pts</span></div>
        <div class="apr-divider">· · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>
        <div class="apr-line"><span class="apr-lbl">Final Wellbeing</span><span class="apr-val">${G.wb}%</span><span class="apr-pts ${ptsClass(s.wbPts)}">${sign(s.wbPts)} pts</span></div>
        <div class="apr-line"><span class="apr-lbl">Final Burnout</span><span class="apr-val">${G.bo}%</span><span class="apr-pts ${ptsClass(s.boPts)}">${sign(s.boPts)} pts</span></div>
        <div class="apr-line"><span class="apr-lbl">Peak Toxicity</span><span class="apr-val">${G.peakTox}%</span><span class="apr-pts ${ptsClass(s.toxPts)}">${sign(s.toxPts)} pts</span></div>
        <div class="apr-divider">· · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>
        <div class="apr-line"><span class="apr-lbl">Team Synergy</span><span class="apr-val">${G.totalTeammateWeeks} wk${G.totalTeammateWeeks !== 1 ? 's' : ''}</span><span class="apr-pts ${ptsClass(s.synPts)}">${sign(s.synPts)} pts</span></div>
        <div class="apr-divider">· · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>
        <div class="apr-line"><span class="apr-lbl">Weeks Completed</span><span class="apr-val">${G.week}/${TOTAL_WEEKS}</span><span class="apr-pts neu"></span></div>
        <div class="apr-line"><span class="apr-lbl">Failed Deliverables</span><span class="apr-val" style="color:${G.failedWeeks > 0 ? '#880000' : '#006600'}">${G.failedWeeks} / 3</span><span class="apr-pts neu"></span></div>
        <div class="apr-divider">· · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>
        <div class="apr-line"><span class="apr-lbl">Achievement Bonus</span><span class="apr-val">${s.achievements.filter(a=>a.pts>0).length} badges</span><span class="apr-pts ${ptsClass(s.achPts)}">${sign(s.achPts)} pts</span></div>
        ${s.contractBonusPts ? `<div class="apr-line"><span class="apr-lbl">Run Contracts</span><span class="apr-val">${(G.runContracts||[]).filter(c=>c.achieved).length}/${(G.runContracts||[]).length} completed</span><span class="apr-pts pos">+${s.contractBonusPts} pts</span></div>` : ''}
      </div>
      ${contractsResultHtml}
      <div class="apr-badges">${badgesHtml}</div>
      ${cumulativeHtml}
      ${(() => {
        if (!G.newUnlockTier) return '';
        const newCards = Object.values(DB).filter(c => c.tier === G.newUnlockTier);
        const cardsHtml = newCards.map((c, i) => {
          const fxParts = [];
          if (c.fx.chips) fxParts.push(`+${c.fx.chips} Chips`);
          if (c.fx.mult) fxParts.push(`+${c.fx.mult}× Mult`);
          if (c.fx.tox > 0) fxParts.push(`+${c.fx.tox}% Tox`);
          if (c.fx.wb < 0) fxParts.push(`${c.fx.wb} WB`);
          if (c.fx.wb > 0) fxParts.push(`+${c.fx.wb} WB`);
          const fx = fxParts.join(' · ') || c.archetype;
          return `<div class="ur-card ${c.archetype}" style="animation-delay:${i * 0.08}s">
            <div class="ur-card-name">${esc(c.name)}</div>
            <div class="ur-card-arch">${c.archetype} · ${c.rarity}</div>
            <div class="ur-card-fx">${fx}</div>
          </div>`;
        }).join('');
        return `<div class="unlock-reveal">
          <div class="ur-title">🔓 CARDS UNLOCKED — Tier ${G.newUnlockTier}</div>
          <div class="ur-subtitle">Available in your next run</div>
          <div class="ur-cards">${cardsHtml}</div>
        </div>`;
      })()}
      <div class="apr-total-row">
        <span>FINAL PERFORMANCE RATING</span>
        <span class="apr-score-val" id="apr-score-animated">${s.total}</span>
      </div>
    </div>
    <div class="ov-btns">
      <button class="w95-btn" onclick="G.restart()">↩ New Game</button>
      ${!terminated ? `<button class="apr-promo-btn" onclick="G.acceptPromotion()" title="Start Year ${G.promotionYear+1} — KPI ×${(G.kpiMultiplier*1.25).toFixed(2)}, carry your best card">🚀 ACCEPT PROMOTION →</button>` : ''}
      <button class="apr-share-btn" id="apr-copy-btn" onclick="aprCopyRun(this)">📋 Copy Run</button>
    </div>
  </div></div>`;
}
