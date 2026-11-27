// The builder's write wiring (author/build/roomedit.tsx `io`, `run`; split from roomedit.test.ts, size):
// which answers count as written, and a gesture with no server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../book/__tests__/combat-book.test.ts'; // registers the .tsx loader

const { io, run, wire } = await import('./build/roomedit.tsx');

// Breaks: a 3xx answer (not a write) taken as a saved write.
test('io: only a 2xx answer is ok', async () => {
  const at = (status: number) => (
    wire(
      async () => [status, null],
      () => {},
      () => {},
    ),
    io.post('move', {})
  );
  assert.deepEqual(
    [(await at(299)).ok, (await at(300)).ok, (await at(200)).ok, (await at(199)).ok],
    [true, false, true, false],
  );
});

// Breaks: a gesture with no server to write to reported as written, so a field forgets its words.
test('a gesture with no api never runs and is not written', async () => {
  let ran = false;
  wire(
    undefined,
    () => {},
    () => {},
  );
  assert.deepEqual([await run(async () => void (ran = true)), ran], [false, false]);
});
