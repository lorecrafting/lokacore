// The author's Why replays game.trace(), so an idle tail must be in it (why.ts, `now`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const START = 64800; // elapsedBundle's calendar start

// Break: game.trace() reads the rows without catching up, so Why replays a world behind the clock.
test('the author trace covers an idle tail, and a later tick still merges into its entry', () => {
  const a = elapsedHost();
  const tick = () => {
    a.clock.wall += 250;
    a.clock.mono += 250;
    assert.equal(a.game.pulse().kind, 'ready');
  };
  const spans = () =>
    a.game.trace().flatMap((r) => {
      const { command } = JSON.parse(r).data;
      return command ? [[command.payload.from, command.payload.until]] : [];
    });
  for (let i = 0; i < 12; i++) tick();
  assert.deepEqual(spans(), [[START, START + 150]]); // 3000 ms at 50 units per 1000 ms
  tick();
  assert.deepEqual(spans(), [[START, START + 162]]); // 162.5 whole units
  a.sql.close();
});
