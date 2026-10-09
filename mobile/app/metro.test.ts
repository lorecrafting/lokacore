// The bundle's kernel commit stamp (metro.config.js, ADR-075 §3) when git fails.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// Breaks (ADR-075 §3): git fails (a source copy without .git) and an old clean stamp in the
// environment is kept, so a modified build reports a clean SHA instead of the zero-commit -dirty.
test('git failing drops an inherited stamp', () => {
  const bin = mkdtempSync(join(tmpdir(), 'loka-nogit-'));
  writeFileSync(join(bin, 'git'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(bin, 'git'), 0o755);
  const out = execFileSync(
    process.execPath,
    ['-e', "process.stdout.write(JSON.stringify(require('./metro.config.js').cacheVersion))"],
    {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      env: { PATH: bin, EXPO_PUBLIC_KERNEL_COMMIT: 'a'.repeat(40) },
    },
  );
  assert.equal(out, '""');
});

// Breaks: the author preview's switch is inverted or ignored, so a release, test or e2e bundle plays
// the dev artifact, or the author preview keeps playing the pinned chapter, or a production bundle
// takes the dev artifact.
test('only LOKA_DEV_CARTRIDGE points the app at the dev artifact', () => {
  const dev = join(mkdtempSync(join(tmpdir(), 'loka-dev-')), 'current.json');
  writeFileSync(dev, '{}');
  const resolved = (env: Record<string, string>) =>
    execFileSync(
      process.execPath,
      [
        '-e',
        `const { resolver } = require('./metro.config.js');
         const context = { originModulePath: require('path').resolve('App.tsx'), resolveRequest: () => 'pinned' };
         const name = '../../protocol/fixtures/missing_child_v042_hash.json';
         process.stdout.write(JSON.stringify(resolver.resolveRequest?.(context, name, 'web') ?? 'pinned'));`,
      ],
      { cwd: import.meta.dirname, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } },
    );
  assert.equal(resolved({}), '"pinned"');
  assert.deepEqual(JSON.parse(resolved({ LOKA_DEV_CARTRIDGE: dev })), {
    type: 'sourceFile',
    filePath: dev,
  });
  assert.throws(() => resolved({ LOKA_DEV_CARTRIDGE: dev, NODE_ENV: 'production' }));
});
