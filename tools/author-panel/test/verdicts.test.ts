// R1's panel rendering (docs/design/story-tooling.md §2): each checkpoint name gets a status word,
// `ok`, `not replayed yet`, or the refused step with its words. The watcher pushes `Checked[]`
// (kernel/ts/play/checkpoints.ts); this maps it onto the list the Play tab already draws.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Checked } from '../src/author.ts';
import { verdicts } from '../src/verdicts.ts';

const ok = (name: string): Checked => ({ name, ok: true });
const broke = (name: string, step: number, why: string): Checked => ({ name, ok: false, step, why });

test('a passing path reads ok', () => {
  // break: showing a passing checkpoint as broken, so the owner chases a good path
  assert.deepEqual(verdicts(['well'], [ok('well')]), [{ name: 'well', ok: true, said: 'ok' }]);
});

test('a failed path names its step and the step’s words', () => {
  // break: dropping the reason, leaving "refused" with no telling what refused
  assert.deepEqual(verdicts(['well'], [broke('well', 4, 'over the budget')]), [
    { name: 'well', ok: false, said: 'step 4, refused: over the budget' },
  ]);
});

test('a name the watcher has not pushed yet is not called broken', () => {
  // break: defaulting an unread checkpoint to failed, so a fresh start shows red for nothing
  assert.deepEqual(verdicts(['new'], []), [{ name: 'new', ok: true, said: 'not replayed yet' }]);
});

test('a failure that names no step still says why', () => {
  // break: printing "step 0" for a file that is not a checkpoint at all
  assert.deepEqual(verdicts(['bad'], [broke('bad', 0, 'not replayed (bad json)')]), [
    { name: 'bad', ok: false, said: 'refused: not replayed (bad json)' },
  ]);
});
