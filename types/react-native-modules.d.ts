// Minimal ambient declarations for the two peer dependencies, covering only
// what src/ touches. The monorepo deliberately installs no React Native
// toolchain (no Metro, no react, no emulator — the GrowthBook approach);
// consumers compile against the real types shipped by the actual packages.
// Never published: types/ is outside the tarball allow-list.

declare module 'react-native' {
  export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

  export interface NativeEventSubscription {
    remove(): void;
  }

  export const AppState: {
    currentState: AppStateStatus;
    addEventListener(
      type: 'change',
      listener: (state: AppStateStatus) => void
    ): NativeEventSubscription;
  };
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  export default AsyncStorage;
}
