import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stormClock, type StormNow } from './stormClock.ts';

function rig(t: { mock: any }, given: Partial<StormNow> = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Math, 'random', () => 0); // every interval at its low end: 20 s apart, thunder 1 s after
  t.mock.method(performance, 'now', () => 1_000_000);
  const s: StormNow = {
    world: true,
    turned: -Infinity,
    exposed: true,
    still: false,
    flashes: true,
    washed: -Infinity,
    entry: 0,
    ...given,
  };
  const log: string[] = [];
  const stop = stormClock(() => s, {
    light: () => log.push('light'),
    thunder: (m) => log.push(m ? 'muffled' : 'thunder'),
    heavy: () => log.push('heavy'),
  });
  return {
    s,
    log,
    stop,
    tick: (ms: number) => {
      for (let left = ms; left > 0; left -= 1) t.mock.timers.tick(1); // a timer set in a timer: one tick does not reach it
    },
  };
}

// Breaks: lightning strikes through a page in its curl (499 ms in; at 500 the curl is over).
test('a page in its curl neither strikes nor thunders; the moment it lands it can', (t) => {
  const r = rig(t, { turned: 1_000_000 - 499 });
  r.tick(21_000);
  assert.deepEqual(r.log, []);
  r.s.turned = 1_000_000 - 500;
  r.tick(19_000);
  assert.deepEqual(r.log, ['light']);
});

// Breaks: the light does not lead the thunder by the spec's second, or the first interval is not 20 s.
test('an exposed page strikes at 20 s and thunders 1 s after, heavy once', (t) => {
  const r = rig(t);
  r.tick(19_999);
  assert.deepEqual(r.log, []);
  r.tick(1);
  assert.deepEqual(r.log, ['light']);
  r.tick(1000);
  assert.deepEqual(r.log, ['light', 'thunder', 'heavy']);
  r.tick(20_000);
  assert.deepEqual(r.log.slice(3), ['light', 'thunder']); // same room: no second heavy
  r.s.entry = 1;
  r.tick(20_000);
  assert.deepEqual(r.log.slice(5), ['light', 'thunder', 'heavy']); // a new entry's first
  r.stop();
});

// Breaks: reduced motion, Flashes off or a recent wash draws light, or takes the thunder with it.
for (const given of [{ still: true }, { flashes: false }, { washed: 1_000_000 - 1 }])
  test(`no light, thunder kept: ${JSON.stringify(given)}`, (t) => {
    const r = rig(t, given);
    r.tick(21_000);
    assert.deepEqual(r.log, ['thunder', 'heavy']);
    r.stop();
  });

// Breaks: an indoor storm flashes or buzzes.
test('not exposed: no light, muffled thunder, no haptic', (t) => {
  const r = rig(t, { exposed: false });
  r.tick(21_000);
  assert.deepEqual(r.log, ['muffled']);
  r.stop();
});

// Breaks: a storm strikes over Combat, a scene or a curl.
test('off the World page nothing strikes, and the clock keeps running', (t) => {
  const r = rig(t, { world: false });
  r.tick(21_000);
  assert.deepEqual(r.log, []);
  r.s.world = true;
  r.tick(19_000);
  assert.deepEqual(r.log, ['light']);
  r.stop();
});

// Breaks: leaving the storm leaves a late thunder or a timer running.
test('stop cancels both timers', (t) => {
  const r = rig(t);
  r.tick(20_000);
  r.stop();
  r.tick(100_000);
  assert.deepEqual(r.log, ['light']);
});
