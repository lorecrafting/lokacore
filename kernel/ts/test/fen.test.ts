import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { DeltaOp } from '../src/contracts.gen.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fen-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fen_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}

function load(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function world(edit?: (c: any) => void, context = '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f') {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, context as never, [1, 2, 3, 4]);
}
let n = 0;
// Advances `hour` units (one hour by default) at a time to `until`, keeping each accepted delta.
function elapsed(w: World, until: number, receipts: DeltaOp[][] = [], hour = 100): World {
  while (w.state.clock < until) {
    const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
    const from = w.state.clock;
    const to = Math.min(until, from - (from % hour) + hour);
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, from, to) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id, from, until: to },
      },
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    if (r.decision.kind === 'accepted') receipts.push([...r.decision.delta.ops]);
    w = r.world;
  }
  return w;
}
const DEER = 'fen_sampler@0.0.1:population/deer';
const HOUNDS = 'fen_sampler@0.0.1:population/hounds';
const FEN = 'fen_sampler@0.0.1:room/fen';
function act(w: World, payload: object): World {
  const id = `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}` as never;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const slot = (w: World, plan: string, n: number) =>
  Object.entries(w.state.population_slots!).find(([k]) => {
    const s = JSON.parse(k);
    return (
      s.slot === n &&
      `${s.plan.cartridge_id}@${s.plan.cartridge_version}:population/${s.plan.key}` === plan
    );
  })![1];
// Walks to the plan slot's member and slays it (hp 1, the player's attack always hits).
function slay(w: World, plan: string, n: number): World {
  const id = slot(w, plan, n).member_id!;
  const here = w.state.containers[w.body] === w.roomIds[FEN];
  const there = w.state.containers[id] === w.roomIds[FEN];
  if (here !== there) w = act(w, { type: 'move', direction: here ? 'north' : 'south' });
  w = act(w, { type: 'attack', target_id: id });
  while (slot(w, plan, n).replacement_due === null) w = elapsed(w, w.state.clock + 10, [], 10);
  return w;
}
const alive = (w: World, plan: string, n: number) => slot(w, plan, n).replacement_due === null;

const born = (w: World, plan: string, n: number) => slot(w, plan, n).member_id;

// Breaks: population_count compares with > (one live hound would not hold births), counts a dead
// member (a slain hound would still hold them), or the deer plan ignores birth_when.
test('deer above the floor stay dead while a hound lives and refill once it is slain', () => {
  let w = slay(slay(world(), DEER, 2), DEER, 3);
  w = elapsed(w, 1000);
  assert.ok(!alive(w, DEER, 2) && !alive(w, DEER, 3), 'held past replacement_delay');
  w = slay(w, HOUNDS, 1);
  const at = w.state.clock;
  w = elapsed(w, at - (at % 100) + 100);
  assert.ok(alive(w, DEER, 2) && alive(w, DEER, 3), 'born at the next occurrence');
});

// Breaks: the floor slot waits replacement_delay, or birth_when also holds floor slots.
test('a floor deer slain while the hound lives is reborn at the next wander boundary', () => {
  let w = slay(world(), DEER, 1);
  const dead = born(w, DEER, 1);
  assert.equal(slot(w, DEER, 1).replacement_due, w.state.clock);
  const at = w.state.clock;
  w = elapsed(w, at - (at % 100) + 100);
  assert.ok(alive(w, DEER, 1) && born(w, DEER, 1) !== dead);
  assert.ok(alive(w, HOUNDS, 1));
});

// Breaks: wanders ignores wander_when.
test('a false wander_when keeps every deer where it was born', () => {
  const never = {
    op: 'population_count',
    plan: {
      cartridge_id: 'fen_sampler',
      cartridge_version: '0.0.1',
      kind: 'population',
      key: 'deer',
    },
    at_least: 3,
  };
  const where = (w: World) => [1, 2, 3].map((i) => w.state.containers[born(w, DEER, i)!]);
  const free = elapsed(world(), 150);
  const held = elapsed(
    world((c) => {
      c.populations[DEER].wander_when = { policy_version: 1, root: { op: 'not', item: never } };
    }),
    150,
  );
  assert.ok(
    where(free).some((r) => r !== free.roomIds[FEN]),
    'a free deer wanders',
  );
  assert.deepEqual(
    where(held),
    [1, 2, 3].map(() => held.roomIds[FEN]),
  );
});

// Breaks (loader; twin of test/loka/content_fen_test.exs): population_count under API 1.85, an
// unknown plan, an actor leaf in a gate, or a floor above day_target loads.
test('the loader refuses an old API, an unknown plan, an actor leaf and a high floor', () => {
  const at = `.cartridge.populations["${DEER}"]`;
  for (const [edit, code, path] of [
    [
      (c: any) => (c.manifest.requires.kernel_api.at_least = '1.85'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c: any) => (c.populations[DEER].birth_when.root.item.plan.key = 'nowhere'),
      'UNRESOLVED_REFERENCE',
      `${at}.birth_when.root.item.plan`,
    ],
    [
      (c: any) =>
        (c.populations[DEER].birth_when.root.item = {
          op: 'has_item',
          item: {
            cartridge_id: 'fen_sampler',
            cartridge_version: '0.0.1',
            kind: 'item',
            key: 'tuft',
          },
        }),
      'SCHEMA_VIOLATION',
      `${at}.birth_when`,
    ],
    [(c: any) => (c.populations[DEER].floor = 4), 'SCHEMA_VIOLATION', `${at}.floor`],
  ] as const) {
    const r = load(edit);
    assert.ok(!r.ok && r.diagnostic.code === code && r.diagnostic.path === path, JSON.stringify(r));
  }
});
