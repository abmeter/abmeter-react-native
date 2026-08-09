// In-repo stand-in for the `react-native` peer, wired in via vitest alias.
// Covers exactly what src/adapter.ts touches, plus __-prefixed test hooks.

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface NativeEventSubscription {
  remove(): void;
}

type Listener = (state: AppStateStatus) => void;

const listeners = new Set<Listener>();
let state: AppStateStatus = 'active';

export const AppState = {
  get currentState(): AppStateStatus {
    return state;
  },
  addEventListener(_type: 'change', listener: Listener): NativeEventSubscription {
    listeners.add(listener);
    return { remove: () => void listeners.delete(listener) };
  },
};

export function __setAppState(next: AppStateStatus): void {
  state = next;
  for (const listener of listeners) listener(next);
}

export function __resetAppState(): void {
  state = 'active';
  listeners.clear();
}

export function __appStateListenerCount(): number {
  return listeners.size;
}
