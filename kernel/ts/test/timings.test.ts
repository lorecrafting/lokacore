// The edit budgets (kernel/ts/play/timings.ts): expected values from the E2 brief's budgets, not
// from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadOf, within } from '../play/timings.ts';

// Breaks: an edit over its budget shows as within (or the reverse); a structural edit's Book load
// is left out of its total.
test('timings are judged against the brief`s budgets', () => {
  const at = 1;
  assert.equal(within({ at, compile: 200, publish: 100, kind: 'prose' }), true);
  assert.equal(within({ at, compile: 200, publish: 101, kind: 'prose' }), false);
  assert.equal(within({ at, compile: 900, publish: 100, kind: 'structural' }, 500), true);
  assert.equal(within({ at, compile: 900, publish: 100, kind: 'structural' }, 501), false);
  assert.equal(within({ at, compile: 999, publish: 2, kind: 'refusal' }), false);
  const edit = { at: 1000, compile: 900, publish: 100, kind: 'structural', sha256: 'a' } as const;
  assert.equal(loadOf(edit, { sha256: 'a', at: 1400 }), 400);
  assert.equal(loadOf(edit, { sha256: 'b', at: 1400 }), 0, 'another artifact is not this load');
  assert.equal(
    loadOf(edit, { sha256: 'a', at: 999 }),
    0,
    'a load before the publish is the old Book',
  );
  assert.equal(loadOf({ ...edit, kind: 'prose' }, { sha256: 'a', at: 1400 }), 0);
});
