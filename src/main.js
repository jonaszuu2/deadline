import { Game, _setUIFunctions } from './game.js';
import { render, zoomIn, zoomOut } from './ui/render.js';
import { scrollLog, showScorePopup, animateWscore, showWbDamage, showComboAnnouncer, triggerKpiFlash } from './ui/animations.js';
import { showClassScreen, selectClass, dismissTeammateModal, initStatTooltip, openHelp } from './ui/modals.js';
import { restoreHandHeight, startHandResize } from './ui/resize.js';
import { showStartupScreen, dismissStartup, _advanceTutorial, _skipTutorial, _advanceIntroTutorial, _skipIntroTutorial } from './ui/tutorial.js';
import { aprCopyRun } from './share.js';

// ═══════════════════════════════════════════════════════
//  WIRE UI FUNCTIONS INTO GAME CLASS
// ═══════════════════════════════════════════════════════
_setUIFunctions({
  render,
  scrollLog,
  showScorePopup,
  animateWscore,
  showWbDamage,
  showComboAnnouncer,
  triggerKpiFlash,
  showClassScreen,
});

// ═══════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const n = new Date();
  el.textContent = `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
}
updateClock();
setInterval(updateClock, 1000);

// ═══════════════════════════════════════════════════════
//  EXPOSE GLOBALS (required by inline onclick handlers)
// ═══════════════════════════════════════════════════════
window.selectClass          = selectClass;
window.dismissTeammateModal = dismissTeammateModal;
window.dismissStartup       = dismissStartup;
window._advanceTutorial     = _advanceTutorial;
window._skipTutorial        = _skipTutorial;
window.zoomIn               = zoomIn;
window.zoomOut              = zoomOut;
window.startHandResize      = startHandResize;
window.aprCopyRun           = aprCopyRun;
window._advanceIntroTutorial = _advanceIntroTutorial;
window._skipIntroTutorial   = _skipIntroTutorial;
window.openHelp             = openHelp;

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
window.G = new Game();
// restore any saved zoom level
const savedScale = parseFloat(localStorage.getItem('scale'));
if (!isNaN(savedScale)) {
  document.documentElement.style.setProperty('--scale', savedScale);
}
showStartupScreen();
initStatTooltip();
restoreHandHeight();
