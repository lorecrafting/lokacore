// The cue bus live: useCues driven by hand on a mock clock, and its one line in the real Book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { onCue, useCues } = await import('./cues.ts');
const { motion } = await import('./tokens.ts');

const place = (id: string, more = {}) =>
  ({ place: { id }, inventory: [], journal: [], ...more }) as unknown as GameView;
const hit = (hp: number) =>
  place('p', { combat: {}, resources: [{ resource: { key: 'hp' }, current: hp }] });

// The hook's clock is monotonic; node's mock timers leave performance alone.
function clock(t: any) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  return (ms: number, early = 0) => {
    now += ms - early;
    t.mock.timers.tick(ms);
  };
}

// One hook instance: its refs held, its effect rerun when a dep moves, as React does.
function mount() {
  const slots: unknown[] = [];
  let i = 0;
  let deps: unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  const draw = (view: GameView, catchingUp: boolean, turn: number, resumes = 0) => {
    i = 0;
    const g = globalThis as any;
    g[Symbol.for('loka-book-test-state')] = (v: unknown) => [(slots[i++] ??= v), () => {}];
    g[Symbol.for('loka-book-test-effect')] = (f: () => () => void, d: unknown[]) => {
      if (deps && d.every((x, j) => Object.is(x, deps![j]))) return;
      deps = d;
      cleanup?.();
      cleanup = f();
    };
    useCues(view, catchingUp, turn, resumes);
  };
  return Object.assign(draw, { unmount: () => cleanup?.() });
}
function listen(t: { after: (f: () => void) => void }) {
  const heard: string[] = [];
  t.after(onCue((c) => heard.push(c.name)));
  return heard;
}

// Breaks: opening a save plays what it holds; or nothing is ever published.
test('a first view is silent, the next change is published', (t) => {
  const heard = listen(t);
  const draw = mount();
  draw(place('a'), false, 0);
  assert.deepEqual(heard, []);
  draw(place('b'), false, 0);
  assert.deepEqual(heard, ['place']);
});

// Breaks: a catch-up chunk, or the ready view that ends it, plays the time away.
test('catch-up is silent to its end, and the view after it is heard', (t) => {
  const heard = listen(t);
  const draw = mount();
  draw(place('a'), false, 0);
  draw(place('b'), true, 0);
  draw(place('c'), true, 0);
  draw(place('d'), false, 0);
  assert.deepEqual(heard, []);
  draw(place('e'), false, 0);
  assert.deepEqual(heard, ['place']);
});

// Breaks: the pending blow never plays, plays early, or its timer survives a redraw.
test('a pending cue plays when the beat ends', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const draw = mount();
  draw(hit(9), false, 0);
  draw(hit(8), false, 0);
  draw(hit(7), false, 0);
  assert.deepEqual(heard, ['hp_loss']);
  tick(499);
  assert.deepEqual(heard, ['hp_loss']);
  tick(1);
  assert.deepEqual(heard, ['hp_loss', 'hp_loss']);
});

// Breaks: a timer landing a hair early strands the pending blow until some other change.
test('a timer landing early waits again', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const draw = mount();
  draw(hit(9), false, 0);
  draw(hit(8), false, 0);
  draw(hit(7), false, 0);
  tick(500, 1);
  assert.deepEqual(heard, ['hp_loss']);
  tick(1);
  assert.deepEqual(heard, ['hp_loss', 'hp_loss']);
});

// Breaks: a closed Book plays its pending blow; a listener that left still hears.
test('unmounting drops the pending cue, unsubscribing stops the listener', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const gone: string[] = [];
  const off = onCue((c) => gone.push(c.name));
  const draw = mount();
  draw(hit(9), false, 0);
  draw(hit(8), false, 0);
  off();
  draw(hit(7), false, 0);
  draw.unmount();
  tick(1000);
  assert.deepEqual(heard, ['hp_loss']);
  assert.deepEqual(gone, ['hp_loss']);
});

// Breaks: a turn leaves the old page's blow to play on the new page, or every view counts as a turn.
test('a page turn cancels the pending cue', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const draw = mount();
  draw(hit(9), false, 0);
  draw(hit(8), false, 0);
  draw(hit(7), false, 0);
  draw(hit(7), false, 1);
  tick(1000);
  assert.deepEqual(heard, ['hp_loss']);
});

// Breaks: held cues never get a timer, or the timer outlives the Book.
test('the arriving page cues play at the picture deadline, unless the Book unmounts', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const draw = mount();
  draw(place('a'), false, 0);
  draw(place('b'), false, 1);
  assert.deepEqual(heard, []);
  tick(motion.quick.duration - 1);
  assert.deepEqual(heard, []);
  tick(1);
  assert.deepEqual(heard, ['place']);
  draw(place('c'), false, 2);
  draw.unmount();
  tick(1000);
  assert.deepEqual(heard, ['place']);
});

// Breaks: an absence drained in one pulse is heard as cues (status_out here); or a plain clock tick,
// or the first press after coming back, is silenced with it.
test('what a resume settled is silent; the same time passing while open is not', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const statused = () => {
    const b = book(compiled('cartridges/recap_sampler') as never);
    for (const d of ['east', 'west']) b.go(d);
    b.draw();
    tick(1000);
    assert.ok(b.game.view().view.conditions?.length, 'poisoned before the absence');
    heard.length = 0;
    b.clock.wall += 60000;
    b.clock.mono += 60000;
    return b;
  };
  const away = statused();
  assert.equal(away.game.pulse('resume').kind, 'ready');
  away.draw();
  assert.deepEqual(heard, []);
  away.go('east');
  away.draw();
  tick(1000);
  assert.ok(heard.includes('place'), JSON.stringify(heard));
  away.unmount();
  const open = statused();
  assert.equal(open.game.pulse('active').kind, 'ready');
  open.draw();
  tick(1000);
  assert.ok(heard.includes('status_out'), JSON.stringify(heard));
  open.unmount();
});

// Breaks: Book stops feeding the bus, passes the wrong view, or a restored save is heard.
test('the Book publishes a walk, and is silent opening and reopening', (t) => {
  const tick = clock(t);
  const heard = listen(t);
  const showcase = compiled('cartridges/toolbox_showcase') as never;
  const b = book(showcase);
  assert.deepEqual(heard, []);
  b.go(b.game.view().view.exits[0]!.direction);
  b.draw();
  tick(1000);
  assert.ok(heard.includes('place'), JSON.stringify(heard));
  const more = heard.length;
  const again = book(showcase, { sql: b.sql, clock: b.clock } as never);
  assert.equal(heard.length, more);
  again.unmount();
  b.unmount();
});
