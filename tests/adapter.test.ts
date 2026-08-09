import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReactNativeAdapter } from '../src/adapter';
import { __asyncStorageStore, __resetAsyncStorage } from './mocks/async-storage';
import { __appStateListenerCount, __resetAppState, __setAppState } from './mocks/react-native';

function subscribeBackground(): { fires: () => number; unsubscribe: () => void } {
  const handler = vi.fn();
  const unsubscribe = createReactNativeAdapter().lifecycle.onBackground(handler);
  return { fires: () => handler.mock.calls.length, unsubscribe };
}

afterEach(() => {
  __resetAsyncStorage();
  __resetAppState();
  vi.restoreAllMocks();
});

describe('createReactNativeAdapter storage', () => {
  it('round-trips through AsyncStorage', async () => {
    const { storage } = createReactNativeAdapter();

    await storage.setItem('abmeter:probe', 'value');
    await expect(storage.getItem('abmeter:probe')).resolves.toBe('value');
    expect(__asyncStorageStore().get('abmeter:probe')).toBe('value');

    await storage.removeItem('abmeter:probe');
    await expect(storage.getItem('abmeter:probe')).resolves.toBeNull();
  });
});

describe('createReactNativeAdapter lifecycle', () => {
  it('fires when the app leaves active for background', () => {
    const background = subscribeBackground();

    __setAppState('background');

    expect(background.fires()).toBe(1);
  });

  it('fires once across the iOS active → inactive → background sequence', () => {
    const background = subscribeBackground();

    __setAppState('inactive');
    __setAppState('background');

    expect(background.fires()).toBe(1);
  });

  it('does not fire when returning to the foreground', () => {
    const background = subscribeBackground();

    __setAppState('background');
    __setAppState('active');

    expect(background.fires()).toBe(1);
  });

  it('stops observing after unsubscribe', () => {
    const background = subscribeBackground();

    background.unsubscribe();
    __setAppState('background');

    expect(background.fires()).toBe(0);
    expect(__appStateListenerCount()).toBe(0);
  });
});
