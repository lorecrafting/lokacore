// The author terminal drops Metro's harmless WARN entries and keeps real warnings and errors
// (mobile/app/quiet-metro.cjs): a filter too wide would hide the author's own errors.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { quiet } = createRequire(import.meta.url)('./quiet-metro.cjs');

test('drops each noisy entry with its continuation lines and keeps the rest', () => {
  const lines = [
    'Web Bundled 12ms index.ts',
    'Web  WARN  Require cycle: a.ts -> b.ts -> a.ts',
    '',
    'Require cycles are allowed, but can result in uninitialized values.',
    'Web  WARN  Using synchronous SQLite operations can cause significant performance impact.',
    'Web  WARN  props.pointerEvents is deprecated. Use style.pointerEvents',
    'Web  WARN  Something real',
    'its explanation',
    'Web  ERROR  Compile failed',
  ];
  const keep = quiet();
  assert.deepEqual(lines.filter(keep), [
    lines[0],
    'Web  WARN  Something real',
    'its explanation',
    'Web  ERROR  Compile failed',
  ]);
});
