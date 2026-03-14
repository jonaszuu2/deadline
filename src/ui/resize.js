export const HAND_H_MIN = 160;
export const HAND_H_MAX = 420;
export const HAND_H_DEF = 206;
export const CARD_H_BASE = 190;
export let _currentHandH = HAND_H_DEF;

export function applyHandHeight(px) {
  _currentHandH = px;
  const root  = document.documentElement;
  const ratio = px / HAND_H_DEF;
  const cardH = (Math.round(CARD_H_BASE * ratio) / 10).toFixed(1);
  root.style.setProperty('--card-h', cardH + 'rem');
  const hand = document.getElementById('hand');
  if (hand) hand.style.height = px + 'px';
}

export function restoreHandHeight() {
  const saved = parseInt(localStorage.getItem('handHeight'), 10);
  if (saved && saved >= HAND_H_MIN && saved <= HAND_H_MAX) applyHandHeight(saved);
}

export function startHandResize(e) {
  e.preventDefault();
  const handle = document.getElementById('hand-resize-handle');
  const hand   = document.getElementById('hand');
  if (!handle || !hand) return;
  const startY = e.clientY;
  const startH = hand.offsetHeight;
  handle.classList.add('dragging');
  function onMove(ev) {
    const newH = Math.round(Math.max(HAND_H_MIN, Math.min(HAND_H_MAX, startH - (ev.clientY - startY))));
    applyHandHeight(newH);
  }
  function onUp() {
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const h = document.getElementById('hand')?.offsetHeight || HAND_H_DEF;
    localStorage.setItem('handHeight', h);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
