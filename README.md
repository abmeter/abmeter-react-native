# ABMeter React Native SDK

[ABMeter](https://abmeter.ai) is a feature-flag and A/B-testing platform. You define parameters, experiments, and feature flags in the ABMeter Lab; this package reads the value assigned to each user in a React Native or Expo app and reports exposures and events back.

`@abmeter/react-native` is a thin platform adapter over the [`abmeter`](https://www.npmjs.com/package/abmeter) JS core: AsyncStorage instead of `localStorage`, `AppState` instead of tab-visibility events, no cookies, no DOM. The SDK fetches the **values already assigned** to the current user (`POST /api/v1/user-assignments`) and caches them on the device — your experiment setup never leaves the server, so nothing in your app bundle reveals what you are testing or how. Reading a value is a synchronous lookup; an exposure is reported only when a value is actually read.

## Install

```bash
npm install @abmeter/react-native abmeter @react-native-async-storage/async-storage
```

`react-native` itself is a peer dependency your app already has. In an Expo app, install AsyncStorage with `npx expo install @react-native-async-storage/async-storage` so the version matches your Expo SDK.

Pin exact versions before production — a range still lets a release you did not deploy reach your app.

## Quick start

```js
import * as abmeter from '@abmeter/react-native';

abmeter.configure({
  apiKey: 'pk_your_publishable_key',
  // Optional: identify a logged-in user. When omitted, the SDK generates a
  // stable anonymous track id (a random UUID persisted in AsyncStorage).
  user: { userId: 'user_123', email: 'user@example.com' },
});

await abmeter.ready();

const buttonColor = abmeter.resolveParameter('button-color');

abmeter.trackEvent('purchase', { price: 4.99 });
```

`configure` is synchronous, same as the browser core. Identity (the anonymous track id in AsyncStorage), the cached assignment map, and the first assignments fetch all settle behind `ready()` — await it before reading parameters.

`apiKey` must be a **publishable key** (`pk_...`, minted on the Lab API Keys page) — it is safe to embed in client code and is limited server-side to the three endpoints this SDK uses. `configure` refuses any other key: secret keys (`api-...`) are never client-safe.

## Identity

- **Anonymous users** get a generated `track id` — a random UUID persisted in AsyncStorage — sent as the `user_id`. It survives app restarts; it does not survive an app uninstall.
- **Logged-in users**: pass `user: { userId }` yourself. Keep one randomization unit per experiment — do not switch a user's id across the login boundary mid-experiment.
- `email` is optional and used only by email-predicate audiences.

### Decide the identity before the first `configure`

Calling `configure` again with a different `userId` is **not** a supported way to
upgrade an anonymous user to a logged-in one. Two things change that you cannot
undo:

- **The user may flip variant.** Assignments are fetched per user id, so the second
  `configure` gets a different map. Whatever the app already rendered was for the old
  identity.
- **Attribution splits.** Exposures already recorded carry the old id, everything after
  carries the new one, and results match events to a user by the id their exposure was
  recorded under. The two halves never meet — no error, just a metric quietly missing
  conversions.

Queued telemetry itself is safe: `configure` drains the previous configuration in the
background rather than discarding it. Use `await reset()` first if you need certainty
that the drain completed.

If the user is unknown until an auth request returns, either **stay anonymous** for the
life of the experiment and let the generated track id be the randomization unit, or
**configure once auth resolves** and render defaults until then.

## Event submission

Exposures and events are queued and submitted in small batches in the background. The queue also drains when the app leaves the foreground (`AppState` → `inactive`/`background`) with fire-and-forget requests — background JS keeps running briefly on both platforms, and the browser tab-death tricks (`keepalive`, `sendBeacon`) are harmless no-ops here. Call `abmeter.flush()` at moments you want an eager drain.

If the OS kills the app before a background flush completes, that tail of the queue is lost. The SDK treats network loss as expected and never throws.

## API

| Function | Description |
| --- | --- |
| `configure(options)` | Initialize the SDK. Options: `apiKey` (required), `baseUrl`, `user: { userId?, email? }`, `flushInterval` (ms, default 1000), `logger`, `errorCallback`, `platform` (override the RN adapter). |
| `ready()` | Resolves once the first assignment fetch has settled. |
| `resolveParameter(slug)` | Resolved value for this user, or `undefined` if unknown. Queues an exposure lazily (deduplicated over a 10-minute window). |
| `getExposure(slug)` | The exposure metadata for a parameter (`null` for feature-flag/default resolutions), without queueing anything. |
| `trackEvent(eventSlug, customFields?)` | Queue an event for the configured user. |
| `flush()` | Drain the queue now (returns a promise). |
| `reset(options?)` | Drain fully and tear down timers/listeners. `configure` again to restart. |

All read/track functions are error-safe: failures are logged (and passed to `errorCallback` when configured) and return a safe default instead of throwing.
