import { configure as coreConfigure } from 'abmeter';
import { createReactNativeAdapter } from './adapter';
import type { ConfigInput, PlatformAdapter } from 'abmeter';

export type ReactNativeConfigInput = Omit<ConfigInput, 'platform'> & {
  platform?: PlatformAdapter;
};

/**
 * Initialize the SDK with the React Native platform pre-filled. Identity
 * (the AsyncStorage-persisted track id), cache hydration, and the first
 * assignments fetch all settle behind ready() — same contract as the browser
 * core.
 */
export function configure(input: ReactNativeConfigInput): void {
  coreConfigure({ ...input, platform: input.platform ?? createReactNativeAdapter() });
}

export { ready, resolveParameter, getExposure, trackEvent, flush, reset, ApiError } from 'abmeter';
export { createReactNativeAdapter } from './adapter';
export { VERSION } from './version';

export type {
  Assignment,
  AssignmentsPayload,
  Config,
  ConfigInput,
  ErrorCallback,
  ExposureMetadata,
  ExposureRecord,
  Logger,
  PlatformAdapter,
  PlatformLifecycle,
  PlatformStorage,
  User,
  UserInput,
} from 'abmeter';
