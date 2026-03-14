import { clamp } from '../data/constants.js';
export { clamp };

export const rnd100 = () => Math.floor(Math.random() * 100);
export const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const fmt1 = v => parseFloat(v.toFixed(2));
let _uid = 0;
export const nextUid = () => _uid++;

export function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ── Unlock system (persists across runs via localStorage) ──
export function getUnlockedTier() {
  return parseInt(localStorage.getItem('dl_unlocked_tier') || '0', 10);
}
export function setUnlockedTier(t) {
  const cur = getUnlockedTier();
  if (t > cur) localStorage.setItem('dl_unlocked_tier', String(t));
}
export function isCardUnlocked(card) {
  return (card.tier || 0) <= getUnlockedTier();
}

// returning player bonus: if scores exist but no unlock tier set, grant tier 2
if (!localStorage.getItem('dl_unlocked_tier') && localStorage.getItem('dl_scores')) {
  localStorage.setItem('dl_unlocked_tier', '2');
}
