// ═══════════════════════════════════════════════════════
//  UI FUNCTION STORE
//  Breaks circular dep: game.js ↔ render.js
//  main.js calls _setUIFunctions() after all modules load.
// ═══════════════════════════════════════════════════════
export const ui = {
  render:                null,
  scrollLog:             null,
  showScorePopup:        null,
  animateWscore:         null,
  showWbDamage:          null,
  showComboAnnouncer:    null,
  triggerKpiFlash:       null,
  showClassScreen:       null,
  checkFirstShopTutorial:null,
  showContextualTip:     null,
  resetCtxTips:          null,
  startUpgradeSpin:      null,
};

export function _setUIFunctions(fns) {
  Object.assign(ui, fns);
}
