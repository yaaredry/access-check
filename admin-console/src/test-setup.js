import '@testing-library/jest-dom';

// jsdom doesn't always wire up localStorage to the globalThis scope in module
// contexts — provide a simple in-memory implementation so all tests can use it.
const store = {};
const localStorageMock = {
  getItem:    (k) => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
