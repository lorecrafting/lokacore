// R1's cache key (kernel/ts/play/recheck.ts): `checkpoints/` is outside the compiled artifact
// (lib/loka/content/source_files.ex:15), so the artifact sha alone would replay a second, different
// path as the first one's verdict — the bug a reviewer found by editing a checkpoint and seeing
// nothing change. The key must follow the checkpoint bytes.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { only } from '../play/recheck.ts';

const dir = () => {
  const d = mkdtempSync(join(tmpdir(), 'loka-only-'));
  mkdirSync(join(d, 'checkpoints'));
  return d;
};

test('the same artifact and the same path key the same', () => {
  const d = dir();
  writeFileSync(join(d, 'checkpoints/a.json'), '{"steps":[]}');
  // break: a key that varies by call, so every compile re-runs every replay
  assert.equal(only(d, 'ab'.repeat(32)), only(d, 'ab'.repeat(32)));
  rmSync(d, { recursive: true, force: true });
});

test('an edited path keys differently, though the artifact sha is unchanged', () => {
  const d = dir();
  const sha = 'cd'.repeat(32);
  writeFileSync(join(d, 'checkpoints/a.json'), '{"steps":[]}');
  const before = only(d, sha);
  writeFileSync(join(d, 'checkpoints/a.json'), '{"steps":[1]}');
  // break: keying on the artifact sha alone, so an edited checkpoint keeps its old verdict
  assert.notEqual(only(d, sha), before);
  rmSync(d, { recursive: true, force: true });
});

test('a renamed path keys differently', () => {
  const d = dir();
  const sha = 'ef'.repeat(32);
  writeFileSync(join(d, 'checkpoints/a.json'), '{"steps":[]}');
  const before = only(d, sha);
  rmSync(join(d, 'checkpoints/a.json'));
  writeFileSync(join(d, 'checkpoints/b.json'), '{"steps":[]}');
  // break: keying on contents only, so renaming a path silently keeps the old name's verdict
  assert.notEqual(only(d, sha), before);
  rmSync(d, { recursive: true, force: true });
});
