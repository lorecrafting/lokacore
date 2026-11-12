// R1 (docs/design/story-tooling.md §2): the verdict a checkpoint's replay becomes, and that
// `bin/loka check`'s report is the same one the watcher pushes. The replay itself is the preview's
// own (`replay`); this file names the break each assertion catches.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verdict } from '../play/checkpoints.ts';

test('a path that replays is ok, and carries no step', () => {
  // break: reporting a passing path as failed, or inventing a step number for one
  assert.deepEqual(verdict('to_the_well', undefined), { name: 'to_the_well', ok: true });
});

test("a refused step's number is the one replay named, not the array index", () => {
  // break: off-by-one in the step number, so the card names the wrong line of the path
  assert.deepEqual(verdict('well', 'step 4 (advance 60000): over the 1-minute budget'), {
    name: 'well',
    ok: false,
    step: 4,
    why: 'over the 1-minute budget',
  });
});

test('the step number and its words are not printed twice', () => {
  // break: keeping replay's own "step N (…)" prefix, so the row reads "step 4: step 4 (…): …"
  const v = verdict('well', 'step 2 (move north): rejected invalid_target');
  assert.ok(!v.ok);
  assert.equal(v.why, 'rejected invalid_target');
  assert.ok(!/^step \d/.test(v.why), `why must not restate its step: ${v.why}`);
});

test('a refusal that names no step keeps its words and says no step', () => {
  // break: dropping the words of a failure whose shape replay changed, leaving an empty reason
  assert.deepEqual(verdict('well', 'not replayed (a checkpoint is {"steps": [...]})'), {
    name: 'well',
    step: 0,
    ok: false,
    why: 'not replayed (a checkpoint is {"steps": [...]})',
  });
});
