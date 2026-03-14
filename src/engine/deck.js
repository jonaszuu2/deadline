import { DB } from '../data/cards.js';
import { SHOP_DB } from '../data/shop.js';
import { shuffle, nextUid, getUnlockedTier, isCardUnlocked, fmt1 } from './utils.js';

export const DECK_BLUEPRINT = {
  prod_001:3, prod_002:3, prod_005:2,
  strat_001:3, strat_002:2, strat_005:2,
  crunch_001:2, crunch_004:2,
  recov_001:2, recov_004:2,
  // tier 1
  prod_004:2, strat_006:1, crunch_002:1, crunch_005:1, recov_002:1, recov_006:1,
  // tier 2
  prod_003:1, prod_007:1, strat_004:2, strat_007:1, crunch_006:1, recov_003:1,
  // tier 3
  strat_003:1, crunch_003:1,
};

export function makeDeck() {
  const deck = [];
  for (const [id, n] of Object.entries(DECK_BLUEPRINT)) {
    const card = DB[id];
    if (!card || !isCardUnlocked(card)) continue;
    for (let i = 0; i < n; i++) deck.push({...card, uid:`${id}_${nextUid()}`});
  }
  return shuffle(deck);
}

export function makeClassDeck(blueprint) {
  const deck = [];
  for (const [id, n] of Object.entries(blueprint)) {
    const card = DB[id];
    if (!card) continue;
    for (let i = 0; i < n; i++) deck.push({...card, uid:`${id}_${nextUid()}`});
  }
  return shuffle(deck);
}

export function wbEff(wb) {
  if (wb >= 60) return {mult:1.0, label:null};
  if (wb >= 35) return {mult:0.85, label:'⚠ LOW WB ×0.85'};
  if (wb >= 15) return {mult:0.65, label:'⚠ EXHAUSTED ×0.65'};
  return {mult:0.45, label:'⚠ BREAKDOWN ×0.45'};
}

export function pickShopItems(ownedIds) {
  const tier = getUnlockedTier();
  const avail = Object.keys(SHOP_DB).filter(id => {
    if (id === 'sh_shredder') return false;
    if (id === 'sh_upgrade')  return false;
    const item = SHOP_DB[id];
    if (item.unique && ownedIds.includes(id)) return false;
    if (item.type === 'ADD_CARD' && item.tier !== undefined && item.tier > tier) return false;
    return true;
  });
  return shuffle(avail).slice(0, 3);
}
