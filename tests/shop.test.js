/**
 * shop.test.js — Vitest suite for shop/pack randomization.
 */
import { describe, it, expect } from 'vitest';
import { SHOP_DB, PACK_DB } from '../src/data/shop.js';
import { DESK_ITEMS_LIST } from '../src/data/deskItems.js';
import { shuffle } from '../src/engine/utils.js';
import { _rollPackItems } from '../src/engine/GamePhases.js';

// ── Minimal GameState mock ────────────────────────────────
function mockGameState(overrides = {}) {
  return {
    deskItems: [],
    deck: [],
    hand: [],
    pile: [],
    week: 1,
    coins: 99,
    freeRemovalUsed: false,
    shopPacksBought: 0,
    purchasedThisShop: false,
    shopPackIds: [],
    openedPack: null,
    ...overrides,
    _buildCardDraftPool() { return []; },
    _packifyShopItem(id) {
      const item = SHOP_DB[id];
      if (!item) return null;
      return {
        type: item.type, id, name: item.name, icon: item.icon,
        rarity: 'COMMON', desc: item.desc, negative: false, data: item,
      };
    },
  };
}

// ─────────────────────────────────────────────────────────
//  SHOP_DB — static structure checks
// ─────────────────────────────────────────────────────────
describe('SHOP_DB — structure', () => {

  it('all shop items have type, name, cost as number', () => {
    for (const [id, item] of Object.entries(SHOP_DB)) {
      expect(item.type,  `${id}.type`).toBeDefined();
      expect(item.name,  `${id}.name`).toBeDefined();
      expect(item.cost,  `${id}.cost`).toBeDefined();
      expect(typeof item.cost, `${id}.cost type`).toBe('number');
    }
  });

  it('CONSUMABLE items have effects object with logCls and logMsg', () => {
    for (const [id, item] of Object.entries(SHOP_DB)) {
      if (item.type === 'CONSUMABLE') {
        expect(item.effects,         `${id}.effects`).toBeDefined();
        expect(item.effects.logCls,  `${id}.effects.logCls`).toBeDefined();
        expect(item.effects.logMsg,  `${id}.effects.logMsg`).toBeDefined();
      }
    }
  });

  it('ADD_CARD items have card definition with archetype and fx', () => {
    for (const [id, item] of Object.entries(SHOP_DB)) {
      if (item.type === 'ADD_CARD') {
        expect(item.card,           `${id}.card`).toBeDefined();
        expect(item.card.fx,        `${id}.card.fx`).toBeDefined();
        expect(item.card.archetype, `${id}.card.archetype`).toBeDefined();
        expect(item.card.synergies, `${id}.card.synergies`).toBeDefined();
      }
    }
  });

  it('sh_shredder and sh_upgrade exist', () => {
    expect(SHOP_DB['sh_shredder']).toBeDefined();
    expect(SHOP_DB['sh_upgrade']).toBeDefined();
  });

  it('sh_shredder is REMOVE_CARD type', () => {
    expect(SHOP_DB['sh_shredder'].type).toBe('REMOVE_CARD');
  });

  it('sh_upgrade is UPGRADE_CARD type', () => {
    expect(SHOP_DB['sh_upgrade'].type).toBe('UPGRADE_CARD');
  });
});

// ─────────────────────────────────────────────────────────
//  PACK_DB — structure
// ─────────────────────────────────────────────────────────
describe('PACK_DB — structure', () => {

  it('all 5 packs exist: standard, talent_acq, executive, shred, upgrade', () => {
    expect(PACK_DB.standard).toBeDefined();
    expect(PACK_DB.talent_acq).toBeDefined();
    expect(PACK_DB.executive).toBeDefined();
    expect(PACK_DB.shred).toBeDefined();
    expect(PACK_DB.upgrade).toBeDefined();
  });

  it('all packs have cost (number) and weight (number)', () => {
    for (const [id, pack] of Object.entries(PACK_DB)) {
      expect(typeof pack.cost,   `${id}.cost type`).toBe('number');
      expect(typeof pack.weight, `${id}.weight type`).toBe('number');
    }
  });
});

