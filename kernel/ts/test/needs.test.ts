// Toolbox rows G13 and W25 (dry) on the compiled needs sampler: 3600 units an hour, 24 a day;
// weather clear / drought, weight 1 each. Entering the track applies hungry and thirsty (1 point an
// hour for a day); on a drought day the exposed flats apply parched (1 thirst every 1800 for 5400,
// refreshed each hour). Bread cures hungry; a Drink of water cures thirsty and parched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { validate } from '../src/foundation/validate.ts';
import { commands, ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-needs-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/needs_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

// Oracle, independent of the kernel: for d in 1..2 the first 4 bytes of
// `printf 'weather:<CONTEXT>:<d>' | shasum -a 256`, mod 2: 1, 0 (drought, clear).
const CONTEXT = '7e1f0c2a-5d3b-4c8e-9a6f-000000000004';
const HOUR = 3600;
const stream = commands('dddddddd-5555-4333-8444');
const { play } = stream;
const fresh = () => newWorld(content, ctx(CONTEXT), [1, 2, 3, 4]);
// One elapsed command to `until`; returns the world and its committed events.
function elapse(w: World, until: number) {
  stream.n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000025';
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    stream.n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return {
    w: r.world,
    events: (r.decision as unknown as { events: { payload: { type: string } }[] }).events,
  };
}
// As the host (mobile/authority/local-story/elapsed.ts boundary): stop at each pending job but the
// calendar job, which runs once in whichever step passes it.
function wait(w: World, target: number): World {
  while (w.state.clock < target) {
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending' && j.job.kind !== 'calendar')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    w = elapse(w, until).w;
  }
  return w;
}
const id = (w: World, item: string) => w.entityIds[`needs_sampler@0.0.1:item/${item}`]!;
const pool = (w: World, key: string) => level(w, w.body, resourceRef(w, key));
const labels = (w: World) => gameView(w).conditions?.map((c) => c.label);
const supplied = () => {
  const w = play(fresh(), { type: 'take', item_id: id(fresh(), 'bread') });
  return play(w, { type: 'take', item_id: id(w, 'waterskin') });
};

// Breaks: a Drink ignores the liquid's cures (thirst keeps falling to 1 after six more hours), bread
// ends the wrong status, or a cure leaves its pending tick draining (row 1).
test('the track drains hunger and thirst an hour at a time; bread and a drink end them', () => {
  let w = play(supplied(), { type: 'move', direction: 'east' });
  assert.deepEqual(labels(w), ['condition.hungry', 'condition.thirsty']);
  w = wait(w, 3 * HOUR);
  assert.deepEqual([pool(w, 'hunger'), pool(w, 'thirst')], [7, 7]);
  w = play(w, { type: 'eat', item_id: id(w, 'bread') });
  assert.deepEqual(labels(w), ['condition.thirsty']);
  w = play(w, { type: 'drink', vessel_id: id(w, 'waterskin') });
  assert.equal(labels(w), undefined);
  w = wait(w, 9 * HOUR);
  assert.deepEqual([pool(w, 'hunger'), pool(w, 'thirst')], [7, 7]);
});

// Breaks: Pour applies the liquid's cures (only a Drink does), so pouring the waterskin into a cup
// ends thirsty.
test('pouring the water out ends no status', () => {
  const c = structuredClone(content) as any;
  const skin = c.items['needs_sampler@0.0.1:item/waterskin'];
  c.items['needs_sampler@0.0.1:item/cup'] = {
    ...skin,
    keywords: ['cup'],
    vessel: { ...skin.vessel, initial: { kind: null, quantity: 0 } },
  };
  let w = newWorld(c, ctx(CONTEXT), [1, 2, 3, 4]);
  for (const item of ['waterskin', 'cup']) w = play(w, { type: 'take', item_id: id(w, item) });
  w = play(w, { type: 'move', direction: 'east' });
  w = play(w, { type: 'pour', source_id: id(w, 'waterskin'), receiver_id: id(w, 'cup') });
  assert.deepEqual(labels(w), ['condition.hungry', 'condition.thirsty']);
});

// Breaks: the dry drain ignores the weather (a clear day parches) or the room tag, a Drink does not
// end it (in the inn it would tick on to 4 before expiring at 12600), it reaches hp or kills, or
// the need pools read the world's hp bands.
test('a dry day on the flats drains thirst until a drink, and never past the pool floor', () => {
  let w = play(supplied(), { type: 'move', direction: 'north' });
  assert.deepEqual(labels(w), ['condition.parched']);
  w = wait(w, 2 * HOUR);
  assert.equal(pool(w, 'thirst'), 6);
  w = play(w, { type: 'move', direction: 'south' });
  w = play(w, { type: 'drink', vessel_id: id(w, 'waterskin') });
  assert.equal(labels(w), undefined);
  w = wait(w, 6 * HOUR);
  assert.equal(pool(w, 'thirst'), 6);

  const clear = play(wait(fresh(), 24 * HOUR + 1), { type: 'move', direction: 'north' });
  assert.equal(labels(clear), undefined, 'day 2 is clear');
  assert.equal(pool(wait(clear, 26 * HOUR), 'thirst'), 10);

  const day = wait(play(fresh(), { type: 'move', direction: 'north' }), 24 * HOUR - 1);
  assert.deepEqual([pool(day, 'thirst'), pool(day, 'hp')], [0, 10]);
  assert.deepEqual(labels(day), ['condition.parched']);
  // The empty pool reads as its own band, not the world's hp band "dying".
  const thirst = gameView(day).resources?.find((r) => r.resource.key === 'thirst');
  assert.deepEqual([thirst?.band, thirst?.tone], ['parched', 'danger']);
});

// Breaks (row W8, loka-rn3b): a ticking permanent status gets an end or a ring (ends_at, duration),
// expires with the day as the timed thirsty does, stops ticking after its first tick, or survives
// its cure.
test('a permanent hungry ticks past the day until bread cures it', () => {
  const c = structuredClone(content) as any;
  const spec = c.statuses['needs_sampler@0.0.1:status/hungry'];
  spec.duration = 'permanent';
  delete spec.narration.expired;
  const start = newWorld(c, ctx(CONTEXT), [1, 2, 3, 4]);
  let w = play(start, { type: 'take', item_id: id(start, 'bread') });
  w = play(w, { type: 'move', direction: 'east' });
  const t0 = w.state.clock;
  const hungry = () => gameView(w).conditions?.find((r) => r.label === 'condition.hungry');
  const view = {
    label: 'condition.hungry',
    resource: 'hunger',
    per_tick: -1,
    tick_every: HOUR,
    kind: 'debuff',
  };
  assert.deepEqual(hungry(), { ...view, next_tick_at: t0 + HOUR });
  assert.deepEqual(validate('GameView', gameView(w)), []);
  w = wait(w, t0 + 30 * HOUR + 1);
  assert.deepEqual(labels(w), ['condition.hungry']);
  assert.deepEqual(hungry(), { ...view, next_tick_at: t0 + 31 * HOUR });
  assert.equal(pool(w, 'hunger'), 0);
  w = play(w, { type: 'eat', item_id: id(w, 'bread') });
  assert.equal(labels(w), undefined);
});
