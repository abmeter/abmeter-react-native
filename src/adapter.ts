import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { PlatformAdapter, PlatformLifecycle, PlatformStorage } from 'abmeter';

/**
 * The React Native platform for the abmeter core: AsyncStorage for
 * persistence (track id and assignments cache — no cookies here) and AppState
 * for drain moments. Everything experiment-shaped stays in the core.
 */
export function createReactNativeAdapter(): PlatformAdapter {
  return { name: 'react-native', storage: asyncStorageAdapter(), lifecycle: appStateLifecycle() };
}

// AsyncStorage is already promise-based — passthrough with type narrowing.
// Failures are the core's to log; nothing here needs a try/catch of its own.
function asyncStorageAdapter(): PlatformStorage {
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
}

const BACKGROUND_STATES: readonly AppStateStatus[] = ['background', 'inactive'];

// Leaving 'active' (to 'inactive' — app switcher, incoming call — or straight
// to 'background') signals the drain. Tracking the previous state keeps iOS's
// active → inactive → background sequence to a single fire. The core's drain
// transports degrade cleanly here: RN's fetch ignores keepalive (the runtime
// survives backgrounding) and navigator.sendBeacon does not exist, so the
// beacon branch is never taken.
function appStateLifecycle(): PlatformLifecycle {
  return {
    onBackground(handler) {
      let previous = AppState.currentState;
      const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
        const leavingActive = previous === 'active' && BACKGROUND_STATES.includes(next);
        previous = next;
        if (leavingActive) handler();
      });
      return () => subscription.remove();
    },
  };
}
