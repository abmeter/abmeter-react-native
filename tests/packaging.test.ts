// @vitest-environment node
//
// Tarball content guard, the React Native twin of sdk-js/tests/packaging.test.ts.
// Builds dist/ with tsup, walks `npm pack --dry-run --json`, and checks the
// file list against tests/_packaging_allowlists.mjs — the same module
// bin/publish runs against the tarball it is about to upload.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';
import { filesFromPackJson, tarballViolations } from './_packaging_allowlists.mjs';

const SDK_ROOT = fileURLToPath(new URL('..', import.meta.url));
// The adapter is glue over the external core; if it grows past this something
// core-shaped is being duplicated here instead of behind the platform seam.
const MAX_GZIP_BYTES = 4 * 1024;

let files: string[];

beforeAll(() => {
  execFileSync('npx', ['tsup'], { cwd: SDK_ROOT, stdio: 'pipe' });
  const packOutput = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: SDK_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
  files = filesFromPackJson(JSON.parse(packOutput));
});

describe('npm tarball boundary', () => {
  it('ships only dist/, src/, README.md, LICENSE, package.json', () => {
    expect(tarballViolations(files).disallowed).toEqual([]);
  });

  it('excludes monorepo-only paths (including the types/ shims)', () => {
    expect(tarballViolations(files).forbidden).toEqual([]);
  });

  it('contains every artifact the exports map promises', () => {
    expect(tarballViolations(files).missing).toEqual([]);
  });
});

describe('release invariants', () => {
  it('keeps src/version.ts in sync with package.json', () => {
    const { version } = JSON.parse(readFileSync(`${SDK_ROOT}/package.json`, 'utf8'));
    expect(VERSION).toBe(version);
  });

  it('exposes ./package.json through the exports map', () => {
    const require = createRequire(import.meta.url);
    expect(require.resolve('@abmeter/react-native/package.json')).toBe(`${SDK_ROOT}package.json`);
  });

  it('keeps the core external in the built bundle', () => {
    // Metro must resolve the app's own abmeter install; a bundled copy would
    // fork the singleton state (configure in one copy, resolve in another).
    const bundle = readFileSync(`${SDK_ROOT}/dist/index.mjs`, 'utf8');
    expect(bundle).toMatch(/from\s+['"]abmeter['"]/);
  });
});

describe('bundle size', () => {
  it(`keeps the adapter ESM bundle under ${MAX_GZIP_BYTES / 1024} KB gzipped`, () => {
    const bundle = readFileSync(`${SDK_ROOT}/dist/index.mjs`);
    const gzipped = gzipSync(bundle, { level: 9 }).byteLength;
    expect(gzipped).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });
});
