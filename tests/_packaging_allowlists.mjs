// Single source of truth for the npm-tarball file boundary — the React Native
// twin of sdk-js/tests/_packaging_allowlists.mjs, same two callers:
//   * tests/packaging.test.ts imports it — the every-commit guard.
//   * bin/publish executes it as a script against the tarball it uploads.
//
// Both check the *packed file list*, never the `files` config that produced it,
// and both directions: an allow-list catches a tarball shipping too much, the
// required-file list catches one shipping too little.

export const TARBALL_ALLOWED_RE = /^(dist\/|src\/|README\.md$|LICENSE$|package\.json$)/;

// One entry per artifact the exports map promises. No iife build here — React
// Native code always arrives through a bundler, never a CDN script tag.
export const TARBALL_REQUIRED = [
  'dist/index.mjs',
  'dist/index.cjs',
  'dist/index.d.ts',
  'src/index.ts',
  'package.json',
  'README.md',
  'LICENSE',
];

// Redundant with the allow-list by construction, and deliberately so: naming
// the monorepo-only paths gives a specific, actionable error for the exact
// regressions this guard exists to catch. types/ carries the ambient shims for
// the two peers — a shipped copy would collide with consumers' real types.
export const TARBALL_FORBIDDEN_RE = /^(tests\/|bin\/|types\/|mise\.toml$|CLAUDE\.md$|eslint\.config\.js$|tsup\.config\.ts$|vitest\.config\.ts$|tsconfig\.json$)/;

export function tarballViolations(files) {
  const present = new Set(files);
  return {
    disallowed: files.filter((file) => !TARBALL_ALLOWED_RE.test(file)),
    forbidden: files.filter((file) => TARBALL_FORBIDDEN_RE.test(file)),
    missing: TARBALL_REQUIRED.filter((file) => !present.has(file)),
  };
}

// `npm pack --dry-run --json` output → the packed file paths.
export function filesFromPackJson(packJson) {
  const [report] = packJson;
  if (!report || !Array.isArray(report.files)) {
    throw new Error('unexpected `npm pack --json` output: no files array');
  }
  return report.files.map((file) => file.path);
}

function printViolations(header, files, hint) {
  console.error(`ERROR: ${header}`);
  for (const file of files) console.error(`  - ${file}`);
  console.error(hint);
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const files = filesFromPackJson(JSON.parse(Buffer.concat(chunks).toString('utf8')));

  const report = tarballViolations(files);
  const hint = 'Fix the `files` allow-list in package.json.';
  let ok = true;

  if (report.disallowed.length > 0) {
    printViolations('tarball would ship files outside the allowed set:', report.disallowed, hint);
    ok = false;
  }
  if (report.forbidden.length > 0) {
    printViolations('tarball would ship monorepo-only paths:', report.forbidden, hint);
    ok = false;
  }
  if (report.missing.length > 0) {
    printViolations('tarball is missing required files:', report.missing, hint);
    ok = false;
  }

  if (!ok) {
    console.error('Aborting before upload.');
    process.exit(1);
  }
  console.log('OK - tarball contains only allowed files.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
