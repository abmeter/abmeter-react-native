import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Node environment, not jsdom: React Native is not a DOM runtime, and the
// suite must prove the adapter works without one. The two RN peers resolve to
// in-repo mocks (no emulator, no Metro). The abmeter core resolves to the
// sibling working tree when it exists (the monorepo — always tests the
// current core); in the public mirror the sibling is absent and the alias is
// skipped, so the core comes from node_modules — the registry release
// bin/publish installs for the mirror run.
const coreSource = fileURLToPath(new URL('../sdk-js/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      ...(existsSync(coreSource) ? { abmeter: coreSource } : {}),
      'react-native': fileURLToPath(new URL('tests/mocks/react-native.ts', import.meta.url)),
      '@react-native-async-storage/async-storage': fileURLToPath(
        new URL('tests/mocks/async-storage.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // packaging.test.ts shells out to tsup + npm pack; give it room.
    testTimeout: 120_000,
  },
});
