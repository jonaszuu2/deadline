import { TOTAL_WEEKS } from './data/constants.js';
import { calculateFinalScore, calculateCareerOutcome } from './engine/scoring.js';

export function generateShareText(G, s, career, achievements) {
  const {tier, raise} = career;
  const line = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const badgesStr = achievements.map(b => `${b.icon} ${b.label}`).join('  ');
  const end = G.endCondition === 'burnout' ? '☠️ BURNOUT' :
              G.endCondition === 'terminated' ? `🏃 TERMINATED (wk ${G.week})` :
              `✅ Week ${G.week}/${TOTAL_WEEKS}`;
  return [
    `📊 DEADLINE™ — Annual Performance Review`,
    line,
    `🏆 ${tier.title} (Tier ${tier.tier}/10)`,
    `📈 Raise: +${raise}%  |  💯 Score: ${s.total.toLocaleString()} pts`,
    line,
    `⚡ Chips: ${s.chips.toLocaleString()}  |  ×${s.avgMult} avg mult`,
    `💚 WB: ${G.wb}%  |  🔥 BO: ${G.bo}%  |  ☢ Peak TOX: ${G.peakTox}%`,
    `${end}`,
    line,
    badgesStr,
    `#DEADLINE #CorporateHell`,
  ].join('\n');
}

export function aprCopyRun(btn) {
  const G = window.G;
  if (!G) return;
  const s = calculateFinalScore(G);
  const career = calculateCareerOutcome(s.total);
  const text = generateShareText(G, s, career, s.achievements);
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }).catch(() => {
    btn.textContent = '✗ Failed';
    setTimeout(() => { btn.textContent = '📋 Copy Run'; }, 2000);
  });
}
