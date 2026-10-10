// Toolbox rows G13 and W25 (dry) on the compiled needs sampler: 3600 units an hour, 24 a day;
// weather clear / drought, weight 1 each. Entering the track applies hungry and thirsty (1 point an
// hour for a day); on a drought day the exposed flats apply parched (1 thirst every 1800 for 5400,
// refreshed each hour). Bread cures hungry; a Drink of water cures thirsty and parched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

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
let n = 0;
const fresh = () => newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
function play(w: World, p: object): World {
  n += 1;
  const r = step(
    w,
    {
      id: `dddddddd-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
// One elapsed command to `until`; returns the world and its committed events.
function elapse(w: World, until: number) {
  n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000025';
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
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

// Breaks: either loader accepts a liquid's cures below kernel_api 1.46 or naming no status.
test('the loader refuses a liquid cure below 1.46 or naming no status', () => {
  const water = 'needs_sampler@0.0.1:liquid/water';
  const rows: [(c: Obj) => void, string, string][] = [
    [
      (c) => {
        // The clock_hour reaction alone needs 1.46 (row W25); without it only the cure does.
        for (const k of Object.keys(c.reactions))
          if (c.reactions[k].on.event === 'clock_hour') delete c.reactions[k];
        c.manifest.requires.kernel_api.at_least = '1.45';
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.liquids[water].cures[1].key = 'scurvy'),
      'UNRESOLVED_REFERENCE',
      `.cartridge.liquids[${JSON.stringify(water)}].cures[1]`,
    ],
  ];
  // Control: without the cures (and the clock_hour reaction) 1.45 loads.
  const uncured = (c: Obj) => {
    rows[0]![0](c);
    delete c.liquids[water].cures;
  };
  rows.push([uncured, 'loaded', '']);
  for (const [change, code, path] of rows) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? ['loaded', ''] : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