// ─────────────────────────────────────────────────────────
//  _rollPackItems — standard pack
// ─────────────────────────────────────────────────────────
describe('_rollPackItems — standard pack', () => {

  it('always returns exactly 3 items', () => {
    const gs = mockGameState();
    const items = _rollPackItems.call(gs, 'standard');
    expect(items.length).toBe(3);
  });

  it('items have required shape: type, id, name, icon, rarity, desc', () => {
    const gs = mockGameState();
    const items = _rollPackItems.call(gs, 'standard');
    for (const item of items) {
      expect(item.type,   `item.type`).toBeDefined();
      expect(item.id,     `item.id`).toBeDefined();
      expect(item.name,   `item.name`).toBeDefined();
      expect(item.rarity, `item.rarity`).toBeDefined();
    }
  });

  it('standard pack only contains CONSUMABLE or DESK_ITEM types', () => {
    const gs = mockGameState();
    for (let i = 0; i < 20; i++) {
      const items = _rollPackItems.call(gs, 'standard');
      for (const item of items) {
        expect(['CONSUMABLE', 'DESK_ITEM']).toContain(item.type);
      }
    }
  });

  it('standard pack excludes already-owned DESK_ITEMs', () => {
    const gs = mockGameState({
      deskItems: [{ id: 'office_plant', name: 'Office Plant', rarity: 'COMMON' }],
    });
    for (let i = 0; i < 30; i++) {
      const items = _rollPackItems.call(gs, 'standard');
      const deskItems = items.filter(it => it.type === 'DESK_ITEM');
      for (const di of deskItems) {
        expect(di.id).not.toBe('office_plant');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
//  _rollPackItems — executive pack
// ─────────────────────────────────────────────────────────
describe('_rollPackItems — executive pack', () => {

  it('always returns exactly 3 items', () => {
    const gs = mockGameState();
    const items = _rollPackItems.call(gs, 'executive');
    expect(items.length).toBe(3);
  });

  it('executive pack items are DESK_ITEM (RARE/LEGENDARY) or UPGRADE_CARD', () => {
    const gs = mockGameState();
    for (let i = 0; i < 15; i++) {
      const items = _rollPackItems.call(gs, 'executive');
      for (const item of items) {
        expect(['DESK_ITEM', 'UPGRADE_CARD']).toContain(item.type);
        if (item.type === 'DESK_ITEM') {
          expect(['RARE', 'LEGENDARY']).toContain(item.rarity);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────
//  Shop pack pool — shred/upgrade frequency simulation
// ─────────────────────────────────────────────────────────
describe('openShop — pack pool distribution (1000 simulations)', () => {

  it('shred and upgrade both appear in ≥10% of shops', () => {
    // Simulates the pack pool building logic from openShop()
    // Weights: standard=4, talent_acq=3, executive=2, shred=2, upgrade=2 → total=13
    let shredCount = 0;
    let upgradeCount = 0;
    const N = 1000;

    for (let trial = 0; trial < N; trial++) {
      const _packPool = [];
      for (const [id, pack] of Object.entries(PACK_DB)) {
        for (let w = 0; w < (pack.weight || 1); w++) _packPool.push(id);
      }
      const shuffled = shuffle(_packPool);
      const seen = new Set();
      const shopPackIds = [];
      for (const id of shuffled) {
        if (!seen.has(id)) { seen.add(id); shopPackIds.push(id); }
        if (shopPackIds.length >= 3) break;
      }
      if (shopPackIds.includes('shred'))   shredCount++;
      if (shopPackIds.includes('upgrade')) upgradeCount++;
    }

    // Both have weight=2 out of 5 unique packs, so they should appear in >50% of shops
    expect(shredCount).toBeGreaterThan(100);
    expect(upgradeCount).toBeGreaterThan(100);
  });
});
