// The full simulate flow through the React Native adapter: identity resolves
// from AsyncStorage behind ready(), assignments hydrate/persist through it,
// and an AppState background transition drains the queue. The core's drain
// sends keepalive/text-plain — both harmless no-ops for RN's fetch, and the
// sendBeacon fallback is never viable, so the drain is effectively a plain
// fire-and-forget fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as abmeter from '../src/index';
import {
  __asyncStorageStore,
  __resetAsyncStorage,
  __setAsyncStorageFailing,
} from './mocks/async-storage';
import { __resetAppState, __setAppState } from './mocks/react-native';

const PAYLOAD = {
  user: { user_id: 'ignored', email: null },
  assignments: {
    'button-color': {
      value: 'green',
      parameter_id: 1,
      space_id: 2,
      exposure: { exposable_type: 'Experiment', exposable_id: 3, audience_id: 4 },
    },
  },
};

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

let requests: RecordedRequest[];

function installFetchMock(): void {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url).includes('/user-assignments')) {
        return new Response(JSON.stringify(PAYLOAD), {
          status: 200,
          headers: { ETag: 'W/"v1"', 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ recorded_count: 1, invalid_count: 0 }), { status: 201 });
    })
  );
}

function requestsTo(path: string): RecordedRequest[] {
  return requests.filter((request) => request.url.includes(path));
}

beforeEach(() => {
  installFetchMock();
});

afterEach(async () => {
  await abmeter.reset({ force: true });
  __resetAsyncStorage();
  __resetAppState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('configure', () => {
  it('resolves the track id from AsyncStorage before the first request', async () => {
    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();

    const sent = requestsTo('/user-assignments')[0]?.body as { user_id: string };
    expect(sent.user_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(__asyncStorageStore().get('abmeter:track_id')).toBe(sent.user_id);
  });

  it('keeps the same identity across app launches', async () => {
    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();
    const first = (requestsTo('/user-assignments')[0]?.body as { user_id: string }).user_id;

    await abmeter.reset({ force: true });
    installFetchMock();
    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();

    expect((requestsTo('/user-assignments')[0]?.body as { user_id: string }).user_id).toBe(first);
  });

  it('degrades to a per-launch id when AsyncStorage is unavailable', async () => {
    __setAsyncStorageFailing(true);

    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();

    const sent = requestsTo('/user-assignments')[0]?.body as { user_id: string };
    expect(sent.user_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(__asyncStorageStore().size).toBe(0);
  });

  it('uses a supplied userId without touching stored identity', async () => {
    abmeter.configure({
      apiKey: 'pk_k',
      baseUrl: 'https://api.test',
      user: { userId: 'known-user' },
      flushInterval: 60_000,
    });
    await abmeter.ready();

    expect((requestsTo('/user-assignments')[0]?.body as { user_id: string }).user_id).toBe('known-user');
    expect(__asyncStorageStore().has('abmeter:track_id')).toBe(false);
  });

  it('persists the assignments cache through AsyncStorage', async () => {
    abmeter.configure({
      apiKey: 'pk_k',
      baseUrl: 'https://api.test',
      user: { userId: 'u1' },
      flushInterval: 60_000,
    });
    await abmeter.ready();

    await vi.waitFor(() => {
      expect(__asyncStorageStore().has('abmeter:assignments:u1')).toBe(true);
    });
  });

  it('rejects secret (api-) keys exactly like the browser core', () => {
    expect(() =>
      abmeter.configure({ apiKey: 'api-notForClients123', baseUrl: 'https://api.test' })
    ).toThrow(/publishable key/);
  });
});

describe('simulate flow', () => {
  it('resolves, tracks, and drains on backgrounding', async () => {
    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();
    const userId = (requestsTo('/user-assignments')[0]?.body as { user_id: string }).user_id;

    expect(abmeter.resolveParameter('button-color')).toBe('green');
    abmeter.trackEvent('purchase', { price: 4.99 });

    __setAppState('background');

    await vi.waitFor(() => {
      expect(requestsTo('/exposures')).toHaveLength(1);
      expect(requestsTo('/events')).toHaveLength(1);
    });

    const exposure = requestsTo('/exposures')[0];
    expect(exposure?.headers['Authorization']).toBe('Bearer pk_k');
    expect((exposure?.body as Array<Record<string, unknown>>)[0]).toMatchObject({
      parameter_id: 1,
      resolved_value: 'green',
      user_id: userId,
      exposable_type: 'Experiment',
    });

    const event = requestsTo('/events')[0];
    expect((event?.body as Array<Record<string, unknown>>)[0]).toMatchObject({
      event_slug: 'purchase',
      user_id: userId,
      custom_fields: { price: 4.99 },
    });
  });

  it('drains again after a foreground round-trip', async () => {
    abmeter.configure({ apiKey: 'pk_k', baseUrl: 'https://api.test', flushInterval: 60_000 });
    await abmeter.ready();
    abmeter.trackEvent('purchase');

    __setAppState('background');
    await vi.waitFor(() => {
      expect(requestsTo('/events')).toHaveLength(1);
    });

    __setAppState('active');
    abmeter.trackEvent('view');
    __setAppState('background');

    await vi.waitFor(() => {
      expect(requestsTo('/events')).toHaveLength(2);
    });
    expect((requestsTo('/events')[1]?.body as Array<Record<string, unknown>>)[0]).toMatchObject({
      event_slug: 'view',
    });
  });
});
