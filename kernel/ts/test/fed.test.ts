// Food and drink boost regen (owner 2026-11-04, loka-vduxr.61) on the compiled fed sampler: hp 5 of
// 20 and mv 50 of 100 with no regen. Bread applies well_fed (hp +1 and mv +5 every 1200 for 3600);
// the stew applies well_fed for 7200; a drink of water applies refreshed (mv +5 every 600 for 1800).
// A tick lands strictly before the status ends, so 3600 / 1200 is 2 ticks and 7200 / 1200 is 5.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { validate } from '../src/foundation/validate.ts';
import { commands, ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fed-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fed_sampler', file, '--allow-placeholders'], {
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

const stream = commands('dddddddd-6666-4333-8444');
const { play } = stream;
const fresh = () => newWorld(content, ctx('7e1f0c2a-5d3b-4c8e-9a6f-000000000061'), [1, 2, 3, 4]);
// As the host: one elapsed command to each pending job, then to the target.
function wait(w: World, target: number): World {
  while (w.state.clock < target) {
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    stream.n += 1;
    const run_id = 'aaaaaaaa-0000-4000-8000-000000000061';
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
    w = r.world;
  }
  return w;
}
const id = (w: World, item: string) => w.entityIds[`fed_sampler@0.0.1:item/${item}`]!;
const pools = (w: World) => ['hp', 'mv'].map((k) => level(w, w.body, resourceRef(w, k)));
const labels = (w: World) => gameView(w).conditions?.map((c) => c.label);
const consume = (item: string) => {
  const w = fresh();
  const held = play(w, { type: 'take', item_id: id(w, item) });
  return play(held, { type: 'consume', item_id: id(held, item) });
};

// Breaks: an edible's applies is dropped, a multi-pool status ticks only its first pool, or a tick
// lands at the end (hp 8, mv 65).
test('bread makes you well fed: hp and mv rise twice, then it ends', () => {
  let w = consume('bread');
  const t0 = w.state.clock;
  assert.deepEqual(labels(w), ['condition.well_fed']);
  assert.deepEqual(validate('GameView', gameView(w)), []);
  w = wait(w, t0 + 3600);
  assert.deepEqual([pools(w), labels(w)], [[7, 60], undefined]);
});

// Breaks: an applies entry's duration is ignored (the stew ends at 3600 like bread, after 2 ticks).
test('a cooked meal keeps you well fed past the hour bread lasts', () => {
  let w = consume('stew');
  const t0 = w.state.clock;
  w = wait(w, t0 + 3600);
  assert.deepEqual([pools(w), labels(w)], [[8, 65], ['condition.well_fed']]);
  w = wait(w, t0 + 7200);
  assert.deepEqual([pools(w), labels(w)], [[10, 75], undefined]);
});

// Breaks: a Drink ignores the liquid's applies, or refreshed ticks hp as well.
test('a drink of water refreshes: mv rises twice, hp holds', () => {
  let w = consume('waterskin');
  const t0 = w.state.clock;
  assert.deepEqual(labels(w), ['condition.refreshed']);
  w = wait(w, t0 + 1800);
  assert.deepEqual([pools(w), labels(w)], [[5, 60], undefined]);
});
