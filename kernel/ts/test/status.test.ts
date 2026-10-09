// Toolbox row 1 on the compiled status sampler: the dart corridor poisons on entry, the antidote
// cures, the shrine blesses, and a fatal tick runs the ordinary death return.
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
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-status-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/status_sampler', file], {
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
const fresh = () =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
const antidote = (w: World) => w.entityIds['status_sampler@0.0.1:item/antidote'];
let n = 0;
function play(w: World, p: object): World {
  n += 1;
  const r = step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
// The host advances to the earliest pending job first (mobile/authority/local-story/elapsed.ts
// boundary), so a long wait is a chain of bounded elapsed commands.
function wait(w: World, seconds: number): World {
  const target = w.state.clock + seconds;
  while (w.state.clock < target) {
    n += 1;
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    const run_id = 'aaaaaaaa-0000-4000-8000-000000000010';
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
        world_context_id: w.context,
        payload: {
          type: 'elapsed',
          actor_id: w.character,
          run_id,
          from: w.state.clock,
          until,
        } as never,
      },
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
  }
  return w;
}
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'));
const withPool = (w: World, pool: string, value: number): World => ({
  ...w,
  state: {
    ...w.state,
    resources: {
      ...w.state.resources,
      [key({ kind: 'resource', entity_id: w.body, resource: resourceRef(w, pool) })]: {
        value,
        at: w.state.clock,
        rate: pool === 'mv' ? 18 : 0,
        remainder: 0,
      },
    },
  },
});

// Breaks: entry applies nothing, a tick drains the wrong amount or direction, the tick at the end
// still drains, or expiry leaves the condition on the Character page.
test('the dart corridor poisons for four ticks and then expires', () => {
  let w = fresh();
  const t0 = w.state.clock;
  assert.equal(gameView(w).conditions, undefined);
  w = play(w, { type: 'move', direction: 'east' });
  assert.deepEqual(gameView(w).conditions, [
    {
      label: 'condition.poisoned',
      ends_at: t0 + 300,
      next_tick_at: t0 + 60,
      resource: 'hp',
      per_tick: -1,
      tick_every: 60,
    },
  ]);
  w = wait(w, 60);
  assert.equal(hp(w), 9);
  assert.equal(gameView(w).conditions![0].next_tick_at, t0 + 120);
  w = wait(w, 240);
  assert.equal(hp(w), 6);
  assert.equal(gameView(w).conditions, undefined);
  w = wait(w, 300);
  assert.equal(hp(w), 6);
  // A later entry is a fresh generation, not a refused reapplication.
  w = play(w, { type: 'move', direction: 'west' });
  w = play(w, { type: 'move', direction: 'east' });
  assert.equal(gameView(w).conditions?.length, 1);
  assert.equal(hp(wait(w, 60)), 5);
});

// Breaks: cures are ignored, the cured status keeps draining through its stale job, or the
// antidote is refused at the pool maximum.
test('drinking the antidote ends the poison and its pending tick', () => {
  let w = fresh();
  w = play(w, { type: 'take', item_id: antidote(w) });
  w = withPool(w, 'mv', 100);
  w = play(w, { type: 'move', direction: 'east' });
  w = wait(w, 60);
  assert.equal(hp(w), 9);
  w = withPool(w, 'mv', 100);
  w = play(w, { type: 'eat', item_id: antidote(w) });
  assert.equal(gameView(w).conditions, undefined);
  w = wait(w, 300);
  assert.equal(hp(w), 9);
});

// Breaks: a positive per_tick is applied as a loss or skipped, or the hour-long buff never ends.
test('the shrine blessing adds its amount every tick for an hour', () => {
  let w = withPool(fresh(), 'mv', 50);
  w = play(w, { type: 'move', direction: 'north' });
  assert.equal(mv(w), 49);
  w = wait(w, 600);
  // 49, plus 18/hour standing regen over 600 s (3), plus one 5-point tick.
  assert.equal(mv(w), 57);
  w = wait(w, 3000);
  assert.equal(gameView(w).conditions, undefined);
});

// Breaks: a fatal tick skips the death return, or death leaves a status active on the returned body.
test('a fatal poison tick runs the death return and clears every status', () => {
  let w = fresh();
  w = play(w, { type: 'move', direction: 'north' });
  w = play(w, { type: 'move', direction: 'south' });
  w = withPool(w, 'hp', 1);
  w = play(w, { type: 'move', direction: 'east' });
  assert.equal(gameView(w).conditions?.length, 2);
  w = wait(w, 60);
  assert.equal(hp(w), 10);
  assert.equal(gameView(w).place.title.key, 'room.hall.title');
  assert.equal(gameView(w).conditions, undefined);
});
