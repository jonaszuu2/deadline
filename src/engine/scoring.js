import { CAREER_DB, TOTAL_WEEKS } from '../data/constants.js';
import { fmt1 } from './utils.js';

// ═══════════════════════════════════════════════════════
//  STATUS EFFECT LOOKUP
// ═══════════════════════════════════════════════════════
import { STATUS_EFFECTS_DB } from '../data/constants.js';

export function getStatEffect(stat, val) {
  const tiers = STATUS_EFFECTS_DB[stat];
  if (!tiers) return null;
  return tiers.find(t => val >= t.min && val <= t.max) || tiers[tiers.length - 1];
}

// ═══════════════════════════════════════════════════════
//  END-GAME SCORING
// ═══════════════════════════════════════════════════════
export function computeAchievements(G, baseTotal, avgMult, chips) {
  const badges = [];
  const add = (icon, label, cls, desc, pts) => badges.push({icon, label, cls, desc, pts});
  // survival
  if (G.endCondition === 'burnout')          add('☠️','Scorched Earth','neg','Died to Burnout',-200);
  else if (G.endCondition === 'terminated')  add('🏃','Early Exit','neg','3 Failed Deliverables',-100);
  else                                       add('🔥','Burnout Survivor','pos','Survived all 10 weeks',100);
  // attendance
  if (G.failedWeeks === 0 && G.week >= TOTAL_WEEKS) add('🎯','Perfect Attendance','pos','0 Failed Deliverables',200);
  // wellbeing
  if (G.wb >= 80) add('🧘','Zen Master','pos','Final WB ≥ 80%',150);
  // toxicity
  if (G.peakTox >= 80) add('⚡','High Voltage','neg','Peak TOX ≥ 80%',-150);
  // teamwork
  if (G.totalTeammateWeeks >= 5)       add('🤝','Team Player','pos','5+ weeks with a teammate',100);
  else if (G.totalTeammateWeeks === 0) add('💀','Solo Operator','neu','No teammate used this run',0);
  // score milestones
  if (baseTotal >= 30000)    add('💎','High Achiever','pos','Base score ≥ 30000',250);
  else if (baseTotal < 2500) add('📉','It Is What It Is','neg','Base score < 2500',0);
  // multiplier
  if (avgMult >= 4.0)      add('🌀','Multiplier Master','pos','Avg Multiplier ≥ 4.0×',250);
  else if (avgMult >= 3.0) add('🔄','Efficiency Expert','pos','Avg Multiplier ≥ 3.0×',150);
  // chips
  if (chips >= 15000)  add('💥','Output Monster','pos','Total Output ≥ 15000',150);
  // wellness path
  if ((G.wellnessWeeks || 0) >= 8) add('🌿','Wellness Champion','pos','8+ weeks with WB ≥ 70%',200);
  else if ((G.wellnessWeeks || 0) >= 5) add('❤','Healthy Habits','pos','5+ weeks with WB ≥ 70%',100);
  return badges;
}

export function calculateFinalScore(G) {
  const chips = G.totalRawChips;
  const avgMult = G.totalPlayCount > 0 ? G.totalMultSum / G.totalPlayCount : 1.0;
  const rawPts      = chips;
  const multPts     = Math.floor(avgMult * 1000);
  const wellnessPts = (G.wellnessWeeks || 0) * 150;
  const wbPts       = G.wb * 10;
  const boPts       = G.bo * (-25);
  const toxPts      = G.peakTox * (-5);
  const synPts      = G.totalTeammateWeeks * 50;
  const baseTotal   = rawPts + multPts + wellnessPts + wbPts + boPts + toxPts + synPts;
  const achievements = computeAchievements(G, baseTotal, fmt1(avgMult), chips);
  const achPts       = achievements.reduce((sum, a) => sum + (a.pts || 0), 0);
  const total        = baseTotal + achPts;
  return {chips, avgMult:fmt1(avgMult), weeksPlayed:G.week, rawPts, multPts, wellnessPts, wbPts, boPts, toxPts, synPts, achPts, achievements, total};
}

export function predictCareerTier(total) {
  return CAREER_DB.find(t => total >= t.min) || CAREER_DB[CAREER_DB.length - 1];
}

export function calculateCareerOutcome(total) {
  const tier = CAREER_DB.find(t => total >= t.min) || CAREER_DB[CAREER_DB.length - 1];
  const raise = parseFloat((tier.raiseMin + Math.random() * (tier.raiseMax - tier.raiseMin)).toFixed(1));
  try {
    const prev = JSON.parse(localStorage.getItem('dl_scores') || '[]');
    prev.push({score:total, tier:tier.tier, title:tier.title, raise, date:Date.now()});
    prev.sort((a, b) => b.score - a.score);
    localStorage.setItem('dl_scores', JSON.stringify(prev.slice(0, 10)));
  } catch (e) {}
  const hs = getHighScore();
  return {tier, raise, isHighScore: !hs || total >= hs.score};
}

export function getHighScore() {
  try {
    const s = JSON.parse(localStorage.getItem('dl_scores') || '[]');
    return s[1] || null;
  } catch (e) { return null; }
}
