// Toolbox row 12 on the compiled traps sampler, content only (mechanics.md traps): a plate on the
// vault threshold poisons the entrant (300 s, -1 hp every 60 s, hp 10) while neither sprung nor
// disarmed and marks itself sprung; the clock_hour reaction re-arms it; a search finds it, a
// failed disarm (skill level 0 < rating 1) poisons the doer, a passed one wedges it for good.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-traps-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/traps_sampler', file], {
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
const ref = (kind: string, k: string) =>
  ({ cartridge_id: 'traps_sampler', cartridge_version: '0.0.1', kind, key: k }) as never;
const fresh = () =>
  newWorld(content, '2c6e1a9b-7d3f-4e5a-8b1c-0f2e4d6a8c1b' as never, [1, 2, 3, 4]);
const poison = (w: World) => {
  const r =
    w.state.statuses?.[key({ kind: 'status', body_id: w.body, status: ref('status', 'poison') })];
  return r && { generation: r.generation, ends_at: r.active ? r.ends_at : undefined };
};
const sprung = (w: World) => value(w, w.character, ref('fact', 'plate_sprung'));
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));

let n = 0;
function run(w: World, payload: object) {
  n += 1;
  const r = step(
    w,
    {
      id: `eeeeeeee-1212-4212-8212-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
  const d = r.decision as { kind: string; outcome?: string; error?: { code: string } };
  return { w: r.world, out: d.kind === 'accepted' ? d.outcome : d.error?.code };
}
const move = (w: World, direction: string) => {
  const r = run(w, { type: 'move', direction });
  assert.equal(r.out, 'moved');
  return r.w;
};
// As the host (mobile/authority/local-story/elapsed.ts): stop at each pending job but the
// calendar job, which runs once in whichever step passes it.
function wait(w: World, target: number): World {
  while (w.state.clock < target) {
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending' && j.job.kind !== 'calendar')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    n += 1;
    const run_id = 'aaaaaaaa-0000-4000-8000-000000000012';
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
    w = r.world;
  }
  return w;
}

// Breaks: the plate's `when` loses its sprung gate (the second crossing at 120 refreshes the
// poison to 420), the spent-state write is dropped (same), or the clock_hour re-arm is missing
// (the crossing after the hour opens no generation 2).
test('the plate poisons the first crossing only, and the hour re-arms it', () => {
  let w = move(fresh(), 'north');
  assert.deepEqual(poison(w), { generation: 1, ends_at: 300 });
  w = wait(move(w, 'south'), 120);
  w = move(w, 'north');
  assert.deepEqual(poison(w), { generation: 1, ends_at: 300 }, 'the spent plate does not fire');
  assert.equal(sprung(w), true);
  w = wait(move(w, 'south'), 3600);
  assert.equal(hp(w), 6, 'ticks at 60, 120, 180, 240; expiry at 300 does not tick');
  assert.equal(sprung(w), false, 'clock_hour re-armed it');
  w = move(w, 'north');
  assert.deepEqual(poison(w), { generation: 2, ends_at: 3900 });
});

// Breaks: the disarm offered before the search, a failed check that poisons nobody (check_failed
// reaction or its subject), the skill check ignoring the rating, or the plate's `when` losing its
// disarmed gate (the crossing at 120 refreshes the poison to 420).
test('a found plate is disarmed by check; a failed attempt poisons the doer', () => {
  let w = fresh();
  const outs: (string | undefined)[] = [];
  for (const action of ['disarm_plate', 'search_floor', 'disarm_plate']) {
    const r = run(w, { type: 'perform', action });
    outs.push(r.out);
    w = r.w;
  }
  assert.deepEqual(outs, ['invalid_state', 'performed', 'failure']);
  assert.deepEqual(poison(w), { generation: 1, ends_at: 300 }, 'the failed disarm poisons');
  const r = run(w, { type: 'perform', action: 'disarm_plate' });
  assert.equal(r.out, 'success');
  w = move(wait(r.w, 120), 'north');
  assert.deepEqual(poison(w), { generation: 1, ends_at: 300 }, 'the disarmed plate does not fire');
  assert.equal(sprung(w), false);
});
