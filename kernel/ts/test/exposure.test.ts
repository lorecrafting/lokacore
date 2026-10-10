// Toolbox row W25 on the compiled exposure sampler: 3600 units an hour, 24 hours a day; weather
// clear / frost / heat / rain / gale, weight 1 each; the fell north of the inn is `exposed`; each
// condition (chilled, overheated, soaked, windburnt) lasts 9000 and drains 1 hp every 7200.
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

const scratch = mkdtempSync(join(tmpdir(), 'loka-exposure-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/exposure_sampler', file], {
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

// Oracle, independent of the kernel: for d in 1..5 the first 4 bytes of
// `printf 'weather:<CONTEXT>:<d>' | shasum -a 256`, mod 5: 1, 0, 4, 2, 3 (frost, clear, gale, heat, rain).
const CONTEXT = '7e1f0c2a-5d3b-4c8e-9a6f-000000000003';
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
const id = (w: World, item: string) => w.entityIds[`exposure_sampler@0.0.1:item/${item}`]!;
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));
const labels = (w: World) => gameView(w).conditions?.map((c) => c.label);
const clockJobs = (w: World) =>
  Object.values(w.state.jobs ?? {}).filter((j) => j.job.kind === 'calendar');
const pendingClock = (w: World) => clockJobs(w).filter((j) => j.status === 'pending');

// Breaks: the job reschedules from its own due time (one firing per elapsed hour across later
// settlements), loops inside one settlement, stamps its event at the stale due time, or exists
// in a cartridge with no clock_hour reaction (Chapter 1 would gain a job).
test('a long absence collapses clock_hour to one firing, and the next is the following hour', () => {
  let w = fresh();
  assert.deepEqual(
    pendingClock(w).map((j) => j.due_time),
    [HOUR],
  );
  const r = elapse(w, 10 * HOUR + 1800);
  const fired = r.events.filter((e) => e.payload.type === 'clock_hour') as unknown as {
    logical_time: number;
  }[];
  assert.deepEqual(
    fired.map((e) => e.logical_time),
    [10 * HOUR + 1800],
  );
  w = r.w;
  assert.deepEqual(
    pendingClock(w).map((j) => j.due_time),
    [11 * HOUR],
  );
  const quiet = structuredClone(content) as unknown as Obj;
  for (const k of Object.keys(quiet.reactions))
    if (quiet.reactions[k].on.event === 'clock_hour') delete quiet.reactions[k];
  const other = newWorld(quiet as unknown as Cartridge, CONTEXT as never, [1, 2, 3, 4]);
  assert.deepEqual(clockJobs(other), []);
});

// Breaks: the drain ignores the weather (a clear day chills), the room tag (the inn chills), or
// the clothing; wearing reads carried items (a held cloak stops the frost); the hourly refresh
// is missing (the condition lapses at 9000 on the fell); shelter does not let it lapse.
test('a frosty day on the fell chills a cloakless body; a worn cloak stops it; the inn ends it', () => {
  let w = play(fresh(), { type: 'take', item_id: id(fresh(), 'cloak') });
  w = play(w, { type: 'move', direction: 'north' });
  assert.deepEqual(labels(w), ['condition.chilled'], 'a held cloak is not worn');
  w = wait(w, 2 * 7200);
  assert.equal(hp(w), 8);
  assert.deepEqual(labels(w), ['condition.chilled']);
  w = play(w, { type: 'move', direction: 'south' });
  w = wait(w, 2 * 7200 + 9000);
  assert.equal(hp(w), 7, 'one tick already due before the shelter refresh stops');
  assert.equal(labels(w), undefined);
  w = wait(w, 4 * 7200);
  assert.equal(hp(w), 7);

  let warm = play(fresh(), { type: 'take', item_id: id(fresh(), 'cloak') });
  warm = play(warm, { type: 'wear', item_id: id(warm, 'cloak') });
  warm = play(warm, { type: 'move', direction: 'north' });
  warm = wait(warm, 3 * 7200);
  assert.equal(labels(warm), undefined);
  assert.equal(hp(warm), 10);
});

// Breaks: an expiry and a clock_hour re-application in one settlement merge into a write
// compose_status refuses (active generation 1 to active 2), so the settlement faults
// precondition_failed and the host retries the same step forever. Literals: entering at 1000
// ends at 10000; one advance 9500 to 11000 expires it at 10000 and re-applies it at the committed
// clock 11000 (ends 20000); entering at 1800 ends at 10800, where expiry and the calendar job tie.
test('an expiry and a re-application in one settlement keep one generation', () => {
  const chilled = (w: World) =>
    Object.values(w.state.statuses ?? {}).filter((r) => r.active) as {
      generation: number;
      ends_at: number;
    }[];
  for (const [enter, step] of [
    [1000, (w: World) => elapse(w, 11000).w],
    [1800, (w: World) => wait(w, 10800)],
  ] as const) {
    let w = elapse(fresh(), enter).w;
    w = play(w, { type: 'take', item_id: id(w, 'cloak') });
    w = play(w, { type: 'move', direction: 'north' });
    w = play(w, { type: 'wear', item_id: id(w, 'cloak') });
    w = wait(w, 9500);
    assert.equal(hp(w), 9);
    w = play(w, { type: 'remove', item_id: id(w, 'cloak') });
    w = step(w);
    assert.deepEqual(
      chilled(w).map((r) => r.generation),
      [1],
      `entered at ${enter}`,
    );
    assert.equal(hp(w), 9);
    if (enter === 1000) assert.equal(chilled(w)[0]!.ends_at, 20000);
  }
});

// Breaks: a condition's reaction names the wrong weather, or its label is missing (trap 12).
test('each day of weather gives its own labelled condition on the fell', () => {
  const rows: [number, string[] | undefined][] = [
    [1, ['condition.chilled']],
    [2, undefined],
    [3, ['condition.windburnt']],
    [4, ['condition.overheated']],
    [5, ['condition.soaked']],
  ];
  for (const [day, want] of rows) {
    const w = wait(fresh(), (day - 1) * 24 * HOUR + 1);
    assert.deepEqual(labels(play(w, { type: 'move', direction: 'north' })), want, `day ${day}`);
  }
});

// Breaks: the loader accepts a wearing leaf or a clock_hour reaction below kernel_api 1.46.
test('the loader refuses a wearing leaf or a clock_hour reaction below 1.46', () => {
  const only = (event: string) => (c: Obj) => {
    for (const k of Object.keys(c.reactions)) {
      if (c.reactions[k].on.event !== event) delete c.reactions[k];
      else if (event === 'clock_hour') delete c.reactions[k].when;
    }
  };
  for (const change of [only('entity_entered_room'), only('clock_hour')]) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    c.manifest.requires.kernel_api.at_least = '1.45';
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ]);
  }
});
