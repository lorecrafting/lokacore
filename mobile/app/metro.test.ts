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
