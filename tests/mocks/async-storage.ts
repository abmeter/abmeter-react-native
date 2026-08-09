// In-repo stand-in for `@react-native-async-storage/async-storage`, wired in
// via vitest alias. A promise-based Map with __-prefixed test hooks.

const store = new Map<string, string>();
let failing = false;

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (failing) throw new Error('AsyncStorage unavailable');
    return store.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (failing) throw new Error('AsyncStorage unavailable');
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
};

export default AsyncStorage;

export function __resetAsyncStorage(): void {
  store.clear();
  failing = false;
}

export function __setAsyncStorageFailing(value: boolean): void {
  failing = value;
}

export function __asyncStorageStore(): Map<string, string> {
  return store;
}
