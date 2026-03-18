import { Game, _setUIFunctions } from './game.js';
import { render, zoomIn, zoomOut } from './ui/render.js';
import { scrollLog, showScorePopup, animateWscore, showWbDamage, showComboAnnouncer, triggerKpiFlash, startUpgradeSpin, dismissManagerEmail } from './ui/animations.js';
import { dismissTeammateModal, initStatTooltip, initCardTooltip, openHelp } from './ui/modals.js';
import { restoreHandHeight, startHandResize } from './ui/resize.js';
import { showStartupScreen, dismissStartup, showHowToPlay, _advanceTutorial, _skipTutorial, _advanceIntroTutorial, _skipIntroTutorial, checkFirstShopTutorial, _advanceShopTutorial, _skipShopTutorial, showContextualTip, resetCtxTips, showGuideTip } from './ui/tutorial.js';
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
  checkFirstShopTutorial,
  showContextualTip,
  resetCtxTips,
  startUpgradeSpin,
  showGuideTip,
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
window.dismissTeammateModal = dismissTeammateModal;
window.dismissStartup       = dismissStartup;
window.showHowToPlay        = showHowToPlay;
window._advanceTutorial     = _advanceTutorial;
window._skipTutorial        = _skipTutorial;
window._advanceShopTutorial = _advanceShopTutorial;
window._skipShopTutorial    = _skipShopTutorial;
window.zoomIn               = zoomIn;
window.zoomOut              = zoomOut;
window.startHandResize      = startHandResize;
window.aprCopyRun           = aprCopyRun;
window._advanceIntroTutorial = _advanceIntroTutorial;
window._skipIntroTutorial   = _skipIntroTutorial;
window.openHelp             = openHelp;
window._dismissManagerEmail = dismissManagerEmail;

// Desk Item actions (called from inline onclick handlers)
window.claimDeskItem    = (id) => window.G.claimDeskItem(id);
window.skipDeskOffer    = ()   => window.G.skipDeskOffer();
window.useResignationLetter = () => window.G.useResignationLetter();

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
initCardTooltip();
restoreHandHeight();
