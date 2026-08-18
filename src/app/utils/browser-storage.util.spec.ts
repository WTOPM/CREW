import { readLocalStorage, removeLocalStorage, writeLocalStorage } from './browser-storage.util';

describe('browser-storage.util', () => {
  const KEY = 'crew-test-browser-storage';

  afterEach(() => {
    removeLocalStorage(KEY);
  });

  it('writes and reads a value when storage is available', () => {
    writeLocalStorage(KEY, 'hello');
    if (typeof globalThis.localStorage?.getItem === 'function') {
      expect(readLocalStorage(KEY)).toBe('hello');
    } else {
      expect(readLocalStorage(KEY)).toBeNull();
    }
  });

  it('does not throw when storage is missing', () => {
    expect(() => writeLocalStorage(KEY, 'x')).not.toThrow();
    expect(() => readLocalStorage(KEY)).not.toThrow();
    expect(() => removeLocalStorage(KEY)).not.toThrow();
  });
});
