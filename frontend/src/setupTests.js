// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';

// jsdom does not provide Web Storage and Node's implementation only exists
// behind a CLI flag, so anything reading localStorage (useLocalStorage, and the
// auth session on top of it) needs a stand-in to be testable.
class MemoryStorage {
  #entries = new Map();

  get length() {
    return this.#entries.size;
  }

  key(index) {
    return Array.from(this.#entries.keys())[index] ?? null;
  }

  getItem(key) {
    const stored = this.#entries.get(String(key));
    return stored === undefined ? null : stored;
  }

  setItem(key, value) {
    this.#entries.set(String(key), String(value));
  }

  removeItem(key) {
    this.#entries.delete(String(key));
  }

  clear() {
    this.#entries.clear();
  }
}

if (!globalThis.localStorage) {
  const storage = new MemoryStorage();
  for (const target of new Set([globalThis, globalThis.window].filter(Boolean))) {
    Object.defineProperty(target, 'localStorage', {value: storage, configurable: true, writable: true});
  }
}
