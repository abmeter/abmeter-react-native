import { defineConfig } from 'tsup';

// dist/index.mjs + dist/index.cjs + dist/index.d.ts — the npm package.
// No CDN/iife build: React Native code always arrives through a bundler.
// The core and the two peers stay external; Metro resolves them in the app.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  target: 'es2020',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['abmeter', 'react-native', '@react-native-async-storage/async-storage'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
