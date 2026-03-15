// Stub browser globals before any test module is loaded
const store = {};
global.localStorage = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear:      () => { for (const k in store) delete store[k]; },
};
